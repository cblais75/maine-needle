// build-baseline.mjs — generate any state's county baseline from real past results.
// Usage: node scripts/build-baseline.mjs --out data/oh-baseline.json --file <county_results.csv>
//
// WHY: NC's needle currently runs on a single statewide unit centered on polling. To get a
// real county-by-county needle (like Maine's), we need each county's partisan lean and its
// turnout weight, built from past results. This script does that from a county-level results
// CSV and writes data/nc-baseline.json.
//
// RUN THIS THROUGH DISPATCH (it has open internet). Two ways to feed it data:
//   1) Download NC's official results once, then point at the file:
//        node scripts/build-baseline-nc.mjs --file path/to/nc_results.csv
//   2) Give it a direct URL to a county-level results CSV:
//        node scripts/build-baseline-nc.mjs --url https://.../nc_county_results.csv
//
// Good sources for the file (county-level, presidential + senate):
//   - NC State Board of Elections historical results (dl.ncsbe.gov) — county or precinct CSV
//   - OpenElections NC (github.com/openelections/openelections-data-nc)
//
// The reader is fuzzy about column names. It looks for: county, office/contest, candidate/choice,
// party, votes. It builds the baseline from the PRESIDENTIAL contest by default (most complete);
// pass --office "US SENATE" to use a Senate map instead, or --blend to average President+Senate.
//
// OUTPUT: data/nc-baseline.json = { lean: {County: ±share}, weight: {County: twoPartyVotes}, ... }
// lean is mean-zero across counties (each county's D two-party share minus the statewide share),
// exactly the shape makeNCSenate will consume to replace the single statewide unit.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const OUT = opt("--out");
const FILE = opt("--file");
const URL = opt("--url");
const OFFICE = String(opt("--office", "PRESIDENT")).toUpperCase();
const BLEND = args.includes("--blend");

function parseCSV(text) {
  const rows = [];
  let f = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (f !== "" || row.length) { row.push(f); rows.push(row); row = []; f = ""; } if (c === "\r" && text[i + 1] === "\n") i++; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const findCol = (header, ...cands) => {
  const h = header.map((x) => String(x).toLowerCase().trim());
  for (const c of cands) { const i = h.findIndex((x) => x.includes(c)); if (i >= 0) return i; }
  return -1;
};

async function loadText() {
  if (FILE) return fs.readFileSync(path.resolve(FILE), "utf8");
  if (URL) { const r = await fetch(URL); if (!r.ok) throw new Error("fetch failed " + r.status); return await r.text(); }
  throw new Error("Provide --file <csv> or --url <csv>. See header comment for sources.");
}

function leanFromOffice(rows, header, officeRe) {
  const ci = {
    county: findCol(header, "county"),
    office: findCol(header, "contest", "office"),
    cand: findCol(header, "candidate", "choice", "name"),
    party: findCol(header, "party", "choice party"),
    votes: findCol(header, "total votes", "votes", "count"),
  };
  if (ci.county < 0 || ci.votes < 0) throw new Error("Could not find county/votes columns. Headers: " + header.join(" | "));
  const acc = {};
  for (const r of rows) {
    if (ci.office >= 0 && !officeRe.test(String(r[ci.office] || ""))) continue;
    const county = String(r[ci.county] || "").trim();
    if (!county) continue;
    const party = String(r[ci.party] >= 0 ? r[ci.party] : "").toUpperCase();
    const cand = String(ci.cand >= 0 ? r[ci.cand] : "");
    const votes = Number(String(r[ci.votes]).replace(/[^0-9.-]/g, "")) || 0;
    let side = null;
    if (party.startsWith("DEM")) side = "dem";
    else if (party.startsWith("REP")) side = "rep";
    else if (/biden|harris|cooper|cunningham/i.test(cand)) side = "dem";
    else if (/trump|tillis|whatley|budd/i.test(cand)) side = "rep";
    if (!side) continue;
    acc[county] = acc[county] || { dem: 0, rep: 0 };
    acc[county][side] += votes;
  }
  return acc;
}

function toLeanWeight(acc) {
  const lean = {}, weight = {};
  let demAll = 0, repAll = 0;
  for (const v of Object.values(acc)) { demAll += v.dem; repAll += v.rep; }
  const stateShare = demAll / (demAll + repAll || 1);
  for (const [co, v] of Object.entries(acc)) {
    const tp = v.dem + v.rep;
    if (tp <= 0) continue;
    lean[co] = v.dem / tp - stateShare;
    weight[co] = tp;
  }
  return { lean, weight, stateShare };
}

(async () => {
  const text = await loadText();
  const rows = parseCSV(text).filter((r) => r.length > 1);
  const header = rows.shift();
  const pres = toLeanWeight(leanFromOffice(rows, header, /president/i));
  let out = pres;
  if (BLEND) {
    const sen = toLeanWeight(leanFromOffice(rows, header, /senat/i));
    const lean = {}, weight = pres.weight;
    for (const co of Object.keys(pres.lean)) {
      lean[co] = sen.lean[co] != null ? (pres.lean[co] + sen.lean[co]) / 2 : pres.lean[co];
    }
    out = { lean, weight, stateShare: pres.stateShare };
  } else if (OFFICE !== "PRESIDENT") {
    out = toLeanWeight(leanFromOffice(rows, header, new RegExp(OFFICE.replace(/\s+/g, ".*"), "i")));
  }
  const counties = Object.keys(out.lean).sort();
  const baseline = {
    builtAt: new Date().toISOString(),
    source: FILE ? `file:${path.basename(FILE)}` : URL,
    basis: BLEND ? "president+senate blend" : OFFICE.toLowerCase(),
    statewideDemTwoParty: Number(out.stateShare.toFixed(4)),
    nCounties: counties.length,
    lean: Object.fromEntries(counties.map((c) => [c, Number(out.lean[c].toFixed(4))])),
    weight: Object.fromEntries(counties.map((c) => [c, out.weight[c]])),
  };
  if (!OUT) throw new Error("Provide --out data/<state>-baseline.json");
  const dest = path.isAbsolute(OUT) ? OUT : path.join(ROOT, OUT);
  fs.writeFileSync(dest, JSON.stringify(baseline, null, 2));
  console.log(`Wrote ${dest}`);
  console.log(`Counties: ${counties.length} · statewide D two-party: ${(out.stateShare * 100).toFixed(1)}%`);
  if (counties.length && counties.length < 10) console.log("NOTE: very few counties parsed — check the source file / column matching before using.");
})();
