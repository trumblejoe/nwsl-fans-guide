/* ============================================================
   NWSL Fan's Guide — App Logic
   Fetches data from local JSON (built by GitHub Actions),
   renders season schedule with pagination, spoiler toggle,
   and team/platform filters.
   ============================================================ */

(function () {
  'use strict';

  const { platforms, teamColors, defaultTeamColor, assignStreaming } = NWSL_STATIC;
  const PLATFORM_MAP = Object.fromEntries(platforms.map(p => [p.id, p]));
  const TODAY        = new Date();
  const LIVE_WINDOW  = 2 * 60 * 60 * 1000;
  const MONTH_NAMES  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ----------------------------------------------------------
  //  State
  // ----------------------------------------------------------
  let state = {
    activeSeason:     null,
    availableSeasons: [],        // sorted newest→oldest
    activeMonth:      'all',
    filterTeam:       'all',
    filterPlatform:   'all',
    spoilersHidden:   false,
    revealedMatches:  new Set(),
    teamMap:          {},
    stadiumMap:       {},
    seasonGames:      {},        // year → NormalizedGame[]
  };

  // ----------------------------------------------------------
  //  DOM refs
  // ----------------------------------------------------------
  let dom = {};

  function cacheDOM() {
    dom.seasonTabs     = document.getElementById('season-tabs');
    dom.matchesGrid    = document.getElementById('matches-grid');
    dom.matchCount     = document.getElementById('match-count');
    dom.filterTeam     = document.getElementById('filter-team');
    dom.filterPlatform = document.getElementById('filter-platform');
    dom.filterMonth    = document.getElementById('filter-month');
    dom.filterReset    = document.getElementById('filter-reset');
    dom.monthPrev      = document.getElementById('month-prev');
    dom.monthNext      = document.getElementById('month-next');
    dom.spoilerToggle  = document.getElementById('spoiler-toggle');
    dom.streamingGrid  = document.getElementById('streaming-grid');
    dom.heroTeams      = document.getElementById('hero-teams-count');
    dom.heroMatches    = document.getElementById('hero-matches-count');
    dom.heroPlatforms  = document.getElementById('hero-platforms-count');
  }

  // ----------------------------------------------------------
  //  Boot
  // ----------------------------------------------------------
  async function boot() {
    cacheDOM();
    buildStreamingGuide();
    showLoadingState();

    try {
      const { teams, stadia, games, nwslSchedule, nwslStandings } = await NWSL_API.loadAll();
      buildLookupMaps(teams, stadia);

      NWSL_API.SEASONS.forEach(year => {
        const raw = games[year];
        state.seasonGames[year] = Array.isArray(raw) && raw.length > 0
          ? normalizeGames(raw)
          : [];
      });

      // Overlay real broadcaster data + add upcoming games from nwslsoccer.com scrape
      if (nwslSchedule && Array.isArray(nwslSchedule.games) && nwslSchedule.games.length > 0) {
        state.seasonGames['2026'] = mergeNwslSchedule(state.seasonGames['2026'], nwslSchedule.games);
      }

      // Seasons with data, newest first
      state.availableSeasons = NWSL_API.SEASONS
        .filter(y => state.seasonGames[y].length > 0)
        .reverse();

      buildStandings(nwslStandings);
    } catch (err) {
      console.error('Failed to load NWSL data:', err);
      showErrorState();
      return;
    }

    buildSeasonTabs();
    buildPlatformOptions();
    wireEvents();
    updateHeroStats();

    // Default to the most recent season
    switchSeason(state.availableSeasons[0], true);
  }

  // ----------------------------------------------------------
  //  Lookup maps
  // ----------------------------------------------------------
  function buildLookupMaps(teams, stadia) {
    teams.forEach(t => {
      const c = teamColors[t.team_id] || defaultTeamColor;
      state.teamMap[t.team_id] = {
        id: t.team_id, name: t.team_name,
        short: t.team_short_name, abbreviation: t.team_abbreviation,
        bg: c.bg, color: c.color,
      };
    });
    stadia.forEach(s => { state.stadiumMap[s.stadium_id] = s; });
  }

  // ----------------------------------------------------------
  //  Normalize raw API games
  // ----------------------------------------------------------
  function normalizeGames(games) {
    return games.map(g => {
      const st     = state.stadiumMap[g.stadium_id];
      const parts  = st ? [st.stadium_name, st.city, st.province].filter(Boolean) : [];
      const venue  = parts.length
        ? `${parts[0]}${parts[1] ? ', ' + parts[1] : ''}${parts[2] ? ' ' + abbrevState(parts[2]) : ''}`
        : 'Venue TBD';
      const date   = parseUTC(g.date_time_utc);
      const score  = g.status === 'FullTime' && g.home_score != null
        ? { home: g.home_score, away: g.away_score } : null;
      let label = null;
      if (g.knockout_game && g.matchday >= 27) {
        label = ({ 27:'NWSL Quarterfinal', 28:'NWSL Semifinal', 29:'NWSL Championship Final' })[g.matchday]
              || 'NWSL Playoff';
      }
      const penaltyNote = g.penalties
        ? ` (${g.home_penalties}–${g.away_penalties} pens)` : g.extra_time ? ' (AET)' : '';

      return {
        id: g.game_id, date, home: g.home_team_id, away: g.away_team_id,
        venue, platforms: [assignStreaming(g)], score, penaltyNote, label,
        status: g.status, attendance: g.attendance, matchday: g.matchday,
        knockout: g.knockout_game,
      };
    }).sort((a, b) => a.date - b.date);
  }

  // ----------------------------------------------------------
  //  Merge NWSL schedule (broadcaster data + upcoming games)
  // ----------------------------------------------------------
  function mergeNwslSchedule(asaGames, nwslGames) {
    // Index ASA games by "homeId_awayId" for fast lookup
    const byTeams = new Map();
    asaGames.forEach(g => byTeams.set(`${g.home}_${g.away}`, g));

    const toAdd = [];
    nwslGames.forEach(ng => {
      if (!ng.home_team_id || !ng.away_team_id) return;
      const key     = `${ng.home_team_id}_${ng.away_team_id}`;
      const asaGame = byTeams.get(key);

      if (asaGame) {
        // Override heuristic platform with real broadcaster data
        if (ng.platforms && ng.platforms.length > 0) asaGame.platforms = ng.platforms;
      } else if (ng.status === 'PreMatch' && ng.date_time_utc) {
        // Upcoming game not yet in ASA — add it
        const date = parseUTC(ng.date_time_utc);
        if (isNaN(date.getTime())) return;
        const platforms = (ng.platforms && ng.platforms.length > 0)
          ? ng.platforms
          : [assignStreaming({ date_time_utc: ng.date_time_utc, matchday: ng.matchday || 1, knockout_game: false })];
        toAdd.push({
          id:          ng.game_id,
          date,
          home:        ng.home_team_id,
          away:        ng.away_team_id,
          venue:       ng.stadium_name || 'Venue TBD',
          platforms,
          score:       null,
          penaltyNote: '',
          label:       null,
          status:      'PreMatch',
          attendance:  null,
          matchday:    ng.matchday,
          knockout:    false,
        });
      }
    });

    return [...asaGames, ...toAdd].sort((a, b) => a.date - b.date);
  }

  // ----------------------------------------------------------
  //  Season tabs
  // ----------------------------------------------------------
  function buildSeasonTabs() {
    const frag = document.createDocumentFragment();
    state.availableSeasons.forEach((year, i) => {
      const btn = document.createElement('button');
      btn.className   = 'season-tab';
      btn.dataset.season = year;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', 'matches-grid');
      if (i === 0) {
        btn.innerHTML = `${year} <span class="season-tab-dot" aria-hidden="true">●</span>`;
      } else {
        btn.textContent = year;
      }
      frag.appendChild(btn);
    });
    dom.seasonTabs.innerHTML = '';
    dom.seasonTabs.appendChild(frag);
  }

  function switchSeason(year, initial = false) {
    state.activeSeason    = year;
    state.revealedMatches = new Set();
    // Always hide scores by default
    state.spoilersHidden  = true;

    // Reset filters unless this is the very first load
    if (!initial) {
      state.filterTeam     = 'all';
      state.filterPlatform = 'all';
      dom.filterTeam.value     = 'all';
      dom.filterPlatform.value = 'all';
    }

    // Update tab UI
    dom.seasonTabs.querySelectorAll('.season-tab').forEach(btn => {
      const active = btn.dataset.season === year;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    updateSpoilerToggle();
    rebuildTeamOptions();
    rebuildMonthFilter();

    const defaultMonth = getDefaultMonth(year);
    state.activeMonth       = defaultMonth;
    dom.filterMonth.value   = defaultMonth;
    updateMonthNav();
    renderSchedule();
  }

  function getDefaultMonth(year) {
    const months = getAvailableMonths(year);
    if (!months.length) return 'all';
    if (year === state.availableSeasons[0]) {
      // Current season: jump to the month closest to today
      const todayYM = TODAY.toISOString().slice(0, 7);
      return months.find(m => m >= todayYM) || months[months.length - 1];
    }
    return months[0]; // Historical: start from the first matchday
  }

  // ----------------------------------------------------------
  //  Filter options
  // ----------------------------------------------------------
  function rebuildTeamOptions() {
    const usedIds = new Set(
      (state.seasonGames[state.activeSeason] || []).flatMap(m => [m.home, m.away])
    );
    const sorted = [...usedIds]
      .map(id => state.teamMap[id]).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    dom.filterTeam.innerHTML = '<option value="all">All teams</option>';
    const frag = document.createDocumentFragment();
    sorted.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.name;
      frag.appendChild(o);
    });
    dom.filterTeam.appendChild(frag);
    dom.filterTeam.value = state.filterTeam;
  }

  function buildPlatformOptions() {
    const frag = document.createDocumentFragment();
    platforms.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      frag.appendChild(o);
    });
    dom.filterPlatform.innerHTML = '<option value="all">All platforms</option>';
    dom.filterPlatform.appendChild(frag);
  }

  // ----------------------------------------------------------
  //  Month filter + pagination
  // ----------------------------------------------------------
  function getAvailableMonths(season = state.activeSeason) {
    // Months that have games after applying team & platform filters
    return [...new Set(
      (state.seasonGames[season] || [])
        .filter(m => {
          if (state.filterTeam !== 'all' && m.home !== state.filterTeam && m.away !== state.filterTeam) return false;
          if (state.filterPlatform !== 'all' && !(m.platforms || []).includes(state.filterPlatform)) return false;
          return true;
        })
        .map(m => m.date.toISOString().slice(0, 7))
    )].sort();
  }

  function rebuildMonthFilter() {
    const months = getAvailableMonths();
    while (dom.filterMonth.options.length > 1) dom.filterMonth.remove(1);
    const frag = document.createDocumentFragment();
    months.forEach(ym => {
      const o = document.createElement('option');
      o.value = ym; o.textContent = fmtMonthYear(ym);
      frag.appendChild(o);
    });
    dom.filterMonth.appendChild(frag);
    // Restore or reset selection
    if (months.includes(state.activeMonth)) {
      dom.filterMonth.value = state.activeMonth;
    } else {
      dom.filterMonth.value = 'all';
      state.activeMonth = 'all';
    }
    updateMonthNav();
  }

  function setMonth(ym) {
    state.activeMonth     = ym;
    dom.filterMonth.value = ym;
    updateMonthNav();
    renderSchedule();
  }

  function navigateMonth(dir) {
    const months = getAvailableMonths();
    if (!months.length) return;
    if (state.activeMonth === 'all') {
      setMonth(dir > 0 ? months[0] : months[months.length - 1]);
      return;
    }
    const idx  = months.indexOf(state.activeMonth);
    const next = idx + dir;
    if (next >= 0 && next < months.length) setMonth(months[next]);
  }

  function updateMonthNav() {
    const months = getAvailableMonths();
    const idx    = months.indexOf(state.activeMonth);
    const inMonth = state.activeMonth !== 'all';
    dom.monthPrev.disabled = !inMonth || idx <= 0;
    dom.monthNext.disabled = !inMonth || idx >= months.length - 1;
    // Show the current month label in the nav bar
    const label = document.getElementById('month-label');
    if (label) label.textContent = inMonth ? fmtMonthYear(state.activeMonth) : 'All months';
  }

  // ----------------------------------------------------------
  //  Spoiler toggle
  // ----------------------------------------------------------
  function toggleGlobalSpoilers() {
    state.spoilersHidden = !state.spoilersHidden;
    if (!state.spoilersHidden) state.revealedMatches = new Set();
    updateSpoilerToggle();
    renderSchedule();
  }

  function updateSpoilerToggle() {
    if (!dom.spoilerToggle) return;
    if (state.spoilersHidden) {
      dom.spoilerToggle.innerHTML = '<span class="spoiler-icon">👁</span> Show All Scores';
      dom.spoilerToggle.classList.add('spoiler-active');
    } else {
      dom.spoilerToggle.innerHTML = '<span class="spoiler-icon">🙈</span> Hide Scores';
      dom.spoilerToggle.classList.remove('spoiler-active');
    }
  }

  // ----------------------------------------------------------
  //  Events
  // ----------------------------------------------------------
  function wireEvents() {
    // Season tab clicks (event delegation)
    dom.seasonTabs.addEventListener('click', e => {
      const btn = e.target.closest('.season-tab');
      if (btn && btn.dataset.season !== state.activeSeason) {
        switchSeason(btn.dataset.season);
      }
    });

    // Team filter
    dom.filterTeam.addEventListener('change', () => {
      state.filterTeam = dom.filterTeam.value;
      rebuildMonthFilter();
      syncActiveMonth();
      renderSchedule();
    });

    // Platform filter
    dom.filterPlatform.addEventListener('change', () => {
      state.filterPlatform = dom.filterPlatform.value;
      rebuildMonthFilter();
      syncActiveMonth();
      renderSchedule();
    });

    // Month dropdown
    dom.filterMonth.addEventListener('change', () => {
      state.activeMonth = dom.filterMonth.value;
      updateMonthNav();
      renderSchedule();
    });

    // Month prev / next
    dom.monthPrev.addEventListener('click', () => navigateMonth(-1));
    dom.monthNext.addEventListener('click', () => navigateMonth(1));

    // Spoiler toggle
    dom.spoilerToggle.addEventListener('click', toggleGlobalSpoilers);

    // Reset button
    dom.filterReset.addEventListener('click', () => {
      state.filterTeam     = 'all';
      state.filterPlatform = 'all';
      dom.filterTeam.value     = 'all';
      dom.filterPlatform.value = 'all';
      rebuildMonthFilter();
      const defaultMonth = getDefaultMonth(state.activeSeason);
      state.activeMonth       = defaultMonth;
      dom.filterMonth.value   = defaultMonth;
      updateMonthNav();
      renderSchedule();
    });

    // Reveal individual score (event delegation on grid)
    dom.matchesGrid.addEventListener('click', e => {
      const btn = e.target.closest('.reveal-score-btn');
      if (btn) {
        state.revealedMatches.add(btn.dataset.id);
        // Replace just this card's VS block instead of full re-render
        const card = btn.closest('.match-card');
        if (card) {
          const match = (state.seasonGames[state.activeSeason] || [])
            .find(m => m.id === btn.dataset.id);
          if (match) {
            const vsBlock = card.querySelector('.vs-block');
            if (vsBlock) vsBlock.outerHTML = buildScoreHTML(match);
          }
        }
      }
    });
  }

  // Ensure activeMonth is still valid after filter change
  function syncActiveMonth() {
    const months = getAvailableMonths();
    if (state.activeMonth !== 'all' && !months.includes(state.activeMonth)) {
      state.activeMonth = months[0] || 'all';
      dom.filterMonth.value = state.activeMonth;
    }
    updateMonthNav();
  }

  // ----------------------------------------------------------
  //  Filtering
  // ----------------------------------------------------------
  function getActiveMatches() {
    return state.seasonGames[state.activeSeason] || [];
  }

  function filterMatches(matches) {
    return matches.filter(m => {
      if (state.filterTeam !== 'all' && m.home !== state.filterTeam && m.away !== state.filterTeam) return false;
      if (state.filterPlatform !== 'all' && !(m.platforms || []).includes(state.filterPlatform)) return false;
      if (state.activeMonth !== 'all' && m.date.toISOString().slice(0, 7) !== state.activeMonth) return false;
      return true;
    });
  }

  // ----------------------------------------------------------
  //  Match status
  // ----------------------------------------------------------
  function getMatchStatus(match) {
    if (match.status === 'Abandoned') return 'abandoned';
    if (match.score !== null)         return 'final';
    const elapsed = TODAY - match.date;
    if (elapsed < 0)                  return 'upcoming';
    if (elapsed < LIVE_WINDOW)        return 'live';
    return 'final';
  }

  // ----------------------------------------------------------
  //  Score HTML builder (used both in card build and in-place reveal)
  // ----------------------------------------------------------
  function buildScoreHTML(match) {
    const status      = getMatchStatus(match);
    const isRevealed  = !state.spoilersHidden || state.revealedMatches.has(match.id);

    if (status === 'live') {
      return `<div class="vs-block"><div class="score-display" style="color:var(--red)">LIVE</div></div>`;
    }
    if ((status === 'final' || status === 'abandoned') && match.score) {
      if (isRevealed) {
        return `<div class="vs-block">
          <div class="score-display">${match.score.home}–${match.score.away}</div>
          ${match.penaltyNote ? `<div class="penalty-note">${match.penaltyNote}</div>` : ''}
        </div>`;
      }
      return `<div class="vs-block">
        <button class="reveal-score-btn" data-id="${match.id}" aria-label="Reveal score for this match">
          <span class="reveal-icon">👁</span> Reveal
        </button>
      </div>`;
    }
    // Upcoming
    return `<div class="vs-block">
      <div class="vs-label">VS</div>
      <div class="kickoff-time">${fmtTime(match.date)}</div>
    </div>`;
  }

  // ----------------------------------------------------------
  //  Build match card element
  // ----------------------------------------------------------
  function buildMatchCard(match) {
    const status   = getMatchStatus(match);
    const home     = state.teamMap[match.home] || fallbackTeam(match.home);
    const away     = state.teamMap[match.away] || fallbackTeam(match.away);
    const isRevealed = !state.spoilersHidden || state.revealedMatches.has(match.id);

    const card = document.createElement('article');
    card.className = 'match-card'
      + (status === 'final' || status === 'abandoned' ? ' is-past' : '')
      + (status === 'live'                            ? ' is-live'  : '');

    const statusText   = { upcoming: 'Upcoming', live: '● Live', final: 'Final', abandoned: 'Abandoned' }[status];
    const platBadges   = (match.platforms || [])
      .map(id => PLATFORM_MAP[id]).filter(Boolean)
      .map(p => `<span class="platform-badge" style="background:${p.color};color:${p.textColor};" title="${p.name}">${p.icon}</span>`)
      .join('');
    const attendHtml = (status === 'final' && match.attendance && isRevealed)
      ? `<div class="card-attendance-row"><span class="card-attendance">🏟 ${match.attendance.toLocaleString()} fans</span></div>`
      : '';

    card.innerHTML = `
      <div class="card-meta">
        <span class="card-date">${fmtDate(match.date)}</span>
        <span class="card-label ${status}">${statusText}</span>
      </div>
      <div class="matchup">
        <div class="team team-home">
          <div class="team-badge" style="background:${home.bg};color:${home.color};">${home.abbreviation}</div>
          <div class="team-name">${home.name}</div>
        </div>
        ${buildScoreHTML(match)}
        <div class="team team-away">
          <div class="team-badge" style="background:${away.bg};color:${away.color};">${away.abbreviation}</div>
          <div class="team-name">${away.name}</div>
        </div>
      </div>
      <div class="card-footer">
        <span class="card-venue" title="${match.venue}">📍 ${match.venue}</span>
        <div class="platform-badges">${platBadges || '<span class="platform-badge" style="background:#2a2a3e;color:#fff;" title="Unknown">?</span>'}</div>
      </div>
      ${attendHtml}
      ${match.label ? `<div class="card-special-label">${match.label}</div>` : ''}
    `;
    return card;
  }

  function fallbackTeam(id) {
    return { name: id, abbreviation: '?', bg: defaultTeamColor.bg, color: defaultTeamColor.color };
  }

  // ----------------------------------------------------------
  //  Render schedule
  // ----------------------------------------------------------
  function renderSchedule() {
    const all      = getActiveMatches();
    const filtered = filterMatches(all);

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

    const monthLabel = state.activeMonth !== 'all'
      ? ` in ${fmtMonthYear(state.activeMonth)}` : '';
    dom.matchCount.innerHTML =
      `Showing <strong>${filtered.length}</strong> of <strong>${all.length}</strong> matches${monthLabel}`;
  }

  // ----------------------------------------------------------
  //  Hero stats
  // ----------------------------------------------------------
  function updateHeroStats() {
    const total = Object.values(state.seasonGames).reduce((s, g) => s + g.length, 0);
    if (dom.heroTeams)     dom.heroTeams.textContent     = Object.keys(state.teamMap).length;
    if (dom.heroMatches)   dom.heroMatches.textContent   = total;
    if (dom.heroPlatforms) dom.heroPlatforms.textContent = platforms.length;
  }

  // ----------------------------------------------------------
  //  Loading / error states
  // ----------------------------------------------------------
  function showLoadingState() {
    dom.matchesGrid.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading NWSL data…</div>
      </div>`;
    dom.matchCount.textContent = 'Loading…';
  }

  function showErrorState() {
    dom.matchesGrid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">⚠️</div>
        <div class="no-results-text">Could not load schedule data</div>
        <div class="no-results-sub">Visit <a href="https://www.nwsl.com" target="_blank" rel="noopener">nwsl.com</a></div>
      </div>`;
  }

  // ----------------------------------------------------------
  //  Standings
  // ----------------------------------------------------------
  function buildStandings(data) {
    const wrap = document.getElementById('standings-wrap');
    if (!wrap) return;

    const rows = data && Array.isArray(data.teams) ? data.teams : [];
    if (!rows.length) {
      wrap.innerHTML = '<p class="standings-empty">Standings not yet available.</p>';
      return;
    }

    // Column definitions
    const cols = [
      { key: 'rank',  label: '#',   title: 'Rank' },
      { key: 'team',  label: 'Team',title: 'Team', wide: true },
      { key: 'p',     label: 'P',   title: 'Played' },
      { key: 'w',     label: 'W',   title: 'Wins' },
      { key: 'd',     label: 'D',   title: 'Draws' },
      { key: 'l',     label: 'L',   title: 'Losses' },
      { key: 'gf',    label: 'GF',  title: 'Goals For' },
      { key: 'ga',    label: 'GA',  title: 'Goals Against' },
      { key: 'gd',    label: 'GD',  title: 'Goal Difference' },
      { key: 'pts',   label: 'PTS', title: 'Points' },
      { key: 'form',  label: 'Form',title: 'Recent form (newest right)' },
    ];

    const thead = `<thead><tr>${cols.map(c =>
      `<th ${c.wide ? 'class="col-team"' : ''} title="${c.title}">${c.label}</th>`
    ).join('')}</tr></thead>`;

    const tbody = rows.map(t => {
      const tc = teamColors[t.asa_team_id] || defaultTeamColor;
      const badge = `<div class="standings-badge" style="background:${tc.bg};color:${tc.color};">${t.acronym || '?'}</div>`;
      const formDots = (t.form || []).slice(-5).map(f => {
        const cls = f === 'W' ? 'form-w' : f === 'D' ? 'form-d' : 'form-l';
        const lbl = f === 'W' ? 'Win' : f === 'D' ? 'Draw' : 'Loss';
        return `<span class="form-dot ${cls}" title="${lbl}"></span>`;
      }).join('');
      const gdStr = t.gd > 0 ? `+${t.gd}` : String(t.gd);
      const zoneClass = t.playoff_zone ? ' playoff-zone' : '';

      return `<tr class="standings-row${zoneClass}">
        <td class="col-rank">${t.rank}</td>
        <td class="col-team"><div class="standings-team-cell">${badge}<span class="standings-name">${t.name}</span></div></td>
        <td>${t.p}</td>
        <td>${t.w}</td>
        <td>${t.d}</td>
        <td>${t.l}</td>
        <td>${t.gf}</td>
        <td>${t.ga}</td>
        <td class="${t.gd > 0 ? 'gd-pos' : t.gd < 0 ? 'gd-neg' : ''}">${gdStr}</td>
        <td class="col-pts">${t.pts}</td>
        <td class="col-form"><div class="form-dots">${formDots}</div></td>
      </tr>`;
    }).join('');

    const lastPlayoff = rows.filter(r => r.playoff_zone).length;
    const legend = lastPlayoff > 0
      ? `<div class="standings-legend"><span class="legend-dot playoff-zone"></span> Top ${lastPlayoff} qualify for playoffs</div>`
      : '';

    wrap.innerHTML = `
      <div class="standings-scroll">
        <table class="standings-table" aria-label="2026 NWSL Standings">
          ${thead}<tbody>${tbody}</tbody>
        </table>
      </div>
      ${legend}`;
  }

  // ----------------------------------------------------------
  //  Streaming guide
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
        </div>`;
      frag.appendChild(card);
    });
    dom.streamingGrid.appendChild(frag);
  }

  // ----------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------
  function parseUTC(str) {
    return new Date(str.replace(' ', 'T').replace(' UTC', 'Z'));
  }

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
    'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
  };
  function abbrevState(s)    { return STATE_ABBR[s] || s; }
  function fmtDate(d)        { return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }); }
  function fmtTime(d)        { return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }); }
  function fmtMonthYear(ym)  { const [y,m] = ym.split('-'); return `${MONTH_NAMES[+m-1]} ${y}`; }

  // ----------------------------------------------------------
  //  Theme switcher
  // ----------------------------------------------------------
  function initTheme() {
    const saved = localStorage.getItem('nwsl-theme') || 'dark';
    applyTheme(saved);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nwsl-theme', theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.theme === theme ? 'true' : 'false');
    });
  }

  // ----------------------------------------------------------
  //  Bootstrap
  // ----------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initTheme(); boot(); });
  } else {
    initTheme();
    boot();
  }

})();
