// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

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
    isVerified: true,
    reportedBy: 'BTP Traffic Monitor',
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
    isVerified: true,
    reportedBy: 'Local Commuter',
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
    isVerified: true,
    reportedBy: 'Citizen Scout',
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
    isVerified: true,
    reportedBy: 'ORRCA Commuter',
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
    isVerified: true,
    reportedBy: 'Highway Patrol',
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
  } catch (err) {
    console.error('Failed to persist incidents:', err.message);
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
  const { type, title, ward, description, position, urgency, mediaUrl } = req.body;

  if (!title || !description || !position) {
    return res.status(400).json({ error: 'Missing required incident fields (title, description, position).' });
  }

  const newIncident = {
    id: `namma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: type || 'Infrastructure',
    title,
    ward: ward || 'Bengaluru Urban',
    description,
    position,
    timestamp: 'Just now',
    urgency: urgency || 'Medium',
    verificationCount: 1,
    isVerified: false,
    reportedBy: 'You (Citizen)',
    mediaUrl: mediaUrl || null,
    createdAt: new Date().toISOString(),
  };

  incidents.unshift(newIncident);
  persistIncidents();

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

  incident.verificationCount = (incident.verificationCount || 1) + 1;
  if (incident.verificationCount >= 3) {
    incident.isVerified = true;
  }
  persistIncidents();

  io.emit('incident:verified', {
    id: incident.id,
    verificationCount: incident.verificationCount,
    isVerified: incident.isVerified,
  });

  res.json(incident);
});

app.post('/api/incidents/:id/resolve', (req, res) => {
  const { id } = req.params;
  const index = incidents.findIndex((i) => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const [removed] = incidents.splice(index, 1);
  persistIncidents();

  io.emit('incident:resolved', { id: removed.id });

  res.json({ message: 'Incident resolved successfully', id: removed.id });
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
