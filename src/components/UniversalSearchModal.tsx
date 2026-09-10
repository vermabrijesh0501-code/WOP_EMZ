import React, { useState } from 'react';
import { Search, X, Truck, RotateCcw, Package } from 'lucide-react';
import { InwardGateEntry, ReturnBatch, ScannedReturnItem, Client, Courier } from '../types';

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateEntries: InwardGateEntry[];
  batches: ReturnBatch[];
  scannedItems: ScannedReturnItem[];
  clients: Client[];
  couriers: Courier[];
  onSelectResult: (type: 'inward' | 'rto', id: string) => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  isOpen,
  onClose,
  gateEntries,
  batches,
  scannedItems,
  clients,
  couriers,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedGate = q
    ? gateEntries.filter(
        g =>
          g.gatePassNumber.toLowerCase().includes(q) ||
          g.vehicleNumber.toLowerCase().includes(q) ||
          g.driverName.toLowerCase().includes(q) ||
          g.invoiceChallanNumber.toLowerCase().includes(q)
      )
    : [];

  const matchedBatches = q
    ? batches.filter(
        b =>
          b.batchNumber.toLowerCase().includes(q) ||
          b.batchType.toLowerCase().includes(q) ||
          (b.notes && b.notes.toLowerCase().includes(q))
      )
    : [];

  const matchedItems = q
    ? scannedItems.filter(
        i =>
          i.trackingNumber.toLowerCase().includes(q) ||
          (i.orderNumber && i.orderNumber.toLowerCase().includes(q)) ||
          (i.skuCode && i.skuCode.toLowerCase().includes(q))
      )
    : [];

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111D2C] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 transition-colors">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c141f]">
          <Search className="w-5 h-5 text-[#123B5D] dark:text-blue-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Universal Search across AWB #, Vehicle #, Gate Pass, Batch #, Order #..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-slate-900 dark:text-slate-100 font-semibold text-sm focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4 text-xs">
          {!query ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              Type any tracking number, vehicle plate, gate pass, or client name to search instantly.
            </div>
          ) : matchedGate.length === 0 && matchedBatches.length === 0 && matchedItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              No matching records found for "{query}".
            </div>
          ) : (
            <>
              {/* Gate Passes */}
              {matchedGate.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Inward Gate Passes ({matchedGate.length})
                  </div>
                  {matchedGate.map((g, idx) => (
                    <div
                      key={`search-gate-${g.id || g.gatePassNumber || idx}-${idx}`}
                      onClick={() => {
                        onSelectResult('inward', g.id);
                        onClose();
                      }}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-[#123B5D] dark:hover:border-blue-500 cursor-pointer flex items-center justify-between transition-colors shadow-xs"
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white">{g.gatePassNumber} • {g.vehicleNumber}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Driver: {g.driverName} • {g.expectedBoxCount} Cartons</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700/50">
                        {g.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Batches */}
              {matchedBatches.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-[#123B5D] dark:text-blue-400" /> Return Batches ({matchedBatches.length})
                  </div>
                  {matchedBatches.map((b, idx) => (
                    <div
                      key={`search-batch-${b.id || b.batchNumber || idx}-${idx}`}
                      onClick={() => {
                        onSelectResult('rto', b.id);
                        onClose();
                      }}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-[#123B5D] dark:hover:border-blue-500 cursor-pointer flex items-center justify-between transition-colors shadow-xs"
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white font-mono">{b.batchNumber}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{b.batchType} • {b.totalScanned} Items Scanned</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Scanned Tracking Barcodes */}
              {matchedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Scanned Tracking Numbers ({matchedItems.length})
                  </div>
                  {matchedItems.map((item, idx) => (
                    <div
                      key={`search-item-${item.id || item.trackingNumber || idx}-${idx}`}
                      onClick={() => {
                        onSelectResult('rto', item.batchId);
                        onClose();
                      }}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-500 cursor-pointer flex items-center justify-between transition-colors shadow-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">{item.trackingNumber}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Order: {item.orderNumber || 'N/A'} • Scanned By: {item.scannedByName}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                        {item.remark}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
