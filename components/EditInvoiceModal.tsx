'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  X, Save, User, Plus, Trash2, Calendar, DollarSign, Phone, MapPin, 
  Truck, Tag, AlertCircle, Loader2, Check, Search, ChevronDown, 
  UserPlus, FileText, CornerDownRight, Hash, Edit3, 
  Copy, ArrowUp, ArrowDown, Eraser
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { addNotification } from '@/lib/notifications'
import { getDisplayInvoiceId, normalizeInvoiceIdFormat, isValidInvoiceIdFormat } from '@/lib/invoice'
import { fetchOrgUsers, recordInvoiceCreator } from '@/lib/invoiceCache'
import { cn, parseDateSafe } from '@/lib/utils'

interface EditInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: any
  onSave: () => void
}

interface EditableItem {
  id?: number | string
  product_id?: number | null
  product_type?: string
  name: string
  quantity: number
  unit?: string
  price: number
  total: number
  // Wood specifics
  treeNo?: string
  carNo?: string
  width?: number
  length?: number
  cft?: number
  tag?: string
  isStock?: boolean
}

export default function EditInvoiceModal({ isOpen, onClose, invoice, onSave }: EditInvoiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [settings, setSettings] = useState<any>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string; username?: string; role?: string }>>([])
  
  // States for Search & Dropdowns
  const [customers, setCustomers] = useState<any[]>([])
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [activeItemSearchIdx, setActiveItemSearchIdx] = useState<number | null>(null)
  const [itemSearchTerm, setItemSearchTerm] = useState('')

  // Header & Customer details
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceId, setInvoiceId] = useState('') 
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState<'Pending' | 'Delivered'>('Pending')
  const [createdBy, setCreatedBy] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  // Original IDs tracking to safely handle tenant prefixes & modifications
  const originalDisplayIdRef = useRef<string>('')
  const originalDbIdRef = useRef<string>('')

  // Items
  const [items, setItems] = useState<EditableItem[]>([])

  // Financials
  const [discount, setDiscount] = useState<number>(0)
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0)
  const [paid, setPaid] = useState<number>(0)
  const [oldDue, setOldDue] = useState<number>(0)

  // Type detector
  const isWood = useMemo(() => {
    if (!invoice) return false
    return (
      invoice.originalType?.toLowerCase() === 'wood' || 
      invoice.originalType?.toLowerCase() === 'solo_wood' || 
      invoice.type?.toLowerCase() === 'wood' || 
      invoice.type?.toLowerCase() === 'solo_wood' ||
      invoice.id?.includes('-W-')
    )
  }, [invoice])

  // Fetch initial data
  useEffect(() => {
    if (!isOpen) return
    
    const fetchInitialData = async () => {
      try {
        const { data: settingsData } = await supabase
          .from('app_settings')
          .select('settings')
          .eq('id', 'global')
          .single()
        if (settingsData?.settings) setSettings(settingsData.settings)
        
        fetchOrgUsers().then(uList => setUsers(uList))
        
        const { data: custData } = await supabase.from('customer').select('*').order('name', { ascending: true })
        if (custData) setCustomers(custData)
        
        const inventoryTable = isWood ? 'wood_inventory' : 'furniture_inventory'
        const { data: prodData } = await supabase.from(inventoryTable).select('*')
        if (prodData) {
          setAllProducts(prodData.map(p => ({
            ...p,
            id: p.id,
            name: isWood ? (p.tree_no || p.name) : p.name,
            price: Number(p.sell_price || p.price || 0),
            stock: Number(p.stock || 0)
          })))
        }
      } catch (e) {
        console.warn('Failed to fetch initial data:', e)
      }
    }
    
    fetchInitialData()
  }, [isOpen, isWood])

  const createEmptyItem = useCallback((woodMode: boolean): EditableItem => {
    return {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: null,
      product_type: woodMode ? 'wood' : 'furniture',
      name: '',
      quantity: 1,
      unit: woodMode ? 'CFT' : 'PCS',
      price: 0,
      total: 0,
      treeNo: '',
      carNo: '',
      width: 0,
      length: 0,
      cft: 0,
      tag: '-',
      isStock: false
    }
  }, [])

  const normalizeItems = useCallback((rawItems: any[], woodMode: boolean): EditableItem[] => {
    return rawItems.map((item, idx) => {
      const qty = Number(item.quantity || 1)
      const price = Number(item.price || item.sellPrice || 0)
      const width = item.width !== undefined && item.width !== null ? Number(item.width) : 0
      const length = item.length !== undefined && item.length !== null ? Number(item.length) : 0
      const cft = item.cft !== undefined && item.cft !== null ? Number(item.cft) : (qty || 0)
      const computedTotal = woodMode ? (cft * price) : (qty * price)

      return {
        id: item.id || `item-${Date.now()}-${idx}`,
        product_id: item.product_id || item.productId || null,
        product_type: item.product_type || (woodMode ? 'wood' : 'furniture'),
        name: item.name || item.treeNo || item.tree_no || (woodMode ? 'Wood Item' : 'Furniture Item'),
        quantity: isNaN(qty) ? 1 : qty,
        unit: item.unit || (woodMode ? 'CFT' : 'PCS'),
        price: isNaN(price) ? 0 : price,
        total: Number(item.total) || computedTotal,
        treeNo: item.treeNo || item.tree_no || (woodMode ? item.name : ''),
        carNo: item.carNo || item.car_no || '',
        width,
        length,
        cft: isNaN(cft) ? 0 : cft,
        tag: item.tag || '-',
        isStock: !!(item.product_id || item.productId)
      }
    })
  }, [])

  const fetchItemsFromDb = useCallback(async (invId: string, woodMode: boolean) => {
    setIsLoadingItems(true)
    try {
      const itemsTable = woodMode ? 'wood_invoice_items' : 'furniture_invoice_items'
      const { data, error } = await supabase
        .from(itemsTable)
        .select('*')
        .eq('invoice_id', invId)
        .order('id', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setItems(normalizeItems(data, woodMode))
      } else {
        setItems([createEmptyItem(woodMode)])
      }
    } catch (err) {
      console.error('Failed to load items from DB:', err)
      setItems([createEmptyItem(woodMode)])
    } finally {
      setIsLoadingItems(false)
    }
  }, [normalizeItems, createEmptyItem])

  useEffect(() => {
    if (!isOpen || !invoice) return

    setCustomerName(invoice.customer || invoice.customer_name || 'Walk-in Customer')
    setCustomerPhone(invoice.customerPhone || invoice.customer_phone || '')
    setCustomerAddress(invoice.customerAddress || invoice.customer_address || '')
    setInvoiceDate(invoice.date ? invoice.date.split('T')[0] : new Date().toISOString().split('T')[0])
    
    // Strictly format Invoice ID to #INV-W-260902 (Wood) or #INV-F-260902 (Furniture)
    const initialDisplayId = normalizeInvoiceIdFormat(
      invoice.invoice_number || invoice.id,
      isWood,
      invoice.date || invoice.created_at
    )
    setInvoiceId(initialDisplayId)
    originalDisplayIdRef.current = initialDisplayId
    originalDbIdRef.current = invoice.id || ''

    setDeliveryDate(invoice.deliveryDate || invoice.delivery_date || '')
    setDeliveryStatus((invoice.deliveryStatus || invoice.delivery_status || 'Pending') as 'Pending' | 'Delivered')
    setCreatedBy(invoice.createdBy && invoice.createdBy !== 'Unassigned' ? invoice.createdBy : (invoice.created_by_name || ''))
    setPaymentMethod(invoice.paymentMethod || invoice.payment_method || 'Cash')

    setDiscount(Number(invoice.discount || 0))
    setDiscountType((invoice.discountType || invoice.discount_type || 'fixed') as 'fixed' | 'percent')
    setDeliveryCharge(Number(invoice.deliveryCharge || invoice.delivery_charge || 0))
    setPaid(Number(invoice.paid || invoice.paid_amount || 0))
    setOldDue(Number(invoice.oldDue || 0))

    if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      setItems(normalizeItems(invoice.items, isWood))
    } else {
      fetchItemsFromDb(invoice.id, isWood)
    }

    if (invoice.customer && invoice.customer !== 'Walk-in Customer') {
      supabase
        .from('customer')
        .select('phone, address, total_due')
        .eq('name', invoice.customer)
        .maybeSingle()
        .then(({ data: cust }) => {
          if (cust) {
            if (!invoice.customerPhone && cust.phone) setCustomerPhone(cust.phone)
            if (!invoice.customerAddress && cust.address) setCustomerAddress(cust.address)
            const currentInvoiceDue = Number(invoice.due || invoice.due_amount || 0)
            const calculatedOldDue = Math.max(0, (cust.total_due || 0) - currentInvoiceDue)
            setOldDue(calculatedOldDue)
          }
        })
    }
  }, [isOpen, invoice, isWood, normalizeItems, fetchItemsFromDb])

  // Real-time calculations
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  }, [items])

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.round((itemsSubtotal * (Number(discount) || 0)) / 100)
    }
    return Math.round(Number(discount) || 0)
  }, [itemsSubtotal, discount, discountType])

  const grandTotal = useMemo(() => {
    return Math.max(0, Math.round(itemsSubtotal - discountAmount + (Number(deliveryCharge) || 0)))
  }, [itemsSubtotal, discountAmount, deliveryCharge])

  const currentDue = useMemo(() => {
    return Math.max(0, Math.round(grandTotal - (Number(paid) || 0)))
  }, [grandTotal, paid])

  const totalDue = useMemo(() => {
    return Math.round(oldDue + currentDue)
  }, [oldDue, currentDue])

  const filteredCustomers = useMemo(() => {
    const term = customerSearchTerm.toLowerCase()
    return customers.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.phone.toLowerCase().includes(term)
    )
  }, [customers, customerSearchTerm])

  const filteredProducts = useMemo(() => {
    const term = itemSearchTerm.toLowerCase()
    return allProducts.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (isWood && (p.car_no?.toLowerCase().includes(term) || p.tree_no?.toLowerCase().includes(term)))
    )
  }, [allProducts, itemSearchTerm, isWood])

  const selectCustomer = (c: any) => {
    setCustomerName(c.name)
    setCustomerPhone(c.phone || '')
    setCustomerAddress(c.address || '')
    setOldDue(Math.max(0, (c.total_due || 0)))
    setIsCustomerDropdownOpen(false)
  }

  const selectProduct = (p: any, index: number) => {
    setItems(prev => {
      const next = [...prev]
      const current = { ...next[index] }
      
      current.product_id = p.id
      current.name = p.name
      current.price = p.price
      current.unit = p.unit || (isWood ? 'CFT' : 'PCS')
      current.isStock = true
      
      if (isWood) {
        current.carNo = p.car_no
        current.treeNo = p.tree_no
        current.width = p.width
        current.length = p.length
        current.cft = p.cft
        current.tag = p.tag
        current.total = Math.round(Number(p.cft || 0) * Number(p.price || 0))
      } else {
        current.total = Math.round(current.quantity * p.price)
      }
      
      next[index] = current
      return next
    })
    setActiveItemSearchIdx(null)
    setItemSearchTerm('')
  }

  const handleItemChange = (index: number, field: keyof EditableItem, value: any) => {
    setItems(prev => {
      const next = [...prev]
      const current = { ...next[index], [field]: value }

      if (isWood) {
        const w = field === 'width' ? Number(value) || 0 : (Number(current.width) || 0)
        const l = field === 'length' ? Number(value) || 0 : (Number(current.length) || 0)
        const p = field === 'price' ? Number(value) || 0 : (Number(current.price) || 0)

        let cftVal = current.cft || 0
        if (field === 'width' || field === 'length') {
          if (w > 0 && l > 0) {
            cftVal = Number(((w * w * l) / 2304).toFixed(4))
            current.cft = cftVal
          }
        } else if (field === 'cft') {
          cftVal = Number(value) || 0
        }

        current.total = Math.round(cftVal * p)
      } else {
        const qty = field === 'quantity' ? Number(value) || 0 : (Number(current.quantity) || 1)
        const prc = field === 'price' ? Number(value) || 0 : (Number(current.price) || 0)
        current.total = Math.round(qty * prc)
      }

      next[index] = current
      return next
    })
  }

  const handleAddItem = () => {
    setItems(prev => [...prev, createEmptyItem(isWood)])
  }

  const handleDuplicateItem = (index: number) => {
    setItems(prev => {
      const next = [...prev]
      const cloned = { ...next[index], id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` }
      next.splice(index + 1, 0, cloned)
      return next
    })
    toast.success('Item duplicated')
  }

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    setItems(prev => {
      const next = [...prev]
      if (direction === 'up' && index > 0) {
        [next[index], next[index - 1]] = [next[index - 1], next[index]]
      } else if (direction === 'down' && index < next.length - 1) {
        [next[index], next[index + 1]] = [next[index + 1], next[index]]
      }
      return next
    })
  }

  const handleClearItems = () => {
    if (confirm('Are you sure you want to clear all items?')) {
      setItems([createEmptyItem(isWood)])
      toast.info('All items cleared')
    }
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('Invoice must contain at least one item')
      return
    }
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveChanges = async () => {
    if (!invoiceId.trim()) {
      toast.error('Invoice ID is required')
      return
    }
    if (!invoiceDate) {
      toast.error('Invoice Date is required')
      return
    }
    if (!customerName.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const nameCheck = isWood ? (item.treeNo || item.name) : item.name
      if (!nameCheck || !nameCheck.trim()) {
        toast.error(`Item #${i + 1} requires a valid name/description`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      const invoiceTable = isWood ? 'wood_invoices' : 'furniture_invoices'
      const itemsTable = isWood ? 'wood_invoice_items' : 'furniture_invoice_items'

      const matchedUser = users.find(u => 
        u.name?.toLowerCase() === createdBy.trim().toLowerCase() ||
        u.username?.toLowerCase() === createdBy.trim().toLowerCase()
      )
      const creatorNameVal = createdBy.trim() || null
      const creatorIdVal = matchedUser?.id || null

      const invoiceUpdatePayload: any = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        subtotal: itemsSubtotal,
        discount: discountAmount,
        discount_type: discountType,
        delivery_charge: Number(deliveryCharge) || 0,
        total: grandTotal,
        paid_amount: Number(paid) || 0,
        due_amount: currentDue,
        payment_method: paymentMethod,
        created_by: creatorIdVal,
        created_by_name: creatorNameVal
      }

      // Validate and normalize Invoice ID strictly to #INV-W-260902 format
      const trimmedId = invoiceId.trim()
      const cleanDisplayId = normalizeInvoiceIdFormat(trimmedId, isWood, invoiceDate)

      if (!isValidInvoiceIdFormat(cleanDisplayId)) {
        toast.error(`Invoice ID must be in format ${isWood ? '#INV-W-260902' : '#INV-F-260902'}`)
        setIsSubmitting(false)
        return
      }

      const isIdChanged = cleanDisplayId !== originalDisplayIdRef.current
      let targetDbId = invoice.id

      if (isIdChanged) {
        const tenantPrefix = (invoice.id && invoice.id.includes('_')) ? invoice.id.split('_')[0] + '_' : ''
        targetDbId = tenantPrefix ? `${tenantPrefix}${cleanDisplayId}` : cleanDisplayId

        const { data: existing } = await supabase
          .from(invoiceTable)
          .select('id')
          .or(`id.eq.${targetDbId},id.eq.${cleanDisplayId},invoice_number.eq.${cleanDisplayId}`)
          .maybeSingle()
        
        if (existing && existing.id !== invoice.id) {
          toast.error(`Invoice ID "${cleanDisplayId}" already exists. Please use a unique number.`)
          setIsSubmitting(false)
          return
        }
        invoiceUpdatePayload.id = targetDbId
        invoiceUpdatePayload.invoice_number = cleanDisplayId
      } else {
        invoiceUpdatePayload.invoice_number = cleanDisplayId
      }

      if (invoiceDate) invoiceUpdatePayload.created_at = new Date(invoiceDate).toISOString()
      if (!isWood) {
        invoiceUpdatePayload.delivery_date = deliveryDate || null
        invoiceUpdatePayload.delivery_status = deliveryStatus
      }

      const { error: invErr } = await supabase
        .from(invoiceTable)
        .update(invoiceUpdatePayload)
        .eq('id', invoice.id)

      if (invErr) throw invErr

      const { error: deleteErr } = await supabase
        .from(itemsTable)
        .delete()
        .eq('invoice_id', invoice.id)
      if (deleteErr) throw deleteErr

      if (isWood) {
        const woodItemsToInsert = items.map(item => ({
          invoice_id: targetDbId,
          product_type: 'wood',
          product_id: item.product_id || 0,
          name: (item.treeNo || item.name || '').trim(),
          price: Number(item.price) || 0,
          cft: Number(item.cft) || 0,
          tag: item.tag || null,
          car_no: item.carNo || null,
          width: Number(item.width) || null,
          length: Number(item.length) || null,
          total: Number(item.total) || 0
        }))
        const { error: insertItemsErr } = await supabase.from(itemsTable).insert(woodItemsToInsert)
        if (insertItemsErr) throw insertItemsErr
      } else {
        const furnitureItemsToInsert = items.map(item => ({
          invoice_id: targetDbId,
          product_type: 'furniture',
          product_id: item.product_id || null,
          name: (item.name || '').trim(),
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          total: Number(item.total) || 0
        }))
        const { error: insertItemsErr } = await supabase.from(itemsTable).insert(furnitureItemsToInsert)
        if (insertItemsErr) throw insertItemsErr
      }

      // Update transactions reference if invoice ID was changed
      if (isIdChanged && targetDbId !== invoice.id) {
        await supabase
          .from('transactions')
          .update({ ref: targetDbId })
          .eq('ref', invoice.id)
      }

      const previousDueRecorded = Number(invoice.due || invoice.due_amount || 0)
      const dueDifference = currentDue - previousDueRecorded

      if (customerName && customerName !== 'Walk-in Customer') {
        const { data: customerRecord } = await supabase
          .from('customer')
          .select('id, total_due')
          .eq('name', customerName)
          .maybeSingle()

        if (customerRecord) {
          await supabase
            .from('customer')
            .update({ 
              total_due: Math.max(0, (customerRecord.total_due || 0) + dueDifference),
              phone: customerPhone.trim() || undefined,
              address: customerAddress.trim() || undefined
            })
            .eq('name', customerName)
        }
      }

      if (creatorNameVal) {
        await recordInvoiceCreator(invoice.id, creatorNameVal, creatorIdVal || undefined)
      }

      addNotification('invoice_update', 'Invoice Updated', `Invoice ${cleanDisplayId} was modified.`)
      toast.success(`Invoice ${cleanDisplayId} updated successfully!`)
      onSave()
      onClose()
    } catch (err: any) {
      console.error('Error saving invoice:', err)
      toast.error('Failed to save: ' + (err.message || 'Unknown error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
        >
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Edit3 size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Edit Invoice <span className="text-amber-600 dark:text-amber-400 font-mono">{getDisplayInvoiceId(invoiceId || invoice?.id, isWood)}</span>
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                    isWood ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  )}>
                    {isWood ? 'Wood Stock' : 'Furniture'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                Cancel
              </button>
              <button 
                onClick={handleSaveChanges} 
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Changes
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all ml-1">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {isLoadingItems ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Loader2 size={48} className="animate-spin text-amber-500 mb-4" />
                <p className="font-bold">Loading invoice data...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form Area */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Top Metadata Card: Invoice Core & Customer Context */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-5">
                    {/* Header Row: Invoice ID, Invoice Date, Staff Assignment */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1. Invoice ID (Editable and Validated) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between ml-1">
                          <span className="flex items-center gap-1.5">
                            <Hash size={13} className="text-slate-400" /> Invoice ID
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {isWood ? '#INV-W-YYMMSS' : '#INV-F-YYMMSS'}
                          </span>
                        </label>
                        <input 
                          type="text" 
                          value={invoiceId} 
                          onChange={e => {
                            let val = e.target.value.toUpperCase()
                            if (val && !val.startsWith('#')) {
                              val = '#' + val.replace(/^#+/, '')
                            }
                            setInvoiceId(val)
                          }}
                          onBlur={() => {
                            if (invoiceId.trim()) {
                              setInvoiceId(normalizeInvoiceIdFormat(invoiceId, isWood, invoiceDate))
                            }
                          }}
                          placeholder={isWood ? '#INV-W-260902' : '#INV-F-260902'}
                          className={cn(
                            "w-full bg-white dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold outline-none transition-all",
                            isValidInvoiceIdFormat(invoiceId)
                              ? "border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                              : "border-rose-400 dark:border-rose-600 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                          )}
                        />
                        {!isValidInvoiceIdFormat(invoiceId) && (
                          <p className="text-[10px] font-medium text-rose-500 ml-1">
                            Format required: {isWood ? '#INV-W-260902' : '#INV-F-260902'}
                          </p>
                        )}
                      </div>

                      {/* 2. Invoice Date (Editable) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 ml-1">
                          <Calendar size={13} className="text-slate-400" /> Invoice Date
                        </label>
                        <input 
                          type="date" 
                          value={invoiceDate} 
                          onChange={e => setInvoiceDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                      </div>

                      {/* 3. Staff Assignment ("Created By / Assigned Staff") */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 ml-1">
                          <User size={13} className="text-blue-500" /> Created By / Assigned Staff
                        </label>
                        <select 
                          value={createdBy}
                          onChange={e => setCreatedBy(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="">Unassigned</option>
                          {users.map(u => (
                            <option key={u.id} value={u.name}>{u.name} ({u.role || 'Staff'})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200/80 dark:bg-slate-700/60" />

                    {/* Customer Information: Streamlined, No Grid Headings, Prominent Name with Adjacent Phone and Address Below */}
                    <div className="space-y-3 pt-1">
                      {/* Top Row: Customer Name (Prominent) & Phone Number (Adjacent) */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                        {/* Customer Name Dropdown - Prominently Displayed */}
                        <div className="md:col-span-7 lg:col-span-8 space-y-1 relative">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <User size={13} className="text-amber-500" /> Customer Name
                            </label>
                            {oldDue > 0 && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 px-2 py-0.5 rounded-full">
                                Due: ৳{Math.round(oldDue).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold flex items-center justify-between cursor-pointer hover:border-amber-400 transition-colors shadow-sm"
                            onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                          >
                            <span className="truncate text-slate-900 dark:text-slate-100 font-bold">
                              {customerName || 'Select Customer'}
                            </span>
                            <ChevronDown size={16} className={cn("transition-transform text-slate-400 shrink-0 ml-1", isCustomerDropdownOpen && "rotate-180")} />
                          </div>
                          
                          {isCustomerDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[150] p-2 animate-in fade-in slide-in-from-top-2">
                              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl mb-2">
                                <Search size={14} className="text-slate-400 shrink-0" />
                                <input
                                  type="text"
                                  value={customerSearchTerm}
                                  onChange={e => setCustomerSearchTerm(e.target.value)}
                                  placeholder="Search customer name or phone..."
                                  className="bg-transparent border-none outline-none text-sm w-full font-bold"
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-[240px] overflow-y-auto space-y-1 scrollbar-thin px-1">
                                <div 
                                  className="p-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl cursor-pointer flex items-center gap-2.5 text-amber-600 font-bold text-xs"
                                  onClick={() => { setIsCustomerDropdownOpen(false); toast.info("Enter or select customer from master list.") }}
                                >
                                  <UserPlus size={16} /> Add / Enter Customer
                                </div>
                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                                {filteredCustomers.map(c => (
                                  <div key={c.id} onClick={() => selectCustomer(c)} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl cursor-pointer group flex items-center justify-between">
                                    <div className="min-w-0 pr-2">
                                      <p className="text-sm font-bold group-hover:text-amber-600 transition-colors truncate">{c.name}</p>
                                      <p className="text-xs text-slate-500 truncate">{c.phone || 'No phone'}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-xs font-bold text-slate-400 group-hover:text-amber-500 transition-colors">৳{Math.round(c.total_due || 0)}</p>
                                    </div>
                                  </div>
                                ))}
                                {filteredCustomers.length === 0 && (
                                  <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                                    No customers found
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Customer Phone Number - Adjacent to Name */}
                        <div className="md:col-span-5 lg:col-span-4 space-y-1">
                          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 ml-1">
                            <Phone size={12} className="text-slate-400" /> Phone Number
                          </label>
                          <div className="relative">
                            <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input 
                              type="text" 
                              readOnly 
                              disabled
                              value={customerPhone || 'No phone registered'} 
                              className="w-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-not-allowed select-none outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Customer Address - Below Them */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 ml-1">
                          <MapPin size={12} className="text-slate-400" /> Address / Location
                        </label>
                        <div className="relative">
                          <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input 
                            type="text" 
                            readOnly 
                            disabled
                            value={customerAddress || 'No address registered'} 
                            title={customerAddress || 'No address registered'}
                            className="w-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 cursor-not-allowed select-none outline-none truncate"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items Table Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Tag size={16} className="text-amber-500" /> Invoice Items
                      </h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleClearItems}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 dark:bg-rose-900/10 dark:text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-100 transition-all border border-rose-100 dark:border-rose-900/20"
                        >
                          <Eraser size={14} /> Clear All
                        </button>
                        <button 
                          onClick={handleAddItem}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md"
                        >
                          <Plus size={14} /> Add Item Row
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="py-3 px-4 text-left font-bold w-16">#</th>
                            <th className="py-3 px-4 text-left font-bold">Item Description & Type</th>
                            <th className="py-3 px-4 text-center font-bold w-24">{isWood ? 'CFT' : 'Qty'}</th>
                            <th className="py-3 px-4 text-right font-bold w-32">Price</th>
                            <th className="py-3 px-4 text-right font-bold w-32">Total</th>
                            <th className="py-3 px-4 text-center w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {items.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                              <td className="py-4 px-4">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-slate-400 font-mono font-bold text-xs">{idx + 1}</span>
                                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleMoveItem(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-amber-500 disabled:opacity-30">
                                      <ArrowUp size={12} />
                                    </button>
                                    <button onClick={() => handleMoveItem(idx, 'down')} disabled={idx === items.length - 1} className="p-0.5 text-slate-400 hover:text-amber-500 disabled:opacity-30">
                                      <ArrowDown size={12} />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-2 relative">
                                <div className="space-y-1">
                                  <div className="relative group/itemsearch">
                                    <input 
                                      type="text"
                                      value={item.name}
                                      onChange={e => {
                                        handleItemChange(idx, 'name', e.target.value)
                                        if (isWood) handleItemChange(idx, 'treeNo', e.target.value)
                                        setItemSearchTerm(e.target.value)
                                        setActiveItemSearchIdx(idx)
                                      }}
                                      onFocus={() => {
                                        setActiveItemSearchIdx(idx)
                                        setItemSearchTerm(item.name)
                                      }}
                                      placeholder="Search or enter item..."
                                      className="w-full bg-transparent border-none outline-none font-bold text-slate-800 dark:text-slate-200 px-2"
                                    />
                                    <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/itemsearch:text-amber-500" />
                                  </div>
                                  
                                  <div className="flex items-center gap-2 px-2">
                                    {item.product_id ? (
                                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase flex items-center gap-1">
                                        <Check size={8} /> Stock Item
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase">
                                        Custom Item
                                      </span>
                                    )}
                                    {isWood && item.carNo && (
                                      <span className="text-[9px] font-bold text-slate-400">Car: {item.carNo}</span>
                                    )}
                                    {isWood && item.tag && (
                                      <span className="text-[9px] font-bold text-slate-400">Tag: {item.tag}</span>
                                    )}
                                  </div>
                                </div>

                                {activeItemSearchIdx === idx && (
                                  <div className="absolute top-full left-0 w-[450px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[160] p-2 mt-1 animate-in fade-in slide-in-from-top-2">
                                    <div className="max-h-[300px] overflow-y-auto space-y-1 scrollbar-thin px-1">
                                      <div 
                                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl cursor-pointer text-slate-500 font-bold text-xs flex items-center justify-between group/manual"
                                        onClick={() => {
                                          handleItemChange(idx, 'product_id', null)
                                          handleItemChange(idx, 'isStock', false)
                                          setActiveItemSearchIdx(null)
                                        }}
                                      >
                                        <div className="flex items-center gap-2">
                                          <Edit3 size={14} className="text-slate-400 group-hover/manual:text-amber-500" />
                                          <span>Use as Custom / Non-Stock Item</span>
                                        </div>
                                        <CornerDownRight size={14} />
                                      </div>
                                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                                      
                                      <p className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Results</p>
                                      
                                      {filteredProducts.map(p => (
                                        <div key={p.id} onClick={() => selectProduct(p, idx)} className="p-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl cursor-pointer group/row flex items-center justify-between transition-colors">
                                          <div className="min-w-0">
                                            <p className="text-sm font-bold truncate group-hover/row:text-amber-600 transition-colors">
                                              {isWood ? `Log #${p.tree_no}` : p.name}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-medium">
                                              {isWood ? `Car: ${p.car_no} • W: ${p.width} • L: ${p.length} • Tag: ${p.tag}` : p.category}
                                            </p>
                                          </div>
                                          <div className="text-right shrink-0 ml-4">
                                            <p className="text-sm font-black text-amber-600">৳{p.price}</p>
                                            <div className="flex items-center justify-end gap-1 mt-0.5">
                                              <div className={cn("w-1.5 h-1.5 rounded-full", (p.stock > 0 || !p.is_sold) ? "bg-emerald-500" : "bg-rose-500")} />
                                              <p className={cn("text-[9px] font-bold uppercase", (p.stock > 0 || !p.is_sold) ? "text-emerald-500" : "text-rose-500")}>
                                                {isWood ? (p.is_sold ? "Sold" : "Available") : `${p.stock} In Stock`}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      {filteredProducts.length === 0 && (
                                        <div className="py-8 text-center">
                                          <AlertCircle size={24} className="mx-auto text-slate-200 mb-2" />
                                          <p className="text-[11px] text-slate-400 font-bold uppercase">No matching stock items</p>
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                      <button 
                                        onClick={() => setActiveItemSearchIdx(null)}
                                        className="text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-3 py-1.5 uppercase tracking-wider"
                                      >
                                        Close Search
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <input 
                                  type="number"
                                  value={isWood ? (item.cft ?? '') : (item.quantity ?? '')}
                                  onChange={e => handleItemChange(idx, isWood ? 'cft' : 'quantity', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-slate-100/50 dark:bg-slate-800 rounded-lg py-2 text-center font-mono font-bold text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                                  <input 
                                    type="number"
                                    value={item.price ?? ''}
                                    onChange={e => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-100/50 dark:bg-slate-800 rounded-lg py-2 pl-6 pr-2 text-right font-mono font-bold text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-4 text-right">
                                <p className="font-mono font-black text-slate-900 dark:text-slate-100">
                                  ৳{Math.round(item.total).toLocaleString()}
                                </p>
                              </td>
                              <td className="py-2 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => handleDuplicateItem(idx)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors" title="Duplicate Item">
                                    <Copy size={16} />
                                  </button>
                                  <button onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors" title="Remove Item">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Sidebar Summary Area */}
                <div className="space-y-6">
                  {/* Payment Info Section */}
                  <div className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
                      <DollarSign size={16} className="text-emerald-500" /> Payment & Status
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Payment Method</label>
                        <select 
                          value={paymentMethod} 
                          onChange={e => setPaymentMethod(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="bKash">bKash</option>
                          <option value="Nagad">Nagad</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Amount Paid (৳)</label>
                        <input 
                          type="number" 
                          value={paid ?? ''} 
                          onChange={e => setPaid(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-black text-emerald-600 outline-none focus:border-emerald-500"
                        />
                      </div>
                      {!isWood && (
                        <div className="pt-2">
                          <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-wider">Delivery Status</label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['Pending', 'Delivered'] as const).map(status => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setDeliveryStatus(status)}
                                className={cn(
                                  "py-2 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2",
                                  deliveryStatus === status 
                                    ? (status === 'Delivered' ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200")
                                    : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                )}
                              >
                                {status === 'Delivered' ? <Check size={14} /> : <Truck size={14} />}
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Breakdown Section */}
                  <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center text-slate-400 font-bold">
                        <span>Subtotal</span>
                        <span className="font-mono">৳{Math.round(itemsSubtotal).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold">Discount</span>
                          <div className="flex bg-slate-800 rounded-lg p-0.5">
                            <button onClick={() => setDiscountType('fixed')} className={cn("px-2 py-0.5 rounded text-[9px] font-black", discountType === 'fixed' ? "bg-amber-500 text-black" : "text-slate-400")}>৳</button>
                            <button onClick={() => setDiscountType('percent')} className={cn("px-2 py-0.5 rounded text-[9px] font-black", discountType === 'percent' ? "bg-amber-500 text-black" : "text-slate-400")}>%</button>
                          </div>
                        </div>
                        <input 
                          type="number" 
                          value={discount ?? ''} 
                          onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-800 border-none rounded-lg px-3 py-1 text-right font-mono font-black text-amber-400 outline-none"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">Delivery Charge</span>
                        <input 
                          type="number" 
                          value={deliveryCharge ?? ''} 
                          onChange={e => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-800 border-none rounded-lg px-3 py-1 text-right font-mono font-black text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="h-px bg-slate-800 my-4" />

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Grand Total</span>
                        <span className="text-2xl font-black font-mono text-white">৳{Math.round(grandTotal).toLocaleString()}</span>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">Paid</span>
                          <span className="text-emerald-400 font-mono font-black">৳{Math.round(paid).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">Current Invoice Due</span>
                          <span className="text-rose-400 font-mono font-black">৳{Math.round(currentDue).toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-white/10 my-2" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-amber-500">Total Outstanding</span>
                          <span className="text-base font-black font-mono text-amber-500">৳{Math.round(totalDue).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 flex gap-3">
                    <AlertCircle className="text-amber-600 shrink-0" size={18} />
                    <p className="text-[11px] text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                      Updating this invoice will recalculate the customer&apos;s account balance and may affect inventory stock levels.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
