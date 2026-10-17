// discover.mjs — automatic link discovery (Update 62).
//
// Iowa and Georgia give every election a new results address, and neither has posted its Nov 3, 2026
// page yet. Instead of a link to one election, IA_RESULTS_URL / GA_RESULTS_URL can point at the state's
// LIST of elections. On every refresh the list is read, the Nov 3, 2026 general election is picked
// (never a primary, runoff, recount, special or city/school election), and that election's county
// results are read as usual. Until the general shows up in the list: "<State>: Nov 3 general not posted yet".
//
//   Iowa (Clarity):  https://electionresults.iowa.gov/IA/elections.json
//     -> [{ "EID": "126082", "ElectionName": "2026 Primary Election", "Date": "6/2/2026 12:00:00 AM" }, ...]
//     -> https://electionresults.iowa.gov/IA/<EID>/{ver}/reports/detailxml.zip
//   Georgia (Enhanced Voting): https://results.sos.ga.gov/results/public/api/jurisdictions/Georgia
//     -> { id, elections: [{ publicElectionId: "2024NovGen", electionDate: "2024-11-05", name: [{ text }] }, ...] }
//     -> .../api/elections/Georgia/<id>/data  (the contests; the same data the app loads)
//     -> .../api/elections/Georgia/<id>/data/ballot-item/<contest id>  (county breakdown, for each contest we track)
//     If no tracked contest is listed yet but the election's "Total Votes Excel" report is posted, that's read instead.
//
// TESTING ONLY: add #election=<election ID or YYYY-MM-DD> to the list link to pick that election instead
// (any kind, e.g. #election=126082 for Iowa's June primary). Never put that in the Vercel setting.
import { tracksOffice } from "./aggregate.mjs";

export const GENERAL_DATE = "2026-11-03";
const STATE_NAMES = { IA: "Iowa", GA: "Georgia" };
// Never the general: primaries, runoffs, recounts, city/school/municipal, presidential preference primaries.
const NOT_GENERAL = /primar|runoff|recount|municipal|city|school|preference/i;

const IOWA_LIST = /^\/([A-Z]{2})\/elections\.json$/i; // Clarity's list, any state on a Clarity host
const isClarityList = (u) => IOWA_LIST.test(u.pathname);
// Georgia's list: the data address the app uses, or the app's own page (same list behind it).
const GA_API = /^\/results\/public\/api\/jurisdictions\/([^/]+)\/?$/i;
const GA_PAGE = /^\/results\/public\/([^/]+)\/?$/i;
const isEVList = (u) => /(^|\.)sos\.ga\.gov$/i.test(u.hostname) && (GA_API.test(u.pathname) || (GA_PAGE.test(u.pathname) && !/^api$/i.test(u.pathname.match(GA_PAGE)[1])));
export const isElectionList = (link) => { try { const u = new URL(link); return isClarityList(u) || isEVList(u); } catch { return false; } };

// "6/2/2026 12:00:00 AM" -> "2026-06-02"; "2026-06-16" stays.
export function isoDate(s) {
  const t = String(s ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

// elections: [{ id, name, date }]. Returns the Nov 3, 2026 general, or null.
// override (testing only): an election ID or date, any kind of election.
export function pickElection(elections, override = null) {
  if (override) return elections.find((e) => String(e.id) === override || e.date === override) || null;
  const ok = elections.filter((e) => e.date === GENERAL_DATE && !NOT_GENERAL.test(e.name) && /gen/i.test(`${e.name} ${e.id}`));
  // If the state lists more than one, prefer the one actually called a general election.
  return ok.find((e) => /general election/i.test(e.name)) || ok[0] || null;
}

// The election-list shapes, as [{ id, name, date }].
export function listFromClarity(json) {
  return (Array.isArray(json) ? json : []).map((e) => ({ id: String(e.EID ?? ""), name: String(e.ElectionName ?? ""), date: isoDate(e.Date) })).filter((e) => e.id);
}
export function listFromEV(json) {
  const text = (v) => (Array.isArray(v) ? (v.find((t) => t.languageId === "en") || v[0] || {}).text : v) ?? "";
  return (json?.elections || []).map((e) => ({ id: String(e.publicElectionId ?? ""), name: String(text(e.name)), date: isoDate(e.electionDate) })).filter((e) => e.id);
}

// link: the setting; getJson(url) downloads and parses JSON. Returns
//   { urls: [result files to read], picked: { id, name, date } }  or  { urls: [], notPosted: "Iowa: Nov 3 general not posted yet" }
export async function discover(link, state, getJson) {
  const [base, frag = ""] = link.split("#");
  const override = (frag.match(/(?:^|&)election=([^&]+)/) || [])[1] || null;
  const u = new URL(base);
  const label = STATE_NAMES[state] || state;
  const notPosted = { urls: [], notPosted: `${label}: Nov 3 general not posted yet` };
  if (isClarityList(u)) {
    const picked = pickElection(listFromClarity(await getJson(base)), override && decodeURIComponent(override));
    if (!picked) return notPosted;
    const root = base.replace(/elections\.json$/i, "");
    return { urls: [`${root}${picked.id}/{ver}/reports/detailxml.zip`], picked };
  }
  // Georgia (Enhanced Voting)
  const jur = (u.pathname.match(GA_API) || u.pathname.match(GA_PAGE))[1];
  const api = `${u.origin}/results/public/api`;
  const list = await getJson(`${api}/jurisdictions/${jur}`);
  const picked = pickElection(listFromEV(list), override && decodeURIComponent(override));
  if (!picked) return notPosted;
  const eid = encodeURIComponent(picked.id);
  const data = await getJson(`${api}/elections/${jur}/${eid}/data`);
  const items = (data?.ballotItems || []).filter((b) => tracksOffice(state, (Array.isArray(b.name) ? (b.name.find((t) => t.languageId === "en") || b.name[0] || {}).text : b.name)));
  if (items.length) return { urls: items.map((b) => `${api}/elections/${jur}/${eid}/data/ballot-item/${encodeURIComponent(b.id)}`), picked };
  // Fallback: the election's "Total Votes" Excel report (the file we tested on 2022 and 2024).
  const election = data?.election || (await getJson(`${api}/elections/${jur}/${eid}`));
  const reports = (election?.publicReportCategories || []).flatMap((c) => c.reports || []);
  const tv = reports.find((r) => /total votes/i.test(r.reportName || r.blobName || "") && /\.xlsx?$/i.test(r.blobName || ""));
  const jurId = election?.jurisdictionId || list?.id;
  if (tv && jurId) return { urls: [`${u.origin}/cdn/results/${jurId}/${encodeURIComponent(tv.blobName)}`], picked };
  return { urls: [], picked, notPosted: `${label}: Nov 3 general listed, but no results posted yet` };
}
