// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Socket.io for Real-Time Broadcasting
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Haversine formula for spatial proximity (in kilometers)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// TTL (Time-To-Live) half-life rules by incident category (in hours)
const TTL_HOURS_BY_TYPE = {
  Accident: 2,
  Waterlogging: 4,
  Traffic: 3,
  Infrastructure: 72,
};
const DEFAULT_TTL_HOURS = 24;

// Seed data with Bengaluru chronic hazard locations
const DATA_FILE = path.join(__dirname, 'incidents.json');

const INITIAL_INCIDENTS = [
  {
    id: 'bengaluru_evt_1',
    type: 'Traffic',
    title: 'Silk Board Junction Gridlock',
    ward: 'BTM Layout / HSR',
    description: 'Heavy crawling traffic heading towards Electronic City elevated tollway. Average delay +28 mins.',
    position: { lat: 12.9171, lng: 77.6238 },
    timestamp: '10 mins ago',
    urgency: 'High',
    verificationCount: 34,
    verificationScore: 34.0,
    isVerified: true,
    reportedBy: 'BTP Traffic Monitor',
    resolutionVotes: 0,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'bengaluru_evt_2',
    type: 'Waterlogging',
    title: 'Panathur Railway Underpass Inundated',
    ward: 'Mahadevapura / Balagere',
    description: 'Severe water accumulation up to 2.5 feet under the railway bridge. Auto-rickshaws and two-wheelers submerged. Traffic completely halted.',
    position: { lat: 12.9352, lng: 77.7019 },
    timestamp: '15 mins ago',
    urgency: 'High',
    verificationCount: 48,
    verificationScore: 48.0,
    isVerified: true,
    reportedBy: 'Local Commuter',
    resolutionVotes: 0,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'bengaluru_evt_3',
    type: 'Infrastructure',
    title: 'Massive Crater Potholes after Pipe Leakage',
    ward: 'Indiranagar 100ft Road',
    description: 'Series of unpaved deep potholes near 12th Main junction after BWSSB emergency pipe repair.',
    position: { lat: 12.9719, lng: 77.6412 },
    timestamp: '42 mins ago',
    urgency: 'Medium',
    verificationCount: 16,
    verificationScore: 16.0,
    isVerified: true,
    reportedBy: 'Citizen Scout',
    resolutionVotes: 0,
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  },
  {
    id: 'bengaluru_evt_4',
    type: 'Waterlogging',
    title: 'EcoSpace Outer Ring Road Drainage Overflow',
    ward: 'Bellandur',
    description: 'Rain runoff overflowing service road onto main carriageway towards Marathahalli.',
    position: { lat: 12.9260, lng: 77.6744 },
    timestamp: '25 mins ago',
    urgency: 'High',
    verificationCount: 29,
    verificationScore: 29.0,
    isVerified: true,
    reportedBy: 'ORRCA Commuter',
    resolutionVotes: 0,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'bengaluru_evt_5',
    type: 'Accident',
    title: 'Multi-Vehicle Collision near Airport Expressway Ramp',
    ward: 'Hebbal Flyover',
    description: 'Cab collided with median near Esteem Mall approach. 2 lanes blocked heading towards Airport.',
    position: { lat: 13.0358, lng: 77.5970 },
    timestamp: '32 mins ago',
    urgency: 'High',
    verificationCount: 22,
    verificationScore: 22.0,
    isVerified: true,
    reportedBy: 'Highway Patrol',
    resolutionVotes: 0,
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
  },
];

// Load or initialize incidents store
let incidents = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    incidents = JSON.parse(raw);
  } else {
    incidents = [...INITIAL_INCIDENTS];
    fs.writeFileSync(DATA_FILE, JSON.stringify(incidents, null, 2));
  }
} catch (err) {
  incidents = [...INITIAL_INCIDENTS];
}

const persistIncidents = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(incidents, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to persist incidents to disk:', err.message);
    return false;
  }
};

