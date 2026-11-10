const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.NODE_ENV = 'test';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nammadrishti-condition-'));
process.env.DATA_FILE = path.join(directory, 'incidents.json');
const { server, io } = require('../index');

test('condition fields are enum-validated, official titles rejected, and coverage is fenced', async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => io.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const report = { title: 'Condition check', description: 'Validation fixture', type: 'Waterlogging', position: { lat: 12.97, lng: 77.59 }, voterId: 'owner', urgency: 'Low', waterDepth: '< 6 in (Ankle Deep)', vehiclePassability: 'Passable with Caution' };
  assert.equal((await post('/api/incidents', { ...report, waterDepth: 'free text' })).status, 400);
  assert.equal((await post('/api/incidents', { ...report, vehiclePassability: 'free text' })).status, 400);
  assert.equal((await post('/api/incidents', { ...report, reportedBy: 'Bengaluru Traffic Police' })).status, 400);
  assert.equal((await post('/api/incidents', { ...report, reportedBy: 'x'.repeat(61) })).status, 400);
  assert.equal((await post('/api/incidents', { ...report, position: { lat: 28.6, lng: 77.2 } })).status, 400);
  assert.equal((await post('/api/incidents', { ...report, position: { lat: 13.30, lng: 77.70 } })).status, 201);
  const created = await (await post('/api/incidents', { ...report, title: 'Vote freshness', position: { lat: 12.97, lng: 77.59 } })).json();
  assert.equal((await post('/api/incidents/' + created.id + '/verify', { observedAt: Date.now() - 31 * 60000 })).status, 422);
  assert.equal((await post('/api/incidents/' + created.id + '/verify', { observedAt: Date.now() - 1000 })).status, 200);
  assert.equal((await post('/api/incidents/' + created.id + '/verify', {})).status, 422);
  assert.equal((await post('/api/incidents/' + created.id + '/resolve', { observedAt: Date.now() - 31 * 60000 })).status, 422);
});
