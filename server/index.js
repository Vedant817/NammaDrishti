// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { hasAuthorityAccess, voterKeyFor } = require('./services/accessControl');

const { getHexIndex, getHexRing } = require('./services/spatialHex.js');
const { createRateLimiter } = require('./services/rateLimiter.js');
const { processMediaUpload, MEDIA_DIR } = require('./services/mediaService.js');
const { publicIncident } = require('./services/publicIncident');
const { insideCity } = require('./services/liveData');

const app = express();
const server = http.createServer(app);

// Express reverse-proxy trust configuration
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Enable CORS for frontend client. Mutating API routes require Firebase auth
// in production, but a restrictive allow-list avoids cross-site calls to
// dev/local servers. Configure FRONTEND_ORIGINS (comma-separated) on deploy.
const corsOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  ...(process.env.FRONTEND_ORIGINS ? process.env.FRONTEND_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : []),
];
function corsOrigin(origin, cb) {
  // Disallowed origins get a clean no-ACAO denial, not an error response.
  if (!origin || corsOrigins.includes(origin)) return cb(null, true);
  return cb(null, false);
}
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup Socket.io for Real-Time Event Dispatch
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

const liveData = require('./services/liveData').createLiveData({ reserveGeocode: async () => {  if (!firebaseStore) { const wait = Math.max(0, localGeocodeAt - Date.now()); localGeocodeAt = Math.max(Date.now(), localGeocodeAt) + 1100; await new Promise(r => setTimeout(r, wait)); return; }
  const ref = firebaseStore.db.collection('_coordination').doc('geocoder');
  const owner = require('crypto').randomUUID();
  const wait = await firebaseStore.db.runTransaction(async tx => {
    const item=(await tx.get(ref)).data();
    if(item?.until>Date.now())throw new Error('Geocoder busy; retry shortly');
    const wait=Math.max(0,(item?.nextAt||0)-Date.now());
    tx.set(ref,{owner,until:Date.now()+15000,nextAt:Date.now()+1100});return wait;
  });
  await new Promise(r=>setTimeout(r,wait));
  return async()=>firebaseStore.db.runTransaction(async tx=>{const item=(await tx.get(ref)).data();if(item?.owner===owner)tx.set(ref,{until:0,nextAt:Date.now()+1100});});
} });
let localGeocodeAt = 0;
const sourceLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 60, message: 'Source request limit reached.' });
// Network reads do not hold the incident mutation queue.
app.get('/api/weather', sourceLimiter, async (req, res) => {
  try { res.json(await liveData.weather(req.query.lat === undefined ? undefined : Number(req.query.lat), req.query.lng === undefined ? undefined : Number(req.query.lng))); }
  catch { res.status(503).json({ error: 'Weather unavailable', isOffline: true, precipitation: null }); }
});
app.get('/api/geocode', sourceLimiter, async (req, res) => {
  try { res.json({ results: await liveData.geocode(req.query.q), attribution: '© OpenStreetMap contributors' }); }
  catch (e) { res.status(503).json({ error: e.message }); }
});
app.get('/api/traffic', sourceLimiter, async (req, res) => {
  try { res.json(await liveData.traffic()); } catch { res.status(503).json({ status: 'unavailable', segments: [] }); }
});
app.get('/api/traffic-incidents', sourceLimiter, async(req,res)=>{
  try{res.json(await liveData.trafficIncidents());}catch{res.status(503).json({status:'unavailable',source:'TomTom',incidents:[]});}
});
app.get('/api/official-alerts', sourceLimiter, async(req,res)=>{
  try{res.json(await liveData.officialAlerts());}catch{res.status(503).json({status:'unavailable',source:'NDMA SACHET',alerts:[]});}
});
const trafficTile = require('./services/trafficTiles').createTrafficTiles();
const tileLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 240, message: 'Traffic tile limit reached; retry shortly.' });
app.get('/api/traffic/tiles/:z/:x/:y.png', tileLimiter, async (req, res) => {
  if (![req.params.z, req.params.x, req.params.y].every(v => /^\d{1,6}$/.test(v))) return res.sendStatus(404);
  try {
    const bytes = await trafficTile(Number(req.params.z), Number(req.params.x), Number(req.params.y));
    res.set('Cache-Control', 'public, max-age=30, s-maxage=60').type('png').send(bytes);
  } catch (error) {
    res.set('Cache-Control', 'no-store').status(error.status || 503).json({ error: 'Traffic tiles unavailable' });
  }
});
app.get('/api/flood-context', sourceLimiter, async(req,res)=>{try{res.json(await liveData.floodContext());}catch{res.status(503).json({status:'unavailable',forecast:[]});}});
app.get('/api/flood-observations', sourceLimiter, async (req, res) => {
  try { res.json(await liveData.observations()); } catch { res.status(503).json({ status: 'unavailable', observations: [] }); }
});

const serverRuntime = require.main === module || process.env.VERCEL === '1';
const firebaseStore = serverRuntime && process.env.NODE_ENV !== 'test' && process.env.FIREBASE_PROJECT_ID
  ? require('./services/firebaseStore').createFirebaseStore(process.env.FIREBASE_PROJECT_ID)
  : null;
