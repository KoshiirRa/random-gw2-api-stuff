# Agent Guidelines - GW2 WvW Team Lookup

## Project Overview

`random-gw2-api-stuff` (GW2 WvW Team Lookup) is a lightweight serverless application hosted on Cloudflare Workers. It resolves Guild Wars 2 (GW2) Guild IDs to their assigned World vs World (WvW) Matchmaking Teams under the World Restructuring (Alliance) system.

## Key Features

1. **Live GW2 API Integration**: Fetches real-time guild team allocations from `https://api.guildwars2.com/v2/wvw/guilds/na` and `/eu`.
2. **Resilient Caching**: Implements a 2-tier caching strategy (Module-level memory cache + Cloudflare Cache API) with static fallback for API rate limits (`HTTP 429`).
3. **Dual Interface**:
   - Web GUI (`GET /`) rendered directly by the worker using modern CSS glassmorphism aesthetics.
   - REST API (`GET /api/lookup`) returning structured JSON for third-party tools, Discord bots, and webhooks.

## Codebase Architecture

- **`src/index.js`**: Main Cloudflare Worker entry point. Contains request handlers, API routes, HTML string renderer, and lookup logic.
- **`wrangler.jsonc`**: Cloudflare Workers configuration schema.
- **`package.json`**: Package scripts and Wrangler dependency setup.
- **`GEMINI.md`**: Technical architecture document and AI disclosure notice.

## Development & Deployment Commands

```bash
# Local testing
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```
