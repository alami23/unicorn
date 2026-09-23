'use client'

import React, { useState, useEffect, Suspense, useRef } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Plus, Minus, Trash2, Printer, ShoppingCart, Filter, Pencil, Check, X, Upload, UserPlus, RotateCcw, ChevronDown, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn, safeParse } from '@/lib/utils'
import AddCustomerModal from '@/components/AddCustomerModal'
import InvoiceModal from '@/components/InvoiceModal'
import AlertPopup from '@/components/AlertPopup'
import { sendSMS } from '@/lib/sms'
import { supabase, getTenantId, getCurrentUser } from '@/lib/supabase'
import { addNotification } from '@/lib/notifications'
import { generateInvoiceId, getDisplayInvoiceId, generateSecretToken, generatePublicInvoiceUrl, getInvoiceDateString } from '@/lib/invoice'
import { recordInvoiceCreator } from '@/lib/invoiceCache'
import { toast } from 'sonner'
import { useSearchParams } from 'next/navigation'

interface WoodProduct {
  id: number
  category: string
  treeNo: string
  carNo: string
  width: number
  length: number
  cft: number
  tag: string
  sellPrice: number
  buyPrice?: number
  stock: number
  unit: string
  isSold?: boolean
}

const initialWoodProducts: WoodProduct[] = [
  { id: 1, category: 'Wood', treeNo: 'S-101', carNo: 'Solo', width: 24, length: 12, cft: 3.000000, tag: 'Solo', sellPrice: 1500, stock: 1, unit: 'cu ft' },
  { id: 2, category: 'Wood', treeNo: 'S-102', carNo: 'Solo', width: 12, length: 8, cft: 0.500000, tag: 'Solo', sellPrice: 1200, stock: 1, unit: 'cu ft' },
]

