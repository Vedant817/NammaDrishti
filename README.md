<div align="center">

# 🌧️ NammaDrishti (ನಮ್ಮ ದೃಷ್ಟಿ)

### Real-Time Crowd-Sourced Civic Intelligence, Monsoon Flooding Telemetry & Transit Corridor Radar for Bengaluru

[![CI Pipeline](https://github.com/Vedant817/NammaDrishti/actions/workflows/ci.yml/badge.svg)](https://github.com/Vedant817/NammaDrishti/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bengaluru Civic Intelligence](https://img.shields.io/badge/Bengaluru-Namma%20Bengaluru-orange.svg)](https://github.com/Vedant817/NammaDrishti)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)

</div>

---

## 🏙️ About NammaDrishti

**NammaDrishti** (*ನಮ್ಮ ದೃಷ್ಟಿ - "Our Vision"*) is a hyper-localized civic awareness and flood warning platform engineered for the complex urban topology of Bengaluru. When torrential monsoons strike corridors like Bellandur, Silk Board, Outer Ring Road, and Panathur, commuters face waterlogged railway underpasses, tree falls, severe gridlocks, and unmapped hazards.

NammaDrishti collects citizen road reports, rain telemetry, and route information for Bengaluru. Reports are community observations, not independently verified ground truth.

---

## ✨ Key Capabilities

- **🗺️ Interactive Hyper-Local Map**: Live rendering of active traffic jams, flash floods, accidents, and potholes across BBMP wards and major IT corridors.
- **Account-bound voting**: Firebase ID tokens identify contributors in production. A contributor counts once per incident, across reporting and verification. Browser GPS does not increase vote weight or prove physical presence.
- **📍 Dynamic Spatial Auto-Clustering**: Nearby hazard reports within 200m auto-merge into unified clusters, preventing visual clutter and consolidating confirmation scores.
- **🧭 Safe Navigation & Hazard Detour Radar**: Interactive origin-to-destination routing that samples road corridors, alerts commuters of intersecting hazards, and calculates safe bypasses. Supports both GeoJSON routes and raw coordinate arrays.
- **🌊 Monsoon Diagnostic Engine**: Dedicated telemetry analyzing 11 documented high-risk Bengaluru underpasses (Panathur, Hebbal, Okalipuram, Le Méridien, etc.) alongside real-time Doppler precipitation data.
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

2. **Honest Data Provenance**:
   Every displayed value comes from a live keyless source or a clearly-labeled curated catalog — never from seeded sample data. See [DATA_SOURCES.md](./DATA_SOURCES.md) for the full audit trail, and note again: **this is advisory tooling, not an authority feed**.

3. **Atomic Anti-Sybil Single Vote Guard**:
   Verification and clearance endpoints enforce strict single-vote-per-device rules. Concurrent duplicate votes are atomically rejected with `HTTP 409 Conflict`.

4. **Zero-Loss Offline Synchronization**:
   Offline queues prevent loss of queued items during asynchronous draining. Offline verifications and clearance votes are tracked in `nammadrishti_offline_votes_v1` and replayed cleanly upon reconnection.

5. **Reverse Proxy Trust Isolation**:
   `X-Forwarded-For` header spoofing is prevented by only evaluating forwarded IPs when reverse proxy trust is explicitly configured (`app.set('trust proxy', 1)`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22.0.0
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

# Run frontend tests only (React Testing Library - 7 tests)
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
   - Authoritative title spoofing and official impersonation sanitization on `reportedBy` (`"BTP Official Police Patrol Commander"` -> scrubbed to `"Citizen Commander"`).
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
1. **Monsoon Flash Flood & Proximity Consensus**: Citizen reports ORR EcoSpace flash flood; all accounts confirm with equal weight; duplicate-account protection rejects duplicate votes with HTTP 409 Conflict.
2. **Spatial Hazard Auto-Clustering**: Nearby hazard reports within 200m auto-merge into existing corridor clusters without duplicating map pins.
3. **Safe Navigation Corridor & Dynamic Rerouting**: Real-time corridor conflict detector alerts of flood intersections on primary route and generates a zero-conflict safe detour.
4. **Monsoon Offline Queue Sync**: Simulates network disconnection during cloudbursts, queues reports locally, and drains + syncs with WebSocket broadcast once reconnected.
5. **Multi-Citizen Clearance Consensus**: Requires 2 unique citizen confirmations to mark resolved and purge from live map; rejects repeat account contributions.
6. **Dynamic TTL Decay & Worker Lifecycle**: Expired incidents past their half-life are safely purged with atomic disk persistence.
7. **Context-Aware AI Commute Assistant**: Inquires on Panathur flood status, Silk Board/HSR congestion, and Doppler rain telemetry, with answers composed strictly from live incident data (no invented delays or engine "confidence" scores).
8. **One-Tap Emergency SOS Dispatch**: Formats stranded commuter coordinates into instant 112/1095 hotline targets and pre-formatted WhatsApp SOS dispatch links.

---

## 📊 Comparative Analysis: NammaDrishti vs Alternative Solutions

Bengaluru commuters traditionally juggle multiple disconnected platforms to navigate the city's unique civic and monsoon transit challenges. The table below illustrates how **NammaDrishti** fills the critical technological gaps left by global navigation apps and legacy municipal systems:

| Dimension / Capability | **NammaDrishti** (Our Platform) | **Google Maps** | **Waze** | **BTP ASTrAM & BBMP Sahaya** |
| :--- | :--- | :--- | :--- | :--- |
| **Monsoon Flooding & Inundation Tracking** | **Hyper-localized real-time alerts** with depth telemetry, waterlogged underpass monitoring, and RainViewer Doppler radar overlay | Generic traffic delay color-coding (red/orange); no distinction between slow traffic and impassable deep water | Crowd-flagged "flood" warnings, but zero depth metrics or low-lying underpass classification | Periodic official advisories or grievance tickets; not embedded in live commuter maps |
| **Community verification** | Account-bound contributions; anonymous accounts do not prove unique humans | Provider-specific | Provider-specific | Provider-specific |
| **Bengaluru Underpass Diagnostic Engine** | **Automated risk telemetry** for 11 documented chronic underpasses (Panathur, Hebbal, Okalipuram, etc.) with rain intensity thresholds | None (treats underpasses as standard road segments) | None | Periodic manual barricading announcements via Twitter/X or control rooms |
| **Safe Corridor Navigation & Hazard Detour** | **Dynamic corridor hazard conflict detection** with automated bypass routing around submerged roads & fallen trees | Standard fastest-route routing (frequently guides motorists directly into flooded underpasses) | Real-time rerouting based on congestion, but lacks flood-depth awareness | No navigation routing engine; text-only notifications |
| **Low-Connectivity Offline Resilience** | **Zero-drop offline queue**: stores drafted reports and consensus votes in `localStorage`, auto-syncs with atomic replay upon reconnection | Offline map download available for static maps, but crowd incident reporting and voting are disabled offline | Requires active cellular data to submit or view crowd alerts | Web portal requires steady connectivity; high failure rates during cloudburst signal dropouts |
| **One-Tap Emergency SOS Dispatch** | **Instant coordinate generation**, WhatsApp emergency dispatch links, and direct hotlines (112, 1095, 1533) with restricted dispatch room privacy | Emergency SOS location sharing via SMS/contacts, but no direct routing to Bengaluru civic agencies | Community roadside assistance; not linked to Karnataka ERSS 112 | 112 / 1095 phone lines exist, but no integrated coordinate sharing web app |
| **Multilingual Parity (Namma Bhashe)** | **100% native localization** in **Kannada (ಕನ್ನಡ)**, **Hindi (हिंदी)**, and English with instantaneous toggle | Multilingual voice assistance, but UI text localization frequently misses local civic colloquialisms | Primary interface in English; minimal localized Indian dialect phrasing | Bilingual (English/Kannada), but static portals with sluggish interface responsiveness |
| **Context-Aware AI Commute Assistant** | **City-aware natural language assistant** understanding Kannada transit slang, Silk Board bottlenecks, and live Doppler rain status | General Google Assistant (not specialized for Bengaluru hyper-local ward telemetry) | None | None |
| **Dynamic Spatial Auto-Clustering** | **200m / 60-min corridor clustering**: auto-merges duplicate reports to prevent map pollution while incrementing confidence | Clusters incidents only at low zoom levels; duplicate hazard markers often appear side-by-side | Map clustering at high zoom, but reports remain independent points | Aggregated complaints list, not visualized spatially |
| **Openness & Community Ownership** | **Open Source (MIT)**, self-hostable, Docker-ready, real-time WebSocket API for community and municipal integration | Closed proprietary platform; enterprise API requires heavy billing | Proprietary (Google-owned); closed data repository | Closed municipal databases with siloed departmental access |

---

## 🧭 Why Commuters Use NammaDrishti (Illustrative Walkthrough)

*A scenario walkthrough, composed from features as shipped — not a transcription of a specific user session:*

### Scenario: The Monsoon Commute (Silk Board → Bellandur → Panathur)

1. **Immediate Situational Clarity**:
   - Opening NammaDrishti presents a high-visibility dark UI with live hazard markers fed only by backend reports. The weather telemetry pill shows the current Open-Meteo reading, and the RainViewer Doppler overlay animates the last ~2 hours of precipitation plus a 30-minute nowcast.
   - Unlike commercial apps that merely paint the Outer Ring Road in solid dark red, NammaDrishti isolates **why** a corridor is risky: citizen reports carry water depth, vehicle passability, and multi-citizen confirmation counts.

2. **Proximity-Weighted Trust Factor**:
   - Account-bound confirmations are community observations. GPS is not attested, and anonymous sign-in is not proof of unique people. Stale reports expire via the TTL worker.

3. **Avoiding the Panathur "Trap"**:
   - The Underpass Diagnostic tab evaluates every catalogued chokepoint against the live rain intensity using BBMP/BTP-derived trigger thresholds, so a crossing shows *below trigger*, *warning*, or *critical submersion risk* — never a made-up water depth.
   - Activating the **Safe Route Radar** highlights citizen-confirmed hazards intersecting the OSRM corridor and automatically computes a detour around them when one exists.

4. **Peace of Mind with Offline SOS**:
   - When driving through low-lying dead zones under railway lines where cellular signal drops, drafted reports and verification votes stay queued in `localStorage` and replay automatically the instant connectivity returns — the one-tap SOS keeps direct 112/1095 dial links and a preformatted WhatsApp dispatch ready.


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

## 🗺️ Roadmap

Recent and upcoming work — PRs welcome for any of these:

- **Live keyless geocoding everywhere**: ✅ shipped — Safe Route origins/destinations and Report Modal ward lookups now resolve through OpenStreetMap Nominatim instead of preset hub dictionaries.
- **Official advisory ingestion**: dropped the curated placeholder BTP/BBMP advisory pins; the hook point is a documented integration (`server/` ingestion module) waiting on a real data agreement.
- **Traffic flow overlays with real telemetry**: corridor overlays currently reflect live incident density only; LMDS / MapmyIndia-style keyless flow APIs are unverified — evaluate before wiring.
- **PWA install hardening & IndexedDB offline drafts** beyond the current `localStorage` queue.
- **Municipal dashboards**: aggregate ward-level feeds (`/api/incidents/spatial/neighborhood`) packaged for BBMP/BTP review.

---

## 📚 Project Documentation

| Document | What it covers |
|---|---|
| [DATA_SOURCES.md](./DATA_SOURCES.md) | Every external data source, endpoint, auth posture, terms & honesty notes |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Ground rules (zero fabricated data), local setup, validation gate |
| `.env.example` | Optional configuration surface — the app is keyless-first and runs with zero config |

---

## 🤝 Contributing

Bug reports, feature PRs, and Bengaluru ward data corrections are welcome — start with [CONTRIBUTING.md](./CONTRIBUTING.md). CI must be green (`npm run test:all`, `CI=true npm run build`) before any PR is opened.

---

## 📄 License
MIT © Vedant817


### Firebase authentication and incident storage

Firebase is optional. Without Firebase environment variables, the standalone server
uses the existing local JSON store. To enable cloud storage, configure the variables
in `.env.example`, enable Anonymous Authentication, create a Firestore database,
and run `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
The frontend uses persistent anonymous Firebase sign-in for API mutations; the
backend verifies the ID token and derives the reporter/voter identity from its UID.
Anonymous accounts identify a browser installation, not a verified human.

The Admin SDK uses `GOOGLE_APPLICATION_CREDENTIALS` (or application default credentials).
Keep the credential outside the repository and grant only `roles/datastore.user`.
The web SDK configuration is public configuration, never an Admin credential.
Restart both servers after changing `.env`; React embeds the web configuration at build time.
The configured project is `nammadrishti-20261105`, with Firestore in `asia-south1` (Mumbai).
All direct browser Firestore reads and writes are denied; the validated Express API
continues to own incident queries, voting, TTL cleanup, and Socket.io broadcasts.

Cloud mode loads existing Firestore incidents before listening and waits for an
atomic batch commit before acknowledging mutations. It fails startup if storage
is unavailable and rolls failed mutations back using the existing API error paths.
Run **one backend process** for this in-memory spatial index; multiple replicas need
a transactional repository and shared broadcasts. A mutation exceeding 500 changed
documents or Firestore's document/request size limits fails rather than partially
committing. Large inline photos can exceed Firestore's 1 MiB document limit; use
hosted photo URLs. Existing local JSON data is not imported automatically.

The ordinary test harnesses import the server in local JSON mode; they do not prove
Firebase acceptance. Live cloud verification must separately exercise sign-in,
unauthenticated rejection, persistence across restarts, and Firestore access rules.


Production requires Node 22+ and Firebase Auth/Firestore configuration. Without
Firebase, `npm run server` remains a local development mode; local voter identity
comes from the client IP, never a caller-selected voter ID. Fixture voter IDs are
accepted only under NODE_ENV=test. Set TRUST_PROXY=true only behind a trusted proxy.
Browser GPS is not location attestation: all account votes have equal weight and
no vote is labelled ground-verified. Anonymous accounts are not verified humans.
SOS history and emergency socket subscriptions require a nonempty AUTHORITY_TOKEN
in every environment (HTTP x-authority-token header / socket auth.authorityToken).
An unset token disables authority access; there is no default secret.
Docker Compose reads Firebase web build arguments and server credentials from the
operator environment. The Admin credential is mounted read-only, never baked into
an image; .env files are excluded from the Docker build context.
