// ============================================================================
// MasterSync — Supabase-backed synchronization for ALL master data.
//
// WHY: static deployments (Cloudflare Pages / Netlify) have no sync server
// and no /api/sync/* endpoints. The ONLY shared backend every device has is
// Supabase. This module makes `master_records` the cloud source of truth:
//
//   - push(): every local master save is diffed against the last pushed
//     snapshot and upserted/deleted in Supabase (debounced, fire-and-forget)
//   - pullAll(): merged cloud state into local lists (last-writer-wins by
//     `_updatedAt`) so a fresh device (e.g. a phone) immediately sees every
//     courier/client created anywhere
//   - subscribe(): realtime postgres_changes -> apply single-record changes
//     on every other device within ~a second
// ============================================================================
import { getSupabase, isSupabaseConfigured } from './supabase';
import { StorageService } from './storage';

export type MasterCategory =
  | 'companies'
  | 'warehouses'
  | 'clients'
  | 'couriers'
  | 'skus'
  | 'drivers'
  | 'vehicle_types'
  | 'return_reasons'
  | 'users';

export const MASTER_CATEGORIES: MasterCategory[] = [
  'companies',
  'warehouses',
  'clients',
  'couriers',
  'skus',
  'drivers',
  'vehicle_types',
  'return_reasons',
  'users',
];

const PUSH_SNAPSHOT_KEY = 'emiza_master_pushed_v1';
const PUSH_DEBOUNCE_MS = 150;

type MasterRow = {
  category: string;
  rec_id: string;
  data: any;
  updated_at: string;
};

