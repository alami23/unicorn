'use client'

import React, { useState, useEffect, Suspense, useMemo } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Plus, Receipt, Calendar, User, Tag, MoreHorizontal, Eye, Edit2, Trash2, Filter, ChevronDown, Check, X, CreditCard, DollarSign } from 'lucide-react'
import { cn, safeParse, parseDateSafe } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Bill {
  id: string;
  vendor: string;
  category: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending';
  note: string;
  createdAt: string;
}

const initialBills: Bill[] = [
  { id: 'BILL-001', vendor: 'Timber Supply Co.', category: 'Wood Purchase', amount: 85000, date: '2024-03-20', status: 'Paid', note: 'Mahogany & Teak stock', createdAt: new Date().toISOString() },
  { id: 'BILL-002', vendor: 'Hardware World', category: 'Accessories', amount: 12500, date: '2024-03-19', status: 'Pending', note: 'Hinges and handles', createdAt: new Date().toISOString() },
  { id: 'BILL-003', vendor: 'City Electric', category: 'Utility', amount: 4500, date: '2024-03-15', status: 'Paid', note: 'Workshop electricity', createdAt: new Date().toISOString() },
  { id: 'BILL-004', vendor: 'Workshop Rent', category: 'Rent', amount: 25000, date: '2024-03-01', status: 'Paid', note: 'March 2024 rent', createdAt: new Date().toISOString() },
]

const expenseCategories = ['Wood Purchase', 'Accessories', 'Utility', 'Rent', 'Wages', 'Transport', 'Marketing', 'Maintenance', 'Other']

function BillsContent() {
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [billToDelete, setBillToDelete] = useState<string | null>(null)

  const [newBill, setNewBill] = useState<Omit<Bill, 'id' | 'createdAt'>>({
    vendor: '',
    category: 'Other',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    status: 'Pending',
    note: ''
  })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const fetchBills = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      if (data) {
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
      }
    } catch (error) {
      console.error('Error fetching bills:', error)
      toast.error('Failed to load bills')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isMounted) {
      fetchBills()
    }
  }, [isMounted, fetchBills])

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesSearch = bill.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           bill.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || bill.category === selectedCategory
      const matchesStatus = selectedStatus === 'All' || bill.status === selectedStatus
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [bills, searchTerm, selectedCategory, selectedStatus])

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

  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill)
    setIsEditModalOpen(true)
  }

  const handleDeleteBill = (id: string) => {
    setBillToDelete(id)
    setIsDeleteModalOpen(true)
  }

  const handleAddBill = async () => {
    if (!newBill.vendor || newBill.amount <= 0) return;
    
    try {
      const id = `BILL-${Math.floor(100 + Math.random() * 900)}`;
      const billData = {
        id,
        vendor: newBill.vendor,
        category: newBill.category,
        amount: newBill.amount,
        date: newBill.date,
        status: newBill.status,
        note: newBill.note
      };
      
      const { error } = await supabase.from('bills').insert([billData])
      if (error) throw error
      
      toast.success('Bill added successfully')
      setIsAddModalOpen(false);
      setNewBill({
        vendor: '',
        category: 'Other',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'Pending',
        note: ''
      });
      fetchBills()
    } catch (error: any) {
      console.error('Error adding bill:', error)
      toast.error('Failed to add bill: ' + error.message)
    }
  };

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
  };

  const handleUpdateBill = async () => {
    if (!editingBill) return;
    try {
      const { error } = await supabase
        .from('bills')
        .update({
          vendor: editingBill.vendor,
          category: editingBill.category,
          amount: editingBill.amount,
          date: editingBill.date,
          status: editingBill.status,
          note: editingBill.note
        })
        .eq('id', editingBill.id)
      
      if (error) throw error
      
      toast.success('Bill updated successfully')
      setIsEditModalOpen(false);
      setEditingBill(null);
      fetchBills()
    } catch (error: any) {
      console.error('Error updating bill:', error)
      toast.error('Failed to update bill')
    }
  };

  const confirmDelete = async () => {
    if (billToDelete) {
      try {
        const { error } = await supabase
          .from('bills')
          .delete()
          .eq('id', billToDelete)
        
        if (error) throw error
        
        toast.success('Bill deleted successfully')
        setIsDeleteModalOpen(false);
        setBillToDelete(null);
        fetchBills()
      } catch (error: any) {
        console.error('Error deleting bill:', error)
        toast.error('Failed to delete bill')
      }
    }
  };

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
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Bills & Expenses</h1>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-95"
          >
            <Plus size={18} /> Add New Bill
          </button>
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

        {/* Main Content Area */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search vendor or ID..." 
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
                {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
                {filteredBills.map((bill) => (
                  <tr key={`${bill.id}-desktop`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{bill.id}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1"><Calendar size={12} /> {bill.date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          <User size={16} />
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">{bill.vendor}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full w-fit">
                        <Tag size={12} /> {bill.category}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-display font-bold text-slate-900 dark:text-slate-100">৳{bill.amount.toLocaleString()}</td>
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
                          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                          <DropdownMenuItem onClick={() => handleDeleteBill(bill.id)} className="gap-2 text-rose-600 focus:text-rose-600">
                            <Trash2 size={14} /> Delete Bill
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View Card List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredBills.map((bill) => (
              <div key={`${bill.id}-mobile`} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <User size={20} />
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
                    <p className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 text-amber-600 dark:text-amber-400">৳{bill.amount.toLocaleString()}</p>
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
            ))}
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
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedStatus('All'); }}
                className="text-amber-600 dark:text-amber-400 text-sm font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
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
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 custom-scrollbar font-medium">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Vendor / Supplier Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text"
                          placeholder="e.g. Timber Supply Co."
                          value={isAddModalOpen ? newBill.vendor : editingBill?.vendor || ''}
                          onChange={(e) => isAddModalOpen 
                            ? setNewBill({ ...newBill, vendor: e.target.value })
                            : setEditingBill({ ...editingBill!, vendor: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Amount (৳)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={isAddModalOpen ? newBill.amount : editingBill?.amount || 0}
                          onChange={(e) => isAddModalOpen 
                            ? setNewBill({ ...newBill, amount: parseFloat(e.target.value) || 0 })
                            : setEditingBill({ ...editingBill!, amount: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-bold transition-all"
                        />
                      </div>
                    </div>

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
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-bold transition-all appearance-none"
                        >
                          {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                      </div>
                    </div>

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
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-bold transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                      <div className="flex gap-3">
                        {(['Pending', 'Paid'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => isAddModalOpen
                              ? setNewBill({ ...newBill, status: s })
                              : setEditingBill({ ...editingBill!, status: s })
                            }
                            className={cn(
                              "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all border",
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

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Notes (Optional)</label>
                      <textarea 
                        placeholder="Add any additional details here..."
                        rows={3}
                        value={isAddModalOpen ? newBill.note : editingBill?.note || ''}
                        onChange={(e) => isAddModalOpen 
                          ? setNewBill({ ...newBill, note: e.target.value })
                          : setEditingBill({ ...editingBill!, note: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                  <button 
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="flex-1 px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-95"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={isAddModalOpen ? handleAddBill : handleUpdateBill}
                    className="flex-1 px-6 py-3 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 disabled:opacity-50"
                    disabled={isAddModalOpen ? (!newBill.vendor || !newBill.amount) : (!editingBill?.vendor || !editingBill?.amount)}
                  >
                    {isAddModalOpen ? 'Create Bill Entry' : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation */}
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
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-3 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all rounded-xl active:scale-95"
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
