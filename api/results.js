// Serverless results endpoint for the hosted site.
// The browser polls /api/results; this fetches Maine's latest results spreadsheet,
// parses it with the same shared library the CLI uses, and returns county results.
// Cached at the CDN for ~60s, so Maine's site is hit at most about once a minute
// no matter how many friends are watching. Laptop-off, fully automatic.
//
// Election night: set the env var MAINE_RESULTS_URL (in the host dashboard) to the
// Maine SoS results spreadsheet URL. Until then it returns empty -> the app simulates.
import * as XLSX from "xlsx";
import { aggregate } from "../scripts/lib/aggregate.mjs";
import { rowsFromWorkbook } from "../scripts/lib/parse-sources.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  const url = process.env.MAINE_RESULTS_URL;
  if (!url) {
    res.status(200).json({ updated: null, source: "simulation", races: {} });
    return;
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`source ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const result = aggregate(rowsFromWorkbook(wb));
    res.status(200).json(result);
  } catch (e) {
    // never crash the page — fall back to empty so the app keeps running
    res.status(200).json({ updated: null, source: "error", error: String(e), races: {} });
  }
}
