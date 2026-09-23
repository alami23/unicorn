'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { useTheme } from 'next-themes'
import { 
  LayoutDashboard, 
  Trees, 
  Armchair, 
  FileText, 
  Calculator, 
  Undo2, 
  Users, 
  UserCircle, 
  Receipt, 
  Tags, 
  UserCog, 
  History, 
  ArrowLeftRight, 
  MessageSquare, 
  BarChart3,
  LayoutGrid,
  Menu,
  X,
  ChevronRight,
  Database,
  Search,
  User,
  Box,
  ShoppingBag,
  Sun,
  Moon,
  Home,
  Zap,
  Plus,
  ShoppingCart,
  ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'
import OnboardingModal from '@/components/OnboardingModal'

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/', permission: 'Dashboard' }, 
  { name: 'Solo Wood', icon: Trees, href: '/solo-wood', permission: 'solo wood' },
  { name: 'POS Wood', icon: Trees, href: '/pos-wood', permission: 'pos wood' },
  { name: 'POS Furniture', icon: Armchair, href: '/pos-furniture', permission: 'pos furniture' },
  { 
    name: 'Invoice', 
    icon: FileText, 
    href: '/invoice',
    subItems: [
      { name: 'Furniture Invoice', icon: Armchair, href: '/invoice?type=Furniture', permission: 'Furniture Invoices' },
      { name: 'Wood Invoice', icon: Trees, href: '/invoice?type=Wood', permission: 'Wood Invoices' },
    ]
  },
  { 
    name: 'Customer', 
    icon: Users, 
    href: '/customer',
    permission: 'Customer',
    subItems: [
      { name: 'Customer List', icon: Users, href: '/customer' },
      { name: 'Customer Statement', icon: UserCircle, href: '/customer-statement', permission: 'Customer Statement' },
    ]
  },
  { name: 'Bills', icon: Receipt, href: '/bills', permission: 'Bills & Expenses' },
  { 
    name: 'Inventory', 
    icon: Box, 
    href: '/furniture-inventory',
    subItems: [
      { name: 'Furniture', icon: ShoppingBag, href: '/furniture-inventory', permission: 'Furniture Inventory' },
      { name: 'Wood', icon: Box, href: '/wood-inventory', permission: 'Wood Inventory' },
    ]
  },
  { 
    name: 'Category', 
    icon: Tags, 
    href: '/furniture-category',
    subItems: [
      { name: 'Furniture', icon: Tags, href: '/furniture-category', permission: 'Furniture Category' },
      { name: 'Wood', icon: Trees, href: '/wood-category', permission: 'Wood Category' },
    ]
  },
  { 
    name: 'Staff', 
    icon: UserCog, 
    href: '/staff',
    permission: 'Staff',
    subItems: [
      { name: 'Staff List', icon: UserCog, href: '/staff' },
      { name: 'Staff Statement', icon: History, href: '/staff-statement', permission: 'Staff Statement' },
    ]
  },
  { name: 'Transactions', icon: ArrowLeftRight, href: '/transactions', permission: 'Transaction' },
  { name: 'SMS', icon: MessageSquare, href: '/sms', permission: 'SMS' },
  { name: 'Reports', icon: BarChart3, href: '/reports', permission: 'Reports' },
  { name: 'Settings', icon: UserCog, href: '/settings', permission: 'Settings' },
]