if (process.env.VERCEL === '1' && !firebaseStore) throw new Error('Hosted backend requires Firebase configuration.');
const records = require('./services/records').createRecords({ db: firebaseStore?.db, directory: process.env.STATE_DIR || (process.env.DATA_FILE ? path.dirname(process.env.DATA_FILE) : undefined) });
function defer(work) {
  const safe = work.catch(() => console.error('[Background] Task failed; durable job retained'));
  if (process.env.VERCEL === '1') require('@vercel/functions').waitUntil(safe);
}
const backupService = require('./services/backupService').createBackupService({db:firebaseStore?.db});
const pushService = require('./services/pushService').createPushService(records);
const pushTimer = setInterval(() => pushService.process(incidents).catch(() => console.error('[Push] Delivery queue unavailable')), 15000);
pushTimer.unref();
const emergencyOutbox = require('./services/emergencyOutbox').createEmergencyOutbox(records);
const outboxTimer = setInterval(() => emergencyOutbox.process().catch(() => console.error('[SOS] Outbox storage unavailable')), 10000);
outboxTimer.unref();
let storageReady = !firebaseStore;
let storageQueue = Promise.resolve();
let pendingCommit = Promise.resolve();
async function coordinated(task) {
  if (!firebaseStore) return task();
  const release = await firebaseStore.lease.acquire();
  try { incidents = await firebaseStore.load(); return await task(); }
  finally { await release(); }
}
function serializeStorage(task) {
  const result = storageQueue.then(task);
  storageQueue = result.catch(() => {});
  return result;
}

// Hold API reads and writes while a cloud mutation is pending. One server process
// owns this index; multiple replicas require a transactional repository instead.
app.use('/api', async (req, res, next) => {
  if (!firebaseStore) return next();
  if (process.env.VERCEL === '1') {
    try { await ready; }
    catch { return res.status(503).json({ error: 'Incident storage unavailable.' }); }
  }
  if (!storageReady) return res.status(503).json({ error: 'Incident storage is initializing.' });
  if (process.env.VERCEL === '1' && Date.now() - lastMaintenance > 60000) {
    lastMaintenance = Date.now();
    defer(maintenance());
    defer(backupService.run({trigger:'opportunistic'}).catch(()=>console.error('[Backup] Due snapshot unavailable')));
  }
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    try {
      const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
      if (!match) return res.status(401).json({ error: 'Firebase sign-in required.' });
      req.citizen = await firebaseStore.auth.verifyIdToken(match[1], true);
      if(req.path.startsWith('/incidents') && process.env.REQUIRE_VERIFIED_IDENTITY !== 'false' && !req.citizen.email_verified) return res.status(403).json({code:'EMAIL_VERIFICATION_REQUIRED',error:'Verify your email in Citizen account before reporting or voting.'});
      req.body = { ...req.body, voterId: req.citizen.uid };
    } catch { return res.status(401).json({ error: 'Invalid Firebase sign-in token.' }); }
  }
  if (!req.path.startsWith('/incidents')) return next();
  // Decode legacy inline photos before acquiring the mutation lease. A client
  // disconnect during decoding must not release a lease for a still-running write.
  if (req.method === 'POST' && typeof req.body?.mediaUrl === 'string' && req.body.mediaUrl.startsWith('data:')) {
    try { req.body.mediaUrl = (await processMediaUpload({imageBase64:req.body.mediaUrl})).mediaUrl; }
    catch { return res.status(400).json({error:'Invalid image attachment.'}); }
  }
  serializeStorage(() => coordinated(() => new Promise(resolve => {
    if (res.destroyed) return resolve();
    res.once('finish', resolve);
    // A disconnected client must not release the index while its write is pending.
    res.once('close', () => { pendingCommit.then(resolve, resolve); });
    next();
  }))).catch(() => { if (!res.headersSent) res.status(503).json({ error: 'Storage busy; retry shortly.' }); });
});

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'incidents.json');

// In-Memory Incident Store initialized ONLY from the operator's own persisted
// data file. First run starts empty — no seeds, no synthetic incidents; the
// live feed is built from real citizen reports arriving over REST/WebSocket.
let incidents = [];
try {
  if (!firebaseStore && fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    if (raw.trim()) {
      incidents = JSON.parse(raw);
      // Legacy persisted records (timestamp stays as reported — missing
      // createdAt is quarantined to cleanup, never fabricated to "now")
      incidents = incidents.map((inc) => {
        const lat = inc.position?.lat || 12.9716;
        const lng = inc.position?.lng || 77.5946;
        // Pre-fix records may carry official-title reportedBy values; the
        // write path rejects those, so the load path must re-sanitize them.
        const cleanReporter = typeof inc.reportedBy === 'string'
          ? inc.reportedBy.replace(/(bengaluru traffic police|btp|bbmp|official|police|highway patrol|patrol|traffic monitor|monitor|authority)/gi, 'Citizen').trim() || 'Citizen Contributor'
          : inc.reportedBy;
        return {
          ...inc,
          reportedBy: cleanReporter,
          createdAt: inc.createdAt || null,
          hexIndex: inc.hexIndex || getHexIndex(lat, lng, 8),
          verificationScore: inc.verificationScore || inc.verificationCount || 1.0,
        };
      });
    }
  }
} catch (err) {
  console.warn('[Storage] Failed to read initial incidents file:', err.message);
  incidents = [];
}

