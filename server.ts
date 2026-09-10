import express from 'express';
import compression from 'compression';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

import {
  initialCompanies,
  initialWarehouses,
  initialClients,
  initialCouriers,
  initialSKUs,
  initialDrivers,
  initialVehicleTypes,
  initialReturnReasons,
  initialUsers,
  initialInwardGateEntries,
  initialReturnBatches,
  initialScannedItems,
  initialActivityLogs,
  initialActiveDevices,
} from './src/mockData';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'sync-store.json');

// Central In-Memory Store
interface ServerStore {
  gateEntries: any[];
  batches: any[];
  scannedItems: any[];
  companies: any[];
  warehouses: any[];
  clients: any[];
  couriers: any[];
  skus: any[];
  drivers: any[];
  vehicleTypes: any[];
  returnReasons: any[];
  users: any[];
  activityLogs: any[];
  activeDevices: any[];
  lastUpdated: string;
}

function getDefaultStore(): ServerStore {
  return {
    gateEntries: initialInwardGateEntries,
    batches: initialReturnBatches,
    scannedItems: initialScannedItems,
    companies: initialCompanies,
    warehouses: initialWarehouses,
    clients: initialClients,
    couriers: initialCouriers,
    skus: initialSKUs,
    drivers: initialDrivers,
    vehicleTypes: initialVehicleTypes,
    returnReasons: initialReturnReasons,
    users: initialUsers,
    activityLogs: initialActivityLogs,
    activeDevices: initialActiveDevices,
    lastUpdated: new Date().toISOString(),
  };
}

function loadStoreFromDisk(): ServerStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.batches)) {
        parsed.batches = parsed.batches
          .filter((b: any) => b && (
            (b.id && b.id !== 'undefined' && b.id !== 'null') ||
            (b.batchNumber && b.batchNumber !== 'undefined' && b.batchNumber !== 'null')
          ))
          .map((b: any, idx: number) => ({
            ...b,
            id: (b.id && b.id !== 'undefined' && b.id !== 'null')
              ? b.id
              : (b.batchNumber && b.batchNumber !== 'undefined' && b.batchNumber !== 'null')
                ? b.batchNumber
                : `batch-${Date.now()}-${idx}`,
            warehouseId: b.warehouseId || 'wh-main',
          }));
      }
      if (Array.isArray(parsed.scannedItems)) {
        parsed.scannedItems = parsed.scannedItems
          .filter((i: any) => i && (
            (i.id && i.id !== 'undefined' && i.id !== 'null') ||
            (i.trackingNumber && i.trackingNumber !== 'undefined' && i.trackingNumber !== 'null') ||
            (i.awbNumber && i.awbNumber !== 'undefined' && i.awbNumber !== 'null')
          ))
          .map((i: any, idx: number) => ({
            ...i,
            id: (i.id && i.id !== 'undefined' && i.id !== 'null')
              ? i.id
              : (i.trackingNumber && i.trackingNumber !== 'undefined' && i.trackingNumber !== 'null')
                ? i.trackingNumber
                : `item-${Date.now()}-${idx}`,
          }));
      }
      return {
        ...getDefaultStore(),
        ...parsed,
      };
    }
  } catch (err) {
    console.error('[Server] Error reading store from disk, falling back to defaults:', err);
  }
  const def = getDefaultStore();
  saveStoreToDisk(def);
  return def;
}

function saveStoreToDisk(store: ServerStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Server] Error saving store to disk:', err);
  }
}

function mergeGateEntries(existing: any[], incoming: any[]): any[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing || [];
  if (!Array.isArray(existing) || existing.length === 0) return incoming || [];
  const map = new Map<string, any>();
  for (const g of existing) {
    if (g && (g.id || g.gatePassNumber)) {
      map.set(g.id || g.gatePassNumber, g);
    }
  }
  for (const g of incoming) {
    if (g && (g.id || g.gatePassNumber)) {
      const key = g.id || g.gatePassNumber;
      const prev = map.get(key);
      map.set(key, prev ? { ...prev, ...g } : g);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.entryTime || b.createdAt || 0).getTime() - new Date(a.entryTime || a.createdAt || 0).getTime()
  );
}

