// Fixed provider and city bounds keep the public tile proxy from becoming a
// general-purpose proxy or spending the traffic quota outside Bengaluru.
function cityTile(z, x, y) {
  if (![z, x, y].every(Number.isInteger) || z < 10 || z > 18 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return false;
  const n = 2 ** z;
  const latitude = row => Math.atan(Math.sinh(Math.PI * (1 - 2 * row / n))) * 180 / Math.PI;
  return (x + 1) / n * 360 - 180 >= 77.25 && x / n * 360 - 180 <= 77.95 && latitude(y) >= 12.6 && latitude(y + 1) <= 13.35;
}

function createTrafficTiles({ fetcher = fetch, now = Date.now, key = () => process.env.TOMTOM_API_KEY } = {}) {
  const cache = new Map(), pending = new Map();
  return async (z, x, y) => {
    if (!cityTile(z, x, y)) throw Object.assign(new Error('Outside traffic coverage'), { status: 404 });
    if (!key()) throw Object.assign(new Error('Traffic unavailable'), { status: 503 });
    const id = `${z}/${x}/${y}`, hit = cache.get(id);
    if (hit && now() - hit.at < 60000) return hit.bytes;
    if (pending.has(id)) return pending.get(id);
    const request = (async () => {
      const response = await fetcher(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${id}.png?tileSize=256&key=${encodeURIComponent(key())}`, { signal: AbortSignal.timeout(7000), redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) throw new Error('Traffic provider unavailable');
      // Read with a hard bound, including providers that omit Content-Length.
      const chunks = []; let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > 512000) { throw new Error('Traffic tile too large'); }
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid traffic tile');
      if (cache.size >= 128) cache.delete(cache.keys().next().value);
      cache.set(id, { bytes, at: now() });
      return bytes;
    })().finally(() => pending.delete(id));
    pending.set(id, request);
    return request;
  };
}
module.exports = { cityTile, createTrafficTiles };
