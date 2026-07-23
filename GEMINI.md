# GEMINI.md - System Architecture & AI Disclosure

## 🤖 AI Disclosure & Generation Statement

This project was built with pair-programming assistance from **Antigravity** (Google DeepMind's AI Coding Assistant).

### Scope of AI Contribution
- **Architecture & Design**: Designed the Cloudflare Worker serverless architecture, 2-tier caching system, and error fallback handlers.
- **Frontend & UI**: Authored the responsive dark-mode HTML/CSS user interface with glassmorphism styling and custom CSS variables.
- **Data Engineering**: Mapped Guild Wars 2 WvW Team IDs (11000 and 12000 series) to human-readable team names from official GW2 Wiki specifications.
- **Resilience**: Implemented graceful handling for upstream ArenaNet API rate limits (`HTTP 429`) and Cloudflare edge CDN response headers.

---

## 📐 System Architecture

### Request Lifecycle Flow

```
[ Client Request ]
       │
       ▼
[ Cloudflare Worker Edge Router ]
       │
       ├─── GET / ────────────► Render Web UI (HTML/CSS)
       │
       └─── GET /api/lookup ──► Lookup WvW Team Assignment
                                       │
                                       ▼
                       [ Check Module Memory Cache ]
                                       │
                         ┌─────────────┴─────────────┐
                    (Hit)│                       (Miss)│
                         ▼                           ▼
                 [ Return Cached Data ]    [ Check Cloudflare Cache API ]
                                                     │
                                       ┌─────────────┴─────────────┐
                                  (Hit)│                       (Miss)│
                                       ▼                           ▼
                               [ Return Data ]             [ Fetch GW2 API ]
                                                                   │
                                                     ┌─────────────┴─────────────┐
                                                (200)│                       (429)│
                                                     ▼                           ▼
                                            [ Update Caches ]          [ Use Fallback Data ]
```

---

## 📡 API Specification

### Endpoint: `GET /api/lookup`

#### Query Parameters:
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `guild_id` | string | No | `19B737C3-5B7D-F011-8467-122223FBD123` | Target GW2 Guild UUID string |
| `region` | string | No | `na` | Matchmaking region (`na` or `eu`) |

#### Example Request:
```bash
curl "https://slpy-wvw.dwavenbard.com/api/lookup?guild_id=19B737C3-5B7D-F011-8467-122223FBD123&region=na"
```

#### Successful Response (`200 OK`):
```json
{
  "guild_id": "19B737C3-5B7D-F011-8467-122223FBD123",
  "region": "na",
  "found": true,
  "team_id": "11003",
  "team_name": "Domain of Torment"
}
```

#### Error Response (`429` / `500`):
```json
{
  "error": "Failed to fetch data from Guild Wars 2 API",
  "details": "GW2 API returned status 429"
}
```

---

## 🛡️ WvW Matchmaking Team Dictionary

### NA Region (11000 Series)
- **11001**: Moogooloo
- **11002**: Rall's Rest
- **11003**: Domain of Torment
- **11004**: Yohlon Haven
- **11005**: Tombs of Drascir
- **11006**: Hall of Judgment
- **11007**: Throne of Balthazar
- **11008**: Dwayna's Temple
- **11009**: Abaddon's Prison
- **11010**: Ruined Cathedral of Blood
- **11011**: Lutgardis Conservatory
- **11012**: Mosswood

### EU Region (12000 Series)
- **12001**: Skrittsburgh
- **12002**: Fortune's Vale
- **12003**: Silent Woods
- **12004**: Kormir's Library
- **12005**: Balthazar's Citadel
- **12006**: Grenth's Hollow
- **12007**: Melandru's Refuge
- **12008**: Lyssa's Reliquary
- **12009**: Morgahn's Reach
- **12010**: Bizzan's Den
- **12011**: Glint's Lair
- **12012**: Vesper Bay
