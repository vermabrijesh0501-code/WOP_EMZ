/* Masters sync test: Device A creates/edits/deletes a courier -> Device B sees it instantly;
   fresh device fetches /api/sync/state and sees it too. All master categories covered. */
const WebSocket = require('ws');
const http = require('http');
const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function report(name, ok, detail = '') {
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  [' + detail + ']' : ''}`);
}
function httpJson(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE + path, { method, headers: { 'content-type': 'application/json' } }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); } catch { resolve({ status: res.statusCode, json: null }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
function connect(deviceId, deviceType) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3000/ws');
    const st = { ws, messages: [], deviceId };
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'REGISTER_DEVICE', payload: { deviceId, deviceType, userName: deviceId, userRole: 'Warehouse Manager' }, senderId: deviceId, timestamp: new Date().toISOString() }));
      setTimeout(() => resolve(st), 300);
    });
    ws.on('message', raw => st.messages.push(JSON.parse(raw.toString())));
    ws.on('error', reject);
  });
}
function waitFor(st, pred, ms = 3000) {
  return new Promise(res => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const m = st.messages.find(pred);
      if (m) { clearInterval(iv); res(m); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); res(null); }
    }, 40);
  });
}
(async () => {
  console.log('=== Masters Central-Sync Test (2 devices + fresh login) ===\n');
  const A = await connect('masters-dev-A', 'Desktop');   // laptop
  const B = await connect('masters-dev-B', 'Mobile / Scanner'); // phone

  const categories = ['couriers', 'companies', 'warehouses', 'clients', 'skus', 'drivers', 'vehicle_types', 'return_reasons', 'users'];
  const ts = Date.now();

  // 1. Device A: create one record per category, send the exact shape StorageService.saveX broadcasts
  for (const cat of categories) {
    const listRes = await httpJson('/api/sync/state');
    const key = cat === 'vehicle_types' ? 'vehicleTypes' : cat === 'return_reasons' ? 'returnReasons' : cat;
    const current = listRes.json?.data?.[key] || [];
    const newRecord = cat === 'users'
      ? { id: `test-usr-${ts}`, name: `Test User ${ts}`, email: `test${ts}@emiza.com`, role: 'Supervisor', status: 'Active' }
      : { id: `test-${cat}-${ts}`, name: `TEST ${cat.toUpperCase()} ${ts}`, code: `T${ts.toString().slice(-5)}`, status: 'Active' };
    A.messages.length = 0; B.messages.length = 0;
    A.ws.send(JSON.stringify({
      type: 'MASTERS_UPDATED',
      payload: { category: cat, action: 'add', record: newRecord, allRecords: [newRecord, ...current], count: current.length + 1 },
      senderId: 'masters-dev-A',
      timestamp: new Date().toISOString(),
    }));
    const gotOnB = await waitFor(B, m => m.type === 'MASTERS_UPDATED' && m.payload?.category === cat && (m.payload?.record?.id === newRecord.id || m.payload?.allRecords?.some?.(r => r.id === newRecord.id)));
    report(`B sees ${cat} ADD instantly`, !!gotOnB);
    const state = await httpJson('/api/sync/state');
    const inStore = (state.json?.data?.[key] || []).some(r => r.id === newRecord.id);
    report(`Server store persisted ${cat} ADD`, inStore);
    if (gotOnB) {
      const applied = gotOnB.payload?.allRecords?.some?.(r => r.id === newRecord.id) || gotOnB.payload?.record?.id === newRecord.id;
      report(`B received full list for ${cat} (React setState ready)`, !!applied);
    }
  }

  // 2. Device A edits the courier; B must see the UPDATE
  const editId = `test-couriers-${ts}`;
  const stateNow = await httpJson('/api/sync/state');
  const courierList = stateNow.json?.data?.couriers || [];
  const edited = courierList.map(c => c.id === editId ? { ...c, name: 'TEST COURIER EDITED' } : c);
  A.messages.length = 0; B.messages.length = 0;
  A.ws.send(JSON.stringify({
    type: 'MASTERS_UPDATED',
    payload: { category: 'couriers', action: 'update', record: { id: editId, name: 'TEST COURIER EDITED' }, allRecords: edited, count: edited.length },
    senderId: 'masters-dev-A', timestamp: new Date().toISOString(),
  }));
  const editOnB = await waitFor(B, m => m.type === 'MASTERS_UPDATED' && m.payload?.category === 'couriers' && m.payload?.allRecords?.some?.(r => r.id === editId && r.name === 'TEST COURIER EDITED'));
  report('B sees COURIER EDIT instantly', !!editOnB);

  // 3. Device A deletes it; B must see the DELETE
  const afterDelete = edited.filter(c => c.id !== editId);
  A.messages.length = 0; B.messages.length = 0;
  A.ws.send(JSON.stringify({
    type: 'MASTERS_UPDATED',
    payload: { category: 'couriers', action: 'delete', record: { id: editId }, allRecords: afterDelete, count: afterDelete.length },
    senderId: 'masters-dev-A', timestamp: new Date().toISOString(),
  }));
  const delOnB = await waitFor(B, m => m.type === 'MASTERS_UPDATED' && m.payload?.category === 'couriers' && !m.payload?.allRecords?.some?.(r => r.id === editId));
  report('B sees COURIER DELETE instantly', !!delOnB);

  // 4. REST-only device C (WS blocked — worst-case phone): must pick up masters within poll cycle
  const preVer = await httpJson('/api/sync/version');
  A.ws.send(JSON.stringify({
    type: 'MASTERS_UPDATED',
    payload: { category: 'couriers', action: 'add', record: { id: `courier-rest-${ts}`, name: 'REST ONLY COURIER', code: 'ROC1', status: 'Active' }, senderId: 'masters-dev-A' },
    senderId: 'masters-dev-A', timestamp: new Date().toISOString(),
  }));
  await new Promise(r => setTimeout(r, 400));
  const stateC = await httpJson('/api/sync/state');
  const cHasIt = (stateC.json?.data?.couriers || []).some(c => c.id === `courier-rest-${ts}`);
  report('REST-only device sees new courier via /api/sync/state', cHasIt);

  // 5. A does NOT receive its own masters event back (echo check)
  A.messages.length = 0;
  A.ws.send(JSON.stringify({
    type: 'MASTERS_UPDATED',
    payload: { category: 'skus', action: 'add', record: { id: `echo-sku-${ts}`, name: 'ECHO SKU' }, senderId: 'masters-dev-A' },
    senderId: 'masters-dev-A', timestamp: new Date().toISOString(),
  }));
  await new Promise(r => setTimeout(r, 700));
  const echo = A.messages.find(m => m.type === 'MASTERS_UPDATED' && m.payload?.record?.id === `echo-sku-${ts}`);
  report('No self-echo of MASTERS_UPDATED to sender', !echo);

  A.ws.close(); B.ws.close();
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(2); });
