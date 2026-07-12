// Deterministic core: turn per-town vote rows into county results.json.
// A row is { town, office, party, candidate, votes }. Source-agnostic: the Excel
// reader and the CSV reader both produce rows, this turns them into the app's schema.
import town2county from "./town-county.mjs";

// Which office maps to which race, and how to tell the sides apart.
// Sides resolve by party first; if the file has no party column, by candidate name.
const RACES = [
  { id: "sen", state: "ME", office: /senat/i, kind: "two", names: { dem: /platner/i, rep: /collins/i } },
  { id: "gov", state: "ME", office: /governor/i, kind: "three", names: { dem: /pingree/i, rep: /charles/i, ind: /bennett/i } },
  { id: "cd1", state: "ME", office: /(congress|representative).*(district\s*1|first|\b1\b)/i, kind: "two", names: { dem: /pingree/i, rep: /russell/i } },
  { id: "cd2", state: "ME", office: /(congress|representative).*(district\s*2|second|\b2\b)/i, kind: "two", names: { dem: /dunlap/i, rep: /lepage/i } },
  { id: "q1", state: "ME", office: /question\s*1/i, kind: "ballot" },
  { id: "nc_sen", state: "NC", office: /senat/i, kind: "two", names: { dem: /cooper/i, rep: /whatley/i } },
  { id: "oh_sen", state: "OH", office: /senat/i, kind: "two", names: { dem: /brown/i, rep: /husted/i } },
  { id: "tx_sen", state: "TX", office: /senat/i, kind: "two", names: { dem: /talarico/i, rep: /paxton/i } },
  { id: "ia_sen", state: "IA", office: /senat/i, kind: "two", names: { dem: /turek/i, rep: /hinson/i } },
  { id: "ga_sen", state: "GA", office: /senat/i, kind: "two", names: { dem: /ossoff/i, rep: /collins/i } },
];

function lookupCounty(townRaw) {
  let n = String(townRaw || "").trim();
  if (town2county[n]) return town2county[n];
  for (const suf of [" Ward", " CP", " City", " Precinct"]) if (n.includes(suf)) n = n.split(suf)[0].trim();
  return town2county[n] || null;
}
function sideOf(race, party, candidate) {
  const p = String(party || "").toUpperCase(), c = String(candidate || "");
  if (race.kind === "ballot") { if (/^\s*y/i.test(c)) return "dem"; if (/^\s*n/i.test(c)) return "rep"; return null; }
  if (p.startsWith("DEM")) return "dem";
  if (p.startsWith("REP")) return "rep";
  const nm = race.names || {};
  for (const s of ["dem", "rep", "ind"]) if (nm[s] && nm[s].test(c)) return s;
  if (race.kind === "three" && p) return "ind"; // gov: any other party is the independent lane
  return null;
}

export function aggregate(rows, state = "ME") {
  const pool = RACES.filter((R) => R.state === state);
  const acc = {}, unmatchedTowns = new Set(), unmatchedOffice = new Set();
  for (const r of rows) {
    const race = pool.find((R) => R.office.test(r.office || ""));
    if (!race) { if (r.office) unmatchedOffice.add(r.office); continue; }
    const side = sideOf(race, r.party, r.candidate);
    if (!side) continue;
    // Maine reports by town and rolls up to county; other states report by county directly.
    const county = state !== "ME"
      ? String(r.town || r.county || "").trim().toUpperCase().replace(/\s+COUNTY$/, "")
      : lookupCounty(r.town);
    if (!county) { unmatchedTowns.add(r.town); continue; }
    const votes = Number(String(r.votes).replace(/[^0-9.-]/g, "")) || 0;
    acc[race.id] = acc[race.id] || {};
    acc[race.id][county] = acc[race.id][county] || { dem: 0, rep: 0, ind: 0 };
    acc[race.id][county][side] += votes;
  }
  const races = {};
  for (const id of Object.keys(acc)) {
    const counties = {};
    for (const [co, v] of Object.entries(acc[id])) {
      const o = { dem: Math.round(v.dem), rep: Math.round(v.rep) };
      if (v.ind) o.ind = Math.round(v.ind);
      counties[co] = o;
    }
    races[id] = { counties };
  }
  return {
    updated: new Date().toISOString(),
    source: ({ NC: "NC SBE (parsed)", OH: "OH SOS (parsed)", TX: "TX SOS (parsed)", IA: "IA SOS (parsed)", GA: "GA SOS (parsed)" }[state]) || "Maine SoS (parsed)",
    races,
    _diag: { unmatchedOffices: [...unmatchedOffice], unmatchedTownsSample: [...unmatchedTowns].slice(0, 15) },
  };
}
