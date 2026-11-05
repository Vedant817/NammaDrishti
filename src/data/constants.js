// src/data/constants.js
export const BENGALURU_CENTER = [12.9716, 77.5946];

export const mapConfig = {
  center: BENGALURU_CENTER,
  zoom: 12,
  minZoom: 10,
  maxZoom: 18,
};

export const filters = [
  { id: "All", name: "All Hazards", icon: "🗺️", color: "#3B82F6" },
  { id: "Traffic", name: "Traffic Jams", icon: "🚗", color: "#EF4444" },
  { id: "Waterlogging", name: "Waterlogging", icon: "🌊", color: "#06B6D4" },
  { id: "Accident", name: "Accidents", icon: "⚠️", color: "#F59E0B" },
  { id: "Infrastructure", name: "Potholes / Infra", icon: "🔧", color: "#8B5CF6" },
  { id: "Event", name: "Events / Fests", icon: "🎉", color: "#EC4899" },
  { id: "Rain", name: "Rain & Weather", icon: "🌧️", color: "#3B82F6" },
];

export const EMERGENCY_CONTACTS = [
  { name: "Bengaluru Traffic Police (BTP)", number: "1095 / 080-22943030", desc: "Real-time traffic control & breakdowns" },
  { name: "BBMP Control Room (Civic Grievances)", number: "1533 / 080-22221188", desc: "Flooding, fallen trees, potholes" },
  { name: "BESCOM Power Outage", number: "1912", desc: "Downed lines & power issues" },
  { name: "BWSSB Water / Sewage Breakdown", number: "1916", desc: "Burst water mains & contamination" },
  { name: "State Emergency Services", number: "112", desc: "Police, Fire, and Ambulance" },
];
