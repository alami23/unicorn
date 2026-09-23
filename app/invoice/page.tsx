'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  MoreHorizontal,
  Calendar,
  User,
  Plus,
  Trees,
  Armchair,
  FileText,
  ChevronDown,
  Edit,
  Trash2,
  Undo2,
  Send,
  X,
  DollarSign,
  RotateCw,
  BellRing,
  Truck,
  Undo,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendSMS } from '@/lib/sms'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { addNotification } from '@/lib/notifications'
import { getDisplayInvoiceId } from '@/lib/invoice'
import InvoiceModal from '@/components/InvoiceModal'
import CreateInvoiceModal from '@/components/CreateInvoiceModal'
import ReceivePaymentModal from '@/components/ReceivePaymentModal'
import SendSMSModal from '@/components/SendSMSModal'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Suspense } from 'react'
import { useInvoices } from '@/hooks/useInvoiceCache'
import { invalidateInvoiceCache, FormattedInvoice } from '@/lib/invoiceCache'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

import AlertPopup from '@/components/AlertPopup'
import EditInvoiceModal from '@/components/EditInvoiceModal'

function InvoicePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeFilterFromUrl = searchParams?.get('type')
  const customerFilter = searchParams?.get('customer')
  const searchParamQuery = searchParams?.get('search') || searchParams?.get('invoice') || searchParams?.get('q')

  // Active tab state: 'All' | 'Furniture' | 'Wood'
  const [activeTab, setActiveTab] = useState<'All' | 'Furniture' | 'Wood'>(() => {
    if (typeFilterFromUrl === 'Furniture') return 'Furniture'
    if (typeFilterFromUrl === 'Wood') return 'Wood'
    return 'All'
  })

  // Synchronize when URL changes externally (e.g. from sidebar navigation)
  useEffect(() => {
    if (typeFilterFromUrl === 'Furniture') {
      setActiveTab('Furniture')
    } else if (typeFilterFromUrl === 'Wood') {
      setActiveTab('Wood')
    } else if (!typeFilterFromUrl) {
      setActiveTab('All')
    }
  }, [typeFilterFromUrl])

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input so typing does not stutter, while tab switches remain 0ms instant
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All')
  const [selectedDateRange, setSelectedDateRange] = useState('All time')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Sync search from URL
  useEffect(() => {
    if (customerFilter) {
      setSearchTerm(customerFilter)
    } else if (searchParamQuery) {
      setSearchTerm(searchParamQuery)
    }
  }, [customerFilter, searchParamQuery])

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isReceivePaymentModalOpen, setIsReceivePaymentModalOpen] = useState(false)
  const [isDueReminderModalOpen, setIsDueReminderModalOpen] = useState(false)
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)
  const [reminderCooldowns, setReminderCooldowns] = useState<Record<string, number>>({})
  const [dueReminderData, setDueReminderData] = useState<{
    customerName: string
    customerPhone: string
    initialMessage: string
    invoiceId?: string
  } | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null)
  const [isFetchingItems, setIsFetchingItems] = useState(false)

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

  const getRemainingCooldown = (invId: string) => {
    const expiry = reminderCooldowns[invId]
    if (!expiry) return 0
    const remaining = Math.ceil((expiry - Date.now()) / 1000)
    return remaining > 0 ? remaining : 0
  }

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean
    message: string
    type: 'success' | 'error' | 'info'
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  })

  const [updatingDeliveryId, setUpdatingDeliveryId] = useState<string | null>(null)
  const [optimisticDeliveryStatuses, setOptimisticDeliveryStatuses] = useState<Record<string, 'Pending' | 'Delivered'>>({})

  // Listen to external delivery status change events for cross-widget synchronization
  useEffect(() => {
    const handleDeliveryStatusChanged = (e: any) => {
      const detail = e?.detail
      if (detail?.id && detail?.status) {
        setOptimisticDeliveryStatuses(prev => ({
          ...prev,
          [detail.id]: detail.status
        }))
      }
    }
    window.addEventListener('delivery-status-changed', handleDeliveryStatusChanged)
    return () => window.removeEventListener('delivery-status-changed', handleDeliveryStatusChanged)
  }, [])

  // Dynamic toggle handler for delivery status (Mark Delivered / Unmark Delivered) with optimistic UI updates
  const handleToggleDeliveryStatus = async (inv: FormattedInvoice) => {
    if (!inv || updatingDeliveryId === inv.id) return

    const currentStatus = optimisticDeliveryStatuses[inv.id] ?? inv.deliveryStatus ?? 'Pending'
    const isCurrentlyDelivered = currentStatus === 'Delivered'
    const newStatus: 'Pending' | 'Delivered' = isCurrentlyDelivered ? 'Pending' : 'Delivered'
    const displayId = inv.displayId || getDisplayInvoiceId(inv.id)

    // 1. Instant optimistic UI update to avoid any jumping or reloading
    setOptimisticDeliveryStatuses(prev => ({
      ...prev,
      [inv.id]: newStatus,
      ...(displayId ? { [displayId]: newStatus } : {})
    }))

    // Notify other components (like UpcomingDeliveriesWidget) immediately without lag
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('delivery-status-changed', {
          detail: { id: inv.id, status: newStatus }
        })
      )
    }

    // Immediate toast feedback for instant user confirmation
    if (newStatus === 'Delivered') {
      toast.success(`Invoice #${displayId} marked as Delivered`, {
        description: inv.customer ? `Customer: ${inv.customer}` : 'Delivery status successfully updated',
        duration: 3500,
        position: 'top-center'
      })
    } else {
      toast.success(`Invoice #${displayId} delivery status reverted to Pending`, {
        duration: 3500,
        position: 'top-center'
      })
    }

    setUpdatingDeliveryId(inv.id)
    try {
      // 2. Persist update asynchronously to Supabase in background
      const updatePayload = { delivery_status: newStatus }
      const promises: Promise<any>[] = []

      if (inv.id && !String(inv.id).startsWith('loc-')) {
        promises.push(
          supabase
            .from('furniture_invoices')
            .update(updatePayload as any)
            .eq('id', inv.id)
        )
      }

      if (displayId) {
        promises.push(
          supabase
            .from('furniture_invoices')
            .update(updatePayload as any)
            .eq('invoice_number', displayId)
        )
      }

      const results = await Promise.all(promises)
      const errorResult = results.find(r => r?.error)
      if (errorResult?.error) throw errorResult.error
    } catch (err) {
      console.error('Failed to toggle delivery status in background:', err)
      // Roll back optimistic state on failure
      setOptimisticDeliveryStatuses(prev => {
        const next = { ...prev }
        delete next[inv.id]
        if (displayId) delete next[displayId]
        return next
      })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('delivery-status-changed', {
            detail: { id: inv.id, status: currentStatus }
          })
        )
      }

      toast.error(`Failed to update delivery status to ${newStatus}`)
    } finally {
      setUpdatingDeliveryId(null)
    }
  }

  // SWR-backed cached query params
  const queryParams = useMemo(() => ({
    type: activeTab,
    searchTerm: debouncedSearch,
    status: selectedStatusFilter,
    dateRange: selectedDateRange,
    startDate,
    endDate
  }), [activeTab, debouncedSearch, selectedStatusFilter, selectedDateRange, startDate, endDate])

  // Fetch using SWR cache - instant data return on tab transitions
  const {
    invoices,
    totalCount,
    hasMore,
    isLoading,
    isValidating,
    isLoadingMore,
    loadMore,
    refresh
  } = useInvoices(queryParams)

  // Apply optimistic delivery status overrides to invoices for instant, glitch-free UI updates
  const displayedInvoices = useMemo(() => {
    if (Object.keys(optimisticDeliveryStatuses).length === 0) return invoices
    return invoices.map(inv => {
      const override = optimisticDeliveryStatuses[inv.id] ?? (inv.displayId ? optimisticDeliveryStatuses[inv.displayId] : undefined)
      if (override !== undefined && inv.deliveryStatus !== override) {
        return {
          ...inv,
          deliveryStatus: override
        }
      }
      return inv
    })
  }, [invoices, optimisticDeliveryStatuses])

  // Infinite scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 120 >= document.documentElement.offsetHeight) {
        if (!isLoading && !isLoadingMore && hasMore) {
          loadMore()
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isLoading, isLoadingMore, hasMore, loadMore])

  // Instant tab switcher handler that avoids full page reload
  const handleTabChange = useCallback((tab: 'All' | 'Furniture' | 'Wood') => {
    setActiveTab(tab)
    const newUrl = tab === 'All' ? '/invoice' : `/invoice?type=${tab}`
    // Update browser URL without triggering Next.js full page reload
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', newUrl)
    }
  }, [])

  const handleOpenInvoice = async (invoice: any) => {
    setIsFetchingItems(true)
    try {
      const isWood = invoice.originalType?.toLowerCase() === 'wood' || 
                     invoice.originalType?.toLowerCase() === 'solo_wood' || 
                     invoice.type?.toLowerCase() === 'wood' || 
                     invoice.type?.toLowerCase() === 'solo_wood' ||
                     invoice.id.includes('-W-')
      const itemsTable = isWood ? 'wood_invoice_items' : 'furniture_invoice_items'

      const { data, error } = await supabase
        .from(itemsTable)
        .select('*')
        .eq('invoice_id', invoice.id)
      
      if (error) throw error
      
      const { data: paymentsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('ref', invoice.id)
        .gt('credit', 0)
        .order('id', { ascending: true })

      const payments: any[] = paymentsData?.map(t => ({
        date: t.date,
        method: t.notes || 'Cash',
        amount: Number(t.credit)
      })) || []

      const totalRecordedPayments = payments.reduce((sum, p) => sum + p.amount, 0)
      if (invoice.paid > totalRecordedPayments) {
        payments.unshift({
          date: invoice.date,
          method: invoice.paymentMethod || 'Cash',
          amount: invoice.paid - totalRecordedPayments
        })
      }

      payments.sort((a, b) => {
        const tA = new Date(a.date).getTime()
        const tB = new Date(b.date).getTime()
        return tA - tB
      })

      let oldDue = 0
      let customerDetails = null
      if (invoice.customer && invoice.customer !== 'Walk-in Customer') {
        const { data: customerData } = await supabase
          .from('customer')
          .select('total_due, phone, address')
          .eq('name', invoice.customer)
          .single()
        
        if (customerData) {
          customerDetails = customerData
          oldDue = Math.max(0, (customerData.total_due || 0) - (invoice.due || 0))
        }
      }

      setSelectedInvoice({ 
        ...invoice, 
        items: data || [], 
        oldDue, 
        payments,
        customerPhone: invoice.customerPhone || customerDetails?.phone,
        customerAddress: invoice.customerAddress || customerDetails?.address
      })
      setIsInvoiceModalOpen(true)
    } catch (error) {
      console.error('Error fetching invoice items:', error)
      toast.error('Failed to load invoice items')
      setSelectedInvoice({ ...invoice, items: [], oldDue: 0, payments: [] })
      setIsInvoiceModalOpen(true)
    } finally {
      setIsFetchingItems(false)
    }
  }

  // Automatically open invoice view if routed with open=true
  const hasAutoOpenedRef = React.useRef(false)
  useEffect(() => {
    if (hasAutoOpenedRef.current) return
    const shouldOpen = searchParams?.get('open') === 'true'
    if (shouldOpen && invoices && invoices.length > 0) {
      hasAutoOpenedRef.current = true
      handleOpenInvoice(invoices[0])
    }
  }, [invoices, searchParams])

  const handleOpenPayment = async (invoice: any) => {
    try {
      let customerDetails = null
      if (invoice.customer && invoice.customer !== 'Walk-in Customer') {
        const { data: customerData } = await supabase
          .from('customer')
          .select('total_due, phone, address')
          .eq('name', invoice.customer)
          .single()
        
        if (customerData) {
          customerDetails = customerData
        }
      }

      setSelectedInvoice({
        ...invoice,
        customerPhone: invoice.customerPhone || customerDetails?.phone,
        customerAddress: invoice.customerAddress || customerDetails?.address
      })
      setIsReceivePaymentModalOpen(true)
    } catch (err) {
      setSelectedInvoice(invoice)
      setIsReceivePaymentModalOpen(true)
    }
  }

  const handleDeleteInvoice = async (inv: any) => {
    try {
      const isWood = inv.originalType?.toLowerCase() === 'wood' || 
                     inv.originalType?.toLowerCase() === 'solo_wood' || 
                     inv.type?.toLowerCase() === 'wood' || 
                     inv.type?.toLowerCase() === 'solo_wood' ||
                     inv.id.includes('-W-')

      const invTable = isWood ? 'wood_invoices' : 'furniture_invoices'
      const itemsTable = isWood ? 'wood_invoice_items' : 'furniture_invoice_items'

      const { data: items } = await supabase
        .from(itemsTable)
        .select('*')
        .eq('invoice_id', inv.id)

      if (items && items.length > 0) {
        for (const item of items) {
          if (isWood) {
            if (item.tree_no) {
              await supabase
                .from('wood_inventory')
                .update({ is_sold: false })
                .eq('tree_no', item.tree_no)
            }
          } else {
            const prodId = item.product_id
            const qty = item.quantity || 1
            if (prodId) {
              const { data: prod } = await supabase
                .from('furniture_inventory')
                .select('stock')
                .eq('id', prodId)
                .single()
              
              if (prod) {
                await supabase
                  .from('furniture_inventory')
                  .update({ stock: (prod.stock || 0) + qty })
                  .eq('id', prodId)
              }
            }
          }
        }
      }

      await supabase.from(itemsTable).delete().eq('invoice_id', inv.id)
      await supabase.from('transactions').delete().eq('ref', inv.id)

      if (inv.due > 0 && inv.customer && inv.customer !== 'Walk-in Customer') {
        const { data: cust } = await supabase
          .from('customer')
          .select('total_due')
          .eq('name', inv.customer)
          .single()

        if (cust) {
          await supabase
            .from('customer')
            .update({ total_due: Math.max(0, (cust.total_due || 0) - inv.due) })
            .eq('name', inv.customer)
        }
      }

      const { error: delError } = await supabase
        .from(invTable)
        .delete()
        .eq('id', inv.id)

      if (delError) throw delError

      toast.success('Invoice deleted entirely')
      setInvoiceToDelete(null)
      invalidateInvoiceCache()
      refresh()
    } catch (error) {
      console.error('Error deleting invoice:', error)
      toast.error('Failed to delete invoice')
    }
  }

  const handleSendInvoice = async (inv: any) => {
    try {
      let phoneToSend = inv.customerPhone
      if (!phoneToSend && inv.customer && inv.customer !== 'Walk-in Customer') {
        const { data: cust } = await supabase
          .from('customer')
          .select('phone')
          .eq('name', inv.customer)
          .maybeSingle()
        if (cust?.phone) phoneToSend = cust.phone
      }

      if (!phoneToSend) {
        toast.error('No phone number available for customer')
        return
      }

      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .single()
      
      const settings = settingsData?.settings as any
      let currentUserId = null
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('custom_user')
          if (stored) currentUserId = JSON.parse(stored).id
        } catch (e) {}
      }
      const businessName = (currentUserId && settings?.business_by_user?.[currentUserId]?.name) || settings?.business?.name || 'Store'
      const invoiceUrl = `${window.location.origin}/invoice/view/${encodeURIComponent(inv.id)}`
      const msg = `Dear ${inv.customer}, here is your Invoice ${getDisplayInvoiceId(inv.id)} from ${businessName}. Total: ৳${Math.round(inv.amount).toLocaleString()}, Due: ৳${Math.round(inv.due).toLocaleString()}. View: ${invoiceUrl}`

      await sendSMS(phoneToSend, msg)
      toast.success('Invoice sent via SMS')
    } catch (err) {
      console.error('Failed to send invoice SMS:', err)
      toast.error('Failed to send SMS')
    }
  }

  const handleSendDueReminder = async (inv: any) => {
    if (!inv || sendingReminderId) return

    const remainingSecs = getRemainingCooldown(inv.id)
    if (remainingSecs > 0) {
      toast.info(`Please wait ${remainingSecs}s before sending another reminder for invoice ${getDisplayInvoiceId(inv.id)}.`)
      return
    }

    setSendingReminderId(inv.id)
    const toastId = toast.loading('Fetching invoice details & sending due reminder SMS...')

    try {
      // 1. Fetch fresh invoice details from database to ensure exact figures
      const isWood = inv.type === 'Wood' || inv.originalType === 'solo_wood' || (inv.id && String(inv.id).includes('-W-'))
      const primaryTable = isWood ? 'wood_invoices' : 'furniture_invoices'
      const fallbackTable = isWood ? 'furniture_invoices' : 'wood_invoices'

      let { data: freshInvoice } = await supabase
        .from(primaryTable)
        .select('*, customer:customer_id(*)')
        .eq('id', inv.id)
        .maybeSingle()

      if (!freshInvoice) {
        const { data: fallbackInvoice } = await supabase
          .from(fallbackTable)
          .select('*, customer:customer_id(*)')
          .eq('id', inv.id)
          .maybeSingle()
        freshInvoice = fallbackInvoice
      }

      // 2. Extract precise details: total bill, paid amount, due amount
      const totalBill = Number(freshInvoice?.total ?? inv.amount ?? 0)
      const amountPaid = Number(freshInvoice?.paid_amount ?? inv.paid ?? 0)
      const amountDue = Number(freshInvoice?.due_amount ?? inv.due ?? (totalBill - amountPaid))
      const customerName = freshInvoice?.customer_name || inv.customer || 'Valued Customer'
      const invoiceNumber = getDisplayInvoiceId(freshInvoice?.invoice_number || freshInvoice?.id || inv.id)

      // If due is 0, no reminder needed
      if (amountDue <= 0) {
        toast.dismiss(toastId)
        toast.info(`Invoice ${invoiceNumber} has no outstanding due.`)
        return
      }

      // 3. Resolve customer phone number
      let phoneToSend = freshInvoice?.customer_phone || freshInvoice?.customer?.phone || inv.customerPhone
      if (!phoneToSend && customerName && customerName !== 'Walk-in Customer') {
        const { data: cust } = await supabase
          .from('customer')
          .select('phone')
          .eq('name', customerName)
          .maybeSingle()
        if (cust?.phone) phoneToSend = cust.phone
      }

      // 4. Resolve business name from settings
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

      // 5. Build full due reminder message with total bill, paid, and due
      const formattedTotal = Math.round(totalBill).toLocaleString()
      const formattedPaid = Math.round(amountPaid).toLocaleString()
      const formattedDue = Math.round(amountDue).toLocaleString()

      const reminderMsg = `Dear ${customerName}, here is the payment reminder for Invoice ${invoiceNumber} from ${businessName}.\n• Total Bill: ৳${formattedTotal}\n• Paid Amount: ৳${formattedPaid}\n• Due Amount: ৳${formattedDue}\nPlease clear the due amount at your earliest convenience. Thank you!`

      // 6. If phone number is missing, open modal so user can input phone number
      if (!phoneToSend || !phoneToSend.trim()) {
        toast.dismiss(toastId)
        toast.info(`No phone number found for ${customerName}. Please specify phone number.`)
        setDueReminderData({
          customerName,
          customerPhone: '',
          initialMessage: reminderMsg,
          invoiceId: inv.id
        })
        setIsDueReminderModalOpen(true)
        return
      }

      // 7. Send SMS directly
      await sendSMS(phoneToSend.trim(), reminderMsg)
      
      // Set 60 seconds anti-spam cooldown for this invoice
      setReminderCooldowns(prev => ({
        ...prev,
        [inv.id]: Date.now() + 60000
      }))

      toast.dismiss(toastId)
      toast.success(`Due reminder SMS sent successfully to ${customerName} (${phoneToSend})!`)
    } catch (e: any) {
      console.error('Error sending due reminder SMS:', e)
      toast.dismiss(toastId)
      toast.error(`Failed to send due reminder: ${e?.message || 'Error occurred'}`)
    } finally {
      setSendingReminderId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Title, Tabs, and Create Invoice Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 -mt-2">
          {/* Top row on mobile: Title & Count on left, '+ Create Invoice' button aligned further to the right */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                  {activeTab === 'All' ? 'Invoices' : `${activeTab} Invoices`}
                </h1>
                {isValidating && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-full animate-pulse">
                    <RotateCw size={10} className="animate-spin" />
                    Syncing
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {totalCount} total {activeTab.toLowerCase()} invoice{totalCount === 1 ? '' : 's'} recorded
              </p>
            </div>

            {/* Mobile-only '+ Create Invoice' button aligned further to the right */}
            <div className="md:hidden flex items-center justify-end">
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 whitespace-nowrap"
              >
                <Plus size={15} className="shrink-0" />
                <span>Create Invoice</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs: Centered on mobile, inline on desktop */}
          <div className="w-full md:w-auto flex items-center justify-center">
            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-inner w-full max-w-xs sm:max-w-sm md:w-fit mx-auto md:mx-0">
              <button
                type="button"
                onClick={() => handleTabChange('All')}
                className={cn(
                  "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap",
                  activeTab === 'All'
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <FileText size={14} className={activeTab === 'All' ? "text-amber-500" : "opacity-60"} />
                <span>All Invoices</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('Furniture')}
                className={cn(
                  "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap",
                  activeTab === 'Furniture'
                    ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <Armchair size={14} className={activeTab === 'Furniture' ? "text-purple-600" : "opacity-60"} />
                <span>Furniture</span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('Wood')}
                className={cn(
                  "flex-1 md:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap",
                  activeTab === 'Wood'
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <Trees size={14} className={activeTab === 'Wood' ? "text-emerald-600" : "opacity-60"} />
                <span>Wood</span>
              </button>
            </div>
          </div>

          {/* Desktop '+ Create Invoice' button */}
          <div className="hidden md:flex items-center gap-2">
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 whitespace-nowrap"
            >
              <Plus size={16} className="shrink-0" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Toolbar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by invoice ID or customer name..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:flex items-center gap-2 w-full md:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <Filter size={16} className="shrink-0" /> 
                  <span className="truncate">{selectedStatusFilter === 'All' ? 'All Status' : selectedStatusFilter}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setSelectedStatusFilter('All')}>All Status</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatusFilter('Paid')}>Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatusFilter('Partial')}>Partial</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatusFilter('Due')}>Due</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <Calendar size={16} className="shrink-0" /> 
                  <span className="truncate">{selectedDateRange === 'All time' ? 'Date Range' : selectedDateRange}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setSelectedDateRange('All time')}>All time</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateRange('Today')}>Today</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateRange('Last 7 Days')}>Last 7 Days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateRange('This Month')}>This Month</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateRange('Custom')}>Custom Date</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedDateRange === 'Custom' && (
              <div className="col-span-2 md:col-span-1 flex items-center gap-2 w-full md:w-auto">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full md:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-amber-500"
                />
                <span className="text-slate-500 text-sm font-medium">to</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full md:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Invoice List Container */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[300px]">
          {isLoading && displayedInvoices.length === 0 ? (
            /* Skeleton Loading State (only shown if cache is empty on first boot) */
            <div className="p-6 space-y-4">
              <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/4 animate-pulse" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-28" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-44" />
                  </div>
                  <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-20" />
                </div>
              ))}
            </div>
          ) : displayedInvoices.length === 0 ? (
            /* Empty State */
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 mb-4">
                <FileText size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No {activeTab !== 'All' ? `${activeTab} ` : ''}Invoices Found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                {searchTerm || selectedStatusFilter !== 'All' || selectedDateRange !== 'All time'
                  ? 'Try adjusting your search query or filters to find what you are looking for.'
                  : `No invoices recorded yet under ${activeTab}. Click "Create Invoice" to start.`}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
              >
                <Plus size={16} />
                Create New Invoice
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Invoice Details</th>
                      <th className="px-6 py-4 font-semibold">Customer</th>
                      <th className="px-6 py-4 font-semibold">Amount</th>
                      <th className="px-6 py-4 font-semibold">Payment</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Created By</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedInvoices.map((inv) => (
                      <tr key={`${inv.id}-desktop`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{getDisplayInvoiceId(inv.id)}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                              <Calendar size={12} /> {inv.date}
                            </span>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded w-fit uppercase text-black",
                                inv.type === 'Furniture' ? "bg-purple-100 dark:bg-purple-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                              )}>
                                {inv.type}
                              </span>
                              {inv.type === 'Furniture' && (
                                <span className={cn(
                                  "text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit flex items-center gap-1 transition-colors",
                                  inv.deliveryStatus === 'Delivered'
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                )}>
                                  {inv.deliveryStatus === 'Delivered' ? (
                                    <>
                                      <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                                      Delivered
                                    </>
                                  ) : (
                                    <>
                                      <Truck size={10} className="text-amber-600 dark:text-amber-400" />
                                      Pending Delivery
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {inv.customerPhoto ? (
                              <div className="w-8 h-8 rounded-full overflow-hidden relative">
                                <Image src={inv.customerPhoto} alt={inv.customer} fill sizes="32px" className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                <User size={16} />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{inv.customer}</span>
                              {inv.customerPhone && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">{inv.customerPhone}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">৳{Math.round(inv.amount).toLocaleString()}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">Total Bill</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              <span>PAID: ৳{Math.round(inv.paid).toLocaleString()}</span>
                              <span className="text-rose-500 dark:text-rose-400">DUE: ৳{Math.round(inv.due).toLocaleString()}</span>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${(inv.paid / Math.max(1, inv.amount)) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-bold text-black",
                            inv.status === 'Paid' ? "bg-emerald-100 dark:bg-emerald-900/30" :
                            inv.status === 'Partial' ? "bg-amber-100 dark:bg-amber-900/30" :
                            "bg-rose-100 dark:bg-rose-900/30"
                          )}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-semibold shrink-0">
                              {inv.createdBy && inv.createdBy !== 'Unassigned' ? inv.createdBy.charAt(0).toUpperCase() : <User size={13} />}
                            </div>
                            <span className={cn(
                              "text-sm truncate max-w-[130px]",
                              inv.createdBy && inv.createdBy !== 'Unassigned'
                                ? "font-medium text-slate-800 dark:text-slate-200"
                                : "text-slate-400 dark:text-slate-500 italic"
                            )} title={inv.createdBy || 'Unassigned'}>
                              {inv.createdBy || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right relative">
                          <div className="flex items-center justify-end gap-2">
                            {Number(inv.due || 0) > 0 && (
                              <button 
                                onClick={() => handleSendDueReminder(inv)}
                                disabled={isFetchingItems || sendingReminderId === inv.id || getRemainingCooldown(inv.id) > 0}
                                className={cn(
                                  "p-2 rounded-lg transition-colors relative group",
                                  getRemainingCooldown(inv.id) > 0
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-75"
                                    : "hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500 hover:text-rose-600 dark:text-rose-400"
                                )}
                                title={
                                  getRemainingCooldown(inv.id) > 0
                                    ? `Please wait ${getRemainingCooldown(inv.id)}s before sending another reminder`
                                    : "Send Due Reminder SMS"
                                }
                              >
                                {sendingReminderId === inv.id ? (
                                  <RotateCw size={18} className="animate-spin text-rose-500" />
                                ) : (
                                  <div className="relative flex items-center justify-center">
                                    <BellRing size={18} />
                                    {getRemainingCooldown(inv.id) > 0 && (
                                      <span className="absolute -top-1.5 -right-2 text-[9px] font-bold bg-rose-500 text-white rounded-full px-1 min-w-[15px] h-[15px] flex items-center justify-center shadow-sm">
                                        {getRemainingCooldown(inv.id)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                            )}
                            <button 
                              onClick={() => handleOpenPayment(inv)}
                              disabled={isFetchingItems}
                              className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-500 hover:text-emerald-600 transition-colors disabled:opacity-50"
                              title="Receive Payment"
                            >
                              <DollarSign size={18} />
                            </button>
                            <button 
                              onClick={() => handleOpenInvoice(inv)}
                              disabled={isFetchingItems}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
                              title="View Invoice"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => handleOpenInvoice(inv)}
                              disabled={isFetchingItems}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
                              title="Print Invoice"
                            >
                              <Printer size={18} />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-2 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300">
                                  <MoreHorizontal size={18} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {Number(inv.due || 0) > 0 && (
                                  <DropdownMenuItem 
                                    onClick={() => handleSendDueReminder(inv)}
                                    disabled={sendingReminderId === inv.id || getRemainingCooldown(inv.id) > 0}
                                    className="gap-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/10 cursor-pointer disabled:opacity-50"
                                  >
                                    {sendingReminderId === inv.id ? (
                                      <RotateCw size={16} className="animate-spin text-rose-500" />
                                    ) : (
                                      <BellRing size={16} />
                                    )}
                                    {getRemainingCooldown(inv.id) > 0
                                      ? `Due Reminder (${getRemainingCooldown(inv.id)}s)`
                                      : 'Due Reminder SMS'}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedInvoice(inv)
                                    setIsEditModalOpen(true)
                                  }}
                                  className="gap-3"
                                >
                                  <Edit size={16} className="text-slate-400" /> Edit
                                </DropdownMenuItem>
                                {inv.type === 'Furniture' && (
                                  <DropdownMenuItem
                                    onClick={() => handleToggleDeliveryStatus(inv)}
                                    disabled={updatingDeliveryId === inv.id}
                                    className={cn(
                                      'gap-3 cursor-pointer disabled:opacity-50',
                                      inv.deliveryStatus === 'Delivered'
                                        ? 'text-amber-700 dark:text-amber-400 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/20'
                                        : 'text-emerald-700 dark:text-emerald-400 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-950/20'
                                    )}
                                  >
                                    {updatingDeliveryId === inv.id ? (
                                      <RotateCw
                                        size={16}
                                        className={cn(
                                          'animate-spin',
                                          inv.deliveryStatus === 'Delivered' ? 'text-amber-600' : 'text-emerald-600'
                                        )}
                                      />
                                    ) : inv.deliveryStatus === 'Delivered' ? (
                                      <Undo size={16} className="text-amber-600" />
                                    ) : (
                                      <CheckCircle2 size={16} className="text-emerald-600" />
                                    )}
                                    <span>
                                      {inv.deliveryStatus === 'Delivered' ? 'Unmark Delivered' : 'Mark Delivered'}
                                    </span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={() => handleSendInvoice(inv)}
                                  className="gap-3"
                                >
                                  <Send size={16} className="text-blue-400" /> Send Invoice
                                </DropdownMenuItem>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                <DropdownMenuItem 
                                  onClick={() => setInvoiceToDelete(inv)}
                                  className="gap-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/10 cursor-pointer"
                                >
                                  <Trash2 size={16} /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                {displayedInvoices.map((inv) => (
                  <div key={`${inv.id}-mobile`} className="p-4 space-y-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-[14px]">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {inv.customerPhoto ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden relative shrink-0">
                            <Image src={inv.customerPhoto} alt={inv.customer} fill sizes="40px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                            <User size={20} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{getDisplayInvoiceId(inv.id)}</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold text-black",
                              inv.status === 'Paid' ? "bg-emerald-100 dark:bg-emerald-900/30" :
                              inv.status === 'Partial' ? "bg-amber-100 dark:bg-amber-900/30" :
                              "bg-rose-100 dark:bg-rose-900/30"
                            )}>
                              {inv.status}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase text-black",
                              inv.type === 'Furniture' ? "bg-purple-100 dark:bg-purple-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                            )}>
                              {inv.type}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5 truncate">{inv.customer}</p>
                          {inv.customerPhone && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{inv.customerPhone}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} /> {inv.date}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Corner element for Created By in mobile and tablet views */}
                      <div className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300" title={`Created by: ${inv.createdBy || 'Unassigned'}`}>
                        <User size={11} className="text-slate-400 shrink-0" />
                        <span className="font-medium truncate max-w-[85px] sm:max-w-[120px]">{inv.createdBy || 'Unassigned'}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end text-sm pt-1 border-t border-slate-50 dark:border-slate-800/50">
                      <div className="flex flex-col">
                        <span className="text-slate-400 text-xs">Total Bill</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">৳{Math.round(inv.amount).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-xs text-slate-400">PAID: <span className="font-semibold text-emerald-600 dark:text-emerald-400">৳{Math.round(inv.paid).toLocaleString()}</span></span>
                        <span className="text-xs text-rose-500 dark:text-rose-400 font-bold">DUE: ৳{Math.round(inv.due).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Delivery Status Badge at bottom-left corner */}
                      <div className="flex items-center min-w-0">
                        {inv.type === 'Furniture' && (
                          inv.deliveryStatus === 'Delivered' ? (
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1 transition-colors shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                              <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                              Delivered
                            </span>
                          ) : (
                            <span 
                              title="Pending Delivery"
                              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              <Truck size={15} className="text-amber-600 dark:text-amber-400" />
                            </span>
                          )
                        )}
                      </div>

                      {/* Action buttons with 'Receive Payment' placed directly to the right of bottom-left delivery badge */}
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        <button onClick={() => handleOpenPayment(inv)} disabled={isFetchingItems} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400 disabled:opacity-50 hover:bg-emerald-100 transition-colors" title="Receive Payment"><DollarSign size={16} /></button>
                        {Number(inv.due || 0) > 0 && (
                          <button 
                            onClick={() => handleSendDueReminder(inv)} 
                            disabled={isFetchingItems || sendingReminderId === inv.id || getRemainingCooldown(inv.id) > 0} 
                            className={cn(
                              "p-2 rounded-lg disabled:opacity-50 transition-colors relative",
                              getRemainingCooldown(inv.id) > 0 
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-75"
                                : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
                            )} 
                            title={
                              getRemainingCooldown(inv.id) > 0
                                ? `Please wait ${getRemainingCooldown(inv.id)}s before sending another reminder`
                                : "Send Due Reminder SMS"
                            }
                          >
                            {sendingReminderId === inv.id ? (
                              <RotateCw size={16} className="animate-spin text-rose-500" />
                            ) : (
                              <div className="relative flex items-center justify-center">
                                <BellRing size={16} />
                                {getRemainingCooldown(inv.id) > 0 && (
                                  <span className="absolute -top-1.5 -right-2 text-[8px] font-bold bg-rose-500 text-white rounded-full px-1 min-w-[13px] h-[13px] flex items-center justify-center shadow-sm">
                                    {getRemainingCooldown(inv.id)}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        )}
                        <button onClick={() => handleOpenInvoice(inv)} disabled={isFetchingItems} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 transition-colors" title="View"><Eye size={16} /></button>
                      <button onClick={() => handleOpenInvoice(inv)} disabled={isFetchingItems} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 transition-colors" title="Print"><Printer size={16} /></button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {Number(inv.due || 0) > 0 && (
                            <DropdownMenuItem 
                              onClick={() => handleSendDueReminder(inv)}
                              disabled={sendingReminderId === inv.id || getRemainingCooldown(inv.id) > 0}
                              className="gap-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/10 cursor-pointer disabled:opacity-50"
                            >
                              {sendingReminderId === inv.id ? (
                                <RotateCw size={16} className="animate-spin text-rose-500" />
                              ) : (
                                <BellRing size={16} />
                              )}
                              {getRemainingCooldown(inv.id) > 0
                                ? `Due Reminder (${getRemainingCooldown(inv.id)}s)`
                                : 'Due Reminder SMS'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedInvoice(inv)
                              setIsEditModalOpen(true)
                            }}
                            className="gap-3"
                          >
                            <Edit size={16} className="text-slate-400" /> Edit
                          </DropdownMenuItem>
                          {inv.type === 'Furniture' && (
                            <DropdownMenuItem
                              onClick={() => handleToggleDeliveryStatus(inv)}
                              disabled={updatingDeliveryId === inv.id}
                              className={cn(
                                'gap-3 cursor-pointer disabled:opacity-50',
                                inv.deliveryStatus === 'Delivered'
                                  ? 'text-amber-700 dark:text-amber-400 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/20'
                                  : 'text-emerald-700 dark:text-emerald-400 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-950/20'
                              )}
                            >
                              {updatingDeliveryId === inv.id ? (
                                <RotateCw
                                  size={16}
                                  className={cn(
                                    'animate-spin',
                                    inv.deliveryStatus === 'Delivered' ? 'text-amber-600' : 'text-emerald-600'
                                  )}
                                />
                              ) : inv.deliveryStatus === 'Delivered' ? (
                                <Undo size={16} className="text-amber-600" />
                              ) : (
                                <CheckCircle2 size={16} className="text-emerald-600" />
                              )}
                              <span>
                                {inv.deliveryStatus === 'Delivered' ? 'Unmark Delivered' : 'Mark Delivered'}
                              </span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleSendInvoice(inv)}
                            className="gap-3"
                          >
                            <Send size={16} className="text-blue-400" /> Send Invoice
                          </DropdownMenuItem>
                          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                          <DropdownMenuItem 
                            onClick={() => setInvoiceToDelete(inv)}
                            className="gap-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-900/10 cursor-pointer"
                          >
                            <Trash2 size={16} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>

        {/* Load More Spinner */}
        {isLoadingMore && (
          <div className="py-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        )}

        {/* View Invoice Modal */}
        <InvoiceModal 
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          invoice={selectedInvoice}
        />

        {/* Create Invoice Selection Modal */}
        <CreateInvoiceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />

        {/* Edit Invoice Modal */}
        <EditInvoiceModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          invoice={selectedInvoice}
          onSave={() => {
            invalidateInvoiceCache()
            refresh()
          }}
        />

        {/* Receive Payment Modal */}
        <ReceivePaymentModal 
          isOpen={isReceivePaymentModalOpen}
          onClose={() => setIsReceivePaymentModalOpen(false)}
          customerName={selectedInvoice?.customer || ''}
          customerPhone={selectedInvoice?.customerPhone || ''}
          totalDue={selectedInvoice?.due || 0}
          invoiceId={selectedInvoice?.id}
          onPaymentReceived={async (payment) => {
            try {
              const newPaid = (selectedInvoice.paid || 0) + payment.amount
              const newDue = Math.max(0, (selectedInvoice.amount || 0) - newPaid)
              
              const isWood = selectedInvoice.originalType?.toLowerCase() === 'wood' || 
                             selectedInvoice.originalType?.toLowerCase() === 'solo_wood' || 
                             selectedInvoice.type?.toLowerCase() === 'wood' || 
                             selectedInvoice.type?.toLowerCase() === 'solo_wood' ||
                             selectedInvoice.id.includes('-W-')
              const invoiceTable = isWood ? 'wood_invoices' : 'furniture_invoices'

              // 1. Update Invoice in Supabase
              const { error: invError } = await supabase
                .from(invoiceTable)
                .update({ 
                  paid_amount: newPaid, 
                  due_amount: newDue
                })
                .eq('id', selectedInvoice.id)
              
              if (invError) throw invError

              // 2. Update Customer total_due
              let customerId = null
              if (selectedInvoice.customer && selectedInvoice.customer !== 'Walk-in Customer') {
                const { data: customerData } = await supabase
                  .from('customer')
                  .select('id, total_due')
                  .eq('name', selectedInvoice.customer)
                  .maybeSingle()
                
                if (customerData) {
                  customerId = customerData.id
                  await supabase
                    .from('customer')
                    .update({ total_due: Math.max(0, (customerData.total_due || 0) - payment.amount) })
                    .eq('name', selectedInvoice.customer)
                }
              }

              // 3. Record Transaction
              await supabase.from('transactions').insert([{
                id: `TXN-P-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                date: payment.date || new Date().toISOString().split('T')[0],
                type: 'Payment',
                ref: selectedInvoice.id,
                credit: payment.amount,
                balance: newDue,
                customer_id: customerId,
                method: payment.method,
                notes: payment.notes || payment.method
              }])

              toast.success('Payment received')
              addNotification('invoice_update', 'Payment Received', `Received ৳${payment.amount} for Invoice ${getDisplayInvoiceId(selectedInvoice.id)} via ${payment.method}`)
              invalidateInvoiceCache()
              refresh()

              // 4. Send SMS
              const { data: settingsData } = await supabase
                .from('app_settings')
                .select('settings')
                .eq('id', 'global')
                .single()
              
              const settings = settingsData?.settings as any
              let currentUserId = null
              if (typeof window !== 'undefined') {
                try {
                  const stored = localStorage.getItem('custom_user')
                  if (stored) currentUserId = JSON.parse(stored).id
                } catch (e) {}
              }
              const businessName = (currentUserId && settings?.business_by_user?.[currentUserId]?.name) || settings?.business?.name || ''
              const smsMessage = `Dear ${selectedInvoice.customer}, we have received a payment of ৳${Math.round(payment.amount).toLocaleString()} via ${payment.method} for Invoice ${getDisplayInvoiceId(selectedInvoice.id)}. Your current invoice due is ৳${Math.round(newDue).toLocaleString()}. Thank you! - ${businessName}`
              
              let phoneToSend = selectedInvoice.customerPhone
              if (!phoneToSend && selectedInvoice.customer && selectedInvoice.customer !== 'Walk-in Customer') {
                const { data: customerData } = await supabase
                  .from('customer')
                  .select('phone')
                  .eq('name', selectedInvoice.customer)
                  .maybeSingle()
                
                if (customerData?.phone) {
                  phoneToSend = customerData.phone
                }
              }

              if (phoneToSend) {
                sendSMS(phoneToSend, smsMessage).catch(err => console.error('SMS failed:', err))
              }

            } catch (error) {
              console.error('Payment error:', error)
              toast.error('Failed to record payment')
            }
          }}
        />

        <AlertPopup 
          isOpen={alertConfig.isOpen}
          onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
          message={alertConfig.message}
          type={alertConfig.type}
        />

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {invoiceToDelete && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setInvoiceToDelete(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center border border-slate-200 dark:border-slate-800"
              >
                <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600 dark:text-rose-400">
                  <Trash2 size={40} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Invoice?</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                  Are you sure you want to delete invoice <b>{getDisplayInvoiceId(invoiceToDelete.id)}</b>? This will restore stock, delete transactions, and reduce customer due.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setInvoiceToDelete(null)}
                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleDeleteInvoice(invoiceToDelete)}
                    className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all shadow-lg"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Due Reminder SMS Modal */}
        {isDueReminderModalOpen && dueReminderData && (
          <SendSMSModal
            isOpen={isDueReminderModalOpen}
            onClose={() => {
              if (dueReminderData.invoiceId) {
                setReminderCooldowns(prev => ({
                  ...prev,
                  [dueReminderData.invoiceId!]: Date.now() + 60000
                }))
              }
              setIsDueReminderModalOpen(false)
              setDueReminderData(null)
            }}
            customerName={dueReminderData.customerName}
            customerPhone={dueReminderData.customerPhone}
            initialMessage={dueReminderData.initialMessage}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

export default function InvoicePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    }>
      <InvoicePageContent />
    </Suspense>
  )
}
