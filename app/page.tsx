'use client'

import React, { Suspense, useMemo } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal'
import AddCustomerModal from '@/components/AddCustomerModal'
import UpcomingDeliveriesWidget from '@/components/UpcomingDeliveriesWidget'
import InventoryStockWidget from '@/components/InventoryStockWidget'
import { motion } from 'motion/react'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  Trees,
  BarChart3,
  Receipt,
  CreditCard,
  Search,
  FileText,
  X,
  ExternalLink,
  Filter,
  Scan,
  Camera,
  QrCode,
  UserPlus
} from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { getDisplayInvoiceId } from '@/lib/invoice'
import { toast } from 'sonner'

const stats = [
  { label: 'Total Sales', value: '৳0', change: '+0%', trend: 'up', icon: DollarSign, color: 'bg-[#fe9a11]' },
  { label: 'Total Purchases', value: '৳0', change: '+0%', trend: 'up', icon: ShoppingBag, color: 'bg-slate-800' },
  { label: 'Total Customers', value: '0', change: '+0%', trend: 'up', icon: Users, color: 'bg-indigo-500' },
  { label: 'Due Collection', value: '৳0', change: '+0%', trend: 'down', icon: AlertCircle, color: 'bg-rose-500' },
]

const revenueDataMock = [
  { month: 'Jan', revenue: 45000, profit: 12000 },
  { month: 'Feb', revenue: 52000, profit: 15000 },
  { month: 'Mar', revenue: 48000, profit: 11000 },
  { month: 'Apr', revenue: 61000, profit: 19000 },
  { month: 'May', revenue: 55000, profit: 16000 },
  { month: 'Jun', revenue: 67000, profit: 22000 },
]

const categoryDataMock = [
  { name: 'Beds', value: 400, color: '#f59e0b' },
  { name: 'Sofas', value: 300, color: '#10b981' },
  { name: 'Dining', value: 300, color: '#3b82f6' },
  { name: 'Office', value: 200, color: '#8b5cf6' },
]

