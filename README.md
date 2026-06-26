# The Needle Project

A live election dashboard for Maine's November 2026 races: U.S. Senate, Governor
(three-way), both U.S. House seats, and three ballot questions.

Baselines for Senate, Governor, and the House seats come from real OpenElections data
(2020 Senate, 2020 + 2016 President, 2020 U.S. House). The needle projects a winner from
partial returns the way the NYT needle does: comparing reporting counties to expectation.

## Run it

    npm install
    npm run dev        # opens http://localhost:5173

## Keep the polling current  (Goal 1)

Polls live in `data/polls.json`. Each entry has a pollster, a quality `rating` (0-1, with
partisan firms down-weighted), a date, and the numbers. To refresh the outlook:

    npm run polls      # recency- + quality-weighted average -> public/current.json

The app reads `public/current.json` on load and centers every race on it. To add a new poll,
append it to `data/polls.json` and re-run `npm run polls`. (Dispatch can do this for you:
"find the latest reputable Maine Senate polls, add them to data/polls.json, and run npm run polls".)

## Restore-to-current buttons  (Goal 2)

Each race with a dial has a "Restore to current" button under the slider. After exploring
scenarios, one tap snaps it back to the live polling outlook from `current.json`.

## Election night  (Goal 3)

Returns live in `public/results.json`. It ships empty, so the app runs in simulation. When the
file has real county numbers, those races switch to LIVE automatically (red badge) and the
needle runs on actual votes instead of the simulation.

    npm run results:demo   # writes a fake partial count so you can watch LIVE mode work
    npm run results        # election night: pulls real returns (see scripts/update-results.mjs)

`scripts/update-results.mjs` has a documented seam where the Maine Secretary of State feed
gets parsed on election night. The schema per race:
`races[id].counties[County] = { dem, rep, ind? }`  (ballot: dem = Yes, rep = No).

## Project map

- `src/MaineDashboard.jsx` — the whole dashboard
- `data/polls.json` — the poll feed you edit
- `scripts/update-polls.mjs` — builds the polling average
- `scripts/update-results.mjs` — builds election-night returns (live + demo)
- `public/current.json` / `public/results.json` — what the app reads

## Election-night parser (official Maine source)

`scripts/update-results.mjs` turns Maine's official results into `public/results.json`.
It reads town-level numbers, rolls them into the 16 counties using `data/town-county.json`,
and matches each office to the right race. Sources:

    node scripts/update-results.mjs --file results.xlsx     # a downloaded SoS spreadsheet
    node scripts/update-results.mjs --url  https://...       # download then parse
    node scripts/update-results.mjs --csv  clean.csv         # a clean town,office,party,candidate,votes file
    npm run results:demo                                     # fake partial count to test LIVE mode

On election night, set LIVE_URL at the top of the script to the SoS results spreadsheet and
run it on a timer (every ~2 minutes). The app polls results.json every 20s and switches races
to LIVE automatically.

**One calibration step before November:** Maine's exact spreadsheet layout (sheet names, column
headers, candidate spellings) isn't final until they publish the 2026 file. The parser is built
to adapt, but to lock it in, run it once against the real 2024 results file and check the
diagnostics it prints (unmatched offices/towns). Adjust the office/candidate patterns in
`scripts/lib/aggregate.mjs` if anything is unmatched.

## Smoothing

The needle now eases between positions over ~0.7s, and reporting bars glide, so a batch of
towns landing at once produces a smooth sweep instead of a snap.


All four candidate races can hold polls. `data/polls.json` has `senate`, `governor`, `cd1`, and `cd2` groups — append polls to any of them and run `npm run polls`. A race with no polls falls back to its historical baseline; a race with polls is re-centered onto the weighted average. The Polls tab shows every race and the weight each poll carried.

## Going online (automatic, laptop-off)

The hosted site updates itself. The browser polls `/api/results` every 20s; that serverless
function (`api/results.js`) fetches Maine's results spreadsheet, parses it with the same shared
library as the CLI, and is CDN-cached ~60s so Maine's site is hit at most ~once a minute. No
loop on your computer, nothing to refresh.

One-time setup:
1. Put the project on GitHub (dispatch can do this).
2. Import the repo into Vercel (free). It auto-detects Vite and the `/api` function.
3. Every push redeploys automatically.

On election night: in the Vercel project settings, set an environment variable
`MAINE_RESULTS_URL` to the Maine SoS results spreadsheet URL, then redeploy. The needles go
LIVE within ~60s and update on their own all night. Leave it unset and the site stays in
simulation mode. Local `npm run dev` ignores all this and uses `public/results.json` as before.
