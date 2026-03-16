/* ============================================================
   NWSL Fan's Guide — App Logic
   Vanilla JS — no build tools, no frameworks, no dependencies
   ============================================================ */

(function () {
  'use strict';

  // ----------------------------------------------------------
  //  Constants — derived from data.js (NWSL_DATA global)
  // ----------------------------------------------------------
  const { teams, platforms, matches2025, matches2024 } = NWSL_DATA;

  // Quick lookup maps
  const TEAM_MAP     = Object.fromEntries(teams.map(t => [t.id, t]));
  const PLATFORM_MAP = Object.fromEntries(platforms.map(p => [p.id, p]));

  // "Today" for status calculation: treat as 2026-03-15 per spec
  // (all 2025 matches are in the past, so they'll all show FINAL)
  const TODAY = new Date('2026-03-15T12:00:00');

  // Match window: a match is LIVE for 2 hours after kickoff
  const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

  // ----------------------------------------------------------
  //  State
  // ----------------------------------------------------------
  let state = {
    activeSeason: '2025',
    filterTeam:     'all',
    filterPlatform: 'all',
    filterMonth:    'all',
  };

  // ----------------------------------------------------------
  //  DOM refs (populated after DOMContentLoaded)
  // ----------------------------------------------------------
  let dom = {};

  // ----------------------------------------------------------
  //  Initialisation
  // ----------------------------------------------------------
  function init() {
    cacheDOM();
    buildStreamingGuide();
    buildFilterOptions();
    wireEvents();
    renderSchedule();
    updateHeroStats();
  }

  function cacheDOM() {
    dom.seasonTabs    = document.querySelectorAll('.season-tab');
    dom.matchesGrid   = document.getElementById('matches-grid');
    dom.matchCount    = document.getElementById('match-count');
    dom.filterTeam    = document.getElementById('filter-team');
    dom.filterPlatform= document.getElementById('filter-platform');
    dom.filterMonth   = document.getElementById('filter-month');
    dom.filterReset   = document.getElementById('filter-reset');
    dom.streamingGrid = document.getElementById('streaming-grid');
    dom.heroTeams     = document.getElementById('hero-teams-count');
    dom.heroMatches   = document.getElementById('hero-matches-count');
    dom.heroPlatforms = document.getElementById('hero-platforms-count');
  }

  // ----------------------------------------------------------
  //  Hero stats
  // ----------------------------------------------------------
  function updateHeroStats() {
    if (dom.heroTeams)     dom.heroTeams.textContent     = teams.length;
    if (dom.heroMatches)   dom.heroMatches.textContent   = matches2025.length + matches2024.length;
    if (dom.heroPlatforms) dom.heroPlatforms.textContent = platforms.length;
  }

  // ----------------------------------------------------------
  //  Build filter <option> lists dynamically
  // ----------------------------------------------------------
  function buildFilterOptions() {
    // Teams
    const teamFrag = document.createDocumentFragment();
    teams.slice().sort((a,b) => a.name.localeCompare(b.name)).forEach(t => {
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
  //  Wire up events
  // ----------------------------------------------------------
  function wireEvents() {
    // Season tabs
    dom.seasonTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeSeason = tab.dataset.season;
        dom.seasonTabs.forEach(t => t.classList.toggle('active', t === tab));
        resetFilters(false);
        rebuildMonthFilter();
        renderSchedule();
      });
    });

    // Filters
    [dom.filterTeam, dom.filterPlatform, dom.filterMonth].forEach(sel => {
      sel.addEventListener('change', () => {
        state.filterTeam     = dom.filterTeam.value;
        state.filterPlatform = dom.filterPlatform.value;
        state.filterMonth    = dom.filterMonth.value;
        renderSchedule();
      });
    });

    // Reset
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
  //  Rebuild month filter options based on active season data
  // ----------------------------------------------------------
  function rebuildMonthFilter() {
    const matches = getActiveMatches();
    const months = [...new Set(matches.map(m => {
      const d = new Date(m.date);
      return d.toISOString().slice(0, 7); // "YYYY-MM"
    }))].sort();

    // Clear existing dynamic options (keep first "All months")
    while (dom.filterMonth.options.length > 1) {
      dom.filterMonth.remove(1);
    }

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    months.forEach(ym => {
      const [year, month] = ym.split('-');
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = `${MONTH_NAMES[parseInt(month,10)-1]} ${year}`;
      dom.filterMonth.appendChild(opt);
    });
  }

  // ----------------------------------------------------------
  //  Get match list for active season
  // ----------------------------------------------------------
  function getActiveMatches() {
    return state.activeSeason === '2025' ? matches2025 : matches2024;
  }

  // ----------------------------------------------------------
  //  Compute match status
  // ----------------------------------------------------------
  function getMatchStatus(match) {
    // 2024 historical — always FINAL
    if (match.score !== null) return 'final';

    const kickoff = new Date(match.date);
    const elapsed = TODAY - kickoff;

    if (elapsed < 0)              return 'upcoming';
    if (elapsed < LIVE_WINDOW_MS) return 'live';
    return 'final';
  }

  // ----------------------------------------------------------
  //  Filter matches
  // ----------------------------------------------------------
  function filterMatches(matches) {
    return matches.filter(m => {
      if (state.filterTeam !== 'all' &&
          m.home !== state.filterTeam && m.away !== state.filterTeam) return false;

      if (state.filterPlatform !== 'all' && m.platform !== state.filterPlatform) return false;

      if (state.filterMonth !== 'all') {
        const ym = new Date(m.date).toISOString().slice(0, 7);
        if (ym !== state.filterMonth) return false;
      }

      return true;
    });
  }

  // ----------------------------------------------------------
  //  Format helpers
  // ----------------------------------------------------------
  function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function formatTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  }

  // ----------------------------------------------------------
  //  Build a match card element
  // ----------------------------------------------------------
  function buildMatchCard(match) {
    const status   = getMatchStatus(match);
    const home     = TEAM_MAP[match.home];
    const away     = TEAM_MAP[match.away];
    const platform = PLATFORM_MAP[match.platform];

    const card = document.createElement('article');
    card.className = 'match-card' +
      (status === 'final'   ? ' is-past' : '') +
      (status === 'live'    ? ' is-live'  : '');

    // --- Status label text/class ---
    const statusClass = status;
    const statusText  = status === 'upcoming' ? 'Upcoming'
                      : status === 'live'     ? '● Live'
                      :                         'Final';

    // --- Score or VS block ---
    let vsHtml;
    if (status === 'final' && match.score) {
      vsHtml = `<div class="vs-block">
                  <div class="score-display">${match.score.home}–${match.score.away}</div>
                </div>`;
    } else if (status === 'live') {
      vsHtml = `<div class="vs-block">
                  <div class="score-display" style="color:var(--red)">LIVE</div>
                </div>`;
    } else {
      vsHtml = `<div class="vs-block">
                  <div class="vs-label">VS</div>
                  <div style="font-size:0.7rem;color:var(--white-faint);margin-top:4px;">${formatTime(match.date)}</div>
                </div>`;
    }

    // --- Platform badge ---
    const platStyle = `background:${platform.color};color:${platform.textColor};`;

    // --- Special label (championship, etc.) ---
    const specialHtml = match.label
      ? `<div class="card-special-label">${match.label}</div>`
      : '';

    card.innerHTML = `
      <div class="card-meta">
        <span class="card-date">${formatDate(match.date)}</span>
        <span class="card-label ${statusClass}">${statusText}</span>
      </div>

      <div class="matchup">
        <div class="team team-home">
          <div class="team-badge" style="background:${home.bg};">${home.id}</div>
          <div class="team-name">${home.name}</div>
        </div>

        ${vsHtml}

        <div class="team team-away">
          <div class="team-badge" style="background:${away.bg};">${away.id}</div>
          <div class="team-name">${away.name}</div>
        </div>
      </div>

      <div class="card-footer">
        <span class="card-venue" title="${match.venue}">📍 ${match.venue}</span>
        <span class="platform-badge" style="${platStyle}">${platform.icon}</span>
      </div>

      ${specialHtml}
    `;

    return card;
  }

  // ----------------------------------------------------------
  //  Render schedule
  // ----------------------------------------------------------
  function renderSchedule() {
    const allMatches      = getActiveMatches();
    const filtered        = filterMatches(allMatches);
    const total           = allMatches.length;

    // Clear grid
    dom.matchesGrid.innerHTML = '';

    if (filtered.length === 0) {
      dom.matchesGrid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">⚽</div>
          <div class="no-results-text">No matches found</div>
          <div class="no-results-sub">Try adjusting your filters</div>
        </div>`;
    } else {
      // Re-trigger CSS animations by cloning grid
      const frag = document.createDocumentFragment();
      filtered.forEach(m => frag.appendChild(buildMatchCard(m)));
      dom.matchesGrid.appendChild(frag);
    }

    // Update count
    dom.matchCount.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${total}</strong> matches`;

    // Rebuild month options if season just changed (called from wireEvents too)
    if (dom.filterMonth.options.length <= 1) rebuildMonthFilter();
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
  //  Bootstrap on DOM ready
  // ----------------------------------------------------------
  //  Bootstrap — also builds month filter options on first load
  // ----------------------------------------------------------
  function boot() {
    init();
    rebuildMonthFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
