import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, RotateCcw, ChevronLeft } from "lucide-react";
import ErrorBoundary from "./ErrorBoundary.jsx";
import ncBaseline from "../data/nc-baseline.json";
import ohBaseline from "../data/oh-baseline.json";
import txBaseline from "../data/tx-baseline.json";
import iaBaseline from "../data/ia-baseline.json";
import gaBaseline from "../data/ga-baseline.json";
import neBaseline from "../data/ne-baseline.json";
import miBaseline from "../data/mi-baseline.json";
import nhBaseline from "../data/nh-baseline.json";

// Newspaper palette (Update 42): warm paper, black ink, red/blue kept for results only.
// `ink` is the PAGE color (the name dates from the old dark theme); `text` is the ink.
const C = {
  ink: "#F4EFE4", panel: "#FBF8F1", panel2: "#EFE8D9", line: "#CFC7B6",
  text: "#1B1A17", muted: "#5A564E", brass: "#8A6116", body: "#3A3732",
};
const BLUE = "#1D5FA6", RED = "#B3261E", TEAL = "#0F7A68", AMBER = "#A5520F";

// base county baselines (illustrative two-party Dem share + expected vote)
const CO = {
  Cumberland: [0.66, 185000], York: [0.57, 118000], Penobscot: [0.47, 88000],
  Kennebec: [0.51, 70000], Androscoggin: [0.50, 56000], Aroostook: [0.42, 36000],
  Hancock: [0.53, 33000], Oxford: [0.46, 32000], Somerset: [0.41, 28000],
  Knox: [0.57, 24000], Waldo: [0.54, 22000], Lincoln: [0.53, 21000],
  Sagadahoc: [0.55, 21000], Franklin: [0.47, 17000], Washington: [0.45, 17000],
  Piscataquis: [0.38, 9000],
};
const unit = (name, prior, w) => ({ name, prior, weight: w });
const fromCO = (names, shift = 0) =>
  names.map((n) => unit(n, clamp(CO[n][0] + shift, 0.02, 0.98), CO[n][1]));
const all16 = Object.keys(CO);
const south = ["Cumberland", "York", "Sagadahoc", "Lincoln", "Knox", "Kennebec", "Waldo"];
const north = ["Penobscot", "Androscoggin", "Aroostook", "Hancock", "Oxford", "Somerset", "Franklin", "Washington", "Piscataquis"];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// REAL DATA, blended baseline for the Senate map.
// SEN_LEAN = each county's partisan tilt vs the statewide result, built from
//   2020 Senate (Collins-Gideon, weighted 60%) + 2020 & 2016 President (40%).
// SEN_W = real county turnout (2020 Senate two-party). Source: OpenElections.
// The statewide CENTER is set live from polling, so prior_i = center + lean_i.
const SEN_LEAN = {
  Cumberland: 0.138, York: 0.016, Penobscot: -0.089, Kennebec: -0.040,
  Androscoggin: -0.051, Aroostook: -0.140, Hancock: 0.014, Oxford: -0.084,
  Somerset: -0.159, Knox: 0.056, Sagadahoc: 0.027, Waldo: -0.018,
  Lincoln: 0.001, Washington: -0.134, Franklin: -0.062, Piscataquis: -0.168,
};
const SEN_W = {
  Cumberland: 179900, York: 121918, Penobscot: 80046, Kennebec: 67145,
  Androscoggin: 55160, Aroostook: 33783, Hancock: 32750, Oxford: 31272,
  Somerset: 25216, Knox: 23895, Sagadahoc: 22345, Waldo: 22306,
  Lincoln: 22177, Washington: 16447, Franklin: 16093, Piscataquis: 9258,
};
// pollMargin = the Democrat's two-party lead in points (D+). center share = 0.5 + margin/200.
// SEN_HOUSE shifts the center toward Collins: she has consistently outrun her polling
// (she trailed in nearly every 2020 public poll and won by about 9 points), so a raw
// poll average structurally overstates the Democrat in Maine. This keeps a tossup a tossup.
const SEN_HOUSE = 4;
const senateUnits = (pollMargin) =>
  Object.keys(SEN_LEAN).map((n) =>
    unit(n, clamp(0.5 + (pollMargin - SEN_HOUSE) / 200 + SEN_LEAN[n], 0.02, 0.98), SEN_W[n]));
const makeSenate = (pollMargin) => ({
  id: "sen", state: "ME", title: "U.S. Senate",
  sub: "Jackson (D) vs Collins (R)",
  system: "Ranked-Choice Voting", real: true,
  note: `Troy Jackson (D) won the July 25 Democratic convention to replace Graham Platner and faces Susan Collins. Centered on polls, then shifted ${SEN_HOUSE} pts toward Collins, who has consistently outrun her polling (she trailed in nearly every 2020 survey and won by about 9). The county map blends the 2020 Collins-Gideon Senate results with recent presidential results.`,
  left: { full: "Collins", short: "Collins", color: RED },
  right: { full: "Jackson", short: "Jackson", color: BLUE },
  units: senateUnits(pollMargin),
});

// ---- NORTH CAROLINA ----
// Cooper (D) vs Whatley (R) — open seat (Tillis retired), plurality, rated tossup/lean-D.
// County-level baseline is pending the real-data step (scripts/build-baseline-nc.mjs pulls
// NC's past results via dispatch). Until then NC runs on a single statewide unit centered on
// polling: a valid poll-driven needle now, and a statewide live needle on election night.
// Update 47: state shifts halved (Maine Senate and Alaska kept). Past polling misses don't reliably
// repeat, especially in midterms, so each shift is about half the size of the state's past misses.
const NC_HOUSE = 3; // toward Whatley: NC polls have overstated Democrats in recent cycles (halved from 6)
// Real county baseline from NC's 2024 presidential results (scripts/build-baseline-nc.mjs):
// lean = each county's Dem two-party share minus the statewide share (mean-zero); weight = two-party turnout.
const NC_LEAN = ncBaseline.lean, NC_W = ncBaseline.weight;
const ncUnits = (pollMargin) =>
  Object.keys(NC_LEAN).map((n) =>
    unit(n, clamp(0.5 + (pollMargin - NC_HOUSE) / 200 + NC_LEAN[n], 0.02, 0.98), NC_W[n]));
const makeNCSenate = (pollMargin) => ({
  id: "nc_sen", state: "NC", title: "U.S. Senate",
  sub: "Cooper (D) vs Whatley (R)",
  system: "Plurality", real: true,
  note: `Open seat (Tillis retired). Centered on polls, then shifted ${NC_HOUSE} pts toward Whatley because North Carolina polls have tended to underestimate Republicans; the shift was halved in October, since past misses don't reliably repeat. County map built from 2024 results.`,
  left: { full: "Whatley", short: "Whatley", color: RED },
  right: { full: "Cooper", short: "Cooper", color: BLUE },
  units: ncUnits(pollMargin),
});

// ---- OHIO ---- (special election for JD Vance's old seat)
// Brown (D) vs Husted (R), plurality. Ohio leans Republican (Trump +11 in 2024) and its polls
// overstated Brown in 2024 (he led several surveys, then lost by ~3.5), so the poll center is
// shifted toward Husted. Uses the real county map when data/oh-baseline.json is filled in,
// otherwise a single statewide unit until the dispatch baseline step runs.
const OH_HOUSE = 2; // halved from 4 in Update 47
const OH_LEAN = ohBaseline.lean || {}, OH_W = ohBaseline.weight || {};
const OH_HAS_COUNTIES = Object.keys(OH_LEAN).length > 0;
const ohUnits = (pollMargin) =>
  OH_HAS_COUNTIES
    ? Object.keys(OH_LEAN).map((n) => unit(n, clamp(0.5 + (pollMargin - OH_HOUSE) / 200 + OH_LEAN[n], 0.02, 0.98), OH_W[n]))
    : [unit("Ohio", clamp(0.5 + (pollMargin - OH_HOUSE) / 200, 0.02, 0.98), 1)];
const makeOhioSenate = (pollMargin) => ({
  id: "oh_sen", state: "OH", title: "U.S. Senate (special)",
  sub: "Brown (D) vs Husted (R)",
  system: "Plurality", real: true,
  note: `Special election for JD Vance's old seat. Centered on polls, then shifted ${OH_HOUSE} pts toward Husted because Ohio polls have tended to underestimate Republicans; the shift was halved in October, since past misses don't reliably repeat.${OH_HAS_COUNTIES ? " County map built from 2024 results." : " County-level baseline is being added; the needle is currently statewide."}`,
  left: { full: "Husted", short: "Husted", color: RED },
  right: { full: "Brown", short: "Brown", color: BLUE },
  units: ohUnits(pollMargin),
});

// ---- TEXAS ----
// Paxton (R) vs Talarico (D), plurality. Texas leans strongly Republican (Trump +14 in 2024),
// though the race has polled closer than usual. The poll center is shifted toward Paxton for the
// state's fundamentals. Uses the real county map when data/tx-baseline.json is filled in.
const TX_HOUSE = 2.5; // halved from 5 in Update 47
const TX_LEAN = txBaseline.lean || {}, TX_W = txBaseline.weight || {};
const TX_HAS_COUNTIES = Object.keys(TX_LEAN).length > 0;
const txUnits = (pollMargin) =>
  TX_HAS_COUNTIES
    ? Object.keys(TX_LEAN).map((n) => unit(n, clamp(0.5 + (pollMargin - TX_HOUSE) / 200 + TX_LEAN[n], 0.02, 0.98), TX_W[n]))
    : [unit("Texas", clamp(0.5 + (pollMargin - TX_HOUSE) / 200, 0.02, 0.98), 1)];
const makeTexasSenate = (pollMargin) => ({
  id: "tx_sen", state: "TX", title: "U.S. Senate",
  sub: "Talarico (D) vs Paxton (R)",
  system: "Plurality", real: true,
  note: `Texas leans strongly Republican and its polls have tended to underestimate Republicans, so the poll center is shifted ${TX_HOUSE} pts toward Paxton (halved in October, since past misses don't reliably repeat).${TX_HAS_COUNTIES ? " County map built from 2024 results." : " County-level baseline is being added; the needle is currently statewide."}`,
  left: { full: "Paxton", short: "Paxton", color: RED },
  right: { full: "Talarico", short: "Talarico", color: BLUE },
  units: txUnits(pollMargin),
});

// ---- IOWA ---- (open seat; Ernst is retiring)
// Hinson (R) vs Turek (D), plurality. Iowa leans strongly Republican (Trump +13 in 2024) and a
// Democrat has not won a Senate race here since 2008, so the center is shifted toward Hinson.
// No public general-election polls yet, so it runs on fundamentals until the weekly refresh adds them.
const IA_HOUSE = 2.5; // halved from 5 in Update 47
const IA_LEAN = iaBaseline.lean || {}, IA_W = iaBaseline.weight || {};
const IA_HAS_COUNTIES = Object.keys(IA_LEAN).length > 0;
const iaUnits = (pollMargin) =>
  IA_HAS_COUNTIES
    ? Object.keys(IA_LEAN).map((n) => unit(n, clamp(0.5 + (pollMargin - IA_HOUSE) / 200 + IA_LEAN[n], 0.02, 0.98), IA_W[n]))
    : [unit("Iowa", clamp(0.5 + (pollMargin - IA_HOUSE) / 200, 0.02, 0.98), 1)];
const makeIowaSenate = (pollMargin) => ({
  id: "ia_sen", state: "IA", title: "U.S. Senate",
  sub: "Turek (D) vs Hinson (R)",
  system: "Plurality", real: true,
  note: `Open seat (Ernst is retiring). Iowa leans strongly Republican and its polls have tended to underestimate Republicans, so the poll center is shifted ${IA_HOUSE} pts toward Hinson (halved in October, since past misses don't reliably repeat).${IA_HAS_COUNTIES ? " County map built from 2024 results." : " County-level baseline is being added; the needle is currently statewide."}`,
  left: { full: "Hinson", short: "Hinson", color: RED },
  right: { full: "Turek", short: "Turek", color: BLUE },
  units: iaUnits(pollMargin),
});

// ---- GEORGIA ----
// Ossoff (D, incumbent) vs Collins (R), the GOP runoff winner. Georgia is nearly even federally
// (Trump +2 in 2024) with a Democratic incumbent defending; the center gets a small shift toward
// Collins for the state's lean. Georgia law requires a December 1 runoff if no candidate tops 50%.
const GA_HOUSE = 1; // halved from 2 in Update 47
const GA_LEAN = gaBaseline.lean || {}, GA_W = gaBaseline.weight || {};
const GA_HAS_COUNTIES = Object.keys(GA_LEAN).length > 0;
const gaUnits = (pollMargin) =>
  GA_HAS_COUNTIES
    ? Object.keys(GA_LEAN).map((n) => unit(n, clamp(0.5 + (pollMargin - GA_HOUSE) / 200 + GA_LEAN[n], 0.02, 0.98), GA_W[n]))
    : [unit("Georgia", clamp(0.5 + (pollMargin - GA_HOUSE) / 200, 0.02, 0.98), 1)];
const makeGeorgiaSenate = (pollMargin) => ({
  id: "ga_sen", state: "GA", title: "U.S. Senate",
  sub: "Ossoff (D) vs Collins (R)",
  system: "Majority (runoff Dec 1 if no one tops 50%)", real: true,
  note: `Ossoff is the incumbent; Collins won the Republican runoff. The poll center is shifted ${GA_HOUSE} pt toward Collins for Georgia's slight Republican lean. If no candidate wins a majority in November, the race goes to a December 1 runoff.${GA_HAS_COUNTIES ? " County map built from 2024 results." : " County-level baseline is being added; the needle is currently statewide."}`,
  left: { full: "Collins", short: "Collins", color: RED },
  right: { full: "Ossoff", short: "Ossoff", color: BLUE },
  units: gaUnits(pollMargin),
});

// ---- NEBRASKA ----
// Ricketts (R, incumbent) vs Osborn (independent). Public polls show a near-tie, but Nebraska is
// Trump +20 territory and Osborn polled close in 2024 before losing by ~7, so the center is shifted
// toward Ricketts. Osborn sits in the challenger (right) slot but is colored as an independent, not blue.
const NE_HOUSE = 2; // halved from 4 in Update 47
const NE_LEAN = neBaseline.lean || {}, NE_W = neBaseline.weight || {};
const NE_HAS_COUNTIES = Object.keys(NE_LEAN).length > 0;
const neUnits = (pollMargin) =>
  NE_HAS_COUNTIES
    ? Object.keys(NE_LEAN).map((n) => unit(n, clamp(0.5 + (pollMargin - NE_HOUSE) / 200 + NE_LEAN[n], 0.02, 0.98), NE_W[n]))
    : [unit("Nebraska", clamp(0.5 + (pollMargin - NE_HOUSE) / 200, 0.02, 0.98), 1)];
const makeNebraskaSenate = (pollMargin) => ({
  id: "ne_sen", state: "NE", title: "U.S. Senate",
  sub: "Osborn (I) vs Ricketts (R)",
  system: "Independent vs Republican", real: true,
  note: `Dan Osborn runs as an independent against Republican incumbent Pete Ricketts; the Democratic nominee is expected to step aside for him. Public polls show a near-tie, but the center is shifted ${NE_HOUSE} pts toward Ricketts for Nebraska's strong Republican lean (Trump +20 in 2024) and Osborn's 2024 pattern of polling close before losing by about 7. The shift was halved in October, since one race's miss doesn't reliably repeat. Osborn has not said which party he would caucus with.${NE_HAS_COUNTIES ? " County map built from past results." : " County-level baseline is being added; the needle is currently statewide."}`,
  left: { full: "Ricketts", short: "Ricketts", color: RED },
  right: { full: "Osborn", short: "Osborn", color: TEAL },
  units: neUnits(pollMargin),
});

// ---- ALASKA ---- (ranked-choice; a polling needle that never goes live on election night)
// Sullivan (R, incumbent) vs Peltola (D) in a top-four ranked-choice race.
// Update 44: Alaska gets a polling needle (forecast only). One statewide unit: Alaska reports
// by state house district, not county, and its ranked-choice rounds are counted about two weeks
// after election night, so this needle never goes live. It still counts in Senate control.
// AK_HOUSE shifts the center toward Sullivan: Alaska polls have underestimated Republicans
// (Sullivan won by about 13 in 2020 after polling far closer; Peltola lost her 2024 House race
// by about 2 after polling close).
const AK_HOUSE = 2; // halved from 4 in Update 47, like the other state shifts
const makeAlaskaSenate = (pollMargin = 3) => ({
  id: "ak_sen", state: "AK", title: "U.S. Senate",
  sub: "Peltola (D) vs Sullivan (R)",
  system: "Ranked-Choice Voting", real: true, noNight: true,
  note: `Polling forecast only. Centered on the head-to-head polling average, then shifted ${AK_HOUSE} pts toward Sullivan because Alaska polls have underestimated Republicans; the shift was halved in October, since past misses don't reliably repeat. Alaska's ranked-choice rounds are counted about two weeks after election night, so this needle does not move on election night.`,
  left: { full: "Sullivan", short: "Sullivan", color: RED },
  right: { full: "Peltola", short: "Peltola", color: BLUE },
  units: [unit("Alaska", clamp(0.5 + (pollMargin - AK_HOUSE) / 200, 0.02, 0.98), 320000)],
});

// ---- MICHIGAN ---- (placeholder until the Aug. 4 primary sets the nominees)
// Michigan polls have underestimated Republicans repeatedly (about 4 pts in 2016,
// 5 in 2020, 2 in 2024), but it is also the bluest state on this board at the
// presidential level (Trump +1.4 in 2024) — narrower than Georgia, which carries a
// 2-pt shift. The center was shifted 2 pts toward Rogers; Update 47 halves it to 1.
const MI_HOUSE = 1;
const MI_LEAN = miBaseline.lean || {}, MI_W = miBaseline.weight || {};
const MI_HAS_COUNTIES = Object.keys(MI_LEAN).length > 0;
const miUnits = (pollMargin) =>
  MI_HAS_COUNTIES
    ? Object.keys(MI_LEAN).map((n) => unit(n, clamp(0.5 + (pollMargin - MI_HOUSE) / 200 + MI_LEAN[n], 0.02, 0.98), MI_W[n]))
    : [unit("Michigan", clamp(0.5 + (pollMargin - MI_HOUSE) / 200, 0.02, 0.98), 1)];