function DashboardContent() {
  const router = useRouter()
  const { user, userRole } = useAuth()
  const [liveStats, setLiveStats] = React.useState(stats)

  const isSuperAdmin = userRole?.name === 'Super Admin' || userRole?.id === 'r1'
  const canViewFinancialSummary = 
    isSuperAdmin || 
    userRole?.permissions?.includes('All Access') || 
    userRole?.permissions?.includes('Financial Summary') ||
    userRole?.permissions?.includes('Financial Summaries')

  const maskValue = (label: string, value: string) => {
    if (canViewFinancialSummary) return value
    const sensitiveLabels = ['Total Sales', 'Total Purchases', 'Total Customers', 'Due Collection']
    if (sensitiveLabels.includes(label)) {
      if (value.startsWith('৳')) {
        return '৳****'
      }
      return '****'
    }
    return value
  }
  const [recentTransactions, setRecentTransactions] = React.useState<any[]>([])
  const [recentInvoices, setRecentInvoices] = React.useState<any[]>([])
  const [chartData, setChartData] = React.useState(revenueDataMock)
  const [pieData, setPieData] = React.useState(categoryDataMock)
  const [isMounted, setIsMounted] = React.useState(false)

  // Search box state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchFilter, setSearchFilter] = React.useState<'all' | 'invoice' | 'bill'>('all')
  const [searchResults, setSearchResults] = React.useState<any[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [isScanning, setIsScanning] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const handleSearch = React.useCallback(async (query: string, filter: 'all' | 'invoice' | 'bill') => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    const q = query.toLowerCase().trim()

    try {
      const results: any[] = []

      // 1. Invoices
      if ((filter === 'all' || filter === 'invoice') && supabase) {
        const [furnRes, woodRes] = await Promise.all([
          supabase.from('furniture_invoices').select('*, customer:customer_id(name, phone)').order('created_at', { ascending: false }).limit(30),
          supabase.from('wood_invoices').select('*, customer:customer_id(name, phone)').order('created_at', { ascending: false }).limit(30)
        ])

        const furnList = (furnRes.data || []).map(inv => ({
          type: 'Invoice',
          subType: 'Furniture Invoice',
          id: getDisplayInvoiceId(inv.id),
          rawId: inv.id,
          name: inv.customer_name || inv.customer?.name || 'Customer',
          phone: inv.customer?.phone || '',
          amount: Number(inv.total || 0),
          status: inv.status || (inv.due_amount <= 0 ? 'Paid' : inv.paid_amount > 0 ? 'Partial' : 'Due'),
          date: inv.created_at,
          link: `/invoice?type=Furniture&search=${encodeURIComponent(getDisplayInvoiceId(inv.id))}`
        }))

        const woodList = (woodRes.data || []).map(inv => ({
          type: 'Invoice',
          subType: 'Wood Invoice',
          id: getDisplayInvoiceId(inv.id),
          rawId: inv.id,
          name: inv.customer_name || inv.customer?.name || 'Customer',
          phone: inv.customer?.phone || '',
          amount: Number(inv.total || 0),
          status: inv.status || (inv.due_amount <= 0 ? 'Paid' : inv.paid_amount > 0 ? 'Partial' : 'Due'),
          date: inv.created_at,
          link: `/invoice?type=Wood&search=${encodeURIComponent(getDisplayInvoiceId(inv.id))}`
        }))

        results.push(...furnList, ...woodList)
      }

      // 2. Bills
      if ((filter === 'all' || filter === 'bill') && supabase) {
        const { data: billsData } = await supabase.from('bills').select('*').order('created_at', { ascending: false }).limit(30)
        if (billsData) {
          const billList = billsData.map(b => ({
            type: 'Bill',
            subType: b.category || 'Expense Bill',
            id: b.id || `BILL-${b.id}`,
            rawId: b.id,
            name: b.vendor || 'Vendor',
            phone: '',
            amount: Number(b.amount || 0),
            status: b.status || 'Paid',
            date: b.date || b.created_at,
            note: b.note || '',
            link: `/bills`
          }))
          results.push(...billList)
        }
      }

      // Fallback sample list to ensure instant response if tables are empty
      const mockItems = [
        { type: 'Invoice', subType: 'Furniture Invoice', id: '#INV-F-260801', name: 'Alice Johnson', phone: '01711000000', amount: 45000, status: 'Paid', date: '2026-08-11', link: '/invoice?type=Furniture&search=%23INV-F-260801' },
        { type: 'Invoice', subType: 'Wood Invoice', id: '#INV-W-260801', name: 'Bob Smith', phone: '01811000000', amount: 12500, status: 'Partial', date: '2026-08-10', link: '/invoice?type=Wood&search=%23INV-W-260801' },
        { type: 'Invoice', subType: 'Furniture Invoice', id: '#INV-F-260802', name: 'Charlie Brown', phone: '01911000000', amount: 32000, status: 'Due', date: '2026-08-09', link: '/invoice?type=Furniture&search=%23INV-F-260802' },
        { type: 'Bill', subType: 'Wood Purchase', id: 'BILL-001', name: 'Timber Supply Co.', phone: '', amount: 85000, status: 'Paid', date: '2026-08-11', note: 'Mahogany & Teak stock', link: '/bills' },
        { type: 'Bill', subType: 'Accessories', id: 'BILL-002', name: 'Hardware World', phone: '', amount: 12500, status: 'Pending', date: '2024-03-19', note: 'Hinges and handles', link: '/bills' },
        { type: 'Bill', subType: 'Utility', id: 'BILL-003', name: 'City Electric', phone: '', amount: 4500, status: 'Paid', date: '2024-03-15', note: 'Electricity bill', link: '/bills' }
      ]

      const combined = [...results, ...mockItems]
      const uniqueMap = new Map()
      combined.forEach(item => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item)
        }
      })

      const filtered = Array.from(uniqueMap.values()).filter(item => {
        const matchesType = filter === 'all' ||
          (filter === 'invoice' && item.type === 'Invoice') ||
          (filter === 'bill' && item.type === 'Bill')

        const matchesQuery = 
          String(item.id).toLowerCase().includes(q) ||
          String(item.name).toLowerCase().includes(q) ||
          String(item.phone || '').toLowerCase().includes(q) ||
          String(item.subType).toLowerCase().includes(q) ||
          String(item.amount).includes(q) ||
          String(item.status).toLowerCase().includes(q) ||
          String(item.note || '').toLowerCase().includes(q)

        return matchesType && matchesQuery
      })

      setSearchResults(filtered)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    handleSearch(value, searchFilter)
  }

  const onFilterChange = (filter: 'all' | 'invoice' | 'bill') => {
    setSearchFilter(filter)
    handleSearch(searchQuery, filter)
  }

  const fetchStats = React.useCallback(async () => {
    if (!supabase) {
      console.error('Supabase client is not initialized')
      return
    }

    try {
      // 1. Fetch Invoices for Sales and Due from both tables
      const [furnRes, woodRes] = await Promise.all([
        supabase.from('furniture_invoices').select('total, due_amount, paid_amount, created_at'),
        supabase.from('wood_invoices').select('total, due_amount, paid_amount, created_at')
      ])
      
      if (furnRes.error) {
        console.error('Error fetching furniture_invoices stats:', furnRes.error.message ? `${furnRes.error.message} (${furnRes.error.details || furnRes.error.code || ''})` : furnRes.error, furnRes.error)
      }
      if (woodRes.error) {
        console.error('Error fetching wood_invoices stats:', woodRes.error.message ? `${woodRes.error.message} (${woodRes.error.details || woodRes.error.code || ''})` : woodRes.error, woodRes.error)
      }

      const invoices = [...(furnRes.data || []), ...(woodRes.data || [])]

      // 2. Fetch Customers Count
      const { count: customerCount, error: custError } = await supabase
        .from('customer')
        .select('*', { count: 'exact', head: true })
      
      if (custError) {
        console.error('Error fetching customer count:', custError.message ? `${custError.message} (${custError.details || custError.code || ''})` : custError, custError)
      }

      // 3. Fetch Bills for Purchases (Expenses)
      const { data: bills, error: billError } = await supabase
        .from('bills')
        .select('amount, created_at')
      
      if (billError) {
        console.error('Error fetching bills stats:', billError.message ? `${billError.message} (${billError.details || billError.code || ''})` : billError, billError)
      }
      
      // 4. Fetch Recent Invoices (fetching recent pool from both tables to ensure strictly sequential chronological order)
      const [furnLatestRes, woodLatestRes] = await Promise.all([
        supabase
          .from('furniture_invoices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('wood_invoices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
      ])

      if (furnLatestRes.error) {
        console.error('Error fetching recent furniture invoices:', furnLatestRes.error)
      }
      if (woodLatestRes.error) {
        console.error('Error fetching recent wood invoices:', woodLatestRes.error)
      }

      const parseInvoiceSerial = (idStr: string) => {
        const match = idStr.match(/\d+$/)
        return match ? parseInt(match[0], 10) : 0
      }

      const formatInvoiceNumber = (inv: any, defaultType: string) => {
        const rawId = inv.invoice_number || inv.id
        return getDisplayInvoiceId(rawId) || (inv.id ? `#INV-${defaultType[0]}-${String(inv.id).slice(-6)}` : `#INV-${defaultType[0]}-01`)
      }

      const combinedInvoices = [
        ...(furnLatestRes.data || []).map(inv => ({
          ...inv,
          type: 'Furniture',
          displayId: formatInvoiceNumber(inv, 'Furniture'),
          total: Number(inv.total || 0),
          paid: Number(inv.paid_amount || 0),
          due: Number(inv.due_amount || 0),
          status: inv.status || (Number(inv.due_amount || 0) <= 0 ? 'Paid' : Number(inv.paid_amount || 0) > 0 ? 'Partial' : 'Due')
        })),
        ...(woodLatestRes.data || []).map(inv => ({
          ...inv,
          type: 'Wood',
          displayId: formatInvoiceNumber(inv, 'Wood'),
          total: Number(inv.total || 0),
          paid: Number(inv.paid_amount || 0),
          due: Number(inv.due_amount || 0),
          status: inv.status || (Number(inv.due_amount || 0) <= 0 ? 'Paid' : Number(inv.paid_amount || 0) > 0 ? 'Partial' : 'Due')
        }))
      ]
        .sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
          if (timeB !== timeA) return timeB - timeA
          return parseInvoiceSerial(b.displayId) - parseInvoiceSerial(a.displayId)
        })
        .slice(0, 8)

      setRecentInvoices(combinedInvoices)

      // 5. Fetch Recent Transactions
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select(`*, customer:customer_id(name)`)
        .order('created_at', { ascending: false })
        .limit(8)
      
      if (txError) {
        console.error('Error fetching recent transactions:', txError.message ? `${txError.message} (${txError.details || txError.code || ''})` : txError, txError)
      } else if (txData) {
        setRecentTransactions(txData)
      }

      // Generate Real Revenue Data
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return {
          month: format(d, 'MMM'),
          monthId: format(d, 'yyyy-MM'),
          revenue: 0,
          profit: 0
        };
      });

      invoices.forEach(inv => {
        if (!inv.created_at) return;
        const invMonth = format(new Date(inv.created_at), 'yyyy-MM');
        const monthData = last6Months.find(m => m.monthId === invMonth);
        if (monthData) {
          monthData.revenue += Number(inv.total || 0);
          monthData.profit += Number(inv.paid_amount || 0); // Using paid_amount as proxy for positive cashflow/profit in chart
        }
      });
      setChartData(last6Months);

      // Generate Real Category Data
      // For a quick overview, let's fetch furniture and wood counts or totals
      const [furnInvRes, woodInvRes] = await Promise.all([
        supabase.from('furniture_inventory').select('category', { count: 'exact', head: true }),
        supabase.from('wood_inventory').select('category', { count: 'exact', head: true })
      ]);
      
      if (furnInvRes.error) {
        console.error('Error fetching furniture_inventory count:', furnInvRes.error.message || furnInvRes.error, furnInvRes.error)
      }
      if (woodInvRes.error) {
        console.error('Error fetching wood_inventory count:', woodInvRes.error.message || woodInvRes.error, woodInvRes.error)
      }

      const newCategoryData = [
        { name: 'Furniture', value: furnInvRes.count || 0, color: '#f59e0b' },
        { name: 'Wood', value: woodInvRes.count || 0, color: '#10b981' },
      ];
      setPieData(newCategoryData.filter(d => d.value > 0).length ? newCategoryData : categoryDataMock);

      const totalSales = invoices?.reduce((acc, current) => acc + Number(current.total || 0), 0) || 0
      const totalDue = invoices?.reduce((acc, current) => acc + Number(current.due_amount || 0), 0) || 0
      const totalPurchases = bills?.reduce((acc, current) => acc + Number(current.amount || 0), 0) || 0

      setLiveStats([
        { label: 'Total Sales', value: `৳${totalSales.toLocaleString()}`, change: '+0%', trend: 'up', icon: DollarSign, color: 'bg-[#fe9a11]' },
        { label: 'Total Purchases', value: `৳${totalPurchases.toLocaleString()}`, change: '+0%', trend: 'up', icon: ShoppingBag, color: 'bg-slate-800' },
        { label: 'Total Customers', value: (customerCount || 0).toLocaleString(), change: '+0%', trend: 'up', icon: Users, color: 'bg-indigo-500' },
        { label: 'Due Collection', value: `৳${totalDue.toLocaleString()}`, change: '+0%', trend: 'down', icon: AlertCircle, color: 'bg-rose-500' },
      ])
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error?.message ? `${error.message} (${error.details || error.code || ''})` : error, error)
    }
  }, [])

  React.useEffect(() => {
    setIsMounted(true)
    fetchStats()
    const interval = setInterval(fetchStats, 15000) // Update every 15 seconds
    return () => clearInterval(interval)
  }, [fetchStats])

  if (!isMounted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      </DashboardLayout>
    )
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-10 max-w-[1600px] mx-auto pb-10">
        {/* Top Header Actions: Add Customer Button & Search Box */}
        <div className="flex items-center justify-end gap-3 w-full">
          {/* Add New Customer Button (Visible only on Desktop lg+) */}
          <button
            type="button"
            id="btn-add-customer-dashboard"
            onClick={() => setIsAddCustomerOpen(true)}
            className="hidden lg:flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 -mt-[13px]"
            title="Add New Customer"
            aria-label="Add New Customer"
          >
            <UserPlus size={20} className="shrink-0" />
          </button>

          {/* Find Invoices & Bills Search Box */}
          <div className="relative space-y-4 w-full max-w-xl md:max-w-2xl">
          {/* Search Bar Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={onQueryChange}
              placeholder="Search invoice number (e.g. INV-2024-001), bill #, customer name, or vendor..."
              className="w-full pl-13 pr-28 sm:pr-36 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-medium text-sm md:text-base shadow-sm -mt-[13px]"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors -mt-[13px]"
                  title="Clear search"
                >
                  <X size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer -mt-[13px]"
                title="Scan QR / Barcode"
              >
                <Scan size={17} />
                <span className="font-semibold text-xs">Scan</span>
              </button>
            </div>
          </div>

          {/* Barcode & QR Camera Scanner Modal */}
          {isScanning && (
            <BarcodeScannerModal
              isOpen={isScanning}
              onClose={() => setIsScanning(false)}
              targetInputRef={searchInputRef}
              onScanResult={(scannedText) => {
                setSearchQuery(scannedText)
                handleSearch(scannedText, searchFilter)
              }}
            />
          )}

          {/* Search Results Display */}
          {searchQuery.trim() !== '' && (
            <div className="space-y-3 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                <span>Search Results ({searchResults.length})</span>
                {isSearching && <span className="text-amber-500 animate-pulse">Searching...</span>}
              </div>

              {searchResults.length === 0 && !isSearching ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/50">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">No matching invoices or bills found</p>
                  <p className="text-slate-400 text-xs mt-1">Try searching for a different invoice number, bill #, or name</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {searchResults.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        const searchParam = encodeURIComponent(item.id)
                        const isWood = item.subType === 'Wood Invoice' || item.type === 'Wood' || item.subType?.toLowerCase().includes('wood')
                        const typeParam = isWood ? 'Wood' : item.type === 'Invoice' ? 'Furniture' : ''
                        const link = typeParam ? `/invoice?type=${typeParam}&search=${searchParam}` : (item.link || `/invoice?search=${searchParam}`)
                        router.push(link)
                      }}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/60 dark:hover:border-amber-500/60 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs",
                          item.type === 'Invoice'
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                        )}>
                          {item.type === 'Invoice' ? <FileText size={20} /> : <Receipt size={20} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                              {item.id}
                            </span>
                            <span className={cn(
                              "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0",
                              item.type === 'Invoice'
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            )}>
                              {item.subType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                            {item.name} {item.phone ? `• ${item.phone}` : ''} {item.note ? `• ${item.note}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          ৳{Number(item.amount).toLocaleString()}
                        </p>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                            item.status === 'Paid' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                            item.status === 'Partial' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                            "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                          )}>
                            {item.status}
                          </span>
                          <ExternalLink size={14} className="text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add New Customer Modal */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onAdd={async (customer) => {
          try {
            const dbData = {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
              address: customer.address,
              type: customer.type,
              total_due: customer.initialBalance || 0,
              total_orders: 0,
              last_purchase: null,
              photo: customer.photo
            }

            const { error } = await supabase.from('customer').upsert(dbData)
            if (error) throw error
            toast.success('Customer created successfully')
            fetchStats()
          } catch (error: any) {
            console.error('Error saving customer:', error)
            toast.error('Failed to save customer: ' + (error?.message || 'Unknown error'))
          }
        }}
      />

        {/* Compact Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 h-auto lg:h-[62.5px] -mt-[20px] lg:mt-0 mb-4 lg:mb-[32px] pt-1 lg:pt-[8px]">
          {liveStats.map((stat, idx) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all flex items-center justify-between gap-3 group my-0 lg:-mt-[15px] lg:mb-[15px]"
            >
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                    {maskValue(stat.label, stat.value)}
                  </h3>
                </div>
              </div>

              <div className={cn(
                stat.color, 
                "w-10 h-10 rounded-xl text-white shrink-0 flex items-center justify-center shadow-md shadow-slate-200 dark:shadow-none group-hover:scale-105 transition-transform duration-300"
              )}>
                <stat.icon size={20} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Top Row: Inventory Stock Distribution (Left) & Upcoming Deliveries (Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Inventory Stock Distribution Donut Widget (Left Column) */}
          <InventoryStockWidget />

          {/* Upcoming Product Deliveries Widget (Right Column) */}
          <UpcomingDeliveriesWidget />
        </div>

        {/* Dedicated Bottom Activity Section: Recent Invoices (Left) & Recent Transactions (Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Recent Invoices Section (Left Column) */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50">Recent Invoices</h3>
              </div>
              <button 
                onClick={() => router.push('/invoice')}
                className="text-xs font-bold text-amber-500 hover:text-amber-600 uppercase tracking-wider flex items-center gap-1 group cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            
            {recentInvoices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No recent invoices found.</p>
              </div>
            ) : (
              <div className="space-y-2.5 flex-1">
                {recentInvoices.map((inv) => (
                  <div 
                    key={`${inv.type}-${inv.id}`} 
                    onClick={() => router.push(`/invoice?type=${inv.type}&search=${encodeURIComponent(inv.displayId)}`)}
                    className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs transition-transform group-hover:scale-105",
                        inv.type === 'Wood' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                      )}>
                        {inv.type === 'Wood' ? 'W' : 'F'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tracking-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {inv.displayId}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            inv.status === 'Paid' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                              : inv.status === 'Partial'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          )}>
                            {inv.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px] sm:max-w-[160px]">
                            {inv.customer_name || 'Walk-in Customer'}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span>
                            {inv.created_at ? format(new Date(inv.created_at), 'MMM dd') : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        ৳{Number(inv.total || 0).toLocaleString()}
                      </p>
                      {Number(inv.due || 0) > 0 ? (
                        <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 mt-0.5">
                          Due: ৳{Number(inv.due).toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Paid in Full
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions Bento (Right Column) */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50">Recent Transactions</h3>
              </div>
              <button 
                onClick={() => router.push('/transactions')}
                className="text-xs font-bold text-amber-500 hover:text-amber-600 uppercase tracking-wider flex items-center gap-1 group cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            
            {recentTransactions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                <CreditCard className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">No recent transactions found.</p>
              </div>
            ) : (
              <div className="space-y-2.5 flex-1">
                {recentTransactions.map((tx) => {
                  const isInvoice = String(tx.type || '').toLowerCase() === 'invoice'
                  const displayInvoiceId = tx.ref 
                    ? getDisplayInvoiceId(tx.ref) 
                    : (tx.invoice_id ? getDisplayInvoiceId(tx.invoice_id) : '')

                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => {
                        if (isInvoice && displayInvoiceId) {
                          router.push(`/invoice?search=${encodeURIComponent(displayInvoiceId)}`)
                        } else {
                          router.push('/transactions')
                        }
                      }}
                      className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                          tx.type === 'Payment' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                        )}>
                          {tx.type === 'Payment' ? <DollarSign size={18} /> : <Receipt size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {tx.customer?.name || 'Walk-in Customer'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                {tx.type}
                              </span>
                              {displayInvoiceId && (
                                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                  {displayInvoiceId}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-xs text-slate-500">
                              {tx.created_at || tx.date ? format(new Date(tx.created_at || tx.date), 'MMM dd') : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <p className={cn(
                          "text-sm font-bold",
                          tx.credit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"
                        )}>
                          {tx.credit > 0 ? '+' : ''}৳{(tx.credit > 0 ? tx.credit : tx.debit).toLocaleString()}
                        </p>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                          Bal: ৳{Number(tx.balance || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}


export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <DashboardContent />
    </Suspense>
  )
}
