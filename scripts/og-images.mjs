// Draws one 1200x630 link preview image per race into public/og/ (Nov 14).
// Run by hand after a call changes, not on Vercel (it needs a browser):
//   npm i --no-save playwright @fontsource/newsreader @fontsource/public-sans && node scripts/og-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { RACES, STATES, pathOf, imageOf, headlineOf, byArea } from "./lib/og-races.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const { chromium } = await import("playwright");
const FONT = (pkg, file) => `file://${ROOT}node_modules/@fontsource/${pkg}/files/${file}`;
const BLUE = "#1D5FA6", RED = "#B3261E", TEAL = "#0F7A68", PAPER = "#F4EFE4", INK = "#1B1A17";
const PARTY = { D: BLUE, R: RED, I: TEAL };
const NAME = { D: "Democrat", R: "Republican", I: "Independent" };
const tint = (hex, t = 0.68) => {
  const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const a = h(hex), b = h(PAPER);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Same dial as the site: the non-Republican on the left, the Republican on the right, needle pinned to the winner.
function dial(r) {
  const rep = r.w[1] === "R" ? r.w : r.l, other = r.w[1] === "R" ? r.l : r.w;
  const deg = r.w[1] === "R" ? 84 : -84;
  return `<svg viewBox="0 0 220 125" width="400" height="227">
    <path d="M 20 110 A 90 90 0 0 1 110 20" fill="none" stroke="${tint(PARTY[other[1]])}" stroke-width="20"/>
    <path d="M 110 20 A 90 90 0 0 1 200 110" fill="none" stroke="${tint(PARTY[rep[1]])}" stroke-width="20"/>
    <line x1="110" y1="6" x2="110" y2="34" stroke="${INK}" stroke-width="1"/>
    <g transform="rotate(${deg} 110 110)"><line x1="110" y1="110" x2="110" y2="26" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/></g>
    <circle cx="110" cy="110" r="7" fill="${INK}"/>
  </svg>
  <div class="ends"><span style="color:${PARTY[other[1]]}">${esc(other[0])}</span><span style="color:${PARTY[rep[1]]}">${esc(rep[0])}</span></div>`;
}

const page = (r) => {
  const wc = PARTY[r.w[1]], lc = PARTY[r.l[1]];
  const head = headlineOf(r);
  const size = head.length > 44 ? 62 : head.length > 34 ? 70 : 78;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Newsreader";font-weight:600;src:url(${FONT("newsreader", "newsreader-latin-600-normal.woff2")})}
@font-face{font-family:"Newsreader";font-weight:700;src:url(${FONT("newsreader", "newsreader-latin-700-normal.woff2")})}
@font-face{font-family:"Public Sans";font-weight:600;src:url(${FONT("public-sans", "public-sans-latin-600-normal.woff2")})}
@font-face{font-family:"Public Sans";font-weight:700;src:url(${FONT("public-sans", "public-sans-latin-700-normal.woff2")})}
*{margin:0;padding:0;box-sizing:border-box}
#c{width:1200px;height:630px;padding:40px 56px 36px;background:${PAPER};color:${INK};font-family:"Public Sans",sans-serif;display:flex;flex-direction:column}
.mast{display:flex;align-items:center;justify-content:space-between}
.kicker{display:flex;align-items:center;gap:12px;font-size:17px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:#5A564E}
.tag{background:${INK};color:${PAPER};padding:6px 11px;letter-spacing:2px}
.brand{font-family:"Newsreader",serif;font-weight:700;font-size:46px;letter-spacing:-1px;line-height:1}
.rule{border-top:3px solid ${INK};border-bottom:1px solid ${INK};height:6px;margin:16px 0 0}
.grid{flex:1;display:grid;grid-template-columns:1fr 400px;gap:44px;align-items:center}
h1{font-family:"Newsreader",serif;font-weight:700;font-size:${size}px;line-height:1.03;letter-spacing:-1.4px}
h1 b{color:${wc}}
.vs{margin-top:22px;font-size:25px;font-weight:600;color:#3A3732;line-height:1.35}
.vs .w{color:${wc};font-weight:700}.vs .l{color:${lc}}
.ends{display:flex;justify-content:space-between;font-family:"Newsreader",serif;font-weight:700;font-size:26px;margin-top:4px;padding:0 6px}
.called{margin-top:14px;text-align:center;font-size:16px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:${wc}}
.foot{background:${INK};color:${PAPER};border-radius:12px;padding:15px 24px;display:flex;justify-content:space-between;align-items:center}
.foot .u{font-family:"Newsreader",serif;font-weight:700;font-size:28px;line-height:1}
.foot .t{font-size:16px;font-weight:600;opacity:.85}
</style></head><body><div id="c">
<div class="mast"><div class="kicker"><span class="tag">Race call</span>${esc(STATES[r.state])} · ${esc(r.title)} · 2026</div><div class="brand">Needlepoint</div></div>
<div class="rule"></div>
<div class="grid">
  <div><h1><b>${esc(r.w[0])}</b> wins ${esc(head.slice(r.w[0].length + 6))}</h1>
  <div class="vs"><span class="w">✓ ${esc(r.w[0])}</span> (${NAME[r.w[1]]}) defeats <span class="l">${esc(r.l[0])}</span> (${NAME[r.l[1]]})${r.third ? ` and ${esc(r.third[0])} (${NAME[r.third[1]]})` : ""}</div></div>
  <div>${dial(r)}<div class="called">Called for ${esc(r.w[0])}</div></div>
</div>
<div class="foot"><div class="u">needlepoint.news${pathOf(r)}</div><div class="t">${byArea(r)} results</div></div>
</div></body></html>`;
};

mkdirSync(`${ROOT}public/og`, { recursive: true });
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const only = process.argv[2];
for (const r of RACES) {
  if (only && r.id !== only) continue;
  const tmp = `${tmpdir()}/og-card.html`;
  writeFileSync(tmp, page(r));
  await p.goto(`file://${tmp}`);
  await p.evaluate(() => document.fonts.ready);
  if (!(await p.evaluate(() => document.fonts.check('700 40px "Newsreader"')))) throw new Error("fonts did not load");
  await p.locator("#c").screenshot({ path: `${ROOT}public${imageOf(r)}` });
  console.log("wrote", imageOf(r));
}
await b.close();
