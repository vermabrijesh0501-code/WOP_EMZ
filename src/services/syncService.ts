import { supabase, isSupabaseConfigured } from './supabase';
import { pollIntervalMs } from './masterSync';

export type SyncEventType =
  | 'SYNC_ALL'
  | 'STORAGE_SYNC'
  | 'ITEM_SCANNED'
  | 'ITEM_UPDATED'
  | 'ITEM_DELETED'
  | 'BATCH_CREATED'
  | 'BATCH_UPDATED'
  | 'BATCH_CLOSED'
  | 'BATCH_DELETED'
  | 'GATE_ENTRY_CREATED'
  | 'GATE_ENTRY_UPDATED'
  | 'GATE_ENTRY_DELETED'
  | 'DEVICE_HEARTBEAT'
  | 'DEVICE_LOGIN'
  | 'DEVICE_LOGOUT'
  | 'DEVICE_SESSION_UPDATED'
  | 'DEVICES_UPDATED'
  | 'USER_UPDATED'
  | 'MASTERS_UPDATED'
  | 'ACTIVITY_LOG_ADDED';

export interface SyncMessage {
  type: SyncEventType;
  payload?: any;
  timestamp: string;
  senderId?: string;
}

export interface ConnectedDeviceInfo {
  id: string;
  userId?: string;
  userName: string;
  userRole: string;
  userEmail?: string;
  warehouseId?: string;
  warehouseName?: string;
  deviceType: 'Desktop' | 'Mobile / Scanner' | 'Tablet';
  deviceName: string;
  browserInfo?: string;
  ipAddress?: string;
  loginTime: string;
  lastActiveAt: string;
  status: 'Online' | 'Idle' | 'Offline';
}

export interface SyncStatus {
  status: 'connected' | 'connecting' | 'offline';
  connectedDevicesCount: number;
  connectedDevices: ConnectedDeviceInfo[];
  lastSyncedAt: string;
  latencyMs: number;
  currentDeviceId: string;
  deviceType: 'Desktop' | 'Mobile / Scanner' | 'Tablet';
  deviceName: string;
  /** false once /api/sync/* is judged absent (static hosting) */
  serverApiAvailable: boolean;
  /** health of the Supabase realtime channel (the static-hosting sync path) */
  supabaseRealtimeState: 'none' | 'subscribed' | 'failed';
}

type SyncCallback = (msg: SyncMessage) => void;
type StatusCallback = (status: SyncStatus) => void;

class RealtimeSyncManager {
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private subscribers: Set<SyncCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private supabaseChannel: any = null;

  private currentDeviceId: string = '';
  private deviceName: string = '';
  private deviceType: 'Desktop' | 'Mobile / Scanner' | 'Tablet' = 'Desktop';
  private userName: string = 'Operator';
  private userRole: string = 'Super Admin';
  private warehouseId: string = 'wh-main';

  private wsReconnectTimer: any = null;
  private pingTimer: any = null;
  private pollTimer: any = null;
  private lastSeenStoreVersion: string = '';
  private pingSentTime: number = 0;
  private latencyMs: number = 0;

  private connectionStatus: 'connected' | 'connecting' | 'offline' = 'connecting';
  private connectedDevices: ConnectedDeviceInfo[] = [];
  private lastSyncedAt: string = new Date().toISOString();
  private isOnline: boolean = true;

  // --- Backoff / status tracking ---
  private wsFailures: number = 0;
  private pollFailures: number = 0;
  private serverApiAvailable: boolean = true;
  private supabaseRealtimeState: 'none' | 'subscribed' | 'failed' = 'none';

  private isBroadcasting: boolean = false;
  private isNotifying: boolean = false;
  private pendingMessages: SyncMessage[] = [];
  private isStatusChangePending: boolean = false;

  constructor() {
    this.currentDeviceId = this.getOrCreateDeviceId();
    this.detectDeviceMetadata();
    this.initBroadcastChannel();
    this.initStorageEventListener();
    this.initNetworkListeners();
    this.connectWebSocket();
    this.initSupabaseRealtime();
    this.startPingLoop();
    this.startPollFallback();
  }

  public getDeviceId(): string {
    return this.currentDeviceId;
  }

  private detectDeviceMetadata() {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 1024;
    const isTablet = /(iPad|Tablet|(Android(?!.*Mobile)))/i.test(ua) || (window.innerWidth >= 768 && window.innerWidth <= 1024);

    if (isTablet) {
      this.deviceType = 'Tablet';
      this.deviceName = 'Tablet App';
    } else if (isMobile) {
      this.deviceType = 'Mobile / Scanner';
      this.deviceName = /iPhone/i.test(ua) ? 'iPhone (Mobile App)' : /Android/i.test(ua) ? 'Android (Mobile App)' : 'Phone App';
    } else {
      this.deviceType = 'Desktop';
      this.deviceName = /Mac/i.test(ua) ? 'Mac (System App)' : /Windows/i.test(ua) ? 'PC (System App)' : 'System App (Desktop)';
    }
  }

