// server/services/rateLimiter.js
/**
 * In-Memory Sliding-Window IP Rate Limiter Middleware
 * Prevents spamming, bot scraping, and automated consensus hijacking.
 */

function createRateLimiter({ windowMs = 60000, maxRequests = 30, message = 'Too many requests. Please slow down.' } = {}) {
  const requestLog = new Map();

  // Periodically clean up stale IPs every 5 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requestLog.entries()) {
      const active = timestamps.filter((ts) => now - ts < windowMs);
      if (active.length === 0) {
        requestLog.delete(ip);
      } else {
        requestLog.set(ip, active);
      }
    }
  }, 300000);

  if (cleanupTimer.unref) cleanupTimer.unref();

  return (req, res, next) => {
    // Bypass in test runs or with explicit test header
    if (process.env.NODE_ENV === 'test' || req.headers['x-test-bypass-rate-limit'] === 'true') {
      return next();
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const timestamps = requestLog.get(ip) || [];

    const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (validTimestamps.length >= maxRequests) {
      const oldest = validTimestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: message,
        retryAfterSec,
      });
    }

    validTimestamps.push(now);
    requestLog.set(ip, validTimestamps);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - validTimestamps.length);

    next();
  };
}

module.exports = {
  createRateLimiter,
};