function SoloWoodContent() {
  const searchParams = useSearchParams()
  const customerFromQuery = searchParams?.get('customer')

  const [products, setProducts] = useState<WoodProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const fetchSoloInventory = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('wood_inventory')
        .select('*')
        .eq('car_no', 'Solo')
        .eq('is_sold', false)
      
      if (error) throw error
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          category: p.category,
          treeNo: p.tree_no,
          carNo: p.car_no,
          width: Number(p.width),
          length: Number(p.length),
          cft: Number(p.cft),
          tag: p.tag || '',
          sellPrice: Number(p.sell_price),
          buyPrice: Number(p.buy_price),
          stock: p.is_sold ? 0 : 1,
          unit: p.unit || 'pcs'
        })))
      }
    } catch (error) {
      console.error('Error fetching solo wood inventory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSoloInventory()
  }, [])

  const [cart, setCart] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('Walk-in Customer')
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
  const [deliveryCharge, setDeliveryCharge] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [availableMethods, setAvailableMethods] = useState<string[]>(['Cash', 'Card', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Other'])
  const [checkoutError, setCheckoutError] = useState('')
  const [manualWidth, setManualWidth] = useState('')
  const [manualLength, setManualLength] = useState('')
  const [manualPrice, setManualPrice] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultWoodPrice') || ''
    }
    return ''
  })
  const [manualCounter, setManualCounter] = useState(1)
  const [tags, setTags] = useState<any[]>([])
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'error'
  })
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

  const widthInputRef = useRef<HTMLInputElement>(null)
  const lengthInputRef = useRef<HTMLInputElement>(null)
  const discountInputRef = useRef<HTMLInputElement>(null)
  const deliveryInputRef = useRef<HTMLInputElement>(null)
  const paidInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (customerFromQuery) {
      setSelectedCustomer(customerFromQuery)
    }
  }, [customerFromQuery])

  const getTagColor = (tagName: string | undefined | null) => {
    if (!tagName) return "bg-slate-100 dark:bg-slate-800 text-black dark:text-black hover:border-slate-300 dark:hover:border-slate-700";
    
    const normalized = tagName.toLowerCase();
    if (normalized === 'premium') return "bg-amber-100 dark:bg-amber-900/30 text-black dark:text-black hover:border-amber-300 dark:hover:border-amber-700";
    if (normalized === 'standard') return "bg-blue-100 dark:bg-blue-900/30 text-black dark:text-black hover:border-blue-300 dark:hover:border-blue-700";
    if (normalized === 'economy') return "bg-green-200 dark:bg-green-900/30 text-black dark:text-black hover:border-green-400 dark:hover:border-green-700";
    
    // Hash based color selection for other tags
    const colors = [
      "bg-red-100 dark:bg-red-900/30 text-black dark:text-black hover:border-red-300 dark:hover:border-red-700",
      "bg-purple-100 dark:bg-purple-900/30 text-black dark:text-black hover:border-purple-300 dark:hover:border-purple-700",
      "bg-teal-100 dark:bg-teal-900/30 text-black dark:text-black hover:border-teal-300 dark:hover:border-teal-700",
      "bg-pink-100 dark:bg-pink-900/30 text-black dark:text-black hover:border-pink-300 dark:hover:border-pink-700",
      "bg-indigo-100 dark:bg-indigo-900/30 text-black dark:text-black hover:border-indigo-300 dark:hover:border-indigo-700",
      "bg-cyan-100 dark:bg-cyan-900/30 text-black dark:text-black hover:border-cyan-300 dark:hover:border-cyan-700",
    ];
    
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
      hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getTagStyle = (tagName: string | undefined | null) => {
    if (!tagName) return undefined;
    const tagRecord = tags.find((t: any) => t.name.toLowerCase() === tagName.toLowerCase());
    if (tagRecord && tagRecord.color) {
      return {
        backgroundColor: `${tagRecord.color}33`,
        color: '#000000',
      };
    }
    return undefined;
  };

  useEffect(() => {
    const loadCustomers = async () => {
      const { data, error } = await supabase.from('customer').select('*').order('name')
      if (data) {
        setCustomers(data.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          type: c.type,
          photo: c.photo,
          totalDue: Number(c.total_due)
        })))
      }
    }
    loadCustomers()
    
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .single()
      
      const defaultMethods = ['Cash', 'Card', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Other']
      if (data && data.settings) {
        const parsed = data.settings as any
        if (parsed.finance?.defaultPaymentMethod) {
          setPaymentMethod(parsed.finance.defaultPaymentMethod)
        }
        if (parsed.system?.defaultWoodPrice !== undefined && parsed.system?.defaultWoodPrice !== null && parsed.system?.defaultWoodPrice !== '') {
          const priceStr = parsed.system.defaultWoodPrice.toString()
          setManualPrice(priceStr)
          localStorage.setItem('defaultWoodPrice', priceStr)
        } else {
          setManualPrice('')
          localStorage.removeItem('defaultWoodPrice')
        }
        setAvailableMethods(parsed.finance?.paymentMethods || defaultMethods)
      } else {
        setAvailableMethods(defaultMethods)
      }
    }
    loadSettings()

    const loadTags = async () => {
      const { data, error } = await supabase.from('wood_category_tag').select('*').eq('status', 'Active')
      if (data) {
        setTags(data.map(t => ({
          id: t.id,
          name: t.name,
          buyPrice: Number(t.buy_price),
          sellPrice: Number(t.sell_price)
        })))
      }
    }
    loadTags()

    window.addEventListener('wood-inventory-updated', fetchSoloInventory)
    return () => window.removeEventListener('wood-inventory-updated', fetchSoloInventory)
  }, [])

  const handleAddCustomer = async (customer: any) => {
    try {
      const dbData = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        type: customer.type,
        total_due: customer.totalDue || 0,
        total_orders: 0
      }
      const { error } = await supabase.from('customer').insert([dbData])
      if (error) throw error
      
      setCustomers([...customers, customer])
      setSelectedCustomer(customer.name)
      toast.success('Customer added')
    } catch (error: any) {
      console.error('Error adding customer:', error)
      toast.error('Failed to add customer')
    }
  }

  const addToCart = (product: any) => {
    if (cart.find(item => item.id === product.id)) return
    if (product.stock < 1 || product.isSold) return
    setCart([{ ...product }, ...cart])
  }

  useEffect(() => {
    const allTreeNos = [...products.map(p => p.treeNo), ...cart.map(p => p.treeNo)]
    const mNumbers = allTreeNos
      .filter(no => no?.startsWith('M-'))
      .map(no => parseInt(no.replace('M-', ''), 10))
      .filter(num => !isNaN(num))
    
    if (mNumbers.length > 0) {
      setManualCounter(Math.max(...mNumbers) + 1)
    } else {
      setManualCounter(1)
    }
  }, [products, cart])

  const addManualToCart = () => {
    const w = parseFloat(manualWidth) || 0
    const l = parseFloat(manualLength) || 0
    const p = parseFloat(manualPrice) || 0
    
    if (w <= 0 || l <= 0 || p <= 0) {
      setAlertConfig({
        isOpen: true,
        message: 'Please enter valid width, length and price.',
        type: 'error'
      })
      return
    }

    const cft = (w * w * l) / 2304
    
    // Find matching tag based on price
    const matchingTag = tags.find(t => Number(t.sellPrice) === p)
    const tagName = matchingTag ? matchingTag.name : '-'

    const newItem = {
      id: Date.now(),
      treeNo: `M-${manualCounter}`,
      width: w,
      length: l,
      cft: parseFloat(cft.toFixed(5)),
      sellPrice: p,
      
      tag: tagName,
      category: 'Wood',
      carNo: 'Solo',
      stock: 1
    }
    
    setCart([newItem, ...cart])
    setManualCounter(prev => prev + 1)
    setManualWidth('')
    setManualLength('')
    setTimeout(() => {
      widthInputRef.current?.focus()
    }, 0)
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (isCheckingOut) return

    setIsCheckingOut(true)
    setCheckoutError('')

    const currentSubtotal = Number(cart.reduce((acc, item) => acc + (Number(item.sellPrice) * Number(item.cft)), 0).toFixed(4))
    const currentDiscountAmount = discountType === 'fixed' ? discount : (currentSubtotal * discount / 100)
    const currentTotal = Math.round(currentSubtotal + deliveryCharge - currentDiscountAmount)
    const currentDue = Math.max(0, currentTotal - paidAmount)

    if (selectedCustomer === 'Walk-in Customer' && paidAmount < currentTotal) {
      setAlertConfig({
        isOpen: true,
        message: 'Walk-in Customer cannot buy on due. Please pay the full amount.',
        type: 'error'
      })
      setIsCheckingOut(false)
      return
    }

    try {
      // 1. Create Invoice Number (#INV-W-YYMMSS format)
      const tenantId = getTenantId();
      const invoiceNumber = await generateInvoiceId('Wood', tenantId);
      const customerData = customers.find(c => c.name === selectedCustomer)
      const oldDue = Number(customerData?.totalDue || 0)

      // 2. Create Invoice first (Required for database referential integrity)
      let finalInvoiceNumber = invoiceNumber;
      let finalId = tenantId ? `${tenantId}_${finalInvoiceNumber}` : finalInvoiceNumber;
      let insertSuccess = false;
      let attempts = 0;
      let currentSerial = parseInt(invoiceNumber.slice(-2), 10);
      const basePrefix = invoiceNumber.slice(0, -2);
      const currentUser = getCurrentUser();
      const creatorName = currentUser?.name || currentUser?.username || 'Staff';
      const creatorId = currentUser?.id || currentUser?.username || null;
      const secretToken = generateSecretToken(8);
      const invoiceDate = getInvoiceDateString(new Date());

      while (!insertSuccess && attempts < 50) {
        const invoicePayload: any = {
          id: finalId,
          invoice_number: finalInvoiceNumber,
          customer_id: customerData?.id || null,
          customer_name: selectedCustomer,
          customer_phone: customerData?.phone || null,
          customer_address: customerData?.address || null,
          type: 'solo_wood',
          subtotal: currentSubtotal,
          discount: currentDiscountAmount,
          discount_type: discountType,
          delivery_charge: deliveryCharge,
          total: currentTotal,
          paid_amount: paidAmount,
          due_amount: currentDue,
          payment_method: paymentMethod,
          created_by: creatorId,
          created_by_name: creatorName,
          secret_token: secretToken
        };

        let { error: invError } = await supabase.from('wood_invoices').insert([invoicePayload]);

        if (invError && (invError.code === 'PGRST204' || invError.message?.includes('schema cache') || invError.message?.includes('created_by') || invError.message?.includes('secret_token'))) {
          delete invoicePayload.created_by;
          delete invoicePayload.created_by_name;
          delete invoicePayload.secret_token;
          const retry = await supabase.from('wood_invoices').insert([invoicePayload]);
          invError = retry.error;
        }

        if (invError) {
          if (invError.code === '23505') { // Postgres duplicate key error code
            attempts++;
            currentSerial++;
            finalInvoiceNumber = `${basePrefix}${String(currentSerial).padStart(2, '0')}`;
            finalId = tenantId ? `${tenantId}_${finalInvoiceNumber}` : finalInvoiceNumber;
            continue;
          } else {
            throw invError;
          }
        }
        insertSuccess = true;
      }

      // Record creator for cache and settings persistence
      recordInvoiceCreator(finalId, creatorName, creatorId || undefined);

      // 3. Prepare and run dependent operations in parallel
      const productIds = cart.filter(item => item.id && typeof item.id === 'number' && !(item.carNo === 'Solo' && item.treeNo.startsWith('M-'))).map(item => item.id);
      const operations: any[] = [];
      
      // Invoice Items
      const invoiceItems = cart.map(item => ({
        invoice_id: finalId,
        product_type: 'wood',
        product_id: item.carNo === 'Solo' && item.treeNo.startsWith('M-') ? 0 : Number(item.id),
        name: item.treeNo,
        price: Number(item.sellPrice),
        cft: item.cft !== undefined && item.cft !== null ? Number(item.cft) : 0,
        tag: item.tag || '',
        car_no: item.carNo || '',
        width: item.width !== undefined && item.width !== null ? Number(item.width) : 0,
        length: item.length !== undefined && item.length !== null ? Number(item.length) : 0,
        total: Number(item.sellPrice * item.cft)
      }))
      operations.push(supabase.from('wood_invoice_items').insert(invoiceItems));

      // Stock update
      if (productIds.length > 0) {
        operations.push(supabase
          .from('wood_inventory')
          .update({ is_sold: true })
          .in('id', productIds));
      }

      // Customer Balance, Order count, Transaction and SMS
      const newTotalDue = oldDue + currentDue
      const newTotalOrders = (Number(customerData?.total_orders) || 0) + 1
      
      if (selectedCustomer !== 'Walk-in Customer' && customerData) {
        operations.push(supabase.from('customer')
          .update({ 
            total_due: Number(newTotalDue),
            total_orders: newTotalOrders
          })
          .eq('id', customerData.id));

        operations.push(supabase.from('transactions').insert([{
          id: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          customer_id: customerData?.id,
          date: new Date().toISOString().split('T')[0],
          type: 'Invoice',
          ref: finalId,
          debit: Number(currentTotal),
          credit: Number(paidAmount),
          balance: Number(newTotalDue),
          method: paymentMethod || 'Cash',
          notes: paymentMethod || 'Cash'
        }]));

        // SMS (non-critical)
        if (customerData?.phone) {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          const invoiceUrl = generatePublicInvoiceUrl(finalId, invoiceDate, secretToken, origin)
          const smsMessage = `Dear ${selectedCustomer}, your wood order ${finalInvoiceNumber} has been confirmed. Total: ৳${currentTotal.toLocaleString()}, Paid: ৳${paidAmount.toLocaleString()}. View invoice: ${invoiceUrl}`
          sendSMS(customerData.phone, smsMessage).catch(console.error)
        }
      } else {
        operations.push(supabase.from('transactions').insert([{
          id: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          customer_id: null,
          date: new Date().toISOString().split('T')[0],
          type: 'Invoice',
          ref: finalId,
          debit: Number(currentTotal),
          credit: Number(paidAmount),
          balance: Number(currentDue),
          method: paymentMethod || 'Cash',
          notes: paymentMethod || 'Cash'
        }]));
      }

      const results = await Promise.all(operations);
      const errors = results.filter(r => r.error).map(r => r.error);
      if (errors.length > 0) throw errors[0];

      // Play success sound
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')
        audio.play().catch(() => {})
      } catch (e) {}

      addNotification('sale', 'New Solo Wood Sale', `Invoice ${finalInvoiceNumber} created. Paid: ৳${paidAmount.toLocaleString()} (${paymentMethod || 'Cash'}), Due: ৳${currentDue.toLocaleString()}`);

      setSelectedInvoice({
        id: finalId,
        customer: selectedCustomer,
        customerPhone: customerData?.phone,
        customerAddress: customerData?.address,
        paid: paidAmount,
        paymentMethod: paymentMethod || 'Cash',
        due: currentDue,
        oldDue: oldDue,
        total: currentTotal,
        type: 'solo_wood',
        date: new Date().toISOString().split('T')[0],
        items: cart.map(item => ({
          name: item.treeNo,
          treeNo: item.treeNo,
          carNo: item.carNo,
          width: item.width,
          length: item.length,
          cft: item.cft,
          price: item.sellPrice,
          total: item.sellPrice * item.cft,
          tag: item.tag
        })),
        payments: paidAmount > 0 ? [{
          date: new Date().toISOString().split('T')[0],
          method: paymentMethod || 'Cash',
          amount: paidAmount
        }] : []
      })
      setCart([])
      setSelectedCustomer('Walk-in Customer')
      setDiscount(0)
      setDiscountType('fixed')
      setDeliveryCharge(0)
      setPaidAmount(0)
      setCustomerSearchTerm('')
      setIsCheckoutSuccess(true)
      fetchSoloInventory()
    } catch (error: any) {
      console.error('Solo wood checkout error details:', error)
      
      let errorMessage = 'Unknown error occurred';
      if (error && error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && error.error_description) {
        errorMessage = error.error_description;
      } else {
        try {
          const stringified = JSON.stringify(error);
          if (stringified !== '{}') errorMessage = stringified;
        } catch (e) {}
      }

      setCheckoutError('Checkout failed: ' + errorMessage)
      toast.error('Checkout failed: ' + errorMessage)
    } finally {
      setIsCheckingOut(false)
    }
  }

  const subtotal = Number(cart.reduce((acc, item) => acc + (item.sellPrice * item.cft), 0).toFixed(4))
  const totalCFT = cart.reduce((acc, item) => acc + (item.cft || 0), 0)
  const discountAmount = discountType === 'fixed' ? discount : (subtotal * discount / 100)
  const total = Math.round(subtotal + deliveryCharge - discountAmount)
  const dueAmount = Math.max(0, total - paidAmount)

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-start gap-4 pt-0 pb-8 min-h-0">
        <div className="w-full max-w-md bg-white dark:bg-black rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col overflow-hidden h-fit">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div 
                    className="flex items-center w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 relative z-30"
                  >
                    {(() => {
                      if (!isCustomerDropdownOpen) {
                        const cust = customers.find(c => c.name === selectedCustomer);
                        if (cust?.photo) {
                          // eslint-disable-next-line @next/next/no-img-element
                          return <img src={cust.photo} alt={cust.name} className="w-5 h-5 rounded-full object-cover mr-2 shrink-0 border border-slate-200" />;
                        }
                      }
                      return <Search className="text-slate-400 mr-2 shrink-0" size={14} />;
                    })()}
                    <input 
                      type="text"
                      placeholder="Search or Select Customer..."
                      className="bg-transparent outline-none flex-1 text-sm text-slate-900 dark:text-slate-100 w-full min-w-0"
                      value={isCustomerDropdownOpen ? customerSearchTerm : selectedCustomer}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value)
                        setIsCustomerDropdownOpen(true)
                      }}
                      onFocus={() => {
                        setIsCustomerDropdownOpen(true)
                        setCustomerSearchTerm('')
                      }}
                    />
                    <button 
                      onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                      className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {isCustomerDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCustomerDropdownOpen(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-1">
                        <div 
                          className="px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer text-sm text-slate-700 dark:text-slate-300 font-medium transition-colors"
                          onClick={() => {
                            setSelectedCustomer('Walk-in Customer')
                            setIsCustomerDropdownOpen(false)
                            setCustomerSearchTerm('')
                          }}
                        >
                          Walk-in Customer
                        </div>
                        {customers
                          .filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || c.phone.includes(customerSearchTerm))
                          .map(c => (
                          <div 
                            key={c.id}
                            className="px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer text-sm text-slate-700 dark:text-slate-300 transition-colors border-t border-slate-50 dark:border-slate-800 flex items-center gap-3"
                            onClick={() => {
                              setSelectedCustomer(c.name)
                              setIsCustomerDropdownOpen(false)
                              setCustomerSearchTerm('')
                            }}
                          >
                            {c.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.photo} alt={c.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold shrink-0">
                                {c.name.charAt(0)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium">{c.name}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">{c.phone}</span>
                            </div>
                          </div>
                        ))}
                        {customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || c.phone.includes(customerSearchTerm)).length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                            No customers found
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => setIsAddingCustomer(true)}
                  className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors shadow-sm flex items-center justify-center shrink-0"
                  title="Add New Customer"
                >
                  <UserPlus size={18} />
                </button>
                <button 
                  onClick={() => {
                    setCart([])
                    setSelectedCustomer('Walk-in Customer')
                  }}
                  className="p-2.5 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
                  title="Reset Order"
                >
                  <RotateCcw size={18} />
                </button>
              </div>

              {/* Manual Entry Section - Now under customer selection */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  addManualToCart()
                }}
                className="flex items-end gap-2 pt-2"
              >
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Width</label>
                  <input 
                    ref={widthInputRef}
                    type="number" 
                    inputMode="decimal"
                    enterKeyHint="next"
                    placeholder="W" 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={manualWidth}
                    onChange={(e) => setManualWidth(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault()
                        lengthInputRef.current?.focus()
                      }
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Length</label>
                  <input 
                    ref={lengthInputRef}
                    type="number" 
                    inputMode="decimal"
                    enterKeyHint="send"
                    placeholder="L" 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={manualLength}
                    onChange={(e) => setManualLength(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault()
                        addManualToCart()
                      }
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Price</label>
                  <input 
                    type="number" 
                    inputMode="numeric"
                    tabIndex={-1}
                    placeholder="Price" 
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors shadow-sm flex items-center justify-center shrink-0"
                >
                  <Plus size={18} />
                </button>
              </form>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <AnimatePresence mode="popLayout">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <ShoppingCart size={48} strokeWidth={1} />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center justify-between gap-2 p-2.5 px-3 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group"
                  >
                    <span className="text-[10px] font-mono text-slate-400 min-w-[16px] shrink-0">{cart.length - index}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap overflow-hidden">
                        <span className="text-[10px] font-bold text-emerald-600 shrink-0">{item.treeNo}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">•</span>
                        <span className="text-[10px] text-slate-900 dark:text-slate-100 font-medium shrink-0">({item.width}&quot; * {item.length}&apos;)</span>
                        <span className="text-[10px] text-slate-400 shrink-0">=</span>
                        <span className="text-xs font-bold text-emerald-600 shrink-0">{item.cft.toFixed(4)}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-auto whitespace-nowrap shrink-0">৳{Number(item.sellPrice * item.cft).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                    <span 
                      className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0",
                        !getTagStyle(item.tag) && getTagColor(item.tag)
                      )}
                      style={getTagStyle(item.tag)}
                    >
                      {item.tag || 'No Tag'}
                    </span>
                    <button 
                      onClick={() => setCart(cart.filter(i => i.id !== item.id))} 
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-slate-400 text-xs font-bold">
                <span>Total CFT</span>
                <span className="text-emerald-600 dark:text-emerald-500">{totalCFT.toFixed(4)} CFT</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 text-xs border-t border-slate-200/50 dark:border-slate-800/50 pt-1">
                <span>Subtotal</span>
                <span>৳{Math.round(subtotal).toLocaleString()}</span>
              </div>
              
              {/* Discount Section - One Line */}
              <div className="flex items-center justify-between gap-2 py-1 border-y border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-1.5 min-w-fit">
                  <span className="text-slate-600 dark:text-slate-400 text-xs">Disc.</span>
                  <div className="flex bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                    <button 
                      onClick={() => setDiscountType('fixed')}
                      className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded", discountType === 'fixed' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "text-slate-400 dark:text-slate-500")}
                    >৳</button>
                    <button 
                      onClick={() => setDiscountType('percent')}
                      className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded", discountType === 'percent' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "text-slate-400 dark:text-slate-500")}
                    >%</button>
                  </div>
                </div>
                <input 
                  ref={discountInputRef}
                  type="number" 
                  inputMode="decimal"
                  enterKeyHint="next"
                  className="w-40 p-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-right text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={discount === 0 ? '' : discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                      e.preventDefault()
                      deliveryInputRef.current?.focus()
                    }
                  }}
                />
              </div>

              {/* Delivery Charge */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">Delivery</span>
                <input 
                  ref={deliveryInputRef}
                  type="number" 
                  inputMode="decimal"
                  enterKeyHint="next"
                  className="w-40 p-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm text-right outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={deliveryCharge === 0 ? '' : deliveryCharge}
                  onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.keyCode === 13) {
                      e.preventDefault()
                      paidInputRef.current?.focus()
                    }
                  }}
                />
              </div>

              <div 
                className="flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
                onClick={() => setPaidAmount(total)}
                title="Click to auto-fill Paid amount"
              >
                <span>Total</span>
                <span>৳{Math.round(total).toLocaleString()}</span>
              </div>

              {/* Payment Section */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-emerald-600 dark:text-emerald-500 font-bold text-xs">Paid</span>
                  <input 
                    ref={paidInputRef}
                    type="number" 
                    inputMode="decimal"
                    enterKeyHint="send"
                    className="w-40 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg text-sm text-right font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    value={paidAmount === 0 ? '' : paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault()
                        handleCheckout()
                      }
                    }}
                  />
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-500 font-bold text-xs">
                  <span>Due</span>
                  <span>৳{Math.round(dueAmount).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">Method</span>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-40 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm"
                >
                  {availableMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {checkoutError && (
              <div className="text-xs text-rose-500 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/50">
                {checkoutError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button 
                onClick={() => {
                  if (cart.length === 0) {
                    toast.error('Cart is empty')
                    return
                  }
                  const currentSubtotal = Number(cart.reduce((acc, item) => acc + (Number(item.sellPrice) * Number(item.cft)), 0).toFixed(4))
                  const currentDiscountAmount = discountType === 'fixed' ? discount : (currentSubtotal * discount / 100)
                  const currentTotal = Math.round(currentSubtotal + deliveryCharge - currentDiscountAmount)
                  const currentDue = Math.max(0, currentTotal - paidAmount)
                  const customerData = customers.find(c => c.name === selectedCustomer)

                  setSelectedInvoice({
                    id: 'PREVIEW',
                    customer: selectedCustomer,
                    paid: paidAmount,
                    paymentMethod: paymentMethod || 'Cash',
                    due: currentDue,
                    oldDue: (Number(customerData?.totalDue) || 0),
                    total: currentTotal,
                    type: 'solo_wood',
                    date: new Date().toISOString().split('T')[0],
                    items: cart.map(item => ({
                      name: item.treeNo,
                      price: item.sellPrice,
                      cft: item.cft,
                      total: item.sellPrice * item.cft,
                      carNo: item.carNo,
                      treeNo: item.treeNo,
                      width: item.width,
                      length: item.length,
                      tag: item.tag
                    }))
                  })
                  setIsInvoiceModalOpen(true)
                }}
                className="py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={18} /> Bill
              </button>
              <button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="py-3 px-4 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCheckingOut ? (
                  <>
                    <RotateCcw className="animate-spin" size={18} /> Processing...
                  </>
                ) : 'Checkout'}
              </button>
            </div>
          </div>
        </div>

        {/* Checkout Success Modal */}
        <AnimatePresence>
          {isCheckoutSuccess && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center"
              >
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Sale Complete!</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8">The wood inventory has been automatically updated and the invoice is ready.</p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setIsCheckoutSuccess(false)
                      setIsInvoiceModalOpen(true)
                    }}
                    className="w-full py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
                  >
                    <Printer size={20} /> Print Invoice
                  </button>
                  <button 
                    onClick={() => setIsCheckoutSuccess(false)}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                  >
                    Continue Shopping
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AddCustomerModal 
          isOpen={isAddingCustomer}
          onClose={() => setIsAddingCustomer(false)}
          onAdd={handleAddCustomer}
        />

        <InvoiceModal 
          isOpen={isInvoiceModalOpen}
          onClose={() => setIsInvoiceModalOpen(false)}
          invoice={selectedInvoice}
        />

        <AlertPopup 
          isOpen={alertConfig.isOpen}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
          message={alertConfig.message}
          type={alertConfig.type}
        />
      </div>
    </DashboardLayout>
  )
}

export default function SoloWood() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>}>
      <SoloWoodContent />
    </Suspense>
  )
}