import { supabase } from '@/lib/supabase'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isAllOptionsOpen, setIsAllOptionsOpen] = useState(false) // Added
  const [isPosSellOpen, setIsPosSellOpen] = useState(false) // Added pos sell popup state
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false) // Added invoice popup state
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, logout, businessName, businessLogo, businessLogoX, businessLogoY, businessLogoZoom, userRole } = useAuth()
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const checkDb = async () => {
    setIsRefreshing(true)
    try {
      const { error } = await supabase.from('app_settings').select('id').limit(1)
      if (error) throw error
      setDbStatus('connected')
    } catch (err: any) {
      console.error('DB check failed:', err?.message ? `${err.message}${err.details ? ` - ${err.details}` : ''}${err.code ? ` (code: ${err.code})` : ''}` : err, err)
      setDbStatus('error')
    } finally {
      setTimeout(() => setIsRefreshing(false), 600)
    }
  }

  useEffect(() => {
    let activeFetches = 0
    let stopTimer: NodeJS.Timeout | null = null

    const handleFetchStart = () => {
      activeFetches++
      setIsRefreshing(true)
    }

    const handleFetchEnd = () => {
      activeFetches = Math.max(0, activeFetches - 1)
      if (activeFetches === 0) {
        if (stopTimer) clearTimeout(stopTimer)
        stopTimer = setTimeout(() => {
          setIsRefreshing(false)
        }, 500)
      }
    }

    window.addEventListener('db-fetch-start', handleFetchStart)
    window.addEventListener('db-fetch-end', handleFetchEnd)

    return () => {
      window.removeEventListener('db-fetch-start', handleFetchStart)
      window.removeEventListener('db-fetch-end', handleFetchEnd)
      if (stopTimer) clearTimeout(stopTimer)
    }
  }, [])
  
  const [unauthorizedAlert, setUnauthorizedAlert] = useState<{isOpen: boolean, requiredPermission?: string}>({isOpen: false})

  useEffect(() => {
    if (unauthorizedAlert.isOpen) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.play().catch(e => console.log('Audio play failed:', e))
    }
  }, [unauthorizedAlert.isOpen]);

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    if (permission === 'Settings') return true;
    if (!userRole) return false;
    if (userRole.permissions?.includes('All Access')) return true;
    return userRole.permissions?.includes(permission);
  };

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => {
      const isCurrentlyExpanded = !!prev[name];
      if (!isCurrentlyExpanded) {
        return { [name]: true };
      }
      return { ...prev, [name]: false };
    })
  }
  
  useEffect(() => {
    checkDb()
    const interval = setInterval(checkDb, 30000) // Check every 30s

    return () => {
      clearInterval(interval)
    }
  }, [])

  const currentTheme = theme === 'system' ? resolvedTheme : theme

  const isItemActive = (href: string) => {
    const [path, query] = href.split('?')
    if (pathname !== path) return false
    if (!query) return !searchParams?.toString()
    
    const params = new URLSearchParams(query)
    for (const [key, value] of params.entries()) {
      if (searchParams?.get(key) !== value) return false
    }
    return true
  }

  const handleLogout = async () => {
    try {
      logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  useEffect(() => {
    setMounted(true)
    
    const checkMobile = () => {
      const isMobileNow = window.innerWidth < 1024
      setIsMobile(isMobileNow)
      if (isMobileNow) setIsSidebarOpen(false)
      else setIsSidebarOpen(true)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [setTheme, user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme)
    
    // Also persist to Supabase
    try {
      // Use the newly set theme explicitly
      const targetTheme = newTheme
      
      const { data } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .single()
      
      const currentSettings = data?.settings || {}
      const updatedSettings = {
        ...(typeof currentSettings === 'object' ? currentSettings : {}),
        system: {
          ...((currentSettings as any)?.system || {}),
          theme: targetTheme
        }
      }
      
      await supabase
        .from('app_settings')
        .upsert({ 
          id: 'global', 
          settings: updatedSettings, 
          updated_at: new Date().toISOString() 
        })
    } catch (e) {
      console.error('Failed to save theme preference', e)
    }
  }

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [pathname, searchParams, isMobile])

  useEffect(() => {
    const isAnyOverlayOpen = (isMobile && isSidebarOpen) || isPosSellOpen || isAllOptionsOpen || isInvoiceOpen || unauthorizedAlert.isOpen
    if (isAnyOverlayOpen) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [isMobile, isSidebarOpen, isPosSellOpen, isAllOptionsOpen, isInvoiceOpen, unauthorizedAlert.isOpen])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? '280px' : '260px') : (isMobile ? '0px' : '80px'),
          x: isMobile && !isSidebarOpen ? -280 : 0
        }}
        className={cn(
          "fixed lg:relative z-[80] h-screen bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/50 overflow-hidden flex flex-col shadow-2xl lg:shadow-none",
          !isSidebarOpen && isMobile && "border-none"
        )}
      >
        <div className={cn(
          "p-8 flex items-center gap-4 border-b border-slate-100/50 dark:border-slate-800/50",
          !isSidebarOpen && !isMobile && "justify-center px-0"
        )}>
          <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-[1.25rem] flex items-center justify-center text-slate-900 dark:text-white shadow-xl shadow-slate-900/5 dark:shadow-white/5 shrink-0 overflow-hidden relative">
            {businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={businessLogo} 
                alt={businessName} 
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${businessLogoX ?? 50}% ${businessLogoY ?? 50}%`,
                  transform: `translate(${((businessLogoX ?? 50) - 50)}%, ${((businessLogoY ?? 50) - 50)}%) scale(${(businessLogoZoom ?? 100) / 100})`,
                  transformOrigin: 'center'
                }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <Armchair size={24} />
            )}
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-display font-extrabold text-slate-900 dark:text-slate-50 text-base leading-tight break-words">
                {businessName}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {menuItems.map((item) => {
            const hasActiveSubItem = item.subItems?.some(sub => isItemActive(sub.href))
            const isActive = isItemActive(item.href) && !hasActiveSubItem
            const isExpanded = (hasActiveSubItem || pathname?.startsWith(item.href) || expandedItems[item.name]) && isSidebarOpen

            return (
              <div key={item.name} className="space-y-1">
                {item.subItems ? (
                  <button
                    onClick={() => toggleExpand(item.name)}
                    className={cn(
                      "flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 group relative w-full text-left",
                      isActive 
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg shadow-slate-900/10 dark:shadow-white/5" 
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100",
                      !isSidebarOpen && !isMobile && "justify-center px-0"
                    )}
                  >
                    <item.icon 
                      size={19} 
                      style={{ color: isActive ? undefined : '#000000' }} 
                      className={cn(
                        "transition-transform group-hover:scale-110 shrink-0",
                        isActive ? "text-white dark:text-slate-900" : ""
                      )} 
                    />
                    {isSidebarOpen && (
                      <>
                        <span className="whitespace-nowrap flex-1 text-[13px] tracking-tight">{item.name}</span>
                        <ChevronRight size={14} style={{ color: '#000000' }} className={cn(
                          "transition-transform duration-300",
                          isExpanded && "rotate-90"
                        )} />
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={(e) => {
                      if (!hasPermission(item.permission)) {
                        e.preventDefault();
                        setUnauthorizedAlert({ isOpen: true, requiredPermission: item.permission });
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-300 group relative",
                      isActive 
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-lg shadow-slate-900/10 dark:shadow-white/5" 
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100",
                      !isSidebarOpen && !isMobile && "justify-center px-0"
                    )}
                    title={!isSidebarOpen ? item.name : undefined}
                  >
                    <item.icon 
                      size={19} 
                      style={{ color: isActive ? undefined : '#000000' }} 
                      className={cn(
                        "transition-transform group-hover:scale-110 shrink-0",
                        isActive ? "text-white dark:text-slate-900" : ""
                      )} 
                    />
                    {isSidebarOpen && <span className="whitespace-nowrap flex-1 text-[13px] tracking-tight">{item.name}</span>}
                  </Link>
                )}


                {item.subItems && isExpanded && isSidebarOpen && (
                  <div className="ml-5 pl-4 border-l-2 border-slate-100 dark:border-slate-800/50 space-y-1 mt-1">
                    {item.subItems.map((sub: any) => {
                      const isSubActive = isItemActive(sub.href)
                      return (
                        <Link
                          key={sub.name}
                          href={sub.href}
                          onClick={(e) => {
                            const permToCheck = sub.permission || item.permission;
                            if (!hasPermission(permToCheck)) {
                              e.preventDefault();
                              setUnauthorizedAlert({ isOpen: true, requiredPermission: permToCheck });
                            }
                          }}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-300",
                            isSubActive 
                              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900" 
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          )}
                        >
                          <sub.icon 
                            size={14} 
                            style={{ color: isSubActive ? undefined : '#000000' }} 
                            className={cn(
                              isSubActive ? "text-white dark:text-slate-900" : ""
                            )} 
                          />
                          <span>{sub.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-black max-w-full overflow-x-hidden">
        {/* Top Navbar */}
        <header className="h-[62px] bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-[60]">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              style={{ color: '#000000' }}
              aria-label="Toggle menu"
              id="menu-button"
            >
              {isSidebarOpen ? (
                <X size={20} style={{ color: '#000000' }} />
              ) : (
                <Menu size={20} style={{ color: '#000000' }} />
              )}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div 
              onClick={() => checkDb()}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-2xl border transition-all duration-300 cursor-pointer select-none active:scale-95 group shadow-sm",
                dbStatus === 'connected' ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30" : 
                dbStatus === 'error' ? "bg-rose-500/5 border-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30" : 
                "bg-amber-500/5 border-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30"
              )}
              title={
                isRefreshing
                  ? 'Database Refreshing...'
                  : dbStatus === 'connected'
                  ? 'Database Live (Click to refresh)'
                  : dbStatus === 'error'
                  ? 'Database Disconnected (Click to re-check)'
                  : 'Checking Connection...'
              }
            >
              {/* Dynamic Status/Database Icon Container */}
              <div className="relative flex items-center justify-center shrink-0 w-4 h-4">
                {isRefreshing ? (
                  <svg className="animate-spin h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <Database size={13} className="shrink-0 transition-transform duration-300 group-hover:scale-110" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                      {dbStatus === 'connected' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span className={cn(
                        "relative inline-flex rounded-full h-1.5 w-1.5 transition-colors duration-300",
                        dbStatus === 'connected' ? "bg-emerald-500" : 
                        dbStatus === 'error' ? "bg-rose-500" : "bg-amber-500"
                      )} />
                    </span>
                  </>
                )}
              </div>
            </div>

            {mounted && (
              <button
                onClick={() => handleThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
                className="py-[5.5px] px-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all duration-300 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center active:scale-90"
                title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {currentTheme === 'dark' ? (
                  <Sun size={18} className="text-amber-500" />
                ) : (
                  <Moon size={18} className="text-slate-600" />
                )}
              </button>
            )}
            {/* User Dropdown Menu */}
            <div className="relative flex items-center" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-display font-black text-xs shadow-lg shadow-slate-900/10 dark:shadow-white/5 border-2 border-slate-100 dark:border-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 transition-all hover:scale-105 active:scale-95 overflow-hidden group shrink-0"
                id="user-profile-button"
              >
                {user ? (
                  <span className="group-hover:scale-110 transition-transform">{user.email?.charAt(0).toUpperCase()}</span>
                ) : (
                  <User size={18} />
                )}
              </button>

              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                    className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden z-[100] p-1"
                    id="user-profile-dropdown"
                  >
                    <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/50 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-amber-500/20 shrink-0">
                        {user ? user.email?.charAt(0).toUpperCase() : <User size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100 truncate capitalize">
                          {user?.email?.split('@')[0].replace(/[._-]/g, ' ') || 'Guest User'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
                          {user?.email || 'guest@example.com'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="px-2 py-1 space-y-1">
                      <Link 
                        href="/settings?tab=my_profile"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[13px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-all text-left"
                      >
                        <UserCog size={18} className="text-slate-400" />
                        My Profile
                      </Link>
                      <button 
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[13px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all text-left"
                      >
                        <LogOut size={18} />
                        Sign Out
                      </button>
                    </div>

                    <div className="mt-2 p-3 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Global Status</span>
                        <div 
                          onClick={() => checkDb()}
                          className="flex items-center gap-2 cursor-pointer select-none group"
                          title="Click to refresh database connection"
                        >
                          <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                            {isRefreshing ? (
                              <svg className="animate-spin h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <>
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                  dbStatus === 'connected' ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : 
                                  dbStatus === 'error' ? "bg-rose-500" : "bg-amber-500"
                                )} />
                                {dbStatus === 'connected' && (
                                  <span className="absolute inset-0.5 rounded-full bg-emerald-500 animate-ping opacity-25" />
                                )}
                              </>
                            )}
                          </div>
                          <span className={cn(
                            "text-[10px] font-extrabold tracking-wide uppercase transition-all group-hover:underline",
                            dbStatus === 'connected' ? "text-emerald-600 dark:text-emerald-400" : 
                            dbStatus === 'error' ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                          )}>
                            {isRefreshing ? 'Refreshing' : dbStatus === 'connected' ? 'Connected' : dbStatus === 'error' ? 'Disconnected' : 'Syncing'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 lg:p-8 lg:pb-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 xl:hidden flex items-center justify-around p-2 z-[90] pb-safe">
          <Link 
            href="/" 
            onClick={(e) => {
              if (!hasPermission('Dashboard')) {
                e.preventDefault();
                setUnauthorizedAlert({ isOpen: true, requiredPermission: 'Dashboard' });
              }
            }}
            className="flex flex-col items-center gap-0.5 p-1 rounded-lg"
          >
            <Home size={22} style={{ color: '#000000' }} className={cn(pathname === '/' ? "font-bold" : "")} />
            <span className={cn("text-[10px] font-medium", pathname === '/' ? "text-slate-900 dark:text-white font-bold" : "text-slate-400")}>Home</span>
          </Link>
          <button 
            type="button"
            onClick={() => setIsPosSellOpen(!isPosSellOpen)}
            className={cn("flex flex-col items-center gap-0.5 p-1 rounded-lg", pathname?.startsWith('/pos-') || pathname === '/solo-wood' ? "text-slate-900 dark:text-white" : "text-slate-400")}
          >
            <Zap size={22} style={{ color: '#000000' }} />
            <span className={cn("text-[10px] font-medium", pathname?.startsWith('/pos-') || pathname === '/solo-wood' ? "text-slate-900 dark:text-white font-bold" : "text-slate-400")}>POS Sell</span>
          </button>
          <div className="relative -top-6">
            <button 
              onClick={() => setIsAllOptionsOpen(!isAllOptionsOpen)}
              className="flex items-center justify-center w-14 h-14 bg-slate-900 dark:bg-white rounded-full shadow-xl shadow-slate-900/20 dark:shadow-white/10 border-4 border-slate-50 dark:border-slate-950"
            >
              {isAllOptionsOpen ? (
                <X size={26} className="text-white dark:text-slate-900 transition-transform duration-200" />
              ) : (
                <LayoutGrid size={24} className="text-white dark:text-slate-900 transition-transform duration-200" />
              )}
            </button>
          </div>
          <AnimatePresence>
            {isPosSellOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsPosSellOpen(false)}
                  className="fixed inset-0 bg-black/60 z-[95] backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="fixed bottom-24 left-4 right-4 bg-white dark:bg-slate-900 p-5 rounded-3xl z-[100] shadow-2xl flex flex-col"
                >
                  <div className="grid grid-cols-3 gap-x-3 gap-y-5">
                    {[
                      { name: 'Solo Wood', icon: Trees, href: '/solo-wood' },
                      { name: 'POS Wood', icon: Trees, href: '/pos-wood' },
                      { name: 'POS Furniture', icon: Armchair, href: '/pos-furniture' },
                    ].map(item => (
                      <Link 
                        key={item.name} 
                        href={item.href} 
                        onClick={() => setIsPosSellOpen(false)} 
                        className="flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm">
                          <item.icon size={22} style={{ color: '#000000' }} className="shrink-0" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-center leading-tight break-words max-w-[80px]">
                          {item.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isAllOptionsOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsAllOptionsOpen(false)}
                  className="fixed inset-0 bg-black/60 z-[95] backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="fixed bottom-24 left-4 right-4 bg-white dark:bg-slate-900 p-5 rounded-3xl z-[100] shadow-2xl max-h-[70vh] overflow-y-auto flex flex-col"
                >
                  
                  <div className="grid grid-cols-3 gap-x-3 gap-y-5 pb-4">
                    {[
                      { name: 'Solo Wood', icon: Trees, href: '/solo-wood', permission: 'solo wood' },
                      { name: 'POS Wood', icon: Trees, href: '/pos-wood', permission: 'pos wood' },
                      { name: 'POS Furniture', icon: Armchair, href: '/pos-furniture', permission: 'pos furniture' },
                      { name: 'Furniture Invoices', icon: FileText, href: '/invoice?type=Furniture', permission: 'Furniture Invoices' },
                      { name: 'Wood Invoices', icon: FileText, href: '/invoice?type=Wood', permission: 'Wood Invoices' },
                      { name: 'Bills', icon: Receipt, href: '/bills', permission: 'Bills & Expenses' },
                      { name: 'Customer', icon: Users, href: '/customer', permission: 'Customer' },
                      { name: 'Customer Statement', icon: UserCircle, href: '/customer-statement', permission: 'Customer Statement' },
                      { name: 'Furniture Inventory', icon: ShoppingBag, href: '/furniture-inventory', permission: 'Furniture Inventory' },
                      { name: 'Furniture Category', icon: Tags, href: '/furniture-category', permission: 'Furniture Category' },
                      { name: 'Wood Category', icon: Trees, href: '/wood-category', permission: 'Wood Category' },
                      { name: 'Wood Inventory', icon: Box, href: '/wood-inventory', permission: 'Wood Inventory' },
                      { name: 'Staff', icon: UserCog, href: '/staff', permission: 'Staff' },
                      { name: 'Staff Statement', icon: History, href: '/staff-statement', permission: 'Staff Statement' },
                      { name: 'SMS', icon: MessageSquare, href: '/sms', permission: 'SMS' },
                      { name: 'Transactions', icon: ArrowLeftRight, href: '/transactions', permission: 'Transaction' },
                      { name: 'Reports', icon: BarChart3, href: '/reports', permission: 'Reports' },
                      { name: 'Settings', icon: UserCog, href: '/settings', permission: 'Settings' },
                    ].map(item => (
                      <Link 
                        key={item.name} 
                        href={item.href} 
                        onClick={(e) => {
                          if (!hasPermission(item.permission)) {
                            e.preventDefault();
                            setUnauthorizedAlert({ isOpen: true, requiredPermission: item.permission });
                          } else {
                            setIsAllOptionsOpen(false);
                          }
                        }} 
                        className="flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm">
                          <item.icon size={22} style={{ color: '#000000' }} className="shrink-0" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-center leading-tight break-words max-w-[80px]">
                          {item.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isInvoiceOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsInvoiceOpen(false)}
                  className="fixed inset-0 bg-black/60 z-[95] backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="fixed bottom-24 left-4 right-4 bg-white dark:bg-slate-900 p-5 rounded-3xl z-[100] shadow-2xl flex flex-col"
                >
                  <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                    {[
                      { name: 'Furniture Invoices', icon: FileText, href: '/invoice?type=Furniture', permission: 'Furniture Invoices' },
                      { name: 'Wood Invoices', icon: FileText, href: '/invoice?type=Wood', permission: 'Wood Invoices' },
                    ].map(item => (
                      <Link 
                        key={item.name} 
                        href={item.href} 
                        onClick={(e) => {
                          if (!hasPermission(item.permission)) {
                            e.preventDefault();
                            setUnauthorizedAlert({ isOpen: true, requiredPermission: item.permission });
                          } else {
                            setIsInvoiceOpen(false);
                          }
                        }} 
                        className="flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-sm">
                          <item.icon size={22} style={{ color: '#000000' }} className="shrink-0" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-center leading-tight break-words max-w-[80px]">
                          {item.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <button 
            type="button"
            onClick={(e) => {
              if (!hasPermission('Furniture Invoices') && !hasPermission('Wood Invoices')) {
                e.preventDefault();
                setUnauthorizedAlert({ isOpen: true, requiredPermission: 'Invoices' });
              } else {
                setIsInvoiceOpen(!isInvoiceOpen);
              }
            }}
            className="flex flex-col items-center gap-0.5 p-1 rounded-lg"
          >
            <FileText size={22} style={{ color: '#000000' }} className={cn(pathname === '/invoice' ? "font-bold" : "")} />
            <span className={cn("text-[10px] font-medium", pathname === '/invoice' ? "text-slate-900 dark:text-white font-bold" : "text-slate-400")}>Invoice</span>
          </button>
          <Link 
            href="/transactions" 
            onClick={(e) => {
              if (!hasPermission('Transaction')) {
                e.preventDefault();
                setUnauthorizedAlert({ isOpen: true, requiredPermission: 'Transaction' });
              }
            }}
            className="flex flex-col items-center gap-0.5 p-1 rounded-lg"
          >
            <ArrowLeftRight size={22} style={{ color: '#000000' }} className={cn(pathname === '/transactions' ? "font-bold" : "")} />
            <span className={cn("text-[10px] font-medium", pathname === '/transactions' ? "text-slate-900 dark:text-white font-bold" : "text-slate-400")}>Transaction</span>
          </Link>
        </nav>

        <AnimatePresence>
          {unauthorizedAlert.isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setUnauthorizedAlert({ isOpen: false })}
                className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-slate-900 p-6 rounded-3xl z-[9999] shadow-2xl flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4">
                  <ShieldAlert size={32} />
                </div>
                <h3 className="text-xl font-display font-extrabold text-slate-900 dark:text-white mb-2">Access Denied</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                  আপনার এই পেইজটি দেখার অনুমতি নেই। এই পেইজটির জন্য <strong className="text-slate-900 dark:text-white">{unauthorizedAlert.requiredPermission}</strong> অ্যাক্সেস প্রয়োজন।
                </p>
                <button
                  onClick={() => setUnauthorizedAlert({ isOpen: false })}
                  className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
                >
                  Okay
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <OnboardingModal />
    </div>
  )
}
