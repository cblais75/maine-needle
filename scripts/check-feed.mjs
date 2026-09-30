// check-feed.mjs — test a state's REAL results download against the needle, before election night.
//
//   node scripts/check-feed.mjs --state NC --url "https://.../results_pct_20241105.zip" --office "PRESIDENT" --dem harris --rep trump
//   node scripts/check-feed.mjs --state MI --file downloads/2024GEN_MI_CENR_BY_COUNTY.xls --office "PRESIDENT" --dem harris --rep trump
//   node scripts/check-feed.mjs --state IA --url "https://.../{ver}/reports/detailxml.zip"      (U.S. Senate, 2026 names)
//   node scripts/check-feed.mjs --state NH --url "https://www.sos.nh.gov/2024-general-election-results" --office governor --dem craig --rep ayotte
//       (a results WEB PAGE: the spreadsheets for our offices are found and read automatically)
//
// --office/--dem/--rep let you test on a PAST election (like the 2024 President race), since our
// 2026 candidates aren't on any ballot yet. Leave them off to test the real 2026 U.S. Senate setup.
// Prints a PASS/FAIL verdict plus everything needed to fix a FAIL.
import fs from "node:fs";
import { readFeed } from "./lib/read-feed.mjs";
import { aggregate } from "./lib/aggregate.mjs";
import { fetchRows } from "./lib/fetch-rows.mjs";
import COUNTIES from "./lib/counties.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const state = (opt("--state") || "").toUpperCase();
if (!COUNTIES[state] || (!opt("--url") && !opt("--file"))) {
  console.log("Usage: node scripts/check-feed.mjs --state NC --url <link> | --file <path>  [--office PRESIDENT --dem harris --rep trump]");
  process.exit(1);
}
const t0 = Date.now();
let rows, where, size = 0, files = [];
try {
  if (opt("--file")) {
    const buf = new Uint8Array(fs.readFileSync(opt("--file"))); size = buf.length; where = opt("--file");
    rows = readFeed(buf, state, where); files = [where];
  } else {
    where = opt("--url");
    ({ rows, files } = await fetchRows(where, state));
  }
} catch (e) { console.log(`FAIL: could not download or read: ${e.message}`); process.exit(2); }
const t1 = Date.now();
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
console.log(`files read: ${files.length}${files.length > 1 || !opt("--file") ? "\n  " + files.join("\n  ") : ""}${size ? `\nsize: ${(size / 1e6).toFixed(1)} MB` : ""}\ntime ${((t2 - t0) / 1000).toFixed(1)}s   rows ${rows.length}`);
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
