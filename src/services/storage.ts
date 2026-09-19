import {
  User,
  Company,
  Warehouse,
  Client,
  Courier,
  SKU,
  Driver,
  VehicleType,
  ReturnReason,
  InwardGateEntry,
  ReturnBatch,
  ScannedReturnItem,
  ActivityLog,
  SupabaseConfig,
  ActiveDeviceSession,
  AuthSessionData,
} from '../types';

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
  initialSupabaseConfig,
  initialActiveDevices,
} from '../mockData';
import { SyncService } from './syncService';
import { queueMasterPush } from './masterSync';

export function mergeGateEntries(existing: InwardGateEntry[], incoming: InwardGateEntry[]): InwardGateEntry[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing || [];
  if (!Array.isArray(existing) || existing.length === 0) return incoming || [];
  const map = new Map<string, InwardGateEntry>();
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
    new Date(b.entryTime || (b as any).createdAt || 0).getTime() - new Date(a.entryTime || (a as any).createdAt || 0).getTime()
  );
}

export function mergeBatches(existing: ReturnBatch[], incoming: ReturnBatch[]): ReturnBatch[] {
  const result: ReturnBatch[] = [];
  const idToIndex = new Map<string, number>();
  const batchNumToIndex = new Map<string, number>();

  const addOrUpdate = (b: ReturnBatch) => {
    if (!b) return;
    const rawId = (b.id || '').trim();
    const rawNum = (b.batchNumber || '').trim();
    const idKey = (rawId !== 'undefined' && rawId !== 'null') ? rawId : '';
    const numKey = (rawNum !== 'undefined' && rawNum !== 'null') ? rawNum : '';

    // Ignore invalid empty batches
    if (!idKey && !numKey) return;

    const safeBatch: ReturnBatch = {
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
      const cleanSafe: any = {};
      for (const [k, v] of Object.entries(safeBatch)) {
        if (v !== undefined && v !== null && v !== '') {
          cleanSafe[k] = v;
        }
      }
      const merged: ReturnBatch = {
        ...existingItem,
        ...cleanSafe,
        id: (existingItem.id && existingItem.id !== 'undefined' && existingItem.id !== 'null') ? existingItem.id : safeBatch.id,
        batchNumber: (existingItem.batchNumber && existingItem.batchNumber !== 'undefined' && existingItem.batchNumber !== 'null') ? existingItem.batchNumber : safeBatch.batchNumber,
        warehouseId: cleanSafe.warehouseId || existingItem.warehouseId || 'wh-main',
        totalScanned: Math.max(existingItem.totalScanned || 0, safeBatch.totalScanned || 0),
        status: (cleanSafe.status === 'Closed' || existingItem.status === 'Closed') ? 'Closed' : (cleanSafe.status || existingItem.status || 'Open'),
        remarksBreakdown: cleanSafe.remarksBreakdown || existingItem.remarksBreakdown || {
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

export function mergeScannedItems(existing: ScannedReturnItem[], incoming: ScannedReturnItem[]): ScannedReturnItem[] {
  const result: ScannedReturnItem[] = [];
  const idToIndex = new Map<string, number>();
  const trackToIndex = new Map<string, number>();

  const addOrUpdate = (item: ScannedReturnItem) => {
    if (!item) return;
    const idKey = (item.id || '').trim();
    const trackNum = (item.trackingNumber || (item as any).awbNumber || (item as any).barcode || '').trim().toUpperCase();
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
      const merged: ScannedReturnItem = {
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

const STORAGE_KEYS = {
  COMPANIES: 'emiza_companies_v3',
  WAREHOUSES: 'emiza_warehouses_v3',
  CLIENTS: 'emiza_clients_v3',
  COURIERS: 'emiza_couriers_v3',
  SKUS: 'emiza_skus_v3',
  DRIVERS: 'emiza_drivers_v3',
  VEHICLE_TYPES: 'emiza_vehicle_types_v3',
  RETURN_REASONS: 'emiza_return_reasons_v3',
  USERS: 'emiza_users_v3',
  CURRENT_USER: 'emiza_current_user_v3',
  CURRENT_WH: 'emiza_current_wh_v3',
  GATE_ENTRIES: 'emiza_gate_entries_v3',
  RETURN_BATCHES: 'emiza_return_batches_v3',
  SCANNED_ITEMS: 'emiza_scanned_items_v3',
  LOGS: 'emiza_logs_v3',
  SUPABASE_CONFIG: 'emiza_supabase_config_v3',
  AUTH_SESSION: 'emiza_auth_session_v3',
  ACTIVE_DEVICES: 'emiza_active_devices_v3',
  DASHBOARD_DATE_FILTER: 'emiza_dashboard_filter_v3',
  DASHBOARD_SELECTED_DATE: 'emiza_dashboard_selected_date_v3',
};

// Auto-purge any stale mock/test scan keys and sanitize stored batches
(() => {
  try {
    const staleKeys = [
      'emiza_gate_entries', 'emiza_gate_entries_v1', 'emiza_gate_entries_v2',
      'emiza_return_batches', 'emiza_return_batches_v1', 'emiza_return_batches_v2',
      'emiza_scanned_items', 'emiza_scanned_items_v1', 'emiza_scanned_items_v2',
      'emiza_audit_records', 'emiza_audit_records_v1', 'emiza_audit_records_v2',
      'emiza_auditor_devices', 'emiza_auditor_devices_v1', 'emiza_auditor_devices_v2',
      'emiza_logs', 'emiza_logs_v1', 'emiza_logs_v2',
    ];
    staleKeys.forEach(k => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(k);
      }
    });

    if (typeof localStorage !== 'undefined') {
      const rawBatches = localStorage.getItem('emiza_return_batches_v3');
      if (rawBatches) {
        try {
          const parsed = JSON.parse(rawBatches);
          if (Array.isArray(parsed)) {
            const cleaned = parsed
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
              }));
            localStorage.setItem('emiza_return_batches_v3', JSON.stringify(cleaned));
          }
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore in non-browser context
  }
})();

function loadItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed loading ${key} from storage`, e);
    return fallback;
  }
}

function saveItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed saving ${key} to storage`, e);
  }
}

export const StorageService = {
  getCompanies: (): Company[] => loadItem(STORAGE_KEYS.COMPANIES, initialCompanies),
  saveCompanies: (data: Company[]) => {
    saveItem(STORAGE_KEYS.COMPANIES, data);
    queueMasterPush('companies', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'companies', allRecords: data, count: data.length });
  },

  getWarehouses: (): Warehouse[] => loadItem(STORAGE_KEYS.WAREHOUSES, initialWarehouses),
  saveWarehouses: (data: Warehouse[]) => {
    saveItem(STORAGE_KEYS.WAREHOUSES, data);
    queueMasterPush('warehouses', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'warehouses', allRecords: data, count: data.length });
  },

  getClients: (): Client[] => loadItem(STORAGE_KEYS.CLIENTS, initialClients),
  saveClients: (data: Client[]) => {
    saveItem(STORAGE_KEYS.CLIENTS, data);
    queueMasterPush('clients', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'clients', allRecords: data, count: data.length });
  },

  getCouriers: (): Courier[] => loadItem(STORAGE_KEYS.COURIERS, initialCouriers),
  saveCouriers: (data: Courier[]) => {
    saveItem(STORAGE_KEYS.COURIERS, data);
    queueMasterPush('couriers', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'couriers', allRecords: data, count: data.length });
  },

  getSKUs: (): SKU[] => loadItem(STORAGE_KEYS.SKUS, initialSKUs),
  saveSKUs: (data: SKU[]) => {
    saveItem(STORAGE_KEYS.SKUS, data);
    queueMasterPush('skus', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'skus', allRecords: data, count: data.length });
  },

  getDrivers: (): Driver[] => loadItem(STORAGE_KEYS.DRIVERS, initialDrivers),
  saveDrivers: (data: Driver[]) => {
    saveItem(STORAGE_KEYS.DRIVERS, data);
    queueMasterPush('drivers', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'drivers', allRecords: data, count: data.length });
  },

  getVehicleTypes: (): VehicleType[] => loadItem(STORAGE_KEYS.VEHICLE_TYPES, initialVehicleTypes),
  saveVehicleTypes: (data: VehicleType[]) => {
    saveItem(STORAGE_KEYS.VEHICLE_TYPES, data);
    queueMasterPush('vehicle_types', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'vehicle_types', allRecords: data, count: data.length });
  },

  getReturnReasons: (): ReturnReason[] => loadItem(STORAGE_KEYS.RETURN_REASONS, initialReturnReasons),
  saveReturnReasons: (data: ReturnReason[]) => {
    saveItem(STORAGE_KEYS.RETURN_REASONS, data);
    queueMasterPush('return_reasons', data);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'return_reasons', allRecords: data, count: data.length });
  },

  getUsers: (): User[] => {
    const raw = (() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.USERS);
        if (stored !== null) {
          return JSON.parse(stored);
        }
      } catch {
        // fall through to seeding
      }
      return null;
    })();
    if (Array.isArray(raw)) {
      const existingMap = new Map<string, User>();
      // First put initial users
      initialUsers.forEach(u => existingMap.set(u.email.toLowerCase(), u));
      // Then overlay saved custom users so custom edits/new users take precedence
      raw.forEach((u: any) => {
        if (u && u.email) {
          const { password: _, ...rest } = u;
          existingMap.set(u.email.toLowerCase(), rest as User);
        }
      });
      return Array.from(existingMap.values());
    }
    // First run only: seed standard users
    const seeded = initialUsers.map(({ password: _, ...rest }) => rest as User);
    saveItem(STORAGE_KEYS.USERS, seeded);
    return seeded;
  },
  saveUsers: (data: User[]) => {
    // Strictly strip password from all records to guarantee zero password exposure in storage
    const sanitized = data.map(({ password: _, ...rest }) => rest as User);
    saveItem(STORAGE_KEYS.USERS, sanitized);
    queueMasterPush('users', sanitized);
    SyncService.broadcast('MASTERS_UPDATED', { category: 'users', allRecords: sanitized, count: sanitized.length });
  },
  updateUser: (id: string, updates: Partial<User>) => {
    const users = StorageService.getUsers();
    const { password: _, ...safeUpdates } = updates as any;
    const updated = users.map(u => (u.id === id || u.email.toLowerCase() === id.toLowerCase() ? { ...u, ...safeUpdates } : u));
    StorageService.saveUsers(updated);
  },

  getCurrentUser: (): User | null => {
    const session = loadItem<AuthSessionData>(STORAGE_KEYS.AUTH_SESSION, { isLoggedIn: false });
    if (!session.isLoggedIn) return null;
    const rawUser = loadItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (!rawUser) return null;
    const { password: _, ...cleanUser } = rawUser;
    return cleanUser as User;
  },
  saveCurrentUser: (user: User | null) => {
    if (user) {
      const { password: _, ...cleanUser } = user;
      saveItem(STORAGE_KEYS.CURRENT_USER, cleanUser);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },

  getCurrentWarehouseId: (): string => loadItem(STORAGE_KEYS.CURRENT_WH, 'wh-main'),
  saveCurrentWarehouseId: (id: string) => saveItem(STORAGE_KEYS.CURRENT_WH, id),

  getGateEntries: (): InwardGateEntry[] => loadItem(STORAGE_KEYS.GATE_ENTRIES, initialInwardGateEntries),
  saveGateEntries: (data: InwardGateEntry[], broadcast = true) => {
    saveItem(STORAGE_KEYS.GATE_ENTRIES, data);
    if (broadcast) SyncService.broadcast('GATE_ENTRY_UPDATED', { allGateEntries: data, count: data.length });
  },

  getReturnBatches: (): ReturnBatch[] => {
    const raw = loadItem(STORAGE_KEYS.RETURN_BATCHES, initialReturnBatches);
    if (!Array.isArray(raw)) return [];
    return raw
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
      }));
  },
  saveReturnBatches: (data: ReturnBatch[], broadcast = true) => {
    const safe = (data || [])
      .filter(b => b && (
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
      }));
    saveItem(STORAGE_KEYS.RETURN_BATCHES, safe);
    if (broadcast) SyncService.broadcast('BATCH_UPDATED', { allBatches: safe, count: safe.length });
  },

  getScannedItems: (): ScannedReturnItem[] => {
    const raw = loadItem(STORAGE_KEYS.SCANNED_ITEMS, initialScannedItems);
    if (!Array.isArray(raw)) return [];
    return raw
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
  },
  saveScannedItems: (data: ScannedReturnItem[], broadcast = true) => {
    const safe = (data || [])
      .filter(i => i && (
        (i.id && i.id !== 'undefined' && i.id !== 'null') ||
        (i.trackingNumber && i.trackingNumber !== 'undefined' && i.trackingNumber !== 'null') ||
        ((i as any).awbNumber && (i as any).awbNumber !== 'undefined' && (i as any).awbNumber !== 'null')
      ))
      .map((i: any, idx: number) => ({
        ...i,
        id: (i.id && i.id !== 'undefined' && i.id !== 'null')
          ? i.id
          : (i.trackingNumber && i.trackingNumber !== 'undefined' && i.trackingNumber !== 'null')
            ? i.trackingNumber
            : `item-${Date.now()}-${idx}`,
      }));
    saveItem(STORAGE_KEYS.SCANNED_ITEMS, safe);
    if (broadcast) SyncService.broadcast('ITEM_UPDATED', { allScannedItems: safe, count: safe.length });
  },

  getActiveDevices: (): ActiveDeviceSession[] => loadItem(STORAGE_KEYS.ACTIVE_DEVICES, initialActiveDevices),
  saveActiveDevices: (data: ActiveDeviceSession[], broadcast = true) => {
    saveItem(STORAGE_KEYS.ACTIVE_DEVICES, data);
    if (broadcast) SyncService.broadcast('DEVICE_HEARTBEAT', { count: data.length });
  },

  registerDeviceSession: (session: ActiveDeviceSession): ActiveDeviceSession[] => {
    const devices = StorageService.getActiveDevices();
    const existingIndex = devices.findIndex(d => d.id === session.id || (d.userId === session.userId && d.deviceType === session.deviceType));
    let updated: ActiveDeviceSession[];
    if (existingIndex >= 0) {
      updated = [...devices];
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...session,
        status: 'Online',
        lastActiveAt: new Date().toISOString(),
      };
    } else {
      updated = [session, ...devices];
    }
    StorageService.saveActiveDevices(updated);
    SyncService.broadcast('DEVICE_LOGIN', session);
    return updated;
  },

  updateDeviceHeartbeat: (sessionId: string): void => {
    const devices = StorageService.getActiveDevices();
    const index = devices.findIndex(d => d.id === sessionId);
    if (index >= 0) {
      devices[index].lastActiveAt = new Date().toISOString();
      devices[index].status = 'Online';
      StorageService.saveActiveDevices(devices);
    }
  },

  removeDeviceSession: (sessionId: string): void => {
    const devices = StorageService.getActiveDevices();
    const updated = devices.map(d => (d.id === sessionId ? { ...d, status: 'Offline' as const, lastActiveAt: new Date().toISOString() } : d));
    StorageService.saveActiveDevices(updated);
    SyncService.broadcast('DEVICE_LOGOUT', { sessionId });
  },

  cleanupStaleDevices: (maxIdleMinutes: number = 30): ActiveDeviceSession[] => {
    const devices = StorageService.getActiveDevices();
    const now = Date.now();
    const thresholdMs = maxIdleMinutes * 60 * 1000;
    const updated = devices.map(d => {
      const lastActive = new Date(d.lastActiveAt).getTime();
      if (d.status === 'Online' && now - lastActive > thresholdMs) {
        return { ...d, status: 'Idle' as const };
      }
      return d;
    });
    StorageService.saveActiveDevices(updated);
    return updated;
  },

  getActivityLogs: (): ActivityLog[] => loadItem(STORAGE_KEYS.LOGS, initialActivityLogs),
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const logs = StorageService.getActivityLogs();
    const newLog: ActivityLog = {
      ...log,
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newLog, ...logs].slice(0, 150);
    saveItem(STORAGE_KEYS.LOGS, updated);
    SyncService.broadcast('ACTIVITY_LOG_ADDED', { log: newLog, allLogs: updated });
    return newLog;
  },

  getDashboardDateFilter: (defaultFilter: string = 'today'): string => loadItem(STORAGE_KEYS.DASHBOARD_DATE_FILTER, defaultFilter),
  saveDashboardDateFilter: (filter: string) => saveItem(STORAGE_KEYS.DASHBOARD_DATE_FILTER, filter),

  getDashboardSelectedDate: (defaultDate: string = ''): string => loadItem(STORAGE_KEYS.DASHBOARD_SELECTED_DATE, defaultDate),
  saveDashboardSelectedDate: (dateStr: string) => saveItem(STORAGE_KEYS.DASHBOARD_SELECTED_DATE, dateStr),

  // Apply full authoritative remote server store to local cache
  applyRemoteStore: (remoteStore: any): { batches: ReturnBatch[]; scannedItems: ScannedReturnItem[]; gateEntries: InwardGateEntry[] } => {
    let mergedBatches = StorageService.getReturnBatches();
    let mergedScannedItems = StorageService.getScannedItems();
    let mergedGateEntries = StorageService.getGateEntries();

    if (!remoteStore || typeof remoteStore !== 'object') {
      return { batches: mergedBatches, scannedItems: mergedScannedItems, gateEntries: mergedGateEntries };
    }

    try {
      if (Array.isArray(remoteStore.gateEntries)) {
        const local = StorageService.getGateEntries();
        mergedGateEntries = mergeGateEntries(local, remoteStore.gateEntries);
        saveItem(STORAGE_KEYS.GATE_ENTRIES, mergedGateEntries);
      }
      if (Array.isArray(remoteStore.batches)) {
        const local = StorageService.getReturnBatches();
        mergedBatches = mergeBatches(local, remoteStore.batches);
        saveItem(STORAGE_KEYS.RETURN_BATCHES, mergedBatches);
      }
      if (Array.isArray(remoteStore.scannedItems)) {
        const local = StorageService.getScannedItems();
        mergedScannedItems = mergeScannedItems(local, remoteStore.scannedItems);
        saveItem(STORAGE_KEYS.SCANNED_ITEMS, mergedScannedItems);
      }
      if (Array.isArray(remoteStore.companies)) saveItem(STORAGE_KEYS.COMPANIES, remoteStore.companies);
      if (Array.isArray(remoteStore.warehouses)) saveItem(STORAGE_KEYS.WAREHOUSES, remoteStore.warehouses);
      if (Array.isArray(remoteStore.clients)) saveItem(STORAGE_KEYS.CLIENTS, remoteStore.clients);
      if (Array.isArray(remoteStore.couriers)) saveItem(STORAGE_KEYS.COURIERS, remoteStore.couriers);
      if (Array.isArray(remoteStore.skus)) saveItem(STORAGE_KEYS.SKUS, remoteStore.skus);
      if (Array.isArray(remoteStore.drivers)) saveItem(STORAGE_KEYS.DRIVERS, remoteStore.drivers);
      if (Array.isArray(remoteStore.vehicleTypes)) saveItem(STORAGE_KEYS.VEHICLE_TYPES, remoteStore.vehicleTypes);
      if (Array.isArray(remoteStore.returnReasons)) saveItem(STORAGE_KEYS.RETURN_REASONS, remoteStore.returnReasons);
      if (Array.isArray(remoteStore.users)) saveItem(STORAGE_KEYS.USERS, remoteStore.users);
      if (Array.isArray(remoteStore.activityLogs)) saveItem(STORAGE_KEYS.LOGS, remoteStore.activityLogs);
    } catch (e) {
      console.warn('[StorageService] Error applying remote store:', e);
    }

    return {
      batches: mergedBatches,
      scannedItems: mergedScannedItems,
      gateEntries: mergedGateEntries,
    };
  },

  // Silently persist a masters list received via realtime sync (no re-broadcast).
  // Keeps each device's offline/localStorage fallback identical to the central data.
  applyMasterUpdate: (category: string, records: any[]) => {
    if (!category || !Array.isArray(records)) return;
    const keyMap: Record<string, string> = {
      companies: STORAGE_KEYS.COMPANIES,
      warehouses: STORAGE_KEYS.WAREHOUSES,
      clients: STORAGE_KEYS.CLIENTS,
      couriers: STORAGE_KEYS.COURIERS,
      skus: STORAGE_KEYS.SKUS,
      drivers: STORAGE_KEYS.DRIVERS,
      vehicle_types: STORAGE_KEYS.VEHICLE_TYPES,
      return_reasons: STORAGE_KEYS.RETURN_REASONS,
      users: STORAGE_KEYS.USERS,
    };
    const key = keyMap[category];
    if (!key) return;
    try {
      const sanitized = category === 'users'
        ? records.map(({ password: _, ...rest }) => rest)
        : records;
      saveItem(key, sanitized as any);
    } catch (e) {
      console.warn('[StorageService] Error applying master update:', e);
    }
  },

  getSupabaseConfig: (): SupabaseConfig => {
    const cfg = loadItem<SupabaseConfig>(STORAGE_KEYS.SUPABASE_CONFIG, initialSupabaseConfig);
    if (cfg?.supabaseUrl?.includes('xyzcompany') || cfg?.supabaseUrl?.includes('placeholder') || cfg?.supabaseAnonKey?.includes('...')) {
      return {
        supabaseUrl: '',
        supabaseAnonKey: '',
        autoSyncEnabled: false,
        connectedStatus: 'Disconnected',
      };
    }
    return cfg;
  },
  saveSupabaseConfig: (config: SupabaseConfig) => saveItem(STORAGE_KEYS.SUPABASE_CONFIG, config),

  // Authentication Session (Secure, device/date/expiry enforced)
  getAuthSession: (): AuthSessionData =>
    loadItem<AuthSessionData>(STORAGE_KEYS.AUTH_SESSION, { isLoggedIn: false }),
  saveAuthSession: (session: Partial<AuthSessionData> & { isLoggedIn: boolean; userId?: string }) => {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const sessionObj: AuthSessionData = {
      isLoggedIn: session.isLoggedIn,
      userId: session.userId,
      userEmail: session.userEmail,
      userName: session.userName,
      userRole: session.userRole,
      loginDate: session.loginDate || today,
      loginTimestamp: session.loginTimestamp || now,
      expiresAt: session.expiresAt || (now + 12 * 60 * 60 * 1000), // 12-hour active shift session
      sessionToken: session.sessionToken || `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      deviceId: session.deviceId || SyncService.getDeviceId(),
    };
    saveItem(STORAGE_KEYS.AUTH_SESSION, sessionObj);
  },
  clearAuthSession: () => {
    saveItem(STORAGE_KEYS.AUTH_SESSION, { isLoggedIn: false });
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  resetToDefault: () => {
    localStorage.clear();
    window.location.reload();
  },
};


export function generateSupabaseDDL(): string {
  return `-- WOP-Emiza Phase 1 PostgreSQL Database Schema (for Supabase SQL Editor)
-- Run this in your Supabase project's SQL Editor to create all 13+ tables & indexes.

-- OPTIONAL: Drop existing tables if re-initializing or fixing column type conflicts (e.g. TEXT vs UUID)
DROP TABLE IF EXISTS scanned_return_items CASCADE;
DROP TABLE IF EXISTS return_batches CASCADE;
DROP TABLE IF EXISTS inward_gate_entries CASCADE;
DROP TABLE IF EXISTS return_reasons CASCADE;
DROP TABLE IF EXISTS vehicle_types CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS skus CASCADE;
DROP TABLE IF EXISTS couriers CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;

-- 1. Companies
CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    gstin TEXT,
    address TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Warehouses
CREATE TABLE warehouses (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    total_docks INT DEFAULT 10,
    contact_person TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Active'
);

-- 3. Clients
CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    category TEXT,
    status TEXT DEFAULT 'Active'
);

-- 4. Couriers
CREATE TABLE couriers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tracking_format_pattern TEXT,
    contact_number TEXT,
    api_supported BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'Active'
);

