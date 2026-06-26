import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, RotateCcw, ChevronLeft } from "lucide-react";

const C = {
  ink: "#0E1422", panel: "#161E2E", panel2: "#1B2435", line: "#28344A",
  text: "#E6ECF5", muted: "#8A97AD", brass: "#F4C95D",
};
const BLUE = "#4F9DF7", RED = "#F2585B", TEAL = "#46B39D", AMBER = "#E0894B";

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
// pollMargin = Platner two-party lead in points (D+). center share = 0.5 + margin/200.
// SEN_HOUSE shifts the center toward Collins: she has consistently outrun her polling
// (she trailed in nearly every 2020 public poll and won by about 9 points), so a raw
// poll average structurally overstates the Democrat in Maine. This keeps a tossup a tossup.
const SEN_HOUSE = 4;
const senateUnits = (pollMargin) =>
  Object.keys(SEN_LEAN).map((n) =>
    unit(n, clamp(0.5 + (pollMargin - SEN_HOUSE) / 200 + SEN_LEAN[n], 0.02, 0.98), SEN_W[n]));
const makeSenate = (pollMargin) => ({
  id: "sen", state: "ME", title: "U.S. Senate",
  sub: "Platner (D) vs Collins (R)",
  system: "Ranked-Choice Voting", real: true,
  note: `Centered on polls, then shifted ${SEN_HOUSE} pts toward Collins, who has consistently outrun her polls (she trailed in nearly every 2020 survey and won by ~9).`,
  left: { full: "Collins", short: "Collins", color: RED },
  right: { full: "Platner", short: "Platner", color: BLUE },
  units: senateUnits(pollMargin),
});

