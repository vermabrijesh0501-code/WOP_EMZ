/* Integration test: real-time sync between two devices (desktop + mobile) */
const WebSocket = require('ws');
const http = require('http');

const BASE = 'http://localhost:3000';
const results = [];
function report(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} — ${name}${detail ? '  [' + detail + ']' : ''}`);
}

function httpJson(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE + path, { method, headers: { 'content-type': 'application/json' } }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); } catch (e) { resolve({ status: res.statusCode, json: null }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function connectDevice(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3000/ws');
    const state = { name, ws, messages: [], devices: null, gotInit: false };
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'REGISTER_DEVICE',
        payload: {
          deviceId: `test-device-${name}`,
          deviceName: name === 'desktop' ? 'PC (System App)' : 'Android (Mobile App)',
          deviceType: name === 'desktop' ? 'Desktop' : 'Mobile / Scanner',
          userName: name === 'desktop' ? 'Test Manager' : 'Test Scanner',
          userRole: name === 'desktop' ? 'Warehouse Manager' : 'RTO Operator',
          warehouseId: 'wh-main',
        },
        senderId: `test-device-${name}`,
        timestamp: new Date().toISOString(),
      }));
    });
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString());
      state.messages.push(msg);
      if (msg.type === 'INIT_STATE') state.gotInit = true;
      if (msg.type === 'DEVICES_UPDATED') state.devices = msg.payload;
    });
    ws.on('error', reject);
    ws.on('open', () => setTimeout(() => resolve(state), 400));
  });
}

function waitFor(state, pred, timeoutMs = 3000, label = '') {
  return new Promise(resolve => {
    const start = Date.now();
    const iv = setInterval(() => {
      const found = state.messages.find(pred);
      if (found) { clearInterval(iv); resolve(found); }
      else if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(null); }
    }, 50);
  });
}

(async () => {
  console.log('=== EMIZA Realtime Sync Integration Test ===\n');

  // Connect two devices
  const desktop = await connectDevice('desktop');
  const mobile = await connectDevice('mobile');
  report('Desktop WS connected + INIT_STATE received', desktop.gotInit);
  report('Mobile WS connected + INIT_STATE received', mobile.gotInit);

  await new Promise(r => setTimeout(r, 500));

  // Both should see 2+ devices after registration
  const d1 = await waitFor(desktop, m => m.type === 'DEVICES_UPDATED' && m.payload.length >= 2);
  const d2 = await waitFor(mobile, m => m.type === 'DEVICES_UPDATED' && m.payload.length >= 2);
  report('Both devices see each other in DEVICES_UPDATED', !!d1 && !!d2,
    d1 ? `${d1.payload.length} devices visible` : 'no DEVICES_UPDATED with 2+ devices');

  // TEST A: desktop scans an item via WS -> mobile receives in realtime, desktop no echo
  const ts = Date.now();
  desktop.messages.length = 0;
  mobile.messages.length = 0;
  const scanEvent = {
    type: 'ITEM_SCANNED',
    payload: {
      item: { id: `test-item-${ts}`, batchId: 'test-batch', trackingNumber: `TRK-${ts}`, status: 'Scanned' },
      batch: { id: 'test-batch', status: 'In Progress', itemCount: 1 },
    },
    senderId: 'test-device-desktop',
    timestamp: new Date().toISOString(),
  };
  desktop.ws.send(JSON.stringify(scanEvent));

  const mobileGot = await waitFor(mobile, m => m.type === 'ITEM_SCANNED' && m.payload?.item?.id === `test-item-${ts}`);
  report('A) Mobile receives Desktop scan in realtime (WS→WS)', !!mobileGot);
  const desktopEcho = desktop.messages.find(m => m.type === 'ITEM_SCANNED' && m.payload?.item?.id === `test-item-${ts}`);
  report('B) Desktop does NOT receive its own echo', !desktopEcho);

  // TEST B: mobile sends batch event via WS -> desktop receives
  desktop.messages.length = 0;
  mobile.ws.send(JSON.stringify({
    type: 'BATCH_CREATED',
    payload: { batch: { id: `test-batch-${ts}`, status: 'Open' } },
    senderId: 'test-device-mobile',
    timestamp: new Date().toISOString(),
  }));
  const desktopGot = await waitFor(desktop, m => m.type === 'BATCH_CREATED' && m.payload?.batch?.id === `test-batch-${ts}`);
  report('C) Desktop receives Mobile batch creation in realtime (WS→WS)', !!desktopGot);

  // TEST C: REST fallback (simulates WS down on sender) -> broadcast to WS devices
  desktop.messages.length = 0;
  mobile.messages.length = 0;
  const restRes = await httpJson('/api/sync/mutate', 'POST', {
    type: 'GATE_ENTRY_CREATED',
    payload: { entry: { id: `test-gate-${ts}`, vehicleNumber: 'MH-15-TEST' } },
    senderId: 'test-device-rest',
    timestamp: new Date().toISOString(),
  });
  report('D) REST /api/sync/mutate accepted', restRes.status === 200 && restRes.json?.success === true);
  const mGotRest = await waitFor(mobile, m => m.type === 'GATE_ENTRY_CREATED' && m.payload?.entry?.id === `test-gate-${ts}`);
  const dGotRest = await waitFor(desktop, m => m.type === 'GATE_ENTRY_CREATED' && m.payload?.entry?.id === `test-gate-${ts}`);
  report('E) REST mutation broadcast to BOTH connected devices', !!mGotRest && !!dGotRest);

  // TEST D: server central store has the mutations (persistence for late joiners)
  const state = await httpJson('/api/sync/state');
  const inStore = state.json?.data?.scannedItems?.some?.(i => i.id === `test-item-${ts}`);
  const gateInStore = state.json?.data?.gateEntries?.some?.(g => g.id === `test-gate-${ts}`);
  report('F) Server central store updated (scan item persisted)', !!inStore);
  report('G) Server central store updated (gate entry persisted)', !!gateInStore);

  // TEST E: heartbeat & device list
  const hb = await httpJson('/api/sync/heartbeat', 'POST', { deviceId: 'test-device-mobile' });
  report('H) Heartbeat endpoint works', hb.status === 200 && hb.json?.success === true);

  // TEST F: senderId filter — a message sent with MY senderId via REST must NOT reach me
  mobile.messages.length = 0;
  await httpJson('/api/sync/mutate', 'POST', {
    type: 'ACTIVITY_LOG_ADDED',
    payload: { log: { id: `test-log-${ts}` } },
    senderId: 'test-device-mobile',
    timestamp: new Date().toISOString(),
  });
  await new Promise(r => setTimeout(r, 600));
  const echoToMobile = mobile.messages.find(m => m.type === 'ACTIVITY_LOG_ADDED');
  report('I) Sender does not receive own REST mutation (deviceId filter)', !echoToMobile);

  // TEST G: version endpoint (used by REST polling fallback)
  const ver = await httpJson('/api/sync/version');
  report('K) /api/sync/version returns lastUpdated', ver.status === 200 && typeof ver.json?.lastUpdated === 'string');

  // TEST H: REST heartbeat registers a WS-less device for presence
  // (run-scoped device ids — the server keeps REST-only devices in memory for
  // 90s, so fixed ids make re-runs flaky: no "join" broadcast on repeat)
  const restOnlyId = `test-device-restonly-${ts}`;
  const restOnlyId2 = `test-device-restonly2-${ts}`;
  const hbReg = await httpJson('/api/sync/heartbeat', 'POST', {
    deviceId: restOnlyId,
    deviceType: 'Mobile / Scanner',
    deviceName: 'Android (Mobile App)',
    userName: 'Rest Only User',
    userRole: 'RTO Operator',
    warehouseId: 'wh-main',
  });
  const restDevice = hbReg.json?.activeDevices?.find(d => d.id === restOnlyId);
  report('L) REST heartbeat registers WS-less device (presence)', hbReg.status === 200 && !!restDevice,
    restDevice ? `visible as ${restDevice.deviceType}` : 'not found');

  // TEST I: WS device receives DEVICES_UPDATED when REST-only device registers
  desktop.messages.length = 0;
  await httpJson('/api/sync/heartbeat', 'POST', {
    deviceId: restOnlyId2, deviceType: 'Mobile / Scanner', userName: 'Second REST', userRole: 'Auditor',
  });
  const dSawRest = await waitFor(desktop, m => m.type === 'DEVICES_UPDATED' && m.payload?.some?.(d => d.id === restOnlyId2));
  report('M) WS devices notified when REST-only device joins', !!dSawRest);

  // PING/PONG keepalive
  desktop.ws.send(JSON.stringify({ type: 'PING' }));
  const pong = await waitFor(desktop, m => m.type === 'PONG', 2000);
  report('J) PING/PONG keepalive works', !!pong);

  desktop.ws.close();
  mobile.ws.close();

  const failed = results.filter(r => !r.pass);
  console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) { console.log('FAILED TESTS:'); failed.forEach(f => console.log(' -', f.name)); process.exit(1); }
  process.exit(0);
})().catch(e => { console.error('Test harness error:', e); process.exit(2); });
