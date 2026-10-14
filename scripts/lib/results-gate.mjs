// results-gate.mjs — no real results count before polls close (Update 55).
//
// States post TEST files with fake practice votes before Election Day (Minnesota's 2026 file already
// has them), at the same addresses they use on election night. So the results links can be set in
// Vercel ahead of time, nothing from a state file counts before 7 p.m. Eastern on Nov 3, 2026
// (00:00 UTC Nov 4, after daylight saving ends). The gate runs in BOTH places:
//   - api/results.js returns no races before the start time;
//   - the app ignores any races it receives before the start time.
// Testing still works: the ?night page address bypasses the gate (the app also asks the API to skip
// it), and test payloads (scripts/test-night.mjs snapshots, TEST_RESULTS_URL) carry test: true.
export const RESULTS_START = Date.UTC(2026, 10, 4, 0, 0);
export const RESULTS_WAITING_NOTE = "waiting: results start at 7 p.m. ET Nov 3";
export const resultsOpen = (now = Date.now()) => now >= RESULTS_START;
export const waitingPayload = () => ({ updated: null, source: "waiting", note: RESULTS_WAITING_NOTE, races: {} });

// Returns the payload unchanged when results may count, otherwise an empty "waiting" payload.
export function gateResults(payload, { now = Date.now(), bypass = false } = {}) {
  if (!payload || bypass || payload.test === true || resultsOpen(now)) return payload;
  return waitingPayload();
}
