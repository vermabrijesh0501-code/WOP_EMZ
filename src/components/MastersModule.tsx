import React, { useState } from 'react';
import {
  Layers,
  Building2,
  Warehouse as WHIcon,
  Users,
  Truck,
  Package,
  Shield,
  Phone,
  Sliders,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Edit2,
  Trash2,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  Company,
  Warehouse,
  Client,
  Courier,
  SKU,
  User,
  UserRole,
  Department,
  Driver,
  VehicleType,
  ReturnReason,
  ModuleId,
  ModulePermission,
} from '../types';
import { ROLE_DEFAULT_PERMISSIONS, getRoleBadgeConfig } from '../utils/rbac';

interface MastersModuleProps {
  companies: Company[];
  warehouses: Warehouse[];
  clients: Client[];
  couriers: Courier[];
  skus: SKU[];
  users: User[];
  drivers: Driver[];
  vehicleTypes: VehicleType[];
  returnReasons: ReturnReason[];
  onAddMasterRecord: (category: string, record: any) => void;
  onUpdateMasterRecord: (category: string, id: string, updatedRecord: any) => void;
  onDeleteMasterRecord: (category: string, id: string) => void;
  onToggleHoldMasterRecord: (category: string, id: string) => void;
}

const ALL_SYSTEM_MODULES: { id: ModuleId; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard & Daily KPIs', description: 'Overview metrics, pie charts & live dock stats' },
  { id: 'inward', label: 'Inward Gate Entry', description: 'Vehicle gate register, driver logging & box counts' },
  { id: 'returns_rto', label: 'RTO / B2C Returns', description: 'Batch scanning, 7 QC conditions & closed manifests' },
  { id: 'returns_b2b', label: 'B2B Returns', description: 'Box-level pallet inward & bulk invoice validation' },
  { id: 'masters', label: 'Master Data & RBAC', description: 'Client, courier, SKU, facility & user access controls' },
  { id: 'reports', label: 'Reports & Manifest', description: 'PDF manifest downloads, CSV exports & courier reports' },
];

