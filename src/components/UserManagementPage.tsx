import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Sparkles,
  Database,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  UserProfileRow,
  PermissionRow,
  RolePermissionRow,
  fetchAllUserProfiles,
  fetchPermissionsAndRoles,
  createUserViaSupabaseAuth,
  adminResetUserPassword,
  updateUserProfile,
  subscribeToUserProfiles,
  SUPER_ADMIN_EMAIL,
} from '../services/supabase';
import { User, UserRole } from '../types';
import { StorageService } from '../services/storage';
import { SyncService } from '../services/syncService';
import { getRoleBadgeConfig } from '../utils/rbac';
import { generateSecureTempPassword } from '../utils/credentialUtils';
import { CredentialIssuedModal } from './auth/CredentialIssuedModal';
import { AdminResetPasswordModal } from './auth/AdminResetPasswordModal';

interface UserManagementPageProps {
  onNavigateTab?: (tab: any) => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ onNavigateTab }) => {
  const { appUser, isSuperAdminUser } = useAuth();

  // Directory state
  const [userProfiles, setUserProfiles] = useState<UserProfileRow[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'permissions'>('users');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [addRole, setAddRole] = useState<'Super Admin' | 'Warehouse Manager' | 'Supervisor' | 'Security'>('Supervisor');
  const [addEmpId, setAddEmpId] = useState('');
  const [addDepartment, setAddDepartment] = useState('Operations Management');
  const [addPhone, setAddPhone] = useState('');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    role: 'Super Admin' | 'Warehouse Manager' | 'Supervisor' | 'Security';
    is_active: boolean;
  } | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Credential Issued Modal State (One-time secure display)
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<{
    userId: string;
    empId?: string;
    name: string;
    email: string;
    role: string;
    department?: string;
    status: string;
    tempPassword?: string;
    actionType?: 'create' | 'reset';
  } | null>(null);

  // Reset Password Modal State for Super Admin
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<{
    id: string;
    empId?: string;
    name: string;
    email: string;
    role: string;
    status: string;
    department?: string;
  } | null>(null);

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load data from Supabase and Local Storage
  const loadDirectoryData = useCallback(async () => {
    try {
      const [profiles, permsData] = await Promise.all([
        fetchAllUserProfiles(),
        fetchPermissionsAndRoles(),
      ]);

      setUserProfiles(profiles);
      setPermissions(permsData.permissions);
      setRolePermissions(permsData.rolePermissions);

      // Also get any cached user metadata from storage
      const localUsers = StorageService.getUsers();
      setUsersList(localUsers);
    } catch (err) {
      console.warn('[UserManagement] Error loading directory data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDirectoryData();

    // Subscribe to realtime updates from Supabase user_profiles table
    const sub = subscribeToUserProfiles(async (payload) => {
      console.info('[UserManagement Realtime] user_profiles update received:', payload);
      // Reload on update to ensure latest single source of truth
      loadDirectoryData();
    });

    return () => {
      sub.unsubscribe();
    };
  }, [loadDirectoryData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDirectoryData();
  };

  // Toggle user active/inactive status in Supabase
  const handleToggleActiveStatus = async (userId: string, currentStatus: boolean, userEmail?: string) => {
    if (userEmail && userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      alert('The primary Super Administrator account cannot be deactivated.');
      return;
    }

    const nextStatus = !currentStatus;
    const res = await updateUserProfile(userId, { is_active: nextStatus });

    if (res.success) {
      // Optimistically update local state
      setUserProfiles((prev) =>
        prev.map((p) => (p.user_id === userId ? { ...p, is_active: nextStatus } : p))
      );

      // Also update local storage cache if user exists
      StorageService.updateUser(userId, { status: nextStatus ? 'Active' : 'Inactive' });

      // Broadcast sync mutation to all other connected terminals
      SyncService.broadcast('USER_UPDATED', {
        id: userId,
        status: nextStatus ? 'Active' : 'Inactive',
        is_active: nextStatus,
      });

      StorageService.addActivityLog({
        userId: appUser?.id || 'admin',
        userName: appUser?.name || 'Super Admin',
        userRole: 'Super Admin',
        action: nextStatus ? 'Activated User' : 'Deactivated User',
        module: 'Auth',
        details: `Updated user profile status for ${userEmail || userId} to ${nextStatus ? 'Active' : 'Deactivated'}`,
      });
    } else {
      alert(`Failed to update status: ${res.error}`);
    }
  };

  const handleOpenAddUserModal = () => {
    const generatedId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const generatedPwd = generateSecureTempPassword();
    setAddEmpId(generatedId);
    setAddPassword(generatedPwd);
    setShowPassword(true);
    setAddError(null);
    setAddSuccess(null);
    setIsAddModalOpen(true);
  };

  // Submit Add New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    if (!addEmail.trim() || !addEmail.includes('@')) {
      setAddError('Please enter a valid email address.');
      return;
    }
    if (!addPassword || addPassword.length < 6) {
      setAddError('Password must be at least 6 characters long.');
      return;
    }
    if (!addName.trim()) {
      setAddError('Please provide the full name of the user.');
      return;
    }

    const assignedEmpId = addEmpId.trim() || `EMP-${Date.now().toString().slice(-4)}`;
    const tempPasswordSaved = addPassword.trim();

    setIsSubmittingNewUser(true);
    try {
      const res = await createUserViaSupabaseAuth({
        email: addEmail.trim(),
        password: tempPasswordSaved,
        name: addName.trim(),
        role: addRole,
        empId: assignedEmpId,
        department: addDepartment,
        phone: addPhone.trim(),
        mustChangePassword: true,
      });

      if (res.success) {
        // Register in local users cache (never storing password in plain text!)
        const newUserObj: User = {
          id: res.user?.id || `usr-${Date.now()}`,
          empId: assignedEmpId,
          name: addName.trim(),
          email: addEmail.trim().toLowerCase(),
          role: addRole as UserRole,
          department: addDepartment,
          phone: addPhone.trim(),
          status: 'Active',
          mustChangePassword: true,
          assignedWarehouseIds: ['wh-main'],
          assignedClientIds: ['cli-bellavita', 'cli-nykaa', 'cli-mama', 'cli-boat', 'cli-sugar'],
          createdAt: new Date().toISOString(),
          authProvider: 'supabase',
        };
        StorageService.saveUsers([newUserObj, ...StorageService.getUsers()]);

        // Broadcast to WebSocket sync server so phone and desktop sync in real time
        SyncService.broadcast('MASTERS_UPDATED', { category: 'users', user: newUserObj });

        StorageService.addActivityLog({
          userId: appUser?.id || 'admin',
          userName: appUser?.name || 'Super Admin',
          userRole: appUser?.role || 'Super Admin',
          action: 'User Created',
          module: 'Auth',
          details: `Created user ${newUserObj.email} (ID: ${assignedEmpId}) with mandatory first-login password change`,
        });

        // Reset inputs and close creation form
        setAddName('');
        setAddEmail('');
        setAddPassword('');
        setAddEmpId('');
        setAddPhone('');
        setIsAddModalOpen(false);

        // Open one-time Credential Issued Modal
        setIssuedCredentials({
          userId: res.user?.id || newUserObj.id,
          empId: assignedEmpId,
          name: newUserObj.name,
          email: newUserObj.email,
          role: newUserObj.role,
          department: newUserObj.department,
          status: 'Active',
          tempPassword: tempPasswordSaved,
          actionType: 'create',
        });
        setIsCredentialModalOpen(true);

        // Reload data
        await loadDirectoryData();
      } else {
        setAddError(res.error || 'Failed to create user.');
      }
    } catch (err: any) {
      setAddError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  // Super Admin Password Reset Handler
  const handleConfirmResetPassword = async (params: {
    userId: string;
    email: string;
    tempPassword: string;
    mustChangePassword: boolean;
    sendEmailLink?: boolean;
  }) => {
    const res = await adminResetUserPassword({
      userId: params.userId,
      email: params.email,
      newTempPassword: params.tempPassword,
      mustChangePassword: params.mustChangePassword,
      sendEmailLink: params.sendEmailLink,
    });

    if (res.success) {
      // Update local cache
      StorageService.updateUser(params.userId, {
        mustChangePassword: true,
        tempPasswordSetAt: new Date().toISOString(),
      });

      SyncService.broadcast('USER_UPDATED', {
        id: params.userId,
        mustChangePassword: true,
      });

      StorageService.addActivityLog({
        userId: appUser?.id || 'admin',
        userName: appUser?.name || 'Super Admin',
        userRole: appUser?.role || 'Super Admin',
        action: 'Password Reset Issued',
        module: 'Auth',
        details: `Issued temporary credentials for ${params.email} with mandatory first-login password change`,
      });

      // Close reset modal and open credential modal
      setIsResetModalOpen(false);
      if (resettingUser) {
        setIssuedCredentials({
          userId: resettingUser.id,
          empId: resettingUser.empId,
          name: resettingUser.name,
          email: resettingUser.email,
          role: resettingUser.role,
          department: resettingUser.department,
          status: resettingUser.status,
          tempPassword: params.tempPassword,
          actionType: 'reset',
        });
        setIsCredentialModalOpen(true);
      }
      setResettingUser(null);
      await loadDirectoryData();
    }

    return res;
  };

  // Submit Edit User (Role & Active status)
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setIsUpdatingUser(true);

    try {
      const res = await updateUserProfile(editingUser.user_id, {
        role: editingUser.role,
        is_active: editingUser.is_active,
      });

      if (res.success) {
        setUserProfiles((prev) =>
          prev.map((p) =>
            p.user_id === editingUser.user_id
              ? { ...p, role: editingUser.role, is_active: editingUser.is_active }
              : p
          )
        );

        // Update local storage cache
        StorageService.updateUser(editingUser.user_id, {
          role: editingUser.role as UserRole,
          status: editingUser.is_active ? 'Active' : 'Inactive',
        });

        // Broadcast sync mutation
        SyncService.broadcast('USER_UPDATED', {
          id: editingUser.user_id,
          role: editingUser.role,
          status: editingUser.is_active ? 'Active' : 'Inactive',
        });

        setEditingUser(null);
      } else {
        setEditError(res.error || 'Failed to update user profile.');
      }
    } catch (err: any) {
      setEditError(err?.message || 'Unexpected update failure.');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Merge Supabase user_profiles with known metadata for display
  const combinedUserRows = useMemo(() => {
    const mapByUserId = new Map<string, any>();

    // 1. Seed from user_profiles table (the database single source of truth)
    userProfiles.forEach((p) => {
      mapByUserId.set(p.user_id, {
        userId: p.user_id,
        profileId: p.id,
        role: p.role,
        isActive: p.is_active,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        name: '',
        email: '',
        empId: '',
        department: '',
        phone: '',
      });
    });

    // 2. Enrich with local user cache (name, email, empId, phone)
    usersList.forEach((u) => {
      const existing = mapByUserId.get(u.id);
      if (existing) {
        existing.name = u.name;
        existing.email = u.email;
        existing.empId = u.empId;
        existing.department = u.department;
        existing.phone = u.phone;
        existing.mustChangePassword = Boolean(u.mustChangePassword);
      } else {
        // If row not yet in user_profiles, add as placeholder
        mapByUserId.set(u.id, {
          userId: u.id,
          profileId: `prof-${u.id}`,
          role: u.role,
          isActive: u.status !== 'Inactive',
          mustChangePassword: Boolean(u.mustChangePassword),
          createdAt: u.createdAt,
          name: u.name,
          email: u.email,
          empId: u.empId,
          department: u.department,
          phone: u.phone,
        });
      }
    });

    // 3. Ensure Super Admin record is always prominent
    let hasSuperAdmin = false;
    mapByUserId.forEach((val) => {
      if (val.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        hasSuperAdmin = true;
        val.role = 'Super Admin';
        val.isActive = true;
      }
    });

    if (!hasSuperAdmin) {
      mapByUserId.set('super-admin-root', {
        userId: appUser?.id || 'super-admin-root',
        profileId: 'prof-root-superadmin',
        role: 'Super Admin',
        isActive: true,
        name: 'Brijesh Verma',
        email: SUPER_ADMIN_EMAIL,
        empId: 'EMP-0001',
        department: 'Central Admin',
        phone: '+91 98765 43210',
      });
    }

    const rows = Array.from(mapByUserId.values());

    // Filter by search
    return rows.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.empId?.toLowerCase().includes(q) ||
        r.userId?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q);

      const matchRole = roleFilter === 'all' || r.role === roleFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && r.isActive) ||
        (statusFilter === 'inactive' && !r.isActive);

      return matchSearch && matchRole && matchStatus;
    });
  }, [userProfiles, usersList, searchQuery, roleFilter, statusFilter, appUser]);

  // If user is not Super Admin, show restricted screen
  if (!isSuperAdminUser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 text-slate-100 select-none">
        <div className="max-w-md w-full bg-[#131E32] rounded-3xl p-8 border border-rose-500/30 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Restricted Access</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            The User & Role Management module is strictly reserved for the designated Super Administrator (
            <span className="text-purple-400 font-mono">{SUPER_ADMIN_EMAIL}</span>).
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab ? onNavigateTab('dashboard') : window.history.back()}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Return to Operations Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#131E32] rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              User & Role Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[11px] font-mono font-bold text-purple-300">
              Super Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span>Single Source of Truth:</span>
            <span className="font-mono text-cyan-400">public.user_profiles</span>
            <span>&bull;</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" /> Real-time Device Sync Active
            </span>
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="py-2 px-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh from Supabase database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Database'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddUserModal}
            className="py-2.5 px-4 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] active:bg-[#6D28D9] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'users'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Profiles & Access</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px]">
            {combinedUserRows.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('permissions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'permissions'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Role Permissions Matrix</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px]">
            {permissions.length}
          </span>
        </button>
      </div>

      {activeSubTab === 'users' ? (
        <>
          {/* Filter and Search Bar */}
          <div className="bg-[#131E32] rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, email, role, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0F172A] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-[#0F172A] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 text-[11px]">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#131E32]">All Roles</option>
                  <option value="Super Admin" className="bg-[#131E32]">Super Admin</option>
                  <option value="Warehouse Manager" className="bg-[#131E32]">Warehouse Manager</option>
                  <option value="Supervisor" className="bg-[#131E32]">Supervisor</option>
                  <option value="Security" className="bg-[#131E32]">Security</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-[#0F172A] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
                <span className="text-slate-500 text-[11px]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#131E32]">All Status</option>
                  <option value="active" className="bg-[#131E32]">Active</option>
                  <option value="inactive" className="bg-[#131E32]">Deactivated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[#131E32] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0B1120] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">User Details</th>
                    <th className="py-3.5 px-4">Database Role (app_role)</th>
                    <th className="py-3.5 px-4">Linked Supabase Auth ID</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4 text-center">Status (is_active)</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-400 mb-2" />
                        <span>Querying Supabase user_profiles & permissions...</span>
                      </td>
                    </tr>
                  ) : combinedUserRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                        <p className="text-sm font-semibold text-slate-300">No matching user records found</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or create a new user.</p>
                      </td>
                    </tr>
                  ) : (
                    combinedUserRows.map((user) => {
                      const isSuper = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || user.role === 'Super Admin';
                      const badgeCfg = getRoleBadgeConfig(user.role as UserRole);

                      return (
                        <tr
                          key={user.userId || user.profileId}
                          className="hover:bg-slate-800/30 transition-colors"
                        >
                          {/* User Details */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                isSuper
                                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                                  : 'bg-slate-700/60 text-slate-300'
                              }`}>
                                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="font-semibold text-white flex items-center gap-1.5">
                                  <span>{user.name || 'Emiza User'}</span>
                                  {isSuper && (
                                    <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                                      Root Admin
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span className="font-mono">{user.email || 'No email'}</span>
                                  {user.empId && (
                                    <span className="text-slate-500 font-mono">({user.empId})</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeCfg.bg} ${badgeCfg.text} ${badgeCfg.border}`}>
                              <Shield className="w-3 h-3" />
                              <span>{user.role}</span>
                            </span>
                          </td>

                          {/* Supabase User ID */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                              <span>{user.userId ? `${user.userId.slice(0, 8)}...${user.userId.slice(-4)}` : 'N/A'}</span>
                              {user.userId && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(user.userId)}
                                  className="p-1 hover:text-white transition-colors cursor-pointer"
                                  title="Copy full Supabase user ID"
                                >
                                  {copiedId === user.userId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-4 text-slate-300">
                            <span>{user.department || 'Operations Management'}</span>
                          </td>

                          {/* Active / Inactive Status with 1-click Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleToggleActiveStatus(user.userId, user.isActive, user.email)}
                                disabled={isSuper}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                                  user.isActive
                                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-400'
                                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-400'
                                } ${isSuper ? 'opacity-80 cursor-not-allowed' : ''}`}
                                title={isSuper ? 'Super Admin cannot be deactivated' : 'Click to toggle Active / Deactivated status in database'}
                              >
                                {user.isActive ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Active</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3" />
                                    <span>Deactivated</span>
                                  </>
                                )}
                              </button>
                              {user.mustChangePassword && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[9px] font-bold tracking-tight">
                                  Temp Pwd Pending
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setResettingUser({
                                    id: user.userId,
                                    empId: user.empId,
                                    name: user.name,
                                    email: user.email,
                                    role: user.role,
                                    status: user.isActive ? 'Active' : 'Inactive',
                                    department: user.department,
                                  });
                                  setIsResetModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 transition-colors cursor-pointer"
                                title="Reset user password & issue temporary credentials"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditingUser({
                                    id: user.profileId,
                                    user_id: user.userId,
                                    name: user.name,
                                    email: user.email,
                                    role: user.role,
                                    is_active: user.isActive,
                                  })
                                }
                                disabled={isSuper}
                                className={`p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer ${
                                  isSuper ? 'opacity-30 cursor-not-allowed' : ''
                                }`}
                                title={isSuper ? 'Root Super Admin cannot be edited' : 'Edit role and settings'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
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
        </>
      ) : (
        /* Role Permissions Matrix View */
        <div className="bg-[#131E32] rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Database Permissions Matrix</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live records from <span className="font-mono text-cyan-400">permissions</span> and{' '}
              <span className="font-mono text-cyan-400">role_permissions</span> in Supabase PostgreSQL.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['Super Admin', 'Warehouse Manager', 'Supervisor', 'Security'] as const).map((role) => {
              const badgeCfg = getRoleBadgeConfig(role);
              const count = rolePermissions.filter((rp) => rp.role === role).length;

              return (
                <div
                  key={role}
                  className="bg-[#0F172A] rounded-xl p-4 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${badgeCfg.bg} ${badgeCfg.text} ${badgeCfg.border}`}>
                      {role}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {role === 'Super Admin' ? 'All (Full Access)' : `${count} permissions`}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 leading-relaxed">
                    {role === 'Super Admin' && (
                      <p className="text-purple-300/90">
                        Unrestricted system-wide permission across all operational modules, user administration, gate entries, cycle counts, and audit logs.
                      </p>
                    )}
                    {role === 'Warehouse Manager' && (
                      <p>
                        Authorized for full gate entry verification, batch dispatch, cycle counts, discrepancy reconciliation, and operations reports.
                      </p>
                    )}
                    {role === 'Supervisor' && (
                      <p>
                        Authorized for live scanning, returns sorting, staging location assignment, barcode verification, and exception logging.
                      </p>
                    )}
                    {role === 'Security' && (
                      <p>
                        Authorized for vehicle gate entry registration, driver verification, seal inspection, dock staging, and vehicle exit logging.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Permissions List */}
          <div className="border-t border-slate-800 pt-5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Configured System Permission Keys
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {permissions.length > 0 ? (
                permissions.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-mono text-xs font-semibold text-white">{p.permission_key}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{p.description || 'System permission'}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-6 text-slate-500 text-xs">
                  No custom permission rows returned from table. Utilizing default role permission schema.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW USER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#131E32] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create New User</h3>
                  <p className="text-xs text-slate-400">Registers user in Supabase Auth & links to user_profiles</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            {addSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{addSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Malhotra"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@emizawop.in"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                    <span>Temporary Password (min 6 chars) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generateSecureTempPassword();
                      setAddPassword(pwd);
                      setShowPassword(true);
                    }}
                    className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Generate Strong Password</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter or generate temporary password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 pr-10 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-purple-300/80 mt-1 flex items-center gap-1">
                  <span>🔒 Shown once upon creation with 1-click Copy. User is forced to set permanent password on first login.</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">System Role (app_role) *</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as any)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Warehouse Manager">Warehouse Manager</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Security">Security</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-1045"
                    value={addEmpId}
                    onChange={(e) => setAddEmpId(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Department</label>
                  <input
                    type="text"
                    value={addDepartment}
                    onChange={(e) => setAddDepartment(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="px-5 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingNewUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating in Supabase Auth...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#131E32] border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit User Profile</h3>
                  <p className="text-xs text-slate-400">{editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role (app_role)</label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as any })
                  }
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="Warehouse Manager">Warehouse Manager</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Security">Security</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status (is_active)</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={editingUser.is_active}
                      onChange={() => setEditingUser({ ...editingUser, is_active: true })}
                      className="text-purple-600"
                    />
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      checked={!editingUser.is_active}
                      onChange={() => setEditingUser({ ...editingUser, is_active: false })}
                      className="text-purple-600"
                    />
                    <span className="text-rose-400 font-semibold">Deactivated (Block Access)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="px-5 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Database...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      <AdminResetPasswordModal
        isOpen={isResetModalOpen}
        onClose={() => {
          setIsResetModalOpen(false);
          setResettingUser(null);
        }}
        targetUser={resettingUser}
        onConfirmReset={handleConfirmResetPassword}
      />

      {/* Credential Issued Modal (Secure One-Time Display) */}
      <CredentialIssuedModal
        isOpen={isCredentialModalOpen}
        onClose={() => {
          setIsCredentialModalOpen(false);
          setIssuedCredentials(null);
        }}
        credentials={issuedCredentials}
      />
    </div>
  );
};
