import { User, UserRole, ModuleId, ModulePermission } from '../types';

// Default permissions for every system role
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, Partial<Record<ModuleId, ModulePermission>>> = {
  'Super Admin': {
    dashboard: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
    inward: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
    returns_rto: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
    returns_b2b: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
    masters: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
    reports: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
    supabase_hub: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
  },
  'Admin': {
    dashboard: { view: true, create: true, edit: true, delete: true, scan: true, export: true, approve: true, closeBatch: true },
    inward: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    returns_rto: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    returns_b2b: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    masters: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    reports: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    supabase_hub: { view: true, create: false, edit: false, delete: false, scan: false, export: true, approve: false, closeBatch: false },
  },
  'Warehouse Manager': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: true, approve: true, closeBatch: false },
    inward: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    returns_rto: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    returns_b2b: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    masters: { view: true, create: false, edit: true, delete: false, scan: false, export: true, approve: true, closeBatch: false },
    reports: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'Supervisor': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: false },
    returns_rto: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    returns_b2b: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: true, closeBatch: true },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: true, create: false, edit: false, delete: false, scan: false, export: true, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'Security': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: false, closeBatch: false },
    returns_rto: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_b2b: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'Security Officer': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: false, closeBatch: false },
    returns_rto: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_b2b: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'RTO Operator': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_rto: { view: true, create: true, edit: false, delete: false, scan: true, export: true, approve: false, closeBatch: true },
    returns_b2b: { view: true, create: true, edit: false, delete: false, scan: true, export: true, approve: false, closeBatch: true },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'GRN Operator': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: true, create: true, edit: true, delete: false, scan: true, export: true, approve: false, closeBatch: false },
    returns_rto: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_b2b: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'Auditor': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_rto: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_b2b: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: true, create: false, edit: false, delete: false, scan: false, export: true, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'Operator': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_rto: { view: true, create: true, edit: false, delete: false, scan: true, export: false, approve: false, closeBatch: true },
    returns_b2b: { view: true, create: true, edit: false, delete: false, scan: true, export: false, approve: false, closeBatch: true },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
  'Read Only': {
    dashboard: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    inward: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_rto: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    returns_b2b: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    masters: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    reports: { view: true, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
    supabase_hub: { view: false, create: false, edit: false, delete: false, scan: false, export: false, approve: false, closeBatch: false },
  },
};

// Check if user is the designated Super Admin
export const isSuperAdmin = (user: User | null | undefined): boolean => {
  if (!user) return false;
  const email = (user.email || '').trim().toLowerCase();
  return email === 'verma.brijesh0501@gmail.com' || user.role === 'Super Admin';
};

/**
 * Checks role-based page/action permission using the canonical PostgreSQL RPC pattern.
 * Requirements:
 * - Super Admin (Verma.brijesh0501@gmail.com) gets full access.
 * - Block login/access when is_active = false.
 */
export const has_permission = (
  user: User | null | undefined,
  requestedPermission: string,
  action: keyof ModulePermission = 'view'
): boolean => {
  if (!user) return false;

  // Block access when is_active = false / status is Inactive
  if (user.status === 'Inactive') return false;

  // Super Admin (Verma.brijesh0501@gmail.com) gets full access to all pages and actions
  if (isSuperAdmin(user)) return true;

  // Map requestedPermission to module id if it's a module permission
  const moduleId = requestedPermission.toLowerCase() as ModuleId;
  return hasModulePermission(user, moduleId, action);
};

// Check if user has permission for a specific module and action
export const hasModulePermission = (
  user: User | null | undefined,
  moduleId: ModuleId,
  action: keyof ModulePermission = 'view'
): boolean => {
  if (!user) return false;

  // Block access if user is inactive
  if (user.status === 'Inactive') return false;

  // Super Admin gets unrestricted access
  if (isSuperAdmin(user)) return true;

  // Map alias module IDs to canonical permission keys
  let canonicalId: ModuleId = moduleId;
  if (moduleId === 'grn') canonicalId = 'inward';
  else if (moduleId === 'clients' || moduleId === 'couriers' || moduleId === 'locations' || moduleId === 'user_management') canonicalId = 'masters';
  else if (moduleId === 'notifications') canonicalId = 'dashboard';
  else if (moduleId === 'settings') canonicalId = 'supabase_hub';

  // Check custom user permissions if configured
  if (user.permissions && user.permissions[canonicalId]) {
    const perm = user.permissions[canonicalId];
    if (perm) {
      if (action === 'view') return !!perm.view;
      return !!perm[action];
    }
  }

  // Fallback to role default permissions
  const roleDefaults = user.role ? ROLE_DEFAULT_PERMISSIONS[user.role] : undefined;
  if (roleDefaults && roleDefaults[canonicalId]) {
    const rolePerm = roleDefaults[canonicalId];
    if (action === 'view') return !!rolePerm.view;
    return !!rolePerm[action];
  }

  return false;
};

// Get all accessible module IDs for a user
export const getAccessibleModules = (user: User | null | undefined): ModuleId[] => {
  const allModules: ModuleId[] = [
    'dashboard',
    'inward',
    'grn',
    'returns_rto',
    'returns_b2b',
    'clients',
    'couriers',
    'locations',
    'reports',
    'notifications',
    'masters',
    'user_management',
    'supabase_hub',
    'settings',
  ];

  if (!user) return ['dashboard'];
  if (user.role === 'Super Admin') return allModules;

  return allModules.filter(mod => hasModulePermission(user, mod, 'view'));
};

// Get Role Color Badge classes
export const getRoleBadgeConfig = (role?: UserRole | string): { bg: string; text: string; border: string; label: string } => {
  switch (role) {
    case 'Super Admin':
      return { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', label: 'Super Admin' };
    case 'Admin':
      return { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40', label: 'Admin' };
    case 'Warehouse Manager':
      return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40', label: 'Warehouse Manager' };
    case 'Supervisor':
      return { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40', label: 'Supervisor' };
    case 'Security Officer':
      return { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40', label: 'Security Officer' };
    case 'RTO Operator':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', label: 'RTO Operator' };
    case 'GRN Operator':
      return { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/40', label: 'GRN Operator' };
    case 'Auditor':
      return { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/40', label: 'Auditor' };
    case 'Operator':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', label: 'Operator' };
    case 'Read Only':
    default:
      return { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/40', label: 'Read Only' };
  }
};
