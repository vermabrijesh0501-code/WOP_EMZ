import { getSupabase } from './supabase';
import {
  ReturnBatch,
  ScannedReturnItem,
  InwardGateEntry,
  ActivityLog,
  ReturnRemarkType,
  Warehouse,
} from '../types';
import { StorageService } from './storage';
import { SyncService } from './syncService';
import { OfflineQueue } from './offlineQueue';

// Normalizers between TypeScript camelCase and PostgreSQL snake_case

export function mapDbToScannedItem(row: any): ScannedReturnItem {
  return {
    id: row.id,
    batchId: row.batch_id || row.batchId,
    trackingNumber: row.tracking_number || row.trackingNumber,
    orderNumber: row.order_number || row.orderNumber || `ORD-${(row.tracking_number || row.trackingNumber || '').slice(-6)}`,
    skuCode: row.sku_code || row.skuCode || '',
    productName: row.product_name || row.productName || '',
    remark: (row.remark || row.qc_condition || row.qcCondition || 'Good') as ReturnRemarkType,
    photoUrl: row.photo_url || row.photoUrl,
    scannedAt: row.scanned_at || row.scannedAt || new Date().toISOString(),
    scannedBy: row.scanned_by || row.scannedBy || '',
    scannedByName: row.scanned_by_name || row.scannedByName || 'Operator',
  };
}

export function mapScannedItemToDb(item: ScannedReturnItem): Record<string, any> {
  return {
    id: item.id,
    batch_id: item.batchId,
    tracking_number: item.trackingNumber,
    order_number: item.orderNumber || `ORD-${item.trackingNumber.slice(-6)}`,
    sku_code: item.skuCode || null,
    product_name: item.productName || null,
    remark: item.remark,
    photo_url: item.photoUrl || null,
    scanned_at: item.scannedAt,
    scanned_by: item.scannedBy,
    scanned_by_name: item.scannedByName,
  };
}

export function mapDbToReturnBatch(row: any): ReturnBatch {
  return {
    id: row.id,
    batchNumber: row.batch_number || row.batchNumber,
    batchType: (row.batch_type || row.batchType || 'RTO/B2C') as 'RTO/B2C' | 'B2B Return',
    warehouseId: row.warehouse_id || row.warehouseId,
    clientId: row.client_id || row.clientId,
    courierId: row.courier_id || row.courierId,
    status: (row.status || 'Open') as 'Open' | 'Closed',
    dockNumber: row.dock_number || row.dockNumber || 'Dock 01',
    expectedCount: row.expected_count ?? row.expectedCount ?? 0,
    totalScanned: row.total_scanned ?? row.totalScanned ?? 0,
    remarksBreakdown: row.remarks_breakdown || row.remarksBreakdown || {
      Good: 0,
      Damage: 0,
      'Open Box': 0,
      'Wrong Product': 0,
      'Short Qty': 0,
      'Missing Product': 0,
      Others: 0,
    },
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    closedAt: row.closed_at || row.closedAt,
    createdBy: row.created_by || row.createdBy || 'usr-super',
    createdByName: row.created_by_name || row.createdByName || 'Super Admin',
    driverName: row.driver_name || row.driverName,
    driverMobile: row.driver_mobile || row.driverMobile,
    driverSignature: row.driver_signature || row.driverSignature,
    supervisorSigner: row.supervisor_signer || row.supervisorSigner,
    notes: row.notes,
  };
}

export function mapReturnBatchToDb(batch: ReturnBatch): Record<string, any> {
  return {
    id: batch.id,
    batch_number: batch.batchNumber,
    batch_type: batch.batchType,
    warehouse_id: batch.warehouseId,
    client_id: batch.clientId,
    courier_id: batch.courierId,
    status: batch.status,
    expected_count: batch.expectedCount || 0,
    total_scanned: batch.totalScanned || 0,
    remarks_breakdown: batch.remarksBreakdown,
    created_at: batch.createdAt,
    closed_at: batch.closedAt || null,
    created_by: batch.createdBy,
  };
}

