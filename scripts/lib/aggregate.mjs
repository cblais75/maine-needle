// Deterministic core: turn vote rows (from read-feed.mjs) into county results for the app.
// A row is { county, town, precinct, office, party, candidate, votes, pr, pt }.
import town2county from "./town-county.mjs";
import { matchCounty } from "./read-feed.mjs";

// U.S. Senate only. Matches "US SENATE", "U.S. Senator", "U. S. SENATOR", "United States Senator",
// "U.S. Senator 6 Year Term (1) Position", "2026-ge-us-senate.xls" — but NOT "State Senate District 5".
const US_SENATE = /\bU\.?[\s-]*S\.?[\s-]*SENAT|\bUNITED[\s-]+STATES[\s-]+SENAT/i;
// Governor, but NOT "Lieutenant Governor" / "Lt. Governor" (Texas lists both on the same ballot).
const GOVERNOR = /^(?!.*\b(lieutenant|lt\.?)[\s-]+gov).*\bgovernor\b/i;

// Which office maps to which race, and how to tell the sides apart.
// Sides resolve by party first; if the file has no party column, by candidate name.
const RACES = [
  { id: "sen", state: "ME", office: US_SENATE, kind: "two", names: { dem: /jackson/i, rep: /collins/i } },
  { id: "gov", state: "ME", office: /governor/i, kind: "three", names: { dem: /pingree/i, rep: /charles/i, ind: /bennett/i } },
  { id: "cd1", state: "ME", office: /(congress|representative).*(district\s*1|first|\b1\b)/i, kind: "two", names: { dem: /pingree/i, rep: /russell/i } },
  { id: "cd2", state: "ME", office: /(congress|representative).*(district\s*2|second|\b2\b)/i, kind: "two", names: { dem: /dunlap/i, rep: /lepage/i } },
  { id: "nc_sen", state: "NC", office: US_SENATE, kind: "two", names: { dem: /cooper/i, rep: /whatley/i } },
  { id: "oh_sen", state: "OH", office: US_SENATE, kind: "two", names: { dem: /brown/i, rep: /husted/i } },
  { id: "tx_sen", state: "TX", office: US_SENATE, kind: "two", names: { dem: /talarico/i, rep: /paxton/i } },
  // Texas governor (Update 49): same feed as the Senate race, the governor contest instead.
  { id: "tx_gov", state: "TX", office: GOVERNOR, kind: "two", names: { dem: /hinojosa/i, rep: /abbott/i } },
  { id: "ia_sen", state: "IA", office: US_SENATE, kind: "two", names: { dem: /turek/i, rep: /hinson/i } },
  { id: "ga_sen", state: "GA", office: US_SENATE, kind: "two", names: { dem: /ossoff/i, rep: /collins/i } },
  // Nebraska: names only. Osborn is an independent, and if the Democratic nominee (Burbank) ends
  // up on the ballot her votes must NOT be counted as Osborn's.
  { id: "ne_sen", state: "NE", office: US_SENATE, kind: "two", namesOnly: true, names: { dem: /osborn/i, rep: /ricketts/i } },
  { id: "mi_sen", state: "MI", office: US_SENATE, kind: "two", names: { dem: /el-?\s?sayed/i, rep: /rogers/i } },
  { id: "nh_sen", state: "NH", office: US_SENATE, kind: "two", names: { dem: /pappas/i, rep: /sununu/i } },
];

function lookupMaineCounty(row) {
  const byCounty = matchCounty("ME", row.county);
  if (byCounty) return byCounty;
  let n = String(row.town ?? row.precinct ?? "").trim();
  if (!n || /^(total|totals|grand total)$/i.test(n)) return null;
  if (town2county[n]) return town2county[n];
  for (const suf of [" Ward", " CP", " City", " Precinct"]) if (n.includes(suf)) n = n.split(suf)[0].trim();
  return town2county[n] || null;
}
function sideOf(race, party, candidate) {
  const p = String(party ?? "").trim().toUpperCase(), c = String(candidate ?? "");
  const nm = race.names || {};
  // Names first when they match: guards against a stray third candidate sharing a party label.
  for (const s of ["dem", "rep", "ind"]) if (nm[s] && nm[s].test(c)) return s;
  if (race.namesOnly) return null;
  if (p === "D" || p.startsWith("DEM")) return "dem";
  if (p === "R" || p.startsWith("REP")) return "rep";
  return null;
}