  public updateUserInfo(userName: string, userRole: string, warehouseId: string = 'wh-main') {
    this.userName = userName;
    this.userRole = userRole;
    this.warehouseId = warehouseId;
    this.sendDeviceRegistration();
  }

  private getOrCreateDeviceId(): string {
    try {
      if (typeof window === 'undefined') return 'device-server';
      let id = localStorage.getItem('emiza_device_unique_id');
      if (!id) {
        id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
        localStorage.setItem('emiza_device_unique_id', id);
      }
      return id;
    } catch {
      return `dev-${Date.now()}`;
    }
  }

  // --- WebSocket Setup ---
  private connectWebSocket() {
    if (typeof window === 'undefined') return;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.connectionStatus = 'connecting';
      this.emitStatusChange();

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Healthy connection — reset backoff & server-API state.
        this.wsFailures = 0;
        this.serverApiAvailable = true;
        this.connectionStatus = 'connected';
        this.lastSyncedAt = new Date().toISOString();
        this.sendDeviceRegistration();
        this.emitStatusChange();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'PONG') {
            if (this.pingSentTime > 0) {
              this.latencyMs = Math.max(1, Date.now() - this.pingSentTime);
              this.emitStatusChange();
            }
            return;
          }

          if (data.type === 'DEVICES_UPDATED') {
            if (Array.isArray(data.payload)) {
              this.connectedDevices = data.payload;
              this.emitStatusChange();
            }
            return;
          }

          if (data.type === 'INIT_STATE') {
            if (data.payload?.activeDevices) {
              this.connectedDevices = data.payload.activeDevices;
            }
            if (data.payload?.store?.lastUpdated) {
              this.lastSeenStoreVersion = data.payload.store.lastUpdated;
            }
            this.lastSyncedAt = new Date().toISOString();
            this.emitStatusChange();

            // Notify subscribers with INIT/SYNC_ALL state
            this.notifySubscribers({
              type: 'SYNC_ALL',
              payload: data.payload?.store || data.payload,
              timestamp: new Date().toISOString(),
              senderId: 'server-init',
            });
            return;
          }