// ---- NORTH CAROLINA ----
// Cooper (D) vs Whatley (R) — open seat (Tillis retired), plurality, rated tossup/lean-D.
// County-level baseline is pending the real-data step (scripts/build-baseline-nc.mjs pulls
// NC's past results via dispatch). Until then NC runs on a single statewide unit centered on
// polling: a valid poll-driven needle now, and a statewide live needle on election night.
const NC_HOUSE = 4; // toward Whatley: NC leans Republican federally and undecideds have tended to break R
const makeNCSenate = (pollMargin) => ({
  id: "nc_sen", state: "NC", title: "U.S. Senate",
  sub: "Cooper (D) vs Whatley (R)",
  system: "Plurality", real: true,
  note: `Open seat (Tillis retired). Centered on polls, then shifted ${NC_HOUSE} pts toward Whatley for North Carolina's Republican lean. County-level baseline is being added; the needle is currently statewide.`,
  left: { full: "Whatley", short: "Whatley", color: RED },
  right: { full: "Cooper", short: "Cooper", color: BLUE },
  units: [unit("North Carolina", clamp(0.5 + (pollMargin - NC_HOUSE) / 200, 0.02, 0.98), 1)],
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
const IND = "#A98BE6"; // independent (Bennett)
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
  const se = 0.06 * Math.sqrt(1 - fracIn) + 0.005;
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
const OTHER_RACES = [
  {
    id: "q1", state: "ME", title: "Question 1",
    sub: "Do you want to change civil rights and education laws to require public schools to restrict access to bathrooms and sports based on the gender on the child's original birth certificate and allow students to sue the schools?",
    system: "Majority",
    left: { full: "No", short: "No", color: AMBER }, right: { full: "Yes", short: "Yes", color: TEAL },
    units: ballotUnits(0.49, -0.5),
  },
];

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
  const se = 0.095 * Math.sqrt(1 - fracIn) + 0.004;
  return { fracIn, swing, margin, se, winRight: ncdf(margin / se) };
}
function rateOf(race, m) {
  const p = m.margin >= 0 ? m.winRight : 1 - m.winRight;
  const leader = m.margin >= 0 ? race.right : race.left;
  const pct = Math.round(p * 100);
  const tag = pct >= 97 ? "Called" : pct >= 85 ? "Likely" : pct >= 65 ? "Leans" : "Toss-up";
  return { pct, leader, text: tag === "Toss-up" ? "Toss-up" : `${tag} ${leader.short}` };
}

// ---- live results: map real county returns onto race units, replacing the simulation ----
// ballot questions: dem = Yes, rep = No. reported fraction = counted votes / expected turnout.
function liveTwoWay(units, counties) {
  return units.map((u) => {
    const c = counties[u.name];
    const counted = c ? (c.dem || 0) + (c.rep || 0) : 0;
    if (counted <= 0) return { ...u, reported: 0 };
    return { ...u, reported: clamp(counted / u.weight, 0, 1), finalShare: c.dem / counted };
  });
}
function liveThree(units, counties) {
  return units.map((u) => {
    const c = counties[u.name];
    const counted = c ? (c.dem || 0) + (c.rep || 0) + (c.ind || 0) : 0;
    if (counted <= 0) return { ...u, reported: 0, fP: u.pP, fC: u.pC, fB: u.pB };
    return { ...u, reported: clamp(counted / u.weight, 0, 1), fP: c.dem / counted, fC: c.rep / counted, fB: (c.ind || 0) / counted };
  });
}
function applyLive(race, rdata) {
  if (!rdata || !rdata.counties) return { ...race, liveOn: false };
  const hasData = Object.values(rdata.counties).some((c) => ((c.dem || 0) + (c.rep || 0) + (c.ind || 0)) > 0);
  if (!hasData) return { ...race, liveOn: false };
  const units = race.type === "three" ? liveThree(race.units, rdata.counties) : liveTwoWay(race.units, rdata.counties);
  if (!units.some((u) => u.reported > 0)) return { ...race, liveOn: false };
  return { ...race, units, liveOn: true };
}
function applyAllLive(races, results) {
  if (!results || !results.races) return races;
  return races.map((r) => results.races[r.id] ? applyLive(r, results.races[r.id]) : r);
}

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const sans = "Inter, ui-sans-serif, system-ui, sans-serif";
const RBTN = { marginTop: 8, width: "100%", background: "transparent", color: "#9FB3CE", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 0", fontSize: 11.5, fontFamily: mono, cursor: "pointer" };
const STATES = [{ code: "ME", label: "Maine" }, { code: "NC", label: "North Carolina" }];

export default function MaineDashboard() {
  const DEFAULT_MARGIN = 3; // Platner D+3 two-party, a mid estimate of current polls
  const DEFAULT_NC_MARGIN = 9; // Cooper D+9, mid of recent NC polls
  const [pollMargin, setPollMargin] = useState(DEFAULT_MARGIN);
  const [ncMargin, setNcMargin] = useState(DEFAULT_NC_MARGIN);
  const [cd2Decay, setCd2Decay] = useState(DEFAULT_DECAY);
  const [govB, setGovB] = useState(DEFAULT_B);
  const [govMargin, setGovMargin] = useState(DEFAULT_GM);
  const buildAll = (pm, gb, gm, dc, cd1m = null, cd2m = null, ncm = DEFAULT_NC_MARGIN) => [
    rollRace(makeSenate(pm)),
    rollGov(makeGov(gb, gm)),
    rollRace(makeCD1(cd1m)),
    rollRace(makeCD2(dc, cd2m)),
    rollRace(makeNCSenate(ncm)),
    ...OTHER_RACES.map((r) => rollRace(r)),
  ];
  const [races, setRaces] = useState(() => buildAll(DEFAULT_MARGIN, DEFAULT_B, DEFAULT_GM, DEFAULT_DECAY));
  const [sel, setSel] = useState(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [current, setCurrent] = useState(null);   // current polling outlook from public/current.json
  const [view, setView] = useState("dashboard");   // dashboard | <state code> | polls | method
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
          if (r.liveOn) return r; // live races are driven by real returns, not the sim
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
        if (c?.governor) { setGovB(c.governor.bennett ?? DEFAULT_B); setGovMargin(c.governor.margin ?? DEFAULT_GM); }
        setRaces(applyAllLive(buildAll(c?.senate?.margin ?? DEFAULT_MARGIN, c?.governor?.bennett ?? DEFAULT_B, c?.governor?.margin ?? DEFAULT_GM, DEFAULT_DECAY, c?.cd1?.margin ?? null, c?.cd2?.margin ?? null, c?.nc_sen?.margin ?? DEFAULT_NC_MARGIN), resultsRef.current));
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

  const reset = () => { setRunning(false); setRaces(applyAllLive(buildAll(pollMargin, govB, govMargin, cd2Decay, current?.cd1?.margin ?? null, current?.cd2?.margin ?? null, ncMargin), resultsRef.current)); };
  const setPoll = (v) => { setPollMargin(v); setRaces((prev) => prev.map((r) => r.id === "sen" ? rollRace(makeSenate(v)) : r)); };
  const setDecay = (v) => { setCd2Decay(v); setRaces((prev) => prev.map((r) => r.id === "cd2" ? rollRace(makeCD2(v, current?.cd2?.margin ?? null)) : r)); };
  const setGov = (b, m) => { setGovB(b); setGovMargin(m); setRaces((prev) => prev.map((r) => r.id === "gov" ? rollGov(makeGov(b, m)) : r)); };
  const step = () => setRaces((prev) => prev.map((r) => r.liveOn ? r : ({
    ...r,
    units: r.units.map((u) => u.reported >= 1 ? u : (Math.random() < u.speed ? { ...u, reported: clamp(u.reported + 0.1 + Math.random() * 0.18, 0, 1) } : u)),
  })));

  const anyLive = races.some((r) => r.liveOn);
  return (
    <div style={{ background: C.ink, color: C.text, fontFamily: sans, minHeight: "100vh", padding: 16 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>The Needle Project</div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>
            An independent, live-updating tracker for the 2026 elections. Each state's key races, centered on polling now and running on real returns on election night.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: 1.4, color: anyLive ? RED : C.muted, fontFamily: mono, textTransform: "uppercase", marginBottom: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 9, background: anyLive ? RED : C.muted, boxShadow: anyLive ? `0 0 8px ${RED}` : "none" }} />
          {anyLive ? "Live — real returns coming in" : "Simulation — not election night yet"}
        </div>

        {sel !== null ? (
          <Detail race={races.find((r) => r.id === sel)} onBack={() => setSel(null)}
            pollMargin={pollMargin} onPoll={setPoll}
            cd2Decay={cd2Decay} onDecay={setDecay}
            govB={govB} govMargin={govMargin} onGov={setGov} current={current} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
              {[["dashboard", "Dashboard"], ...STATES.map((s) => [s.code, s.label]), ["polls", "Polls"], ["method", "Method"]].map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                  style={{ flexShrink: 0, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, fontFamily: mono, borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
                    background: view === k ? C.panel2 : "transparent", color: view === k ? C.text : C.muted, border: `1px solid ${view === k ? C.brass : C.line}` }}>
                  {label}
                </button>
              ))}
            </div>

            {view === "dashboard" && (
              <div>
                <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>ALL RACES · NOVEMBER 2026</div>
                <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: -0.4, marginBottom: 14 }}>Election Night Board</div>
                {STATES.map((st) => {
                  const sr = races.filter((r) => r.state === st.code);
                  if (!sr.length) return null;
                  return (
                    <div key={st.code} style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: 1.5, color: C.brass, textTransform: "uppercase", marginBottom: 8 }}>{st.label}</div>
                      <Overview races={sr} onPick={setSel} />
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, fontFamily: mono }}>Tap any race to open its needle.</div>
              </div>
            )}
            {STATES.some((s) => s.code === view) && (
              <div>
                <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>{STATES.find((s) => s.code === view).label.toUpperCase()} · NOVEMBER 2026</div>
                <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: -0.4, marginBottom: 14 }}>{STATES.find((s) => s.code === view).label}</div>
                <Overview races={races.filter((r) => r.state === view)} onPick={setSel} />
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 12, fontFamily: mono }}>Tap any race to open its needle and county board.</div>
              </div>
            )}
            {view === "polls" && <PollsView current={current} loaded={currentLoaded} />}
            {view === "method" && <MethodView />}

            {(view === "dashboard" || STATES.some((s) => s.code === view)) && (
              <>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={() => setRunning((r) => !r)}
                    style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: running ? C.panel2 : BLUE, color: running ? C.text : "#06101F", border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    {running ? <Pause size={16} /> : <Play size={16} />}{running ? "Pause" : "Run election night"}
                  </button>
                  <button onClick={step} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    <SkipForward size={15} /> Step
                  </button>
                  <button onClick={reset} style={{ width: 46, display: "flex", alignItems: "center", justifyContent: "center", background: C.panel2, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 10, cursor: "pointer" }}>
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
          </>
        )}
      </div>
    </div>
  );
}