// New Hampshire leans Democratic at the presidential level (Harris +2.8 in 2024) and
// Democrats have held this seat and both NH Senate seats for over a decade. But NH
// polling has a history of underestimating Republicans, and Sununu is a proven
// statewide crossover name. So the center was shifted just 1 pt toward Sununu (halved to
// 0.5 in Update 47) — the smallest shift on the board, because the state's fundamentals lean blue.
const NH_HOUSE = 0.5;
const NH_LEAN = nhBaseline.lean || {}, NH_W = nhBaseline.weight || {};
const NH_HAS_COUNTIES = Object.keys(NH_LEAN).length > 0;
const nhUnits = (pollMargin) =>
  NH_HAS_COUNTIES
    ? Object.keys(NH_LEAN).map((n) => unit(n, clamp(0.5 + (pollMargin - NH_HOUSE) / 200 + NH_LEAN[n], 0.02, 0.98), NH_W[n]))
    : [unit("New Hampshire", clamp(0.5 + (pollMargin - NH_HOUSE) / 200, 0.02, 0.98), 1)];
const makeNHSenate = (pollMargin) => ({
  id: "nh_sen", state: "NH", title: "U.S. Senate",
  sub: "Pappas (D) vs Sununu (R)",
  system: "Plurality", real: true,
  note: `Open seat (Shaheen retiring). Chris Pappas (D) faces former Senator John E. Sununu (R). Centered on polls, then shifted ${NH_HOUSE} pt toward Sununu, the smallest shift on the board. New Hampshire leans Democratic at the presidential level and has held this seat for Democrats for over a decade, but its polls have underestimated Republicans before and Sununu is a proven statewide crossover candidate. County map built from 2024 results.`,
  left: { full: "Sununu", short: "Sununu", color: RED },
  right: { full: "Pappas", short: "Pappas", color: BLUE },
  units: nhUnits(pollMargin),
});
const makeMichiganSenate = (pollMargin) => ({
  id: "mi_sen", state: "MI", title: "U.S. Senate",
  sub: "El-Sayed (D) vs Rogers (R)",
  system: "Plurality", real: true,
  note: `Open seat (Peters retiring). Abdul El-Sayed won the August 4 Democratic primary over Haley Stevens in a race decided by roughly a point; Mike Rogers was unopposed on the Republican side. Centered on polls, then shifted ${MI_HOUSE} pt toward Rogers. Michigan polling underestimated Republicans in each of the last three presidential cycles, but misses like that don't reliably repeat in a midterm, and Michigan is the narrowest state on this board at the presidential level. County map built from 2024 results.`,
  left: { full: "Rogers", short: "Rogers", color: RED },
  right: { full: "El-Sayed", short: "El-Sayed", color: BLUE },
  units: miUnits(pollMargin),
});

// REAL DATA: county partisan geography (blended 2020+2016 presidential), mean-zero lean.
const GOV_LEAN = { Cumberland: +0.145, York: +0.005, Penobscot: -0.088, Kennebec: -0.040, Androscoggin: -0.054, Aroostook: -0.105, Hancock: +0.008, Oxford: -0.095, Somerset: -0.158, Knox: +0.053, Sagadahoc: +0.021, Waldo: -0.024, Lincoln: -0.004, Washington: -0.137, Franklin: -0.062, Piscataquis: -0.172 };

// REAL DATA: 2020 U.S. House by county within district. [Dem two-party share, turnout].
const CD1 = { Cumberland: [0.676, 190870], York: [0.576, 126947], Kennebec: [0.552, 42369], Knox: [0.622, 25464], Sagadahoc: [0.590, 23700], Lincoln: [0.552, 23393] };
const CD2 = { Penobscot: [0.514, 84538], Androscoggin: [0.555, 58461], Aroostook: [0.490, 35160], Hancock: [0.615, 35102], Oxford: [0.534, 33181], Kennebec: [0.527, 28690], Somerset: [0.461, 27325], Waldo: [0.577, 24123], Franklin: [0.560, 17270], Washington: [0.472, 17203], Piscataquis: [0.442, 9821] };
const fromMap = (m) => Object.entries(m).map(([n, v]) => unit(n, v[0], v[1]));

// shift every county's prior by a constant so the turnout-weighted statewide margin
// matches a target (in points). Used to re-center a historical map onto current polling.
const recenter = (units, targetMarginPts) => {
  if (targetMarginPts == null) return units;
  const totW = units.reduce((s, u) => s + u.weight, 0);
  const meanShare = units.reduce((s, u) => s + u.weight * u.prior, 0) / totW;
  const delta = (0.5 + targetMarginPts / 200) - meanShare;
  return units.map((u) => ({ ...u, prior: clamp(u.prior + delta, 0.02, 0.98) }));
};

const makeCD1 = (margin = null) => ({
  id: "cd1", state: "ME", title: "U.S. House · District 1", sub: "Pingree (D) vs Russell (R)", system: "Ranked-Choice Voting", real: true,
  left: { full: "Russell", short: "Russell", color: RED },
  right: { full: "Pingree", short: "Pingree", color: BLUE },
  units: recenter(fromMap(CD1), margin),
});

// CD2 personal-vote decay: regress Golden's 2020 map toward each county's generic-D fundamentals.
// decay 1 = full Golden map, 0 = pure fundamentals. Open seat -> default low.
const CD2_FUND = { Penobscot: 0.449, Androscoggin: 0.482, Aroostook: 0.408, Hancock: 0.544, Oxford: 0.442, Kennebec: 0.497, Somerset: 0.379, Waldo: 0.513, Franklin: 0.475, Washington: 0.400, Piscataquis: 0.364 };
const DEFAULT_DECAY = 0.25;
const cd2Units = (decay) =>
  Object.keys(CD2).map((n) => {
    const golden = CD2[n][0], fund = CD2_FUND[n];
    return unit(n, clamp(fund + decay * (golden - fund), 0.02, 0.98), CD2[n][1]);
  });
const makeCD2 = (decay, margin = null) => ({
  id: "cd2", state: "ME", title: "U.S. House · District 2",
  sub: "Dunlap (D) vs LePage (R)",
  system: "Ranked-Choice Voting", real: true,
  left: { full: "LePage", short: "LePage", color: RED },
  right: { full: "Dunlap", short: "Dunlap", color: BLUE },
  units: recenter(cd2Units(decay), margin),
});

// ---- three-way Governor (plurality, real partisan geography + polling-set statewide split) ----
const IND = "#6D4BB3"; // independent (Bennett)
const DEFAULT_B = 18;   // Bennett statewide share, points
const DEFAULT_GM = 6;   // Pingree minus Charles margin within the two-major pool, points
// build per-county priors for the three candidates from statewide split + partisan lean.
const govUnits3 = (bennettPts, marginPts) => {
  const b = bennettPts / 100;
  const demFrac = clamp(0.5 + marginPts / 200, 0.02, 0.98); // D share of the two-major pool
  return Object.keys(GOV_LEAN).map((n) => {
    const dp = clamp(demFrac + GOV_LEAN[n], 0.02, 0.98); // county D share of two-major pool
    return { name: n, weight: SEN_W[n], pP: (1 - b) * dp, pC: (1 - b) * (1 - dp), pB: b };
  });
};
const makeGov = (bennettPts, marginPts) => ({
  id: "gov", state: "ME", title: "Governor", type: "three",
  sub: "Pingree (D) · Charles (R) · Bennett (I)",
  system: "Plurality", real: true,
  cands: [
    { key: "P", full: "Pingree", short: "Pingree", color: BLUE },
    { key: "C", full: "Charles", short: "Charles", color: RED },
    { key: "B", full: "Bennett", short: "Bennett", color: IND },
  ],
  units: govUnits3(bennettPts, marginPts),
});
function rollGov(race) {
  const sPart = (Math.random() - 0.5) * 0.10, sBen = (Math.random() - 0.5) * 0.07;
  return {
    ...race,
    units: race.units.map((u) => {
      const b = clamp(u.pB + sBen + (Math.random() - 0.5) * 0.03, 0.02, 0.6);
      const rest = 1 - b;
      const dp = clamp(u.pP / (u.pP + u.pC) + sPart + (Math.random() - 0.5) * 0.05, 0.02, 0.98);
      return { ...u, reported: 0, speed: speedFor(u.weight), fP: rest * dp, fC: rest * (1 - dp), fB: b };
    }),
  };
}
function compute3(units) {
  const totalW = units.reduce((s, u) => s + u.weight, 0);
  const repW = units.reduce((s, u) => s + u.weight * u.reported, 0);
  const fracIn = totalW ? repW / totalW : 0;
  const swing = (fk, pk) => repW > 0 ? units.reduce((s, u) => s + u.weight * u.reported * (u[fk] - u[pk]), 0) / repW : 0;
  const sP = swing("fP", "pP"), sC = swing("fC", "pC"), sB = swing("fB", "pB");
  const projOne = (fk, pk, sw) => units.reduce((s, u) => s + u.weight * (u.reported >= 0.92 ? u[fk] : clamp(u[pk] + sw, 0.01, 0.98)), 0) / totalW;
  let P = projOne("fP", "pP", sP), C = projOne("fC", "pC", sC), B = projOne("fB", "pB", sB);
  const tot = P + C + B; P /= tot; C /= tot; B /= tot;
  const se = 0.06 * Math.sqrt(1 - fracIn) + 0.03 * (1 - fracIn) + 0.005;
  // P(candidate i finishes first) = integral of f_i(x) * prod_{j!=i} F_j(x) dx.
  // Deterministic numerical integration (no randomness), so the readout is stable across renders.
  const npdf = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const lo = Math.min(P, C, B) - 6 * se, hi = Math.max(P, C, B) + 6 * se;
  const steps = 240, dx = (hi - lo) / steps;
  let wP = 0, wC = 0, wB = 0;
  for (let k = 0; k <= steps; k++) {
    const x = lo + k * dx;
    const fP = npdf((x - P) / se) / se, fC = npdf((x - C) / se) / se, fB = npdf((x - B) / se) / se;
    const FP = ncdf((x - P) / se), FC = ncdf((x - C) / se), FB = ncdf((x - B) / se);
    wP += fP * FC * FB * dx; wC += fC * FP * FB * dx; wB += fB * FP * FC * dx;
  }
  const ws = wP + wC + wB || 1;
  return { fracIn, proj: { P, C, B }, win: { P: wP / ws, C: wC / ws, B: wB / ws }, se };
}

// illustrative ballot-question map: a statewide yes-center plus a partisan tilt per county.
// corr > 0 means Yes runs stronger in Democratic counties; corr < 0 the reverse.
const ballotUnits = (yesCenter, corr) =>
  all16.map((n) => unit(n, clamp(yesCenter + corr * (CO[n][0] - 0.5), 0.08, 0.92), CO[n][1]));

// the ballot question(s). Illustrative — a new question has no prior election to map.
const OTHER_RACES = []; // ballot question (transgender-sports referendum) struck from the Nov ballot by the Maine SJC on 2026-07-10

// ---- stats ----
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const ncdf = (z) => 0.5 * (1 + erf(z / Math.sqrt(2)));
const speedFor = (w) => clamp(1.05 - w / 200000, 0.18, 0.95);

function rollRace(race) {
  const swing = (Math.random() - 0.5) * 0.12;
  return {
    ...race,
    units: race.units.map((u) => ({
      ...u,
      reported: 0,
      finalShare: clamp(u.prior + swing + (Math.random() - 0.5) * 0.05, 0.02, 0.98),
      speed: speedFor(u.weight),
    })),
  };
}
function compute(units) {
  const totalW = units.reduce((s, u) => s + u.weight, 0);
  const repW = units.reduce((s, u) => s + u.weight * u.reported, 0);
  const fracIn = totalW ? repW / totalW : 0;
  let swing = 0;
  if (repW > 0) swing = units.reduce((s, u) => s + u.weight * u.reported * (u.finalShare - u.prior), 0) / repW;
  const proj = units.reduce((s, u) => {
    const known = u.reported >= 0.92;
    return s + u.weight * (known ? u.finalShare : clamp(u.prior + swing, 0.02, 0.98));
  }, 0) / totalW;
  const margin = 2 * proj - 1;
  // Confidence band: wide when little is in (so a sliver can't "call" a race),
  // tightening as real vote accumulates. Floor keeps very-early calls impossible.
  const se = 0.095 * Math.sqrt(1 - fracIn) + 0.03 * (1 - fracIn) + 0.004;
  return { fracIn, swing, margin, se, winRight: ncdf(margin / se) };
}
function rateOf(race, m) {
  const p = m.margin >= 0 ? m.winRight : 1 - m.winRight;
  const leader = m.margin >= 0 ? race.right : race.left;
  const pct = Math.round(p * 100);
  // A race cannot be "Called" until enough vote is actually in, no matter how lopsided
  // the early sliver looks. Below that, the strongest it can read is "Likely".
  const canCall = m.fracIn >= 0.5;
  let tag;
  if (pct >= 97) tag = canCall ? "Called" : "Likely";
  else if (pct >= 85) tag = "Likely";
  else if (pct >= 65) tag = "Leans";
  else tag = "Toss-up";
  return { pct, leader, text: tag === "Toss-up" ? "Toss-up" : `${tag} ${leader.short}` };
}

// ---- live results: map real county returns onto race units, replacing the simulation ----
// ballot questions: dem = Yes, rep = No.
// County weights are 2024 PRESIDENTIAL turnout, and midterms draw far fewer voters, so a county
// that has finished counting would otherwise look only ~75% "in" all night and no race could
// ever be called. Expected 2026 vote = weight x the state's midterm turnout ratio: the higher of
// 2018 and 2022 turnout relative to 2024, plus a small cushion so the needle leans cautious.
// When a feed states precincts reporting outright, the reported fraction is the lower reading.
const MIDTERM_TURNOUT = { ME: 0.83, NC: 0.68, OH: 0.78, TX: 0.75, IA: 0.81, GA: 0.77, NE: 0.76, MI: 0.8, NH: 0.77 };
function reportedFrac(counted, u, c, state) {
  const byVotes = clamp(counted / (u.weight * (MIDTERM_TURNOUT[state] || 0.8)), 0, 1);
  if (c && c.pt > 0 && Number.isFinite(c.pr)) return Math.min(byVotes, clamp(c.pr / c.pt, 0, 1));
  return byVotes;
}
function liveTwoWay(units, counties, state) {
  return units.map((u) => {
    const c = counties[u.name];
    const counted = c ? (c.dem || 0) + (c.rep || 0) : 0;
    if (counted <= 0) return { ...u, reported: 0, vDem: 0, vRep: 0 };
    return { ...u, reported: reportedFrac(counted, u, c, state), finalShare: c.dem / counted, vDem: c.dem || 0, vRep: c.rep || 0 };
  });
}
// Sum raw votes across a race's units for the live scoreboard.
function voteTotals(units) {
  let dem = 0, rep = 0;
  for (const u of units) { dem += u.vDem || 0; rep += u.vRep || 0; }
  return { dem, rep, total: dem + rep };
}
const fmtVotes = (n) => n.toLocaleString("en-US");
const pctOf = (part, whole) => whole > 0 ? (part / whole * 100) : 0;
function liveThree(units, counties, state) {
  return units.map((u) => {
    const c = counties[u.name];
    const counted = c ? (c.dem || 0) + (c.rep || 0) + (c.ind || 0) : 0;
    if (counted <= 0) return { ...u, reported: 0, fP: u.pP, fC: u.pC, fB: u.pB };
    return { ...u, reported: reportedFrac(counted, u, c, state), fP: c.dem / counted, fC: c.rep / counted, fB: (c.ind || 0) / counted };
  });
}
function applyLive(race, rdata) {
  if (!rdata || !rdata.counties) return { ...race, liveOn: false };
  const hasData = Object.values(rdata.counties).some((c) => ((c.dem || 0) + (c.rep || 0) + (c.ind || 0)) > 0);
  if (!hasData) return { ...race, liveOn: false };
  const units = race.type === "three" ? liveThree(race.units, rdata.counties, race.state) : liveTwoWay(race.units, rdata.counties, race.state);
  if (!units.some((u) => u.reported > 0)) return { ...race, liveOn: false };
  return { ...race, units, liveOn: true };
}
function applyAllLive(races, results) {
  if (!results || !results.races) return races;
  return races.map((r) => results.races[r.id] ? applyLive(r, results.races[r.id]) : r);
}

