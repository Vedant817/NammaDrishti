# Source contracts

| Data | Source and semantics | Missing/stale behavior |
|---|---|---|
| Citizen hazards | Firebase-backed validated Express API; consensus is account agreement, not official verification | Cached/pending items and disconnected route checks remain uncertain |
| Weather | [Open-Meteo](https://open-meteo.com/en/docs), model current values, UTC observation timestamp and interval | Missing precipitation remains null; older than 30 minutes is stale. An interval accumulation is not an instantaneous rain rate |
| Radar | [RainViewer transition FAQ](https://www.rainviewer.com/api/transition-faq.html), past frames, native zoom capped at 7, Universal Blue | No future nowcast. Tile/catalog errors and observation age are visible; coverage is not guaranteed |
| Geocoding | [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), explicit searches, Bengaluru bounds, shared server cache/gate and identifying User-Agent | No client autocomplete. Bounded queue rejects excess requests; configurable `GEOCODING_URL` and `GEOCODING_USER_AGENT` |
| Base map | [OpenStreetMap](https://www.openstreetmap.org/copyright), attributed public tiles | Network dependent; no bulk or offline tile download |
| Roads/ETA | [OSRM](https://project-osrm.org/docs/v5.24.0/api/), two bounded mirror attempts, static driving estimate | Fails visibly; route search cannot guarantee hazard avoidance. ETA is not traffic-adjusted |
| Measured traffic | [TomTom raster flow tiles](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles) across Bengaluru, plus four junction speed samples in the Traffic panel | Server key stays private. Tile proxy bounds Bengaluru, zoom 10–18, caches for 60 seconds, and validates PNG size/type. Refreshes every two minutes; errors remain visible. Uncoloured roads have unknown coverage. Sample retrieval time is not a provider observation timestamp |
| Underpasses | Approximate candidate coordinates in source, with explicit unverified provenance; no pump, barrier, depth or threshold claims | Field review/source links remain required. Nearby citizen reports are not sensor confirmations |
| Flood observations | Operator-configured `FLOOD_OBSERVATIONS_URL`, normalized `{observations:[{lat,lng,depthCm,source,sourceUrl,observedAt}]}` | Only finite Bengaluru values, HTTPS source links and observations within 15 minutes. Feed must be authorized and calibrated before use; no official feed is currently configured |
| Assistant | Server-owned reports/weather; optional Gemini adapter | Labeled grounded summary when no model is configured. Model responses are advisory and may be wrong |
| Emergency location | Private durable storage, optional operator webhook | No agreement with emergency services is implied; call 112. ACK requires `{acknowledged:true,dispatchId:<id>}` |
| Official warnings | [NDMA SACHET](https://sachet.ndma.gov.in/) public summary plus authoritative CAP XML | Only Actual/Public alerts affecting Bengaluru in their validity window. Expiry/cancellation, partial failures and source age are explicit; not street-depth observations |
| Road incidents | [TomTom Incident Details](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-incidents/incident-details), present Bengaluru records | Future/ended records excluded; up to 2,000 returned incidents with explicit truncation, 30 per UI page. Distinct access-denied/empty/unavailable states; retrieval time is not start time |
| Photos | Validated, re-encoded WebP in immutable Vercel Blob objects when configured; local disk otherwise | Each upload owns a unique object URL. No overwrite of shared hash paths. Shared local storage and separate attachment backups required |

Public APIs have usage limits and no availability guarantee. Production authentication/storage requires a Firebase project and server credentials. This deployment uses Vercel Blob for photos and does not enable paid Firebase Storage. OSRM fallback uses the documented FOSSGIS `routing.openstreetmap.de/routed-car` endpoint, with per-browser request spacing and a short cache. Larger workloads need an appropriately provisioned routing service.

`npm run doctor` checks Node, dependency/store availability, Open-Meteo, RainViewer, OSRM and local backend health. It does not certify licenses, Bengaluru radar coverage, geocoding policy enforcement across foreign deployments, external provider credentials, sensor accuracy, or emergency delivery.

## Activated public integrations

The Vercel deployment uses live TomTom speeds. Open-Meteo/GloFAS adds regional daily river-flow model context (https://open-meteo.com/en/docs/flood-api), not street-flood depth. IMD probes returned 401/API key missing. MyMemory GET (https://mymemory.translated.net/doc/spec.php) generated cached public UI labels only; anonymous quota is 5,000 characters/day per its usage policy. No runtime personal text is sent for translation. See DEPLOYMENT.md for live evidence and limits.