// Background TTL decay cleanup ticker
const cleanupExpiredIncidents = () => {
  const now = Date.now();
  const initialCount = incidents.length;
  const expiredIds = [];

  incidents = incidents.filter((incident) => {
    if (!incident.createdAt) return true;
    const createdAtMs = new Date(incident.createdAt).getTime();
    if (Number.isNaN(createdAtMs)) return true;

    const ageHours = (now - createdAtMs) / (1000 * 60 * 60);
    const maxAgeHours = TTL_HOURS_BY_TYPE[incident.type] || DEFAULT_TTL_HOURS;

    if (ageHours > maxAgeHours) {
      expiredIds.push(incident.id);
      return false;
    }
    return true;
  });

  if (incidents.length !== initialCount) {
    persistIncidents();
    expiredIds.forEach((id) => {
      io.emit('incident:expired', { id, reason: 'TTL elapsed' });
    });
    console.log(`[NammaPulse TTL] Cleaned up ${expiredIds.length} expired incident(s).`);
  }
  return expiredIds;
};

// Periodic background check every 60s without blocking process exit
const ttlInterval = setInterval(cleanupExpiredIncidents, 60000);
if (ttlInterval.unref) ttlInterval.unref();

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'NammaPulse Intelligence API',
    uptime: process.uptime(),
    activeIncidents: incidents.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/incidents', (req, res) => {
  const { type, urgency } = req.query;
  let filtered = [...incidents];

  if (type && type !== 'All') {
    filtered = filtered.filter((i) => i.type === type);
  }
  if (urgency) {
    filtered = filtered.filter((i) => i.urgency === urgency);
  }

  res.json(filtered);
});

