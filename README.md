<div align="center">

# 🌧️ NammaDrishti (ನಮ್ಮ ದೃಷ್ಟಿ)

### Real-Time Crowd-Sourced Civic Intelligence, Monsoon Flooding Telemetry & Transit Corridor Radar for Bengaluru

[![CI Pipeline](https://github.com/Vedant817/NammaDrishti/actions/workflows/ci.yml/badge.svg)](https://github.com/Vedant817/NammaDrishti/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bengaluru Civic Intelligence](https://img.shields.io/badge/Bengaluru-Namma%20Bengaluru-orange.svg)](https://github.com/Vedant817/NammaDrishti)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)

</div>

---

## 🏙️ About NammaDrishti

**NammaDrishti** (*ನಮ್ಮ ದೃಷ್ಟಿ - "Our Vision"*) is a hyper-localized civic awareness and flood warning platform engineered for the complex urban topology of Bengaluru. When torrential monsoons strike corridors like Bellandur, Silk Board, Outer Ring Road, and Panathur, commuters face waterlogged railway underpasses, tree falls, severe gridlocks, and unmapped hazards.

NammaDrishti empowers citizens and traffic wardens to crowd-source ground-truth road status, verify hazards with proximity weighting, calculate safe detour corridors avoiding flooded segments, and dispatch emergency SOS alerts with precise GPS locations.

---

## ✨ Key Capabilities

- **🗺️ Interactive Hyper-Local Map**: Live rendering of active traffic jams, flash floods, accidents, and potholes across BBMP wards and major IT corridors.
- **🛡️ Proximity-Weighted Verification**: On-ground commuters (<1.5 km) carry higher verification weight ($1.0\times$) than remote observers ($0.25\times$), defeating false alarms while remaining tamper-resistant. Requires at least 2 distinct voters and score $\ge 2.5$ for verified status.
- **📍 Dynamic Spatial Auto-Clustering**: Nearby hazard reports within 200m auto-merge into unified clusters, preventing visual clutter and consolidating confirmation scores.
- **🧭 Safe Navigation & Hazard Detour Radar**: Interactive origin-to-destination routing that samples road corridors, alerts commuters of intersecting hazards, and calculates safe bypasses. Supports both GeoJSON routes and raw coordinate arrays.
- **🌊 Monsoon Diagnostic Engine**: Dedicated telemetry analyzing 12 high-risk Bengaluru underpasses (Panathur, Hebbal, Okalipuram, Le Méridien, etc.) alongside real-time Doppler precipitation data.
- **🆘 One-Tap Emergency SOS Dispatcher**: Generates pre-formatted WhatsApp SOS broadcasts with exact GPS coordinates, triggers an emergency beacon via `POST /api/sos/dispatch`, and offers direct dialing to Bengaluru Police (112) and Traffic Helplines (1095).
- **🗣️ Tri-Lingual Support**: Complete native localisation in **ಕನ್ನಡ (Kannada)**, **हिंदी (Hindi)**, and **English**, with dynamic locale switching and fallback deep-merging.
- **🤖 Context-Aware AI Commute Assistant**: Powered by heuristic city knowledge and live weather telemetry to answer commuter questions on underpasses, gridlocks, and alternate routes.
- **📡 Resilient Offline Queue & Vote Replay**: Commuters in low-connectivity areas or waterlogged underpasses can draft reports and votes that auto-sync upon signal restoration with race-condition protection.
- **🎮 Citizen Karma & Gamification**: Tiered civic badges (*Bengaluru Scout*, *Ward Sentinel*, *City Guardian*) rewarding constructive crowd contributions.

---

## 🛠️ Architecture & Tech Stack

```
   ┌────────────────────────────────────────────────────────┐
   │             NammaDrishti Frontend (React 19)           │
   │  Leaflet Map  •  Routing Modal  •  Diagnostic Sidebar  │
   └───────────────────────────▲────────────────────────────┘
                   │ WebSocket (Socket.io)  │ REST API
   ┌───────────────────────────▼────────────────────────────┐
   │              Express 4 Backend Service                 │
   │  Hexagonal Spatial Index  •  Sliding Window Limiter    │
   │  Proximity Consensus Engine  •  TTL Half-Life Decay    │
   └───────────────────────────▲────────────────────────────┘
                           │ Atomic JSON / Cloud Persistence
   ┌───────────────────────────▼────────────────────────────┐
   │              Bengaluru Civic Data Store                │
   └────────────────────────────────────────────────────────┘
```

- **Frontend**: React 19, Leaflet, React-Leaflet, Lucide Icons, Pure CSS Responsive Theme.
- **Backend**: Node.js, Express, Socket.io (real-time broadcast rooms), Open-Meteo API.
- **Geospatial Engine**: In-memory Resolution-8 Axial Hexagonal Partitioning (`server/services/spatialHex.js`), Haversine distance, and 2D Segment Corridor Projection.
- **Resilience**: Sliding-Window IP Rate Limiter (`server/services/rateLimiter.js`), Atomic Disk Persistence (`incidents.json`), and Dynamic TTL Lifecycle Sweeper.

---

## 🛡️ Robustness & Anti-Sybil Consensus Safeguards

NammaDrishti incorporates robust production and concurrency safeguards:

1. **Two-Voter Minimum for Verified Status**:
   A single commuter cannot elevate an incident to verified status alone. Even with high initial weight, an incident requires `verificationScore >= 2.5` **and** at least `2` distinct verified voters before attaining verified status.

2. **Authoritative Bulletin Protection**:
   Official advisories ingested from Bengaluru Traffic Police (BTP) or BBMP cannot be cleared by citizen resolution votes. Citizen clearance requests on official bulletins receive `HTTP 403 Forbidden`.

3. **Atomic Anti-Sybil Single Vote Guard**:
   Verification and clearance endpoints enforce strict single-vote-per-device rules. Concurrent duplicate votes are atomically rejected with `HTTP 409 Conflict`.

4. **Zero-Loss Offline Synchronization**:
   Offline queues prevent loss of queued items during asynchronous draining. Offline verifications and clearance votes are tracked in `nammadrishti_offline_votes_v1` and replayed cleanly upon reconnection.

5. **Reverse Proxy Trust Isolation**:
   `X-Forwarded-For` header spoofing is prevented by only evaluating forwarded IPs when reverse proxy trust is explicitly configured (`app.set('trust proxy', 1)`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Vedant817/NammaDrishti.git
   cd NammaDrishti
   ```

2. **Install dependencies**:
   ```bash
   npm install --legacy-peer-deps
   cd server && npm install && cd ..
   ```

3. **Start backend and frontend services**:
   ```bash
   # Terminal 1: Start Backend API (Port 5001)
   npm run server

   # Terminal 2: Start React Development Server (Port 3000)
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000`.

---

## 🧪 Testing & Quality Assurance

NammaDrishti includes a unified multi-tier test suite with zero external mocks required:

```bash
# Run complete test suite (Frontend + Backend + E2E + Sandbox Scenarios + 5 QA Brutal)
npm run test:all

# Run frontend tests only (React Testing Library - 7 test suites)
npm run test:ci

# Run backend API, clustering, proximity, and TTL tests (13 test cases)
npm run test:backend

# Run heavy user commuter journey simulation (11 workflows)
npm run test:e2e

# Run isolated simulation sandbox (8 end-to-end multi-commuter scenarios)
npm run test:sandbox

# Run 5 Senior QA Engineers brutal stress suite (24 harsh user stress tests)
npm run test:brutal
```

### 🔬 5 Senior QA Engineers Brutal Stress Suite (`test:brutal`)

Simulates an isolated, high-concurrency sandbox environment with harsh, adversarial, and heavy commuter behavior:

1. **Senior Security & Concurrency QA Engineer**:
   - Atomic anti-Sybil protection under 15 simultaneous parallel verification blasts (1 accepted, 14 blocked with HTTP 409).
   - Multi-citizen consensus clearance race condition (2 distinct confirmations required to purge).
   - Authoritative title spoofing and official impersonation sanitization (`"BTP Official Police Patrol Commander"` -> scrubbed to `"Citizen Commander"`).
   - Oversized JSON string payload attacks (>2,000 characters rejected with HTTP 400).
   - Media path traversal and binary executable injection rejection (`../../system32/cmd.exe` blocked with HTTP 400).

2. **Senior Geospatial & Navigation QA Engineer**:
   - Extreme coordinate boundary testing: `null`, `NaN`, `Infinity`, latitude overflow (+120), longitude underflow (-200), Null Island (0,0), North/South Poles, and International Date Line antimeridian.
   - Haversine numerical stability clamping ($a > 1 \implies \text{NaN}$ overshoot protection) for zero, antipodal, and invalid inputs.
   - Perpendicular corridor distance projection across zero-length and sloped route segments.
   - Hexagonal spatial index partitioning (Resolution-8) and 9-ring neighborhood lookups.

3. **Senior Chaos, Fault Injection & Storage QA Engineer**:
   - Atomic disk persistence with verified JSON structure integrity.
   - Dynamic TTL lifecycle worker execution under active continuous throughput.

4. **Senior Frontend & Commuter UX QA Engineer**:
   - Extreme monsoon weather telemetry resilience under 350 mm/hr cloudburst scenarios.
   - Multilingual translation key completeness across Kannada, Hindi, and English with deep-merge fallback.
   - Citizen reputation engine headless/SSR safety (zero `localStorage` `ReferenceError`s).
   - Double-submit form protection preventing race conditions in `ReportModal` and `SafeRouteModal`.

5. **Senior API, Network & Rate Limiter QA Engineer**:
   - Offline queue idempotent de-duplication (replayed duplicate IDs safely return HTTP 200).
   - Sliding-window rate limiter enforcement with reverse-proxy `X-Forwarded-For` client IP resolution (spam IP throttled with HTTP 429).

---

### 🔬 Isolated Simulation Sandbox Scenarios (`test:sandbox`)

The isolated sandbox runner (`scripts/sandbox_scenario_runner.js`) spins up an ephemeral backend server on a dedicated isolated port with isolated temporary disk storage, systematically executing 8 real-life commuter scenarios:
1. **Monsoon Flash Flood & Proximity Consensus**: Citizen reports ORR EcoSpace flash flood; on-ground commuters confirm with 1.0x weight; anti-Sybil protection rejects duplicate votes with HTTP 409 Conflict.
2. **Spatial Hazard Auto-Clustering**: Nearby hazard reports within 200m auto-merge into existing corridor clusters without duplicating map pins.
3. **Safe Navigation Corridor & Dynamic Rerouting**: Real-time corridor conflict detector alerts of flood intersections on primary route and generates a zero-conflict safe detour.
4. **Monsoon Offline Queue Sync**: Simulates network disconnection during cloudbursts, queues reports locally, and drains + syncs with WebSocket broadcast once reconnected.
5. **Multi-Citizen Clearance Consensus**: Requires 2 unique citizen confirmations to mark resolved and purge from live map; enforces Sybil immunity.
6. **Dynamic TTL Decay & Worker Lifecycle**: Expired incidents past their half-life are safely purged with atomic disk persistence.
7. **Context-Aware AI Commute Assistant**: Inquires on Panathur flood status, Silk Board/HSR congestion, and Doppler rain telemetry with 96% confidence score.
8. **One-Tap Emergency SOS Dispatch**: Formats stranded commuter coordinates into instant 112/1095 hotline targets and pre-formatted WhatsApp SOS dispatch links.

### Production Build

```bash
npm run build
```

---

## 🐳 Docker Deployment

Run the complete multi-stage containerized stack with a single command:

```bash
docker-compose up --build
```
The application will be live at `http://localhost:5001`, serving both the static React SPA and real-time backend API from a unified container with persistent data storage.

---

## 📄 License
MIT © Vedant817