function TiltBar({ race }) {
  const m = compute(race.units);
  const rt = rateOf(race, m);
  const x = clamp(m.winRight, 0.02, 0.98) * 100;
  return (
    <div>
      <div style={{ position: "relative", height: 8, background: C.panel2, borderRadius: 5, overflow: "hidden", marginBottom: 7 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: `${race.left.color}22` }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", background: `${race.right.color}22` }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.line }} />
        <div style={{ position: "absolute", top: -2, left: `calc(${x}% - 3px)`, width: 6, height: 12, borderRadius: 3, background: rt.leader.color, boxShadow: `0 0 8px ${rt.leader.color}`, transition: "left .6s ease-out" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mono }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: rt.leader.color }}>{rt.text}</span>
        <span style={{ fontSize: 11, color: C.muted }}>{rt.leader.short} +{Math.abs(m.margin * 100).toFixed(1)} · {Math.round(m.fracIn * 100)}% in</span>
      </div>
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

function Overview({ races, onPick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {races.map((r) => (
        <button key={r.id} onClick={() => onPick(r.id)}
          style={{ textAlign: "left", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", color: C.text }}>
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
          {r.type === "three" ? <ThreeBar race={r} /> : <TiltBar race={r} />}
        </button>
      ))}
    </div>
  );
}

function GovDetail({ race, onBack, govB, govMargin, onGov, current }) {
  const m = compute3(race.units);
  const parts = race.cands.map((c) => ({ ...c, sh: m.proj[c.key], win: m.win[c.key] }));
  const byShare = [...parts].sort((a, b) => b.sh - a.sh);
  const leader = [...parts].sort((a, b) => b.win - a.win)[0];
  const lpct = Math.round(leader.win * 100);
  const tag = lpct >= 90 ? "Likely" : lpct >= 60 ? "Leans" : "Toss-up";
  const sorted = [...race.units].sort((a, b) => b.weight - a.weight);
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 10, fontFamily: mono }}>
        <ChevronLeft size={16} /> All races
      </button>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>MAINE · PLURALITY (3-WAY)</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{race.title}</div>
        {race.liveOn && <span style={{ fontSize: 10, fontFamily: mono, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4, color: "#fff", background: RED, fontWeight: 700 }}>● LIVE</span>}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{race.sub}</div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>Polling dial</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontFamily: mono, marginBottom: 2 }}>
          <span style={{ color: IND }}>Bennett (I)</span><span style={{ color: IND, fontWeight: 700 }}>{govB}%</span>
        </div>
        <input type="range" min="0" max="35" step="1" value={govB} onChange={(e) => onGov(parseInt(e.target.value), govMargin)} style={{ width: "100%", accentColor: IND }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontFamily: mono, margin: "8px 0 2px" }}>
          <span style={{ color: C.muted }}>Pingree vs Charles</span>
          <span style={{ fontWeight: 700, color: govMargin >= 0 ? BLUE : RED }}>{govMargin >= 0 ? "Pingree" : "Charles"} +{Math.abs(govMargin)}</span>
        </div>
        <input type="range" min="-10" max="14" step="1" value={govMargin} onChange={(e) => onGov(govB, parseInt(e.target.value))} style={{ width: "100%", accentColor: C.brass }} />
        <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5, marginTop: 6, fontFamily: mono }}>
          Bennett has no past election to map, so this race leans on polling for its starting point. Drag to explore scenarios.
        </div>
        {current && (
          <button onClick={() => onGov(current.governor.bennett, current.governor.margin)} style={RBTN}>
            ↻ Restore to current outlook (Bennett {current.governor.bennett}%, {current.governor.margin >= 0 ? "Pingree" : "Charles"} +{Math.abs(current.governor.margin)})
          </button>
        )}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "16px 14px" }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, fontFamily: mono, textTransform: "uppercase", textAlign: "center" }}>
          {tag === "Toss-up" ? "Toss-up" : `${tag} ${leader.short}`}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: leader.color, textAlign: "center", lineHeight: 1.2, marginBottom: 14 }}>
          {leader.short} {lpct}%
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}> to win</span>
        </div>
        {byShare.map((p) => (
          <div key={p.key} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, fontFamily: mono }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 8, background: p.color, marginRight: 6 }} />{p.full}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>
                <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{(p.sh * 100).toFixed(1)}%</span> · win {Math.round(p.win * 100)}%
              </span>
            </div>
            <div style={{ height: 8, background: C.panel2, borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${p.sh * 100}%`, height: "100%", background: p.color, transition: "width .6s ease-out" }} />
            </div>
          </div>
        ))}
        <div style={{ textAlign: "center", fontFamily: mono, fontSize: 11, color: C.muted, marginTop: 4 }}>{Math.round(m.fracIn * 100)}% of expected vote in</div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.brass}`, borderRadius: 8, padding: "10px 12px", marginTop: 12, fontSize: 13, lineHeight: 1.5, color: "#C7D2E3" }}>
        {m.fracIn === 0
          ? "No votes counted. A plurality race with a strong independent: whoever leads can win with well under half the vote, so watch the gap between the top two, not the 50% line."
          : `${leader.short} leads with ${(leader.sh * 100).toFixed(1)}% projected. In a three-way, the winner needs only a plurality, so margins between the top two matter more than any majority.`}
      </div>

      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.5, color: C.muted, margin: "16px 4px 8px", textTransform: "uppercase" }}>County board</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sorted.map((u) => {
          const reported = u.reported > 0;
          let topShort = "—", topColor = C.muted, topSh = 0;
          if (reported) {
            const arr = [["fP", "P"], ["fC", "C"], ["fB", "B"]].map(([fk, key]) => ({ key, v: u[fk] }));
            const t = arr.sort((a, b) => b.v - a.v)[0];
            const cand = race.cands.find((c) => c.key === t.key);
            topShort = cand.short; topColor = cand.color; topSh = t.v;
          }
          return (
            <div key={u.name} style={{ display: "grid", gridTemplateColumns: "92px 1fr 70px", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
              <div>
                <div style={{ height: 5, background: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${u.reported * 100}%`, height: "100%", background: u.reported >= 1 ? C.brass : "#4A6FA6", transition: "width .6s ease-out" }} />
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, marginTop: 3 }}>{Math.round(u.reported * 100)}% in</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: mono, fontWeight: 700, fontSize: 12.5, color: topColor }}>
                {reported ? `${topShort} ${Math.round(topSh * 100)}` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Detail({ race, onBack, pollMargin, onPoll, cd2Decay, onDecay, govB, govMargin, onGov, current }) {
  if (race.type === "three") return <GovDetail race={race} onBack={onBack} govB={govB} govMargin={govMargin} onGov={onGov} current={current} />;
  const m = compute(race.units);
  const rt = rateOf(race, m);
  const lead = m.margin >= 0 ? race.right : race.left;

  // gauge geometry
  const cx = 160, cy = 162, rOut = 132, rIn = 112, N = 50;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (c1, c2, t) => { const a = hx(c1), b = hx(c2); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; };
  const tcol = (f) => f < 0.5 ? mix(race.left.color, "#3A4A66", f / 0.5) : mix("#3A4A66", race.right.color, (f - 0.5) / 0.5);
  const pt = (r, deg) => { const a = (deg * Math.PI) / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const ticks = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, ang = 180 * (1 - f), major = Math.abs((f * 4) % 1) < 0.001;
    const [x1, y1] = pt(major ? rIn - 8 : rIn, ang), [x2, y2] = pt(rOut, ang);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tcol(f)} strokeWidth={major ? 3 : 2.2} strokeLinecap="round" opacity={major ? 1 : 0.85} />);
  }
  const needleDeg = (m.winRight - 0.5) * 180; // -90 (R) .. +90 (D), 0 = straight up

  const swingPts = m.swing * 100;
  const caption = m.fracIn === 0
    ? "No votes counted yet. The needle sits at the historical baseline."
    : Math.abs(swingPts) < 0.6
      ? "Reporting areas are tracking close to baseline; the projection is holding."
      : `Reporting areas are running about ${Math.abs(swingPts).toFixed(1)} pts toward ${swingPts > 0 ? race.right.short : race.left.short} vs baseline. That swing is carried into areas still counting.`;

  const sorted = [...race.units].sort((a, b) => b.weight - a.weight);

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 10, fontFamily: mono }}>
        <ChevronLeft size={16} /> All races
      </button>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>{(STATES.find((s) => s.code === race.state)?.label || "").toUpperCase()} · {race.system}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{race.title}</div>
        {race.liveOn && <span style={{ fontSize: 10, fontFamily: mono, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 4, color: "#fff", background: RED, fontWeight: 700 }}>● LIVE</span>}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: race.note ? 6 : 12 }}>{race.sub}</div>
      {race.note && <div style={{ fontSize: 11, color: "#9FB3CE", lineHeight: 1.5, marginBottom: 12, padding: "8px 10px", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8 }}>{race.note}</div>}

      {race.id === "sen" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: mono, letterSpacing: 1, color: C.muted, textTransform: "uppercase" }}>Polling dial</span>
            <span style={{ fontSize: 13, fontFamily: mono, fontWeight: 700, color: pollMargin >= 0 ? BLUE : RED }}>
              {pollMargin >= 0 ? "Platner" : "Collins"} +{Math.abs(pollMargin)}
            </span>
          </div>
          <input type="range" min="-6" max="12" step="1" value={pollMargin} onChange={(e) => onPoll(parseInt(e.target.value))} style={{ width: "100%", accentColor: C.brass }} />
          <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5, marginTop: 6, fontFamily: mono }}>
            Sets the statewide center. Each county starts at this margin plus its real historical lean. Recent polls run about Platner +2 to +3.
          </div>
          {current && (
            <button onClick={() => onPoll(current.senate.margin)} style={RBTN}>
              ↻ Restore to current polling ({current.senate.margin >= 0 ? "Platner" : "Collins"} +{Math.abs(current.senate.margin)})
            </button>
          )}
        </div>
      )}

      {race.id === "cd2" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: mono, letterSpacing: 1, color: C.muted, textTransform: "uppercase" }}>Golden personal-vote dial</span>
            <span style={{ fontSize: 13, fontFamily: mono, fontWeight: 700, color: C.brass }}>{Math.round(cd2Decay * 100)}% kept</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" value={cd2Decay} onChange={(e) => onDecay(parseFloat(e.target.value))} style={{ width: "100%", accentColor: C.brass }} />
          <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5, marginTop: 6, fontFamily: mono }}>
            100% = Golden's full 2020 map (D+5.8). 0% = the district's generic-D fundamentals (R+8.4). Open seat, so default is low.
          </div>
          <button onClick={() => onDecay(DEFAULT_DECAY)} style={RBTN}>
            ↻ Restore to default ({Math.round(DEFAULT_DECAY * 100)}% kept)
          </button>
        </div>
      )}

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "18px 14px 14px" }}>
        <svg viewBox="0 0 320 188" style={{ width: "100%", display: "block" }}>
          {ticks}
          <text x="14" y="180" fill={race.left.color} fontFamily={mono} fontSize="12" fontWeight="700">{race.left.short}</text>
          <text x="306" y="180" fill={race.right.color} fontFamily={mono} fontSize="12" fontWeight="700" textAnchor="end">{race.right.short}</text>
          <g style={{ transform: `rotate(${needleDeg}deg)`, transformBox: "view-box", transformOrigin: `${cx}px ${cy}px`, transition: "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)" }}>
            <line x1={cx} y1={cy} x2={cx} y2={cy - (rIn - 14)} stroke={C.text} strokeWidth="3.5" strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={cx} y2={cy + 22} stroke={C.text} strokeWidth="3.5" strokeLinecap="round" />
          </g>
          <circle cx={cx} cy={cy} r="11" fill={C.panel2} stroke={C.brass} strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="3.5" fill={C.brass} />
        </svg>
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.5, color: C.muted, fontFamily: mono, textTransform: "uppercase" }}>{rt.text}</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: lead.color, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginTop: 2 }}>{rt.pct}%</div>
          <div style={{ fontSize: 13, color: C.muted }}>chance {lead.full} {race.id === "q1" ? "passes" : "wins"}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 12, fontFamily: mono }}>
            <Stat label="PROJECTED" value={`${lead.short} +${Math.abs(m.margin * 100).toFixed(1)}`} color={lead.color} />
            <div style={{ width: 1, background: C.line }} />
            <Stat label="EST. VOTE IN" value={`${Math.round(m.fracIn * 100)}%`} />
          </div>
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.brass}`, borderRadius: 8, padding: "10px 12px", marginTop: 12, fontSize: 13, lineHeight: 1.5, color: "#C7D2E3" }}>{caption}</div>

      <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.5, color: C.muted, margin: "16px 4px 8px", textTransform: "uppercase" }}>County board</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {sorted.map((u) => {
          const lean = Math.round((u.prior - 0.5) * 200);
          const cur = u.reported > 0 ? Math.round((u.finalShare - 0.5) * 200) : null;
          const curC = cur == null ? C.muted : cur >= 0 ? race.right.color : race.left.color;
          const sideR = cur >= 0 ? race.right.short : race.left.short;
          const baseSide = lean >= 0 ? race.right.short : race.left.short;
          return (
            <div key={u.name} style={{ display: "grid", gridTemplateColumns: "92px 1fr 64px", alignItems: "center", gap: 8, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
              <div>
                <div style={{ height: 5, background: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${u.reported * 100}%`, height: "100%", background: u.reported >= 1 ? C.brass : "#4A6FA6", transition: "width .6s ease-out" }} />
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, marginTop: 3 }}>base {baseSide}+{Math.abs(lean)} · {Math.round(u.reported * 100)}% in</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: mono, fontWeight: 700, fontSize: 13, color: curC, fontVariantNumeric: "tabular-nums" }}>
                {cur == null ? "—" : `${sideR}+${Math.abs(cur)}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || C.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

const card = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 };
const h2 = { fontSize: 13, fontFamily: mono, letterSpacing: 1.2, color: C.brass, textTransform: "uppercase", marginBottom: 8 };
const body = { fontSize: 13, lineHeight: 1.6, color: "#C7D2E3" };

function PollsView({ current, loaded }) {
  const hasData = current && current.senate;
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>HOW WE READ THE POLLS</div>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: -0.4, marginBottom: 6 }}>Polling</div>
      <div style={{ ...body, marginBottom: 14 }}>
        The needle's starting point isn't any single poll. It's a weighted average: each poll counts more if it's recent and from a higher-quality pollster, and less if it's old or from a campaign's own (partisan) firm.
        {current?.method?.note ? ` ${current.method.note}` : ""}
      </div>

      {!loaded ? (
        <div style={{ ...card, ...body }}>Loading the latest polls…</div>
      ) : !hasData ? (
        <div style={{ ...card, ...body }}>
          Couldn't load the poll data. Make sure <span style={{ fontFamily: mono, color: C.brass }}>public/current.json</span> exists, then run <span style={{ fontFamily: mono, color: C.brass }}>npm run polls</span> and refresh.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: 1.5, color: C.brass, textTransform: "uppercase", margin: "2px 0 8px" }}>Maine</div>
          <PollRace title="U.S. Senate" lead={current.senate} demName="Platner" repName="Collins" />
          <PollRace title="Governor" lead={current.governor} demName="Pingree" repName="Charles" indName="Bennett" />
          <PollRace title="U.S. House · District 1" lead={current.cd1} demName="Pingree" repName="Russell" />
          <PollRace title="U.S. House · District 2" lead={current.cd2} demName="Dunlap" repName="LePage" />
          <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: 1.5, color: C.brass, textTransform: "uppercase", margin: "14px 0 8px" }}>North Carolina</div>
          <PollRace title="U.S. Senate" lead={current.nc_sen} demName="Cooper" repName="Whatley" />
        </>
      )}
      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, lineHeight: 1.5, marginTop: 4 }}>
        Updated {current?.updated || "—"}. New polls are added to the feed and re-averaged automatically.
      </div>
    </div>
  );
}

function PollRace({ title, lead, demName, repName, indName }) {
  if (!lead) return null;
  const polls = Array.isArray(lead.polls) ? lead.polls : [];
  const margin = lead.margin ?? 0;
  const marginTxt = margin >= 0 ? `${demName} +${Math.abs(margin)}` : `${repName} +${Math.abs(margin)}`;
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        {polls.length > 0 && (
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: margin >= 0 ? BLUE : RED }}>
            avg: {marginTxt}{indName && lead.bennett != null ? `, ${indName} ${lead.bennett}%` : ""}
          </span>
        )}
      </div>
      {polls.length === 0 ? (
        <div style={{ ...body, fontSize: 12 }}>{lead.note || "No public polls yet."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {polls.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", fontFamily: mono, fontSize: 11.5 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.pollster}</span>
              <span style={{ color: C.muted }}>
                <span style={{ color: BLUE }}>{p.dem}</span>/<span style={{ color: RED }}>{p.rep}</span>{p.ind ? <span style={{ color: IND }}>/{p.ind}</span> : null} · {String(p.date).slice(5)}
              </span>
              <span style={{ color: C.brass, fontWeight: 700, minWidth: 34, textAlign: "right" }}>{p.weightPct}%</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: mono }}>pollster · D/R{indName ? "/I" : ""} · date · weight in average</div>
        </div>
      )}
    </div>
  );
}

