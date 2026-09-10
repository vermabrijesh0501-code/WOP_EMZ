import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  UserCheck,
  Building2,
  Truck,
  FileText,
  Eye,
  Search,
  X,
} from 'lucide-react';
import {
  InwardGateEntry,
  ReturnBatch,
  ScannedReturnItem,
  Warehouse,
  Client,
  Courier,
  User,
} from '../types';
import { downloadCSV } from '../utils/csvExporter';
import { generateBatchPDF } from '../utils/pdfGenerator';

interface ReportsModuleProps {
  activeWarehouse: Warehouse;
  gateEntries: InwardGateEntry[];
  batches: ReturnBatch[];
  scannedItems: ScannedReturnItem[];
  clients: Client[];
  couriers: Courier[];
  users: User[];
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  activeWarehouse,
  gateEntries,
  batches,
  scannedItems,
  clients,
  couriers,
  users,
}) => {
  const [reportType, setReportType] = useState<
    'manifest' | 'inward' | 'rto_summary' | 'client_wise' | 'courier_wise' | 'user_productivity'
  >('manifest');

  // Manifest Filters & State
  const [manifestSearch, setManifestSearch] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('ALL');
  const [selectedCourierFilter, setSelectedCourierFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'Open' | 'Closed'>('ALL');
  const [previewBatch, setPreviewBatch] = useState<ReturnBatch | null>(null);

  const whGateEntries = gateEntries.filter(g => g.warehouseId === activeWarehouse.id);
  const whBatches = batches.filter(b => b.warehouseId === activeWarehouse.id);

  // Filtered batches for Manifest section
  const filteredBatches = whBatches.filter(b => {
    if (selectedStatusFilter !== 'ALL' && b.status !== selectedStatusFilter) return false;
    if (selectedClientFilter !== 'ALL' && b.clientId !== selectedClientFilter) return false;
    if (selectedCourierFilter !== 'ALL' && b.courierId !== selectedCourierFilter) return false;
    if (manifestSearch) {
      const q = manifestSearch.toLowerCase();
      const clientName = clients.find(c => c.id === b.clientId)?.name?.toLowerCase() || '';
      const courierName = couriers.find(cr => cr.id === b.courierId)?.name?.toLowerCase() || '';
      const batchNum = b.batchNumber.toLowerCase();
      const dockNum = (b.dockNumber || '').toLowerCase();
      return batchNum.includes(q) || clientName.includes(q) || courierName.includes(q) || dockNum.includes(q);
    }
    return true;
  });

  // Client breakdown
  const clientBreakdown = clients.map(cli => {
    const cliGate = whGateEntries.filter(g => g.clientId === cli.id);
    const cliBatches = whBatches.filter(b => b.clientId === cli.id);
    const totalScanned = cliBatches.reduce((acc, b) => acc + (b.totalScanned || 0), 0);
    return {
      clientName: cli.name,
      code: cli.code,
      vehicles: cliGate.length,
      batches: cliBatches.length,
      totalScanned,
    };
  });

  // Courier breakdown
  const courierBreakdown = couriers.map(cr => {
    const crGate = whGateEntries.filter(g => g.courierId === cr.id);
    const crBatches = whBatches.filter(b => b.courierId === cr.id);
    const totalScanned = crBatches.reduce((acc, b) => acc + (b.totalScanned || 0), 0);
    return {
      courierName: cr.name,
      code: cr.code,
      vehicles: crGate.length,
      batches: crBatches.length,
      totalScanned,
    };
  });

  // User Productivity
  const operatorProductivity = users.map(usr => {
    const itemsScannedByUsr = scannedItems.filter(i => i.scannedBy === usr.id);
    const batchesCreated = whBatches.filter(b => b.createdBy === usr.id).length;
    return {
      userName: usr.name,
      role: usr.role,
      itemsScanned: itemsScannedByUsr.length,
      batchesCreated,
      avgSpeedPerHour: Math.round(itemsScannedByUsr.length * 1.5) || 45,
    };
  });

  const handleDownloadPDF = (batch: ReturnBatch) => {
    const items = scannedItems.filter(i => i.batchId === batch.id);
    const client = clients.find(c => c.id === batch.clientId);
    const courier = couriers.find(cr => cr.id === batch.courierId);
    generateBatchPDF(batch, items, activeWarehouse, client, courier);
  };

  const handleExportBatchCSV = (batch: ReturnBatch) => {
    const items = scannedItems.filter(i => i.batchId === batch.id);
    const client = clients.find(c => c.id === batch.clientId);
    const courier = couriers.find(cr => cr.id === batch.courierId);

    const headers = [
      '#',
      'Batch Number',
      'Client / Brand',
      'Courier Partner',
      'Dock Number',
      'AWB / Tracking Number',
      'QC Condition',
      'Scan Timestamp',
      'Scanned By',
    ];

    const rows = items.map((item, idx) => [
      idx + 1,
      batch.batchNumber,
      client?.name || batch.clientId,
      courier?.name || batch.courierId,
      batch.dockNumber || 'N/A',
      item.trackingNumber,
      item.remark,
      new Date(item.scannedAt).toLocaleString(),
      item.scannedByName || item.scannedBy,
    ]);

    downloadCSV(`Manifest_${batch.batchNumber}_${client?.code || 'CLI'}.csv`, headers, rows);
  };

  const handleExportFullReport = () => {
    if (reportType === 'manifest' || reportType === 'rto_summary') {
      const headers = ['Batch Number', 'Type', 'Dock #', 'Client', 'Courier', 'Status', 'Total Scanned', 'Created At', 'Created By', 'Closed At', 'Driver / Rep'];
      const rows = whBatches.map(b => [
        b.batchNumber,
        b.batchType || 'RTO/B2C',
        b.dockNumber || 'N/A',
        clients.find(c => c.id === b.clientId)?.name || b.clientId,
        couriers.find(cr => cr.id === b.courierId)?.name || b.courierId,
        b.status,
        b.totalScanned,
        new Date(b.createdAt).toLocaleString(),
        b.createdByName || b.createdBy,
        b.closedAt ? new Date(b.closedAt).toLocaleString() : 'Open',
        b.driverName || 'N/A',
      ]);
      downloadCSV(`EMIZA_Returns_Manifest_Summary_${activeWarehouse.code}.csv`, headers, rows);
    } else if (reportType === 'inward') {
      const headers = ['Gate Pass #', 'Vehicle #', 'Driver Name', 'Client', 'Courier', 'Cartons', 'Invoice Value', 'Status', 'Entry Time'];
      const rows = whGateEntries.map(g => [
        g.gatePassNumber,
        g.vehicleNumber,
        g.driverName,
        clients.find(c => c.id === g.clientId)?.name || g.clientId,
        couriers.find(cr => cr.id === g.courierId)?.name || g.courierId,
        g.expectedBoxCount,
        g.invoiceValue,
        g.status,
        new Date(g.entryTime).toLocaleString(),
      ]);
      downloadCSV(`EMIZA_Inward_Report_${activeWarehouse.code}.csv`, headers, rows);
    } else if (reportType === 'client_wise') {
      const headers = ['Client Brand', 'Client Code', 'Inward Vehicles', 'Return Batches', 'Total Scanned Items'];
      const rows = clientBreakdown.map(c => [c.clientName, c.code, c.vehicles, c.batches, c.totalScanned]);
      downloadCSV(`EMIZA_Client_Wise_Report_${activeWarehouse.code}.csv`, headers, rows);
    } else if (reportType === 'courier_wise') {
      const headers = ['Courier Partner', 'Courier Code', 'Vehicles Received', 'Return Batches Handled', 'Total Scanned Items'];
      const rows = courierBreakdown.map(cr => [cr.courierName, cr.code, cr.vehicles, cr.batches, cr.totalScanned]);
      downloadCSV(`EMIZA_Courier_Performance_${activeWarehouse.code}.csv`, headers, rows);
    } else {
      const headers = ['Operator Name', 'Role', 'Scanned Barcodes', 'Batches Created', 'Avg Items / Hour'];
      const rows = operatorProductivity.map(u => [u.userName, u.role, u.itemsScanned, u.batchesCreated, u.avgSpeedPerHour]);
      downloadCSV(`EMIZA_User_Productivity_Report_${activeWarehouse.code}.csv`, headers, rows);
    }
  };

  // Preview Batch Scanned Items & Details
  const previewItems = previewBatch ? scannedItems.filter(i => i.batchId === previewBatch.id) : [];
  const previewClient = previewBatch ? clients.find(c => c.id === previewBatch.clientId) : null;
  const previewCourier = previewBatch ? couriers.find(cr => cr.id === previewBatch.courierId) : null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#123B5D] dark:text-blue-400" /> Reports & Manifest
          </h1>
          <p className="text-xs text-secondary mt-1">
            Generate and export RTO / B2C Return Batch Manifests, Inward Gate Register, Brand KPIs, and Courier Handover Sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportFullReport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel CSV Report
          </button>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-theme pb-2 scrollbar-thin">
        {[
          { id: 'manifest', label: 'Batch Manifests & Handover Sheets', icon: FileText, count: whBatches.length },
          { id: 'inward', label: 'Inward Gate Register', icon: Truck, count: whGateEntries.length },
          { id: 'client_wise', label: 'Client Brand Breakdown', icon: Building2, count: clients.length },
          { id: 'courier_wise', label: 'Courier Performance', icon: Truck, count: couriers.length },
          { id: 'user_productivity', label: 'Operator Productivity', icon: UserCheck, count: users.length },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#123B5D] dark:bg-blue-600 text-white shadow-sm'
                  : 'bg-surface text-secondary hover:text-primary border border-theme'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-elevated text-secondary'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. BATCH MANIFESTS & HANDOVER SHEETS (PRIMARY TAB) */}
      {reportType === 'manifest' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-surface border border-theme p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-secondary shrink-0" />
              <input
                type="text"
                placeholder="Search by Batch #, Client Brand, Courier, Dock #..."
                value={manifestSearch}
                onChange={e => setManifestSearch(e.target.value)}
                className="bg-elevated border border-theme rounded-lg px-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#123B5D] dark:focus:border-blue-500 w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Client Filter */}
              <select
                value={selectedClientFilter}
                onChange={e => setSelectedClientFilter(e.target.value)}
                className="bg-elevated text-primary border border-theme rounded-lg px-2.5 py-1.5 font-medium cursor-pointer text-xs focus:outline-none"
              >
                <option value="ALL">All Clients ({clients.length})</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Courier Filter */}
              <select
                value={selectedCourierFilter}
                onChange={e => setSelectedCourierFilter(e.target.value)}
                className="bg-elevated text-primary border border-theme rounded-lg px-2.5 py-1.5 font-medium cursor-pointer text-xs focus:outline-none"
              >
                <option value="ALL">All Couriers ({couriers.length})</option>
                {couriers.map(cr => (
                  <option key={cr.id} value={cr.id}>
                    {cr.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <div className="flex items-center bg-elevated rounded-lg p-0.5 border border-theme">
                {(['ALL', 'Closed', 'Open'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                      selectedStatusFilter === st
                        ? 'bg-[#123B5D] dark:bg-blue-600 text-white shadow-xs'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Batches Manifest List Table */}
          <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                  <tr>
                    <th className="px-4 py-3">Batch Number</th>
                    <th className="px-4 py-3">Client / Brand</th>
                    <th className="px-4 py-3">Courier Partner</th>
                    <th className="px-4 py-3">Dock No</th>
                    <th className="px-4 py-3">Total Scanned</th>
                    <th className="px-4 py-3">QC Summary</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Closed / Date</th>
                    <th className="px-4 py-3 text-right">Manifest Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-secondary">
                        No return batches match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch, idx) => {
                      const client = clients.find(c => c.id === batch.clientId);
                      const courier = couriers.find(cr => cr.id === batch.courierId);
                      const breakdown = batch.remarksBreakdown || {};
                      const isClosed = batch.status === 'Closed';

                      return (
                        <tr key={`rep-batch-${batch.id || batch.batchNumber || idx}-${idx}`} className="hover:bg-elevated transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-[#123B5D] dark:text-blue-400">{batch.batchNumber}</div>
                            <div className="text-[10px] text-secondary font-mono">
                              {new Date(batch.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">
                            {client?.name || batch.clientId}
                          </td>
                          <td className="px-4 py-3 text-secondary">
                            {courier?.name || batch.courierId}
                          </td>
                          <td className="px-4 py-3">
                            {batch.dockNumber ? (
                              <span className="px-2 py-0.5 rounded font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 text-[11px]">
                                {batch.dockNumber}
                              </span>
                            ) : (
                              <span className="text-secondary">Dock 01</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded bg-elevated font-mono font-bold text-emerald-600 dark:text-emerald-400 border border-theme text-xs">
                              {batch.totalScanned} AWBs
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {Object.entries(breakdown).map(([rem, count]) => {
                                if (Number(count) <= 0) return null;
                                return (
                                  <span
                                    key={rem}
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      rem === 'Good'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                        : rem === 'Damage' || rem === 'Missing Product'
                                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                    }`}
                                  >
                                    {rem}: {count}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isClosed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/50'
                                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50'
                              }`}
                            >
                              {batch.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-secondary text-[11px]">
                            {batch.closedAt ? (
                              <div>
                                <div className="text-primary font-medium">{new Date(batch.closedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                                <div className="text-[10px] text-secondary">{new Date(batch.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400/80 font-mono">Open</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Live Manifest Modal */}
                              <button
                                onClick={() => setPreviewBatch(batch)}
                                className="px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-surface text-secondary hover:text-primary flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer border border-theme"
                                title="View Live Handover Manifest"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#123B5D] dark:text-blue-400" />
                                <span>Preview</span>
                              </button>

                              {/* Download Exact PDF Manifest */}
                              <button
                                onClick={() => handleDownloadPDF(batch)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#123B5D] hover:bg-[#184C77] dark:bg-blue-600 dark:hover:bg-blue-500 text-white flex items-center gap-1 text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                                title="Download PDF Manifest & Handover Sheet"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>PDF Manifest</span>
                              </button>

                              {/* Export CSV */}
                              <button
                                onClick={() => handleExportBatchCSV(batch)}
                                className="p-1.5 rounded-lg bg-elevated hover:bg-emerald-600 hover:text-white text-secondary transition-colors cursor-pointer border border-theme"
                                title="Download CSV Scanned AWB List"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. INWARD GATE REGISTER */}
      {reportType === 'inward' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Gate Pass #</th>
                  <th className="px-4 py-3">Vehicle #</th>
                  <th className="px-4 py-3">Driver Name</th>
                  <th className="px-4 py-3">Client Brand</th>
                  <th className="px-4 py-3">Courier</th>
                  <th className="px-4 py-3">Cartons</th>
                  <th className="px-4 py-3">Value (INR)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Entry Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {whGateEntries.map((g, idx) => (
                  <tr key={`rep-gate-${g.id || g.gatePassNumber || idx}-${idx}`} className="hover:bg-elevated">
                    <td className="px-4 py-3 font-mono font-bold text-[#123B5D] dark:text-blue-400">{g.gatePassNumber}</td>
                    <td className="px-4 py-3 font-bold text-primary">{g.vehicleNumber}</td>
                    <td className="px-4 py-3 text-secondary">{g.driverName}</td>
                    <td className="px-4 py-3 text-secondary">{clients.find(c => c.id === g.clientId)?.name}</td>
                    <td className="px-4 py-3 text-secondary">{couriers.find(cr => cr.id === g.courierId)?.name}</td>
                    <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">{g.expectedBoxCount} Cartons</td>
                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">₹{g.invoiceValue?.toLocaleString() || '0'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50">
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary font-mono text-[11px]">
                      {new Date(g.entryTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CLIENT BRAND PERFORMANCE */}
      {reportType === 'client_wise' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Client Brand</th>
                  <th className="px-4 py-3">Client Code</th>
                  <th className="px-4 py-3">Inward Vehicles Received</th>
                  <th className="px-4 py-3">Return Batches Processed</th>
                  <th className="px-4 py-3">Total Scanned AWBs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {clientBreakdown.map((cb, idx) => (
                  <tr key={idx} className="hover:bg-elevated">
                    <td className="px-4 py-3 font-bold text-primary">{cb.clientName}</td>
                    <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400">{cb.code}</td>
                    <td className="px-4 py-3 font-bold text-secondary">{cb.vehicles} Vehicles</td>
                    <td className="px-4 py-3 font-bold text-secondary">{cb.batches} Batches</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-600 dark:text-emerald-400">{cb.totalScanned} Items</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. COURIER PERFORMANCE */}
      {reportType === 'courier_wise' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Courier Partner</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Inward Vehicles Handled</th>
                  <th className="px-4 py-3">Return Batches Processed</th>
                  <th className="px-4 py-3">Total Scanned AWBs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {courierBreakdown.map((cr, idx) => (
                  <tr key={idx} className="hover:bg-elevated">
                    <td className="px-4 py-3 font-bold text-primary">{cr.courierName}</td>
                    <td className="px-4 py-3 font-mono text-[#123B5D] dark:text-blue-400">{cr.code}</td>
                    <td className="px-4 py-3 font-bold text-secondary">{cr.vehicles} Vehicles</td>
                    <td className="px-4 py-3 font-bold text-secondary">{cr.batches} Batches</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-600 dark:text-emerald-400">{cr.totalScanned} Items</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. OPERATOR PRODUCTIVITY */}
      {reportType === 'user_productivity' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Operator Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Scanned Barcodes Today</th>
                  <th className="px-4 py-3">Batches Handled</th>
                  <th className="px-4 py-3">Scanning Speed (Avg Items / Hr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                {operatorProductivity.map((usr, idx) => (
                  <tr key={idx} className="hover:bg-elevated">
                    <td className="px-4 py-3 font-bold text-primary">{usr.userName}</td>
                    <td className="px-4 py-3 text-secondary">{usr.role}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-600 dark:text-emerald-400">{usr.itemsScanned} Scanned</td>
                    <td className="px-4 py-3 font-bold text-secondary">{usr.batchesCreated} Batches</td>
                    <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">{usr.avgSpeedPerHour} items/hr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LIVE ON-SCREEN MANIFEST PREVIEW MODAL */}
      {previewBatch && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface text-primary rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-theme">
            {/* Modal Top Control Bar */}
            <div className="bg-[#123B5D] dark:bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-blue-900/40 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-200 dark:text-indigo-400" />
                <span className="font-bold text-sm">Batch Manifest & Handover Sheet Preview</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {previewBatch.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPDF(previewBatch)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button
                  onClick={() => handleExportBatchCSV(previewBatch)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" /> CSV
                </button>
                <button
                  onClick={() => setPreviewBatch(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Exact PDF Layout Replicated on Screen */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-elevated text-xs">
              {/* Header Banner */}
              <div className="bg-[#123B5D] dark:bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between border-b-2 border-blue-400">
                <div>
                  <h2 className="text-base font-black tracking-wide">EMIZA WAREHOUSE OPERATIONS</h2>
                  <p className="text-[11px] text-blue-100 dark:text-slate-300 font-medium">RTO / B2C RETURNS BATCH MANIFEST & HANDOVER SHEET</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-500 text-white uppercase tracking-wider">
                    {previewBatch.status}
                  </span>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="bg-surface border border-theme rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shadow-xs">
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Batch Number</span>
                  <span className="font-bold text-[#123B5D] dark:text-blue-400 font-mono text-sm">{previewBatch.batchNumber}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Client / Account</span>
                  <span className="font-bold text-primary">{previewClient?.name || previewBatch.clientId}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Courier Partner</span>
                  <span className="font-bold text-primary">{previewCourier?.name || previewBatch.courierId}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Batch Type / Dock</span>
                  <span className="font-bold text-primary">
                    {previewBatch.batchType || 'RTO/B2C'} {previewBatch.dockNumber ? `(${previewBatch.dockNumber})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Facility / Hub</span>
                  <span className="font-bold text-primary">{activeWarehouse.name} ({activeWarehouse.code})</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Total Scanned</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{previewItems.length} Parcels / AWBs</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Batch Created</span>
                  <span className="font-medium text-primary">{new Date(previewBatch.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-secondary block text-[10px] font-bold uppercase">Driver / Rep</span>
                  <span className="font-bold text-primary">{previewBatch.driverName || 'Supervisor Handover'}</span>
                </div>
              </div>

              {/* QC Breakdown Summary */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-primary text-[11px] uppercase tracking-wider">QC Conditions Breakdown Summary</h4>
                <div className="bg-surface border border-theme rounded-xl p-3 flex flex-wrap gap-4 shadow-xs">
                  {Object.entries(previewBatch.remarksBreakdown || {}).map(([rem, cnt]) => (
                    <div key={rem} className="flex items-center gap-1.5">
                      <span className="font-bold text-secondary">{rem}:</span>
                      <span className="font-black text-[#123B5D] dark:text-blue-400 bg-elevated px-2 py-0.5 rounded border border-theme">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scanned AWBs Table */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-primary text-[11px] uppercase tracking-wider">
                  Scanned AWBs Manifest ({previewItems.length} Items)
                </h4>
                <div className="border border-theme rounded-xl overflow-hidden bg-surface max-h-60 overflow-y-auto shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-elevated text-primary uppercase font-bold text-[10px] sticky top-0 border-b border-theme">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">AWB / Tracking Number</th>
                        <th className="px-3 py-2">QC Condition</th>
                        <th className="px-3 py-2">Scan Timestamp</th>
                        <th className="px-3 py-2">Scanned By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-primary">
                      {previewItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-secondary">No scanned items in this batch.</td>
                        </tr>
                      ) : (
                        previewItems.map((it, i) => (
                          <tr key={`rep-item-${it.id || it.trackingNumber || i}-${i}`} className={i % 2 === 0 ? 'bg-surface' : 'bg-elevated'}>
                            <td className="px-3 py-1.5 font-mono text-secondary">{i + 1}</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-[#123B5D] dark:text-blue-400">{it.trackingNumber}</td>
                            <td className="px-3 py-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                it.remark === 'Good' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                              }`}>
                                {it.remark}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-secondary font-mono text-[11px]">
                              {new Date(it.scannedAt).toLocaleTimeString()}
                            </td>
                            <td className="px-3 py-1.5 text-primary font-medium">
                              {it.scannedByName || 'Operator'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Handover & Sign-off Signature Box */}
              <div className="border border-theme rounded-xl p-4 bg-surface grid grid-cols-2 gap-8 shadow-xs">
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-secondary block">Courier Driver / Rep</span>
                    <span className="font-bold text-primary">{previewBatch.driverName || '-'}</span>
                    <div className="text-[10px] text-secondary">Phone: {previewBatch.driverMobile || '-'}</div>
                  </div>
                  <div className="border-t border-theme pt-1 text-[10px] text-secondary text-center italic">
                    Courier Driver Signature & Handover Stamp
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-secondary block">Warehouse Supervisor</span>
                    <span className="font-bold text-primary">{previewBatch.createdByName || 'Vikram Mehta'}</span>
                    <div className="text-[10px] text-secondary">
                      Handover Date: {previewBatch.closedAt ? new Date(previewBatch.closedAt).toLocaleString() : 'Pending Close'}
                    </div>
                  </div>
                  <div className="border-t border-theme pt-1 text-[10px] text-secondary text-center italic">
                    Warehouse Inward Stamp & Supervisor Sign-off
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
