// /api/feed-check?state=NC&url=<official results file>[&office=PRESIDENT&dem=harris&rep=trump]
// Tests a results file THROUGH THE HOSTED SITE, so we learn before election night whether the
// host's servers can download each state's file (some state sites block cloud servers) and
// whether it reads cleanly. Changes nothing on the site. Only official election hosts are
// allowed, so this can't be used to fetch arbitrary pages.
import { aggregate } from "../scripts/lib/aggregate.mjs";
import { readFeed } from "../scripts/lib/read-feed.mjs";
import COUNTIES from "../scripts/lib/counties.mjs";
import { resolveUrl } from "./results.js";

const ALLOWED = [/\.gov$/i, /\.us$/i, /(^|\.)clarityelections\.com$/i, /(^|\.)enhancedvoting\.com$/i, /(^|\.)texas-election\.com$/i];
const s3ok = (u) => u.hostname === "s3.amazonaws.com" && u.pathname.startsWith("/dl.ncsbe.gov/");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60");
  const q = req.query || {};
  const state = String(q.state || "").toUpperCase();
  let url;
  try { url = new URL(String(q.url || "").replace("{ver}", "0")); } catch { url = null; }
  if (!COUNTIES[state] || !url) return res.status(400).json({ ok: false, error: "need ?state=XX&url=..." });
  if (!(ALLOWED.some((re) => re.test(url.hostname)) || s3ok(url)))
    return res.status(400).json({ ok: false, error: `host not allowed: ${url.hostname}` });
  const t0 = Date.now();
  try {
    const real = await resolveUrl(String(q.url));
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(real, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; TheNeedleProject/1.0; +https://theneedleproject.vercel.app)" } });
    clearTimeout(t);
    if (!r.ok) return res.status(200).json({ ok: false, step: "download", status: r.status, url: real });
    const buf = new Uint8Array(await r.arrayBuffer());
    const t1 = Date.now();
    const rows = readFeed(buf, state, real);
    const options = q.office ? { office: new RegExp(esc(String(q.office)), "i"),
      names: { ...(q.dem ? { dem: new RegExp(esc(String(q.dem)), "i") } : {}), ...(q.rep ? { rep: new RegExp(esc(String(q.rep)), "i") } : {}) } } : {};
    const out = aggregate(rows, state, options);
    const race = Object.values(out.races)[0];
    const got = race ? Object.keys(race.counties) : [];
    const tot = (k) => got.reduce((s, c) => s + (race.counties[c][k] || 0), 0);
    res.status(200).json({
      ok: !!race && got.length === COUNTIES[state].length,
      url: real, mb: +(buf.length / 1e6).toFixed(2), downloadSec: (t1 - t0) / 1000, readSec: (Date.now() - t1) / 1000,
      rows: rows.length, countiesMatched: `${got.length} of ${COUNTIES[state].length}`,
      totals: race ? { dem: tot("dem"), rep: tot("rep") } : null,
      missing: COUNTIES[state].filter((c) => !got.includes(c)).slice(0, 20),
      diag: out._diag,
    });
  } catch (e) {
    res.status(200).json({ ok: false, step: "read", error: String(e), seconds: (Date.now() - t0) / 1000 });
  }
}
