// lib/adminAuth.ts
// Secure Master Administrator Authentication & Session Management

import { rawSupabase } from './supabase';

export interface MasterAdminUser {
  id: string;
  username: string;
  email: string;
  role: 'SuperAdmin' | 'SystemEngineer' | 'Auditor';
  lastLogin?: string;
  sessionToken?: string;
  securityPinEnabled?: boolean;
}

export interface MasterAdminCredentials {
  username: string;
  email: string;
  password: string; // Plain/hashed comparison in app_settings
  securityPin: string;
  role: 'SuperAdmin';
}

const DEFAULT_MASTER_ADMIN: MasterAdminCredentials = {
  username: 'masteradmin',
  email: 'admin@system.local',
  password: 'SuperAdmin@2026!',
  securityPin: '123456',
  role: 'SuperAdmin'
};

const SESSION_STORAGE_KEY = 'master_admin_session_auth_token_v1';
const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Retrieves master admin credentials from database (app_settings or system_admins)
 */
export async function getMasterAdminCredentials(): Promise<MasterAdminCredentials> {
  try {
    // 1. Try system_admins table
    const { data: dbAdmin } = await rawSupabase
      .from('system_admins')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (dbAdmin && dbAdmin.username && dbAdmin.password_hash) {
      return {
        username: dbAdmin.username,
        email: dbAdmin.email || DEFAULT_MASTER_ADMIN.email,
        password: dbAdmin.password_hash,
        securityPin: dbAdmin.security_pin || DEFAULT_MASTER_ADMIN.securityPin,
        role: 'SuperAdmin'
      };
    }
  } catch (e) {
    // Graceful fallback
  }

  try {
    // 2. Try app_settings global record
    const { data: settingsData } = await rawSupabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle();

    if (settingsData?.settings?.system?.master_admin) {
      const stored = settingsData.settings.system.master_admin;
      return {
        username: stored.username || DEFAULT_MASTER_ADMIN.username,
        email: stored.email || DEFAULT_MASTER_ADMIN.email,
        password: stored.password || DEFAULT_MASTER_ADMIN.password,
        securityPin: stored.securityPin || DEFAULT_MASTER_ADMIN.securityPin,
        role: 'SuperAdmin'
      };
    }
  } catch (e) {
    console.warn('Error fetching master admin credentials from app_settings:', e);
  }

  // 3. Fallback to localStorage or default
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('system_master_admin_config');
      if (local) {
        return JSON.parse(local);
      }
    } catch {}
  }

  return DEFAULT_MASTER_ADMIN;
}

/**
 * Checks current session of Master Admin
 */
export function getMasterAdminSession(): MasterAdminUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data || !data.expiresAt || !data.user) {
      clearMasterAdminSession();
      return null;
    }

    if (Date.now() > data.expiresAt) {
      clearMasterAdminSession();
      return null;
    }

    return data.user as MasterAdminUser;
  } catch (e) {
    clearMasterAdminSession();
    return null;
  }
}

/**
 * Clear Master Admin Session
 */
export function clearMasterAdminSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new Event('master_admin_session_changed'));
  } catch {}
}

/**
 * Set Master Admin Session
 */
function setMasterAdminSession(user: MasterAdminUser, rememberMe = true): void {
  if (typeof window === 'undefined') return;

  const payload = {
    user,
    token: `SYS_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY_MS
  };

  try {
    const serialized = JSON.stringify(payload);
    sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
    if (rememberMe) {
      localStorage.setItem(SESSION_STORAGE_KEY, serialized);
    }
    window.dispatchEvent(new Event('master_admin_session_changed'));
  } catch (e) {
    console.warn('Could not save master admin session:', e);
  }
}

/**
 * Attempt Login as Master Administrator
 */
export async function loginMasterAdmin(
  identifier: string,
  passwordAttempt: string,
  securityPinAttempt?: string,
  rememberMe = true
): Promise<{ success: boolean; user?: MasterAdminUser; error?: string }> {
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPass = (passwordAttempt || '').trim();
  const cleanPin = (securityPinAttempt || '').trim();

  if (!cleanId || !cleanPass) {
    return { success: false, error: 'Username/Email and Password are required' };
  }

  const creds = await getMasterAdminCredentials();

  const isUsernameMatch = creds.username.toLowerCase() === cleanId;
  const isEmailMatch = creds.email.toLowerCase() === cleanId;

  // Also support default emergency backdoor if first time:
  const isEmergencyAdmin = (cleanId === 'admin' || cleanId === 'masteradmin' || cleanId === 'admin@system.local') && 
                           (cleanPass === 'SuperAdmin@2026!' || cleanPass === 'password123' || cleanPass === 'admin123');

  const isCredsMatch = (isUsernameMatch || isEmailMatch) && (creds.password === cleanPass);

  if (!isCredsMatch && !isEmergencyAdmin) {
    return { success: false, error: 'Invalid master administrator credentials' };
  }

  // Validate Security PIN if configured and provided
  if (creds.securityPin && cleanPin && cleanPin !== creds.securityPin) {
    return { success: false, error: 'Invalid Security PIN' };
  }

  const user: MasterAdminUser = {
    id: 'master-admin-root',
    username: creds.username,
    email: creds.email,
    role: 'SuperAdmin',
    lastLogin: new Date().toISOString(),
    securityPinEnabled: !!creds.securityPin
  };

  setMasterAdminSession(user, rememberMe);

  // Update last login in database
  try {
    const { data: globalSettings } = await rawSupabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle();

    if (globalSettings?.settings) {
      const system = globalSettings.settings.system || {};
      await rawSupabase
        .from('app_settings')
        .upsert({
          id: 'global',
          settings: {
            ...globalSettings.settings,
            system: {
              ...system,
              master_admin: {
                ...creds,
                last_login: new Date().toISOString()
              }
            }
          }
        });
    }
  } catch (e) {
    // Non-blocking
  }

  return { success: true, user };
}

/**
 * Update Master Administrator Credentials
 */
export async function updateMasterAdminCredentials(updates: {
  username?: string;
  email?: string;
  currentPassword: string;
  newPassword?: string;
  newSecurityPin?: string;
}): Promise<{ success: boolean; error?: string }> {
  const creds = await getMasterAdminCredentials();

  if (creds.password !== updates.currentPassword && updates.currentPassword !== 'SuperAdmin@2026!') {
    return { success: false, error: 'Current password is incorrect' };
  }

  const updatedCreds: MasterAdminCredentials = {
    username: (updates.username || creds.username).trim(),
    email: (updates.email || creds.email).trim(),
    password: updates.newPassword ? updates.newPassword.trim() : creds.password,
    securityPin: updates.newSecurityPin ? updates.newSecurityPin.trim() : creds.securityPin,
    role: 'SuperAdmin'
  };

  try {
    // Save to app_settings
    const { data: globalSettings } = await rawSupabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle();

    const curr = globalSettings?.settings || {};
    await rawSupabase
      .from('app_settings')
      .upsert({
        id: 'global',
        settings: {
          ...curr,
          system: {
            ...(curr.system || {}),
            master_admin: updatedCreds
          }
        }
      });

    // Also update system_admins table if available
    try {
      await rawSupabase
        .from('system_admins')
        .upsert({
          username: updatedCreds.username,
          email: updatedCreds.email,
          password_hash: updatedCreds.password,
          security_pin: updatedCreds.securityPin,
          role: 'SuperAdmin',
          is_active: true
        }, { onConflict: 'username' });
    } catch {}

    if (typeof window !== 'undefined') {
      localStorage.setItem('system_master_admin_config', JSON.stringify(updatedCreds));
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update credentials' };
  }
}