// Typewriter font is gone from labels; numbers line up via tabular figures (see GLOBAL_CSS).
const mono = "'Public Sans', ui-sans-serif, system-ui, sans-serif";
const sans = "'Public Sans', ui-sans-serif, system-ui, sans-serif";
const serif = "'Newsreader', Georgia, 'Times New Roman', serif";
const COFFEE_URL = "https://buymeacoffee.com/colinblais";
const GLOBAL_CSS = `html,body{margin:0;background:${"#F4EFE4"}}body{font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}button,input{font-family:inherit}a{color:inherit}::selection{background:#E6D9B8}::-webkit-scrollbar{width:9px}::-webkit-scrollbar-thumb{background:#CFC7B6;border-radius:9px}::-webkit-scrollbar-track{background:transparent}`;
const RBTN = { marginTop: 8, width: "100%", background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 0", fontSize: 11.5, fontFamily: mono, cursor: "pointer" };
const STATES = [{ code: "ME", label: "Maine" }, { code: "NC", label: "North Carolina" }, { code: "OH", label: "Ohio" }, { code: "TX", label: "Texas" }, { code: "IA", label: "Iowa" }, { code: "GA", label: "Georgia" }, { code: "NE", label: "Nebraska" }, { code: "AK", label: "Alaska" }, { code: "MI", label: "Michigan" }, { code: "NH", label: "New Hampshire" }];

// Width-based layout switch: >=1000px gets the desktop three-zone layout, anything
// narrower keeps the exact mobile column. Width (not device sniffing) so a resized
// window or a landscape tablet just works.
function useWide(px = 1000) {
  const [wide, setWide] = React.useState(typeof window !== "undefined" ? window.innerWidth >= px : false);
  React.useEffect(() => {
    const on = () => setWide(window.innerWidth >= px);
    on(); window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [px]);
  return wide;
}

export default function MaineDashboard() {
  const DEFAULT_MARGIN = 3; // Jackson D+3 two-party (UNH Jul 2026), a mid estimate of current polls
  const DEFAULT_NC_MARGIN = 9; // Cooper D+9, mid of recent NC polls
  const DEFAULT_OH_MARGIN = 4; // Brown D+4, mid of recent Ohio polls
  const DEFAULT_TX_MARGIN = 0; // ~even, mid of recent Texas polls
  const DEFAULT_IA_MARGIN = 0; // no public polls yet; fundamentals via house effect
  const DEFAULT_GA_MARGIN = 4; // Ossoff has polled near 50 and ahead of the GOP field; incumbent edge
  const DEFAULT_NE_MARGIN = -1; // Osborn (I) polls a near-tie, ~1 pt behind Ricketts
  const DEFAULT_MI_MARGIN = -3; // EPIC-MRA Jul 2026: Rogers 46, El-Sayed 43
  const DEFAULT_NH_MARGIN = 0; // tied polling average (UNH Aug: Sununu +2; Emerson/June: Pappas +1-3)
  const [pollMargin, setPollMargin] = useState(DEFAULT_MARGIN);
  const [ncMargin, setNcMargin] = useState(DEFAULT_NC_MARGIN);
  const [ohMargin, setOhMargin] = useState(DEFAULT_OH_MARGIN);
  const [txMargin, setTxMargin] = useState(DEFAULT_TX_MARGIN);
  const [iaMargin, setIaMargin] = useState(DEFAULT_IA_MARGIN);
  const [gaMargin, setGaMargin] = useState(DEFAULT_GA_MARGIN);
  const [neMargin, setNeMargin] = useState(DEFAULT_NE_MARGIN);
  const [miMargin, setMiMargin] = useState(DEFAULT_MI_MARGIN);
  const [nhMargin, setNhMargin] = useState(DEFAULT_NH_MARGIN);
  const DEFAULT_AK_MARGIN = 3; // Peltola +3, polling average
  const [akMargin, setAkMargin] = useState(DEFAULT_AK_MARGIN);
  const [cd2Decay, setCd2Decay] = useState(DEFAULT_DECAY);
  const [govB, setGovB] = useState(DEFAULT_B);
  const [govMargin, setGovMargin] = useState(DEFAULT_GM);
  const buildAll = (pm, gb, gm, dc, cd1m = null, cd2m = null, ncm = DEFAULT_NC_MARGIN, ohm = DEFAULT_OH_MARGIN, txm = DEFAULT_TX_MARGIN, iam = DEFAULT_IA_MARGIN, gam = DEFAULT_GA_MARGIN, nem = DEFAULT_NE_MARGIN, mim = DEFAULT_MI_MARGIN, nhm = DEFAULT_NH_MARGIN, akm = DEFAULT_AK_MARGIN) => [
    rollRace(makeSenate(pm)),
    rollGov(makeGov(gb, gm)),
    rollRace(makeCD1(cd1m)),
    rollRace(makeCD2(dc, cd2m)),
    rollRace(makeNCSenate(ncm)),
    rollRace(makeOhioSenate(ohm)),
    rollRace(makeTexasSenate(txm)),
    rollRace(makeIowaSenate(iam)),
    rollRace(makeGeorgiaSenate(gam)),
    rollRace(makeNebraskaSenate(nem)),
    rollRace(makeAlaskaSenate(akm)),
    rollRace(makeMichiganSenate(mim)),
    rollRace(makeNHSenate(nhm)),
    ...OTHER_RACES.map((r) => rollRace(r)),
  ];
  const [races, setRaces] = useState(() => buildAll(DEFAULT_MARGIN, DEFAULT_B, DEFAULT_GM, DEFAULT_DECAY));
  const [sel, setSel] = useState(null);
  const wide = useWide(1000);
  const [navOpen, setNavOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [boardView, setBoardView] = useState("cards"); // "cards" | "needles"
  const [running, setRunning] = useState(false);
  const [wire, setWire] = useState([]);
  const [briefing, setBriefing] = useState(null);
  const wirePrev = useRef(null);
  const wireSeen = useRef({});
  const [speed, setSpeed] = useState(1);
  const [current, setCurrent] = useState(null);   // current polling outlook from public/current.json
  const [view, setView] = useState("dashboard");   // dashboard | <state code> | polls | method
  useEffect(() => { window.scrollTo(0, 0); }, [view, sel]);
  const [currentLoaded, setCurrentLoaded] = useState(false);
  const [results, setResults] = useState(null);   // live returns from public/results.json
  const resultsRef = useRef(null);
  const tk = useRef(null);

  useEffect(() => {
    if (!running) return;
    tk.current = setInterval(() => {
      setRaces((prev) => {
        let done = true;
        const next = prev.map((r) => {
          if (r.liveOn || r.noNight) return r; // live races run on real returns; Alaska never counts on the night
          return {
            ...r,
            units: r.units.map((u) => {
              if (u.reported >= 1) return u;
              done = false;
              if (Math.random() < u.speed) return { ...u, reported: clamp(u.reported + 0.06 + Math.random() * 0.16, 0, 1) };
              return u;
            }),
          };
        });
        if (done) setRunning(false);
        return next;
      });
    }, 700 / speed);
    return () => clearInterval(tk.current);
  }, [running, speed]);

  // load current polling outlook, then center every race on it
  useEffect(() => {
    fetch(`/current.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no current.json"))))
      .then((c) => {
        setCurrent(c);
        if (c?.senate) setPollMargin(c.senate.margin ?? DEFAULT_MARGIN);
        if (c?.nc_sen) setNcMargin(c.nc_sen.margin ?? DEFAULT_NC_MARGIN);
        if (c?.oh_sen) setOhMargin(c.oh_sen.margin ?? DEFAULT_OH_MARGIN);
        if (c?.tx_sen) setTxMargin(c.tx_sen.margin ?? DEFAULT_TX_MARGIN);
        if (c?.ia_sen) setIaMargin(c.ia_sen.margin ?? DEFAULT_IA_MARGIN);
        if (c?.ga_sen) setGaMargin(c.ga_sen.margin ?? DEFAULT_GA_MARGIN);
        if (c?.ne_sen) setNeMargin(c.ne_sen.margin ?? DEFAULT_NE_MARGIN);
        if (c?.mi_sen) setMiMargin(c.mi_sen.margin ?? DEFAULT_MI_MARGIN);
        if (c?.nh_sen) setNhMargin(c.nh_sen.margin ?? DEFAULT_NH_MARGIN);
        if (c?.ak_sen) setAkMargin(c.ak_sen.margin ?? DEFAULT_AK_MARGIN);
        if (c?.governor) { setGovB(c.governor.bennett ?? DEFAULT_B); setGovMargin(c.governor.margin ?? DEFAULT_GM); }
        setRaces(applyAllLive(buildAll(c?.senate?.margin ?? DEFAULT_MARGIN, c?.governor?.bennett ?? DEFAULT_B, c?.governor?.margin ?? DEFAULT_GM, DEFAULT_DECAY, c?.cd1?.margin ?? null, c?.cd2?.margin ?? null, c?.nc_sen?.margin ?? DEFAULT_NC_MARGIN, c?.oh_sen?.margin ?? DEFAULT_OH_MARGIN, c?.tx_sen?.margin ?? DEFAULT_TX_MARGIN, c?.ia_sen?.margin ?? DEFAULT_IA_MARGIN, c?.ga_sen?.margin ?? DEFAULT_GA_MARGIN, c?.ne_sen?.margin ?? DEFAULT_NE_MARGIN, c?.mi_sen?.margin ?? DEFAULT_MI_MARGIN, c?.nh_sen?.margin ?? DEFAULT_NH_MARGIN, c?.ak_sen?.margin ?? DEFAULT_AK_MARGIN), resultsRef.current));
      })
      .catch(() => {})
      .finally(() => setCurrentLoaded(true));
  }, []);

  // load live returns now and every 20s; races with real data switch to LIVE automatically.
  // hosted: /api/results (self-updating function). local dev: falls back to /results.json.
  useEffect(() => {
    const apply = (res) => { resultsRef.current = res; setResults(res); setRaces((prev) => applyAllLive(prev, res)); };
    const load = () =>
      fetch(`/api/results?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .catch(() => fetch(`/results.json?t=${Date.now()}`).then((r) => r.json()))
        .then(apply)
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/briefing.json?t=" + Date.now()).then((r) => r.ok ? r.json() : []).then((b) => setBriefing(Array.isArray(b) ? b : [])).catch(() => setBriefing([]));
  }, []);

  useEffect(() => {
    // The tag comes from rateOf, so the wire never calls a race before half the vote is in.
    const label = (r) => { const st = STATES.find((s) => s.code === r.state); return `${st ? st.label : ""} ${r.title.replace("U.S. ", "").replace(" (special)", "")}`.trim(); };
    const abbr = (r) => r.state; // 2-letter state code, e.g. "NC"
    const snap = {}; const events = [];
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    for (const r of races) {
      if (r.type === "rcv" || r.type === "tbd" || r.type === "three" || !r.right || !r.left || !r.units || !r.units.length) continue;
      const m = compute(r.units); const rt = rateOf(r, m);
      const cur = { pct: rt.pct, tag: rt.text.split(" ")[0], leader: rt.leader.short, color: rt.leader.color, frac: m.fracIn };
      snap[r.id] = cur;
      const prev = wirePrev.current ? wirePrev.current[r.id] : null;
      if (!prev || cur.frac === 0) continue;
      const wasCalled = prev.tag === "Called";
      // The moment of the call still fires; after that, this race goes quiet in the wire.
      if (prev.frac === 0) events.push({ kind: "open", text: `${abbr(r)}: first results in.`, color: C.muted });
      if (!wasCalled) for (const M of [25, 50, 75, 90, 99]) if (prev.frac < M / 100 && cur.frac >= M / 100) events.push({ kind: "mile", text: `${abbr(r)}: ${M}% of expected vote in.`, color: C.muted });
      if (!wasCalled && prev.leader !== cur.leader) events.push({ kind: "flip", text: `${abbr(r)}: lead flip — ${cur.leader} now ahead (${cur.pct}%).`, color: cur.color });
      else if (!wasCalled && prev.tag !== cur.tag) {
        if (cur.tag === "Called") events.push({ kind: "call", text: `${abbr(r)}: called — ${cur.leader} wins.`, color: C.brass });
        else events.push({ kind: "tier", text: `${abbr(r)}: now ${rt.text} (${cur.pct}%).`, color: cur.color });
      }
      // Once called, skip all county-watch and path narration for this race.
      if (cur.tag === "Called" || wasCalled) { continue; }
      // ---- county watch: pure comparison of each county's actual share to its baseline ----
      const seen = (wireSeen.current[r.id] || (wireSeen.current[r.id] = { counties: new Set(), paths: new Set() }));
      const totalW = r.units.reduce((s2, u) => s2 + u.weight, 0) || 1;
      for (const u of r.units) {
        if (seen.counties.has(u.name)) continue;
        if (u.reported < 0.6 || u.finalShare == null) continue;
        seen.counties.add(u.name);
        if (u.weight / totalW < 0.025) continue;                 // skip tiny counties
        const diff = Math.round(2 * (u.finalShare - u.prior) * 100); // margin points vs baseline
        if (Math.abs(diff) < 3) continue;                        // skip "as expected"
        const ahead = diff > 0 ? r.right : r.left;
        events.push({ kind: "county", text: `${abbr(r)}: ${ahead.short} running ${Math.abs(diff)} pts ahead of baseline in ${u.name}.`, color: ahead.color });
      }
      // ---- path to win: in close races, what is the trailing candidate's remaining vote? ----
      const gap = Math.round(Math.abs(m.margin) * 100);
      for (const M of [50, 80]) {
        if (!(prev.frac < M / 100 && cur.frac >= M / 100) || seen.paths.has(M) || gap > 6) continue;
        seen.paths.add(M);
        const trailing = m.margin >= 0 ? r.left : r.right;
        const trailIsD = trailing === r.right;
        let remW = 0, best = null;
        for (const u of r.units) {
          if (u.reported >= 0.5) continue;
          remW += u.weight;
          const leansTrail = trailIsD ? u.prior > 0.5 : u.prior < 0.5;
          if (leansTrail && (!best || u.weight > best.weight)) best = u;
        }
        const pctRem = Math.round((remW / totalW) * 100);
        if (pctRem < 5) continue;
        const tail = best ? `, including ${best.name}, a ${trailing.short}-leaning county` : "";
        events.push({ kind: "path", text: `${abbr(r)}: ${trailing.short} trails by ${gap} with about ${pctRem}% still out${tail}.`, color: C.text });
      }
    }
    wirePrev.current = snap;
    if (events.length) setWire((w) => [...events.map((e, i) => ({ ...e, id: `${Date.now()}-${i}`, t: now })), ...w].slice(0, 60));
  }, [races]);

  const openState = (code) => {
    setNavOpen(false);
    const stateRaces = races.filter((r) => r.state === code);
    if (code !== "ME" && stateRaces.length === 1) { setView(code); setSel(stateRaces[0].id); }
    else { setView(code); setSel(null); }
  };
  const backFromDetail = () => {
    const r = races.find((x) => x.id === sel);
    setSel(null);
    if (r && r.state !== "ME" && races.filter((x) => x.state === r.state).length === 1) setView("dashboard");
  };
  const reset = () => { setRunning(false); setWire([]); wirePrev.current = null; wireSeen.current = {}; setRaces(applyAllLive(buildAll(pollMargin, govB, govMargin, cd2Decay, current?.cd1?.margin ?? null, current?.cd2?.margin ?? null, ncMargin, ohMargin, txMargin, iaMargin, gaMargin, neMargin, miMargin, nhMargin, akMargin), resultsRef.current)); };
  const setPoll = (v) => { setPollMargin(v); setRaces((prev) => prev.map((r) => r.id === "sen" ? rollRace(makeSenate(v)) : r)); };
  const setDecay = (v) => { setCd2Decay(v); setRaces((prev) => prev.map((r) => r.id === "cd2" ? rollRace(makeCD2(v, current?.cd2?.margin ?? null)) : r)); };
  const setGov = (b, m) => { setGovB(b); setGovMargin(m); setRaces((prev) => prev.map((r) => r.id === "gov" ? rollGov(makeGov(b, m)) : r)); };
  const step = () => setRaces((prev) => prev.map((r) => r.liveOn || r.noNight ? r : ({
    ...r,
    units: r.units.map((u) => u.reported >= 1 ? u : (Math.random() < u.speed ? { ...u, reported: clamp(u.reported + 0.1 + Math.random() * 0.18, 0, 1) } : u)),
  })));

  const anyLive = races.some((r) => r.liveOn);
  const night = nightStarted();
  const anyPaused = night && races.some((r) => isPaused(r, night));
  const NAV_ITEMS = [["dashboard", "Races"], ["control", "Senate control"], ["briefing", "Briefing"], ["polls", "Polls"], ["ratings", "Pollster ratings"], ["method", "How it works"]];
  const go = (k) => { setNavOpen(false); setMoreOpen(false); setView(k); setSel(null); };
  const today = new Date();
  const edition = anyLive || night ? "Election night edition" : "Forecast edition";
  const longDate = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const shortDate = today.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const onState = STATES.some((st) => st.code === view);
  const sortedStates = STATES.slice().sort((a, b) => a.label.localeCompare(b.label));
  const statusLine = (
    <p style={{ margin: 0, padding: "10px 0", borderBottom: `1px solid ${C.line}`, fontSize: wide ? 14 : 12.5, lineHeight: 1.45, textAlign: "center", color: anyLive || night ? RED : C.muted, fontWeight: anyLive || night ? 600 : 400 }}>
      {anyLive ? "Live · The needles are running on official results as they come in." : night ? "Election night · Each needle goes live as its state posts its first official results." : "Pre-election forecast based on polling averages. The needles start moving on real votes at 7 p.m. ET on Nov. 3."}
      {anyPaused ? " Maine and New Hampshire are paused until official results are posted." : ""}
    </p>
  );
  const titleBtn = (size) => (
    <button onClick={() => go("dashboard")} aria-label="The Needle Project, home"
      style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: C.text, fontFamily: serif, fontWeight: 700, fontSize: size, letterSpacing: size > 40 ? -1.5 : -0.8, lineHeight: 1 }}>
      The Needle Project
    </button>
  );
  const navLink = (on) => ({ background: "none", border: "none", cursor: "pointer", color: C.text, fontSize: 15, fontWeight: on ? 700 : 500, padding: "4px 0 3px", borderBottom: `2px solid ${on ? C.text : "transparent"}` });
  const desktopMasthead = (
    <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: `3px double ${C.text}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontSize: 13, color: C.muted }}>
        <span>{edition} · {longDate}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 18 }}><span>{night ? "Results refresh automatically" : "Election night: Tuesday, Nov. 3"}</span><SupportSmall /></span>
      </div>
      {titleBtn(64)}
      <nav aria-label="Sections" style={{ position: "relative", display: "flex", alignItems: "center", gap: 26 }}>
        {NAV_ITEMS.map(([k, label]) => (
          <button key={k} onClick={() => go(k)} style={navLink(view === k && sel === null)}>{label}</button>
        ))}
        <button onClick={() => setNavOpen((o) => !o)} aria-expanded={navOpen} style={navLink(onState)}>
          {onState ? STATES.find((st) => st.code === view).label : "States"} {navOpen ? "▴" : "▾"}
        </button>
        {navOpen && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40, minWidth: 210, background: C.panel, border: `1px solid ${C.text}`, padding: 6, boxShadow: "0 8px 24px rgba(27,26,23,0.16)" }}>
            {sortedStates.map((st) => (
              <button key={st.code} onClick={() => openState(st.code)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 15, cursor: "pointer", border: "none",
                  background: view === st.code ? C.panel2 : "transparent", color: C.text, fontWeight: view === st.code ? 700 : 500 }}>
                {st.label}
              </button>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
  const mobileMasthead = (
    <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, paddingBottom: 10, borderBottom: `3px double ${C.text}` }}>
      {titleBtn(34)}
      <span style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>{edition} · {shortDate}{night ? "" : " · Election night Nov. 3"}</span>
      <SupportSmall />
    </header>
  );
  const TabIcon = ({ d }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((x, i) => <path key={i} d={x} />)}
    </svg>
  );
  const moreKeys = ["polls", "ratings", "method", "wire"];
  const tabs = [
    ["dashboard", "Races", ["M4 18a8 8 0 0 1 16 0", "M12 18l4-6"]],
    ["control", "Senate", ["M3 20h18", "M5 20V10l7-5 7 5v10", "M9 20v-6h6v6"]],
    ["briefing", "Briefing", ["M5 4h11l3 3v13H5z", "M8 10h8M8 14h8M8 18h5"]],
    ["more", "More", ["M5 12h.01", "M12 12h.01", "M19 12h.01"]],
  ];
  const tabOn = (k) => k === "more" ? (moreOpen || moreKeys.includes(view) || onState) : (!moreOpen && view === k);
  const tabBar = (
    <nav aria-label="Sections" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: C.ink, borderTop: `1px solid ${C.text}`, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(([k, label, d]) => (
        <button key={k} onClick={() => (k === "more" ? setMoreOpen((o) => !o) : go(k))} aria-expanded={k === "more" ? moreOpen : undefined}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 60, background: "none", border: "none", cursor: "pointer",
            color: tabOn(k) ? C.text : C.muted, fontSize: 12, fontWeight: tabOn(k) ? 700 : 500 }}>
          <TabIcon d={d} />{label}
        </button>
      ))}
    </nav>
  );
  const moreItem = (on) => ({ display: "block", width: "100%", textAlign: "left", minHeight: 44, padding: "10px 14px", fontSize: 16, cursor: "pointer", border: "none", borderBottom: `1px solid ${C.line}`, background: on ? C.panel2 : "transparent", color: C.text, fontWeight: on ? 700 : 500 });
  const moreSheet = moreOpen && (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(61px + env(safe-area-inset-bottom))", zIndex: 49, maxHeight: "70vh", overflowY: "auto", background: C.panel, borderTop: `1px solid ${C.text}`, boxShadow: "0 -8px 24px rgba(27,26,23,0.14)" }}>
      {[["polls", "Polls"], ["ratings", "Pollster ratings"], ["method", "How it works"], ["wire", "Live wire"]].map(([k, label]) => (
        <button key={k} onClick={() => go(k)} style={moreItem(view === k)}>{label}</button>
      ))}
      <div style={{ padding: "12px 14px 6px", fontFamily: serif, fontSize: 18, fontWeight: 600 }}>States</div>
      {sortedStates.map((st) => (
        <button key={st.code} onClick={() => { setMoreOpen(false); openState(st.code); }} style={moreItem(view === st.code)}>{st.label}</button>
      ))}
    </div>
  );
  const detailBlock = (
      <ErrorBoundary label="This race view hit an error">
            <Detail race={races.find((r) => r.id === sel)} onBack={backFromDetail}
              govB={govB} govMargin={govMargin} onGov={setGov} current={current}
              briefing={briefing} wide={wide} onNav={go} night={night} />
          </ErrorBoundary>
  );
  const tabBody = (
            <ErrorBoundary key={view} label="This section hit an error">
            {view === "dashboard" && (
              <FrontPage races={races} current={current} briefing={briefing} wide={wide} onPick={setSel} go={go} night={night} />
            )}
            {STATES.some((s) => s.code === view) && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>November 2026</div>
                <h1 style={{ margin: "0 0 14px", fontFamily: serif, fontWeight: 600, fontSize: wide ? 46 : 32, letterSpacing: -0.8 }}>{STATES.find((s) => s.code === view).label}</h1>
                <SectionHead title={races.filter((r) => r.state === view).length > 1 ? "Races on the ballot" : "The race"} size={22} />
                <RaceTable races={races.filter((r) => r.state === view)} onPick={setSel} wide={wide} night={night} />
                {night && PAUSE_STATES.includes(view) && <div style={{ marginTop: 18 }}><PauseNote state={view} /></div>}
              </div>
            )}
            {view === "polls" && <PollsView current={current} loaded={currentLoaded} wide={wide} />}
            {view === "control" && <SenateControlView races={races} wide={wide} onPick={setSel} night={night} />}
            {view === "wire" && <WireFeed events={wire} />}
            {view === "briefing" && <BriefingView posts={briefing} wide={wide} />}
            {view === "ratings" && <RatingsView current={current} loaded={currentLoaded} wide={wide} />}
            {view === "method" && <MethodView wide={wide} />}

            {!night && (view === "dashboard" || view === "wire" || view === "control" || (STATES.some((s) => s.code === view) && view !== "AK")) && (
              <>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={() => setRunning((r) => !r)}
                    style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: running ? C.panel2 : BLUE, color: running ? C.text : "#FFFFFF", border: `1px solid ${C.line}`, borderRadius: 3, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    {running ? <Pause size={16} /> : <Play size={16} />}{running ? "Pause" : "Run election night"}
                  </button>
                  <button onClick={step} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 3, padding: "11px 0", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    <SkipForward size={15} /> Step
                  </button>
                  <button onClick={reset} style={{ width: 46, display: "flex", alignItems: "center", justifyContent: "center", background: C.panel2, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 3, cursor: "pointer" }}>
                    <RotateCcw size={16} />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontFamily: mono, fontSize: 11, color: C.muted }}>
                  SPEED
                  <input type="range" min="0.5" max="3" step="0.5" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.brass }} />
                  {speed}×
                </div>
              </>
            )}
          </ErrorBoundary>
  );
  // ── MOBILE (< 1000px): one column, masthead on top, tab bar at the bottom ──
  if (!wide) {
    return (
      <div style={{ background: C.ink, color: C.text, fontFamily: sans, minHeight: "100vh", padding: "16px 16px 104px" }}>
        <style>{GLOBAL_CSS}</style>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          {mobileMasthead}
          {statusLine}
          <div style={{ paddingTop: 18 }}>{sel !== null ? detailBlock : tabBody}</div>
          <SupportBlock compact />
        </div>
        {moreSheet}
        {tabBar}
      </div>
    );
  }

  // ── DESKTOP (>= 1000px): newspaper front page; the Wire rail appears once there is news ──
  const showRail = anyLive || night || wire.length > 0;
  return (
    <div style={{ minHeight: "100vh", background: C.ink, color: C.text, fontFamily: sans }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ maxWidth: showRail ? 1360 : 1180, margin: "0 auto", padding: "26px 48px 56px" }}>
        {desktopMasthead}
        {statusLine}
        <div style={{ display: "grid", gridTemplateColumns: showRail ? "minmax(0,1fr) 320px" : "minmax(0,1fr)", gap: 40, paddingTop: 28 }}>
          <main style={{ minWidth: 0 }}>{sel !== null ? detailBlock : tabBody}</main>
          {showRail && (
            <aside style={{ position: "sticky", top: 20, alignSelf: "start", maxHeight: "calc(100vh - 40px)", overflowY: "auto", paddingLeft: 24, borderLeft: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: `2px solid ${C.text}` }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: anyLive ? RED : C.muted }} />
                <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600 }}>The Wire</span>
              </div>
              {anyPaused && <p style={{ margin: 0, padding: "10px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14, lineHeight: 1.45, color: C.body }}>Maine and New Hampshire are paused until official results are posted. <a href={AP_URL} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: C.text }}>Live count at AP</a></p>}
              <ErrorBoundary mini label="Wire unavailable"><WireFeed events={wire} embedded /></ErrorBoundary>
            </aside>
          )}
        </div>
        <SupportBlock />
      </div>
    </div>
  );
}

function TiltBar({ race }) {
  const m = compute(race.units);
  const rt = rateOf(race, m);
  const x = (1 - clamp(m.winRight, 0.02, 0.98)) * 100; // Democrat side drawn on the left
  return (
    <div>
      <div style={{ position: "relative", height: 8, background: C.panel2, borderRadius: 5, overflow: "hidden", marginBottom: 7 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: `${race.right.color}22` }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: `${race.left.color}22` }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.line }} />
        <div style={{ position: "absolute", top: -2, left: `calc(${x}% - 3px)`, width: 6, height: 12, borderRadius: 3, background: rt.leader.color, boxShadow: "none", transition: "left .6s ease-out" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mono }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: rt.leader.color }}>{rt.text}</span>
        <span style={{ fontSize: 11, color: C.muted }}>{rt.leader.short} +{Math.abs(m.margin * 100).toFixed(1)} · {Math.round(m.fracIn * 100)}% in</span>
      </div>
      <Scoreboard race={race} compact />
    </div>
  );
}

// Live vote scoreboard: raw counts + percentages for each candidate. Renders only
// once real votes are in (m.fracIn > 0); before that there is nothing to show.
function Scoreboard({ race, compact }) {
  const t = voteTotals(race.units);
  if (t.total <= 0) return null;
  const dPct = pctOf(t.dem, t.total), rPct = pctOf(t.rep, t.total);
  const dLead = t.dem >= t.rep;
  const row = (name, votes, pct, color, lead) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: compact ? 11.5 : 13, fontWeight: lead ? 700 : 500, color }}>{name}</span>
      <span style={{ fontFamily: mono, fontSize: compact ? 11.5 : 13, color: C.text }}>
        <b style={{ color, fontWeight: lead ? 700 : 500 }}>{pct.toFixed(1)}%</b>
        <span style={{ color: C.muted, marginLeft: 6 }}>{fmtVotes(votes)}</span>
      </span>
    </div>
  );
  return (
    <div style={{ marginTop: compact ? 8 : 12, paddingTop: compact ? 8 : 10, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: compact ? 3 : 5 }}>
      {row(race.right.short, t.dem, dPct, race.right.color, dLead)}
      {row(race.left.short, t.rep, rPct, race.left.color, !dLead)}
    </div>
  );
}

function ThreeBar({ race }) {
  const m = compute3(race.units);
  const parts = race.cands.map((c) => ({ ...c, sh: m.proj[c.key], win: m.win[c.key] }));
  const leader = [...parts].sort((a, b) => b.win - a.win)[0];
  const pct = Math.round(leader.win * 100);
  const tag = pct >= 90 ? "Likely" : pct >= 60 ? "Leans" : "Toss-up";
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", marginBottom: 7 }}>
        {parts.map((p) => (
          <div key={p.key} style={{ width: `${p.sh * 100}%`, background: p.color, transition: "width .6s ease-out" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mono }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: leader.color }}>{tag === "Toss-up" ? "Toss-up" : `${tag} ${leader.short}`} ({pct}%)</span>
        <span style={{ fontSize: 11, color: C.muted }}>{parts.map((p) => `${p.short[0]} ${Math.round(p.sh * 100)}`).join(" · ")} · {Math.round(m.fracIn * 100)}% in</span>
      </div>
    </div>
  );
}

// Short race label for the Needles view, so Maine's two Pingree races (Governor vs House 1) are easy to tell apart.
const raceTag = (r) => ({ sen: "Senate", gov: "Governor", cd1: "House 1", cd2: "House 2" }[r.id] || "Senate");
function NeedleGrid({ races, onPick }) {
  // Scoreboard rows: state, favored candidate, win %, and a plain-language rating.
  // No bars — just the number and who's ahead, scannable at a glance.
  const readOf = (r) => {
    if (r.type === "tbd") return { fav: "TBD", pct: null, tag: r.tbdChip || "TBD", color: C.brass, sub: r.sub };
    if (r.type === "rcv") return { fav: "RCV", pct: null, tag: "No night-of call", color: C.muted, sub: r.sub };
    if (r.type === "three") {
      const m = compute3(r.units);
      const parts = r.cands.map((c) => ({ ...c, win: m.win[c.key] }));
      const lead = [...parts].sort((a, b) => b.win - a.win)[0];
      const pct = Math.round(lead.win * 100);
      const tag = pct >= 90 ? "Likely" : pct >= 60 ? "Leans" : "Toss-up";
      return { fav: lead.short, pct, tag, color: lead.color, frac: m.fracIn };
    }
    if (!r.left || !r.right || !r.units || !r.units.length) return { fav: r.title, pct: null, tag: r.system || "", color: C.muted, sub: r.sub };
    const m = compute(r.units); const rt = rateOf(r, m);
    const tag = rt.text.split(" ")[0];
    return { fav: rt.leader.short, pct: rt.pct, tag, color: rt.leader.color, frac: m.fracIn };
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 8 }}>
      {races.map((r) => {
        const d = readOf(r);
        return (
          <ErrorBoundary key={r.id} mini label={`${r.title} unavailable`}>
            <button onClick={() => onPick(r.id)}
              style={{ textAlign: "left", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 3, padding: "11px 13px", cursor: "pointer", color: C.text, width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <span style={{ fontSize: 11, fontFamily: mono, letterSpacing: 1, color: C.brass }}>{r.state}<span style={{ color: C.muted, letterSpacing: 0.3, marginLeft: 6 }}>{raceTag(r)}</span></span>
                {r.liveOn
                  ? <span style={{ fontSize: 8, fontFamily: mono, letterSpacing: 0.5, padding: "1px 4px", borderRadius: 3, color: "#fff", background: RED, fontWeight: 700 }}>LIVE</span>
                  : (d.frac > 0 && <span style={{ fontSize: 9.5, fontFamily: mono, color: C.muted }}>{Math.round(d.frac * 100)}% in</span>)}
              </div>
              {d.pct == null ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: d.color, lineHeight: 1.05 }}>{d.fav}</div>
                  <div style={{ fontSize: 10.5, fontFamily: mono, color: C.muted, marginTop: 3 }}>{d.tag}</div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1, color: d.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{d.pct}%</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: d.color }}>{d.fav}</span>
                  </div>
                  <div style={{ fontSize: 10.5, fontFamily: mono, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {d.tag === "Toss-up" ? "Toss-up" : `${d.tag} ${d.fav}`}
                  </div>
                </>
              )}
            </button>
          </ErrorBoundary>
        );
      })}
    </div>
  );
}
function Overview({ races, onPick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {races.map((r) => (
        <ErrorBoundary key={r.id} mini label={`${r.title} unavailable`}>
        <button onClick={() => onPick(r.id)}
          style={{ textAlign: "left", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 3, padding: "12px 14px", cursor: "pointer", color: C.text }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{r.title}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {r.liveOn && (
                <span style={{ fontSize: 9, fontFamily: mono, letterSpacing: 0.5, padding: "2px 5px", borderRadius: 4, color: "#fff", background: RED, fontWeight: 700 }}>● LIVE</span>
              )}
              <span style={{ fontSize: 10, fontFamily: mono, color: C.muted, letterSpacing: 1 }}>{r.system}</span>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 9 }}>{r.sub}</div>
          {r.type === "tbd" ? <TbdMini race={r} /> : r.type === "rcv" ? <RcvMini race={r} /> : r.type === "three" ? <ThreeBar race={r} /> : <TiltBar race={r} />}
        </button>
        </ErrorBoundary>
      ))}
    </div>
  );
}

function GovDetail({ race, onBack, govB, govMargin, current, night }) {
  const d = readRace(race);
  const paused = isPaused(race, night);
  const m = compute3(race.units);
  const parts = race.cands.map((c) => ({ ...c, sh: m.proj[c.key], win: m.win[c.key] }));
  const byShare = [...parts].sort((a, b) => b.sh - a.sh);
  const sorted = [...race.units].sort((a, b) => b.weight - a.weight);
  const anyIn = sorted.some((u) => u.reported > 0);
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 14 }}>
        <ChevronLeft size={16} /> All races
      </button>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", columnGap: 40, rowGap: 22, paddingBottom: 28, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={kicker(d.favColor)}>Maine · Governor · Plurality, three-way{race.liveOn ? " · Live" : ""}</div>
          <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: 44, lineHeight: 1.05, letterSpacing: -0.8 }}>{race.cands.map((c) => c.short).join(" vs. ")}</h1>
          <p style={deckStyle(true)}>{d.frac > 0
            ? `${d.fav} leads with ${(parts.find((p) => p.short === d.fav).sh * 100).toFixed(1)}% projected. In a three-way race the winner needs only the most votes, so the gap between the top two matters more than the 50% line.`
            : `Polling has Bennett at ${govB}% and ${govMargin >= 0 ? "Pingree" : "Charles"} ahead by ${Math.abs(govMargin)} between the two major-party candidates. The winner needs only the most votes, not a majority.`}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.muted }}>Bennett (I) has no past election to map, so this race leans on polling for its starting point.</p>
          {paused && <PauseNote state="ME" />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", opacity: paused ? 0.45 : 1 }}>
          <div style={{ fontSize: 14, color: C.muted }}>{paused ? "Pre-election forecast" : "Chance of winning"} · <b style={{ color: C.text }}>{d.tag}</b></div>
          {byShare.map((p) => (
            <div key={p.key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: p.color }}>{p.full}</span>
                <span style={{ fontSize: 15, color: C.muted }}><b style={{ fontSize: 24, color: p.color }}>{Math.round(p.win * 100)}%</b> to win · {(p.sh * 100).toFixed(1)}% of the vote</span>
              </div>
              <div style={{ height: 10, background: C.panel2 }}><div style={{ width: `${p.sh * 100}%`, height: "100%", background: p.color, transition: "width .6s ease-out" }} /></div>
            </div>
          ))}
          <div style={{ fontSize: 13, color: C.muted }}>{Math.round(m.fracIn * 100)}% of expected vote in</div>
        </div>
      </section>
      <section style={{ paddingTop: 26, maxWidth: 820 }}>
        <SectionHead title="County by county" note={anyIn ? "Leader in counted votes" : "Counties fill in as votes are counted"} size={22} />
        {sorted.map((u) => {
          let top = null;
          if (u.reported > 0) {
            const arr = [["fP", "P"], ["fC", "C"], ["fB", "B"]].map(([fk, key]) => ({ key, v: u[fk] })).sort((a, b) => b.v - a.v)[0];
            top = { cand: race.cands.find((c) => c.key === arr.key), v: arr.v };
          }
          return (
            <div key={u.name} style={{ display: "grid", gridTemplateColumns: "minmax(90px,150px) minmax(0,1fr) 120px", alignItems: "center", columnGap: 14, padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{u.name}</span>
              <span style={{ fontSize: 13, color: C.muted }}>{Math.round(u.reported * 100)}% counted</span>
              <span style={{ fontSize: 14, fontWeight: 600, textAlign: "right", color: top ? top.cand.color : C.muted }}>{top ? `${top.cand.short} ${Math.round(top.v * 100)}%` : "—"}</span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ---- CONTROL OF THE SENATE ----
// Baseline: 53R–47D. Untracked seats are assumed to hold their party:
// safe-D bloc 44 (King and Sanders, who caucus D, included) and safe-R bloc 46.
// The 10 tracked races are the live set (NH added — a formerly-safe D seat now competitive). Democrats need 51 outright; 50-50 stays
// Republican on the Vice President's tie-breaking vote. Osborn (I) counts for
// neither party unless he declares a caucus.
const D_SAFE_SEATS = 44, R_SAFE_SEATS = 46; // NH moved from safe-D into the tracked set
const CONTROL_SET = [
  { id: "sen",    label: "Maine",          holder: "R" },
  { id: "nc_sen", label: "North Carolina", holder: "R" },
  { id: "oh_sen", label: "Ohio",           holder: "R" },
  { id: "tx_sen", label: "Texas",          holder: "R" },
  { id: "ia_sen", label: "Iowa",           holder: "R" },
  { id: "ga_sen", label: "Georgia",        holder: "D" },
  { id: "ne_sen", label: "Nebraska",       holder: "R", indRight: true },
  { id: "ak_sen", label: "Alaska",         holder: "R", note: "no election-night call (RCV)" },
  { id: "mi_sen", label: "Michigan",       holder: "D" },
  { id: "nh_sen", label: "New Hampshire",   holder: "D" },
];

function CupIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" />
    </svg>
  );
}
// Small outlined button in the masthead.
function SupportSmall() {
  return (
    <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, boxSizing: "border-box", textDecoration: "none", fontSize: 13, fontWeight: 600, color: C.text, border: `1.5px solid ${C.text}`, padding: "5px 12px", whiteSpace: "nowrap" }}>
      <CupIcon size={16} />Support this project
    </a>
  );
}
// Sign-off block at the bottom of every page.
function SupportBlock({ compact }) {
  return (
    <section style={{ display: "flex", flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", justifyContent: "space-between", gap: compact ? 12 : 40, marginTop: 40, paddingTop: 22, borderTop: `3px double ${C.text}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 760 }}>
        <span style={{ fontFamily: serif, fontSize: compact ? 22 : 26, fontWeight: 600 }}>Support the Needle Project</span>
        <span style={{ fontFamily: serif, fontSize: compact ? 16 : 18, lineHeight: 1.5, color: C.body }}>It's free, ad-free and built by one person. If it's useful to you, you can chip in to keep it running through election night.</span>
      </div>
      <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 48, boxSizing: "border-box", padding: "12px 22px", background: C.text, color: C.ink, textDecoration: "none", fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>
        <CupIcon />Buy me a coffee
      </a>
    </section>
  );
}