-- 5. SKUs
CREATE TABLE skus (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL,
    ean_barcode TEXT,
    name TEXT NOT NULL,
    category TEXT,
    unit_price NUMERIC(10,2),
    weight_grams INT,
    status TEXT DEFAULT 'Active'
);

-- 6. Users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    assigned_warehouse_ids TEXT[],
    assigned_client_ids TEXT[],
    status TEXT DEFAULT 'Active',
    last_login_at TIMESTAMPTZ
);

-- 7. Drivers
CREATE TABLE drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    license_number TEXT,
    transporter_name TEXT,
    status TEXT DEFAULT 'Active'
);

-- 8. Vehicle Types
CREATE TABLE vehicle_types (
    id TEXT PRIMARY KEY,
    type_name TEXT NOT NULL,
    capacity_tons NUMERIC(5,2),
    status TEXT DEFAULT 'Active'
);

-- 9. Return Reasons
CREATE TABLE return_reasons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    category TEXT DEFAULT 'Both',
    require_photo BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'Active'
);

-- 10. Inward Gate Entries
CREATE TABLE inward_gate_entries (
    id TEXT PRIMARY KEY,
    gate_pass_number TEXT UNIQUE NOT NULL,
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    courier_id TEXT REFERENCES couriers(id) ON DELETE SET NULL,
    vehicle_number TEXT NOT NULL,
    vehicle_type_id TEXT,
    driver_name TEXT NOT NULL,
    driver_mobile TEXT NOT NULL,
    driver_license TEXT,
    invoice_challan_number TEXT,
    invoice_value NUMERIC(12,2),
    expected_box_count INT DEFAULT 0,
    received_box_count INT DEFAULT 0,
    dock_number TEXT,
    status TEXT DEFAULT 'Arrived',
    entry_time TIMESTAMPTZ DEFAULT NOW(),
    dock_allocated_time TIMESTAMPTZ,
    unloading_end_time TIMESTAMPTZ,
    remarks TEXT,
    created_by TEXT
);

