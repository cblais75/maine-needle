// convert-tsv-to-csv.mjs
// Reads the NC SBoE tab-delimited precinct results file and outputs a clean CSV
// with only the 5 columns build-baseline-nc.mjs needs, named unambiguously so
// the fuzzy column matcher cannot confuse "Contest Group ID" with "Contest Name".
//
// Output columns: county, contest, candidate, party, votes
//
// Usage: node scripts/convert-tsv-to-csv.mjs <input.txt> <output.csv>

import fs from "node:fs";

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("Usage: node convert-tsv-to-csv.mjs <input.txt> <output.csv>");
  process.exit(1);
}

const text = fs.readFileSync(input, "utf8");
const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

const quote = (f) => {
  f = String(f ?? "").trim();
  if (f.includes(",") || f.includes('"') || f.includes("\n")) {
    return '"' + f.replace(/"/g, '""') + '"';
  }
  return f;
};

// Parse header line to find column indices
const header = lines[0].split("\t").map((h) => h.trim().toLowerCase());
const idx = (name) => header.findIndex((h) => h === name);

const colCounty   = idx("county");
const colContest  = idx("contest name");
const colChoice   = idx("choice");
const colParty    = idx("choice party");
const colVotes    = idx("total votes");

console.log(`Column indices — county:${colCounty} contest:${colContest} choice:${colChoice} party:${colParty} votes:${colVotes}`);

if ([colCounty, colContest, colChoice, colParty, colVotes].includes(-1)) {
  console.error("ERROR: could not find all required columns. Raw header:", lines[0]);
  process.exit(1);
}

const outLines = ["county,contest,candidate,party,votes"];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const f = line.split("\t");
  outLines.push([
    quote(f[colCounty]),
    quote(f[colContest]),
    quote(f[colChoice]),
    quote(f[colParty]),
    quote(f[colVotes]),
  ].join(","));
}

fs.writeFileSync(output, outLines.join("\n"), "utf8");
console.log(`Wrote ${outLines.length - 1} data rows → ${output}`);
