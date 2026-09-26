// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5001;

// Enable CORS for frontend client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '10mb' }));

// Socket.io for Real-Time Broadcasting
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Seed data with Bengaluru chronic hazard locations
const DATA_FILE = path.join(__dirname, 'incidents.json');

const INITIAL_INCIDENTS = [
  {\n    id: 'bengaluru_evt_1',\n    type: 'Traffic',\n    title: 'Silk Board Junction Gridlock',\n    ward: 'BTM Layout / HSR',\n    description: 'Heavy crawling traffic heading towards Electronic City elevated tollway. Average delay +28 mins.',\n    position: { lat: 12.9171, lng: 77.6238 },\n    timestamp: '10 mins ago',\n    urgency: 'High',\n    verificationCount: 34,\n    isVerified: true,\n    reportedBy: 'BTP Traffic Monitor',\n    resolutionVotes: 0,\n  },\n  {\n    id: 'bengaluru_evt_2',\n    type: 'Waterlogging',\n    title: 'Panathur Railway Underpass Inundated',\n    ward: 'Mahadevapura / Balagere',\n    description: 'Severe water accumulation up to 2.5 feet under the railway bridge. Auto-rickshaws and two-wheelers submerged. Traffic completely halted.',\n    position: { lat: 12.9352, lng: 77.7019 },\n    timestamp: '15 mins ago',\n    urgency: 'High',\n    verificationCount: 48,\n    isVerified: true,\n    reportedBy: 'Local Commuter',\n    resolutionVotes: 0,\n  },\n  {\n    id: 'bengaluru_evt_3',\n    type: 'Infrastructure',\n    title: 'Massive Crater Potholes after Pipe Leakage',\n    ward: 'Indiranagar 100ft Road',\n    description: 'Series of unpaved deep potholes near 12th Main junction after BWSSB emergency pipe repair.',\n    position: { lat: 12.9719, lng: 77.6412 },\n    timestamp: '42 mins ago',\n    urgency: 'Medium',\n    verificationCount: 16,\n    isVerified: true,\n    reportedBy: 'Citizen Scout',\n    resolutionVotes: 0,\n  },\n  {\n    id: 'bengaluru_evt_4',\n    type: 'Waterlogging',\n    title: 'EcoSpace Outer Ring Road Drainage Overflow',\n    ward: 'Bellandur',\n    description: 'Rain runoff overflowing service road onto main carriageway towards Marathahalli.',\n    position: { lat: 12.9260, lng: 77.6744 },\n    timestamp: '25 mins ago',\n    urgency: 'High',\n    verificationCount: 29,\n    isVerified: true,\n    reportedBy: 'ORRCA Commuter',\n    resolutionVotes: 0,\n  },\n  {\n    id: 'bengaluru_evt_5',\n    type: 'Accident',\n    title: 'Multi-Vehicle Collision near Airport Expressway Ramp',\n    ward: 'Hebbal Flyover',\n    description: 'Cab collided with median near Esteem Mall approach. 2 lanes blocked heading towards Airport.',\n    position: { lat: 13.0358, lng: 77.5970 },\n    timestamp: '32 mins ago',\n    urgency: 'High',\n    verificationCount: 22,\n    isVerified: true,\n    reportedBy: 'Highway Patrol',\n    resolutionVotes: 0,\n  },\n];

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

  const newIncident = {
    id: id || `namma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: type || 'Infrastructure',
    title: String(title).trim(),
    ward: ward ? String(ward).trim() : 'Bengaluru Urban',
    description: String(description).trim(),
    position: { lat, lng },
    timestamp: 'Just now',
    urgency: urgency || 'Medium',
    verificationCount: 1,
    isVerified: false,
    resolutionVotes: 0,
    reportedBy: 'You (Citizen)',
    mediaUrl: mediaUrl || null,
    createdAt: new Date().toISOString(),
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

app.post('/api/incidents/:id/verify', (req, res) => {
  const { id } = req.params;
  const incident = incidents.find((i) => i.id === id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const prevCount = incident.verificationCount || 1;
  incident.verificationCount = prevCount + 1;
  if (incident.verificationCount >= 3) {
    incident.isVerified = true;
  }

  const saved = persistIncidents();
  if (!saved) {
    incident.verificationCount = prevCount;
    return res.status(500).json({ error: 'Failed to persist verification update.' });
  }

  io.emit('incident:verified', {
    id: incident.id,
    verificationCount: incident.verificationCount,
    isVerified: incident.isVerified,
  });

  res.json(incident);
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

module.exports = { app, server };