function mergeBatches(existing: any[], incoming: any[]): any[] {
  const result: any[] = [];
  const idToIndex = new Map<string, number>();
  const batchNumToIndex = new Map<string, number>();

  const addOrUpdate = (b: any) => {
    if (!b) return;
    const rawId = (b.id || '').trim();
    const rawNum = (b.batchNumber || '').trim();
    const idKey = (rawId !== 'undefined' && rawId !== 'null') ? rawId : '';
    const numKey = (rawNum !== 'undefined' && rawNum !== 'null') ? rawNum : '';

    // Reject empty batch without id or batch number
    if (!idKey && !numKey) return;

    const safeBatch = {
      ...b,
      id: idKey || numKey || `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      batchNumber: numKey || idKey || `BATCH-${Date.now().toString().slice(-4)}`,
      warehouseId: b.warehouseId || 'wh-main',
    };

    let targetIdx = -1;
    if (idKey && idToIndex.has(idKey)) {
      targetIdx = idToIndex.get(idKey)!;
    } else if (numKey && batchNumToIndex.has(numKey)) {
      targetIdx = batchNumToIndex.get(numKey)!;
    }

    if (targetIdx >= 0) {
      const existingItem = result[targetIdx];
      const cleanIncoming: any = {};
      for (const [k, v] of Object.entries(safeBatch)) {
        if (v !== undefined && v !== null && v !== '') {
          cleanIncoming[k] = v;
        }
      }
      const merged = {
        ...existingItem,
        ...cleanIncoming,
        id: (existingItem.id && existingItem.id !== 'undefined' && existingItem.id !== 'null') ? existingItem.id : safeBatch.id,
        batchNumber: (existingItem.batchNumber && existingItem.batchNumber !== 'undefined' && existingItem.batchNumber !== 'null') ? existingItem.batchNumber : safeBatch.batchNumber,
        warehouseId: cleanIncoming.warehouseId || existingItem.warehouseId || 'wh-main',
        totalScanned: Math.max(existingItem.totalScanned || 0, safeBatch.totalScanned || 0),
        status: (cleanIncoming.status === 'Closed' || existingItem.status === 'Closed') ? 'Closed' : (cleanIncoming.status || existingItem.status || 'Open'),
        remarksBreakdown: cleanIncoming.remarksBreakdown || existingItem.remarksBreakdown || {
          Good: 0,
          Damage: 0,
          'Open Box': 0,
          'Wrong Product': 0,
          'Short Qty': 0,
          'Missing Product': 0,
          Others: 0,
        },
      };
      result[targetIdx] = merged;
      if (idKey) idToIndex.set(idKey, targetIdx);
      if (numKey) batchNumToIndex.set(numKey, targetIdx);
      if (merged.id) idToIndex.set(merged.id, targetIdx);
      if (merged.batchNumber) batchNumToIndex.set(merged.batchNumber, targetIdx);
    } else {
      const idx = result.length;
      result.push({ ...safeBatch });
      if (safeBatch.id) idToIndex.set(safeBatch.id, idx);
      if (numKey) batchNumToIndex.set(numKey, idx);
    }
  };

  for (const b of existing) addOrUpdate(b);
  for (const b of incoming) addOrUpdate(b);

  return result.sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

function mergeScannedItems(existing: any[], incoming: any[]): any[] {
  const result: any[] = [];
  const idToIndex = new Map<string, number>();
  const trackToIndex = new Map<string, number>();

  const addOrUpdate = (item: any) => {
    if (!item) return;
    const idKey = (item.id || '').trim();
    const trackNum = (item.trackingNumber || item.awbNumber || (item as any).barcode || '').trim().toUpperCase();
    const batchKey = (item.batchId || (item as any).batchNumber || '').trim();
    const compositeKey = trackNum ? (batchKey ? `${batchKey}::${trackNum}` : trackNum) : '';

    let targetIdx = -1;
    if (idKey && idToIndex.has(idKey)) {
      targetIdx = idToIndex.get(idKey)!;
    } else if (compositeKey && trackToIndex.has(compositeKey)) {
      targetIdx = trackToIndex.get(compositeKey)!;
    } else if (trackNum && trackToIndex.has(trackNum)) {
      targetIdx = trackToIndex.get(trackNum)!;
    }

    if (targetIdx >= 0) {
      const prev = result[targetIdx];
      const cleanItem: any = {};
      for (const [k, v] of Object.entries(item)) {
        if (v !== undefined && v !== null && v !== '') {
          cleanItem[k] = v;
        }
      }
      const merged = {
        ...prev,
        ...cleanItem,
        id: prev.id || cleanItem.id || item.id,
        batchId: cleanItem.batchId || prev.batchId,
        scannedAt: cleanItem.scannedAt || prev.scannedAt || new Date().toISOString(),
      };
      result[targetIdx] = merged;
      if (idKey) idToIndex.set(idKey, targetIdx);
      if (compositeKey) trackToIndex.set(compositeKey, targetIdx);
      if (trackNum) trackToIndex.set(trackNum, targetIdx);
    } else {
      const idx = result.length;
      result.push({ ...item });
      if (idKey) idToIndex.set(idKey, idx);
      if (compositeKey) trackToIndex.set(compositeKey, idx);
      if (trackNum) trackToIndex.set(trackNum, idx);
    }
  };

  for (const item of existing) addOrUpdate(item);
  for (const item of incoming) addOrUpdate(item);

  return result.sort((a, b) =>
    new Date(b.scannedAt || 0).getTime() - new Date(a.scannedAt || 0).getTime()
  );
}

const store: ServerStore = loadStoreFromDisk();

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'Desktop' | 'Mobile / Scanner' | 'Tablet';
  userName: string;
  userRole: string;
  warehouseId: string;
  connectedAt: string;
  lastActiveAt: string;
  ip: string;
}

const connectedClients = new Map<string, ConnectedClient>();

function getActiveDevicesList() {
  const list: any[] = [];
  const now = Date.now();
  for (const [id, client] of connectedClients.entries()) {
    list.push({
      id: client.deviceId || id,
      userId: client.id,
      userName: client.userName || 'Operator',
      userRole: client.userRole || 'Operator',
      userEmail: `${(client.userName || 'operator').toLowerCase().replace(/\s+/g, '.')}@emiza.com`,
      warehouseId: client.warehouseId || 'wh-main',
      warehouseName: 'Bhiwandi Hub 01',
      deviceType: client.deviceType,
      deviceName: client.deviceName,
      browserInfo: client.deviceName,
      ipAddress: client.ip,
      loginTime: client.connectedAt,
      lastActiveAt: client.lastActiveAt,
      status: now - new Date(client.lastActiveAt).getTime() > 60000 ? 'Idle' : 'Online',
    });
  }
  return list;
}

function broadcastToAll(data: any, excludeId?: string) {
  const message = JSON.stringify(data);
  for (const [clientId, client] of connectedClients.entries()) {
    // Exclude by WS connection id OR by device id (REST senders have no WS id)
    if (excludeId && (clientId === excludeId || (client.deviceId && client.deviceId === excludeId))) continue;
    if (!client.ws || client.ws.readyState !== WebSocket.OPEN) continue;
    try {
      client.ws.send(message);
    } catch (err) {
      console.warn(`[Server WS] Error sending to ${clientId}:`, err);
    }
  }
}

// Apply Mutation to Central Store
function applyMutation(event: { type: string; payload: any; senderId?: string }) {
  const { type, payload } = event;
  store.lastUpdated = new Date().toISOString();

  switch (type) {
    // 1. Gate Entries
    case 'GATE_ENTRY_CREATED': {
      if (payload?.entry) {
        const exists = store.gateEntries.some((g) => g.id === payload.entry.id);
        if (!exists) {
          store.gateEntries = [payload.entry, ...store.gateEntries];
        }
      }
      if (payload?.allGateEntries) {
        store.gateEntries = payload.allGateEntries;
      }
      break;
    }
    case 'GATE_ENTRY_UPDATED': {
      if (payload?.entry) {
        store.gateEntries = store.gateEntries.map((g) =>
          g.id === payload.entry.id ? { ...g, ...payload.entry } : g
        );
      }
      if (payload?.allGateEntries) {
        store.gateEntries = payload.allGateEntries;
      }
      break;
    }
    case 'GATE_ENTRY_DELETED': {
      if (payload?.id) {
        store.gateEntries = store.gateEntries.filter((g) => g.id !== payload.id);
      }
      break;
    }

    // 2. Return Batches
    case 'BATCH_CREATED': {
      if (payload?.batch) {
        store.batches = mergeBatches(store.batches, [payload.batch]);
      }
      if (payload?.allBatches && Array.isArray(payload.allBatches)) {
        store.batches = mergeBatches(store.batches, payload.allBatches);
      }
      break;
    }
    case 'BATCH_UPDATED': {
      if (payload?.batch) {
        const batch = payload.batch;
        const bId = payload.batchId || batch.id;
        const idx = store.batches.findIndex(b => b.id === bId || b.batchNumber === bId);
        if (idx >= 0) {
          store.batches[idx] = { ...store.batches[idx], ...batch };
        } else {
          store.batches = mergeBatches(store.batches, [batch]);
        }
      }
      if (payload?.allBatches && Array.isArray(payload.allBatches)) {
        store.batches = payload.allBatches;
      }
      break;
    }
    case 'BATCH_CLOSED': {
      if (payload?.batch) {
        store.batches = mergeBatches(store.batches, [payload.batch]);
      }
      if (payload?.allBatches && Array.isArray(payload.allBatches)) {
        store.batches = mergeBatches(store.batches, payload.allBatches);
      }
      break;
    }
    case 'BATCH_DELETED': {
      if (payload?.batchId) {
        store.batches = store.batches.filter((b) => b.id !== payload.batchId && b.batchNumber !== payload.batchId);
        store.scannedItems = store.scannedItems.filter((i) => i.batchId !== payload.batchId);
      }
      if (payload?.allBatches && Array.isArray(payload.allBatches)) {
        store.batches = payload.allBatches;
      }
      if (payload?.allScannedItems && Array.isArray(payload.allScannedItems)) {
        store.scannedItems = payload.allScannedItems;
      }
      break;
    }

    // 3. Scanned Items
    case 'ITEM_SCANNED': {
      if (payload?.item) {
        store.scannedItems = mergeScannedItems(store.scannedItems, [payload.item]);
      }
      if (payload?.batch) {
        store.batches = mergeBatches(store.batches, [payload.batch]);
      }
      if (payload?.allScannedItems && Array.isArray(payload.allScannedItems)) {
        store.scannedItems = mergeScannedItems(store.scannedItems, payload.allScannedItems);
      }
      if (payload?.allBatches && Array.isArray(payload.allBatches)) {
        store.batches = mergeBatches(store.batches, payload.allBatches);
      }
      break;
    }
    case 'ITEM_UPDATED': {
      if (payload?.item) {
        const item = payload.item;
        const itemId = payload.itemId || item.id;
        const idx = store.scannedItems.findIndex(i => i.id === itemId);
        if (idx >= 0) {
          store.scannedItems[idx] = { ...store.scannedItems[idx], ...item };
        } else {
          store.scannedItems = mergeScannedItems(store.scannedItems, [item]);
        }
      }
      if (payload?.batch) {
        store.batches = mergeBatches(store.batches, [payload.batch]);
      }
      if (payload?.allScannedItems && Array.isArray(payload.allScannedItems)) {
        store.scannedItems = mergeScannedItems(store.scannedItems, payload.allScannedItems);
      }
      if (payload?.allBatches && Array.isArray(payload.allBatches)) {
        store.batches = mergeBatches(store.batches, payload.allBatches);
      }
      break;
    }
    case 'ITEM_DELETED': {
      if (payload?.itemId) {
        store.scannedItems = store.scannedItems.filter((i) => i.id !== payload.itemId);
      }
      if (payload?.batch) {
        store.batches = mergeBatches(store.batches, [payload.batch]);
      }
      if (payload?.allScannedItems && Array.isArray(payload.allScannedItems)) {
        store.scannedItems = payload.allScannedItems;
      }
      break;
    }

    // 4. Masters Data Management
    case 'MASTERS_UPDATED': {
      const category = payload?.category;
      const allRecords = payload?.allRecords;
      const record = payload?.record;
      const action = payload?.action; // 'add' | 'update' | 'delete'

      if (category && allRecords && Array.isArray(allRecords)) {
        if (category === 'companies') store.companies = allRecords;
        else if (category === 'warehouses') store.warehouses = allRecords;
        else if (category === 'clients') store.clients = allRecords;
        else if (category === 'couriers') store.couriers = allRecords;
        else if (category === 'skus') store.skus = allRecords;
        else if (category === 'drivers') store.drivers = allRecords;
        else if (category === 'vehicle_types') store.vehicleTypes = allRecords;
        else if (category === 'return_reasons') store.returnReasons = allRecords;
        else if (category === 'users') store.users = allRecords;
      } else if (category && record) {
        let targetList: any[] = [];
        if (category === 'companies') targetList = store.companies;
        else if (category === 'warehouses') targetList = store.warehouses;
        else if (category === 'clients') targetList = store.clients;
        else if (category === 'couriers') targetList = store.couriers;
        else if (category === 'skus') targetList = store.skus;
        else if (category === 'drivers') targetList = store.drivers;
        else if (category === 'vehicle_types') targetList = store.vehicleTypes;
        else if (category === 'return_reasons') targetList = store.returnReasons;
        else if (category === 'users') targetList = store.users;

        if (action === 'delete') {
          targetList = targetList.filter((item) => item.id !== record.id);
        } else if (action === 'update') {
          targetList = targetList.map((item) => (item.id === record.id ? { ...item, ...record } : item));
        } else {
          // add
          if (!targetList.some((item) => item.id === record.id)) {
            targetList = [record, ...targetList];
          }
        }

        if (category === 'companies') store.companies = targetList;
        else if (category === 'warehouses') store.warehouses = targetList;
        else if (category === 'clients') store.clients = targetList;
        else if (category === 'couriers') store.couriers = targetList;
        else if (category === 'skus') store.skus = targetList;
        else if (category === 'drivers') store.drivers = targetList;
        else if (category === 'vehicle_types') store.vehicleTypes = targetList;
        else if (category === 'return_reasons') store.returnReasons = targetList;
        else if (category === 'users') store.users = targetList;
      }
      break;
    }

    // 5. Activity Logs
    case 'ACTIVITY_LOG_ADDED': {
      if (payload?.log) {
        store.activityLogs = [payload.log, ...store.activityLogs.filter((l) => l.id !== payload.log.id)].slice(0, 150);
      }
      if (payload?.allLogs) {
        store.activityLogs = payload.allLogs.slice(0, 150);
      }
      break;
    }

    case 'SYNC_ALL':
    case 'SYNC_FULL_STATE': {
      if (payload?.store) {
        if (payload.store.batches) store.batches = mergeBatches(store.batches, payload.store.batches);
        if (payload.store.scannedItems) store.scannedItems = mergeScannedItems(store.scannedItems, payload.store.scannedItems);
        if (payload.store.gateEntries && payload.store.gateEntries.length > 0) store.gateEntries = mergeGateEntries(store.gateEntries, payload.store.gateEntries);
      }
      if (payload?.allBatches) {
        store.batches = mergeBatches(store.batches, payload.allBatches);
      }
      if (payload?.allScannedItems) {
        store.scannedItems = mergeScannedItems(store.scannedItems, payload.allScannedItems);
      }
      if (payload?.allGateEntries && payload.allGateEntries.length > 0) {
        store.gateEntries = mergeGateEntries(store.gateEntries, payload.allGateEntries);
      }
      break;
    }

    default:
      break;
  }

  // Also catch generic log payload
  if (payload?.log && type !== 'ACTIVITY_LOG_ADDED') {
    store.activityLogs = [payload.log, ...store.activityLogs.filter((l) => l.id !== payload.log.id)].slice(0, 150);
  }

  saveStoreToDisk(store);
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // WebSocket Server setup
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientId = `ws-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const remoteIp = req.socket.remoteAddress || '127.0.0.1';

    const clientInfo: ConnectedClient = {
      ws,
      id: clientId,
      deviceId: clientId,
      deviceName: 'Device (Browser)',
      deviceType: 'Desktop',
      userName: 'Floor Operator',
      userRole: 'Operator',
      warehouseId: 'wh-main',
      connectedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      ip: remoteIp,
    };
    connectedClients.set(clientId, clientInfo);

    // 1. Immediately send current state and connected devices
    try {
      ws.send(
        JSON.stringify({
          type: 'INIT_STATE',
          payload: {
            store,
            activeDevices: getActiveDevicesList(),
            assignedClientId: clientId,
          },
          timestamp: new Date().toISOString(),
          senderId: 'server',
        })
      );
    } catch (err) {
      console.error('[Server WS] Error sending init state:', err);
    }

    // Broadcast new device presence to all
    broadcastToAll({
      type: 'DEVICES_UPDATED',
      payload: getActiveDevicesList(),
      timestamp: new Date().toISOString(),
      senderId: 'server',
    });

    // 2. Handle incoming messages from clients
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        clientInfo.lastActiveAt = new Date().toISOString();

        if (msg.type === 'REGISTER_DEVICE') {
          if (msg.payload) {
            clientInfo.deviceId = msg.payload.deviceId || clientInfo.deviceId;
            clientInfo.deviceName = msg.payload.deviceName || clientInfo.deviceName;
            clientInfo.deviceType = msg.payload.deviceType || clientInfo.deviceType;
            clientInfo.userName = msg.payload.userName || clientInfo.userName;
            clientInfo.userRole = msg.payload.userRole || clientInfo.userRole;
            clientInfo.warehouseId = msg.payload.warehouseId || clientInfo.warehouseId;
          }
          broadcastToAll({
            type: 'DEVICES_UPDATED',
            payload: getActiveDevicesList(),
            timestamp: new Date().toISOString(),
            senderId: 'server',
          });
          return;
        }

        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          return;
        }

        if (msg.type === 'HEARTBEAT') {
          return;
        }

        // Apply mutation to central store
        applyMutation(msg);

        // Broadcast the sync message to ALL other clients
        broadcastToAll(msg, clientInfo.id);
      } catch (err) {
        console.error('[Server WS] Failed processing message:', err);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(clientId);
      broadcastToAll({
        type: 'DEVICES_UPDATED',
        payload: getActiveDevicesList(),
        timestamp: new Date().toISOString(),
        senderId: 'server',
      });
    });

    ws.on('error', (err) => {
      console.warn(`[Server WS] Client ${clientId} error:`, err);
      connectedClients.delete(clientId);
    });
  });

  // REST API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      port: PORT,
      activeDevicesCount: connectedClients.size,
      activeDevices: getActiveDevicesList(),
      lastUpdated: store.lastUpdated,
      uptime: process.uptime(),
    });
  });

  app.get('/api/sync/state', (req, res) => {
    res.json({
      status: 'ok',
      data: store,
      activeDevices: getActiveDevicesList(),
    });
  });

  app.post('/api/sync/mutate', (req, res) => {
    try {
      const event = req.body;
      const type = event?.type || event?.action;
      if (!event || !type) {
        return res.status(400).json({ error: 'Invalid event format' });
      }
      event.type = type;

      applyMutation(event);

      // Broadcast via WebSocket to all connected clients
      broadcastToAll(event, event.senderId);

      res.json({ success: true, timestamp: store.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed mutation' });
    }
  });

  app.post('/api/sync/heartbeat', (req, res) => {
    const { deviceId, deviceType, deviceName, userName, userRole, warehouseId } = req.body;
    if (deviceId) {
      let client = Array.from(connectedClients.values()).find(c => c.deviceId === deviceId);
      if (!client) {
        // REST-only device (WS unavailable) — register a synthetic entry for presence.
        client = {
          ws: null as any,
          id: `rest-${deviceId}`,
          deviceId,
          deviceName: deviceName || 'Device (Browser)',
          deviceType: deviceType || 'Desktop',
          userName: userName || 'Floor Operator',
          userRole: userRole || 'Operator',
          warehouseId: warehouseId || 'wh-main',
          connectedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          ip: req.socket.remoteAddress || '127.0.0.1',
        };
        connectedClients.set(client.id, client);
        broadcastToAll({
          type: 'DEVICES_UPDATED',
          payload: getActiveDevicesList(),
          timestamp: new Date().toISOString(),
          senderId: 'server',
        });
      }
      client.lastActiveAt = new Date().toISOString();
      if (deviceType) client.deviceType = deviceType;
      if (deviceName) client.deviceName = deviceName;
      if (userName) client.userName = userName;
      if (userRole) client.userRole = userRole;
      if (warehouseId) client.warehouseId = warehouseId;

      // Prune stale REST-only devices (no heartbeat for 90s and no live WS)
      const now = Date.now();
      for (const [id, c] of connectedClients.entries()) {
        if (!c.ws && now - new Date(c.lastActiveAt).getTime() > 90000) {
          connectedClients.delete(id);
          broadcastToAll({
            type: 'DEVICES_UPDATED',
            payload: getActiveDevicesList(),
            timestamp: new Date().toISOString(),
            senderId: 'server',
          });
        }
      }
    }
    res.json({ success: true, activeDevices: getActiveDevicesList() });
  });

  // Lightweight poll endpoint: clients check this when WS is unavailable.
  app.get('/api/sync/version', (req, res) => {
    res.json({ lastUpdated: store.lastUpdated, deviceCount: connectedClients.size });
  });

  app.get('/api/sync/devices', (req, res) => {
    res.json({
      success: true,
      activeDevices: getActiveDevicesList(),
    });
  });

  // Reset store to default if requested
  app.post('/api/sync/reset', (req, res) => {
    const def = getDefaultStore();
    Object.assign(store, def);
    saveStoreToDisk(store);
    broadcastToAll({
      type: 'SYNC_FULL_STATE',
      payload: { store },
      timestamp: new Date().toISOString(),
      senderId: 'server',
    });
    res.json({ success: true, message: 'Store reset to defaults' });
  });

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      appType: 'spa',
      server: {
        middlewareMode: true,
        // Attach HMR websocket to the main HTTP server (single port),
        // so no separate HMR port (24678) is exposed.
        hmr: { server },
      },
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Gzip static assets (JS chunks compress ~70%) for lighter page loads
    app.use(compression());
    app.use(express.static(distPath, { maxAge: '1y', setHeaders: (res, fp) => {
      // never cache the HTML shell — it references hashed chunks
      if (fp.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }}));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WOP-Emiza] Real-Time Sync Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
