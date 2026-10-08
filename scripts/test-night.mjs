// test-night.mjs — election-night stress-test harness.
// Fabricates a synthetic night for the eight county-mapped states (NC, OH, TX, IA, GA, NE, MI, NH).
// Each state's fake returns are written as a realistic, messy DOWNLOAD FILE in that state's own
// layout (NC-style tab file with State Senate rows mixed in, Clarity XML, Michigan-style tab file,
// Ohio-style wide spreadsheet, CSV with "County" suffixes and odd capitalization...) and then run
// through the REAL reader + aggregator — the exact code election night uses — at midterm turnout.
// It writes public/results.json snapshots the app picks up.
//
//   node scripts/test-night.mjs --frac 0.4          one snapshot at 40% reporting
//   node scripts/test-night.mjs --auto --minutes 30 full night, 0 -> 100%, rewriting every 20s
//   node scripts/test-night.mjs --reset             restore the dormant simulation file
//
// Run the app locally (npm run dev) while --auto runs, or push a snapshot and point
// TEST_RESULTS_URL at it to test the hosted site. Swings are random each run, so every
// test night is a different election. Deterministic per run via --seed N.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import * as XLSX from "xlsx";
import { aggregate } from "./lib/aggregate.mjs";
import { readFeed } from "./lib/read-feed.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "results.json");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };

if (has("--reset")) {
  fs.writeFileSync(OUT, JSON.stringify({ updated: null, source: "simulation", races: {} }, null, 2));
  console.log("reset -> dormant simulation file");
  process.exit(0);
}

