# NammaDrishti — Data Sources & Provenance

NammaDrishti is **keyless-first**: every external data source below works with **no API key, no signup, and no metered spend** by default. This document records exactly where each piece of data comes from, how it is used, and its terms — so anyone can audit the platform's inputs the same way [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) does with `DATA_SOURCES.md`.

> **Disclaimer:** NammaDrishti is a *civic awareness and advisory* tool. Crowd-sourced and weather-telemetry data can be incomplete or wrong.
> **Do not use it for safety-critical decisions.** In an emergency call **112**; for traffic/flood help call **BTP 1095** or **BBMP 1533**.

---

## Live External Sources (keyless, public)

| Source | Endpoint(s) | Used for | Auth | Terms / Attribution | Notes |
|---|---|---|---|---|---|
| **OpenStreetMap** tiles | `tile.openstreetmap.org/{z}/{x}/{y}.png` | Base map layer | None | [ODbL](https://www.openstreetmap.org/copyright) — "© OpenStreetMap contributors" shown in map attribution | Standard Leaflet usage; fair-use tile policy respected (single city, no bulk scraping) |
| **RainViewer** radar archive | `api.rainviewer.com/public/weather-maps.json` + `tilecache.rainviewer.com` | Animated 🌧️ radar timeline: past ~2h observed frames + 30-min nowcast, play/scrub in the map toolbar | None | Public API per [RainViewer docs](https://www.rainviewer.com/api.html); free tier permits public map display | Frames refresh every 5 min; app keeps working offline when unreachable |
| **Open-Meteo** | `api.open-meteo.com/v1/forecast` (Bengaluru coords) | Header weather telemetry, monsoon rain intensity, underpass trigger thresholds | None | [Attribution required](https://open-meteo.com/en/terms) — "Weather data by Open-Meteo.com" | Also drives the AI assistant's answers and City Recap diagnostics |
| **OSRM public routing mirrors** | `router.project-osrm.org` (primary), `router.project-osrm.de` (FOSSGIS fallback) | Safe Route turn-by-turn corridors + hazard-detour calculation | None | Public OSRM demo servers; ODbL-derived data | Mirror chain: 5xx/network errors fail over `.org` → `.de`; bad input (NoRoute) is a final answer, not retried |
| **Google Maps** | `maps.google.com/?q=lat,lng` links only | Geolocation deep links inside WhatsApp share text | None (plain URL) | Standard external links; no Maps API call is made | We never call the paid Maps API — coordinate links only |

## Local / Derived Data (no network)

| Source | Location | Used for | Honesty note |
|---|---|---|---|
| **Citizen incident stream** | `server/incidents.json` + WebSocket (`socket.io`, port 5001) | Live hazard feed, verification consensus, TTL lifecycle decay | Crowd-sourced; trust scores are heuristics, not ground truth |
| **Underpass vulnerability catalog (12)** | `src/data/bengaluruUnderpasses.js` | Chronic flooding chokepoint watch (Pump capacity, gate status, trigger mm/hr) | **Curated static catalog** compiled from public BBMP/BTP reporting; needs periodic manual review |
| **BTP / BBMP advisories** | `server/services/btpIngestion.js` | "Official" advisory pins in the feed | **Curated placeholders**, not a live police feed — swapping in an official feed requires an agreement; advisory `reportedBy` is intentionally masked to "Citizen" unless an authority token is configured |
| **Sample seed events** | `src/data/sampleEvents.js` | First-load demo data before any citizen reports arrive | Clearly demo content, replaceable by live backend data |
| **Corridor baselines** | `src/components/Map/MapContainer.jsx` | Silk Board / ORR / Tin Factory / Hebbal chokepoint overlays | Baseline speeds + peak delays are editorial estimates, correlated live against nearby citizen reports |
| **Device APIs** | browser Geolocation, `navigator.clipboard` | Proximity alerts, Copy-Link sharing | GPS asks permission in-browser; clipboard copy falls back to a prompt dialog |

## Explicitly Not Included (pending official agreements)

- **CCTV / ANPR camera locations** — OSM-tagged `man_made=surveillance` layer was evaluated and deferred: keyless but needs viewport capping and a privacy review; live video impossible without a BTP/BBMP opt-in agreement.
- **BMTC / Namma Metro GTFS-RT feeds** — deferred until an official feed or a documented schedule-reconstruction adapter exists.
- **Satellite / flights / quakes OSINT layers** — global data irrelevant to Bengaluru civic flooding.

## Verification

`npm run doctor` probes every live source above (plus the local backend health endpoint) and prints a green/warning report — run it before deploying or demoing.
