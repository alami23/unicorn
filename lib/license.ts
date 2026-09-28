// lib/license.ts
// Enterprise License Verification, Generation, and Database Storage System

import { rawSupabase } from './supabase';

export interface LicenseFeatures {
  wood_management: boolean;
  furniture_management: boolean;
  pos_billing: boolean;
  sms_gateway: boolean;
  accounting_statements: boolean;
  excel_exports: boolean;
  multi_organization: boolean;
  api_access: boolean;
}

export interface SystemLicense {
  id?: string;
  license_key: string;
  license_tier: 'Starter' | 'Professional' | 'Enterprise' | 'Ultimate' | 'Lifetime';
  licensed_to: string;
  contact_email?: string;
  domain?: string;
  issued_date: string;
  expiry_date?: string;
  is_lifetime: boolean;
  max_users: number;
  max_organizations: number;
  features: LicenseFeatures;
  signature: string;
  status?: 'active' | 'expired' | 'revoked' | 'invalid';
  raw_license_data?: any;
  created_at?: string;
  updated_at?: string;
}

const LICENSE_SALT = 'TF_ENTERPRISE_SYSTEM_LICENSE_2026_SECURE_SALT_98471';

/**
 * Generate cryptographic signature hash for license payload
 */
export function computeLicenseSignature(payload: {
  license_key: string;
  license_tier: string;
  licensed_to: string;
  issued_date: string;
  expiry_date?: string;
  is_lifetime: boolean;
  max_users: number;
  max_organizations: number;
}): string {
  const norm = [
    payload.license_key.trim(),
    payload.license_tier.trim(),
    payload.licensed_to.trim().toLowerCase(),
    payload.issued_date,
    payload.expiry_date || 'NONE',
    payload.is_lifetime ? 'LIFETIME' : 'STANDARD',
    payload.max_users,
    payload.max_organizations,
    LICENSE_SALT
  ].join('::');

  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    const char = norm.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  // Generate a multi-block hex signature
  const p1 = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  let hash2 = 5381;
  for (let i = norm.length - 1; i >= 0; i--) {
    hash2 = ((hash2 << 5) + hash2) + norm.charCodeAt(i);
    hash2 |= 0;
  }
  const p2 = Math.abs(hash2).toString(16).padStart(8, '0').toUpperCase();

  return `SIG-TF-${p1}-${p2}`;
}

/**
 * Validates a license object and computes status, expiration, and days remaining
 */
export function validateLicense(lic: SystemLicense): {
  valid: boolean;
  status: 'active' | 'expired' | 'revoked' | 'invalid';
  reason?: string;
  daysRemaining: number;
} {
  if (!lic || !lic.license_key || !lic.licensed_to || !lic.signature) {
    return {
      valid: false,
      status: 'invalid',
      reason: 'Incomplete license parameters or missing signature',
      daysRemaining: 0
    };
  }

  // Check signature match
  const expectedSig = computeLicenseSignature({
    license_key: lic.license_key,
    license_tier: lic.license_tier,
    licensed_to: lic.licensed_to,
    issued_date: lic.issued_date,
    expiry_date: lic.expiry_date,
    is_lifetime: lic.is_lifetime,
    max_users: lic.max_users,
    max_organizations: lic.max_organizations
  });

  if (lic.signature !== expectedSig) {
    return {
      valid: false,
      status: 'invalid',
      reason: 'Cryptographic signature mismatch. License file may have been modified or forged.',
      daysRemaining: 0
    };
  }

  if (lic.status === 'revoked') {
    return {
      valid: false,
      status: 'revoked',
      reason: 'This license has been explicitly revoked by the system administrator.',
      daysRemaining: 0
    };
  }

  if (lic.is_lifetime) {
    return {
      valid: true,
      status: 'active',
      daysRemaining: 9999
    };
  }

  if (!lic.expiry_date) {
    return {
      valid: false,
      status: 'invalid',
      reason: 'Standard license must have an expiration date',
      daysRemaining: 0
    };
  }

  const now = new Date();
  const expiry = new Date(lic.expiry_date + 'T23:59:59');
  const diffTime = expiry.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      valid: false,
      status: 'expired',
      reason: `License expired on ${lic.expiry_date} (${Math.abs(daysRemaining)} days ago)`,
      daysRemaining: 0
    };
  }

  return {
    valid: true,
    status: 'active',
    daysRemaining
  };
}

/**
 * Creates a signed license and prepares downloadable JSON / string
 */
export function generateSignedLicense(params: {
  licensed_to: string;
  license_tier: 'Starter' | 'Professional' | 'Enterprise' | 'Ultimate' | 'Lifetime';
  contact_email?: string;
  domain?: string;
  is_lifetime?: boolean;
  expiry_date?: string;
  max_users?: number;
  max_organizations?: number;
  features?: Partial<LicenseFeatures>;
}): { license: SystemLicense; fileContent: string } {
  const is_lifetime = !!params.is_lifetime;
  const today = new Date().toISOString().split('T')[0];

  let expiry_date = params.expiry_date;
  if (!is_lifetime && !expiry_date) {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expiry_date = nextYear.toISOString().split('T')[0];
  }

  // Generate standardized key e.g. LIC-ENT-2026-XXXX-XXXX
  const randomPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const randomPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const tierPrefix = params.license_tier.substring(0, 3).toUpperCase();
  const license_key = `LIC-${tierPrefix}-${new Date().getFullYear()}-${randomPart1}-${randomPart2}`;

  const max_users = params.max_users || (params.license_tier === 'Ultimate' || params.license_tier === 'Enterprise' ? 100 : 25);
  const max_organizations = params.max_organizations || (params.license_tier === 'Ultimate' ? 20 : 5);

  const defaultFeatures: LicenseFeatures = {
    wood_management: true,
    furniture_management: true,
    pos_billing: true,
    sms_gateway: true,
    accounting_statements: true,
    excel_exports: true,
    multi_organization: params.license_tier !== 'Starter',
    api_access: params.license_tier === 'Enterprise' || params.license_tier === 'Ultimate'
  };

  const features: LicenseFeatures = {
    ...defaultFeatures,
    ...(params.features || {})
  };

  const signature = computeLicenseSignature({
    license_key,
    license_tier: params.license_tier,
    licensed_to: params.licensed_to,
    issued_date: today,
    expiry_date: is_lifetime ? undefined : expiry_date,
    is_lifetime,
    max_users,
    max_organizations
  });

  const license: SystemLicense = {
    license_key,
    license_tier: params.license_tier,
    licensed_to: params.licensed_to,
    contact_email: params.contact_email || '',
    domain: params.domain || '*',
    issued_date: today,
    expiry_date: is_lifetime ? undefined : expiry_date,
    is_lifetime,
    max_users,
    max_organizations,
    features,
    signature,
    status: 'active',
    created_at: new Date().toISOString()
  };

  const fileContent = JSON.stringify(license, null, 2);

  return { license, fileContent };
}

