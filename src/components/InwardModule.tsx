import React, { useState } from 'react';
import {
  Truck,
  Search,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Package,
  Layers,
  ArrowRight,
  Eye,
  Building2,
  RotateCcw,
} from 'lucide-react';
import {
  InwardGateEntry,
  Warehouse,
  Client,
  Courier,
  VehicleType,
  User,
  Driver,
  Phase1SecurityData,
  Phase2UnloadingData,
  Phase3HandoverData,
} from '../types';
import { generateGatePassPDF } from '../utils/pdfGenerator';
import { Phase1SecurityModal } from './inward/Phase1SecurityModal';
import { Phase2DockQCModal } from './inward/Phase2DockQCModal';
import { Phase3HandoverModal } from './inward/Phase3HandoverModal';
import { GateEntryDetailsModal } from './inward/GateEntryDetailsModal';

interface InwardModuleProps {
  currentUser: User;
  activeWarehouse: Warehouse;
  gateEntries: InwardGateEntry[];
  clients: Client[];
  couriers: Courier[];
  vehicleTypes: VehicleType[];
  drivers?: Driver[];
  onAddGateEntry: (entry: Omit<InwardGateEntry, 'id' | 'gatePassNumber' | 'entryTime'> & { phase1Data?: Phase1SecurityData }) => void;
  onUpdateGateStatus: (id: string, status: InwardGateEntry['status'], dockNumber?: string) => void;
  onUpdateGateEntryPhase2?: (id: string, phase2Data: Phase2UnloadingData) => void;
  onUpdateGateEntryPhase3?: (id: string, phase3Data: Phase3HandoverData) => void;
  isOpenCreateModal: boolean;
  onCloseCreateModal: () => void;
  initialTab?: 'inward' | 'b2b';
}