function WireFeed({ events, embedded }) {
  return (
    <div>
      {!embedded && (
        <>
          <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>LIVE WIRE</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, fontFamily: serif, marginBottom: 4 }}>Election Night Feed</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
            Plain-language updates generated straight from the model as results come in: rating changes, lead flips, reporting milestones, and county-by-county overperformance versus baseline. Every line is arithmetic on the numbers, never written commentary. County lines only carry meaning on real returns; in the simulation the county figures are random.
          </div>
        </>
      )}
      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: C.muted, fontFamily: mono, padding: "18px 0" }}>Waiting for results…</div>
      ) : (
        <div>
          {events.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 10, padding: "9px 2px", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 11, fontFamily: mono, color: C.muted, flexShrink: 0, paddingTop: 1, width: 62 }}>{e.t}</span>
              <span style={{ fontSize: 13, color: e.color || C.text, lineHeight: 1.45, fontWeight: (e.kind === "call" || e.kind === "flip") ? 700 : 400 }}>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TbdMini({ race }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{race.tbdNote}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: 0.5, color: C.brass, border: `1px solid ${C.brass}66`, borderRadius: 5, padding: "2px 7px" }}>{race.tbdChip}</span>
        <span style={{ fontSize: 11.5, color: C.muted }}>tap for details</span>
      </div>
    </div>
  );
}