export const MastersModule: React.FC<MastersModuleProps> = ({
  companies,
  warehouses,
  clients,
  couriers,
  skus,
  users,
  drivers,
  vehicleTypes,
  returnReasons,
  onAddMasterRecord,
  onUpdateMasterRecord,
  onDeleteMasterRecord,
  onToggleHoldMasterRecord,
}) => {
  const [activeTab, setActiveTab] = useState<string>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'On Hold' | 'Inactive'>('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{ category: string; data: any } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [userPermissions, setUserPermissions] = useState<Record<ModuleId, ModulePermission>>(() =>
    JSON.parse(JSON.stringify(ROLE_DEFAULT_PERMISSIONS['Supervisor']))
  );

  const masterCategories = [
    { id: 'clients', label: '1. Client / Brand Master', icon: Users, count: clients.length },
    { id: 'couriers', label: '2. Courier Master', icon: Truck, count: couriers.length },
    { id: 'users', label: '3. User Master & Access Control', icon: Shield, count: users.length },
    { id: 'skus', label: '4. SKU / Item Master', icon: Package, count: skus.length },
    { id: 'warehouses', label: '5. Warehouse Master', icon: WHIcon, count: warehouses.length },
    { id: 'return_reasons', label: '6. Return Conditions (7)', icon: Sliders, count: returnReasons.length },
    { id: 'companies', label: '7. Company Master', icon: Building2, count: companies.length },
    { id: 'drivers', label: '8. Driver Master', icon: Phone, count: drivers.length },
    { id: 'vehicle_types', label: '9. Vehicle Types', icon: Truck, count: vehicleTypes.length },
  ];

  // Open Add Record Modal
  const handleOpenAdd = () => {
    let initial: Record<string, any> = { status: 'Active' };
    if (activeTab === 'clients') {
      initial = {
        code: `CLI-${(clients.length + 1).toString().padStart(3, '0')}`,
        name: '',
        category: 'Personal Care',
        email: '',
        phone: '',
        companyId: companies[0]?.id || 'comp-1',
        status: 'Active',
      };
    } else if (activeTab === 'couriers') {
      initial = {
        code: '',
        name: '',
        trackingFormatPattern: 'AWB 10-14 DIGITS',
        contactNumber: '',
        apiSupported: true,
        status: 'Active',
      };
    } else if (activeTab === 'users') {
      initial = {
        empId: `EMP-${1000 + users.length + 1}`,
        name: '',
        email: '',
        phone: '',
        password: 'password123',
        role: 'Supervisor',
        department: 'Operations Management',
        companyId: companies[0]?.id || 'comp-1',
        assignedWarehouseIds: [warehouses[0]?.id || 'wh-main'],
        assignedClientIds: clients.map(c => c.id),
        status: 'Active',
      };
      setUserPermissions(JSON.parse(JSON.stringify(ROLE_DEFAULT_PERMISSIONS['Supervisor'])));
    } else if (activeTab === 'skus') {
      initial = {
        clientId: clients[0]?.id || '',
        skuCode: '',
        eanBarcode: '',
        name: '',
        category: 'General',
        unitPrice: 499,
        weightGrams: 100,
        status: 'Active',
      };
    } else if (activeTab === 'warehouses') {
      initial = {
        code: `WH-0${warehouses.length + 1}`,
        name: '',
        city: '',
        address: '',
        totalDocks: 10,
        companyId: companies[0]?.id || 'comp-1',
        status: 'Active',
      };
    } else if (activeTab === 'return_reasons') {
      initial = {
        code: `REASON-${returnReasons.length + 1}`,
        label: '',
        category: 'Both',
        requirePhoto: false,
        status: 'Active',
      };
    } else if (activeTab === 'drivers') {
      initial = {
        name: '',
        mobile: '',
        licenseNumber: '',
        transporterName: couriers[0]?.name || 'Logistics Partner',
        status: 'Active',
      };
    } else if (activeTab === 'vehicle_types') {
      initial = {
        typeName: '',
        capacityTons: 5,
        status: 'Active',
      };
    }
    setFormData(initial);
    setIsAddModalOpen(true);
  };

  // Open Edit Record Modal
  const handleOpenEdit = (category: string, item: any) => {
    setEditingRecord({ category, data: item });
    setFormData({ ...item });
    if (category === 'users') {
      if (item.permissions) {
        setUserPermissions(JSON.parse(JSON.stringify(item.permissions)));
      } else if (ROLE_DEFAULT_PERMISSIONS[item.role as UserRole]) {
        setUserPermissions(JSON.parse(JSON.stringify(ROLE_DEFAULT_PERMISSIONS[item.role as UserRole])));
      }
    }
  };

  // Save Add
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `${activeTab.slice(0, 3)}-${Date.now()}`;
    const newRecord = {
      id,
      ...formData,
      status: formData.status || 'Active',
      ...(activeTab === 'users' ? { permissions: userPermissions } : {}),
    };
    onAddMasterRecord(activeTab, newRecord);
    setIsAddModalOpen(false);
    setFormData({});
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const updated = {
      ...formData,
      ...(editingRecord.category === 'users' ? { permissions: userPermissions } : {}),
    };
    onUpdateMasterRecord(editingRecord.category, editingRecord.data.id, updated);
    setEditingRecord(null);
    setFormData({});
  };

  // Delete
  const handleDelete = (category: string, id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}" from ${category.toUpperCase()} master?`)) {
      onDeleteMasterRecord(category, id);
    }
  };

  // Quick Preset Add Brand
  const handleQuickAddBrand = (brandName: string, category: string, code: string) => {
    const id = `cli-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if (clients.some(c => c.code === code || c.name.toLowerCase() === brandName.toLowerCase())) {
      alert(`Brand ${brandName} already exists!`);
      return;
    }
    const newClient: Client = {
      id,
      companyId: companies[0]?.id || 'comp-1',
      code,
      name: brandName,
      email: `ops@${code.toLowerCase().replace(/[^a-z0-9]/g, '')}.in`,
      phone: '+91 22 4000 0000',
      category,
      status: 'Active',
    };
    onAddMasterRecord('clients', newClient);
  };

  // Quick Preset Add Courier
  const handleQuickAddCourier = (courierName: string, code: string, pattern: string, helpline: string) => {
    const id = `cour-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    if (couriers.some(c => c.code === code || c.name.toLowerCase() === courierName.toLowerCase())) {
      alert(`Courier ${courierName} already exists!`);
      return;
    }
    const newCourier: Courier = {
      id,
      code,
      name: courierName,
      trackingFormatPattern: pattern,
      contactNumber: helpline,
      apiSupported: true,
      status: 'Active',
    };
    onAddMasterRecord('couriers', newCourier);
  };

  // Toggle user permission module / action
  const togglePermission = (modId: ModuleId, action: keyof ModulePermission) => {
    setUserPermissions(prev => {
      const current = prev[modId] || { view: false };
      return {
        ...prev,
        [modId]: {
          ...current,
          [action]: !current[action],
        },
      };
    });
  };

  // Apply Role Preset to Permissions
  const applyRolePreset = (role: UserRole) => {
    if (ROLE_DEFAULT_PERMISSIONS[role]) {
      setUserPermissions(JSON.parse(JSON.stringify(ROLE_DEFAULT_PERMISSIONS[role])));
      setFormData(prev => ({ ...prev, role }));
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'Active') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3" /> Active
        </span>
      );
    }
    if (status === 'On Hold') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 flex items-center gap-1 w-fit">
          <PauseCircle className="w-3 h-3" /> On Hold
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 w-fit">
        <AlertCircle className="w-3 h-3" /> Inactive
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Title & Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-primary flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#123B5D] dark:text-blue-400" /> Master Data Management & RBAC Access Control
          </h1>
          <p className="text-xs text-secondary mt-1">
            Configure Client Brands, Courier Logistics Partners, User Roles & Approved Tabs, SKUs, and Warehouse Facilities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add New {masterCategories.find(c => c.id === activeTab)?.label.split('. ')[1] || 'Record'}
          </button>
        </div>
      </div>

      {/* Master Tabs List */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-theme pb-2 scrollbar-thin">
        {masterCategories.map(cat => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveTab(cat.id);
                setSearchQuery('');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#123B5D] dark:bg-blue-600 text-white shadow-sm'
                  : 'bg-surface text-secondary hover:text-primary border border-theme'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-elevated text-secondary'}`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface border border-theme p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm transition-colors">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            type="text"
            placeholder={`Search in ${activeTab.toUpperCase()} master...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-elevated border border-theme rounded-lg px-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#123B5D] dark:focus:border-blue-500 w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-secondary font-medium">Status:</span>
          <div className="flex items-center bg-elevated rounded-lg p-0.5 border border-theme">
            {(['ALL', 'Active', 'On Hold', 'Inactive'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                  statusFilter === st
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

      {/* QUICK PRESETS FOR CLIENTS & BRANDS */}
      {activeTab === 'clients' && (
        <div className="bg-surface border border-theme p-3.5 rounded-xl space-y-2 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Add Popular Brands & Accounts:
            </span>
            <span className="text-[11px] text-muted">Click any brand to instantly provision</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { name: 'Bella Vita Organic', cat: 'Personal Care', code: 'CLI-BV' },
              { name: 'Nykaa E-Retail', cat: 'Cosmetics', code: 'CLI-NYK' },
              { name: 'Honasa (Mamaearth)', cat: 'Personal Care', code: 'CLI-MME' },
              { name: 'Imagine Marketing (boAt)', cat: 'Consumer Electronics', code: 'CLI-BOAT' },
              { name: 'SUGAR Cosmetics', cat: 'Cosmetics', code: 'CLI-SUG' },
              { name: 'Wow Skin Science', cat: 'Skin Care', code: 'CLI-WOW' },
              { name: 'Minimalist (Be Minimalist)', cat: 'Skin Care', code: 'CLI-MIN' },
              { name: 'Plum Goodness', cat: 'Beauty & Wellness', code: 'CLI-PLUM' },
              { name: 'Snitch Menswear', cat: 'Apparel & Fashion', code: 'CLI-SNITCH' },
              { name: 'Noise Electronics', cat: 'Smart Wearables', code: 'CLI-NOISE' },
              { name: 'Fire-Boltt', cat: 'Smart Wearables', code: 'CLI-FIRE' },
              { name: 'The Man Company', cat: 'Men Grooming', code: 'CLI-TMC' },
            ].map(b => (
              <button
                key={b.code}
                onClick={() => handleQuickAddBrand(b.name, b.cat, b.code)}
                className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-elevated/80 border border-theme text-secondary hover:text-primary text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-[#123B5D] dark:text-blue-400" /> {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QUICK PRESETS FOR COURIERS */}
      {activeTab === 'couriers' && (
        <div className="bg-surface border border-theme p-3.5 rounded-xl space-y-2 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#123B5D] dark:text-blue-400" /> Quick Add Popular Courier Logistics Partners:
            </span>
            <span className="text-[11px] text-muted">Click any courier to instantly provision</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { name: 'Delhivery Surface & Express', code: 'DELHIVERY', pattern: '14 DIGITS / DELH...', helpline: '1800-103-6354' },
              { name: 'Blue Dart Express Ltd', code: 'BLUEDART', pattern: '11 DIGITS', helpline: '1860-233-1234' },
              { name: 'XpressBees Logistics', code: 'XPRESSBEES', pattern: 'XB+12 DIGITS', helpline: '020-4911-6100' },
              { name: 'Shadowfax Technologies', code: 'SHADOWFAX', pattern: 'SFX+10 DIGITS', helpline: '080-6818-8000' },
              { name: 'Ecom Express Ltd', code: 'ECOM_EXP', pattern: 'ECOM+9 DIGITS', helpline: '0124-490-5000' },
              { name: 'DTDC Express Ltd', code: 'DTDC', pattern: 'D+9 DIGITS', helpline: '080-2536-5032' },
              { name: 'Amazon Shipping India', code: 'AMAZON_SHIP', pattern: 'TBA+12 DIGITS', helpline: '1800-3000-9009' },
              { name: 'Ekart Logistics', code: 'EKART', pattern: 'FMPC+10 DIGITS', helpline: '1800-208-9898' },
              { name: 'Smartr Logistics', code: 'SMARTR', pattern: 'SMR+10 DIGITS', helpline: '1800-200-8899' },
            ].map(cr => (
              <button
                key={cr.code}
                onClick={() => handleQuickAddCourier(cr.name, cr.code, cr.pattern, cr.helpline)}
                className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-elevated/80 border border-theme text-secondary hover:text-primary text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> {cr.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 1. CLIENTS TABLE */}
      {activeTab === 'clients' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Client Code</th>
                  <th className="px-4 py-3">Brand Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Email & Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {clients
                  .filter(c => {
                    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(client => (
                    <tr key={client.id} className="hover:bg-elevated/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#123B5D] dark:text-indigo-400">{client.code}</td>
                      <td className="px-4 py-3 font-bold text-primary text-sm">{client.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-elevated font-medium text-secondary border border-theme">
                          {client.category || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        <div>{client.email || '-'}</div>
                        <div className="text-[10px] text-muted">{client.phone || '-'}</div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(client.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onToggleHoldMasterRecord('clients', client.id)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              client.status === 'Active' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                            }`}
                            title={client.status === 'Active' ? 'Put on Hold' : 'Activate Client'}
                          >
                            {client.status === 'Active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit('clients', client)}
                            className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                            title="Edit Client"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('clients', client.id, client.name)}
                            className="p-1.5 rounded-lg bg-elevated hover:bg-red-50 dark:hover:bg-red-900/50 text-muted hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer border border-theme"
                            title="Delete Client"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. COURIERS TABLE */}
      {activeTab === 'couriers' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Courier Code</th>
                  <th className="px-4 py-3">Logistics Partner Name</th>
                  <th className="px-4 py-3">AWB Barcode Pattern</th>
                  <th className="px-4 py-3">Helpline & Support</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {couriers
                  .filter(cr => {
                    if (statusFilter !== 'ALL' && cr.status !== statusFilter) return false;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return cr.name.toLowerCase().includes(q) || cr.code.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(courier => (
                    <tr key={courier.id} className="hover:bg-elevated/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#123B5D] dark:text-blue-400">{courier.code}</td>
                      <td className="px-4 py-3 font-bold text-primary text-sm">{courier.name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-secondary">
                        {courier.trackingFormatPattern || 'Standard 10-14 Digits'}
                      </td>
                      <td className="px-4 py-3 text-secondary">{courier.contactNumber || '1800-100-2000'}</td>
                      <td className="px-4 py-3">{getStatusBadge(courier.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onToggleHoldMasterRecord('couriers', courier.id)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              courier.status === 'Active' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {courier.status === 'Active' ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit('couriers', courier)}
                            className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('couriers', courier.id, courier.name)}
                            className="p-1.5 rounded-lg bg-elevated hover:bg-red-50 dark:hover:bg-red-900/50 text-muted hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer border border-theme"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. USERS & RBAC ACCESS CONTROL TABLE */}
      {activeTab === 'users' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Emp ID</th>
                  <th className="px-4 py-3">User Name & Email</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Approved Modules / Tabs</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {users
                  .filter(u => {
                    if (!u) return false;
                    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(user => {
                    const roleCfg = getRoleBadgeConfig((user.role || 'Operator') as UserRole);
                    const perms = user.permissions || (user.role ? ROLE_DEFAULT_PERMISSIONS[user.role] : {}) || {};
                    const visibleModulesCount = Object.values(perms).filter((p: any) => p.view).length;

                    return (
                      <tr key={user.id} className="hover:bg-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#123B5D] dark:text-blue-400">{user.empId || 'EMP-1001'}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-primary text-sm">{user.name}</div>
                          <div className="text-muted text-[11px]">{user.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-secondary">{user.department || 'Operations'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-[#123B5D] dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800/50 text-[11px]">
                              {user.role === 'Super Admin' ? 'All 7 Tabs (Full)' : `${visibleModulesCount} of 7 Tabs`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit('users', user)}
                              className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                              title="Edit User & Permissions"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('users', user.id, user.name)}
                              className="p-1.5 rounded-lg bg-elevated hover:bg-red-50 dark:hover:bg-red-900/50 text-muted hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer border border-theme"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SKUs TABLE */}
      {activeTab === 'skus' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">SKU Code</th>
                  <th className="px-4 py-3">EAN Barcode</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Brand / Client</th>
                  <th className="px-4 py-3">Price (MRP)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {skus
                  .filter(s => {
                    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return s.skuCode.toLowerCase().includes(q) || s.eanBarcode.includes(q) || s.name.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(sku => {
                    const client = clients.find(c => c.id === sku.clientId);
                    return (
                      <tr key={sku.id} className="hover:bg-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{sku.skuCode}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{sku.eanBarcode}</td>
                        <td className="px-4 py-3 font-bold text-primary">{sku.name}</td>
                        <td className="px-4 py-3 text-secondary">{client?.name || 'General'}</td>
                        <td className="px-4 py-3 font-bold text-primary">₹{sku.unitPrice || 499}</td>
                        <td className="px-4 py-3">{getStatusBadge(sku.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit('skus', sku)}
                              className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('skus', sku.id, sku.name)}
                              className="p-1.5 rounded-lg bg-elevated hover:bg-red-50 dark:hover:bg-red-900/50 text-muted hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer border border-theme"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. WAREHOUSES TABLE */}
      {activeTab === 'warehouses' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Facility Code</th>
                  <th className="px-4 py-3">Warehouse Hub Name</th>
                  <th className="px-4 py-3">City / State</th>
                  <th className="px-4 py-3">Total Dock Doors</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {warehouses
                  .filter(w => {
                    if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q) || w.city.toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map(wh => (
                    <tr key={wh.id} className="hover:bg-elevated/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#123B5D] dark:text-blue-400">{wh.code}</td>
                      <td className="px-4 py-3 font-bold text-primary text-sm">{wh.name}</td>
                      <td className="px-4 py-3 text-secondary">{wh.city}</td>
                      <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">{wh.totalDocks || 10} Docks</td>
                      <td className="px-4 py-3">{getStatusBadge(wh.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit('warehouses', wh)}
                            className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('warehouses', wh.id, wh.name)}
                            className="p-1.5 rounded-lg bg-elevated hover:bg-red-50 dark:hover:bg-red-900/50 text-muted hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer border border-theme"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. RETURN CONDITIONS TABLE */}
      {activeTab === 'return_reasons' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Reason Code</th>
                  <th className="px-4 py-3">Condition Label</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Photo Mandatory</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {returnReasons.map(r => (
                  <tr key={r.id} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#123B5D] dark:text-blue-400">{r.code}</td>
                    <td className="px-4 py-3 font-bold text-primary">{r.label}</td>
                    <td className="px-4 py-3 text-secondary">{r.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.requirePhoto ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50' : 'bg-elevated text-muted'}`}>
                        {r.requirePhoto ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit('return_reasons', r)}
                          className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. COMPANIES TABLE */}
      {activeTab === 'companies' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Company Code</th>
                  <th className="px-4 py-3">Entity Name</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Headquarters</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {companies.map(comp => (
                  <tr key={comp.id} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#123B5D] dark:text-blue-400">{comp.code}</td>
                    <td className="px-4 py-3 font-bold text-primary">{comp.name}</td>
                    <td className="px-4 py-3 font-mono text-secondary">{comp.gstin || '27AAACE1234F1Z5'}</td>
                    <td className="px-4 py-3 text-secondary">{comp.address || 'Mumbai, Maharashtra'}</td>
                    <td className="px-4 py-3">{getStatusBadge(comp.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. DRIVERS TABLE */}
      {activeTab === 'drivers' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Driver Name</th>
                  <th className="px-4 py-3">Mobile Contact</th>
                  <th className="px-4 py-3">License Number</th>
                  <th className="px-4 py-3">Transporter / Courier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {drivers.map(d => (
                  <tr key={d.id} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-primary">{d.name}</td>
                    <td className="px-4 py-3 font-mono text-secondary">{d.mobile}</td>
                    <td className="px-4 py-3 font-mono text-muted">{d.licenseNumber}</td>
                    <td className="px-4 py-3 text-secondary">{d.transporterName}</td>
                    <td className="px-4 py-3">{getStatusBadge(d.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit('drivers', d)}
                          className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. VEHICLE TYPES TABLE */}
      {activeTab === 'vehicle_types' && (
        <div className="bg-surface border border-theme rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated text-secondary uppercase font-bold text-[10px] border-b border-theme">
                <tr>
                  <th className="px-4 py-3">Vehicle Type Name</th>
                  <th className="px-4 py-3">Rated Capacity (Tons)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme text-primary">
                {vehicleTypes.map(vt => (
                  <tr key={vt.id} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-4 py-3 font-bold text-primary">{vt.typeName}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">{vt.capacityTons} Tons</td>
                    <td className="px-4 py-3">{getStatusBadge(vt.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit('vehicle_types', vt)}
                          className="p-1.5 rounded-lg bg-elevated hover:bg-elevated/80 text-secondary hover:text-primary transition-colors cursor-pointer border border-theme"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE RECORD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-theme rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <h3 className="text-base font-extrabold text-primary">
                Add New {masterCategories.find(c => c.id === activeTab)?.label.split('. ')[1]}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted hover:text-primary font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4">
              {/* CLIENT ADD */}
              {activeTab === 'clients' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Client Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.code || ''}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono"
                        placeholder="CLI-BV"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Brand / Company Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="Bella Vita Organic"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Category</label>
                      <input
                        type="text"
                        value={formData.category || ''}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="Personal Care / Beauty"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Billing Email</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="ops@brand.com"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* COURIER ADD */}
              {activeTab === 'couriers' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Courier Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.code || ''}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono"
                        placeholder="DELHIVERY"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Courier Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="Delhivery Surface"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">AWB Barcode Pattern</label>
                      <input
                        type="text"
                        value={formData.trackingFormatPattern || ''}
                        onChange={e => setFormData({ ...formData, trackingFormatPattern: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono"
                        placeholder="14 Digits (DELH...)"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Helpline Phone</label>
                      <input
                        type="text"
                        value={formData.contactNumber || ''}
                        onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="1800-103-6354"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* USER & RBAC ADD */}
              {activeTab === 'users' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Employee ID *</label>
                      <input
                        type="text"
                        required
                        value={formData.empId || ''}
                        onChange={e => setFormData({ ...formData, empId: e.target.value.toUpperCase() })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="e.g. Ramesh Kumar"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Email / Login ID *</label>
                      <input
                        type="email"
                        required
                        value={formData.email || ''}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="ramesh@emiza.com"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Password</label>
                      <input
                        type="password"
                        value={formData.password || 'password123'}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">System Role *</label>
                      <select
                        value={formData.role || 'Supervisor'}
                        onChange={e => {
                          const newRole = e.target.value as UserRole;
                          setFormData({ ...formData, role: newRole });
                          applyRolePreset(newRole);
                        }}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:border-[#123B5D] dark:focus:border-blue-500 focus:outline-none"
                      >
                        <option value="Super Admin">Super Admin (All Facilities & Settings)</option>
                        <option value="Admin">Admin</option>
                        <option value="Warehouse Manager">Warehouse Manager</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Security Officer">Security Officer (Gate Inward)</option>
                        <option value="RTO Operator">RTO Operator (Returns Scanning)</option>
                        <option value="GRN Operator">GRN Operator</option>
                        <option value="Auditor">Auditor (Cycle Count / Scanner)</option>
                        <option value="Operator">Operator</option>
                        <option value="Read Only">Read Only (Viewer)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Department</label>
                      <input
                        type="text"
                        value={formData.department || 'Operations Management'}
                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme focus:border-[#123B5D] dark:focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Approved Navigation Tabs & Permissions Matrix */}
                  <div className="border border-theme rounded-xl p-4 bg-elevated space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary text-xs flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" /> Approved Tabs & Module Permissions
                      </span>
                      <span className="text-[11px] text-muted">User will only see checked tabs</span>
                    </div>

                    <div className="space-y-2">
                      {ALL_SYSTEM_MODULES.map(mod => {
                        const isViewAllowed = !!userPermissions[mod.id]?.view || formData.role === 'Super Admin';
                        const modPerm = userPermissions[mod.id] || { view: false };

                        return (
                          <div key={mod.id} className="p-2.5 rounded-xl bg-surface border border-theme space-y-2 shadow-xs">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isViewAllowed}
                                  onChange={() => togglePermission(mod.id, 'view')}
                                  className="w-4 h-4 rounded text-[#123B5D] dark:text-blue-600 focus:ring-0 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-primary text-xs">{mod.label}</div>
                                  <div className="text-[10px] text-muted">{mod.description}</div>
                                </div>
                              </label>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isViewAllowed ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-elevated text-muted'}`}>
                                {isViewAllowed ? 'Tab Visible' : 'Hidden'}
                              </span>
                            </div>

                            {/* Granular Actions */}
                            {isViewAllowed && (
                              <div className="flex flex-wrap gap-3 pt-1 border-t border-theme text-[11px] text-secondary">
                                {(['create', 'edit', 'delete', 'scan', 'export', 'closeBatch'] as const).map(act => (
                                  <label key={act} className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!modPerm[act] || formData.role === 'Super Admin'}
                                      onChange={() => togglePermission(mod.id, act)}
                                      className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
                                    />
                                    <span className="capitalize">{act.replace(/([A-Z])/g, ' $1')}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* SKU ADD */}
              {activeTab === 'skus' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Brand / Client *</label>
                      <select
                        value={formData.clientId || clients[0]?.id}
                        onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      >
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">SKU Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.skuCode || ''}
                        onChange={e => setFormData({ ...formData, skuCode: e.target.value.toUpperCase() })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono"
                        placeholder="BV-PERF-100ML"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">EAN Barcode *</label>
                      <input
                        type="text"
                        required
                        value={formData.eanBarcode || ''}
                        onChange={e => setFormData({ ...formData, eanBarcode: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono text-emerald-600 dark:text-emerald-400 font-bold"
                        placeholder="8906105610014"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">MRP Price (₹)</label>
                      <input
                        type="number"
                        value={formData.unitPrice || 499}
                        onChange={e => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-secondary font-semibold mb-1">Product Description / Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      placeholder="e.g. Bella Vita Luxury Man Perfume 100ml"
                    />
                  </div>
                </>
              )}

              {/* WAREHOUSE ADD */}
              {activeTab === 'warehouses' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Warehouse Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.code || ''}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono"
                        placeholder="WH-04"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Facility Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="EMIZA Hyderabad Logistics Hub"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">City / Region *</label>
                      <input
                        type="text"
                        required
                        value={formData.city || ''}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="Hyderabad"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Total Dock Doors</label>
                      <input
                        type="number"
                        value={formData.totalDocks || 10}
                        onChange={e => setFormData({ ...formData, totalDocks: Number(e.target.value) })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* RETURN REASONS ADD */}
              {activeTab === 'return_reasons' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Reason Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.code || ''}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Reason Label *</label>
                      <input
                        type="text"
                        required
                        value={formData.label || ''}
                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="Customer Refused Delivery"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* DRIVER ADD */}
              {activeTab === 'drivers' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Driver Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Mobile Contact *</label>
                      <input
                        type="text"
                        required
                        value={formData.mobile || ''}
                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* VEHICLE TYPE ADD */}
              {activeTab === 'vehicle_types' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Vehicle Type Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.typeName || ''}
                        onChange={e => setFormData({ ...formData, typeName: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                        placeholder="Tata Ace / 14 Ft Truck"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Capacity (Tons)</label>
                      <input
                        type="number"
                        value={formData.capacityTons || 5}
                        onChange={e => setFormData({ ...formData, capacityTons: Number(e.target.value) })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-theme">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-elevated text-secondary font-bold hover:bg-elevated/80 border border-theme cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold shadow-sm cursor-pointer transition-all"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RECORD MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-theme rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <h3 className="text-base font-extrabold text-primary">
                Edit {editingRecord.category.toUpperCase()} Record
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-muted hover:text-primary font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* EDIT USER */}
              {editingRecord.category === 'users' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Employee ID</label>
                      <input
                        type="text"
                        disabled
                        value={formData.empId || ''}
                        className="w-full bg-elevated/50 text-muted p-2.5 rounded-xl border border-theme font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-secondary font-semibold mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email || ''}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      />
                    </div>
                    <div>
                      <label className="block text-secondary font-semibold mb-1">System Role *</label>
                      <select
                        value={formData.role || 'Supervisor'}
                        onChange={e => {
                          const newRole = e.target.value as UserRole;
                          setFormData({ ...formData, role: newRole });
                          applyRolePreset(newRole);
                        }}
                        className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                      >
                        <option value="Super Admin">Super Admin (All Facilities & Settings)</option>
                        <option value="Admin">Admin</option>
                        <option value="Warehouse Manager">Warehouse Manager</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Security Officer">Security Officer (Gate Inward)</option>
                        <option value="RTO Operator">RTO Operator (Returns Scanning)</option>
                        <option value="GRN Operator">GRN Operator</option>
                        <option value="Auditor">Auditor (Cycle Count / Scanner)</option>
                        <option value="Operator">Operator</option>
                        <option value="Read Only">Read Only (Viewer)</option>
                      </select>
                    </div>
                  </div>

                  {/* Permissions Checklist in Edit */}
                  <div className="border border-theme rounded-xl p-4 bg-elevated space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary text-xs flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-[#123B5D] dark:text-indigo-400" /> Module Access Rights & Granular Permissions
                      </span>
                      <span className="text-[11px] text-muted">Manage user view & action capabilities</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {ALL_SYSTEM_MODULES.map(mod => {
                        const isViewAllowed = !!userPermissions[mod.id]?.view || formData.role === 'Super Admin';
                        const modPerm = userPermissions[mod.id] || { view: false };

                        return (
                          <div key={mod.id} className="p-2.5 rounded-xl bg-surface border border-theme space-y-2 shadow-xs">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isViewAllowed}
                                  onChange={() => togglePermission(mod.id, 'view')}
                                  className="w-4 h-4 rounded text-[#123B5D] dark:text-blue-600 focus:ring-0 cursor-pointer"
                                />
                                <div>
                                  <div className="font-bold text-primary text-xs">{mod.label}</div>
                                  <div className="text-[10px] text-muted">{mod.description}</div>
                                </div>
                              </label>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isViewAllowed ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-elevated text-muted'}`}>
                                {isViewAllowed ? 'Tab Visible' : 'Hidden'}
                              </span>
                            </div>

                            {/* Granular Actions */}
                            {isViewAllowed && (
                              <div className="flex flex-wrap gap-3 pt-1 border-t border-theme text-[11px] text-secondary">
                                {(['create', 'edit', 'delete', 'scan', 'export', 'closeBatch'] as const).map(act => (
                                  <label key={act} className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!modPerm[act] || formData.role === 'Super Admin'}
                                      onChange={() => togglePermission(mod.id, act)}
                                      className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer"
                                    />
                                    <span className="capitalize">{act.replace(/([A-Z])/g, ' $1')}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* EDIT OTHER MASTER RECORD (GENERIC FIELDS) */}
              {editingRecord.category !== 'users' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-secondary font-semibold mb-1">Name / Label *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || formData.label || formData.typeName || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (formData.name !== undefined) setFormData({ ...formData, name: val });
                        else if (formData.label !== undefined) setFormData({ ...formData, label: val });
                        else setFormData({ ...formData, typeName: val });
                      }}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                    />
                  </div>

                  <div>
                    <label className="block text-secondary font-semibold mb-1">Status</label>
                    <select
                      value={formData.status || 'Active'}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-elevated text-primary p-2.5 rounded-xl border border-theme"
                    >
                      <option value="Active">Active</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-theme">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl bg-elevated text-secondary font-bold hover:bg-elevated/80 border border-theme cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#123B5D] hover:bg-[#184C77] dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold shadow-sm cursor-pointer transition-all"
                >
                  Update Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
