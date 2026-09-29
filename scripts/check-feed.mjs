// check-feed.mjs — test a state's REAL results download against the needle, before election night.
//
//   node scripts/check-feed.mjs --state NC --url "https://.../results_pct_20241105.zip" --office "PRESIDENT" --dem harris --rep trump
//   node scripts/check-feed.mjs --state MI --file downloads/2024GEN_MI_CENR_BY_COUNTY.xls --office "PRESIDENT" --dem harris --rep trump
//   node scripts/check-feed.mjs --state IA --url "https://.../{ver}/reports/detailxml.zip"      (U.S. Senate, 2026 names)
//
// --office/--dem/--rep let you test on a PAST election (like the 2024 President race), since our
// 2026 candidates aren't on any ballot yet. Leave them off to test the real 2026 U.S. Senate setup.
// Prints a PASS/FAIL verdict plus everything needed to fix a FAIL.
import fs from "node:fs";
import { readFeed } from "./lib/read-feed.mjs";
import { aggregate } from "./lib/aggregate.mjs";
import { resolveUrl } from "../api/results.js";
import COUNTIES from "./lib/counties.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const state = (opt("--state") || "").toUpperCase();
if (!COUNTIES[state] || (!opt("--url") && !opt("--file"))) {
  console.log("Usage: node scripts/check-feed.mjs --state NC --url <link> | --file <path>  [--office PRESIDENT --dem harris --rep trump]");
  process.exit(1);
}
const t0 = Date.now();
let buf, where;
if (opt("--file")) { buf = new Uint8Array(fs.readFileSync(opt("--file"))); where = opt("--file"); }
else {
  where = await resolveUrl(opt("--url"));
  const r = await fetch(where, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TheNeedleProject/1.0)" } });
  if (!r.ok) { console.log(`FAIL: download returned HTTP ${r.status} for ${where}`); process.exit(2); }
  buf = new Uint8Array(await r.arrayBuffer());
}
const t1 = Date.now();
let rows;
try { rows = readFeed(buf, state, where); }
catch (e) { console.log(`FAIL: could not read the file: ${e.message}`); process.exit(2); }
const t2 = Date.now();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const options = opt("--office") ? {
  office: new RegExp(esc(opt("--office")), "i"),
  names: { ...(opt("--dem") ? { dem: new RegExp(esc(opt("--dem")), "i") } : {}), ...(opt("--rep") ? { rep: new RegExp(esc(opt("--rep")), "i") } : {}) },
} : {};
const out = aggregate(rows, state, options);
const all = COUNTIES[state];
const race = Object.values(out.races)[0];
const got = race ? Object.keys(race.counties) : [];
const sum = (k) => got.reduce((t, c) => t + (race.counties[c][k] || 0), 0);
const missing = all.filter((c) => !got.includes(c));

console.log(`\n=== ${state} feed check ===`);
console.log(`file: ${where}`);
console.log(`size: ${(buf.length / 1e6).toFixed(1)} MB   download ${((t1 - t0) / 1000).toFixed(1)}s   read ${((t2 - t1) / 1000).toFixed(1)}s   rows ${rows.length}`);
console.log(`sample row: ${JSON.stringify(rows.find((r) => r.county || r.town) || rows[0] || null)}`);
console.log(`race matched: ${race ? "yes" : "NO"}   counties matched: ${got.length} of ${all.length}`);
if (race) console.log(`statewide totals: Dem side ${sum("dem").toLocaleString()}   Rep side ${sum("rep").toLocaleString()}   (compare to the official totals)`);
if (race && got.some((c) => race.counties[c].pt)) console.log("precincts-reporting info: yes");
if (missing.length) console.log(`counties with no votes found: ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? " ..." : ""}`);
if (out._diag.unmatchedPlaces.length) console.log(`place names in the file we could not match: ${out._diag.unmatchedPlaces.join(" | ")}`);
if (out._diag.rowsWithUnknownSide) console.log(`rows in the race with no recognized party/candidate: ${out._diag.rowsWithUnknownSide}`);
if (!race) console.log(`other contests seen (first 12): ${out._diag.otherOfficesSample.join(" | ")}`);
const pass = race && missing.length === 0 && (t2 - t0) < 20000;
console.log(pass ? "\nVERDICT: PASS" : `\nVERDICT: FAIL${!race ? " (race not found)" : missing.length ? " (missing counties)" : " (too slow)"}`);
process.exit(pass ? 0 : 3);