export function mapDbToGateEntry(row: any): InwardGateEntry {
  return {
    id: row.id,
    gatePassNumber: row.gate_pass_number || row.gatePassNumber,
    warehouseId: row.warehouse_id || row.warehouseId,
    companyId: row.company_id || row.companyId || 'comp-emiza',
    clientId: row.client_id || row.clientId,
    courierId: row.courier_id || row.courierId,
    vehicleNumber: row.vehicle_number || row.vehicleNumber,
    vehicleTypeId: row.vehicle_type_id || row.vehicleTypeId || 'vt-eicher',
    driverName: row.driver_name || row.driverName,
    driverMobile: row.driver_mobile || row.driverMobile,
    driverLicense: row.driver_license || row.driverLicense || '',
    invoiceChallanNumber: row.invoice_challan_number || row.invoiceChallanNumber || '',
    invoiceValue: row.invoice_value ?? row.invoiceValue ?? 0,
    expectedBoxCount: row.expected_box_count ?? row.expectedBoxCount ?? 0,
    receivedBoxCount: row.received_box_count ?? row.receivedBoxCount ?? 0,
    dockNumber: row.dock_number || row.dockNumber,
    status: (row.status || 'Arrived') as any,
    currentPhase: row.current_phase || row.currentPhase || 'Phase 01 - Vehicle Received',
    entryTime: row.entry_time || row.entryTime || new Date().toISOString(),
    dockAllocatedTime: row.dock_allocated_time || row.dockAllocatedTime,
    unloadingEndTime: row.unloading_end_time || row.unloadingEndTime,
    handoverCompletedTime: row.handover_completed_time || row.handoverCompletedTime,
    remarks: row.remarks || '',
    createdBy: row.created_by || row.createdBy || 'usr-super',
    createdByName: row.created_by_name || row.createdByName || 'Security Officer',
    phase1: row.phase1 || (row.phase_1_data ? JSON.parse(row.phase_1_data) : undefined),
    phase2: row.phase2 || (row.phase_2_data ? JSON.parse(row.phase_2_data) : undefined),
    phase3: row.phase3 || (row.phase_3_data ? JSON.parse(row.phase_3_data) : undefined),
  };
}

export function mapGateEntryToDb(entry: InwardGateEntry): Record<string, any> {
  return {
    id: entry.id,
    gate_pass_number: entry.gatePassNumber,
    warehouse_id: entry.warehouseId,
    company_id: entry.companyId,
    client_id: entry.clientId,
    courier_id: entry.courierId,
    vehicle_number: entry.vehicleNumber,
    vehicle_type_id: entry.vehicleTypeId,
    driver_name: entry.driverName,
    driver_mobile: entry.driverMobile,
    driver_license: entry.driverLicense || null,
    invoice_challan_number: entry.invoiceChallanNumber || null,
    invoice_value: entry.invoiceValue || 0,
    expected_box_count: entry.expectedBoxCount || 0,
    received_box_count: entry.receivedBoxCount || 0,
    dock_number: entry.dockNumber || null,
    status: entry.status,
    current_phase: entry.currentPhase || null,
    entry_time: entry.entryTime,
    dock_allocated_time: entry.dockAllocatedTime || null,
    unloading_end_time: entry.unloadingEndTime || null,
    handover_completed_time: entry.handoverCompletedTime || null,
    remarks: entry.remarks || null,
    created_by: entry.createdBy,
    created_by_name: entry.createdByName || null,
    phase_1_data: entry.phase1 ? JSON.stringify(entry.phase1) : null,
    phase_2_data: entry.phase2 ? JSON.stringify(entry.phase2) : null,
    phase_3_data: entry.phase3 ? JSON.stringify(entry.phase3) : null,
  };
}

export function mapDbToActivityLog(row: any): ActivityLog {
  let userName = row.user_name || row.userName || 'Staff';
  let userRole = row.user_role || row.userRole || 'Operator';
  let details = row.details || '';
  const match = details.match(/^\[(.*?)(?: - (.*?))?\]\s*(.*)$/);
  if (match) {
    userName = match[1];
    if (match[2]) userRole = match[2] as any;
    details = match[3];
  }
  return {
    id: row.id,
    timestamp: row.timestamp || row.created_at || new Date().toISOString(),
    userId: row.user_id || row.userId || 'usr-super',
    userName,
    userRole,
    action: row.action || 'Action',
    module: row.module || 'Warehouse',
    details,
  };
}