function MaineSenateTbdDetail({ race, onBack }) {
  const card = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 3, padding: "14px 16px", marginBottom: 12 };
  const h2 = { fontSize: 12, fontWeight: 700, color: C.brass, marginBottom: 6, fontFamily: mono, letterSpacing: 0.5 };
  const body = { fontSize: 13, color: C.body, lineHeight: 1.6 };
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "4px 0 10px" }}>
        <ChevronLeft size={16} /> All races
      </button>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>MAINE · RANKED-CHOICE</div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5, fontFamily: serif }}>{race.title}</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{race.sub}</div>

      <div style={{ ...card, borderColor: C.brass, background: "#F3E9D2" }}>
        <div style={h2}>NOMINEE ALL BUT DECIDED</div>
        <div style={body}>Graham Platner, who won the June 9 primary, withdrew on July 10 after a former partner's accusation of sexual assault, which he denies. Former state Senate President Troy Jackson has since emerged as the overwhelming favorite to replace him and face Susan Collins.</div>
      </div>

      <div style={card}>
        <div style={h2}>THE REPLACEMENT PROCESS</div>
        <div style={body}>The nominee is chosen by roughly 600 delegates at a state convention in Bangor on July 25. Over a single weekend of county caucuses, Jackson's supporters swept the delegate slates, winning more than 460 of the 500 seats up for grabs.</div>
      </div>

      <div style={card}>
        <div style={h2}>THE PRESUMPTIVE NOMINEE</div>
        <div style={body}>By the end of that weekend Jackson's major rivals had dropped out and endorsed him, including Shenna Bellows, Nirav Shah, Jordan Wood, and Dan Kleban. A logger and former Senate President, Jackson runs on a working-class platform close to Platner's. Delegates are not legally bound, so it is not final until the convention, but his lead makes the nomination a formality.</div>
      </div>

      <div style={card}>
        <div style={h2}>WHAT HAPPENS TO THE NEEDLE</div>
        <div style={body}>This needle is suspended. The polling average it ran on was a Platner–Collins matchup, which no longer exists, so showing a probability now would be dishonest. Once the convention makes Jackson official on July 25, the needle returns as a Jackson vs Collins race, rebuilt on fresh head-to-head polling as it arrives.</div>
      </div>
    </div>
  );
}

function MichiganDetail({ race, onBack }) {
  const card = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 3, padding: "14px 16px", marginBottom: 12 };
  const h2 = { fontSize: 12, fontWeight: 700, color: C.brass, marginBottom: 6, fontFamily: mono, letterSpacing: 0.5 };
  const body = { fontSize: 13, color: C.body, lineHeight: 1.6 };
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "4px 0 10px" }}>
        <ChevronLeft size={16} /> All races
      </button>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>MICHIGAN · U.S. SENATE</div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5, fontFamily: serif }}>{race.title}</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{race.sub}</div>
      <div style={{ ...card, borderColor: C.brass, background: "#F3E9D2" }}>
        <div style={h2}>COMING AFTER THE AUGUST 4 PRIMARY</div>
        <div style={body}>Michigan's Senate seat is open — Gary Peters is retiring — and neither party has a nominee yet. Both fields are decided in the August 4 primary, so there is no matchup to model or poll here until then.</div>
      </div>
      <div style={card}>
        <div style={h2}>WHAT'S COMING</div>
        <div style={body}>Once the primary sets the candidates, Michigan gets the full treatment: a county-level needle built from Michigan's past results, weighted poll tracking, and live first-results coverage on election night — the same as the other states on the board.</div>
      </div>
      <div style={card}>
        <div style={h2}>WHY IT MATTERS</div>
        <div style={body}>Michigan is one of the marquee races of the cycle: an open seat in a genuine swing state, likely to be among the closest in the country and potentially decisive for control of the Senate.</div>
      </div>
    </div>
  );
}

function RcvMini({ race }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Decided by ranked-choice rounds that Alaska tabulates about two weeks after election night, not a single count.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: 0.5, color: RED, border: `1px solid ${RED}66`, borderRadius: 5, padding: "2px 7px" }}>LEAN R</span>
        <span style={{ fontSize: 11.5, color: C.muted }}>No call on the night — tap to see how it works</span>
      </div>
    </div>
  );
}

function AlaskaDetail({ race, onBack, current, wide = true, onNav }) {
  const d = readRace(race);
  const sec = (title, text, boxed) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: boxed ? 18 : "20px 0", background: boxed ? C.panel2 : "none", border: boxed ? `1px solid ${C.line}` : "none", borderBottom: `1px solid ${C.line}` }}>
      <h2 style={{ margin: 0, fontFamily: serif, fontSize: 24, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: 0, fontFamily: serif, fontSize: 18, lineHeight: 1.6, color: C.body }}>{text}</p>
    </div>
  );
  const hasNeedle = d.kind === "two";
  const leftPct = hasNeedle ? (d.favSide === "left" ? d.pct : 100 - d.pct) : null;
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 14 }}>
        <ChevronLeft size={16} /> All races
      </button>
      <section style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,7fr) minmax(0,5fr)" : "minmax(0,1fr)", columnGap: 40, rowGap: 22, paddingBottom: 26, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={kicker(hasNeedle ? d.favColor : RED)}>Alaska · {race.title} · Ranked-choice voting · Forecast only</div>
          <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: wide ? 48 : 32, lineHeight: 1.05, letterSpacing: -0.8 }}>Peltola vs. Sullivan</h1>
          <p style={deckStyle(wide)}>{hasNeedle ? dekFor(race, d, current) : "Rated Lean Republican."}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.muted }}>This needle is a polling forecast. It won't move on election night, because Alaska's ranked-choice rounds are counted about two weeks later.</p>
        </div>
        {hasNeedle && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: "100%", maxWidth: 400 }}><Dial pRight={d.pRight} width={400} left={race.left.color} right={race.right.color} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 400 }}>
              <span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: wide ? 34 : 28, fontWeight: 600, color: race.right.color }}>{100 - leftPct}%</span><span style={{ fontSize: 15, fontWeight: 600 }}>Peltola (D)</span></span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}><span style={{ fontSize: wide ? 34 : 28, fontWeight: 600, color: race.left.color }}>{leftPct}%</span><span style={{ fontSize: 15, fontWeight: 600 }}>Sullivan (R)</span></span>
            </div>
            <div style={{ fontSize: 14, color: C.muted, textAlign: "center" }}>Chance of winning, from the polling average · <b style={{ color: C.text }}>{d.tag}</b></div>
          </div>
        )}
      </section>
      <section style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,7fr) minmax(0,5fr)" : "minmax(0,1fr)", columnGap: 48, rowGap: 26, paddingTop: 22 }}>
        <div>
          {sec("Won't be called on election night", "Alaska counts first-choice votes on the night, but if no candidate is above 50% the winner is decided by ranked-choice rounds the state does not tabulate until about two weeks later. So on the night you'll see the first-choice lead, not a final result.", true)}
          {sec("How this race works", "Alaska uses a top-four open primary: the four candidates with the most votes, regardless of party, advance to a ranked-choice general election. To win outright, a candidate needs a majority of first-choice votes. If no one clears 50%, the last-place candidate is eliminated and their ballots move to each voter's next choice. That repeats until someone has a majority.")}
          {sec("The matchup", "Incumbent Republican Dan Sullivan faces Democrat Mary Peltola, the only Democrat to win a statewide race in Alaska since 2008. Trump carried Alaska by 13 points in 2024 and Sullivan is the incumbent; Peltola's crossover appeal and the ranked-choice format keep it competitive.")}
          {sec("How this needle is built", `It starts from the head-to-head polling average and shifts ${AK_HOUSE} points toward Sullivan (halved in October, since past misses don't reliably repeat), because Alaska polls have underestimated Republicans: Sullivan won by about 13 in 2020 after polling much closer, and Peltola lost her 2024 House race by about 2 after polling close. Alaska reports results by state house district rather than county, so there's no county map, and the needle stays a forecast.`)}
        </div>
        {hasNeedle && onNav && <RacePolls r={race} current={current} onNav={onNav} />}
      </section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// NEWSPAPER PAGES (Update 43, redesign step 2)
// Shared pieces first (dial needle, race reader, headlines), then each page.
// ════════════════════════════════════════════════════════════════════════════
// Election night (Update 44). The board switches to election-night mode at 7 p.m. ET on Nov. 3
// (00:00 UTC Nov. 4, after daylight saving ends). Add ?night to the address to preview it any time.
const ELECTION_NIGHT_START = Date.UTC(2026, 10, 4, 0, 0);
const PAUSE_STATES = ["ME", "NH"]; // no official results on election night; finish from official files
const AP_URL = "https://apnews.com/projects/elections-2026/";
function nightStarted() {
  try { if (new URLSearchParams(window.location.search).has("night")) return true; } catch { /* no window */ }
  return Date.now() >= ELECTION_NIGHT_START;
}
const isPaused = (r, night) => !!(night && r && PAUSE_STATES.includes(r.state) && !r.liveOn);
const PAUSE_TEXT = {
  ME: "Maine doesn't publish results on election night. Towns report to the press and the AP, and the state posts official town-by-town results only after they're certified, usually a few weeks later. If a ranked-choice count is needed, first-choice results come about a week after the election. This needle will finish on its own when those files are posted.",
  NH: "New Hampshire doesn't publish results on election night. Its towns report to the press and the AP overnight, and the state posts official town results a few days later. This needle will finish on its own when those files are posted.",
};
function PauseNote({ state, compact }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: compact ? 14 : 18, background: C.panel2, border: `1px solid ${C.line}` }}>
      <span style={{ fontFamily: serif, fontSize: compact ? 19 : 22, fontWeight: 600 }}>Paused until official results</span>
      <span style={{ fontSize: 15, lineHeight: 1.55, color: C.body }}>{PAUSE_TEXT[state] || PAUSE_TEXT.ME}</span>
      <a href={AP_URL} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", fontSize: 15, fontWeight: 700, color: C.text }}>Follow the live count at AP</a>
    </div>
  );
}

const POLL_KEY = { sen: "senate", gov: "governor" };
const pollKey = (id) => POLL_KEY[id] || id;
const HOUSE_BY_RACE = { ak_sen: AK_HOUSE, sen: SEN_HOUSE, nc_sen: NC_HOUSE, oh_sen: OH_HOUSE, tx_sen: TX_HOUSE, ia_sen: IA_HOUSE, ga_sen: GA_HOUSE, ne_sen: NE_HOUSE, mi_sen: MI_HOUSE, nh_sen: NH_HOUSE };
const stateLabel = (code) => (STATES.find((s) => s.code === code) || {}).label || code;
const raceName = (r) => String(r.title || "").replace("U.S. House · District", "House District").replace("U.S. ", "");
const PAPER = "#F4EFE4";
function tintOf(hex, t = 0.68) {
  const h = (x) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)];
  const a = h(hex), b = h(PAPER);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

// One plain reading of any race: who is favored, how likely, how much is counted.
function readRace(r) {
  if (!r) return { kind: "none" };
  if (r.type === "tbd") return { kind: "tbd", fav: "To be decided", favColor: C.brass, pct: null, tag: r.tbdChip || "Nominee TBD", frac: 0 };
  if (r.type === "rcv") return { kind: "rcv", fav: "Sullivan", favColor: RED, pct: null, tag: "Lean R", frac: 0, note: "Ranked-choice rounds counted about two weeks later" };
  if (r.type === "three") {
    const m = compute3(r.units);
    const parts = r.cands.map((c) => ({ ...c, sh: m.proj[c.key], win: m.win[c.key] }));
    const lead = [...parts].sort((a, b) => b.win - a.win)[0];
    const pct = Math.round(lead.win * 100);
    const t = pct >= 90 ? "Likely" : pct >= 60 ? "Leans" : "Toss-up";
    return { kind: "three", fav: lead.short, favColor: lead.color, pct, tag: t === "Toss-up" ? "Toss-up" : `${t} ${lead.short}`, frac: m.fracIn, parts };
  }
  if (!r.left || !r.right || !r.units || !r.units.length) return { kind: "none", fav: r.title, favColor: C.muted, pct: null, tag: r.system || "", frac: 0 };
  const m = compute(r.units); const rt = rateOf(r, m);
  return { kind: "two", fav: rt.leader.short, favColor: rt.leader.color, pct: rt.pct, tag: rt.text, frac: m.fracIn, pRight: m.winRight, m,
    marginTxt: `${(m.margin >= 0 ? r.right : r.left).short} +${Math.abs(m.margin * 100).toFixed(1)}`, favSide: m.margin >= 0 ? "right" : "left" };
}
function swingCaption(r, m) {
  if (m.fracIn === 0) return "No votes counted yet. The needle sits at its starting point, built from polling and each county's usual lean.";
  const s = m.swing * 100;
  if (Math.abs(s) < 0.6) return "Counted areas are tracking close to their expected results, so the projection is holding steady.";
  return `Counted areas are running about ${Math.abs(s).toFixed(1)} points toward ${s > 0 ? r.right.short : r.left.short} compared with their expected results. The needle carries that swing into the areas still counting.`;
}
function headlineFor(r, d) {
  if (d.kind !== "two" && d.kind !== "three") return raceName(r);
  const names = d.kind === "two" ? [r.left.short, r.right.short] : r.cands.map((c) => c.short);
  const other = names.find((n) => n !== d.fav) || "";
  if (d.tag.startsWith("Called")) return `${d.fav} wins`;
  if (d.frac > 0) return d.tag === "Toss-up" ? `${d.fav} and ${other} are neck and neck as votes come in` : `${d.fav} leads as votes are counted`;
  if (d.tag === "Toss-up") return `${d.fav} and ${other} are nearly even`;
  if (d.tag.startsWith("Leans")) return `${d.fav} holds a narrow edge`;
  return `${d.fav} is a clear favorite`;
}
function dekFor(r, d, current) {
  if (d.frac > 0 && d.m) return swingCaption(r, d.m);
  const pc = current && current[pollKey(r.id)];
  if (!pc || pc.margin == null || d.kind !== "two") return r.note || "";
  const mg = pc.margin;
  const lead = mg > 0 ? r.right.short : r.left.short;
  let t = mg === 0 ? "The polling average is tied." : `The polling average has ${lead} up ${Math.abs(mg)}.`;
  const house = HOUSE_BY_RACE[r.id] || 0;
  if (house > 0) t += r.id === "sen"
    ? ` Collins has beaten her polls in every recent race, so the needle starts ${house} points her way.`
    : ` Polls here have tended to underestimate Republicans, so the needle starts ${house} point${house === 1 ? "" : "s"} toward ${r.left.short}.`;
  if (/ranked/i.test(r.system || "")) t += " Ranked-choice voting decides it if no one tops 50 percent.";
  return t;
}

