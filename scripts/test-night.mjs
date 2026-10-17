// test-night.mjs — election-night stress-test harness.
// Fabricates a synthetic night for the ten county-mapped states (NC, OH, TX, IA, GA, NE, MI, NH, KS, MN).
// Each state's fake returns are written as a realistic, messy DOWNLOAD FILE in that state's own
// layout (NC-style tab file with State Senate rows mixed in, Clarity XML, Michigan-style tab file,
// Ohio-style wide spreadsheet, CSV with "County" suffixes and odd capitalization, Kansas's results
// web page with the votes inside the county map's hover boxes, Minnesota's headerless ';' file with
// numeric county codes...) and then run
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
import { gateResults } from "./lib/results-gate.mjs";
import { simulatedPreview } from "./lib/night-preview.mjs";
import { runoffStatus, otherShare, RUNOFF_RACES } from "./lib/runoff.mjs";
import { buildPayload } from "../api/results.js";

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
  { state: "KS", office: "United States Senate", dem: "Hamilton", rep: "Marshall", baseline: "ks-baseline.json" },
  { state: "MN", office: "U.S. Senator", dem: "Flanagan", rep: "Tafoya", baseline: "mn-baseline.json" },
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

const TURNOUT = { NC: 0.66, OH: 0.72, TX: 0.71, IA: 0.73, GA: 0.75, NE: 0.72, MI: 0.79, NH: 0.76, KS: 0.76, MN: 0.78 }; // 2022 turnout vs 2024

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
      if (["TX", "OH", "GA", "IA", "KS"].includes(s.state)) { // governor races (TX Update 49; OH, GA Update 61; IA, KS Update 63), a little redder than the Senate race
        const gShare = Math.min(0.97, Math.max(0.03, demShare - 0.015));
        row.gdem = Math.round(turnout * gShare); row.grep = Math.round(turnout * (1 - gShare));
      }
      if (s.state === "GA") { row.oth = Math.round(turnout * 0.025); row.goth = Math.round(turnout * 0.02); } // Libertarians (runoff rule, Updates 57 and 61)
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
    return enc(`<?xml version="1.0"?><ElectionResult><Contest key="1" text="United States Senator" voteFor="1"><ParticipatingCounties>${part}</ParticipatingCounties>${ch(s.dem, "DEM", "dem")}${ch(s.rep, "REP", "rep")}${s.state === "GA" ? ch("Chase Oliver", "LIB", "oth") : ""}</Contest>${s.state === "GA" ? `<Contest key="3" text="Governor" voteFor="1"><ParticipatingCounties>${part}</ParticipatingCounties>${ch("Keisha Lance Bottoms", "DEM", "gdem")}${ch("Rick Jackson", "REP", "grep")}${ch("Some Libertarian", "LIB", "goth")}</Contest><Contest key="4" text="Lieutenant Governor"><Choice key="8" text="Burt Jones" party="REP"><VoteType name="Election Day">${cty(() => 7777)}</VoteType></Choice></Contest>` : ""}${s.state === "IA" ? `<Contest key="3" text="Governor/Lieutenant Governor" voteFor="1"><ParticipatingCounties>${part}</ParticipatingCounties>${ch("Rob Sand", "DEM", "gdem")}${ch("Zach Lahn", "REP", "grep")}<Choice key="7" text="Sondra Wilson" party="NP"><VoteType name="Election Day">${cty(() => 33)}</VoteType></Choice></Contest><Contest key="4" text="Lieutenant Governor"><Choice key="8" text="Someone" party="REP"><VoteType name="Election Day">${cty(() => 7777)}</VoteType></Choice></Contest>` : ""}<Contest key="2" text="State Senator Dist. 3"><Choice key="9" text="X" party="DEM"><VoteType name="Election Day">${cty(() => 9999)}</VoteType></Choice></Contest></ElectionResult>`);
  }
  if (s.state === "MI") { // Michigan Voter Information Center download (Update 60): MVIC GetElectionResultFile, the old
    // CENR_BY_COUNTY layout. A "TOTAL VOTER TURNOUT" line comes before the header; no precincts-reporting column;
    // a governor race and "DISTRICT STATE SENATOR" rows are mixed in and must NOT count for the Senate race.
    const H = ["ElectionDate", "OfficeCode", "DistrictCode", "StatusCode", "CountyCode", "CountyName", "OfficeDescription", "PartyOrder", "PartyDescription", "CandidateID",
      "CandidateLastName", "CandidateFirstName", "CandidateMiddleName", "CandidateFormerName", "CandidateVotes", "WriteIn(W)/Uncommitted(Z)", "Recount(*)", "Nominated(N)/Elected(E)"];
    const row = (c, i, code, office, order, party, id, last, first, votes) => ["11/3/2026", code, "0", "0", String(i + 1).padStart(2, "0"), c.county.toUpperCase(), office, order, party, id, last, first, "", "", votes, "", "", ""].join(String.fromCharCode(9));
    const out = ["TOTAL VOTER TURNOUT" + String.fromCharCode(9) + "4,321,987", H.join(String.fromCharCode(9))];
    list.forEach((c, i) => {
      out.push(row(c, i, "5", "UNITED STATES SENATOR 6 YEAR TERM (1) POSITION", "1", "Democratic", "101", "EL-SAYED", "ABDUL", c.dem));
      out.push(row(c, i, "5", "UNITED STATES SENATOR 6 YEAR TERM (1) POSITION", "2", "Republican", "102", "ROGERS", "MIKE", c.rep));
      out.push(row(c, i, "5", "UNITED STATES SENATOR 6 YEAR TERM (1) POSITION", "3", "Libertarian", "103", "CHRISTENSEN", "LYDIA", 11));
      out.push(row(c, i, "2", "GOVERNOR 4 YEAR TERM (1) POSITION", "1", "Democratic", "201", "BENSON", "JOCELYN", 8888));
      out.push(row(c, i, "7", "DISTRICT STATE SENATOR 4 YEAR TERM (1) POSITION", "1", "Democratic", "301", "ELSE", "SOME", 7777));
    });
    return enc(out.join(String.fromCharCode(13, 10)));
  }
  if (s.state === "OH") { // Ohio-style wide workbook: counties down the side, candidates across, merged office title,
    // a Total and a Percentage column per candidate, and the SAME race repeated on a "Master" summary sheet
    // Governor (Update 61): Ohio's contest is "Governor and Lieutenant Governor"; it's on the Master sheet and its own sheet.
    const aoa = [["2026 General Election — Official Canvass"], ["", "U.S. Senator", "", "", "", "State Senator 12", "Governor and Lieutenant Governor", "", ""],
      ["", "Sherrod Brown (D)", "", "Jon Husted (R)", "", "Some One (D)", "Amy Acton (D)", "Vivek Ramaswamy (R)", "Donald Kissick (L)"],
      ["County", "Total", "Percentage", "Total", "Percentage", "Total", "Total", "Total", "Total"]];
    for (const c of list) aoa.push([c.county, c.dem, c.dem / (c.dem + c.rep), c.rep, c.rep / (c.dem + c.rep), 4444, c.gdem, c.grep, 5]);
    aoa.push(["Total", 1, 1, 1, 1, 1, 1, 1, 1]);
    const sen = aoa.map((r) => r.slice(0, 6)), gov = aoa.map((r) => [r[0], ...r.slice(6)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Master");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sen), "U.S. Senator");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gov), "Governor");
    return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  }
  if (s.state === "TX") { // Texas's new Civix results API (Update 59): .../s3/enr/election/countyInfo/<id> answers
    // { "upload": "<base64 JSON>" }; inside, counties keyed 1..254 with races, candidates and precincts reporting.
    // Lieutenant Governor and a State Senate race are mixed in and must NOT count.
    const obj = {};
    list.forEach((c, i) => {
      obj[String(i + 1)] = { N: c.county.toUpperCase(), TV: 1, C: "#19b90f", Summary: { PRR: Math.round(20 * c.local), PRP: 20 },
        Races: {
          43: { OID: 43, N: "U. S. SENATOR ", T: c.dem + c.rep, PR: Math.round(20 * c.local), TP: 20, C: {
            9240: { id: 9240, N: "JAMES TALARICO", P: "DEM", V: c.dem }, 9241: { id: 9241, N: "KEN PAXTON", P: "REP", V: c.rep }, 9242: { id: 9242, N: "TED BROWN", P: "L", V: 3 } } },
          9: { OID: 9, N: "GOVERNOR", T: c.gdem + c.grep, C: {
            9250: { id: 9250, N: "GINA HINOJOSA", P: "DEM", V: c.gdem }, 9251: { id: 9251, N: "GREG ABBOTT (I)", P: "REP", V: c.grep }, 9252: { id: 9252, N: "PAT DIXON", P: "L", V: 4 } } },
          10: { OID: 10, N: "LIEUTENANT GOVERNOR", C: { 9260: { id: 9260, N: "SOMEONE", P: "DEM", V: 6666 }, 9261: { id: 9261, N: "DAN PATRICK (I)", P: "REP", V: 7777 } } }, // must NOT count as governor
          201: { OID: 201, N: "STATE SENATOR, DISTRICT 1", C: { 1: { id: 1, N: "X", P: "DEM", V: 5555 } } } } };
    });
    return enc(JSON.stringify({ upload: Buffer.from(JSON.stringify(obj)).toString("base64") }));
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
  if (s.state === "KS") { // Kansas results page (sos.ks.gov/ent/kssos_ent.html): one block per race, each county's
    // votes inside the map's hover-box title attribute, party-prefixed names and a Libertarian. A primary-style
    // "(R)" Senate title and a U.S. House race are mixed in and must NOT count.
    const tip = (c, cands) => `<area shape='poly' coords='1,2,3,4' class="tooltip" href='${c.county.toLowerCase()}.html#top' alt='${c.county}' title="<table style='border-collapse: collapse;' cellpadding='0'><tr><td align='left' colspan='2'><span class='county'>${c.county} County</span><br/>${Math.round(20 * c.local)} of 20 precincts reporting</td></tr><tr><td>Candidate</td><td>Votes</td></tr><tr><td colspan='2'><hr/></td><tr>`
      + cands.map(([n, v]) => `<tr><td style='padding-right:15px'>${n}</td><td style='text-align:right'>${Number(v).toLocaleString("en-US")}</td></tr>`).join(" ") + `</table>" />`;
    const race = (title, f) => [`<div class='race'>`, `<div class='row race-heading'><div class='col-11'>`, `<h3>${title}</h3>`, `</div></div>`,
      `<map name='Map1' id='Map1'>`, ...list.map((c) => tip(c, f(c))), `</map>`, `</div><!--end of .race -->`].join("\n");
    return enc(["﻿<!DOCTYPE html>", `<html lang="en"><head><title>Unofficial Kansas Election Results</title></head><body>`,
      race("United States Senate", (c) => [["R-Roger Marshall", c.rep], ["D-Adam Hamilton", c.dem], ["L-David Graham", 222]]),
      race("United States Senate (R)", () => [["R-Roger Marshall", 8888], ["R-Pond Naramore", 1111]]),
      // Governor (Update 63): Kansas's ticket is "Governor / Lt. Governor"; a primary-style "(R)" copy must NOT count.
      race("Governor / Lt. Governor", (c) => [["R-Ty Masterson", c.grep], ["D-Cindy Holscher", c.gdem], ["L-Someone Else", 111]]),
      race("Governor / Lt. Governor (R)", () => [["R-Ty Masterson", 5555], ["R-Someone", 4444]]),
      race("United States House of Representatives 1", () => [["R-Tracey Mann", 7777], ["D-Someone", 6666]]),
      "</body></html>"].join("\n"));
  }
  if (s.state === "MN") { // Minnesota SoS allracesbycounty.txt: no header, ';', numeric county codes (alphabetical
    // by the state's own order: 43 McLeod, 44 Mahnomen, 69 St. Louis), DFL party code, a statewide row with no county,
    // and other offices mixed in that must NOT count
    const order = ["Aitkin","Anoka","Becker","Beltrami","Benton","Big Stone","Blue Earth","Brown","Carlton","Carver","Cass","Chippewa","Chisago","Clay","Clearwater","Cook","Cottonwood","Crow Wing","Dakota","Dodge","Douglas","Faribault","Fillmore","Freeborn","Goodhue","Grant","Hennepin","Houston","Hubbard","Isanti","Itasca","Jackson","Kanabec","Kandiyohi","Kittson","Koochiching","Lac qui Parle","Lake","Lake of the Woods","Le Sueur","Lincoln","Lyon","McLeod","Mahnomen","Marshall","Martin","Meeker","Mille Lacs","Morrison","Mower","Murray","Nicollet","Nobles","Norman","Olmsted","Otter Tail","Pennington","Pine","Pipestone","Polk","Pope","Ramsey","Red Lake","Redwood","Renville","Rice","Rock","Roseau","St. Louis","Scott","Sherburne","Sibley","Stearns","Steele","Stevens","Swift","Todd","Traverse","Wabasha","Wadena","Waseca","Washington","Watonwan","Wilkin","Winona","Wright","Yellow Medicine"];
    const out = [];
    for (const c of list) {
      const id = String(order.indexOf(c.county) + 1).padStart(2, "0"), pr = Math.round(40 * c.local), tot = c.dem + c.rep + 30;
      out.push(["MN", id, "", "0102", "U.S. Senator", "", "0403", "Peggy Flanagan", "", "", "DFL", pr, 40, c.dem, "50.00", tot].join(";"));
      out.push(["MN", id, "", "0102", "U.S. Senator", "", "0304", "Michele Tafoya", "", "", "R", pr, 40, c.rep, "50.00", tot].join(";"));
      out.push(["MN", id, "", "0102", "U.S. Senator", "", "1102", "Rebecca Whiting", "", "", "LIB", pr, 40, 30, "0.10", tot].join(";"));
      out.push(["MN", id, "", "0331", "Governor & Lt Governor", "", "0201", "Someone Else", "", "", "DFL", pr, 40, 8888, "50.00", 9999].join(";"));
    }
    out.push(["MN", "", "", "0102", "U.S. Senator", "", "0403", "Peggy Flanagan", "", "", "DFL", 1, 1, 99999999, "50.00", 1].join(";"));
    return enc("﻿" + out.join("\r\n"));
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
    const gov = list.map((c) => ({ dem: c.gdem, rep: c.grep }));
    const expect = { TX: { tx_sen: list, tx_gov: gov }, OH: { oh_sen: list, oh_gov: gov }, GA: { ga_sen: list, ga_gov: gov }, IA: { ia_sen: list, ia_gov: gov }, KS: { ks_sen: list, ks_gov: gov } }[s.state]
      || { [Object.keys(out.races)[0] || s.state]: list };
    for (const [id, want] of Object.entries(expect)) {
      const got = out.races[id] ? Object.values(out.races[id].counties) : [];
      if (want.length && (got.length !== want.length || Math.abs(sum(got, "dem") - sum(want, "dem")) > want.length || Math.abs(sum(got, "rep") - sum(want, "rep")) > want.length))
        problems.push(`${s.state} ${id}: expected ${want.length} counties / D ${sum(want, "dem")} R ${sum(want, "rep")}, got ${got.length} / D ${sum(got, "dem")} R ${sum(got, "rep")}`);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({
    updated: new Date().toISOString(),
    source: `stress-test (seed ${seed}, ${(frac * 100).toFixed(0)}% in)`,
    test: true, // a marked test: shown even before the results start gate (Update 55)
    races,
  }, null, 2));
  console.log(`wrote snapshot at ${(frac * 100).toFixed(0)}% in (seed ${seed})` + (problems.length ? "\n  PROBLEMS:\n  " + problems.join("\n  ") : "  - all 10 states read correctly (plus the Texas, Ohio, Georgia, Iowa and Kansas governor races)"));
}

// START GATE CHECK (Updates 55-56): fake votes in a state's file must not go live before that
// state's last polls close, through either the API or the app, and must go live after; and the
// ?night preview must show simulated returns, never the state's real (test) file.
async function gateCheck() {
  const counts = snapshotCounts(0.7);
  const fakeFile = (st) => asFile(night.find((s) => s.state === st), counts[st]);
  const fetchStateFn = async (setting, state) => aggregate(readFeed(fakeFile(state), state), state);
  const env = { MN_RESULTS_URL: "https://example.invalid/mn.txt", GA_RESULTS_URL: "https://example.invalid/ga.xml" };
  const et = (h, m) => Date.UTC(2026, 10, 3, h + 5, m); // Nov 3, Eastern -> UTC
  const has = (p, id) => !!(p && p.races && p.races[id]);
  const fails = [];
  const at = async (h, m) => buildPayload({ env, now: et(h, m), fetchStateFn });
  const p659 = await at(18, 59), p701 = await at(19, 1), p859 = await at(20, 59), p901 = await at(21, 1);
  if (has(p659, "ga_sen") || has(p659, "mn_sen") || p659.source !== "waiting") fails.push("API showed results at 6:59 p.m.");
  if (!has(p701, "ga_sen")) fails.push("API hid Georgia at 7:01 p.m.");
  if (has(p701, "mn_sen") || has(p859, "mn_sen")) fails.push("API showed Minnesota's test votes before 9 p.m.");
  if (!has(p901, "mn_sen") || !has(p901, "ga_sen")) fails.push("API hid Minnesota or Georgia at 9:01 p.m.");
  // the app's own gate, on a payload that somehow arrived early with every state in it
  const leaked = p901;
  const app = (h, m) => gateResults(leaked, { now: et(h, m) });
  if (has(app(20, 59), "mn_sen")) fails.push("app accepted Minnesota at 8:59 p.m.");
  if (!has(app(21, 1), "mn_sen")) fails.push("app rejected Minnesota at 9:01 p.m.");
  if (!has(app(19, 1), "ga_sen") || has(app(19, 1), "mn_sen")) fails.push("app got Georgia/Minnesota wrong at 7:01 p.m.");
  if (!has(gateResults({ ...leaked, test: true }, { now: et(12, 0) }), "mn_sen")) fails.push("app rejected a marked test payload");
  // ?night before 9 p.m.: Minnesota must come from the simulator, not from Minnesota's (test) file
  const units = (st) => { const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data", `${st.toLowerCase()}-baseline.json`), "utf8"));
    return Object.keys(b.lean).map((name) => ({ name, weight: b.weight[name], prior: Math.min(0.98, Math.max(0.02, b.statewideDemTwoParty + b.lean[name])) })); };
  const needles = [{ id: "mn_sen", state: "MN", units: units("MN") }, { id: "ga_sen", state: "GA", units: units("GA") }];
  const t0 = et(18, 0), now = et(20, 30);
  const preview = simulatedPreview(gateResults(leaked, { now }), needles, now, t0 + 200000);
  const real = leaked.races.mn_sen.counties, shown = preview.races.mn_sen && preview.races.mn_sen.counties;
  if (!shown || !preview.simulated || !preview.simulated.includes("mn_sen")) fails.push("?night preview had no simulated Minnesota returns");
  else if (Object.keys(shown).some((c) => real[c] && real[c].dem === shown[c].dem && real[c].rep === shown[c].rep)) fails.push("?night preview showed Minnesota's real file");
  if (!has(preview, "ga_sen") || (preview.simulated || []).includes("ga_sen")) fails.push("?night preview didn't show Georgia's real results after 7 p.m.");
  console.log(fails.length ? "gate check FAILED:\n  " + fails.join("\n  ") : "gate check passed: Minnesota hidden at 8:59 p.m. ET, shown at 9:01; Georgia shown at 7:01; ?night shows simulated Minnesota returns before 9, never its file; marked tests still show");
  if (fails.length) process.exitCode = 1;
}
await gateCheck();

// RUNOFF CHECK (Update 57): Georgia needs more than 50% of ALL votes. The reader must keep the
// Libertarian's votes ("oth"), and the runoff rule must send a 49.4% leader (Warnock 2022) to a
// runoff instead of calling the race, while still calling a clear majority.
function runoffCheck() {
  const fails = [];
  const counts = snapshotCounts(1);
  const ga = night.find((s) => s.state === "GA");
  const out = aggregate(readFeed(asFile(ga, counts.GA), "GA"), "GA");
  const got = Object.values(out.races.ga_sen.counties).reduce((t, c) => t + (c.oth || 0), 0);
  const want = counts.GA.reduce((t, c) => t + c.oth, 0);
  if (got !== want) fails.push(`Georgia third-party votes: expected ${want}, got ${got}`);
  const gotG = Object.values((out.races.ga_gov || { counties: {} }).counties).reduce((t, c) => t + (c.oth || 0), 0), wantG = counts.GA.reduce((t, c) => t + c.goth, 0);
  if (gotG !== wantG) fails.push(`Georgia governor third-party votes: expected ${wantG}, got ${gotG}`);
  if (!RUNOFF_RACES.ga_gov) fails.push("the runoff rule doesn't cover the Georgia governor race");
  // the 2022 certified count: Warnock 1,946,117, Walker 1,908,442, Oliver 81,365, all counted
  const w = 1946117, k = 1908442, o = 81365;
  const full = { margin: (w - k) / (w + k), se: 0.004, fracIn: 1 };
  if (runoffStatus(full, 0.999, otherShare([{ vDem: w, vRep: k, vOth: o }])).status !== "runoff") fails.push("a 49.4% leader was not sent to a runoff");
  const clear = { margin: 0.08, se: 0.004, fracIn: 1 }; // leader ~52.6% of all votes
  if (runoffStatus(clear, 0.999, 0.025).status !== "called") fails.push("a clear majority was not called");
  if (runoffStatus({ ...full, fracIn: 0.3, se: 0.07 }, 0.6, 0.02).status === "called") fails.push("called with only 30% in");
  console.log(fails.length ? "runoff check FAILED:\n  " + fails.join("\n  ") : "runoff check passed: Georgia's Libertarian votes kept (Senate and governor); rule covers both races; 49.4% leader goes to a Dec. 1 runoff (no call); a clear majority is still called");
  if (fails.length) process.exitCode = 1;
}
runoffCheck();

// LINK DISCOVERY CHECK (Update 62): IA_RESULTS_URL / GA_RESULTS_URL point at each state's LIST of elections.
// A fake Iowa and Georgia site (no network) serves lists with decoy primaries, specials and runoffs, including
// a decoy primary ON Nov 3; the reader must pick the general, read its county results exactly, never download a
// decoy's files or Georgia's Lieutenant Governor contest, say "not posted yet" when the general isn't listed,
// and respect the start gate (Georgia 7:00 p.m., Iowa 9:00 p.m. ET: nothing is even downloaded before then).
async function discoveryCheck() {
  const fails = [], requested = [];
  const counts = snapshotCounts(0.8);
  const ia = night.find((s) => s.state === "IA"), ga = night.find((s) => s.state === "GA");
  const IA_LIST = "https://electionresults.iowa.gov/IA/elections.json";
  const GA_LIST = "https://results.sos.ga.gov/results/public/api/jurisdictions/Georgia";
  const GA_API = "https://results.sos.ga.gov/results/public/api";
  const iaDecoys = [
    { EID: "126082", ElectionName: "2026 Primary Election", Date: "6/2/2026 12:00:00 AM" },
    { EID: "126555", ElectionName: "2026 General Election Recount - HD 5", Date: "11/3/2026 12:00:00 AM" },
    { EID: "124196", ElectionName: "2025 City-School Election", Date: "11/4/2025 12:00:00 AM" },
  ];
  const gaDecoys = [
    { publicElectionId: "06162026GeneralPrimaryRunoff", electionDate: "2026-06-16", name: [{ languageId: "en", text: "June 16th, 2026 General Primary Runoff" }] },
    { publicElectionId: "GeneralPrimary51926", electionDate: "2026-05-19", name: [{ languageId: "en", text: "May 19, 2026 - General Primary" }] },
    { publicElectionId: "11032026GenRunoff", electionDate: "2026-11-03", name: [{ languageId: "en", text: "November 3, 2026 - General Election Runoff" }] },
  ];
  const iaGeneral = { EID: "126900", ElectionName: "2026 General Election", Date: "11/3/2026 12:00:00 AM" };
  const gaGeneral = { publicElectionId: "11032026GeneralElection", electionDate: "2026-11-03", name: [{ languageId: "en", text: "November 3, 2026 - General Election" }] };
  const T = (text) => [{ languageId: "en", text }];
  const evItem = (id, office, opts) => ({ ballotItemWithBreakdown: { id, name: T(office), breakdownResults: counts.GA.map((c) => ({
    locality: { name: T(`${c.county} County`) }, precinctReportingStatus: { reportingUnits: Math.round(10 * c.local), totalUnits: 10 },
    ballotOptions: opts.map(([cand, party, key]) => ({ name: T(cand), party: { abbreviation: party }, voteCount: c[key] })) })) } });
  let posted = true;
  const site = (u) => {
    if (u === IA_LIST) return JSON.stringify(posted ? [...iaDecoys, iaGeneral] : iaDecoys);
    if (u === "https://electionresults.iowa.gov/IA/126900/current_ver.txt") return "377001";
    if (u === "https://electionresults.iowa.gov/IA/126900/377001/reports/detailxml.zip") return asFile(ia, counts.IA);
    if (u === GA_LIST) return JSON.stringify({ id: "09378a07-e6cf-4f66-be7c-ca4aa534f99a", elections: posted ? [...gaDecoys, gaGeneral] : gaDecoys });
    if (u === `${GA_API}/elections/Georgia/11032026GeneralElection/data`) return JSON.stringify({ ballotItems: [
      { id: "sen-1", name: T("US Senate") }, { id: "gov-1", name: T("Governor") }, { id: "ltg-1", name: T("Lieutenant Governor") }, { id: "ss-1", name: T("State Senate - District 7") }] });
    if (u === `${GA_API}/elections/Georgia/11032026GeneralElection/data/ballot-item/sen-1`) return JSON.stringify(evItem("sen-1", "US Senate", [["Jon Ossoff (Dem)", "Dem", "dem"], ["Mike Collins (Rep)", "Rep", "rep"], ["Chase Oliver (Lib)", "Lib", "oth"]]));
    if (u === `${GA_API}/elections/Georgia/11032026GeneralElection/data/ballot-item/gov-1`) return JSON.stringify(evItem("gov-1", "Governor", [["Keisha Lance Bottoms (Dem)", "Dem", "gdem"], ["Rick Jackson (Rep)", "Rep", "grep"], ["Some Libertarian (Lib)", "Lib", "goth"]]));
    return null; // anything else (a decoy's files, Lieutenant Governor) is a 404, and is flagged below
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => { u = String(u); requested.push(u); const body = site(u); return new Response(body, { status: body == null ? 404 : 200 }); };
  try {
    const sum = (o, k) => Object.values(o || {}).reduce((t, c) => t + (c[k] || 0), 0);
    const want = (list, d, r, o) => ({ n: list.length, dem: list.reduce((t, c) => t + c[d], 0), rep: list.reduce((t, c) => t + c[r], 0), oth: o ? list.reduce((t, c) => t + c[o], 0) : 0 });
    const checkRace = (out, id, w) => {
      const co = out.races[id]?.counties;
      if (!co || Object.keys(co).length !== w.n || Math.abs(sum(co, "dem") - w.dem) > w.n || Math.abs(sum(co, "rep") - w.rep) > w.n || sum(co, "oth") !== w.oth)
        fails.push(`${id}: expected ${w.n} counties / D ${w.dem} R ${w.rep} O ${w.oth}, got ${co ? Object.keys(co).length : 0} / D ${sum(co, "dem")} R ${sum(co, "rep")} O ${sum(co, "oth")}`);
    };
    // 1. Through the real endpoint, gate and all: before 7 p.m. nothing is downloaded; 7:01 Georgia only; 9:01 both.
    const env = { IA_RESULTS_URL: IA_LIST, GA_RESULTS_URL: GA_LIST };
    const et = (h, m) => Date.UTC(2026, 10, 3, h + 5, m);
    requested.length = 0;
    const p659 = await buildPayload({ env, now: et(18, 59) });
    if (requested.length || Object.keys(p659.races).length) fails.push("a list or file was downloaded before 7 p.m.");
    const p701 = await buildPayload({ env, now: et(19, 1) });
    if (requested.some((u) => u.includes("iowa.gov"))) fails.push("Iowa's list was read before 9 p.m.");
    if (!p701.races.ga_sen || p701.races.ia_sen) fails.push("7:01 p.m.: expected Georgia only");
    requested.length = 0;
    const p901 = await buildPayload({ env, now: et(21, 1) });
    checkRace(p901, "ia_sen", want(counts.IA, "dem", "rep"));
    checkRace(p901, "ia_gov", want(counts.IA, "gdem", "grep"));
    checkRace(p901, "ga_sen", want(counts.GA, "dem", "rep", "oth"));
    checkRace(p901, "ga_gov", want(counts.GA, "gdem", "grep", "goth"));
    if (p901.diag?.IA?.election?.id !== "126900") fails.push(`Iowa picked election ${p901.diag?.IA?.election?.id}, not the general`);
    if (p901.diag?.GA?.election?.id !== "11032026GeneralElection") fails.push(`Georgia picked election ${p901.diag?.GA?.election?.id}, not the general`);
    const bad = requested.filter((u) => site(u) == null);
    if (bad.length) fails.push(`downloaded files it shouldn't have: ${bad.join(", ")}`);
    if (!(p901.races.ga_sen?.counties && Object.values(p901.races.ga_sen.counties).every((c) => c.pt === 10))) fails.push("Georgia's precincts-reporting numbers were lost");
    // 2. Today's situation: the general isn't listed yet (only the decoys are).
    posted = false; requested.length = 0;
    const pNot = await buildPayload({ env, now: et(21, 1) });
    if (Object.keys(pNot.races).length) fails.push("showed results from a decoy election");
    for (const msg of ["Iowa: Nov 3 general not posted yet", "Georgia: Nov 3 general not posted yet"])
      if (!(pNot.errors || []).includes(msg)) fails.push(`missing message "${msg}" (got ${JSON.stringify(pNot.errors)})`);
    if (pNot.source !== "waiting") fails.push(`source should be "waiting" before the general is listed, got "${pNot.source}"`);
    if (requested.some((u) => !(u === IA_LIST || u === GA_LIST))) fails.push("downloaded a decoy election's files");
  } finally { globalThis.fetch = realFetch; }
  console.log(fails.length ? "discovery check FAILED:\n  " + fails.join("\n  ") : "discovery check passed: Iowa and Georgia pick the Nov 3 general from their election lists (skipping decoy primaries, runoffs and recounts, even ones dated Nov 3 and listed first); county totals exact (Iowa Senate and governor, Georgia Senate and governor); Lieutenant Governor never downloaded; \"not posted yet\" until the general is listed; nothing downloaded before 7 p.m. (Georgia) / 9 p.m. (Iowa)");
  if (fails.length) process.exitCode = 1;
}
await discoveryCheck();

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