// mulberry32 — seedable RNG so a run can be reproduced
let seed = val("--seed", Math.floor(Math.random() * 1e9));
const rng = (() => { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

const STATES = [
  { state: "NC", office: "U.S. Senate", dem: "Cooper",   rep: "Whatley",  baseline: "nc-baseline.json" },
  { state: "OH", office: "U.S. Senate", dem: "Brown",    rep: "Husted",   baseline: "oh-baseline.json" },
  { state: "TX", office: "U.S. Senate", dem: "Talarico", rep: "Paxton",   baseline: "tx-baseline.json" },
  { state: "IA", office: "U.S. Senate", dem: "Turek",    rep: "Hinson",   baseline: "ia-baseline.json" },
  { state: "GA", office: "U.S. Senate", dem: "Ossoff",   rep: "Collins",  baseline: "ga-baseline.json" },
  { state: "NE", office: "U.S. Senate", dem: "Osborn",   rep: "Ricketts", baseline: "ne-baseline.json" },
  { state: "MI", office: "U.S. Senate", dem: "El-Sayed", rep: "Rogers",   baseline: "mi-baseline.json" },
  { state: "NH", office: "U.S. Senate", dem: "Pappas",   rep: "Sununu",   baseline: "nh-baseline.json" },
];

// One synthetic "truth" per run: statewide swing per state, county noise, county report order.
const night = STATES.map((s) => {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data", s.baseline), "utf8"));
  const counties = Object.keys(b.lean).map((name) => ({
    name,
    weight: b.weight[name],
    demShare: Math.min(0.97, Math.max(0.03, b.statewideDemTwoParty + b.lean[name] + (rng() - 0.5) * 0.06)),
    order: rng(),           // when this county starts reporting (staggered like a real night)
    speed: 0.6 + rng() * 0.8, // how fast it counts once it starts
  }));
  return { ...s, swing: (rng() - 0.5) * 0.08, counties };
});

const TURNOUT = { NC: 0.66, OH: 0.72, TX: 0.71, IA: 0.73, GA: 0.75, NE: 0.72, MI: 0.79, NH: 0.76 }; // 2022 turnout vs 2024

// Per-state fake counts for this moment of the night.
function snapshotCounts(frac) {
  const perState = {};
  for (const s of night) {
    const list = [];
    for (const c of s.counties) {
      const local = Math.min(1, Math.max(0, (frac - c.order * 0.7) * (1.6 * c.speed)));
      if (local <= 0) continue;
      const turnout = Math.round(c.weight * TURNOUT[s.state] * local);
      const demShare = Math.min(0.97, Math.max(0.03, c.demShare + s.swing));
      const row = { county: c.name, dem: Math.round(turnout * demShare), rep: Math.round(turnout * (1 - demShare)), local };
      if (s.state === "TX") { // Texas also counts its governor race (Update 49), running a little redder than the Senate race
        const gShare = Math.min(0.97, Math.max(0.03, demShare - 0.015));
        row.gdem = Math.round(turnout * gShare); row.grep = Math.round(turnout * (1 - gShare));
      }
      list.push(row);
    }
    perState[s.state] = list;
  }
  return perState;
}

// Write each state's counts in a different real-world layout, as bytes, like a download.
const esc = (v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
function asFile(s, list) {
  const enc = (t) => new TextEncoder().encode(t);
  if (s.state === "NC") { // NC SBE results_pct: tab-delimited, precinct rows, every contest on the ballot
    const out = ["County\tElection Date\tPrecinct\tContest Group ID\tContest Type\tContest Name\tChoice\tChoice Party\tVote For\tElection Day\tEarly Voting\tAbsentee by Mail\tProvisional\tTotal Votes\tReal Precinct"];
    for (const c of list) for (const half of [0.4, 0.6]) {
      out.push([c.county, "11/03/2026", "P1" + half, "1", "S", "US SENATE", "Roy Cooper", "DEM", "1", "0", "0", "0", "0", Math.round(c.dem * half), "Y"].join("\t"));
      out.push([c.county, "11/03/2026", "P1" + half, "1", "S", "US SENATE", "Michael Whatley", "REP", "1", "0", "0", "0", "0", Math.round(c.rep * half), "Y"].join("\t"));
      out.push([c.county, "11/03/2026", "P1" + half, "9", "S", "NC STATE SENATE DISTRICT 05", "Somebody", "DEM", "1", "0", "0", "0", "0", 5000, "Y"].join("\t"));
    }
    return enc(out.join("\n"));
  }
  if (s.state === "IA" || s.state === "GA") { // Clarity detail XML, split by vote type, with precincts reporting
    const cty = (f) => list.map((c) => `<County name="${c.county}" votes="${f(c)}" />`).join("");
    const part = list.map((c) => `<County name="${c.county}" precinctsParticipating="20" precinctsReported="${Math.round(20 * c.local)}" />`).join("");
    const ch = (name, party, key) => `<Choice key="1" text="${name}" party="${party}"><VoteType name="Election Day">${cty((c) => Math.round(c[key] * 0.7))}</VoteType><VoteType name="Absentee">${cty((c) => c[key] - Math.round(c[key] * 0.7))}</VoteType></Choice>`;
    return enc(`<?xml version="1.0"?><ElectionResult><Contest key="1" text="United States Senator" voteFor="1"><ParticipatingCounties>${part}</ParticipatingCounties>${ch(s.dem, "DEM", "dem")}${ch(s.rep, "REP", "rep")}</Contest><Contest key="2" text="State Senator Dist. 3"><Choice key="9" text="X" party="DEM"><VoteType name="Election Day">${cty(() => 9999)}</VoteType></Choice></Contest></ElectionResult>`);
  }
  if (s.state === "MI") { // Michigan county file: tab-delimited, split first/last names, "ST. CLAIR"
    const out = ["ElectionDate\tOfficeCode\tDistrictCode\tStatusCode\tCountyCode\tCountyName\tOfficeDescription\tPartyOrder\tPartyName\tPartyDescription\tCandidateID\tCandidateLastName\tCandidateFirstName\tCandidateMiddleName\tCandidateFormerName\tCandidateVotes\tWriteIn(W)/Uncommitted(Z)\tRecount(*)"];
    for (const c of list) {
      out.push(["11/3/2026", "5", "0", "0", "1", c.county.toUpperCase(), "U.S. Senator 6 Year Term (1) Position", "1", "DEM", "Democratic", "1", "El-Sayed", "Abdul", "", "", c.dem, "", ""].join("\t"));
      out.push(["11/3/2026", "5", "0", "0", "1", c.county.toUpperCase(), "U.S. Senator 6 Year Term (1) Position", "2", "REP", "Republican", "2", "Rogers", "Mike", "", "", c.rep, "", ""].join("\t"));
      out.push(["11/3/2026", "7", "0", "0", "1", c.county.toUpperCase(), "State Senator 4 Year Term (1) Position", "1", "DEM", "Democratic", "3", "Else", "Some", "", "", 7777, "", ""].join("\t"));
    }
    return enc(out.join("\n"));
  }
  if (s.state === "OH") { // Ohio-style wide workbook: counties down the side, candidates across, merged office title,
    // a Total and a Percentage column per candidate, and the SAME race repeated on a "Master" summary sheet
    const aoa = [["2026 General Election — Official Canvass"], ["", "U.S. Senator", "", "", "", "State Senator 12"],
      ["", "Sherrod Brown (D)", "", "Jon Husted (R)", "", "Some One (D)"], ["County", "Total", "Percentage", "Total", "Percentage", "Total"]];
    for (const c of list) aoa.push([c.county, c.dem, c.dem / (c.dem + c.rep), c.rep, c.rep / (c.dem + c.rep), 4444]);
    aoa.push(["Total", 1, 1, 1, 1, 1]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Master");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "U.S. Senator");
    return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  }
  if (s.state === "TX") { // Texas results site County.json: keyed by county code, then race, then candidate
    const obj = {};
    list.forEach((c, i) => {
      obj[String(48001 + 2 * i)] = { N: c.county.toUpperCase(), TV: 1, C: "#19b90f", Summary: { PRR: Math.round(20 * c.local), PRP: 20 },
        Races: { 1001: { OID: 1001, ON: "U. S. SENATOR ", T: c.dem + c.rep, C: {
          9240: { id: 9240, N: "JAMES TALARICO", P: "DEM", V: c.dem }, 9241: { id: 9241, N: "KEN PAXTON", P: "REP", V: c.rep }, 9242: { id: 9242, N: "WRITE-IN", P: "W", V: 3 } } },
          1002: { OID: 1002, ON: "GOVERNOR", T: c.gdem + c.grep, C: {
            9250: { id: 9250, N: "GINA HINOJOSA", P: "DEM", V: c.gdem }, 9251: { id: 9251, N: "GREG ABBOTT", P: "REP", V: c.grep }, 9252: { id: 9252, N: "PAT DIXON", P: "LIB", V: 4 } } },
          1003: { OID: 1003, ON: "LIEUTENANT GOVERNOR", C: { 9260: { id: 9260, N: "SOMEONE", P: "DEM", V: 6666 }, 9261: { id: 9261, N: "DAN PATRICK", P: "REP", V: 7777 } } }, // must NOT count as governor
          2001: { OID: 2001, ON: "STATE SENATOR, DISTRICT 1", C: { 1: { id: 1, N: "X", P: "DEM", V: 5555 } } } } };
    });
    return enc(JSON.stringify(obj));
  }
  if (s.state === "NE") { // Nebraska results web service: { d: [ ...one object per county per candidate... ] }
    const d = [];
    for (const c of list) {
      const base = { __type: "MapData:#NEResultsWebService", CountyName: c.county[0] + c.county.slice(1).toLowerCase(), RaceName: "For United States Senator - 6  Year Term", PrecinctsReporting: Math.round(10 * c.local), TotalPrecincts: 10 };
      d.push({ ...base, PartyCode: "IND", calcCandidate: "Dan  Osborn ", calcCandidatePercentage: 0.5, calcCandidateVotes: c.dem });
      d.push({ ...base, PartyCode: "REP", calcCandidate: "Pete  Ricketts ", calcCandidatePercentage: 0.5, calcCandidateVotes: c.rep });
      d.push({ ...base, PartyCode: "DEM", calcCandidate: "Cindy  Burbank ", calcCandidatePercentage: 0.01, calcCandidateVotes: 50 }); // must NOT count for Osborn
    }
    return enc(JSON.stringify({ d }));
  }
  // everyone else (New Hampshire in this test): plain CSV with "Adams County" style names and shouting capitals
  const out = ["County,Office,Party,Candidate,Votes"];
  for (const c of list) {
    const nm = c.county.toUpperCase() + " COUNTY";
    out.push([nm, "U. S. SENATOR", "DEM", s.dem, c.dem].map(esc).join(","));
    out.push([nm, "U. S. SENATOR", "REP", s.rep, c.rep].map(esc).join(","));
    out.push([nm, "STATE SENATOR, DISTRICT 4", "DEM", "Someone", 3333].map(esc).join(","));
  }
  out.push(["TOTAL", "U. S. SENATOR", "DEM", s.dem, 99999999].map(esc).join(","));
  return enc(out.join("\r\n"));
}

function writeSnapshot(frac) {
  const races = {};
  const counts = snapshotCounts(frac);
  const problems = [];
  for (const s of night) {
    const rows = readFeed(asFile(s, counts[s.state]), s.state);     // <-- the real reader
    const out = aggregate(rows, s.state);                            // <-- the real aggregator
    Object.assign(races, out.races || {});
    // check nothing was lost or added on the way through, for every race in the state
    const sum = (a, k) => a.reduce((t, x) => t + (x[k] || 0), 0);
    const list = counts[s.state];
    const expect = s.state === "TX"
      ? { tx_sen: list, tx_gov: list.map((c) => ({ dem: c.gdem, rep: c.grep })) }
      : { [Object.keys(out.races)[0] || s.state]: list };
    for (const [id, want] of Object.entries(expect)) {
      const got = out.races[id] ? Object.values(out.races[id].counties) : [];
      if (want.length && (got.length !== want.length || Math.abs(sum(got, "dem") - sum(want, "dem")) > want.length || Math.abs(sum(got, "rep") - sum(want, "rep")) > want.length))
        problems.push(`${s.state} ${id}: expected ${want.length} counties / D ${sum(want, "dem")} R ${sum(want, "rep")}, got ${got.length} / D ${sum(got, "dem")} R ${sum(got, "rep")}`);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({
    updated: new Date().toISOString(),
    source: `stress-test (seed ${seed}, ${(frac * 100).toFixed(0)}% in)`,
    races,
  }, null, 2));
  console.log(`wrote snapshot at ${(frac * 100).toFixed(0)}% in (seed ${seed})` + (problems.length ? "\n  PROBLEMS:\n  " + problems.join("\n  ") : "  - all 8 states read correctly (plus the Texas governor race)"));
}

if (has("--auto")) {
  const minutes = val("--minutes", 30);
  const stepMs = 20000;
  const steps = Math.max(2, Math.round((minutes * 60000) / stepMs));
  console.log(`auto night: 0 -> 100% over ${minutes} min (${steps} snapshots, every 20s). Ctrl-C to stop.`);
  let i = 0;
  writeSnapshot(0.02);
  const t = setInterval(() => {
    i++;
    writeSnapshot(Math.min(1, i / steps));
    if (i >= steps) { clearInterval(t); console.log("night complete - run --reset when done."); }
  }, stepMs);
} else {
  writeSnapshot(Math.min(1, Math.max(0, val("--frac", 0.5))));
}