// The signature dial: Democrat (blue) half on the LEFT, Republican (red) half on the right,
// needle = chance of winning. Race data keeps Republicans as "left" and Democrats as "right";
// only the drawing is mirrored, so pRight (the Democrat's chance) swings the needle leftward.
function Dial({ pRight = 0.5, width = 420, left = RED, right = BLUE, mini = false }) {
  const deg = (0.5 - clamp(pRight, 0.01, 0.99)) * 180;
  const sw = mini ? 26 : 20;
  return (
    <svg viewBox="0 0 220 125" width={width} height={Math.round((width * 125) / 220)} aria-hidden="true" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <path d="M 20 110 A 90 90 0 0 1 110 20" fill="none" stroke={tintOf(right)} strokeWidth={sw} />
      <path d="M 110 20 A 90 90 0 0 1 200 110" fill="none" stroke={tintOf(left)} strokeWidth={sw} />
      {!mini && <line x1="110" y1="6" x2="110" y2="34" stroke={C.text} strokeWidth="1" />}
      <g style={{ transform: `rotate(${deg}deg)`, transformBox: "view-box", transformOrigin: "110px 110px", transition: "transform .7s cubic-bezier(0.22, 1, 0.36, 1)" }}>
        <line x1="110" y1="110" x2="110" y2={mini ? 24 : 26} stroke={C.text} strokeWidth={mini ? 10 : 3} strokeLinecap="round" />
      </g>
      {!mini && <circle cx="110" cy="110" r="7" fill={C.text} />}
    </svg>
  );
}
function ThreeStrip({ parts, height = 10 }) {
  return (
    <div style={{ display: "flex", height, width: "100%" }}>
      {parts.map((p) => <div key={p.key} style={{ width: `${p.sh * 100}%`, background: p.color, transition: "width .6s ease-out" }} />)}
    </div>
  );
}
function SectionHead({ title, note, size = 26 }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingBottom: 10, borderBottom: `2px solid ${C.text}` }}>
      <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: size, letterSpacing: -0.3 }}>{title}</h2>
      {note && <span style={{ fontSize: 13, color: C.muted }}>{note}</span>}
    </div>
  );
}
const kicker = (color = C.muted) => ({ fontSize: 14, fontWeight: 600, color });
const deckStyle = (wide) => ({ margin: 0, fontFamily: serif, fontSize: wide ? 20 : 17, lineHeight: 1.45, color: C.body });
const linkBtn = { background: "none", border: "none", padding: 0, cursor: "pointer", color: C.text, fontWeight: 600, fontSize: 14, textDecoration: "underline", textUnderlineOffset: 3, textAlign: "left" };

// Senate control from today's leaders (or calls, once votes are in).
function controlTally(races) {
  let dL = 0, rL = 0, iL = 0, dC = 0, rC = 0, iC = 0;
  const rows = CONTROL_SET.map((c) => {
    const r = races.find((x) => x.id === c.id);
    const d = readRace(r);
    let side = "R", name = "Sullivan (R)", pct = null, called = false;
    if (d.kind === "two") {
      const right = d.favSide === "right";
      side = right ? (c.indRight ? "I" : "D") : "R";
      const cand = right ? r.right : r.left;
      name = `${cand.short} (${right ? (c.indRight ? "I" : "D") : "R"})`;
      pct = d.pct; called = d.tag.startsWith("Called") && d.frac > 0;
    }
    if (side === "D") dL++; else if (side === "R") rL++; else iL++;
    if (called) { if (side === "D") dC++; else if (side === "R") rC++; else iC++; }
    return { ...c, race: r, d, side, name, pct, called, flip: side !== c.holder };
  });
  return { rows, D: D_SAFE_SEATS + dL, R: R_SAFE_SEATS + rL, I: iL, calledD: D_SAFE_SEATS + dC, calledR: R_SAFE_SEATS + rC, calledI: iC };
}
const sideColor = (s) => (s === "D" ? BLUE : s === "I" ? TEAL : RED);