-- 11. Return Batches
CREATE TABLE return_batches (
    id TEXT PRIMARY KEY,
    batch_number TEXT UNIQUE NOT NULL,
    batch_type TEXT NOT NULL,
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    courier_id TEXT REFERENCES couriers(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Open',
    expected_count INT DEFAULT 0,
    total_scanned INT DEFAULT 0,
    remarks_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_by TEXT,
    created_by_name TEXT,
    driver_name TEXT,
    driver_mobile TEXT,
    driver_signature TEXT,
    supervisor_signer TEXT,
    notes TEXT
);

-- 12. Scanned Return Items
CREATE TABLE scanned_return_items (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES return_batches(id) ON DELETE CASCADE,
    tracking_number TEXT NOT NULL,
    order_number TEXT,
    sku_code TEXT,
    product_name TEXT,
    remark TEXT NOT NULL,
    photo_url TEXT,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    scanned_by TEXT,
    scanned_by_name TEXT
);

-- 13. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details TEXT
);

-- 14. User Profiles (Auth Link)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'Supervisor',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Permissions & Role Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    permission_key TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE
);

-- 16. Active Devices & Live Sessions
CREATE TABLE IF NOT EXISTS active_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_email TEXT NOT NULL,
    warehouse_id TEXT,
    warehouse_name TEXT,
    client_id TEXT,
    device_type TEXT DEFAULT 'Desktop',
    browser_info TEXT,
    ip_address TEXT,
    login_time TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'Online'
);

-- Indexes for lightning fast barcode & tracking lookups
CREATE INDEX IF NOT EXISTS idx_scanned_items_tracking ON scanned_return_items(tracking_number);
CREATE INDEX IF NOT EXISTS idx_scanned_items_batch ON scanned_return_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_gate_entries_wh ON inward_gate_entries(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_batches_wh ON return_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_active_devices_wh ON active_devices(warehouse_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inward_gate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;

-- FIX RECURSION: Non-recursive RLS Policies for user_profiles
DROP POLICY IF EXISTS "user_profiles_read_authenticated" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_write_authenticated" ON user_profiles;
CREATE POLICY "user_profiles_read_authenticated" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_profiles_write_authenticated" ON user_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissive RLS Policies for Authenticated Operations Staff
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on return batches" ON return_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on scanned items" ON scanned_return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on gate entries" ON inward_gate_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on active devices" ON active_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on users" ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on activity logs" ON activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on warehouses" ON warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow authenticated read/write on couriers" ON couriers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Supabase Realtime publication for multi-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE scanned_return_items;
ALTER PUBLICATION supabase_realtime ADD TABLE return_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE inward_gate_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
`;
}