          // Inbound mutation event from server
          if (data.senderId !== this.currentDeviceId) {
            this.lastSyncedAt = new Date().toISOString();
            this.emitStatusChange();
            this.notifySubscribers(data);
          }
        } catch (err) {
          console.warn('[SyncService] Failed parsing WS message:', err);
        }
      };

      this.ws.onclose = () => {
        this.connectionStatus = 'offline';
        this.emitStatusChange();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.connectionStatus = 'offline';
        this.emitStatusChange();
      };
    } catch (err) {
      console.warn('[SyncService] WS connection failed, will retry:', err);
      this.connectionStatus = 'offline';
      this.emitStatusChange();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    clearTimeout(this.wsReconnectTimer);
    if (!this.isOnline) return;
    this.wsFailures += 1;
    // Linear backoff capped at 30s (2.5s, 5s, 7.5s, ... 30s)
    const delay = Math.min(2500 * this.wsFailures, 30000);
    this.wsReconnectTimer = setTimeout(() => {
      if (this.isOnline) {
        this.connectWebSocket();
      }
    }, delay);
  }

  // --- REST Polling Fallback (keeps realtime sync alive when WebSocket is
  // blocked, e.g. mobile networks/proxies that kill WS).
  // The interval is backoff-driven via pollIntervalMs(pollFailures): fast while
  // healthy, slower as failures accumulate, and null (stop entirely) once the
  // /api/sync/* endpoints are judged absent — i.e. static hosting with no sync
  // server, where Supabase realtime is the only shared backend. ---
  private startPollFallback() {
    if (typeof window === 'undefined') return;
    clearTimeout(this.pollTimer);
    this.schedulePollTick();
  }

  private schedulePollTick() {
    const interval = pollIntervalMs(this.pollFailures);
    if (interval === null) {
      // Endpoint absent (static host — no /api/sync/*) — stop hammering.
      this.serverApiAvailable = false;
      this.emitStatusChange();
      return;
    }
    this.pollTimer = setTimeout(async () => {
      // Only needed when the WebSocket is not healthy
      if (!(this.ws && this.ws.readyState === WebSocket.OPEN)) {
        await this.runPollOnce();
      }
      this.schedulePollTick();
    }, interval);
  }

  private async runPollOnce() {
    try {
      // 1. Presence heartbeat via REST so other devices still see this device
      fetch('/api/sync/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.currentDeviceId,
          deviceType: this.deviceType,
          deviceName: this.deviceName,
          userName: this.userName,
          userRole: this.userRole,
          warehouseId: this.warehouseId,
        }),
      }).catch(() => {});

      // 2. Cheap version check — full sync only when the server store changed.
      //    Non-JSON responses (a static host 404s with HTML) count as failures.
      const res = await fetch('/api/sync/version');
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok || !json || typeof json.lastUpdated !== 'string') {
        this.pollFailures += 1;
        if (this.pollFailures >= 3 && this.serverApiAvailable) {
          this.serverApiAvailable = false;
          this.emitStatusChange();
        }
        return;
      }
      // Healthy response — recover backoff / API-availability state.
      if (this.pollFailures > 0 || !this.serverApiAvailable) {
        this.pollFailures = 0;
        this.serverApiAvailable = true;
        this.emitStatusChange();
      }
      if (json.lastUpdated !== this.lastSeenStoreVersion) {
        const isFirstRun = this.lastSeenStoreVersion === '';
        this.lastSeenStoreVersion = json.lastUpdated;
        if (!isFirstRun || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          await this.forceSyncNow();
        }
      }
    } catch {
      // offline — retry on next tick
      this.pollFailures += 1;
      if (this.pollFailures >= 3 && this.serverApiAvailable) {
        this.serverApiAvailable = false;
        this.emitStatusChange();
      }
    }
  }

  private sendDeviceRegistration() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'REGISTER_DEVICE',
          payload: {
            deviceId: this.currentDeviceId,
            deviceName: this.deviceName,
            deviceType: this.deviceType,
            userName: this.userName,
            userRole: this.userRole,
            warehouseId: this.warehouseId,
          },
          senderId: this.currentDeviceId,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // ignore
    }
  }

  private startPingLoop() {
    if (typeof window === 'undefined') return;
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingSentTime = Date.now();
        try {
          this.ws.send(JSON.stringify({ type: 'PING' }));
        } catch {
          // ignore
        }
      }
    }, 12000);
  }

  // --- Local BroadcastChannel & Fallbacks ---
  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('emiza_wop_realtime_sync');
        this.broadcastChannel.onmessage = (event: MessageEvent<SyncMessage>) => {
          if (event.data && event.data.senderId !== this.currentDeviceId) {
            this.notifySubscribers(event.data);
          }
        };
      }
    } catch (err) {
      console.warn('[SyncService] BroadcastChannel unavailable', err);
    }
  }

  private initStorageEventListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key && event.key.startsWith('emiza_')) {
          this.notifySubscribers({
            type: 'STORAGE_SYNC',
            payload: { key: event.key },
            timestamp: new Date().toISOString(),
            senderId: 'storage-event',
          });
        }
      });
    }
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.wsFailures = 0; // network back — start reconnect backoff fresh
      this.connectWebSocket();
      this.initSupabaseRealtime();
      this.forceSyncNow();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.connectionStatus = 'offline';
      this.emitStatusChange();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.connectWebSocket();
        }
        this.forceSyncNow();
      }
    });
  }

  public initSupabaseRealtime() {
    if (!isSupabaseConfigured()) return;
    try {
      if (this.supabaseChannel) {
        try {
          supabase.removeChannel(this.supabaseChannel);
        } catch {
          // ignore
        }
      }

      this.supabaseChannel = supabase
        .channel('emiza_warehouse_live_sync', {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'warehouse_update' }, ({ payload }) => {
          if (payload && payload.senderId !== this.currentDeviceId) {
            this.notifySubscribers(payload);
          }
        })
        .subscribe((status: string) => {
          // Track the realtime subscription health (v1 uppercase / v2 lowercase)
          const s = String(status || '').toUpperCase();
          if (s === 'SUBSCRIBED') {
            this.supabaseRealtimeState = 'subscribed';
          } else if (s === 'CHANNEL_ERROR' || s === 'ERRORED' || s === 'TIMED_OUT' || s === 'CLOSED') {
            this.supabaseRealtimeState = 'failed';
          }
          this.emitStatusChange();
        });
    } catch (e) {
      console.warn('[SyncService] Supabase Realtime subscription error:', e);
    }
  }

  public ensureSupabaseRealtime() {
    if (!this.supabaseChannel || this.supabaseRealtimeState !== 'subscribed') {
      this.initSupabaseRealtime();
    }
  }

  // --- Broadcasting Mutations ---
  public broadcast(type: SyncEventType, payload?: any) {
    if (this.isBroadcasting) {
      return;
    }
    this.isBroadcasting = true;
    try {
      const msg: SyncMessage = {
        type,
        payload,
        timestamp: new Date().toISOString(),
        senderId: this.currentDeviceId,
      };

      this.lastSyncedAt = msg.timestamp;
      this.emitStatusChange();

      // 1. Broadcast over WebSocket (Real-Time Sub-20ms to all other devices)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(msg));
        } catch (err) {
          console.warn('[SyncService] Error sending via WebSocket:', err);
        }
      }

      // 2. REST persist & sync — always post mutation to server backend
      // so disk persistence (.data/sync-store.json) is guaranteed instantly,
      // even on mobile HHD when WebSocket is sleeping or reconnecting.
      try {
        fetch('/api/sync/mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        }).catch(() => {
          // Safe failover if offline
        });
      } catch {
        // ignore
      }

      // 3. Broadcast to local tabs via BroadcastChannel
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage(msg);
        } catch (err) {
          console.warn('[SyncService] Error posting to BroadcastChannel:', err);
        }
      }

      // 4. Broadcast to Supabase if configured
      if (isSupabaseConfigured() && this.supabaseChannel) {
        try {
          this.supabaseChannel.send({
            type: 'broadcast',
            event: 'warehouse_update',
            payload: msg,
          });
        } catch {
          // ignore
        }
      }
    } finally {
      this.isBroadcasting = false;
    }
  }

  // --- Force Manual Sync ---
  public async forceSyncNow(): Promise<boolean> {
    try {
      this.connectionStatus = 'connecting';
      this.emitStatusChange();

      const res = await fetch('/api/sync/state');
      if (!res.ok) throw new Error('Failed to fetch server state');
      const json = await res.json();

      if (json.data) {
        this.lastSyncedAt = new Date().toISOString();
        if (json.data.lastUpdated) {
          this.lastSeenStoreVersion = json.data.lastUpdated;
        }
        this.connectionStatus = this.ws && this.ws.readyState === WebSocket.OPEN ? 'connected' : 'connected';
        if (Array.isArray(json.activeDevices)) {
          this.connectedDevices = json.activeDevices;
        }
        this.emitStatusChange();

        this.notifySubscribers({
          type: 'SYNC_ALL',
          payload: json.data,
          timestamp: this.lastSyncedAt,
          senderId: 'force-sync',
        });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[SyncService] Force sync failed:', err);
      this.connectionStatus = 'offline';
      this.emitStatusChange();
      return false;
    }
  }

  // --- Status & Subscription Management ---
  public getSyncStatus(): SyncStatus {
    const activeCount = this.connectedDevices.length > 0 ? this.connectedDevices.length : 1;
    // On static hosting there is no WS server — a healthy Supabase realtime
    // subscription IS the connected sync path. Without this the UI gets stuck
    // on "Syncing…" forever even though master data is syncing through the cloud.
    const wsOpen = !!this.ws && this.ws.readyState === WebSocket.OPEN;
    const status: SyncStatus['status'] =
      wsOpen || this.supabaseRealtimeState === 'subscribed' ? 'connected' : this.connectionStatus;
    return {
      status,
      connectedDevicesCount: activeCount,
      connectedDevices: this.connectedDevices,
      lastSyncedAt: this.lastSyncedAt,
      latencyMs: this.latencyMs,
      currentDeviceId: this.currentDeviceId,
      deviceType: this.deviceType,
      deviceName: this.deviceName,
      serverApiAvailable: this.serverApiAvailable,
      supabaseRealtimeState: this.supabaseRealtimeState,
    };
  }

  public onSyncStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    // Defer initial status notification to microtask to prevent setState during render
    queueMicrotask(() => {
      try {
        if (this.statusListeners.has(callback)) {
          callback(this.getSyncStatus());
        }
      } catch (err) {
        console.error('[SyncService] Error in initial status listener callback:', err);
      }
    });
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private emitStatusChange() {
    if (this.isStatusChangePending) return;
    this.isStatusChangePending = true;

    // Asynchronously notify listeners in a microtask so that:
    // 1) React component render phases are never interrupted by foreign setState calls
    // 2) Rapid successive status changes are cleanly coalesced into a single update
    queueMicrotask(() => {
      this.isStatusChangePending = false;
      const status = this.getSyncStatus();
      this.statusListeners.forEach((cb) => {
        try {
          cb(status);
        } catch (err) {
          console.error('[SyncService] Error in status listener callback:', err);
        }
      });
    });
  }

  public subscribe(callback: SyncCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers(msg: SyncMessage) {
    this.pendingMessages.push(msg);
    if (this.isNotifying) return;
    this.isNotifying = true;

    // Asynchronously flush queued messages in a microtask loop.
    // This completely prevents recursion stack overflow ("Maximum call stack size exceeded").
    queueMicrotask(() => {
      try {
        while (this.pendingMessages.length > 0) {
          const nextMsg = this.pendingMessages.shift();
          if (!nextMsg) continue;
          this.subscribers.forEach((cb) => {
            try {
              cb(nextMsg);
            } catch (e) {
              console.error('[SyncService] Error in subscriber callback:', e);
            }
          });
        }
      } finally {
        this.isNotifying = false;
      }
    });
  }
}

export const SyncService = new RealtimeSyncManager();
