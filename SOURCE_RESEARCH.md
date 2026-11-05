# Public-source investigation — 5 November 2026

Research used web search, Tavily advanced search with India relevance, Context.dev and Firecrawl domain-filtered searches, followed by direct HTTP probes and primary documentation. Search snippets and similarly named apps were discovery aids; a published page is not proof of a usable API or fresh observations.

## Comparable products

- [NDMA SACHET](https://sachet.ndma.gov.in/): national multi-hazard warnings, validity windows and multilingual CAP alerts. Its public [RSS information](https://sachet.ndma.gov.in/CapFeed) explicitly describes redistribution; the RSS response declares public-domain copyright. This is the government integration added here.
- [Bengaluru Traffic Police ASTraM](https://btp.karnataka.gov.in/200/be-aware-be-smart/en): the official indexed page describes traffic updates and citizen reporting. Direct page requests were unavailable during this audit; an anonymous documented incident API was not verified. The app links to BTP rather than presenting scraped snippets as live alerts.
- [Varunamitra](https://varunamitra.karnataka.gov.in/Currentrain/Index): Karnataka's rainfall/flood dashboard. Search indexed an earlier date; direct HTTPS requests failed here. No readings were imported or relabeled as today's data.
- [TomTom Bengaluru Traffic Index](https://www.tomtom.com/traffic-index/city/bengaluru/): city traffic statistics and historical comparisons. Its annual statistics are not today's road observations. The app uses authorized flow/incident APIs instead of copying the annual index.

## Integrated and verified

### NDMA SACHET CAP

`GET https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails` discovers candidates; `FetchXMLFile?identifier=<numeric identifier>` supplies the authoritative CAP document. Only Actual/Public Alert or Update messages mentioning Bengaluru are shown within their explicit effective/expiry window. Referenced actual cancellations and updates retire older records. English/Kannada source text is retained, with other supplied languages preserved. Alert areas are warnings, not point flood-depth observations.

Responses are bounded, XML DTD/entity declarations are rejected, namespaces are checked, and failures are separate from successful empty feeds. Partial candidate failures remain visible. Source links point back to NDMA. The RSS channel's older publication date is not used as the issue time of individual alerts.

### TomTom present incidents

The configured key successfully authorized [Incident Details v5](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-incidents/incident-details), in addition to the existing flow API. A fixed Bengaluru bounding box and `timeValidityFilter=present` request congestion, closures, roadworks and other available categories. Future/ended/out-of-bounds records are excluded. Missing delays remain unknown.

The original 500-record processing cap truncated the live response. Processing now supports up to 2,000 records within the bounded upstream response, with explicit truncation notice. Search covers the returned set and the UI pages 30 items at a time. Incident markers have an independent toggle and use a canvas renderer. Roadworks may have started months ago and remain active according to the provider: start time and retrieval time are shown separately.

### Weather, river model, routing and map

Open-Meteo current estimates, RainViewer past frames, Nominatim explicit place search, OSRM road routing and OpenStreetMap remain active. River model requests specify Asia/Kolkata; the server rejects a forecast lacking today's Bengaluru date and changes the cache key at IST midnight. Neither the river model nor radar establishes underpass depth or road clearance. Route hazard checks use citizen reports; users are directed to Public alerts for provider closures. OSRM ETA excludes live traffic.

## Access gaps and sources not imported

- [IMD API gateway](https://api.imd.gov.in/public/): direct AWS observation probe returned HTTP 401, `API key missing`. An approved key is needed for that gateway. IMD-origin warnings are available through SACHET without pretending station observations are configured.
- KSNDMC/Varunamitra and BTP: public products exist, but a current, documented, anonymous machine-readable feed was not verified here. Access failures do not prove the services are globally down.
- BMTC/BMRCL real-time transport: discovery found announcements of data sharing, not a verified anonymous operational feed suitable for this deployment. No old GTFS schedules are labeled as live vehicle locations.
- Calibrated underpass depth, pumps/barriers, confirmed agency dispatch and complete traffic coverage on every road remain unavailable. They are not synthesized from rain estimates or empty report counts.

## Reproduce live API acceptance

Set `ACCEPTANCE_API_URL=https://nammadrishti.vercel.app/api`, then run `npm run test:live-sources`. This read-only test checks health, current weather age, actual speed samples, today's river dates, valid CAP windows, authorized incident access, geocoding, traffic PNGs, push configuration and unauthenticated moderation denial. Privileged fixture tests remain separate in `scripts/verify-auth-moderation.js`; fixtures are removed after the run.