// --- push snapshot bookkeeping (avoids re-uploading unchanged records) ---
function loadPushSnapshot(): Record<string, Record<string, any>> {
  try {
    const raw = localStorage.getItem(PUSH_SNAPSHOT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}
function savePushSnapshot(snap: Record<string, Record<string, any>>) {
  try {
    localStorage.setItem(PUSH_SNAPSHOT_KEY, JSON.stringify(snap));
  } catch { /* ignore */ }
}

export function recordMergedSnapshot(category: MasterCategory, records: any[]) {
  try {
    const snap = loadPushSnapshot();
    const current: Record<string, any> = snap[category] || {};
    for (const rec of records) {
      if (rec?.id) {
        current[String(rec.id)] = rec;
      }
    }
    snap[category] = current;
    savePushSnapshot(snap);
  } catch { /* ignore */ }
}

const debounceTimers: Partial<Record<MasterCategory, any>> = {};

// Test seam: allows unit tests to inject a fake Supabase client.
let testClient: any = null;
export function _setSupabaseClientForTesting(client: any) { testClient = client; }
function getClient(): any { return testClient || getSupabase(); }

/** Queue a cloud push for a category (called from StorageService.saveX). */
export function queueMasterPush(category: MasterCategory, records: any[]) {
  if (!isSupabaseConfigured() || typeof window === 'undefined') return;
  clearTimeout(debounceTimers[category]);
  debounceTimers[category] = setTimeout(() => {
    pushMasterCategory(category, records).catch(() => {});
  }, PUSH_DEBOUNCE_MS);
}

/** Diff `records` against the last pushed snapshot and sync to Supabase. */
export async function pushMasterCategory(category: MasterCategory, records: any[]): Promise<boolean> {
  const sb = getClient();
  if (!sb || !Array.isArray(records)) return false;

  const snap = loadPushSnapshot();
  const prev = snap[category] || {};
  const next: Record<string, any> = {};

  const upserts: MasterRow[] = [];
  for (const rec of records) {
    if (!rec?.id) continue;
    const clean = category === 'users'
      ? (() => { const { password: _pw, ...rest } = rec; return rest; })()
      : rec;
    // stamp LWW version (keep existing stamp if record unchanged since load)
    const existingStamp = rec._updatedAt || prev[rec.id]?._updatedAt;
    const isUnchanged = prev[rec.id] && JSON.stringify(stripStamp(prev[rec.id])) === JSON.stringify(stripStamp(clean));
    const stamp = isUnchanged && existingStamp
      ? existingStamp
      : (rec._updatedAt && !prev[rec.id] ? rec._updatedAt : new Date().toISOString());
    const withStamp = { ...clean, _updatedAt: stamp };
    next[rec.id] = withStamp;
    if (JSON.stringify(stripStamp(prev[rec.id])) !== JSON.stringify(stripStamp(withStamp))) {
      upserts.push({ category, rec_id: String(rec.id), data: withStamp, updated_at: stamp });
    }
  }

  // deletes: ids previously pushed but missing from the new list
  const removedIds = Object.keys(prev).filter(id => !next[id]).filter(id => !id.startsWith('local-'));
  const seedGuard = category === 'users' ? removedIds.filter(id => !prev[id]?.isSeedDemo) : removedIds;

  let ok = true;
  if (upserts.length > 0) {
    const { error } = await sb.from('master_records').upsert(upserts, { onConflict: 'category,rec_id' });
    if (error) { console.warn(`[MasterSync] upsert ${category}:`, error.message); ok = false; }
  }
  if (ok && seedGuard.length > 0) {
    const { error } = await sb.from('master_records').delete().eq('category', category).in('rec_id', seedGuard);
    if (error) { console.warn(`[MasterSync] delete ${category}:`, error.message); ok = false; }
  }
  if (ok) {
    snap[category] = next;
    savePushSnapshot(snap);
  }
  return ok;
}

function stripStamp(rec: any): any {
  if (!rec || typeof rec !== 'object') return rec;
  const { _updatedAt: _s, ...rest } = rec;
  return rest;
}

// --- cloud pull & merge ---------------------------------------------------

export interface MasterLists {
  companies: any[]; warehouses: any[]; clients: any[]; couriers: any[]; skus: any[];
  drivers: any[]; vehicleTypes: any[]; returnReasons: any[]; users: any[];
}

export function readLocalMasterLists(): MasterLists {
  return {
    companies: StorageService.getCompanies(),
    warehouses: StorageService.getWarehouses(),
    clients: StorageService.getClients(),
    couriers: StorageService.getCouriers(),
    skus: StorageService.getSKUs(),
    drivers: StorageService.getDrivers(),
    vehicleTypes: StorageService.getVehicleTypes(),
    returnReasons: StorageService.getReturnReasons(),
    users: StorageService.getUsers(),
  };
}

export function categoryKey(category: string): keyof MasterLists | null {
  switch (category) {
    case 'companies': return 'companies';
    case 'warehouses': return 'warehouses';
    case 'clients': return 'clients';
    case 'couriers': return 'couriers';
    case 'skus': return 'skus';
    case 'drivers': return 'drivers';
    case 'vehicle_types': return 'vehicleTypes';
    case 'return_reasons': return 'returnReasons';
    case 'users': return 'users';
    default: return null;
  }
}

/** LWW union of two lists by record id (records without _updatedAt lose ties). */
export function mergeList(local: any[], cloud: any[]): any[] {
  const byId = new Map<string, any>();
  for (const rec of local || []) if (rec?.id) byId.set(String(rec.id), rec);
  for (const rec of cloud || []) {
    if (!rec?.id) continue;
    const id = String(rec.id);
    const cur = byId.get(id);
    if (!cur) { byId.set(id, rec); continue; }
    const curT = cur?._updatedAt || '';
    const newT = rec?._updatedAt || '';
    if (newT >= curT) byId.set(id, rec);
  }
  return Array.from(byId.values());
}

/** Fetch all master rows from Supabase and LWW-merge into local lists. */
export async function pullAndMergeMasters(): Promise<Partial<MasterLists> | null> {
  const sb = getClient();
  if (!sb) return null;
  const { data, error } = await sb.from('master_records').select('category,rec_id,data,updated_at');
  if (error) { console.warn('[MasterSync] pull:', error.message); return null; }

  const cloud: Record<string, any[]> = {};
  for (const row of (data as MasterRow[]) || []) {
    if (!row?.category || !row?.data) continue;
    const item = { ...row.data, id: row.rec_id, _updatedAt: row.data?._updatedAt || row.updated_at };
    (cloud[row.category] = cloud[row.category] || []).push(item);
  }

  const local = readLocalMasterLists();
  const merged: Partial<MasterLists> = {};
  for (const cat of MASTER_CATEGORIES) {
    const key = categoryKey(cat)!;
    const localList: any[] = (local as any)[key] || [];
    const cloudList: any[] = cloud[cat] || [];
    if (cloudList.length === 0) { merged[key] = localList; continue; }
    const m = mergeList(localList, cloudList);
    (merged as any)[key] = m;
    StorageService.applyMasterUpdate(cat, m);
    recordMergedSnapshot(cat, m);
  }
  return merged;
}

// --- realtime subscription -------------------------------------------------

type MasterChangeHandler = (category: MasterCategory, recId: string, data: any | null, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
let masterChannel: any = null;

export function subscribeMasterChanges(onChange: MasterChangeHandler): () => void {
  const sb = getClient();
  if (!sb) return () => {};
  try {
    if (masterChannel) {
      try { sb.removeChannel(masterChannel); } catch { /* ignore */ }
      masterChannel = null;
    }
    masterChannel = sb
      .channel('emiza_master_records_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_records' }, (payload: any) => {
        const row = (payload.new && (payload.new.category !== undefined ? payload.new : null)) || null;
        const oldRow = (payload.old && (payload.old.category !== undefined ? payload.old : null)) || null;
        const cat = row?.category || oldRow?.category;
        const recId = row?.rec_id || oldRow?.rec_id;
        if (!cat || !recId) return;
        const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        const data = row?.data
          ? { ...row.data, id: recId, _updatedAt: row.data._updatedAt || row.updated_at }
          : null;
        onChange(cat as MasterCategory, String(recId), data, event);
      })
      .subscribe();
    return () => {
      try { sb.removeChannel(masterChannel); } catch { /* ignore */ }
      masterChannel = null;
    };
  } catch (e) {
    console.warn('[MasterSync] subscribe failed:', e);
    return () => {};
  }
}

/** Apply a single realtime change to a local list (pure — returns new list). */
export function applyMasterChange(list: any[], recId: string, data: any | null, event: 'INSERT' | 'UPDATE' | 'DELETE'): any[] {
  const id = String(recId);
  if (event === 'DELETE') return (list || []).filter(r => String(r.id) !== id);
  if (!data) return list || [];
  const rec = { ...data, id };
  const idx = (list || []).findIndex(r => String(r.id) === id);
  if (idx === -1) return [rec, ...(list || [])];
  const cur = list[idx];
  const newT = rec?._updatedAt || '';
  const curT = cur?._updatedAt || '';
  if (newT < curT) return list; // stale event
  const next = [...list];
  next[idx] = rec;
  return next;
}

/** Pure backoff policy for the REST poll fallback on hosts without the sync API. */
export function pollIntervalMs(consecutiveFailures: number): number | null {
  if (consecutiveFailures <= 0) return 3000;   // healthy fast poll
  if (consecutiveFailures < 3) return 5000;    // transient
  if (consecutiveFailures < 6) return 30000;   // degrading — slow down
  return null;                                  // endpoint absent (static host) — stop hammering
}
