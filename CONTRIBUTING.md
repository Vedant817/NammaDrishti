# Contributing to NammaDrishti

Namaskara! 🙏 Thanks for wanting to improve Bengaluru's civic awareness tooling.
This guide keeps contributions fast to review and honest to ship.

## Ground rules (read first)

1. **Zero fabricated data.** Nothing that *displays* to a commuter may come from a
   hardcoded/sample dataset. Every label, badge, count, delay, or status almost shown
   in the UI must derive from a live source (backend incident stream, Open-Meteo,
   RainViewer, OSRM, Nominatim) or from a **clearly-labeled curated catalog**
   (e.g. `src/data/bengaluruUnderpasses.js`). If your feature reads better with data
   we don't have yet, ship an honest empty state instead — see
   [DATA_SOURCES.md](./DATA_SOURCES.md) for the provenance contract.
2. **Keyless-first.** New data sources must work without API keys, signups, or metered
   spend, and must respect public fair-use policies (rate limits, attribution).
3. **Small, focused PRs.** One feature or fix per PR, with a short "why" in the body.

## Getting started

```bash
git clone https://github.com/Vedant817/NammaDrishti.git
cd NammaDrishti
npm install --legacy-peer-deps
npm install ./server --prefix server   # or: cd server && npm install

# Verify your toolchain quickly (keys needed):
npm run doctor
```

## Development workflow

```bash
npm start          # React dev server on :3000
npm run server     # Express + Socket.io backend on :5001
```

## Validation gate (required before every PR)

CI runs on Node 18.x and 20.x, so run the same suite locally first — it must be
**fully green**:

```bash
npm run test:all
CI=true npm run build
npm run doctor
```

- `test:all` covers the frontend tests, the backend API suite, the e2e commuter
  simulation, the sandbox scenarios, and the brutal stress suite.
- `CI=true npm run build` mirrors the CI build (warnings are failures).
- `server/incidents.json` is runtime state and is git-ignored — never commit it.
  If a test run dirtied it: `git checkout -- server/incidents.json`.

## Commit & PR conventions

- Commits: `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`, `chore: …`.
- Describe behavior, not just implementation ("Show live underpass triggers",
  not "change some jsx").
- If a PR touches a data display path, say in the PR body where each piece of
  rendered data now comes from.

## Project structure

```
.github/workflows/    CI pipeline (Node 18 + 20 matrix)
public/               PWA shell, service worker
scripts/              doctor + scenario/stress runners used by test:all
server/               Express + Socket.io API, spatial hex index, tests
src/
  components/         Map, Sidebar, Navigation, Modals, Chatbot, Header, Filters
  data/               constants, i18n translations, curated underpass catalog
  hooks/              event stream, weather telemetry, geolocation
  services/           OSRM routing, Nominatim geocoding
  utils/              reputation, image optimizer, formatters
```

## Questions?

Open a GitHub issue with the `question` label, or check the README's
Architecture section first — the backend contract starts at
`server/index.js` and the frontend data flow starts at `CityPulseDashboard.jsx`.
