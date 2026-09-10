import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Vibrate,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowLeft,
  X,
  List,
  Zap,
  Layers,
  Search,
  Eye,
  Printer,
} from 'lucide-react';
import {
  ReturnBatch,
  ScannedReturnItem,
  ReturnRemarkType,
  Warehouse,
  Client,
  Courier,
  User,
} from '../types';
import { generateBatchPDF } from '../utils/pdfGenerator';

interface HandheldScannerViewProps {
  activeBatch: ReturnBatch;
  batches: ReturnBatch[];
  scannedItems: ScannedReturnItem[];
  clients: Client[];
  couriers: Courier[];
  activeWarehouse: Warehouse;
  currentUser: User;
  onScanItem: (batchId: string, trackingNumber: string, remark: ReturnRemarkType) => { success: boolean; message: string; item?: ScannedReturnItem };
  onSelectBatch: (batchId: string) => void;
  onCloseBatchRequest: (batch: ReturnBatch) => void;
  onExitDeviceMode: () => void;
}

export const HandheldScannerView: React.FC<HandheldScannerViewProps> = ({
  activeBatch,
  batches,
  scannedItems,
  clients,
  couriers,
  activeWarehouse,
  currentUser,
  onScanItem,
  onSelectBatch,
  onCloseBatchRequest,
  onExitDeviceMode,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedRemark, setSelectedRemark] = useState<ReturnRemarkType>('Good');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showRecentDrawer, setShowRecentDrawer] = useState(false);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [batchPickerTab, setBatchPickerTab] = useState<'open' | 'closed'>('open');
  const [selectedClosedBatch, setSelectedClosedBatch] = useState<ReturnBatch | null>(null);
  const [closedSearchQuery, setClosedSearchQuery] = useState('');
  const [lastScan, setLastScan] = useState<{ success: boolean; msg: string; awb: string; time: string } | null>(null);
  const [scanAnimation, setScanAnimation] = useState<'success' | 'error' | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  const activeClient = clients.find(c => c.id === activeBatch.clientId);
  const activeCourier = couriers.find(cr => cr.id === activeBatch.courierId);
  const batchItems = scannedItems.filter(i => i.batchId === activeBatch.id);
  const openBatches = batches.filter(b => b.warehouseId === activeWarehouse.id && b.status === 'Open');
  const closedBatches = batches.filter(b => b.warehouseId === activeWarehouse.id && b.status === 'Closed');

  // Keep focus on input for hardware laser guns / PDA wedge
  useEffect(() => {
    const focusTimer = setInterval(() => {
      if (!isCameraActive && !showBatchPicker && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(focusTimer);
  }, [isCameraActive, showBatchPicker]);

  // Handle Hardware Gun / Keyboard wedge fast typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal or camera active, let normal input handle
      if (showBatchPicker || selectedClosedBatch) return;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter key from hardware scanner
      if (e.key === 'Enter') {
        if (scanBufferRef.current.length >= 3) {
          processScan(scanBufferRef.current);
          scanBufferRef.current = '';
          e.preventDefault();
        }
        return;
      }

      // Fast typing buffer (hardware gun sends keystrokes < 35ms apart)
      if (e.key.length === 1 && diff < 50) {
        scanBufferRef.current += e.key;
      } else if (diff >= 50) {
        scanBufferRef.current = e.key.length === 1 ? e.key : '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBatch.id, selectedRemark, showBatchPicker, selectedClosedBatch]);

  // Audio tone feedback synthesizer
  const playAudioTone = (isSuccess: boolean) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.28);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.28);
      }
    } catch (e) {}
  };

  // Haptic vibration feedback
  const triggerHaptic = (isSuccess: boolean) => {
    if (!vibrateEnabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
      if (isSuccess) {
        navigator.vibrate(60);
      } else {
        navigator.vibrate([120, 60, 120]);
      }
    } catch (e) {}
  };

  // Main scan execution
  const processScan = (rawTrackingNumber: string) => {
    const cleanAwb = rawTrackingNumber.trim().toUpperCase();
    if (!cleanAwb) return;

    const result = onScanItem(activeBatch.id, cleanAwb, selectedRemark);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastScan({
      success: result.success,
      msg: result.message,
      awb: cleanAwb,
      time: now,
    });

    setScanAnimation(result.success ? 'success' : 'error');
    setTimeout(() => setScanAnimation(null), 400);

    playAudioTone(result.success);
    triggerHaptic(result.success);

    setBarcodeInput('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      processScan(barcodeInput);
    }
  };

  // Camera Scanner Setup
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not supported on this browser/device.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // If Native BarcodeDetector is supported
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix'],
        });

        const detectLoop = async () => {
          if (!mediaStreamRef.current || !videoRef.current) return;
          try {
            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                if (detectedVal) {
                  processScan(detectedVal);
                  await new Promise(r => setTimeout(r, 1200));
                }
              }
            }
          } catch (err) {}
          if (isCameraActive) {
            requestAnimationFrame(detectLoop);
          }
        };

        requestAnimationFrame(detectLoop);
      }
    } catch (err: any) {
      setCameraError(err?.message || 'Could not access device camera. Please grant camera permissions.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setTorchOn(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track && (track.getCapabilities?.() as any)?.torch) {
      try {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      } catch (e) {}
    }
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const conditionButtons: { key: ReturnRemarkType; label: string; badge: string; color: string; activeColor: string }[] = [
    { key: 'Good', label: 'Good (QC Pass)', badge: '1', color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80', activeColor: 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-300 shadow-lg shadow-emerald-600/40' },
    { key: 'Damage', label: 'Damage', badge: '2', color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80', activeColor: 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-300 shadow-lg shadow-rose-600/40' },
    { key: 'Open Box', label: 'Open Box', badge: '3', color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80', activeColor: 'bg-amber-600 text-white border-amber-400 ring-2 ring-amber-300 shadow-lg shadow-amber-600/40' },
    { key: 'Wrong Product', label: 'Wrong Product', badge: '4', color: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80', activeColor: 'bg-purple-600 text-white border-purple-400 ring-2 ring-purple-300 shadow-lg shadow-purple-600/40' },
    { key: 'Short Qty', label: 'Short Qty', badge: '5', color: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/80', activeColor: 'bg-orange-600 text-white border-orange-400 ring-2 ring-orange-300 shadow-lg shadow-orange-600/40' },
    { key: 'Missing Product', label: 'Missing Prod', badge: '6', color: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/80', activeColor: 'bg-red-600 text-white border-red-400 ring-2 ring-red-300 shadow-lg shadow-red-600/40' },
    { key: 'Others', label: 'Others', badge: '7', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', activeColor: 'bg-slate-600 text-white border-slate-400 ring-2 ring-white/40 shadow-lg shadow-slate-600/40' },
  ];

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans select-none ${
      scanAnimation === 'success' ? 'ring-8 ring-inset ring-emerald-500/40 transition-all duration-300' : ''
    } ${
      scanAnimation === 'error' ? 'ring-8 ring-inset ring-rose-500/40 transition-all duration-300' : ''
    }`}>
      {/* 1. TOP DEVICE STATUS BAR */}
      <div className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800/90 px-3 py-2 sticky top-0 z-30 shadow-xs backdrop-blur">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={onExitDeviceMode}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="Exit Device Mode"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Desktop</span>
            </button>

            <button
              onClick={() => setShowBatchPicker(true)}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/40 text-[#123B5D] dark:text-indigo-300 text-left transition-all active:scale-95 cursor-pointer"
            >
              <div className="text-[9px] uppercase font-extrabold tracking-wider text-[#123B5D] dark:text-indigo-400 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" /> Batch Switch
              </div>
              <div className="text-xs font-black font-mono text-slate-900 dark:text-white truncate max-w-[130px]">
                {activeBatch.batchNumber}
              </div>
            </button>
          </div>

          {/* Quick Counter HUD */}
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-extrabold">Scanned</div>
              <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                {activeBatch.totalScanned}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">/{activeBatch.expectedCount || 50}</span>
              </div>
            </div>

            {/* Sound & Vibrate Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${soundEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}
                title="Sound Audio"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setVibrateEnabled(!vibrateEnabled)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${vibrateEnabled ? 'text-[#123B5D] dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}
                title="Vibration Haptics"
              >
                <Vibrate className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Client & Courier Strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 max-w-lg mx-auto">
          <span className="truncate font-bold text-slate-800 dark:text-slate-200">
            {activeClient?.name} • <span className="text-[#123B5D] dark:text-indigo-300 font-mono">{activeCourier?.name}</span>
          </span>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
            {activeWarehouse.code}
          </span>
        </div>
      </div>

      {/* 2. MAIN SCANNING INTERFACE (ERGONOMIC 1-HAND READY) */}
      <div className="flex-1 px-3 py-2 max-w-lg w-full mx-auto flex flex-col justify-between space-y-3 overflow-y-auto">
        {/* CAMERA SCANNER VIEWFINDER (IF ACTIVE) */}
        {isCameraActive && (
          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 shadow-2xl aspect-[4/3] flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Laser Scan Animation Line */}
            <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse pointer-events-none"></div>

            {/* Target Reticle */}
            <div className="absolute inset-10 border-2 border-dashed border-emerald-400/80 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-[10px] font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded backdrop-blur">
                Align AWB Barcode Inside Box
              </span>
            </div>

            {/* Camera Overlay Controls */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <button
                onClick={toggleTorch}
                className={`p-2 rounded-xl text-xs font-bold backdrop-blur cursor-pointer ${
                  torchOn ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/50' : 'bg-black/60 text-white'
                }`}
                title="Torch Light"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                onClick={stopCamera}
                className="p-2 rounded-xl bg-black/60 text-white text-xs font-bold backdrop-blur hover:bg-rose-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* SCAN ALERT BANNER */}
        {lastScan && (
          <div
            className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition-all animate-in fade-in zoom-in-95 duration-200 ${
              lastScan.success
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40 shadow-sm'
                : 'bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/40 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {lastScan.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <div className="truncate">
                <div className="font-black font-mono text-sm text-slate-900 dark:text-white">{lastScan.awb}</div>
                <div className="text-[11px] font-medium opacity-90 truncate">{lastScan.msg}</div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0 ml-2">{lastScan.time}</span>
          </div>
        )}

        {/* POINT 1: AWB NO OR ORDER NO INPUT & CAMERA BUTTON */}
        <form onSubmit={handleFormSubmit} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" />
              AWB No / Order No *
            </label>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
              ● Ready for Hardware Laser / Gun
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value.toUpperCase())}
                placeholder="Scan with Laser Gun or Type..."
                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-emerald-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 px-3.5 py-2.5 rounded-xl text-sm font-mono font-black border-2 border-indigo-300 dark:border-indigo-500/80 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 shadow-inner"
              />
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => {
                    setBarcodeInput('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Phone Camera Scanner Button */}
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              className={`p-3 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 border cursor-pointer ${
                isCameraActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-600/30'
                  : 'bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white border-indigo-300 dark:border-indigo-400 shadow-md shadow-indigo-600/30'
              }`}
              title={isCameraActive ? 'Stop Camera' : 'Start Camera Scanner'}
            >
              {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </button>
          </div>

          {/* Thumb Scan Submit Button */}
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#123B5D] to-teal-700 dark:from-emerald-600 dark:to-teal-600 hover:opacity-95 text-white text-xs font-black uppercase tracking-wider shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" /> Submit Scan (Enter)
          </button>
        </form>

        {/* POINT 2: COMPACT CONDITIONS SELECTION */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Condition:
            </label>
            <span className="text-[10px] font-black text-[#123B5D] dark:text-indigo-400 uppercase">
              Selected: <strong className="text-slate-900 dark:text-white underline">{selectedRemark}</strong>
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {conditionButtons.map(cond => (
              <button
                type="button"
                key={cond.key}
                onClick={() => {
                  setSelectedRemark(cond.key);
                  if (vibrateEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    try { navigator.vibrate(40); } catch (e) {}
                  }
                  inputRef.current?.focus();
                }}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-black border transition-all text-center truncate active:scale-95 cursor-pointer ${
                  selectedRemark === cond.key
                    ? cond.activeColor
                    : `${cond.color} hover:bg-slate-200 dark:hover:bg-slate-800/80`
                }`}
              >
                {cond.key}
              </button>
            ))}
          </div>
        </div>

        {/* RECENT 5 SCANNED TRACKING IDs (LINE ITEMS ON DEVICE SCREEN) */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-2.5 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <List className="w-3 h-3 text-[#123B5D] dark:text-indigo-400" />
              Recent 5 Scanned Parcels:
            </span>
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              {batchItems.length} Scanned
            </span>
          </div>

          {batchItems.length === 0 ? (
            <div className="py-3 text-center text-slate-400 dark:text-slate-500 text-[11px]">
              No scans yet in this batch.
            </div>
          ) : (
            <div className="space-y-1">
              {batchItems.slice(-5).reverse().map((item, idx) => (
                <div
                  key={`handheld-recent-${item.id || item.trackingNumber || idx}-${idx}`}
                  className="bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-xs truncate">
                      {item.trackingNumber}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                      {new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black shrink-0 ${
                      item.remark === 'Good'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        : item.remark === 'Damage' || item.remark === 'Missing Product'
                        ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                        : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                    }`}
                  >
                    {item.remark}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM DEVICE NAVIGATION & DRAWER */}
      <div className="bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 px-3 py-2 sticky bottom-0 z-30 shadow-md backdrop-blur">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          {/* View Recent Scanned List Button */}
          <button
            onClick={() => setShowRecentDrawer(true)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
          >
            <List className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Recent Scans ({batchItems.length})</span>
          </button>

          {/* Close Batch Button */}
          <button
            onClick={() => onCloseBatchRequest(activeBatch)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Close Batch & Sign</span>
          </button>
        </div>
      </div>

      {/* RECENT SCANNED ITEMS DRAWER / BOTTOM SHEET */}
      {showRecentDrawer && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end p-0">
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col w-full max-w-lg mx-auto shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <List className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" />
                  Scanned Items in {activeBatch.batchNumber}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Total: <strong className="text-emerald-600 dark:text-emerald-400">{batchItems.length} parcels scanned</strong>
                </p>
              </div>
              <button
                onClick={() => setShowRecentDrawer(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
              {batchItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No items scanned yet in this batch.
                </div>
              ) : (
                batchItems.slice().reverse().map((item, idx) => (
                  <div key={`handheld-all-${item.id || item.trackingNumber || idx}-${idx}`} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-black text-slate-900 dark:text-white">{item.trackingNumber}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {item.scannedByName}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                        item.remark === 'Good'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : item.remark === 'Damage' || item.remark === 'Missing Product'
                          ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                      }`}
                    >
                      {item.remark}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setShowRecentDrawer(false)}
                className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Back to Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH SELECTOR MODAL */}
      {showBatchPicker && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" /> Batches ({batches.filter(b => b.warehouseId === activeWarehouse.id).length})
              </h3>
              <button onClick={() => setShowBatchPicker(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* OPEN vs CLOSED TABS */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setBatchPickerTab('open')}
                className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  batchPickerTab === 'open'
                    ? 'bg-[#123B5D] dark:bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Open ({openBatches.length})
              </button>
              <button
                type="button"
                onClick={() => setBatchPickerTab('closed')}
                className={`py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  batchPickerTab === 'closed'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Closed ({closedBatches.length})
              </button>
            </div>

            {/* BATCH LIST */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {batchPickerTab === 'open' ? (
                openBatches.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">No open batches.</div>
                ) : (
                  openBatches.map((b, idx) => {
                    const client = clients.find(c => c.id === b.clientId);
                    const isSelected = b.id === activeBatch.id;

                    return (
                      <div
                        key={b.id || b.batchNumber || idx}
                        onClick={() => {
                          onSelectBatch(b.id);
                          setShowBatchPicker(false);
                        }}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-600/30 border-indigo-400 dark:border-indigo-500 text-slate-900 dark:text-white font-bold ring-1 ring-indigo-400 dark:ring-indigo-500'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold">{b.batchNumber}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{b.totalScanned} Scanned</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{client?.name}</div>
                      </div>
                    );
                  })
                )
              ) : (
                closedBatches.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">No closed batches.</div>
                ) : (
                  closedBatches.map((b, idx) => {
                    const client = clients.find(c => c.id === b.clientId);
                    const courier = couriers.find(cr => cr.id === b.courierId);

                    return (
                      <div
                        key={b.id || b.batchNumber || idx}
                        onClick={() => {
                          setSelectedClosedBatch(b);
                          setClosedSearchQuery('');
                          setShowBatchPicker(false);
                        }}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-[#123B5D] dark:text-indigo-300">
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>{b.batchNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {client?.name} • <span className="text-slate-700 dark:text-slate-300">{courier?.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Closed: {b.closedAt ? new Date(b.closedAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-xs block">
                            {b.totalScanned} items
                          </span>
                          <span className="text-[10px] text-[#123B5D] dark:text-indigo-400 font-medium flex items-center gap-0.5 justify-end mt-1">
                            <Eye className="w-2.5 h-2.5" /> View
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* CLOSED BATCH DETAIL SHEET IN DEVICE MODE */}
      {selectedClosedBatch && (() => {
        const closedItems = scannedItems.filter(i => i.batchId === selectedClosedBatch.id);
        const filteredClosedItems = closedItems.filter(i =>
          !closedSearchQuery ||
          i.trackingNumber.toLowerCase().includes(closedSearchQuery.toLowerCase()) ||
          i.remark.toLowerCase().includes(closedSearchQuery.toLowerCase())
        );
        const client = clients.find(c => c.id === selectedClosedBatch.clientId);
        const courier = couriers.find(cr => cr.id === selectedClosedBatch.courierId);

        // QC Breakdown
        const breakdownCounts: Record<string, number> = {};
        closedItems.forEach(i => {
          breakdownCounts[i.remark] = (breakdownCounts[i.remark] || 0) + 1;
        });

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end p-0">
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl max-h-[90vh] flex flex-col w-full max-w-lg mx-auto shadow-2xl animate-in slide-in-from-bottom duration-200">
              {/* HEADER */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black font-mono text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      {selectedClosedBatch.batchNumber}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                      Closed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {client?.name} • <span className="text-[#123B5D] dark:text-indigo-300">{courier?.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClosedBatch(null)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* CONTENT BODY */}
              <div className="p-3 overflow-y-auto flex-1 space-y-3 text-xs">
                {/* METRICS ROW */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Total Scanned</div>
                    <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {selectedClosedBatch.totalScanned} Parcels
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Driver / Rep</div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                      {selectedClosedBatch.driverName || 'Supervisor Verified'}
                    </div>
                    {selectedClosedBatch.driverMobile && (
                      <div className="text-[10px] text-slate-400 font-mono">{selectedClosedBatch.driverMobile}</div>
                    )}
                  </div>
                </div>

                {/* QC CONDITIONS BREAKDOWN */}
                {Object.keys(breakdownCounts).length > 0 && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      QC Breakdown:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(breakdownCounts).map(([remark, count]) => (
                        <span
                          key={remark}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                        >
                          {remark}: <strong className="text-emerald-600 dark:text-emerald-400 font-mono ml-0.5">{count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* SEARCH AWBs */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      <List className="w-3.5 h-3.5 text-[#123B5D] dark:text-indigo-400" />
                      Scanned Items ({closedItems.length}):
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search AWB in batch..."
                      value={closedSearchQuery}
                      onChange={e => setClosedSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:border-[#123B5D] dark:focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {filteredClosedItems.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No items found matching search.
                      </div>
                    ) : (
                      filteredClosedItems.map((item, idx) => (
                        <div
                          key={`handheld-closed-item-${item.id || item.trackingNumber || idx}-${idx}`}
                          className="bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs truncate">
                              {item.trackingNumber}
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              item.remark === 'Good'
                                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                : item.remark === 'Damage' || item.remark === 'Missing Product'
                                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                                : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                            }`}
                          >
                            {item.remark}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => generateBatchPDF(selectedClosedBatch, batchItems, activeWarehouse, client, courier)}
                  className="flex-1 py-2.5 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF Manifest</span>
                </button>
                <button
                  onClick={() => setSelectedClosedBatch(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
