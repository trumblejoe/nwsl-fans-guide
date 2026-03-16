#!/usr/bin/env node
/**
 * Fetch the 2026 NWSL schedule from nwslsoccer.com using Playwright.
 * The site uses an Endeavor SDP widget that dynamically loads schedule data,
 * so a real browser is required. This script:
 *   1. Intercepts the widget's API response (gets broadcaster info + upcoming games)
 *   2. Falls back to DOM extraction if the API isn't captured
 *   3. Writes data/nwsl-schedule.json with normalized game objects
 *
 * The output supplements the ASA API data (data/games-2026.json), adding:
 *   - Upcoming games not yet in ASA
 *   - Real broadcaster/streaming assignments per match
 */

const { chromium } = require('playwright');
const fs  = require('fs');
const path = require('path');

const DATA_DIR     = path.join(__dirname, '..', 'data');
const OUTPUT_FILE  = path.join(DATA_DIR, 'nwsl-schedule.json');
const TEAMS_FILE   = path.join(DATA_DIR, 'teams.json');
const STADIA_FILE  = path.join(DATA_DIR, 'stadia.json');

// ── Lookups ───────────────────────────────────────────────────────────────
const teams  = JSON.parse(fs.readFileSync(TEAMS_FILE,  'utf8'));
const stadia = JSON.parse(fs.readFileSync(STADIA_FILE, 'utf8'));

// Team name / short name / abbreviation → ASA team_id
const teamByName = {};
teams.forEach(t => {
  [t.team_name, t.team_short_name, t.team_abbreviation].forEach(key => {
    if (key) teamByName[key.toLowerCase().trim()] = t.team_id;
  });
});

// Endeavor API uses abbreviated names that don't always match ASA's full names
const TEAM_NAME_ALIASES = {
  'portland thorns':    'portland thorns fc',
  'boston legacy':      'boston legacy fc',
  'denver summit':      'denver summit fc',
  'racing louisville':  'racing louisville fc',
  'san diego wave':     'san diego wave fc',
  'seattle reign':      'seattle reign fc',
  'chicago stars':      'chicago stars fc',
};

function findTeamWithAlias(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return teamByName[key] || teamByName[TEAM_NAME_ALIASES[key]] || null;
}

// Stadium name → ASA stadium_id
const stadiumByName = {};
stadia.forEach(s => {
  if (s.stadium_name) stadiumByName[s.stadium_name.toLowerCase().trim()] = s.stadium_id;
});

function findTeam(name)   { return findTeamWithAlias(name); }
function findStadium(name){ return name ? (stadiumByName[name.toLowerCase().trim()] || null) : null; }

// ── Broadcaster → platform ID mapping ────────────────────────────────────
const BROADCASTER_MAP = {
  'cbs':            'CBS',  'cbs sports':     'CBS',
  'paramount':      'PAR',  'paramount+':     'PAR',  'p+':  'PAR',
  'amazon':         'AMZ',  'prime video':    'AMZ',  'amazon prime': 'AMZ',
  'prime':          'AMZ',
  'espn':           'ESPN',
  'espn+':          'ESPNP', 'espn plus':     'ESPNP',
  'nwsl+':          'NWSL',  'nwsl plus':     'NWSL', 'nwsl streaming': 'NWSL',
  'victory+':       'NWSL',  'victory plus':  'NWSL',
};

function broadcasterToPlatform(names) {
  for (const name of names) {
    const key = (name || '').toLowerCase().trim();
    if (BROADCASTER_MAP[key]) return BROADCASTER_MAP[key];
    for (const [k, v] of Object.entries(BROADCASTER_MAP)) {
      if (key.includes(k)) return v;
    }
  }
  return null;
}

