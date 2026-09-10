import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Truck,
  Scan,
  Smartphone,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Plus,
  QrCode,
  TrendingUp,
  Activity,
  ChevronRight,
  Filter,
  Boxes,
  Users,
  Radio,
  Check,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  InwardGateEntry,
  ReturnBatch,
  ScannedReturnItem,
  ActivityLog,
  Warehouse,
  Client,
  Company,
  ActiveDeviceSession,
  User,
} from '../types';
import { ActiveTab } from './Sidebar';
import { StorageService } from '../services/storage';

type DateFilterOption = 'all' | 'today' | 'yesterday' | 'specific' | 'last_7_days' | 'custom';

interface DashboardViewProps {
  warehouse: Warehouse;
  allWarehouses?: Warehouse[];
  companies?: Company[];
  clients: Client[];
  gateEntries: InwardGateEntry[];
  batches: ReturnBatch[];
  scannedItems: ScannedReturnItem[];
  activeDevices?: ActiveDeviceSession[];
  users?: User[];
  logs: ActivityLog[];
  currentUser?: User;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenNewGateEntryModal: () => void;
  onOpenNewBatchModal: () => void;
  onSelectWarehouse?: (id: string) => void;
}

// Date helpers
function getLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseItemDate(dateVal: string | null | undefined): string | null {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return getLocalDateString(d);
  } catch {
    return null;
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  warehouse,
  clients = [],
  gateEntries = [],
  batches = [],
  scannedItems = [],
  activeDevices = [],
  users = [],
  logs = [],
  onNavigateTab,
  onOpenNewGateEntryModal,
  onOpenNewBatchModal,
}) => {
  // All unique dates present in operations data (sorted newest first)
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    batches.forEach(b => {
      const d = parseItemDate(b.createdAt || (b as any).date);
      if (d) dates.add(d);
    });
    scannedItems.forEach(s => {
      const d = parseItemDate(s.scannedAt);
      if (d) dates.add(d);
    });
    gateEntries.forEach(g => {
      const d = parseItemDate(g.entryTime || (g as any).inwardDate || (g as any).createdAt);
      if (d) dates.add(d);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [batches, scannedItems, gateEntries]);

  const latestDataDate = useMemo(() => {
    return availableDates.length > 0 ? availableDates[0] : '';
  }, [availableDates]);

  // 1. Date Filter State with persistence across refreshes
  const [dateFilter, setDateFilterState] = useState<DateFilterOption>(() => {
    const saved = StorageService.getDashboardDateFilter('') as DateFilterOption;
    if (saved && ['all', 'today', 'yesterday', 'specific', 'last_7_days', 'custom'].includes(saved)) {
      return saved;
    }
    return 'today';
  });

  const [selectedSpecificDate, setSelectedSpecificDateState] = useState<string>(() => {
    return StorageService.getDashboardSelectedDate('');
  });

  const setDateFilter = (opt: DateFilterOption) => {
    setDateFilterState(opt);
    StorageService.saveDashboardDateFilter(opt);
  };

  const setSelectedSpecificDate = (dateStr: string) => {
    setSelectedSpecificDateState(dateStr);
    StorageService.saveDashboardSelectedDate(dateStr);
  };

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Custom date range bounds
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Guarantee dashboard data never becomes NULL simply after refresh:
  // If user previously selected a specific date, keep it.
  // If dateFilter is today but today has 0 items and saved data exists on previous dates,
  // automatically show the latest saved data date so dashboard shows saved data instead of becoming NULL.
  useEffect(() => {
    if (batches.length === 0 && scannedItems.length === 0 && gateEntries.length === 0) return;

    const savedDate = StorageService.getDashboardSelectedDate('');
    if (savedDate && availableDates.includes(savedDate)) {
      if (dateFilter !== 'specific' || selectedSpecificDate !== savedDate) {
        setDateFilterState('specific');
        setSelectedSpecificDateState(savedDate);
      }
      return;
    }

    if (dateFilter === 'today' && latestDataDate && latestDataDate !== todayStr) {
      const todayCount = batches.filter(b => parseItemDate(b.createdAt || (b as any).date) === todayStr).length;
      if (todayCount === 0) {
        setDateFilterState('specific');
        setSelectedSpecificDateState(latestDataDate);
        StorageService.saveDashboardDateFilter('specific');
        StorageService.saveDashboardSelectedDate(latestDataDate);
      }
    }
  }, [batches, scannedItems, gateEntries, availableDates, latestDataDate, todayStr, dateFilter, selectedSpecificDate]);

  // Close date picker popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute reference date strings
  const { yesterdayStr, sevenDaysAgoStr, thirtyDaysAgoStr, sixtyDaysAgoStr, ninetyDaysAgoStr } = useMemo(() => {
    const now = new Date();

    const y = new Date(now);
    y.setDate(y.getDate() - 1);

    const s7 = new Date(now);
    s7.setDate(s7.getDate() - 6);

    const s30 = new Date(now);
    s30.setDate(s30.getDate() - 29);

    const s60 = new Date(now);
    s60.setDate(s60.getDate() - 59);

    const s90 = new Date(now);
    s90.setDate(s90.getDate() - 89);

    return {
      yesterdayStr: getLocalDateString(y),
      sevenDaysAgoStr: getLocalDateString(s7),
      thirtyDaysAgoStr: getLocalDateString(s30),
      sixtyDaysAgoStr: getLocalDateString(s60),
      ninetyDaysAgoStr: getLocalDateString(s90),
    };
  }, []);

  // Filter predicate: returns true if an item's timestamp is within the active date filter
  const isDateInFilter = useMemo(() => {
    return (dateVal: string | null | undefined): boolean => {
      const itemDateStr = parseItemDate(dateVal);
      if (!itemDateStr) return false;

      if (dateFilter === 'all') {
        return true;
      }
      if (dateFilter === 'specific') {
        const target = selectedSpecificDate || latestDataDate || todayStr;
        return itemDateStr === target;
      }
      if (dateFilter === 'today') {
        return itemDateStr === todayStr;
      }
      if (dateFilter === 'yesterday') {
        return itemDateStr === yesterdayStr;
      }
      if (dateFilter === 'last_7_days') {
        return itemDateStr >= sevenDaysAgoStr && itemDateStr <= todayStr;
      }
      if (dateFilter === 'custom') {
        if (customStartDate && customEndDate) {
          return itemDateStr >= customStartDate && itemDateStr <= customEndDate;
        }
        if (customStartDate) {
          return itemDateStr >= customStartDate;
        }
        if (customEndDate) {
          return itemDateStr <= customEndDate;
        }
        return true;
      }
      return true;
    };
  }, [dateFilter, selectedSpecificDate, latestDataDate, todayStr, yesterdayStr, sevenDaysAgoStr, customStartDate, customEndDate]);

  // Label text for current date filter button
  const dateFilterLabel = useMemo(() => {
    const now = new Date();
    const formattedToday = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (dateFilter === 'all') {
      return 'All Dates (All Saved Data)';
    }
    if (dateFilter === 'specific') {
      const target = selectedSpecificDate || latestDataDate || todayStr;
      const parsed = new Date(target + 'T00:00:00');
      const formatted = isNaN(parsed.getTime()) ? target : parsed.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `Date: ${formatted}`;
    }
    if (dateFilter === 'today') {
      return `Today (${formattedToday})`;
    }
    if (dateFilter === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const formattedYesterday = y.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return `Yesterday (${formattedYesterday})`;
    }
    if (dateFilter === 'last_7_days') {
      return 'Last 7 Days';
    }
    if (dateFilter === 'custom') {
      if (customStartDate === thirtyDaysAgoStr && customEndDate === todayStr) {
        return 'Last 30 Days (1 Month)';
      }
      if (customStartDate === sixtyDaysAgoStr && customEndDate === todayStr) {
        return 'Last 60 Days (2 Months)';
      }
      if (customStartDate === ninetyDaysAgoStr && customEndDate === todayStr) {
        return 'Last 90 Days (3 Months)';
      }
      return `Custom: ${customStartDate} to ${customEndDate}`;
    }
    return 'Today';
  }, [dateFilter, selectedSpecificDate, latestDataDate, customStartDate, customEndDate, thirtyDaysAgoStr, sixtyDaysAgoStr, ninetyDaysAgoStr, todayStr]);

  // Warehouse-scoped and Date-Filtered Datasets
  const filteredGateEntries = useMemo(() => {
    return gateEntries.filter(
      g => g.warehouseId === warehouse.id && isDateInFilter(g.entryTime || (g as any).inwardDate || (g as any).createdAt)
    );
  }, [gateEntries, warehouse.id, isDateInFilter]);

  const filteredBatches = useMemo(() => {
    return batches.filter(
      b => b.warehouseId === warehouse.id && isDateInFilter(b.createdAt || (b as any).date)
    );
  }, [batches, warehouse.id, isDateInFilter]);

  const filteredB2CBatches = useMemo(() => {
    return filteredBatches.filter(b => b.batchType !== 'B2B Return');
  }, [filteredBatches]);

  const filteredB2BBatches = useMemo(() => {
    return filteredBatches.filter(b => b.batchType === 'B2B Return');
  }, [filteredBatches]);

  const filteredScannedItems = useMemo(() => {
    const warehouseBatchIds = new Set(batches.filter(b => b.warehouseId === warehouse.id).map(b => b.id));
    return scannedItems.filter(
      s => warehouseBatchIds.has(s.batchId) && isDateInFilter(s.scannedAt || (s as any).createdAt)
    );
  }, [scannedItems, batches, warehouse.id, isDateInFilter]);

  // Helper to normalize condition key
  const getConditionKey = (item: ScannedReturnItem): string => {
    const raw = ((item.remark || (item as any).qcCondition || (item as any).qc_condition || '') as string).trim().toUpperCase();
    if (raw.includes('GOOD') || raw === '1') return 'GOOD';
    if (raw.includes('DAMAGE') || raw === '2') return 'DAMAGE';
    if (raw.includes('OPEN') || raw === '3') return 'OPEN BOX';
    if (raw.includes('WRONG') || raw === '4') return 'WRONG PROD';
    if (raw.includes('SHORT') || raw === '5') return 'SHORT QTY';
    if (raw.includes('MISSING') || raw === '6') return 'MISSING';
    if (raw.includes('OTHER') || raw === '7') return 'OTHERS';
    return 'GOOD';
  };

  // Metrics Calculation (Real Data, 0 fallback when empty)
  const metrics = useMemo(() => {
    const totalScanned = filteredScannedItems.length;

    const goodCount = filteredScannedItems.filter(s => getConditionKey(s) === 'GOOD').length;
    const damageCount = filteredScannedItems.filter(s => getConditionKey(s) === 'DAMAGE').length;
    const openBoxCount = filteredScannedItems.filter(s => getConditionKey(s) === 'OPEN BOX').length;
    const wrongProdCount = filteredScannedItems.filter(s => getConditionKey(s) === 'WRONG PROD').length;
    const shortQtyCount = filteredScannedItems.filter(s => getConditionKey(s) === 'SHORT QTY').length;
    const missingCount = filteredScannedItems.filter(s => getConditionKey(s) === 'MISSING').length;
    const othersCount = filteredScannedItems.filter(s => getConditionKey(s) === 'OTHERS').length;

    const defectiveCount = totalScanned - goodCount;
    const goodPct = totalScanned > 0 ? Math.round((goodCount / totalScanned) * 100) : 100;
    const damagePct = totalScanned > 0 ? Math.round((damageCount / totalScanned) * 100) : 0;
    const openBoxPct = totalScanned > 0 ? Math.round((openBoxCount / totalScanned) * 100) : 0;
    const wrongProdPct = totalScanned > 0 ? Math.round((wrongProdCount / totalScanned) * 100) : 0;

    const inwardVehiclesCount = filteredGateEntries.length;
    const totalBoxesUnloaded = filteredGateEntries.reduce((acc, g) => acc + (g.receivedBoxCount || 0), 0);

    // Active HHD & Logins status - purely dynamic
    const activeHHDCount = activeDevices.filter(d => d.status === 'Online' && (d.deviceType as string) === 'Mobile / Scanner').length;
    const activeLoginSessions = activeDevices.filter(d => d.status === 'Online').length || users.filter(u => u.status === 'Active').length || 1;

    // B2B Returns metrics
    const b2bBatchesCount = filteredB2BBatches.length;
    const b2bOpenCount = filteredB2BBatches.filter(b => b.status === 'Open').length;
    const b2bClosedCount = filteredB2BBatches.filter(b => b.status === 'Closed').length;
    const b2bTotalScanned = filteredB2BBatches.reduce((acc, b) => acc + (b.totalScanned || 0), 0);

    return {
      totalScanned,
      goodCount,
      goodPct,
      defectiveCount,
      damageCount,
      damagePct,
      openBoxCount,
      openBoxPct,
      wrongProdCount,
      wrongProdPct,
      shortQtyCount,
      missingCount,
      othersCount,
      inwardVehiclesCount,
      totalBoxesUnloaded,
      activeHHDCount,
      activeLoginSessions,
      b2bBatchesCount,
      b2bOpenCount,
      b2bClosedCount,
      b2bTotalScanned,
    };
  }, [
    filteredScannedItems,
    filteredGateEntries,
    activeDevices,
    users,
    filteredB2BBatches,
  ]);

  // Hourly Live Trend Data for Area Chart (Grouped from real scans in active date filter)
  const hourlyTrendData = useMemo(() => {
    const buckets: Record<string, { scans: number; good: number }> = {
      '08:00': { scans: 0, good: 0 },
      '10:00': { scans: 0, good: 0 },
      '12:00': { scans: 0, good: 0 },
      '14:00': { scans: 0, good: 0 },
      '16:00': { scans: 0, good: 0 },
      '18:00': { scans: 0, good: 0 },
      '20:00': { scans: 0, good: 0 },
    };

    filteredScannedItems.forEach((item) => {
      if (!item.scannedAt) return;
      try {
        const itemHour = new Date(item.scannedAt).getHours();
        const isGood = getConditionKey(item) === 'GOOD';

        let bucketKey = '08:00';
        if (itemHour < 9) bucketKey = '08:00';
        else if (itemHour < 11) bucketKey = '10:00';
        else if (itemHour < 13) bucketKey = '12:00';
        else if (itemHour < 15) bucketKey = '14:00';
        else if (itemHour < 17) bucketKey = '16:00';
        else if (itemHour < 19) bucketKey = '18:00';
        else bucketKey = '20:00';

        buckets[bucketKey].scans += 1;
        if (isGood) buckets[bucketKey].good += 1;
      } catch {
        // ignore date error
      }
    });

    // Cumulative progression
    let cumulativeScans = 0;
    let cumulativeGood = 0;
    return Object.entries(buckets).map(([time, val]) => {
      cumulativeScans += val.scans;
      cumulativeGood += val.good;
      return {
        time,
        scans: cumulativeScans,
        good: cumulativeGood,
      };
    });
  }, [filteredScannedItems]);

  // Account Distribution sorted by MOST-RECENT scan first, then by count.
  // Root-cause fixes ("scanned account does not come to the front / details
  // wrong"):
  //  - Accounts missing from this device's client master (master drift /
  //    deleted record) used to VANISH from the distribution; they stay visible
  //    via the batch's clientName snapshot.
  //  - The account whose RTO was just scanned jumps to the front and receives
  //    a live highlight. Sort: latest scan desc -> units desc -> name.
  const clientAccountsList = useMemo(() => {
    const palette = ['#8B5CF6', '#14B8A6', '#EC4899', '#F59E0B', '#06B6D4', '#3B82F6', '#10B981', '#64748B'];

    const totalUnits = metrics.totalScanned;

    // batchId -> batch lookup for scan attribution
    const batchById = new Map<string, ReturnBatch>(filteredBatches.map(b => [b.id, b]));

    // Aggregate scans per clientId (only batches in the filtered/warehouse scope)
    const perClient = new Map<string, { count: number; lastScanAt: number }>();
    filteredScannedItems.forEach((item) => {
      const batch = batchById.get(item.batchId);
      if (!batch || !batch.clientId) return;
      const entry = perClient.get(batch.clientId) || { count: 0, lastScanAt: 0 };
      entry.count += 1;
      const t = item.scannedAt ? new Date(item.scannedAt).getTime() : 0;
      if (t > entry.lastScanAt) entry.lastScanAt = t;
      perClient.set(batch.clientId, entry);
    });

    // Known master accounts
    const knownIds = new Set<string>();
    const list = clients.map((c) => {
      knownIds.add(c.id);
      const agg = perClient.get(c.id) || { count: 0, lastScanAt: 0 };
      const pct = totalUnits > 0 ? Math.round((agg.count / totalUnits) * 100) : 0;
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        count: agg.count,
        pct,
        lastScanAt: agg.lastScanAt,
      };
    });

    // Accounts referenced by batches but NOT in this device's client master —
    // keep them visible using the snapshot stored on the batch so their volume
    // never silently disappears.
    const orphanIds = new Set<string>();
    filteredBatches.forEach((b) => {
      if (b.clientId && !knownIds.has(b.clientId)) orphanIds.add(b.clientId);
    });
    orphanIds.forEach((orphanId) => {
      const agg = perClient.get(orphanId) || { count: 0, lastScanAt: 0 };
      const sampleBatch = filteredBatches.find(b => b.clientId === orphanId);
      const pct = totalUnits > 0 ? Math.round((agg.count / totalUnits) * 100) : 0;
      list.push({
        id: orphanId,
        name: (sampleBatch as any)?.clientName || 'Unknown Account',
        code: 'OFFLINE-REF',
        count: agg.count,
        pct,
        lastScanAt: agg.lastScanAt,
      });
    });

    // Accounts sorting: Top quantity scanned on top, then most recent scan, then alphabetical
    list.sort((a, b) =>
      (b.count - a.count) ||
      (b.lastScanAt - a.lastScanAt) ||
      a.name.localeCompare(b.name)
    );

    return list.map((item, idx) => ({
      ...item,
      color: palette[idx % palette.length],
    }));
  }, [clients, filteredBatches, filteredScannedItems, metrics.totalScanned]);

  // Account distribution dropdown filter state: 'top4' (default: only 4 on top) | 'all' | <specific account ID>
  const [accountDistributionFilter, setAccountDistributionFilter] = useState<string>('top4');

  const displayedAccountsList = useMemo(() => {
    if (accountDistributionFilter === 'top4') {
      return clientAccountsList.slice(0, 4);
    }
    if (accountDistributionFilter === 'all') {
      return clientAccountsList;
    }
    const single = clientAccountsList.filter(c => c.id === accountDistributionFilter);
    return single.length > 0 ? single : clientAccountsList.slice(0, 4);
  }, [clientAccountsList, accountDistributionFilter]);

  // The most recently scanned account (drives the LIVE highlight below)
  const liveAccountId = useMemo(() => {
    const withScan = clientAccountsList.filter(c => c.lastScanAt > 0);
    return withScan.length > 0 ? withScan[0].id : null;
  }, [clientAccountsList]);

  // Donut Chart Data
  const donutData = useMemo(() => {
    const listToUse = accountDistributionFilter === 'all' ? clientAccountsList : displayedAccountsList;
    const nonZero = listToUse.filter(item => item.count > 0);
    if (nonZero.length === 0) {
      return [
        {
          name: 'No scans in period',
          value: 1,
          color: '#334155',
          pct: 0,
        },
      ];
    }
    return nonZero.map(item => ({
      name: item.name,
      value: item.count,
      color: item.color,
      pct: item.pct,
    }));
  }, [clientAccountsList, displayedAccountsList, accountDistributionFilter]);

  // Recent operations activity feed (within filtered dataset)
  const recentActivities = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'inward' | 'return' | 'b2b';
      title: string;
      subtitle: string;
      time: string;
      status: string;
      statusColor: string;
    }> = [];

    // Filtered gate entries
    filteredGateEntries.slice(0, 3).forEach((g) => {
      items.push({
        id: `gate-${g.id}`,
        type: 'inward',
        title: `Gate Pass ${g.gatePassNumber || 'GP-INW'}`,
        subtitle: `${g.vehicleNumber || 'Vehicle'} • ${g.receivedBoxCount || 0} Boxes (${g.driverName || 'Driver'})`,
        time: g.entryTime ? new Date(g.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
        status: g.status || 'Received',
        statusColor: '#06B6D4',
      });
    });

    // Filtered return batches
    filteredBatches.slice(0, 3).forEach((b) => {
      const client = clients.find(c => c.id === b.clientId);
      items.push({
        id: `batch-${b.id}`,
        type: b.batchType === 'B2B Return' ? 'b2b' : 'return',
        title: `${b.batchType === 'B2B Return' ? 'B2B Batch' : 'RTO Batch'} ${b.batchNumber}`,
        subtitle: `${client?.name || (b as any).clientName || 'Client'} • ${b.totalScanned || 0} Items Processed`,
        time: b.createdAt ? new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
        status: b.status === 'Closed' ? 'Closed' : 'Active',
        statusColor: b.batchType === 'B2B Return' ? '#EC4899' : '#8B5CF6',
      });
    });

    return items.slice(0, 6);
  }, [filteredGateEntries, filteredBatches, clients]);

  return (
    <div className="space-y-6 select-none font-sans text-slate-900 dark:text-[#F8FAFC]">
      {/* 1. Header: Page Title + Facility Badge + Date Filter + Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-theme pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              WMS Operations Dashboard
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#3B2D54] text-[#A78BFA] border border-[#8B5CF6]/30">
              {warehouse.name || 'Bhiwandi Hub'}
            </span>
          </div>

          {/* Date Filter Dropdown with Today (Default), Yesterday, Last 7 Days, Custom Calendar */}
          <div className="relative mt-2 inline-block" ref={datePickerRef}>
            <button
              id="dashboard-date-filter-button"
              type="button"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E293B] border border-theme text-xs font-medium text-[#F8FAFC] shadow-sm hover:border-[#8B5CF6]/60 cursor-pointer transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span className="font-semibold">{dateFilterLabel}</span>
              <ChevronDown className="w-3 h-3 text-[#64748B]" />
            </button>

            {isDatePickerOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-[#1E293B] border border-theme rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in-50 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
                  Select Date Filter
                </div>

                <div className="space-y-1">
                  {/* All Dates */}
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter('all');
                      setIsDatePickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      dateFilter === 'all'
                        ? 'bg-[#3B2D54] text-[#8B5CF6] font-bold border border-[#8B5CF6]/30'
                        : 'text-[#F8FAFC] hover:bg-[#152238]'
                    }`}
                  >
                    <span>All Saved Dates</span>
                    {dateFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                  </button>

                  {/* Today */}
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter('today');
                      setIsDatePickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      dateFilter === 'today'
                        ? 'bg-[#3B2D54] text-[#8B5CF6] font-bold border border-[#8B5CF6]/30'
                        : 'text-[#F8FAFC] hover:bg-[#152238]'
                    }`}
                  >
                    <span>Today</span>
                    {dateFilter === 'today' && <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                  </button>

                  {/* Yesterday */}
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter('yesterday');
                      setIsDatePickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      dateFilter === 'yesterday'
                        ? 'bg-[#3B2D54] text-[#8B5CF6] font-bold border border-[#8B5CF6]/30'
                        : 'text-[#F8FAFC] hover:bg-[#152238]'
                    }`}
                  >
                    <span>Yesterday</span>
                    {dateFilter === 'yesterday' && <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                  </button>

                  {/* Last 7 Days */}
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter('last_7_days');
                      setIsDatePickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      dateFilter === 'last_7_days'
                        ? 'bg-[#3B2D54] text-[#8B5CF6] font-bold border border-[#8B5CF6]/30'
                        : 'text-[#F8FAFC] hover:bg-[#152238]'
                    }`}
                  >
                    <span>Last 7 Days</span>
                    {dateFilter === 'last_7_days' && <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                  </button>

                  {/* Custom Calendar Range Option */}
                  <button
                    type="button"
                    onClick={() => setDateFilter('custom')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      dateFilter === 'custom'
                        ? 'bg-[#3B2D54] text-[#8B5CF6] font-bold border border-[#8B5CF6]/30'
                        : 'text-[#F8FAFC] hover:bg-[#152238]'
                    }`}
                  >
                    <span>Custom Calendar Range</span>
                    {dateFilter === 'custom' && <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                  </button>
                </div>

                {/* Saved Specific Dates Section */}
                <div className="pt-2 border-t border-theme space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-slate-300">Pick Old / Saved Date</span>
                    {availableDates.length > 0 && (
                      <span className="text-[10px] text-purple-400 font-mono">
                        {availableDates.length} date{availableDates.length > 1 ? 's' : ''} found
                      </span>
                    )}
                  </div>

                  {availableDates.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-0.5 scrollbar-thin">
                      {availableDates.slice(0, 8).map(dStr => {
                        const isSelected = dateFilter === 'specific' && (selectedSpecificDate === dStr || (!selectedSpecificDate && latestDataDate === dStr));
                        const parsed = new Date(dStr + 'T00:00:00');
                        const formatted = isNaN(parsed.getTime()) ? dStr : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return (
                          <button
                            key={dStr}
                            type="button"
                            onClick={() => {
                              setDateFilter('specific');
                              setSelectedSpecificDate(dStr);
                              setIsDatePickerOpen(false);
                            }}
                            className={`px-2 py-1 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#8B5CF6] text-white font-bold'
                                : 'bg-[#152238] hover:bg-[#20304c] text-slate-300'
                            }`}
                          >
                            <span className="truncate">{formatted}</span>
                            {isSelected && <Check className="w-3 h-3 text-white shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <input
                      type="date"
                      value={selectedSpecificDate || latestDataDate || todayStr}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDateFilter('specific');
                          setSelectedSpecificDate(e.target.value);
                          setIsDatePickerOpen(false);
                        }
                      }}
                      className="w-full bg-[#152238] border border-theme rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#8B5CF6] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Custom Date Range Picker Container */}
                {dateFilter === 'custom' && (
                  <div className="pt-2 border-t border-theme space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStartDate(thirtyDaysAgoStr);
                          setCustomEndDate(todayStr);
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-[#152238] hover:bg-[#20304c] text-slate-300 font-semibold text-center cursor-pointer"
                      >
                        1 Month
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStartDate(sixtyDaysAgoStr);
                          setCustomEndDate(todayStr);
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-[#152238] hover:bg-[#20304c] text-slate-300 font-semibold text-center cursor-pointer"
                      >
                        2 Months
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStartDate(ninetyDaysAgoStr);
                          setCustomEndDate(todayStr);
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-[#152238] hover:bg-[#20304c] text-slate-300 font-semibold text-center cursor-pointer"
                      >
                        3 Months
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Start Date</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={e => setCustomStartDate(e.target.value)}
                          className="w-full bg-[#152238] border border-theme rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">End Date</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={e => setCustomEndDate(e.target.value)}
                          className="w-full bg-[#152238] border border-theme rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(false)}
                      className="w-full py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold cursor-pointer transition-colors text-center mt-1"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top Right Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('returns_rto')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-white" />
            <span>Start Return Batch</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('returns_b2b')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EC4899] hover:bg-[#DB2777] text-white text-sm font-semibold shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Boxes className="w-4 h-4 text-white" />
            <span>B2B Returns</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('inward')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-white text-sm font-semibold shadow-xs hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Inward Gate Entry</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Stat KPI Cards in One Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: B2C / RTO Returns */}
        <div
          id="kpi-card-rto-returns"
          onClick={() => onNavigateTab('returns_rto')}
          className="bg-card border border-theme rounded-[20px] p-5 shadow-sm hover:border-[#8B5CF6]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
              B2C / RTO Returns
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#3B2D54] flex items-center justify-center text-[#A78BFA]">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="my-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-[#F8FAFC] leading-none">
                {metrics.totalScanned}
              </span>
              <span className="text-sm font-semibold text-[#64748B]">Units</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-[#10B981]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{filteredB2CBatches.length} Active RTO Batches</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1.5">
              <span>Good QC Pass Rate</span>
              <span className="text-white font-bold">{metrics.goodPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#334155] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8B5CF6] rounded-full transition-all duration-500"
                style={{ width: `${metrics.goodPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Gate Inward Register */}
        <div
          id="kpi-card-gate-inward"
          onClick={() => onNavigateTab('inward')}
          className="bg-card border border-theme rounded-[20px] p-5 shadow-sm hover:border-[#06B6D4]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
              Gate Inward Register
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#164E63] flex items-center justify-center text-[#38BDF8]">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="my-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-[#F8FAFC] leading-none">
                {metrics.inwardVehiclesCount}
              </span>
              <span className="text-sm font-semibold text-[#64748B]">Vehicles</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-[#10B981]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{metrics.totalBoxesUnloaded} Boxes Received</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1.5">
              <span>Boxes Unloaded</span>
              <span className="text-white font-bold">{metrics.totalBoxesUnloaded} Boxes</span>
            </div>
            <div className="w-full h-1.5 bg-[#334155] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#06B6D4] rounded-full transition-all duration-500"
                style={{ width: metrics.inwardVehiclesCount > 0 ? '100%' : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: B2B Return */}
        <div
          id="kpi-card-b2b-returns"
          onClick={() => onNavigateTab('returns_b2b')}
          className="bg-card border border-theme rounded-[20px] p-5 shadow-sm hover:border-[#EC4899]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
              B2B Return
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#501335] flex items-center justify-center text-[#F472B6]">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="my-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-[#F8FAFC] leading-none">
                {metrics.b2bTotalScanned}
              </span>
              <span className="text-sm font-semibold text-[#64748B]">Units</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-[#10B981]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{filteredB2BBatches.length} Active B2B Batches</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1.5">
              <span>Good QC Pass Rate</span>
              <span className="text-white font-bold">{metrics.goodPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#334155] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#EC4899] rounded-full transition-all duration-500"
                style={{ width: `${metrics.goodPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Daily Vehicle & Shipment Summary */}
        <div
          id="kpi-card-vehicle-shipment-summary"
          onClick={() => onNavigateTab('inward')}
          className="bg-card border border-theme rounded-[20px] p-5 shadow-sm hover:border-[#10B981]/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
              Daily Shipment Summary
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#064E3B] flex items-center justify-center text-[#34D399]">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="my-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-[#F8FAFC] leading-none">
                {metrics.totalBoxesUnloaded}
              </span>
              <span className="text-sm font-semibold text-[#64748B]">Boxes Today</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#10B981]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{filteredGateEntries.filter(g => g.status === 'Completed' || g.status === 'Gate Out').length} of {filteredGateEntries.length} Vehicles Cleared</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] mb-1.5">
              <span>Dock Inward Clearance</span>
              <span className="text-white font-bold">
                {filteredGateEntries.length > 0
                  ? Math.round((filteredGateEntries.filter(g => g.status === 'Completed' || g.status === 'Gate Out').length / filteredGateEntries.length) * 100)
                  : 100}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#334155] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#10B981] rounded-full transition-all duration-500"
                style={{
                  width: `${filteredGateEntries.length > 0
                    ? Math.round((filteredGateEntries.filter(g => g.status === 'Completed' || g.status === 'Gate Out').length / filteredGateEntries.length) * 100)
                    : 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Middle Section: Area Chart (Live Ops Trends) + Donut Chart (Account Distribution by Count) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Area Chart: Live Operations (Span 2) */}
        <div className="lg:col-span-2 bg-card border border-theme rounded-[20px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">
                Operations & Hourly Scan Trends
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Hourly throughput of processed AWB units ({dateFilterLabel})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                Throughput Overview
              </span>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis
                  dataKey="time"
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1E293B] border border-theme rounded-xl p-3 shadow-lg text-xs">
                          <div className="font-semibold text-[#F8FAFC] mb-1">{label}</div>
                          <div className="text-[#8B5CF6] font-semibold">Total Scans: {payload[0]?.value} units</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="scans"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#purpleGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Account Distribution by Count (Span 1) */}
        <div id="account-distribution-donut" className="bg-card border border-theme rounded-[20px] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">
                Account Distribution by Count
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Client share of processed returns ({accountDistributionFilter === 'top4' ? 'Top 4' : 'All'})
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                id="donut-account-filter-select"
                value={accountDistributionFilter}
                onChange={(e) => setAccountDistributionFilter(e.target.value)}
                className="bg-[#152238] border border-theme rounded-lg px-2 py-1 text-xs text-[#F8FAFC] font-semibold focus:outline-none focus:border-[#8B5CF6] cursor-pointer"
                title="Filter Account Distribution"
              >
                <option value="top4">Top 4 Accounts</option>
                <option value="all">All Accounts ({clientAccountsList.length})</option>
                {clientAccountsList.length > 0 && (
                  <optgroup label="Single Account">
                    {clientAccountsList.map((entry, idx) => (
                      <option key={entry.id} value={entry.id}>
                        #{idx + 1} {entry.name} ({entry.count})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {displayedAccountsList.length > 3 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('account-distribution-legend-scroll');
                      if (el) el.scrollBy({ left: -140, behavior: 'smooth' });
                    }}
                    className="w-6 h-6 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-theme text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title="Slide left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('account-distribution-legend-scroll');
                      if (el) el.scrollBy({ left: 140, behavior: 'smooth' });
                    }}
                    className="w-6 h-6 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-theme text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title="Slide right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="relative h-[180px] w-full my-2 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="90%"
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-[#F8FAFC] font-mono">
                {metrics.totalScanned}
              </span>
              <span className="text-[11px] font-semibold text-[#64748B]">Total Units</span>
            </div>
          </div>

          {/* Horizontal Slide / Scroll Accounts Legend (Shows top 4 accounts on top by default) */}
          <div className="pt-2.5 border-t border-theme">
            <div
              id="account-distribution-legend-scroll"
              className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scroll-smooth scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent snap-x"
            >
              {displayedAccountsList.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#152238] border border-theme shrink-0 snap-start text-xs min-w-[125px] max-w-[150px] hover:border-[#8B5CF6]/40 transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <div className="truncate flex-1 min-w-0">
                    <div className="font-semibold text-[#F8FAFC] truncate text-[11px]" title={entry.name}>
                      {entry.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {entry.count} <span className="text-slate-500">({entry.pct}%)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Section: Account Distribution by Count List + QC Condition Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Account Distribution by Count (Span 2) */}
        <div id="account-distribution-by-count-list" className="lg:col-span-2 bg-card border border-theme rounded-[20px] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Account Distribution by Count
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/40">
                  {accountDistributionFilter === 'top4' ? 'Top 4 Accounts' : accountDistributionFilter === 'all' ? 'All Accounts' : 'Filtered Account'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Processed unit volume and percentage share per client account (sorted by top scanned quantity)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="account-distribution-select" className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                Account:
              </label>
              <select
                id="account-distribution-select"
                value={accountDistributionFilter}
                onChange={(e) => setAccountDistributionFilter(e.target.value)}
                className="bg-[#152238] border border-theme rounded-xl px-3 py-1.5 text-xs text-[#F8FAFC] font-semibold focus:outline-none focus:border-[#8B5CF6] cursor-pointer shadow-xs"
              >
                <option value="top4">Top 4 Accounts (Top Qty Scanned)</option>
                <option value="all">All Accounts ({clientAccountsList.length})</option>
                {clientAccountsList.length > 0 && (
                  <optgroup label="Select Specific Account">
                    {clientAccountsList.map((client, idx) => (
                      <option key={client.id} value={client.id}>
                        #{idx + 1} {client.name} — {client.count} units ({client.pct}%)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <button
                onClick={() => onNavigateTab('masters')}
                className="text-xs font-semibold text-[#8B5CF6] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap ml-1"
              >
                Manage Masters <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-theme">
            {displayedAccountsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No accounts found with scan records for the selected period.
              </div>
            ) : (
              displayedAccountsList.map((client) => (
                <div
                  key={client.id}
                  className={`py-3.5 first:pt-1 last:pb-1 px-2 -mx-2 rounded-xl transition-all duration-500 ${
                    client.id === liveAccountId && client.lastScanAt > 0
                      ? 'bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/40'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: client.color }} />
                      <span className="text-sm font-semibold text-[#F8FAFC]">
                        {client.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ({client.code})
                      </span>
                      {client.id === liveAccountId && client.lastScanAt > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
                          LATEST SCAN
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-xs font-medium text-slate-300 bg-[#152238] px-2.5 py-0.5 rounded-full border border-theme font-mono">
                        {client.count} units
                      </span>
                      <span className="font-semibold text-[#64748B] min-w-[36px] text-right font-mono">
                        {client.pct}%
                      </span>
                    </div>
                  </div>
                  {/* Mini Progress Bar below name */}
                  <div className="w-full h-1 bg-[#334155] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${client.pct}%`,
                        backgroundColor: client.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {accountDistributionFilter === 'top4' && clientAccountsList.length > 4 && (
            <div className="pt-3 mt-2 border-t border-theme flex items-center justify-between text-xs text-slate-400">
              <span>Showing top 4 accounts by quantity scanned ({clientAccountsList.length} total).</span>
              <button
                type="button"
                onClick={() => setAccountDistributionFilter('all')}
                className="text-xs font-semibold text-[#8B5CF6] hover:underline cursor-pointer"
              >
                View all {clientAccountsList.length} accounts →
              </button>
            </div>
          )}
        </div>

        {/* QC Condition Breakdown & Circular Progress Ring (Span 1) */}
        <div className="bg-card border border-theme rounded-[20px] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              QC Condition Status
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Live inspection triage breakdown in period
            </p>
          </div>

          {/* Progress Ring */}
          <div className="flex items-center justify-center my-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#334155"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="url(#progressRingGradient)"
                  strokeWidth="8"
                  strokeDasharray={`${metrics.goodPct * 2.51} 251.2`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="progressRingGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-[#F8FAFC]">
                  {metrics.goodPct}%
                </span>
                <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wide">
                  Pass Rate
                </span>
              </div>
            </div>
          </div>

          {/* 4 Condition Summary Badges */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-theme text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-bold">
              <span>Good</span>
              <span className="font-mono">{metrics.goodCount}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-950/40 text-rose-300 border border-rose-800/40 font-bold">
              <span>Damage</span>
              <span className="font-mono">{metrics.damageCount}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-950/40 text-amber-300 border border-amber-800/40 font-bold">
              <span>Open Box</span>
              <span className="font-mono">{metrics.openBoxCount}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-950/40 text-purple-300 border border-purple-800/40 font-bold">
              <span>Wrong Prod</span>
              <span className="font-mono">{metrics.wrongProdCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Daily Vehicle & Shipment Summary */}
      <div id="dashboard-daily-vehicle-summary" className="bg-card border border-theme rounded-[20px] p-6 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#164E63] flex items-center justify-center text-[#38BDF8]">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Daily Vehicle & Shipment Summary
              </h2>
              <p className="text-xs text-[#64748B]">
                Registered inward vehicles and shipment manifests for {dateFilterLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('inward')}
            className="text-xs font-semibold text-[#38BDF8] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            Gate Inward Register <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-theme">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#152238] text-[#94A3B8] uppercase font-bold text-[10px] border-b border-theme">
              <tr>
                <th className="px-3.5 py-2.5">Vehicle Number</th>
                <th className="px-3.5 py-2.5">Transporter / Courier</th>
                <th className="px-3.5 py-2.5">Driver & Mobile</th>
                <th className="px-3.5 py-2.5">Dock</th>
                <th className="px-3.5 py-2.5 text-center">Expected Boxes</th>
                <th className="px-3.5 py-2.5 text-center">Received Boxes</th>
                <th className="px-3.5 py-2.5">Gate In Time</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme text-[#F8FAFC]">
              {filteredGateEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    No vehicle movements recorded for {dateFilterLabel}.
                  </td>
                </tr>
              ) : (
                filteredGateEntries.slice(0, 10).map(g => (
                  <tr key={g.id} className="hover:bg-[#152238]/60 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-white">{g.vehicleNumber}</td>
                    <td className="px-3.5 py-2.5 text-slate-300">{g.courierPartner || g.transporter || '—'}</td>
                    <td className="px-3.5 py-2.5 text-slate-300">
                      {g.driverName} {g.driverMobile && <span className="font-mono text-[10px] text-slate-400">({g.driverMobile})</span>}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono font-semibold">{g.dockNumber || 'Dock 01'}</td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-300">{g.expectedBoxes || 0}</td>
                    <td className="px-3.5 py-2.5 text-center font-mono font-extrabold text-[#10B981]">
                      {g.receivedBoxes || g.expectedBoxes || 0}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-400">
                      {g.gateInTime ? new Date(g.gateInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          g.status === 'Completed' || g.status === 'Gate Out'
                            ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                            : g.status === 'In Unloading' || g.status === 'Under QC'
                            ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                            : 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/40'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Operations Activity Stream (Filtered Feed) */}
      <div className="bg-card border border-theme rounded-[20px] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3B2D54] flex items-center justify-center text-[#A78BFA]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Live Operations Feed
              </h2>
              <p className="text-xs text-[#64748B]">
                Recent gate entries, return batches, and warehouse events ({dateFilterLabel})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="text-xs font-semibold text-[#A78BFA] hover:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Full Operational Log <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-theme">
          {recentActivities.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              No live operations recorded for {dateFilterLabel}.
            </div>
          ) : (
            recentActivities.map((act) => (
              <div key={act.id} className="py-3 flex items-center justify-between gap-4 first:pt-1 last:pb-1">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-transparent bg-slate-800 text-slate-300 shadow-2xs"
                  >
                    {act.type === 'inward' ? (
                      <Truck className="w-4 h-4 text-cyan-400" />
                    ) : act.type === 'b2b' ? (
                      <Boxes className="w-4 h-4 text-pink-400" />
                    ) : act.type === 'return' ? (
                      <RotateCcw className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Scan className="w-4 h-4 text-teal-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {act.title}
                    </div>
                    <div className="text-xs text-[#64748B]">
                      {act.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-transparent bg-slate-800 text-slate-300"
                  >
                    {act.status}
                  </span>
                  <span className="text-xs text-[#94A3B8] font-mono hidden sm:inline">
                    {act.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
