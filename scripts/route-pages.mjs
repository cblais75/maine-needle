// Runs after "vite build" (Nov 14). For every page address (/mississippi/senate, /maine, /briefing, ...)
// it writes a copy of dist/index.html with that page's own title, summary and preview image, so a shared
// link shows the right card on Bluesky, iMessage, Substack and Facebook (their link readers don't run JavaScript).
// Vercel serves these files first; any other address still falls through to index.html (vercel.json).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RACES, STATES, stateSlug, pathOf, imageOf, headlineOf, byArea } from "./lib/og-races.mjs";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const SITE = "https://needlepoint.news";
const base = readFileSync(`${DIST}index.html`, "utf8");
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");


function render({ path, title, desc, image, h1, body, og }) {
  const url = SITE + path, img = SITE + image;
  const short = og || title.replace(/ \| Needlepoint$/, "");
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${attr(title)}</title>`],
    [/(<link rel="canonical" href=")[^"]*/, `$1${url}`],
    [/(<meta name="description" content=")[^"]*/, `$1${attr(desc)}`],
    [/(<meta property="og:title" content=")[^"]*/, `$1${attr(short)}`],
    [/(<meta property="og:description" content=")[^"]*/, `$1${attr(desc)}`],
    [/(<meta property="og:url" content=")[^"]*/, `$1${url}`],
    [/(<meta property="og:image" content=")[^"]*/, `$1${img}`],
    [/(<meta name="twitter:title" content=")[^"]*/, `$1${attr(short)}`],
    [/(<meta name="twitter:description" content=")[^"]*/, `$1${attr(desc)}`],
    [/(<meta name="twitter:image" content=")[^"]*/, `$1${img}`],
    [/<noscript>[\s\S]*?<\/noscript>/, `<noscript>\n      <h1>${attr(h1)}</h1>\n      <p>${attr(body)} Turn on JavaScript to see the needle.</p>\n    </noscript>`],
  ];
  let html = base;
  for (const [re, to] of swaps) {
    if (!re.test(html)) throw new Error(`route-pages: index.html is missing ${re}`);
    html = html.replace(re, to);
  }
  const dir = DIST + path.slice(1);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, html);
}

const DEFAULT_IMG = "/og-image.png?v=4";
const pages = [];
for (const r of RACES) {
  const head = headlineOf(r);
  const vs = `${r.w[0]} (${r.w[1]}) defeated ${r.l[0]} (${r.l[1]})${r.third ? ` and ${r.third[0]} (${r.third[1]})` : ""}`;
  const desc = `${vs}. ${byArea(r)} results and the final Needlepoint needle for ${STATES[r.state]}'s 2026 ${r.title} race.`;
  const page = { title: `${head}: 2026 results | Needlepoint`, desc, image: imageOf(r), h1: `${head}`, body: `${vs} in ${STATES[r.state]}'s 2026 ${r.title} race.` };
  pages.push({ path: pathOf(r), ...page });
  // A state with one race opens straight to that race, so its state page gets the same card.
  if (RACES.filter((x) => x.state === r.state).length === 1) pages.push({ path: `/${stateSlug(r.state)}`, ...page });
}
// States with several races get a page listing every result.
for (const code of Object.keys(STATES)) {
  const list = RACES.filter((x) => x.state === code);
  if (list.length < 2) continue;
  const offices = list.map((x) => x.title.replace("U.S. Senate (special)", "Senate").replace("U.S. Senate", "Senate").replace(/U\.S\. House.*/, "House").replace("Governor", "governor"));
  const uniq = [...new Set(offices)];
  const what = uniq.length > 1 ? `${uniq.slice(0, -1).join(", ")} and ${uniq[uniq.length - 1]}` : uniq[0];
  const desc = `${list.map((x) => `${x.w[0]} wins the ${x.office}`).join(". ")}. County-by-county results and needles for every ${STATES[code]} race.`;
  pages.push({ path: `/${stateSlug(code)}`, title: `${STATES[code]} 2026 election results: ${what} | Needlepoint`, desc, image: DEFAULT_IMG, h1: `${STATES[code]} 2026 election results`, body: desc.replace(/ County-by-county.*/, "") });
}
const VIEWS = [
  ["/senate-control", "Senate control", "Who controls the Senate after the 2026 midterms, race by race."],
  ["/briefing", "Briefing", "Analysis and race notes from Needlepoint's 2026 election coverage."],
  ["/polls", "Polling averages", "Polling averages for every 2026 Senate, governor and House race Needlepoint tracked."],
  ["/pollster-ratings", "Pollster ratings", "Needlepoint's quality ratings for the pollsters behind 2026 Senate and governor polls."],
  ["/how-it-works", "How the needles work", "How Needlepoint's election-night needles turn county results into a chance of winning."],
  ["/2026-scorecard", "2026 forecast and pollster scorecard", "How Needlepoint's forecast did in 2026, and which pollsters came closest to the results."],
  ["/custom-dashboards", "Custom race dashboards", "Custom election-night dashboards like Needlepoint's, built for campaigns and organizations."],
  ["/special-elections", "Special elections tracker", "Every special election compared with the 2024 presidential vote in the same district, from 2025 through the 2027–28 cycle."],
  ["/vote", "How to vote", "Where to find official voting information for the states Needlepoint covers."],
  ["/live-wire", "Live wire", "Running updates from election night 2026."],
];
for (const [path, name, desc] of VIEWS) pages.push({ path, title: `${name} | Needlepoint`, og: `Needlepoint: ${name}`, desc, image: DEFAULT_IMG, h1: name, body: desc });

for (const p of pages) render(p);
console.log(`route-pages: wrote ${pages.length} pages`);
