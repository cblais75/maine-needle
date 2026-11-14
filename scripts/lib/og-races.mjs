// Link preview cards (Nov 14): one entry per race page. Used by
//   scripts/og-images.mjs  (run by hand: draws public/og/<state>-<race>.png)
//   scripts/route-pages.mjs (runs on every build: writes a page per address with its own title, summary and image)
// Social sites (Bluesky, iMessage, Substack, Facebook) don't run the site's JavaScript, so each address
// needs its own plain HTML copy for the preview to show that race.
// w = winner, l = runner-up, as [name, party]. Keep in step with EDITOR_CALLS in src/MaineDashboard.jsx.
export const STATES = { ME: "Maine", NC: "North Carolina", OH: "Ohio", TX: "Texas", IA: "Iowa", GA: "Georgia", NE: "Nebraska", AK: "Alaska", MI: "Michigan", NH: "New Hampshire", KS: "Kansas", MN: "Minnesota", SC: "South Carolina", MS: "Mississippi" };

export const RACES = [
  { id: "sen", state: "ME", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Jackson", "D"], l: ["Collins", "R"] },
  { id: "gov", state: "ME", race: "governor", office: "race for governor", title: "Governor", w: ["Pingree", "D"], l: ["Charles", "R"], third: ["Bennett", "I"] },
  { id: "cd1", state: "ME", race: "house-district-1", office: "1st District", title: "U.S. House, District 1", w: ["Pingree", "D"], l: ["Russell", "R"] },
  { id: "cd2", state: "ME", race: "house-district-2", office: "2nd District", title: "U.S. House, District 2", w: ["LePage", "R"], l: ["Dunlap", "D"] },
  { id: "nc_sen", state: "NC", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Cooper", "D"], l: ["Whatley", "R"] },
  { id: "oh_sen", state: "OH", race: "senate", office: "Senate special election", title: "U.S. Senate (special)", w: ["Brown", "D"], l: ["Husted", "R"] },
  { id: "oh_gov", state: "OH", race: "governor", office: "race for governor", title: "Governor", w: ["Acton", "D"], l: ["Ramaswamy", "R"] },
  { id: "tx_sen", state: "TX", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Talarico", "D"], l: ["Paxton", "R"] },
  { id: "tx_gov", state: "TX", race: "governor", office: "race for governor", title: "Governor", w: ["Hinojosa", "D"], l: ["Abbott", "R"] },
  { id: "ia_sen", state: "IA", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Turek", "D"], l: ["Hinson", "R"] },
  { id: "ia_gov", state: "IA", race: "governor", office: "race for governor", title: "Governor", w: ["Sand", "D"], l: ["Lahn", "R"] },
  { id: "ga_sen", state: "GA", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Ossoff", "D"], l: ["Collins", "R"] },
  { id: "ga_gov", state: "GA", race: "governor", office: "race for governor", title: "Governor", w: ["Bottoms", "D"], l: ["Jackson", "R"] },
  { id: "ne_sen", state: "NE", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Ricketts", "R"], l: ["Osborn", "I"] },
  { id: "ak_sen", state: "AK", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Peltola", "D"], l: ["Sullivan", "R"] },
  { id: "nh_sen", state: "NH", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Pappas", "D"], l: ["Sununu", "R"] },
  { id: "mi_sen", state: "MI", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["El-Sayed", "D"], l: ["Rogers", "R"] },
  { id: "ks_sen", state: "KS", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Hamilton", "D"], l: ["Marshall", "R"] },
  { id: "ks_gov", state: "KS", race: "governor", office: "race for governor", title: "Governor", w: ["Holscher", "D"], l: ["Masterson", "R"] },
  { id: "mn_sen", state: "MN", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Flanagan", "D"], l: ["Tafoya", "R"] },
  { id: "sc_sen", state: "SC", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Andrews", "D"], l: ["D. Graham", "R"] },
  { id: "ms_sen", state: "MS", race: "senate", office: "Senate race", title: "U.S. Senate", w: ["Colom", "D"], l: ["Hyde-Smith", "R"] },
];

export const slugify = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const stateSlug = (code) => slugify(STATES[code]);
export const pathOf = (r) => `/${stateSlug(r.state)}/${r.race}`;
export const imageOf = (r) => `/og/${stateSlug(r.state)}-${r.race}.png`;
const poss = (s) => `${s}'s`;
export const headlineOf = (r) => `${r.w[0]} wins ${poss(STATES[r.state])} ${r.office}`;
export const matchupOf = (r) => `${r.w[0]} (${r.w[1]}) defeats ${r.l[0]} (${r.l[1]})${r.third ? ` and ${r.third[0]} (${r.third[1]})` : ""}`;
// Alaska reports by state House district, not county.
export const byArea = (r) => (r.state === "AK" ? "District-by-district" : "County-by-county");
