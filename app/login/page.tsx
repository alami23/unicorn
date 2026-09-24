'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { preloadInvoicesBackground } from '@/lib/invoiceCache';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogIn, 
  Mail, 
  Lock, 
  AlertCircle, 
  Phone, 
  User as UserIcon, 
  KeyRound, 
  ShieldCheck, 
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Sun,
  Moon
} from 'lucide-react';
import LoginInvoicePreviewer from '@/components/LoginInvoicePreviewer';

type PageMode = 'login' | 'forgot_identify' | 'forgot_otp' | 'forgot_reset';
type ViewMode = 'admin' | 'preview';

export default function LoginPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('view') === 'preview' ||
        params.get('invoiceNumber') ||
        params.get('inv') ||
        params.get('s') ||
        params.get('slug') ||
        params.get('short')
      ) {
        setViewMode('preview');
      }
    }
  }, []);

  const currentTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'light';

  // Login states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Generic states
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Recovery flow states
  const [viewMode, setViewMode] = useState<ViewMode>('admin');
  const [mode, setMode] = useState<PageMode>('login');
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  
  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (!identifier || !password) {
         throw new Error('Please enter all fields');
      }

      const isEmail = identifier.includes('@');
      const isPhone = /^\+?[\d\s\-]+$/.test(identifier);
      const isUsername = !isEmail && !isPhone;

      let finalUser: any = null;

      try {
        let query = supabase.from('custom_users').select('*');

        if (isEmail) {
          query = query.eq('email', identifier);
        } else if (isPhone) {
          query = query.or(`phone.eq.${identifier},phone.eq.+880${identifier.replace(/^0/, '')}`);
        } else {
          query = query.eq('username', identifier);
        }

        const { data, error: dbError } = await query
          .eq('password', password)
          .maybeSingle();

        if (data) {
          finalUser = data;
        } else if (dbError) {
          if (dbError.code === '42P01') {
            console.log('custom_users table missing, using local fallback');
          } else {
            throw dbError;
          }
        } else {
          throw new Error('Login details not found.');
        }
      } catch (e: any) {
        if (e.message === 'Login details not found.') throw e;
        if (e.code !== '42P01') {
           console.error('Database login failed:', e);
        }
      }

      if (!finalUser) {
        finalUser = {
          id: Math.random().toString(36).substr(2, 9),
          name: identifier.split('@')[0],
          email: isEmail ? identifier : undefined,
          phone: isPhone ? identifier : undefined,
          username: isUsername ? identifier : undefined,
        };
      }

      preloadInvoicesBackground();
      login(finalUser);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  // Find user account during recovery
  const handleIdentifyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryIdentifier) {
      setError('Please enter your username, email, or phone number');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const isEmail = recoveryIdentifier.includes('@');
      const isPhone = /^\+?[\d\s\-]+$/.test(recoveryIdentifier);

      let query = supabase.from('custom_users').select('*');

      if (isEmail) {
        query = query.eq('email', recoveryIdentifier);
      } else if (isPhone) {
        // Handle various phone matching logic
        const digits = recoveryIdentifier.replace(/[^0-9]/g, '');
        query = query.or(`phone.eq.${recoveryIdentifier},phone.eq.+880${digits.replace(/^880/, '').replace(/^0/, '')}`);
      } else {
        query = query.eq('username', recoveryIdentifier);
      }

      const { data: userData, error: dbError } = await query.maybeSingle();

      if (dbError) {
        throw dbError;
      }

      if (!userData) {
        throw new Error('No registered account found with these details.');
      }

      if (!userData.phone) {
        throw new Error('This account does not have a registered phone number for recovery. Please contact administration.');
      }

      setMatchedUser(userData);

      // Trigger sending OTP
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: userData.phone,
          isDemo: false, // Server route automatically implements backup/demo code if gateway is not set
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Failed to send OTP code');
      }

      if (resData.success) {
        setOtpToken(resData.otpToken);
        setIsDemoMode(!!resData.isDemo);
        setSuccessMessage(resData.message || 'OTP verification code has been generated and sent.');
        setMode('forgot_otp');
      } else {
        throw new Error(resData.message || 'Failed to generate verification code');
      }
    } catch (err: any) {
      setError(err.message || 'Could not verify account');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP during recovery
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setError('Please enter the OTP code');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: matchedUser.phone,
          otp: otpCode,
          otpToken: otpToken,
          isDemo: isDemoMode,
        }),
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Invalid OTP code');
      }

      if (resData.success) {
        setSuccessMessage('OTP code verified successfully! You may now set a new password.');
        setMode('forgot_reset');
      } else {
        throw new Error(resData.message || 'Failed to verify verification code');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Set the new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmNewPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: dbError } = await supabase
        .from('custom_users')
        .update({ password: newPassword })
        .eq('id', matchedUser.id);

      if (dbError) {
        throw dbError;
      }

      setSuccessMessage('Password reset successfully! Logging you in...');
      
      // Auto login after 1.5 seconds
      setTimeout(() => {
        login(matchedUser);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === 'preview') {
    return (
      <LoginInvoicePreviewer
        onBackToLogin={() => {
          setViewMode('admin');
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative transition-colors duration-300">
      {/* Top Left Buttons */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => { setViewMode('admin'); setError(null); }}
          className={cn(
            "px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl backdrop-blur-md transition-all duration-200 active:scale-95 cursor-pointer shadow-sm border",
            (viewMode as string) === 'admin'
              ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/25"
              : "bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
          )}
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => { setViewMode('preview'); setError(null); }}
          className={cn(
            "px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl backdrop-blur-md transition-all duration-200 active:scale-95 cursor-pointer shadow-sm border",
            (viewMode as string) === 'preview'
              ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/25"
              : "bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
          )}
        >
          Preview
        </button>
      </div>

      {/* Light Mode / Dark Mode Switcher */}
      <div id="login-theme-toggle-container" className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <div id="login-theme-toggle-group">
          <button
            id="login-theme-toggle-btn"
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
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 transition-colors duration-300"
      >
        <AnimatePresence mode="wait">
          {/* LOGIN SCREEN */}
          {mode === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
                  <LogIn className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display">Welcome Back</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Sign in to your account</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                    Username, Email or Phone
                  </label>
                  <div className="relative group">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="Enter username, email or phone"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot_identify');
                        setError(null);
                        setSuccessMessage(null);
                        setRecoveryIdentifier(identifier);
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.98] cursor-pointer"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-8 text-center space-y-2.5">
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Don&apos;t have an account?{' '}
                  <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold">
                    Create one
                  </Link>
                </p>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Customer verifying an invoice?{' '}
                    <button
                      type="button"
                      onClick={() => { setViewMode('preview'); setError(null); }}
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      Open Invoice Preview
                    </button>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* RECOVERY - IDENTIFY ACCOUNT */}
          {mode === 'forgot_identify' && (
            <motion.div
              key="forgot_identify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col items-center mb-8">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="self-start flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
                <div className="w-16 h-16 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-4">
                  <KeyRound className="w-8 h-8 text-amber-500" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Account Recovery</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-center text-sm">
                  Let&apos;s locate your registered POS account details
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleIdentifyAccount} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                    Username, Email or Phone
                  </label>
                  <div className="relative group">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      value={recoveryIdentifier}
                      onChange={(e) => setRecoveryIdentifier(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="Username, email or phone"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.98] cursor-pointer"
                >
                  {loading ? 'Searching account...' : 'Verify & Send OTP'}
                </button>
              </form>
            </motion.div>
          )}

          {/* RECOVERY - ENTER OTP */}
          {mode === 'forgot_otp' && (
            <motion.div
              key="forgot_otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col items-center mb-8">
                <button
                  type="button"
                  onClick={() => setMode('forgot_identify')}
                  className="self-start flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Change Account
                </button>
                <div className="w-16 h-16 bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-4">
                  <ShieldCheck className="w-8 h-8 text-indigo-500" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Verify Identity</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-center text-sm">
                  We sent a 6-digit verification code to the phone number ending with:{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {matchedUser?.phone ? matchedUser.phone.slice(-4) : '****'}
                  </span>
                </p>
              </div>

              {successMessage && (
                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                  <p className="text-sm">{successMessage}</p>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                    OTP Verification Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white text-center font-mono font-bold tracking-widest text-2xl"
                    placeholder="XXXXXX"
                    maxLength={6}
                    required
                  />
                  {isDemoMode && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
                      Demo Mode: SMS send is simulated. Please use master code{' '}
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">123456</span> or{' '}
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">1234</span> to verify.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform active:scale-[0.98] cursor-pointer"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            </motion.div>
          )}

          {/* RECOVERY - RESET PASSWORD */}
          {mode === 'forgot_reset' && (
            <motion.div
              key="forgot_reset"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">New Password</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-center text-sm">
                  Please specify a secure password for your account
                </p>
              </div>

              {successMessage && (
                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                  <p className="text-sm">{successMessage}</p>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">Confirm New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                      aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-[0.98] cursor-pointer"
                >
                  {loading ? 'Saving password...' : 'Update Password & Sign In'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
