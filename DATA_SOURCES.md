# NammaDrishti — Data Sources & Provenance

NammaDrishti is **keyless-first**: every external data source below works with **no API key, no signup, and no metered spend** by default. This document records exactly where each piece of data comes from, how it is used, and its terms — so anyone can audit the platform's inputs the same way [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) does with `DATA_SOURCES.md`.

> **Disclaimer:** NammaDrishti is a *civic awareness and advisory* tool. Crowd-sourced and weather-telemetry data can be incomplete or wrong.
> **Do not use it for safety-critical decisions.** In an emergency call **112**; for traffic/flood help call **BTP 1095** or **BBMP 1533**.

---

## Live External Sources (keyless, public)

| Source | Endpoint(s) | Used for | Auth | Terms / Attribution | Notes |
|---|---|---|---|---|---|
| **OpenStreetMap** tiles | `tile.openstreetmap.org/{z}/{x}/{y}.png` | Base map layer | None | [ODbL](https://www.openstreetmap.org/copyright) — "© OpenStreetMap contributors" shown in map attribution | Standard Leaflet usage; fair-use tile policy respected (single city, no bulk scraping) |
| **OpenStreetMap Nominatim** | `nominatim.openstreetmap.org/search` | Live geocoding for Safe Route origins/destinations and Report Modal ward lookups | None | [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) — browser Referer used as identifier | Serialized to ≤1 req/s with per-query memoization; searches bounded to the Bengaluru viewbox (`bounded=1`) |
| **RainViewer** radar archive | `api.rainviewer.com/public/weather-maps.json` + `tilecache.rainviewer.com` | Animated 🌧️ radar timeline: past ~2h observed frames + 30-min nowcast, play/scrub in the map toolbar | None | Public API per [RainViewer docs](https://www.rainviewer.com/api.html); free tier permits public map display | Frames refresh every 5 min; app keeps working offline when unreachable |
| **Open-Meteo** | `api.open-meteo.com/v1/forecast` (Bengaluru coords) | Header weather telemetry, monsoon rain intensity, underpass trigger thresholds | None | [Attribution required](https://open-meteo.com/en/terms) — "Weather data by Open-Meteo.com" | Also drives the AI assistant's answers and City Recap diagnostics |
| **OSRM public routing mirrors** | `router.project-osrm.org` (primary), `router.project-osrm.de` (FOSSGIS fallback) | Safe Route turn-by-turn corridors + hazard-detour calculation | None | Public OSRM demo servers; ODbL-derived data | Mirror chain: 5xx/network errors fail over `.org` → `.de`; bad input (NoRoute) is a final answer, not retried |
| **OpenStreetMap share links** | `www.openstreetmap.org/?mlat=…&mlon=…#map=17/…` deep links only | Location pins inside SOS WhatsApp dispatch text and feed share text | None (plain URL) | ODbL data via standard external links; no API call is made | Free Google-Maps alternative — coordinate deep links, we never call or key the paid Maps API |

## Local / Derived Data (no network)

| Source | Location | Used for | Honesty note |
|---|---|---|---|
| **Citizen incident stream** | backend store (`DATA_FILE`, defaults to git-ignored `server/incidents.json`) + WebSocket (`socket.io`, port 5001) | Live hazard feed, verification consensus, TTL lifecycle decay | Crowd-sourced; the store **starts empty** on first run — no seeds, no synthetic incidents. Verification is heuristic consensus, not ground truth |
| **Underpass vulnerability catalog (11)** | `src/data/bengaluruUnderpasses.js` | Chronic flooding chokepoint watch (pump capacity, gate status, trigger mm/hr) | **Curated static catalog** compiled from public BBMP/BTP reporting; needs periodic manual review — clearly labeled in the UI |
| **Monitoring corridor geometry** | `src/components/Map/MapContainer.jsx` | Silk Board / ORR / Tin Factory / Hebbal overlay lines | Geometry + names are factual; corridor status derives **only** from live citizen report density (no speed/delay estimates) |
| **Device APIs** | browser Geolocation, `navigator.clipboard` | Proximity alerts, Copy-Link sharing | GPS asks permission in-browser; clipboard copy falls back to a prompt dialog |

### Data honesty policy

Anything rendered to a user originates from one of the tables above. There are no
sample seeds, placeholder advisories, preset "trust" percentages, baseline speeds,
or forecast bullets anywhere in the client or server — when data is missing the UI
shows explicit empty states. Removing or adding data sources must update both
tables here (`npm run doctor` probes the live list).

## Explicitly Not Included (pending official agreements)

- **CCTV / ANPR camera locations** — OSM-tagged `man_made=surveillance` layer was evaluated and deferred: keyless but needs viewport capping and a privacy review; live video impossible without a BTP/BBMP opt-in agreement.
- **BMTC / Namma Metro GTFS-RT feeds** — deferred until an official feed or a documented schedule-reconstruction adapter exists.
- **Satellite / flights / quakes OSINT layers** — global data irrelevant to Bengaluru civic flooding.

## Verification

`npm run doctor` probes every live source above (plus the local backend health endpoint) and prints a green/warning report — run it before deploying or demoing.
