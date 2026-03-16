# NWSL Fan's Guide

An unofficial fan resource for the National Women's Soccer League. Browse match schedules, streaming options, and standings for every NWSL season since 2016.

**Live site:** https://trumblejoe.github.io/nwsl-fans-guide/

---

## Features

- **Match schedule** — every season from 2016–2026, with results and upcoming fixtures
- **Broadcaster badges** — see which platform each match airs on (CBS, Paramount+, Amazon, ESPN, NWSL+, Victory+)
- **Spoiler mode** — hide scores for any season while you catch up
- **2026 Standings** — live table with points, goal difference, form dots, and playoff zone indicator
- **Streaming guide** — quick reference for every broadcaster carrying NWSL games
- **Three display modes** — Dark, Light, and Easy Read (larger text) — toggled from the navbar

---

## Data sources

| Data | Source |
|------|--------|
| Historical game results (2016–2025) | [American Soccer Analysis API](https://www.americansocceranalysis.com) |
| 2026 schedule & broadcaster info | NWSL / Endeavor SDP (scraped via Playwright) |
| 2026 standings | Endeavor SDP API |

Data is refreshed automatically every day at 6 AM UTC via GitHub Actions.

---

## Tech stack

- Plain HTML, CSS, and vanilla JavaScript — no build step, no framework
- Static site hosted on GitHub Pages
- GitHub Actions workflow fetches fresh data at deploy time and on a daily schedule
- [Playwright](https://playwright.dev/) headless browser for the NWSL schedule scrape
- Node.js built-in `https` module for the standings API call

---

## Local development

No build step required — just open `index.html` in a browser, or serve with any static file server:

```bash
npx serve .
```

To refresh data locally, run the fetch scripts (requires Node.js 20+):

```bash
node scripts/fetch-nwsl-standings.js
node scripts/fetch-nwsl-schedule.js   # requires Playwright
```

---

## Deployment

Pushes to `master` trigger the GitHub Actions workflow, which:

1. Fetches all historical season data from the ASA API
2. Scrapes the current season schedule (broadcaster + upcoming game data)
3. Fetches current standings
4. Injects a cache-busting git SHA into `index.html`
5. Deploys to GitHub Pages

The daily 6 AM cron run only refreshes the active seasons (2025, 2026) to avoid redundant fetches of historical data.

---

*Unofficial fan project. Not affiliated with the NWSL or any of its broadcasters.*
