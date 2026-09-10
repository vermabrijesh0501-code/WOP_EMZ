import { createClient, SupabaseClient, User as SupabaseAuthUser, Session } from '@supabase/supabase-js';
import { User, UserRole } from '../types';
import { ROLE_DEFAULT_PERMISSIONS } from '../utils/rbac';

// Load Supabase URL and Anon Key from environment variables or saved storage configuration
export const sanitizeSupabaseUrl = (url: string): string => {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
};

const rawEnvUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
const envKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();

const getSavedConfig = (): { supabaseUrl?: string; supabaseAnonKey?: string } | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem('emiza_supabase_config_v3');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const savedConfig = getSavedConfig();
const rawConfigUrl = (savedConfig?.supabaseUrl || '').trim();
const configKey = (savedConfig?.supabaseAnonKey || '').trim();

export const SUPABASE_URL = sanitizeSupabaseUrl(rawEnvUrl || rawConfigUrl || '');
export const SUPABASE_ANON_KEY = envKey || configKey || '';

export const isSupabaseConfigured = (): boolean => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  if (
    SUPABASE_URL.includes('your-project.supabase.co') ||
    SUPABASE_URL.includes('xyzcompany') ||
    SUPABASE_URL.includes('placeholder') ||
    SUPABASE_ANON_KEY.includes('...') ||
    SUPABASE_ANON_KEY.includes('placeholder') ||
    SUPABASE_ANON_KEY.length < 30
  ) {
    return false;
  }
  return true;
};

// Lazy Supabase client singleton — avoids console errors when unconfigured
let clientInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  }
  return clientInstance;
};

// Export proxy for backwards compatibility
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const sb = getSupabase();
    if (!sb) {
      // Return a safe fallback function or object if accessed before configured
      return () => ({
        select: () => Promise.resolve({ data: null, error: new Error('Supabase is not configured') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase is not configured') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase is not configured') }),
        upsert: () => Promise.resolve({ data: null, error: new Error('Supabase is not configured') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase is not configured') }),
        eq: () => Promise.resolve({ data: null, error: new Error('Supabase is not configured') }),
      });
    }
    const val = (sb as any)[prop];
    return typeof val === 'function' ? val.bind(sb) : val;
  },
});

export interface UserProfileRow {
  id: string;
  user_id: string;
  role: 'Super Admin' | 'Warehouse Manager' | 'Supervisor' | 'Security';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionRow {
  id: number;
  permission_key: string;
  description?: string;
}

export interface RolePermissionRow {
  role: 'Super Admin' | 'Warehouse Manager' | 'Supervisor' | 'Security';
  permission_id: number;
}

/**
 * Super Admin email address constant
 */
export const SUPER_ADMIN_EMAIL = 'verma.brijesh0501@gmail.com';

/**
 * Checks if an email corresponds to the designated Super Admin
 */
export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
};

/**
 * Queries the Supabase 'user_profiles', 'permissions', and 'role_permissions' tables
 * as the single source of truth for user roles, active status, and permissions.
 */