// ── Normalize raw API match object (Endeavor format) ─────────────────────
function normalizeApiMatch(m) {
  const home = m.home || m.homeTeam || {};
  const away = m.away || m.awayTeam || {};
  const broadcasters = extractBroadcasters(m);
  const platform = broadcasterToPlatform(broadcasters);

  return {
    game_id:        `nwsl-${m.matchId || m.id}`,
    date_time_utc:  m.matchDateUtc || m.kickOffDate || m.kickoffDate || m.date || null,
    home_score:     m.providerHomeScore ?? m.homeScorePush ?? m.homeScore ?? (m.score ? m.score.home  : null),
    away_score:     m.providerAwayScore ?? m.awayScorePush ?? m.awayScore ?? (m.score ? m.score.away  : null),
    home_team_id:   findTeam(home.officialName || home.name || home.shortName) || home.teamId || null,
    away_team_id:   findTeam(away.officialName || away.name || away.shortName) || away.teamId || null,
    home_team_name: home.officialName || home.name || null,
    away_team_name: away.officialName || away.name || null,
    stadium_id:     findStadium(m.stadiumName || m.venue) || null,
    stadium_name:   m.stadiumName || m.venue || null,
    season_name:    '2026',
    matchday:       (m.matchSet && m.matchSet.index) || m.matchDay || m.roundNumber || m.round || null,
    status:         normalizeStatus(m.status || m.matchStatus),
    knockout_game:  false,
    broadcasters,
    platform,
    source:         'nwsl-site',
  };
}

function normalizeStatus(s) {
  if (!s) return 'PreMatch';
  const up = (s + '').toUpperCase();
  if (up === 'FINISHED' || up === 'FULLTIME' || up === 'FT') return 'FullTime';
  if (up === 'LIVE' || up === 'INPROGRESS')                   return 'InProgress';
  return 'PreMatch';
}

function extractBroadcasters(m) {
  const out = [];

  // Endeavor SDP format: editorial.broadcasters is an object with numbered keys
  // e.g. { broadcasterNational1: "Prime Video|https://...", broadcasterNational2: "", ... }
  const editorialBc = m.editorial && m.editorial.broadcasters;
  if (editorialBc && typeof editorialBc === 'object' && !Array.isArray(editorialBc)) {
    Object.values(editorialBc).forEach(val => {
      if (typeof val === 'string' && val) {
        const name = val.split('|')[0].trim();  // strip URL after pipe
        if (name) out.push(name);
      }
    });
  }

  // Fallback: legacy array / string formats
  const sources = [
    m.broadcasters, m.broadcaster, m.broadcasterNational, m.broadcastNational,
  ].filter(Boolean);

  sources.forEach(src => {
    if (Array.isArray(src)) {
      src.forEach(b => {
        const name = b.name || b.shortName || b.title || (typeof b === 'string' ? b : '');
        if (name) out.push(name);
      });
    } else if (typeof src === 'string') {
      out.push(src.split('|')[0].trim());
    }
  });

  return [...new Set(out)].filter(Boolean);
}

// ── DOM-based extraction (fallback) ──────────────────────────────────────
async function extractFromDOM(page) {
  try {
    await page.waitForSelector('.d3w-match-list-item', { timeout: 25000 });
  } catch {
    console.warn('DOM: .d3w-match-list-item not found within timeout');
    return [];
  }

  return page.evaluate(() => {
    return [...document.querySelectorAll('.d3w-match-list-item')].map(el => {
      const matchId     = el.getAttribute('data-matchid');
      const status      = el.getAttribute('data-match-status') || 'UPCOMING';
      const teamsVenue  = el.getAttribute('data-match-teams') || '';

      // Parse "HomeTeam vs AwayTeam, venue: Stadium"
      const vsIdx       = teamsVenue.indexOf(' vs ');
      const venueMarker = ', venue: ';
      const venueIdx    = teamsVenue.toLowerCase().indexOf(venueMarker.toLowerCase());
      const homeTeam    = vsIdx > -1 ? teamsVenue.slice(0, vsIdx).trim() : '';
      const restAfterVs = vsIdx > -1 ? teamsVenue.slice(vsIdx + 4) : '';
      const awayTeam    = venueIdx > -1
        ? restAfterVs.slice(0, restAfterVs.toLowerCase().indexOf(venueMarker.toLowerCase())).trim()
        : restAfterVs.trim();
      const venueName   = venueIdx > -1
        ? teamsVenue.slice(teamsVenue.toLowerCase().indexOf(venueMarker.toLowerCase()) + venueMarker.length).trim()
        : '';

      // Broadcaster names from alt/title/text
      const broadcasters = [
        ...[...el.querySelectorAll('.d3w-broadcasters img')].map(i => i.getAttribute('alt') || ''),
        ...[...el.querySelectorAll('.d3w-broadcasters [data-broadcaster]')].map(b => b.getAttribute('data-broadcaster') || ''),
        ...[...el.querySelectorAll('.d3w-broadcasters span, .d3w-broadcasters a')].map(b => b.textContent.trim()),
      ].filter(Boolean);

      // Date string from any date/time element
      const dateEl = el.querySelector('[class*="date"], [class*="time"], [class*="kickoff"]');
      const dateText = dateEl ? dateEl.textContent.trim() : '';

      // Score
      const scoreEl = el.querySelector('[class*="score"]');
      const scoreText = scoreEl ? scoreEl.textContent.trim() : '';

      return { matchId, status, homeTeam, awayTeam, venueName, broadcasters, dateText, scoreText };
    });
  });
}

