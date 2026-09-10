import React from 'react';
import {
  X,
  Truck,
  ShieldCheck,
  Package,
  CheckCircle2,
  Download,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  InwardGateEntry,
  Warehouse,
  Client,
  Courier,
  VehicleType,
} from '../../types';
import { generateGatePassPDF } from '../../utils/pdfGenerator';

interface GateEntryDetailsModalProps {
  isOpen: boolean;
  entry: InwardGateEntry | null;
  onClose: () => void;
  warehouse: Warehouse;
  clients: Client[];
  couriers: Courier[];
  vehicleTypes: VehicleType[];
  onOpenPhase2?: (entry: InwardGateEntry) => void;
  onOpenPhase3?: (entry: InwardGateEntry) => void;
}

export const GateEntryDetailsModal: React.FC<GateEntryDetailsModalProps> = ({
  isOpen,
  entry,
  onClose,
  warehouse,
  clients,
  couriers,
  vehicleTypes,
  onOpenPhase2,
  onOpenPhase3,
}) => {
  if (!isOpen || !entry) return null;

  const client = clients.find(c => c.id === entry.clientId);
  const courier = couriers.find(cr => cr.id === entry.courierId);
  const vehicleType = vehicleTypes.find(vt => vt.id === entry.vehicleTypeId);

  const isB2B = entry.entryType === 'B2B Return' || entry.gatePassNumber.startsWith('B2B');
  const isPhase1Done = !!entry.phase1 || !!entry.gatePassNumber;
  const isPhase2Done = !!entry.phase2;
  const isPhase3Done = !!entry.phase3 || entry.status === 'Handover Completed' || entry.status === 'Completed';

  const handleDownloadPDF = () => {
    generateGatePassPDF(entry, warehouse, client, courier, isB2B);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-surface border border-theme rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`px-6 py-4 ${isB2B ? 'bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900' : 'bg-gradient-to-r from-[#123B5D] via-[#1E4E79] to-[#123B5D]'} text-white flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Truck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white/20 text-white font-extrabold border border-white/30">
                  {entry.gatePassNumber}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  {entry.status}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
                {isB2B ? 'B2B Return Gate Entry Details' : 'Inward Gate Entry Details'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Interactive Linked Workflow Stepper Bar */}
        <div className="px-6 py-3.5 bg-elevated/80 border-b border-theme">
          <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isPhase1Done ? 'bg-emerald-500 text-white' : 'bg-muted text-surface'
              }`}>
                {isPhase1Done ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div>
                <span className="text-[11px] font-bold text-primary block">Security Check-In</span>
                <span className="text-[10px] text-secondary">Arrival Recorded</span>
              </div>
            </div>

            <div className={`flex-1 h-0.5 ${isPhase2Done ? 'bg-emerald-500' : 'bg-theme'}`} />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isPhase2Done ? 'bg-amber-500 text-white' : 'bg-muted/40 text-secondary'
              }`}>
                {isPhase2Done ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <div>
                <span className="text-[11px] font-bold text-primary block">Dock QC</span>
                <span className="text-[10px] text-secondary">Unloading & Verification</span>
              </div>
            </div>

            <div className={`flex-1 h-0.5 ${isPhase3Done ? 'bg-emerald-500' : 'bg-theme'}`} />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isPhase3Done ? 'bg-emerald-600 text-white' : 'bg-muted/40 text-secondary'
              }`}>
                {isPhase3Done ? <Check className="w-4 h-4" /> : '3'}
              </div>
              <div>
                <span className="text-[11px] font-bold text-primary block">Handover</span>
                <span className="text-[10px] text-secondary">Custody Sign-off</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Security Card */}
          <div className="p-4 rounded-xl bg-elevated border border-theme space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-theme">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="font-extrabold text-primary text-xs uppercase tracking-wider">
                  Vehicle Arrival & Security Check-In
                </h3>
              </div>
              <span className="text-[11px] font-mono text-muted">
                {entry.phase1?.gateEntryDateTime || new Date(entry.entryTime).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Vehicle Number</span>
                <span className="font-bold font-mono text-primary">{entry.vehicleNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Vehicle Type</span>
                <span className="font-semibold text-primary">{vehicleType?.typeName || 'Truck'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Courier / Transporter</span>
                <span className="font-semibold text-primary">{courier?.name || 'Courier'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Account (Client)</span>
                <span className="font-bold text-primary">{client?.name || 'Account'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Driver Name</span>
                <span className="font-semibold text-primary">{entry.driverName}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Driver Mobile</span>
                <span className="font-mono text-primary">{entry.driverMobile}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Driver License</span>
                <span className="font-mono text-primary">{entry.driverLicense || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted block uppercase font-semibold">Aligned Dock</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{entry.dockNumber || 'Dock 01'}</span>
              </div>
            </div>

            {entry.remarks && (
              <div className="p-2.5 rounded-lg bg-surface border border-theme text-[11px] text-secondary">
                <span className="font-bold text-primary mr-1">Security Notes:</span>
                {entry.remarks}
              </div>
            )}
          </div>

          {/* Dock QC Card */}
          <div className="p-4 rounded-xl bg-elevated border border-theme space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-theme">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-primary text-xs uppercase tracking-wider">
                  Unloading & Dock QC Details
                </h3>
              </div>
              {isPhase2Done ? (
                <span className="text-[11px] font-mono text-muted">
                  Supervisor: <strong className="text-primary">{entry.phase2?.unloadingInchargeName || 'Incharge'}</strong>
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                  Pending Dock QC
                </span>
              )}
            </div>

            {isPhase2Done && entry.phase2 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-surface border border-theme">
                    <span className="text-[10px] text-muted block">Dockets</span>
                    <span className="font-bold font-mono text-primary">{entry.phase2.totalDocketsCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-theme">
                    <span className="text-[10px] text-muted block">Invoices</span>
                    <span className="font-bold font-mono text-primary">{entry.phase2.totalInvoicesCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-theme">
                    <span className="text-[10px] text-muted block">Total Boxes</span>
                    <span className="font-bold font-mono text-primary">{entry.phase2.totalBoxesCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                    <span className="text-[10px] block">Good</span>
                    <span className="font-bold font-mono">{entry.phase2.goodCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                    <span className="text-[10px] block">Damage/Issues</span>
                    <span className="font-bold font-mono">
                      {(entry.phase2.damageCount || 0) + (entry.phase2.openBoxesCount || 0) + (entry.phase2.missingBoxesCount || 0) + (entry.phase2.otherCount || 0)}
                    </span>
                  </div>
                </div>

                {/* Dockets Breakdown */}
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold text-primary block uppercase tracking-wider">
                    Nested Dockets & Invoices Manifest:
                  </span>
                  <div className="space-y-2">
                    {entry.phase2.dockets?.map((dkt, idx) => (
                      <div key={dkt.id || idx} className="p-3 rounded-lg bg-surface border border-theme space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            Docket #{idx + 1}: {dkt.docketNumber}
                          </span>
                          <span className="text-secondary font-mono text-[11px]">
                            {dkt.invoices.length} Invoices | {dkt.invoices.reduce((s, i) => s + (Number(i.boxCount) || 0), 0)} Boxes
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {dkt.invoices.map(inv => (
                            <div key={inv.id} className="p-2 rounded-md bg-elevated border border-theme/60 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="font-mono font-bold text-primary block">{inv.invoiceNumber}</span>
                                {inv.qcCondition === 'Other' && inv.otherRemark && (
                                   <span className="text-[10px] text-muted block italic">Remark: {inv.otherRemark}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-primary">{inv.boxCount} Boxes</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  inv.qcCondition === 'Good'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                }`}>
                                  {inv.qcCondition}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-muted">
                <p>Unloading & Dock QC has not been recorded yet.</p>
                {onOpenPhase2 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPhase2(entry);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <span>Proceed to Dock QC</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Custody Handover Card */}
          <div className="p-4 rounded-xl bg-elevated border border-theme space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-theme">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="font-extrabold text-primary text-xs uppercase tracking-wider">
                  Custody Handover & Sign-off
                </h3>
              </div>
              {isPhase3Done ? (
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Handover Completed
                </span>
              ) : (
                <span className="text-[11px] font-bold text-muted bg-surface px-2 py-0.5 rounded-md border border-theme">
                  Pending Handover
                </span>
              )}
            </div>

            {isPhase3Done && entry.phase3 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-muted block uppercase font-semibold">Account Incharge</span>
                    <span className="font-bold text-primary">{entry.phase3.accountInchargeName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block uppercase font-semibold">Total Invoices</span>
                    <span className="font-bold font-mono text-primary">{entry.phase3.totalInvoicesCalculated} Invoices</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block uppercase font-semibold">Confirmed Received Boxes</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{entry.phase3.receivedBoxesConfirmed} Boxes</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block uppercase font-semibold">Difference / Shortage</span>
                    <span className={`font-bold font-mono ${entry.phase3.differenceCount === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {entry.phase3.differenceCount === 0 ? '0 (Exact Match)' : `${entry.phase3.differenceCount} Boxes`}
                    </span>
                  </div>
                </div>

                {entry.phase3.shortageComment && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200">
                    <span className="font-bold block">Shortage / Discrepancy Explanation:</span>
                    {entry.phase3.shortageComment}
                  </div>
                )}

                {/* Digital Signature */}
                {entry.phase3.signatureDataUrl && (
                  <div className="p-3 rounded-lg bg-surface border border-theme flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-primary block">Account Incharge Digital Sign-off:</span>
                      <span className="text-[10px] text-secondary">Verified by {entry.phase3.signerName} at {new Date(entry.phase3.completedAt).toLocaleString()}</span>
                    </div>
                    <img
                      src={entry.phase3.signatureDataUrl}
                      alt="Digital Signature"
                      className="h-12 bg-white rounded-md border border-theme p-1 max-w-[160px] object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center text-muted">
                <p>Custody Handover has not been completed yet.</p>
                {isPhase2Done && onOpenPhase3 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPhase3(entry);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <span>Proceed to Custody Handover</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-elevated/80 border-t border-theme flex items-center justify-between">
          <div className="text-[11px] text-muted">
            Warehouse: <strong className="text-primary">{warehouse.name} ({warehouse.code})</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-surface hover:bg-surface/80 text-primary font-bold border border-theme transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
