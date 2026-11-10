const { timingSafeEqual } = require('crypto');
function hasAuthorityAccess(candidate) {
  const expected = process.env.AUTHORITY_TOKEN;
  if (typeof expected !== 'string' || !expected.trim() || typeof candidate !== 'string') return false;
  const supplied = Buffer.from(candidate), configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}
function voterKeyFor(req) {
  if (req.citizen?.uid) return req.citizen.uid;
  if (process.env.NODE_ENV === 'test' && typeof req.body?.voterId === 'string') return req.body.voterId;
  return req.ip;
}
module.exports = { hasAuthorityAccess, voterKeyFor };
