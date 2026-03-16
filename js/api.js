/* ============================================================
   NWSL Fan's Guide — Data Loader
   Loads pre-fetched JSON files from the data/ directory.
   These are refreshed at deploy time by the GitHub Actions
   workflow, which pulls from the American Soccer Analysis API.
   No CORS issues — all requests are same-origin.
   ============================================================ */

const NWSL_API = (() => {
  const SEASONS = ['2016','2017','2018','2019','2020','2021','2022','2023','2024','2025','2026'];

  async function get(file) {
    const res = await fetch(`./data/${file}`);
    if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
    return res.json();
  }

  return {
    SEASONS,
    async loadAll() {
      const [teams, stadia, nwslSchedule, nwslStandings, ...seasonArrays] = await Promise.all([
        get('teams.json'),
        get('stadia.json'),
        get('nwsl-schedule.json').catch(() => ({ games: [] })),
        get('nwsl-standings.json').catch(() => ({ teams: [] })),
        ...SEASONS.map(s => get(`games-${s}.json`).catch(() => [])),
      ]);
      const games = Object.fromEntries(SEASONS.map((s, i) => [s, seasonArrays[i]]));
      return { teams, stadia, games, nwslSchedule, nwslStandings };
    }
  };
})();
