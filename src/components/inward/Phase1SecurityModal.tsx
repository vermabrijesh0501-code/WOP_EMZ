import React, { useState, useEffect } from 'react';
import {
  Truck,
  X,
  Clock,
  ShieldCheck,
  FileText,
  User as UserIcon,
  Phone,
  CreditCard,
  Building2,
  Package,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Warehouse,
  Client,
  Courier,
  VehicleType,
  User,
  Driver,
  InwardGateEntry,
  Phase1SecurityData,
  WAREHOUSE_DOCKS,
} from '../../types';

interface Phase1SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  activeWarehouse: Warehouse;
  clients: Client[];
  couriers: Courier[];
  vehicleTypes: VehicleType[];
  drivers?: Driver[];
  isB2B?: boolean;
  onSubmitPhase1: (entry: Omit<InwardGateEntry, 'id' | 'gatePassNumber' | 'entryTime'> & { phase1Data: Phase1SecurityData }) => void;
}

export const Phase1SecurityModal: React.FC<Phase1SecurityModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeWarehouse,
  clients,
  couriers,
  vehicleTypes,
  drivers = [],
  isB2B = false,
  onSubmitPhase1,
}) => {
  // Auto Date & Time in DD/MM/YYYY : HH:mm (24-hour format)
  const [currentDateTimeStr, setCurrentDateTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      setCurrentDateTimeStr(`${dd}/${mm}/${yyyy} : ${hh}:${min}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Form states
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState(vehicleTypes[0]?.id || '');
  const [courierPartner, setCourierPartner] = useState(''); // Free-text, NO dropdown
  const [transporterName, setTransporterName] = useState(''); // Free-text, NO dropdown
  const [driverName, setDriverName] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [invoiceCount, setInvoiceCount] = useState<number | ''>(1); // Manual numeric input only
  const [boxCount, setBoxCount] = useState<number | ''>(''); // Manual numeric input only
  const [alignedDock, setAlignedDock] = useState('Dock 01');
  const [remarks, setRemarks] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // When clients / vehicle types change, sync dropdown defaults if empty
  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clients, clientId]);

  useEffect(() => {
    if (!vehicleTypeId && vehicleTypes.length > 0) setVehicleTypeId(vehicleTypes[0].id);
  }, [vehicleTypes, vehicleTypeId]);

  if (!isOpen) return null;

  // Handle Driver Quick Select
  const handleDriverSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const drvId = e.target.value;
    if (!drvId) return;
    const selected = drivers.find(d => d.id === drvId);
    if (selected) {
      setDriverName(selected.name);
      setDriverMobile(selected.mobile);
      setDriverLicense(selected.licenseNumber);
      if (selected.transporterName && !transporterName) {
        setTransporterName(selected.transporterName);
      }
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!vehicleNumber.trim()) {
      errors.vehicleNumber = 'Vehicle Number is required';
    } else if (vehicleNumber.trim().length < 5) {
      errors.vehicleNumber = 'Enter a valid vehicle registration number';
    }

    if (!courierPartner.trim()) {
      errors.courierPartner = 'Courier Partner name is required';
    }

    if (!driverName.trim()) {
      errors.driverName = 'Driver Name is required';
    }

    if (!driverMobile.trim()) {
      errors.driverMobile = 'Mobile number is required';
    } else if (!/^[0-9+ -]{8,15}$/.test(driverMobile.trim())) {
      errors.driverMobile = 'Enter a valid mobile number';
    }

    if (!driverLicense.trim()) {
      errors.driverLicense = 'Driver License No. is required';
    }

    if (!clientId) {
      errors.clientId = 'Please select an Account Name';
    }

    if (invoiceCount === '' || Number(invoiceCount) < 1) {
      errors.invoiceCount = 'Invoice count must be at least 1';
    }

    if (!alignedDock) {
      errors.alignedDock = 'Please select an aligned dock';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const selectedClient = clients.find(c => c.id === clientId);
    const selectedVehicleType = vehicleTypes.find(vt => vt.id === vehicleTypeId);
    const numInvoices = Number(invoiceCount) || 1;
    const numBoxes = boxCount === '' ? 0 : Number(boxCount);

    const phase1Data: Phase1SecurityData = {
      gateEntryDateTime: currentDateTimeStr,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleTypeId,
      vehicleTypeName: selectedVehicleType?.typeName || 'Truck',
      courierPartner: courierPartner.trim(),
      courierName: courierPartner.trim(),
      transporterName: transporterName.trim() || undefined,
      driverName: driverName.trim(),
      driverMobile: driverMobile.trim(),
      driverLicense: driverLicense.trim().toUpperCase(),
      clientId,
      clientName: selectedClient?.name || 'Account',
      invoiceCount: numInvoices,
      boxCount: numBoxes,
      alignedDock,
      remarks: remarks.trim() || undefined,
      createdById: currentUser.id,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    onSubmitPhase1({
      warehouseId: activeWarehouse.id,
      companyId: activeWarehouse.companyId,
      clientId,
      courierPartner: courierPartner.trim(),
      transporterName: transporterName.trim() || undefined,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      vehicleTypeId,
      driverName: driverName.trim(),
      driverMobile: driverMobile.trim(),
      driverLicense: driverLicense.trim().toUpperCase(),
      invoiceChallanNumber: `INV-CNT-${numInvoices}`,
      invoiceValue: 0,
      expectedBoxCount: numBoxes,
      receivedBoxCount: 0,
      dockNumber: alignedDock,
      status: 'Gate In',
      entryType: isB2B ? 'B2B Return' : 'Inward',
      currentPhase: 'At Gate',
      remarks: remarks.trim() || undefined,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      phase1Data,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-surface border border-theme rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`px-6 py-4 ${isB2B ? 'bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950' : 'bg-gradient-to-r from-[#123B5D] to-[#1E4E79]'} text-white flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {isB2B ? 'New B2B Return / RTV Entry' : 'New Inward Gate Entry'}
              </h2>
              <p className="text-xs text-slate-200 mt-0.5">
                {isB2B
                  ? <>Vehicle check-in & B2B return arrival registration at <strong className="text-white">{activeWarehouse.name}</strong></>
                  : <>Vehicle check-in and arrival registration at <strong className="text-white">{activeWarehouse.name}</strong></>}
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

        {/* Auto Timestamp & Security Officer Banner */}
        <div className="px-6 py-2.5 bg-elevated/70 border-b border-theme flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span>Auto Date & Time:</span>
            <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              {currentDateTimeStr || 'Loading...'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-secondary text-[11px]">
            <UserIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Gate Incharge:</span>
            <strong className="text-primary">{currentUser?.name || 'Gate Officer'}</strong>
            <span className="text-muted font-mono">({currentUser?.role || 'Security Officer'})</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Section 1: Vehicle & Transport Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
              <Truck className="w-4 h-4 text-blue-500" />
              <span>1. Vehicle & Transport Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Vehicle Number */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Vehicle Registration No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH04 JK 8821"
                  value={vehicleNumber}
                  onChange={e => {
                    setVehicleNumber(e.target.value.toUpperCase());
                    if (formErrors.vehicleNumber) setFormErrors(prev => ({ ...prev, vehicleNumber: '' }));
                  }}
                  className={`w-full bg-elevated text-primary p-2.5 rounded-xl border ${
                    formErrors.vehicleNumber ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-theme'
                  } focus:outline-none focus:border-blue-500 uppercase font-mono font-bold tracking-wider`}
                />
                {formErrors.vehicleNumber && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.vehicleNumber}
                  </p>
                )}
              </div>

              {/* Vehicle Type */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Vehicle Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={vehicleTypeId}
                  onChange={e => setVehicleTypeId(e.target.value)}
                  className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-blue-500 font-semibold [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC]"
                >
                  {vehicleTypes.map(vt => (
                    <option key={vt.id} value={vt.id} className="bg-[#1E293B] text-[#F8FAFC]">
                      {vt.typeName} ({vt.capacityTons} Tons)
                    </option>
                  ))}
                </select>
              </div>

              {/* Courier Partner -> Free text, NO dropdown */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Courier Partner <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Blue Dart, Delhivery, DTDC"
                  value={courierPartner}
                  onChange={e => {
                    setCourierPartner(e.target.value);
                    if (formErrors.courierPartner) setFormErrors(prev => ({ ...prev, courierPartner: '' }));
                  }}
                  className={`w-full bg-elevated text-primary p-2.5 rounded-xl border ${
                    formErrors.courierPartner ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-theme'
                  } focus:outline-none focus:border-blue-500 font-semibold`}
                />
                {formErrors.courierPartner && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.courierPartner}
                  </p>
                )}
              </div>

              {/* Transporter -> Free text, NO dropdown */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Transporter (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SafeExpress, V-Trans, TCI"
                  value={transporterName}
                  onChange={e => setTransporterName(e.target.value)}
                  className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Driver Details */}
          <div className="space-y-3 pt-2 border-t border-theme">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
                <UserIcon className="w-4 h-4 text-indigo-500" />
                <span>2. Driver Credentials</span>
              </div>
              {drivers.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-muted">Quick Autofill:</span>
                  <select
                    onChange={handleDriverSelect}
                    defaultValue=""
                    className="bg-elevated text-secondary py-1 px-2 rounded-lg border border-theme text-[11px] [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC]"
                  >
                    <option value="" disabled className="bg-[#1E293B] text-slate-400">Select Driver Master</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id} className="bg-[#1E293B] text-[#F8FAFC]">{d.name} ({d.mobile})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Driver Name */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Driver Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar Yadav"
                  value={driverName}
                  onChange={e => {
                    setDriverName(e.target.value);
                    if (formErrors.driverName) setFormErrors(prev => ({ ...prev, driverName: '' }));
                  }}
                  className={`w-full bg-elevated text-primary p-2.5 rounded-xl border ${
                    formErrors.driverName ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-theme'
                  } focus:outline-none focus:border-blue-500 font-semibold`}
                />
                {formErrors.driverName && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.driverName}
                  </p>
                )}
              </div>

              {/* Driver Mobile */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={driverMobile}
                    onChange={e => {
                      setDriverMobile(e.target.value);
                      if (formErrors.driverMobile) setFormErrors(prev => ({ ...prev, driverMobile: '' }));
                    }}
                    className={`w-full bg-elevated text-primary pl-9 pr-3 py-2.5 rounded-xl border ${
                      formErrors.driverMobile ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-theme'
                    } focus:outline-none focus:border-blue-500 font-mono`}
                  />
                </div>
                {formErrors.driverMobile && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.driverMobile}
                  </p>
                )}
              </div>

              {/* Driver License No. */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Driver License No. <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH04 20180012345"
                    value={driverLicense}
                    onChange={e => {
                      setDriverLicense(e.target.value.toUpperCase());
                      if (formErrors.driverLicense) setFormErrors(prev => ({ ...prev, driverLicense: '' }));
                    }}
                    className={`w-full bg-elevated text-primary pl-9 pr-3 py-2.5 rounded-xl border ${
                      formErrors.driverLicense ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-theme'
                    } focus:outline-none focus:border-blue-500 uppercase font-mono font-bold`}
                  />
                </div>
                {formErrors.driverLicense && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.driverLicense}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Account Master & Dock Alignment */}
          <div className="space-y-3 pt-2 border-t border-theme">
            <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
              <Building2 className="w-4 h-4 text-emerald-500" />
              <span>3. Account & Dock Allocation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Account Name - dynamically updated from Account Master */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Account Name <span className="text-rose-500">*</span>
                </label>
                <select
                  value={clientId}
                  onChange={e => {
                    setClientId(e.target.value);
                    if (formErrors.clientId) setFormErrors(prev => ({ ...prev, clientId: '' }));
                  }}
                  className={`w-full bg-elevated text-primary p-2.5 rounded-xl border ${
                    formErrors.clientId ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-theme'
                  } focus:outline-none focus:border-blue-500 font-bold [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC]`}
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#1E293B] text-[#F8FAFC]">
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Count -> Manual numeric input only, NO slider or stepper */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Invoice Count <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Type number..."
                    value={invoiceCount}
                    onChange={e => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setInvoiceCount(val);
                      if (formErrors.invoiceCount) setFormErrors(prev => ({ ...prev, invoiceCount: '' }));
                    }}
                    className={`w-full bg-elevated text-primary pl-9 pr-3 py-2.5 rounded-xl border ${
                      formErrors.invoiceCount ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-theme'
                    } focus:outline-none focus:border-blue-500 font-bold font-mono`}
                  />
                </div>
                {formErrors.invoiceCount && (
                  <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.invoiceCount}
                  </p>
                )}
              </div>

              {/* Box Count -> Manual numeric input only, NO slider or stepper */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Declared Box Count
                </label>
                <div className="relative">
                  <Package className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={0}
                    placeholder="Type number..."
                    value={boxCount}
                    onChange={e => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setBoxCount(val);
                    }}
                    className="w-full bg-elevated text-primary pl-9 pr-3 py-2.5 rounded-xl border border-theme focus:outline-none focus:border-blue-500 font-bold font-mono"
                  />
                </div>
              </div>

              {/* Aligned Dock */}
              <div>
                <label className="block text-secondary font-bold mb-1">
                  Aligned Dock <span className="text-rose-500">*</span>
                </label>
                <select
                  value={alignedDock}
                  onChange={e => setAlignedDock(e.target.value)}
                  className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:outline-none focus:border-blue-500 font-bold text-amber-600 dark:text-amber-400 [&>option]:bg-[#1E293B] [&>option]:text-[#F8FAFC]"
                >
                  {WAREHOUSE_DOCKS.map(dock => (
                    <option key={dock} value={dock} className="bg-[#1E293B] text-[#F8FAFC]">
                      {dock}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Security Inspection & Remarks */}
          <div className="space-y-2 pt-2 border-t border-theme">
            <label className="block text-secondary font-bold">
              Inspection Remarks / Seal Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Vehicle seal intact upon arrival, container inspected..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full bg-elevated text-primary p-3 rounded-xl border border-theme focus:outline-none focus:border-blue-500"
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#123B5D] hover:bg-[#0D2E49] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-extrabold shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Gate Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
