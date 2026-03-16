/* ============================================================
   NWSL Fan's Guide — American Soccer Analysis API Client
   https://app.americansocceranalysis.com/api/v1/__docs__/
   No auth required. All endpoints return JSON arrays.
   ============================================================ */

const NWSL_API = (() => {
  const BASE = 'https://app.americansocceranalysis.com/api/v1';

  async function get(path) {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    const data = await res.json();
    if (data && data.error) throw new Error(`API error: ${data.error}`);
    return data;
  }

  return {
    fetchTeams:       ()       => get('/nwsl/teams'),
    fetchStadia:      ()       => get('/nwsl/stadia'),
    fetchGames:       (season) => get(`/nwsl/games?season_name=${season}`),

    async loadAll() {
      const [teams, stadia, games2025, games2024] = await Promise.all([
        this.fetchTeams(),
        this.fetchStadia(),
        this.fetchGames('2025'),
        this.fetchGames('2024'),
      ]);
      return { teams, stadia, games2025, games2024 };
    }
  };
})();
