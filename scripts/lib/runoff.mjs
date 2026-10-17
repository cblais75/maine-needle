// runoff.mjs — majority-or-runoff rule (Update 57).
// Georgia requires MORE than 50% of all votes to win outright; otherwise the top two meet in a runoff
// (Dec. 1, 2026). The needle projects the two main candidates' share; third-party votes ("oth" in the
// results) shrink both, so a two-way lead can still fall short of a majority (Warnock had 49.4% in 2022).
export const RUNOFF_RACES = { ga_sen: { date: "Dec. 1" }, ga_gov: { date: "Dec. 1" } };

function ncdf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// Share of all counted votes that went to other candidates, from the race's counted units.
export function otherShare(units) {
  let main = 0, oth = 0;
  for (const u of units || []) { main += (u.vDem || 0) + (u.vRep || 0); oth += u.vOth || 0; }
  return main + oth > 0 ? oth / (main + oth) : 0;
}

// m: the needle's projection { margin (two-way, -1..1), se, fracIn }; pWin: the leader's chance to finish first.
// The leader wins outright only with a two-way margin above o / (1 - o), where o is the other candidates' share.
//   called: leader is ≥97% to finish first AND ≥97% to clear 50%, with at least half the vote in
//   runoff: at least half the vote in and the leader is more likely than not to fall short of 50%
//   open:   anything else (the needle may lean, but never shows "Called")
export function runoffStatus(m, pWin, oth) {
  const need = oth >= 1 ? Infinity : oth / (1 - oth);
  const pMajority = ncdf((Math.abs(m.margin) - need) / m.se);
  let status = "open";
  if (m.fracIn >= 0.5 && pWin >= 0.97 && pMajority >= 0.97) status = "called";
  else if (m.fracIn >= 0.5 && pMajority < 0.5) status = "runoff";
  return { status, pMajority, need };
}
