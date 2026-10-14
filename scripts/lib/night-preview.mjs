// night-preview.mjs — simulated practice returns for the ?night preview (Update 56).
// For every needle whose state hasn't reached its start time (results-gate.mjs), this makes fake
// county counts from the needle's own county units, with a random swing, counting up over about
// nine minutes, like scripts/test-night.mjs. It never reads a real state file. Maine and New
// Hampshire stay paused (as on the real night), Alaska never counts on the night, and three-way
// races (Maine governor) are skipped. The payload is marked simulated: [race ids] for the page banner.
import { stateOpen } from "./results-gate.mjs";

const SEED = String(Math.random());
const rnd = (k) => { let h = 2166136261; for (const ch of k + SEED) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function simulatedPreview(base, races, now, t0, { turnout = {}, pauseStates = [] } = {}) {
  const prog = Math.min(1, 0.12 + (now - t0) / 540000);
  const sim = {};
  for (const r of races || []) {
    if (r.type === "three" || r.noNight || pauseStates.includes(r.state) || stateOpen(r.state, now)) continue;
    const swing = (rnd(r.id) - 0.5) * 0.06, counties = {};
    for (const u of r.units) {
      const local = clamp((prog - rnd(r.id + u.name + "o") * 0.6) * (1.2 + rnd(r.id + u.name + "s")), 0, 1);
      if (local <= 0) continue;
      const share = clamp(u.prior + swing + (rnd(r.id + u.name + "n") - 0.5) * 0.06, 0.03, 0.97);
      const n = Math.round(u.weight * (turnout[r.state] || 0.8) * local), d = Math.round(n * share);
      counties[u.name] = { dem: d, rep: n - d, pr: Math.round(20 * local), pt: 20 };
    }
    if (Object.keys(counties).length) sim[r.id] = { counties };
  }
  if (!Object.keys(sim).length) return base;
  return { ...(base || {}), races: { ...((base && base.races) || {}), ...sim }, simulated: Object.keys(sim) };
}
