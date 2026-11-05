const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../services/rateLimiter');
test('forged leftmost proxy entries cannot rotate the resolved client rate-limit identity', () => {
  const limiter = createRateLimiter({ maxRequests: 2 });
  let allowed = 0;
  let rejected;
  for (let i = 0; i < 3; i++) {
    const req = { ip: '203.0.113.42', app: { get: () => 1 }, headers: { 'x-forwarded-for': `198.51.100.${i}, 203.0.113.42` }, socket: { remoteAddress: '127.0.0.1' } };
    const res = { setHeader() {}, status(code) { rejected = code; return { json() {} }; } };
    limiter(req, res, () => allowed++);
  }
  assert.equal(allowed, 2);
  assert.equal(rejected, 429);
});
