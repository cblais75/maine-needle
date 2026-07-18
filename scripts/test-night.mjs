// test-night.mjs — election-night stress-test harness.
// Fabricates a synthetic night for the six county-mapped states (NC, OH, TX, IA, GA, NE),
// runs it through the REAL parser + aggregator (the same code election night uses),
// and writes public/results.json snapshots the app picks up.
//
//   node scripts/test-night.mjs --frac 0.4          one snapshot at 40% reporting
//   node scripts/test-night.mjs --auto --minutes 30 full night, 0 -> 100%, rewriting every 20s
//   node scripts/test-night.mjs --reset             restore the dormant simulation file
//
// Run the app locally (npm run dev) while --auto runs, or push a snapshot and point
// TEST_RESULTS_URL at it to test the hosted site. Swings are random each run, so every
// test night is a different election. Deterministic per run via --seed N.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { aggregate } from "./lib/aggregate.mjs";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "results.json");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d; };

if (has("--reset")) {
  fs.writeFileSync(OUT, JSON.stringify({ updated: null, source: "simulation", races: {} }, null, 2));
  console.log("reset -> dormant simulation file");
  process.exit(0);
}

// mulberry32 — seedable RNG so a run can be reproduced
let seed = val("--seed", Math.floor(Math.random() * 1e9));
const rng = (() => { let a = seed; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

const STATES = [
  { state: "NC", office: "U.S. Senate", dem: "Cooper",   rep: "Whatley",  baseline: "nc-baseline.json" },
  { state: "OH", office: "U.S. Senate", dem: "Brown",    rep: "Husted",   baseline: "oh-baseline.json" },
  { state: "TX", office: "U.S. Senate", dem: "Talarico", rep: "Paxton",   baseline: "tx-baseline.json" },
  { state: "IA", office: "U.S. Senate", dem: "Turek",    rep: "Hinson",   baseline: "ia-baseline.json" },
  { state: "GA", office: "U.S. Senate", dem: "Ossoff",   rep: "Collins",  baseline: "ga-baseline.json" },
  { state: "NE", office: "U.S. Senate", dem: "Osborn",   rep: "Ricketts", baseline: "ne-baseline.json" },
];

// One synthetic "truth" per run: statewide swing per state, county noise, county report order.
const night = STATES.map((s) => {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data", s.baseline), "utf8"));
  const counties = Object.keys(b.lean).map((name) => ({
    name,
    weight: b.weight[name],
    demShare: Math.min(0.97, Math.max(0.03, b.statewideDemTwoParty + b.lean[name] + (rng() - 0.5) * 0.06)),
    order: rng(),           // when this county starts reporting (staggered like a real night)
    speed: 0.6 + rng() * 0.8, // how fast it counts once it starts
  }));
  return { ...s, swing: (rng() - 0.5) * 0.08, counties };
});

function snapshotRows(frac) {
  const perState = {};
  for (const s of night) {
    const rows = [];
    for (const c of s.counties) {
      // county's own reporting progress at this point in the night
      const local = Math.min(1, Math.max(0, (frac - c.order * 0.7) * (1.6 * c.speed)));
      if (local <= 0) continue;
      const turnout = Math.round(c.weight * local);
      const demShare = Math.min(0.97, Math.max(0.03, c.demShare + s.swing));
      rows.push({ county: c.name, office: s.office, party: "DEM", candidate: s.dem, votes: Math.round(turnout * demShare) });
      rows.push({ county: c.name, office: s.office, party: "REP", candidate: s.rep, votes: Math.round(turnout * (1 - demShare)) });
    }
    perState[s.state] = rows;
  }
  return perState;
}

function writeSnapshot(frac) {
  const races = {};
  const perState = snapshotRows(frac);
  for (const s of night) {
    const out = aggregate(perState[s.state], s.state);   // <-- the real aggregator
    Object.assign(races, out.races || {});
  }
  fs.writeFileSync(OUT, JSON.stringify({
    updated: new Date().toISOString(),
    source: `stress-test (seed ${seed}, ${(frac * 100).toFixed(0)}% in)`,
    races,
  }, null, 2));
  console.log(`wrote snapshot at ${(frac * 100).toFixed(0)}% in (seed ${seed})`);
}

if (has("--auto")) {
  const minutes = val("--minutes", 30);
  const stepMs = 20000;
  const steps = Math.max(2, Math.round((minutes * 60000) / stepMs));
  console.log(`auto night: 0 -> 100% over ${minutes} min (${steps} snapshots, every 20s). Ctrl-C to stop.`);
  let i = 0;
  writeSnapshot(0.02);
  const t = setInterval(() => {
    i++;
    writeSnapshot(Math.min(1, i / steps));
    if (i >= steps) { clearInterval(t); console.log("night complete - run --reset when done."); }
  }, stepMs);
} else {
  writeSnapshot(Math.min(1, Math.max(0, val("--frac", 0.5))));
}
