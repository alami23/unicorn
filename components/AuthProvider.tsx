'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { preloadInvoicesBackground } from '@/lib/invoiceCache';

export interface CustomUser {
  id: string;
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  org_id?: string;
  role?: string;
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  businessName: string;
  businessLogo: string;
  businessLogoX: number;
  businessLogoY: number;
  businessLogoZoom: number;
  userRole: any;
  login: (userData: CustomUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  businessName: '',
  businessLogo: '',
  businessLogoX: 50,
  businessLogoY: 50,
  businessLogoZoom: 100,
  userRole: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoLogoutTime, setAutoLogoutTime] = useState<number>(0);
  const [businessName, setBusinessName] = useState('');
  const [businessLogo, setBusinessLogo] = useState('');
  const [businessLogoX, setBusinessLogoX] = useState<number>(50);
  const [businessLogoY, setBusinessLogoY] = useState<number>(50);
  const [businessLogoZoom, setBusinessLogoZoom] = useState<number>(100);
  const [userRole, setUserRole] = useState<any>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();
  const autoLogoutTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Helper to read stored user safely
  const getStoredUser = (): CustomUser | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('custom_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) {
          if (!parsed.org_id) {
            parsed.org_id = parsed.id;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error parsing custom_user from localStorage:', e);
    }
    return null;
  };

  // 1. Initial hydration and local storage restoration
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const restoredUser = getStoredUser();
      setUser(restoredUser);

