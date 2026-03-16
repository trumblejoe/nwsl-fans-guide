// ============================================================
//  NWSL Fan's Guide — Data Layer
//  All schedule and streaming data is hardcoded here.
// ============================================================

const NWSL_DATA = {

  // ----------------------------------------------------------
  //  Teams
  // ----------------------------------------------------------
  teams: [
    { id: "POR", name: "Portland Thorns FC",       color: "#8B1A1A", bg: "#6B1212" },
    { id: "KC",  name: "Kansas City Current",       color: "#00A3E0", bg: "#005F8E" },
    { id: "NJY", name: "NJ/NY Gotham FC",           color: "#1C2B4A", bg: "#0D1F3C" },
    { id: "CHI", name: "Chicago Red Stars",          color: "#C8102E", bg: "#9B0D24" },
    { id: "SEA", name: "OL Reign FC",               color: "#002244", bg: "#001533" },
    { id: "NC",  name: "North Carolina Courage",    color: "#EF3E42", bg: "#C2292D" },
    { id: "HOU", name: "Houston Dash",              color: "#F5A623", bg: "#C47C0A" },
    { id: "WAS", name: "Washington Spirit",         color: "#1A3D7C", bg: "#102860" },
    { id: "ORL", name: "Orlando Pride",             color: "#5A2D8E", bg: "#3D1C66" },
    { id: "ACF", name: "Angel City FC",             color: "#000000", bg: "#1a1a1a" },
    { id: "SD",  name: "San Diego Wave FC",         color: "#005EB8", bg: "#003D7A" },
    { id: "LOU", name: "Racing Louisville FC",      color: "#6CACE4", bg: "#3A7BB5" },
    { id: "BOS", name: "Boston Legacy FC",          color: "#1E5799", bg: "#0D3D6E" },
    { id: "UTH", name: "Utah Royals FC",            color: "#8B2FC9", bg: "#5E1A8A" },
    { id: "BAY", name: "Bay FC",                    color: "#1A6B3C", bg: "#0E4526" },
  ],

  // ----------------------------------------------------------
  //  Streaming platforms
  // ----------------------------------------------------------
  platforms: [
    {
      id: "CBS",
      name: "CBS Sports",
      color: "#003791",
      textColor: "#ffffff",
      description: "National broadcast games on CBS network",
      includes: "National broadcast games, NWSL Championship",
      subscription: "Free with TV / antenna",
      icon: "CBS"
    },
    {
      id: "PAR",
      name: "Paramount+",
      color: "#0064FF",
      textColor: "#ffffff",
      description: "Streaming home of NWSL, including exclusive matches",
      includes: "All NWSL matches, playoffs, archive",
      subscription: "From $5.99/mo",
      icon: "P+"
    },
    {
      id: "NWSL",
      name: "NWSL+",
      color: "#1DB954",
      textColor: "#ffffff",
      description: "Official NWSL streaming platform",
      includes: "Out-of-market games, replays, highlights",
      subscription: "Free / Premium tier",
      icon: "N+"
    },
    {
      id: "AMZ",
      name: "Amazon Prime Video",
      color: "#FF9900",
      textColor: "#000000",
      description: "Prime Video exclusive NWSL package",
      includes: "Select national games, Friday night matches",
      subscription: "Included with Prime ($14.99/mo)",
      icon: "PV"
    },
    {
      id: "ESPN",
      name: "ESPN",
      color: "#CC0000",
      textColor: "#ffffff",
      description: "ESPN network broadcast matches",
      includes: "Select national games, rivalry matches",
      subscription: "Requires cable/satellite or live TV",
      icon: "ESPN"
    },
    {
      id: "ESPNP",
      name: "ESPN+",
      color: "#E01010",
      textColor: "#ffffff",
      description: "ESPN's streaming service with NWSL coverage",
      includes: "Regional games, select national games",
      subscription: "From $10.99/mo",
      icon: "E+"
    }
  ],

  // ----------------------------------------------------------
  //  Venues
  // ----------------------------------------------------------
  venues: {
    POR: "Providence Park, Portland OR",
    KC:  "CPKC Stadium, Kansas City MO",
    NJY: "Red Bull Arena, Harrison NJ",
    CHI: "Wrigley Field (select), Chicago IL",
    SEA: "Lumen Field (select), Seattle WA",
    NC:  "WakeMed Soccer Park, Cary NC",
    HOU: "Shell Energy Stadium, Houston TX",
    WAS: "Audi Field, Washington DC",
    ORL: "Inter&Co Stadium, Orlando FL",
    ACF: "BMO Stadium, Los Angeles CA",
    SD:  "Snapdragon Stadium, San Diego CA",
    LOU: "Lynn Family Stadium, Louisville KY",
    BOS: "Gillette Stadium (select), Foxborough MA",
    UTH: "America First Field, Sandy UT",
    BAY: "PayPal Park, San Jose CA",
  },

  // ----------------------------------------------------------
  //  2025 Season — ~20 sample matches
  //  status will be computed at runtime by app.js
  // ----------------------------------------------------------
  matches2025: [
    {
      id: "25-001",
      date: "2025-03-15T19:00:00",
      home: "KC",
      away: "POR",
      venue: "CPKC Stadium, Kansas City MO",
      platform: "PAR",
      score: null
    },
    {
      id: "25-002",
      date: "2025-03-15T21:30:00",
      home: "ACF",
      away: "SD",
      venue: "BMO Stadium, Los Angeles CA",
      platform: "NWSL",
      score: null
    },
    {
      id: "25-003",
      date: "2025-03-22T14:00:00",
      home: "NJY",
      away: "WAS",
      venue: "Red Bull Arena, Harrison NJ",
      platform: "CBS",
      score: null
    },
    {
      id: "25-004",
      date: "2025-03-22T16:30:00",
      home: "NC",
      away: "CHI",
      venue: "WakeMed Soccer Park, Cary NC",
      platform: "PAR",
      score: null
    },
    {
      id: "25-005",
      date: "2025-03-29T18:00:00",
      home: "ORL",
      away: "HOU",
      venue: "Inter&Co Stadium, Orlando FL",
      platform: "ESPNP",
      score: null
    },
    {
      id: "25-006",
      date: "2025-04-05T19:30:00",
      home: "UTH",
      away: "BAY",
      venue: "America First Field, Sandy UT",
      platform: "AMZ",
      score: null
    },
    {
      id: "25-007",
      date: "2025-04-05T21:00:00",
      home: "SEA",
      away: "POR",
      venue: "Lumen Field, Seattle WA",
      platform: "ESPN",
      score: null
    },
    {
      id: "25-008",
      date: "2025-04-12T14:00:00",
      home: "WAS",
      away: "NJY",
      venue: "Audi Field, Washington DC",
      platform: "CBS",
      score: null
    },
    {
      id: "25-009",
      date: "2025-04-19T19:00:00",
      home: "CHI",
      away: "KC",
      venue: "SeatGeek Stadium, Bridgeview IL",
      platform: "PAR",
      score: null
    },
    {
      id: "25-010",
      date: "2025-04-26T20:00:00",
      home: "BAY",
      away: "ACF",
      venue: "PayPal Park, San Jose CA",
      platform: "AMZ",
      score: null
    },
    {
      id: "25-011",
      date: "2025-05-03T18:00:00",
      home: "HOU",
      away: "NC",
      venue: "Shell Energy Stadium, Houston TX",
      platform: "ESPNP",
      score: null
    },
    {
      id: "25-012",
      date: "2025-05-10T19:30:00",
      home: "LOU",
      away: "BOS",
      venue: "Lynn Family Stadium, Louisville KY",
      platform: "NWSL",
      score: null
    },
    {
      id: "25-013",
      date: "2025-05-17T14:00:00",
      home: "POR",
      away: "SEA",
      venue: "Providence Park, Portland OR",
      platform: "CBS",
      score: null
    },
    {
      id: "25-014",
      date: "2025-06-07T17:00:00",
      home: "SD",
      away: "UTH",
      venue: "Snapdragon Stadium, San Diego CA",
      platform: "ESPN",
      score: null
    },
    {
      id: "25-015",
      date: "2025-06-14T19:00:00",
      home: "BOS",
      away: "WAS",
      venue: "Gillette Stadium, Foxborough MA",
      platform: "PAR",
      score: null
    },
    {
      id: "25-016",
      date: "2025-07-04T20:00:00",
      home: "KC",
      away: "ORL",
      venue: "CPKC Stadium, Kansas City MO",
      platform: "AMZ",
      score: null
    },
    {
      id: "25-017",
      date: "2025-07-19T19:30:00",
      home: "NJY",
      away: "CHI",
      venue: "Red Bull Arena, Harrison NJ",
      platform: "ESPNP",
      score: null
    },
    {
      id: "25-018",
      date: "2025-08-09T18:00:00",
      home: "ACF",
      away: "BAY",
      venue: "BMO Stadium, Los Angeles CA",
      platform: "CBS",
      score: null
    },
    {
      id: "25-019",
      date: "2025-09-13T15:00:00",
      home: "SEA",
      away: "KC",
      venue: "Lumen Field, Seattle WA",
      platform: "PAR",
      score: null
    },
    {
      id: "25-020",
      date: "2025-10-25T18:00:00",
      home: "NJY",
      away: "KC",
      venue: "Red Bull Arena, Harrison NJ",
      platform: "CBS",
      score: null,
      label: "NWSL Championship Final"
    }
  ],

  // ----------------------------------------------------------
  //  2024 Historical Season — 15 past matches with scores
  // ----------------------------------------------------------
  matches2024: [
    {
      id: "24-001",
      date: "2024-03-16T19:00:00",
      home: "KC",
      away: "POR",
      venue: "CPKC Stadium, Kansas City MO",
      platform: "PAR",
      score: { home: 2, away: 1 }
    },
    {
      id: "24-002",
      date: "2024-03-23T14:00:00",
      home: "NJY",
      away: "WAS",
      venue: "Red Bull Arena, Harrison NJ",
      platform: "CBS",
      score: { home: 0, away: 0 }
    },
    {
      id: "24-003",
      date: "2024-04-06T21:00:00",
      home: "SEA",
      away: "POR",
      venue: "Lumen Field, Seattle WA",
      platform: "ESPN",
      score: { home: 3, away: 1 }
    },
    {
      id: "24-004",
      date: "2024-04-13T19:30:00",
      home: "ACF",
      away: "SD",
      venue: "BMO Stadium, Los Angeles CA",
      platform: "NWSL",
      score: { home: 1, away: 2 }
    },
    {
      id: "24-005",
      date: "2024-04-20T18:00:00",
      home: "NC",
      away: "CHI",
      venue: "WakeMed Soccer Park, Cary NC",
      platform: "PAR",
      score: { home: 2, away: 0 }
    },
    {
      id: "24-006",
      date: "2024-05-04T19:00:00",
      home: "ORL",
      away: "HOU",
      venue: "Inter&Co Stadium, Orlando FL",
      platform: "ESPNP",
      score: { home: 4, away: 2 }
    },
    {
      id: "24-007",
      date: "2024-05-11T14:00:00",
      home: "WAS",
      away: "BOS",
      venue: "Audi Field, Washington DC",
      platform: "CBS",
      score: { home: 1, away: 1 }
    },
    {
      id: "24-008",
      date: "2024-05-18T20:00:00",
      home: "BAY",
      away: "UTH",
      venue: "PayPal Park, San Jose CA",
      platform: "AMZ",
      score: { home: 3, away: 0 }
    },
    {
      id: "24-009",
      date: "2024-06-08T19:30:00",
      home: "CHI",
      away: "KC",
      venue: "SeatGeek Stadium, Bridgeview IL",
      platform: "PAR",
      score: { home: 0, away: 3 }
    },
    {
      id: "24-010",
      date: "2024-06-22T17:00:00",
      home: "SD",
      away: "ACF",
      venue: "Snapdragon Stadium, San Diego CA",
      platform: "ESPN",
      score: { home: 2, away: 2 }
    },
    {
      id: "24-011",
      date: "2024-07-06T20:00:00",
      home: "KC",
      away: "NJY",
      venue: "CPKC Stadium, Kansas City MO",
      platform: "AMZ",
      score: { home: 1, away: 0 }
    },
    {
      id: "24-012",
      date: "2024-08-10T18:00:00",
      home: "POR",
      away: "SEA",
      venue: "Providence Park, Portland OR",
      platform: "CBS",
      score: { home: 2, away: 1 }
    },
    {
      id: "24-013",
      date: "2024-08-31T19:30:00",
      home: "LOU",
      away: "NC",
      venue: "Lynn Family Stadium, Louisville KY",
      platform: "NWSL",
      score: { home: 0, away: 2 }
    },
    {
      id: "24-014",
      date: "2024-09-28T14:00:00",
      home: "ORL",
      away: "KC",
      venue: "Inter&Co Stadium, Orlando FL",
      platform: "CBS",
      score: { home: 2, away: 3 },
      label: "NWSL Playoff Semifinal"
    },
    {
      id: "24-015",
      date: "2024-11-23T15:00:00",
      home: "ORL",
      away: "NJY",
      venue: "CPKC Stadium, Kansas City MO",
      platform: "CBS",
      score: { home: 1, away: 0 },
      label: "NWSL Championship Final"
    }
  ]
};
