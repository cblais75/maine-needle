// read-feed.mjs — turn ANY state's results download into plain vote rows.
//
// A row is { county, town, precinct, office, party, candidate, votes, pr, pt }.
// (pr/pt = precincts reporting / total, only when the source states them outright.)
//
// Election night can't depend on guessing each state's format right in advance, so this
// sniffs the bytes and handles every layout our states use:
//   - ZIP files (NC's results_pct zip, Clarity's detailxml.zip, zipped CSVs)
//   - Excel workbooks (.xlsx/.xls), in "long" layout (one row per candidate) or "wide"
//     layout (counties down the side, candidates across the top, like Ohio and Maine)
//   - delimited text: comma, tab, semicolon or pipe, with or without quotes
//   - Clarity/Scytl detail XML (Iowa, Texas counties, many others)
//   - JSON (generic walk; used for vendors like Enhanced Voting)
// aggregate.mjs then keeps only the U.S. Senate race and maps counties to the needle's names.
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import COUNTIES from "./counties.mjs";
import town2county from "./town-county.mjs";

// ---------- county name matching (shared with aggregate.mjs) ----------
// Known abbreviations in official files (Michigan writes "GD. TRAVERSE").
const ALIAS = { GDTRAVERSE: "GRANDTRAVERSE" };
export const normCounty = (s) => {
  const n = String(s ?? "").toUpperCase()
    .replace(/\bCOUNTY\b|\bPARISH\b/g, "").replace(/\bSAINT\b/g, "ST").replace(/[^A-Z0-9]/g, "");
  return ALIAS[n] || n;
};
const countyIndex = {};
for (const [st, list] of Object.entries(COUNTIES)) {
  countyIndex[st] = {};
  for (const n of list) countyIndex[st][normCounty(n)] = n;
}
// Returns the needle's exact county name for this state, or null.
export function matchCounty(state, raw) {
  const ix = countyIndex[state];
  if (!ix || raw == null) return null;
  return ix[normCounty(raw)] || null;
}
function isPlace(state, v) {
  if (v == null || v === "") return false;
  if (state === "ME") return !!(town2county[String(v).trim()] || matchCounty("ME", v));
  return !!matchCounty(state, v);
}

// ---------- header synonyms for "long" layouts ----------
const SYN = {
  county: ["county", "county name", "countyname", "county_name", "county desc", "county_desc", "jurisdiction", "jurisdiction name"],
  town: ["town", "municipality", "town name", "city/town", "city_town"],
  precinct: ["precinct", "precinct name", "precinctname", "precinct_name", "precinct code"],
  office: ["contest name", "contest_name", "contestname", "contest", "office", "office name", "office_name", "officename",
           "office description", "officedescription", "race", "race name", "racename", "contest title"],
  candidate: ["candidate", "candidate name", "candidatename", "candidate_name", "choice", "choice name", "name on ballot",
              "name_on_ballot", "ballot name", "ballotname"],
  first: ["candidatefirstname", "candidate first name", "first name", "firstname"],
  last: ["candidatelastname", "candidate last name", "last name", "lastname"],
  party: ["choice party", "party", "party code", "party_cd", "partycode", "party name", "partyname", "candidate party", "party abbreviation"],
  votes: ["total votes", "total_votes", "totalvotes", "votes", "candidatevotes", "candidate votes", "vote count", "votecount",
          "total vote count", "total_vote_count", "count", "total"],
  votetype: ["vote type", "votetype", "vote mode", "votemode", "vote_mode", "ballot type", "mode"],
  pr: ["precincts reporting", "precinctsreporting", "precincts reported", "precinctsreported"],
  pt: ["total precincts", "totalprecincts", "precincts total", "precincts participating", "precinctsparticipating"],
};
function findHeader(header) {
  const h = header.map((x) => String(x ?? "").trim().toLowerCase());
  const col = {};
  for (const [key, names] of Object.entries(SYN)) {
    let i = -1;
    for (const n of names) { i = h.indexOf(n); if (i >= 0) break; }   // exact names only: "Contest Group ID" must not pass for "Contest"
    col[key] = i;
  }
  // No single total column? Some files split votes by method (election_day_votes, absentee_votes, ...):
  // add those up instead.
  col.voteCols = col.votes >= 0 ? [] : h.map((x, i) => (/votes?$/.test(x) && !/vote ?for|votefor/.test(x) ? i : -1)).filter((i) => i >= 0);
  return col;
}
const looksLong = (c) => (c.county >= 0 || c.town >= 0 || c.precinct >= 0) && (c.votes >= 0 || c.voteCols.length > 0) && (c.candidate >= 0 || c.last >= 0 || c.party >= 0);

