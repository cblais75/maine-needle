// Shared source readers: Maine SoS Excel -> rows, and clean CSV -> rows.
// Both the CLI (update-results.mjs) and the serverless function import these,
// so there is exactly one parsing implementation.
import * as XLSX from "xlsx";
import town2county from "./town-county.mjs";

function townCounty(v) {
  let n = String(v || "").trim();
  if (town2county[n]) return town2county[n];
  for (const s of [" Ward", " CP", " City", " Precinct"]) if (n.includes(s)) n = n.split(s)[0].trim();
  return town2county[n] || null;
}

// Excel: towns as rows, candidate columns, one office per sheet (adaptive).
export function rowsFromWorkbook(wb) {
  const rows = [];
  for (const sheet of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false });
    if (!aoa.length) continue;
    let townCol = -1, best = 0;
    const width = Math.max(...aoa.map((r) => r.length));
    for (let c = 0; c < width; c++) {
      let hits = 0;
      for (const r of aoa) if (r[c] != null && townCounty(r[c])) hits++;
      if (hits > best) { best = hits; townCol = c; }
    }
    if (townCol < 0 || best < 2) continue;
    const dataRowIdx = aoa.findIndex((r) => r[townCol] != null && townCounty(r[townCol]));
    const header = aoa[dataRowIdx - 1] || [];
    for (let r = dataRowIdx; r < aoa.length; r++) {
      const town = aoa[r][townCol];
      if (town == null || !townCounty(town)) continue;
      for (let c = 0; c < width; c++) {
        if (c === townCol) continue;
        const cand = header[c], val = aoa[r][c];
        if (cand && typeof cand === "string" && val != null && !isNaN(Number(String(val).replace(/[^0-9.-]/g, ""))))
          rows.push({ town, office: sheet, party: "", candidate: cand, votes: val });
      }
    }
  }
  return rows;
}

// Clean CSV: town,office,party,candidate,votes (extra columns ignored).
export function rowsFromCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const parse = (l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o.map((s) => s.trim()); };
  const head = parse(lines[0]).map((h) => h.toLowerCase());
  const ix = (n) => head.indexOf(n);
  const ci = { town: ix("town") >= 0 ? ix("town") : ix("precinct"), office: ix("office"), party: ix("party"), candidate: ix("candidate"), votes: ix("votes") };
  return lines.slice(1).map(parse).map((r) => ({
    town: r[ci.town], office: r[ci.office], party: ci.party >= 0 ? r[ci.party] : "", candidate: r[ci.candidate], votes: r[ci.votes],
  }));
}
