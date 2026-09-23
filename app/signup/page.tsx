'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Lock, User, AlertCircle, Phone, Mail, Fingerprint, Key, Eye, EyeOff, Sun, Moon } from 'lucide-react';

export default function SignupPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'light';

  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+880');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!licenseKey) {
      setError('License Key is required');
      return;
    }

    const cleanPhone = phone.replace(/^0+/, '');
    const fullPhoneNumber = `${countryCode}${cleanPhone}`;

    setLoading(true);
    setError(null);
    try {
      // 1. Verify License Key
      const { data: licenseData, error: licenseError } = await supabase
        .from('license_keys')
        .select('*')
        .eq('key', licenseKey)
        .eq('is_active', true)
        .single();

      if (licenseError || !licenseData) {
        throw new Error('Invalid or expired License Key');
      }

      // 2. Send OTP
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: fullPhoneNumber,
          isDemo: isDemoMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP code');
      }

      if (data.success) {
        setOtpToken(data.otpToken);
        if (data.isDemo) {
          setIsDemoMode(true);
        }
        setStep('otp');
      } else {
        throw new Error(data.message || 'Failed to send OTP code');
      }
    } catch (err: any) {
      console.warn('Signup Setup failed:', err);
      setError(err.message || 'Failed processing signup. Please check credentials or retry.');
      if (err.message?.includes('OTP') || err.message?.includes('SMS')) {
        setIsDemoMode(true);
        setStep('otp');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPhone = phone.replace(/^0+/, '');
    const fullPhoneNumber = `${countryCode}${cleanPhone}`;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: fullPhoneNumber,
          otp: otp,
          otpToken: otpToken,
          isDemo: isDemoMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid validation code');
      }

      const orgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'org_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      let finalUser = {
        id: Math.random().toString(36).substr(2, 9),
        name: username, // Using username as name
        username: username,
        email: email,
        phone: fullPhoneNumber,
        org_id: orgId
      };

      // Try inserting to Supabase custom_users table if available
      try {
        const { data: dbData, error: dbError } = await supabase
          .from('custom_users')
          .insert({
            name: finalUser.name,
            username: finalUser.username,
            email: finalUser.email,
            phone: finalUser.phone,
            password: password, // For mockup
            role: 'Super Admin',
            org_id: orgId
          })
          .select()
          .single();

        if (dbData) {
          finalUser = { ...finalUser, id: dbData.id, org_id: dbData.org_id || orgId };
        } else if (dbError && dbError.code !== '42P01') {
          // Ignore table missing error, throw valid errors
          throw dbError;
        }

        // Initialize or update app_settings with this brand new user as Super Admin
        try {
          const { data: settingsData } = await supabase
            .from('app_settings')
            .select('settings')
            .eq('id', 'global')
            .maybeSingle();

          if (settingsData && settingsData.settings) {
            const currentSettings = { ...settingsData.settings } as any;
            if (!currentSettings.users) {
              currentSettings.users = [];
            }
            const userExists = currentSettings.users.some(
              (u: any) =>
                u.email?.toLowerCase() === finalUser.email?.toLowerCase() ||
                u.phone === finalUser.phone ||
                u.username?.toLowerCase() === finalUser.username?.toLowerCase()
            );
            if (!userExists) {
              const isFirstUser = currentSettings.users.length === 0;
              currentSettings.users.push({
                id: finalUser.id,
                name: finalUser.name,
                email: finalUser.email,
                phone: finalUser.phone,
                username: finalUser.username,
                roleId: "r1", // Every new create account holder is a Super Admin
                status: "active",
                lastLogin: new Date().toISOString(),
              });

              await supabase.from('app_settings').upsert({
                id: 'global',
                settings: currentSettings,
                updated_at: new Date().toISOString(),
              });
            }
          } else {
            // No global settings row exists, initialize completely fresh with NO default dummy business profile or dummy users!
            const cleanInitialSettings = {
              business: {
                name: "",
                logo: "",
                logoX: 50,
                logoY: 50,
                logoZoom: 100,
                phone: "",
                secondaryPhone: "",
                whatsapp: "",
                email: "",
                address: "",
              },
              finance: {
                currency: "BDT",
                invoicePrefix: "INV-",
                defaultPaymentMethod: "Cash",
                paymentMethods: [
                  "Cash",
                  "Card",
                  "bKash",
                  "Nagad",
                  "Rocket",
                  "Bank Transfer",
                  "Mobile Banking",
                  "Cheque",
                  "Other",
                ],
                showPaymentOnChalan: false,
              },
              system: {
                lowStockThreshold: 5,
                defaultWoodPrice: null,
                autoLogoutTime: 5,
                language: "English",
                theme: "light",
                timezone: "Asia/Dhaka",
                dateFormat: "DD/MM/YYYY",
                timeFormat: "12h",
              },
              integrations: {
                smsApiKey: "",
                smsSenderId: "",
              },
              printing: {
                paperSize: "A4",
                showWatermark: true,
                footerText: "Thank you for your business!",
              },
              roles: [
                {
                  id: "r1",
                  name: "Super Admin",
                  description: "Complete access to all modules and system settings.",
                  permissions: ["All Access"],
                },
                {
                  id: "r_admin",
                  name: "Admin",
                  description: "Comprehensive access to all modules and system settings, excluding database clear/delete actions.",
                  permissions: [
                    "Dashboard",
                    "Financial Summary",
                    "solo wood",
                    "pos wood",
                    "pos furniture",
                    "Furniture Invoices",
                    "Wood Invoices",
                    "Customer",
                    "Customer Statement",
                    "Bills & Expenses",
                    "Furniture Inventory",
                    "Wood Inventory",
                    "Furniture Category",
                    "Wood Category",
                    "Staff",
                    "Staff Statement",
                    "Transaction",
                    "SMS",
                    "Reports",
                    "Settings",
                    "Users",
                    "Roles",
                  ],
                },
                {
                  id: "r2",
                  name: "Manager",
                  description: "Can manage inventory, view reports, and handle staff operations.",
                  permissions: ["Furniture Inventory", "Wood Inventory", "Furniture Invoices", "Wood Invoices", "Reports", "Staff", "Financial Summary", "Settings"],
                },
                {
                  id: "r3",
                  name: "Cashier",
                  description: "Can create and manage invoices and process sales only.",
                  permissions: ["Furniture Invoices", "Wood Invoices", "pos wood", "pos furniture", "Customer"],
                },
                {
                  id: "r4",
                  name: "Sales Rep",
                  description: "Can view inventory and customer statements.",
                  permissions: ["solo wood", "Customer Statement"],
                },
              ],
              users: [
                {
                  id: finalUser.id,
                  name: finalUser.name,
                  email: finalUser.email,
                  phone: finalUser.phone,
                  username: finalUser.username,
                  roleId: "r1", // Brand new first user is Super Admin
                  status: "active",
                  lastLogin: new Date().toISOString(),
                },
              ],
            };

            await supabase.from('app_settings').upsert({
              id: 'global',
              settings: cleanInitialSettings,
              updated_at: new Date().toISOString(),
            });
          }
        } catch (settingsErr) {
          console.error('Failed to initialize app settings:', settingsErr);
        }

        // Mark license key as used
        await supabase
          .from('license_keys')
          .update({ is_active: false, used_by_phone: fullPhoneNumber })
          .eq('key', licenseKey);

        // Ensure default wood price is clear so new user sets own price and set onboarding flag
        if (typeof window !== 'undefined') {
          localStorage.removeItem('defaultWoodPrice');
          localStorage.setItem('just_signed_up_' + finalUser.id, 'true');
        }
      } catch (e: any) {
        if (e.code === '42P01') {
           console.log('custom_users table does not exist.');
        } else {
           console.error('Database sign up failed:', e);
           throw e;
        }
      }

      login(finalUser);
    } catch (err: any) {
      setError(err.message || 'Failed to verify account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 py-12 relative transition-colors duration-300">
      {/* Light Mode / Dark Mode Switcher */}
      <div id="signup-theme-toggle-container" className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <div id="signup-theme-toggle-group">
          <button
            id="signup-theme-toggle-btn"
            type="button"
            onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 active:scale-90 cursor-pointer"
            title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {currentTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            )}
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
            {step === 'details' ? <UserPlus className="w-8 h-8 text-white" /> : <Fingerprint className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display">Create Account</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {step === 'details' ? 'Complete your profile to join' : 'Enter the verification code sent to you'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-left">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="relative">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.form 
                key="details-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleDetailsSubmit} 
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">User ID (Username)</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="johndoe"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Phone Number</label>
                  <div className="flex">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white pl-3 pr-2 py-3 border-r-0 text-sm"
                    >
                      <option value="+880">+880 (BD)</option>
                      <option value="+1">+1 (US/CA)</option>
                      <option value="+44">+44 (UK)</option>
                      <option value="+91">+91 (IN)</option>
                      <option value="+971">+971 (UAE)</option>
                      <option value="+60">+60 (MY)</option>
                      <option value="+65">+65 (SG)</option>
                    </select>
                    <div className="relative group flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                        placeholder="1700-000000"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">License Key</label>
                  <div className="relative group">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Create Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isDemoMode}
                      onChange={(e) => setIsDemoMode(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Demo registration (skip real SMS & verify with 123456)
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.98] mt-2"
                >
                  {loading ? 'Processing...' : 'Continue'}
                </button>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.form 
                key="otp-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleOtpSubmit} 
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">OTP Code</label>
                  <div className="relative group">
                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white text-center font-mono font-bold tracking-widest text-xl"
                      placeholder="XXXXXX"
                      maxLength={6}
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    {isDemoMode 
                      ? "Demo mode is active! Please type 123456 or 1234 to verify instantly." 
                      : "Enter the OTP sent via SMS. (Backup code: 123456)"}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.98]"
                >
                  {loading ? 'Creating Account...' : 'Verify & Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('details'); setOtp(''); }}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Back to Details
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 text-center pt-6 border-t border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

