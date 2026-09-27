# NammaPulse Advanced Engineering Roadmap & Implementation Tracker

## 📋 Status Overview
- **Active Branch**: `feat/nammapulse-core`
- **Quality Standard**: Zero regressions, single-pass tests (`npm run test:all`), atomic git commits.

---

### [x] 1. Spatial Clustering & Duplicate Auto-Merge
- [x] Add geospatial Haversine proximity function on backend.
- [x] When a new incident is submitted: if an active incident of the same category exists within **200 meters** reported within the last 60 minutes, automatically treat it as an upvote (+1 consensus) and append citizen commentary/media rather than creating a duplicate pin.
- [x] Return cluster metadata (`isClustered: true`, `parentIncidentId`, `clusterCount`).
- [x] Frontend card display: `🔗 2 merged` badge in feed.

### [x] 2. Time-To-Live (TTL) Dynamic Hazard Decay Worker
- [x] Implement category-based TTL half-life rules:
  - *Accidents*: 2 hours.
  - *Waterlogging*: 4 hours.
  - *Traffic Gridlock*: 3 hours.
  - *Potholes / Infrastructure*: 72 hours.
- [x] Periodic background cleanup ticker on server (`cleanupExpiredIncidents` every 60 seconds).
- [x] WebSocket broadcast `incident:expired` removing cleared incidents without page reload.

### [x] 3. Proximity-Weighted Consensus Verification
- [x] Allow passing client coordinates in verification request (`/api/incidents/:id/verify`).
- [x] Calculate distance from verifying citizen to the hazard:
  - $\le 1.5$ km: **1.0x weight** (`groundVerified: true`).
  - $> 1.5$ km: **0.25x weight** (`groundVerified: false`, remote observation).
- [x] Frontend card display: `📍 On-Ground` verification pill.

### [x] 4. Citizen Reputation & Gamification Badges
- [x] Implemented `src/utils/reputationService.js` tracking civic points and tiers.
- [x] Gamified Tiers:
  - `Bengaluru Scout` (0–49 Karma)
  - `Ward Sentinel` (50–149 Karma)
  - `City Guardian` (150+ Karma)
- [x] Display citizen tier and real-time karma score in Header bar (`Header.jsx`).

### [x] 5. Gemini-Powered Conversational RAG Assistant with Context Fallback
- [x] Backend endpoint `POST /api/assistant/chat` analyzing active incidents, underpass flood risk, weather, and emergency helplines.
- [x] Resilient client-side fallback in `ChatbotModal.jsx` if server endpoint is offline or times out.
- [x] Quick prompt chips and conversational natural language guidance for commuters.

### [x] 6. End-to-End Testing & Verification
- [x] Expanded `server/test/api.test.js` to 8/8 passing tests covering clustering, proximity, TTL, and assistant chat.
- [x] Expanded `scripts/simulate_user.js` to 11/11 commuter workflows.
- [x] Full test suite passes: `npm run test:all` (Frontend, Backend, and E2E all green).
