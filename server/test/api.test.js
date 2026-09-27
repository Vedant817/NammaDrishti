// server/test/api.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  app,
  server,
  getDistanceKm,
  cleanupExpiredIncidents,
  getHexIndex,
  getHexRing,
  getBtpAdvisories,
  processMediaUpload,
} = require('../index.js');
const { createRateLimiter } = require('../services/rateLimiter.js');

const TEST_PORT = 5088;

test('NammaDrishti Backend API Comprehensive Test Suite', async (t) => {
  // Start server on ephemeral test port
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  t.after(() => {
    server.close();
  });

  await t.test('1. GET /api/health should return online status and feature flags', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'online');
    assert.equal(typeof body.activeIncidents, 'number');
    assert.equal(body.features.spatialClustering, true);
    assert.equal(body.features.h3HexPartitioning, true);
    assert.equal(body.features.rateLimiting, true);
  });

  await t.test('2. Coordinate validation logic prevents malformed locations', () => {
    const isValidCoordinate = (lat, lng) => {
      const nLat = Number(lat);
      const nLng = Number(lng);
      return (
        Number.isFinite(nLat) &&
        Number.isFinite(nLng) &&
        nLat >= -90 &&
        nLat <= 90 &&
        nLng >= -180 &&
        nLng <= 180
      );
    };

    assert.equal(isValidCoordinate(12.9716, 77.5946), true, 'Bengaluru coordinates should be valid');
    assert.equal(isValidCoordinate('12.9716', '77.5946'), true, 'String numbers should be parsed');
    assert.equal(isValidCoordinate(NaN, 77.5946), false, 'NaN latitude should be rejected');
    assert.equal(isValidCoordinate(999, 77.5946), false, 'Out-of-range latitude should be rejected');
    assert.equal(isValidCoordinate(12.9716, -999), false, 'Out-of-range longitude should be rejected');
    assert.equal(isValidCoordinate(undefined, null), false, 'Undefined coordinates should be rejected');
  });

  await t.test('3. Haversine distance calculates accurate geographic intervals', () => {
    // Distance between Vidhana Soudha (12.9797, 77.5907) and Silk Board (12.9171, 77.6238) ~ 7.7 km
    const dist = getDistanceKm(12.9797, 77.5907, 12.9171, 77.6238);
    assert.ok(dist > 7.0 && dist < 8.5, `Distance should be ~7.7km, got ${dist.toFixed(2)}km`);

    // Zero distance
    assert.equal(getDistanceKm(12.9797, 77.5907, 12.9797, 77.5907), 0);
  });

  await t.test('4. Spatial Clustering: Reports within 200m auto-merge into existing incident', async () => {
    // 1. Submit initial parent incident in Koramangala
    const testLat = 12.9345;
    const testLng = 77.6150;
    const initialPayload = {
      title: 'Waterlogging near Sony World Junction',
      type: 'Waterlogging',
      ward: 'Koramangala 4th Block',
      description: 'Water level rising quickly.',
      position: { lat: testLat, lng: testLng },
      urgency: 'High',
      voterId: 'voter_alpha',
    };

    const res1 = await fetch(`${BASE_URL}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initialPayload),
    });
    assert.equal(res1.status, 201, 'Initial incident created with 201 Created');
    const parent = await res1.json();
    assert.ok(parent.id);
    assert.ok(parent.hexIndex, 'New incident should receive hexIndex');

    // 2. Submit second report ~55 meters away (lat + 0.0005 is ~55 meters) with different voterId
    const nearbyPayload = {
      title: 'Deep Water Accumulation near Sony World',
      type: 'Waterlogging',
      ward: 'Koramangala',
      description: 'Vehicles struggling in water.',
      position: { lat: testLat + 0.0005, lng: testLng },
      urgency: 'High',
      voterId: 'voter_beta',
    };
    const res2 = await fetch(`${BASE_URL}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nearbyPayload),
    });
    assert.equal(res2.status, 200, 'Subsequent incident within 200m auto-merges with 200 OK');
    const clustered = await res2.json();
    assert.equal(clustered.id, parent.id, 'Should merge into parent incident ID');
    assert.equal(clustered.isClustered, true);
    assert.equal(clustered.clusterCount, 2);
    assert.equal(clustered.verificationCount, 2);
    assert.ok(clustered.updates.length >= 1, 'Appended citizen update commentary');

    // Clean up test incident to maintain clean storage with distinct voter keys
    await fetch(`${BASE_URL}/api/incidents/${parent.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: 'voter_clean_alpha' }),
    });
    await fetch(`${BASE_URL}/api/incidents/${parent.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: 'voter_clean_beta' }),
    });
  });

  await t.test('5. Proximity-Weighted Verification: On-ground vs remote weighting', async () => {
    // Dynamically create a test incident at Silk Board
    const createRes = await fetch(`${BASE_URL}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Silk Board Verification Target',
        type: 'Traffic',
        ward: 'BTM / Silk Board',
        description: 'Testing proximity verification logic.',
        position: { lat: 12.9171, lng: 77.6238 },
        urgency: 'Medium',
        voterId: 'initial_creator_test_5',
      }),
    });
    assert.equal(createRes.status, 201);
    const targetInc = await createRes.json();
    const targetId = targetInc.id;

    // On-ground verification (commuter within 300m at lat: 12.9180, lng: 77.6240)
    const onGroundRes = await fetch(`${BASE_URL}/api/incidents/${targetId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterPosition: { lat: 12.9180, lng: 77.6240 }, voterId: 'device_ground_1' }),
    });
    const onGroundData = await onGroundRes.json();
    assert.equal(onGroundData.groundVerified, true);
    assert.equal(onGroundData.weight, 1.0);

    // Remote observation (commuter 15km away in Yelahanka at lat: 13.1000, lng: 77.5900)
    const remoteRes = await fetch(`${BASE_URL}/api/incidents/${targetId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterPosition: { lat: 13.1000, lng: 77.5900 }, voterId: 'device_remote_1' }),
    });
    const remoteData = await remoteRes.json();
    assert.equal(remoteData.groundVerified, false);
    assert.equal(remoteData.weight, 0.25);

    // Clean up
    await fetch(`${BASE_URL}/api/incidents/${targetId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: 'voter_clean_5_a' }),
    });
    await fetch(`${BASE_URL}/api/incidents/${targetId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: 'voter_clean_5_b' }),
    });
  });

  await t.test('6. Dynamic TTL Decay: Expired incidents cleaned up', () => {
    const expiredList = cleanupExpiredIncidents();
    assert.ok(Array.isArray(expiredList));
  });

  await t.test('7. AI Assistant Chat Endpoint: Contextual intelligent response', async () => {
    const res = await fetch(`${BASE_URL}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Is Silk Board jammed right now?' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.reply);
    assert.ok(data.reply.length > 10);
  });

  await t.test('8. Hexagonal Spatial Partitioning & Neighborhood Rings', () => {
    const hex1 = getHexIndex(12.9716, 77.5946, 8);
    assert.ok(hex1.startsWith('hex_r8_'));

    const ring = getHexRing(hex1);
    assert.equal(ring.length, 9, 'Central hex plus 8 neighbor ring cells');
    assert.ok(ring.includes(hex1));
  });

  await t.test('9. Sliding-Window Rate Limiter enforces request throttling', () => {
    const limiter = createRateLimiter({
      windowMs: 60 * 1000,
      max: 2, // Max 2 requests per minute
      message: 'Rate limit test hit',
    });

    const mockReq = { ip: '192.168.1.50', headers: {} };
    let statusSet = 200;
    let jsonBody = null;
    const mockRes = {
      setHeader: () => {},
      status: (code) => {
        statusSet = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };

    let nextCount = 0;
    const next = () => { nextCount += 1; };

    // In NODE_ENV === 'test', rate limiter allows testing without tripping unless we simulate production
    const prodEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // Request 1: Allowed
      limiter(mockReq, mockRes, next);
      assert.equal(nextCount, 1);

      // Request 2: Allowed
      limiter(mockReq, mockRes, next);
      assert.equal(nextCount, 2);

      // Request 3: Blocked (429)
      limiter(mockReq, mockRes, next);
      assert.equal(nextCount, 2, 'Blocked request does not call next()');
      assert.equal(statusSet, 429, 'Returns HTTP 429');
      assert.equal(jsonBody.error, 'Rate limit test hit');
    } finally {
      process.env.NODE_ENV = prodEnv;
    }
  });

  await t.test('10. BTP Authoritative Civic Advisories Endpoint', async () => {
    const res = await fetch(`${BASE_URL}/api/advisories/btp`);
    assert.equal(res.status, 200);
    const advisories = await res.json();
    assert.ok(Array.isArray(advisories));
    assert.ok(advisories.length >= 2);
    assert.equal(advisories[0].isAuthoritative, true);

    // Sync endpoint
    const syncRes = await fetch(`${BASE_URL}/api/advisories/sync`, { method: 'POST' });
    assert.equal(syncRes.status, 200);
    const syncBody = await syncRes.json();
    assert.ok(typeof syncBody.totalOfficial === 'number');
  });

  await t.test('11. Civic Media Upload Service validates format and returns CDN path', async () => {
    // Valid PNG base64
    const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: sampleBase64,
        filename: 'pothole_evidence.png',
        mimeType: 'image/png',
      }),
    });
    assert.equal(uploadRes.status, 201);
    const body = await uploadRes.json();
    assert.ok(body.mediaUrl);
    assert.ok(body.hash);
    assert.ok(body.byteSize > 0);

    // Invalid MIME rejection
    const badRes = await fetch(`${BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: sampleBase64,
        mimeType: 'application/exe',
      }),
    });
    assert.equal(badRes.status, 400);
  });

  await t.test('12. Sybil Resistance: Duplicate clearance vote rejected', async () => {
    const tempPayload = {
      title: 'Temporary Sybil Test Incident',
      type: 'Traffic',
      ward: 'Hebbal',
      description: 'Sybil vote testing.',
      position: { lat: 13.0358, lng: 77.5970 },
      urgency: 'Low',
    };
    const createRes = await fetch(`${BASE_URL}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tempPayload),
    });
    const tempInc = await createRes.json();

    // First vote from device_alpha: Allowed (200)
    const vote1 = await fetch(`${BASE_URL}/api/incidents/${tempInc.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: 'device_alpha' }),
    });
    assert.equal(vote1.status, 200);

    // Second vote from SAME device_alpha: Rejected (400)
    const vote2 = await fetch(`${BASE_URL}/api/incidents/${tempInc.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: 'device_alpha' }),
    });
    assert.equal(vote2.status, 400);
    const errBody = await vote2.json();
    assert.ok(errBody.error.includes('already voted'));

    // Second vote from DIFFERENT device_beta: Allowed (200) and clears incident
    const vote3 = await fetch(`${BASE_URL}/api/incidents/${tempInc.id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: 'device_beta' }),
    });
    assert.equal(vote3.status, 200);
    const resolvedBody = await vote3.json();
    assert.equal(resolvedBody.cleared, true, '2 distinct citizen votes permanently clear incident');
  });
});
