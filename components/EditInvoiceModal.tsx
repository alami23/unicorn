'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { 
  X, Save, User, Plus, Trash2, Calendar, DollarSign, Phone, MapPin, 
  Truck, Tag, AlertCircle, Loader2, Check, Search, ChevronDown, 
  UserPlus, FileText, CornerDownRight, Hash, Edit3, 
  Copy, ArrowUp, ArrowDown, Eraser, ArrowUpDown, CheckSquare
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
  description?: string
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
  marked?: boolean
  seq?: number
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

  // POS Wood Multi-Select Modal States
  const [isWoodPickerOpen, setIsWoodPickerOpen] = useState(false)
  const [woodCategories, setWoodCategories] = useState<string[]>([])
  const [pickerSearchTerm, setPickerSearchTerm] = useState('')
  const [pickerCategory, setPickerCategory] = useState('All')
  const [pickerCarNo, setPickerCarNo] = useState('All')
  const [selectedPickerIds, setSelectedPickerIds] = useState<number[]>([])

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
  const [isDisplayReversed, setIsDisplayReversed] = useState(false)
  const initialProductIdsRef = useRef<Set<number>>(new Set())
  const removedProductIdsRef = useRef<Set<number>>(new Set())
  const lastClickedDisplayIdxRef = useRef<number | null>(null)

  // Manual Wood Entry States
  const [manualWidth, setManualWidth] = useState('')
  const [manualLength, setManualLength] = useState('')
  const [manualPrice, setManualPrice] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultWoodPrice') || ''
    }
    return ''
  })
  const manualWidthInputRef = useRef<HTMLInputElement>(null)
  const manualLengthInputRef = useRef<HTMLInputElement>(null)

  // Financials
  const [discount, setDiscount] = useState<number>(0)
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0)
  const [oldDue, setOldDue] = useState<number>(0)

  // Partial Payment Transactions State
  interface PaymentTransactionEntry {
    id: string
    dbId?: string
    date: string
    method: string
    amount: number
    type?: string
    notes?: string
    isNew?: boolean
  }
  const [paymentEntries, setPaymentEntries] = useState<PaymentTransactionEntry[]>([])
  const [pendingPaymentInput, setPendingPaymentInput] = useState<string>('')

  // Type detector & sales method
  const isWood = useMemo(() => {
    if (!invoice) return false
    return (
      invoice.originalType?.toLowerCase() === 'wood' || 
      invoice.originalType?.toLowerCase() === 'solo_wood' || 
      invoice.type?.toLowerCase() === 'wood' || 
      invoice.type?.toLowerCase() === 'solo_wood' ||
      invoice.sales_method?.toLowerCase() === 'pos wood' ||
      invoice.sales_method?.toLowerCase() === 'wood' ||
      invoice.id?.includes('-W-') ||
      invoice.invoice_number?.includes('-W-')
    )
  }, [invoice])

  const isPOSWood = useMemo(() => {
    if (!invoice) return false
    const methodStr = (invoice.sales_method || invoice.salesMethod || invoice.originalType || invoice.type || '').toLowerCase()
    const idStr = (invoice.invoice_number || invoice.id || invoiceId || '').toUpperCase()
    return isWood || methodStr.includes('wood') || idStr.includes('-W-')
  }, [invoice, isWood, invoiceId])

  interface SavedTag {
    id: string | number
    name: string
    sell_price: number
    color?: string
  }

  const [savedTags, setSavedTags] = useState<SavedTag[]>([])
  const savedTagsRef = useRef<SavedTag[]>([])
  useEffect(() => {
    savedTagsRef.current = savedTags
  }, [savedTags])

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
        if (settingsData?.settings) {
          setSettings(settingsData.settings)
          const defaultPrice = settingsData.settings?.system?.defaultWoodPrice
          if (defaultPrice !== undefined && defaultPrice !== null && defaultPrice !== '') {
            setManualPrice(String(defaultPrice))
          }
        }
        
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
            treeNo: p.tree_no || p.name || '',
            carNo: p.car_no || '',
            category: p.category || 'Wood',
            width: Number(p.width || 0),
            length: Number(p.length || 0),
            cft: Number(p.cft || 0),
            tag: p.tag || '',
            price: Number(p.sell_price || p.price || 0),
            sellPrice: Number(p.sell_price || p.price || 0),
            stock: p.is_sold ? 0 : Number(p.stock ?? 1),
            isSold: Boolean(p.is_sold)
          })))
        }

        if (isWood) {
          const { data: catData } = await supabase
            .from('wood_category')
            .select('name')
            .order('name', { ascending: true })
          if (catData) {
            setWoodCategories(catData.map((c: any) => c.name).filter(Boolean))
          }
        }

        const { data: tagData } = await supabase
          .from('wood_category_tag')
          .select('*')
          .order('name', { ascending: true })

        if (tagData && tagData.length > 0) {
          setSavedTags(tagData.map((t: any) => ({
            id: t.id,
            name: t.name,
            sell_price: Number(t.sell_price ?? t.sellPrice ?? t.price ?? 0),
            color: t.color
          })))
        }
      } catch (e) {
        console.warn('Failed to fetch initial data:', e)
      }
    }
    
    fetchInitialData()
  }, [isOpen, isWood])

  const getTagData = useCallback((tagName?: string): SavedTag | undefined => {
    if (!tagName) return undefined
    const cleanName = tagName.trim().toLowerCase()
    return savedTags.find(st => st.name.trim().toLowerCase() === cleanName)
  }, [savedTags])

  const getTagColor = useCallback((tagName?: string): string | null => {
    if (!tagName) return null
    const data = getTagData(tagName)
    if (data?.color) return data.color
    const normalized = tagName.trim().toLowerCase()
    if (normalized === 'premium') return '#f59e0b'
    if (normalized === 'standard') return '#3b82f6'
    if (normalized === 'economy') return '#22c55e'
    return null
  }, [getTagData])

  const getMatchingTagByPrice = useCallback((priceVal: number, tagsList: SavedTag[] = savedTagsRef.current): string | null => {
    const numericPrice = Number(priceVal)
    if (!numericPrice || isNaN(numericPrice) || numericPrice <= 0) return null
    const matched = tagsList.find(t => Number(t.sell_price) > 0 && Number(t.sell_price) === numericPrice)
    return matched ? matched.name : null
  }, [])

  const createEmptyItem = useCallback((woodMode: boolean, seqNum: number = 1): EditableItem => {
    return {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: null,
      product_type: woodMode ? 'wood' : 'furniture',
      name: '',
      description: '',
      quantity: 1,
      unit: woodMode ? 'CFT' : 'PCS',
      price: 0,
      total: 0,
      treeNo: '',
      carNo: woodMode ? 'M' : '',
      width: 0,
      length: 0,
      cft: 0,
      tag: '',
      isStock: false,
      marked: false,
      seq: seqNum
    }
  }, [])

  const normalizeItems = useCallback((rawItems: any[], woodMode: boolean): EditableItem[] => {
    // Sort items chronologically from first entry to last
    const chronologicalRaw = [...rawItems].sort((a, b) => {
      if (woodMode) {
        const treeA = String(a.treeNo || a.tree_no || a.name || '').trim()
        const treeB = String(b.treeNo || b.tree_no || b.name || '').trim()
        const matchA = /^M-(\d+)$/i.exec(treeA)
        const matchB = /^M-(\d+)$/i.exec(treeB)
        if (matchA && matchB) {
          return parseInt(matchA[1], 10) - parseInt(matchB[1], 10)
        }
      }
      const idA = Number(a.id)
      const idB = Number(b.id)
      if (!isNaN(idA) && !isNaN(idB) && idA !== idB) {
        return idA - idB
      }
      return 0
    })

    return chronologicalRaw.map((item, idx) => {
      const qty = Number(item.quantity || 1)
      const price = Number(item.price || item.sellPrice || 0)
      const width = item.width !== undefined && item.width !== null ? Number(item.width) : 0
      const length = item.length !== undefined && item.length !== null ? Number(item.length) : 0
      const cft = item.cft !== undefined && item.cft !== null ? Number(item.cft) : (qty || 0)
      const computedTotal = woodMode ? (cft * price) : (qty * price)

      let carNoVal = item.carNo || item.car_no || ''
      if (woodMode && ['solo', 'manual'].includes(carNoVal.trim().toLowerCase())) {
        carNoVal = 'M'
      }

      const rawProdId = Number(item.product_id || item.productId || 0)
      return {
        id: item.id || `item-${Date.now()}-${idx}`,
        product_id: rawProdId > 0 ? rawProdId : null,
        product_type: item.product_type || (woodMode ? 'wood' : 'furniture'),
        name: item.name || item.treeNo || item.tree_no || (woodMode ? 'Wood Item' : 'Furniture Item'),
        description: item.description || (woodMode ? (carNoVal ? `Car: ${carNoVal}` : '') : (item.category || '')),
        quantity: isNaN(qty) ? 1 : qty,
        unit: item.unit || (woodMode ? 'CFT' : 'PCS'),
        price: isNaN(price) ? 0 : price,
        total: Number(item.total) || computedTotal,
        treeNo: item.treeNo || item.tree_no || (woodMode ? item.name : ''),
        carNo: carNoVal,
        width,
        length,
        cft: isNaN(cft) ? 0 : cft,
        tag: woodMode
          ? (getMatchingTagByPrice(price) ?? (item.tag && item.tag !== '-' ? item.tag : ''))
          : (item.tag || ''),
        isStock: rawProdId > 0,
        marked: false,
        seq: idx + 1
      }
    })
  }, [getMatchingTagByPrice])

  const resolveWoodInventoryProductId = useCallback((item: EditableItem, productsList: any[] = allProducts): number => {
    const directId = Number(item.product_id || 0)
    if (directId > 0) return directId
    if (!isWood) return 0
    const treeVal = String(item.treeNo || item.name || '').trim().toLowerCase()
    if (!treeVal || /^m-\d+$/i.test(treeVal)) return 0
    const carVal = String(item.carNo || '').trim().toLowerCase()
    const matched = productsList.find(p => {
      const pTree = String(p.treeNo || p.tree_no || p.name || '').trim().toLowerCase()
      if (pTree !== treeVal) return false
      if (carVal && carVal !== 'm' && carVal !== 'manual' && carVal !== 'solo') {
        const pCar = String(p.carNo || p.car_no || '').trim().toLowerCase()
        if (pCar && pCar !== carVal) return false
      }
      return true
    })
    return matched ? Number(matched.id) : 0
  }, [allProducts, isWood])

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
        const normalized = normalizeItems(data, woodMode)
        normalized.forEach(it => {
          const pid = Number(it.product_id || 0)
          if (pid > 0) initialProductIdsRef.current.add(pid)
        })
        setItems(normalized)
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

    setIsDisplayReversed(false)
    initialProductIdsRef.current = new Set()
    removedProductIdsRef.current = new Set()
    lastClickedDisplayIdxRef.current = null

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
    setOldDue(Number(invoice.oldDue || 0))
    setPendingPaymentInput('')

    const initialInvoicePaid = Number(invoice.paid ?? invoice.paid_amount ?? 0)
    const defaultDateStr = invoice.date ? invoice.date.split('T')[0] : new Date().toISOString().split('T')[0]
    const defaultMethodStr = invoice.paymentMethod || invoice.payment_method || 'Cash'

    // Load existing partial payment transactions for this invoice
    supabase
      .from('transactions')
      .select('*')
      .eq('ref', invoice.id)
      .gt('credit', 0)
      .order('created_at', { ascending: true })
      .then(({ data: txns }) => {
        const loadedEntries: PaymentTransactionEntry[] = (txns || []).map((t: any, idx: number) => ({
          id: t.id || `txn-${idx}-${Date.now()}`,
          dbId: t.id,
          date: t.date || defaultDateStr,
          method: t.method || t.notes || defaultMethodStr,
          amount: Number(t.credit || 0),
          type: t.type || (idx === 0 ? 'Invoice' : 'Payment'),
          notes: t.notes || t.method || defaultMethodStr,
          isNew: false
        }))

        const recordedSum = loadedEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        if (initialInvoicePaid > recordedSum) {
          loadedEntries.unshift({
            id: `init-pay-${Date.now()}`,
            date: defaultDateStr,
            method: defaultMethodStr,
            amount: initialInvoicePaid - recordedSum,
            type: 'Invoice',
            notes: defaultMethodStr,
            isNew: true
          })
        }
        setPaymentEntries(loadedEntries)
      })

    // Always fetch items from DB so product_id is accurately loaded for stock restoration, with invoice.items as immediate fallback
    if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      const normalized = normalizeItems(invoice.items, isWood)
      normalized.forEach(it => {
        const pid = Number(it.product_id || 0)
        if (pid > 0) initialProductIdsRef.current.add(pid)
      })
      setItems(normalized)
      if (invoice.id) {
        fetchItemsFromDb(invoice.id, isWood)
      }
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

  // Backfill product_id for loaded wood items from wood_inventory if missing, and record initial stock IDs
  useEffect(() => {
    if (!isOpen || !isWood || allProducts.length === 0 || items.length === 0) return
    setItems(prev => {
      let changed = false
      const next = prev.map(item => {
        const resolvedId = resolveWoodInventoryProductId(item, allProducts)
        if (resolvedId > 0) {
          initialProductIdsRef.current.add(resolvedId)
          if (Number(item.product_id || 0) !== resolvedId) {
            changed = true
            return { ...item, product_id: resolvedId, isStock: true }
          }
        }
        return item
      })
      return changed ? next : prev
    })
  }, [isOpen, isWood, allProducts, items.length, resolveWoodInventoryProductId])

  // Automatically evaluate each line item's price against predefined price-tag rules when tags load
  useEffect(() => {
    if (!isOpen || !isWood || savedTags.length === 0) return
    setItems(prev => {
      let changed = false
      const next = prev.map(item => {
        const cleanCurrentTag = item.tag === '-' ? '' : (item.tag || '')
        const matchedTag = getMatchingTagByPrice(item.price, savedTags)
        const targetTag = matchedTag ?? cleanCurrentTag
        if (item.tag !== targetTag) {
          changed = true
          return { ...item, tag: targetTag }
        }
        return item
      })
      return changed ? next : prev
    })
  }, [isOpen, isWood, savedTags, getMatchingTagByPrice])

  // Real-time calculations
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
  }, [items])

  const displayedItems = useMemo(() => {
    const mapped = items.map((item, originalIndex) => ({ item, originalIndex }))
    return isDisplayReversed ? [...mapped].reverse() : mapped
  }, [items, isDisplayReversed])

  // Selected items & CFT calculations (auto-updates when markable boxes toggle)
  const selectedItems = useMemo(() => items.filter(it => it.marked), [items])
  const selectedCount = selectedItems.length
  const selectedTotalCft = useMemo(() => {
    return items
      .filter(it => it.marked)
      .reduce((sum, item) => sum + (Number(item.cft) || 0), 0)
  }, [items])

  const totalAllCft = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.cft) || 0), 0)
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

  const recordedPaymentsSum = useMemo(() => {
    return paymentEntries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)
  }, [paymentEntries])

  const paid = useMemo(() => {
    const pendingVal = parseFloat(pendingPaymentInput) || 0
    return Math.max(0, Math.round(recordedPaymentsSum + (pendingVal > 0 ? pendingVal : 0)))
  }, [recordedPaymentsSum, pendingPaymentInput])

  const isPaidExceedingGrandTotal = useMemo(() => {
    return paid > grandTotal
  }, [paid, grandTotal])

  const handleAddPartialPaymentEntry = () => {
    const amt = parseFloat(pendingPaymentInput) || 0
    if (amt <= 0) {
      toast.error('Please enter a valid payment amount greater than 0')
      return
    }
    const nextTotalPaid = Math.round(recordedPaymentsSum + amt)
    if (nextTotalPaid > grandTotal) {
      toast.error(`Total Paid (৳${nextTotalPaid.toLocaleString()}) cannot exceed Grand Total (৳${Math.round(grandTotal).toLocaleString()})`)
      return
    }
    const todayStr = new Date().toISOString().split('T')[0]
    const newEntry: PaymentTransactionEntry = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: todayStr,
      method: paymentMethod || 'Cash',
      amount: amt,
      type: paymentEntries.length === 0 ? 'Invoice' : 'Payment',
      notes: paymentMethod || 'Cash',
      isNew: true
    }
    setPaymentEntries(prev => [...prev, newEntry])
    setPendingPaymentInput('')
    toast.success(`Added partial payment of ৳${amt.toLocaleString()}`)
  }

  const handleUpdatePaymentEntry = (id: string, field: keyof PaymentTransactionEntry, value: any) => {
    setPaymentEntries(prev =>
      prev.map(entry =>
        entry.id === id
          ? {
              ...entry,
              [field]: field === 'amount' ? (parseFloat(value) || 0) : value
            }
          : entry
      )
    )
  }

  const handleRemovePaymentEntry = (id: string) => {
    setPaymentEntries(prev => prev.filter(entry => entry.id !== id))
  }

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
        current.carNo = ['solo', 'manual'].includes(p.car_no?.trim().toLowerCase() || '') ? 'M' : p.car_no
        current.treeNo = p.tree_no
        current.width = p.width
        current.length = p.length
        current.cft = p.cft
        current.tag = getMatchingTagByPrice(p.price, savedTags) || p.tag || current.tag
        current.description = p.car_no ? `Car: ${current.carNo}` : ''
        current.total = Math.round(Number(p.cft || 0) * Number(p.price || 0))
      } else {
        current.description = p.category || 'Stock Item'
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

      if (isWood && field === 'carNo' && typeof value === 'string' && ['solo', 'manual'].includes(value.trim().toLowerCase())) {
        current.carNo = 'M'
      }

      let updatedPrice = field === 'price' ? Number(value) || 0 : (Number(current.price) || 0)

      // When price is changed, automatically evaluate against price-tag rules and assign matching tag
      if (isWood && field === 'price') {
        const matchedTag = getMatchingTagByPrice(updatedPrice, savedTags)
        current.tag = matchedTag || ''
      }

      // When tag is changed, update price automatically from matching saved tag
      if (field === 'tag') {
        const matchingTag = savedTags.find(t => t.name.toLowerCase() === String(value).trim().toLowerCase())
        if (matchingTag && matchingTag.sell_price > 0) {
          updatedPrice = matchingTag.sell_price
          current.price = updatedPrice
        }
      }

      if (field === 'treeNo') {
        current.name = value
      } else if (field === 'name') {
        current.treeNo = value
      }

      if (isWood) {
        const w = field === 'width' ? Number(value) || 0 : (Number(current.width) || 0)
        const l = field === 'length' ? Number(value) || 0 : (Number(current.length) || 0)

        let cftVal = current.cft || 0
        if (field === 'width' || field === 'length') {
          if (w > 0 && l > 0) {
            cftVal = Number(((w * w * l) / 2304).toFixed(4))
            current.cft = cftVal
          }
        } else if (field === 'cft') {
          cftVal = Number(value) || 0
        }

        current.total = Math.round(cftVal * updatedPrice)
      } else {
        const qty = field === 'quantity' ? Number(value) || 0 : (Number(current.quantity) || 1)
        current.total = Math.round(qty * updatedPrice)
      }

      next[index] = current
      return next
    })
  }

  const handleAddItem = () => {
    if (isWood) {
      setSelectedPickerIds([])
      setPickerSearchTerm('')
      setIsWoodPickerOpen(true)
      return
    }
    setItems(prev => {
      const nextSeq = prev.length + 1
      const emptyItem = createEmptyItem(isWood, nextSeq)
      return [...prev, emptyItem]
    })
  }

  // Available POS Wood products for the selection modal (unsold items + items currently in this invoice)
  const existingProductIdsInInvoice = useMemo(() => {
    return new Set(items.map(it => Number(it.product_id)).filter(id => id > 0))
  }, [items])

  const posWoodInventoryList = useMemo(() => {
    if (!isWood) return []
    return allProducts.filter(p => !p.isSold || existingProductIdsInInvoice.has(Number(p.id)))
  }, [allProducts, isWood, existingProductIdsInInvoice])

  const pickerCategoryOptions = useMemo(() => {
    const set = new Set<string>(woodCategories)
    posWoodInventoryList.forEach(p => {
      if (p.category) set.add(p.category)
    })
    return ['All', ...Array.from(set)]
  }, [woodCategories, posWoodInventoryList])

  const pickerCarNoOptions = useMemo(() => {
    const set = new Set<string>()
    posWoodInventoryList.forEach(p => {
      if (p.carNo) set.add(String(p.carNo))
    })
    return ['All', ...Array.from(set)]
  }, [posWoodInventoryList])

  const filteredPosWoodProducts = useMemo(() => {
    const q = pickerSearchTerm.trim().toLowerCase()
    return posWoodInventoryList
      .filter(p => {
        const matchesSearch =
          !q ||
          String(p.treeNo || '').toLowerCase().includes(q) ||
          String(p.carNo || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q) ||
          String(p.tag || '').toLowerCase().includes(q)
        const matchesCategory = pickerCategory === 'All' || p.category === pickerCategory
        const matchesCarNo = pickerCarNo === 'All' || String(p.carNo) === pickerCarNo
        return matchesSearch && matchesCategory && matchesCarNo
      })
      .sort((a, b) =>
        String(a.treeNo || '').localeCompare(String(b.treeNo || ''), undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )
  }, [posWoodInventoryList, pickerSearchTerm, pickerCategory, pickerCarNo])

  const pickerFilteredTotalCft = useMemo(() => {
    return filteredPosWoodProducts.reduce((sum, p) => sum + (Number(p.cft) || 0), 0)
  }, [filteredPosWoodProducts])

  const handleTogglePickerItem = (productId: number) => {
    if (existingProductIdsInInvoice.has(productId)) {
      toast.info('This item is already in the current invoice')
      return
    }
    setSelectedPickerIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    )
  }

  const handleToggleSelectAllPickerItems = () => {
    const selectableIds = filteredPosWoodProducts
      .filter(p => !existingProductIdsInInvoice.has(Number(p.id)))
      .map(p => Number(p.id))
    if (selectableIds.length === 0) return

    const allSelected = selectableIds.every(id => selectedPickerIds.includes(id))
    if (allSelected) {
      setSelectedPickerIds(prev => prev.filter(id => !selectableIds.includes(id)))
    } else {
      setSelectedPickerIds(prev => Array.from(new Set([...prev, ...selectableIds])))
    }
  }

  const handleConfirmAddWoodItems = () => {
    if (selectedPickerIds.length === 0) {
      toast.error('Please select at least one item to add')
      return
    }

    const selectedProducts = selectedPickerIds
      .map(id => allProducts.find(p => Number(p.id) === Number(id)))
      .filter(Boolean)

    if (selectedProducts.length === 0) return

    setItems(prev => {
      const isSingleEmpty =
        prev.length === 1 &&
        !prev[0].treeNo &&
        !prev[0].name &&
        !prev[0].width &&
        !prev[0].length &&
        !prev[0].cft

      const baseItems = isSingleEmpty ? [] : [...prev]
      const newEditableItems: EditableItem[] = selectedProducts.map((prod, idx) => {
        const sellPrice = Number(prod.sellPrice ?? prod.sell_price ?? prod.price ?? 0)
        const cftVal = Number(prod.cft || 0)
        const matchedTag = getMatchingTagByPrice(sellPrice, savedTags) || prod.tag || ''
        const carVal = String(prod.carNo || prod.car_no || '').trim()
        const normalizedCar = ['solo', 'manual'].includes(carVal.toLowerCase()) ? 'M' : carVal

        return {
          id: `new-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          product_id: Number(prod.id),
          product_type: 'wood',
          name: String(prod.treeNo || prod.tree_no || prod.name || ''),
          description: normalizedCar ? `Car: ${normalizedCar}` : 'Stock Item',
          quantity: 1,
          unit: 'CFT',
          price: sellPrice,
          total: Math.round(cftVal * sellPrice),
          treeNo: String(prod.treeNo || prod.tree_no || prod.name || ''),
          carNo: normalizedCar,
          width: Number(prod.width || 0),
          length: Number(prod.length || 0),
          cft: cftVal,
          tag: matchedTag,
          isStock: true,
          marked: false,
          seq: baseItems.length + idx + 1
        }
      })

      return [...baseItems, ...newEditableItems].map((it, i) => ({
        ...it,
        seq: i + 1
      }))
    })

    toast.success(`${selectedProducts.length} item${selectedProducts.length > 1 ? 's' : ''} added to invoice`)
    setSelectedPickerIds([])
    setIsWoodPickerOpen(false)
  }

  const handleAddManualWoodItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const w = parseFloat(manualWidth) || 0
    const l = parseFloat(manualLength) || 0
    const p = parseFloat(manualPrice) || 0

    if (w <= 0 || l <= 0 || p <= 0) {
      toast.error('Please enter valid Width, Length, and Price')
      return
    }

    const cft = Number(((w * w * l) / 2304).toFixed(4))
    const total = Math.round(cft * p)

    const allTreeNos = [
      ...allProducts.map(prod => String(prod.tree_no || prod.name || '')),
      ...items.map(it => String(it.treeNo || it.name || ''))
    ]
    const mNumbers = allTreeNos
      .filter(no => no.startsWith('M-'))
      .map(no => parseInt(no.replace('M-', ''), 10))
      .filter(num => !isNaN(num))
    const nextCounter = mNumbers.length > 0 ? Math.max(...mNumbers) + 1 : 1
    const nextTreeNo = `M-${nextCounter}`

    const matchedTagName = getMatchingTagByPrice(p, savedTags) || ''

    setItems(prev => {
      const isSingleEmpty =
        prev.length === 1 &&
        !prev[0].treeNo &&
        !prev[0].name &&
        !prev[0].width &&
        !prev[0].length &&
        !prev[0].cft

      const nextSeq = isSingleEmpty ? 1 : prev.length + 1
      const newItem: EditableItem = {
        id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        product_id: null,
        product_type: 'wood',
        name: nextTreeNo,
        description: 'Car: M',
        quantity: 1,
        unit: 'CFT',
        price: p,
        total,
        treeNo: nextTreeNo,
        carNo: 'M',
        width: w,
        length: l,
        cft,
        tag: matchedTagName,
        isStock: false,
        marked: false,
        seq: nextSeq
      }

      if (isSingleEmpty) {
        return [newItem]
      }
      return [...prev, newItem]
    })

    setManualWidth('')
    setManualLength('')
    setTimeout(() => {
      manualWidthInputRef.current?.focus()
    }, 0)
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

  const handleReverseOrder = () => {
    if (items.length <= 1) return
    lastClickedDisplayIdxRef.current = null
    setIsDisplayReversed(prev => !prev)
  }

  const handleItemRowSelection = useCallback((
    displayIdx: number,
    originalIdx: number,
    e: React.MouseEvent,
    fromCheckbox: boolean = false
  ) => {
    const isShift = e.shiftKey
    const isCtrlOrMeta = e.ctrlKey || e.metaKey

    if (isShift && lastClickedDisplayIdxRef.current !== null) {
      const start = Math.min(lastClickedDisplayIdxRef.current, displayIdx)
      const end = Math.max(lastClickedDisplayIdxRef.current, displayIdx)
      const rangeOriginalIndices = new Set(
        displayedItems.slice(start, end + 1).map(d => d.originalIndex)
      )

      setItems(prev =>
        prev.map((it, idx) =>
          rangeOriginalIndices.has(idx) ? { ...it, marked: true } : it
        )
      )
      lastClickedDisplayIdxRef.current = displayIdx
      return
    }

    if (isCtrlOrMeta || fromCheckbox) {
      setItems(prev =>
        prev.map((it, idx) =>
          idx === originalIdx ? { ...it, marked: !it.marked } : it
        )
      )
      lastClickedDisplayIdxRef.current = displayIdx
      return
    }
  }, [displayedItems])

  const restoreStockForRemovedItems = useCallback(async (removedItems: EditableItem[]) => {
    if (!isWood || removedItems.length === 0) return

    const productIdsToRestore: number[] = []
    removedItems.forEach(item => {
      const resolvedId = resolveWoodInventoryProductId(item, allProducts)
      if (resolvedId > 0) {
        productIdsToRestore.push(resolvedId)
        removedProductIdsRef.current.add(resolvedId)
      }
    })

    if (productIdsToRestore.length === 0) return

    // Immediately update local POS Wood inventory state so available quantity increases right away
    setAllProducts(prev =>
      prev.map(p =>
        productIdsToRestore.includes(Number(p.id))
          ? { ...p, is_sold: false, isSold: false, stock: 1 }
          : p
      )
    )

    try {
      const { error } = await supabase
        .from('wood_inventory')
        .update({ is_sold: false })
        .in('id', productIdsToRestore)

      if (error) throw error

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('wood-inventory-updated'))
      }
      toast.success(
        productIdsToRestore.length === 1
          ? 'Item restored to POS Wood inventory'
          : `${productIdsToRestore.length} items restored to POS Wood inventory`
      )
    } catch (err) {
      console.error('Failed to restore item to wood_inventory:', err)
    }
  }, [isWood, allProducts, resolveWoodInventoryProductId])

  const handleClearItems = () => {
    if (confirm('Are you sure you want to clear all items?')) {
      const itemsToRestore = [...items]
      setItems([createEmptyItem(isWood)])
      void restoreStockForRemovedItems(itemsToRestore)
      toast.info('All items cleared')
    }
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('Invoice must contain at least one item')
      return
    }
    const removedItem = items[index]
    setItems(prev => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, seq: i + 1 })))
    if (removedItem) {
      void restoreStockForRemovedItems([removedItem])
    }
  }

  const handleSaveChanges = async () => {
    if (isSubmitting) return
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
    if (paid > grandTotal) {
      toast.error(`Total Paid (৳${Math.round(paid).toLocaleString()}) cannot exceed Grand Total (৳${Math.round(grandTotal).toLocaleString()})`)
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
        const chronologicalWoodItems = [...items].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
        const woodItemsToInsert = chronologicalWoodItems.map(item => {
          let carVal = item.carNo ? item.carNo.trim() : ''
          if (['solo', 'manual'].includes(carVal.toLowerCase()) || (!carVal && item.isStock === false)) {
            carVal = 'M'
          }
          return {
            invoice_id: targetDbId,
            product_type: 'wood',
            product_id: item.product_id || 0,
            name: (item.treeNo || item.name || '').trim(),
            price: Number(item.price) || 0,
            cft: Number(item.cft) || 0,
            tag: item.tag || null,
            car_no: carVal || null,
            width: Number(item.width) || null,
            length: Number(item.length) || null,
            total: Number(item.total) || 0
          }
        })
        const { error: insertItemsErr } = await supabase.from(itemsTable).insert(woodItemsToInsert)
        if (insertItemsErr) throw insertItemsErr

        const soldProductIds = chronologicalWoodItems
          .map(it => resolveWoodInventoryProductId(it, allProducts))
          .filter(id => id > 0)

        const soldSet = new Set(soldProductIds)
        const restoredProductIds = Array.from(
          new Set([
            ...Array.from(initialProductIdsRef.current),
            ...Array.from(removedProductIdsRef.current)
          ])
        ).filter(id => id > 0 && !soldSet.has(id))

        if (restoredProductIds.length > 0) {
          await supabase
            .from('wood_inventory')
            .update({ is_sold: false })
            .in('id', restoredProductIds)
        }

        if (soldProductIds.length > 0) {
          await supabase
            .from('wood_inventory')
            .update({ is_sold: true })
            .in('id', soldProductIds)
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('wood-inventory-updated'))
        }
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

      const previousDueRecorded = Number(invoice.due || invoice.due_amount || 0)
      const dueDifference = currentDue - previousDueRecorded

      let resolvedCustomerId: string | null = invoice.customer_id || null
      if (customerName && customerName !== 'Walk-in Customer') {
        const { data: customerRecord } = await supabase
          .from('customer')
          .select('id, total_due')
          .eq('name', customerName)
          .maybeSingle()

        if (customerRecord) {
          resolvedCustomerId = customerRecord.id
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

      // Sync Partial Payment Transactions in `transactions` table
      const finalPaymentEntries: PaymentTransactionEntry[] = [
        ...paymentEntries.filter(e => (Number(e.amount) || 0) > 0)
      ]
      const pendingVal = parseFloat(pendingPaymentInput) || 0
      if (pendingVal > 0) {
        finalPaymentEntries.push({
          id: `pay-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          method: paymentMethod || 'Cash',
          amount: pendingVal,
          type: finalPaymentEntries.length === 0 ? 'Invoice' : 'Payment',
          notes: paymentMethod || 'Cash',
          isNew: true
        })
      }

      await supabase.from('transactions').delete().eq('ref', invoice.id)
      if (isIdChanged && targetDbId !== invoice.id) {
        await supabase.from('transactions').delete().eq('ref', targetDbId)
      }

      if (finalPaymentEntries.length === 0) {
        await supabase.from('transactions').insert([{
          id: `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          customer_id: resolvedCustomerId,
          date: invoiceDate || new Date().toISOString().split('T')[0],
          type: 'Invoice',
          ref: targetDbId,
          debit: Number(grandTotal),
          credit: 0,
          balance: Number(currentDue),
          method: paymentMethod || 'Cash',
          notes: paymentMethod || 'Cash'
        }])
      } else {
        let runningBalance = Number(grandTotal)
        const txnRowsToInsert = finalPaymentEntries.map((entry, idx) => {
          const creditAmt = Number(entry.amount) || 0
          runningBalance = Math.max(0, runningBalance - creditAmt)
          return {
            id: entry.dbId || `TXN-${idx === 0 ? '' : 'P-'}${Date.now().toString(36).toUpperCase()}-${idx}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
            customer_id: resolvedCustomerId,
            date: entry.date || invoiceDate || new Date().toISOString().split('T')[0],
            type: idx === 0 ? 'Invoice' : 'Payment',
            ref: targetDbId,
            debit: idx === 0 ? Number(grandTotal) : 0,
            credit: creditAmt,
            balance: runningBalance,
            method: entry.method || paymentMethod || 'Cash',
            notes: entry.notes || entry.method || paymentMethod || 'Cash'
          }
        })
        await supabase.from('transactions').insert(txnRowsToInsert)
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
          className="bg-white dark:bg-slate-900 w-full max-w-7xl h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
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
                disabled={isSubmitting || isPaidExceedingGrandTotal}
                title={isPaidExceedingGrandTotal ? 'Total Paid cannot exceed Grand Total' : 'Save Changes'}
                className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="space-y-8">
                {/* Full-width Form Area (Metadata & Items Table) */}
                <div className="space-y-6">
                  {/* Top Section: Left Side (Customer Details + Invoice Metadata) | Right Side (Totals Breakdown) */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left Column: Customer Name, Phone Number, Address vertically, then Invoice ID, Invoice Date, Created By/Assigned Staff below */}
                      <div className="lg:col-span-6 space-y-5">
                        {/* Customer Information (Arranged Vertically) */}
                        <div className="space-y-3">
                          {/* 1. Customer Name Dropdown */}
                          <div className="space-y-1.5 relative">
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

                          {/* 2. Phone Number */}
                          <div className="space-y-1.5">
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

                          {/* 3. Address */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 ml-1">
                              <MapPin size={12} className="text-slate-400" /> Address
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

                        <div className="h-px bg-slate-200/80 dark:bg-slate-700/60" />

                        {/* Below Customer Details: Invoice ID, Invoice Date, Created By / Assigned Staff */}
                        <div className="space-y-3">
                          {/* Invoice ID */}
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

                          {/* Invoice Date */}
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

                          {/* Created By / Assigned Staff */}
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

                        {/* Quick Wood Entry (Width, Length, Price) */}
                        {isWood && (
                          <form
                            onSubmit={handleAddManualWoodItem}
                            className="bg-white/70 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-700/60"
                          >
                            <div className="flex items-end gap-2.5">
                              <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 block">Width</label>
                                <input
                                  ref={manualWidthInputRef}
                                  type="number"
                                  step="any"
                                  inputMode="decimal"
                                  enterKeyHint="next"
                                  placeholder="Width"
                                  value={manualWidth}
                                  onChange={e => setManualWidth(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      manualLengthInputRef.current?.focus()
                                    }
                                  }}
                                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 block">Length</label>
                                <input
                                  ref={manualLengthInputRef}
                                  type="number"
                                  step="any"
                                  inputMode="decimal"
                                  enterKeyHint="send"
                                  placeholder="Length"
                                  value={manualLength}
                                  onChange={e => setManualLength(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddManualWoodItem()
                                    }
                                  }}
                                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 block">Price</label>
                                <input
                                  type="number"
                                  step="any"
                                  inputMode="numeric"
                                  placeholder="Price"
                                  value={manualPrice}
                                  onChange={e => setManualPrice(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddManualWoodItem()
                                    }
                                  }}
                                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                              <button
                                type="submit"
                                className="p-2.5 h-[42px] w-[42px] bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors shadow-sm flex items-center justify-center shrink-0"
                                title="Add to List"
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                          </form>
                        )}
                      </div>

                      {/* Right Column: Totals Breakdown (Total CFT, Subtotal, Discount, Delivery Charge, Grand Total, Paid Amount, Total Due) */}
                      <div className="lg:col-span-6 lg:border-l lg:border-slate-200/80 lg:dark:border-slate-700/60 lg:pl-6">
                        <div className="space-y-3.5 py-1">
                          {/* Total CFT */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total CFT</span>
                            <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">{Number(totalAllCft.toFixed(2))} CFT</span>
                          </div>

                          {/* Subtotal */}
                          <div className="flex items-center justify-between py-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subtotal</span>
                            <span className="text-xl font-black font-mono text-slate-900 dark:text-slate-100">৳{Math.round(itemsSubtotal).toLocaleString()}</span>
                          </div>

                          <div className="h-px bg-slate-200 dark:bg-slate-800" />

                          {/* Discount */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Discount</span>
                              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                                <button
                                  type="button"
                                  onClick={() => setDiscountType('fixed')}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-black transition-colors",
                                    discountType === 'fixed' ? "bg-amber-500 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  )}
                                >
                                  ৳
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDiscountType('percent')}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-black transition-colors",
                                    discountType === 'percent' ? "bg-amber-500 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  )}
                                >
                                  %
                                </button>
                              </div>
                            </div>
                            <input 
                              type="number" 
                              value={discount ?? ''} 
                              onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                              className="w-40 sm:w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-right font-mono font-black text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500"
                            />
                          </div>

                          {/* Delivery Charge */}
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Delivery Charge</span>
                            <input 
                              type="number" 
                              value={deliveryCharge ?? ''} 
                              onChange={e => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                              className="w-40 sm:w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-right font-mono font-black text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="h-px bg-slate-200 dark:bg-slate-800" />

                          {/* Grand Total */}
                          <div
                            onClick={() => {
                              const remainingToPay = Math.max(0, Math.round(grandTotal - recordedPaymentsSum))
                              setPendingPaymentInput(String(remainingToPay > 0 ? remainingToPay : Math.round(grandTotal)))
                            }}
                            title="Click to auto-fill Paid Amount"
                            className="flex items-center justify-between py-1 px-2 -mx-2 rounded-xl cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors select-none"
                          >
                            <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Grand Total</span>
                            <span className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">৳{Math.round(grandTotal).toLocaleString()}</span>
                          </div>

                          {/* Paid Amount (Input Box + Partial Payments Support) */}
                          <div className="space-y-2.5 pt-1">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Paid Amount</span>
                                {paid > 0 && (
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] font-mono font-black border",
                                      isPaidExceedingGrandTotal
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    )}
                                  >
                                    Total: ৳{Math.round(paid).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="any"
                                  value={pendingPaymentInput}
                                  onChange={e => setPendingPaymentInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddPartialPaymentEntry()
                                    }
                                  }}
                                  placeholder="0"
                                  className={cn(
                                    "w-40 sm:w-48 bg-white dark:bg-slate-800 border rounded-xl px-3.5 py-1.5 text-right font-mono font-black outline-none transition-colors",
                                    isPaidExceedingGrandTotal
                                      ? "border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-600"
                                      : "border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 focus:border-emerald-500"
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={handleAddPartialPaymentEntry}
                                  disabled={isPaidExceedingGrandTotal}
                                  className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-xs flex items-center justify-center shrink-0"
                                  title="Add Payment Entry"
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                            </div>

                            {isPaidExceedingGrandTotal && (
                              <div className="flex items-center justify-end gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-bold bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl px-3 py-2">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>
                                  Total Paid (৳{Math.round(paid).toLocaleString()}) cannot exceed Grand Total (৳{Math.round(grandTotal).toLocaleString()}).
                                </span>
                              </div>
                            )}

                            {/* Recorded Partial Payment Transaction Entries */}
                            {paymentEntries.length > 0 && (
                              <div className="space-y-1.5 pl-2 border-l-2 border-emerald-500/30">
                                {paymentEntries.map((entry, idx) => (
                                  <div
                                    key={entry.id}
                                    className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-xl px-3 py-1.5 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                        #{idx + 1}
                                      </span>
                                      <input
                                        type="date"
                                        value={entry.date}
                                        onChange={e => handleUpdatePaymentEntry(entry.id, 'date', e.target.value)}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                                      />
                                      <select
                                        value={entry.method}
                                        onChange={e => handleUpdatePaymentEntry(entry.id, 'method', e.target.value)}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                                      >
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Card</option>
                                        <option value="bKash">bKash</option>
                                        <option value="Nagad">Nagad</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        step="any"
                                        value={entry.amount ?? ''}
                                        onChange={e => handleUpdatePaymentEntry(entry.id, 'amount', e.target.value)}
                                        className="w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePaymentEntry(entry.id)}
                                        className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                                        title="Remove payment entry"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Current Due Amount (Specific to this invoice) */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Current Due Amount
                            </span>
                            <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                              ৳{Math.round(currentDue).toLocaleString()}
                            </span>
                          </div>

                          {/* Total Due (Current Invoice Due + Previous Outstanding Balance) */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-slate-800">
                            <div className="space-y-0.5">
                              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-500 block">
                                Total Due
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                                Current Due: ৳{Math.round(currentDue).toLocaleString()} + Previous Due: ৳{Math.round(oldDue).toLocaleString()}
                              </span>
                            </div>
                            <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                              ৳{Math.round(totalDue).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items Table Section */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Tag size={16} className="text-amber-500" /> Invoice Items
                        </h3>
                        <button
                          type="button"
                          onClick={handleReverseOrder}
                          disabled={items.length <= 1}
                          className={cn(
                            "flex items-center justify-center p-2 text-xs font-bold rounded-xl transition-all border disabled:opacity-40 disabled:cursor-not-allowed shadow-xs",
                            isDisplayReversed
                              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                              : "text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 border-slate-200 dark:border-slate-700"
                          )}
                          title="Reverse displayed item order"
                          aria-label="Reverse displayed item order"
                        >
                          <ArrowUpDown size={14} className="text-amber-600 dark:text-amber-400" />
                        </button>

                        {isWood && (
                          <>
                            {/* Display Area for Total CFT of Selected Items */}
                            <div 
                              className={cn(
                                "flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs",
                                selectedCount > 0 
                                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400/30" 
                                  : "bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400"
                              )}
                              title={`${selectedCount} items selected`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "w-2 h-2 rounded-full transition-colors",
                                  selectedCount > 0 ? "bg-amber-500 animate-pulse" : "bg-slate-400"
                                )} />
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                  Selected CFT:
                                </span>
                              </div>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                                  {selectedTotalCft.toFixed(2)}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  CFT
                                </span>
                              </div>
                              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 border-l border-slate-200 dark:border-slate-700 pl-2">
                                {selectedCount} of {items.length} selected
                              </span>
                            </div>

                            {/* Display Area for Total Items CFT */}
                            <div 
                              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all shadow-xs"
                              title={`Total across all ${items.length} items`}
                            >
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Total Items ({items.length}) CFT:
                              </span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                                  {totalAllCft.toFixed(2)}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  CFT
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleAddItem}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md"
                        >
                          <Plus size={14} /> Add Item Row
                        </button>
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm table-fixed border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs">
                          <tr>
                            {/* 1. The Markable Box */}
                            <th className="py-3 px-2 text-center w-10">
                              <input 
                                type="checkbox" 
                                ref={el => {
                                  if (el) {
                                    el.indeterminate = items.some(it => it.marked) && !items.every(it => it.marked)
                                  }
                                }}
                                checked={items.length > 0 && items.every(it => it.marked)}
                                onChange={e => {
                                  const isChecked = e.target.checked
                                  setItems(prev => prev.map(it => ({ ...it, marked: isChecked })))
                                }}
                                className="rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer accent-amber-600"
                                title={items.every(it => it.marked) ? "Deselect all items" : "Select all items"}
                              />
                            </th>

                            {/* 2. No */}
                            <th className="py-3 px-1 text-center font-bold w-10 text-slate-500 dark:text-slate-400">No</th>

                            {isWood ? (
                              <>
                                {/* 3. Car */}
                                <th className="py-3 px-1 text-center font-bold w-[8%]">Car</th>

                                {/* 4. Tree */}
                                <th className="py-3 px-1 text-center font-bold w-[11%]">Tree</th>

                                {/* 5. W */}
                                <th className="py-3 px-1.5 text-center font-bold w-[7%]">W</th>

                                {/* 6. L */}
                                <th className="py-3 px-1.5 text-center font-bold w-[7%]">L</th>

                                {/* 7. CFT */}
                                <th className="py-3 px-1.5 text-center font-bold w-[9%]">CFT</th>

                                {/* 8. Tag */}
                                <th className="py-3 px-2 text-center font-bold w-[15%]">Tag</th>

                                {/* 9. Price */}
                                <th className="py-3 px-1 text-center font-bold w-[8%]">Price</th>

                                {/* 10. Total */}
                                <th className="py-3 px-2 text-right font-bold w-[12%]">Total</th>
                              </>
                            ) : (
                              <>
                                <th className="py-3 px-2.5 text-left font-bold w-[34%]">Item Name</th>
                                <th className="py-3 px-2.5 text-left font-bold w-[28%]">Description</th>
                                <th className="py-3 px-2.5 text-center font-bold w-[8%]">Qty</th>
                                <th className="py-3 px-2.5 text-center font-bold w-[10%]">Price</th>
                                <th className="py-3 px-2.5 text-right font-bold w-[11%]">Total</th>
                              </>
                            )}

                            {/* 11. Actions */}
                            <th className="py-3 px-2 text-center font-bold w-14">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {displayedItems.map(({ item, originalIndex: idx }, displayIdx) => {
                            const itemTagColor = getTagColor(item.tag)
                            return (
                            <tr
                              key={item.id || idx}
                              onClick={e => {
                                const target = e.target as HTMLElement
                                const isInteractive = Boolean(target.closest('button, select, option'))
                                const isCheckbox = Boolean(target.closest('input[type="checkbox"]'))
                                const isTextOrNumberInput = Boolean(
                                  target.closest('input:not([type="checkbox"])')
                                )

                                if (isCheckbox || isInteractive) return

                                // Allow Shift-click or Ctrl/Cmd-click anywhere on the row (even over inputs)
                                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                  e.preventDefault()
                                  if (e.shiftKey && typeof window !== 'undefined') {
                                    window.getSelection()?.removeAllRanges()
                                  }
                                  handleItemRowSelection(displayIdx, idx, e, false)
                                  return
                                }

                                // Clicking non-input cells (like No, Total, or row padding) toggles the item
                                if (!isTextOrNumberInput) {
                                  handleItemRowSelection(displayIdx, idx, e, true)
                                } else {
                                  // Update anchor row when focusing/clicking an input normally
                                  lastClickedDisplayIdxRef.current = displayIdx
                                }
                              }}
                              className={cn(
                                "hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group cursor-pointer",
                                item.marked && "bg-amber-50/60 dark:bg-amber-900/15"
                              )}
                            >
                              {/* 1. The Markable Box */}
                              <td className="py-2.5 px-2 text-center w-10">
                                <input 
                                  type="checkbox"
                                  checked={!!item.marked}
                                  onClick={e => {
                                    e.stopPropagation()
                                    if (e.shiftKey && typeof window !== 'undefined') {
                                      window.getSelection()?.removeAllRanges()
                                    }
                                    handleItemRowSelection(displayIdx, idx, e, true)
                                  }}
                                  onChange={() => {}}
                                  className="rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer accent-amber-600"
                                  title="Click to toggle, Shift+Click to select range, Ctrl+Click to multi-select"
                                />
                              </td>

                              {/* 2. No */}
                              <td className="py-2.5 px-1 text-center font-mono font-bold text-xs text-slate-400 dark:text-slate-500 select-none">
                                {idx + 1}
                              </td>

                              {isWood ? (
                                <>
                                  {/* 3. Car */}
                                  <td className="py-2.5 px-1 text-center">
                                    <input 
                                      type="text"
                                      value={['solo', 'manual'].includes(item.carNo?.trim().toLowerCase() || '') ? 'M' : (item.carNo ?? '')}
                                      onChange={e => {
                                        let val = e.target.value
                                        if (['solo', 'manual'].includes(val.trim().toLowerCase())) val = 'M'
                                        handleItemChange(idx, 'carNo', val)
                                      }}
                                      placeholder="Car #"
                                      className="w-full max-w-[64px] mx-auto bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 px-1.5 text-center font-mono font-bold text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-amber-500 truncate"
                                    />
                                  </td>

                                  {/* 4. Tree (Direct inline text editing) */}
                                  <td className="py-2.5 px-1 text-center">
                                    <input 
                                      type="text"
                                      value={item.treeNo || item.name || ''}
                                      onChange={e => {
                                        handleItemChange(idx, 'treeNo', e.target.value)
                                        handleItemChange(idx, 'name', e.target.value)
                                      }}
                                      placeholder="Tree #"
                                      className="w-full max-w-[90px] mx-auto bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200 text-xs outline-none focus:ring-1 focus:ring-amber-500 truncate"
                                    />
                                  </td>

                                  {/* 5. W */}
                                  <td className="py-2.5 px-1.5 text-center">
                                    <input 
                                      type="number"
                                      step="any"
                                      value={item.width ?? ''}
                                      onChange={e => handleItemChange(idx, 'width', parseFloat(e.target.value) || 0)}
                                      placeholder="W"
                                      className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 text-center font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </td>

                                  {/* 6. L */}
                                  <td className="py-2.5 px-1.5 text-center">
                                    <input 
                                      type="number"
                                      step="any"
                                      value={item.length ?? ''}
                                      onChange={e => handleItemChange(idx, 'length', parseFloat(e.target.value) || 0)}
                                      placeholder="L"
                                      className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 text-center font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </td>

                                  {/* 7. CFT */}
                                  <td className="py-2.5 px-1.5 text-center">
                                    <input 
                                      type="number"
                                      step="any"
                                      value={item.cft ?? ''}
                                      onChange={e => handleItemChange(idx, 'cft', parseFloat(e.target.value) || 0)}
                                      placeholder="CFT"
                                      className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 text-center font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </td>

                                  {/* 8. Tag */}
                                  <td className="py-2.5 px-1.5 text-center">
                                    <div className="relative flex items-center">
                                      <span 
                                        className="absolute left-2 w-2.5 h-2.5 rounded-full shrink-0 shadow-xs pointer-events-none ring-1 ring-white/70 dark:ring-black/40 z-10 bg-slate-300 dark:bg-slate-600 transition-colors" 
                                        style={itemTagColor ? { backgroundColor: itemTagColor } : undefined}
                                        aria-hidden="true"
                                      />
                                      <select 
                                        value={item.tag ?? ''}
                                        onChange={e => handleItemChange(idx, 'tag', e.target.value)}
                                        className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 pl-6 pr-6 text-center font-bold text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none truncate transition-all"
                                        title="Choose saved tag (updates price automatically)"
                                      >
                                        <option value="" className="text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 font-normal">
                                          No Tag
                                        </option>
                                        {savedTags.map(st => (
                                          <option 
                                            key={st.id || st.name} 
                                            value={st.name}
                                            className="font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900"
                                          >
                                            {st.name} {st.sell_price > 0 ? `(৳${st.sell_price})` : ''}
                                          </option>
                                        ))}
                                        {item.tag && !savedTags.some(st => st.name.toLowerCase() === item.tag?.toLowerCase()) && (
                                          <option value={item.tag} className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
                                            {item.tag}
                                          </option>
                                        )}
                                      </select>
                                      <ChevronDown 
                                        size={12} 
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors" 
                                      />
                                    </div>
                                  </td>

                                  {/* 9. Price */}
                                  <td className="py-2.5 px-1 text-center">
                                    <input 
                                      type="number"
                                      step="any"
                                      value={item.price ?? ''}
                                      onChange={e => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      className="w-full max-w-[68px] mx-auto bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 px-1.5 text-center font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </td>

                                  {/* 10. Total */}
                                  <td className="py-2.5 px-2 text-right">
                                    <p className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs truncate">
                                      ৳{Math.round(item.total).toLocaleString()}
                                    </p>
                                  </td>
                                </>
                              ) : (
                                <>
                                  {/* Furniture Items */}
                                  <td className="py-2.5 px-2.5 relative">
                                    <div className="relative group/itemsearch">
                                      <input 
                                        type="text"
                                        value={item.name}
                                        onChange={e => {
                                          handleItemChange(idx, 'name', e.target.value)
                                          setItemSearchTerm(e.target.value)
                                          setActiveItemSearchIdx(idx)
                                        }}
                                        onFocus={() => {
                                          setActiveItemSearchIdx(idx)
                                          setItemSearchTerm(item.name)
                                        }}
                                        placeholder="Search or enter item name..."
                                        className="w-full bg-transparent border-none outline-none font-bold text-slate-800 dark:text-slate-200 text-sm px-1 py-1 pr-6 truncate"
                                      />
                                      <Search size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/itemsearch:text-amber-500 pointer-events-none" />
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2.5">
                                    <input 
                                      type="text"
                                      value={item.description ?? ''}
                                      onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                      placeholder={item.isStock ? 'Stock Item' : 'Description...'}
                                      className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-amber-500 truncate"
                                    />
                                  </td>
                                  <td className="py-2.5 px-2.5 text-center">
                                    <input 
                                      type="number"
                                      value={item.quantity ?? ''}
                                      onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                      placeholder="Qty"
                                      className="w-full bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 text-center font-mono font-bold text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </td>
                                  <td className="py-2.5 px-2.5 text-center">
                                    <input 
                                      type="number"
                                      value={item.price ?? ''}
                                      onChange={e => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      className="w-full max-w-[72px] mx-auto bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg py-1.5 px-1.5 text-center font-mono font-bold text-sm outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </td>
                                  <td className="py-2.5 px-2.5 text-right">
                                    <p className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                                      ৳{Math.round(item.total).toLocaleString()}
                                    </p>
                                  </td>
                                </>
                              )}

                              {/* 9. Actions */}
                              <td className="py-2.5 px-2 text-center w-14">
                                <div className="flex items-center justify-center">
                                  <button 
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)} 
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" 
                                    title="Delete Item"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* POS Wood Item Selection Modal */}
          <AnimatePresence>
            {isWood && isWoodPickerOpen && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[85vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
                >
                  {/* Modal Header */}
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <CheckSquare size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                          POS Wood Inventory Selection
                        </h3>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Select one or more items from POS Wood to add to this invoice
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsWoodPickerOpen(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Filter Controls */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      {/* Search */}
                      <div className="sm:col-span-5 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          type="text"
                          value={pickerSearchTerm}
                          onChange={e => setPickerSearchTerm(e.target.value)}
                          placeholder="Search by Tree No, Car No, Tag..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          autoFocus
                        />
                      </div>

                      {/* Category Filter */}
                      <div className="sm:col-span-3">
                        <select
                          value={pickerCategory}
                          onChange={e => setPickerCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                        >
                          {pickerCategoryOptions.map(cat => (
                            <option key={cat} value={cat}>
                              {cat === 'All' ? 'All Categories' : cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Car No Filter */}
                      <div className="sm:col-span-2">
                        <select
                          value={pickerCarNo}
                          onChange={e => setPickerCarNo(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                        >
                          {pickerCarNoOptions.map(cn => (
                            <option key={cn} value={cn}>
                              {cn === 'All' ? 'All Car No' : cn}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Total CFT Badge */}
                      <div className="sm:col-span-2 flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">CFT</span>
                        <span className="text-xs font-mono font-black text-amber-700 dark:text-amber-300">
                          {pickerFilteredTotalCft.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* POS Wood Items Table */}
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="py-2.5 px-3 text-center w-10">
                            <input
                              type="checkbox"
                              checked={
                                filteredPosWoodProducts.some(p => !existingProductIdsInInvoice.has(Number(p.id))) &&
                                filteredPosWoodProducts
                                  .filter(p => !existingProductIdsInInvoice.has(Number(p.id)))
                                  .every(p => selectedPickerIds.includes(Number(p.id)))
                              }
                              onChange={handleToggleSelectAllPickerItems}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              title="Select All Available"
                            />
                          </th>
                          <th className="py-2.5 px-2 text-center w-12">No</th>
                          <th className="py-2.5 px-3">Car</th>
                          <th className="py-2.5 px-3">TREE</th>
                          <th className="py-2.5 px-2 text-center">W</th>
                          <th className="py-2.5 px-2 text-center">L</th>
                          <th className="py-2.5 px-3 text-center">CFT</th>
                          <th className="py-2.5 px-3 text-center">Tag</th>
                          <th className="py-2.5 px-4 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                        {filteredPosWoodProducts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                              No wood items found matching your filter.
                            </td>
                          </tr>
                        ) : (
                          filteredPosWoodProducts.map((product, index) => {
                            const prodId = Number(product.id)
                            const isAlreadyInInvoice = existingProductIdsInInvoice.has(prodId)
                            const isSelected = selectedPickerIds.includes(prodId)
                            const effectiveTag =
                              getMatchingTagByPrice(Number(product.sellPrice || 0), savedTags) || product.tag || ''
                            const tagColor = getTagColor(effectiveTag)

                            return (
                              <tr
                                key={prodId}
                                onClick={() => handleTogglePickerItem(prodId)}
                                className={cn(
                                  'transition-colors cursor-pointer select-none',
                                  isAlreadyInInvoice
                                    ? 'bg-slate-100/70 dark:bg-slate-800/40 opacity-60 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-amber-500/15 dark:bg-amber-500/20 hover:bg-amber-500/20'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                )}
                              >
                                <td
                                  className="py-2.5 px-3 text-center"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={isAlreadyInInvoice}
                                    checked={isSelected || isAlreadyInInvoice}
                                    onChange={() => handleTogglePickerItem(prodId)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono text-[11px] font-bold text-slate-400">
                                  {index + 1}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-400">
                                  {product.carNo || '-'}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span>{product.treeNo}</span>
                                    {isAlreadyInInvoice && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                                        In Invoice
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono text-slate-600 dark:text-slate-300">
                                  {product.width}
                                </td>
                                <td className="py-2.5 px-2 text-center font-mono text-slate-600 dark:text-slate-300">
                                  {product.length}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {Number(product.cft || 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {effectiveTag ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase border"
                                      style={
                                        tagColor
                                          ? {
                                              backgroundColor: `${tagColor}18`,
                                              color: tagColor,
                                              borderColor: `${tagColor}40`
                                            }
                                          : undefined
                                      }
                                    >
                                      {effectiveTag}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 dark:text-slate-600">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {Number(product.sellPrice || 0) > 0
                                    ? `৳${Number(product.sellPrice).toLocaleString()}`
                                    : '-'}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="font-bold text-slate-500">Selected: </span>
                        <span className="font-black text-amber-600 dark:text-amber-400">
                          {selectedPickerIds.length} item{selectedPickerIds.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500">Selected CFT: </span>
                        <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                          {selectedPickerIds
                            .reduce((acc, id) => {
                              const found = allProducts.find(p => Number(p.id) === Number(id))
                              return acc + (Number(found?.cft) || 0)
                            }, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setItems(prev => [...prev, createEmptyItem(true, prev.length + 1)])
                          setIsWoodPickerOpen(false)
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                      >
                        + Blank Row
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsWoodPickerOpen(false)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={selectedPickerIds.length === 0}
                        onClick={handleConfirmAddWoodItems}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-600/20 transition-all"
                      >
                        <Plus size={14} />
                        Add Selected ({selectedPickerIds.length})
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