// ── FRONT PAGE ──────────────────────────────────────────────────────────────
function RaceTable({ races, onPick, wide, night }) {
  const reads = races.map((r) => ({ r, d: isPaused(r, night) ? { ...readRace(r), paused: true, frac: 0 } : readRace(r) }));
  const anyIn = reads.some((x) => x.d.frac > 0);
  const cols = wide ? `150px minmax(0,1fr) 190px 150px ${anyIn ? "80px " : ""}72px` : "56px minmax(0,1fr) auto";
  return (
    <div role="list">
      {wide && (
        <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 20, padding: "9px 0", fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.line}` }}>
          <span>State</span><span>Race</span><span>Favored</span><span>Rating</span>{anyIn && <span>Counted</span>}<span style={{ textAlign: "right" }}>Needle</span>
        </div>
      )}
      {reads.map(({ r, d }) => {
        const gauge = d.kind === "two"
          ? <Dial mini pRight={d.pRight} width={wide ? 64 : 52} left={r.left.color} right={r.right.color} />
          : d.kind === "three" ? <div style={{ width: wide ? 64 : 52 }}><ThreeStrip parts={d.parts} height={8} /></div>
          : <span style={{ fontSize: 11, color: C.muted }}>No needle</span>;
        const fav = d.paused ? "Paused" : d.pct != null ? `${d.fav} ${d.pct}%` : d.kind === "rcv" ? "Lean R" : d.fav;
        const favCol = d.paused ? C.muted : d.favColor;
        const ratingTxt = d.paused ? "Waiting for official results" : d.kind === "rcv" ? "No night-of call" : r.noNight ? `${d.tag} · forecast only` : d.tag;
        return (
          <ErrorBoundary key={r.id} mini label={`${r.title} unavailable`}>
            <button role="listitem" onClick={() => onPick(r.id)}
              style={{ display: "grid", gridTemplateColumns: cols, columnGap: wide ? 20 : 12, alignItems: "center", width: "100%", textAlign: "left", padding: wide ? "10px 0" : "11px 0", background: "none", border: "none", borderBottom: `1px solid ${C.line}`, cursor: "pointer", color: C.text }}>
              {wide ? (
                <>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{stateLabel(r.state)}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: serif, fontSize: 18 }}>{raceName(r)}{r.liveOn && <span style={{ marginLeft: 8, fontFamily: sans, fontSize: 11, fontWeight: 700, color: "#fff", background: RED, padding: "1px 6px", verticalAlign: 3 }}>LIVE</span>}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>{r.sub}</span>
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 600, color: favCol }}>{fav}</span>
                  <span style={{ fontSize: 15 }}>{ratingTxt}</span>
                  {anyIn && <span style={{ fontSize: 14, color: C.muted }}>{d.frac > 0 ? `${Math.round(d.frac * 100)}%` : "—"}</span>}
                  <span style={{ justifySelf: "end", opacity: d.paused ? 0.35 : 1 }}>{gauge}</span>
                </>
              ) : (
                <>
                  <span style={{ opacity: d.paused ? 0.35 : 1 }}>{gauge}</span>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{stateLabel(r.state)} <span style={{ fontWeight: 400, color: C.muted }}>{raceName(r)}</span>{r.liveOn && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: RED, padding: "1px 5px" }}>LIVE</span>}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>{ratingTxt}{d.frac > 0 ? ` · ${Math.round(d.frac * 100)}% in` : ""}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: favCol, textAlign: "right" }}>{fav}</span>
                </>
              )}
            </button>
          </ErrorBoundary>
        );
      })}
    </div>
  );
}

function LeadStory({ r, current, wide, onPick }) {
  const d = readRace(r);
  if (d.kind !== "two") return null;
  const L = r.left, R = r.right;
  const leftPct = d.favSide === "left" ? d.pct : 100 - d.pct;
  const rightPct = 100 - leftPct;
  const t = voteTotals(r.units);
  const side = (cand, pct, align) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 2, minWidth: wide ? 140 : 0 }}>
      <span style={{ fontSize: wide ? 40 : 28, fontWeight: 600, color: cand.color, lineHeight: 1 }}>{pct}%</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{cand.short} ({cand.color === RED ? "R" : cand.color === TEAL ? "I" : "D"})</span>
      {t.total > 0 && <span style={{ fontSize: 13, color: C.muted }}>{fmtVotes(cand === R ? t.dem : t.rep)} votes</span>}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={kicker(d.favColor)}>{stateLabel(r.state)} · {r.title}{d.frac > 0 ? ` · ${Math.round(d.frac * 100)}% of expected vote in` : ""}</div>
      <button onClick={() => onPick(r.id)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: C.text }}>
        <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: wide ? 46 : 30, lineHeight: 1.08, letterSpacing: wide ? -0.8 : -0.4 }}>{headlineFor(r, d)}</h1>
      </button>
      <p style={deckStyle(wide)}>{dekFor(r, d, current)}</p>
      {wide ? (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28, paddingTop: 14 }}>
          <div style={{ paddingBottom: 14 }}>{side(R, rightPct, "flex-end")}</div>
          <Dial pRight={d.pRight} width={420} left={L.color} right={R.color} />
          <div style={{ paddingBottom: 14 }}>{side(L, leftPct, "flex-start")}</div>
        </div>
      ) : (
        <>
          <div style={{ alignSelf: "center", width: "100%", maxWidth: 320 }}><Dial pRight={d.pRight} width={320} left={L.color} right={R.color} /></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>{side(R, rightPct, "flex-start")}{side(L, leftPct, "flex-end")}</div>
        </>
      )}
      <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: C.muted }}>
        Chance of winning, {d.frac > 0 ? "updated from the official count" : "from the polling average"}. {d.tag}.{" "}
        <button onClick={() => onPick(r.id)} style={{ ...linkBtn, fontSize: 13 }}>Open the race page</button>
      </p>
    </div>
  );
}

function pickLead(races, night) {
  const two = races.filter((r) => readRace(r).kind === "two" && !isPaused(r, night) && !(night && r.noNight));
  if (!night) return races.find((r) => r.id === "sen" && readRace(r).kind === "two") || two[0];
  // Election night: the closest race that is counting and not yet called; then any counting race;
  // before the first results, the closest race by forecast.
  const byClose = (a, b) => Math.abs(readRace(a).pct - 50) - Math.abs(readRace(b).pct - 50);
  const counting = two.filter((r) => readRace(r).frac > 0);
  const open = counting.filter((r) => !readRace(r).tag.startsWith("Called")).sort(byClose);
  return open[0] || counting.sort((a, b) => readRace(b).frac - readRace(a).frac)[0] || two.slice().sort(byClose)[0];
}
function PausedList({ races, onPick, wide }) {
  if (!races.length) return null;
  return (
    <section style={{ paddingTop: 30 }}>
      <SectionHead title="Paused until official results" note={wide ? "Maine and New Hampshire don't publish results on election night" : null} size={wide ? 28 : 22} />
      {races.map((r) => (
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: wide ? "150px minmax(0,1fr) 260px 150px" : "minmax(0,1fr) auto", columnGap: 20, rowGap: 4, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
          {wide && <span style={{ fontSize: 16, fontWeight: 600 }}>{stateLabel(r.state)}</span>}
          <button onClick={() => onPick(r.id)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: C.text, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontFamily: serif, fontSize: 18 }}>{wide ? raceName(r) : `${stateLabel(r.state)} ${raceName(r)}`}</span>
            <span style={{ fontSize: 13, color: C.muted }}>{r.sub}</span>
          </button>
          {wide && <span style={{ fontSize: 14, color: C.muted }}>Finishes when the state posts official results</span>}
          <a href={AP_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 700, color: C.text, textAlign: "right" }}>Live count at AP</a>
        </div>
      ))}
    </section>
  );
}

function FrontPage({ races, current, briefing, wide, onPick, go, night }) {
  const leadRace = pickLead(races, night);
  const counting = races.filter((r) => !isPaused(r, night));
  const paused = races.filter((r) => isPaused(r, night));
  const tally = controlTally(races);
  const latest = (briefing || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const firstPara = latest ? String(latest.body || "").split(/\n\s*\n/)[0] : "";
  const excerpt = firstPara.length > 220 ? firstPara.slice(0, 217).replace(/\s+\S*$/, "") + "…" : firstPara;
  const anyIn = races.some((r) => readRace(r).frac > 0);
  const sidebar = (
    <aside style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 style={{ margin: 0, fontFamily: serif, fontSize: 24, fontWeight: 600 }}>Senate control</h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: C.body }}>{anyIn ? "If every race goes to its current leader:" : "If every race goes to today's polling leader:"}{paused.length ? " Paused races count by their pre-election forecast." : ""}</p>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontSize: 30, fontWeight: 600 }}>
          <span style={{ color: BLUE }}>{tally.D} D</span>{tally.I > 0 && <span style={{ color: TEAL, fontSize: 22 }}>{tally.I} I</span>}<span style={{ color: RED }}>{tally.R} R</span>
        </div>
        <div style={{ position: "relative", display: "flex", height: 14 }}>
          <div style={{ width: `${tally.D}%`, background: BLUE }} />{tally.I > 0 && <div style={{ width: `${tally.I}%`, background: TEAL }} />}<div style={{ width: `${tally.R}%`, background: RED }} />
          <div style={{ position: "absolute", left: "50%", top: -5, width: 2, height: 24, background: C.text }} />
        </div>
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>51 seats for control. The vice president breaks a 50–50 tie.</p>
        <button onClick={() => go("control")} style={linkBtn}>See every seat</button>
      </div>
      {latest && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>The Briefing · {fmtDate(latest.date)}</div>
          <button onClick={() => go("briefing")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: C.text }}>
            <h3 style={{ margin: 0, fontFamily: serif, fontSize: 26, fontWeight: 600, lineHeight: 1.15 }}>{latest.title}</h3>
          </button>
          <p style={{ margin: 0, fontFamily: serif, fontSize: 17, lineHeight: 1.5, color: C.body }}>{excerpt}</p>
          <button onClick={() => go("briefing")} style={linkBtn}>Read the briefing</button>
        </div>
      )}
    </aside>
  );
  return (
    <div>
      <section style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,2fr) minmax(0,1fr)" : "minmax(0,1fr)", columnGap: 40, rowGap: 28, paddingBottom: 30, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ paddingRight: wide ? 40 : 0, borderRight: wide ? `1px solid ${C.line}` : "none" }}>
          {leadRace && <ErrorBoundary label="The lead race hit an error"><LeadStory r={leadRace} current={current} wide={wide} onPick={onPick} /></ErrorBoundary>}
        </div>
        {sidebar}
      </section>
      <section style={{ paddingTop: 28 }}>
        <SectionHead title={night ? "Counting now" : "Every race we're tracking"} note={wide ? "Chance of winning · tap a race for its page" : null} size={wide ? 28 : 22} />
        <RaceTable races={counting} onPick={onPick} wide={wide} night={night} />
        <p style={{ margin: 0, paddingTop: 12, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Alaska's needle is a polling forecast only. Its ranked-choice rounds are counted about two weeks after election night, so it doesn't move on election night.</p>
      </section>
      {night && <PausedList races={paused} onPick={onPick} wide={wide} />}
    </div>
  );
}
const fmtDate = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d) ? String(iso || "") : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ── RACE PAGE (two-candidate races) ─────────────────────────────────────────
function RacePolls({ r, current, onNav }) {
  const pc = current && current[pollKey(r.id)];
  const polls = pc && Array.isArray(pc.polls) ? pc.polls.slice(0, 6) : [];
  if (!pc) return null;
  const dem = r.right.short, rep = r.left.short;
  const mTxt = (dm, rp) => { const x = Math.round((dm - rp) * 10) / 10; return x === 0 ? ["Tied", C.text] : x > 0 ? [`${dem} +${x}`, r.right.color] : [`${rep} +${-x}`, r.left.color]; };
  return (
    <div>
      <SectionHead title="Recent polls" note={pc.nPolls ? `${pc.nPolls} in the average` : null} size={22} />
      {polls.length === 0 ? <p style={{ fontSize: 14, color: C.muted }}>{pc.note || "No public polls yet."}</p> : polls.map((p, i) => {
        const [t, col] = mTxt(p.dem, p.rep);
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", columnGap: 12, padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.pollster}</span>
            <span style={{ color: C.muted }}>{fmtDate(p.date).replace(/, \d{4}$/, "")}</span>
            <span style={{ color: col, fontWeight: 600, minWidth: 92, textAlign: "right" }}>{t}</span>
          </div>
        );
      })}
      <button onClick={() => onNav("polls")} style={{ ...linkBtn, marginTop: 12 }}>All polls</button>
    </div>
  );
}
function RelatedBriefing({ r, briefing, onNav }) {
  const names = [r.left?.short, r.right?.short, stateLabel(r.state)].filter(Boolean);
  const hit = (briefing || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .find((p) => names.some((n) => `${p.title} ${p.body}`.includes(n)));
  if (!hit) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 26 }}>
      <h3 style={{ margin: 0, fontFamily: serif, fontSize: 22, fontWeight: 600 }}>From the Briefing</h3>
      <button onClick={() => onNav("briefing")} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: C.text, fontFamily: serif, fontSize: 19, lineHeight: 1.3 }}>{hit.title}</button>
      <span style={{ fontSize: 13, color: C.muted }}>{fmtDate(hit.date)}</span>
    </div>
  );
}
function CountyTable({ race }) {
  const sorted = [...race.units].sort((a, b) => b.weight - a.weight);
  const anyIn = sorted.some((u) => u.reported > 0);
  return (
    <div>
      <SectionHead title="County by county" note={anyIn ? "Share of expected vote counted" : "Starting estimate for each county"} size={22} />
      {sorted.map((u) => {
        const share = u.reported > 0 && u.finalShare != null ? u.finalShare : u.prior;
        const lean = Math.round((share - 0.5) * 200);
        const col = lean >= 0 ? race.right.color : race.left.color;
        const who = lean >= 0 ? race.right.short : race.left.short;
        const base = Math.round((u.prior - 0.5) * 200);
        return (
          <div key={u.name} style={{ display: "grid", gridTemplateColumns: "minmax(90px,150px) minmax(0,1fr) 118px", alignItems: "center", columnGap: 14, padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
            <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ display: "flex", height: 10 }}>
                <span style={{ width: `${share * 100}%`, background: tintOf(race.right.color, 0.45) }} />
                <span style={{ width: `${(1 - share) * 100}%`, background: tintOf(race.left.color, 0.45) }} />
              </span>
              {anyIn && <span style={{ fontSize: 12, color: C.muted }}>{Math.round(u.reported * 100)}% counted · expected {base >= 0 ? race.right.short : race.left.short} +{Math.abs(base)}</span>}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: col, textAlign: "right" }}>{lean === 0 ? "Even" : `${who} +${Math.abs(lean)}`}</span>
          </div>
        );
      })}
      <p style={{ margin: 0, paddingTop: 10, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        {anyIn ? "Counties show the counted vote once results arrive, and the starting estimate before that." : "Each county starts from its usual lean relative to the state. When votes arrive, the gap between the starting estimate and the real count drives the needle."}
      </p>
    </div>
  );
}
function RacePage({ race, onBack, current, briefing, wide, onNav, night }) {
  const d = readRace(race);
  const paused = isPaused(race, night);
  const L = race.left, R = race.right;
  const leftPct = d.favSide === "left" ? d.pct : 100 - d.pct;
  const t = voteTotals(race.units);
  const party = (c) => (c.color === RED ? "R" : c.color === TEAL ? "I" : "D");
  const side = (cand, pct, votes, align) => (
    <span style={{ display: "flex", flexDirection: "column", alignItems: align }}>
      <span style={{ fontSize: wide ? 34 : 28, fontWeight: 600, color: cand.color, lineHeight: 1.05 }}>{pct}%</span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{cand.short} ({party(cand)})</span>
      {t.total > 0 && <span style={{ fontSize: 13, color: C.muted }}>{fmtVotes(votes)} votes</span>}
    </span>
  );
  const right = (
    <div>
      <RacePolls r={race} current={current} onNav={onNav} />
      <RelatedBriefing r={race} briefing={briefing} onNav={onNav} />
    </div>
  );
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.muted, fontSize: 14, cursor: "pointer", padding: 0, marginBottom: 14 }}>
        <ChevronLeft size={16} /> All races
      </button>
      <section style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,7fr) minmax(0,5fr)" : "minmax(0,1fr)", columnGap: 40, rowGap: 22, paddingBottom: 28, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={kicker(paused ? C.muted : d.favColor)}>{stateLabel(race.state)} · {race.title} · {race.system}{race.liveOn ? " · Live" : paused ? " · Paused" : ""}</div>
          <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: wide ? 48 : 32, lineHeight: 1.05, letterSpacing: -0.8 }}>{R.short} vs. {L.short}</h1>
          <p style={deckStyle(wide)}>{dekFor(race, d, current)}</p>
          {race.note && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.muted }}>{race.note}</p>}
          {paused && <PauseNote state={race.state} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: paused ? 0.45 : 1 }}>
          {paused && <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Pre-election forecast</div>}
          <div style={{ width: "100%", maxWidth: 400 }}><Dial pRight={d.pRight} width={400} left={L.color} right={R.color} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 400 }}>
            {side(R, 100 - leftPct, t.dem, "flex-start")}{side(L, leftPct, t.rep, "flex-end")}
          </div>
          <div style={{ fontSize: 14, color: C.muted, textAlign: "center" }}>
            Chance of winning · <b style={{ color: C.text }}>{d.tag}</b> · Projected {d.marginTxt} · {Math.round(d.frac * 100)}% of expected vote in
          </div>
        </div>
      </section>
      {!paused && <p style={{ margin: "18px 0 0", padding: "2px 0 2px 14px", borderLeft: `3px solid ${C.text}`, fontFamily: serif, fontSize: 17, lineHeight: 1.5, color: C.body }}>{swingCaption(race, d.m)}</p>}
      <section style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,7fr) minmax(0,5fr)" : "minmax(0,1fr)", columnGap: 48, rowGap: 30, paddingTop: 26 }}>
        <CountyTable race={race} />
        {right}
      </section>
    </div>
  );
}

// ── SENATE CONTROL ──────────────────────────────────────────────────────────
function SenateControlView({ races, wide, onPick, night }) {
  const [ovr, setOvr] = useState({});
  const tally = controlTally(races);
  const rows = tally.rows.map((x) => ({ ...x, pick: ovr[x.id] }));
  const scenario = rows.some((x) => x.pick);
  const count = (s) => rows.filter((x) => (x.pick || x.side) === s).length;
  const D = D_SAFE_SEATS + count("D"), R = R_SAFE_SEATS + count("R"), I = count("I");
  const cycle = (x) => {
    const opts = [x.indRight ? "I" : "D", "R"];
    setOvr((o) => {
      const cur = o[x.id];
      const next = cur == null ? opts.find((v) => v !== x.side) : undefined;
      const n = { ...o };
      if (next) n[x.id] = next; else delete n[x.id];
      return n;
    });
  };
  const flips = rows.filter((x) => (x.pick || x.side) !== x.holder);
  const verdict = D >= 51 ? "Democrats would take control" : R >= 50 ? "Republicans would keep control" : "control would come down to Nebraska's Dan Osborn";
  const blocks = [];
  for (let i = 0; i < D_SAFE_SEATS; i++) blocks.push(BLUE);
  rows.filter((x) => (x.pick || x.side) === "D").forEach(() => blocks.push(tintOf(BLUE, 0.4)));
  rows.filter((x) => (x.pick || x.side) === "I").forEach(() => blocks.push(tintOf(TEAL, 0.3)));
  rows.filter((x) => (x.pick || x.side) === "R").forEach(() => blocks.push(tintOf(RED, 0.4)));
  for (let i = 0; i < R_SAFE_SEATS; i++) blocks.push(RED);
  return (
    <div>
      <section style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 28, borderBottom: `1px solid ${C.line}` }}>
        <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: wide ? 46 : 32, letterSpacing: -0.8 }}>Who controls the Senate?</h1>
        <p style={{ ...deckStyle(wide), maxWidth: 880 }}>
          {scenario ? "In your scenario, " : "If every race we track goes to today's leader, "}{verdict}, {D} to {R}{I ? `, with Osborn holding ${I}` : ""}.
          {flips.length ? ` Seats changing hands: ${flips.map((x) => x.label).join(", ")}.` : " No seats would change hands."}
        </p>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontSize: wide ? 34 : 24, fontWeight: 600 }}>
          <span style={{ color: BLUE }}>{D} Democrats</span>{I > 0 && <span style={{ color: TEAL, fontSize: wide ? 24 : 18 }}>{I} Ind.</span>}<span style={{ color: RED }}>{R} Republicans</span>
        </div>
        <div style={{ position: "relative", display: "flex", gap: wide ? 3 : 1 }}>
          {blocks.map((c, i) => <div key={i} style={{ flex: 1, height: wide ? 26 : 20, background: c }} />)}
          <div style={{ position: "absolute", left: "calc(50% - 1px)", top: -8, width: 2, height: wide ? 42 : 36, background: C.text }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px", fontSize: 13, color: C.muted }}>
          <span>Dark: seats not up this year or safe ({D_SAFE_SEATS} D, {R_SAFE_SEATS} R)</span><span>Light: the 10 races we track, by current leader</span><span>Line: 51 for control; the vice president breaks a 50–50 tie</span>
        </div>
        {scenario && <button onClick={() => setOvr({})} style={{ ...linkBtn, color: RED }}>Clear my scenario and go back to the forecast</button>}
      </section>
      <section style={{ paddingTop: 26 }}>
        <SectionHead title="The 10 seats that decide it" note={wide ? "Tap “Your call” to try a scenario" : null} size={wide ? 28 : 22} />
        {rows.map((x) => {
          const s = x.pick || x.side;
          const col = sideColor(s);
          const flip = s !== x.holder;
          const callTxt = x.pick ? (x.pick === "D" ? "Dem" : x.pick === "I" ? "Ind" : "GOP") : "—";
          return (
            <div key={x.id} style={{ display: "grid", gridTemplateColumns: wide ? "170px 130px minmax(0,1fr) 110px 110px 130px" : "minmax(0,1fr) auto", columnGap: 16, rowGap: 4, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
              {wide ? (
                <>
                  <button onClick={() => x.race && onPick(x.id)} style={{ ...linkBtn, textDecoration: "none", fontSize: 16 }}>{x.label}</button>
                  <span style={{ fontSize: 14, color: C.muted }}>Held by {x.holder === "D" ? "Dem." : "GOP"}</span>
                  <span style={{ fontFamily: serif, fontSize: 18, color: sideColor(x.side) }}>{x.name}{isPaused(x.race, night) ? <span style={{ fontFamily: sans, fontSize: 13, color: C.muted }}> · paused, forecast shown</span> : x.race && x.race.noNight ? <span style={{ fontFamily: sans, fontSize: 13, color: C.muted }}> · forecast only</span> : null}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: sideColor(x.side) }}>{x.pct != null ? `${x.pct}%` : "—"}{x.called ? " · Called" : ""}</span>
                  <span>{flip && <span style={{ fontSize: 12, fontWeight: 700, color: PAPER, background: col, padding: "2px 8px" }}>Would flip</span>}</span>
                  <button onClick={() => cycle(x)} style={{ whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, border: `1px solid ${x.pick ? col : C.line}`, background: x.pick ? tintOf(col, 0.8) : "transparent", color: C.text, padding: "5px 8px", cursor: "pointer" }}>Your call: {callTxt}</button>
                </>
              ) : (
                <>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{x.label} <span style={{ fontWeight: 400, fontSize: 13, color: C.muted }}>held by {x.holder === "D" ? "Dem." : "GOP"}</span></span>
                    <span style={{ fontSize: 14, color: sideColor(x.side) }}>{x.name} {x.pct != null ? `${x.pct}%` : ""}{flip ? " · would flip" : ""}{isPaused(x.race, night) ? " · paused" : x.race && x.race.noNight ? " · forecast only" : ""}</span>
                  </span>
                  <button onClick={() => cycle(x)} style={{ whiteSpace: "nowrap", fontSize: 12, fontWeight: 600, minHeight: 36, border: `1px solid ${x.pick ? col : C.line}`, background: x.pick ? tintOf(col, 0.8) : "transparent", color: C.text, padding: "5px 8px", cursor: "pointer" }}>Your call: {callTxt}</button>
                </>
              )}
            </div>
          );
        })}
        <p style={{ margin: 0, paddingTop: 12, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Seats not listed are assumed to stay with their party. Osborn counts for neither party. A scenario never changes the needles.</p>
      </section>
    </div>
  );
}

// ── THE BRIEFING ────────────────────────────────────────────────────────────
function BriefingView({ posts, wide }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState(null);
  const sorted = (posts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const shown = filter ? sorted.filter((p) => `${p.title} ${p.body}`.toLowerCase().includes(filter.toLowerCase())) : sorted;
  const paras = (p) => String(p.body || "").split(/\n\s*\n/);
  const links = (p) => Array.isArray(p.links) && p.links.length > 0 && (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 6 }}>
      {p.links.map((l, k) => <a key={k} href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{l.label}</a>)}
    </div>
  );
  const lead = shown[0];
  const rest = shown.slice(1);
  const states = ["Maine", "North Carolina", "Texas", "Michigan", "Nebraska", "Iowa", "Georgia", "Ohio", "New Hampshire", "Alaska"];
  const aside = (
    <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ margin: 0, fontFamily: serif, fontSize: 24, fontWeight: 600 }}>About the Briefing</h2>
      <p style={{ margin: 0, fontFamily: serif, fontSize: 17, lineHeight: 1.55, color: C.body }}>Written analysis from Colin Blais. The needles are math; this is the story around them. Longer pieces run on Food &amp; Politics.</p>
      <a href="https://foodandpolitics.substack.com" target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", fontSize: 15, fontWeight: 700, textDecoration: "none", color: C.text, border: `1.5px solid ${C.text}`, padding: "10px 16px" }}>Subscribe to Food &amp; Politics</a>
      <div style={{ height: 1, background: C.line, margin: "8px 0" }} />
      <h2 style={{ margin: 0, fontFamily: serif, fontSize: 20, fontWeight: 600 }}>Filter by state</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {states.map((s) => (
          <button key={s} onClick={() => { setFilter(filter === s ? null : s); setOpen(null); }}
            style={{ fontSize: 14, padding: "7px 12px", minHeight: 36, cursor: "pointer", border: `1px solid ${filter === s ? C.text : C.line}`, background: filter === s ? C.text : "transparent", color: filter === s ? PAPER : C.text }}>{s}</button>
        ))}
      </div>
      {filter && <button onClick={() => setFilter(null)} style={linkBtn}>Show all posts</button>}
    </aside>
  );
  if (posts === null) return <p style={{ fontSize: 15, color: C.muted }}>Loading the Briefing…</p>;
  if (!sorted.length) return <p style={{ fontSize: 15, color: C.muted }}>No briefings posted yet.</p>;
  return (
    <section style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,2fr) minmax(0,1fr)" : "minmax(0,1fr)", columnGap: 48, rowGap: 30 }}>
      <div>
        {!lead ? <p style={{ fontSize: 15, color: C.muted }}>No posts mention {filter} yet.</p> : (
          <article style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 26, borderBottom: `2px solid ${C.text}` }}>
            <div style={kicker()}>The Briefing · {fmtDate(lead.date)}</div>
            <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: wide ? 46 : 30, lineHeight: 1.06, letterSpacing: -0.8 }}>{lead.title}</h1>
            {paras(lead).map((t, j) => <p key={j} style={{ margin: 0, fontFamily: serif, fontSize: wide ? 19 : 17, lineHeight: 1.6, color: C.body }}>{t}</p>)}
            {links(lead)}
          </article>
        )}
        {rest.map((p, i) => {
          const isOpen = open === i;
          return (
            <article key={`${p.date}-${p.title}`} style={{ display: "grid", gridTemplateColumns: wide ? "110px minmax(0,1fr)" : "minmax(0,1fr)", columnGap: 24, rowGap: 4, padding: "16px 0", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ fontSize: 14, color: C.muted, paddingTop: wide ? 5 : 0 }}>{fmtDate(p.date)}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
                  style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: C.text, fontFamily: serif, fontSize: wide ? 24 : 21, fontWeight: 600, lineHeight: 1.2 }}>{p.title}</button>
                {(isOpen ? paras(p) : [paras(p)[0]]).map((t, j) => (
                  <p key={j} style={{ margin: 0, fontFamily: serif, fontSize: 17, lineHeight: 1.55, color: C.body, ...(isOpen ? {} : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{t}</p>
                ))}
                {isOpen && links(p)}
                <button onClick={() => setOpen(isOpen ? null : i)} style={linkBtn}>{isOpen ? "Show less" : "Keep reading"}</button>
              </div>
            </article>
          );
        })}
      </div>
      {aside}
    </section>
  );
}

// ── POLLS ───────────────────────────────────────────────────────────────────
const POLL_TABS = [
  ["senate", "Maine Senate", "Jackson", "Collins"], ["governor", "Maine Governor", "Pingree", "Charles", "Bennett"],
  ["cd1", "Maine House 1", "Pingree", "Russell"], ["cd2", "Maine House 2", "Dunlap", "LePage"],
  ["nc_sen", "North Carolina", "Cooper", "Whatley"], ["oh_sen", "Ohio", "Brown", "Husted"], ["tx_sen", "Texas", "Talarico", "Paxton"],
  ["ia_sen", "Iowa", "Turek", "Hinson"], ["ga_sen", "Georgia", "Ossoff", "Collins"], ["ne_sen", "Nebraska", "Osborn", "Ricketts"],
  ["mi_sen", "Michigan", "El-Sayed", "Rogers"], ["nh_sen", "New Hampshire", "Pappas", "Sununu"], ["ak_sen", "Alaska", "Peltola", "Sullivan"],
];
const HOUSE_BY_POLL = { ak_sen: AK_HOUSE, senate: SEN_HOUSE, nc_sen: NC_HOUSE, oh_sen: OH_HOUSE, tx_sen: TX_HOUSE, ia_sen: IA_HOUSE, ga_sen: GA_HOUSE, ne_sen: NE_HOUSE, mi_sen: MI_HOUSE, nh_sen: NH_HOUSE };
const tierOf = (rating) => TIERS.find((t) => (rating || 0) >= t.min) || TIERS[TIERS.length - 1];
function PollsView({ current, loaded, wide }) {
  const [tab, setTab] = useState("senate");
  const def = POLL_TABS.find((t) => t[0] === tab) || POLL_TABS[0];
  const [, label, demN, repN, indN] = def;
  const pc = current && current[tab];
  const polls = pc && Array.isArray(pc.polls) ? pc.polls : [];
  const mg = pc ? pc.margin : null;
  const demCol = tab === "ne_sen" ? TEAL : BLUE;
  const avgTxt = mg == null ? "—" : mg === 0 ? "Tied" : mg > 0 ? `${demN} +${Math.abs(mg)}` : `${repN} +${Math.abs(mg)}`;
  const house = HOUSE_BY_POLL[tab] || 0;
  const cols = wide ? `minmax(0,1fr) 100px 70px 70px ${indN ? "70px " : ""}120px 120px 90px 64px` : "minmax(0,1fr) auto";
  const mTxt = (x) => { const v = Math.round(x * 10) / 10; return v === 0 ? ["Tied", C.text] : v > 0 ? [`${demN} +${v}`, demCol] : [`${repN} +${-v}`, RED]; };
  const stateName = label.startsWith("Maine") ? "Maine" : label;
  return (
    <div>
      <section style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 18 }}>
        <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: wide ? 46 : 32, letterSpacing: -0.8 }}>The polls</h1>
        <p style={{ ...deckStyle(wide), maxWidth: 900 }}>Every poll in the averages, newest first. Better pollsters count more, newer polls count more, each poll is corrected for its pollster's measured lean, and a campaign's own poll never stands alone.</p>
      </section>
      <nav aria-label="Races" style={{ display: "flex", flexWrap: wide ? "wrap" : "nowrap", overflowX: wide ? "visible" : "auto", gap: 4, borderBottom: `1px solid ${C.line}` }}>
        {POLL_TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: C.text, padding: "9px 12px", minHeight: 40, fontSize: 15, fontWeight: tab === k ? 700 : 500, borderBottom: `2px solid ${tab === k ? C.text : "transparent"}`, whiteSpace: "nowrap" }}>{l}</button>
        ))}
      </nav>
      {!loaded ? <p style={{ fontSize: 15, color: C.muted }}>Loading the latest polls…</p> : !pc ? <p style={{ fontSize: 15, color: C.muted }}>No polling data for this race yet.</p> : (
        <>
          <section style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14, padding: "24px 0 16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={kicker()}>{label} · polling average{pc.nPolls ? ` of ${pc.nPolls} polls` : ""}</span>
              <span style={{ fontSize: wide ? 40 : 30, fontWeight: 600, color: mg == null || mg === 0 ? C.text : mg > 0 ? demCol : RED }}>{avgTxt}{indN && pc.bennett != null ? <span style={{ fontSize: 20, color: IND }}> · {indN} {pc.bennett}%</span> : null}</span>
            </div>
            {house > 0 && <span style={{ fontSize: 14, color: C.muted, maxWidth: 440 }}>The needle then shifts its starting point {house} point{house === 1 ? "" : "s"} toward {repN} {tab === "senate" ? "for her record of beating her polls" : `for ${stateName}'s history of polls underestimating Republicans`}. The How it works page explains each shift.</span>}
          </section>
          {polls.length === 0 ? <p style={{ fontSize: 15, color: C.muted }}>{pc.note || "No public polls yet."}</p> : (
            <div>
              {wide && (
                <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 18, padding: "10px 0", fontSize: 12, fontWeight: 600, color: C.muted, borderTop: `2px solid ${C.text}`, borderBottom: `1px solid ${C.line}` }}>
                  <span>Pollster</span><span>Field end</span><span>{demN}</span><span>{repN}</span>{indN && <span>{indN}</span>}<span>Margin</span><span>Lean-corrected</span><span>Rating</span><span style={{ textAlign: "right" }}>Weight</span>
                </div>
              )}
              {polls.map((p, i) => {
                const [mt, mc] = mTxt(p.dem - p.rep);
                const [at, ac] = mTxt(p.adjMargin != null ? p.adjMargin : p.dem - p.rep);
                const tier = tierOf(p.rating);
                return wide ? (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: cols, columnGap: 18, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.line}`, fontSize: 15 }}>
                    <span style={{ fontFamily: serif, fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.pollster}</span>
                    <span style={{ color: C.muted }}>{fmtDate(p.date).replace(/, \d{4}$/, "")}</span>
                    <span>{p.dem}</span><span>{p.rep}</span>{indN && <span>{p.ind ?? "—"}</span>}
                    <span style={{ color: mc, fontWeight: 600 }}>{mt}</span>
                    <span style={{ color: ac }}>{at}</span>
                    <span style={{ color: tier.color, fontWeight: 600 }}>{tier.name}</span>
                    <span style={{ textAlign: "right", color: C.muted }}>{p.weightPct}%</span>
                  </div>
                ) : (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: cols, columnGap: 12, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontFamily: serif, fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.pollster}</span>
                      <span style={{ fontSize: 13, color: C.muted }}>{fmtDate(p.date).replace(/, \d{4}$/, "")} · <span style={{ color: tier.color, fontWeight: 600 }}>{tier.name}</span> · {p.dem}–{p.rep}{p.ind != null ? `–${p.ind}` : ""} · weight {p.weightPct}%{p.house ? ` · lean-corrected ${at}` : ""}</span>
                    </span>
                    <span style={{ color: mc, fontWeight: 600, fontSize: 15, textAlign: "right" }}>{mt}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p style={{ margin: 0, paddingTop: 12, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {tab === "ak_sen" ? "Alaska polls are head-to-head surveys. Alaska's needle is built from them as a forecast only; the election itself is ranked-choice. " : ""}
            {tab === "senate" ? "Maine Senate polls count from July 25, when Jackson became the nominee. " : ""}
            Likely-voter numbers are used when a poll reports both. Margin is what the pollster published; lean-corrected is the margin after removing that pollster's measured lean, and that is what goes into the average. Weight is each poll's share of the average. Updated {current?.updated || "—"}.
          </p>
        </>
      )}
    </div>
  );
}

// ── POLLSTER RATINGS ────────────────────────────────────────────────────────
function RatingsView({ current, loaded, wide }) {
  const all = buildRatings(current);
  return (
    <div>
      <section style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 20, borderBottom: `2px solid ${C.text}` }}>
        <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: wide ? 46 : 32, letterSpacing: -0.8 }}>Pollster ratings</h1>
        <p style={{ ...deckStyle(wide), maxWidth: 900 }}>Not every poll deserves the same trust. Each pollster gets one rating, used everywhere it polls, and that rating decides how much its numbers pull the average. Each pollster's measured lean is shown too, and corrected for. This list is built from the polls the site is using right now.</p>
      </section>
      {!loaded && <p style={{ fontSize: 14, color: C.muted }}>Loading ratings…</p>}
      {TIERS.map((t, i) => {
        const max = i === 0 ? 2 : TIERS[i - 1].min;
        const members = all.filter((p) => p.rating >= t.min && p.rating < max);
        if (!members.length) return null;
        return (
          <div key={t.name} style={{ display: "grid", gridTemplateColumns: wide ? "260px minmax(0,1fr)" : "minmax(0,1fr)", columnGap: 40, rowGap: 12, padding: "24px 0", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: serif, fontSize: 30, fontWeight: 600, color: t.color }}>{t.name}</span>
              <span style={{ fontSize: 14, lineHeight: 1.5, color: C.body }}>{t.desc}</span>
              <span style={{ fontSize: 13, color: C.muted }}>Rating {t.range}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: wide ? "repeat(auto-fill, minmax(230px, 1fr))" : "minmax(0,1fr)", gap: 8, alignContent: "start" }}>
              {members.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", background: C.panel, border: `1px solid ${C.line}` }}>
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{POLLSTER_NOTES[p.name] ? `${POLLSTER_NOTES[p.name]} · ` : ""}{p.n} {p.n === 1 ? "poll" : "polls"} · {[...p.states].sort().join(", ")}</span>
                    {leanText(p.lean) && <span style={{ fontSize: 12, fontWeight: 600, color: leanColor(p.lean) }}>Measured lean: {leanText(p.lean)}</span>}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{p.rating.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ paddingTop: 22 }}>
        <SectionHead title="The rules" size={22} />
        <p style={{ margin: "12px 0 0", fontFamily: serif, fontSize: 17, lineHeight: 1.6, color: C.body, maxWidth: 900 }}>
          A pollster carries one rating everywhere it appears. When a poll publishes both registered-voter and likely-voter numbers, the likely-voter numbers are used. A poll paid for by a campaign or a party is rated at the bottom, and it can join a race's average but can never be the only poll in it. A pollster's measured lean is how far its numbers have run from other pollsters in the same races at the same time this year ("runs R+2.0" means about 2 points more Republican than everyone else). Every poll is corrected for its pollster's lean before averaging, in both directions. Pollsters with only a poll or two get a smaller correction, since one poll can differ by luck, and a poll paid for by a campaign, party or PAC starts out assumed to lean 2 points toward its sponsor. A label like "R-leaning reputation" describes a firm's track record in past cycles; the measured lean is what its polls are doing this year. Ratings and leans are separate from the state adjustments on the How it works page, which correct for a state's history of polling misses.
        </p>
      </div>
    </div>
  );
}

// ── HOW IT WORKS ────────────────────────────────────────────────────────────
function MethodView({ wide }) {
  const sub = { fontFamily: serif, fontSize: wide ? 18 : 17, lineHeight: 1.6, color: C.body, margin: 0 };
  const item = { fontSize: 15, lineHeight: 1.55, color: C.body, margin: 0 };
  const steps = [
    ["Start from the polls", <>
      <p style={sub}>Each race begins at its polling average. Every poll is weighted two ways: by how much we trust the pollster (see Pollster ratings) and by how recent it is, with a poll's weight halving every three weeks.</p>
      <p style={sub}>Each poll is also corrected for its pollster's measured lean, or "house effect": how far that pollster's numbers have run from other pollsters in the same races at the same time this year. A pollster with only a poll or two gets a smaller correction, since one poll can differ by luck, and a poll paid for by a campaign, party or PAC starts out assumed to lean 2 points toward its sponsor. This is the approach major polling averages such as Silver Bulletin's use, and it works in both directions. The Pollster ratings page lists every pollster's lean.</p>
    </>],
    ["Adjust for history", <>
      <p style={sub}>Polls in several of these states underestimated Republicans in recent elections, mostly in presidential years. Misses like that don't reliably repeat (midterm polls have been far closer), so each race's starting point shifts toward the Republican by half of what it did before October. Maine's shift is about Susan Collins herself, whose record of beating her polls is the best documented on the board, so it stays at full size:</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        {[["Maine", `${SEN_HOUSE} pts toward Collins`, "Collins has repeatedly outrun her polls (she trailed in nearly every 2020 survey and won by about 9). Kept at full size."],
          ["North Carolina", `${NC_HOUSE} pts toward Whatley`, "NC polls have overstated Democrats in recent cycles, and undecided voters there tend to break Republican."],
          ["Texas", `${TX_HOUSE} pts toward Paxton`, "for Texas's strong Republican lean and its polls' history of underestimating Republicans."],
          ["Iowa", `${IA_HOUSE} pts toward Hinson`, "for Iowa's strong Republican lean and its polls' history of underestimating Republicans."],
          ["Ohio", `${OH_HOUSE} pts toward Husted`, "Ohio polls have underestimated Republicans in recent federal races."],
          ["Nebraska", `${NE_HOUSE} pts toward Ricketts`, "for the state's Republican lean and Osborn's 2024 pattern of polling close, then losing by about seven."],
          ["Georgia", `${GA_HOUSE} pt toward Collins`, "for Georgia's narrow Republican lean."],
          ["Michigan", `${MI_HOUSE} pt toward Rogers`, "Michigan polls underestimated Republicans in each of the last three presidential elections, but it is the closest state on this board."],
          ["New Hampshire", `${NH_HOUSE} pt toward Sununu`, "the smallest shift, for NH polls' history and Sununu's crossover appeal."],
          ["Alaska", `${AK_HOUSE} pts toward Sullivan`, "Sullivan won by about 13 in 2020 after polling much closer, and Peltola lost her 2024 House race by about 2 after polling close."]].map(([s, a, why]) => (
          <p key={s} style={item}><b style={{ color: C.text }}>{s}:</b> {a}. {why.charAt(0).toUpperCase() + why.slice(1)}</p>
        ))}
        <p style={item}>Maine's governor and House races get no adjustment. These shifts were halved on Oct. 4; before that, every state except Maine carried twice the shift shown here.</p>
      </div>
    </>],
    ["Map it county by county", <>
      <p style={sub}>Every race is built on real past results, county by county. The map sets which counties run bluer or redder than the state; how the state leans overall comes from the polls.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        <p style={item}><b style={{ color: C.text }}>Maine Senate:</b> the 2020 Collins–Gideon results (60%) blended with the 2020 and 2016 presidential maps (40%).</p>
        <p style={item}><b style={{ color: C.text }}>Maine House 1 and 2:</b> the 2020 House results by county. District 2 is an open seat, so only a quarter of Jared Golden's personal-vote pattern is kept.</p>
        <p style={item}><b style={{ color: C.text }}>Maine Governor:</b> the blended presidential map for shape, with the three-way split (Pingree, Charles, Bennett) set by polling.</p>
        <p style={item}><b style={{ color: C.text }}>Alaska:</b> a single statewide forecast from polling. Alaska reports by state house district, not county, and counts its ranked-choice rounds about two weeks after election night, so its needle never goes live; it still counts toward Senate control.</p>
        <p style={item}><b style={{ color: C.text }}>North Carolina, Ohio, Texas, Iowa, Georgia, Nebraska, Michigan and New Hampshire:</b> 2024 presidential results in every county. Ohio's race is a special election; Georgia goes to a Dec. 1 runoff if no one tops 50%; Nebraska's Dan Osborn is an independent, shown in green.</p>
      </div>
    </>],
    ["Watch the real count", <p key="w" style={sub}>On election night, official results files from each state arrive every minute or two. The needle compares each county's count with its expected result and carries the difference into the counties still counting. Expected turnout is scaled for a midterm, and if one state's feed goes down, only that state pauses.</p>],
    ["Call it carefully", <p key="c" style={sub}>A race is called only when the leader passes a 97 percent chance and at least half the expected vote is counted. Before that, the strongest label is Likely, however lopsided the early count looks.</p>],
  ];
  const note = (title, text) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ margin: 0, fontFamily: serif, fontSize: 22, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: C.body }}>{text}</p>
    </div>
  );
  return (
    <section style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,2fr) minmax(0,1fr)" : "minmax(0,1fr)", columnGap: 48, rowGap: 30 }}>
      <div>
        <h1 style={{ margin: "0 0 12px", fontFamily: serif, fontWeight: 600, fontSize: wide ? 46 : 32, letterSpacing: -0.8 }}>How the needle works</h1>
        <p style={{ ...deckStyle(wide), paddingBottom: 18, borderBottom: `2px solid ${C.text}` }}>Before election night, the needle is a polling forecast. Once votes are counted, it runs on the official results each state publishes.</p>
        {steps.map(([title, content], i) => (
          <div key={title} style={{ display: "grid", gridTemplateColumns: wide ? "70px minmax(0,1fr)" : "44px minmax(0,1fr)", columnGap: wide ? 24 : 14, padding: "20px 0", borderBottom: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: serif, fontSize: wide ? 44 : 32, fontWeight: 600, lineHeight: 1, color: C.muted }}>{i + 1}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 style={{ margin: 0, fontFamily: serif, fontSize: wide ? 26 : 22, fontWeight: 600 }}>{title}</h2>
              {content}
            </div>
          </div>
        ))}
        <p style={{ margin: 0, paddingTop: 16, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>This is an independent project, not a forecast from a news outlet. Probabilities express uncertainty; they are not guarantees.</p>
      </div>
      <aside style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ padding: 18, background: C.panel2, border: `1px solid ${C.line}` }}>
          {note("Maine and New Hampshire", "These states don't publish results on election night. Their needles will pause and finish on their own when the states post official results; in the meantime each paused race links to the AP's live count.")}
        </div>
        {note("Ranked-choice races", "Maine's Senate and House races and Alaska's Senate race use ranked-choice voting. The needle tracks first choices. Alaska's ranked rounds are counted about two weeks later, so its needle is a polling forecast that doesn't move on election night.")}
        {note("Where the data comes from", "Polls from public releases, and results from the official files each state's election office publishes. No paid data and no copying from news sites.")}
      </aside>
    </section>
  );
}


function Detail({ race, onBack, govB, govMargin, onGov, current, briefing, wide, onNav, night }) {
  if (race.type === "three") return <GovDetail race={race} onBack={onBack} govB={govB} govMargin={govMargin} onGov={onGov} current={current} night={night} />;
  if (race.type === "rcv" || race.id === "ak_sen") return <AlaskaDetail race={race} onBack={onBack} current={current} wide={wide} onNav={onNav} />;
  if (race.type === "tbd") return race.id === "sen" ? <MaineSenateTbdDetail race={race} onBack={onBack} /> : <MichiganDetail race={race} onBack={onBack} />;
  return <RacePage race={race} onBack={onBack} current={current} briefing={briefing} wide={wide} onNav={onNav} night={night} />;
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || C.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

const card = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 3, padding: "14px 16px", marginBottom: 12 };
const h2 = { fontSize: 13, fontFamily: mono, letterSpacing: 1.2, color: C.brass, textTransform: "uppercase", marginBottom: 8 };
const body = { fontSize: 13, lineHeight: 1.6, color: C.body };

// ---- Pollster ratings page: built from the live polling data, so it never goes stale ----
const TIERS = [
  { name: "Diamond", min: 0.9, range: "0.90 and up", color: "#0E6E8C", mark: "◆",
    desc: "The best in the business. Nonpartisan, transparent, strong methods, and long records of accuracy. These move the needle most." },
  { name: "Gold", min: 0.85, range: "0.85", color: "#8A6116", mark: "★",
    desc: "Strong nonpartisan pollsters just below the very top: excellent methods, slightly shorter or noisier records." },
  { name: "Silver", min: 0.75, range: "0.75 to 0.80", color: "#5B6472", mark: "◈",
    desc: "Solid university and established media pollsters. Reliable, with more variance or thinner records than the tiers above." },
  { name: "Bronze", min: 0.6, range: "0.60 to 0.70", color: "#8C4F22", mark: "▲",
    desc: "Lightly proven pollsters, several with a known partisan lean. Their numbers count, but at a discount." },
  { name: "Iron", min: 0, range: "below 0.60", color: "#4A4F57", mark: "■",
    desc: "Partisan, campaign-paid, or unproven. These barely move the needle, and a campaign or party poll can join a race's average but can never be the only poll in it." },
];
// Same pollster, different spellings in the data: fold them into one entry.
const POLLSTER_ALIASES = {
  "NYT/PPH/Siena": "NYT/Siena",
  "Fox News (Beacon/Shaw)": "Fox News",
  "AARP (Impact/Fabrizio)": "AARP (Fabrizio/Impact)",
  "UT Politics Project": "UT/Texas Politics Project",
  "Emerson College/Nexstar": "Emerson College",
};
const POLLSTER_NOTES = {
  "Fox News": "Beacon (D) and Shaw (R) pair",
  "AARP (Fabrizio/Impact)": "Fabrizio (R) and Impact (D) pair",
  "Trafalgar Group": "R-leaning reputation",
  "Quantus Insights": "R-leaning reputation",
  "InsiderAdvantage": "R-leaning reputation",
  "co/efficient": "R-leaning reputation",
  "Rasmussen Reports": "R-leaning reputation",
  "Abacus Data": "lightly proven",
  "Wedgewood Polls": "lightly proven",
};
const GROUP_STATE = { senate: "ME", governor: "ME", cd1: "ME", cd2: "ME" };
function buildRatings(current) {
  const map = new Map();
  if (!current) return [];
  for (const [g, v] of Object.entries(current)) {
    if (!v || !Array.isArray(v.polls)) continue;
    const st = GROUP_STATE[g] || g.split("_")[0].toUpperCase();
    for (const p of v.polls) {
      const name = POLLSTER_ALIASES[p.pollster] || p.pollster;
      const cur = map.get(name) || { name, rating: 0, n: 0, states: new Set() };
      cur.rating = Math.max(cur.rating, p.rating || 0);
      cur.n += 1;
      cur.states.add(st);
      map.set(name, cur);
    }
  }
  const he = (current && current.houseEffects) || {};
  for (const v of map.values()) v.lean = he[v.name] ? he[v.name].lean : null;
  return [...map.values()].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}
// A pollster's measured lean, in plain words. Positive = more Democratic than other pollsters.
const leanText = (lean) => lean == null ? null : Math.abs(lean) < 0.5 ? "no measurable lean" : `runs ${lean > 0 ? "D" : "R"}+${Math.abs(lean).toFixed(1)}`;
const leanColor = (lean) => lean == null || Math.abs(lean) < 0.5 ? C.muted : lean > 0 ? BLUE : RED;