function domMatchToGame(m) {
  const scoreMatch = m.scoreText.match(/(\d+)\s*[–\-]\s*(\d+)/);
  const broadcasters = [...new Set(m.broadcasters.map(b => b.trim()).filter(Boolean))];
  const platform = broadcasterToPlatform(broadcasters);

  return {
    game_id:        `nwsl-${m.matchId}`,
    date_time_utc:  m.dateText || null,   // raw string; app handles display
    home_score:     scoreMatch ? parseInt(scoreMatch[1]) : null,
    away_score:     scoreMatch ? parseInt(scoreMatch[2]) : null,
    home_team_id:   findTeam(m.homeTeam),
    away_team_id:   findTeam(m.awayTeam),
    home_team_name: m.homeTeam,
    away_team_name: m.awayTeam,
    stadium_id:     findStadium(m.venueName),
    stadium_name:   m.venueName,
    season_name:    '2026',
    matchday:       null,
    status:         normalizeStatus(m.status),
    knockout_game:  false,
    broadcasters,
    platform,
    source:         'nwsl-dom',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('[nwsl-schedule] Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context  = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  });
  const page = await context.newPage();

  // API interception
  let capturedGames = [];
  page.on('response', async response => {
    const url  = response.url();
    const ct   = response.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    if (url.includes('geo.json') || url.includes('vocabulary')) return;

    try {
      const json = await response.json();
      const arr  = Array.isArray(json)     ? json
                 : Array.isArray(json?.data)    ? json.data
                 : Array.isArray(json?.matches) ? json.matches
                 : Array.isArray(json?.results) ? json.results
                 : null;
      if (arr && arr.length > 0 && (arr[0].matchId || arr[0].kickOffDate || arr[0].kickoffDate)) {
        console.log(`[API] Captured ${arr.length} matches from ${url}`);
        capturedGames = arr.map(normalizeApiMatch);
      }
    } catch { /* ignore parse errors */ }
  });

  console.log('[nwsl-schedule] Loading schedule page...');
  try {
    await page.goto('https://www.nwslsoccer.com/schedule/regular-season', {
      waitUntil: 'networkidle', timeout: 60000,
    });
  } catch (e) {
    console.warn('[nwsl-schedule] Navigation timeout:', e.message);
  }

  let games = capturedGames;

  if (!games.length) {
    console.log('[nwsl-schedule] API not captured — trying DOM extraction...');
    const domItems = await extractFromDOM(page);
    games = domItems.map(domMatchToGame).filter(g => g.home_team_id && g.away_team_id);
    console.log(`[nwsl-schedule] DOM extracted ${games.length} games`);
  }

  await browser.close();

  const result = {
    fetched_at:  new Date().toISOString(),
    source:      games[0]?.source || 'unknown',
    game_count:  games.length,
    games,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`[nwsl-schedule] Saved ${games.length} games to ${OUTPUT_FILE}`);

  if (!games.length) {
    console.warn('[nwsl-schedule] WARNING: No games captured. nwsl-schedule.json will be empty.');
  }
}

main().catch(err => {
  console.error('[nwsl-schedule] Fatal error:', err);
  // Write an empty result so the workflow doesn't fail the deploy
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ fetched_at: new Date().toISOString(), game_count: 0, games: [] }, null, 2));
  process.exit(0);
});
