#!/usr/bin/env node
/**
 * Fetch 2026 NWSL standings from the Endeavor SDP API.
 * Unlike the schedule scraper this endpoint is directly accessible — no
 * headless browser required.  Writes data/nwsl-standings.json.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DATA_DIR   = path.join(__dirname, '..', 'data');
const OUT_FILE   = path.join(DATA_DIR, 'nwsl-standings.json');
const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');

const SEASON_ID = 'nwsl::Football_Season::0b6761e4701749f593690c0f338da74c';

// ── Team name → ASA team_id lookup (same as schedule scraper) ────────────
const teams = JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8'));
const teamByName = {};
teams.forEach(t => {
  [t.team_name, t.team_short_name, t.team_abbreviation].forEach(k => {
    if (k) teamByName[k.toLowerCase().trim()] = t.team_id;
  });
});

const TEAM_NAME_ALIASES = {
  'angel city':       'angel city fc',
  'bay':              'bay fc',
  'boston legacy':    'boston legacy fc',
  'chicago stars':    'chicago stars fc',
  'denver summit':    'denver summit fc',
  'gotham fc':        'nj/ny gotham fc',
  'portland thorns':  'portland thorns fc',
  'racing louisville':'racing louisville fc',
  'san diego wave':   'san diego wave fc',
  'seattle reign':    'seattle reign fc',
  'utah royals':      'utah royals fc',
};

function findTeam(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  return teamByName[key] || teamByName[TEAM_NAME_ALIASES[key]] || null;
}

function getStat(statsArr, id) {
  const s = statsArr.find(s => s.statsId === id);
  return s ? s.statsValue : null;
}

// ── Fetch ──────────────────────────────────────────────────────────────────
const url = `/v1/nwsl/football/seasons/${SEASON_ID}/standings?locale=en-US`;

console.log('[nwsl-standings] Fetching standings...');

const req = https.get({
  hostname: 'api-sdp.nwslsoccer.com',
  path: url,
  headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    try {
      const d = JSON.parse(body);
      const rows = (d.teams || []).map(t => {
        const s = t.stats || [];
        const form = (getStat(s, 'form') || []).map(f => f.formType);
        return {
          rank:         getStat(s, 'rank'),
          asa_team_id:  findTeam(t.officialName || t.shortName),
          name:         t.officialName || t.shortName || '',
          acronym:      t.acronymName || '',
          pts:          getStat(s, 'points'),
          p:            getStat(s, 'matches-played'),
          w:            getStat(s, 'win'),
          d:            getStat(s, 'draw'),
          l:            getStat(s, 'lose'),
          gf:           getStat(s, 'goals-for'),
          ga:           getStat(s, 'goals-against'),
          gd:           getStat(s, 'goal-difference'),
          form,
          playoff_zone: t.qualification != null,
        };
      });

      const result = {
        fetched_at: new Date().toISOString(),
        season:     '2026',
        teams:      rows,
      };

      fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
      console.log(`[nwsl-standings] Saved ${rows.length} teams to ${OUT_FILE}`);
    } catch (err) {
      console.error('[nwsl-standings] Parse error:', err.message);
      writeEmpty();
    }
  });
});

req.on('error', err => {
  console.error('[nwsl-standings] Request error:', err.message);
  writeEmpty();
});

function writeEmpty() {
  fs.writeFileSync(OUT_FILE, JSON.stringify(
    { fetched_at: new Date().toISOString(), season: '2026', teams: [] }, null, 2
  ));
}