export const InwardModule: React.FC<InwardModuleProps> = ({
  currentUser,
  activeWarehouse,
  gateEntries,
  clients,
  couriers,
  vehicleTypes,
  drivers = [],
  onAddGateEntry,
  onUpdateGateStatus,
  onUpdateGateEntryPhase2,
  onUpdateGateEntryPhase3,
  isOpenCreateModal,
  onCloseCreateModal,
  initialTab = 'inward',
}) => {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'inward' | 'b2b'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('IN_PROGRESS');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');

  // Modals state
  const [phase2TargetEntry, setPhase2TargetEntry] = useState<InwardGateEntry | null>(null);
  const [phase3TargetEntry, setPhase3TargetEntry] = useState<InwardGateEntry | null>(null);
  const [detailsTargetEntry, setDetailsTargetEntry] = useState<InwardGateEntry | null>(null);

  // Filter gate entries for current warehouse and workflow tab
  const warehouseEntries = gateEntries.filter(e => {
    if (e.warehouseId !== activeWarehouse.id) return false;
    const isB2BEntry = e.entryType === 'B2B Return' || e.gatePassNumber.startsWith('B2B');
    return activeWorkflowTab === 'b2b' ? isB2BEntry : !isB2BEntry;
  });

  // Status helper functions
  const isEntryCompleted = (e: InwardGateEntry) =>
    e.status === 'Completed' || e.status === 'Handover Completed' || !!e.phase3;

  const isEntryHandoverPending = (e: InwardGateEntry) =>
    !isEntryCompleted(e) && (e.status === 'Handover Pending' || e.status === 'QC Completed' || (!!e.phase2 && !e.phase3));

  const isEntryInProgress = (e: InwardGateEntry) =>
    !isEntryCompleted(e) && !isEntryHandoverPending(e);

  // Filtered entries based on search and status tabs
  const filteredEntries = warehouseEntries.filter(entry => {
    // Status filtering
    if (statusFilter === 'IN_PROGRESS') {
      if (!isEntryInProgress(entry)) return false;
    } else if (statusFilter === 'HANDOVER_PENDING') {
      if (!isEntryHandoverPending(entry)) return false;
    } else if (statusFilter === 'COMPLETED') {
      if (!isEntryCompleted(entry)) return false;
    }

    // Account filtering
    if (accountFilter !== 'ALL' && entry.clientId !== accountFilter) {
      return false;
    }

    // Search query
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const client = clients.find(c => c.id === entry.clientId);
    const courier = couriers.find(cr => cr.id === entry.courierId);
    const dockets = entry.phase2?.dockets || [];
    const hasDocketMatch = dockets.some(d =>
      d.docketNumber.toLowerCase().includes(q) ||
      d.invoices.some(i => i.invoiceNumber.toLowerCase().includes(q))
    );

    return (
      entry.gatePassNumber.toLowerCase().includes(q) ||
      entry.vehicleNumber.toLowerCase().includes(q) ||
      entry.driverName.toLowerCase().includes(q) ||
      entry.driverMobile.includes(q) ||
      (client && client.name.toLowerCase().includes(q)) ||
      (courier && courier.name.toLowerCase().includes(q)) ||
      (entry.courierPartner && entry.courierPartner.toLowerCase().includes(q)) ||
      (entry.transporterName && entry.transporterName.toLowerCase().includes(q)) ||
      (entry.dockNumber && entry.dockNumber.toLowerCase().includes(q)) ||
      hasDocketMatch
    );
  });

  // Workflow KPI Metrics for the active workflow tab
  const inProgressCount = warehouseEntries.filter(isEntryInProgress).length;
  const handoverPendingCount = warehouseEntries.filter(isEntryHandoverPending).length;
  const completedEntries = warehouseEntries.filter(isEntryCompleted);
  const completedCount = completedEntries.length;
  const totalCompletedBoxes = completedEntries.reduce((sum, e) => {
    return sum + (e.phase3?.receivedBoxesConfirmed ?? e.receivedBoxCount ?? 0);
  }, 0);

  // Tab counts for badges
  const totalInwardCount = gateEntries.filter(
    e => e.warehouseId === activeWarehouse.id && !(e.entryType === 'B2B Return' || e.gatePassNumber.startsWith('B2B'))
  ).length;
  const totalB2BCount = gateEntries.filter(
    e => e.warehouseId === activeWarehouse.id && (e.entryType === 'B2B Return' || e.gatePassNumber.startsWith('B2B'))
  ).length;

  // Submit Phase 1
  const handlePhase1Submit = (entryData: any) => {
    onAddGateEntry(entryData);
  };

  // Submit Phase 2
  const handlePhase2Submit = (gateEntryId: string, phase2Data: Phase2UnloadingData) => {
    if (onUpdateGateEntryPhase2) {
      onUpdateGateEntryPhase2(gateEntryId, phase2Data);
    } else {
      onUpdateGateStatus(gateEntryId, 'QC Completed', phase2Data.dockConfirmed);
    }
  };

  // Submit Phase 3
  const handlePhase3Submit = (gateEntryId: string, phase3Data: Phase3HandoverData) => {
    if (onUpdateGateEntryPhase3) {
      onUpdateGateEntryPhase3(gateEntryId, phase3Data);
    } else {
      onUpdateGateStatus(gateEntryId, 'Handover Completed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Navigation Tabs: Inward Gate Entry vs B2B Return / RTV */}
      <div className="flex items-center justify-between border-b border-theme pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveWorkflowTab('inward');
              setStatusFilter('IN_PROGRESS');
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer border ${
              activeWorkflowTab === 'inward'
                ? 'bg-[#123B5D] text-white border-[#123B5D] shadow-sm dark:bg-blue-600 dark:border-blue-500'
                : 'bg-surface text-secondary hover:text-primary hover:bg-elevated border-theme'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Inward Gate Entry</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeWorkflowTab === 'inward'
                ? 'bg-white/20 text-white'
                : 'bg-elevated text-secondary border border-theme'
            }`}>
              {totalInwardCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWorkflowTab('b2b');
              setStatusFilter('IN_PROGRESS');
            }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer border ${
              activeWorkflowTab === 'b2b'
                ? 'bg-purple-700 text-white border-purple-700 shadow-sm dark:bg-purple-600 dark:border-purple-500'
                : 'bg-surface text-secondary hover:text-primary hover:bg-elevated border-theme'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>B2B Return / RTV</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeWorkflowTab === 'b2b'
                ? 'bg-white/20 text-white'
                : 'bg-elevated text-secondary border border-theme'
            }`}>
              {totalB2BCount}
            </span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl ${activeWorkflowTab === 'b2b' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'} flex items-center justify-center font-bold`}>
              {activeWorkflowTab === 'b2b' ? <RotateCcw className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            </div>
            <h1 className="text-xl font-extrabold text-primary">
              {activeWorkflowTab === 'b2b' ? 'B2B Return / RTV Gate Entry' : 'Inward Gate Entry'}
            </h1>
          </div>
          <p className="text-xs text-secondary mt-1">
            {activeWorkflowTab === 'b2b'
              ? `Manage B2B store return & RTV vehicle check-in, dock QC verification, and custodial handover at ${activeWarehouse.name}.`
              : `Manage vehicle check-in, dock unloading & QC verification, and account handover at ${activeWarehouse.name}.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onCloseCreateModal}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${
              activeWorkflowTab === 'b2b'
                ? 'bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700'
                : 'bg-[#123B5D] hover:bg-[#0D2E49] dark:bg-blue-600 dark:hover:bg-blue-700'
            } text-white font-extrabold text-xs shadow-md transition-all cursor-pointer`}
          >
            <span>{activeWorkflowTab === 'b2b' ? '+ New B2B Return Entry' : '+ New Inward Entry'}</span>
          </button>
        </div>
      </div>

      {/* Top Workflow Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Card 1: In Progress */}
        <div className="p-4 rounded-xl bg-surface border border-theme shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase font-bold tracking-wider">In Progress</span>
            <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono">{inProgressCount} Active</span>
          </div>
        </div>

        {/* Card 2: Handover Pending */}
        <div className="p-4 rounded-xl bg-surface border border-theme shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase font-bold tracking-wider">Handover Pending</span>
            <span className="text-lg font-extrabold text-purple-600 dark:text-purple-400 font-mono">{handoverPendingCount} Pending</span>
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="p-4 rounded-xl bg-surface border border-theme shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase font-bold tracking-wider">Completed</span>
            <span className="text-lg font-extrabold text-primary font-mono">{completedCount} Completed</span>
          </div>
        </div>

        {/* Card 4: Total Cartons / Boxes */}
        <div className="p-4 rounded-xl bg-surface border border-theme shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase font-bold tracking-wider">Total Cartons / Boxes</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{totalCompletedBoxes} Received</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface border border-theme p-4 rounded-xl shadow-xs transition-colors">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={activeWorkflowTab === 'b2b' ? "Search B2B Entry ID, Store, Vehicle No, Driver, Courier, Docket, Invoice..." : "Search Gate Entry ID, Vehicle No, Driver, Courier, Docket, Invoice..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-elevated border border-theme text-xs text-primary placeholder:text-muted rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-blue-500 font-medium"
          />
        </div>

        {/* Dynamic Account Filter + Status Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Account Filter */}
          <div className="flex items-center gap-1.5 bg-elevated border border-theme px-3 py-1.5 rounded-xl text-xs">
            <Building2 className="w-3.5 h-3.5 text-muted" />
            <select
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
              className="bg-transparent text-primary font-bold text-xs focus:outline-none cursor-pointer [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC] [&>option]:py-1.5"
            >
              <option value="ALL" className="bg-[#1E293B] text-[#F8FAFC]">All Accounts</option>
              {clients.map(c => (
                <option key={c.id} value={c.id} className="bg-[#1E293B] text-[#F8FAFC]">{c.name}</option>
              ))}
            </select>
          </div>

          {/* Workflow Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { label: 'In Progress', value: 'IN_PROGRESS' },
              { label: 'Handover Pending', value: 'HANDOVER_PENDING' },
              { label: 'Completed', value: 'COMPLETED' },
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                  statusFilter === tab.value
                    ? 'bg-[#123B5D] dark:bg-blue-600 text-white border-[#123B5D] dark:border-blue-500 shadow-xs'
                    : 'bg-elevated text-secondary hover:text-primary border-theme hover:bg-elevated/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Gate Entries Workflow Table */}
      <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-theme bg-elevated/60 text-secondary text-[11px] font-extrabold uppercase tracking-wider">
                <th className="py-3.5 px-4">Gate Entry ID & Time</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4">Account & Courier / Transporter</th>
                <th className="py-3.5 px-4">Dock & Volume</th>
                <th className="py-3.5 px-4">Workflow Status</th>
                <th className="py-3.5 px-4">QC Breakdown</th>
                <th className="py-3.5 px-4 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme text-xs">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted font-mono text-xs">
                    {activeWorkflowTab === 'b2b'
                      ? 'No B2B return gate entries match the selected filters.'
                      : 'No inward gate entries match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => {
                  const client = clients.find(c => c.id === entry.clientId);
                  const courier = couriers.find(cr => cr.id === entry.courierId);
                  const vehicleType = vehicleTypes.find(vt => vt.id === entry.vehicleTypeId);

                  const isCompleted = isEntryCompleted(entry);
                  const isHandoverPending = isEntryHandoverPending(entry);
                  const isInProgress = isEntryInProgress(entry);

                  const displayCourier = entry.courierPartner || entry.courierName || courier?.name || 'Courier Partner';
                  const isB2BEntry = entry.entryType === 'B2B Return' || entry.gatePassNumber.startsWith('B2B');

                  return (
                    <tr key={entry.id} className="hover:bg-elevated/40 transition-colors">
                      {/* Gate Entry ID */}
                      <td className="py-3.5 px-4">
                        <div className={`font-mono font-extrabold ${isB2BEntry ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'} text-xs`}>
                          {entry.gatePassNumber}
                        </div>
                        <div className="text-[10px] text-muted font-mono mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{entry.phase1?.gateEntryDateTime || new Date(entry.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>

                      {/* Vehicle & Driver */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-primary flex items-center gap-1.5 font-mono">
                          {entry.vehicleNumber}
                          <span className="text-[10px] font-sans font-normal text-muted">
                            ({vehicleType?.typeName || 'Truck'})
                          </span>
                        </div>
                        <div className="text-[11px] text-secondary mt-0.5">
                          {entry.driverName} <span className="text-muted font-mono">({entry.driverMobile})</span>
                        </div>
                      </td>

                      {/* Account & Courier / Transporter */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-primary flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{client ? client.name : 'Account'}</span>
                        </div>
                        <div className="text-[11px] text-secondary mt-0.5">
                          <span>{displayCourier}</span>
                          {entry.transporterName && (
                            <span className="text-muted text-[10px] block">Transporter: {entry.transporterName}</span>
                          )}
                        </div>
                      </td>

                      {/* Dock & Volume */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                          {entry.dockNumber || 'Dock 01'}
                        </div>
                        <div className="text-[11px] text-secondary font-mono mt-0.5">
                          {entry.phase3 ? (
                            <span className="text-emerald-600 font-bold">{entry.phase3.receivedBoxesConfirmed} Boxes Received</span>
                          ) : entry.phase2 ? (
                            <span>{entry.phase2.totalBoxesCount} Boxes Verified</span>
                          ) : (
                            <span>{entry.expectedBoxCount || 0} Declared</span>
                          )}
                        </div>
                      </td>

                      {/* Workflow Status */}
                      <td className="py-3.5 px-4">
                        {isCompleted ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : isHandoverPending ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Handover Pending
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 w-fit">
                            <Package className="w-3 h-3" /> In Progress
                          </span>
                        )}
                      </td>

                      {/* QC Breakdown */}
                      <td className="py-3.5 px-4">
                        {entry.phase2 ? (
                          <div className="text-[10px] font-mono space-y-0.5">
                            <div className="text-secondary">
                              <strong>{entry.phase2.totalDocketsCount}</strong> Dkts | <strong>{entry.phase2.totalInvoicesCount}</strong> Invs
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-600 font-bold">{entry.phase2.goodCount} Good</span>
                              {(entry.phase2.damageCount > 0 || entry.phase2.openBoxesCount > 0 || entry.phase2.missingBoxesCount > 0) && (
                                <span className="text-rose-600 font-bold">
                                  {(entry.phase2.damageCount || 0) + (entry.phase2.openBoxesCount || 0) + (entry.phase2.missingBoxesCount || 0)} Issue
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted italic">Awaiting Dock QC</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* Action: Open Dock QC if In Progress */}
                        {isInProgress && (
                          <button
                            onClick={() => setPhase2TargetEntry(entry)}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Dock QC</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {/* Action: Open Handover if Dock QC completed and handover is pending */}
                        {isHandoverPending && (
                          <button
                            onClick={() => setPhase3TargetEntry(entry)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Account Handover</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {/* View Full Record Modal */}
                        <button
                          onClick={() => setDetailsTargetEntry(entry)}
                          className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary border border-theme inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="View Gate Entry Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Download Gate Pass PDF */}
                        <button
                          onClick={() => generateGatePassPDF(entry, activeWarehouse, client, courier, isB2BEntry)}
                          className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary border border-theme inline-flex items-center justify-center transition-colors cursor-pointer"
                          title="Download Gate Pass PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Check-In Modal */}
      <Phase1SecurityModal
        isOpen={isOpenCreateModal}
        onClose={onCloseCreateModal}
        currentUser={currentUser}
        activeWarehouse={activeWarehouse}
        clients={clients}
        couriers={couriers}
        vehicleTypes={vehicleTypes}
        drivers={drivers}
        onSubmitPhase1={handlePhase1Submit}
        isB2B={activeWorkflowTab === 'b2b'}
      />

      {/* Dock QC Modal */}
      <Phase2DockQCModal
        isOpen={!!phase2TargetEntry}
        entry={phase2TargetEntry}
        onClose={() => setPhase2TargetEntry(null)}
        currentUser={currentUser}
        activeWarehouse={activeWarehouse}
        clients={clients}
        couriers={couriers}
        onSubmitPhase2={handlePhase2Submit}
      />

      {/* Account Handover Modal */}
      <Phase3HandoverModal
        isOpen={!!phase3TargetEntry}
        entry={phase3TargetEntry}
        onClose={() => setPhase3TargetEntry(null)}
        currentUser={currentUser}
        activeWarehouse={activeWarehouse}
        clients={clients}
        onSubmitPhase3={handlePhase3Submit}
      />

      {/* Gate Entry Details Modal */}
      <GateEntryDetailsModal
        isOpen={!!detailsTargetEntry}
        entry={detailsTargetEntry}
        onClose={() => setDetailsTargetEntry(null)}
        warehouse={activeWarehouse}
        clients={clients}
        couriers={couriers}
        vehicleTypes={vehicleTypes}
        onOpenPhase2={entry => {
          setPhase2TargetEntry(entry);
        }}
        onOpenPhase3={entry => {
          setPhase3TargetEntry(entry);
        }}
      />
    </div>
  );
};
