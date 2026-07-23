# Guild Wars 2 WvW Team Lookup (Cloudflare Worker)

A Cloudflare Worker web application and JSON API service that looks up the current World vs World (WvW) Team assignment for any Guild Wars 2 Guild ID.

## 🎯 Target Guild Result

- **Guild ID:** `19B737C3-5B7D-F011-8467-122223FBD123`
- **Region:** NA (North America)
- **Team ID:** `11003`
- **Team Name:** **Domain of Torment**

---

## 🚀 Quick Start

### Local Development

Run the Cloudflare Worker locally using Wrangler:

```bash
cd gw2-wvw-lookup
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
curl "https://<your-worker>.workers.dev/api/lookup?guild_id=19B737C3-5B7D-F011-8467-122223FBD123&region=na"
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

## 🛠️ Data Sources & Endpoints
- **GW2 API WvW Guilds Endpoint:** `https://api.guildwars2.com/v2/wvw/guilds/na`
- **GW2 Wiki Team Specifications:** `https://wiki.guildwars2.com/wiki/API:2/wvw/guilds/:region`
