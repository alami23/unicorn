'use client'

import React, { useState, useEffect, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Plus, UserPlus, Phone, MapPin, MoreVertical, Mail, MessageSquare, FileText, DollarSign, BellRing, RotateCw } from 'lucide-react'
import { cn, safeParse } from '@/lib/utils'
import { sendSMS } from '@/lib/sms'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getDisplayInvoiceId } from '@/lib/invoice'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

import AddCustomerModal from '@/components/AddCustomerModal'
import SendSMSModal from '@/components/SendSMSModal'
import SMSHistoryModal from '@/components/SMSHistoryModal'
import ReceivePaymentModal from '@/components/ReceivePaymentModal'
import PaymentRecordModal from '@/components/PaymentRecordModal'
import { Edit2, Trash2, History, ShoppingCart } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

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

const initialCustomers: Customer[] = [
  { id: 'CUS-001', name: 'Alice Johnson', phone: '01711223344', address: 'Dhanmondi, Dhaka', type: 'Regular', totalOrders: 5, totalDue: 1200, lastPurchase: '2024-03-20' },
  { id: 'CUS-002', name: 'Bob Smith', phone: '01822334455', address: 'Gulshan, Dhaka', type: 'Premium', totalOrders: 12, totalDue: 0, lastPurchase: '2024-03-25' },
  { id: 'CUS-003', name: 'Charlie Brown', phone: '01933445566', address: 'Uttara, Dhaka', type: 'Wholesale', totalOrders: 25, totalDue: 15000, lastPurchase: '2024-03-28' },
]

