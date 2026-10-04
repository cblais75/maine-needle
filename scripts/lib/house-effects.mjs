// house-effects.mjs — measure each pollster's lean ("house effect") from the data and
// correct for it before averaging. This follows the approach used by Silver Bulletin
// (and FiveThirtyEight before it):
//
//   1. For every poll, compare its margin with what OTHER pollsters found in the same
//      race around the same time (a quality- and time-weighted average that leaves the
//      pollster itself out, and leaves out campaign/party/PAC polls).
//   2. A pollster's raw lean is its average gap across all of its polls, in every race.
//   3. That lean is shrunk toward zero for pollsters with few polls (one or two polls can
//      differ by luck), so frequent pollsters get close to a full correction.
//   4. Polls paid for by a campaign, party or PAC start out assumed to lean 2 points
//      toward their sponsor, until their own track record says otherwise.
//   5. Repeat a few times, since correcting one pollster changes the yardstick for the
//      others, then center the leans so the overall level stays anchored to the
//      nonpartisan pollsters, weighted by quality.
//
// A lean is in margin points: positive = more Democratic (or more pro-Osborn in Nebraska)
// than other pollsters, negative = more Republican. Correcting a poll subtracts its
// pollster's lean from the margin, half from each side.

// Same pollster, different spellings in the data.
export const POLLSTER_ALIASES = {
  "NYT/PPH/Siena": "NYT/Siena",
  "Fox News (Beacon/Shaw)": "Fox News",
  "AARP (Impact/Fabrizio)": "AARP (Fabrizio/Impact)",
  "UT Politics Project": "UT/Texas Politics Project",
  "Emerson College/Nexstar": "Emerson College",
};
export const canon = (name) => POLLSTER_ALIASES[name] || name;

// Polls paid for by a campaign, party or PAC, and which side the sponsor is on.
// "D" means the side stored in the poll's "dem" field (Osborn in Nebraska).
const SPONSORED = {
  "Hart Research (Senate Majority PAC)": "D",
  "Change Research (Carolina Forward)": "D",
  "GBAO (Working Class Majority PAC)": "D",
  "Texas Public Opinion Research": "D",
  "Carolina Journal/Civitas (R)": "R",
  "Torchlight Strategies (Common Sense for America PAC)": "R",
};
export function sponsorOf(name) {
  if (SPONSORED[name]) return SPONSORED[name];
  if (/\((D|Dem)\)\s*$/i.test(name) || /\binternal\b.*\(D\)/i.test(name)) return "D";
  if (/\((R|Rep|GOP)\)\s*$/i.test(name)) return "R";
  return null;
}

export const HE = {
  HALF_LIFE_DAYS: 21,   // how fast nearby polls stop counting as the yardstick
  SHRINK: 3,            // pseudo-polls of "no lean": n polls get n/(n+3) of their raw lean
  SPONSOR_PRIOR: 2,     // points a sponsored poll is assumed to lean toward its sponsor
  MIN_BASE_WEIGHT: 0.3, // need at least this much comparison weight to measure a poll
  CAP: 6,               // no pollster is corrected by more than this
  ITER: 25,
};

const DAY = 86400000;
const marginOf = (p) => p.dem - p.rep;

// races: { raceKey: [poll, ...] }. Only two-way races should be passed in for measuring.
export function measureHouseEffects(races) {
  const polls = [];
  for (const [race, list] of Object.entries(races)) {
    for (const p of list) {
      const name = canon(p.pollster);
      polls.push({ race, name, sponsor: sponsorOf(p.pollster), t: new Date(p.date).getTime(), m: marginOf(p), rating: p.rating });
    }
  }
  const names = [...new Set(polls.map((p) => p.name))];
  let lean = Object.fromEntries(names.map((n) => [n, 0]));
  let detail = {};

  for (let it = 0; it < HE.ITER; it++) {
    const sums = Object.fromEntries(names.map((n) => [n, { dev: 0, n: 0 }]));
    for (const p of polls) {
      let W = 0, S = 0;
      for (const q of polls) {
        if (q.race !== p.race || q.name === p.name || q.sponsor) continue;
        const w = q.rating * Math.pow(0.5, Math.abs(q.t - p.t) / DAY / HE.HALF_LIFE_DAYS);
        W += w; S += w * (q.m - lean[q.name]);
      }
      if (W < HE.MIN_BASE_WEIGHT) continue;
      sums[p.name].dev += p.m - S / W;
      sums[p.name].n += 1;
    }
    const next = {};
    detail = {};
    for (const n of names) {
      const sp = polls.find((p) => p.name === n).sponsor;
      const prior = sp === "D" ? HE.SPONSOR_PRIOR : sp === "R" ? -HE.SPONSOR_PRIOR : 0;
      const { dev, n: k } = sums[n];
      let v = (dev + HE.SHRINK * prior) / (k + HE.SHRINK);
      v = Math.max(-HE.CAP, Math.min(HE.CAP, v));
      next[n] = v;
      detail[n] = { raw: k ? dev / k : null, nMeasured: k, sponsor: sp };
    }
    // Anchor: nonpartisan pollsters' leans average to zero, weighted by rating x polls.
    let W = 0, S = 0;
    for (const p of polls) if (!p.sponsor) { W += p.rating; S += p.rating * next[p.name]; }
    const center = W ? S / W : 0;
    for (const n of names) next[n] = next[n] - center;
    const change = Math.max(...names.map((n) => Math.abs(next[n] - lean[n])));
    lean = next;
    if (change < 0.005) break;
  }
  const out = {};
  for (const n of names) {
    out[n] = {
      lean: Math.round(lean[n] * 10) / 10,
      exact: lean[n],
      polls: polls.filter((p) => p.name === n).length,
      measured: detail[n].nMeasured,
      raw: detail[n].raw == null ? null : Math.round(detail[n].raw * 10) / 10,
      sponsor: detail[n].sponsor,
    };
  }
  return out;
}

// Correct one poll for its pollster's lean (half from each side). Keeps the raw numbers.
export function adjustPoll(p, effects) {
  const e = effects[canon(p.pollster)];
  const h = e ? e.exact : 0;
  return { ...p, rawDem: p.dem, rawRep: p.rep, house: Math.round(h * 10) / 10, dem: p.dem - h / 2, rep: p.rep + h / 2 };
}