// Persist active incidents to disk atomically with swap backup
function persistIncidents() {
  if (firebaseStore) {
    pendingCommit = firebaseStore.save(incidents).then(() => true).catch(err => {
      console.error('[Firestore] Commit failed:', err.message);
      return false;
    });
    return pendingCommit;
  }
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

// Distance utility (Haversine formula in km with robust NaN-safety and numerical clamping)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return 0; // Safe finite fallback against invalid or non-numeric coordinates
  }
  const R = 6371; // Radius of Earth in km
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  return R * c;
}

// DYNAMIC TTL DECAY EXPIRATION POLICIES (in hours)
// Accidents 2h • Waterlogging 4h • Traffic 3h • Potholes/Infrastructure 72h
const TTL_HOURS_BY_TYPE = {
  Traffic: 3, // Rapid clearing congestion
  Accident: 2, // Vehicle clearance & recovery
  Waterlogging: 4, // Monsoon receding time
  Infrastructure: 72, // Pothole / BWSSB pipe repair
};

// Lifecycle Worker: cleans up expired incidents and broadcasts updates
function cleanupExpiredIncidents() {
  const now = Date.now();
  const initialIncidents = incidents;
  const keptIncidents = [];
  const expiredIncidents = [];

  for (const incident of incidents) {
    const createdMs = incident.createdAt ? new Date(incident.createdAt).getTime() : NaN;
    if (Number.isNaN(createdMs)) {
      // Records without a verifiable creation time are quarantined via normal
      // expiry instead of living forever in the live feed.
      expiredIncidents.push({ incident, ageMs: 0 });
      continue;
    }

    const ageMs = now - createdMs;
    // TTL policy per incident type (accidents clear fastest, infrastructure lingers)
    const baseTtlHours = TTL_HOURS_BY_TYPE[incident.type] || 6;
    const ttlMs = baseTtlHours * 60 * 60 * 1000;

    // High consensus citizen hazards receive a 50% TTL grace window
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
    const finish = (saved) => {
      if (!saved) {
        incidents = initialIncidents;
        console.warn('[Lifecycle Worker] Failed to persist cleanup; restored previous state.');
        return [];
      }
      for (const { incident, ageMs } of expiredIncidents) {
        io.emit('incident:expired', {
          id: incident.id,
          reason: `Expired after ${Math.round(ageMs / 3600000)} hours (TTL exceeded).`,
        });
      }
      return expiredIncidents.map(e => e.incident);
    };
    const saved = persistIncidents();
    return saved instanceof Promise ? saved.then(finish) : finish(saved);
  }
  return [];
}

// Run cleanup every 60 seconds (documented lifecycle ticker cadence)
const cleanupInterval = setInterval(() => {
  if (!firebaseStore) cleanupExpiredIncidents();
  else if (storageReady) serializeStorage(() => coordinated(cleanupExpiredIncidents)).catch(err => console.error('[Lifecycle]', err.message));
}, 60 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

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

const resolveLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Too many clearance votes recorded. Please wait a minute before voting again.',
});

const sosLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Emergency SOS dispatch rate limit reached. If this is a real emergency, please call 112 directly.',
});

// REST ENDPOINTS

