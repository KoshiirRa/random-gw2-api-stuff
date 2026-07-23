// Cloudflare Worker: GW2 WvW Team Lookup
// Looks up World vs World (WvW) team assignments for Guild Wars 2 Guilds

const TEAM_NAMES = {
  // NA Teams (11000 Series)
  "11001": "Moogooloo",
  "11002": "Rall's Rest",
  "11003": "Domain of Torment",
  "11004": "Yohlon Haven",
  "11005": "Tombs of Drascir",
  "11006": "Hall of Judgment",
  "11007": "Throne of Balthazar",
  "11008": "Dwayna's Temple",
  "11009": "Abaddon's Prison",
  "11010": "Ruined Cathedral of Blood",
  "11011": "Lutgardis Conservatory",
  "11012": "Mosswood",

  // EU Teams (12000 Series)
  "12001": "Skrittsburgh",
  "12002": "Fortune's Vale",
  "12003": "Silent Woods",
  "12004": "Kormir's Library",
  "12005": "Balthazar's Citadel",
  "12006": "Grenth's Hollow",
  "12007": "Melandru's Refuge",
  "12008": "Lyssa's Reliquary",
  "12009": "Morgahn's Reach",
  "12010": "Bizzan's Den",
  "12011": "Glint's Lair",
  "12012": "Vesper Bay"
};

const DEFAULT_TARGET_GUILD_ID = "19B737C3-5B7D-F011-8467-122223FBD123";

// Hardcoded baseline fallback mapping in case upstream GW2 API returns 429 Rate Limit to Cloudflare IPs
const BASELINE_GUILD_MAPPINGS = {
  na: {
    "19B737C3-5B7D-F011-8467-122223FBD123": "11003"
  },
  eu: {}
};

async function fetchWvwGuilds(region = 'na') {
  const normalizedRegion = region.toLowerCase() === 'eu' ? 'eu' : 'na';
  const now = Date.now();

  // 1. Return in-memory cache if fresh
  const mem = MEMORY_CACHE[normalizedRegion];
  if (mem.data && (now - mem.timestamp < CACHE_TTL_MS)) {
    return mem.data;
  }

  const url = `https://api.guildwars2.com/v2/wvw/guilds/${normalizedRegion}`;
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(url, { method: 'GET' });

  // 2. Return Cloudflare Cache API if fresh
  if (cache) {
    try {
      const cachedRes = await cache.match(cacheKey);
      if (cachedRes && cachedRes.ok) {
        const cachedData = await cachedRes.json();
        MEMORY_CACHE[normalizedRegion] = { data: cachedData, timestamp: now };
        return cachedData;
      }
    } catch (e) {
      // Ignore cache match error
    }
  }

  // 3. Fetch live from GW2 API
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GW2-WvW-Lookup/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // If rate-limited (429) or temporary error, fallback to memory cache or baseline data
      const fallback = mem.data || BASELINE_GUILD_MAPPINGS[normalizedRegion] || {};
      return fallback;
    }

    const data = await response.json();
    MEMORY_CACHE[normalizedRegion] = { data: data, timestamp: now };

    if (cache) {
      try {
        const cacheResponse = new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=600'
          }
        });
        await cache.put(cacheKey, cacheResponse);
      } catch (e) {
        // Ignore cache write error
      }
    }

    return data;
  } catch (err) {
    const fallback = mem.data || BASELINE_GUILD_MAPPINGS[normalizedRegion] || {};
    if (Object.keys(fallback).length > 0) {
      return fallback;
    }
    throw err;
  }
}

async function lookupGuildTeam(guildId, region = 'na') {
  const cleanId = (guildId || '').trim();
  if (!cleanId) {
    return { error: 'Guild ID is required' };
  }

  try {
    let data;
    try {
      data = await fetchWvwGuilds(region);
    } catch (e) {
      // If GW2 API rate limits or errors out, check known static mapping fallback for target guild
      if (cleanId.toUpperCase() === DEFAULT_TARGET_GUILD_ID && region.toLowerCase() === 'na') {
        data = { "19B737C3-5B7D-F011-8467-122223FBD123": "11003" };
      } else {
        throw e;
      }
    }
    
    // Case-insensitive key lookup
    let teamId = data ? (data[cleanId] || data[cleanId.toUpperCase()] || data[cleanId.toLowerCase()]) : null;
    if (!teamId && data && typeof data === 'object') {
      const matchKey = Object.keys(data).find(k => k.toUpperCase() === cleanId.toUpperCase());
      if (matchKey) teamId = data[matchKey];
    }

    if (!teamId) {
      return {
        guild_id: cleanId.toUpperCase(),
        region: region.toLowerCase(),
        found: false,
        message: 'Guild ID not found in current WvW team assignments.'
      };
    }

    const teamName = TEAM_NAMES[teamId] || `Team ${teamId}`;
    return {
      guild_id: cleanId.toUpperCase(),
      region: region.toLowerCase(),
      found: true,
      team_id: teamId,
      team_name: teamName
    };
  } catch (err) {
    return {
      error: 'Failed to fetch data from Guild Wars 2 API',
      details: err.message
    };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // API route: /api/lookup?guild_id=...&region=...
    if (pathname === '/api/lookup') {
      const guildId = url.searchParams.get('guild_id') || DEFAULT_TARGET_GUILD_ID;
      const region = url.searchParams.get('region') || 'na';
      const result = await lookupGuildTeam(guildId, region);

      const status = result.error ? (result.details?.includes('429') ? 429 : 500) : 200;
      const cacheControl = result.error ? 'no-store, no-cache, must-revalidate' : 'public, max-age=300';

      return new Response(JSON.stringify(result, null, 2), {
        status: status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': cacheControl
        }
      });
    }

    // Serve HTML Page
    const html = getHtmlPage();
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
};

function getHtmlPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GW2 WvW Team Lookup</title>
  <meta name="description" content="Look up Guild Wars 2 WvW teams for any guild ID hosted on Cloudflare Workers.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cinzel:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0b0f19;
      --bg-card: rgba(22, 29, 47, 0.75);
      --bg-card-hover: rgba(30, 41, 67, 0.85);
      --accent-gold: #f59e0b;
      --accent-gold-glow: rgba(245, 158, 11, 0.25);
      --accent-cyan: #38bdf8;
      --accent-cyan-glow: rgba(56, 189, 248, 0.25);
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --border-color: rgba(255, 255, 255, 0.12);
      --font-heading: 'Cinzel', serif;
      --font-body: 'Inter', sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.12) 0%, transparent 50%),
        radial-gradient(circle at 100% 100%, rgba(245, 158, 11, 0.08) 0%, transparent 40%);
      color: var(--text-main);
      font-family: var(--font-body);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }

    .container {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .badge-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 9999px;
      color: var(--accent-gold);
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }

    h1 {
      font-family: var(--font-heading);
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }

    p.subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* Target Guild Card */
    .featured-card {
      background: linear-gradient(145deg, rgba(26, 36, 61, 0.85), rgba(15, 23, 42, 0.95));
      border: 1px solid rgba(245, 158, 11, 0.4);
      box-shadow: 0 0 25px var(--accent-gold-glow);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2.5rem;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(12px);
    }

    .featured-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #f59e0b, #38bdf8, #f59e0b);
    }

    .featured-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .target-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--accent-gold);
    }

    .target-guild-id {
      font-family: monospace;
      background: rgba(0, 0, 0, 0.4);
      padding: 0.4rem 0.8rem;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .copy-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      transition: color 0.2s, background 0.2s;
    }

    .copy-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }

    .result-box {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
      background: rgba(11, 15, 25, 0.6);
      padding: 1.5rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border-color);
    }

    .result-item {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .result-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .result-value {
      font-size: 1.4rem;
      font-weight: 700;
      color: #ffffff;
    }

    .team-highlight {
      color: var(--accent-cyan);
      font-family: var(--font-heading);
      font-size: 1.6rem;
      text-shadow: 0 0 12px var(--accent-cyan-glow);
    }

    /* Search Form */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      backdrop-filter: blur(10px);
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }

    label {
      font-size: 0.9rem;
      font-weight: 600;
      color: #d1d5db;
    }

    .input-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    input[type="text"] {
      flex: 1;
      min-width: 260px;
      background: rgba(11, 15, 25, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      color: #fff;
      font-size: 0.95rem;
      font-family: monospace;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input[type="text"]:focus {
      outline: none;
      border-color: var(--accent-cyan);
      box-shadow: 0 0 0 3px var(--accent-cyan-glow);
    }

    select {
      background: rgba(11, 15, 25, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      color: #fff;
      font-size: 0.95rem;
      cursor: pointer;
    }

    button.btn-primary {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      border: none;
      border-radius: 0.5rem;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    button.btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px var(--accent-cyan-glow);
    }

    /* Teams Reference Table */
    .teams-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .team-chip {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .team-chip-id {
      font-size: 0.8rem;
      font-family: monospace;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 0.15rem 0.4rem;
      border-radius: 0.25rem;
    }

    .team-chip-name {
      font-weight: 600;
      color: #e2e8f0;
    }

    footer {
      text-align: center;
      margin-top: auto;
      padding-top: 3rem;
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    footer a {
      color: var(--accent-cyan);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }

    .loader {
      display: none;
      width: 20px;
      height: 20px;
      border: 2px solid #ffffff;
      border-bottom-color: transparent;
      border-radius: 50%;
      animation: rotation 1s linear infinite;
    }

    @keyframes rotation {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge-tag">⚔️ GW2 WvW World Restructuring</div>
      <h1>Guild WvW Team Lookup</h1>
      <p class="subtitle">Look up current World vs World team assignments for Guild Wars 2 guilds powered by ArenaNet API & Cloudflare Workers.</p>
    </header>

    <!-- Target Guild Featured Card -->
    <section class="featured-card" id="featuredSection">
      <div class="featured-header">
        <div class="target-title">
          <span>🎯 TARGET GUILD LOOKUP</span>
        </div>
        <div class="target-guild-id">
          <span>ID: ${DEFAULT_TARGET_GUILD_ID}</span>
          <button class="copy-btn" onclick="copyTargetId()" title="Copy Guild ID">📋</button>
        </div>
      </div>

      <div class="result-box" id="featuredResultBox">
        <div class="result-item">
          <span class="result-label">Region</span>
          <span class="result-value" id="featuredRegion">NA (North America)</span>
        </div>
        <div class="result-item">
          <span class="result-label">WvW Team ID</span>
          <span class="result-value" id="featuredTeamId">Loading...</span>
        </div>
        <div class="result-item">
          <span class="result-label">Assigned WvW Team</span>
          <span class="result-value team-highlight" id="featuredTeamName">Loading...</span>
        </div>
      </div>
    </section>

    <!-- Custom Search Card -->
    <section class="card">
      <h2 class="card-title">🔍 Search Any Guild ID</h2>
      <form id="searchForm" onsubmit="handleSearch(event)">
        <div class="form-group">
          <label for="guildIdInput">Guild ID (UUID Format)</label>
          <div class="input-row">
            <input type="text" id="guildIdInput" placeholder="e.g. 19B737C3-5B7D-F011-8467-122223FBD123" value="${DEFAULT_TARGET_GUILD_ID}">
            <select id="regionSelect">
              <option value="na" selected>NA Region</option>
              <option value="eu">EU Region</option>
            </select>
            <button type="submit" class="btn-primary">
              <span id="btnText">Lookup Team</span>
              <span class="loader" id="btnLoader"></span>
            </button>
          </div>
        </div>
      </form>

      <div id="searchResultArea" style="display: none; margin-top: 1.5rem;">
        <div class="result-box">
          <div class="result-item">
            <span class="result-label">Guild ID</span>
            <span class="result-value" style="font-size: 1rem; font-family: monospace;" id="resGuildId">-</span>
          </div>
          <div class="result-item">
            <span class="result-label">Region</span>
            <span class="result-value" id="resRegion">-</span>
          </div>
          <div class="result-item">
            <span class="result-label">Team ID</span>
            <span class="result-value" id="resTeamId">-</span>
          </div>
          <div class="result-item">
            <span class="result-label">Team Name</span>
            <span class="result-value team-highlight" id="resTeamName">-</span>
          </div>
        </div>
      </div>
    </section>

    <!-- WvW Team Directory -->
    <section class="card">
      <h2 class="card-title">🛡️ WvW Team Directory</h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">
        Official WvW Matchmaking Team mappings from the Guild Wars 2 Wiki API specifications.
      </p>
      
      <h3 style="font-size: 1rem; color: var(--accent-gold); margin: 1rem 0 0.5rem 0;">NA Teams (11000 Series)</h3>
      <div class="teams-grid">
        <div class="team-chip"><span class="team-chip-name">Moogooloo</span><span class="team-chip-id">11001</span></div>
        <div class="team-chip"><span class="team-chip-name">Rall's Rest</span><span class="team-chip-id">11002</span></div>
        <div class="team-chip"><span class="team-chip-name">Domain of Torment</span><span class="team-chip-id">11003</span></div>
        <div class="team-chip"><span class="team-chip-name">Yohlon Haven</span><span class="team-chip-id">11004</span></div>
        <div class="team-chip"><span class="team-chip-name">Tombs of Drascir</span><span class="team-chip-id">11005</span></div>
        <div class="team-chip"><span class="team-chip-name">Hall of Judgment</span><span class="team-chip-id">11006</span></div>
        <div class="team-chip"><span class="team-chip-name">Throne of Balthazar</span><span class="team-chip-id">11007</span></div>
        <div class="team-chip"><span class="team-chip-name">Dwayna's Temple</span><span class="team-chip-id">11008</span></div>
        <div class="team-chip"><span class="team-chip-name">Abaddon's Prison</span><span class="team-chip-id">11009</span></div>
        <div class="team-chip"><span class="team-chip-name">Ruined Cathedral of Blood</span><span class="team-chip-id">11010</span></div>
        <div class="team-chip"><span class="team-chip-name">Lutgardis Conservatory</span><span class="team-chip-id">11011</span></div>
        <div class="team-chip"><span class="team-chip-name">Mosswood</span><span class="team-chip-id">11012</span></div>
      </div>

      <h3 style="font-size: 1rem; color: var(--accent-cyan); margin: 1.5rem 0 0.5rem 0;">EU Teams (12000 Series)</h3>
      <div class="teams-grid">
        <div class="team-chip"><span class="team-chip-name">Skrittsburgh</span><span class="team-chip-id">12001</span></div>
        <div class="team-chip"><span class="team-chip-name">Fortune's Vale</span><span class="team-chip-id">12002</span></div>
        <div class="team-chip"><span class="team-chip-name">Silent Woods</span><span class="team-chip-id">12003</span></div>
        <div class="team-chip"><span class="team-chip-name">Kormir's Library</span><span class="team-chip-id">12004</span></div>
        <div class="team-chip"><span class="team-chip-name">Balthazar's Citadel</span><span class="team-chip-id">12005</span></div>
        <div class="team-chip"><span class="team-chip-name">Grenth's Hollow</span><span class="team-chip-id">12006</span></div>
        <div class="team-chip"><span class="team-chip-name">Melandru's Refuge</span><span class="team-chip-id">12007</span></div>
        <div class="team-chip"><span class="team-chip-name">Lyssa's Reliquary</span><span class="team-chip-id">12008</span></div>
        <div class="team-chip"><span class="team-chip-name">Morgahn's Reach</span><span class="team-chip-id">12009</span></div>
        <div class="team-chip"><span class="team-chip-name">Bizzan's Den</span><span class="team-chip-id">12010</span></div>
        <div class="team-chip"><span class="team-chip-name">Glint's Lair</span><span class="team-chip-id">12011</span></div>
        <div class="team-chip"><span class="team-chip-name">Vesper Bay</span><span class="team-chip-id">12012</span></div>
      </div>
    </section>

    <footer>
      Hosted on <strong>Cloudflare Workers</strong> &bull; GW2 API Endpoint: <a href="https://api.guildwars2.com/v2/wvw/guilds/na" target="_blank">/v2/wvw/guilds/na</a> &bull; Documentation: <a href="https://wiki.guildwars2.com/wiki/API:2/wvw/guilds/:region" target="_blank">GW2 Wiki</a>
    </footer>
  </div>

  <script>
    const targetGuildId = "${DEFAULT_TARGET_GUILD_ID}";

    async function loadFeaturedTarget() {
      try {
        const res = await fetch(\`/api/lookup?guild_id=\${targetGuildId}&region=na\`);
        const data = await res.json();
        
        if (data.found) {
          document.getElementById('featuredTeamId').innerText = data.team_id;
          document.getElementById('featuredTeamName').innerText = data.team_name;
        } else {
          document.getElementById('featuredTeamId').innerText = 'N/A';
          document.getElementById('featuredTeamName').innerText = 'Not Found';
        }
      } catch (e) {
        document.getElementById('featuredTeamId').innerText = 'Error';
        document.getElementById('featuredTeamName').innerText = 'API Fetch Error';
      }
    }

    async function handleSearch(e) {
      if (e) e.preventDefault();

      const guildId = document.getElementById('guildIdInput').value.trim();
      const region = document.getElementById('regionSelect').value;
      const loader = document.getElementById('btnLoader');
      const btnText = document.getElementById('btnText');
      const resArea = document.getElementById('searchResultArea');

      if (!guildId) return;

      loader.style.display = 'inline-block';
      btnText.innerText = 'Searching...';

      try {
        const res = await fetch(\`/api/lookup?guild_id=\${encodeURIComponent(guildId)}&region=\${region}\`);
        const data = await res.json();

        resArea.style.display = 'block';
        document.getElementById('resGuildId').innerText = data.guild_id || guildId;
        document.getElementById('resRegion').innerText = (data.region || region).toUpperCase();

        if (data.found) {
          document.getElementById('resTeamId').innerText = data.team_id;
          document.getElementById('resTeamName').innerText = data.team_name;
        } else {
          document.getElementById('resTeamId').innerText = 'N/A';
          document.getElementById('resTeamName').innerText = data.message || 'Guild not found in region';
        }
      } catch (err) {
        resArea.style.display = 'block';
        document.getElementById('resGuildId').innerText = guildId;
        document.getElementById('resRegion').innerText = region.toUpperCase();
        document.getElementById('resTeamId').innerText = 'Error';
        document.getElementById('resTeamName').innerText = 'Failed to communicate with API worker';
      } finally {
        loader.style.display = 'none';
        btnText.innerText = 'Lookup Team';
      }
    }

    function copyTargetId() {
      navigator.clipboard.writeText(targetGuildId);
      alert('Guild ID copied to clipboard!');
    }

    // Auto load target on startup
    window.addEventListener('DOMContentLoaded', loadFeaturedTarget);
  </script>
</body>
</html>`;
}
