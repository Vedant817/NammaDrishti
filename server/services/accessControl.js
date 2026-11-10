const { timingSafeEqual } = require('crypto');
function hasAuthorityAccess(candidate) {
  const expected = process.env.AUTHORITY_TOKEN;
  if (typeof expected !== 'string' || !expected.trim() || typeof candidate !== 'string') return false;
  const supplied = Buffer.from(candidate), configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}
function voterKeyFor(req) {
  if (req.citizen?.uid) return req.citizen.uid;
  if (typeof req.body?.voterId === 'string') {
    const v = req.body.voterId.trim();
    if (process.env.NODE_ENV === 'test' && v) return v;
    if (/^dev_[a-zA-Z0-9_-]+$/.test(v) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return v;
  }
  return req.ip;
}
module.exports = { hasAuthorityAccess, voterKeyFor };
