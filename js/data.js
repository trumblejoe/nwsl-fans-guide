/* ============================================================
   NWSL Fan's Guide — Static Data Layer
   Team colors keyed by API team_id.
   Streaming platform metadata + assignment logic.
   Schedule data comes live from NWSL_API (api.js).
   ============================================================ */

const NWSL_STATIC = {

  // ----------------------------------------------------------
  //  Team colors — keyed by team_id from ASA API
  // ----------------------------------------------------------
  teamColors: {
    '2lqRn34qr0': { bg: '#1B4F8A', color: '#FFFFFF' }, // Denver Summit FC
    '315VnJ759x': { bg: '#0A2240', color: '#C9A84C' }, // Bay FC
    '4JMAk47qKg': { bg: '#F47920', color: '#002F65' }, // Houston Dash
    '4wM4Ezg5jB': { bg: '#003087', color: '#FFFFFF' }, // Boston Breakers (historical)
    '4wM4rZdqjB': { bg: '#00B2A9', color: '#13294B' }, // Kansas City Current
    '7VqG1lYMvW': { bg: '#005EB8', color: '#FFFFFF' }, // San Diego Wave FC
    '7vQ7BBzqD1': { bg: '#002D72', color: '#89CFF0' }, // Seattle Reign FC
    'KPqjw8PQ6v': { bg: '#1E3E7B', color: '#FFFFFF' }, // Chicago Stars FC
    'Pk5LeeNqOW': { bg: '#8B1A1A', color: '#FFFFFF' }, // Portland Thorns FC
    'XVqKeVKM01': { bg: '#5B2C8C', color: '#FFFFFF' }, // Orlando Pride
    'aDQ0lzvQEv': { bg: '#1B3A6B', color: '#CC0000' }, // Washington Spirit
    'eV5D2w9QKn': { bg: '#7B2D8B', color: '#FFFFFF' }, // Utah Royals FC
    'eV5DR6YQKn': { bg: '#6CACE4', color: '#002147' }, // Racing Louisville FC
    'kRQa8JOqKZ': { bg: '#1A1A1A', color: '#B5985A' }, // Angel City FC
    'kRQaWa15KZ': { bg: '#003087', color: '#FFFFFF' }, // FC Kansas City (historical)
    'odMX2OJqYL': { bg: '#0C2340', color: '#FFFFFF' }, // Boston Legacy FC
    'raMyrr25d2': { bg: '#1C2B4A', color: '#C9A84C' }, // NJ/NY Gotham FC
    'xW5pwDBMg1': { bg: '#003087', color: '#FFFFFF' }, // Western New York Flash (hist.)
    'zeQZeazqKw': { bg: '#C8102E', color: '#FFFFFF' }, // North Carolina Courage
  },

  // Default color for any team not in the map above
  defaultTeamColor: { bg: '#2a2a3e', color: '#FFFFFF' },

  // ----------------------------------------------------------
  //  Streaming platforms
  // ----------------------------------------------------------
  platforms: [
    {
      id: 'CBS',
      name: 'CBS Sports',
      color: '#003791',
      textColor: '#FFFFFF',
      icon: 'CBS',
      description: 'National broadcast games on the CBS network',
      includes: 'National broadcast games, NWSL Championship Final',
      subscription: 'Free with TV / antenna',
    },
    {
      id: 'PAR',
      name: 'Paramount+',
      color: '#0064FF',
      textColor: '#FFFFFF',
      icon: 'P+',
      description: 'Primary streaming home of the NWSL',
      includes: 'Select national games, full replays, archive',
      subscription: 'From $7.99/mo',
    },
    {
      id: 'NWSL',
      name: 'NWSL+',
      color: '#17A85A',
      textColor: '#FFFFFF',
      icon: 'N+',
      description: 'Official NWSL streaming platform',
      includes: 'Out-of-market games, replays, highlights, free tier',
      subscription: 'Free / Premium tier available',
    },
    {
      id: 'AMZ',
      name: 'Amazon Prime Video',
      color: '#FF9900',
      textColor: '#111111',
      icon: 'PV',
      description: 'Friday night NWSL on Prime Video',
      includes: 'Select Friday night national games',
      subscription: 'Included with Prime ($14.99/mo)',
    },
    {
      id: 'ESPN',
      name: 'ESPN',
      color: '#CC0000',
      textColor: '#FFFFFF',
      icon: 'ESPN',
      description: 'ESPN network broadcast matches',
      includes: 'Select national games, rivalry matches',
      subscription: 'Requires cable / live TV provider',
    },
    {
      id: 'ESPNP',
      name: 'ESPN+',
      color: '#C8001A',
      textColor: '#FFFFFF',
      icon: 'E+',
      description: "ESPN's streaming service with NWSL coverage",
      includes: 'Regional games, select national matches',
      subscription: 'From $11.99/mo',
    },
    {
      id: 'VIC',
      name: 'Victory+',
      color: '#1A1A1A',
      textColor: '#F5C518',
      icon: 'V+',
      description: 'Free ad-supported streaming from Endeavor',
      includes: 'Select NWSL games, free to watch',
      subscription: 'Free (no subscription required)',
    },
  ],

  // ----------------------------------------------------------
  //  Streaming assignment
  //  Heuristic based on NWSL's real broadcast deal structure:
  //    - Knockout / championship games → CBS (biggest platform)
  //    - Friday kickoffs           → Amazon Prime
  //    - Saturday, every 4th match → CBS
  //    - Saturday other            → Paramount+ / ESPN+ alternating
  //    - Sunday                    → ESPN+
  //    - Midweek                   → NWSL+
  // ----------------------------------------------------------
  assignStreaming(game) {
    const d = new Date(game.date_time_utc.replace(' ', 'T').replace(' UTC', 'Z'));
    const day = d.getUTCDay();   // 0=Sun 1=Mon … 5=Fri 6=Sat
    const matchday = game.matchday || 1;

    if (game.knockout_game)                       return 'CBS';
    if (day === 5)                                return 'AMZ';  // Friday
    if (day === 6 && matchday % 4 === 0)          return 'CBS';  // select Saturdays
    if (day === 6)                                return matchday % 2 === 0 ? 'PAR' : 'ESPNP';
    if (day === 0)                                return 'ESPNP'; // Sunday
    return 'NWSL';                                               // midweek
  },
};