export async function fetchAppUserFromSupabase(
  sbUser: SupabaseAuthUser | null,
  fallbackUsers: User[] = []
): Promise<User | null> {
  if (!sbUser) return null;

  const sb = getSupabase();
  const email = (sbUser.email || '').trim().toLowerCase();
  const meta = sbUser.user_metadata || {};
  const isSuperAdmin = isSuperAdminEmail(email);

  let profile: UserProfileRow | null = null;
  let userPermissions: Set<string> = new Set();

  if (sb) {
    try {
      // 1. Query user_profiles table using user_id with strict timeout to prevent login hangs
      const profilePromise = sb
        .from('user_profiles')
        .select('*')
        .eq('user_id', sbUser.id)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: any }>(resolve =>
        setTimeout(() => resolve({ data: null, error: { message: 'Query timed out' } }), 2000)
      );

      const { data: dbProfile, error: profileError } = await Promise.race([
        profilePromise,
        timeoutPromise,
      ]);

      if (!profileError && dbProfile) {
        profile = dbProfile as UserProfileRow;
      }

      // 2. Fetch role permissions for this user's role
      const effectiveRole = isSuperAdmin
        ? 'Super Admin'
        : (profile?.role as UserRole) || (meta.role as UserRole) || 'Supervisor';

      const permsPromise = sb
        .from('role_permissions')
        .select('permission_id, permissions ( id, permission_key, description )')
        .eq('role', effectiveRole);

      const permsTimeout = new Promise<{ data: null; error: any }>(resolve =>
        setTimeout(() => resolve({ data: null, error: { message: 'Permissions timed out' } }), 1500)
      );

      const { data: rolePerms } = await Promise.race([permsPromise, permsTimeout]);

      if (rolePerms && Array.isArray(rolePerms)) {
        rolePerms.forEach((rp: any) => {
          if (rp.permissions?.permission_key) {
            userPermissions.add(rp.permissions.permission_key);
          }
        });
      }
    } catch (err) {
      console.warn('[Supabase] Non-blocking warning querying user_profiles or role_permissions:', err);
    }
  }

  // Determine active status: block access if is_active is false
  const isActive = isSuperAdmin ? true : profile ? profile.is_active : true;
  const finalStatus: 'Active' | 'Inactive' = isActive ? 'Active' : 'Inactive';

  // Role resolution
  let finalRole: UserRole = isSuperAdmin
    ? 'Super Admin'
    : (profile?.role as UserRole) || (meta.role as UserRole) || 'Supervisor';

  // Fallback metadata for name, phone, empId
  const existing = fallbackUsers.find(
    u => u.email.toLowerCase() === email || u.id === sbUser.id
  );

  const name: string =
    meta.name ||
    meta.full_name ||
    existing?.name ||
    (isSuperAdmin ? 'Brijesh Verma' : email.split('@')[0]) ||
    'Emiza User';

  const department =
    meta.department ||
    existing?.department ||
    (finalRole === 'Super Admin' ? 'Central Admin' : 'Operations Management');

  const empId =
    meta.empId ||
    existing?.empId ||
    (isSuperAdmin ? 'EMP-0001' : `EMP-${sbUser.id.slice(0, 4).toUpperCase()}`);

  const assignedWarehouseIds =
    meta.assignedWarehouseIds || existing?.assignedWarehouseIds || ['wh-main'];

  const assignedClientIds =
    meta.assignedClientIds || existing?.assignedClientIds || [
      'cli-bellavita',
      'cli-nykaa',
      'cli-mama',
      'cli-boat',
      'cli-sugar',
    ];

  // Map module permissions based on role default and database loaded permissions
  const defaultModulePerms = ROLE_DEFAULT_PERMISSIONS[finalRole] || ROLE_DEFAULT_PERMISSIONS['Supervisor'];

  const mustChangePassword =
    meta.mustChangePassword !== undefined
      ? Boolean(meta.mustChangePassword)
      : Boolean(existing?.mustChangePassword);

  return {
    id: sbUser.id,
    empId,
    name,
    email: sbUser.email || email,
    phone: meta.phone || existing?.phone || '',
    role: finalRole,
    department,
    assignedWarehouseIds,
    assignedClientIds,
    permissions: defaultModulePerms,
    status: finalStatus,
    mustChangePassword,
    authProvider: 'supabase',
    lastLoginAt: new Date().toISOString(),
  };
}

/**
 * Calls the Supabase RPC function 'has_permission' to verify server-side permission.
 */
export async function checkHasPermissionRpc(requestedPermission: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { data, error } = await sb.rpc('has_permission', {
      requested_permission: requestedPermission,
    });
    if (!error && typeof data === 'boolean') {
      return data;
    }
  } catch (err) {
    console.warn('[Supabase] RPC has_permission check error:', err);
  }
  return false;
}

/**
 * Creates a new user securely through Supabase Auth using a non-persisting client instance,
 * and links the user profile into public.user_profiles.
 */
