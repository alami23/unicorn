'use client'

import React, { useState, useEffect, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Printer, Download, User, Calendar, ArrowUpRight, ArrowDownLeft, ChevronLeft, X, ChevronDown, Check } from 'lucide-react'
import { cn, safeParse } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getDisplayInvoiceId } from '@/lib/invoice'

interface Customer {
  id: string
  name: string
  phone: string
  address: string
  type: string
  totalOrders: number
  totalDue: number
  lastPurchase: string
  email?: string
  photo?: string | null
}

const transactions = [
  { id: 'TXN-101', date: '2024-03-20', type: 'Invoice', ref: 'INV-2024-001', debit: 45000, credit: 0, balance: 45000 },
  { id: 'TXN-102', date: '2024-03-20', type: 'Payment', ref: 'PAY-501', debit: 0, credit: 45000, balance: 0 },
  { id: 'TXN-103', date: '2024-03-15', type: 'Invoice', ref: 'INV-2024-012', debit: 12000, credit: 0, balance: 12000 },
  { id: 'TXN-104', date: '2024-03-10', type: 'Return', ref: 'RET-001', debit: 0, credit: 2000, balance: 10000 },
]

function CustomerStatementContent() {
  const searchParams = useSearchParams()
  const customerIdFromQuery = searchParams?.get('id') || null
  
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customerIdFromQuery)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentDateString, setCurrentDateString] = useState('')
  const [businessInfo, setBusinessInfo] = useState({
    name: 'Unicorn Furniture BD',
    logo: '',
    phone: '',
    secondaryPhone: '',
    email: '',
    address: ''
  })

  const fetchData = React.useCallback(async () => {
    setCurrentDateString(new Date().toLocaleDateString())
    const targetId = selectedCustomerId || customerIdFromQuery
    
    // Fetch all customers for the dropdown
    try {
      // Fetch business settings
      const { data: globalSettings } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .single()
      
      if (globalSettings?.settings) {
        const s = globalSettings.settings as any
        if (s.business) {
          setBusinessInfo({
            name: s.business.name || 'Unicorn Furniture BD',
            logo: s.business.logo || '',
            phone: s.business.phone || '',
            secondaryPhone: s.business.secondaryPhone || '',
            email: s.business.email || '',
            address: s.business.address || ''
          })
        }
      }

      const { data: allCustomers, error: cusError } = await supabase
        .from('customer')
        .select('*')
      
      if (cusError) throw cusError
      if (allCustomers) {
        setCustomers(allCustomers.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          type: c.type,
          photo: c.photo,
          totalDue: c.total_due,
          totalOrders: c.total_orders,
          lastPurchase: c.last_purchase
        })))
      }

      if (targetId) {
        // Fetch target customer
        const { data: found, error: foundError } = await supabase
          .from('customer')
          .select('*')
          .eq('id', targetId)
          .single()
        
        if (foundError) throw foundError
        if (found) {
          setCustomer({
            id: found.id,
            name: found.name,
            phone: found.phone,
            address: found.address,
            type: found.type,
            photo: found.photo,
            totalDue: found.total_due,
            totalOrders: found.total_orders,
            lastPurchase: found.last_purchase
          })

          // Fetch transactions for this customer
          let query = supabase
            .from('transactions')
            .select('*')
            .eq('customer_id', targetId)
            .order('date', { ascending: true })
          
          if (startDate) query = query.gte('date', startDate)
          if (endDate) query = query.lte('date', endDate)

          const { data: txns, error: txError } = await query
          if (txError) throw txError

          if (txns) {
            setCustomerTransactions(txns.map(t => ({
              id: t.id,
              date: t.date,
              type: t.type,
              ref: t.ref,
              debit: Number(t.debit || 0),
              credit: Number(t.credit || 0),
              balance: Number(t.balance || 0)
            })))
          }
        }
      } else {
        setCustomer(null)
        setCustomerTransactions([])
      }
    } catch (err: any) {
      console.error('Error fetching statement data:', err)
      // toast.error('Failed to load statement data') 
    }
  }, [selectedCustomerId, customerIdFromQuery, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  )

  const handlePrint = () => {
    try {
      window.print()
    } catch (e) {
      console.warn('Print not supported in this environment', e)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 print:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <Link href="/customer" className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <ChevronLeft size={20} />
            </Link>
            <div className="mt-0 -mb-[2px]">
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Customer Statement</h1>
            </div>
          </div>
          <div className="flex gap-3">
          </div>
        </div>

        {/* Customer Selector & Date Filter */}
        <div className="flex flex-col gap-3.5 bg-slate-50/60 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/85 shadow-sm print:hidden w-full lg:flex-row lg:items-center lg:gap-4 lg:p-3 lg:rounded-[2rem] -mt-[19px]">
          <div className="relative w-full lg:flex-1 lg:min-w-0">
            <div 
              className={cn(
                "flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-sm hover:border-amber-500/50",
                isDropdownOpen && "border-amber-500 ring-2 ring-amber-500/15"
              )} 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <Search className="ml-2 text-slate-400 dark:text-slate-500" size={18} />
              <input 
                type="text"
                placeholder="Search or select customer..."
                className="flex-1 bg-transparent border-none outline-none text-sm py-1 dark:text-slate-100 cursor-text placeholder-slate-400 dark:placeholder-slate-500 font-medium"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex items-center gap-1.5 pr-2">
                {customer && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCustomerId(null)
                      setSearchTerm('')
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
                <ChevronDown className={cn("text-slate-450 dark:text-slate-500 transition-transform duration-250", isDropdownOpen && "rotate-180")} size={18} />
              </div>
            </div>

            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-2.5 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-20 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar transition-all duration-200">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id)
                          setSearchTerm('')
                          setIsDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 border-b border-slate-50 dark:border-slate-800 last:border-none flex items-center justify-between group transition-colors",
                          selectedCustomerId === c.id && "bg-amber-50/40 dark:bg-amber-900/10"
                        )}
                      >
                        <div>
                          <p className={cn(
                            "font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors text-sm",
                            selectedCustomerId === c.id && "text-amber-600 dark:text-amber-500"
                          )}>{c.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{c.phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedCustomerId === c.id && <Check size={14} className="text-amber-600 dark:text-amber-500" />}
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">{c.id}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-5 text-center text-sm text-slate-500 italic">No customers found</div>
                  )}
                </div>
              </>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3 w-full lg:flex lg:flex-row lg:items-center lg:gap-3 lg:w-auto">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider pointer-events-none">From</span>
              <input 
                type="date"
                className="w-full lg:w-[145px] pl-12 pr-2.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] outline-none text-slate-600 dark:text-slate-300 focus:border-amber-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all font-semibold"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider pointer-events-none">To</span>
              <input 
                type="date"
                className="w-full lg:w-[145px] pl-9 pr-2.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] outline-none text-slate-600 dark:text-slate-300 focus:border-amber-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all font-semibold"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <button 
            onClick={handlePrint}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-3 lg:py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white dark:text-white rounded-2xl text-[14px] lg:text-[13px] font-bold shadow-md shadow-amber-600/10 hover:shadow-lg hover:shadow-amber-600/15 transition-all text-center whitespace-nowrap"
          >
            <Printer size={16} /> <span>Print Statement</span>
          </button>
        </div>

        {!customer ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700 mb-4">
              <User size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Select a Customer</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs">Search and select a customer above to view their detailed financial statement and ledger history.</p>
          </div>
        ) : (
          <>
            {/* Printed Header (Branding) */}
            <div className="hidden print:flex flex-row justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight leading-none uppercase">
                  {businessInfo.name}
                </h1>
                {businessInfo.address && (
                  <p className="text-slate-700 text-sm font-semibold max-w-sm">
                    {businessInfo.address}
                  </p>
                )}
                <div className="text-slate-600 text-xs font-semibold space-y-0.5">
                  {businessInfo.phone && <p>Phone: {businessInfo.phone} {businessInfo.secondaryPhone ? `/ ${businessInfo.secondaryPhone}` : ''}</p>}
                  {businessInfo.email && <p>Email: {businessInfo.email}</p>}
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="inline-block px-4 py-2 border border-slate-900 bg-slate-950 text-white font-black text-sm uppercase tracking-wider rounded-xl">
                  Customer Ledger Statement
                </div>
                <div className="text-xs font-bold text-slate-850 space-y-1">
                  <p>Statement Range: {startDate || 'All-Time'} {endDate ? `To ${endDate}` : ''}</p>
                  <p>Statement As Of: {currentDateString}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-8 items-center print:border-none print:shadow-none print:p-0 print:mb-8">
              <div className="flex items-center gap-4 flex-1">
                {customer.photo ? (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden relative shadow-lg shadow-amber-600/20 print:shadow-none">
                     <Image src={customer.photo} alt={customer.name} fill sizes="64px" className="object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-amber-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-amber-600/20 print:shadow-none">
                    {customer.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{customer.name}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Customer ID: {customer.id} • {customer.type} Member</p>
                  <div className="flex items-center gap-4 mt-2 print:hidden">
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Member since Jan 2023</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-8 print:border-l-0 print:border-t-0 print:pt-0 print:pl-0">
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Billed</p>
                  <p className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100">৳{customerTransactions.reduce((acc, t) => acc + t.debit, 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-base md:text-lg font-bold text-emerald-600 dark:text-emerald-400">৳{customerTransactions.reduce((acc, t) => acc + t.credit, 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Orders</p>
                  <p className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100">{customer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Current Due</p>
                  <p className="text-base md:text-lg font-bold text-rose-500 dark:text-rose-400">৳{customerTransactions.length > 0 ? customerTransactions[customerTransactions.length - 1].balance.toLocaleString() : '0'}</p>
                </div>
              </div>
            </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border-none print:shadow-none">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 print:bg-white print:border-b-2 print:border-slate-900">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Ledger Details</h3>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400 print:hidden" />
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Statement as of {currentDateString}</span>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block print:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider print:bg-white print:text-slate-900">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Description</th>
                      <th className="px-6 py-4 font-semibold">Reference</th>
                      <th className="px-6 py-4 font-semibold text-right">Bill</th>
                      <th className="px-6 py-4 font-semibold text-right">Receive</th>
                      <th className="px-6 py-4 font-semibold text-right">Due</th>
                      <th className="px-6 py-4 font-semibold text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                    {customerTransactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors print:hover:bg-transparent">
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{txn.date}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {txn.debit > 0 ? <ArrowUpRight size={14} className="text-rose-400 print:hidden" /> : <ArrowDownLeft size={14} className="text-emerald-400 print:hidden" />}
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{txn.type}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {txn.items?.map((item: any, i: number) => (
                                <span key={`item-${txn.id}-${i}`} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 print:bg-slate-50">
                                  {item.name || (item.treeNo ? `Tree: ${item.treeNo}` : 'Item')}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-amber-600 dark:text-amber-400 font-medium">{getDisplayInvoiceId(txn.ref)}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-slate-900 dark:text-slate-100">{txn.debit > 0 ? `৳${(txn.debit || 0).toLocaleString()}` : '-'}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">{txn.credit > 0 ? `৳${(txn.credit || 0).toLocaleString()}` : '-'}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-rose-500 dark:text-rose-400">{(txn.debit - txn.credit) > 0 ? `৳${(txn.debit - txn.credit).toLocaleString()}` : '-'}</td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-slate-900 dark:text-slate-100">৳{(txn.balance || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-900 dark:text-slate-100 print:bg-white">
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-right uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">Closing Balance</td>
                      <td className="px-6 py-4 text-right text-lg">৳{(customerTransactions.length > 0 ? customerTransactions[customerTransactions.length - 1].balance : 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden print:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {customerTransactions.map((txn) => (
                  <div key={txn.id} className="p-4 space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{txn.date}</span>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                          txn.type === 'Invoice' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      )}>{txn.type}</span>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{getDisplayInvoiceId(txn.ref)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-slate-500">Bill: {txn.debit > 0 ? `৳${(txn.debit || 0).toLocaleString()}` : '-'}</div>
                      <div className="text-slate-500 text-right">Receive: {txn.credit > 0 ? `৳${(txn.credit || 0).toLocaleString()}` : '-'}</div>
                      <div className="text-slate-500">Due: {(txn.debit - txn.credit) > 0 ? `৳${(txn.debit - txn.credit).toLocaleString()}` : '-'}</div>
                      <div className="font-bold text-slate-900 text-right">Balance: ৳{(txn.balance || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function CustomerStatementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <CustomerStatementContent />
    </Suspense>
  )
}