function CustomerPageContent() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isPaymentRecordModalOpen, setIsPaymentRecordModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [smsCustomer, setSmsCustomer] = useState<{ id?: string, name: string, phone: string, totalDue?: number, initialMessage?: string } | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)
  const [reminderCooldowns, setReminderCooldowns] = useState<Record<string, number>>({})

  // Cooldown timer interval: clean up or tick down active reminder cooldowns
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setReminderCooldowns(prev => {
        let hasActive = false
        const next: Record<string, number> = {}
        for (const [id, expiry] of Object.entries(prev)) {
          if (expiry > now) {
            next[id] = expiry
            hasActive = true
          }
        }
        return hasActive || Object.keys(prev).length > 0 ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const getRemainingCooldown = (cusId: string) => {
    const expiry = reminderCooldowns[cusId]
    if (!expiry) return 0
    const remaining = Math.ceil((expiry - Date.now()) / 1000)
    return remaining > 0 ? remaining : 0
  }
  
  const [customersList, setCustomersList] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('customer')
        .select('*')
        .order('name')

      if (error) throw error
      
      const [furnInvoices, woodInvoices] = await Promise.all([
        supabase.from('furniture_invoices').select('customer_name'),
        supabase.from('wood_invoices').select('customer_name')
      ])
      const invoicesData = [
        ...(furnInvoices.data || []),
        ...(woodInvoices.data || [])
      ]

      if (data) {
        // Map snake_case from DB to camelCase for UI
        const mappedCustomers = data.map(c => {
          const invoiceCount = invoicesData?.filter(inv => inv.customer_name === c.name).length || 0
          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address,
            type: c.type,
            totalOrders: Math.max(c.total_orders || 0, invoiceCount),
            totalDue: c.total_due,
            lastPurchase: c.last_purchase,
            email: c.email,
            photo: c.photo
          }
        })
        setCustomersList(mappedCustomers)
      }
    } catch (error: any) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCustomer = async (customer: Customer) => {
    try {
      const customerData = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        type: customer.type,
        total_orders: customer.totalOrders,
        total_due: customer.totalDue,
        last_purchase: customer.lastPurchase,
        email: customer.email,
        photo: customer.photo
      }

      if (editingCustomer) {
        const { error } = await supabase
          .from('customer')
          .update(customerData)
          .eq('id', customer.id)
        
        if (error) throw error
        toast.success('Customer updated successfully')
      } else {
        const { error } = await supabase
          .from('customer')
          .insert([customerData])
        
        if (error) throw error
        toast.success('Customer added successfully')
      }
      fetchCustomers()
      setEditingCustomer(null)
    } catch (error: any) {
      console.error('Error saving customer:', error)
      toast.error(error.message || 'Failed to save customer')
    }
  }

  const handleDeleteCustomer = async (id: string) => {
    setIsDeleting(true)
    try {
      // 1. To avoid foreign key constraints but preserve invoice data,
      // we nullify the customer_id in related tables while keeping the name
      
      // Update invoices
      await Promise.all([
        supabase
          .from('furniture_invoices')
          .update({ customer_id: null })
          .eq('customer_id', id),
        supabase
          .from('wood_invoices')
          .update({ customer_id: null })
          .eq('customer_id', id)
      ])
      
      // Update transactions
      await supabase
        .from('transactions')
        .update({ customer_id: null })
        .eq('customer_id', id)

      // 2. Now perform the actual deletion
      const { error } = await supabase
        .from('customer')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      toast.success('Customer deleted successfully')
      fetchCustomers()
      setIsDeleteModalOpen(false)
    } catch (error: any) {
      console.error('Failed to delete customer:', error)
      toast.error('Failed to delete customer: ' + error.message)
    } finally {
      setIsDeleting(false)
      setCustomerToDelete(null)
    }
  }

  const handleSendDueReminder = async (cus: Customer) => {
    if (!cus || sendingReminderId) return

    const remainingSecs = getRemainingCooldown(cus.id)
    if (remainingSecs > 0) {
      toast.info(`Please wait ${remainingSecs}s before sending another reminder to ${cus.name}.`)
      return
    }

    setSendingReminderId(cus.id)
    const toastId = toast.loading(`Fetching details & sending due reminder SMS to ${cus.name}...`)

    try {
      // 1. Fetch fresh customer data
      const { data: freshCus } = await supabase
        .from('customer')
        .select('*')
        .eq('id', cus.id)
        .maybeSingle()

      // 2. Fetch customer's invoices to calculate exact purchases, paid amount, and due
      const [furnRes, woodRes] = await Promise.all([
        supabase
          .from('furniture_invoices')
          .select('total, paid_amount, due_amount')
          .or(`customer_name.eq."${cus.name}",customer_id.eq."${cus.id}"`),
        supabase
          .from('wood_invoices')
          .select('total, paid_amount, due_amount')
          .or(`customer_name.eq."${cus.name}",customer_id.eq."${cus.id}"`)
      ])

      const allInvoices = [...(furnRes.data || []), ...(woodRes.data || [])]
      let totalBill = 0
      let totalPaid = 0
      let totalDue = freshCus?.total_due !== undefined ? Number(freshCus.total_due) : Number(cus.totalDue || 0)

      if (allInvoices.length > 0) {
        const invTotal = allInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
        const invPaid = allInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0)
        const invDue = allInvoices.reduce((sum, inv) => sum + Number(inv.due_amount || 0), 0)
        totalBill = invTotal
        totalPaid = invPaid
        if (invDue > 0) {
          totalDue = invDue
        }
      } else {
        totalDue = Number(freshCus?.total_due ?? cus.totalDue ?? 0)
        totalBill = totalDue
      }

      if (totalDue <= 0) {
        toast.dismiss(toastId)
        toast.info(`${cus.name} has no outstanding due.`)
        return
      }

      // 3. Resolve customer phone
      const phoneToSend = freshCus?.phone || cus.phone

      // 4. Resolve business name from app_settings
      let businessName = 'Store'
      try {
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('settings')
          .eq('id', 'global')
          .maybeSingle()
        
        const settings = settingsData?.settings as any
        let currentUserId = null
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem('custom_user')
            if (stored) currentUserId = JSON.parse(stored).id
          } catch (e) {}
        }
        businessName = (currentUserId && settings?.business_by_user?.[currentUserId]?.name) || settings?.business?.name || 'Store'
      } catch (e) {}

      // 5. Compose structured due reminder message with total bill, paid amount, and due
      const formattedDue = Math.round(totalDue).toLocaleString()
      const formattedTotal = totalBill > 0 ? Math.round(totalBill).toLocaleString() : null
      const formattedPaid = totalPaid > 0 ? Math.round(totalPaid).toLocaleString() : null

      let reminderMsg = ''
      if (formattedTotal && formattedPaid) {
        reminderMsg = `Dear ${cus.name}, this is a payment reminder from ${businessName}.\n• Total Purchases: ৳${formattedTotal}\n• Paid Amount: ৳${formattedPaid}\n• Outstanding Due: ৳${formattedDue}\nPlease clear your due amount at your earliest convenience. Thank you!`
      } else {
        reminderMsg = `Dear ${cus.name}, this is a payment reminder from ${businessName} regarding your outstanding due of ৳${formattedDue}.\nPlease clear it at your earliest convenience. Thank you!`
      }

      // 6. Check phone
      if (!phoneToSend || !phoneToSend.trim()) {
        toast.dismiss(toastId)
        toast.info(`No phone number found for ${cus.name}. Please enter a phone number.`)
        setSmsCustomer({
          id: cus.id,
          name: cus.name,
          phone: '',
          totalDue: totalDue,
          initialMessage: reminderMsg
        })
        setIsSMSModalOpen(true)
        return
      }

      // 7. Send SMS directly
      await sendSMS(phoneToSend.trim(), reminderMsg)

      // 8. Set 60-second anti-spam cooldown for this customer
      setReminderCooldowns(prev => ({
        ...prev,
        [cus.id]: Date.now() + 60000
      }))

      toast.dismiss(toastId)
      toast.success(`Due reminder SMS sent successfully to ${cus.name} (${phoneToSend})!`)
    } catch (e: any) {
      console.error('Error sending customer due reminder SMS:', e)
      toast.dismiss(toastId)
      toast.error(`Failed to send due reminder: ${e?.message || 'Error occurred'}`)
    } finally {
      setSendingReminderId(null)
    }
  }

  const [filterType, setFilterType] = useState('All')

  const filteredCustomers = customersList.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.phone.includes(searchQuery) ||
                          c.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'All' || c.type === filterType
    return matchesSearch && matchesType
  })

  const stats = [
    { label: 'Total Customers', value: customersList.length.toLocaleString(), color: 'bg-blue-500' },
    { label: 'All-Time Orders', value: customersList.reduce((acc, c) => acc + (c.totalOrders || 0), 0).toLocaleString(), color: 'bg-amber-500' },
    { label: 'Active Customers', value: customersList.filter(c => c.totalOrders > 0).length.toString(), color: 'bg-emerald-500' },
    { label: 'Total Due', value: `৳${customersList.reduce((acc, c) => acc + (c.totalDue || 0), 0).toLocaleString()}`, color: 'bg-rose-500' },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 -mb-[8px]">Customer</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</h3>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 w-full transition-all">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by name, phone or ID..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 outline-none"
              >
                <option value="All">All Types</option>
                <option value="Regular">Regular</option>
                <option value="Premium">Premium</option>
                <option value="Wholesale">Wholesale</option>
              </select>

              <button 
                onClick={() => {
                  setEditingCustomer(null)
                  setIsModalOpen(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
              >
                <UserPlus size={16} /> Add New Customer
              </button>
            </div>
          </div>
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Customer</th>
                  <th className="px-6 py-4 font-semibold">Contact</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Orders</th>
                  <th className="px-6 py-4 font-semibold">Balance</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCustomers.map((cus) => (
                  <tr key={cus.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {cus.photo ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden relative">
                            <Image src={cus.photo} alt={cus.name} fill sizes="40px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold">
                            {cus.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{cus.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{cus.id.slice(-6).toUpperCase()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1"><Phone size={12} /> {cus.phone}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 line-clamp-1"><MapPin size={12} /> {cus.address}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                        cus.type === 'Premium' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" :
                        cus.type === 'Wholesale' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {cus.type || 'Regular'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link 
                        href={`/invoice?customer=${encodeURIComponent(cus.name)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                      >
                        <ShoppingCart size={12} />
                        {cus.totalOrders || 0} Orders
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm font-bold",
                        (cus.totalDue || 0) > 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {(cus.totalDue || 0) > 0 ? `৳${cus.totalDue.toLocaleString()}` : 'No Due'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <div className="flex items-center justify-end gap-2">
                        <a 
                          href={cus.phone ? `tel:${cus.phone}` : undefined}
                          onClick={(e) => {
                            if (!cus.phone) {
                              e.preventDefault()
                              toast.error('No phone number available for this customer')
                            }
                          }}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            cus.phone 
                              ? "hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" 
                              : "opacity-40 cursor-not-allowed text-slate-300 dark:text-slate-600"
                          )}
                          title={cus.phone ? `Call ${cus.phone}` : "No phone number available"}
                          aria-label={`Call ${cus.name}`}
                        >
                          <Phone size={18} />
                        </a>
                        <Link 
                          href={`/customer-statement?id=${cus.id}`}
                          className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                          title="View Statement"
                        >
                          <FileText size={18} />
                        </Link>
                        <button 
                          onClick={() => {
                            setSmsCustomer({ id: cus.id, name: cus.name, phone: cus.phone, totalDue: cus.totalDue })
                            setIsPaymentModalOpen(true)
                          }}
                          className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          title="Receive Payment"
                        >
                          <DollarSign size={18} />
                        </button>
                        {Number(cus.totalDue || 0) > 0 && (
                          <button 
                            onClick={() => handleSendDueReminder(cus)}
                            disabled={sendingReminderId === cus.id || getRemainingCooldown(cus.id) > 0}
                            className={cn(
                              "p-2 rounded-lg transition-colors relative group",
                              getRemainingCooldown(cus.id) > 0
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-75"
                                : "hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-500 hover:text-rose-600 dark:text-rose-400"
                            )}
                            title={
                              getRemainingCooldown(cus.id) > 0
                                ? `Please wait ${getRemainingCooldown(cus.id)}s before sending another reminder`
                                : "Send Due Reminder SMS"
                            }
                          >
                            {sendingReminderId === cus.id ? (
                              <RotateCw size={18} className="animate-spin text-rose-500" />
                            ) : (
                              <div className="relative flex items-center justify-center">
                                <BellRing size={18} />
                                {getRemainingCooldown(cus.id) > 0 && (
                                  <span className="absolute -top-1.5 -right-2 text-[9px] font-bold bg-rose-500 text-white rounded-full px-1 min-w-[15px] h-[15px] flex items-center justify-center shadow-sm">
                                    {getRemainingCooldown(cus.id)}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 transition-colors">
                              <MoreVertical size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {Number(cus.totalDue || 0) > 0 && (
                              <DropdownMenuItem 
                                onClick={() => handleSendDueReminder(cus)}
                                disabled={sendingReminderId === cus.id || getRemainingCooldown(cus.id) > 0}
                                className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/20 cursor-pointer disabled:opacity-50 font-medium"
                              >
                                {sendingReminderId === cus.id ? (
                                  <RotateCw size={14} className="animate-spin text-rose-500" />
                                ) : (
                                  <BellRing size={14} />
                                )}
                                {getRemainingCooldown(cus.id) > 0
                                  ? `Due Reminder (${getRemainingCooldown(cus.id)}s)`
                                  : 'Due Reminder SMS'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => {
                                setEditingCustomer(cus)
                                setIsModalOpen(true)
                              }}
                              className="gap-2"
                            >
                              <Edit2 size={14} /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSmsCustomer({ id: cus.id, name: cus.name, phone: cus.phone, totalDue: cus.totalDue })
                                setIsPaymentRecordModalOpen(true)
                              }}
                              className="gap-2 text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-300 font-semibold"
                            >
                              <DollarSign size={14} /> Payment Record
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSmsCustomer({ id: cus.id, name: cus.name, phone: cus.phone })
                                setIsHistoryModalOpen(true)
                              }}
                              className="gap-2"
                            >
                              <History size={14} /> SMS History
                            </DropdownMenuItem>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                            <DropdownMenuItem 
                              onClick={() => {
                                setCustomerToDelete(cus.id)
                                setIsDeleteModalOpen(true)
                              }}
                              className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/20"
                            >
                              <Trash2 size={14} /> Delete Customer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      No customers found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {filteredCustomers.map((cus) => (
              <div key={cus.id} className="p-4 space-y-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-[14px]">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {cus.photo ? (
                      <div className="w-10 h-10 rounded-full overflow-hidden relative">
                        <Image src={cus.photo} alt={cus.name} fill sizes="40px" className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold">
                        {cus.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">{cus.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{cus.id.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                  <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                        cus.type === 'Premium' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" :
                        cus.type === 'Wholesale' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {cus.type || 'Regular'}
                    </span>
                </div>
                
                <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-col gap-1">
                  <span className="flex items-center gap-1"><Phone size={12} /> {cus.phone}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {cus.address}</span>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Link 
                      href={`/invoice?customer=${encodeURIComponent(cus.name)}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold hover:bg-amber-100 transition-colors"
                    >
                      <ShoppingCart size={10} />
                      {cus.totalOrders || 0} Orders
                    </Link>
                    <span className={cn(
                      "font-bold",
                      (cus.totalDue || 0) > 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {(cus.totalDue || 0) > 0 ? `Due: ৳${cus.totalDue.toLocaleString()}` : 'No Due'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <a 
                    href={cus.phone ? `tel:${cus.phone}` : undefined}
                    onClick={(e) => {
                      if (!cus.phone) {
                        e.preventDefault()
                        toast.error('No phone number available for this customer')
                      }
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      cus.phone 
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer" 
                        : "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                    )}
                    title={cus.phone ? `Call ${cus.phone}` : "No phone number available"}
                    aria-label={`Call ${cus.name}`}
                  >
                    <Phone size={16} />
                  </a>
                  <Link href={`/customer-statement?id=${cus.id}`} className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400" title="View Statement"><FileText size={16} /></Link>
                  <button onClick={() => { setSmsCustomer({ id: cus.id, name: cus.name, phone: cus.phone, totalDue: cus.totalDue }); setIsPaymentModalOpen(true) }} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400" title="Receive Payment"><DollarSign size={16} /></button>
                  {Number(cus.totalDue || 0) > 0 && (
                    <button 
                      onClick={() => handleSendDueReminder(cus)} 
                      disabled={sendingReminderId === cus.id || getRemainingCooldown(cus.id) > 0} 
                      className={cn(
                        "p-2 rounded-lg transition-colors relative",
                        getRemainingCooldown(cus.id) > 0 
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-75"
                          : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
                      )} 
                      title={
                        getRemainingCooldown(cus.id) > 0
                          ? `Please wait ${getRemainingCooldown(cus.id)}s before sending another reminder`
                          : "Send Due Reminder SMS"
                      }
                    >
                      {sendingReminderId === cus.id ? (
                        <RotateCw size={16} className="animate-spin text-rose-500" />
                      ) : (
                        <div className="relative flex items-center justify-center">
                          <BellRing size={16} />
                          {getRemainingCooldown(cus.id) > 0 && (
                            <span className="absolute -top-1.5 -right-2 text-[8px] font-bold bg-rose-500 text-white rounded-full px-1 min-w-[13px] h-[13px] flex items-center justify-center shadow-sm">
                              {getRemainingCooldown(cus.id)}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500">
                        <MoreVertical size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {Number(cus.totalDue || 0) > 0 && (
                        <DropdownMenuItem 
                          onClick={() => handleSendDueReminder(cus)}
                          disabled={sendingReminderId === cus.id || getRemainingCooldown(cus.id) > 0}
                          className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/20 cursor-pointer disabled:opacity-50 font-medium"
                        >
                          {sendingReminderId === cus.id ? (
                            <RotateCw size={14} className="animate-spin text-rose-500" />
                          ) : (
                            <BellRing size={14} />
                          )}
                          {getRemainingCooldown(cus.id) > 0
                            ? `Due Reminder (${getRemainingCooldown(cus.id)}s)`
                            : 'Due Reminder SMS'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => { setEditingCustomer(cus); setIsModalOpen(true) }} className="gap-2"><Edit2 size={14} /> Edit Profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSmsCustomer({ id: cus.id, name: cus.name, phone: cus.phone, totalDue: cus.totalDue }); setIsPaymentRecordModalOpen(true) }} className="gap-2 text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-300 font-semibold"><DollarSign size={14} /> Payment Record</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSmsCustomer({ id: cus.id, name: cus.name, phone: cus.phone }); setIsHistoryModalOpen(true) }} className="gap-2"><History size={14} /> SMS History</DropdownMenuItem>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"/>
                      <DropdownMenuItem onClick={() => { setCustomerToDelete(cus.id); setIsDeleteModalOpen(true) }} className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/20"><Trash2 size={14} /> Delete Customer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <AddCustomerModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false)
          setEditingCustomer(null)
        }} 
        onAdd={handleAddCustomer}
        initialData={editingCustomer}
      />

      <SendSMSModal 
        isOpen={isSMSModalOpen}
        onClose={() => {
          if (smsCustomer?.id) {
            setReminderCooldowns(prev => ({
              ...prev,
              [smsCustomer.id!]: Date.now() + 60000
            }))
          }
          setIsSMSModalOpen(false)
          setSmsCustomer(null)
        }}
        customerName={smsCustomer?.name || ''}
        customerPhone={smsCustomer?.phone || ''}
        initialMessage={smsCustomer?.initialMessage}
      />

      <SMSHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false)
          setSmsCustomer(null)
        }}
        customerName={smsCustomer?.name || ''}
        customerPhone={smsCustomer?.phone || ''}
      />

      <ReceivePaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false)
          setSmsCustomer(null)
        }}
        customerName={smsCustomer?.name || ''}
        customerPhone={smsCustomer?.phone || ''}
        totalDue={smsCustomer?.totalDue || 0}
        onPaymentReceived={async (payment) => {
          try {
            // 1. Load invoices for this customer that have due > 0 from Supabase
            const [furnRes, woodRes] = await Promise.all([
              supabase
                .from('furniture_invoices')
                .select('*')
                .eq('customer_name', smsCustomer?.name)
                .gt('due_amount', 0),
              supabase
                .from('wood_invoices')
                .select('*')
                .eq('customer_name', smsCustomer?.name)
                .gt('due_amount', 0)
            ])

            if (furnRes.error) throw furnRes.error
            if (woodRes.error) throw woodRes.error

            const invoices = [...(furnRes.data || []), ...(woodRes.data || [])].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )

            if (!invoices || invoices.length === 0) {
              toast.info('No outstanding invoices found for this customer.')
              return
            }
            
            let remainingPayment = payment.amount
            const affectedInvoiceIds: string[] = []

            // 3. Distribute payment
            for (const inv of invoices) {
              if (remainingPayment <= 0) break
              
              const amountToApply = Math.min(remainingPayment, inv.due_amount)
              const newPaid = Number(inv.paid_amount) + amountToApply
              const newDue = Math.max(0, Number(inv.subtotal) - newPaid) // Simplified, in real app consider delivery_charge and discount
              
              const isWood = inv.type?.toLowerCase() === 'wood' || 
                             inv.type?.toLowerCase() === 'solo_wood' || 
                             inv.id.includes('-W-')
              const invoiceTable = isWood ? 'wood_invoices' : 'furniture_invoices'

              const { error: updateError } = await supabase
                .from(invoiceTable)
                .update({
                  paid_amount: newPaid,
                  due_amount: newDue
                })
                .eq('id', inv.id)

              if (updateError) throw updateError
              
              remainingPayment -= amountToApply
              affectedInvoiceIds.push(inv.id)

              // Record the transaction
              await supabase.from('transactions').insert([{
                id: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                customer_id: inv.customer_id,
                date: payment.date || new Date().toISOString().split('T')[0],
                type: 'Payment',
                ref: inv.id,
                credit: amountToApply,
                balance: inv.due_amount - amountToApply,
                method: payment.method,
                notes: payment.notes || payment.method
              }])
            }

            // 4. Update customer total due
            const { data: currentCustomer } = await supabase
              .from('customer')
              .select('total_due')
              .eq('name', smsCustomer?.name)
              .single()

            if (currentCustomer) {
              await supabase
                .from('customer')
                .update({ total_due: Math.max(0, currentCustomer.total_due - payment.amount) })
                .eq('name', smsCustomer?.name)
            }

            toast.success('Payment received and applied successfully')
            fetchCustomers()

            // 6. Send SMS notification
            let businessName = ''
            try {
              const { data: settingsData } = await supabase
                .from('app_settings')
                .select('settings')
                .eq('id', 'global')
                .single()
              if (settingsData && settingsData.settings) {
                const settings = settingsData.settings as any
                let currentUserId = null;
                if (typeof window !== 'undefined') {
                  const stored = localStorage.getItem('custom_user');
                  if (stored) {
                    currentUserId = JSON.parse(stored).id;
                  }
                }
                businessName = (currentUserId && settings.business_by_user?.[currentUserId]?.name) || settings.business?.name || ''
              }
            } catch (err) {
              console.warn('Failed to fetch settings for customer SMS:', err)
            }
            
            const smsMessage = `Dear ${smsCustomer?.name}, we have received a payment of ৳${payment.amount.toLocaleString()} via ${payment.method}. This has been applied to your outstanding balance. Your current total due is ৳${Math.max(0, (smsCustomer?.totalDue || 0) - payment.amount).toLocaleString()}. Thank you! - ${businessName}`
            
            if (smsCustomer?.phone) {
              sendSMS(smsCustomer.phone, smsMessage)
                .catch(err => console.error('SMS failed:', err))
            }
          } catch (error: any) {
            console.error('Payment error:', error)
            toast.error(error.message || 'Failed to process payment')
          }
        }}
      />

      <PaymentRecordModal
        isOpen={isPaymentRecordModalOpen}
        onClose={() => {
          setIsPaymentRecordModalOpen(false)
          setSmsCustomer(null)
        }}
        customerName={smsCustomer?.name || ''}
        customerId={smsCustomer?.id}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
                  <Trash2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Customer?</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  Are you sure you want to delete this customer? This will not delete their invoices but they will be removed from the directory.
                </p>
              </div>
              <div className="grid grid-cols-2 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="px-6 py-4 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-r border-slate-100 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => customerToDelete && handleDeleteCustomer(customerToDelete)}
                  disabled={isDeleting}
                  className="px-6 py-4 text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                  ) : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}

export default function CustomerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <CustomerPageContent />
    </Suspense>
  )
}
