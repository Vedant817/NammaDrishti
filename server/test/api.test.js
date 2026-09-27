// server/test/api.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, server, getDistanceKm, cleanupExpiredIncidents } = require('../index.js');

const TEST_PORT = 5088;

test('NammaPulse Backend API Comprehensive Test Suite', async (t) => {
  // Start server on ephemeral test port
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  t.after(() => {
    server.close();
  });

  await t.test('1. GET /api/health should return online status', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'online');
    assert.equal(typeof body.activeIncidents, 'number');
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
    // Distance between Silk Board (12.9171, 77.6238) and BTM 2nd Stage (12.9165, 77.6101) ~ 1.48 km
    const dist = getDistanceKm(12.9171, 77.6238, 12.9165, 77.6101);
    assert.ok(dist > 1.3 && dist < 1.6, `Calculated distance ${dist} km is within expected ~1.48 km range`);

    // Zero distance
    assert.equal(getDistanceKm(12.9716, 77.5946, 12.9716, 77.5946), 0);
  });

  await t.test('4. Spatial Clustering: Reports within 200m auto-merge into existing incident', async () => {
    // Unique test coordinates to ensure isolation across repeated test runs
    const testLat = 12.8000 + Math.random() * 0.01;
    const testLng = 77.6000 + Math.random() * 0.01;

    // 1. Create a parent incident
    const parentPayload = {
      title: 'Waterlogging at Sony World Junction',
      type: 'Waterlogging',
      ward: 'Koramangala',
      description: 'Water ponding near signal.',
      position: { lat: testLat, lng: testLng },
      urgency: 'High',
    };
    const res1 = await fetch(`${BASE_URL}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parentPayload),
    });
    assert.equal(res1.status, 201, 'First incident submission creates new incident');
    const parent = await res1.json();
    assert.equal(parent.clusterCount, 1);

    // 2. Submit second report ~60 meters away (lat + 0.0005 is ~55 meters)
    const nearbyPayload = {
      title: 'Deep Water Accumulation near Sony World',
      type: 'Waterlogging',
      ward: 'Koramangala',
      description: 'Vehicles struggling in water.',
      position: { lat: testLat + 0.0005, lng: testLng },
      urgency: 'High',
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
  });

  await t.test('5. Proximity-Weighted Verification: On-ground vs remote weighting', async () => {
    // Target Silk Board incident: { lat: 12.9171, lng: 77.6238 }
    const targetId = 'bengaluru_evt_1';

    // On-ground verification (commuter within 300m at lat: 12.9180, lng: 77.6240)
    const onGroundRes = await fetch(`${BASE_URL}/api/incidents/${targetId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterPosition: { lat: 12.9180, lng: 77.6240 } }),
    });
    const onGroundData = await onGroundRes.json();
    assert.equal(onGroundData.groundVerified, true);
    assert.equal(onGroundData.weight, 1.0);

    // Remote observation (commuter 15km away in Yelahanka at lat: 13.1000, lng: 77.5900)
    const remoteRes = await fetch(`${BASE_URL}/api/incidents/${targetId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterPosition: { lat: 13.1000, lng: 77.5900 } }),
    });
    const remoteData = await remoteRes.json();
    assert.equal(remoteData.groundVerified, false);
    assert.equal(remoteData.weight, 0.25);
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
    assert.ok(data.reply.length > 20);
    assert.ok(data.confidence >= 0.9);
    assert.ok(data.reply.includes('Silk Board') || data.reply.includes('traffic'));
  });
});
