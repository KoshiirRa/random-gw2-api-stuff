# Guild Wars 2 WvW Team Lookup (Cloudflare Worker)

A Cloudflare Worker web application and JSON API service that looks up current World vs World (WvW) Team assignments for Guild Wars 2 Guilds.

🌐 **Live Worker Deployment:** [https://slpy-wvw.dwavenbard.com](https://slpy-wvw.dwavenbard.com)

---

## 🤖 AI Disclosure & Development Notice

This repository was developed with AI pair-programming assistance provided by **Antigravity** (Google DeepMind's AI Coding Assistant).

- **Architecture & Infrastructure**: Serverless Cloudflare Worker implementation, 2-tier caching logic, custom domain setup, and 429 rate limit fallbacks.
- **UI Design**: Modern glassmorphic dark-mode web interface.
- **Documentation & Testing**: Automated deployment verification, `GEMINI.md`, and `AGENTS.md`.

For full architecture details and AI contribution disclosure, see [GEMINI.md](file:///c:/Users/concentus/Documents/gw2-wvw-team-lookup/GEMINI.md).

---

## 🎯 Target Guild Spotlight

- **Guild ID:** `19B737C3-5B7D-F011-8467-122223FBD123`
- **Region:** NA (North America)
- **Team ID:** `11003`
- **Team Name:** **Domain of Torment**

---

## 🚀 Quick Start

### Local Development

Run the Cloudflare Worker locally using Wrangler:

```bash
cd gw2-wvw-team-lookup
npm install
npm run dev
```

Open `http://localhost:8787` in your browser.

---

## 📡 API Usage

### `GET /api/lookup`

Query parameters:
- `guild_id` (optional, default: `19B737C3-5B7D-F011-8467-122223FBD123`)
- `region` (optional: `na` or `eu`, default: `na`)

#### Example Request:
```bash
curl "https://slpy-wvw.dwavenbard.com/api/lookup?guild_id=19B737C3-5B7D-F011-8467-122223FBD123&region=na"
```

#### Response:
```json
{
  "guild_id": "19B737C3-5B7D-F011-8467-122223FBD123",
  "region": "na",
  "found": true,
  "team_id": "11003",
  "team_name": "Domain of Torment"
}
```

---

## 🌐 Deploy to Cloudflare Workers

To deploy this project to your Cloudflare Workers account:

```bash
npx wrangler deploy
```

---

## 🛠️ Data Sources & Documentation
- **GW2 API WvW Guilds Endpoint:** `https://api.guildwars2.com/v2/wvw/guilds/na`
- **GW2 Wiki Team Specifications:** `https://wiki.guildwars2.com/wiki/API:2/wvw/guilds/:region`
- **Agent Directives:** [AGENTS.md](file:///c:/Users/concentus/Documents/gw2-wvw-team-lookup/AGENTS.md)
- **System Architecture & AI Disclosure:** [GEMINI.md](file:///c:/Users/concentus/Documents/gw2-wvw-team-lookup/GEMINI.md)
