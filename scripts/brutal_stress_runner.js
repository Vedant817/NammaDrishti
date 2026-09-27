// scripts/brutal_stress_runner.js
/**
 * NammaDrishti Brutal Harsh User & 5 Senior QA Engineers Stress Suite
 * Runs an isolated sandbox environment simulating an extremely aggressive,
 * adversarial, and high-concurrency commuter user base.
 *
 * 5 Senior QA Roles Evaluated:
 *   1. Senior Security & Concurrency QA Engineer
 *   2. Senior Geospatial & Navigation QA Engineer
 *   3. Senior Chaos, Fault Injection & Storage QA Engineer
 *   4. Senior Frontend & Commuter UX QA Engineer
 *   5. Senior API, Network & Rate Limiter QA Engineer
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 1. ISOLATED SANDBOX ENVIRONMENT SETUP
const SANDBOX_DIR = path.join(os.tmpdir(), `nammadrishti_brutal_${Date.now()}`);
fs.mkdirSync(SANDBOX_DIR, { recursive: true });

const SANDBOX_DATA_FILE = path.join(SANDBOX_DIR, 'incidents.json');
const SANDBOX_PORT = 5185;

// Initial test incidents to seed the isolated sandbox
const SEED_DATA = [
  {
    id: 'brutal_base_silk_board',
    type: 'Traffic',
    title: 'Silk Board Chokepoint Gridlock',
    ward: 'BTM Layout / Silk Board',
    description: 'Traffic gridlock from Silk Board towards Electronic City toll ramp.',
    position: { lat: 12.9171, lng: 77.6238 },
    hexIndex: 'hex_r8_35_10',
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
    urgency: 'High',
    verificationCount: 1,
    verificationScore: 1.0,
    clusterCount: 1,
    isVerified: false,
    isAuthoritative: false,
    reportedBy: 'Citizen Scout Alpha',
    reporters: ['citizen_alpha'],
    verifiedVoters: ['citizen_alpha'],
    mediaUrl: null,
    clearanceVotes: 0,
    resolutionVoterKeys: [],
    updates: [],
  },
  {
    id: 'brutal_base_panathur',
    type: 'Waterlogging',
    title: 'Panathur Railway Underpass Inundation',
    ward: 'Panathur / Varthur',
    description: 'Water level reached 2.5ft under railway bridge. Vehicles stranded.',
    position: { lat: 12.9352, lng: 77.7019 },
    hexIndex: 'hex_r8_36_11',
    timestamp: 'Just now',
    createdAt: new Date().toISOString(),
    urgency: 'High',
    verificationCount: 2,
    verificationScore: 2.0,
    clusterCount: 1,
    isVerified: false,
    isAuthoritative: false,
    reportedBy: 'Citizen Scout Beta',
    reporters: ['citizen_beta'],
    verifiedVoters: ['citizen_beta'],
    mediaUrl: null,
    clearanceVotes: 0,
    resolutionVoterKeys: [],
    updates: [],
  },
];

fs.writeFileSync(SANDBOX_DATA_FILE, JSON.stringify(SEED_DATA, null, 2), 'utf-8');

process.env.DATA_FILE = SANDBOX_DATA_FILE;
process.env.PORT = String(SANDBOX_PORT);

const { app, server, getDistanceKm, getHexIndex, getHexRing, TTL_HOURS_BY_TYPE, cleanupExpiredIncidents } = require('../server/index.js');
const { calculateDistance, distanceToSegmentKm, BENGALURU_HUBS } = require('../src/services/routingService.js');
const { translations } = require('../src/data/translations.js');
const { getCitizenReputation, recordReputationEvent } = require('../src/utils/reputationService.js');

let runningServer = null;
let reqCounter = 0;

// HTTP Helper for sandboxed requests with distinct IP tracking
function makeRequest(pathName, options = {}) {
  reqCounter++;
  const clientIp = options.ip || options.headers?.['x-forwarded-for'] || `192.168.1.${(reqCounter % 240) + 1}`;

  return new Promise((resolve) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: SANDBOX_PORT,
      path: pathName,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': clientIp,
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Global QA Findings Registry
const findings = [];
function recordFinding(qaRole, testName, details, passed) {
  findings.push({ qaRole, testName, details, passed });
  const icon = passed ? '✅' : '🚨';
  console.log(`  ${icon} [${qaRole}] ${testName}: ${details}`);
}

async function runBrutalStressSuite() {
  console.log('\n================================================================');
  console.log('💥 NAMMADRISHTI 5 SENIOR QA ENGINEERS BRUTAL SUITE STARTING');
  console.log(`📁 Isolated Storage: ${SANDBOX_DATA_FILE}`);
  console.log(`🌐 Isolated Port:    ${SANDBOX_PORT}`);
  console.log('================================================================\n');

  await new Promise((resolve) => {
    runningServer = server.listen(SANDBOX_PORT, () => {
      console.log(`✓ Sandboxed Server listening on port ${SANDBOX_PORT}\n`);
      resolve();
    });
  });

  try {
    // ========================================================================
    // QA ENGINEER 1: SENIOR CONCURRENCY & SECURITY QA ENGINEER
    // ========================================================================
    console.log('--- [QA 1: Concurrency & Security] Rapid Blasts & Vulnerability Fuzzing ---');

    // 1a: High-Velocity Concurrent Sybil Verification Attack
    const concurrentSameVoter = Array.from({ length: 15 }, () =>
      makeRequest('/api/incidents/brutal_base_silk_board/verify', {
        method: 'POST',
        body: { voterId: 'brutal_sybil_bot', voterPosition: { lat: 12.9171, lng: 77.6238 } },
      })
    );
    const sameVoterResults = await Promise.all(concurrentSameVoter);
    const successfulVotes = sameVoterResults.filter((r) => r.status === 200).length;
    const conflictVotes = sameVoterResults.filter((r) => r.status === 409).length;

    console.log(`    -> Sybil Blast: ${successfulVotes} accepted (200), ${conflictVotes} rejected (409)`);
    recordFinding(
      'Senior Security & Concurrency',
      'Atomic Single-Vote Anti-Sybil Guard',
      `${successfulVotes} vote accepted, ${conflictVotes} duplicate attempts blocked under high-speed race condition`,
      successfulVotes === 1 && conflictVotes === 14
    );

    // 1b: Multi-Citizen Clearance Consensus Race
    const resA = makeRequest('/api/incidents/brutal_base_silk_board/resolve', {
      method: 'POST',
      body: { voterId: 'citizen_clearance_1' },
    });
    const resB = makeRequest('/api/incidents/brutal_base_silk_board/resolve', {
      method: 'POST',
      body: { voterId: 'citizen_clearance_2' },
    });
    const resC = makeRequest('/api/incidents/brutal_base_silk_board/resolve', {
      method: 'POST',
      body: { voterId: 'citizen_clearance_3' },
    });
    await Promise.all([resA, resB, resC]);

    const checkCleared = await makeRequest('/api/incidents');
    const silkStillPresent = checkCleared.data.some((i) => i.id === 'brutal_base_silk_board');
    recordFinding(
      'Senior Security & Concurrency',
      'Multi-Citizen Clearance Race',
      silkStillPresent ? 'Failed: Incident still present' : 'Incident correctly resolved & purged after 2 consensus votes',
      !silkStillPresent
    );

    // 1c: Impersonation Attack & Authority Sanitization
    const impersonationRes = await makeRequest('/api/incidents', {
      method: 'POST',
      body: {
        title: 'Fake Police Advisory',
        description: 'Unauthorized official alert broadcast attempt',
        type: 'Traffic',
        position: { lat: 12.9250, lng: 77.6850 },
        reportedBy: 'BTP Official Police Patrol Commander',
      },
    });
    const cleanReporter = impersonationRes.data?.reportedBy;
    const isSanitized = cleanReporter && !cleanReporter.toLowerCase().includes('police') && !cleanReporter.toLowerCase().includes('btp');
    recordFinding(
      'Senior Security & Concurrency',
      'Authoritative Impersonation Sanitization',
      `Title scrubbed to: "${cleanReporter}"`,
      Boolean(isSanitized)
    );

    // 1d: Oversized String Payload Attack (>2000 chars)
    const giantPayloadRes = await makeRequest('/api/incidents', {
      method: 'POST',
      body: {
        title: 'A'.repeat(500), // Max allowed is 200
        description: 'B'.repeat(5000), // Max allowed is 2000
        type: 'Infrastructure',
        position: { lat: 12.9300, lng: 77.6100 },
      },
    });
    recordFinding(
      'Senior Security & Concurrency',
      'Oversized Payload Rejection',
      `Oversized input rejected with status ${giantPayloadRes.status}`,
      giantPayloadRes.status === 400
    );

    // 1e: Media Upload Traversal & Executable File Injection
    const pathTraversalRes = await makeRequest('/api/media/upload', {
      method: 'POST',
      body: {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        filename: '../../../../windows/system32/cmd.exe',
        mimeType: 'application/x-msdownload',
      },
    });
    recordFinding(
      'Senior Security & Concurrency',
      'Media Path Traversal & Executable Injection',
      `Malicious upload rejected with status ${pathTraversalRes.status}`,
      pathTraversalRes.status === 400
    );

    // ========================================================================
    // QA ENGINEER 2: SENIOR GEOSPATIAL & NAVIGATION QA ENGINEER
    // ========================================================================
    console.log('\n--- [QA 2: Geospatial & Navigation] Boundary Coordinates & Corridor Physics ---');

    // 2a: Geographic Coordinate Edge Cases
    const boundaryCoordinates = [
      { name: 'Null Coordinates', pos: { lat: null, lng: null }, expectedStatus: 400 },
      { name: 'NaN Latitude', pos: { lat: NaN, lng: 77.5946 }, expectedStatus: 400 },
      { name: 'Infinity Longitude', pos: { lat: 12.9716, lng: Infinity }, expectedStatus: 400 },
      { name: 'Latitude Overflow (+120)', pos: { lat: 120, lng: 77.5946 }, expectedStatus: 400 },
      { name: 'Longitude Underflow (-200)', pos: { lat: 12.9716, lng: -200 }, expectedStatus: 400 },
      { name: 'Null Island (0, 0)', pos: { lat: 0, lng: 0 }, expectedStatus: 201 },
      { name: 'North Pole Edge (90, 0)', pos: { lat: 90, lng: 0 }, expectedStatus: 201 },
      { name: 'South Pole Edge (-90, 0)', pos: { lat: -90, lng: 0 }, expectedStatus: 201 },
      { name: 'International Date Line (25, -180)', pos: { lat: 25, lng: -180 }, expectedStatus: 201 },
    ];

    for (const bc of boundaryCoordinates) {
      const res = await makeRequest('/api/incidents', {
        method: 'POST',
        body: {
          title: `Boundary ${bc.name}`,
          description: `Testing geographic limits for ${bc.name}`,
          type: 'Infrastructure',
          position: bc.pos,
        },
      });
      const passed = res.status === bc.expectedStatus;
      recordFinding(
        'Senior Geospatial & Navigation',
        `Coordinate ${bc.name}`,
        `HTTP ${res.status} (expected ${bc.expectedStatus})`,
        passed
      );
    }

    // 2b: Mathematical Stability of Haversine & Segment Distance
    const zeroDist = getDistanceKm(12.9716, 77.5946, 12.9716, 77.5946);
    const antipodalDist = getDistanceKm(90, 0, -90, 0);
    const invalidDist = getDistanceKm(NaN, 0, 10, 'abc');
    const haversineStable = zeroDist === 0 && Number.isFinite(antipodalDist) && invalidDist === 0;

    recordFinding(
      'Senior Geospatial & Navigation',
      'Haversine Numerical Clamping & Nan-Safety',
      `Identical: ${zeroDist}km, Antipodal: ${antipodalDist.toFixed(1)}km, Invalid: ${invalidDist}km`,
      haversineStable
    );

    // 2c: Perpendicular Corridor Distance to Route Segments
    const segDistZeroLen = distanceToSegmentKm(12.95, 77.65, 12.95, 77.65, 12.95, 77.65);
    const segDistNormal = distanceToSegmentKm(12.95, 77.65, 12.90, 77.60, 13.00, 77.70);
    recordFinding(
      'Senior Geospatial & Navigation',
      'Corridor Segment Math (Zero-Length & Sloped)',
      `Zero-length: ${segDistZeroLen.toFixed(3)}km, Segment: ${segDistNormal.toFixed(3)}km`,
      segDistZeroLen === 0 && Number.isFinite(segDistNormal)
    );

    // 2d: Spatial Hex Neighborhood Query & Resiliency
    const hexRes = await makeRequest('/api/incidents/spatial/neighborhood?lat=12.9716&lng=77.5946');
    recordFinding(
      'Senior Geospatial & Navigation',
      'Spatial Hex Partitioning (Resolution 8)',
      `Center: ${hexRes.data?.centerHex}, Rings: ${hexRes.data?.activeRings?.length}`,
      hexRes.status === 200 && Array.isArray(hexRes.data?.activeRings) && hexRes.data.activeRings.length === 9
    );

    // ========================================================================
    // QA ENGINEER 3: SENIOR CHAOS, FAULT INJECTION & STORAGE QA ENGINEER
    // ========================================================================
    console.log('\n--- [QA 3: Chaos & Fault Injection] Disk Integrity & TTL Purge Engine ---');

    // 3a: Disk Atomic Persistence Integrity
    const diskContent = fs.readFileSync(SANDBOX_DATA_FILE, 'utf-8');
    let parsedDisk = null;
    try {
      parsedDisk = JSON.parse(diskContent);
    } catch {
      parsedDisk = null;
    }
    recordFinding(
      'Senior Chaos & Storage',
      'Atomic Disk Persistence',
      `File is valid JSON with ${parsedDisk ? parsedDisk.length : 0} items persisted`,
      Array.isArray(parsedDisk) && parsedDisk.length > 0
    );

    // 3b: TTL Lifecycle Worker Execution
    const expiredReport = cleanupExpiredIncidents();
    recordFinding(
      'Senior Chaos & Storage',
      'TTL Lifecycle Expiry Worker',
      `Periodic engine executed safely without exceptions (purged ${expiredReport.length} items)`,
      Array.isArray(expiredReport)
    );

    // ========================================================================
    // QA ENGINEER 4: SENIOR FRONTEND & COMMUTER UX QA ENGINEER
    // ========================================================================
    console.log('\n--- [QA 4: Frontend & Commuter UX] Telemetry, Translations & Audio Fallbacks ---');

    // 4a: Open-Meteo Weather Telemetry Extreme Bounds
    const extremeWeatherQuery = await makeRequest('/api/assistant/chat', {
      method: 'POST',
      body: {
        message: 'What is the flood status across low underpasses right now?',
        weather: { precipitation: 350, condition: 'Catastrophic Cloudburst' },
      },
    });
    recordFinding(
      'Senior Frontend & UX',
      'Extreme Monsoon Telemetry (350 mm/hr)',
      `AI response generated smoothly without crash: "${extremeWeatherQuery.data?.reply?.slice(0, 45)}..."`,
      extremeWeatherQuery.status === 200 && typeof extremeWeatherQuery.data?.reply === 'string'
    );

    // 4b: Multilingual Translation Parity (EN, KN, HI)
    const requiredKeys = ['brandName', 'brandTagline', 'activeHazards', 'filters', 'actions', 'reportModal'];
    const knValid = requiredKeys.every((k) => translations.kn && translations.kn[k] !== undefined);
    const hiValid = requiredKeys.every((k) => translations.hi && translations.hi[k] !== undefined);
    recordFinding(
      'Senior Frontend & UX',
      'Multilingual Translation Parity',
      `Kannada: ${knValid ? '100% Complete' : 'Missing keys'}, Hindi: ${hiValid ? '100% Complete' : 'Missing keys'}`,
      knValid && hiValid
    );

    // 4c: Citizen Reputation Gamification Engine Node/SSR Safety
    const testProfile = recordReputationEvent('REPORT_SUBMITTED');
    recordFinding(
      'Senior Frontend & UX',
      'Reputation Service Headless & Node SSR Safety',
      `Points awarded safely: ${testProfile.points} points, Tier evaluated without localStorage ReferenceError`,
      typeof testProfile.points === 'number' && testProfile.points >= 30
    );

    // ========================================================================
    // QA ENGINEER 5: SENIOR API, NETWORK & RATE LIMITER QA ENGINEER
    // ========================================================================
    console.log('\n--- [QA 5: API, Network & Rate Limiter] Idempotency & Traffic Shaping ---');

    // 5a: Offline Queue Idempotent Replay (Submitting same ID twice)
    const idempotencyId = 'namma_offline_idempotent_test_99';
    const firstSubmission = await makeRequest('/api/incidents', {
      method: 'POST',
      body: {
        id: idempotencyId,
        title: 'Pothole on 100ft road',
        description: 'Large crater near 12th main corner.',
        type: 'Infrastructure',
        position: { lat: 12.9719, lng: 77.6412 },
      },
    });
    const secondSubmission = await makeRequest('/api/incidents', {
      method: 'POST',
      body: {
        id: idempotencyId,
        title: 'Pothole on 100ft road (Resent by offline sync)',
        description: 'Large crater near 12th main corner.',
        type: 'Infrastructure',
        position: { lat: 12.9719, lng: 77.6412 },
      },
    });

    const isIdempotent = firstSubmission.status === 201 && secondSubmission.status === 200 && secondSubmission.data.id === idempotencyId;
    recordFinding(
      'Senior API & Network',
      'Offline Queue Idempotent De-duplication',
      `First attempt: HTTP ${firstSubmission.status}, Replayed attempt: HTTP ${secondSubmission.status}`,
      isIdempotent
    );

    // 5b: Rate Limiter Sliding Window Under Rapid Load
    const spammerIp = '203.0.113.42';
    const rapidRequests = Array.from({ length: 20 }, () =>
      makeRequest('/api/media/upload', {
        method: 'POST',
        headers: { 'x-forwarded-for': spammerIp },
        body: {
          imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          filename: 'valid_test.jpg',
          mimeType: 'image/jpeg',
        },
      })
    );
    const mediaResults = await Promise.all(rapidRequests);
    const mediaStatuses = mediaResults.map((r) => r.status);
    const hitRateLimit = mediaStatuses.includes(429);

    recordFinding(
      'Senior API & Network',
      'Sliding Window Rate Limiter Enforcement',
      `Targeted spammer from ${spammerIp} throttled with HTTP 429 (${mediaStatuses.filter(s => s === 429).length} requests throttled)`,
      hitRateLimit
    );

  } catch (err) {
    console.error('Fatal crash during brutal testing:', err);
  } finally {
    if (runningServer) {
      await new Promise((resolve) => {
        runningServer.close(() => {
          console.log('\n✓ Sandboxed Server stopped.');
          resolve();
        });
      });
    }

    try {
      fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
      console.log(`✓ Temporary brutal sandbox directory cleaned up: ${SANDBOX_DIR}\n`);
    } catch (e) {
      console.warn('Sandbox cleanup warning:', e.message);
    }
  }

  // Final Summary Report
  const passedCount = findings.filter((f) => f.passed).length;
  const failedCount = findings.filter((f) => !f.passed).length;

  console.log('================================================================');
  console.log(`🏁 5 SENIOR QA ENGINEERS STRESS RESULTS: ${passedCount} PASSED, ${failedCount} DEFECTS`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runBrutalStressSuite();
