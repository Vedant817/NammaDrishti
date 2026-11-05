const { cityDate } = require('./sourceTime');
const MAX_AGE = 26 * 3600000;
function validCompletion(state, now) {
  return Number.isFinite(state.completedAt) && state.completedAt > 0 && state.completedAt <= now;
}
function backupDue(state, now) {
  return ['failed','running'].includes(state.status) || !validCompletion(state, now) || cityDate(state.completedAt) !== cityDate(now) || now - state.completedAt > MAX_AGE;
}
function backupHealth(state, now) {
  if (state.status === 'running' && state.leaseUntil > now) return 'running';
  if (state.status === 'failed' || state.status === 'running') return 'failed';
  if (!validCompletion(state, now)) return 'never-completed';
  return now - state.completedAt > MAX_AGE ? 'stale' : 'healthy';
}
async function readBounded(stream, limit) {
  const chunks=[]; let size=0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) throw new Error('Backup byte budget exceeded');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
module.exports = { backupDue, backupHealth, readBounded, MAX_AGE };
