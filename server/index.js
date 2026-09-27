// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '10mb' }));

// Setup Socket.io for Real-Time Event Dispatch
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const DATA_FILE = path.join(__dirname, 'incidents.json');

// In-Memory Incident Store initialized from disk
let incidents = [];
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    incidents = JSON.parse(raw);
    // Ensure all incidents have a valid createdAt timestamp for TTL decay
    const now = Date.now();
    incidents = incidents.map((inc) => {
      if (!inc.createdAt) {
        let minsAgo = 30;
        if (typeof inc.timestamp === 'string') {
          const match = inc.timestamp.match(/(\d+)\s*mins?\s*ago/i);
          if (match) minsAgo = parseInt(match[1], 10);
        }
        return {
          ...inc,
          createdAt: new Date(now - minsAgo * 60 * 1000).toISOString(),
        };
      }
      return inc;
    });
  }
} catch (err) {
  console.error('Error loading incidents file, initializing empty dataset:', err.message);
  incidents = [];
}

// Haversine formula for calculating distance between coordinates in kilometers
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
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

// Category-based dynamic half-life TTL policies (in hours)
const TTL_HOURS_BY_TYPE = {
  Accident: 2,         // Cleared faster once police / cranes assist
  Traffic: 3,          // Peak hours dissipate
  Waterlogging: 4,     // Drains / pumping stations clear water
  Infrastructure: 72,  // Potholes / sinkholes require longer civic repair
};
const DEFAULT_TTL_HOURS = 4;

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

  const remaining = incidents.filter((incident) => {
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

  if (remaining.length !== initialCount) {
    const backup = incidents;
    incidents = remaining;
    const saved = persistIncidents();
    if (!saved) {
      // Rollback if persistence failed
      incidents = backup;
      return [];
    }
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
    // Save previous values for atomic rollback
    const prevCount = clusterMatch.verificationCount || 1;
    const prevScore = clusterMatch.verificationScore || prevCount;
    const prevClusterCount = clusterMatch.clusterCount || 1;
    const prevIsVerified = !!clusterMatch.isVerified;
    const prevUpdates = clusterMatch.updates ? [...clusterMatch.updates] : [];

    clusterMatch.verificationCount = prevCount + 1;
    clusterMatch.verificationScore = Number((prevScore + 1.0).toFixed(2));
    clusterMatch.clusterCount = prevClusterCount + 1;
    if (clusterMatch.verificationCount >= 3 || clusterMatch.verificationScore >= 2.5) {
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

    const saved = persistIncidents();
    if (!saved) {
      // Rollback on failed write
      clusterMatch.verificationCount = prevCount;
      clusterMatch.verificationScore = prevScore;
      clusterMatch.clusterCount = prevClusterCount;
      clusterMatch.isVerified = prevIsVerified;
      clusterMatch.updates = prevUpdates;
      return res.status(500).json({ error: 'Failed to write clustered incident to persistent storage.' });
    }

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
      message: 'Merged with nearby active hazard report within 200m corridor.',
    });
  }

  // 2. NEW INCIDENT CREATION
  const newIncident = {
    id: id || `namma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: category,
    title: String(title).trim(),
    ward: ward || 'Bengaluru Urban',
    description: String(description).trim(),
    position: { lat, lng },
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
    urgency: urgency || 'Medium',
    verificationCount: 1,
    verificationScore: 1.0,
    clusterCount: 1,
    isVerified: false,
    reportedBy: req.body.reportedBy || 'Citizen Contributor',
    mediaUrl: mediaUrl || null,
    clearanceVotes: 0,
    updates: [],
  };

  incidents.unshift(newIncident);

  const saved = persistIncidents();
  if (!saved) {
    incidents.shift(); // Rollback in-memory state on write error
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

  // Calculate proximity weight: On-ground commuters (<= 1.5km) receive full weight (1.0)
  // Remote commuters receive weighted verification (0.25)
  let weight = 0.5;
  let isGroundVerified = false;
  let distKm = 0;

  if (voterPosition && Number.isFinite(Number(voterPosition.lat)) && Number.isFinite(Number(voterPosition.lng))) {
    distKm = getDistanceKm(incident.position.lat, incident.position.lng, Number(voterPosition.lat), Number(voterPosition.lng));
    if (distKm <= 1.5) {
      weight = 1.0; // On-ground observation
      isGroundVerified = true;
    } else {
      weight = 0.25; // Remote observation
      isGroundVerified = false;
    }
  }

  const prevCount = incident.verificationCount || 1;
  const prevScore = incident.verificationScore || prevCount;
  const prevIsVerified = !!incident.isVerified;

  incident.verificationCount = prevCount + 1;
  incident.verificationScore = Number((prevScore + weight).toFixed(2));

  if (incident.verificationScore >= 2.5 || incident.verificationCount >= 3) {
    incident.isVerified = true;
  }

  const saved = persistIncidents();
  if (!saved) {
    incident.verificationCount = prevCount;
    incident.verificationScore = prevScore;
    incident.isVerified = prevIsVerified;
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
    id: incident.id,
    verificationCount: incident.verificationCount,
    verificationScore: incident.verificationScore,
    isVerified: incident.isVerified,
    weight,
    groundVerified: isGroundVerified,
  });
});

// 4. MULTI-CITIZEN CLEARANCE ENDPOINT
app.post('/api/incidents/:id/resolve', (req, res) => {
  const { id } = req.params;
  const index = incidents.findIndex((i) => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const incident = incidents[index];
  incident.clearanceVotes = (incident.clearanceVotes || 0) + 1;

  if (incident.clearanceVotes >= 2) {
    const [cleared] = incidents.splice(index, 1);
    const saved = persistIncidents();
    if (!saved) {
      incidents.splice(index, 0, cleared);
      return res.status(500).json({ error: 'Failed to persist incident clearance.' });
    }

    io.emit('incident:resolved', {
      id: cleared.id,
      clearedBy: 'Citizen Consensus (2 verifications)',
      timestamp: new Date().toISOString(),
    });

    return res.json({
      message: 'Incident marked resolved and removed from live map by citizen consensus.',
      id: cleared.id,
      cleared: true,
    });
  }

  persistIncidents();

  io.emit('incident:clearance_vote', {
    id: incident.id,
    clearanceVotes: incident.clearanceVotes,
    votesNeeded: 2 - incident.clearanceVotes,
  });

  res.json({
    message: `Resolution vote recorded. ${2 - incident.clearanceVotes} more confirmation needed to clear hazard.`,
    id: incident.id,
    clearanceVotes: incident.clearanceVotes,
    cleared: false,
  });
});

// 5. CONVERSATIONAL AI TRANSIT ASSISTANT ENDPOINT
app.post('/api/assistant/chat', (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Prompt message is required.' });
  }

  const query = message.toLowerCase().trim();
  const activeHazards = incidents.filter((i) => !i.isResolved);
  const trafficCount = activeHazards.filter((i) => i.type === 'Traffic').length;
  const waterlogCount = activeHazards.filter((i) => i.type === 'Waterlogging').length;

  let reply = '';
  const sources = [];

  if (query.includes('silk board') || query.includes('silkboard')) {
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
    const hebbal = activeHazards.find(
      (i) =>
        i.title.toLowerCase().includes('hebbal') ||
        i.title.toLowerCase().includes('airport') ||
        (i.ward && i.ward.toLowerCase().includes('hebbal'))
    );
    if (hebbal) {
      reply = `✈️ Airport Expressway Advisory: Accident reported near Hebbal Flyover approach ramp (${hebbal.description}). Expect +20 mins transit delay. Plan extra lead time for KIA flights.`;
      sources.push(hebbal.title);
    } else {
      reply = `Hebbal Flyover and Bellary Road to Kempegowda International Airport are clear with steady moving traffic.`;
    }
  } else if (query.includes('radar') || query.includes('rain') || query.includes('weather') || query.includes('forecast')) {
    reply = `🌧️ Rain & Radar Status: RainViewer Doppler radar is tracking real-time precipitation across Bengaluru. Current civic telemetry shows ${waterlogCount} active waterlogged stretch(es). Check the live Doppler overlay and Underpass Diagnostic tab for rainfall accumulation alerts.`;
    sources.push('RainViewer Doppler & Open-Meteo Telemetry');
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
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send initial dataset snapshot to freshly connected client
  socket.emit('initial:data', incidents);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Export server, app, and internal functions for automated testing
module.exports = {
  app,
  server,
  getDistanceKm,
  cleanupExpiredIncidents,
  TTL_HOURS_BY_TYPE,
};

// Start Server if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`  NammaPulse Real-Time Intelligence Backend    `);
    console.log(`  Port: http://localhost:${PORT}               `);
    console.log(`  Active Incidents Loaded: ${incidents.length} `);
    console.log(`===============================================`);
  });
}
