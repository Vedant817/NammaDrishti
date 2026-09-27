// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { getHexIndex, getHexRing } = require('./services/spatialHex.js');
const { createRateLimiter } = require('./services/rateLimiter.js');
const { syncBtpAdvisories, getBtpAdvisories, markAdvisoryDismissed } = require('./services/btpIngestion.js');
const { processMediaUpload } = require('./services/mediaService.js');

const app = express();
const server = http.createServer(app);

// Enable CORS for frontend client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup Socket.io for Real-Time Event Dispatch
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'incidents.json');
const SEED_FILE = path.join(__dirname, 'incidents.json');

// In-Memory Incident Store initialized from disk with fresh Docker mount seed copy support
let incidents = [];
try {
  let raw = null;
  if (fs.existsSync(DATA_FILE)) {
    raw = fs.readFileSync(DATA_FILE, 'utf-8');
  } else if (fs.existsSync(SEED_FILE)) {
    // Fresh container deployment with DATA_FILE on clean mount: seed from SEED_FILE
    raw = fs.readFileSync(SEED_FILE, 'utf-8');
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, raw, 'utf-8');
  }

  if (raw) {
    incidents = JSON.parse(raw);
    // Ensure all incidents have a valid createdAt timestamp and hex index
    const now = Date.now();
    incidents = incidents.map((inc) => {
      let createdAt = inc.createdAt;
      if (!createdAt) {
        let minsAgo = 30;
        if (typeof inc.timestamp === 'string') {
          const match = inc.timestamp.match(/(\d+)\s*mins?\s*ago/i);
          if (match) minsAgo = parseInt(match[1], 10);
        }
        createdAt = new Date(now - minsAgo * 60 * 1000).toISOString();
      }
      const lat = inc.position?.lat || 12.9716;
      const lng = inc.position?.lng || 77.5946;
      const hexIndex = inc.hexIndex || getHexIndex(lat, lng, 8);
      return {
        ...inc,
        createdAt,
        hexIndex,
        verificationScore: inc.verificationScore || inc.verificationCount || 1.0,
      };
    });
  }
} catch (err) {
  console.warn('[Storage] Failed to read initial incidents file:', err.message);
  incidents = [];
}

// Persist active incidents to disk atomically with swap backup
function persistIncidents() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const jsonStr = JSON.stringify(incidents, null, 2);
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('[Storage] Error persisting incidents to disk:', err.message);
    return false;
  }
}

// Great-circle Haversine formula to calculate distance in km between two GPS coordinates
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return 0;
  }
  const R = 6371; // Radius of the Earth in km
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const aClamped = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(aClamped), Math.sqrt(1 - aClamped));
  return R * c;
}

// Category-specific TTL policies (in hours)
const TTL_HOURS_BY_TYPE = {
  Traffic: 4,          // Rapidly shifting urban congestion
  Waterlogging: 12,    // Monsoon flooding and underpass inundation
  Accident: 6,         // Roadway collisions and clearance
  Infrastructure: 48,  // Potholes, open drains, electrical hazards
};