function rowsFromTable(aoa, state, sheetName = "") {
  // 1) long layout: find a header row in the first 25 rows
  for (let r = 0; r < Math.min(25, aoa.length); r++) {
    const col = findHeader(aoa[r] || []);
    if (!looksLong(col)) continue;
    const g = (row, k) => (col[k] >= 0 ? row[col[k]] : undefined);
    let body = aoa.slice(r + 1).filter((row) => row && row.length > 1);
    // Files that repeat each candidate once per vote type (Election Day, Absentee, ... Total):
    // keep only the Total rows so nothing is double counted.
    if (col.votetype >= 0 && body.some((row) => /^\s*total/i.test(String(g(row, "votetype") ?? ""))))
      body = body.filter((row) => /^\s*total/i.test(String(g(row, "votetype") ?? "")));
    return body.map((row) => ({
      county: g(row, "county"), town: g(row, "town"), precinct: g(row, "precinct"),
      office: g(row, "office") ?? sheetName, party: g(row, "party") ?? "",
      candidate: col.candidate >= 0 ? g(row, "candidate") : [g(row, "first"), g(row, "last")].filter(Boolean).join(" "),
      votes: col.votes >= 0 ? g(row, "votes") : col.voteCols.reduce((t, i) => t + (Number(String(row[i] ?? "").replace(/[^0-9.-]/g, "")) || 0), 0),
      pr: col.pr >= 0 ? Number(g(row, "pr")) : undefined, pt: col.pt >= 0 ? Number(g(row, "pt")) : undefined,
    }));
  }
  // 2) wide layout: counties (or Maine towns) down one column, candidates across the top
  const width = Math.max(0, ...aoa.map((r) => (r ? r.length : 0)));
  let placeCol = -1, best = 0;
  for (let c = 0; c < width; c++) {
    let hits = 0;
    for (const row of aoa) if (row && isPlace(state, row[c])) hits++;
    if (hits > best) { best = hits; placeCol = c; }
  }
  if (placeCol < 0 || best < 2) return [];
  const first = aoa.findIndex((row) => row && isPlace(state, row[placeCol]));
  // Build each column's header from up to 4 rows above the data, carrying merged titles
  // (like an office name spanning several candidate columns) rightward.
  const top = aoa.slice(Math.max(0, first - 4), first);
  const labels = Array.from({ length: width }, () => []);
  for (const hr of top) {
    let carry = "";
    for (let c = 0; c < width; c++) {
      const v = hr && hr[c] != null && String(hr[c]).trim() !== "" ? String(hr[c]).trim() : "";
      if (v) carry = v;
      const piece = v || (c > placeCol ? carry : "");
      if (piece && c !== placeCol) labels[c].push(piece);
    }
  }
  const rows = [];
  for (let r = first; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || !isPlace(state, row[placeCol])) continue;
    for (let c = 0; c < width; c++) {
      if (c === placeCol || !labels[c].length) continue;
      const val = row[c];
      if (val == null || val === "" || isNaN(Number(String(val).replace(/[^0-9.-]/g, "")))) continue;
      const label = labels[c].join(" | ");
      rows.push({
        county: state === "ME" ? undefined : row[placeCol], town: state === "ME" ? row[placeCol] : undefined,
        office: `${sheetName} | ${label}`, party: "", candidate: label, votes: val,
      });
    }
  }
  return rows;
}

