// Reads data/polls.json, computes a recency- and quality-weighted average per race,
// and writes public/current.json. Also emits each poll with the weight it carried, so
// the app's Polls tab can show the methodology transparently.
// Run: node scripts/update-polls.mjs   (or: npm run polls)
import { readFileSync, writeFileSync } from "node:fs";

const HALF_LIFE_DAYS = 21;          // a poll's weight halves every 3 weeks
const today = new Date();
const polls = JSON.parse(readFileSync(new URL("../data/polls.json", import.meta.url)));
const ageDays = (d) => (today - new Date(d)) / 86400000;
const recency = (d) => Math.pow(0.5, ageDays(d) / HALF_LIFE_DAYS);

function summarize(list) {
  if (!list.length) return { margin: null, bennett: null, nPolls: 0, polls: [] };
  let W = 0, wDem = 0, wRep = 0, wInd = 0;
  const weighted = list.map((p) => {
    const w = p.rating * recency(p.date);
    W += w; wDem += w * p.dem; wRep += w * p.rep; wInd += w * (p.ind || 0);
    return { ...p, _w: w };
  });
  const dem = wDem / W, rep = wRep / W, ind = wInd / W;
  const detail = weighted
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((p) => ({
      pollster: p.pollster, date: p.date, rating: p.rating,
      dem: p.dem, rep: p.rep, ind: p.ind || null,
      weightPct: Math.round((p._w / W) * 100),
    }));
  return {
    margin: Math.round(dem - rep),
    bennett: Math.round(ind),
    nPolls: list.length,
    polls: detail,
  };
}

const sen = summarize(polls.senate || []);
const gov = summarize(polls.governor || []);
const cd1 = summarize(polls.cd1 || []);
const cd2 = summarize(polls.cd2 || []);
const nc = summarize(polls.nc_sen || []);
const oh = summarize(polls.oh_sen || []);
const tx = summarize(polls.tx_sen || []);
const current = {
  updated: today.toISOString().slice(0, 10),
  method: { halfLifeDays: HALF_LIFE_DAYS, note: "Weight = pollster quality rating × recency (halves every 3 weeks). Partisan firms are rated lower." },
  senate: { margin: sen.margin ?? 3, nPolls: sen.nPolls, fallback: sen.margin === null, polls: sen.polls },
  governor: {
    bennett: gov.bennett ?? 18, margin: gov.margin ?? 6, nPolls: gov.nPolls, fallback: gov.margin === null,
    note: gov.nPolls === 0 ? "No public three-way polls yet; using a placeholder until real surveys appear." : "",
    polls: gov.polls,
  },
  cd1: { margin: cd1.margin, nPolls: cd1.nPolls, fallback: cd1.margin === null,
    note: cd1.nPolls === 0 ? "No public District 1 polls yet; using the 2020 House baseline." : "", polls: cd1.polls },
  cd2: { margin: cd2.margin, nPolls: cd2.nPolls, fallback: cd2.margin === null,
    note: cd2.nPolls === 0 ? "No public District 2 polls yet; using the personal-vote-adjusted baseline." : "", polls: cd2.polls },
  nc_sen: { margin: nc.margin, nPolls: nc.nPolls, fallback: nc.margin === null,
    note: nc.nPolls === 0 ? "No public North Carolina Senate polls yet." : "", polls: nc.polls },
  oh_sen: { margin: oh.margin, nPolls: oh.nPolls, fallback: oh.margin === null,
    note: oh.nPolls === 0 ? "No public Ohio Senate polls yet." : "", polls: oh.polls },
  tx_sen: { margin: tx.margin, nPolls: tx.nPolls, fallback: tx.margin === null,
    note: tx.nPolls === 0 ? "No public Texas Senate polls yet." : "", polls: tx.polls },
};
writeFileSync(new URL("../public/current.json", import.meta.url), JSON.stringify(current, null, 2));
console.log(`Senate: ${current.senate.margin >= 0 ? "Platner +" : "Collins +"}${Math.abs(current.senate.margin)} from ${current.senate.nPolls} polls`);
console.log(`Governor: ${current.governor.nPolls} polls (${current.governor.fallback ? "placeholder" : "live"})`);
console.log(`CD1: ${current.cd1.nPolls} polls · CD2: ${current.cd2.nPolls} polls`);
console.log(`NC Senate: ${current.nc_sen.margin >= 0 ? "Cooper +" : "Whatley +"}${Math.abs(current.nc_sen.margin)} from ${current.nc_sen.nPolls} polls`);
console.log(`OH Senate: ${current.oh_sen.margin >= 0 ? "Brown +" : "Husted +"}${Math.abs(current.oh_sen.margin)} from ${current.oh_sen.nPolls} polls`);
console.log(`TX Senate: ${current.tx_sen.margin >= 0 ? "Talarico +" : "Paxton +"}${Math.abs(current.tx_sen.margin)} from ${current.tx_sen.nPolls} polls`);