// Periodic Background Worker: Purge Stale Incidents based on TTL & Consensus
function cleanupExpiredIncidents() {
  const now = Date.now();
  const initialIncidents = [...incidents];
  const expiredIncidents = [];
  const keptIncidents = [];

  for (const incident of incidents) {
    // Determine category TTL (default 6 hours if type unknown)
    const ttlHours = TTL_HOURS_BY_TYPE[incident.type] || 6;
    const ttlMs = ttlHours * 60 * 60 * 1000;

    let createdMs = new Date(incident.createdAt).getTime();
    if (Number.isNaN(createdMs)) {
      createdMs = now;
    }

    const ageMs = now - createdMs;

    // High consensus hazards receive a 50% TTL grace window
    const consensusMultiplier = (incident.verificationScore >= 3 || incident.verificationCount >= 4) ? 1.5 : 1.0;
    const effectiveTtlMs = ttlMs * consensusMultiplier;

    if (ageMs > effectiveTtlMs) {
      expiredIncidents.push({ incident, ageMs });
    } else {
      keptIncidents.push(incident);
    }
  }

  if (expiredIncidents.length > 0) {
    incidents = keptIncidents;
    const saved = persistIncidents();
    if (!saved) {
      incidents = initialIncidents;
      console.warn('[Lifecycle Worker] Failed to persist cleanup of expired incidents, preserving in-memory state.');
      return [];
    }

    for (const { incident, ageMs } of expiredIncidents) {
      if (incident.isAuthoritative) {
        markAdvisoryDismissed(incident.id);
      }
      io.emit('incident:expired', {
        id: incident.id,
        reason: `Expired after ${Math.round(ageMs / (1000 * 60 * 60))} hours (TTL exceeded).`,
      });
    }
    console.log(`[Lifecycle Worker] Cleaned up and persisted ${expiredIncidents.length} expired incidents.`);
  }

  return expiredIncidents.map((e) => e.incident);
}

// Run cleanup every 5 minutes
const cleanupInterval = setInterval(cleanupExpiredIncidents, 5 * 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

// Periodically ingest official BTP and BBMP civic advisories every 15 minutes
const btpSyncInterval = setInterval(() => {
  const result = syncBtpAdvisories(incidents);
  if (result.addedCount > 0) {
    persistIncidents();
    io.emit('advisories:updated', { addedCount: result.addedCount });
  }
}, 15 * 60 * 1000);
if (btpSyncInterval.unref) btpSyncInterval.unref();

// RATE LIMITERS
const reportLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many incident reports created from this IP. Please wait a minute before submitting again.',
});

const verifyLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Too many verification votes recorded. Please wait a minute before voting again.',
});

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'NammaDrishti AI assistant rate limit reached. Please wait a moment before sending another prompt.',
});

const mediaLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: 'Media upload rate limit reached. Please wait before uploading more photos.',
});

// REST ENDPOINTS

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'NammaDrishti Real-Time Civic & Transit Radar Backend',
    activeIncidents: incidents.length,
    ttlPolicies: TTL_HOURS_BY_TYPE,
    features: {
      spatialClustering: true,
      h3HexPartitioning: true,
      rateLimiting: true,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/incidents', (req, res) => {
  const { type, urgency, ward, verified, hex } = req.query;
  let filtered = [...incidents];

  if (type && type !== 'All') {
    filtered = filtered.filter((i) => i.type.toLowerCase() === type.toLowerCase());
  }
  if (urgency) {
    filtered = filtered.filter((i) => i.urgency === urgency);
  }
  if (ward) {
    filtered = filtered.filter((i) => i.ward && i.ward.toLowerCase().includes(ward.toLowerCase()));
  }
  if (verified !== undefined) {
    const isVer = verified === 'true';
    filtered = filtered.filter((i) => (i.isVerified || (i.verificationCount && i.verificationCount >= 3)) === isVer);
  }
  if (hex) {
    const ring = getHexRing(hex);
    filtered = filtered.filter((i) => ring.includes(i.hexIndex));
  }

  res.json(filtered);
});

// Hexagonal spatial partition endpoint (queries hex cell and its 8 neighbor rings)
app.get('/api/incidents/hex/:hexId', (req, res) => {
  const { hexId } = req.params;
  const targetHexes = new Set(getHexRing(hexId));

  const localizedIncidents = incidents.filter((i) => targetHexes.has(i.hexIndex));
  res.json({
    hexId,
    neighborhoodRing: Array.from(targetHexes),
    totalCount: localizedIncidents.length,
    incidents: localizedIncidents,
  });
});

