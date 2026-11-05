const test = require('node:test'), assert = require('node:assert/strict');
const { cityTile, createTrafficTiles } = require('../services/trafficTiles');
const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
test('traffic tiles reject invalid coordinates and requests outside Bengaluru before provider calls', async () => {
  let calls = 0;
  const tile = createTrafficTiles({ key: () => 'test-only', fetcher: async () => { calls++; } });
  assert.equal(cityTile(12, 2930, 1899), true);
  for (const args of [[9,732,474],[12,0,0],[12,-1,1899],[12,2930.5,1899],[23,2930,1899],[12,4096,1899]]) await assert.rejects(tile(...args), /Outside traffic coverage/);
  assert.equal(calls, 0);
});
test('traffic tiles coalesce concurrent requests, cache bounded PNGs and refresh after one minute', async () => {
  let calls = 0, clock = 0;
  const tile = createTrafficTiles({ key: () => 'test-only', now: () => clock, fetcher: async url => {
    assert.match(url, /\/flow\/relative0\/12\/2930\/1899.png/); calls++;
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  }});
  await Promise.all([tile(12,2930,1899), tile(12,2930,1899)]);
  await tile(12,2930,1899); assert.equal(calls, 1);
  clock = 60000; assert.deepEqual(await tile(12,2930,1899), png); assert.equal(calls, 2);
});
test('missing credentials, provider errors, oversized or invalid bodies never become cached traffic', async () => {
  await assert.rejects(createTrafficTiles({ key: () => '' })(12,2930,1899), /Traffic unavailable/);
  for (const response of [() => new Response('', {status: 403}), () => new Response('bad', {headers:{'content-type':'image/png'}}), () => new Response(Buffer.alloc(512001), {headers:{'content-type':'image/png'}})]) {
    let calls = 0;
    const tile = createTrafficTiles({ key: () => 'test-only', fetcher: async () => { calls++; return response(); } });
    await assert.rejects(tile(12,2930,1899)); await assert.rejects(tile(12,2930,1899)); assert.equal(calls, 2);
  }
});