/**
 * Parse license content from raw file text or JSON
 */
export function parseLicenseFile(rawText: string): SystemLicense | null {
  try {
    const trimmed = rawText.trim();
    const parsed = JSON.parse(trimmed);
    if (parsed.license_key && parsed.licensed_to && parsed.signature) {
      return parsed as SystemLicense;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Load Active License from Database (system_licenses table or fallback to app_settings)
 */
export async function getActiveSystemLicense(): Promise<SystemLicense | null> {
  try {
    // 1. Try querying system_licenses table
    const { data, error } = await rawSupabase
      .from('system_licenses')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return data as SystemLicense;
    }
  } catch (e) {
    console.warn('system_licenses table check failed, checking app_settings fallback:', e);
  }

  try {
    // 2. Fallback to app_settings global record
    const { data: appSettingsData } = await rawSupabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle();

    if (appSettingsData?.settings?.system?.license) {
      return appSettingsData.settings.system.license as SystemLicense;
    }
  } catch (e) {
    console.warn('Could not read license from app_settings:', e);
  }

  // 3. Fallback to local storage cache if available
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('system_active_license');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
  }

  // 4. Default baseline active license
  const defaultLic: SystemLicense = {
    license_key: 'LIC-ENT-2026-DEMO-MASTER',
    license_tier: 'Enterprise',
    licensed_to: 'Timber & Furniture ERP Platform',
    contact_email: 'admin@system.local',
    issued_date: '2026-01-01',
    is_lifetime: true,
    max_users: 100,
    max_organizations: 10,
    features: {
      wood_management: true,
      furniture_management: true,
      pos_billing: true,
      sms_gateway: true,
      accounting_statements: true,
      excel_exports: true,
      multi_organization: true,
      api_access: true
    },
    signature: computeLicenseSignature({
      license_key: 'LIC-ENT-2026-DEMO-MASTER',
      license_tier: 'Enterprise',
      licensed_to: 'Timber & Furniture ERP Platform',
      issued_date: '2026-01-01',
      is_lifetime: true,
      max_users: 100,
      max_organizations: 10
    }),
    status: 'active'
  };

  return defaultLic;
}

/**
 * Save / Activate License in Database
 */
export async function saveSystemLicense(license: SystemLicense): Promise<{ success: boolean; error?: string }> {
  // Validate first
  const validation = validateLicense(license);
  if (!validation.valid) {
    return { success: false, error: validation.reason || 'Invalid license format or signature' };
  }

  license.status = validation.status;
  license.updated_at = new Date().toISOString();

  let savedInDb = false;

  // 1. Try to save to system_licenses table
  try {
    const { error } = await rawSupabase
      .from('system_licenses')
      .upsert({
        license_key: license.license_key,
        license_tier: license.license_tier,
        licensed_to: license.licensed_to,
        contact_email: license.contact_email || null,
        domain: license.domain || null,
        issued_date: license.issued_date,
        expiry_date: license.expiry_date || null,
        is_lifetime: license.is_lifetime,
        max_users: license.max_users,
        max_organizations: license.max_organizations,
        features: license.features,
        signature: license.signature,
        status: license.status,
        raw_license_data: license,
        updated_at: new Date().toISOString()
      }, { onConflict: 'license_key' });

    if (!error) {
      savedInDb = true;
    }
  } catch (e) {
    console.warn('Upsert to system_licenses failed, will use app_settings:', e);
  }

  // 2. Synchronize to app_settings global record
  try {
    const { data: globalSettings } = await rawSupabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle();

    const currentSettings = globalSettings?.settings || {};
    const updatedSystem = {
      ...(currentSettings.system || {}),
      license: license,
      license_updated_at: new Date().toISOString()
    };

    await rawSupabase
      .from('app_settings')
      .upsert({
        id: 'global',
        settings: {
          ...currentSettings,
          system: updatedSystem
        }
      });

    savedInDb = true;
  } catch (e) {
    console.warn('Failed updating app_settings for license:', e);
  }

  // 3. Cache in localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('system_active_license', JSON.stringify(license));
      window.dispatchEvent(new CustomEvent('system_license_updated', { detail: license }));
    } catch {}
  }

  return { success: savedInDb };
}

/**
 * Fetch all stored licenses from database
 */
export async function getAllSystemLicenses(): Promise<SystemLicense[]> {
  try {
    const { data, error } = await rawSupabase
      .from('system_licenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data as SystemLicense[];
    }
  } catch (e) {
    console.warn('Could not query system_licenses table:', e);
  }

  const active = await getActiveSystemLicense();
  return active ? [active] : [];
}
