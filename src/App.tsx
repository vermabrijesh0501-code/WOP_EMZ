import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  ScanLine,
  BarChart3,
} from 'lucide-react';
import {
  User,
  UserRole,
  InwardGateEntry,
  ReturnBatch,
  ScannedReturnItem,
  ReturnRemarkType,
  SupabaseConfig,
  Phase1SecurityData,
  Phase2UnloadingData,
  Phase3HandoverData,
} from './types';
import { StorageService, mergeBatches, mergeScannedItems } from './services/storage';
import { SyncService } from './services/syncService';
import { startRealtimeSync } from './services/realtimeSync';
import { DBService } from './services/dbService';
import {
  pullAndMergeMasters,
  subscribeMasterChanges,
  applyMasterChange,
} from './services/masterSync';
import { isSupabaseConfigured } from './services/supabase';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { PublicRoute } from './components/auth/PublicRoute';
import { ForcedPasswordChangeModal } from './components/auth/ForcedPasswordChangeModal';
import { useAuth } from './context/AuthContext';
import { getAccessibleModules } from './utils/rbac';

// --- Performance: code-split heavy modules (React.lazy) ---
// These load on demand, so the login page and initial refresh stay lightweight.
const DashboardView = React.lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const InwardModule = React.lazy(() => import('./components/InwardModule').then(m => ({ default: m.InwardModule })));
const ReturnsModule = React.lazy(() => import('./components/ReturnsModule').then(m => ({ default: m.ReturnsModule })));
const MastersModule = React.lazy(() => import('./components/MastersModule').then(m => ({ default: m.MastersModule })));
const ReportsModule = React.lazy(() => import('./components/ReportsModule').then(m => ({ default: m.ReportsModule })));
const UserManagementPage = React.lazy(() => import('./components/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const UniversalSearchModal = React.lazy(() => import('./components/UniversalSearchModal').then(m => ({ default: m.UniversalSearchModal })));

// Lightweight loading placeholder shown while a lazy module chunk downloads
const ModuleFallback = () => (
  <div className="flex flex-col items-center justify-center py-24 text-secondary">
    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 animate-pulse">
      <div className="w-full h-full bg-surface rounded-[7px]" />
    </div>
    <span className="mt-3 text-xs text-muted">Loading module…</span>
  </div>
);

// Tab to URL Route Path helper
const tabToPath = (tab: ActiveTab): string => {
  switch (tab) {
    case 'dashboard':
      return '/dashboard';
    case 'inward':
      return '/inward';
    case 'grn':
      return '/grn';
    case 'returns_rto':
      return '/returns/rto';
    case 'returns_b2b':
      return '/returns/b2b';
    case 'clients':
      return '/clients';
    case 'couriers':
      return '/couriers';
    case 'locations':
      return '/locations';
    case 'reports':
      return '/reports';
    case 'notifications':
      return '/notifications';
    case 'user_management':
      return '/user-management';
    case 'masters':
      return '/masters';
    default:
      return '/dashboard';
  }
};

// URL Route Path to Tab helper
const pathToTab = (pathname: string): ActiveTab => {
  const normalized = pathname.toLowerCase().replace(/\/$/, '');
  if (normalized === '/inward') return 'inward';
  if (normalized === '/grn') return 'grn';
  if (normalized === '/returns' || normalized === '/returns/rto' || normalized === '/returns-rto' || normalized === '/rto') return 'returns_rto';
  if (normalized === '/returns/b2b' || normalized === '/returns-b2b' || normalized === '/b2b') return 'returns_b2b';
  if (normalized === '/clients') return 'clients';
  if (normalized === '/couriers') return 'couriers';
  if (normalized === '/locations') return 'locations';
  if (normalized === '/reports') return 'reports';
  if (normalized === '/notifications') return 'notifications';
  if (normalized === '/user-management' || normalized === '/users') return 'user_management';
  if (normalized === '/masters') return 'masters';
  return 'dashboard';
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appUser, signOut, updatePassword } = useAuth();

  // Navigation & View State derived from URL
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => pathToTab(location.pathname));

  // Master State
  const [companies, setCompanies] = useState(StorageService.getCompanies());
  const [warehouses, setWarehouses] = useState(StorageService.getWarehouses());
  const [clients, setClients] = useState(StorageService.getClients());
  const [couriers, setCouriers] = useState(StorageService.getCouriers());
  const [skus, setSKUs] = useState(StorageService.getSKUs());
  const [drivers, setDrivers] = useState(StorageService.getDrivers());
  const [vehicleTypes, setVehicleTypes] = useState(StorageService.getVehicleTypes());
  const [returnReasons, setReturnReasons] = useState(StorageService.getReturnReasons());
  const [users, setUsers] = useState(StorageService.getUsers());

  // Active Session & Operating Warehouse
  const currentUser: User = appUser || StorageService.getCurrentUser();
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>(StorageService.getCurrentWarehouseId());

  // Operations State
  const [gateEntries, setGateEntries] = useState<InwardGateEntry[]>(StorageService.getGateEntries());
  const [batches, setBatches] = useState<ReturnBatch[]>(StorageService.getReturnBatches());
  const [scannedItems, setScannedItems] = useState<ScannedReturnItem[]>(StorageService.getScannedItems());
  const [logs, setLogs] = useState(StorageService.getActivityLogs());
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(StorageService.getSupabaseConfig());

  // Modal Controls
  const [isNewGateEntryModalOpen, setIsNewGateEntryModalOpen] = useState(false);
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [isUniversalSearchOpen, setIsUniversalSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Responsive Mobile Detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync activeTab when URL pathname changes
  useEffect(() => {
    if (location.pathname !== '/login') {
      const derived = pathToTab(location.pathname);
      setActiveTabState(derived);
    }
  }, [location.pathname]);

  // Fetch initial cloud/server state with bidirectional merge.
  // Fetch initial cloud/server state with bidirectional merge.
  // Runs immediately on mount so mobile HHD and laptop always hydrate
  // without losing batches or data on refresh, and runs when user logs in.
  // Also never parse non-JSON responses — static hosts return index.html for /api/* paths.
  const currentUserId = appUser?.id || currentUser?.id || null;
  const initialLoadDone = useRef(false);
  const lastLoadedUserId = useRef<string | null>(null);

  const syncCentralState = useCallback(() => {
    fetch('/api/sync/state')
      .then(res => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error(`Non-JSON response (${res.status}) — no sync server on this host`);
        }
        return res.json();
      })
      .then(json => {
        if (json?.data) {
          const merged = StorageService.applyRemoteStore(json.data);
          if (merged?.batches) setBatches(merged.batches);
          if (merged?.scannedItems) setScannedItems(merged.scannedItems);
          if (merged?.gateEntries) setGateEntries(merged.gateEntries);
          if (Array.isArray(json.data.companies)) setCompanies(json.data.companies);
          if (Array.isArray(json.data.warehouses)) setWarehouses(json.data.warehouses);
          if (Array.isArray(json.data.clients)) setClients(json.data.clients);
          if (Array.isArray(json.data.couriers)) setCouriers(json.data.couriers);
          if (Array.isArray(json.data.skus)) setSKUs(json.data.skus);
          if (Array.isArray(json.data.drivers)) setDrivers(json.data.drivers);
          if (Array.isArray(json.data.vehicleTypes)) setVehicleTypes(json.data.vehicleTypes);
          if (Array.isArray(json.data.returnReasons)) setReturnReasons(json.data.returnReasons);
          if (Array.isArray(json.data.users)) setUsers(json.data.users);
          if (Array.isArray(json.data.activityLogs)) setLogs(json.data.activityLogs);

          // If local client had more data than remote server, re-hydrate server
          const localBatchesCount = merged.batches.length;
          const serverBatchesCount = Array.isArray(json.data.batches) ? json.data.batches.length : 0;
          const localScansCount = merged.scannedItems.length;
          const serverScansCount = Array.isArray(json.data.scannedItems) ? json.data.scannedItems.length : 0;
          if (localBatchesCount > serverBatchesCount || localScansCount > serverScansCount) {
            fetch('/api/sync/mutate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'SYNC_ALL',
                payload: {
                  allBatches: merged.batches,
                  allScannedItems: merged.scannedItems,
                  allGateEntries: merged.gateEntries,
                },
              }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {
        DBService.fetchAllData().then(data => {
          if (data.batches && data.batches.length > 0) {
            setBatches(prev => mergeBatches(prev, data.batches));
          }
          if (data.scannedItems && data.scannedItems.length > 0) {
            setScannedItems(prev => mergeScannedItems(prev, data.scannedItems));
          }
          if (data.gateEntries && data.gateEntries.length > 0) setGateEntries(data.gateEntries);
          if (data.logs && data.logs.length > 0) setLogs(data.logs);
        });
      });
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      syncCentralState();
    }
    if (currentUserId && lastLoadedUserId.current !== currentUserId) {
      lastLoadedUserId.current = currentUserId;
      syncCentralState();
    }
  }, [currentUserId, syncCentralState]);

  const refreshMastersFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const merged = await pullAndMergeMasters();
      if (!merged) return;
      if (Array.isArray(merged.companies)) setCompanies(merged.companies);
      if (Array.isArray(merged.warehouses)) setWarehouses(merged.warehouses);
      if (Array.isArray(merged.clients)) setClients(merged.clients);
      if (Array.isArray(merged.couriers)) setCouriers(merged.couriers);
      if (Array.isArray(merged.skus)) setSKUs(merged.skus);
      if (Array.isArray(merged.drivers)) setDrivers(merged.drivers);
      if (Array.isArray(merged.vehicleTypes)) setVehicleTypes(merged.vehicleTypes);
      if (Array.isArray(merged.returnReasons)) setReturnReasons(merged.returnReasons);
      if (Array.isArray(merged.users)) setUsers(merged.users);
    } catch (err) {
      console.warn('[App] Master sync pull failed:', err);
    }
  }, []);

  // Keep device registration updated on user or warehouse change & pull fresh cloud masters
  useEffect(() => {
    if (currentUser) {
      SyncService.updateUserInfo(currentUser.name, currentUser.role, activeWarehouseId);
      SyncService.ensureSupabaseRealtime();
      refreshMastersFromCloud();
    }
  }, [currentUser, activeWarehouseId, refreshMastersFromCloud]);

  // Real-time Supabase postgres synchronization
  useEffect(() => {
    const cleanup = startRealtimeSync();
    return cleanup;
  }, []);

  // Cloud master-data sync (Supabase `master_records` is the shared backend —
  // on static hosting there is no /api/sync/* server, so master records must
  // sync through the cloud):
  //   1. initial pull + LWW merge into local lists -> setState
  //   2. live subscription: apply single-record changes from other devices in realtime
  //   3. lifecycle & reconnect auto-pulls (visibilitychange, online, focus, interval)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    // Initial pull
    refreshMastersFromCloud();

    const unsub = subscribeMasterChanges((category, recId, data, event) => {
      if (cancelled) return;
      const apply = (setter: (fn: (prev: any[]) => any[]) => void) => {
        setter(prev => {
          const next = applyMasterChange(prev, recId, data, event);
          StorageService.applyMasterUpdate(category, next);
          return next;
        });
      };
      switch (category) {
        case 'companies': apply(setCompanies); break;
        case 'warehouses': apply(setWarehouses); break;
        case 'clients': apply(setClients); break;
        case 'couriers': apply(setCouriers); break;
        case 'skus': apply(setSKUs); break;
        case 'drivers': apply(setDrivers); break;
        case 'vehicle_types': apply(setVehicleTypes); break;
        case 'return_reasons': apply(setReturnReasons); break;
        case 'users': apply(setUsers); break;
      }
    });

    const handleSyncTrigger = () => {
      if (document.visibilityState === 'visible') {
        refreshMastersFromCloud();
      }
    };
    const handleOnline = () => {
      refreshMastersFromCloud();
      SyncService.ensureSupabaseRealtime();
    };

    document.addEventListener('visibilitychange', handleSyncTrigger);
    window.addEventListener('focus', handleSyncTrigger);
    window.addEventListener('online', handleOnline);

    // Periodic auto-pull every 15s to guarantee non-websocket/mobile logins always catch up
    const pollInterval = setInterval(handleSyncTrigger, 15000);

    return () => {
      cancelled = true;
      unsub();
      document.removeEventListener('visibilitychange', handleSyncTrigger);
      window.removeEventListener('focus', handleSyncTrigger);
      window.removeEventListener('online', handleOnline);
      clearInterval(pollInterval);
    };
  }, [refreshMastersFromCloud]);

 // Self-heal master drift: if any batch references a courier/client that this
  // device doesn't know about, pull the full central state — the master was
  // likely created/changed on another device and this list is stale.
  // HARD GUARDS: max 3 attempts, 60s cooldown, and give up permanently for a
  // missing id once two syncs couldn't resolve it (e.g. master was deleted) —
  // otherwise a batch referencing a dead courier id causes an infinite
  // force-sync loop that freezes the page ("Page Unresponsive").
  const mastersHealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mastersHealState = useRef<{ attempts: number; lastAt: number; givenUp: Set<string> }>({ attempts: 0, lastAt: 0, givenUp: new Set() });
  useEffect(() => {
    if (!batches.length) return;
    const unknownIds: string[] = [];
    for (const b of batches) {
      if (b.courierId && !couriers.some(c => c.id === b.courierId) && !b.courierName) unknownIds.push(`courier:${b.courierId}`);
      if (b.clientId && !clients.some(c => c.id === b.clientId) && !b.clientName) unknownIds.push(`client:${b.clientId}`);
    }
    const missing = unknownIds.filter(id => !mastersHealState.current.givenUp.has(id));
    if (missing.length === 0) return;
    const now = Date.now();
    if (now - mastersHealState.current.lastAt < 60000) return; // cooldown
    if (mastersHealState.current.attempts >= 3) {
      // Server state didn't resolve these ids after 3 tries — they no longer
      // exist centrally. Give up (snapshots keep old batches displayable).
      missing.forEach(id => mastersHealState.current.givenUp.add(id));
      mastersHealState.current.attempts = 0;
      return;
    }
    mastersHealState.current.lastAt = now;
    mastersHealState.current.attempts += 1;
    if (mastersHealTimer.current) clearTimeout(mastersHealTimer.current);
    mastersHealTimer.current = setTimeout(async () => {
      const ok = await SyncService.forceSyncNow();
      if (ok) console.info('[App] Masters self-heal sync triggered (batch referenced unknown master record)');
    }, 1500);
  }, [batches, couriers, clients]);

  // Real-time Cross-Device Synchronization Subscriber
  useEffect(() => {
    const unsubscribe = SyncService.subscribe(event => {
      const { type, payload } = event;

      // If full array state is passed in payload, merge safely (silent save to avoid re-broadcast loop)
      if (payload?.allScannedItems) {
        setScannedItems(prev => {
          const merged = mergeScannedItems(prev, payload.allScannedItems);
          StorageService.saveScannedItems(merged, false);
          return merged;
        });
      }
      if (payload?.allBatches) {
        setBatches(prev => {
          const merged = mergeBatches(prev, payload.allBatches);
          StorageService.saveReturnBatches(merged, false);
          return merged;
        });
      }
      if (payload?.allGateEntries) {
        setGateEntries(payload.allGateEntries);
        StorageService.saveGateEntries(payload.allGateEntries, false);
      }
      if (payload?.log) {
        setLogs(prev => [payload.log, ...prev.filter(l => l.id !== payload.log.id)].slice(0, 150));
      }

      switch (type) {
        case 'ITEM_SCANNED': {
          if (payload?.item && !payload?.allScannedItems) {
            setScannedItems(prev => {
              const next = mergeScannedItems(prev, [payload.item]);
              StorageService.saveScannedItems(next, false);
              return next;
            });
            if (payload?.batch) {
              setBatches(prev => {
                const next = mergeBatches(prev, [payload.batch]);
                StorageService.saveReturnBatches(next, false);
                return next;
              });
            }
          }
          break;
        }

        case 'ITEM_UPDATED': {
          if (payload?.item && !payload?.allScannedItems) {
            setScannedItems(prev => {
              const next = prev.map(i => i.id === (payload.itemId || payload.item.id) ? { ...i, ...payload.item } : i);
              StorageService.saveScannedItems(next, false);
              return next;
            });
            if (payload?.batch) {
              setBatches(prev => {
                const next = mergeBatches(prev, [payload.batch]);
                StorageService.saveReturnBatches(next, false);
                return next;
              });
            }
          }
          break;
        }

        case 'ITEM_DELETED': {
          if (payload?.itemId && !payload?.allScannedItems) {
            setScannedItems(prev => {
              const next = prev.filter(i => i.id !== payload.itemId);
              StorageService.saveScannedItems(next, false);
              return next;
            });
            if (payload?.batch) {
              setBatches(prev => {
                const next = mergeBatches(prev, [payload.batch]);
                StorageService.saveReturnBatches(next, false);
                return next;
              });
            }
          }
          break;
        }

        case 'BATCH_CREATED': {
          if (payload?.batch && !payload?.allBatches) {
            setBatches(prev => {
              const next = mergeBatches(prev, [payload.batch]);
              StorageService.saveReturnBatches(next, false);
              return next;
            });
          }
          break;
        }

        case 'BATCH_UPDATED': {
          if (payload?.batch) {
            setBatches(prev => {
              const updated = prev.map(b => (b.id === payload.batch.id || b.batchNumber === payload.batch.batchNumber ? { ...b, ...payload.batch } : b));
              StorageService.saveReturnBatches(updated, false);
              return updated;
            });
          }
          break;
        }

        case 'BATCH_CLOSED': {
          if (payload?.batch && !payload?.allBatches) {
            setBatches(prev => {
              const next = mergeBatches(prev, [payload.batch]);
              StorageService.saveReturnBatches(next, false);
              return next;
            });
          }
          break;
        }

        case 'BATCH_DELETED': {
          if (payload?.batchId) {
            setBatches(prev => {
              const next = prev.filter(b => b.id !== payload.batchId && b.batchNumber !== payload.batchId);
              StorageService.saveReturnBatches(next, false);
              return next;
            });
            setScannedItems(prev => {
              const next = prev.filter(i => i.batchId !== payload.batchId);
              StorageService.saveScannedItems(next, false);
              return next;
            });
          }
          break;
        }

        case 'GATE_ENTRY_CREATED': {
          if (payload?.entry && !payload?.allGateEntries) {
            setGateEntries(prev => {
              if (prev.some(g => g.id === payload.entry.id)) return prev;
              const next = [payload.entry, ...prev];
              StorageService.saveGateEntries(next, false);
              return next;
            });
          }
          break;
        }

        case 'GATE_ENTRY_UPDATED': {
          if (payload?.entry && !payload?.allGateEntries) {
            setGateEntries(prev => {
              const next = prev.map(g => g.id === payload.entry.id ? payload.entry : g);
              StorageService.saveGateEntries(next, false);
              return next;
            });
          }
          break;
        }

        case 'GATE_ENTRY_DELETED': {
          if (payload?.id) {
            setGateEntries(prev => {
              const next = prev.filter(g => g.id !== payload.id);
              StorageService.saveGateEntries(next, false);
              return next;
            });
          }
          break;
        }

        case 'MASTERS_UPDATED': {
          const category = payload?.category;
          const allRecords = payload?.allRecords;
          if (category === 'companies' && allRecords) setCompanies(allRecords);
          else if (category === 'warehouses' && allRecords) setWarehouses(allRecords);
          else if (category === 'clients' && allRecords) setClients(allRecords);
          else if (category === 'couriers' && allRecords) setCouriers(allRecords);
          else if (category === 'skus' && allRecords) setSKUs(allRecords);
          else if (category === 'drivers' && allRecords) setDrivers(allRecords);
          else if (category === 'vehicle_types' && allRecords) setVehicleTypes(allRecords);
          else if (category === 'return_reasons' && allRecords) setReturnReasons(allRecords);
          else if (category === 'users' && allRecords) setUsers(allRecords);
          else {
            setCompanies(StorageService.getCompanies());
            setWarehouses(StorageService.getWarehouses());
            setClients(StorageService.getClients());
            setCouriers(StorageService.getCouriers());
            setSKUs(StorageService.getSKUs());
            setDrivers(StorageService.getDrivers());
            setVehicleTypes(StorageService.getVehicleTypes());
            setReturnReasons(StorageService.getReturnReasons());
            setUsers(StorageService.getUsers());
          }
          // Persist silently so this device's local/offline fallback stays
          // identical to the central master data (no re-broadcast loop).
          if (category && Array.isArray(allRecords)) {
            StorageService.applyMasterUpdate(category, allRecords);
          }
          break;
        }

        case 'ACTIVITY_LOG_ADDED': {
          if (payload?.allLogs) {
            setLogs(payload.allLogs);
          } else if (payload?.log) {
            setLogs(prev => [payload.log, ...prev.filter(l => l.id !== payload.log.id)].slice(0, 150));
          } else {
            setLogs(StorageService.getActivityLogs());
          }
          break;
        }

        case 'USER_UPDATED':
        case 'DEVICE_SESSION_UPDATED':
        case 'DEVICE_HEARTBEAT':
          setUsers(StorageService.getUsers());
          break;

        case 'SYNC_ALL':
        case 'STORAGE_SYNC': {
          if (payload && typeof payload === 'object') {
            const merged = StorageService.applyRemoteStore(payload);
            if (merged?.batches) setBatches(merged.batches);
            if (merged?.scannedItems) setScannedItems(merged.scannedItems);
            if (merged?.gateEntries) setGateEntries(merged.gateEntries);
            if (Array.isArray(payload.companies)) setCompanies(payload.companies);
            if (Array.isArray(payload.warehouses)) setWarehouses(payload.warehouses);
            if (Array.isArray(payload.clients)) setClients(payload.clients);
            if (Array.isArray(payload.couriers)) setCouriers(payload.couriers);
            if (Array.isArray(payload.skus)) setSKUs(payload.skus);
            if (Array.isArray(payload.drivers)) setDrivers(payload.drivers);
            if (Array.isArray(payload.vehicleTypes)) setVehicleTypes(payload.vehicleTypes);
            if (Array.isArray(payload.returnReasons)) setReturnReasons(payload.returnReasons);
            if (Array.isArray(payload.users)) setUsers(payload.users);
            if (Array.isArray(payload.activityLogs)) setLogs(payload.activityLogs);
          } else {
            DBService.fetchAllData().then(data => {
              if (data.batches) setBatches(prev => mergeBatches(prev, data.batches));
              if (data.scannedItems) setScannedItems(prev => mergeScannedItems(prev, data.scannedItems));
              if (data.gateEntries) setGateEntries(data.gateEntries);
              if (data.logs) setLogs(data.logs);
            });
          }
          break;
        }

        default:
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Navigate tab function that updates URL and state
  const handleSelectTab = useCallback(
    (tab: ActiveTab) => {
      setActiveTabState(tab);
      const targetPath = tabToPath(tab);
      if (location.pathname !== targetPath) {
        navigate(targetPath);
      }
    },
    [navigate, location.pathname]
  );

  // Keyboard shortcut Ctrl+K for Universal Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsUniversalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeWarehouse = warehouses.find(w => w.id === activeWarehouseId) || warehouses[0];

  // Role Switcher Persona Helper - Opens User Management for Super Admin
  const handleSwitchUserRole = (_role: UserRole) => {
    if (currentUser?.role === 'Super Admin') {
      handleSelectTab('user_management');
    }
  };

  // Select Operating Warehouse
  const handleSelectWarehouse = (whId: string) => {
    setActiveWarehouseId(whId);
    StorageService.saveCurrentWarehouseId(whId);
  };

  // Add Gate Entry (Phase 01 Security - Inward / B2B Return)
  const handleAddGateEntry = (
    entryData: Omit<InwardGateEntry, 'id' | 'gatePassNumber' | 'entryTime'> & { phase1Data?: Phase1SecurityData }
  ) => {
    const isB2B = entryData.entryType === 'B2B Return';
    const count = gateEntries.length + 1;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = isB2B ? 'B2B' : 'GE';
    const gatePassNumber = `${prefix}-${dateStr}-${String(count).padStart(3, '0')}`;

    const { phase1Data, ...rest } = entryData as any;
    const newEntry: InwardGateEntry = {
      ...rest,
      id: `gate-${Date.now()}`,
      gatePassNumber,
      entryTime: new Date().toISOString(),
      entryType: isB2B ? 'B2B Return' : 'Inward',
      currentPhase: isB2B ? 'Phase 01 - B2B Vehicle Received' : 'Phase 01 - Vehicle Received',
      phase1: phase1Data || {
        gateEntryDateTime: new Date().toLocaleDateString('en-GB') + ' : ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        vehicleNumber: rest.vehicleNumber,
        vehicleTypeId: rest.vehicleTypeId,
        courierId: rest.courierId,
        driverName: rest.driverName,
        driverMobile: rest.driverMobile,
        driverLicense: rest.driverLicense || '',
        clientId: rest.clientId,
        invoiceCount: 1,
        alignedDock: rest.dockNumber || 'Dock 01',
        remarks: rest.remarks,
        createdById: currentUser.id,
        createdByName: currentUser.name,
        createdAt: new Date().toISOString(),
      },
    };

    const updated = [newEntry, ...gateEntries];
    setGateEntries(updated);

    DBService.createGateEntry(newEntry, updated, {
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: isB2B ? 'Registered B2B Return Gate Entry (Phase 01)' : 'Registered Vehicle Gate Entry (Phase 01)',
      module: isB2B ? 'B2B' : 'Inward',
      details: `Created Gate Entry ${gatePassNumber} for ${newEntry.vehicleNumber} (${newEntry.driverName})`,
    });
    setLogs(StorageService.getActivityLogs());
  };

  // Update Gate Status
  const handleUpdateGateStatus = (id: string, status: InwardGateEntry['status'], dockNumber?: string) => {
    let updatedTarget: InwardGateEntry | undefined;
    const updated = gateEntries.map(g => {
      if (g.id === id) {
        updatedTarget = {
          ...g,
          status,
          dockNumber: dockNumber || g.dockNumber,
          dockAllocatedTime: dockNumber ? new Date().toISOString() : g.dockAllocatedTime,
        };
        return updatedTarget;
      }
      return g;
    });

    setGateEntries(updated);

    if (updatedTarget) {
      DBService.updateGateEntry(id, updatedTarget, updated, {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: `Updated Inward Status to ${status}`,
        module: 'Inward',
        details: `${updatedTarget.gatePassNumber || id} updated to ${status} ${dockNumber ? `at ${dockNumber}` : ''}`,
      });
    }
    setLogs(StorageService.getActivityLogs());
  };

  // Update Gate Entry (Phase 02 Unloading & Dock QC)
  const handleUpdateGateEntryPhase2 = (gateEntryId: string, phase2Data: Phase2UnloadingData) => {
    let updatedTarget: InwardGateEntry | undefined;
    const updated = gateEntries.map(g => {
      if (g.id === gateEntryId) {
        updatedTarget = {
          ...g,
          dockNumber: phase2Data.dockConfirmed || g.dockNumber,
          dockAllocatedTime: g.dockAllocatedTime || new Date().toISOString(),
          unloadingEndTime: new Date().toISOString(),
          expectedBoxCount: phase2Data.totalBoxesCount,
          receivedBoxCount: phase2Data.totalBoxesCount,
          status: 'QC Completed',
          currentPhase: 'Phase 02 - Unloading & Dock QC',
          phase2: phase2Data,
        };
        return updatedTarget;
      }
      return g;
    });

    setGateEntries(updated);

    if (updatedTarget) {
      DBService.updateGateEntry(gateEntryId, updatedTarget, updated, {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Completed Dock QC (Phase 02)',
        module: 'Inward',
        details: `${updatedTarget.gatePassNumber} Dock QC completed: ${phase2Data.totalDocketsCount} Dockets, ${phase2Data.totalInvoicesCount} Invoices, ${phase2Data.totalBoxesCount} Boxes (${phase2Data.goodCount} Good, ${phase2Data.damageCount} Damaged)`,
      });
    }
    setLogs(StorageService.getActivityLogs());
  };

  // Update Gate Entry (Phase 03 Handover Taken)
  const handleUpdateGateEntryPhase3 = (gateEntryId: string, phase3Data: Phase3HandoverData) => {
    let updatedTarget: InwardGateEntry | undefined;
    const updated = gateEntries.map(g => {
      if (g.id === gateEntryId) {
        updatedTarget = {
          ...g,
          receivedBoxCount: phase3Data.receivedBoxesConfirmed,
          status: 'Handover Completed',
          currentPhase: 'Phase 03 - Handover Completed',
          handoverCompletedTime: new Date().toISOString(),
          phase3: phase3Data,
        };
        return updatedTarget;
      }
      return g;
    });

    setGateEntries(updated);

    if (updatedTarget) {
      DBService.updateGateEntry(gateEntryId, updatedTarget, updated, {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Completed Custody Handover (Phase 03)',
        module: 'Inward',
        details: `${updatedTarget.gatePassNumber} Handover completed by ${phase3Data.accountInchargeName}: ${phase3Data.receivedBoxesConfirmed} Boxes received (Diff: ${phase3Data.differenceCount})`,
      });
    }
    setLogs(StorageService.getActivityLogs());
  };

  // Add Return Batch (Format: DD-account reference - serial no 0101, e.g. 22-BV-0101)
  const handleAddBatch = (
    batchData: Omit<ReturnBatch, 'id' | 'batchNumber' | 'totalScanned' | 'remarksBreakdown' | 'createdAt'>
  ): ReturnBatch => {
    const today = new Date();
    const dayStr = String(today.getDate()).padStart(2, '0');
    
    // Find client code / reference (e.g. BV, NYK, MME, BOAT, SUG)
    const client = clients.find(c => c.id === batchData.clientId);
    const clientRef = (client?.code || 'ACC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();

    // Calculate next unique serial number for this client (0101, 0102, ...)
    const clientPrefix = `${dayStr}-${clientRef}-`;
    const matchingBatches = batches.filter(b => (b.batchNumber || '').startsWith(clientPrefix));
    let nextNum = 101;
    matchingBatches.forEach(b => {
      const parts = b.batchNumber.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart) && numPart >= nextNum) {
        nextNum = numPart + 1;
      }
    });
    const serialNumber = String(nextNum).padStart(4, '0');
    const batchNumber = `${dayStr}-${clientRef}-${serialNumber}`;

    const newBatch: ReturnBatch = {
      ...batchData,
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      batchNumber,
      totalScanned: 0,
      remarksBreakdown: {
        Good: 0,
        Damage: 0,
        'Open Box': 0,
        'Wrong Product': 0,
        'Short Qty': 0,
        'Missing Product': 0,
        Others: 0,
      },
      createdAt: new Date().toISOString(),
    };

    const updated = mergeBatches(batches, [newBatch]);
    setBatches(updated);

    DBService.createBatch(newBatch, updated, {
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'Initialized Return Batch',
      module: batchData.batchType === 'B2B Return' ? 'B2B' : 'RTO',
      details: `Created batch ${batchNumber} for ${client?.name || clientRef}`,
    });
    setLogs(StorageService.getActivityLogs());

    return newBatch;
  };

  // Barcode Gun Item Scan with Duplicate Check & Cross-Device Live Sync
  const handleScanItem = (
    batchId: string,
    trackingNumber: string,
    remark: ReturnRemarkType,
    photoUrl?: string
  ): { success: boolean; message: string; item?: ScannedReturnItem } => {
    const isDuplicateInBatch = scannedItems.some(
      i => i.batchId === batchId && i.trackingNumber.toUpperCase() === trackingNumber.toUpperCase()
    );

    if (isDuplicateInBatch) {
      return {
        success: false,
        message: `DUPLICATE DETECTED: Barcode ${trackingNumber} was ALREADY scanned in this batch!`,
      };
    }

    const targetBatch = batches.find(b => b.id === batchId);
    if (!targetBatch) return { success: false, message: 'Batch not found.' };

    const newItem: ScannedReturnItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      batchId,
      trackingNumber,
      orderNumber: `ORD-${trackingNumber.slice(-6)}`,
      remark,
      photoUrl,
      scannedAt: new Date().toISOString(),
      scannedBy: currentUser.id,
      scannedByName: currentUser.name,
    };

    const updatedItems = [newItem, ...scannedItems];
    setScannedItems(updatedItems);

    let updatedTargetBatch: ReturnBatch = targetBatch;
    const updatedBatches = batches.map(b => {
      if (b.id === batchId) {
        const newBreakdown = { ...b.remarksBreakdown };
        newBreakdown[remark] = (newBreakdown[remark] || 0) + 1;
        updatedTargetBatch = {
          ...b,
          totalScanned: b.totalScanned + 1,
          remarksBreakdown: newBreakdown,
        };
        return updatedTargetBatch;
      }
      return b;
    });

    setBatches(updatedBatches);

    // Persist to Cloud & Broadcast to all authorized devices
    DBService.recordScanItem(
      newItem,
      updatedTargetBatch,
      updatedItems,
      updatedBatches,
      {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Scanned AWB Barcode',
        module: targetBatch.batchType === 'B2B Return' ? 'B2B' : 'RTO',
        details: `Scanned AWB #${trackingNumber} [${remark}] in ${targetBatch.batchNumber}`,
      }
    );
    setLogs(StorageService.getActivityLogs());

    return {
      success: true,
      message: `SCANNED SUCCESSFULLY: AWB ${trackingNumber} recorded as [${remark}]`,
      item: newItem,
    };
  };

  // Update Scanned Return Item (AWB / Remark condition)
  const handleUpdateItem = (
    itemId: string,
    updates: { trackingNumber?: string; remark?: ReturnRemarkType }
  ) => {
    const targetItem = scannedItems.find(i => i.id === itemId);
    if (!targetItem) return;

    const oldRemark = targetItem.remark;
    const newRemark = updates.remark || oldRemark;
    const oldTracking = targetItem.trackingNumber;
    const newTracking = updates.trackingNumber ? updates.trackingNumber.trim().toUpperCase() : oldTracking;

    let updatedItem: ScannedReturnItem = {
      ...targetItem,
      trackingNumber: newTracking,
      remark: newRemark,
    };

    const updatedItems = scannedItems.map(item => {
      if (item.id === itemId) {
        return updatedItem;
      }
      return item;
    });

    setScannedItems(updatedItems);

    let updatedTargetBatch = batches.find(b => b.id === targetItem.batchId)!;
    let updatedBatches = batches;

    if (oldRemark !== newRemark) {
      updatedBatches = batches.map(b => {
        if (b.id === targetItem.batchId) {
          const newBreakdown = { ...b.remarksBreakdown };
          newBreakdown[oldRemark] = Math.max(0, (newBreakdown[oldRemark] || 1) - 1);
          newBreakdown[newRemark] = (newBreakdown[newRemark] || 0) + 1;
          updatedTargetBatch = {
            ...b,
            remarksBreakdown: newBreakdown,
          };
          return updatedTargetBatch;
        }
        return b;
      });
      setBatches(updatedBatches);
    }

    DBService.updateScanItem(
      itemId,
      updatedItem,
      updatedTargetBatch,
      updatedItems,
      updatedBatches,
      {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Edited Scanned Item',
        module: 'RTO',
        details: `Updated item AWB to ${newTracking} [${newRemark}]`,
      }
    );
    setLogs(StorageService.getActivityLogs());
  };

  // Delete Scanned Return Item
  const handleDeleteItem = (itemId: string) => {
    const itemToDelete = scannedItems.find(i => i.id === itemId);
    if (!itemToDelete) return;

    const updatedItems = scannedItems.filter(i => i.id !== itemId);
    setScannedItems(updatedItems);

    let updatedTargetBatch = batches.find(b => b.id === itemToDelete.batchId)!;
    const updatedBatches = batches.map(b => {
      if (b.id === itemToDelete.batchId) {
        const newBreakdown = { ...b.remarksBreakdown };
        newBreakdown[itemToDelete.remark] = Math.max(0, (newBreakdown[itemToDelete.remark] || 1) - 1);
        updatedTargetBatch = {
          ...b,
          totalScanned: Math.max(0, b.totalScanned - 1),
          remarksBreakdown: newBreakdown,
        };
        return updatedTargetBatch;
      }
      return b;
    });

    setBatches(updatedBatches);

    DBService.deleteScanItem(
      itemId,
      itemToDelete.batchId,
      updatedTargetBatch,
      updatedItems,
      updatedBatches,
      {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Deleted Scanned AWB',
        module: 'RTO',
        details: `Removed AWB #${itemToDelete.trackingNumber} from batch`,
      }
    );
    setLogs(StorageService.getActivityLogs());
  };

  // Close Return Batch with Driver/Supervisor Acknowledgement
  const handleCloseBatch = (
    batchId: string,
    signData: {
      driverName: string;
      driverMobile: string;
      driverSignature: string;
      supervisorSigner: string;
      notes?: string;
    }
  ) => {
    let closedTargetBatch: ReturnBatch | undefined;
    const updated = batches.map(b => {
      if (b.id === batchId) {
        closedTargetBatch = {
          ...b,
          status: 'Closed' as const,
          closedAt: new Date().toISOString(),
          driverName: signData.driverName,
          driverMobile: signData.driverMobile,
          driverSignature: signData.driverSignature,
          supervisorSigner: signData.supervisorSigner,
          notes: signData.notes,
        };
        return closedTargetBatch;
      }
      return b;
    });

    setBatches(updated);

    if (closedTargetBatch) {
      DBService.closeBatch(batchId, closedTargetBatch, updated, {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Closed & Reconciled Return Batch',
        module: closedTargetBatch.batchType === 'B2B Return' ? 'B2B' : 'RTO',
        details: `Batch ${closedTargetBatch.batchNumber || batchId} closed with ${closedTargetBatch.totalScanned || 0} units. Driver: ${signData.driverName}`,
      });
    }
    setLogs(StorageService.getActivityLogs());
  };

  // Update Batch Details (Edit Open Batch)
  const handleUpdateBatch = (batchId: string, updates: Partial<ReturnBatch>) => {
    let targetUpdatedBatch: ReturnBatch | undefined;
    const updatedBatches = batches.map(b => {
      if (b.id === batchId || b.batchNumber === batchId) {
        targetUpdatedBatch = {
          ...b,
          ...updates,
        };
        return targetUpdatedBatch;
      }
      return b;
    });

    if (!targetUpdatedBatch) return;

    setBatches(updatedBatches);

    DBService.updateBatch(
      targetUpdatedBatch.id,
      targetUpdatedBatch,
      updatedBatches,
      {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Updated Batch Details',
        module: targetUpdatedBatch.batchType === 'B2B Return' ? 'B2B' : 'RTO',
        details: `Updated batch ${targetUpdatedBatch.batchNumber} details`,
      }
    );
    setLogs(StorageService.getActivityLogs());
  };

  // Delete Batch and all its associated scanned items
  const handleDeleteBatch = (batchId: string) => {
    const targetBatch = batches.find(b => b.id === batchId || b.batchNumber === batchId);
    if (!targetBatch) return;

    const updatedBatches = batches.filter(b => b.id !== targetBatch.id && b.batchNumber !== targetBatch.batchNumber);
    const updatedItems = scannedItems.filter(i => i.batchId !== targetBatch.id);

    setBatches(updatedBatches);
    setScannedItems(updatedItems);

    DBService.deleteBatch(
      targetBatch.id,
      updatedBatches,
      updatedItems,
      {
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'Deleted Return Batch',
        module: targetBatch.batchType === 'B2B Return' ? 'B2B' : 'RTO',
        details: `Deleted batch ${targetBatch.batchNumber} with all its scanned items`,
      }
    );
    setLogs(StorageService.getActivityLogs());
  };

  // Master Data Add/Update/Delete/Toggle Handlers
  const handleAddMasterRecord = (category: string, record: any) => {
    const id = record.id || `${category.slice(0, 3)}-${Date.now()}`;
    const newRecord = { ...record, id, status: record.status || 'Active' };

    if (category === 'companies') {
      const updated = [newRecord, ...companies];
      setCompanies(updated);
      StorageService.saveCompanies(updated);
    } else if (category === 'warehouses') {
      const updated = [newRecord, ...warehouses];
      setWarehouses(updated);
      StorageService.saveWarehouses(updated);
    } else if (category === 'clients') {
      const updated = [newRecord, ...clients];
      setClients(updated);
      StorageService.saveClients(updated);
    } else if (category === 'couriers') {
      const updated = [newRecord, ...couriers];
      setCouriers(updated);
      StorageService.saveCouriers(updated);
    } else if (category === 'skus') {
      const updated = [newRecord, ...skus];
      setSKUs(updated);
      StorageService.saveSKUs(updated);
    } else if (category === 'users') {
      const updated = [newRecord, ...users];
      setUsers(updated);
      StorageService.saveUsers(updated);
    } else if (category === 'drivers') {
      const updated = [newRecord, ...drivers];
      setDrivers(updated);
      StorageService.saveDrivers(updated);
    } else if (category === 'vehicle_types') {
      const updated = [newRecord, ...vehicleTypes];
      setVehicleTypes(updated);
      StorageService.saveVehicleTypes(updated);
    } else if (category === 'return_reasons') {
      const updated = [newRecord, ...returnReasons];
      setReturnReasons(updated);
      StorageService.saveReturnReasons(updated);
    }

    StorageService.addActivityLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: `Created Master Entry in ${category}`,
      module: 'Masters',
      details: `Added new ${category} record: ${record.name || record.code || record.label || record.typeName || record.skuCode}`,
    });
    setLogs(StorageService.getActivityLogs());
  };

  const handleUpdateMasterRecord = (category: string, id: string, updates: any) => {
    if (category === 'companies') {
      const updated = companies.map(c => (c.id === id ? { ...c, ...updates } : c));
      setCompanies(updated);
      StorageService.saveCompanies(updated);
    } else if (category === 'warehouses') {
      const updated = warehouses.map(w => (w.id === id ? { ...w, ...updates } : w));
      setWarehouses(updated);
      StorageService.saveWarehouses(updated);
    } else if (category === 'clients') {
      const updated = clients.map(c => (c.id === id ? { ...c, ...updates } : c));
      setClients(updated);
      StorageService.saveClients(updated);
    } else if (category === 'couriers') {
      const updated = couriers.map(c => (c.id === id ? { ...c, ...updates } : c));
      setCouriers(updated);
      StorageService.saveCouriers(updated);
    } else if (category === 'skus') {
      const updated = skus.map(s => (s.id === id ? { ...s, ...updates } : s));
      setSKUs(updated);
      StorageService.saveSKUs(updated);
    } else if (category === 'users') {
      const updated = users.map(u => (u.id === id ? { ...u, ...updates } : u));
      setUsers(updated);
      StorageService.saveUsers(updated);
    } else if (category === 'drivers') {
      const updated = drivers.map(d => (d.id === id ? { ...d, ...updates } : d));
      setDrivers(updated);
      StorageService.saveDrivers(updated);
    } else if (category === 'vehicle_types') {
      const updated = vehicleTypes.map(v => (v.id === id ? { ...v, ...updates } : v));
      setVehicleTypes(updated);
      StorageService.saveVehicleTypes(updated);
    } else if (category === 'return_reasons') {
      const updated = returnReasons.map(r => (r.id === id ? { ...r, ...updates } : r));
      setReturnReasons(updated);
      StorageService.saveReturnReasons(updated);
    }

    StorageService.addActivityLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: `Updated Master Entry in ${category}`,
      module: 'Masters',
      details: `Modified record ID ${id}`,
    });
    setLogs(StorageService.getActivityLogs());
  };

  const handleDeleteMasterRecord = (category: string, id: string) => {
    if (category === 'companies') {
      const updated = companies.filter(c => c.id !== id);
      setCompanies(updated);
      StorageService.saveCompanies(updated);
    } else if (category === 'warehouses') {
      const updated = warehouses.filter(w => w.id !== id);
      setWarehouses(updated);
      StorageService.saveWarehouses(updated);
    } else if (category === 'clients') {
      const updated = clients.filter(c => c.id !== id);
      setClients(updated);
      StorageService.saveClients(updated);
    } else if (category === 'couriers') {
      const updated = couriers.filter(c => c.id !== id);
      setCouriers(updated);
      StorageService.saveCouriers(updated);
    } else if (category === 'skus') {
      const updated = skus.filter(s => s.id !== id);
      setSKUs(updated);
      StorageService.saveSKUs(updated);
    } else if (category === 'users') {
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      StorageService.saveUsers(updated);
    } else if (category === 'drivers') {
      const updated = drivers.filter(d => d.id !== id);
      setDrivers(updated);
      StorageService.saveDrivers(updated);
    } else if (category === 'vehicle_types') {
      const updated = vehicleTypes.filter(v => v.id !== id);
      setVehicleTypes(updated);
      StorageService.saveVehicleTypes(updated);
    } else if (category === 'return_reasons') {
      const updated = returnReasons.filter(r => r.id !== id);
      setReturnReasons(updated);
      StorageService.saveReturnReasons(updated);
    }

    StorageService.addActivityLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: `Deleted Master Entry in ${category}`,
      module: 'Masters',
      details: `Removed record ID ${id}`,
    });
    setLogs(StorageService.getActivityLogs());
  };

  const handleToggleHoldMasterRecord = (category: string, id: string, newStatus: string) => {
    if (category === 'companies') {
      const updated = companies.map(c => {
        if (c.id === id) {
          const toggled = c.status === 'Active' ? 'On Hold' : 'Active';
          return { ...c, status: toggled as any };
        }
        return c;
      });
      setCompanies(updated);
      StorageService.saveCompanies(updated);
    } else if (category === 'warehouses') {
      const updated = warehouses.map(w => {
        if (w.id === id) {
          const toggled = w.status === 'Active' ? 'On Hold' : 'Active';
          return { ...w, status: toggled as any };
        }
        return w;
      });
      setWarehouses(updated);
      StorageService.saveWarehouses(updated);
    } else if (category === 'clients') {
      const updated = clients.map(c => {
        if (c.id === id) {
          const toggled = c.status === 'Active' ? 'On Hold' : 'Active';
          return { ...c, status: toggled as any };
        }
        return c;
      });
      setClients(updated);
      StorageService.saveClients(updated);
    } else if (category === 'couriers') {
      const updated = couriers.map(c => {
        if (c.id === id) {
          const toggled = c.status === 'Active' ? 'On Hold' : 'Active';
          return { ...c, status: toggled as any };
        }
        return c;
      });
      setCouriers(updated);
      StorageService.saveCouriers(updated);
    } else if (category === 'skus') {
      const updated = skus.map(s => {
        if (s.id === id) {
          const toggled = s.status === 'Active' ? 'On Hold' : 'Active';
          return { ...s, status: toggled as any };
        }
        return s;
      });
      setSKUs(updated);
      StorageService.saveSKUs(updated);
    } else if (category === 'users') {
      const updated = users.map(u => {
        if (u.id === id) {
          const toggled = u.status === 'Active' ? 'Inactive' : 'Active';
          return { ...u, status: toggled as any };
        }
        return u;
      });
      setUsers(updated);
      StorageService.saveUsers(updated);
    } else if (category === 'drivers') {
      const updated = drivers.map(d => {
        if (d.id === id) {
          const toggled = d.status === 'Active' ? 'On Hold' : 'Active';
          return { ...d, status: toggled as any };
        }
        return d;
      });
      setDrivers(updated);
      StorageService.saveDrivers(updated);
    } else if (category === 'vehicle_types') {
      const updated = vehicleTypes.map(v => {
        if (v.id === id) {
          const toggled = v.status === 'Active' ? 'On Hold' : 'Active';
          return { ...v, status: toggled as any };
        }
        return v;
      });
      setVehicleTypes(updated);
      StorageService.saveVehicleTypes(updated);
    } else if (category === 'return_reasons') {
      const updated = returnReasons.map(r => {
        if (r.id === id) {
          const toggled = r.status === 'Active' ? 'On Hold' : 'Active';
          return { ...r, status: toggled as any };
        }
        return r;
      });
      setReturnReasons(updated);
      StorageService.saveReturnReasons(updated);
    }

    StorageService.addActivityLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: `Toggled Hold Status for ${category}`,
      module: 'Masters',
      details: `Record ID ${id} is now ${newStatus}`,
    });
    setLogs(StorageService.getActivityLogs());
  };

  // Save Supabase Config
  const handleSaveSupabaseConfig = (cfg: SupabaseConfig) => {
    setSupabaseConfig(cfg);
    StorageService.saveSupabaseConfig(cfg);
  };

  // Navigation shortcut helper
  const handleUniversalSelectResult = (type: 'inward' | 'rto') => {
    if (type === 'inward') {
      handleSelectTab('inward');
    } else {
      handleSelectTab('returns_rto');
    }
  };

  const openBatchCount = batches.filter(
    b => b.warehouseId === activeWarehouse.id && b.status === 'Open'
  ).length;

  const pendingGateEntriesCount = gateEntries.filter(
    g => g.warehouseId === activeWarehouse.id && g.status !== 'Completed'
  ).length;

  // Auto-switch tab if current user loses permission for activeTab
  useEffect(() => {
    if (!currentUser) return;
    const accessible = getAccessibleModules(currentUser);
    if (!accessible.includes(activeTab)) {
      handleSelectTab(accessible[0] || 'dashboard');
    }
  }, [currentUser, activeTab, handleSelectTab]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  // Primary Protected Warehouse Layout Wrapper
  const renderAppLayout = (viewTab: ActiveTab) => (
    <div className="min-h-screen bg-primary text-primary font-sans selection:bg-[#123B5D] selection:text-white flex flex-col w-full max-w-full overflow-x-hidden theme-transition">
      {/* Header Bar */}
      <Header
        currentUser={currentUser}
        onSwitchUserRole={handleSwitchUserRole}
        warehouses={warehouses}
        activeWarehouseId={activeWarehouseId}
        onSelectWarehouse={handleSelectWarehouse}
        onOpenUniversalSearch={() => setIsUniversalSearchOpen(true)}
        onLogout={handleLogout}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        isMobileMenuOpen={isMobileMenuOpen}
        activeTab={viewTab}
        onPrimaryAction={() => {
          if (viewTab === 'dashboard' || viewTab === 'inward' || viewTab === 'grn') {
            setIsNewGateEntryModalOpen(true);
          } else if (viewTab === 'returns_rto' || viewTab === 'returns_b2b') {
            setIsNewBatchModalOpen(true);
          } else {
            setIsNewGateEntryModalOpen(true);
          }
        }}
      />

      {/* Main Container Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Fixed Left Sidebar Navigation */}
        <Sidebar
          activeTab={viewTab}
          onSelectTab={handleSelectTab}
          openBatchCount={openBatchCount}
          pendingGateEntriesCount={pendingGateEntriesCount}
          activeWarehouseCode={activeWarehouse?.code || 'WH-MAIN-01'}
          activeWarehouseName={activeWarehouse?.name || 'Bhiwandi Central Hub'}
          currentUser={currentUser}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
          onOpenUniversalSearch={() => setIsUniversalSearchOpen(true)}
        />

        {/* Main Content View Container */}
        <main className="main-content flex-1 overflow-y-auto bg-page min-h-[calc(100vh-64px)] transition-colors duration-200 lg:pl-[72px] pb-20 lg:pb-8 w-full">
          <React.Suspense fallback={<ModuleFallback />}>
          <div className="p-3 sm:p-5 lg:p-6 max-w-[1600px] mx-auto w-full">
            {viewTab === 'dashboard' && (
              <DashboardView
                warehouse={activeWarehouse}
                allWarehouses={warehouses}
                companies={companies}
                clients={clients}
                gateEntries={gateEntries}
                batches={batches}
                scannedItems={scannedItems}
                activeDevices={StorageService.getActiveDevices()}
                users={users}
                logs={logs}
                currentUser={currentUser}
                onNavigateTab={tab => handleSelectTab(tab)}
                onOpenNewGateEntryModal={() => setIsNewGateEntryModalOpen(true)}
                onOpenNewBatchModal={() => setIsNewBatchModalOpen(true)}
                onSelectWarehouse={handleSelectWarehouse}
              />
            )}

            {(viewTab === 'inward' || viewTab === 'grn' || viewTab === 'returns_b2b') && (
              <InwardModule
                currentUser={currentUser}
                activeWarehouse={activeWarehouse}
                gateEntries={gateEntries}
                clients={clients}
                couriers={couriers}
                vehicleTypes={vehicleTypes}
                drivers={drivers}
                onAddGateEntry={handleAddGateEntry}
                onUpdateGateStatus={handleUpdateGateStatus}
                onUpdateGateEntryPhase2={handleUpdateGateEntryPhase2}
                onUpdateGateEntryPhase3={handleUpdateGateEntryPhase3}
                isOpenCreateModal={isNewGateEntryModalOpen}
                onCloseCreateModal={() => setIsNewGateEntryModalOpen(!isNewGateEntryModalOpen)}
                initialTab={viewTab === 'returns_b2b' ? 'b2b' : 'inward'}
              />
            )}

            {viewTab === 'returns_rto' && (
              <ReturnsModule
                currentUser={currentUser}
                activeWarehouse={activeWarehouse}
                batches={batches}
                scannedItems={scannedItems}
                gateEntries={gateEntries}
                clients={clients}
                couriers={couriers}
                onAddBatch={handleAddBatch}
                onUpdateBatch={handleUpdateBatch}
                onDeleteBatch={handleDeleteBatch}
                onScanItem={handleScanItem}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onCloseBatch={handleCloseBatch}
                isOpenCreateModal={isNewBatchModalOpen}
                onCloseCreateModal={() => setIsNewBatchModalOpen(!isNewBatchModalOpen)}
                onNavigateTab={handleSelectTab}
              />
            )}

            {viewTab === 'user_management' && (
              <UserManagementPage onNavigateTab={handleSelectTab} />
            )}

            {(viewTab === 'masters' ||
              viewTab === 'clients' ||
              viewTab === 'couriers' ||
              viewTab === 'locations') && (
              <MastersModule
                companies={companies}
                warehouses={warehouses}
                clients={clients}
                couriers={couriers}
                skus={skus}
                users={users}
                drivers={drivers}
                vehicleTypes={vehicleTypes}
                returnReasons={returnReasons}
                onAddMasterRecord={handleAddMasterRecord}
                onUpdateMasterRecord={handleUpdateMasterRecord}
                onDeleteMasterRecord={handleDeleteMasterRecord}
                onToggleHoldMasterRecord={handleToggleHoldMasterRecord}
              />
            )}

            {(viewTab === 'reports' || viewTab === 'notifications') && (
              <ReportsModule
                activeWarehouse={activeWarehouse}
                gateEntries={gateEntries}
                batches={batches}
                scannedItems={scannedItems}
                clients={clients}
                couriers={couriers}
                users={users}
              />
            )}
          </div>
          </React.Suspense>
        </main>
      </div>

      {/* Universal Search Modal (Ctrl+K) */}
      <React.Suspense fallback={null}>
            <UniversalSearchModal
        isOpen={isUniversalSearchOpen}
        onClose={() => setIsUniversalSearchOpen(false)}
        gateEntries={gateEntries}
        batches={batches}
        scannedItems={scannedItems}
        clients={clients}
        couriers={couriers}
        onSelectResult={handleUniversalSelectResult}
      />
            </React.Suspense>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav lg:hidden">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className={location.pathname === '/dashboard' ? 'active' : ''}
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/inward')}
          className={location.pathname === '/inward' ? 'active' : ''}
        >
          <Truck />
          <span>Inward</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/returns')}
          className={location.pathname.startsWith('/returns') || location.pathname === '/rto' ? 'active' : ''}
        >
          <ScanLine />
          <span>Returns</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/reports')}
          className={location.pathname === '/reports' ? 'active' : ''}
        >
          <BarChart3 />
          <span>Reports</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {currentUser && currentUser.mustChangePassword && (
        <ForcedPasswordChangeModal
          user={currentUser}
          onPasswordChanged={updatePassword}
          onSignOut={signOut}
        />
      )}
      <Routes>
        {/* 1. Public Route: Login Page */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* 2. Protected Internal Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {renderAppLayout('dashboard')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/inward"
        element={
          <ProtectedRoute>
            {renderAppLayout('inward')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/grn"
        element={
          <ProtectedRoute>
            {renderAppLayout('grn')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/returns/rto"
        element={
          <ProtectedRoute>
            {renderAppLayout('returns_rto')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/returns"
        element={<Navigate to="/returns/rto" replace />}
      />

      <Route
        path="/returns-rto"
        element={<Navigate to="/returns/rto" replace />}
      />

      <Route
        path="/rto"
        element={<Navigate to="/returns/rto" replace />}
      />

      <Route
        path="/returns/b2b"
        element={
          <ProtectedRoute>
            {renderAppLayout('returns_b2b')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/returns-b2b"
        element={<Navigate to="/returns/b2b" replace />}
      />

      <Route
        path="/inventory"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/audit"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            {renderAppLayout('clients')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/couriers"
        element={
          <ProtectedRoute>
            {renderAppLayout('couriers')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/locations"
        element={
          <ProtectedRoute>
            {renderAppLayout('locations')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            {renderAppLayout('reports')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            {renderAppLayout('notifications')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/user-management"
        element={
          <ProtectedRoute>
            {renderAppLayout('user_management')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={<Navigate to="/user-management" replace />}
      />

      <Route
        path="/masters"
        element={
          <ProtectedRoute>
            {renderAppLayout('masters')}
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={<Navigate to="/dashboard" replace />}
      />

      <Route
        path="/supabase-hub"
        element={<Navigate to="/dashboard" replace />}
      />

      {/* 3. Wildcard Catch-All -> Redirects to /dashboard */}
      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
    </>
  );
}
