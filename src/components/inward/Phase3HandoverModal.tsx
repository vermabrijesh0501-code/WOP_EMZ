import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Package,
  Edit3,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  InwardGateEntry,
  Phase3HandoverData,
  Warehouse,
  Client,
  User,
} from '../../types';

interface Phase3HandoverModalProps {
  isOpen: boolean;
  entry: InwardGateEntry | null;
  onClose: () => void;
  currentUser: User;
  activeWarehouse: Warehouse;
  clients: Client[];
  onSubmitPhase3: (gateEntryId: string, phase3Data: Phase3HandoverData) => void;
}

export const Phase3HandoverModal: React.FC<Phase3HandoverModalProps> = ({
  isOpen,
  entry,
  onClose,
  currentUser,
  activeWarehouse,
  clients,
  onSubmitPhase3,
}) => {
  if (!isOpen || !entry) return null;

  const client = clients.find(c => c.id === entry.clientId);

  // Auto-calculated totals from Phase 2
  const totalInvoicesCalculated = entry.phase2?.totalInvoicesCount || 1;
  const totalBoxesCalculated = entry.phase2?.totalBoxesCount || entry.expectedBoxCount || 0;

  // Form states
  const [accountInchargeName, setAccountInchargeName] = useState(
    entry.phase3?.accountInchargeName || currentUser.name || 'Account Incharge'
  );
  const [receivedBoxesConfirmed, setReceivedBoxesConfirmed] = useState<number>(
    entry.phase3?.receivedBoxesConfirmed ?? totalBoxesCalculated
  );
  const [shortageComment, setShortageComment] = useState(entry.phase3?.shortageComment || '');
  const [conditionConfirmed, setConditionConfirmed] = useState(entry.phase3?.conditionConfirmed ?? true);
  const [remarks, setRemarks] = useState(entry.phase3?.remarks || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Signature Canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  const differenceCount = receivedBoxesConfirmed - totalBoxesCalculated;
  const isVariance = differenceCount !== 0;

  // Initialize Canvas
  useEffect(() => {
    if (isOpen) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }
  }, [isOpen]);

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawnSignature(true);
    setValidationError(null);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnSignature(false);
  };

  const validate = (): boolean => {
    if (!accountInchargeName.trim()) {
      setValidationError('Account Incharge Name is required.');
      return false;
    }

    if (receivedBoxesConfirmed < 0) {
      setValidationError('Received boxes cannot be negative.');
      return false;
    }

    if (isVariance && (!shortageComment || !shortageComment.trim())) {
      setValidationError('Shortage / Difference detected! A mandatory explanation comment is required.');
      return false;
    }

    if (!conditionConfirmed) {
      setValidationError('Please check the condition confirmation acknowledgment.');
      return false;
    }

    if (!hasDrawnSignature && !entry.phase3?.signatureDataUrl) {
      setValidationError('Digital signature by Account Incharge is required to complete handover.');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    let signatureDataUrl = entry.phase3?.signatureDataUrl;
    if (canvasRef.current && hasDrawnSignature) {
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    }

    const phase3Data: Phase3HandoverData = {
      accountInchargeId: currentUser.id,
      accountInchargeName: accountInchargeName.trim(),
      totalInvoicesCalculated,
      totalBoxesCalculated,
      receivedBoxesConfirmed,
      differenceCount,
      shortageComment: isVariance ? shortageComment.trim() : undefined,
      conditionConfirmed,
      signatureDataUrl,
      signerName: accountInchargeName.trim(),
      completedAt: new Date().toISOString(),
      remarks: remarks.trim() || undefined,
    };

    onSubmitPhase3(entry.id, phase3Data);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-surface border border-theme rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Handover & Custodial Verification
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Account Incharge custodial verification & digital sign-off for <strong className="text-white font-mono">{entry.gatePassNumber}</strong>
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

        {/* Linked Verification Strip */}
        <div className="px-6 py-3 bg-elevated/70 border-b border-theme grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Gate Entry ID</span>
            <span className="font-mono font-extrabold text-primary">{entry.gatePassNumber}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Account (Client)</span>
            <span className="font-bold text-primary truncate block">{client?.name || 'Account'}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Vehicle & Dock</span>
            <span className="font-bold text-primary truncate block">{entry.vehicleNumber} ({entry.dockNumber || 'Dock 01'})</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">Dock QC Status</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              QC Completed ({entry.phase2?.goodCount || 0} Good, {entry.phase2?.damageCount || 0} Damaged)
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Validation Error */}
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2 font-semibold animate-in shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section 1: Account Incharge & Auto-Calculated Totals */}
          <div className="p-4 rounded-xl bg-elevated border border-theme space-y-3">
            <div className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-500" />
              <span>1. Account Custody & Auto-Calculated Volume</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Account Incharge Name */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Account Incharge Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountInchargeName}
                  onChange={e => setAccountInchargeName(e.target.value)}
                  placeholder="e.g. Vikram Mehta"
                  className="w-full bg-surface text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              {/* Total Invoices - Auto Calculated */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Total Invoices (From Phase 02)
                </label>
                <div className="w-full bg-surface text-primary p-2.5 rounded-xl border border-theme font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                  {totalInvoicesCalculated} Invoices
                </div>
                <span className="text-[10px] text-muted mt-1 block">
                  Auto-calculated across all dockets
                </span>
              </div>

              {/* Total Boxes - Auto Calculated */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Total Boxes (From Phase 02)
                </label>
                <div className="w-full bg-surface text-primary p-2.5 rounded-xl border border-theme font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                  {totalBoxesCalculated} Boxes
                </div>
                <span className="text-[10px] text-muted mt-1 block">
                  Cumulative sum of all invoice boxes
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Physical Box Count Confirmation & Shortage Verification */}
          <div className="p-4 rounded-xl bg-elevated border border-theme space-y-3">
            <div className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              <span>2. Physical Received Boxes Verification</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Physical Received Boxes (Confirmed) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={receivedBoxesConfirmed}
                  onChange={e => setReceivedBoxesConfirmed(Number(e.target.value))}
                  className={`w-full bg-surface text-primary p-2.5 rounded-xl border ${
                    isVariance ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-theme'
                  } focus:outline-none focus:border-emerald-500 font-extrabold font-mono text-base`}
                />
              </div>

              {/* Difference Status Box */}
              <div className="flex flex-col justify-center">
                <span className="text-secondary font-bold mb-1 text-[11px]">Variance / Difference:</span>
                {differenceCount === 0 ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Exact Match (0 Difference)</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>
                      {differenceCount < 0 ? `Shortage: ${differenceCount} Boxes` : `Excess: +${differenceCount} Boxes`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mandatory Shortage Comment if Difference != 0 */}
            {isVariance && (
              <div className="pt-2 animate-in fade-in space-y-1.5">
                <label className="block text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>Mandatory Shortage / Variance Explanation Comment *</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain reason for discrepancy (e.g. 2 cartons missing from Transporter manifest, claim initiated)..."
                  value={shortageComment}
                  onChange={e => setShortageComment(e.target.value)}
                  className="w-full bg-surface text-primary p-2.5 rounded-xl border border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-medium"
                />
              </div>
            )}
          </div>

          {/* Section 3: Condition Confirmation Checkbox */}
          <div className="p-4 rounded-xl bg-elevated border border-theme">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={conditionConfirmed}
                onChange={e => setConditionConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-extrabold text-primary block">
                  Condition Confirmation & Custody Acceptance *
                </span>
                <span className="text-secondary block mt-0.5">
                  I confirm that I have inspected the condition of the goods against the dock QC record (Good: {entry.phase2?.goodCount || 0}, Damage: {entry.phase2?.damageCount || 0}, Open Boxes: {entry.phase2?.openBoxesCount || 0}, Missing: {entry.phase2?.missingBoxesCount || 0}) and accept custody on behalf of {client?.name || 'Account'}.
                </span>
              </div>
            </label>
          </div>

          {/* Section 4: Digital Signature Canvas */}
          <div className="p-4 rounded-xl bg-elevated border border-theme space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-primary text-xs uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-500" />
                <span>Account Incharge Digital Signature *</span>
              </label>
              <button
                type="button"
                onClick={handleClearSignature}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-rose-500 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Signature</span>
              </button>
            </div>

            <div className="border border-dashed border-theme rounded-xl bg-white dark:bg-slate-950/80 p-1 flex justify-center">
              <canvas
                ref={canvasRef}
                width={500}
                height={120}
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
                className="cursor-crosshair w-full max-w-[500px] h-[120px] bg-white rounded-lg touch-none"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-secondary">
              <span>Sign above using mouse pointer or touch screen</span>
              <span className="font-mono text-muted">Signer: {accountInchargeName}</span>
            </div>
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Custody Handover</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