// Some workbooks repeat the same race on a summary sheet AND its own sheet (Ohio's "Master"),
// which would count every vote twice. For each race, keep sheets whose counties don't overlap
// a sheet already kept (bigger sheets first). Sheets covering different counties still add up.
function dropDuplicateSheets(rows, pool, state) {
  if (!rows.some((r) => r.sheet != null)) return rows;
  const drop = new Set();
  for (const race of pool) {
    const bySheet = new Map();
    for (const r of rows) {
      if (r.sheet == null || !race.office.test(String(r.office ?? ""))) continue;
      const co = state === "ME" ? lookupMaineCounty(r) : matchCounty(state, r.county);
      if (!co) continue;
      if (!bySheet.has(r.sheet)) bySheet.set(r.sheet, new Set());
      bySheet.get(r.sheet).add(co);
    }
    const kept = new Set();
    for (const [sh, set] of [...bySheet].sort((a, b) => b[1].size - a[1].size)) {
      if ([...set].some((c) => kept.has(c))) drop.add(sh); else set.forEach((c) => kept.add(c));
    }
  }
  return drop.size ? rows.filter((r) => !(r.sheet != null && drop.has(r.sheet) && pool.some((R) => R.office.test(String(r.office ?? ""))))) : rows;
}

// options.office / options.names override the race config — used by check-feed.mjs to test the
// reader on past elections (e.g. the 2024 President race) before our candidates are on a ballot.
export function aggregate(rows, state = "ME", options = {}) {
  let pool = RACES.filter((R) => R.state === state);
  if (options.office) pool = [{ id: options.id || pool[0]?.id || "test", state, office: options.office, kind: "two", namesOnly: pool[0]?.namesOnly, names: options.names || {} }];
  const acc = {}, prec = {}, unmatchedPlaces = new Set(), offices = new Set();
  let skippedSide = 0;
  rows = dropDuplicateSheets(rows, pool, state);
  for (const r of rows) {
    const off = String(r.office ?? "");
    const race = pool.find((R) => R.office.test(off));
    if (!race) { if (off) offices.add(off); continue; }
    const side = sideOf(race, r.party, r.candidate);
    if (!side) { skippedSide++; continue; }
    const county = state === "ME" ? lookupMaineCounty(r) : matchCounty(state, r.county);
    if (!county) {
      const raw = r.county ?? r.town ?? r.precinct;
      if (raw != null && !/^(total|totals|grand total|statewide)$/i.test(String(raw).trim())) unmatchedPlaces.add(String(raw));
      continue;
    }
    const votes = Number(String(r.votes ?? "").replace(/[^0-9.-]/g, "")) || 0;
    acc[race.id] = acc[race.id] || {};
    acc[race.id][county] = acc[race.id][county] || { dem: 0, rep: 0, ind: 0 };
    acc[race.id][county][side] += votes;
    if (Number.isFinite(r.pt) && r.pt > 0) {
      prec[race.id] = prec[race.id] || {};
      prec[race.id][county] = { pr: r.pr, pt: r.pt };
    }
  }
  const races = {};
  for (const id of Object.keys(acc)) {
    const counties = {};
    for (const [co, v] of Object.entries(acc[id])) {
      const o = { dem: Math.round(v.dem), rep: Math.round(v.rep) };
      if (v.ind) o.ind = Math.round(v.ind);
      const p = prec[id]?.[co];
      if (p && Number.isFinite(p.pr)) { o.pr = p.pr; o.pt = p.pt; }
      counties[co] = o;
    }
    races[id] = { counties };
  }
  return {
    updated: new Date().toISOString(),
    source: `${state} (parsed)`,
    races,
    _diag: {
      rows: rows.length,
      countiesMatched: Object.fromEntries(Object.entries(races).map(([id, r]) => [id, Object.keys(r.counties).length])),
      unmatchedPlaces: [...unmatchedPlaces].slice(0, 15),
      rowsWithUnknownSide: skippedSide,
      otherOfficesSample: [...offices].slice(0, 12),
    },
  };
}
