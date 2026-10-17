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
//   - our OWN backup page, public/official/nh.html, for a state whose site blocks
//     automated downloads (New Hampshire does). Someone downloads the official file in a
//     normal browser, it's added to public/official/ with a link on that page, and the
//     needle finishes from our copy. Links are only followed to the same site or .gov/.us.
//   - Kansas's unofficial-results page (sos.ks.gov/ent/kssos_ent.html). It has no data file;
//     the page itself carries every county's votes, so it is read directly.
//   - a state's LIST of elections (Iowa, Georgia; Update 62; South Carolina's results page, Update 64): the Nov 3, 2026 general is picked from
//     the list on every refresh and its results read (see discover.mjs). Until it's listed, the state
//     reports "<State>: Nov 3 general not posted yet" and shows no results.
// Clarity links may contain {ver}; the current folder number is looked up automatically.
import { readFeed, isKansasPage } from "./read-feed.mjs";
import { discover, isElectionList } from "./discover.mjs";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Needlepoint/1.0; +https://needlepoint.news)" };

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
// Primary files named with a party code, e.g. Maine's "US Senate DEM - FINAL.xlsx".
// Capitals only, and never "REP to Congress", so general-election files still count.
const PARTY_CODE = /\b(DEM|REP|GRN|LIB)\b(?![\s-]+[Tt][Oo]\b)/;
export function findResultLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  html = html.replace(/<!--[\s\S]*?-->/g, ""); // ignore commented-out links
  while ((m = re.exec(html))) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!/\.(xlsx?|csv)(\?|#|$)/i.test(href)) continue;
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let file = href.split("/").pop() || "";
    try { file = decodeURIComponent(file); } catch { /* keep raw */ }
    const label = `${text} ${file}`;
    if (!OFFICE_LINK.test(label) || SKIP_LINK.test(label) || PARTY_CODE.test(label)) continue;
    let u;
    try { u = new URL(href, baseUrl); } catch { continue; } // bad link
    // Only follow links to the page's own site or to government hosts.
    if (u.hostname !== new URL(baseUrl).hostname && !/\.(gov|us)$/i.test(u.hostname)) continue;
    out.push({ url: u.href, label });
  }
  const seen = new Set();
  return out.filter((x) => (seen.has(x.url) ? false : seen.add(x.url))).slice(0, 8);
}
const looksHtml = (buf) => /^\s*<(!doctype|html|head|body)/i.test(new TextDecoder().decode(buf.subarray(0, 300)));

// Kansas: ent.sos.ks.gov sits behind a Cloudflare bot check that no server can pass, but the same
// pages are served without it at sos.ks.gov/ent/ (and www.kssos.org/ent/). If a setting points at
// ent.sos.ks.gov, read the same page from the mirror instead.
const KS_CHALLENGED = /^ent\.sos\.ks\.gov$/i;
function ksMirror(url) {
  const u = new URL(url);
  if (!KS_CHALLENGED.test(u.hostname)) return null;
  const page = u.pathname.replace(/^\/+/, "") || "kssos_ent.html";
  return `https://sos.ks.gov/ent/${page}`;
}
async function download(url) {
  const alt = ksMirror(url);
  try {
    const buf = new Uint8Array(await (await get(url)).arrayBuffer());
    if (alt && /IM_UNDER_ATTACK/.test(new TextDecoder().decode(buf))) throw new Error("bot check");
    return buf;
  } catch (e) {
    if (!alt) throw e;
    return new Uint8Array(await (await get(alt)).arrayBuffer());
  }
}

// Returns { rows, files }: all vote rows from every file this setting points to.
// With an election list: also { picked } (the election chosen) or { notPosted } (the message to show).
export async function fetchRows(setting, state) {
  const urls = [], rows = [], files = [], out = { rows, files };
  for (const link of String(setting || "").split(/\s+/).filter(Boolean)) {
    if (!isElectionList(link)) { urls.push(link); continue; }
    const d = await discover(link, state, async (u) => (await get(u)).json(), async (u) => (await get(u)).text());
    if (d.picked) out.picked = d.picked;
    if (d.notPosted) out.notPosted = d.notPosted;
    urls.push(...d.urls);
  }
  for (const raw of urls) {
    const url = await resolveUrl(raw);
    const buf = await download(url);
    const html = looksHtml(buf) ? new TextDecoder().decode(buf) : null;
    if (html && isKansasPage(html)) {
      // Kansas's results page IS the data: every county's votes are in the page itself.
      for (const r of readFeed(buf, state, url)) rows.push(r);
      files.push(url);
    } else if (html) {
      const links = findResultLinks(html, url);
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
  return out;
}