app.get('/api/health', (req, res) => {
  res.status(storageReady ? 200 : 503).json({
    status: storageReady ? 'online' : 'initializing',
    app: 'NammaDrishti Real-Time Civic & Transit Radar Backend',
    activeIncidents: incidents.filter((i) => !i.moderationHidden).length,
    storage: firebaseStore ? 'firestore' : 'local-json',
    authentication: firebaseStore ? 'firebase' : 'device-id',
    replicaMode: firebaseStore ? 'fenced-writer-with-live-snapshots' : 'single-process',
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
  let filtered = incidents.map(publicIncident).filter(Boolean);

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
    filtered = filtered.filter((i) => (i.isVerified === true) === isVer);
  }
  if (hex) {
    const ring = getHexRing(hex);
    filtered = filtered.filter((i) => ring.includes(i.hexIndex));
  }

  res.json(filtered.map(publicIncident).filter(Boolean));
});

// Hexagonal spatial partition endpoint (queries hex cell and its 8 neighbor rings)
app.get('/api/incidents/hex/:hexId', (req, res) => {
  const { hexId } = req.params;
  const targetHexes = new Set(getHexRing(hexId));

  const localizedIncidents = incidents.filter((i) => !i.moderationHidden && targetHexes.has(i.hexIndex));
  res.json({
    hexId,
    neighborhoodRing: Array.from(targetHexes),
    totalCount: localizedIncidents.length,
    incidents: localizedIncidents.map(publicIncident).filter(Boolean),
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
  const neighborhoodIncidents = incidents.filter((i) => !i.moderationHidden && ring.includes(i.hexIndex));

  res.json({
    centerHex,
    activeRings: ring,
    count: neighborhoodIncidents.length,
    incidents: neighborhoodIncidents.map(publicIncident).filter(Boolean),
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

app.use('/api/media/objects', express.static(MEDIA_DIR, { dotfiles: 'deny', immutable: true, maxAge: '1y', setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff') }));
app.get('/api/media/status', (req, res) => {
  res.json({
    configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN) || process.env.VERCEL !== '1',
    provider: process.env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob' : 'Persistent disk',
    maxPayloadMb: 2,
  });
});

app.post('/api/incidents', reportLimiter, async (req, res) => {
  let { id, type, title, ward, description, position, urgency, mediaUrl, waterDepth, vehiclePassability, observedAt } = req.body || {};

  if (urgency !== undefined && !['Low', 'Medium', 'High'].includes(urgency)) return res.status(400).json({ error: 'Invalid urgency.' });
  const WATER_DEPTH_ENUM = ['< 6 in (Ankle Deep)', '1 - 1.5 ft (Exhaust Level)', '> 2.0 ft (Engine Submersion)'];
  const PASSABILITY_ENUM = ['Passable with Caution', '2-Wheelers Blocked', 'Cars Blocked / SUV Only', 'Completely Impassable'];
  if (waterDepth !== undefined && waterDepth !== null && waterDepth !== '' && !WATER_DEPTH_ENUM.includes(waterDepth)) return res.status(400).json({ error: 'Invalid waterDepth selection.' });
  if (vehiclePassability !== undefined && vehiclePassability !== null && vehiclePassability !== '' && !PASSABILITY_ENUM.includes(vehiclePassability)) return res.status(400).json({ error: 'Invalid vehiclePassability selection.' });
  if (req.body.reportedBy !== undefined) {
    const rawReportedBy = String(req.body.reportedBy);
    if (rawReportedBy.length > 60) return res.status(400).json({ error: 'Invalid reportedBy.' });
    if (/(bengaluru traffic police|btp|bbmp|official|police|highway patrol|patrol|traffic monitor|monitor|authority)/i.test(rawReportedBy)) return res.status(400).json({ error: 'Citizen reports cannot use official titles.' });
  }
  if (id !== undefined && (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(id))) return res.status(400).json({ error: 'Invalid incident ID.' });
  if (ward !== undefined && (typeof ward !== 'string' || ward.length > 200)) return res.status(400).json({ error: 'Invalid ward.' });
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
  if (!insideCity(lat, lng)) return res.status(400).json({ error: 'Outside Bengaluru metro coverage.' });

  // Media source hygiene: only HTTPS/HTTP URLs (<=2KB) or inline base64 image data URLs are accepted.
  // Blocks javascript:, file:, path traversal, and executable injection payloads.
  if (mediaUrl !== undefined && mediaUrl !== null) {
    if (typeof mediaUrl !== 'string' || mediaUrl.length > 3_000_000) {
      return res.status(400).json({ error: 'Invalid media attachment: payload exceeds the 3MB inline limit.' });
    }
    const isHttpUrl = /^https?:\/\/[^\s]+$/i.test(mediaUrl) && mediaUrl.length <= 2048;
    const isLocalObject = /^\/api\/media\/objects\/[a-f0-9]{64}\.webp$/.test(mediaUrl);
    if (mediaUrl.startsWith('data:image/')) {
      try { mediaUrl = (await processMediaUpload({ imageBase64: mediaUrl })).mediaUrl; }
      catch { return res.status(400).json({ error: 'Invalid image attachment.' }); }
    } else if (!isHttpUrl && !isLocalObject) return res.status(400).json({ error: 'Invalid media attachment.' });
  }

  // Deduplicate if client supplied specific ID
  if (id) {
    const existing = incidents.find((i) => i.id === id || (Array.isArray(i.reportIds) && i.reportIds.includes(id)));
    if (existing?.moderationHidden) return res.status(409).json({error:"This report is under moderation."});
    if (existing) {
      return res.status(200).json(publicIncident(existing));
    }
  }

  // Citizen device time is an observation claim, never trusted telemetry. Bound
  // its age and retain it rather than labeling a delayed report as just seen.
  const receivedAt=Date.now();
  if(observedAt!==undefined&&(!Number.isFinite(observedAt)||observedAt<receivedAt-30*60000||observedAt>receivedAt+5*60000))return res.status(422).json({code:'OBSERVATION_EXPIRED',error:'Check the location again before sending an old observation.'});
  const observationTime=new Date(Math.min(observedAt??receivedAt,receivedAt)).toISOString();
  const allowedTypes = ['Traffic', 'Waterlogging', 'Accident', 'Infrastructure'];
  const category = allowedTypes.includes(type) ? type : 'Infrastructure';
  const hexIndex = getHexIndex(lat, lng, 8);
  const reporterKey = voterKeyFor(req);

  // Sanitize authoritative flags - citizen submissions cannot claim official titles
  const sanitizedReportedBy = String(req.body.reportedBy || 'Citizen Contributor')
    .replace(/(bengaluru traffic police|btp|bbmp|official|police|highway patrol|patrol|traffic monitor|monitor|authority)/gi, 'Citizen')
    .trim() || 'Citizen Contributor';

  // 1. SPATIAL CLUSTERING & AUTO-MERGE (200m / 60 min threshold)
  const now = Date.now();
  const clusterMatch = incidents.find((inc) => {
    if (inc.moderationHidden) return false;
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
    const previousCluster = JSON.parse(JSON.stringify(clusterMatch));
    if (id) {
      if (!Array.isArray(clusterMatch.reportIds)) clusterMatch.reportIds = [clusterMatch.id];
      if (!clusterMatch.reportIds.includes(id)) clusterMatch.reportIds.push(id);
    }
    // Auto-clustering Sybil check: verify reporter has not already contributed to this cluster
    if (!Array.isArray(clusterMatch.reporters)) {
      clusterMatch.reporters = [clusterMatch.reportedBy || 'initial_reporter'];
    }
    const urgencyRank = { Low: 0, Medium: 1, High: 2 };
    if (urgency && urgencyRank[urgency] > (urgencyRank[clusterMatch.urgency] ?? 1)) clusterMatch.urgency = urgency;
    if (waterDepth) clusterMatch.waterDepth = String(waterDepth).slice(0, 50);
    if (vehiclePassability) clusterMatch.vehiclePassability = String(vehiclePassability).slice(0, 50);
    const isNewReporter = !clusterMatch.reporters.includes(reporterKey);
    const isNewContributor = isNewReporter && !(clusterMatch.verifiedVoters || []).includes(reporterKey);
    if (isNewReporter) {
      clusterMatch.reporters.push(reporterKey);
      clusterMatch.verifiedVoters = [...new Set([...(clusterMatch.verifiedVoters || []), ...clusterMatch.reporters])];
    }

    // Save previous values for atomic rollback
    const prevCount = clusterMatch.verificationCount || 1;
    const prevScore = clusterMatch.verificationScore || prevCount;
    const prevClusterCount = clusterMatch.clusterCount || 1;
    const prevIsVerified = !!clusterMatch.isVerified;
    const prevUpdates = clusterMatch.updates ? [...clusterMatch.updates] : [];

    if (isNewContributor) {
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
      timestamp: observationTime,
      description: String(description).trim(),
      reportedBy: sanitizedReportedBy,
      mediaUrl: mediaUrl || null,
      urgency: clusterMatch.urgency,
      waterDepth: clusterMatch.waterDepth || null,
      vehiclePassability: clusterMatch.vehiclePassability || null,
    });

    const saved = await persistIncidents();
    if (!saved) {
      for (const key of Object.keys(clusterMatch)) delete clusterMatch[key];
      Object.assign(clusterMatch, previousCluster);
      return res.status(500).json({ error: 'Failed to write clustered incident to persistent storage.' });
    }

    // Broadcast cluster update to all clients and to the spatial hex room
    defer(pushService.enqueue(clusterMatch).then(() => pushService.process(incidents)));
    io.emit('incident:clustered', {
      ...publicIncident(clusterMatch),
      id: clusterMatch.id,
      clusterId: clusterMatch.id,
      verificationCount: clusterMatch.verificationCount,
      verificationScore: clusterMatch.verificationScore,
      clusterCount: clusterMatch.clusterCount,
      isVerified: clusterMatch.isVerified,
      latestUpdate: publicIncident(clusterMatch).updates?.[0],
      updates: publicIncident(clusterMatch).updates || [],
    });
    io.to(`hex:${clusterMatch.hexIndex || hexIndex}`).emit('incident:spatial_update', publicIncident(clusterMatch));

    return res.status(200).json({
      ...publicIncident(clusterMatch),
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
    timestamp: observationTime,
    createdAt: observationTime,
    urgency: urgency || 'Medium',
    verificationCount: 1,
    verificationScore: 1.0,
    clusterCount: 1,
    isVerified: false,
    isAuthoritative: false,
    reportedBy: sanitizedReportedBy,
    waterDepth: waterDepth ? String(waterDepth).slice(0, 50) : null,
    vehiclePassability: vehiclePassability ? String(vehiclePassability).slice(0, 50) : null,
    reporters: [reporterKey],
    verifiedVoters: [reporterKey],
    mediaUrl: mediaUrl || null,
    clearanceVotes: 0,
    resolutionVoterKeys: [],
    updates: [],
  };

  incidents.unshift(newIncident);

  const saved = await persistIncidents();
  if (!saved) {
    incidents.shift(); // Rollback in-memory state on write error
    return res.status(500).json({ error: 'Failed to write incident to persistent storage.' });
  }

  // Real-time broadcast to all connected WebSocket clients and hex room
  defer(pushService.enqueue(newIncident).then(() => pushService.process(incidents)));
  io.emit('incident:created', publicIncident(newIncident));
  io.emit('incident:new', publicIncident(newIncident));
  io.to(`hex:${hexIndex}`).emit('incident:spatial_update', publicIncident(newIncident));

  res.status(201).json(publicIncident(newIncident));
});

// 3. PROXIMITY-WEIGHTED VERIFICATION ENDPOINT
app.post('/api/incidents/:id/verify', verifyLimiter, async (req, res) => {
  const { id } = req.params;
  const { voterPosition, voterId, observedAt } = req.body || {};
  // Votes inherit the same 30-minute freshness window as reports: a stale
  // approval must fail closed as OBSERVATION_EXPIRED, not record a 200.
  // observedAt is required — an omitted value is not evidence of presence.
  const receivedAt = Date.now();
  if (!Number.isFinite(observedAt) || observedAt < receivedAt - 30 * 60000 || observedAt > receivedAt + 5 * 60000) return res.status(422).json({ code: 'OBSERVATION_EXPIRED', error: 'Check the location again before voting on an old observation.' });
  const incident = incidents.find((i) => i.id === id && !i.moderationHidden);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const voterKey = voterKeyFor(req);
  if (!Array.isArray(incident.verifiedVoters)) {
    incident.verifiedVoters = incident.reporters ? [...incident.reporters] : [];
  }

  // Anti-Sybil single vote guard: check if this citizen/device has already verified
  if (incident.verifiedVoters.includes(voterKey) || incident.reporters?.includes(voterKey)) {
    return res.status(409).json({
      error: 'You have already verified this incident.',
      alreadyVoted: true,
      id: incident.id,
      verificationCount: incident.verificationCount,
      verificationScore: incident.verificationScore,
      isVerified: incident.isVerified,
    });
  }

  // Browser GPS is caller-reported, never proof of physical presence.
  const weight = 1.0;
  const isGroundVerified = false;
  let distKm = 0;
  if (voterPosition && Number.isFinite(voterPosition.lat) && Number.isFinite(voterPosition.lng) && Math.abs(voterPosition.lat) <= 90 && Math.abs(voterPosition.lng) <= 180) {
    distKm = getDistanceKm(incident.position.lat, incident.position.lng, voterPosition.lat, voterPosition.lng);
  }

  const prevCount = incident.verificationCount || 1;
  const prevScore = incident.verificationScore || prevCount;
  const prevIsVerified = !!incident.isVerified;

  incident.verifiedVoters.push(voterKey);
  incident.verificationCount = prevCount + 1;
  incident.verificationScore = Number((prevScore + weight).toFixed(2));

  // Multi-commuter verification threshold: requires score >= 2.5 AND at least 2 distinct voters
  if (incident.verificationScore >= 2.5 && incident.verifiedVoters.length >= 2) {
    incident.isVerified = true;
  }

  const saved = await persistIncidents();
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
app.post('/api/incidents/:id/resolve', resolveLimiter, async (req, res) => {
  const { id } = req.params;
  const { observedAt } = req.body || {};
  const receivedAt = Date.now();
  if (!Number.isFinite(observedAt) || observedAt < receivedAt - 30 * 60000 || observedAt > receivedAt + 5 * 60000) return res.status(422).json({ code: 'OBSERVATION_EXPIRED', error: 'Check the location again before voting on an old observation.' });
  const index = incidents.findIndex((i) => i.id === id && !i.moderationHidden);

  if (index === -1) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const incident = incidents[index];
  const voterKey = voterKeyFor(req);

  if (!Array.isArray(incident.resolutionVoterKeys)) {
    incident.resolutionVoterKeys = [];
  }

  // Multi-citizen consensus: prevent duplicate clearance votes from the same citizen/device
  if (incident.resolutionVoterKeys.includes(voterKey)) {
    return res.status(409).json({ error: 'You have already voted to clear this incident.',alreadyVoted:true,id:incident.id,clearanceVotes:incident.clearanceVotes||incident.resolutionVoterKeys.length,cleared:false });
  }

  incident.resolutionVoterKeys.push(voterKey);
  incident.clearanceVotes = incident.resolutionVoterKeys.length;

  if (incident.clearanceVotes >= 2) {
    const [cleared] = incidents.splice(index, 1);
    const saved = await persistIncidents();
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

  const saved = await persistIncidents();
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

// Durable private delivery outbox. A recipient ACK is distinct from agency dispatch.
app.post('/api/sos/dispatch', sosLimiter, async (req, res) => {
  const {lat,lng}=req.body||{};
  if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return res.status(400).json({error:'Valid GPS coordinates required.'});
  try {
    const event=await emergencyOutbox.enqueue(lat,lng,req.citizen?.uid);
    io.to('emergency:control_room').emit('emergency:sos',event);
    res.json({success:true,dispatchId:event.id,status:event.status,message:'Location saved. Call 112; emergency-service delivery is not confirmed.',directDial:'112'});
    defer(emergencyOutbox.process());
  }catch {res.status(503).json({error:'Location could not be saved. Call 112.'});}
});
app.get('/api/sos/dispatches',async(req,res)=>{
  if(!hasAuthorityAccess(req.headers['x-authority-token']))return res.status(401).json({error:'Authority credentials required.'});
  try {res.json({dispatches:await records.list('emergencyOutbox')});}catch {res.status(503).json({error:'History unavailable'});}
});
app.get('/api/sos/status/:id',async(req,res)=>{
  try {
    const token=/^Bearer (.+)$/.exec(req.headers.authorization||'');
    let uid=null;
    if(firebaseStore&&token){
      try{
        const verified=await firebaseStore.auth.verifyIdToken(token[1],true);
        uid=verified?.uid||null;
      }catch{uid=null;}
    }
    const item=await records.get('emergencyOutbox',req.params.id);
    if(!item || (!hasAuthorityAccess(req.headers['x-authority-token']) && (!uid || uid!==item.uid)))return res.status(404).json({error:'Dispatch not found'});
    res.json({id:item.id,status:item.status,attempts:item.attempts});
  }catch {res.status(503).json({error:'Status unavailable'});}
});

// 6. CONVERSATIONAL AI TRANSIT ASSISTANT ENDPOINT
app.post('/api/assistant/chat', aiLimiter, async (req,res) => {
  if(typeof req.body?.message!=='string'||!req.body.message.trim()||req.body.message.length>2000)return res.status(400).json({error:'Prompt must be 1–2000 characters.'});
  try {res.json(await require('./services/assistant').answer({message:req.body.message,language:req.body.language,incidents,liveData}));}
  catch {res.status(503).json({error:'Assistant unavailable'});}
});

app.get('/api/push/config', (req,res)=>res.json({configured:pushService.configured,publicKey:process.env.VAPID_PUBLIC_KEY||null}));
app.post('/api/push/subscribe', sosLimiter, async(req,res)=>{
  if(!req.citizen?.uid)return res.status(401).json({error:'Firebase sign-in required'});
  const {position,subscription}=req.body||{};
  if(!position||!require('./services/liveData').insideCity(position.lat,position.lng))return res.status(400).json({error:'Bengaluru location required'});
  try {res.json({id:await pushService.subscribe(req.citizen.uid,subscription,position)});}catch(e){res.status(400).json({error:e.message});}
});
app.post('/api/push/unsubscribe', async(req,res)=>{
  try {const id=typeof req.body.endpoint==='string'&&req.body.endpoint.length<=2048?require('crypto').createHash('sha256').update(req.body.endpoint).digest('hex'):req.body.id;if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))return res.status(400).json({error:'Invalid subscription ID'});const sub=await records.get('pushSubscriptions',id);if(!req.citizen?.uid||sub?.uid!==req.citizen.uid)return res.status(404).json({error:'Subscription not found'});await records.remove('pushSubscriptions',id);res.json({success:true});}catch {res.status(503).json({error:'Storage unavailable'});}
});
app.post('/api/push/test', sosLimiter, async(req,res)=>{
  if(!req.citizen?.uid)return res.status(401).json({error:'Firebase sign-in required'});
  try{await pushService.test(req.citizen.uid,req.body?.endpoint);res.json({accepted:true});}
  catch{res.status(400).json({error:'Test delivery unavailable. Verify this device subscription and wait a minute before retrying.'});}
});

async function requireModerator(req,res,next) {
  try {
    const match=/^Bearer (.+)$/.exec(req.headers.authorization||'');
    if(!firebaseStore||!match)throw new Error();
    const citizen=await firebaseStore.auth.verifyIdToken(match[1],true);
    if(citizen.moderator!==true||citizen.firebase?.sign_in_provider==='anonymous')return res.status(403).json({error:'Moderator role required'});
    req.moderator=citizen.uid;next();
  }catch {res.status(401).json({error:'Moderator sign-in required'});}
}
app.get('/api/moderation', requireModerator, async(req,res)=>{
  try {
    const rows = incidents.map((item) => {
      // Moderators see hidden rows too (with id for the restore action), but
      // never voter/reporter identity arrays — counts only.
      const visible = publicIncident(item) || { id: item.id };
      return { ...visible, title: item.title, description: item.description, position: item.position, type: item.type, ward: item.ward, urgency: item.urgency, moderationHidden: !!item.moderationHidden, reporterCount: Array.isArray(item.reporters) ? item.reporters.length : 0, voterCount: Array.isArray(item.verifiedVoters) ? item.verifiedVoters.length : 0, clearanceVotes: item.clearanceVotes || 0 };
    });
    const audit = await records.list('moderationAudit');
    const auditRows = audit.map(({ actor, ...row }) => row);
    res.json({ incidents: rows.slice(0, 200), truncated: rows.length > 200, total: rows.length, audit: auditRows.slice(0, 200) });
  } catch { res.status(503).json({ error: 'Audit unavailable' }); }
});
app.post('/api/moderation/:id', requireModerator, async(req,res)=>{
  if(!['hide','restore'].includes(req.body.action)||typeof req.body.reason!=='string'||req.body.reason.trim().length<5||req.body.reason.length>500)return res.status(400).json({error:'Action and reason (5–500 characters) required'});
  try {await serializeStorage(()=>coordinated(async()=>{
    const item=incidents.find(i=>i.id===req.params.id);if(!item){res.status(404).json({error:'Incident not found'});return;}
    const previousHidden=item.moderationHidden;const audit={id:require('crypto').randomUUID(),incidentId:item.id,actor:req.moderator,action:req.body.action,reason:req.body.reason.trim(),at:new Date().toISOString(),status:'attempted'};
    // Audit first; failed writes retain a record of the attempted action.
    await records.put('moderationAudit',audit.id,audit);
    item.moderationHidden=req.body.action==='hide';
    if(!await persistIncidents()){if(previousHidden===undefined)delete item.moderationHidden;else item.moderationHidden=previousHidden;res.status(503).json({error:'Storage unavailable'});return;}
    await records.put('moderationAudit',audit.id,{...audit,status:'committed'});
    io.emit('initial:data',incidents.map(publicIncident).filter(Boolean));res.json({success:true});
  }));}catch {res.status(503).json({error:'Storage busy'});}
});
app.get('/api/operations', requireModerator, async(req,res)=>{try{res.json({uptimeSeconds:process.uptime(),storageReady,sourceMetrics:liveData.metrics,backup:await backupService.status(),replicaMode:firebaseStore?'fenced-writer-with-live-snapshots':'single-process',sources:{traffic:process.env.TOMTOM_API_KEY?'configured':'unconfigured',assistant:process.env.GEMINI_API_KEY&&process.env.GEMINI_MODEL?'configured':'summary',flood:process.env.FLOOD_OBSERVATIONS_URL?'configured':'unconfigured',sos:process.env.EMERGENCY_DISPATCH_WEBHOOK_URL?'configured':'location-only'}});}catch{res.status(503).json({error:'Operations status unavailable.'});}});

async function maintenance() {
  await ready;
  if (firebaseStore && storageReady) await serializeStorage(() => coordinated(cleanupExpiredIncidents));
  await emergencyOutbox.process();
  await pushService.process(incidents);
}
app.get('/api/maintenance', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const supplied = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(supplied) || !require('crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return res.status(401).json({ error: 'Maintenance authorization required.' });
  try { const result=await require('./services/maintenanceService').runMaintenanceAndBackup(maintenance,()=>backupService.run({trigger:'maintenance'}));res.status(result.success?200:503).json(result); }
  catch { res.status(503).json({ error: 'Maintenance unavailable.' }); }
});
let lastMaintenance = 0;

// Production SPA Static File Serving
const buildPath = path.join(__dirname, '../build');
const publicPath = path.join(__dirname, '../public');
const staticDir = process.env.VERCEL === '1' ? null : fs.existsSync(buildPath) ? buildPath : (fs.existsSync(publicPath) ? publicPath : null);

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
  ready.then(() => storageQueue).then(() => { if (socket.connected && storageReady) socket.emit('initial:data', incidents.map(publicIncident).filter(Boolean)); });

  // Subscribe client to specific H3-style hexagonal spatial room cells
  socket.on('subscribe:hex', (hexIds) => {
    if (Array.isArray(hexIds)) {
      hexIds.slice(0, 20).filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id)).forEach(id => socket.join(`hex:${id}`));
    } else if (typeof hexIds === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(hexIds)) {
      socket.join(`hex:${hexIds}`);
    }
  });

  socket.on('join:emergency_control', (ack) => {
    const allowed = hasAuthorityAccess(socket.handshake.auth?.authorityToken);
    if (allowed) socket.join('emergency:control_room');
    if (typeof ack === 'function') ack({ authorized: allowed });
  });

  socket.on('disconnect', () => {});
});

// Export server, app, and internal functions for automated testing.
// `incidents` is exposed through a live getter so consumers never retain a
// stale array reference after the lifecycle worker reassigns the store.
module.exports = {
  app,
  server,
  io,
  get incidents() {
    return incidents;
  },
  getIncidents() {
    return incidents;
  },
  persistIncidents,
  cleanupExpiredIncidents,
  getDistanceKm,
  TTL_HOURS_BY_TYPE,
  getHexIndex,
  getHexRing,
  processMediaUpload,
};

// Exported Vercel servers initialize storage without opening a second listener.
const ready = firebaseStore ? firebaseStore.load().then(items => { incidents = items; storageReady = true; firebaseStore.subscribe(items => { storageReady = true; serializeStorage(() => { incidents = items; io.emit('initial:data', items.map(publicIncident).filter(Boolean)); }).catch(() => {}); }, () => { storageReady = false; }); }) : Promise.resolve();
ready.catch(() => console.error('[Startup] Cloud storage unavailable'));

// Start Server if executed directly
if (require.main === module) {
  const allowLocalMode = process.env.ALLOW_LOCAL_MODE === 'true' || process.env.NODE_ENV === 'test';
  if (!firebaseStore && !allowLocalMode) {
    console.error('[Startup] Firebase is not configured. Set FIREBASE_PROJECT_ID for production, or ALLOW_LOCAL_MODE=true only for explicit local development.');
    process.exit(1);
  }
  const PORT = process.env.PORT || 5001;
  ready.then(() => server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 NammaDrishti Civic Platform Engine Live (${firebaseStore ? 'Firestore + Firebase Auth' : 'local JSON'})`);
    console.log(`📡 HTTP Server & REST API: http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Server: ws://localhost:${PORT}`);
    console.log(`🧪 Hexagonal Spatial Partitioning & Clustering: ACTIVE`);
    console.log(`⏱️ Dynamic TTL Expiration Worker: ACTIVE`);
    console.log(`🛡️ Rate Limiting & Sliding Window: ACTIVE`);
    console.log(`==================================================\n`);
  })).catch(err => {
    console.error('[Startup] Incident storage unavailable:', err.message);
    process.exitCode = 1;
  });
}
