/* ============================================================
   NWSL Fan's Guide — App Logic
   Fetches live data from the American Soccer Analysis API,
   merges with static display data, and renders the dashboard.
   Vanilla JS — no build tools, no frameworks.
   ============================================================ */

(function () {
  'use strict';

  const { platforms, teamColors, defaultTeamColor, assignStreaming } = NWSL_STATIC;
  const PLATFORM_MAP = Object.fromEntries(platforms.map(p => [p.id, p]));
  const TODAY = new Date();

  // A match is considered LIVE for up to 2 hours after kickoff
  const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

  // ----------------------------------------------------------
  //  App state
  // ----------------------------------------------------------
  let state = {
    activeSeason:    '2025',
    filterTeam:      'all',
    filterPlatform:  'all',
    filterMonth:     'all',
    // Populated after API load:
    teamMap:         {},   // team_id → team object (from API + colors)
    stadiumMap:      {},   // stadium_id → stadium object
    matches2025:     [],
    matches2024:     [],
  };

  // ----------------------------------------------------------
  //  DOM refs
  // ----------------------------------------------------------
  let dom = {};

  function cacheDOM() {
    dom.seasonTabs     = document.querySelectorAll('.season-tab');
    dom.matchesGrid    = document.getElementById('matches-grid');
    dom.matchCount     = document.getElementById('match-count');
    dom.filterTeam     = document.getElementById('filter-team');
    dom.filterPlatform = document.getElementById('filter-platform');
    dom.filterMonth    = document.getElementById('filter-month');
    dom.filterReset    = document.getElementById('filter-reset');
    dom.streamingGrid  = document.getElementById('streaming-grid');
    dom.heroTeams      = document.getElementById('hero-teams-count');
    dom.heroMatches    = document.getElementById('hero-matches-count');
    dom.heroPlatforms  = document.getElementById('hero-platforms-count');
  }

  // ----------------------------------------------------------
  //  Entry point
  // ----------------------------------------------------------
  async function boot() {
    cacheDOM();
    buildStreamingGuide();
    showLoadingState();

    try {
      const { teams, stadia, games2025, games2024 } = await NWSL_API.loadAll();
      buildLookupMaps(teams, stadia);
      state.matches2025 = normalizeGames(games2025);
      state.matches2024 = normalizeGames(games2024);
    } catch (err) {
      console.error('Failed to load NWSL data:', err);
      showErrorState();
      return;
    }

    buildFilterOptions();
    wireEvents();
    rebuildMonthFilter();
    renderSchedule();
    updateHeroStats();
  }

  // ----------------------------------------------------------
  //  Build lookup maps from API responses
  // ----------------------------------------------------------
  function buildLookupMaps(teams, stadia) {
    teams.forEach(t => {
      const colors = teamColors[t.team_id] || defaultTeamColor;
      state.teamMap[t.team_id] = {
        id:           t.team_id,
        name:         t.team_name,
        short:        t.team_short_name,
        abbreviation: t.team_abbreviation,
        bg:           colors.bg,
        color:        colors.color,
      };
    });

    stadia.forEach(s => {
      state.stadiumMap[s.stadium_id] = s;
    });
  }

  // ----------------------------------------------------------
  //  Normalize raw API game objects into display-ready shape
  // ----------------------------------------------------------
  function normalizeGames(games) {
    return games
      .map(g => {
        const stadium = state.stadiumMap[g.stadium_id];
        const venueParts = stadium
          ? [stadium.stadium_name, stadium.city, stadium.province].filter(Boolean)
          : [];
        const venue = venueParts.length
          ? `${venueParts[0]}${venueParts[1] ? ', ' + venueParts[1] : ''}${venueParts[2] ? ' ' + abbreviateState(venueParts[2]) : ''}`
          : 'Venue TBD';

        const dateObj = parseApiDate(g.date_time_utc);

        const score = (g.status === 'FullTime' && g.home_score != null)
          ? { home: g.home_score, away: g.away_score }
          : null;

        // Penalties shootout note
        let label = null;
        if (g.knockout_game && g.matchday >= 27) {
          const matchdayLabels = {
            27: 'NWSL Quarterfinal',
            28: 'NWSL Semifinal',
            29: 'NWSL Championship Final',
          };
          label = matchdayLabels[g.matchday] || 'NWSL Playoff';
        }

        const penaltyNote = g.penalties
          ? ` (${g.home_penalties}–${g.away_penalties} pens)`
          : g.extra_time ? ' (AET)' : '';

        return {
          id:         g.game_id,
          date:       dateObj,
          dateUtc:    g.date_time_utc,
          home:       g.home_team_id,
          away:       g.away_team_id,
          venue,
          platform:   assignStreaming(g),
          score,
          penaltyNote,
          label,
          status:     g.status,    // 'FullTime' | 'PreMatch' | 'Abandoned'
          attendance: g.attendance,
          matchday:   g.matchday,
          knockout:   g.knockout_game,
        };
      })
      .sort((a, b) => a.date - b.date);
  }

  // ----------------------------------------------------------
  //  Date helpers
  // ----------------------------------------------------------
  function parseApiDate(str) {
    // "2025-11-23 01:00:00 UTC" → Date
    return new Date(str.replace(' ', 'T').replace(' UTC', 'Z'));
  }

  // Abbreviate U.S. state names to 2-letter codes for display
  const STATE_ABBR = {
    'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
    'Colorado':'CO','Connecticut':'CT','Delaware':'DE','District of Columbia':'DC',
    'Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL',
    'Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
    'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
    'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV',
    'New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY',
    'North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
    'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
    'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
    'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI',
    'Wyoming':'WY',
  };
  function abbreviateState(s) { return STATE_ABBR[s] || s; }

  function formatDate(d) {
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function formatTime(d) {
    // Display in local time
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // ----------------------------------------------------------
  //  Match status
  // ----------------------------------------------------------
  function getMatchStatus(match) {
    if (match.status === 'Abandoned') return 'abandoned';
    if (match.score !== null)         return 'final';
    const elapsed = TODAY - match.date;
    if (elapsed < 0)                  return 'upcoming';
    if (elapsed < LIVE_WINDOW_MS)     return 'live';
    return 'final';
  }

  // ----------------------------------------------------------
  //  Hero stats
  // ----------------------------------------------------------
  function updateHeroStats() {
    const teamCount    = Object.keys(state.teamMap).length;
    const matchCount   = state.matches2025.length + state.matches2024.length;
    const platCount    = platforms.length;

    if (dom.heroTeams)     dom.heroTeams.textContent     = teamCount;
    if (dom.heroMatches)   dom.heroMatches.textContent   = matchCount;
    if (dom.heroPlatforms) dom.heroPlatforms.textContent = platCount;
  }

  // ----------------------------------------------------------
  //  Loading / error states
  // ----------------------------------------------------------
  function showLoadingState() {
    dom.matchesGrid.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner" aria-label="Loading matches…"></div>
        <div class="loading-text">Loading live NWSL data…</div>
      </div>`;
    dom.matchCount.textContent = 'Loading…';
  }

  function showErrorState() {
    dom.matchesGrid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">⚠️</div>
        <div class="no-results-text">Could not load schedule data</div>
        <div class="no-results-sub">
          Check your connection or visit
          <a href="https://www.nwsl.com" target="_blank" rel="noopener">nwsl.com</a>
          for official schedule information.
        </div>
      </div>`;
    dom.matchCount.textContent = '';
  }

  // ----------------------------------------------------------
  //  Build filter dropdowns
  // ----------------------------------------------------------
  function buildFilterOptions() {
    // Teams — only include teams that appear in loaded games
    const usedTeamIds = new Set([
      ...state.matches2025.flatMap(m => [m.home, m.away]),
      ...state.matches2024.flatMap(m => [m.home, m.away]),
    ]);
    const usedTeams = [...usedTeamIds]
      .map(id => state.teamMap[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    const teamFrag = document.createDocumentFragment();
    usedTeams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      teamFrag.appendChild(opt);
    });
    dom.filterTeam.appendChild(teamFrag);

    // Platforms
    const platFrag = document.createDocumentFragment();
    platforms.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      platFrag.appendChild(opt);
    });
    dom.filterPlatform.appendChild(platFrag);
  }

  // ----------------------------------------------------------
  //  Wire events
  // ----------------------------------------------------------
  function wireEvents() {
    dom.seasonTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeSeason = tab.dataset.season;
        dom.seasonTabs.forEach(t => t.classList.toggle('active', t === tab));
        resetFilters(false);
        rebuildMonthFilter();
        renderSchedule();
      });
    });

    [dom.filterTeam, dom.filterPlatform, dom.filterMonth].forEach(sel => {
      sel.addEventListener('change', () => {
        state.filterTeam     = dom.filterTeam.value;
        state.filterPlatform = dom.filterPlatform.value;
        state.filterMonth    = dom.filterMonth.value;
        renderSchedule();
      });
    });

    dom.filterReset.addEventListener('click', () => {
      resetFilters(true);
      renderSchedule();
    });
  }

  function resetFilters(updateDOM = true) {
    state.filterTeam     = 'all';
    state.filterPlatform = 'all';
    state.filterMonth    = 'all';
    if (updateDOM) {
      dom.filterTeam.value     = 'all';
      dom.filterPlatform.value = 'all';
      dom.filterMonth.value    = 'all';
    }
  }

  // ----------------------------------------------------------
  //  Month filter
  // ----------------------------------------------------------
  function rebuildMonthFilter() {
    const matches = getActiveMatches();
    const months = [...new Set(matches.map(m => {
      return m.date.toISOString().slice(0, 7); // "YYYY-MM"
    }))].sort();

    while (dom.filterMonth.options.length > 1) dom.filterMonth.remove(1);

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    months.forEach(ym => {
      const [year, month] = ym.split('-');
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = `${MONTH_NAMES[+month - 1]} ${year}`;
      dom.filterMonth.appendChild(opt);
    });
  }

  // ----------------------------------------------------------
  //  Active matches + filtering
  // ----------------------------------------------------------
  function getActiveMatches() {
    return state.activeSeason === '2025' ? state.matches2025 : state.matches2024;
  }

  function filterMatches(matches) {
    return matches.filter(m => {
      if (state.filterTeam !== 'all' && m.home !== state.filterTeam && m.away !== state.filterTeam)
        return false;
      if (state.filterPlatform !== 'all' && m.platform !== state.filterPlatform)
        return false;
      if (state.filterMonth !== 'all') {
        const ym = m.date.toISOString().slice(0, 7);
        if (ym !== state.filterMonth) return false;
      }
      return true;
    });
  }

  // ----------------------------------------------------------
  //  Build a match card
  // ----------------------------------------------------------
  function buildMatchCard(match) {
    const status   = getMatchStatus(match);
    const home     = state.teamMap[match.home] || { name: match.home, abbreviation: '?', bg: defaultTeamColor.bg, color: defaultTeamColor.color };
    const away     = state.teamMap[match.away] || { name: match.away, abbreviation: '?', bg: defaultTeamColor.bg, color: defaultTeamColor.color };
    const platform = PLATFORM_MAP[match.platform] || PLATFORM_MAP['NWSL'];

    const card = document.createElement('article');
    card.className = 'match-card' +
      (status === 'final'    ? ' is-past' : '') +
      (status === 'live'     ? ' is-live'  : '') +
      (status === 'abandoned'? ' is-past'  : '');

    const statusText = { upcoming: 'Upcoming', live: '● Live', final: 'Final', abandoned: 'Abandoned' }[status];

    // VS / score block
    let vsHtml;
    if (status === 'final' && match.score) {
      vsHtml = `<div class="vs-block">
                  <div class="score-display">${match.score.home}–${match.score.away}</div>
                  ${match.penaltyNote ? `<div class="penalty-note">${match.penaltyNote}</div>` : ''}
                </div>`;
    } else if (status === 'live') {
      vsHtml = `<div class="vs-block">
                  <div class="score-display" style="color:var(--red)">LIVE</div>
                </div>`;
    } else {
      vsHtml = `<div class="vs-block">
                  <div class="vs-label">VS</div>
                  <div class="kickoff-time">${formatTime(match.date)}</div>
                </div>`;
    }

    const platStyle = `background:${platform.color};color:${platform.textColor};`;
    const specialHtml = match.label ? `<div class="card-special-label">${match.label}</div>` : '';
    const attendanceHtml = (status === 'final' && match.attendance)
      ? `<span class="card-attendance" title="Attendance">${match.attendance.toLocaleString()} fans</span>`
      : '';

    card.innerHTML = `
      <div class="card-meta">
        <span class="card-date">${formatDate(match.date)}</span>
        <span class="card-label ${status}">${statusText}</span>
      </div>

      <div class="matchup">
        <div class="team team-home">
          <div class="team-badge" style="background:${home.bg};color:${home.color};">${home.abbreviation}</div>
          <div class="team-name">${home.name}</div>
        </div>

        ${vsHtml}

        <div class="team team-away">
          <div class="team-badge" style="background:${away.bg};color:${away.color};">${away.abbreviation}</div>
          <div class="team-name">${away.name}</div>
        </div>
      </div>

      <div class="card-footer">
        <span class="card-venue" title="${match.venue}">📍 ${match.venue}</span>
        <span class="platform-badge" style="${platStyle}" title="${platform.name}">${platform.icon}</span>
      </div>

      ${attendanceHtml ? `<div class="card-attendance-row">${attendanceHtml}</div>` : ''}
      ${specialHtml}
    `;

    return card;
  }

  // ----------------------------------------------------------
  //  Render schedule
  // ----------------------------------------------------------
  function renderSchedule() {
    const allMatches = getActiveMatches();
    const filtered   = filterMatches(allMatches);

    dom.matchesGrid.innerHTML = '';

    if (filtered.length === 0) {
      dom.matchesGrid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">⚽</div>
          <div class="no-results-text">No matches found</div>
          <div class="no-results-sub">Try adjusting your filters</div>
        </div>`;
    } else {
      const frag = document.createDocumentFragment();
      filtered.forEach(m => frag.appendChild(buildMatchCard(m)));
      dom.matchesGrid.appendChild(frag);
    }

    dom.matchCount.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${allMatches.length}</strong> matches`;
  }

  // ----------------------------------------------------------
  //  Build streaming guide
  // ----------------------------------------------------------
  function buildStreamingGuide() {
    const frag = document.createDocumentFragment();
    platforms.forEach(p => {
      const card = document.createElement('div');
      card.className = 'streaming-card';
      card.innerHTML = `
        <div class="streaming-card-header">
          <div class="streaming-icon" style="background:${p.color};color:${p.textColor};">${p.icon}</div>
          <div class="streaming-name">${p.name}</div>
        </div>
        <div class="streaming-desc">${p.description}</div>
        <div>
          <div class="streaming-includes-label">What's included</div>
          <div class="streaming-includes">${p.includes}</div>
        </div>
        <div class="streaming-price">
          <span>Subscription</span>
          <strong>${p.subscription}</strong>
        </div>
      `;
      frag.appendChild(card);
    });
    dom.streamingGrid.appendChild(frag);
  }

  // ----------------------------------------------------------
  //  Bootstrap
  // ----------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