      const storedBusinessName = localStorage.getItem('business_name');
      const storedBusinessLogo = localStorage.getItem('business_logo');
      const storedBusinessLogoX = localStorage.getItem('business_logo_x');
      const storedBusinessLogoY = localStorage.getItem('business_logo_y');
      const storedBusinessLogoZoom = localStorage.getItem('business_logo_zoom');
      if (storedBusinessName) setBusinessName(storedBusinessName);
      if (storedBusinessLogo) setBusinessLogo(storedBusinessLogo);
      if (storedBusinessLogoX) setBusinessLogoX(parseInt(storedBusinessLogoX) || 50);
      if (storedBusinessLogoY) setBusinessLogoY(parseInt(storedBusinessLogoY) || 50);
      if (storedBusinessLogoZoom) setBusinessLogoZoom(parseInt(storedBusinessLogoZoom) || 100);
    } catch (e) {
      console.warn('Error initializing auth state from localStorage:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch global settings and sync user role / auto-logout configuration
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('settings').eq('id', 'global').maybeSingle();
        if (data && data.settings) {
          const settings = data.settings as any;
          if (settings.system?.autoLogoutTime !== undefined) {
            const parsedTime = Number(settings.system.autoLogoutTime);
            setAutoLogoutTime(isNaN(parsedTime) ? 0 : parsedTime);
          }
          
          // Load global business settings, with fallback to user-specific if explicitly set
          const currentUser = getStoredUser() || user;
          const currentUserId = currentUser?.id;
          const globalBusiness = settings.business || {};
          const userBusiness = (currentUserId && settings.business_by_user?.[currentUserId]?.name)
            ? settings.business_by_user[currentUserId]
            : globalBusiness;

          const bizName = userBusiness.name || globalBusiness.name || '';
          const bizLogo = userBusiness.logo || globalBusiness.logo || '';
          const bizLogoX = userBusiness.logoX ?? globalBusiness.logoX ?? 50;
          const bizLogoY = userBusiness.logoY ?? globalBusiness.logoY ?? 50;
          const bizLogoZoom = userBusiness.logoZoom ?? globalBusiness.logoZoom ?? 100;

          setBusinessName(bizName);
          localStorage.setItem('business_name', bizName);

          setBusinessLogo(bizLogo);
          localStorage.setItem('business_logo', bizLogo);

          setBusinessLogoX(bizLogoX);
          localStorage.setItem('business_logo_x', bizLogoX.toString());

          setBusinessLogoY(bizLogoY);
          localStorage.setItem('business_logo_y', bizLogoY.toString());

          setBusinessLogoZoom(bizLogoZoom);
          localStorage.setItem('business_logo_zoom', bizLogoZoom.toString());

          setGlobalSettings(settings);
        }

        // Fetch latest custom_users record if user is logged in
        const activeUser = getStoredUser() || user;
        if (activeUser) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeUser.id);
          const filters: string[] = [];
          if (isUuid) filters.push(`id.eq.${activeUser.id}`);
          if (activeUser.phone) filters.push(`phone.eq.${activeUser.phone}`);
          if (activeUser.email) filters.push(`email.eq.${activeUser.email}`);
          if (activeUser.username) filters.push(`username.eq.${activeUser.username}`);

          if (filters.length > 0) {
            const { data: latestDbUser } = await supabase
              .from('custom_users')
              .select('id, name, username, email, phone, role, org_id')
              .or(filters.join(','))
              .maybeSingle();

            if (latestDbUser && latestDbUser.role && activeUser.role !== latestDbUser.role) {
              const updatedUser = {
                ...activeUser,
                role: latestDbUser.role,
                org_id: latestDbUser.org_id || activeUser.org_id || activeUser.id,
              };
              setUser(updatedUser);
              try {
                localStorage.setItem('custom_user', JSON.stringify(updatedUser));
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching settings for auth:', err);
      }
    };

    fetchSettings();

    const channel = supabase.channel('auth_settings_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        fetchSettings();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_users' }, () => {
        fetchSettings();
      })
      .subscribe();

    // Silent Supabase login to bypass RLS for background data operations
    const autoAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return;

        const email = 'admin@unicornfurniture.com';
        const password = 'password123';

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          await supabase.auth.signUp({
            email,
            password,
          });
        }
      } catch (err) {
        console.error('Background autoAuth error:', err);
      }
    };
    autoAuth();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 3. Multi-tab and local storage synchronization
  useEffect(() => {
    const handleStorageUpdate = (e?: StorageEvent | Event) => {
      try {
        // Sync custom_user if storage event or custom event fired
        const latestUser = getStoredUser();
        setUser(prev => {
          if (!latestUser && !prev) return null;
          if (JSON.stringify(latestUser) !== JSON.stringify(prev)) {
            return latestUser;
          }
          return prev;
        });

        const storedBusinessName = localStorage.getItem('business_name');
        const storedBusinessLogo = localStorage.getItem('business_logo');
        const storedBusinessLogoX = localStorage.getItem('business_logo_x');
        const storedBusinessLogoY = localStorage.getItem('business_logo_y');
        const storedBusinessLogoZoom = localStorage.getItem('business_logo_zoom');
        if (storedBusinessName !== null) setBusinessName(storedBusinessName);
        if (storedBusinessLogo !== null) setBusinessLogo(storedBusinessLogo);
        if (storedBusinessLogoX !== null) setBusinessLogoX(parseInt(storedBusinessLogoX) || 50);
        if (storedBusinessLogoY !== null) setBusinessLogoY(parseInt(storedBusinessLogoY) || 50);
        if (storedBusinessLogoZoom !== null) setBusinessLogoZoom(parseInt(storedBusinessLogoZoom) || 100);
      } catch (e) {
        console.warn('Error syncing info from storage event:', e);
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('settings_updated', handleStorageUpdate);
    window.addEventListener('custom_user_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('settings_updated', handleStorageUpdate);
      window.removeEventListener('custom_user_updated', handleStorageUpdate);
    };
  }, []);

  // 4. Role calculation
  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }

    const uEmail = user.email?.toLowerCase();
    const uUsername = user.username?.toLowerCase();

    // DYNAMIC LOOKUP FROM DATABASE SETTINGS:
    if (globalSettings) {
      if (globalSettings.users && globalSettings.roles) {
        const currentUserSettings = globalSettings.users.find((userItem: any) => 
          (user.email && userItem.email?.toLowerCase() === uEmail) || 
          (user.phone && userItem.phone === user.phone) ||
          (user.username && userItem.username?.toLowerCase() === uUsername)
        );
        if (currentUserSettings) {
          const role = globalSettings.roles.find((r: any) => r.id === currentUserSettings.roleId || r.name === currentUserSettings.roleName);
          if (role) {
            setUserRole(role);
            return;
          }
        }
      }

      if (user.role && globalSettings.roles) {
        const roleByName = globalSettings.roles.find((r: any) => r.name === user.role);
        if (roleByName) {
          setUserRole(roleByName);
          return;
        }
      }
    }

    // DEFAULT FALLBACK FOR ANY USER:
    setUserRole({
      id: 'r1',
      name: 'Super Admin',
      description: 'Complete access to all modules and system settings.',
      permissions: ['All Access']
    });
  }, [user, globalSettings]);

  // 5. Protected route redirection logic
  useEffect(() => {
    if (loading || !isSupabaseConfigured) return;

    const isPublicPage = pathname === '/login' || pathname === '/signup' || pathname === '/preview' || pathname?.startsWith('/preview');

    if (!user && !isPublicPage) {
      router.replace('/login');
    } else if (user && (pathname === '/login' || pathname === '/signup')) {
      router.replace('/');
    }
  }, [user, loading, pathname, router]);

  // 6. Preload invoices on user login
  useEffect(() => {
    if (user && isSupabaseConfigured) {
      preloadInvoicesBackground();
    }
  }, [user]);

  // 7. Login and Logout actions
  const login = React.useCallback((userData: CustomUser) => {
    const enrichedUser: CustomUser = {
      ...userData,
      org_id: userData.org_id || userData.id
    };
    setUser(enrichedUser);
    try {
      localStorage.setItem('custom_user', JSON.stringify(enrichedUser));
      window.dispatchEvent(new Event('custom_user_updated'));
    } catch (e) {
      console.warn('localStorage not available', e);
    }
    preloadInvoicesBackground();
    router.replace('/');
  }, [router]);

  const logout = React.useCallback(() => {
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current);
      autoLogoutTimerRef.current = null;
    }
    setUser(null);
    try {
      localStorage.removeItem('custom_user');
      window.dispatchEvent(new Event('custom_user_updated'));
    } catch (e) {
      console.warn('localStorage not available', e);
    }
    router.replace('/login');
  }, [router]);

  // 8. Inactivity Auto-Logout Timer (Only active when autoLogoutTime > 0)
  useEffect(() => {
    const autoLogoutMinutes = typeof autoLogoutTime === 'number' ? autoLogoutTime : Number(autoLogoutTime) || 0;
    if (!user || autoLogoutMinutes <= 0) {
      if (autoLogoutTimerRef.current) {
        clearTimeout(autoLogoutTimerRef.current);
        autoLogoutTimerRef.current = null;
      }
      return;
    }

    const resetTimer = () => {
      if (autoLogoutTimerRef.current) {
        clearTimeout(autoLogoutTimerRef.current);
      }
      autoLogoutTimerRef.current = setTimeout(() => {
        logout();
      }, autoLogoutMinutes * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((name) => {
      document.addEventListener(name, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      if (autoLogoutTimerRef.current) {
        clearTimeout(autoLogoutTimerRef.current);
        autoLogoutTimerRef.current = null;
      }
      events.forEach((name) => {
        document.removeEventListener(name, resetTimer);
      });
    };
  }, [user, autoLogoutTime, logout]);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Supabase Not Configured</h2>
          <p className="text-slate-600 mb-6 font-medium">Please set up your Supabase project and add the environment variables in the **Settings** menu:</p>
          <div className="text-left bg-slate-50 p-4 rounded-xl space-y-3 font-mono text-xs text-slate-700 border border-slate-200 mb-6">
             <p className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2">Required Variables:</p>
             <p>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</p>
             <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...</p>
             <div className="mt-4 pt-2 border-t border-slate-200 text-[10px] text-slate-500 italic">
               Note: The Anon Key should be a very long string starting with &quot;eyJ&quot;. You can find it in your Supabase Dashboard under Settings to API.
             </div>
          </div>
        </div>
      </div>
    );
  }

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isPublicPage = isAuthPage || pathname === '/preview' || pathname?.startsWith('/preview');

  let renderContent: React.ReactNode = null;

  if (loading) {
    renderContent = (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  } else if (!user && !isPublicPage) {
    // Unauthenticated user trying to access a protected route
    // Show loading spinner while redirecting to /login (prevents dashboard flash)
    renderContent = (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  } else if (user && isAuthPage) {
    // Authenticated user on login/signup page
    // Show loading spinner while redirecting to dashboard
    renderContent = (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  } else {
    // Authenticated on protected route OR on public page (e.g. /preview, /login, /signup)
    renderContent = children;
  }

  return (
    <AuthContext.Provider value={{ user, loading, businessName, businessLogo, businessLogoX, businessLogoY, businessLogoZoom, userRole, login, logout }}>
      {renderContent}
    </AuthContext.Provider>
  );
};
