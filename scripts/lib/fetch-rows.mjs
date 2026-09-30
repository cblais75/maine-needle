// fetch-rows.mjs — download a state's results and turn them into vote rows.
//
// A state's setting (its Vercel env var) can hold:
//   - one results file link (zip, Excel, CSV, XML, JSON), or
//   - several links separated by spaces (Maine posts one spreadsheet per office), or
//   - the link to a results WEB PAGE. The page is scanned for spreadsheet links whose
//     name or link text is one of our offices (U.S. Senator, Governor, Representative
//     to Congress), and those files are read. This is how Maine and New Hampshire finish
//     on their own: point the setting at the state's results page before election night,
//     and the needles pick up the official files whenever the state posts them.
// Clarity links may contain {ver}; the current folder number is looked up automatically.
import { readFeed } from "./read-feed.mjs";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; TheNeedleProject/1.0; +https://theneedleproject.vercel.app)" };

export async function get(url, ms = 20000) {
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

// Offices we track, as they appear in link text or file names on state results pages.
const OFFICE_LINK = /(u\.?[\s-]*s\.?|united[\s-]+states)[\s-]*senat|governor|rep(resentative)?\.?[\s-]+to[\s-]+congress|congressional[\s-]*district/i;
// Everything else on those pages: primaries, other offices, ballot-image exports.
const SKIP_LINK = /primar|democrat|republican|green|libertarian|state[\s-]+senat|legislat|county|probate|sheriff|register|treasurer|commissioner|referend|cvr|export|uocava|aux|turnout|ballots?[\s-]*cast|house-|executive/i;
export function findResultLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!/\.(xlsx?|csv)(\?|#|$)/i.test(href)) continue;
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let file = href.split("/").pop() || "";
    try { file = decodeURIComponent(file); } catch { /* keep raw */ }
    const label = `${text} ${file}`;
    if (!OFFICE_LINK.test(label) || SKIP_LINK.test(label)) continue;
    try { out.push({ url: new URL(href, baseUrl).href, label }); } catch { /* bad link */ }
  }
  const seen = new Set();
  return out.filter((x) => (seen.has(x.url) ? false : seen.add(x.url))).slice(0, 8);
}
const looksHtml = (buf) => /^\s*<(!doctype|html|head|body)/i.test(new TextDecoder().decode(buf.subarray(0, 300)));

// Returns { rows, files }: all vote rows from every file this setting points to.
export async function fetchRows(setting, state) {
  const urls = String(setting || "").split(/\s+/).filter(Boolean);
  const rows = [], files = [];
  for (const raw of urls) {
    const url = await resolveUrl(raw);
    const buf = new Uint8Array(await (await get(url)).arrayBuffer());
    if (looksHtml(buf)) {
      const links = findResultLinks(new TextDecoder().decode(buf), url);
      for (const l of links) {
        const b = new Uint8Array(await (await get(l.url)).arrayBuffer());
        // Tag every row with the link's label so the office is known even when the
        // spreadsheet itself only lists towns and candidate names.
        for (const r of readFeed(b, state, l.url)) rows.push({ ...r, office: `${l.label} | ${r.office ?? ""}` });
        files.push(l.url);
      }
    } else {
      for (const r of readFeed(buf, state, url)) rows.push(r);
      files.push(url);
    }
  }
  return { rows, files };
}
