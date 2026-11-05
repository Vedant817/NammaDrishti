const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
function prepareServiceWorker(buildDir = path.join(__dirname, '..', 'build')) {
  const manifestText = fs.readFileSync(path.join(buildDir, 'asset-manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  const worker = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  const assets = ['/index.html', '/manifest.json', '/favicon.ico', ...Object.values(manifest.files).filter(file => /\.(js|css)$/.test(file))];
  const version = createHash('sha256').update(manifestText).update(worker).update(fs.readFileSync(path.join(buildDir, 'index.html'))).digest('hex').slice(0, 16);
  fs.writeFileSync(path.join(buildDir, 'sw.js'), worker.replace('__BUILD_VERSION__', version).replace("/* BUILD_ASSETS */ ['/index.html', '/manifest.json', '/favicon.ico']", JSON.stringify([...new Set(assets)])));
}
if (require.main === module) prepareServiceWorker();
module.exports = { prepareServiceWorker };
