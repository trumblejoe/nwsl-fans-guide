/* ============================================================
   NWSL Fan's Guide — Data Loader
   Loads pre-fetched JSON files from the data/ directory.
   These are refreshed at deploy time by the GitHub Actions
   workflow, which pulls from the American Soccer Analysis API.
   No CORS issues — all requests are same-origin.
   ============================================================ */

const NWSL_API = (() => {
  async function get(file) {
    const res = await fetch(`./data/${file}`);
    if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
    return res.json();
  }

  return {
    async loadAll() {
      const [teams, stadia, games2025, games2024] = await Promise.all([
        get('teams.json'),
        get('stadia.json'),
        get('games-2025.json'),
        get('games-2024.json'),
      ]);
      return { teams, stadia, games2025, games2024 };
    }
  };
})();
