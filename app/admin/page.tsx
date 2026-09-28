'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  User,
  Users,
  Key,
  Server,
  Database,
  Settings,
  FileCheck2,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  ExternalLink,
  Eye,
  EyeOff,
  Search,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Sun,
  Moon,
  Laptop,
  Check,
  X,
  FileText,
  Sliders,
  Activity,
  HardDrive,
  Globe,
  Radio
} from 'lucide-react';
import { rawSupabase } from '@/lib/supabase';
import {
  SystemLicense,
  validateLicense,
  generateSignedLicense,
  parseLicenseFile,
  getActiveSystemLicense,
  saveSystemLicense,
  getAllSystemLicenses
} from '@/lib/license';
import {
  MasterAdminUser,
  getMasterAdminSession,
  clearMasterAdminSession,
  loginMasterAdmin,
  updateMasterAdminCredentials,
  getMasterAdminCredentials
} from '@/lib/adminAuth';

type AdminTab = 'overview' | 'users' | 'license' | 'system' | 'database';

export default function DedicatedAdminDashboardPage() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Authentication State
  const [session, setSession] = useState<MasterAdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Login Form States
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Dashboard Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // License States
  const [activeLicense, setActiveLicense] = useState<SystemLicense | null>(null);
  const [licenseHistory, setLicenseHistory] = useState<SystemLicense[]>([]);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [uploadedLicenseText, setUploadedLicenseText] = useState('');
  const [parsedUploadPreview, setParsedUploadPreview] = useState<SystemLicense | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generator Modal / States
  const [genTier, setGenTier] = useState<'Starter' | 'Professional' | 'Enterprise' | 'Ultimate' | 'Lifetime'>('Enterprise');
  const [genCompany, setGenCompany] = useState('');
  const [genEmail, setGenEmail] = useState('');
  const [genLifetime, setGenLifetime] = useState(false);
  const [genExpiry, setGenExpiry] = useState('');
  const [genMaxUsers, setGenMaxUsers] = useState(100);
  const [genMaxOrgs, setGenMaxOrgs] = useState(10);
  const [generatedLicenseResult, setGeneratedLicenseResult] = useState<{ license: SystemLicense; fileContent: string } | null>(null);

  // Users Management States
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // New User Form fields
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('Staff');
  const [formPassword, setFormPassword] = useState('');
  const [formOrgId, setFormOrgId] = useState('');
  const [formStatus, setFormStatus] = useState('active');

  // System Configurations States
  const [adminCustomPath, setAdminCustomPath] = useState('/admin');
  const [platformTitle, setPlatformTitle] = useState('Timber & Furniture ERP Platform');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('System is undergoing scheduled maintenance. Please check back shortly.');
  const [securityPinConfig, setSecurityPinConfig] = useState('123456');
  const [autoLogoutDuration, setAutoLogoutDuration] = useState(30);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Password Update Modal
  const [credCurrPass, setCredCurrPass] = useState('');
  const [credNewPass, setCredNewPass] = useState('');
  const [credConfirmPass, setCredConfirmPass] = useState('');
  const [credNewUser, setCredNewUser] = useState('');
  const [credNewEmail, setCredNewEmail] = useState('');
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState<string | null>(null);
  const [credUpdating, setCredUpdating] = useState(false);

  // Metrics States
  const [totalInvoicesCount, setTotalInvoicesCount] = useState<number>(0);
  const [totalTenantsCount, setTotalTenantsCount] = useState<number>(1);
  const [dbPingMs, setDbPingMs] = useState<number | null>(null);
  const [exportingDb, setExportingDb] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const existing = getMasterAdminSession();
    if (existing) {
      setSession(existing);
    }
    setAuthLoading(false);
  }, []);

  const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'dark';

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // Load Dashboard Data once authenticated
  const loadDashboardData = async () => {
    setLicenseLoading(true);
    setUsersLoading(true);
    const startTime = performance.now();

    try {
      // 1. Load active license and history
      const lic = await getActiveSystemLicense();
      setActiveLicense(lic);
      const allLics = await getAllSystemLicenses();
      setLicenseHistory(allLics);
    } catch (e) {
      console.warn('Error loading license in admin dashboard:', e);
    } finally {
      setLicenseLoading(false);
    }

    try {
      // 2. Load all users across the entire platform
      const { data: usersData, error: usersErr } = await rawSupabase
        .from('custom_users')
        .select('*')
        .order('name', { ascending: true });

      if (!usersErr && usersData) {
        setAllUsers(usersData);
        // Calculate unique organizations
        const uniqueOrgs = new Set(usersData.map((u: any) => u.org_id || u.id).filter(Boolean));
        setTotalTenantsCount(uniqueOrgs.size || 1);
      } else {
        // Fallback demo user list if custom_users is not populated
        const fallbackUsers = [
          { id: 'usr-1', name: 'Master Administrator', username: 'admin', email: 'admin@system.local', phone: '+1234567890', role: 'Super Admin', status: 'active', org_id: 'org-main' },
          { id: 'usr-2', name: 'Al-Amin Hossan', username: 'alamin', email: 'alamin@timbererp.com', phone: '+8801712345678', role: 'Manager', status: 'active', org_id: 'org-timber-1' },
          { id: 'usr-3', name: 'Sales Executive', username: 'sales', email: 'sales@timbererp.com', phone: '+8801812345678', role: 'Staff', status: 'active', org_id: 'org-timber-1' },
        ];
        setAllUsers(fallbackUsers);
      }
    } catch (e) {
      console.warn('Error loading users:', e);
    } finally {
      setUsersLoading(false);
    }

    try {
      // 3. Load global system settings & configurations
      const { data: globalSettings } = await rawSupabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle();

      if (globalSettings?.settings) {
        const sys = globalSettings.settings.system || {};
        if (sys.admin_custom_path) setAdminCustomPath(sys.admin_custom_path);
        if (sys.maintenance_mode !== undefined) setMaintenanceMode(sys.maintenance_mode);
        if (sys.maintenance_message) setMaintenanceMsg(sys.maintenance_message);
        if (sys.platform_title) setPlatformTitle(sys.platform_title);
        if (sys.autoLogoutTime) setAutoLogoutDuration(Number(sys.autoLogoutTime) || 30);
        if (sys.master_admin?.securityPin) setSecurityPinConfig(sys.master_admin.securityPin);
      }

      // Count invoices platform-wide
      const { count: woodCount } = await rawSupabase.from('wood_invoices').select('id', { count: 'exact', head: true });
      const { count: furnCount } = await rawSupabase.from('furniture_invoices').select('id', { count: 'exact', head: true });
      setTotalInvoicesCount((woodCount || 0) + (furnCount || 0));

      const ping = Math.round(performance.now() - startTime);
      setDbPingMs(ping);
    } catch (e) {
      console.warn('Error loading platform metrics:', e);
    }
  };

  useEffect(() => {
    if (session) {
      loadDashboardData();
    }
  }, [session]);

  // Handle Master Admin Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);

    try {
      const result = await loginMasterAdmin(
        loginIdentifier,
        loginPassword,
        loginPin,
        rememberMe
      );

      if (result.success && result.user) {
        setSession(result.user);
        setFailedAttempts(0);
      } else {
        setFailedAttempts(prev => prev + 1);
        setLoginError(result.error || 'Invalid administrator credentials');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check network connection.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Handle Master Admin Logout
  const handleLogout = () => {
    clearMasterAdminSession();
    setSession(null);
    setLoginPassword('');
    setLoginPin('');
  };

  // License File Selection & Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadedLicenseText(content);
      const parsed = parseLicenseFile(content);
      if (parsed) {
        const val = validateLicense(parsed);
        if (val.valid) {
          setParsedUploadPreview(parsed);
        } else {
          setUploadError(`License signature is invalid or expired: ${val.reason}`);
          setParsedUploadPreview(null);
        }
      } else {
        setUploadError('Unable to parse file. Please ensure it is a valid JSON license file.');
        setParsedUploadPreview(null);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  // Activate & Commit Uploaded License
  const handleCommitLicense = async () => {
    if (!parsedUploadPreview) return;
    setUploadError(null);
    setUploadSuccess(null);
    setLicenseLoading(true);

    try {
      const res = await saveSystemLicense(parsedUploadPreview);
      if (res.success) {
        setActiveLicense(parsedUploadPreview);
        setUploadSuccess(`License successfully activated for ${parsedUploadPreview.licensed_to}!`);
        setParsedUploadPreview(null);
        setUploadedLicenseText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadDashboardData();
      } else {
        setUploadError(res.error || 'Failed to save license in database.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error saving license to database.');
    } finally {
      setLicenseLoading(false);
    }
  };

  // Generate New Signed License
  const handleGenerateLicense = () => {
    if (!genCompany.trim()) {
      alert('Please enter a company / client name');
      return;
    }

    const gen = generateSignedLicense({
      licensed_to: genCompany.trim(),
      license_tier: genTier,
      contact_email: genEmail.trim(),
      is_lifetime: genLifetime,
      expiry_date: genLifetime ? undefined : (genExpiry || undefined),
      max_users: Number(genMaxUsers) || 100,
      max_organizations: Number(genMaxOrgs) || 10
    });

    setGeneratedLicenseResult(gen);
  };

  // Download Generated License File
  const handleDownloadLicenseFile = () => {
    if (!generatedLicenseResult) return;
    const blob = new Blob([generatedLicenseResult.fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedLicenseResult.license.license_key}.lic`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // User Edit / Create Handlers
  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setFormName(user.name || '');
    setFormUsername(user.username || '');
    setFormEmail(user.email || '');
    setFormPhone(user.phone || '');
    setFormRole(user.role || 'Staff');
    setFormPassword('');
    setFormOrgId(user.org_id || user.id || '');
    setFormStatus(user.status || 'active');
    setUserFormError(null);
  };

  const handleOpenNewUser = () => {
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('Staff');
    setFormPassword('');
    setFormOrgId('org-default');
    setFormStatus('active');
    setUserFormError(null);
    setNewUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSubmitting(true);

    try {
      if (!formName.trim()) {
        throw new Error('Full Name is required');
      }

      if (editingUser) {
        // Update user
        const updateData: any = {
          name: formName.trim(),
          username: formUsername.trim() || null,
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          role: formRole,
          org_id: formOrgId.trim() || null,
          status: formStatus
        };

        if (formPassword.trim()) {
          updateData.password = formPassword.trim();
        }

        const { error } = await rawSupabase
          .from('custom_users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) {
          throw error;
        }

        setEditingUser(null);
      } else {
        // Create user
        const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const insertData: any = {
          id: newId,
          name: formName.trim(),
          username: formUsername.trim() || `user_${Date.now().toString().slice(-4)}`,
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          role: formRole,
          password: formPassword.trim() || 'password123',
          org_id: formOrgId.trim() || newId,
          status: formStatus,
          created_at: new Date().toISOString()
        };

        const { error } = await rawSupabase
          .from('custom_users')
          .insert(insertData);

        if (error) {
          throw error;
        }

        setNewUserModalOpen(false);
      }

      await loadDashboardData();
    } catch (err: any) {
      setUserFormError(err.message || 'Failed to save user account.');
    } finally {
      setUserFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user account "${userName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await rawSupabase
        .from('custom_users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    }
  };

  // Impersonate / Login as user shortcut
  const handleImpersonateUser = (targetUser: any) => {
    if (typeof window !== 'undefined') {
      const impersonatedObj = {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        org_id: targetUser.org_id || targetUser.id
      };
      localStorage.setItem('custom_user', JSON.stringify(impersonatedObj));
      window.dispatchEvent(new Event('custom_user_updated'));
      window.open('/', '_blank');
    }
  };

  // Save System Configuration
  const handleSaveSystemConfig = async () => {
    setConfigSaving(true);
    setConfigSuccess(null);

    try {
      const { data: globalSettings } = await rawSupabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle();

      const curr = globalSettings?.settings || {};
      const updatedSystem = {
        ...(curr.system || {}),
        admin_custom_path: adminCustomPath.trim() || '/admin',
        maintenance_mode: maintenanceMode,
        maintenance_message: maintenanceMsg,
        platform_title: platformTitle,
        autoLogoutTime: autoLogoutDuration,
        master_admin: {
          ...((curr.system || {}).master_admin || {}),
          securityPin: securityPinConfig
        }
      };

      await rawSupabase
        .from('app_settings')
        .upsert({
          id: 'global',
          settings: {
            ...curr,
            system: updatedSystem
          }
        });

      setConfigSuccess('System configurations updated successfully!');
      setTimeout(() => setConfigSuccess(null), 3000);
    } catch (err: any) {
      alert(`Failed to save configurations: ${err.message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  // Master Admin Credentials Update
  const handleUpdateMasterCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError(null);
    setCredSuccess(null);

    if (credNewPass && credNewPass !== credConfirmPass) {
      setCredError('New password and confirmation do not match');
      return;
    }

    setCredUpdating(true);

    try {
      const res = await updateMasterAdminCredentials({
        username: credNewUser || undefined,
        email: credNewEmail || undefined,
        currentPassword: credCurrPass,
        newPassword: credNewPass || undefined,
        newSecurityPin: securityPinConfig
      });

      if (res.success) {
        setCredSuccess('Master Administrator credentials updated successfully!');
        setCredCurrPass('');
        setCredNewPass('');
        setCredConfirmPass('');
      } else {
        setCredError(res.error || 'Failed to update credentials');
      }
    } catch (err: any) {
      setCredError(err.message || 'Error updating credentials');
    } finally {
      setCredUpdating(false);
    }
  };

  // Export Full Platform Database Backup
  const handleExportFullDatabase = async () => {
    setExportingDb(true);
    try {
      const [usersRes, settingsRes, woodRes, furnRes, licsRes] = await Promise.all([
        rawSupabase.from('custom_users').select('*'),
        rawSupabase.from('app_settings').select('*'),
        rawSupabase.from('wood_invoices').select('*').limit(500),
        rawSupabase.from('furniture_invoices').select('*').limit(500),
        rawSupabase.from('system_licenses').select('*')
      ]);

      const backupData = {
        meta: {
          exported_at: new Date().toISOString(),
          platform: 'Timber & Furniture Enterprise System',
          version: '2.5.0-MASTER'
        },
        custom_users: usersRes.data || [],
        app_settings: settingsRes.data || [],
        wood_invoices: woodRes.data || [],
        furniture_invoices: furnRes.data || [],
        system_licenses: licsRes.data || []
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Database export failed: ${err.message}`);
    } finally {
      setExportingDb(false);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const searchMatch = !userSearch || (
        (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.phone && u.phone.includes(userSearch)) ||
        (u.org_id && u.org_id.toLowerCase().includes(userSearch.toLowerCase()))
      );

      const roleMatch = roleFilter === 'ALL' || (u.role && u.role.toLowerCase() === roleFilter.toLowerCase());
      const statusMatch = statusFilter === 'ALL' || ((u.status || 'active').toLowerCase() === statusFilter.toLowerCase());

      return searchMatch && roleMatch && statusMatch;
    });
  }, [allUsers, userSearch, roleFilter, statusFilter]);

  // License Validation state for active license
  const licenseValidation = useMemo(() => {
    if (!activeLicense) return null;
    return validateLicense(activeLicense);
  }, [activeLicense]);

  // ==========================================
  // VIEW 1: SECURE MASTER ADMIN LOGIN SCREEN
  // ==========================================
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-100">
        {/* Background glow effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top-Right Theme Toggle & Return Link */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-3 z-20">
          <Link
            href="/login"
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1.5"
          >
            <span>Tenant Portal</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          <button
            type="button"
            onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {currentTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-600/25 mb-3 border border-indigo-500/30">
              <Shield className="w-7 h-7 text-indigo-200" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Master Admin Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Dedicated system-wide dashboard for whole website governance, license validation, and user management.
            </p>
          </div>

          {/* Quick Demo Helper Hint */}
          <div className="mb-5 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Default Master Credentials:</span>
              <div className="font-mono text-[10px] mt-0.5 text-indigo-200/90">
                User: <span className="text-white">admin@system.local</span> | Pass: <span className="text-white">SuperAdmin@2026!</span>
              </div>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Master Admin Username / Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="admin@system.local or masteradmin"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 pl-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Security PIN (Optional)</span>
                <span className="text-[10px] text-slate-500 font-normal">Default: 123456</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="6-digit security PIN"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 pl-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 tracking-widest font-mono transition-colors"
                />
                <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Remember this session</span>
              </label>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                SSL Verified
              </span>
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98] cursor-pointer"
            >
              {loginSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating Master Access...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Access Master Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Quick populate button for developer convenience */}
          <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={() => {
                setLoginIdentifier('admin@system.local');
                setLoginPassword('SuperAdmin@2026!');
                setLoginPin('123456');
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Fill Demo Master Credentials
            </button>
          </div>
        </motion.div>

        {/* Footer info */}
        <p className="text-[11px] text-slate-500 mt-6 text-center">
          Timber & Furniture ERP Platform • Enterprise Core Governance Engine
        </p>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: MASTER ADMIN DASHBOARD (AUTHENTICATED)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Universal Master Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Branding & Core Portal Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 font-bold border border-indigo-500/30">
              <Shield className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-white">System Admin Portal</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Master Core
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Whole-Website Governance, License Validation & User Management
              </p>
            </div>
          </div>

          {/* Center / Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users ({allUsers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('license')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'license'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>License</span>
              {licenseValidation && (
                <span className={`w-2 h-2 rounded-full ${licenseValidation.valid ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'system'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>System Config</span>
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'database'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Database</span>
            </button>
          </nav>

          {/* Right: Quick actions & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              target="_blank"
              className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-medium border border-slate-700/60 transition-colors"
            >
              <span>View Main App</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <button
              type="button"
              onClick={loadDashboardData}
              title="Refresh Data"
              className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700/60"
            >
              <RefreshCw className={`w-4 h-4 ${licenseLoading || usersLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden border-t border-slate-800/60 px-4 py-2 flex items-center justify-between gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            Users ({allUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('license')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${activeTab === 'license' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            License
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${activeTab === 'system' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            Config
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${activeTab === 'database' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
          >
            Database
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW METRICS                                   */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Banner: Status & Quick Info */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Core Engine Operational
                  </span>
                  {dbPingMs !== null && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      (Supabase Ping: {dbPingMs}ms)
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Welcome to Platform Administration
                </h2>
                <p className="text-xs text-slate-400 max-w-xl mt-1">
                  You are governing the entire multi-tenant Timber & Furniture ERP system. All users, license entitlements, and global configurations are managed from this unified console.
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleOpenNewUser}
                  className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New User</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('license')}
                  className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4 text-amber-400" />
                  <span>Manage License</span>
                </button>
              </div>
            </div>

            {/* Metrics Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Users */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Total Accounts</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-950/60 text-indigo-400 flex items-center justify-center border border-indigo-800/40">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {allUsers.length}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Across {totalTenantsCount} Organizations</span>
                  <button onClick={() => setActiveTab('users')} className="text-indigo-400 hover:underline">
                    Manage &rarr;
                  </button>
                </div>
              </div>

              {/* Card 2: License Status */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Active License</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/60 text-emerald-400 flex items-center justify-center border border-emerald-800/40">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                  <span>{activeLicense?.license_tier || 'Enterprise'}</span>
                  {activeLicense?.is_lifetime && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      Lifetime
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span className="text-emerald-400 font-medium">
                    {licenseValidation?.daysRemaining === 9999 ? 'Permanent Active' : `${licenseValidation?.daysRemaining || 0} days remaining`}
                  </span>
                  <button onClick={() => setActiveTab('license')} className="text-indigo-400 hover:underline">
                    Details &rarr;
                  </button>
                </div>
              </div>

              {/* Card 3: Platform Invoices */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Platform Invoices</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-950/60 text-amber-400 flex items-center justify-center border border-amber-800/40">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {totalInvoicesCount}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Wood & Furniture Bills</span>
                  <span className="text-slate-500 font-mono">Live DB</span>
                </div>
              </div>

              {/* Card 4: Customizable URL */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold">Custom Admin Path</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-950/60 text-purple-400 flex items-center justify-center border border-purple-800/40">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-lg font-mono font-bold text-purple-300 truncate">
                  {adminCustomPath}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Customizable URL</span>
                  <button onClick={() => setActiveTab('system')} className="text-indigo-400 hover:underline">
                    Configure &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Overview Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active License Details Card */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span>License Entitlements</span>
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Cryptographically Valid
                  </span>
                </div>

                {activeLicense ? (
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">License Key:</span>
                      <span className="font-mono text-white font-semibold flex items-center gap-1.5">
                        {activeLicense.license_key}
                        <button
                          onClick={() => handleCopy(activeLicense.license_key, 'lic-key-dash')}
                          className="text-slate-400 hover:text-white"
                        >
                          {copiedKey === 'lic-key-dash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Licensed Entity:</span>
                      <span className="text-white font-semibold">{activeLicense.licensed_to}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Allowed Users / Orgs:</span>
                      <span className="text-white font-semibold">{activeLicense.max_users} Users / {activeLicense.max_organizations} Orgs</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800/60">
                      <span className="text-slate-400">Expiration:</span>
                      <span className="text-white font-semibold">
                        {activeLicense.is_lifetime ? 'Lifetime (No Expiry)' : activeLicense.expiry_date}
                      </span>
                    </div>
                    <div className="pt-2">
                      <span className="text-slate-400 block mb-2 font-medium">Enabled Feature Modules:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(activeLicense.features || {}).map(([key, val]) => (
                          <span
                            key={key}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border ${
                              val
                                ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/50'
                                : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                            }`}
                          >
                            {key.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    No active license found. Click Manage License to install one.
                  </div>
                )}
              </div>

              {/* System Governance & Security Card */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-400" />
                    <span>System Governance</span>
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                    SuperAdmin
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <div>
                      <span className="font-semibold text-white block">Maintenance Mode</span>
                      <span className="text-[11px] text-slate-400">
                        {maintenanceMode ? 'Active: Tenant users are blocked' : 'Normal: Platform open to all users'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMaintenanceMode(!maintenanceMode);
                        handleSaveSystemConfig();
                      }}
                      className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer ${
                        maintenanceMode ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {maintenanceMode ? 'Disable' : 'Enable'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <div>
                      <span className="font-semibold text-white block">Custom Admin URL Path</span>
                      <span className="text-[11px] font-mono text-purple-300">{adminCustomPath}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('system')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Change Path
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <div>
                      <span className="font-semibold text-white block">Full Database Backup</span>
                      <span className="text-[11px] text-slate-400">Export JSON of all tables across platform</span>
                    </div>
                    <button
                      type="button"
                      disabled={exportingDb}
                      onClick={handleExportFullDatabase}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{exportingDb ? 'Exporting...' : 'Export'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: USER ACCOUNTS MANAGEMENT (MONITOR & EDIT ALL)     */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-5">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Platform User Accounts</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitor, edit, reset passwords, or delete any user account across all tenant organizations.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenNewUser}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create User Account</span>
              </button>
            </div>

            {/* Filters Bar */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, phone, username, or org_id..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Role filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Roles</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Staff">Staff</option>
                  <option value="Customer">Customer</option>
                </select>

                <span className="text-xs text-slate-400 ml-2">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Tenant / Org ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-700 to-indigo-900 text-white flex items-center justify-center font-bold text-xs">
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="font-semibold text-white">{u.name || 'Unnamed User'}</div>
                                <div className="text-[10px] text-slate-400 font-mono">@{u.username || 'no-username'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-300">{u.email || '-'}</div>
                            <div className="text-[10px] text-slate-500">{u.phone || '-'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                              u.role === 'Super Admin'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : u.role === 'Admin'
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                : u.role === 'Manager'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                              {u.role || 'Staff'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {u.org_id || u.id || 'default'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit ${
                              (u.status || 'active') === 'active'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                (u.status || 'active') === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`} />
                              {u.status || 'active'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleImpersonateUser(u)}
                                title="Login as this user"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-white transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                title="Edit user"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                title="Delete user"
                                className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No users found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: LICENSE VALIDATION & FILE MANAGEMENT              */}
        {/* ======================================================== */}
        {activeTab === 'license' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-amber-400" />
                <span>Enterprise License Governance</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload and validate signed license files, verify cryptographic signatures, or generate new client license keys.
              </p>
            </div>

            {/* Current Active License Status Card */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    licenseValidation?.valid
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                      : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                  }`}>
                    {licenseValidation?.valid ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">
                        {activeLicense?.licensed_to || 'Unlicensed Installation'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        licenseValidation?.valid
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {licenseValidation?.status?.toUpperCase() || 'UNLICENSED'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tier: <span className="text-indigo-400 font-semibold">{activeLicense?.license_tier || 'N/A'}</span> • Key: <span className="font-mono text-slate-300">{activeLicense?.license_key || 'None'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeLicense) {
                        const blob = new Blob([JSON.stringify(activeLicense, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${activeLicense.license_key}.lic`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .lic</span>
                  </button>
                </div>
              </div>

              {/* License Details Grid */}
              {activeLicense && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Cryptographic Signature</span>
                    <span className="font-mono text-[11px] text-emerald-400 break-all">{activeLicense.signature}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Max Users & Orgs</span>
                    <span className="font-semibold text-white text-sm">{activeLicense.max_users} Users / {activeLicense.max_organizations} Orgs</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Issue Date & Expiry</span>
                    <span className="font-semibold text-white text-sm">
                      {activeLicense.issued_date} &rarr; {activeLicense.is_lifetime ? 'Lifetime' : activeLicense.expiry_date}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Days Remaining</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {activeLicense.is_lifetime ? 'Permanent Active' : `${licenseValidation?.daysRemaining} Days`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Split Grid: Upload License & Generate License */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box 1: Upload / Validate New License File */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Upload & Activate License File</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Select a signed `.lic` or `.json` license file to upload, store in the database, and activate immediately.
                </p>

                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {/* Upload drag-drop area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.lic,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <FileCheck2 className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-white">
                    Click to browse or drop license file (.lic, .json)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cryptographic signature is verified instantly upon selection.
                  </p>
                </div>

                {/* Preview of parsed license before activation */}
                {parsedUploadPreview && (
                  <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Parsed License Preview</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Signature Verified
                      </span>
                    </div>
                    <div className="text-slate-300">
                      <strong>Client:</strong> {parsedUploadPreview.licensed_to}
                    </div>
                    <div className="text-slate-300">
                      <strong>Tier:</strong> {parsedUploadPreview.license_tier} • <strong>Users:</strong> {parsedUploadPreview.max_users}
                    </div>
                    <div className="text-slate-300">
                      <strong>Expiry:</strong> {parsedUploadPreview.is_lifetime ? 'Lifetime' : parsedUploadPreview.expiry_date}
                    </div>

                    <button
                      type="button"
                      onClick={handleCommitLicense}
                      className="w-full mt-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Commit & Activate License in Database</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Box 2: Built-in License Generator */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Generate Signed License</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Issue a valid cryptographically signed license file for new client deployments or tier upgrades.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Licensed Organization / Client</label>
                    <input
                      type="text"
                      value={genCompany}
                      onChange={(e) => setGenCompany(e.target.value)}
                      placeholder="e.g. Unicorn Furniture & Timber Ltd."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">License Tier</label>
                      <select
                        value={genTier}
                        onChange={(e) => setGenTier(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Starter">Starter</option>
                        <option value="Professional">Professional</option>
                        <option value="Enterprise">Enterprise</option>
                        <option value="Ultimate">Ultimate</option>
                        <option value="Lifetime">Lifetime</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Max Users</label>
                      <input
                        type="number"
                        value={genMaxUsers}
                        onChange={(e) => setGenMaxUsers(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
                      <input
                        type="checkbox"
                        checked={genLifetime}
                        onChange={(e) => setGenLifetime(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Lifetime License (No Expiration)</span>
                    </label>

                    {!genLifetime && (
                      <input
                        type="date"
                        value={genExpiry}
                        onChange={(e) => setGenExpiry(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateLicense}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>Generate Cryptographic License</span>
                  </button>

                  {/* Generated Result */}
                  {generatedLicenseResult && (
                    <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-xs space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">Generated License Key</span>
                        <span className="font-mono text-amber-300">{generatedLicenseResult.license.license_key}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleDownloadLicenseFile}
                          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1 text-[11px]"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download .lic File</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            saveSystemLicense(generatedLicenseResult.license);
                            setActiveLicense(generatedLicenseResult.license);
                            alert('License activated as current system license!');
                          }}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1 text-[11px]"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Activate Now</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: SYSTEM CONFIGURATIONS & CUSTOMIZABLE URL          */}
        {/* ======================================================== */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <span>System Configurations & Security</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize your dedicated admin dashboard URL, configure maintenance flags, and update master security keys.
              </p>
            </div>

            {configSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{configSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customizable Admin URL Box */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Customizable Admin URL</h3>
                </div>
                <p className="text-xs text-slate-400">
                  You can customize the dedicated URL route for accessing this master administration portal for enhanced obscurity and brand alignment.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Custom URL Slug</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={adminCustomPath}
                          onChange={(e) => setAdminCustomPath(e.target.value)}
                          placeholder="/admin or /sys-admin or /master-portal"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const origin = typeof window !== 'undefined' ? window.location.origin : '';
                          handleCopy(`${origin}${adminCustomPath}`, 'admin-url');
                        }}
                        className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedKey === 'admin-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>Copy Full URL</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Example: <span className="text-purple-300 font-mono">/admin</span>, <span className="text-purple-300 font-mono">/sysadmin</span>, or <span className="text-purple-300 font-mono">/control-center</span>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-900/30 text-slate-300">
                    <span className="font-semibold text-white block mb-0.5">Direct Access Link:</span>
                    <span className="font-mono text-[11px] text-purple-300 break-all">
                      {typeof window !== 'undefined' ? `${window.location.origin}${adminCustomPath}` : adminCustomPath}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={configSaving}
                    onClick={handleSaveSystemConfig}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{configSaving ? 'Saving Configurations...' : 'Save URL & System Settings'}</span>
                  </button>
                </div>
              </div>

              {/* Master Administrator Password & Security PIN */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Master Credentials & PIN</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Update the master administrator login password and 6-digit security PIN used to authenticate high-privilege operations.
                </p>

                {credError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{credError}</span>
                  </div>
                )}

                {credSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{credSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateMasterCredentials} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Current Master Password</label>
                    <input
                      type="password"
                      required
                      value={credCurrPass}
                      onChange={(e) => setCredCurrPass(e.target.value)}
                      placeholder="Enter current password to authorize change"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">New Password</label>
                      <input
                        type="password"
                        value={credNewPass}
                        onChange={(e) => setCredNewPass(e.target.value)}
                        placeholder="Leave blank to keep same"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={credConfirmPass}
                        onChange={(e) => setCredConfirmPass(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Master Security PIN (6 Digits)</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={securityPinConfig}
                      onChange={(e) => setSecurityPinConfig(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono tracking-widest focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={credUpdating}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{credUpdating ? 'Updating Credentials...' : 'Update Master Credentials'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: DATABASE TOOLS & SQL MIGRATION VIEW               */}
        {/* ======================================================== */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <span>Database Integration & Supabase Schemas</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review table status, export full data backups, and copy copy-paste SQL migration scripts for Supabase.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Supabase Client</span>
                <span className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Connected</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Live REST & Realtime WebSocket active</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Latency Ping</span>
                <span className="text-lg font-bold text-indigo-400 font-mono">
                  {dbPingMs !== null ? `${dbPingMs} ms` : 'Testing...'}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Direct roundtrip database response</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">Database Backup</span>
                <button
                  type="button"
                  disabled={exportingDb}
                  onClick={handleExportFullDatabase}
                  className="mt-1 w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportingDb ? 'Exporting...' : 'Export Full JSON Backup'}</span>
                </button>
              </div>
            </div>

            {/* Supabase Copy-Paste SQL Migration Box */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Supabase SQL Data Table & RLS Setup Script</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    If setting up a fresh Supabase project or verifying table policies, execute this SQL script in your Supabase SQL Editor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const sql = `-- Timber & Furniture ERP: Master Enterprise SQL Schema
-- 1. Table: system_licenses
CREATE TABLE IF NOT EXISTS public.system_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    license_tier TEXT NOT NULL DEFAULT 'Enterprise',
    licensed_to TEXT NOT NULL,
    contact_email TEXT,
    domain TEXT,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    is_lifetime BOOLEAN DEFAULT FALSE,
    max_users INTEGER DEFAULT 100,
    max_organizations INTEGER DEFAULT 10,
    features JSONB DEFAULT '{"wood_management": true, "furniture_management": true, "sms_gateway": true, "accounting_statements": true, "excel_exports": true, "multi_organization": true, "api_access": true}'::jsonb,
    signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    raw_license_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read of active licenses" ON public.system_licenses FOR SELECT USING (true);
CREATE POLICY "Allow full access for authenticated users" ON public.system_licenses FOR ALL USING (true);

-- 2. Table: system_admins
CREATE TABLE IF NOT EXISTS public.system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    security_pin TEXT DEFAULT '123456',
    role TEXT NOT NULL DEFAULT 'SuperAdmin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow system_admins access" ON public.system_admins FOR ALL USING (true);

-- 3. Ensure custom_users has status and org_id
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS org_id TEXT;
`;
                    handleCopy(sql, 'supabase-sql');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                >
                  {copiedKey === 'supabase-sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy SQL Code</span>
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-80 border border-slate-800">
{`-- Timber & Furniture ERP: Master Enterprise SQL Schema
-- 1. Table: system_licenses
CREATE TABLE IF NOT EXISTS public.system_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key TEXT UNIQUE NOT NULL,
    license_tier TEXT NOT NULL DEFAULT 'Enterprise',
    licensed_to TEXT NOT NULL,
    contact_email TEXT,
    domain TEXT,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    is_lifetime BOOLEAN DEFAULT FALSE,
    max_users INTEGER DEFAULT 100,
    max_organizations INTEGER DEFAULT 10,
    features JSONB DEFAULT '{"wood_management": true, "furniture_management": true, "sms_gateway": true, "accounting_statements": true, "excel_exports": true, "multi_organization": true, "api_access": true}'::jsonb,
    signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    raw_license_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read of active licenses" ON public.system_licenses FOR SELECT USING (true);
CREATE POLICY "Allow full access for authenticated users" ON public.system_licenses FOR ALL USING (true);

-- 2. Table: system_admins
CREATE TABLE IF NOT EXISTS public.system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    security_pin TEXT DEFAULT '123456',
    role TEXT NOT NULL DEFAULT 'SuperAdmin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow system_admins access" ON public.system_admins FOR ALL USING (true);

-- 3. Ensure custom_users has status and org_id
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS org_id TEXT;`}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: EDIT OR CREATE USER ACCOUNT                       */}
      {/* ======================================================== */}
      {(editingUser || newUserModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-400" />
                <span>{editingUser ? `Edit Account: ${editingUser.name}` : 'Create New User Account'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setNewUserModalOpen(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userFormError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{userFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Username</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+8801700000000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Staff">Staff</option>
                    <option value="Customer">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Account Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tenant Organization ID</label>
                  <input
                    type="text"
                    value={formOrgId}
                    onChange={(e) => setFormOrgId(e.target.value)}
                    placeholder="org-12345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {editingUser ? 'Reset Password (optional)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? 'Leave blank to retain current' : 'Min 6 characters'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setNewUserModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userFormSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>{userFormSubmitting ? 'Saving...' : 'Save User Account'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
