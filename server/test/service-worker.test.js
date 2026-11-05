const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { prepareServiceWorker } = require('../../scripts/prepare-service-worker');

test('offline shell includes compiled assets and versions each build', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nammadrishti-sw-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'asset-manifest.json'), JSON.stringify({ files: { main: '/static/js/main.hash.js', css: '/static/css/main.hash.css', chunk: '/static/js/chunk.hash.js' } }));
  fs.writeFileSync(path.join(directory, 'index.html'), 'shell version one');
  prepareServiceWorker(directory);
  const first = fs.readFileSync(path.join(directory, 'sw.js'), 'utf8');
  assert.ok(first.includes('/static/js/chunk.hash.js'));
  assert.ok(first.includes('/static/css/main.hash.css'));
  assert.ok(!first.includes('__BUILD_VERSION__'));
  fs.writeFileSync(path.join(directory, 'index.html'), 'shell version two');
  prepareServiceWorker(directory);
  assert.notEqual(fs.readFileSync(path.join(directory, 'sw.js'), 'utf8'), first);

  const handlers = {};
  const cached = new Map([['/index.html', 'offline shell']]);
  const cache = { match: async key => cached.get(key), put: async (key, value) => cached.set(key, value) };
  vm.runInNewContext(first, {
    self: { location: { origin: 'https://city.test' }, addEventListener: (type, handler) => { handlers[type] = handler; } },
    caches: { open: async () => cache }, URL, Response,
    fetch: async () => { throw new Error('offline'); },
  });
  let response;
  handlers.fetch({ request: { url: 'https://city.test/shared?incident=123', method: 'GET', mode: 'navigate' }, respondWith: promise => { response = promise; } });
  assert.equal(await response, 'offline shell', 'deep links fall back to the canonical HTML shell');
  let intercepted = false;
  handlers.fetch({ request: { url: 'https://identitytoolkit.googleapis.com/v1/accounts:lookup', method: 'GET' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false, 'auth and live external data never enter the static cache');
});
