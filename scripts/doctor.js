#!/usr/bin/env node
/**
 * NammaDrishti Environment Doctor — keyless pre-flight check.
 *
 * Run `npm run doctor` before starting the servers. Verifies:
 *   1. Node >= 18 (global fetch)
 *   2. Root + server dependencies installed           (hard requirement)
 *   3. server/incidents.json exists and parses        (hard requirement)
 *   4. Live keyless data sources reachability:
 *      - Open-Meteo precipitation telemetry
 *      - RainViewer radar frame catalog
 *      - OSRM public routing mirrors (.org + .de)
 *   5. Local backend health probe (only if `npm run server` is already up)
 *
 * Exit code 1 = something blocks startup (missing deps / corrupt incidents store).
 * Live data-source failures are warnings (the app ships offline fallbacks), exit stays 0.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROBE_TIMEOUT_MS = 8000;

const hardFailures = [];
const liveWarnings = [];

const print = (icon, check, detail) => {
  console.log(`${icon} ${check}${detail ? ` — ${detail}` : ''}`);
};

const ok = (check, detail) => print('✅', check, detail);
const warn = (check, detail) => {
  print('⚠️ ', check, detail);
  liveWarnings.push(`${check}: ${detail || 'unreachable'}`);
};
const fail = (check, detail) => {
  print('❌', check, detail);
  hardFailures.push(`${check}: ${detail || 'failed'}`);
};

const withTimeout = async (promise, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const probeJson = async (url, label) => {
  const res = await withTimeout(fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), headers: { 'User-Agent': 'NammaDrishti-Doctor/1.0 (keyless preflight)' } }), label);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const checkNode = () => {
  const [major,minor] = process.versions.node.split('.').map(Number);
  if (major>=22&&major<25&&(major!==22||minor>=12)) {
    ok('Node runtime', `v${process.versions.node}`);
  } else {
    fail('Node runtime', `Node ${process.versions.node} detected; Node 22.12 through 24 required by this build`);
  }
};

const checkDependencies = () => {
  const rootModules = path.join(ROOT, 'node_modules');
  const serverModules = path.join(ROOT, 'server', 'node_modules');

  // The frontend toolchain (vite) lives in the root install
  if (fs.existsSync(path.join(rootModules, 'vite'))) {
    ok('Root dependencies installed', 'node_modules/vite present');
  } else {
    fail('Root dependencies installed', 'run `npm install --legacy-peer-deps`');
  }

  if (fs.existsSync(path.join(serverModules, 'express'))) {
    ok('Server dependencies installed', 'server/node_modules/express present');
  } else {
    fail('Server dependencies installed', 'run `npm install --legacy-peer-deps` inside server/');
  }
};

const checkIncidentStore = () => {
  const storePath = path.join(ROOT, 'server', 'incidents.json');
  if (!fs.existsSync(storePath)) {
    warn('Server incident store', 'server/incidents.json missing — server will boot with the empty citizen report store');
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const count = Array.isArray(parsed) ? parsed.length : (Array.isArray(parsed.incidents) ? parsed.incidents.length : 0);
    ok('Server incident store parses', `${count} persisted incident(s)`);
  } catch (err) {
    fail('Server incident store', `${storePath} is not valid JSON (${err.message}) — restore or delete it`);
  }
};

const checkOpenMeteo = async () => {
  try {
    const data = await probeJson(
      'https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current=precipitation&timezone=GMT',
      'Open-Meteo'
    );
    const reading=require('../server/services/liveData').normalizeWeather(data);
    if(reading.isOffline)throw new Error('Observation is stale or future dated');
    ok('Open-Meteo model weather', `${reading.precipitationAmountMm} mm / ${reading.intervalSeconds/60} min, observed ${reading.observedAt}`);
  } catch (err) {
    warn('Open-Meteo monsoon telemetry', err.message);
  }
};

const checkRainViewer = async () => {
  try {
    const data = await probeJson('https://api.rainviewer.com/public/weather-maps.json', 'RainViewer');
    const past = (data.radar && data.radar.past) || [];
    if (past.length === 0) throw new Error('frame catalog empty');
    const newest=Math.max(...past.map(frame=>frame.time))*1000;
    if(!Number.isFinite(newest)||Date.now()-newest>1800000||newest>Date.now()+300000)throw new Error('Observed frame catalog stale or future dated');
    ok('RainViewer radar timeline', `${past.length} past frames; coverage still requires a tile check`);
  } catch (err) {
    warn('RainViewer radar timeline', err.message);
  }
};

const checkOsrmMirror = async (mirror, label) => {
  try {
    const url = `${mirror}/route/v1/driving/77.5946,12.9716;77.6238,12.9171?overview=false&steps=false`;
    const data = await probeJson(url, label);
    if (data.code === 'Ok') {
      ok(`OSRM routing mirror ${label}`, 'route Ok');
    } else {
      warn(`OSRM routing mirror ${label}`, `answered code=${data.code}`);
    }
  } catch (err) {
    warn(`OSRM routing mirror ${label}`, err.message);
  }
};

const checkLocalBackend = async () => {
  try {
    const data = await probeJson('http://localhost:5001/api/health', 'Local backend');
    const incidentCount = Array.isArray(data.incidents) ? data.incidents.length : (data.totalIncidents || data.count || 0);
    ok('Local backend (localhost:5001)', `healthy${incidentCount ? `, ${incidentCount} incident(s) live` : ''}`);
  } catch (err) {
    print('⏭️ ', 'Local backend (localhost:5001)', `not running right now — start with \`npm run server\` (${err.message})`);
  }
};

(async () => {
  console.log('🔍 NammaDrishti Environment Doctor — keyless pre-flight\n');

  checkNode();
  checkDependencies();
  checkIncidentStore();

  // Live keyless data-source probes (independent — run concurrently)
  await Promise.all([
    checkOpenMeteo(),
    checkRainViewer(),
    checkOsrmMirror('https://router.project-osrm.org', '.org'),
    checkOsrmMirror('https://routing.openstreetmap.de/routed-car', 'FOSSGIS'),
    checkLocalBackend(),
  ]);

  console.log('\n──────────────────────── Doctor Summary ────────────────────────');
  if (hardFailures.length > 0) {
    console.log(`❌ ${hardFailures.length} startup blocker(s):`);
    hardFailures.forEach((f) => console.log(`   • ${f}`));
    console.log('\nFix the blockers above, then re-run `npm run doctor`.');
    process.exitCode = 1;
  } else if (liveWarnings.length > 0) {
    console.log(`✅ Environment is startup-ready, with ${liveWarnings.length} live-source warning(s):`);
    liveWarnings.forEach((w) => console.log(`   • ${w}`));
    console.log('\nThe app degrades gracefully (offline queue + cached telemetry) when sources are unreachable.');
    process.exitCode = 0;
  } else {
    console.log('✅ All checks green — dependencies installed, incident store valid, every keyless data source live.');
    process.exitCode = 0;
  }
})();