// Spatial Hex Neighborhood Query (lat, lng)
app.get('/api/incidents/spatial/neighborhood', (req, res) => {
  const { lat, lng } = req.query;
  const nLat = parseFloat(lat);
  const nLng = parseFloat(lng);

  if (isNaN(nLat) || isNaN(nLng)) {
    return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
  }

  const centerHex = getHexIndex(nLat, nLng, 8);
  const ring = getHexRing(centerHex);
  const neighborhoodIncidents = incidents.filter((i) => ring.includes(i.hexIndex));

  res.json({
    centerHex,
    activeRings: ring,
    count: neighborhoodIncidents.length,
    incidents: neighborhoodIncidents,
  });
});

// Official BTP Traffic Police Advisories Endpoint
app.get('/api/advisories/btp', (req, res) => {
  res.json(getBtpAdvisories());
});

app.post('/api/advisories/sync', (req, res) => {
  const result = syncBtpAdvisories(incidents);
  if (result.addedCount > 0) {
    persistIncidents();
    io.emit('advisories:updated', { addedCount: result.addedCount });
  }
  res.json({
    message: `Synchronized official BTP civic advisories.`,
    ...result,
  });
});

// Civic Media Upload Endpoint (Cloudinary CDN or direct storage)
app.post('/api/media/upload', mediaLimiter, async (req, res) => {
  try {
    const { imageBase64, filename, mimeType } = req.body || {};
    const mediaResult = await processMediaUpload({ imageBase64, filename, mimeType });
    res.status(201).json(mediaResult);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/media/status', (req, res) => {
  res.json({
    cloudinaryConfigured: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
    provider: process.env.CLOUDINARY_CLOUD_NAME ? 'Cloudinary CDN' : 'Optimized Direct Storage',
    maxPayloadMb: 10,
  });
});

app.post('/api/incidents', reportLimiter, (req, res) => {
  const { id, type, title, ward, description, position, urgency, mediaUrl } = req.body || {};

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const trimmedDesc = typeof description === 'string' ? description.trim() : '';

  if (!trimmedTitle || !trimmedDesc || !position || typeof position !== 'object') {
    return res.status(400).json({ error: 'Missing required incident fields (title, description, position).' });
  }

  if (trimmedTitle.length > 200 || trimmedDesc.length > 2000) {
    return res.status(400).json({ error: 'Title must be <= 200 characters and description <= 2000 characters.' });
  }

  // Strict coordinate validation (lat: -90 to 90, lng: -180 to 180)
  if (
    position.lat === null ||
    position.lng === null ||
    position.lat === undefined ||
    position.lng === undefined ||
    typeof position.lat === 'boolean' ||
    typeof position.lng === 'boolean'
  ) {
    return res.status(400).json({ error: 'Invalid geographic position coordinates (lat, lng must be valid finite numbers).' });
  }

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

  const allowedTypes = ['Traffic', 'Waterlogging', 'Accident', 'Infrastructure'];
  const category = allowedTypes.includes(type) ? type : 'Infrastructure';
  const hexIndex = getHexIndex(lat, lng, 8);
  const reporterKey = req.body.voterId || req.ip || 'anon_reporter';

  // Sanitize authoritative flags - citizen submissions cannot claim official titles
  const sanitizedReportedBy = String(req.body.reportedBy || 'Citizen Contributor')
    .replace(/(bengaluru traffic police|btp|bbmp|official|police|highway patrol|patrol|traffic monitor|monitor|authority)/gi, 'Citizen')
    .trim() || 'Citizen Contributor';

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
    // Auto-clustering Sybil check: verify reporter has not already contributed to this cluster
    if (!Array.isArray(clusterMatch.reporters)) {
      clusterMatch.reporters = [clusterMatch.reportedBy || 'initial_reporter'];
    }
    const isNewReporter = !clusterMatch.reporters.includes(reporterKey);
    if (isNewReporter) {
      clusterMatch.reporters.push(reporterKey);
    }

    // Save previous values for atomic rollback
    const prevCount = clusterMatch.verificationCount || 1;
    const prevScore = clusterMatch.verificationScore || prevCount;
    const prevClusterCount = clusterMatch.clusterCount || 1;
    const prevIsVerified = !!clusterMatch.isVerified;
    const prevUpdates = clusterMatch.updates ? [...clusterMatch.updates] : [];

    if (isNewReporter) {
      clusterMatch.verificationCount = prevCount + 1;
      clusterMatch.verificationScore = Number((prevScore + 1.0).toFixed(2));
      clusterMatch.clusterCount = prevClusterCount + 1;
      if (clusterMatch.verificationScore >= 2.5) {
        clusterMatch.isVerified = true;
      }
    }

    if (!Array.isArray(clusterMatch.updates)) {
      clusterMatch.updates = [];
    }
    clusterMatch.updates.unshift({
      timestamp: 'Just now',
      description: String(description).trim(),
      reportedBy: sanitizedReportedBy,
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
      if (isNewReporter) clusterMatch.reporters.pop();
      return res.status(500).json({ error: 'Failed to write clustered incident to persistent storage.' });
    }

    // Broadcast cluster update to all clients and to the spatial hex room
    io.emit('incident:clustered', {
      id: clusterMatch.id,
      verificationCount: clusterMatch.verificationCount,
      clusterCount: clusterMatch.clusterCount,
      isVerified: clusterMatch.isVerified,
      latestUpdate: clusterMatch.updates[0],
    });
    io.to(`hex:${clusterMatch.hexIndex || hexIndex}`).emit('incident:spatial_update', clusterMatch);

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
    hexIndex,
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
    urgency: urgency || 'Medium',
    verificationCount: 1,
    verificationScore: 1.0,
    clusterCount: 1,
    isVerified: false,
    isAuthoritative: false,
    reportedBy: sanitizedReportedBy,
    reporters: [reporterKey],
    verifiedVoters: [reporterKey],
    mediaUrl: mediaUrl || null,
    clearanceVotes: 0,
    resolutionVoterKeys: [],
    updates: [],
  };

  incidents.unshift(newIncident);

  const saved = persistIncidents();
  if (!saved) {
    incidents.shift(); // Rollback in-memory state on write error
    return res.status(500).json({ error: 'Failed to write incident to persistent storage.' });
  }

  // Real-time broadcast to all connected WebSocket clients and hex room
  io.emit('incident:created', newIncident);
  io.to(`hex:${hexIndex}`).emit('incident:spatial_update', newIncident);

  res.status(201).json(newIncident);
});

// 3. PROXIMITY-WEIGHTED VERIFICATION ENDPOINT
app.post('/api/incidents/:id/verify', verifyLimiter, (req, res) => {
  const { id } = req.params;
  const { voterPosition, voterId } = req.body || {};
  const incident = incidents.find((i) => i.id === id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const voterKey = voterId || req.ip || 'anon_voter';
  if (!Array.isArray(incident.verifiedVoters)) {
    incident.verifiedVoters = incident.reporters ? [...incident.reporters] : [];
  }

  // Anti-Sybil single vote guard: check if this citizen/device has already verified
  if (incident.verifiedVoters.includes(voterKey)) {
    return res.status(409).json({
      error: 'You have already verified this incident.',
      alreadyVoted: true,
      id: incident.id,
      verificationCount: incident.verificationCount,
      verificationScore: incident.verificationScore,
      isVerified: incident.isVerified,
    });
  }

  // Calculate proximity weight: On-ground commuters (<= 1.5km) receive full weight (1.0)
  // Remote commuters receive weighted verification (0.25)
  let weight = 0.25;
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

  incident.verifiedVoters.push(voterKey);
  incident.verificationCount = prevCount + 1;
  incident.verificationScore = Number((prevScore + weight).toFixed(2));

  if (incident.verificationScore >= 2.5) {
    incident.isVerified = true;
  }

  const saved = persistIncidents();
  if (!saved) {
    incident.verifiedVoters.pop();
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
  const voterKey = req.body?.voterId || req.ip || 'anon_voter';

  if (!Array.isArray(incident.resolutionVoterKeys)) {
    incident.resolutionVoterKeys = [];
  }

  // Multi-citizen consensus: prevent duplicate clearance votes from the same citizen/device
  if (incident.resolutionVoterKeys.includes(voterKey)) {
    return res.status(400).json({ error: 'You have already voted to clear this incident.' });
  }

  incident.resolutionVoterKeys.push(voterKey);
  incident.clearanceVotes = incident.resolutionVoterKeys.length;

  if (incident.clearanceVotes >= 2) {
    const [cleared] = incidents.splice(index, 1);
    const saved = persistIncidents();
    if (!saved) {
      cleared.resolutionVoterKeys.pop();
      cleared.clearanceVotes = cleared.resolutionVoterKeys.length;
      incidents.splice(index, 0, cleared);
      return res.status(500).json({ error: 'Failed to persist incident clearance.' });
    }

    io.emit('incident:resolved', {
      id: cleared.id,
      clearedBy: 'Citizen Consensus (2 unique verifications)',
      timestamp: new Date().toISOString(),
    });

    return res.json({
      message: 'Incident marked resolved and removed from live map by citizen consensus.',
      id: cleared.id,
      cleared: true,
    });
  }

  const saved = persistIncidents();
  if (!saved) {
    incident.resolutionVoterKeys.pop();
    incident.clearanceVotes = incident.resolutionVoterKeys.length;
    return res.status(500).json({ error: 'Failed to persist clearance vote.' });
  }

  // Emit both clearance_vote and resolution_voted for seamless backwards-compatible client synchronization
  io.emit('incident:clearance_vote', {
    id: incident.id,
    clearanceVotes: incident.clearanceVotes,
    resolutionVotes: incident.clearanceVotes,
    votesNeeded: 2 - incident.clearanceVotes,
  });
  io.emit('incident:resolution_voted', {
    id: incident.id,
    resolutionVotes: incident.clearanceVotes,
    clearanceVotes: incident.clearanceVotes,
  });

  res.json({
    message: `Resolution vote recorded. ${2 - incident.clearanceVotes} more confirmation needed to clear hazard.`,
    id: incident.id,
    clearanceVotes: incident.clearanceVotes,
    cleared: false,
  });
});

// 5. CONVERSATIONAL AI TRANSIT ASSISTANT ENDPOINT
app.post('/api/assistant/chat', aiLimiter, (req, res) => {
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

  if (query.includes('silk board') || query.includes('silkboard') || query.includes('btm') || query.includes('hsr')) {
    const silk = activeHazards.find(
      (i) =>
        i.title.toLowerCase().includes('silk board') ||
        i.title.toLowerCase().includes('btm') ||
        i.title.toLowerCase().includes('hsr') ||
        (i.ward && (i.ward.toLowerCase().includes('btm') || i.ward.toLowerCase().includes('hsr') || i.ward.toLowerCase().includes('silk board')))
    );
    if (silk) {
      reply = `🚨 Silk Board / BTM / HSR Alert: Heavy congestion flagged (${silk.verificationCount} citizen confirmations). ${silk.description} Estimated delay +28 mins. Commuters heading to Electronic City are advised to use the elevated tollway.`;
      sources.push(silk.title);
    } else {
      reply = `Silk Board Junction, BTM Layout, and HSR corridor are currently experiencing routine traffic flow with standard signal cycles.`;
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
  } else if (query.includes('hebbal') || query.includes('airport') || query.includes('expressway') || query.includes('bellary')) {
    const hebbal = activeHazards.find(
      (i) =>
        i.title.toLowerCase().includes('hebbal') ||
        i.title.toLowerCase().includes('airport') ||
        i.title.toLowerCase().includes('expressway') ||
        (i.ward && i.ward.toLowerCase().includes('hebbal')) ||
        (i.description && (i.description.toLowerCase().includes('hebbal') || i.description.toLowerCase().includes('airport')))
    );
    if (hebbal) {
      reply = `✈️ Airport Expressway Advisory: Accident reported near Hebbal Flyover approach ramp (${hebbal.description}). Expect +20 mins transit delay. Plan extra lead time for KIA flights.`;
      sources.push(hebbal.title);
    } else {
      reply = `Hebbal Flyover and Bellary Road to Kempegowda International Airport are clear with steady moving traffic.`;
    }
  } else if (query.includes('radar') || query.includes('rain') || query.includes('weather') || query.includes('forecast') || query.includes('storm')) {
    const rainMm = (req.body && req.body.weather && typeof req.body.weather.precipitation === 'number')
      ? req.body.weather.precipitation
      : 0;
    const weatherCondition = req.body?.weather?.condition || (rainMm > 5 ? 'Heavy Monsoon Showers' : (rainMm > 0 ? 'Light Rain / Drizzle' : 'Clear / Overcast'));
    reply = `🌧️ Rain & Radar Telemetry: Current conditions indicate ${weatherCondition} (${rainMm} mm/hr precipitation). RainViewer Doppler radar is tracking real-time cloud reflectivity across Bengaluru. There are ${waterlogCount} active waterlogged stretch(es) reported. Check the Underpass Diagnostic tab for localized flood risks.`;
    sources.push('RainViewer Doppler & Open-Meteo Telemetry');
  } else if (query.includes('emergency') || query.includes('helpline') || query.includes('police') || query.includes('bbmp')) {
    reply = `📞 Bengaluru Emergency Helplines:\n• BTP Traffic Police: 1095 / 080-22943030\n• BBMP Disaster Cell: 1533\n• BESCOM Electrical Emergency: 1912\n• BWSSB Water & Sewerage: 1916\n• National Emergency: 112`;
    sources.push('Karnataka State Emergency Operations');
  } else {
    reply = `Namaskara! NammaDrishti is actively monitoring ${activeHazards.length} civic hazard(s) across Bengaluru (${trafficCount} traffic bottlenecks, ${waterlogCount} waterlogged points). You can ask me about Silk Board, Hebbal airport transit, flooded underpasses, or report road hazards directly on the map.`;
  }

  res.json({
    reply,
    confidence: 0.96,
    sources,
    timestamp: new Date().toISOString(),
    activeIncidentCount: activeHazards.length,
  });
});

// Production SPA Static File Serving
const buildPath = path.join(__dirname, '../build');
const publicPath = path.join(__dirname, '../public');
const staticDir = fs.existsSync(buildPath) ? buildPath : (fs.existsSync(publicPath) ? publicPath : null);

if (staticDir) {
  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// Socket.io connection lifecycle
io.on('connection', (socket) => {
  // Push full snapshot of current incidents to newly connected citizen client
  socket.emit('initial:data', incidents);

  // Subscribe client to specific H3-style hexagonal spatial room cells
  socket.on('subscribe:hex', (hexIds) => {
    if (Array.isArray(hexIds)) {
      hexIds.forEach((id) => socket.join(`hex:${id}`));
    } else if (typeof hexIds === 'string') {
      socket.join(`hex:${hexIds}`);
    }
  });

  socket.on('disconnect', () => {});
});

// Export server, app, and internal functions for automated testing
module.exports = {
  app,
  server,
  io,
  incidents,
  persistIncidents,
  cleanupExpiredIncidents,
  getDistanceKm,
  TTL_HOURS_BY_TYPE,
  getHexIndex,
  getHexRing,
  syncBtpAdvisories,
  getBtpAdvisories,
  processMediaUpload,
};

// Start Server if executed directly
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 NammaDrishti Civic Platform Engine Live`);
    console.log(`📡 HTTP Server & REST API: http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Stream: ws://localhost:${PORT}`);
    console.log(`📂 Incident Data Storage: ${DATA_FILE}`);
    console.log(`🏙️ Active Incidents Loaded: ${incidents.length}`);
    console.log(`==================================================\n`);
  });
}
