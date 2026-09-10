import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
} from 'lucide-react';
import {
  InwardGateEntry,
  InwardDocket,
  InwardInvoiceItem,
  Phase2UnloadingData,
  Warehouse,
  Client,
  Courier,
  User,
  WAREHOUSE_DOCKS,
} from '../../types';

interface Phase2DockQCModalProps {
  isOpen: boolean;
  entry: InwardGateEntry | null;
  onClose: () => void;
  currentUser: User;
  activeWarehouse: Warehouse;
  clients: Client[];
  couriers: Courier[];
  onSubmitPhase2: (gateEntryId: string, phase2Data: Phase2UnloadingData) => void;
}

export const Phase2DockQCModal: React.FC<Phase2DockQCModalProps> = ({
  isOpen,
  entry,
  onClose,
  currentUser,
  activeWarehouse,
  clients,
  couriers,
  onSubmitPhase2,
}) => {
  if (!isOpen || !entry) return null;

  const client = clients.find(c => c.id === entry.clientId);
  const courier = couriers.find(cr => cr.id === entry.courierId);
  const phase1ExpectedInvoices = entry.phase1?.invoiceCount || 1;

  // Form states
  const [confirmedDock, setConfirmedDock] = useState(entry.dockNumber || 'Dock 01');
  const [confirmedInvoiceCount, setConfirmedInvoiceCount] = useState<number>(phase1ExpectedInvoices);
  const [qcNotes, setQcNotes] = useState(entry.phase2?.notes || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dockets list with nested invoices
  const [dockets, setDockets] = useState<InwardDocket[]>(() => {
    if (entry.phase2?.dockets && entry.phase2.dockets.length > 0) {
      return entry.phase2.dockets;
    }
    // Default initial Docket with 1 initial Invoice
    return [
      {
        id: `dkt-${Date.now()}-1`,
        docketNumber: `DKT-${entry.vehicleNumber.replace(/[^A-Z0-9]/g, '').slice(-4) || '1001'}-01`,
        invoices: [
          {
            id: `inv-${Date.now()}-1`,
            invoiceNumber: entry.invoiceChallanNumber?.startsWith('INV-CNT') ? `INV-${client?.code || 'ACC'}-001` : (entry.invoiceChallanNumber || `INV-${client?.code || 'ACC'}-001`),
            boxCount: entry.expectedBoxCount || 10,
            qcCondition: 'Good',
            otherRemark: '',
          },
        ],
        notes: '',
      },
    ];
  });

  // Calculate live dynamic sums
  const totalDocketsCount = dockets.length;
  const allInvoices = dockets.flatMap(d => d.invoices);
  const totalInvoicesCount = allInvoices.length;
  const totalBoxesCount = allInvoices.reduce((sum, inv) => sum + (Number(inv.boxCount) || 0), 0);

  const goodCount = allInvoices.filter(i => i.qcCondition === 'Good').reduce((s, i) => s + (Number(i.boxCount) || 0), 0);
  const damageCount = allInvoices.filter(i => i.qcCondition === 'Damage').reduce((s, i) => s + (Number(i.boxCount) || 0), 0);
  const openBoxesCount = allInvoices.filter(i => i.qcCondition === 'Open Boxes').reduce((s, i) => s + (Number(i.boxCount) || 0), 0);
  const missingBoxesCount = allInvoices.filter(i => i.qcCondition === 'Missing Boxes').reduce((s, i) => s + (Number(i.boxCount) || 0), 0);
  const otherCount = allInvoices.filter(i => i.qcCondition === 'Other').reduce((s, i) => s + (Number(i.boxCount) || 0), 0);

  // Docket Handlers
  const handleAddDocket = () => {
    const nextDocketIndex = dockets.length + 1;
    const newDocket: InwardDocket = {
      id: `dkt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      docketNumber: `DKT-${entry.vehicleNumber.replace(/[^A-Z0-9]/g, '').slice(-4) || '1001'}-${String(nextDocketIndex).padStart(2, '0')}`,
      invoices: [
        {
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          invoiceNumber: `INV-${client?.code || 'ACC'}-${String(totalInvoicesCount + 1).padStart(3, '0')}`,
          boxCount: 1,
          qcCondition: 'Good',
          otherRemark: '',
        },
      ],
      notes: '',
    };
    setDockets(prev => [...prev, newDocket]);
    setValidationError(null);
  };

  const handleRemoveDocket = (docketId: string) => {
    if (dockets.length === 1) {
      setValidationError('At least 1 Docket is required for Unloading & Dock QC.');
      return;
    }
    setDockets(prev => prev.filter(d => d.id !== docketId));
    setValidationError(null);
  };

  const handleDocketNumberChange = (docketId: string, value: string) => {
    setDockets(prev =>
      prev.map(d => (d.id === docketId ? { ...d, docketNumber: value.toUpperCase() } : d))
    );
  };

  // Invoice Handlers
  const handleAddInvoice = (docketId: string) => {
    setDockets(prev =>
      prev.map(d => {
        if (d.id === docketId) {
          const newInvoice: InwardInvoiceItem = {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            invoiceNumber: `INV-${client?.code || 'ACC'}-${String(totalInvoicesCount + 1).padStart(3, '0')}`,
            boxCount: 1,
            qcCondition: 'Good',
            otherRemark: '',
          };
          return { ...d, invoices: [...d.invoices, newInvoice] };
        }
        return d;
      })
    );
    setValidationError(null);
  };

  const handleRemoveInvoice = (docketId: string, invoiceId: string) => {
    setDockets(prev =>
      prev.map(d => {
        if (d.id === docketId) {
          if (d.invoices.length === 1) {
            setValidationError('Each Docket must have at least 1 Invoice.');
            return d;
          }
          return { ...d, invoices: d.invoices.filter(i => i.id !== invoiceId) };
        }
        return d;
      })
    );
    setValidationError(null);
  };

  const handleUpdateInvoice = (
    docketId: string,
    invoiceId: string,
    field: keyof InwardInvoiceItem,
    value: any
  ) => {
    setDockets(prev =>
      prev.map(d => {
        if (d.id === docketId) {
          return {
            ...d,
            invoices: d.invoices.map(inv => {
              if (inv.id === invoiceId) {
                return { ...inv, [field]: value };
              }
              return inv;
            }),
          };
        }
        return d;
      })
    );
    setValidationError(null);
  };

  // Validation
  const validate = (): boolean => {
    if (dockets.length === 0) {
      setValidationError('Please add at least 1 Docket.');
      return false;
    }

    for (let dIndex = 0; dIndex < dockets.length; dIndex++) {
      const d = dockets[dIndex];
      if (!d.docketNumber.trim()) {
        setValidationError(`Docket #${dIndex + 1} requires a valid Docket Number.`);
        return false;
      }
      if (d.invoices.length === 0) {
        setValidationError(`Docket "${d.docketNumber}" must contain at least 1 Invoice.`);
        return false;
      }
      for (let iIndex = 0; iIndex < d.invoices.length; iIndex++) {
        const inv = d.invoices[iIndex];
        if (!inv.invoiceNumber.trim()) {
          setValidationError(`Invoice #${iIndex + 1} under Docket "${d.docketNumber}" requires an Invoice No.`);
          return false;
        }
        if (!inv.boxCount || Number(inv.boxCount) < 1) {
          setValidationError(`Invoice "${inv.invoiceNumber}" must have at least 1 box.`);
          return false;
        }
        if (inv.qcCondition === 'Other' && (!inv.otherRemark || !inv.otherRemark.trim())) {
          setValidationError(`Invoice "${inv.invoiceNumber}" is marked as "Other" QC condition. A remark is strictly required.`);
          return false;
        }
      }
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const phase2Data: Phase2UnloadingData = {
      dockConfirmed: confirmedDock,
      confirmedInvoiceCount,
      dockets,
      unloadingInchargeId: currentUser.id,
      unloadingInchargeName: currentUser.name,
      unloadedAt: new Date().toISOString(),
      totalDocketsCount,
      totalInvoicesCount,
      totalBoxesCount,
      goodCount,
      damageCount,
      openBoxesCount,
      missingBoxesCount,
      otherCount,
      notes: qcNotes.trim() || undefined,
    };

    onSubmitPhase2(entry.id, phase2Data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-surface border border-theme rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Package className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white">
                  Unloading & Dock QC Verification
                </h2>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Record nested Dockets, Invoices, Box Counts, and QC conditions under Gate Entry <strong className="text-white font-mono">{entry.gatePassNumber}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Linked Details Summary Strip */}
        <div className="px-6 py-3 bg-elevated/70 border-b border-theme grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Gate Entry ID</span>
            <span className="font-mono font-extrabold text-primary">{entry.gatePassNumber}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Vehicle & Driver</span>
            <span className="font-bold text-primary truncate block">{entry.vehicleNumber} ({entry.driverName})</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Account (Client)</span>
            <span className="font-bold text-primary truncate block">{client?.name || 'Account'}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Declared Invoices</span>
            <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{phase1ExpectedInvoices} Invoices Declared</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Unloading Incharge</span>
            <span className="font-bold text-primary truncate block">{currentUser.name}</span>
          </div>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2 font-semibold animate-in shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section 1: Dock Alignment & Invoice Count Confirmation */}
          <div className="p-4 rounded-xl bg-elevated border border-theme space-y-3">
            <div className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>1. Confirm Gate Alignment & Invoice Declaration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Confirm Aligned Dock <span className="text-rose-500">*</span>
                </label>
                <select
                  value={confirmedDock}
                  onChange={e => setConfirmedDock(e.target.value)}
                  className="w-full bg-surface text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-amber-500 font-bold text-amber-600 dark:text-amber-400 [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC]"
                >
                  {WAREHOUSE_DOCKS.map(dock => (
                    <option key={dock} value={dock} className="bg-[#1E293B] text-[#F8FAFC]">
                      {dock} {entry.dockNumber === dock ? '(Security Assigned)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-secondary font-bold mb-1">
                  Confirm Invoices Count <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={confirmedInvoiceCount}
                    onChange={e => setConfirmedInvoiceCount(Number(e.target.value))}
                    className="w-full bg-surface text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-amber-500 font-bold font-mono"
                  />
                  {confirmedInvoiceCount === totalInvoicesCount ? (
                    <span className="px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px] whitespace-nowrap flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Matches QC ({totalInvoicesCount})
                    </span>
                  ) : (
                    <span className="px-2.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-[11px] whitespace-nowrap">
                      QC Invoices: {totalInvoicesCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Dockets & Nested Invoices Builder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span>2. Vehicle Dockets & Invoices (1 Vehicle → Multiple Dockets → Multiple Invoices)</span>
                </h3>
                <p className="text-[11px] text-secondary mt-0.5">
                  All dockets and invoices remain connected under this single Gate Entry ID.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddDocket}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Docket</span>
              </button>
            </div>

            {/* Dockets List */}
            <div className="space-y-4">
              {dockets.map((docket, dIndex) => {
                const docketBoxes = docket.invoices.reduce((s, i) => s + (Number(i.boxCount) || 0), 0);
                return (
                  <div
                    key={docket.id}
                    className="p-4 rounded-xl bg-elevated border border-theme shadow-xs space-y-3 transition-all"
                  >
                    {/* Docket Header */}
                    <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-theme">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 font-extrabold font-mono text-xs flex items-center justify-center border border-blue-400/30">
                          {dIndex + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="text-secondary font-bold text-[11px]">Docket No:</label>
                          <input
                            type="text"
                            value={docket.docketNumber}
                            onChange={e => handleDocketNumberChange(docket.id, e.target.value)}
                            placeholder="e.g. DKT-8821-01"
                            className="bg-surface text-primary px-2.5 py-1 rounded-lg border border-theme focus:outline-none focus:border-blue-500 font-mono font-bold text-xs uppercase"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-[11px] font-mono font-semibold text-secondary hidden sm:block">
                          {docket.invoices.length} Invoices | <strong className="text-primary">{docketBoxes} Boxes</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddInvoice(docket.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold hover:bg-emerald-100 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Add Invoice</span>
                        </button>
                        {dockets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDocket(docket.id)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Delete Docket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Invoices Table inside Docket */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase font-extrabold text-secondary border-b border-theme/60">
                            <th className="py-2 px-2">#</th>
                            <th className="py-2 px-2">Invoice No. *</th>
                            <th className="py-2 px-2">No. of Boxes *</th>
                            <th className="py-2 px-2">QC Condition *</th>
                            <th className="py-2 px-2">QC Remarks (Mandatory if Other)</th>
                            <th className="py-2 px-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme/40 text-xs">
                          {docket.invoices.map((invoice, iIndex) => {
                            const isOther = invoice.qcCondition === 'Other';
                            return (
                              <tr key={invoice.id} className="hover:bg-surface/50 transition-colors">
                                <td className="py-2 px-2 font-mono text-muted text-[11px]">
                                  {iIndex + 1}
                                </td>

                                {/* Invoice No */}
                                <td className="py-2 px-2 min-w-[130px]">
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. INV-BV-1021"
                                    value={invoice.invoiceNumber}
                                    onChange={e => handleUpdateInvoice(docket.id, invoice.id, 'invoiceNumber', e.target.value.toUpperCase())}
                                    className="w-full bg-surface text-primary p-2 rounded-lg border border-theme focus:outline-none focus:border-blue-500 uppercase font-mono font-bold text-xs"
                                  />
                                </td>

                                {/* No. of Boxes */}
                                <td className="py-2 px-2 w-[110px]">
                                  <input
                                    type="number"
                                    min={1}
                                    required
                                    value={invoice.boxCount}
                                    onChange={e => handleUpdateInvoice(docket.id, invoice.id, 'boxCount', Number(e.target.value))}
                                    className="w-full bg-surface text-primary p-2 rounded-lg border border-theme focus:outline-none focus:border-blue-500 font-bold font-mono text-xs"
                                  />
                                </td>

                                {/* QC Condition */}
                                <td className="py-2 px-2 min-w-[150px]">
                                  <select
                                    value={invoice.qcCondition}
                                    onChange={e => handleUpdateInvoice(docket.id, invoice.id, 'qcCondition', e.target.value)}
                                    className={`w-full p-2 rounded-lg border text-xs font-bold ${
                                      invoice.qcCondition === 'Good'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                        : invoice.qcCondition === 'Damage'
                                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                        : invoice.qcCondition === 'Open Boxes'
                                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                        : invoice.qcCondition === 'Missing Boxes'
                                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                                        : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                                    }`}
                                  >
                                    <option value="Good">Good / Intact</option>
                                    <option value="Damage">Damage</option>
                                    <option value="Open Boxes">Open Boxes</option>
                                    <option value="Missing Boxes">Missing Boxes</option>
                                    <option value="Other">Other (Remark required)</option>
                                  </select>
                                </td>

                                {/* QC Remark (Mandatory if Other) */}
                                <td className="py-2 px-2 min-w-[180px]">
                                  <input
                                    type="text"
                                    required={isOther}
                                    placeholder={isOther ? 'Mandatory remark for Other...' : 'QC condition notes (optional)...'}
                                    value={invoice.otherRemark || ''}
                                    onChange={e => handleUpdateInvoice(docket.id, invoice.id, 'otherRemark', e.target.value)}
                                    className={`w-full bg-surface text-primary p-2 rounded-lg border ${
                                      isOther && (!invoice.otherRemark || !invoice.otherRemark.trim())
                                        ? 'border-rose-500 ring-1 ring-rose-500/30'
                                        : 'border-theme'
                                    } focus:outline-none focus:border-blue-500 text-xs`}
                                  />
                                </td>

                                {/* Delete invoice */}
                                <td className="py-2 px-2 text-right">
                                  {docket.invoices.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInvoice(docket.id, invoice.id)}
                                      className="p-1 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                      title="Delete Invoice"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Live QC Summary & Breakdown Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#123B5D]/10 to-[#123B5D]/5 border border-theme space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-primary text-xs uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Dock QC Cumulative Summary</span>
              </span>
              <span className="font-mono text-xs font-bold text-secondary">
                {totalDocketsCount} Dockets | {totalInvoicesCount} Invoices
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-surface border border-theme">
                <span className="text-[10px] text-muted block">Total Boxes</span>
                <span className="font-mono font-extrabold text-sm text-primary">{totalBoxesCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-semibold">Good</span>
                <span className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300">{goodCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <span className="text-[10px] text-rose-700 dark:text-rose-300 block font-semibold">Damage</span>
                <span className="font-mono font-extrabold text-sm text-rose-700 dark:text-rose-300">{damageCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] text-amber-700 dark:text-amber-300 block font-semibold">Open Boxes</span>
                <span className="font-mono font-extrabold text-sm text-amber-700 dark:text-amber-300">{openBoxesCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                <span className="text-[10px] text-purple-700 dark:text-purple-300 block font-semibold">Missing Boxes</span>
                <span className="font-mono font-extrabold text-sm text-purple-700 dark:text-purple-300">{missingBoxesCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <span className="text-[10px] text-indigo-700 dark:text-indigo-300 block font-semibold">Other</span>
                <span className="font-mono font-extrabold text-sm text-indigo-700 dark:text-indigo-300">{otherCount}</span>
              </div>
            </div>
          </div>

          {/* Additional QC Supervisor Notes */}
          <div className="space-y-1.5">
            <label className="block text-secondary font-bold">
              Unloading & Dock Inspection Overall Remarks (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Unloading completed smoothly at Dock. Carton seal intact..."
              value={qcNotes}
              onChange={e => setQcNotes(e.target.value)}
              className="w-full bg-elevated text-primary p-3 rounded-xl border border-theme focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-theme">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-elevated hover:bg-elevated/80 text-secondary font-bold border border-theme transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Unloading & Dock QC</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