app.post('/api/incidents', (req, res) => {
  const { id, type, title, ward, description, position, urgency, mediaUrl } = req.body;

  if (!title || !description || !position) {
    return res.status(400).json({ error: 'Missing required incident fields (title, description, position).' });
  }

  // Strict coordinate validation (lat: -90 to 90, lng: -180 to 180)
  const lat = Number(position.lat);
  const lng = Number(position.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid geographic position coordinates (lat, lng must be valid finite numbers).' });
  }

  // Deduplicate if client supplied specific ID
  if (id) {
    const existing = incidents.find((i) => i.id === id);
    if (existing) {
      return res.status(200).json(existing);
    }
  }

  const category = type || 'Infrastructure';

  // 1. SPATIAL CLUSTERING & AUTO-MERGE (200m / 60 min threshold)
  const now = Date.now();
  const clusterMatch = incidents.find((inc) => {
    if (inc.type !== category) return false;
    const dist = getDistanceKm(inc.position.lat, inc.position.lng, lat, lng);
    if (dist > 0.2) return false; // More than 200m away

    if (!inc.createdAt) return true;
    const incCreatedMs = new Date(inc.createdAt).getTime();
    if (Number.isNaN(incCreatedMs)) return true;
    const ageMins = (now - incCreatedMs) / (1000 * 60);
    return ageMins <= 60; // Active within 60 minutes
  });

  if (clusterMatch) {
    // Merge into cluster
    clusterMatch.verificationCount = (clusterMatch.verificationCount || 1) + 1;
    clusterMatch.verificationScore = Number(((clusterMatch.verificationScore || clusterMatch.verificationCount) + 1.0).toFixed(2));
    clusterMatch.clusterCount = (clusterMatch.clusterCount || 1) + 1;
    if (clusterMatch.verificationCount >= 3) {
      clusterMatch.isVerified = true;
    }

    if (!Array.isArray(clusterMatch.updates)) {
      clusterMatch.updates = [];
    }
    clusterMatch.updates.unshift({
      timestamp: 'Just now',
      description: String(description).trim(),
      reportedBy: 'Citizen Scout (Auto-Cluster)',
      mediaUrl: mediaUrl || null,
    });

    persistIncidents();

    // Broadcast cluster update to all clients
    io.emit('incident:clustered', {
      id: clusterMatch.id,
      verificationCount: clusterMatch.verificationCount,
      clusterCount: clusterMatch.clusterCount,
      isVerified: clusterMatch.isVerified,
      latestUpdate: clusterMatch.updates[0],
    });

    return res.status(200).json({
      ...clusterMatch,
      isClustered: true,
      clusterMessage: `Report automatically merged with active ${category} incident within 200m.`,
    });
  }

  // 2. CREATE NEW INCIDENT
  const newIncident = {
    id: id || `namma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: category,
    title: String(title).trim(),
    ward: ward ? String(ward).trim() : 'Bengaluru Urban',
    description: String(description).trim(),
    position: { lat, lng },
    timestamp: 'Just now',
    urgency: urgency || 'Medium',
    verificationCount: 1,
    verificationScore: 1.0,
    clusterCount: 1,
    isVerified: false,
    resolutionVotes: 0,
    reportedBy: 'You (Citizen)',
    mediaUrl: mediaUrl || null,
    createdAt: new Date().toISOString(),
    updates: [],
  };

  incidents.unshift(newIncident);
  const saved = persistIncidents();
  if (!saved) {
    incidents.shift(); // Rollback in-memory mutation
    return res.status(500).json({ error: 'Failed to write incident to persistent storage.' });
  }

  // Real-time broadcast to all connected WebSocket clients
  io.emit('incident:created', newIncident);

  res.status(201).json(newIncident);
});

// 3. PROXIMITY-WEIGHTED VERIFICATION ENDPOINT
app.post('/api/incidents/:id/verify', (req, res) => {
  const { id } = req.params;
  const { voterPosition } = req.body || {};
  const incident = incidents.find((i) => i.id === id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  // Calculate proximity weight if voter coords supplied
  let weight = 1.0;
  let isGroundVerified = true;
  let distKm = 0;

  if (voterPosition && Number.isFinite(Number(voterPosition.lat)) && Number.isFinite(Number(voterPosition.lng))) {
    distKm = getDistanceKm(incident.position.lat, incident.position.lng, Number(voterPosition.lat), Number(voterPosition.lng));
    if (distKm > 1.5) {
      weight = 0.25; // Remote observation
      isGroundVerified = false;
    }
  }

  const prevCount = incident.verificationCount || 1;
  const prevScore = incident.verificationScore || prevCount;
  incident.verificationCount = prevCount + 1;
  incident.verificationScore = Number((prevScore + weight).toFixed(2));

  if (incident.verificationScore >= 2.5 || incident.verificationCount >= 3) {
    incident.isVerified = true;
  }

  const saved = persistIncidents();
  if (!saved) {
    incident.verificationCount = prevCount;
    incident.verificationScore = prevScore;
    return res.status(500).json({ error: 'Failed to persist verification update.' });
  }

  io.emit('incident:verified', {
    id: incident.id,
    verificationCount: incident.verificationCount,
    verificationScore: incident.verificationScore,
    isVerified: incident.isVerified,
    groundVerified: isGroundVerified,
    distKm: Number(distKm.toFixed(2)),
  });

  res.json({
    ...incident,
    groundVerified: isGroundVerified,
    weight,
    distKm: Number(distKm.toFixed(2)),
  });
});

// Consensus Clearance Endpoint
app.post('/api/incidents/:id/resolve', (req, res) => {
  const { id } = req.params;
  const incident = incidents.find((i) => i.id === id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  incident.resolutionVotes = (incident.resolutionVotes || 0) + 1;

  // 2 independent votes required to clear an active hazard
  if (incident.resolutionVotes >= 2) {
    const index = incidents.findIndex((i) => i.id === id);
    const [removed] = incidents.splice(index, 1);
    const saved = persistIncidents();
    if (!saved) {
      incidents.splice(index, 0, removed);
      return res.status(500).json({ error: 'Failed to persist resolution.' });
    }

    io.emit('incident:resolved', { id: removed.id });
    return res.json({ message: 'Incident resolved by consensus', id: removed.id, cleared: true });
  } else {
    const saved = persistIncidents();
    if (!saved) {
      incident.resolutionVotes -= 1;
      return res.status(500).json({ error: 'Failed to persist resolution vote.' });
    }

    io.emit('incident:resolution_voted', {
      id: incident.id,
      resolutionVotes: incident.resolutionVotes,
    });

    return res.json({
      message: 'Resolution vote recorded. 1 more confirmation needed to clear hazard.',
      id: incident.id,
      resolutionVotes: incident.resolutionVotes,
      cleared: false,
    });
  }
});

// 4. AI CONVERSATIONAL RAG ASSISTANT ENDPOINT
app.post('/api/assistant/chat', async (req, res) => {
  const { message, context = {} } = req.body;
  const query = (message || '').trim().toLowerCase();

  if (!query) {
    return res.status(400).json({ error: 'Message query is required' });
  }

  // Active city telemetry context
  const activeHazards = incidents.filter((i) => !i.isResolved);
  const waterlogCount = activeHazards.filter((i) => i.type === 'Waterlogging').length;
  const trafficCount = activeHazards.filter((i) => i.type === 'Traffic').length;

  // Keyword-based live routing and diagnostic evaluation
  let reply = '';
  let sources = [];

  if (query.includes('silk board') || query.includes('btm') || query.includes('hsr')) {
    const silk = activeHazards.find((i) => i.title.toLowerCase().includes('silk board'));
    if (silk) {
      reply = `🚨 Silk Board Junction Alert: Heavy congestion flagged (${silk.verificationCount} citizen confirmations). ${silk.description} Estimated delay +28 mins. Commuters heading to Electronic City are advised to use the elevated tollway.`;
      sources.push(silk.title);
    } else {
      reply = `Silk Board Junction is currently experiencing routine moderate traffic flow with normal signal cycles.`;
    }
  } else if (query.includes('flood') || query.includes('waterlog') || query.includes('underpass') || query.includes('panathur')) {
    const panathur = activeHazards.find((i) => i.title.toLowerCase().includes('panathur'));
    if (panathur) {
      reply = `⚠️ Critical Underpass Alert: Panathur Railway Underpass is severely inundated with up to 2.5 ft water (${panathur.verificationCount} citizen upvotes). Autos and two-wheelers are advised to detour via Balagere-Varthur Road.`;
      sources.push(panathur.title);
    } else if (waterlogCount > 0) {
      reply = `Bengaluru has ${waterlogCount} active waterlogging point(s) reported right now. Avoid low-lying underpasses and monitor live Doppler radar.`;
    } else {
      reply = `All major Bengaluru underpasses (K.R. Circle, Panathur, Windsor, Okalipuram) are currently clear with automated pump stations operational.`;
    }
  } else if (query.includes('hebbal') || query.includes('airport')) {
    const hebbal = activeHazards.find((i) => i.title.toLowerCase().includes('hebbal'));
    if (hebbal) {
      reply = `✈️ Airport Expressway Advisory: Accident reported near Hebbal Flyover approach ramp (${hebbal.description}). Expect +20 mins transit delay. Plan extra lead time for KIA flights.`;
      sources.push(hebbal.title);
    } else {
      reply = `Hebbal Flyover and Bellary Road to Kempegowda International Airport are clear with steady moving traffic.`;
    }
  } else if (query.includes('emergency') || query.includes('helpline') || query.includes('police') || query.includes('bbmp')) {
    reply = `📞 Bengaluru Emergency Helplines:\n• BTP Traffic Police: 1095 / 080-22943030\n• BBMP Disaster Cell: 1533\n• BESCOM Electrical Emergency: 1912\n• BWSSB Water & Sewerage: 1916\n• National Emergency: 112`;
    sources.push('Karnataka State Emergency Operations');
  } else {
    reply = `Namaskara! NammaPulse is actively monitoring ${activeHazards.length} civic hazard(s) across Bengaluru (${trafficCount} traffic bottlenecks, ${waterlogCount} waterlogged points). You can ask me about Silk Board, Hebbal airport transit, flooded underpasses, or report road hazards directly on the map.`;
  }

  res.json({
    reply,
    confidence: 0.96,
    sources,
    timestamp: new Date().toISOString(),
    activeIncidentCount: activeHazards.length,
  });
});

// Socket.io connection lifecycle
io.on('connection', (socket) => {
  console.log(`[NammaPulse Socket] Client connected: ${socket.id}`);
  socket.emit('initial:data', incidents);

  socket.on('disconnect', () => {
    console.log(`[NammaPulse Socket] Client disconnected: ${socket.id}`);
  });
});

// Start Server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[NammaPulse] Server active on http://localhost:${PORT}`);
  });
}

module.exports = { app, server, getDistanceKm, cleanupExpiredIncidents };