function MethodView() {
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, fontFamily: mono }}>HOW THE NEEDLE WORKS</div>
      <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: -0.4, marginBottom: 12 }}>Methodology</div>

      <div style={card}>
        <div style={h2}>The needle</div>
        <div style={body}>Each county has an expected result. As real votes report, the model measures how far the counted counties are running from that expectation, then carries that swing into the counties still counting. The needle is the resulting win probability, and it eases as more vote lands.</div>
      </div>

      <div style={card}>
        <div style={h2}>Where the baselines come from</div>
        <div style={body}>
          Built from real past results (OpenElections public data).
          <div style={{ marginTop: 8 }}>
            <b style={{ color: C.brass }}>Maine — Senate</b> — a blend of the 2020 Collins–Gideon Senate map (60%) and the 2020 + 2016 presidential maps (40%), re-centered on current polling.<br />
            <b style={{ color: C.brass }}>Maine — House 1 &amp; 2</b> — the actual 2020 U.S. House results by county. District 2 also has a dial that fades the former incumbent's personal vote toward the district's fundamentals, since the seat is open.<br />
            <b style={{ color: C.brass }}>Maine — Governor</b> — the blended presidential map for shape, with a polling-set split. A three-way plurality race (Pingree, Charles, independent Bennett), so it shows three win-probability meters.<br />
            <b style={{ color: C.brass }}>Maine — Ballot question</b> — illustrative only; a brand-new question has no prior election to map.<br />
            <b style={{ color: C.brass }}>North Carolina — Senate</b> — Cooper vs Whatley, an open seat. Currently centered on polling at the statewide level; the county-by-county baseline (from NC's past results) is being added.
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={h2}>Polling &amp; adjustments</div>
        <div style={body}>
          Each race's center is a recency- and quality-weighted polling average (see the Polls tab). Two races then get a documented house-effect adjustment, because a raw poll average has a known directional bias in that state:
          <div style={{ marginTop: 8 }}>
            <b style={{ color: C.text }}>Maine Senate</b> — shifted toward Collins, who has repeatedly outrun her polls (she trailed in nearly every 2020 survey and won by about 9).<br />
            <b style={{ color: C.text }}>North Carolina Senate</b> — shifted toward Whatley for the state's Republican lean and the way undecideds have tended to break.
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={h2}>Election night</div>
        <div style={body}>On election night the needle runs on real returns parsed from the Maine Secretary of State, rolled up from town to county. Races showing real votes are marked LIVE.</div>
      </div>

      <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, lineHeight: 1.6 }}>
        This is an independent project, not a forecast from a news outlet. Probabilities express uncertainty; they are not guarantees.
      </div>
    </div>
  );
}
