// Build public/results.json for local/dev use.
//   --file results.xlsx | --url https://... | --csv clean.csv | --demo
// On the hosted site, the same parsing runs in api/results.js instead.
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { aggregate } from "./lib/aggregate.mjs";
import { rowsFromWorkbook, rowsFromCSV } from "./lib/parse-sources.mjs";

const LIVE_URL = process.env.MAINE_RESULTS_URL || ""; // set on election night
const args = process.argv.slice(2);
const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const out = new URL("../public/results.json", import.meta.url);

const W = { Cumberland:179900, York:121918, Penobscot:80046, Kennebec:67145, Androscoggin:55160, Aroostook:33783, Hancock:32750, Oxford:31272, Somerset:25216, Knox:23895, Sagadahoc:22345, Waldo:22306, Lincoln:22177, Washington:16447, Franklin:16093, Piscataquis:9258 };
function demoResults() {
  const counties = {};
  for (const [co, exp] of Object.entries(W)) {
    const inFrac = (co === "Cumberland" || co === "York") ? 0.35 : 0.8;
    const counted = Math.round(exp * inFrac), demShare = 0.515 + (Math.random() - 0.5) * 0.06;
    counties[co] = { dem: Math.round(counted * demShare), rep: Math.round(counted * (1 - demShare)) };
  }
  return { updated: new Date().toISOString(), source: "DEMO (fake partial count)", races: { sen: { counties } } };
}

async function main() {
  let result;
  if (args.includes("--demo")) result = demoResults();
  else if (opt("--csv")) result = aggregate(rowsFromCSV(readFileSync(opt("--csv"), "utf8")));
  else if (opt("--file")) result = aggregate(rowsFromWorkbook(XLSX.read(readFileSync(opt("--file")), { type: "buffer" })));
  else if (opt("--url") || LIVE_URL) {
    const url = opt("--url") || LIVE_URL;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    result = aggregate(rowsFromWorkbook(XLSX.read(buf, { type: "buffer" })));
  } else { console.log("No source. Use --demo, --file x.xlsx, --url ..., or --csv x.csv"); return; }
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`Wrote results.json — races: ${Object.keys(result.races || {}).join(", ") || "none"}`);
  if (result._diag) console.log("diagnostics:", JSON.stringify(result._diag));
}
main();
