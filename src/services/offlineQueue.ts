import { getSupabase } from './supabase';

export interface QueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  payload: any;
  filter?: { column: string; value: any };
  attempts: number;
  timestamp: string;
  lastError?: string;
}

const QUEUE_STORAGE_KEY = 'emiza_offline_queue_v1';
const MAX_ATTEMPTS = 3;

function getQueue(): QueueItem[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('[OfflineQueue] Failed to load queue:', err);
    return [];
  }
}

function saveQueue(queue: QueueItem[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[OfflineQueue] Failed to save queue:', err);
  }
}

export const OfflineQueue = {
  enqueue(item: Omit<QueueItem, 'id' | 'attempts' | 'timestamp'>): QueueItem {
    const queue = getQueue();
    const newItem: QueueItem = {
      ...item,
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      attempts: 0,
      timestamp: new Date().toISOString(),
    };
    queue.push(newItem);
    saveQueue(queue);
    console.log(`[OfflineQueue] Enqueued operation for table '${item.table}'. Current size: ${queue.length}`);
    return newItem;
  },

  getAll(): QueueItem[] {
    return getQueue();
  },

  size(): number {
    return getQueue().length;
  },

  remove(id: string): void {
    const queue = getQueue().filter(q => q.id !== id);
    saveQueue(queue);
  },

  clear(): void {
    saveQueue([]);
  },

  async flush(): Promise<{ succeeded: number; failed: number; dropped: number }> {
    const sb = getSupabase();
    if (!sb) {
      return { succeeded: 0, failed: 0, dropped: 0 };
    }

    const queue = getQueue();
    if (queue.length === 0) {
      return { succeeded: 0, failed: 0, dropped: 0 };
    }

    let succeeded = 0;
    let failed = 0;
    let dropped = 0;
    const remaining: QueueItem[] = [];

    for (const item of queue) {
      try {
        let query: any;
        if (item.operation === 'insert') {
          query = sb.from(item.table).insert(item.payload);
        } else if (item.operation === 'upsert') {
          query = sb.from(item.table).upsert(item.payload, { onConflict: 'id' });
        } else if (item.operation === 'update') {
          if (!item.filter) {
            query = sb.from(item.table).update(item.payload).eq('id', item.payload.id);
          } else {
            query = sb.from(item.table).update(item.payload).eq(item.filter.column, item.filter.value);
          }
        } else if (item.operation === 'delete') {
          if (!item.filter) {
            query = sb.from(item.table).delete().eq('id', item.payload.id || item.payload);
          } else {
            query = sb.from(item.table).delete().eq(item.filter.column, item.filter.value);
          }
        }

        const { error } = await query;
        if (error) {
          throw error;
        }

        succeeded++;
      } catch (err: any) {
        failed++;
        item.attempts += 1;
        item.lastError = err?.message || 'Unknown database write error';

        if (item.attempts < MAX_ATTEMPTS) {
          remaining.push(item);
        } else {
          dropped++;
          console.warn(`[OfflineQueue] Dropping item from table '${item.table}' after ${MAX_ATTEMPTS} failed attempts:`, item.lastError);
        }
      }
    }

    saveQueue(remaining);
    return { succeeded, failed, dropped };
  },
};

// Listen for browser online event to automatically flush queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Connection restored. Flushing pending queue...');
    OfflineQueue.flush().then(res => {
      if (res.succeeded > 0 || res.dropped > 0) {
        console.log(`[OfflineQueue] Auto-flush completed: ${res.succeeded} succeeded, ${res.dropped} dropped.`);
      }
    });
  });
}