export function mapActivityLogToDb(log: ActivityLog): Record<string, any> {
  const metaPrefix = log.userName ? `[${log.userName}${log.userRole ? ` - ${log.userRole}` : ''}] ` : '';
  const cleanDetails = (log.details || '').startsWith(metaPrefix) ? log.details : `${metaPrefix}${log.details || ''}`;
  return {
    id: log.id,
    timestamp: log.timestamp || new Date().toISOString(),
    user_id: log.userId,
    action: log.action || 'System Action',
    module: log.module || 'Warehouse',
    details: cleanDetails,
  };
}

/**
 * Executes a write operation against Supabase.
 * If offline, fails, or unconfigured, it automatically enqueues to the OfflineQueue.
 */
async function safeSupabaseWrite(
  table: string,
  operation: 'insert' | 'update' | 'upsert' | 'delete',
  payload: any,
  filter?: { column: string; value: any }
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    OfflineQueue.enqueue({ table, operation, payload, filter });
    return;
  }

  try {
    let query: any;
    if (operation === 'insert') {
      query = sb.from(table).insert(payload);
    } else if (operation === 'upsert') {
      query = sb.from(table).upsert(payload, { onConflict: 'id' });
    } else if (operation === 'update') {
      if (!filter) {
        query = sb.from(table).update(payload).eq('id', payload.id);
      } else {
        query = sb.from(table).update(payload).eq(filter.column, filter.value);
      }
    } else if (operation === 'delete') {
      if (!filter) {
        query = sb.from(table).delete().eq('id', payload.id || payload);
      } else {
        query = sb.from(table).delete().eq(filter.column, filter.value);
      }
    }

    const { error } = await query;
    if (error) {
      // Automatic error recovery for foreign key constraint violation (code 23503)
      if (error.code === '23503' && payload && typeof payload === 'object') {
        console.warn(`[DBService] Foreign key constraint on ${table} (${error.message}). Retrying with sanitized relational keys...`);
        const sanitized = { ...payload };
        if (sanitized.warehouse_id) sanitized.warehouse_id = null;
        if (sanitized.company_id) sanitized.company_id = null;
        if (sanitized.client_id) sanitized.client_id = null;
        if (sanitized.courier_id) sanitized.courier_id = null;
        if (sanitized.vehicle_type_id) sanitized.vehicle_type_id = null;

        let retryQuery: any;
        if (operation === 'insert') retryQuery = sb.from(table).insert(sanitized);
        else if (operation === 'upsert') retryQuery = sb.from(table).upsert(sanitized, { onConflict: 'id' });
        else if (operation === 'update') {
          retryQuery = filter
            ? sb.from(table).update(sanitized).eq(filter.column, filter.value)
            : sb.from(table).update(sanitized).eq('id', sanitized.id);
        }

        const retryRes = await retryQuery;
        if (!retryRes?.error) {
          console.info(`[DBService] Successfully persisted to ${table} after relational key sanitization.`);
          return;
        }
      }
      throw error;
    }
  } catch (err: any) {
    console.warn(`[DBService] Write failed for ${table} (${operation}). Enqueueing for offline retry:`, err?.message || err);
    OfflineQueue.enqueue({ table, operation, payload, filter });
  }
}

/**
 * DBService provides full Cloud database synchronization with local storage fallback
 * and real-time multi-device broadcasts.
 */
