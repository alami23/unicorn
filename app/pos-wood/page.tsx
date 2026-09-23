'use client'

import React, { useState, useEffect, Suspense } from 'react'
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
import { generateInvoiceId, getDisplayInvoiceId } from '@/lib/invoice'
import { recordInvoiceCreator } from '@/lib/invoiceCache'
import { toast } from 'sonner'

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

import { useSearchParams } from 'next/navigation'

function POSWoodContent() {
  const searchParams = useSearchParams()
  const customerFromQuery = searchParams?.get('customer')

  const [categories, setCategories] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [products, setProducts] = useState<WoodProduct[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const fetchMetadata = async () => {
    try {
      const [catRes, subRes, tagRes] = await Promise.all([
        supabase.from('wood_category').select('*'),
        supabase.from('wood_category_car').select('*'),
        supabase.from('wood_category_tag').select('*')
      ])
      
      if (catRes.data) setCategories(catRes.data)
      if (subRes.data) setSubCategories(subRes.data)
      if (tagRes.data) setTags(tagRes.data.map(t => ({
        ...t,
        buyPrice: Number(t.buy_price),
        sellPrice: Number(t.sell_price)
      })))
    } catch (error) {
      console.error('Error fetching metadata:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      console.log('Fetching wood inventory products from Supabase...')
      setIsLoading(true)
      const { data, error } = await supabase
        .from('wood_inventory')
        .select('*')
      
      if (error) throw error
      
      console.log(`Fetched ${data?.length || 0} wood products`)
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          category: p.category,
          treeNo: p.tree_no,
          carNo: p.car_no,
          width: Number(p.width),
          length: Number(p.length),
          cft: Number(p.cft),
          tag: p.tag,
          sellPrice: Number(p.sell_price),
          buyPrice: Number(p.buy_price),
          stock: p.is_sold ? 0 : 1,
          unit: p.unit,
          isSold: Boolean(p.is_sold) // Prevent undefined hydration mismatch
        })))
      }
    } catch (error: any) {
      console.error('Error fetching wood inventory details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error
      })
      toast.error('Failed to load products: ' + (error.message || 'Unknown network error'))
    } finally {
      setIsLoading(false)
    }
  }

  const [cart, setCart] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedSubCategory, setSelectedSubCategory] = useState('All')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<any>(null)

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
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'error'
  })
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

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

  const subtotal = Number(cart.reduce((acc, item) => acc + (item.sellPrice * item.cft), 0).toFixed(4))
  const totalCFT = cart.reduce((acc, item) => acc + item.cft, 0)
  const discountAmount = discountType === 'fixed' ? discount : (subtotal * discount / 100)
  const total = Math.round(subtotal + deliveryCharge - discountAmount)
  const dueAmount = Math.max(0, total - paidAmount)

  const widthInputRef = React.useRef<HTMLInputElement>(null)
  const lengthInputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMetadata()
    fetchProducts()
    loadCustomers()
    loadSettings()
  }, [])

  const loadCustomers = async () => {
    const { data, error } = await supabase.from('customer').select('*')
    if (data) setCustomers(data)
  }

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .single();
      
      const defaultMethods = ['Cash', 'Card', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Other'];
      
      if (data && data.settings) {
        const settings = data.settings as any;
        if (settings.finance?.defaultPaymentMethod) {
          setPaymentMethod(settings.finance.defaultPaymentMethod);
        }
        if (settings.system?.defaultWoodPrice !== undefined && settings.system?.defaultWoodPrice !== null && settings.system?.defaultWoodPrice !== '') {
          const priceStr = settings.system.defaultWoodPrice.toString();
          setManualPrice(priceStr);
          localStorage.setItem('defaultWoodPrice', priceStr);
        } else {
          setManualPrice('');
          localStorage.removeItem('defaultWoodPrice');
        }
        setAvailableMethods(settings.finance?.paymentMethods || defaultMethods);
      } else {
        setAvailableMethods(defaultMethods);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }

  const handleAddCustomer = async (customer: any) => {
    try {
      const { error } = await supabase.from('customer').insert([{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        type: customer.type,
        total_due: 0
      }])
      if (error) throw error
      
      toast.success('Customer added')
      loadCustomers()
      setSelectedCustomer(customer.name)
    } catch (error: any) {
      toast.error('Failed to add customer')
    }
  }

  const addToCart = (product: any) => {
    const existingIndex = cart.findIndex(item => item.id === product.id)
    
    if (existingIndex > -1) {
      // Toggle off: remove if already in cart
      setCart(cart.filter(item => item.id !== product.id))
      return
    }

    if (product.stock < 1 || product.isSold) {
      return
    }

    const productWithTag = { ...product };
    if (!productWithTag.tag) {
      const matchingTag = tags.find((t: any) => Math.abs(Number(t.sellPrice) - Number(productWithTag.sellPrice)) < 0.01);
      if (matchingTag) {
        productWithTag.tag = matchingTag.name;
      }
    }

    setCart([...cart, { ...productWithTag }])
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
  }, [cart, products])

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
    const matchingTag = tags.find((t: any) => Math.abs(Number(t.sellPrice) - p) < 0.01)
    const tagName = matchingTag ? matchingTag.name : ''

    const newItem = {
      id: Date.now(),
      treeNo: `M-${manualCounter}`,
      width: w,
      length: l,
      cft: parseFloat(cft.toFixed(5)),
      sellPrice: p,
      
      tag: tagName,
      category: 'Wood',
      carNo: 'Manual',
      stock: 1
    }
    
    setCart([...cart, newItem])
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

    if (selectedCustomer === 'Walk-in Customer' && paidAmount < total) {
      setAlertConfig({
        isOpen: true,
        message: 'Walk-in Customer cannot buy on due. Please pay the full amount.',
        type: 'error'
      })
      setIsCheckingOut(false)
      return
    }

    const currentSubtotal = Number(cart.reduce((acc, item) => acc + (Number(item.sellPrice) * Number(item.cft)), 0).toFixed(4))
    const currentDiscountAmount = discountType === 'fixed' ? discount : (currentSubtotal * discount / 100)
    const currentTotal = Math.round(currentSubtotal + deliveryCharge - currentDiscountAmount)
    const currentDue = Math.max(0, currentTotal - paidAmount)

    try {
      // 1. Generate new Invoice Number (#INV-W-YYMMSS format)
      const tenantId = getTenantId();
      const invoiceNumber = await generateInvoiceId('Wood', tenantId);
      const customerData = customers.find(c => c.name === selectedCustomer)

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

      while (!insertSuccess && attempts < 50) {
        const invoicePayload: any = {
          id: finalId,
          invoice_number: finalInvoiceNumber,
          customer_id: customerData?.id || null,
          customer_name: selectedCustomer,
          customer_phone: customerData?.phone || null,
          customer_address: customerData?.address || null,
          type: 'Wood',
          subtotal: currentSubtotal,
          discount: currentDiscountAmount,
          discount_type: discountType,
          delivery_charge: deliveryCharge,
          total: currentTotal,
          paid_amount: paidAmount,
          due_amount: currentDue,
          payment_method: paymentMethod,
          created_by: creatorId,
          created_by_name: creatorName
        };

        let { error: invError } = await supabase.from('wood_invoices').insert([invoicePayload]);

        if (invError && (invError.code === 'PGRST204' || invError.message?.includes('schema cache') || invError.message?.includes('created_by'))) {
          delete invoicePayload.created_by;
          delete invoicePayload.created_by_name;
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
      const productIds = cart.filter(item => item.carNo !== 'Manual' && item.id && typeof item.id === 'number').map(item => item.id);
      const operations: any[] = [];
      
      // Invoice items
      const invoiceItems = cart.map(item => ({
        invoice_id: finalId,
        product_type: 'wood',
        product_id: item.carNo === 'Manual' ? 0 : Number(item.id),
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

      // Customer balance, order count and Transaction
      if (selectedCustomer !== 'Walk-in Customer' && customerData) {
        const newTotalDue = (Number(customerData?.total_due) || 0) + currentDue;
        const newTotalOrders = (Number(customerData?.total_orders) || 0) + 1;
        
        operations.push(supabase
          .from('customer')
          .update({ 
            total_due: newTotalDue,
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

        // SMS (no need to await if it fails, it's non-critical)
        if (customerData?.phone) {
          const smsMessage = `Dear ${selectedCustomer}, your wood order ${finalInvoiceNumber} has been confirmed. Total: ৳${currentTotal.toLocaleString()}, Paid: ৳${paidAmount.toLocaleString()}. Thank you for choosing FurniTrack!`
          sendSMS(customerData.phone, smsMessage).catch(err => console.error('SMS failed:', err))
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

      // Success UI
      addNotification('sale', 'New Wood Sale', `Invoice ${finalInvoiceNumber} created. Paid: ৳${paidAmount.toLocaleString()} (${paymentMethod || 'Cash'}), Due: ৳${currentDue.toLocaleString()}`);
      
      setSelectedInvoice({
        id: finalId,
        customer: selectedCustomer,
        customerPhone: customerData?.phone,
        customerAddress: customerData?.address,
        paid: paidAmount,
        paymentMethod: paymentMethod || 'Cash',
        due: currentDue,
        oldDue: (Number(customerData?.total_due) || 0),
        total: currentTotal,
        type: 'Wood',
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
        })),
        payments: paidAmount > 0 ? [{
          date: new Date().toISOString().split('T')[0],
          method: paymentMethod || 'Cash',
          amount: paidAmount
        }] : []
      })

      toast.success('Sale recorded successfully')
      fetchProducts()
      loadCustomers()
      setCart([])
      setSelectedCustomer('Walk-in Customer')
      setDiscount(0)
      setDiscountType('fixed')
      setDeliveryCharge(0)
      setPaidAmount(0)
      setIsCheckoutSuccess(true)

    } catch (error: any) {
      console.error('Wood checkout error details:', error)
      
      // Handle cases where error might stringify to "{}" (like empty Error objects)
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

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const startEditing = (product: any) => {
    setEditingId(product.id)
    setEditData({ ...product })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditData(null)
  }

  const saveEditing = async () => {
    try {
      const { error } = await supabase
        .from('wood_inventory')
        .update({
          car_no: editData.carNo,
          tree_no: editData.treeNo,
          width: editData.width,
          length: editData.length,
          cft: editData.cft,
          tag: editData.tag,
          sell_price: editData.sellPrice,
          buy_price: editData.buyPrice
        })
        .eq('id', editData.id);
      
      if (error) throw error;
      
      setProducts(products.map(p => p.id === editingId ? editData : p))
      setEditingId(null)
      setEditData(null)
      toast.success('Product updated successfully')
    } catch (error: any) {
      toast.error('Failed to update product: ' + error.message)
    }
  }

  const updateProductTag = async (productId: number, newTag: string) => {
    const selectedTag = tags.find((t: any) => t.name === newTag);
    const newSellPrice = selectedTag ? selectedTag.sellPrice : undefined;
    const newBuyPrice = selectedTag ? selectedTag.buyPrice : undefined;

    try {
      const updateData: any = { tag: newTag };
      if (newSellPrice !== undefined) updateData.sell_price = newSellPrice;
      if (newBuyPrice !== undefined) updateData.buy_price = newBuyPrice;
      
      const { error } = await supabase
        .from('wood_inventory')
        .update(updateData)
        .eq('id', productId);
      
      if (error) throw error;

      setProducts(products.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            tag: newTag,
            sellPrice: newSellPrice !== undefined ? newSellPrice : p.sellPrice,
            buyPrice: newBuyPrice !== undefined ? newBuyPrice : p.buyPrice
          }
        }
        return p;
      }));
      toast.success('Product tag updated')
    } catch (error: any) {
      toast.error('Failed to update product tag: ' + error.message)
    }
  };

  const handleEditChange = (field: string, value: any) => {
    const newData = { ...editData, [field]: value }
    
    // Auto-calculate CFT if width or length changes
    if (field === 'width' || field === 'length') {
      const w = parseFloat(field === 'width' ? value : editData.width) || 0
      const l = parseFloat(field === 'length' ? value : editData.length) || 0
      const calculatedCFT = (w * w * l) / 2304
      newData.cft = parseFloat(calculatedCFT.toFixed(5))
    }

    // Auto-select tag if sellPrice matches
    if (field === 'sellPrice') {
      const matchingTag = tags.find((t: any) => Math.abs(Number(t.sellPrice) - Number(value)) < 0.01);
      if (matchingTag) {
        newData.tag = matchingTag.name;
        newData.buyPrice = matchingTag.buyPrice || newData.buyPrice;
      } else {
        newData.tag = ''; // No match means no tag
      }
    }

    // Auto-fill prices if tag changes
    if (field === 'tag' && value) {
      const selectedTag = tags.find((t: any) => t.name === value);
      if (selectedTag) {
        newData.sellPrice = selectedTag.sellPrice || 0;
        newData.buyPrice = selectedTag.buyPrice || 0;
      }
    }
    
    setEditData(newData)
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.treeNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.tag.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory
    const matchesSubCategory = selectedSubCategory === 'All' || p.carNo === selectedSubCategory
    
    return matchesSearch && matchesCategory && matchesSubCategory
  }).sort((a, b) => (a.isSold ? 1 : 0) - (b.isSold ? 1 : 0))

  const [visibleCount, setVisibleCount] = useState(50)
  const observerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleCount(50)
  }, [searchTerm, selectedCategory, selectedSubCategory])

  useEffect(() => {
    if (visibleCount >= filteredProducts.length) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 50, filteredProducts.length))
      }
    }, {
      rootMargin: '100px',
    })

    const currentSentinel = observerRef.current
    if (currentSentinel) {
      observer.observe(currentSentinel)
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel)
      }
    }
  }, [filteredProducts.length, visibleCount])

  const visibleProducts = filteredProducts.slice(0, visibleCount)

  const carNumbers = ['All', ...Array.from(new Set(products
    .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
    .map(p => p.carNo))).sort()]

  return (
    <DashboardLayout>
      <div className="w-full box-border flex flex-col-reverse xl:flex-row gap-6 xl:gap-3 min-h-[calc(100vh-120px)] xl:h-auto min-w-0 pb-20 xl:pb-0">
        {/* Left: Product Selection */}
        <div className="w-full box-border flex-1 flex flex-col gap-3 min-w-0 min-h-[600px] xl:min-h-0 xl:h-auto">
          <div className="w-full box-border flex flex-col md:flex-row gap-4 items-end sticky top-0 z-20 bg-slate-50/80 dark:bg-black/80 backdrop-blur-md py-4 -mt-4 mb-2">
            <div className="flex flex-col gap-1 flex-1 w-full min-w-0">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Search</label>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search wood items..." 
                  className="w-full box-border pl-10 pr-4 h-[42px] bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 -mb-1 hide-scrollbar shrink-0 box-border">
              <div className="flex flex-col gap-1 flex-1 min-w-[100px] md:w-32 shrink-0">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 truncate">Category</label>
                <select 
                  className="w-full box-border px-2 h-[42px] bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value)
                    setSelectedSubCategory('All')
                    setEditingId(null)
                    setEditData(null)
                  }}
                >
                  <option value="All">All</option>
                  {categories.map((cat: any) => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[90px] md:w-32 shrink-0">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 truncate">Car No</label>
                <select 
                  className="w-full box-border px-2 h-[42px] bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  value={selectedSubCategory}
                  onChange={(e) => {
                    setSelectedSubCategory(e.target.value)
                    setEditingId(null)
                    setEditData(null)
                  }}
                >
                  {carNumbers.map((c: any) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[90px] w-[90px] shrink-0">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 text-center truncate">Total CFT</label>
                <div className="h-[42px] px-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-center text-black dark:text-black font-bold text-sm box-border">
                  {filteredProducts.filter(p => !p.isSold && p.stock > 0).reduce((sum, p) => sum + (Number(p.cft) || 0), 0).toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full box-border bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative h-auto overflow-x-auto">
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                <p className="text-slate-500 font-medium">Loading wood inventory...</p>
              </div>
            )}
            <table className="w-full box-border text-left border-collapse min-w-full block">
              <thead className="sticky top-0 bg-slate-50 dark:bg-black/50 text-slate-500 dark:text-slate-400 text-[10px] md:text-xs uppercase tracking-wider z-10 block w-full box-border">
                <tr className={cn(
                  "grid items-center text-center w-full box-border px-2 py-2.5 border-b border-slate-200 dark:border-slate-800 transition-all",
                  editingId !== null 
                    ? "grid-cols-[0.5fr_1.2fr_1.2fr_1fr_1fr_1.4fr_1.2fr_1fr]" 
                    : "grid-cols-[0.5fr_1fr_1fr_0.8fr_0.8fr_1.2fr_1.4fr_1fr_1fr]"
                )}>
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">No</th>
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">Car</th>
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">TREE</th>
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">W</th>
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">L</th>
                  {editingId === null && (
                    <th className="font-semibold text-center text-slate-900 dark:text-slate-100">CFT</th>
                  )}
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">Tag</th>
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">Rate</th>
                  <th className="font-semibold text-center text-slate-900 dark:text-slate-100">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 block w-full box-border">
                {visibleProducts.map((product, index) => (
                    <tr 
                      key={product.id} 
                      onClick={(e) => {
                        if (product.isSold || editingId === product.id) return;
                        const target = e.target as HTMLElement;
                        if (target.closest('button, input, select, option, label')) return;
                        addToCart(product);
                      }}
                      className={cn(
                        "grid items-center text-center w-full box-border px-2 py-2 transition-all group text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/60",
                        editingId !== null 
                          ? "grid-cols-[0.5fr_1.2fr_1.2fr_1fr_1fr_1.4fr_1.2fr_1fr]" 
                          : "grid-cols-[0.5fr_1fr_1fr_0.8fr_0.8fr_1.2fr_1.4fr_1fr_1fr]",
                        !product.isSold && editingId !== product.id && "cursor-pointer",
                        editingId === product.id ? "bg-amber-50/90 dark:bg-amber-900/30 py-3 ring-1 ring-amber-400/50 rounded-lg my-1 shadow-sm" : 
                        cart.some(item => item.id === product.id) ? "bg-rose-200/50 dark:bg-rose-900/30" : "hover:bg-amber-50/30 dark:hover:bg-amber-900/10",
                        product.isSold && "opacity-50"
                      )}
                    >
                    <td className="text-[12px] font-medium text-slate-900 dark:text-slate-100 text-center flex items-center justify-center">
                      {product.isSold ? <Lock size={10} className="mx-auto" /> : index + 1}
                    </td>
                    <td className="text-[12.5px] text-slate-900 dark:text-slate-100 font-medium text-center flex items-center justify-center px-0.5">
                      {editingId === product.id ? (
                        <input 
                          type="text" 
                          className="w-full box-border p-1.5 md:p-2 border border-amber-400 dark:border-amber-500 bg-white dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 text-xs md:text-sm font-semibold text-center text-slate-900 dark:text-slate-100 shadow-sm" 
                          value={editData.carNo}
                          onChange={(e) => handleEditChange('carNo', e.target.value)}
                          placeholder="Car"
                        />
                      ) : product.carNo}
                    </td>
                    <td className="text-[12.5px] font-bold text-emerald-600 text-center font-sans no-underline flex items-center justify-center px-0.5">
                      {editingId === product.id ? (
                        <input 
                          type="text" 
                          className="w-full box-border p-1.5 md:p-2 border border-amber-400 dark:border-amber-500 bg-white dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 text-xs md:text-sm font-semibold text-center text-slate-900 dark:text-slate-100 shadow-sm" 
                          value={editData.treeNo || ''}
                          onChange={(e) => handleEditChange('treeNo', e.target.value)}
                          placeholder="Tree"
                        />
                      ) : product.treeNo}
                    </td>
                    <td className="text-[12.5px] text-slate-900 dark:text-slate-100 font-medium text-center flex items-center justify-center px-0.5">
                      {editingId === product.id ? (
                        <input 
                          type="number" 
                          className="w-full box-border p-1.5 md:p-2 border border-amber-400 dark:border-amber-500 bg-white dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 text-xs md:text-sm font-semibold text-center text-slate-900 dark:text-slate-100 shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          value={Number.isNaN(editData.width) ? '' : editData.width}
                          onChange={(e) => handleEditChange('width', parseFloat(e.target.value))}
                          placeholder="W"
                        />
                      ) : `${product.width}"`}
                    </td>
                    <td className="text-[12.5px] text-slate-900 dark:text-slate-100 font-medium text-center flex items-center justify-center px-0.5">
                      {editingId === product.id ? (
                        <input 
                          type="number" 
                          className="w-full box-border p-1.5 md:p-2 border border-amber-400 dark:border-amber-500 bg-white dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 text-xs md:text-sm font-semibold text-center text-slate-900 dark:text-slate-100 shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          value={Number.isNaN(editData.length) ? '' : editData.length}
                          onChange={(e) => handleEditChange('length', parseFloat(e.target.value))}
                          placeholder="L"
                        />
                      ) : `${product.length}'`}
                    </td>
                    {editingId === null && (
                      <td className="text-[11.5px] text-slate-900 dark:text-slate-100 font-medium text-center flex items-center justify-center">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{product.cft.toFixed(4)}</span>
                      </td>
                    )}
                    <td className="px-1 flex items-center justify-center">
                      <div className="relative group/tag w-full">
                        <select 
                          value={product.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(product.sellPrice)) < 0.01)?.name || '')}
                          onChange={(e) => updateProductTag(product.id, e.target.value)}
                          className={cn(
                            "text-[9px] md:text-xs h-7 md:h-9 px-1 rounded-md border border-transparent outline-none cursor-pointer transition-all appearance-none text-center w-full box-border min-w-0",
                            !getTagStyle(product.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(product.sellPrice)) < 0.01)?.name || '')) && getTagColor(product.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(product.sellPrice)) < 0.01)?.name || ''))
                          )}
                          style={getTagStyle(product.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(product.sellPrice)) < 0.01)?.name || ''))}
                        >
                          <option value="">No Tag</option>
                          {tags.map((t: any) => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover/tag:opacity-100 transition-opacity">
                          <ChevronDown size={10} className="text-current opacity-50" />
                        </div>
                      </div>
                    </td>
                    <td className="text-[10px] md:text-xs font-bold text-amber-600 text-center flex items-center justify-center px-0.5">
                      {editingId === product.id ? (
                        <input 
                          type="number" 
                          className="w-full box-border p-1.5 md:p-2 border border-amber-400 dark:border-amber-500 bg-white dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 text-xs md:text-sm text-center font-bold text-amber-600 dark:text-amber-400 shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          value={Number.isNaN(editData.sellPrice) ? '' : editData.sellPrice}
                          onChange={(e) => handleEditChange('sellPrice', parseInt(e.target.value))}
                          placeholder="Rate"
                        />
                      ) : `৳${product.sellPrice || 0}`}
                    </td>
                    <td className="text-center flex items-center justify-center">
                      <div className="flex items-center justify-center gap-1.5 md:gap-2">
                        {editingId === product.id ? (
                          <>
                            <button 
                              onClick={saveEditing}
                              className="p-1.5 md:p-2 bg-emerald-500 text-white rounded-lg md:rounded-xl hover:bg-emerald-600 transition-all shadow-md"
                              title="Save Changes"
                            >
                              <Check size={16} />
                            </button>
                            <button 
                              onClick={cancelEditing}
                              className="p-1.5 md:p-2 bg-rose-500 text-white rounded-lg md:rounded-xl hover:bg-rose-600 transition-all shadow-md"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => startEditing(product)}
                              disabled={product.isSold}
                              className="p-1 md:p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg md:rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Edit Product"
                            >
                              <Pencil size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p>No wood items found matching your search.</p>
              </div>
            )}
            {filteredProducts.length > visibleCount && (
              <div ref={observerRef} className="p-4 text-center text-slate-500 font-medium text-sm border-t border-slate-100 dark:border-slate-800">
                <div className="animate-pulse flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span>Loading more items...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart/Checkout */}
        <div className="w-full box-border xl:w-[380px] bg-white dark:bg-black rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col h-auto min-w-0 self-start xl:sticky xl:top-3">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShoppingCart size={20} className="text-amber-500" /> Pos Wood
              </h2>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/10 text-black dark:text-black">
                  {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
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
                          className="px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer text-sm text-slate-700 dark:text-slate-200 font-medium transition-colors"
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
                            className="px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer text-sm text-slate-700 dark:text-slate-200 transition-colors border-t border-slate-50 dark:border-slate-800 flex items-center gap-3"
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

              {/* Manual Entry Section */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  addManualToCart()
                }}
                className="flex items-end gap-2 pt-2"
              >
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">W</label>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">L</label>
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
          <div className="p-6 space-y-3 flex flex-col h-auto">
            <AnimatePresence initial={false}>
              {cart.length === 0 ? (
                <motion.div 
                  key="empty-cart"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2 py-8 min-h-[140px]"
                >
                  <ShoppingCart size={48} strokeWidth={1} />
                  <p>Your cart is empty</p>
                </motion.div>
              ) : (
                cart.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="flex items-center justify-between gap-2 p-2.5 px-3 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group"
                  >
                    <span className="text-[10px] font-mono text-slate-400 min-w-[16px] shrink-0">{index + 1}.</span>
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
                        !getTagStyle(item.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(item.sellPrice)) < 0.01)?.name || '')) && getTagColor(item.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(item.sellPrice)) < 0.01)?.name || ''))
                      )}
                      style={getTagStyle(item.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(item.sellPrice)) < 0.01)?.name || ''))}
                    >
                      {item.tag || (tags.find(t => Math.abs(Number(t.sellPrice) - Number(item.sellPrice)) < 0.01)?.name || 'No Tag')}
                    </span>
                    <button 
                      onClick={() => removeFromCart(item.id)} 
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3 rounded-b-xl shrink-0">
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
                  type="number" 
                  className="w-40 p-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-right text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={discount === 0 ? '' : discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Delivery Charge */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">Delivery</span>
                <input 
                  type="number" 
                  className="w-40 p-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm text-right outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={deliveryCharge === 0 ? '' : deliveryCharge}
                  onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
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
                    type="number" 
                    className="w-40 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg text-sm text-right font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    value={paidAmount === 0 ? '' : paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
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
                  className="w-40 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm"
                >
                  {availableMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {checkoutError && (
              <div className="text-xs text-rose-500 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-100 dark:border-rose-800/50">
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
                    oldDue: (Number(customerData?.total_due) || 0),
                    total: currentTotal,
                    type: 'Wood',
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

        {/* Add Customer Modal */}
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

export default function POSWood() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <POSWoodContent />
    </Suspense>
  )
}
