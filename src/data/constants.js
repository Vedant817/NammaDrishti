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

export const BENGALURU_HUBS = [
  { id: "silk-board", name: "Silk Board Junction", zone: "South", lat: 12.9171, lng: 77.6238 },
  { id: "koramangala", name: "Koramangala Sony World", zone: "South-East", lat: 12.9345, lng: 77.6258 },
  { id: "indiranagar", name: "Indiranagar 100ft Road", zone: "East", lat: 12.9719, lng: 77.6412 },
  { id: "marathahalli", name: "Marathahalli Bridge", zone: "East", lat: 12.9592, lng: 77.6974 },
  { id: "bellandur", name: "Bellandur EcoSpace (ORR)", zone: "South-East", lat: 12.9260, lng: 77.6744 },
  { id: "whitefield", name: "Whitefield ITPL", zone: "East", lat: 12.9868, lng: 77.7378 },
  { id: "hebbal", name: "Hebbal Flyover Junction", zone: "North", lat: 13.0358, lng: 77.5970 },
  { id: "mg-road", name: "MG Road Metro Station", zone: "Central", lat: 12.9754, lng: 77.6068 },
  { id: "electronic-city", name: "Electronic City Toll", zone: "South", lat: 12.8452, lng: 77.6602 },
];
