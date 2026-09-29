'use client'

import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Search, Plus, Receipt, Calendar, User, Tag, MoreHorizontal, 
  Edit2, Trash2, ChevronDown, Check, X, DollarSign,
  Building2, Phone, Mail, MapPin, ExternalLink, ArrowRight,
  UserPlus, FolderPlus
} from 'lucide-react'
import { cn, parseDateSafe } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Image from 'next/image'
import SaveVendorModal, { Vendor } from '@/components/SaveVendorModal'
import CategoryManagerModal from '@/components/CategoryManagerModal'

interface Bill {
  id: string
  vendor: string
  category: string
  amount: number
  date: string
  status: 'Paid' | 'Pending'
  note: string
  createdAt: string
}

const defaultInitialBills: Bill[] = []

const initialDemoVendors: Vendor[] = []

const initialExpenseCategories: string[] = []

function BillsContent() {
  const [bills, setBills] = useState<Bill[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<string[]>(initialExpenseCategories)
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // View tabs: 'bills' | 'vendors'
  const [activeTab, setActiveTab] = useState<'bills' | 'vendors'>('bills')

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')
  const [vendorSearch, setVendorSearch] = useState('')
  
  // Bill Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [billToDelete, setBillToDelete] = useState<string | null>(null)

  // Vendor Modals
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [isDeleteVendorModalOpen, setIsDeleteVendorModalOpen] = useState(false)
  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null)

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // New Bill State
  const [newBill, setNewBill] = useState<Omit<Bill, 'id' | 'createdAt'>>({
    vendor: '',
    category: 'Wood Purchase',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    note: ''
  })

  // Searchable Vendor Dropdown state
  const [isVendorSelectOpen, setIsVendorSelectOpen] = useState(false)
  const [vendorSelectSearch, setVendorSelectSearch] = useState('')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Fetch Vendors
  const fetchVendors = useCallback(async () => {
    try {
      let loadedVendors: Vendor[] = []

      // 1. Fetch from Supabase
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .order('name', { ascending: true })

        if (!error && data && data.length > 0) {
          loadedVendors = data.map(v => ({
            id: v.id,
            name: v.name,
            phone: v.phone || '',
            email: v.email || '',
            address: v.address || '',
            photo: v.photo || null,
            created_at: v.created_at
          }))
        }
      } catch (sbErr) {
        console.warn('Supabase fetch vendors error:', sbErr)
      }

      // 2. Fetch from LocalStorage as cache / fallback
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('app_saved_vendors')
          if (raw) {
            const localList: Vendor[] = JSON.parse(raw)
            if (localList && localList.length > 0) {
              const map = new Map<string, Vendor>()
              loadedVendors.forEach(v => map.set(v.id, v))
              localList.forEach(v => {
                if (!map.has(v.id)) {
                  map.set(v.id, v)
                }
              })
              loadedVendors = Array.from(map.values())
            }
          }
        } catch (e) {
          console.warn('LocalStorage vendors parse error:', e)
        }
      }

      // 3. Fallback to empty if still empty
      if (loadedVendors.length === 0) {
        setVendors([])
      } else {
        setVendors(loadedVendors)
      }
    } catch (err) {
      console.error('Error fetching vendors:', err)
    }
  }, [])

  // Fetch Bills
  const fetchBills = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      if (data && data.length > 0) {
        setBills(data.map(b => ({
          id: b.id,
          vendor: b.vendor,
          category: b.category,
          amount: Number(b.amount),
          date: b.date,
          status: b.status as 'Paid' | 'Pending',
          note: b.note || '',
          createdAt: b.created_at
        })))
      } else {
        setBills([])
      }
    } catch (error) {
      console.warn('Notice loading bills from Supabase:', error)
      setBills([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isMounted) {
      fetchBills()
      fetchVendors()
      
      // Load custom categories from localStorage
      const savedCategories = localStorage.getItem('app_expense_categories')
      if (savedCategories) {
        try {
          const parsed = JSON.parse(savedCategories)
          if (Array.isArray(parsed)) {
            setCategories(parsed)
          } else {
            setCategories([])
          }
        } catch (e) {
          console.error('Error parsing categories from localStorage', e)
          setCategories([])
        }
      } else {
        setCategories([])
      }
    }
  }, [isMounted, fetchBills, fetchVendors])

  const handleUpdateCategories = (updatedCategories: string[]) => {
    setCategories(updatedCategories)
    // Only save the custom ones back to localStorage
    const customOnes = updatedCategories.filter(c => !initialExpenseCategories.includes(c))
    localStorage.setItem('app_expense_categories', JSON.stringify(customOnes))
  }

  // Map of vendors for quick lookup by name
  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>()
    vendors.forEach(v => {
      map.set(v.name.toLowerCase().trim(), v)
    })
    return map
  }, [vendors])

  // Filtered bills
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesSearch = bill.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           bill.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || bill.category === selectedCategory
      const matchesStatus = selectedStatus === 'All' || bill.status === selectedStatus
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [bills, searchTerm, selectedCategory, selectedStatus])

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const q = vendorSearch.toLowerCase()
      return v.name.toLowerCase().includes(q) ||
             v.phone.toLowerCase().includes(q) ||
             v.email.toLowerCase().includes(q) ||
             v.address.toLowerCase().includes(q)
    })
  }, [vendors, vendorSearch])

  // Overall statistics
  const stats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    return {
      total: bills.reduce((acc, b) => acc + b.amount, 0),
      paid: bills.filter(b => b.status === 'Paid').reduce((acc, b) => acc + b.amount, 0),
      pending: bills.filter(b => b.status === 'Pending').reduce((acc, b) => acc + b.amount, 0),
      thisMonth: bills.filter(b => {
        const d = parseDateSafe(b.date)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      }).reduce((acc, b) => acc + b.amount, 0)
    }
  }, [bills])

  // Add bill handler
  const handleAddBill = async () => {
    if (!newBill.vendor || newBill.amount <= 0) {
      toast.error('Please specify a vendor and positive amount')
      return
    }
    
    try {
      const id = `BILL-${Math.floor(100 + Math.random() * 900)}`
      const billData = {
        id,
        vendor: newBill.vendor.trim(),
        category: newBill.category,
        amount: newBill.amount,
        date: newBill.date,
        status: newBill.status,
        note: newBill.note
      }
      
      const { error } = await supabase.from('bills').insert([billData])
      if (error) throw error
      
      toast.success('Bill recorded successfully')
      setIsAddModalOpen(false)
      setNewBill({
        vendor: '',
        category: 'Wood Purchase',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        note: ''
      })
      fetchBills()
    } catch (error: any) {
      console.error('Error adding bill:', error)
      toast.error('Failed to add bill: ' + (error.message || 'Unknown error'))
    }
  }

  // Update bill status handler
  const handleUpdateStatus = async (id: string, status: 'Paid' | 'Pending') => {
    try {
      const { error } = await supabase
        .from('bills')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error
      toast.success(`Bill marked as ${status}`)
      fetchBills()
    } catch (error: any) {
      console.error('Error updating bill status:', error)
      toast.error('Failed to update status')
    }
  }

  // Edit bill handler
  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill)
    setIsEditModalOpen(true)
  }

  const handleUpdateBill = async () => {
    if (!editingBill) return
    try {
      const { error } = await supabase
        .from('bills')
        .update({
          vendor: editingBill.vendor.trim(),
          category: editingBill.category,
          amount: editingBill.amount,
          date: editingBill.date,
          status: editingBill.status,
          note: editingBill.note
        })
        .eq('id', editingBill.id)
      
      if (error) throw error
      
      toast.success('Bill updated successfully')
      setIsEditModalOpen(false)
      setEditingBill(null)
      fetchBills()
    } catch (error: any) {
      console.error('Error updating bill:', error)
      toast.error('Failed to update bill')
    }
  }

  // Delete bill handler
  const handleDeleteBill = (id: string) => {
    setBillToDelete(id)
    setIsDeleteModalOpen(true)
  }

  const confirmDeleteBill = async () => {
    if (billToDelete) {
      try {
        const { error } = await supabase
          .from('bills')
          .delete()
          .eq('id', billToDelete)
        
        if (error) throw error
        
        toast.success('Bill deleted successfully')
        setIsDeleteModalOpen(false)
        setBillToDelete(null)
        fetchBills()
      } catch (error: any) {
        console.error('Error deleting bill:', error)
        toast.error('Failed to delete bill')
      }
    }
  }

  // Delete Vendor handler
  const confirmDeleteVendor = async () => {
    if (!vendorToDelete) return
    try {
      try {
        await supabase
          .from('vendors')
          .delete()
          .eq('id', vendorToDelete.id)
      } catch (err) {
        console.warn('Supabase vendor delete notice:', err)
      }

      const updated = vendors.filter(v => v.id !== vendorToDelete.id)
      setVendors(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_saved_vendors', JSON.stringify(updated))
      }
      toast.success(`Vendor "${vendorToDelete.name}" deleted`)
      setIsDeleteVendorModalOpen(false)
      setVendorToDelete(null)
    } catch (err: any) {
      toast.error('Failed to delete vendor: ' + (err.message || 'Unknown error'))
    }
  }

  // Callback when vendor is saved in the modal
  const handleVendorSaved = (savedVendor: Vendor) => {
    // If the add bill modal is currently open, auto-select this vendor
    if (isAddModalOpen) {
      setNewBill(prev => ({ ...prev, vendor: savedVendor.name }))
    } else if (isEditModalOpen && editingBill) {
      setEditingBill(prev => prev ? ({ ...prev, vendor: savedVendor.name }) : null)
    }

    fetchVendors()
  }

  if (!isMounted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Title and Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
              Bills & Vendors
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage expenses, suppliers, and vendor profiles in one place
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Category Manager Button */}
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FolderPlus size={16} className="text-indigo-600" />
              <span>Category Manager</span>
            </button>

            {/* Save Vendor Button (Icon Style) */}
            <button
              type="button"
              onClick={() => {
                setEditingVendor(null)
                setIsVendorModalOpen(true)
              }}
              className="p-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Add New Vendor"
            >
              <UserPlus size={20} className="text-amber-600" />
            </button>

            {/* Add Bill Button */}
            <button 
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-95 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add New Bill</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Expenses', value: stats.total, color: 'text-slate-900 dark:text-white', bg: 'bg-slate-50 dark:bg-slate-800' },
            { label: 'Paid Bills', value: stats.paid, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Pending Bills', value: stats.pending, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'This Month', value: stats.thisMonth, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          ].map((stat) => (
            <div key={stat.label} className={cn("p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm", stat.bg)}>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
              <h3 className={cn("text-lg sm:text-xl font-display font-bold truncate", stat.color)}>৳{stat.value.toLocaleString()}</h3>
            </div>
          ))}
        </div>

        {/* Tab Switcher: Bills vs Vendors */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('bills')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer",
                activeTab === 'bills'
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Receipt size={16} />
              <span>Bills & Expenses</span>
              <span className={cn(
                "px-2 py-0.5 text-xs rounded-full",
                activeTab === 'bills' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              )}>
                {bills.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vendors')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer",
                activeTab === 'vendors'
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Building2 size={16} />
              <span>Saved Vendors</span>
              <span className={cn(
                "px-2 py-0.5 text-xs rounded-full",
                activeTab === 'vendors' ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              )}>
                {vendors.length}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: Bills & Expenses */}
        {activeTab === 'bills' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Filters Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search vendor or Bill ID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="All">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4">Bill Details</th>
                    <th className="px-6 py-4">Vendor</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredBills.map((bill) => {
                    const matchedVendor = vendorMap.get(bill.vendor.toLowerCase().trim())
                    return (
                      <tr key={`${bill.id}-desktop`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{bill.id}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1"><Calendar size={12} /> {bill.date}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {/* Vendor Photo / Avatar */}
                            <div className="relative w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden border border-slate-200 dark:border-slate-700/70 group-hover:border-amber-400/50 transition-colors shrink-0">
                              {matchedVendor?.photo ? (
                                <Image
                                  src={matchedVendor.photo}
                                  alt={bill.vendor}
                                  fill
                                  className="object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <Building2 size={16} className="text-slate-400 group-hover:text-amber-600 transition-colors" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{bill.vendor}</span>
                                {matchedVendor && (
                                  <span className="text-[10px] px-1.5 py-0.2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded font-semibold">
                                    Saved
                                  </span>
                                )}
                              </div>
                              {matchedVendor?.phone && (
                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Phone size={10} /> {matchedVendor.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full w-fit">
                            <Tag size={12} /> {bill.category}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-display font-bold text-slate-900 dark:text-slate-100">
                          ৳{bill.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            bill.status === 'Paid' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          )}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all outline-none">
                                <MoreHorizontal size={18} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 p-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl">
                              <DropdownMenuItem onClick={() => handleUpdateStatus(bill.id, bill.status === 'Paid' ? 'Pending' : 'Paid')} className="gap-2">
                                <Check size={14} className="text-emerald-500" /> Mark as {bill.status === 'Paid' ? 'Pending' : 'Paid'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditBill(bill)} className="gap-2">
                                <Edit2 size={14} className="text-amber-500" /> Edit Bill
                              </DropdownMenuItem>
                              {matchedVendor && (
                                <DropdownMenuItem onClick={() => {
                                  setEditingVendor(matchedVendor)
                                  setIsVendorModalOpen(true)
                                }} className="gap-2">
                                  <Building2 size={14} className="text-indigo-500" /> View/Edit Vendor
                                </DropdownMenuItem>
                              )}
                              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                              <DropdownMenuItem onClick={() => handleDeleteBill(bill.id)} className="gap-2 text-rose-600 focus:text-rose-600">
                                <Trash2 size={14} /> Delete Bill
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View Card List */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredBills.map((bill) => {
                const matchedVendor = vendorMap.get(bill.vendor.toLowerCase().trim())
                return (
                  <div key={`${bill.id}-mobile`} className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                          {matchedVendor?.photo ? (
                            <Image
                              src={matchedVendor.photo}
                              alt={bill.vendor}
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Building2 size={20} />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{bill.vendor}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{bill.id} • {bill.date}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 -mr-2 text-slate-400">
                            <MoreHorizontal size={20} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleUpdateStatus(bill.id, bill.status === 'Paid' ? 'Pending' : 'Paid')}>
                            Mark as {bill.status === 'Paid' ? 'Pending' : 'Paid'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditBill(bill)}>Edit Bill</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteBill(bill.id)} className="text-rose-600">Delete Bill</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Amount</p>
                        <p className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 text-amber-600 dark:text-amber-400">
                          ৳{bill.amount.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right space-y-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          bill.status === 'Paid' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        )}>
                          {bill.status}
                        </span>
                        <div className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full mt-1">
                          {bill.category}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredBills.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-slate-500 dark:text-slate-400 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <Search size={32} className="text-slate-300" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">No bills found</p>
                  <p className="text-sm max-w-xs mx-auto">Try adjusting your filters or search terms.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedStatus('All'); }}
                  className="text-amber-600 dark:text-amber-400 text-sm font-bold hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Saved Vendors Directory */}
        {activeTab === 'vendors' && (
          <div className="space-y-4">
            {/* Vendor search & Quick Add */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search vendors by name, phone, email, address..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingVendor(null)
                  setIsVendorModalOpen(true)
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Plus size={16} />
                <span>Save New Vendor</span>
              </button>
            </div>

            {/* Vendor Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVendors.map((vendor) => {
                const vendorBills = bills.filter(b => b.vendor.toLowerCase().trim() === vendor.name.toLowerCase().trim())
                const totalSpent = vendorBills.reduce((acc, b) => acc + b.amount, 0)

                return (
                  <div
                    key={vendor.id}
                    className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-400/50 dark:hover:border-amber-600/50 transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Logo & Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center overflow-hidden shrink-0">
                            {vendor.photo ? (
                              <Image
                                src={vendor.photo}
                                alt={vendor.name}
                                fill
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Building2 size={24} className="text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                              {vendor.name}
                            </h3>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {vendor.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVendor(vendor)
                              setIsVendorModalOpen(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Vendor"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVendorToDelete(vendor)
                              setIsDeleteVendorModalOpen(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                            title="Delete Vendor"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        {vendor.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-slate-400 shrink-0" />
                            <a href={`tel:${vendor.phone}`} className="hover:underline font-medium">
                              {vendor.phone}
                            </a>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={13} className="text-slate-400 shrink-0" />
                            <a href={`mailto:${vendor.email}`} className="hover:underline font-medium truncate">
                              {vendor.email}
                            </a>
                          </div>
                        )}
                        {vendor.address && (
                          <div className="flex items-start gap-2">
                            <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed">
                              {vendor.address}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Stats & Quick Bill */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Total Spent
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          ৳{totalSpent.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1">
                          ({vendorBills.length} bills)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setNewBill(prev => ({ ...prev, vendor: vendor.name }))
                          setIsAddModalOpen(true)
                        }}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                      >
                        <span>Bill Vendor</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredVendors.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-slate-500 dark:text-slate-400 space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center">
                  <Building2 size={32} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">No vendors found</p>
                  <p className="text-sm max-w-xs mx-auto mt-1">
                    Save vendor details including name, contact info, and logo for simplified billing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVendor(null)
                    setIsVendorModalOpen(true)
                  }}
                  className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 active:scale-95"
                >
                  Save First Vendor
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Bill Modal */}
        <AnimatePresence>
          {(isAddModalOpen || isEditModalOpen) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Receipt size={20} />
                    </div>
                    {isAddModalOpen ? 'Record New Bill' : 'Edit Bill Details'}
                  </h2>
                  <button 
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 custom-scrollbar font-medium">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Vendor / Supplier Name <span className="text-rose-500">*</span>
                      </label>
                      
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <div 
                            className="flex items-center w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 relative z-30 shadow-sm focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all"
                          >
                            <Building2 className="text-slate-400 dark:text-slate-500 mr-2 shrink-0" size={16} />
                            <input 
                              type="text"
                              placeholder="Search or Select Vendor..."
                              className="bg-transparent outline-none flex-1 text-sm w-full min-w-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-semibold"
                              value={isVendorSelectOpen ? vendorSelectSearch : (isAddModalOpen ? newBill.vendor : editingBill?.vendor || '')}
                              onChange={(e) => {
                                setVendorSelectSearch(e.target.value)
                                setIsVendorSelectOpen(true)
                                // If they are typing something that isn't a saved vendor yet, we still want to allow it
                                if (isAddModalOpen) {
                                  setNewBill({ ...newBill, vendor: e.target.value })
                                } else if (editingBill) {
                                  setEditingBill({ ...editingBill, vendor: e.target.value })
                                }
                              }}
                              onFocus={() => {
                                setIsVendorSelectOpen(true)
                                setVendorSelectSearch('')
                              }}
                            />
                            <button 
                              type="button"
                              onClick={() => setIsVendorSelectOpen(!isVendorSelectOpen)}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          {isVendorSelectOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsVendorSelectOpen(false)} />
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-1">
                                {vendors
                                  .filter(v => v.name.toLowerCase().includes(vendorSelectSearch.toLowerCase()) || v.phone.includes(vendorSelectSearch))
                                  .map(v => (
                                  <div 
                                    key={v.id}
                                    className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-800 dark:text-slate-200 transition-colors border-t border-slate-100 dark:border-slate-800/50 first:border-t-0 flex items-center gap-3"
                                    onClick={() => {
                                      if (isAddModalOpen) {
                                        setNewBill({ ...newBill, vendor: v.name })
                                      } else if (editingBill) {
                                        setEditingBill({ ...editingBill, vendor: v.name })
                                      }
                                      setIsVendorSelectOpen(false)
                                      setVendorSelectSearch('')
                                    }}
                                  >
                                    {v.photo ? (
                                      <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
                                        <Image src={v.photo} alt={v.name} fill className="object-cover" referrerPolicy="no-referrer" />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                                        {v.name.charAt(0)}
                                      </div>
                                    )}
                                    <div className="flex flex-col">
                                      <span className="font-semibold">{v.name}</span>
                                      {v.phone && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{v.phone}</span>}
                                    </div>
                                  </div>
                                ))}
                                {vendors.filter(v => v.name.toLowerCase().includes(vendorSelectSearch.toLowerCase()) || v.phone.includes(vendorSelectSearch)).length === 0 && (
                                  <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                                    No vendors found. Type to add manually.
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVendor(null)
                            setIsVendorModalOpen(true)
                          }}
                          className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center justify-center shrink-0"
                          title="Save New Vendor"
                        >
                          <UserPlus size={18} />
                        </button>
                      </div>

                      {/* Selected Vendor Info Preview Card */}
                      {(() => {
                        const currentVendorName = isAddModalOpen ? newBill.vendor : editingBill?.vendor || ''
                        const matched = vendorMap.get(currentVendorName.toLowerCase().trim())
                        if (!matched) return null

                        return (
                          <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="relative w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 overflow-hidden flex items-center justify-center shrink-0">
                                {matched.photo ? (
                                  <Image src={matched.photo} alt={matched.name} fill className="object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Building2 size={16} className="text-amber-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-slate-200">{matched.name}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                                  {matched.phone ? `${matched.phone} • ` : ''}{matched.address || matched.email || 'Saved Vendor Profile'}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVendor(matched)
                                setIsVendorModalOpen(true)
                              }}
                              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline px-2 py-1"
                            >
                              Edit Info
                            </button>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Amount */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount (৳)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={isAddModalOpen ? (newBill.amount || '') : (editingBill?.amount || '')}
                          onChange={(e) => isAddModalOpen 
                            ? setNewBill({ ...newBill, amount: parseFloat(e.target.value) || 0 })
                            : setEditingBill({ ...editingBill!, amount: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-bold transition-all"
                        />
                      </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category</label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                          value={isAddModalOpen ? newBill.category : editingBill?.category || 'Other'}
                          onChange={(e) => isAddModalOpen 
                            ? setNewBill({ ...newBill, category: e.target.value })
                            : setEditingBill({ ...editingBill!, category: e.target.value })
                          }
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-bold transition-all appearance-none"
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      </div>
                    </div>

                    {/* Date */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date"
                          value={isAddModalOpen ? newBill.date : (editingBill?.date || '')}
                          onChange={(e) => isAddModalOpen 
                            ? setNewBill({ ...newBill, date: e.target.value })
                            : setEditingBill({ ...editingBill!, date: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-bold transition-all"
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                      <div className="flex gap-2">
                        {(['Pending', 'Paid'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => isAddModalOpen
                              ? setNewBill({ ...newBill, status: s })
                              : setEditingBill({ ...editingBill!, status: s })
                            }
                            className={cn(
                              "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                              (isAddModalOpen ? newBill.status === s : editingBill?.status === s)
                                ? s === 'Paid' 
                                  ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-500"
                                  : "bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-900/30 dark:border-amber-500"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Notes (Optional)</label>
                      <textarea 
                        placeholder="Add invoice reference, items purchased, or payment notes..."
                        rows={2}
                        value={isAddModalOpen ? newBill.note : editingBill?.note || ''}
                        onChange={(e) => isAddModalOpen 
                          ? setNewBill({ ...newBill, note: e.target.value })
                          : setEditingBill({ ...editingBill!, note: e.target.value })
                        }
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                  <button 
                    type="button"
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="flex-1 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-95"
                  >
                    Discard
                  </button>
                  <button 
                    type="button"
                    onClick={isAddModalOpen ? handleAddBill : handleUpdateBill}
                    className="flex-1 px-6 py-2.5 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 disabled:opacity-50"
                    disabled={isAddModalOpen ? (!newBill.vendor || !newBill.amount) : (!editingBill?.vendor || !editingBill?.amount)}
                  >
                    {isAddModalOpen ? 'Create Bill Entry' : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Save Vendor Modal (Covers Name, Address, Phone, Email, Photo/Logo) */}
        <SaveVendorModal
          isOpen={isVendorModalOpen}
          onClose={() => {
            setIsVendorModalOpen(false)
            setEditingVendor(null)
          }}
          onSave={handleVendorSaved}
          initialData={editingVendor}
        />

        {/* Category Manager Modal */}
        <CategoryManagerModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          categories={categories}
          initialCategories={initialExpenseCategories}
          onUpdate={handleUpdateCategories}
        />

        {/* Delete Bill Confirmation Modal */}
        <AnimatePresence>
          {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 text-center"
              >
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">Delete Bill Entry</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Are you sure you want to permanently delete this bill? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={confirmDeleteBill}
                    className="flex-1 px-6 py-2.5 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all rounded-xl active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Vendor Confirmation Modal */}
        <AnimatePresence>
          {isDeleteVendorModalOpen && vendorToDelete && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteVendorModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 text-center"
              >
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">
                  Delete Vendor Profile
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                  Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">&ldquo;{vendorToDelete.name}&rdquo;</span>? Existing bills with this vendor name will remain intact.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDeleteVendorModalOpen(false)}
                    className="flex-1 px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteVendor}
                    className="flex-1 px-5 py-2.5 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all rounded-xl active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

export default function BillsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
    </div>}>
      <BillsContent />
    </Suspense>
  )
}
