// Serverless results endpoint — multi-state.
// The browser polls /api/results. For each state with a configured env var, this fetches
// that state's results download (any format read-feed.mjs understands: zip, Excel, CSV/TSV,
// Clarity XML, JSON), keeps the U.S. Senate race, and merges everything into one payload.
// CDN-cached, so the state sites are hit about once a minute total regardless of traffic.
//
// Election night setup (host dashboard -> Environment Variables):
//   MAINE_RESULTS_URL, NC_RESULTS_URL, OH_RESULTS_URL, TX_RESULTS_URL,
//   IA_RESULTS_URL, GA_RESULTS_URL, NE_RESULTS_URL, MI_RESULTS_URL, NH_RESULTS_URL
// Clarity sites change their folder number as the night goes on. Put {ver} where that number
// goes (e.g. https://results.enr.clarityelections.com/IA/123456/{ver}/reports/detailxml.zip)
// and this looks up the current number from current_ver.txt on every refresh.
// Stress test: set TEST_RESULTS_URL to a hosted results.json in the final shape; it overrides
// everything and is served as-is.
// Any state without an env var is skipped. Any state that errors or times out is skipped
// (listed in `errors`) without taking down the rest.
import { aggregate } from "../scripts/lib/aggregate.mjs";
import { readFeed } from "../scripts/lib/read-feed.mjs";

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
];
const UA = { "User-Agent": "Mozilla/5.0 (compatible; TheNeedleProject/1.0; +https://theneedleproject.vercel.app)" };

async function get(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const resp = await fetch(url, { signal: ctl.signal, headers: UA });
    if (!resp.ok) throw new Error(`source ${resp.status}`);
    return resp;
  } finally { clearTimeout(t); }
}
export async function resolveUrl(url) {
  if (!url.includes("{ver}")) return url;
  const base = url.split("{ver}")[0];
  const ver = (await (await get(base + "current_ver.txt", 5000)).text()).trim();
  return url.replace("{ver}", ver);
}
async function fetchState(url, state) {
  const real = await resolveUrl(url);
  const buf = new Uint8Array(await (await get(real, 20000)).arrayBuffer());
  return aggregate(readFeed(buf, state, real), state);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=240");

  const testUrl = process.env.TEST_RESULTS_URL;
  if (testUrl) {
    try {
      const r = await fetch(testUrl);
      if (!r.ok) throw new Error(`test source ${r.status}`);
      res.status(200).json(await r.json());
    } catch (e) {
      res.status(200).json({ updated: null, source: "error", error: String(e), races: {} });
    }
    return;
  }

  const active = SOURCES.filter((s) => process.env[s.env]);
  if (!active.length) {
    res.status(200).json({ updated: null, source: "simulation", races: {} });
    return;
  }
  const races = {}, sources = [], errors = [], diag = {};
  await Promise.all(active.map(async (s) => {
    try {
      const out = await fetchState(process.env[s.env], s.state);
      Object.assign(races, out.races || {});
      sources.push(s.state);
      diag[s.state] = out._diag;
      if (!Object.keys(out.races || {}).length) errors.push(`${s.state}: file read, but no U.S. Senate votes found`);
    } catch (e) {
      errors.push(`${s.state}: ${String(e)}`);
    }
  }));
  res.status(200).json({
    updated: new Date().toISOString(),
    source: sources.length ? `live (${sources.join(", ")})` : "error",
    ...(errors.length ? { errors } : {}),
    diag,
    races,
  });
}
