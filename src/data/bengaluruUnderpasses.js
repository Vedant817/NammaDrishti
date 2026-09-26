// src/data/bengaluruUnderpasses.js
/**
 * Curated Bengaluru Underpass Vulnerability Catalog
 * Tracks chronic waterlogging chokepoints, drainage pump capacity,
 * and rainfall trigger thresholds (mm/hr) monitored by BBMP / Traffic Police.
 */

export const BENGALURU_UNDERPASSES = [
  {
    id: "up_kr_circle",
    name: "K.R. Circle Underpass",
    zone: "East / Central",
    lat: 12.9734,
    lng: 77.5898,
    criticalThresholdMmPerHour: 8.0,
    maxRecordedDepthFt: 5.5,
    pumpStation: "Dual Submersible 15HP",
    gateStatus: "Automated Barrier Installed",
    drainageOutlet: "Cubbon Park Stormwater Drain",
    riskCategory: "High",
  },
  {
    id: "up_panathur",
    name: "Panathur Railway Underpass",
    zone: "Mahadevapura",
    lat: 12.9352,
    lng: 77.7019,
    criticalThresholdMmPerHour: 6.0,
    maxRecordedDepthFt: 4.2,
    pumpStation: "Single Diesel Pump",
    gateStatus: "Manual Police Barricade",
    drainageOutlet: "Varthur Lake Channel",
    riskCategory: "Critical",
  },
  {
    id: "up_windsor",
    name: "Windsor Manor / Sankey Underpass",
    zone: "West",
    lat: 12.9928,
    lng: 77.5833,
    criticalThresholdMmPerHour: 10.0,
    maxRecordedDepthFt: 3.5,
    pumpStation: "Dual Electric 20HP",
    gateStatus: "Visual Depth Gauge",
    drainageOutlet: "Hebbal Valley SWD",
    riskCategory: "Medium",
  },
  {
    id: "up_okalipuram",
    name: "Okalipuram Railway Underpass",
    zone: "West / Majestic",
    lat: 12.9818,
    lng: 77.5645,
    criticalThresholdMmPerHour: 9.0,
    maxRecordedDepthFt: 4.0,
    pumpStation: "BBMP Fixed Sump 10HP",
    gateStatus: "Manual Gate",
    drainageOutlet: "Vrishabhavathi Stream",
    riskCategory: "High",
  },
  {
    id: "up_benniganahalli",
    name: "Benniganahalli Railway Bridge Underpass",
    zone: "East / KR Puram",
    lat: 12.9985,
    lng: 77.6635,
    criticalThresholdMmPerHour: 7.5,
    maxRecordedDepthFt: 4.8,
    pumpStation: "Dual Sump",
    gateStatus: "BTP Caution Signboard",
    drainageOutlet: "Chelekeri Lake Overflow",
    riskCategory: "Critical",
  },
  {
    id: "up_marathahalli",
    name: "Marathahalli Multiplex Service Underpass",
    zone: "Mahadevapura / ORR",
    lat: 12.9554,
    lng: 77.7011,
    criticalThresholdMmPerHour: 11.0,
    maxRecordedDepthFt: 3.0,
    pumpStation: "Single Electric 10HP",
    gateStatus: "Open",
    drainageOutlet: "Bellandur Catchment Drain",
    riskCategory: "Medium",
  },
];

/**
 * Evaluates live underpass inundation risk given current rainfall intensity (mm/hr)
 */
export const evaluateUnderpassRisk = (underpass, currentRainIntensityMm) => {
  const intensity = Number(currentRainIntensityMm) || 0;
  if (intensity >= underpass.criticalThresholdMmPerHour) {
    return {
      level: "Critical Submersion Risk",
      action: "Avoid Underpass. Automated or manual barricades recommended.",
      color: "#EF4444",
      isFloodedLikely: true,
    };
  } else if (intensity >= underpass.criticalThresholdMmPerHour * 0.6) {
    return {
      level: "Waterlogging Warning",
      action: "Moderate ponding expected. Two-wheelers exercise extreme caution.",
      color: "#F59E0B",
      isFloodedLikely: false,
    };
  }
  return {
    level: "Clear / Normal Flow",
    action: "Drainage sump pumps operating within capacity.",
    color: "#10B981",
    isFloodedLikely: false,
  };
};
