// results-gate.mjs — no real results count before a state's polls close (Updates 55 and 56).
//
// States post TEST files with fake practice votes before Election Day (Minnesota's 2026 file already
// has them), at the same addresses they use on election night. So the results links can be set in
// Vercel ahead of time, nothing from a state's file counts before that state's LAST polls close on
// Nov 3, 2026. The gate runs in BOTH places:
//   - api/results.js doesn't even download a state's file before its start time;
//   - the app drops any race whose state hasn't reached its start time.
// ?night never sees real files early: before a state's start it shows simulated practice returns
// (built in the app, marked simulated). Marked test payloads (scripts/test-night.mjs snapshots and
// TEST_RESULTS_URL, which carry test: true) always pass.
//
// Times are the LAST poll close in each state, Eastern (EST, UTC-5, on Nov 3):
//   GA, SC 7:00 · NC, OH 7:30 · ME, NH 8:00 (NH's last towns) · MI 9:00 (Central-time Upper Peninsula),
//   TX 9:00 (El Paso/Hudspeth, Mountain), KS 9:00 (western Mountain-time counties), NE, MN, IA 9:00.
const ET = (h, m = 0) => Date.UTC(2026, 10, 3, h + 5, m); // Nov 3 local Eastern -> UTC
export const STATE_START = {
  GA: ET(19), SC: ET(19), NC: ET(19, 30), OH: ET(19, 30), ME: ET(20), NH: ET(20),
  MI: ET(21), TX: ET(21), KS: ET(21), NE: ET(21), MN: ET(21), IA: ET(21),
};
const LATEST = ET(25); // any state not listed: 1 a.m. ET Nov 4, after every poll in the country closes
export const stateStart = (st) => STATE_START[st] ?? LATEST;
export const stateOpen = (st, now = Date.now()) => now >= stateStart(st);
export const RESULTS_START = Math.min(...Object.values(STATE_START)); // the first poll close (Georgia and South Carolina)

// Which state a results race belongs to: Maine's races are sen/gov/cd1/cd2, the rest are "xx_sen" etc.
export const raceState = (id) => (["sen", "gov", "cd1", "cd2"].includes(id) ? "ME" : String(id).split("_")[0].toUpperCase());

const fmt = (t) => { const d = new Date(t - 5 * 3600e3), H = d.getUTCHours(), m = d.getUTCMinutes(); return `${H % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${H >= 12 ? "p.m." : "a.m."}`; };
// "waiting: results start at 7 p.m. ET Nov 3 (GA), 7:30 p.m. (NC, OH), ..." for the states still closed.
export function waitingNote(now = Date.now(), states = Object.keys(STATE_START)) {
  const closed = states.filter((s) => !stateOpen(s, now)).sort((a, b) => stateStart(a) - stateStart(b) || a.localeCompare(b));
  if (!closed.length) return "";
  const groups = [];
  for (const s of closed) { const t = stateStart(s), g = groups.find((x) => x.t === t); if (g) g.s.push(s); else groups.push({ t, s: [s] }); }
  return "waiting: results start at " + groups.map((g, i) => `${fmt(g.t)}${i === 0 ? " ET Nov 3" : ""} (${g.s.join(", ")})`).join(", ");
}
export const waitingPayload = (now = Date.now(), states) => ({ updated: null, source: "waiting", note: waitingNote(now, states), races: {} });

// Drops every race whose state hasn't reached its start time. Marked tests pass untouched.
export function gateResults(payload, { now = Date.now() } = {}) {
  if (!payload || payload.test === true || !payload.races) return payload;
  const races = {}, held = new Set();
  for (const [id, r] of Object.entries(payload.races)) {
    if (stateOpen(raceState(id), now)) races[id] = r; else held.add(raceState(id));
  }
  if (!held.size) return payload;
  const out = { ...payload, races, note: waitingNote(now, [...held]) };
  if (!Object.keys(races).length) { out.source = "waiting"; out.updated = null; }
  return out;
}
