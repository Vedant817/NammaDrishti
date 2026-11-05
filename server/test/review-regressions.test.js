const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io: client } = require('socket.io-client');
process.env.NODE_ENV = 'test';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nammadrishti-review-'));
process.env.DATA_FILE = path.join(directory, 'incidents.json');
const { server, io } = require('../index');
const { hasAuthorityAccess, voterKeyFor } = require('../services/accessControl');

test('review regressions: access control, input validation and cluster integrity', async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];
  t.after(async () => { sockets.forEach(socket => socket.close()); await new Promise(resolve => io.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const report = { title: 'Review flood', description: 'Regression fixture', type: 'Waterlogging', position: { lat: 12.97, lng: 77.59 }, voterId: 'owner', urgency: 'Low', waterDepth: 'Shallow', vehiclePassability: 'Passable with Caution' };

  await t.test('unconfigured authority access fails closed, including published fallback', async () => {
    delete process.env.AUTHORITY_TOKEN;
    assert.equal(hasAuthorityAccess('btp_control_secret'), false);
    assert.equal((await fetch(base + '/api/sos/dispatches')).status, 401);
    assert.equal((await fetch(base + '/api/sos/dispatches?token=btp_control_secret')).status, 401);
    process.env.AUTHORITY_TOKEN = 'review-authority-secret';
    assert.equal((await fetch(base + '/api/sos/dispatches', { headers: { 'x-authority-token': 'wrong' } })).status, 401);
    assert.equal((await fetch(base + '/api/sos/dispatches', { headers: { 'x-authority-token': process.env.AUTHORITY_TOKEN } })).status, 200);
    assert.equal(voterKeyFor({ citizen: { uid: 'verified' }, body: { voterId: 'forged' } }), 'verified');
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    assert.equal(voterKeyFor({ ip: '127.0.0.1', body: { voterId: 'forged' } }), '127.0.0.1');
    process.env.NODE_ENV = previous;
  });

  await t.test('unauthorized sockets cannot receive SOS coordinates; authorized control works', async () => {
    async function connect(auth) {
      const socket = client(base, { auth, transports: ['websocket'], forceNew: true });
      sockets.push(socket);
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
      return socket;
    }
    const unauthorized = await connect({ authorityToken: 'btp_control_secret' });
    const authorized = await connect({ authorityToken: process.env.AUTHORITY_TOKEN });
    assert.deepEqual(await unauthorized.timeout(2000).emitWithAck('join:emergency_control'), { authorized: false });
    assert.deepEqual(await authorized.timeout(2000).emitWithAck('join:emergency_control'), { authorized: true });
    assert.ok(!io.sockets.adapter.rooms.get('emergency:control_room').has(unauthorized.id));
    const delivered = new Promise(resolve => authorized.once('emergency:sos', resolve));
    assert.equal((await post('/api/sos/dispatch', { lat: 12.97, lng: 77.59 })).status, 200);
    assert.equal((await delivered).lat, 12.97);
    assert.equal((await post('/api/sos/dispatch', { lat: null, lng: 77.59 })).status, 400);
  });

  await t.test('malformed urgency cannot persist a client-crashing report', async () => {
    for (const urgency of [{}, [], 1, null, 'Severe']) assert.equal((await post('/api/incidents', { ...report, urgency })).status, 400);
  });

  await t.test('cluster updates are fresh, broadcast, single-vote, and rolled back on storage failure', async () => {
    const created = await (await post('/api/incidents', report)).json();
    // Server emit is not a local EventEmitter event; observe from a connected client.
    const received = new Promise(resolve => sockets[0].once('incident:clustered', resolve));
    const response = await post('/api/incidents', { ...report, voterId: 'second', urgency: 'High', waterDepth: 'Deep', vehiclePassability: 'Impassable' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).waterDepth, 'Deep');
    assert.equal((await received).vehiclePassability, 'Impassable');
    assert.equal((await post(`/api/incidents/${created.id}/verify`, { voterId: 'second' })).status, 409);
    assert.equal((await post(`/api/incidents/${created.id}/verify`, { voterId: 'third' })).status, 200);
    const beforeReport = (await (await fetch(base + '/api/incidents')).json()).find(item => item.id === created.id);
    const reverseOrder = await (await post('/api/incidents', { ...report, voterId: 'third', waterDepth: 'Deep' })).json();
    assert.equal(reverseOrder.verificationCount, beforeReport.verificationCount, 'vote then report must not count twice');
    assert.equal(reverseOrder.verificationScore, beforeReport.verificationScore);
    const rename = fs.renameSync;
    fs.renameSync = () => { throw new Error('injected storage failure'); };
    try { assert.equal((await post('/api/incidents', { ...report, voterId: 'fourth', waterDepth: 'Rejected depth' })).status, 500); }
    finally { fs.renameSync = rename; }
    const persisted = await (await fetch(base + '/api/incidents')).json();
    const incident = persisted.find(item => item.id === created.id);
    assert.equal(incident.waterDepth, 'Deep');
    assert.equal(incident.urgency, 'High');
    assert.ok(!incident.reporters.includes('fourth'));
  });
});