export const DBService = {
  // Fetch all initial data from Supabase if connected
  async fetchAllData(): Promise<{
    batches?: ReturnBatch[];
    scannedItems?: ScannedReturnItem[];
    gateEntries?: InwardGateEntry[];
    logs?: ActivityLog[];
  }> {
    const sb = getSupabase();
    if (!sb) {
      return {
        batches: StorageService.getReturnBatches(),
        scannedItems: StorageService.getScannedItems(),
        gateEntries: StorageService.getGateEntries(),
        logs: StorageService.getActivityLogs(),
      };
    }

    try {
      const [batchesRes, itemsRes, gateRes, logsRes] = await Promise.allSettled([
        sb.from('return_batches').select('*').order('created_at', { ascending: false }),
        sb.from('scanned_return_items').select('*').order('scanned_at', { ascending: false }),
        sb.from('inward_gate_entries').select('*').order('entry_time', { ascending: false }),
        sb.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(100),
      ]);

      const result: {
        batches?: ReturnBatch[];
        scannedItems?: ScannedReturnItem[];
        gateEntries?: InwardGateEntry[];
        logs?: ActivityLog[];
      } = {};

      if (batchesRes.status === 'fulfilled' && batchesRes.value.data && batchesRes.value.data.length > 0) {
        result.batches = batchesRes.value.data.map(mapDbToReturnBatch);
        StorageService.saveReturnBatches(result.batches);
      } else {
        result.batches = StorageService.getReturnBatches();
      }

      if (itemsRes.status === 'fulfilled' && itemsRes.value.data && itemsRes.value.data.length > 0) {
        result.scannedItems = itemsRes.value.data.map(mapDbToScannedItem);
        StorageService.saveScannedItems(result.scannedItems);
      } else {
        result.scannedItems = StorageService.getScannedItems();
      }

      if (gateRes.status === 'fulfilled' && gateRes.value.data && gateRes.value.data.length > 0) {
        result.gateEntries = gateRes.value.data.map(mapDbToGateEntry);
        StorageService.saveGateEntries(result.gateEntries);
      } else {
        result.gateEntries = StorageService.getGateEntries();
      }

      if (logsRes.status === 'fulfilled' && logsRes.value.data && logsRes.value.data.length > 0) {
        result.logs = logsRes.value.data.map(mapDbToActivityLog);
      } else {
        result.logs = StorageService.getActivityLogs();
      }

      // Also trigger queue flush if online
      OfflineQueue.flush().catch(console.warn);

      return result;
    } catch (err) {
      console.warn('[DBService] Failed fetching remote data from Supabase, using storage cache:', err);
      return {
        batches: StorageService.getReturnBatches(),
        scannedItems: StorageService.getScannedItems(),
        gateEntries: StorageService.getGateEntries(),
        logs: StorageService.getActivityLogs(),
      };
    }
  },

  // Insert scanned item & update batch
  async recordScanItem(
    item: ScannedReturnItem,
    updatedBatch: ReturnBatch,
    allUpdatedItems: ScannedReturnItem[],
    allUpdatedBatches: ReturnBatch[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    // 1. Save to local storage for immediate offline/cache availability
    StorageService.saveScannedItems(allUpdatedItems, false);
    StorageService.saveReturnBatches(allUpdatedBatches, false);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    // 2. Reliable persisted writes with offline queue fallback
    const itemRow = mapScannedItemToDb(item);
    const batchRow = mapReturnBatchToDb(updatedBatch);

    // Persist batch first so foreign key relationship is established in database
    await safeSupabaseWrite('return_batches', 'upsert', batchRow);
    await safeSupabaseWrite('scanned_return_items', 'insert', itemRow);
    if (createdLog) {
      await safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog));
    }

    // 3. Broadcast to all other devices & tabs with full payload
    SyncService.broadcast('ITEM_SCANNED', {
      item,
      batch: updatedBatch,
      allScannedItems: allUpdatedItems,
      allBatches: allUpdatedBatches,
      log: createdLog,
    });
  },

  // Update item & recalculate batch
  async updateScanItem(
    itemId: string,
    updatedItem: ScannedReturnItem,
    updatedBatch: ReturnBatch,
    allUpdatedItems: ScannedReturnItem[],
    allUpdatedBatches: ReturnBatch[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveScannedItems(allUpdatedItems, false);
    StorageService.saveReturnBatches(allUpdatedBatches, false);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    const itemRow = mapScannedItemToDb(updatedItem);
    const batchRow = mapReturnBatchToDb(updatedBatch);

    await Promise.all([
      safeSupabaseWrite('scanned_return_items', 'update', itemRow, { column: 'id', value: itemId }),
      safeSupabaseWrite('return_batches', 'upsert', batchRow),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('ITEM_UPDATED', {
      itemId,
      item: updatedItem,
      batch: updatedBatch,
      allScannedItems: allUpdatedItems,
      allBatches: allUpdatedBatches,
      log: createdLog,
    });
  },

  // Delete item & decrement batch
  async deleteScanItem(
    itemId: string,
    batchId: string,
    updatedBatch: ReturnBatch,
    allUpdatedItems: ScannedReturnItem[],
    allUpdatedBatches: ReturnBatch[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveScannedItems(allUpdatedItems, false);
    StorageService.saveReturnBatches(allUpdatedBatches, false);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    const batchRow = mapReturnBatchToDb(updatedBatch);

    await Promise.all([
      safeSupabaseWrite('scanned_return_items', 'delete', { id: itemId }, { column: 'id', value: itemId }),
      safeSupabaseWrite('return_batches', 'upsert', batchRow),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('ITEM_DELETED', {
      itemId,
      batchId,
      batch: updatedBatch,
      allScannedItems: allUpdatedItems,
      allBatches: allUpdatedBatches,
      log: createdLog,
    });
  },

  // Create new return batch
  async createBatch(
    newBatch: ReturnBatch,
    allUpdatedBatches: ReturnBatch[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveReturnBatches(allUpdatedBatches, false);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    const batchRow = mapReturnBatchToDb(newBatch);

    await Promise.all([
      safeSupabaseWrite('return_batches', 'insert', batchRow),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('BATCH_CREATED', {
      batch: newBatch,
      allBatches: allUpdatedBatches,
      log: createdLog,
    });
  },

  // Close return batch
  async closeBatch(
    batchId: string,
    updatedBatch: ReturnBatch,
    allUpdatedBatches: ReturnBatch[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveReturnBatches(allUpdatedBatches, false);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    const batchRow = mapReturnBatchToDb(updatedBatch);

    await Promise.all([
      safeSupabaseWrite('return_batches', 'update', batchRow, { column: 'id', value: batchId }),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('BATCH_CLOSED', {
      batchId,
      batch: updatedBatch,
      allBatches: allUpdatedBatches,
      log: createdLog,
    });
  },

  // Update return batch details (client, courier, expected count, dock, notes)
  async updateBatch(
    batchId: string,
    updatedBatch: ReturnBatch,
    allUpdatedBatches: ReturnBatch[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveReturnBatches(allUpdatedBatches, false);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    const batchRow = mapReturnBatchToDb(updatedBatch);

    await Promise.all([
      safeSupabaseWrite('return_batches', 'update', batchRow, { column: 'id', value: batchId }),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('BATCH_UPDATED', {
      batchId,
      batch: updatedBatch,
      allBatches: allUpdatedBatches,
      log: createdLog,
    });
  },

  // Delete return batch and its associated scanned items
  async deleteBatch(
    batchId: string,
    allUpdatedBatches: ReturnBatch[],
    allUpdatedItems: ScannedReturnItem[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveReturnBatches(allUpdatedBatches, false);
    StorageService.saveScannedItems(allUpdatedItems, false);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    await Promise.all([
      safeSupabaseWrite('scanned_return_items', 'delete', { batch_id: batchId }, { column: 'batch_id', value: batchId }),
      safeSupabaseWrite('return_batches', 'delete', { id: batchId }, { column: 'id', value: batchId }),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('BATCH_DELETED', {
      batchId,
      allBatches: allUpdatedBatches,
      allScannedItems: allUpdatedItems,
      log: createdLog,
    });
  },

  // Gate entry create
  async createGateEntry(
    newEntry: InwardGateEntry,
    allUpdatedEntries: InwardGateEntry[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveGateEntries(allUpdatedEntries);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    const entryRow = mapGateEntryToDb(newEntry);

    await Promise.all([
      safeSupabaseWrite('inward_gate_entries', 'insert', entryRow),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('GATE_ENTRY_CREATED', {
      entry: newEntry,
      allGateEntries: allUpdatedEntries,
      log: createdLog,
    });
  },

  // Gate entry update
  async updateGateEntry(
    id: string,
    updatedEntry: InwardGateEntry,
    allUpdatedEntries: InwardGateEntry[],
    logData?: Omit<ActivityLog, 'id' | 'timestamp'>
  ): Promise<void> {
    StorageService.saveGateEntries(allUpdatedEntries);

    let createdLog: ActivityLog | undefined;
    if (logData) {
      createdLog = StorageService.addActivityLog(logData);
    }

    const entryRow = mapGateEntryToDb(updatedEntry);

    await Promise.all([
      safeSupabaseWrite('inward_gate_entries', 'update', entryRow, { column: 'id', value: id }),
      createdLog ? safeSupabaseWrite('activity_logs', 'insert', mapActivityLogToDb(createdLog)) : Promise.resolve(),
    ]);

    SyncService.broadcast('GATE_ENTRY_UPDATED', {
      id,
      entry: updatedEntry,
      allGateEntries: allUpdatedEntries,
      log: createdLog,
    });
  },
};
