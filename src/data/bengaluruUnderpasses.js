// src/data/bengaluruUnderpasses.js
/**
 * Candidate underpass locations for citizen report correlation.
 * Coordinates require field verification; no engineered thresholds or equipment claims.
 */

const candidates = [
  {
    id: "up_kr_circle",
    name: "K.R. Circle Underpass",
    zone: "East / Central",
    lat: 12.9734,
    lng: 77.5898,
  },
  {
    id: "up_panathur",
    name: "Panathur Railway Underpass",
    zone: "Mahadevapura",
    lat: 12.9352,
    lng: 77.7019,
  },
  {
    id: "up_windsor",
    name: "Windsor Manor / Sankey Underpass",
    zone: "West",
    lat: 12.9928,
    lng: 77.5833,
  },
  {
    id: "up_okalipuram",
    name: "Okalipuram Railway Underpass",
    zone: "West / Majestic",
    lat: 12.9818,
    lng: 77.5645,
  },
  {
    id: "up_benniganahalli",
    name: "Benniganahalli Railway Bridge Underpass",
    zone: "East / KR Puram",
    lat: 12.9985,
    lng: 77.6635,
  },
  {
    id: "up_marathahalli",
    name: "Marathahalli Multiplex Service Underpass",
    zone: "Mahadevapura / ORR",
    lat: 12.9554,
    lng: 77.7011,
  },
  {
    id: "up_hebbal",
    name: "Hebbal Flyover Approach Underpass",
    zone: "North / Bellary Road",
    lat: 13.0358,
    lng: 77.5970,
  },
  {
    id: "up_silk_board",
    name: "Silk Board Junction Underpass",
    zone: "South / BTM-HSR",
    lat: 12.9171,
    lng: 77.6238,
  },
  {
    id: "up_le_meridien",
    name: "Le Méridien / Old Airport Road Underpass",
    zone: "East / Kodihalli",
    lat: 12.9598,
    lng: 77.6462,
  },
  {
    id: "up_mekhri_circle",
    name: "Mekhri Circle Underpass",
    zone: "North / Cantonment Ring",
    lat: 13.0076,
    lng: 77.5813,
  },
  {
    id: "up_kadubeesanahalli",
    name: "Kadubeesanahalli Railway Bridge Underpass",
    zone: "Mahadevapura / ORR",
    lat: 12.9462,
    lng: 77.7030,
  },
];

// These are approximate candidate map locations, not a verified engineering catalog.
export const evaluateUnderpassRisk = () => ({ level: 'Condition unknown', action: 'No verified water-depth, pump or barrier observation is available. Check conditions locally.', color: '#64748b', isFloodedLikely: false });

export const BENGALURU_UNDERPASSES = candidates.map(p => ({ ...p, provenance: { status: 'unverified location', sourceUrl: null, reviewedAt: null } }));