// ---------- delimited text ----------
function splitLine(line, d) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}
function rowsFromText(text, state) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sample = lines.slice(0, 5).join("\n");
  const d = ["\t", ";", "|", ","].map((c) => [c, sample.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  return rowsFromTable(lines.map((l) => splitLine(l, d)), state);
}

// ---------- Clarity / Scytl detail XML ----------
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'") : undefined; };
function rowsFromClarityXML(xml) {
  const rows = [];
  const contests = xml.split(/<Contest\b/).slice(1);
  for (const chunk of contests) {
    const body = chunk.split(/<\/Contest>/)[0];
    const office = attr(body.slice(0, body.indexOf(">")), "text") || "";
    const rep = {};
    const pc = body.match(/<ParticipatingCounties>([\s\S]*?)<\/ParticipatingCounties>/);
    if (pc) for (const t of pc[1].match(/<County\b[^>]*>/g) || [])
      rep[attr(t, "name")] = { pr: Number(attr(t, "precinctsReported")), pt: Number(attr(t, "precinctsParticipating")) };
    for (const ch of body.split(/<Choice\b/).slice(1)) {
      const head = ch.slice(0, ch.indexOf(">"));
      const candidate = attr(head, "text") || "", party = attr(head, "party") || "";
      const sums = {};
      for (const t of ch.split(/<\/Choice>/)[0].match(/<(County|Precinct)\b[^>]*>/g) || []) {
        const nm = attr(t, "name"); sums[nm] = (sums[nm] || 0) + Number(attr(t, "votes") || 0);
      }
      for (const [nm, v] of Object.entries(sums))
        rows.push({ county: nm, office, party, candidate, votes: v, pr: rep[nm]?.pr, pt: rep[nm]?.pt });
    }
  }
  return rows;
}

// ---------- JSON (generic) ----------
const JKEYS = {
  office: /^(contest|contestname|office|officename|race|racename|ballottitle|title)$/i,
  county: /^(county|countyname|jurisdiction|jurisdictionname|locality|localityname)$/i,
  candidate: /^(candidate|candidatename|name|ballotname|choice|choicename|fullname)$/i,
  party: /^(party|partyname|partycode|partyabbreviation|politicalparty)$/i,
  votes: /^(votes|votecount|totalvotes|total|count|ballotcount)$/i,
};
function rowsFromJSON(obj) {
  const rows = [];
  const walk = (node, ctx) => {
    if (Array.isArray(node)) { for (const x of node) walk(x, ctx); return; }
    if (!node || typeof node !== "object") return;
    const c = { ...ctx };
    for (const [k, v] of Object.entries(node)) {
      if (v == null || typeof v === "object") continue;
      for (const [field, re] of Object.entries(JKEYS)) if (re.test(k)) c[field] = v;
    }
    const hasVotes = Object.keys(node).some((k) => JKEYS.votes.test(k) && typeof node[k] !== "object");
    if (hasVotes && c.county != null && c.candidate != null) rows.push({ ...c });
    for (const v of Object.values(node)) if (v && typeof v === "object") walk(v, c);
  };
  walk(obj, {});
  return rows;
}

// ---------- entry point ----------
export function readFeed(input, state, name = "") {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const head = strFromU8(buf.subarray(0, 400)).replace(/^﻿/, "").trimStart();
  // ZIP container (xlsx is also a zip; let SheetJS take those)
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(buf);
    const names = Object.keys(files);
    if (names.includes("[Content_Types].xml")) return rowsFromWorkbook(buf, state);
    return names.filter((n) => !n.endsWith("/")).flatMap((n) => readFeed(files[n], state, n));
  }
  // legacy .xls (OLE2)
  if (buf[0] === 0xd0 && buf[1] === 0xcf) return rowsFromWorkbook(buf, state);
  if (/^<\?xml|^<ElectionResult/i.test(head)) {
    const xml = strFromU8(buf);
    if (/<ElectionResult/i.test(xml)) return rowsFromClarityXML(xml);
    return rowsFromWorkbook(buf, state); // Excel 2003 XML spreadsheets (Clarity "detail.xls")
  }
  if (/^[\[{]/.test(head)) { try { return rowsFromJSON(JSON.parse(strFromU8(buf))); } catch { /* fall through to text */ } }
  if (/^<(!doctype|html)/i.test(head)) throw new Error(`got a web page, not a data file${name ? ` (${name})` : ""} — check the URL`);
  return rowsFromText(strFromU8(buf), state);
}
function rowsFromWorkbook(buf, state) {
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.flatMap((s) =>
    rowsFromTable(XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, blankrows: false, raw: true }), state, s));
}