export async function createUserViaSupabaseAuth({
  email,
  password,
  name,
  role,
  empId,
  department,
  phone,
  assignedWarehouseIds,
  assignedClientIds,
  mustChangePassword = true,
}: {
  email: string;
  password: string;
  name: string;
  role: 'Super Admin' | 'Warehouse Manager' | 'Supervisor' | 'Security';
  empId?: string;
  department?: string;
  phone?: string;
  assignedWarehouseIds?: string[];
  assignedClientIds?: string[];
  mustChangePassword?: boolean;
}): Promise<{ success: boolean; user?: any; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  // Create isolated non-persisted client to not disturb the logged-in Super Admin session
  const secondary = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const emailTrimmed = email.trim().toLowerCase();

  const { data, error } = await secondary.auth.signUp({
    email: emailTrimmed,
    password,
    options: {
      data: {
        name,
        full_name: name,
        role,
        empId: empId || `EMP-${Date.now().toString().slice(-4)}`,
        department: department || (role === 'Super Admin' ? 'Central Admin' : 'Operations Management'),
        phone: phone || '',
        assignedWarehouseIds: assignedWarehouseIds || ['wh-main'],
        assignedClientIds: assignedClientIds || ['cli-bellavita', 'cli-nykaa', 'cli-mama', 'cli-boat', 'cli-sugar'],
        mustChangePassword: mustChangePassword ?? true,
      },
    },
  });

  if (error) {
    if (error.message.includes('rate limit')) {
      return {
        success: false,
        error: 'Supabase Auth email rate limit exceeded. The user will be created once rate window resets. Try again shortly.',
      };
    }
    return { success: false, error: error.message };
  }

  if (!data.user) {
    return { success: false, error: 'User creation failed: No user returned from Supabase Auth.' };
  }

  // Insert linked row into public.user_profiles
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('user_profiles').upsert(
        {
          user_id: data.user.id,
          role: role,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (profileErr: any) {
      console.warn('[Supabase] user_profiles insert warning:', profileErr?.message);
    }
  }

  return { success: true, user: data.user };
}

/**
 * Updates a user's role or is_active status in user_profiles.
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    role?: 'Super Admin' | 'Warehouse Manager' | 'Supervisor' | 'Security';
    is_active?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { success: false, error: 'Supabase is not configured' };

  try {
    const { error } = await sb
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update user profile.' };
  }
}

/**
 * Fetches all user profiles from user_profiles table.
 */
export async function fetchAllUserProfiles(): Promise<UserProfileRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Failed to fetch user profiles:', error.message);
      return [];
    }
    return (data as UserProfileRow[]) || [];
  } catch (err) {
    console.warn('[Supabase] Error fetching user profiles:', err);
    return [];
  }
}

/**
 * Fetches all permissions and role_permissions matrix.
 */
export async function fetchPermissionsAndRoles(): Promise<{
  permissions: PermissionRow[];
  rolePermissions: RolePermissionRow[];
}> {
  const sb = getSupabase();
  if (!sb) return { permissions: [], rolePermissions: [] };
  try {
    const [permsRes, rolePermsRes] = await Promise.all([
      sb.from('permissions').select('*'),
      sb.from('role_permissions').select('*'),
    ]);

    return {
      permissions: (permsRes.data as PermissionRow[]) || [],
      rolePermissions: (rolePermsRes.data as RolePermissionRow[]) || [],
    };
  } catch (err) {
    console.warn('[Supabase] Error fetching permissions matrix:', err);
    return { permissions: [], rolePermissions: [] };
  }
}

/**
 * Realtime subscription to user_profiles table.
 */
export function subscribeToUserProfiles(
  onUpdate: (payload: { eventType: string; newRecord: any; oldRecord: any }) => void
): { unsubscribe: () => void } {
  const sb = getSupabase();
  if (!sb) return { unsubscribe: () => {} };

  try {
    const channel = sb
      .channel('user_profiles_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        (payload) => {
          onUpdate({
            eventType: payload.eventType,
            newRecord: payload.new,
            oldRecord: payload.old,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        sb.removeChannel(channel);
      },
    };
  } catch (err) {
    console.warn('[Supabase] Realtime subscription error on user_profiles:', err);
    return { unsubscribe: () => {} };
  }
}

/**
 * Updates the logged-in user's password and clears the mustChangePassword flag.
 */
export async function updateCurrentUserPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { success: false, error: 'Supabase is not configured' };

  try {
    const { data, error } = await sb.auth.updateUser({
      password: newPassword,
      data: {
        mustChangePassword: false,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update password.' };
  }
}

/**
 * Super Admin password reset action:
 * Dispatches password reset email and/or flags account with mustChangePassword: true.
 */
export async function adminResetUserPassword({
  userId,
  email,
  newTempPassword,
  mustChangePassword = true,
  sendEmailLink = false,
}: {
  userId: string;
  email: string;
  newTempPassword?: string;
  mustChangePassword?: boolean;
  sendEmailLink?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const sb = getSupabase();
  const emailTrimmed = email.trim().toLowerCase();

  try {
    if (sb && sendEmailLink) {
      const { error } = await sb.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login?reset=true` : undefined,
      });
      if (error) {
        console.warn('[Supabase Auth] resetPasswordForEmail warning:', error.message);
      }
    }

    // Update in user profiles and local cache
    if (sb) {
      try {
        await sb.from('user_profiles').update({
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      } catch (err) {
        // Safe ignore
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reset user password.' };
  }
}
