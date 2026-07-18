// Serverless results endpoint — multi-state.
// The browser polls /api/results. For each state with a configured env var, this
// fetches that state's results file (xlsx workbook or CSV), parses it with the
// shared aggregate library, and merges everything into one payload. CDN-cached,
// so the upstream sources are hit about once a minute total regardless of traffic.
//
// Election night setup (host dashboard -> Environment Variables):
//   MAINE_RESULTS_URL, NC_RESULTS_URL, OH_RESULTS_URL, TX_RESULTS_URL,
//   IA_RESULTS_URL, GA_RESULTS_URL, NE_RESULTS_URL
// Stress test: set TEST_RESULTS_URL to a hosted results.json in the final shape;
// it overrides everything and is served as-is.
// Any state without an env var is simply skipped. Any state that errors is skipped
// (listed in `errors`) without taking down the rest.
import * as XLSX from "xlsx";
import { aggregate } from "../scripts/lib/aggregate.mjs";
import { rowsFromWorkbook, rowsFromCSV } from "../scripts/lib/parse-sources.mjs";

const SOURCES = [
  { state: "ME", env: "MAINE_RESULTS_URL" },
  { state: "NC", env: "NC_RESULTS_URL" },
  { state: "OH", env: "OH_RESULTS_URL" },
  { state: "TX", env: "TX_RESULTS_URL" },
  { state: "IA", env: "IA_RESULTS_URL" },
  { state: "GA", env: "GA_RESULTS_URL" },
  { state: "NE", env: "NE_RESULTS_URL" },
];

async function fetchState(url, state) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`source ${resp.status}`);
  const isCsv = /\.csv(\?|$)/i.test(url) || /text\/csv/i.test(resp.headers.get("content-type") || "");
  let rows;
  if (isCsv) {
    rows = rowsFromCSV(await resp.text());
  } else {
    const buf = Buffer.from(await resp.arrayBuffer());
    rows = rowsFromWorkbook(XLSX.read(buf, { type: "buffer" }));
  }
  return aggregate(rows, state);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=240");

  // Stress-test override: serve a hosted results.json verbatim.
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
  const races = {}, sources = [], errors = [];
  await Promise.all(active.map(async (s) => {
    try {
      const out = await fetchState(process.env[s.env], s.state);
      Object.assign(races, out.races || {});
      sources.push(s.state);
    } catch (e) {
      errors.push(`${s.state}: ${String(e)}`);
    }
  }));
  res.status(200).json({
    updated: new Date().toISOString(),
    source: sources.length ? `live (${sources.join(", ")})` : "error",
    ...(errors.length ? { errors } : {}),
    races,
  });
}
