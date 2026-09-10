import { getSupabase, isSupabaseConfigured } from './supabase';
import { StorageService } from './storage';
import { SyncService } from './syncService';
import { mapDbToScannedItem, mapDbToReturnBatch, mapDbToGateEntry, mapDbToActivityLog } from './dbService';

export function startRealtimeSync() {
  if (!isSupabaseConfigured()) return () => {};
  const client = getSupabase();
  if (!client) return () => {};

  const channel = client
    .channel('emiza-global-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scanned_return_items' }, (payload) => {
      const items = StorageService.getScannedItems();
      if (payload.eventType === 'INSERT') {
        const newItem = mapDbToScannedItem(payload.new);
        if (!items.find(i => i.id === newItem.id)) {
          const next = [newItem, ...items];
          StorageService.saveScannedItems(next);
          SyncService.broadcast('ITEM_SCANNED', { item: newItem, source: 'realtime' });
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = mapDbToScannedItem(payload.new);
        const next = items.map(i => i.id === updated.id ? updated : i);
        StorageService.saveScannedItems(next);
        SyncService.broadcast('ITEM_UPDATED', { itemId: updated.id, item: updated, source: 'realtime' });
      } else if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (id) {
          const next = items.filter(i => i.id !== id);
          StorageService.saveScannedItems(next);
          SyncService.broadcast('ITEM_DELETED', { itemId: id, source: 'realtime' });
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'return_batches' }, (payload) => {
      const batches = StorageService.getReturnBatches();
      if (payload.eventType === 'INSERT') {
        const newBatch = mapDbToReturnBatch(payload.new);
        if (!batches.find(b => b.id === newBatch.id)) {
          const next = [newBatch, ...batches];
          StorageService.saveReturnBatches(next);
          SyncService.broadcast('BATCH_CREATED', { batch: newBatch, source: 'realtime' });
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = mapDbToReturnBatch(payload.new);
        const next = batches.map(b => b.id === updated.id ? updated : b);
        StorageService.saveReturnBatches(next);
        SyncService.broadcast('BATCH_UPDATED', { batch: updated, source: 'realtime' });
      } else if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (id) {
          const next = batches.filter(b => b.id !== id);
          StorageService.saveReturnBatches(next);
          SyncService.broadcast('BATCH_CLOSED', { batchId: id, source: 'realtime' });
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inward_gate_entries' }, (payload) => {
      const entries = StorageService.getGateEntries();
      if (payload.eventType === 'INSERT') {
        const newEntry = mapDbToGateEntry(payload.new);
        if (!entries.find(e => e.id === newEntry.id)) {
          const next = [newEntry, ...entries];
          StorageService.saveGateEntries(next);
          SyncService.broadcast('GATE_ENTRY_CREATED', { entry: newEntry, source: 'realtime' });
        }
      } else if (payload.eventType === 'UPDATE') {
        const updated = mapDbToGateEntry(payload.new);
        const next = entries.map(e => e.id === updated.id ? updated : e);
        StorageService.saveGateEntries(next);
        SyncService.broadcast('GATE_ENTRY_UPDATED', { id: updated.id, entry: updated, source: 'realtime' });
      } else if (payload.eventType === 'DELETE') {
        const id = payload.old?.id;
        if (id) {
          const next = entries.filter(e => e.id !== id);
          StorageService.saveGateEntries(next);
          SyncService.broadcast('GATE_ENTRY_DELETED', { id, source: 'realtime' });
        }
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
      if (payload.new) {
        const log = mapDbToActivityLog(payload.new);
        const logs = StorageService.getActivityLogs();
        if (!logs.some(l => l.id === log.id)) {
          SyncService.broadcast('ACTIVITY_LOG_ADDED', { log, source: 'realtime' });
        }
      }
    })
    .subscribe((status) => {
      console.log('[Realtime] Global channel subscription status:', status);
    });

  return () => {
    try {
      client.removeChannel(channel);
    } catch {
      // ignore
    }
  };
}
