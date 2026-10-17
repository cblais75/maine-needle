// Serverless results endpoint — multi-state.
// The browser polls /api/results. For each state with a configured env var, this fetches
// that state's results download (any format read-feed.mjs understands: zip, Excel, CSV/TSV,
// Clarity XML, JSON), keeps the U.S. Senate race, and merges everything into one payload.
// CDN-cached, so the state sites are hit about once a minute total regardless of traffic.
//
// Election night setup (host dashboard -> Environment Variables):
//   MAINE_RESULTS_URL, NC_RESULTS_URL, OH_RESULTS_URL, TX_RESULTS_URL,
//   IA_RESULTS_URL, GA_RESULTS_URL, NE_RESULTS_URL, MI_RESULTS_URL, NH_RESULTS_URL, KS_RESULTS_URL, MN_RESULTS_URL
// Kansas: KS_RESULTS_URL = https://sos.ks.gov/ent/kssos_ent.html (the statewide results page;
// every county's votes are in the page itself, so one download covers all 105 counties).
// Texas: TX_RESULTS_URL = https://goelect.txelections.civixapps.com/api-ivis-system/api/s3/enr/election/countyInfo/53815
// (Texas's new Civix results system; 53815 is the 2026 November general election; the Senate and governor
// races both come from this one file).
// Michigan: the county file is MVIC's https://mvic.sos.state.mi.us/VoteHistory/GetElectionResultFile?electionId=<id>
// (read fine by read-feed.mjs), but as of Oct 2026 that site answers servers with a Cloudflare security challenge
// (403), from Vercel too, so MI_RESULTS_URL can't work there unless the state lifts it.
// Minnesota: MN_RESULTS_URL = https://electionresultsfiles.sos.mn.gov/20261103/allracesbycounty.txt
// (the state posts TEST data at that address before election day: set it only on election night).
// Clarity sites change their folder number as the night goes on. Put {ver} where that number
// goes (e.g. https://results.enr.clarityelections.com/IA/123456/{ver}/reports/detailxml.zip)
// and this looks up the current number from current_ver.txt on every refresh.
// A setting can also hold several links separated by spaces, or the link to a state's results
// WEB PAGE: the page is scanned for the spreadsheets of the offices we track (see
// scripts/lib/fetch-rows.mjs). Maine and New Hampshire use that so they finish on their own.
// Stress test: set TEST_RESULTS_URL to a hosted results.json in the final shape; it overrides
// everything and is served as-is.
// Any state without an env var is skipped. Any state that errors or times out is skipped
// (listed in `errors`) without taking down the rest.
// START GATE (Updates 55-56): a state's file isn't even downloaded before that state's last polls
// close on Nov 3 (scripts/lib/results-gate.mjs has the times), because states post test files with
// fake votes at their election-night addresses. So the state links above can be set ahead of time.
// Only TEST_RESULTS_URL (a marked stress test) skips the gate; ?night previews use simulated data.
import { aggregate } from "../scripts/lib/aggregate.mjs";
import { fetchRows } from "../scripts/lib/fetch-rows.mjs";
import { stateOpen, waitingPayload, waitingNote, gateResults } from "../scripts/lib/results-gate.mjs";

const SOURCES = [
  { state: "ME", env: "MAINE_RESULTS_URL" },
  { state: "NC", env: "NC_RESULTS_URL" },
  { state: "OH", env: "OH_RESULTS_URL" },
  { state: "TX", env: "TX_RESULTS_URL" },
  { state: "IA", env: "IA_RESULTS_URL" },
  { state: "GA", env: "GA_RESULTS_URL" },
  { state: "NE", env: "NE_RESULTS_URL" },
  { state: "MI", env: "MI_RESULTS_URL" },
  { state: "NH", env: "NH_RESULTS_URL" },
  { state: "KS", env: "KS_RESULTS_URL" },
  { state: "MN", env: "MN_RESULTS_URL" },
];
export { resolveUrl } from "../scripts/lib/fetch-rows.mjs";

async function fetchState(setting, state) {
  const { rows, files } = await fetchRows(setting, state);
  const out = aggregate(rows, state);
  out._diag.files = files.length;
  return out;
}

// The results payload for a given moment. now / fetchStateFn are injectable so
// scripts/test-night.mjs can prove the start gate works without touching any state site.
export async function buildPayload({ env = process.env, now = Date.now(), fetchStateFn = fetchState } = {}) {
  const configured = SOURCES.filter((s) => env[s.env]);
  if (!configured.length) return { updated: null, source: "simulation", races: {} };
  const active = configured.filter((s) => stateOpen(s.state, now)); // don't even download test files early
  const closed = configured.filter((s) => !stateOpen(s.state, now)).map((s) => s.state);
  if (!active.length) return waitingPayload(now, closed);
  const races = {}, sources = [], errors = [], diag = {};
  await Promise.all(active.map(async (s) => {
    try {
      const out = await fetchStateFn(env[s.env], s.state);
      Object.assign(races, out.races || {});
      if (Object.keys(out.races || {}).length) sources.push(s.state);
      diag[s.state] = out._diag;
      if (!Object.keys(out.races || {}).length) errors.push(`${s.state}: ${out._diag.files ? "file read, but no votes found for our races" : "no results files posted yet"}`);
    } catch (e) {
      errors.push(`${s.state}: ${String(e)}`);
    }
  }));
  // gateResults again, race by race: a belt-and-braces check that no early state slips through.
  return gateResults({
    updated: new Date(now).toISOString(),
    source: sources.length ? `live (${sources.join(", ")})` : errors.every((e) => /no results files posted yet/.test(e)) ? "waiting" : "error",
    ...(closed.length ? { note: waitingNote(now, closed) } : {}),
    ...(errors.length ? { errors } : {}),
    diag,
    races,
  }, { now });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=240");

  const testUrl = process.env.TEST_RESULTS_URL;
  if (testUrl) {
    try {
      const r = await fetch(testUrl);
      if (!r.ok) throw new Error(`test source ${r.status}`);
      res.status(200).json({ ...(await r.json()), test: true }); // a stress test: always shown
    } catch (e) {
      res.status(200).json({ updated: null, source: "error", error: String(e), races: {} });
    }
    return;
  }
  res.status(200).json(await buildPayload());
}
