'use client'

import React, { useState, useEffect, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import Image from 'next/image'
import { Search, Plus, Minus, Trash2, Printer, ShoppingCart, Armchair, LayoutGrid, List, Check, UserPlus, RotateCcw, ChevronDown } from 'lucide-react'
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

interface FurnitureProduct {
  id: number
  name: string
  category: string
  subCategory: string
  price: number
  stock: number
  image: string
  description?: string
  sku?: string
}

const subCategoriesMap: Record<string, string[]> = {
  'All': [],
  'Bed': ['Single', 'Double', 'King', 'Queen'],
  'Sofa': ['1-Seater', '2-Seater', '3-Seater', 'Corner'],
  'Dining': ['4-Seater', '6-Seater', '8-Seater'],
  'Chair': ['Office', 'Dining', 'Lounge'],
  'Wardrobe': ['2-Door', '3-Door', '4-Door'],
  'Office': ['Desk', 'File Cabinet'],
  'Dressing': ['Modern', 'Classic'],
  'TV Unit': ['Wall Mount', 'Floor Stand'],
  'Shelf': ['Wall', 'Floor']
}

import { useSearchParams } from 'next/navigation'

function POSFurnitureContent() {
  const searchParams = useSearchParams()
  const customerFromQuery = searchParams?.get('customer')

  const [products, setProducts] = useState<FurnitureProduct[]>([])
  const [dbCategories, setDbCategories] = useState<{id: string, name: string}[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const [cart, setCart] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeSubCategory, setActiveSubCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed')
  const [deliveryCharge, setDeliveryCharge] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [availableMethods, setAvailableMethods] = useState<string[]>(['Cash', 'Card', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Other'])
  const [deliveryDate, setDeliveryDate] = useState('') // Hydration fix
  const [checkoutError, setCheckoutError] = useState('')
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'warning' | 'info', title?: string }>({
    isOpen: false,
    message: '',
    type: 'error'
  })

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error', title?: string) => {
    setAlertConfig({ isOpen: true, message, type, title })
  }
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('Walk-in Customer')
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')

  const fetchProducts = React.useCallback(async () => {
    try {
      console.log('Fetching furniture products from Supabase...')
      setIsLoading(true)
      const { data, error } = await supabase
        .from('furniture_inventory')
        .select('*')
      
      if (error) throw error
      
      console.log(`Fetched ${data?.length || 0} furniture products`)
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          subCategory: p.sub_category,
          price: Number(p.price),
          stock: Number(p.stock),
          image: p.image?.startsWith('http:') ? p.image.replace('http:', 'https:') : p.image, // Ensure https
          description: p.description,
          sku: p.sku
        })))
      }
    } catch (error: any) {
      console.error('Error fetching inventory details:', error)
      toast.error('Failed to load products: ' + (error.message || 'Unknown network error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCategories = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('furniture_category')
        .select('id, name')
        .order('name', { ascending: true })
      
      if (error) throw error
      if (data) {
        setDbCategories(data)
      }
    } catch (error: any) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  const loadCustomers = React.useCallback(async () => {
    const { data, error } = await supabase.from('customer').select('*')
    if (data) setCustomers(data)
  }, [])

  const loadSettings = React.useCallback(async () => {
    try {
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
        setAvailableMethods(parsed.finance?.paymentMethods || defaultMethods)
      } else {
        setAvailableMethods(defaultMethods)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      setAvailableMethods(['Cash', 'Card', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Mobile Banking', 'Cheque', 'Other'])
    }
  }, [])

  useEffect(() => {
    setDeliveryDate(new Date().toISOString().split('T')[0]) // Initialize client-side to prevent hydration mismatch
    fetchProducts()
    fetchCategories()
    loadCustomers()
    loadSettings()
  }, [fetchProducts, fetchCategories, loadCustomers, loadSettings])

  useEffect(() => {
    if (customerFromQuery) {
      setSelectedCustomer(customerFromQuery)
    }
  }, [customerFromQuery])

  useEffect(() => {
    try {
      const savedView = localStorage.getItem('pos-furniture-viewmode') as 'grid' | 'list' | null
      if (savedView === 'grid' || savedView === 'list') {
        setViewMode(savedView)
      }
    } catch (e) {
      console.error('Error loading view mode from localStorage:', e)
    }
  }, [])

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

  const addToCart = (product: FurnitureProduct) => {
    const existing = cart.find(item => item.id === product.id)
    const currentQty = existing ? existing.quantity : 0
    
    if (currentQty >= product.stock) {
      showAlert(`Only ${product.stock} units available in stock.`, 'warning', 'Stock Limit')
      return
    }

    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const updateQuantity = (id: number, delta: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return

    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta
        if (newQty > product.stock) {
          showAlert(`Only ${product.stock} units available in stock.`, 'warning', 'Stock Limit')
          return item
        }
        return { ...item, quantity: Math.max(1, newQty) }
      }
      return item
    }))
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setCheckoutError('')

    const currentSubtotal = cart.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0)
    const currentDiscountAmount = discountType === 'fixed' ? discount : (currentSubtotal * discount / 100)
    const currentTotal = Math.round(currentSubtotal + deliveryCharge - currentDiscountAmount)
    const currentDue = Math.max(0, currentTotal - paidAmount)

    if (selectedCustomer === 'Walk-in Customer' && paidAmount < currentTotal) {
      setAlertConfig({
        isOpen: true,
        message: 'Walk-in Customer cannot buy on due. Please pay the full amount.',
        type: 'error'
      })
      return
    }

    try {
      setIsCheckingOut(true)
      
      // 1. Generate new Invoice ID (#INV-F-YYMMSS format)
      const tenantId = getTenantId();
      const invoiceNumber = await generateInvoiceId('Furniture', tenantId);

      const customerData = customers.find(c => c.name === selectedCustomer)

      // 2. Create Invoice in Supabase
      let finalInvoiceNumber = invoiceNumber;
      let finalInvoiceId = tenantId ? `${tenantId}_${finalInvoiceNumber}` : finalInvoiceNumber;
      let insertSuccess = false;
      let attempts = 0;
      let currentSerial = parseInt(invoiceNumber.slice(-2), 10);
      const basePrefix = invoiceNumber.slice(0, -2);
      const currentUser = getCurrentUser();
      const creatorName = currentUser?.name || currentUser?.username || 'Staff';
      const creatorId = currentUser?.id || currentUser?.username || null;

      while (!insertSuccess && attempts < 50) {
        const invoicePayload: any = {
          id: finalInvoiceId,
          invoice_number: finalInvoiceNumber,
          customer_id: customerData?.id || null,
          customer_name: selectedCustomer,
          customer_phone: customerData?.phone || null,
          customer_address: customerData?.address || null,
          type: 'Furniture',
          subtotal: currentSubtotal,
          discount: currentDiscountAmount,
          discount_type: discountType,
          delivery_charge: deliveryCharge,
          total: currentTotal,
          paid_amount: paidAmount,
          due_amount: currentDue,
          payment_method: paymentMethod,
          delivery_date: deliveryDate,
          delivery_status: 'Pending',
          created_by: creatorId,
          created_by_name: creatorName
        };

        let { error: invError } = await supabase.from('furniture_invoices').insert([invoicePayload]);

        if (invError && (invError.code === 'PGRST204' || invError.message?.includes('schema cache') || invError.message?.includes('created_by'))) {
          delete invoicePayload.created_by;
          delete invoicePayload.created_by_name;
          const retry = await supabase.from('furniture_invoices').insert([invoicePayload]);
          invError = retry.error;
        }

        if (invError) {
          if (invError.code === '23505') { // Postgres duplicate key error code
            attempts++;
            currentSerial++;
            finalInvoiceNumber = `${basePrefix}${String(currentSerial).padStart(2, '0')}`;
            finalInvoiceId = tenantId ? `${tenantId}_${finalInvoiceNumber}` : finalInvoiceNumber;
            continue;
          } else {
            throw invError;
          }
        }
        insertSuccess = true;
      }

      // Record creator for cache and settings persistence
      recordInvoiceCreator(finalInvoiceId, creatorName, creatorId || undefined);

      // 3. Insert Invoice Items and update stock
      const invoiceItems = cart.map(item => ({
        invoice_id: finalInvoiceId,
        product_type: 'furniture',
        product_id: Number(item.id),
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        total: Number(item.price * item.quantity)
      }))

      const { error: itemsError } = await supabase.from('furniture_invoice_items').insert(invoiceItems)
      if (itemsError) throw itemsError

      // Update stock in furniture_inventory
      for (const item of cart) {
        const product = products.find(p => p.id === item.id)
        if (product) {
          const { error: stockError } = await supabase
            .from('furniture_inventory')
            .update({ stock: Number(product.stock - item.quantity) })
            .eq('id', item.id)
          if (stockError) throw stockError
        }
      }

      // 4. Update customer total_due and total_orders if not Walk-in
      const newTotalDue = (Number(customerData?.total_due) || 0) + currentDue
      
      if (selectedCustomer !== 'Walk-in Customer' && customerData) {
        const newTotalOrders = (Number(customerData?.total_orders) || 0) + 1
        
        const { error: cusError } = await supabase
          .from('customer')
          .update({ 
            total_due: Number(newTotalDue),
            total_orders: newTotalOrders
          })
          .eq('id', customerData.id)
        if (cusError) throw cusError
      }

      // 5. Send SMS
      if (selectedCustomer !== 'Walk-in Customer' && customerData?.phone) {
        const smsMessage = `Dear ${selectedCustomer}, your order ${getDisplayInvoiceId(finalInvoiceId)} has been confirmed. Total: ৳${currentTotal.toLocaleString()}, Paid: ৳${paidAmount.toLocaleString()}. Thank you for choosing FurniTrack!`
        sendSMS(customerData.phone, smsMessage).catch(err => console.error('SMS failed:', err))
      }

      // 6. Record transaction
      const { error: txnError } = await supabase.from('transactions').insert([{
        id: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        customer_id: selectedCustomer === 'Walk-in Customer' ? null : customerData?.id,
        date: new Date().toISOString().split('T')[0],
        type: 'Invoice',
        ref: finalInvoiceId,
        debit: Number(currentTotal),
        credit: Number(paidAmount),
        balance: selectedCustomer === 'Walk-in Customer' ? Number(currentDue) : Number(newTotalDue),
        method: paymentMethod || 'Cash',
        notes: paymentMethod || 'Cash'
      }])

      if (txnError) throw txnError

      // Success UI
      addNotification('sale', 'New Furniture Sale', `Invoice ${getDisplayInvoiceId(finalInvoiceId)} created. Paid: ৳${paidAmount.toLocaleString()} (${paymentMethod || 'Cash'}), Due: ৳${currentDue.toLocaleString()}`);

      const createdInvoiceObject = {
        id: finalInvoiceId,
        invoice_number: finalInvoiceNumber,
        customer: selectedCustomer,
        customer_name: selectedCustomer,
        customerPhone: customerData?.phone,
        customerAddress: customerData?.address,
        paid: paidAmount,
        paid_amount: paidAmount,
        paymentMethod: paymentMethod || 'Cash',
        payment_method: paymentMethod || 'Cash',
        due: currentDue,
        due_amount: currentDue,
        oldDue: Number(customerData?.total_due || 0),
        total: currentTotal,
        date: new Date().toISOString().split('T')[0],
        type: 'Furniture',
        deliveryDate: deliveryDate,
        delivery_date: deliveryDate,
        deliveryStatus: 'Pending',
        delivery_status: 'Pending',
        deliveryCharge: deliveryCharge,
        discount: discount,
        discountType: discountType,
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity
        })),
        payments: paidAmount > 0 ? [{
          date: new Date().toISOString().split('T')[0],
          method: paymentMethod || 'Cash',
          amount: paidAmount
        }] : []
      };

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('last_created_furniture_invoice', JSON.stringify(createdInvoiceObject));
          const existingListStr = localStorage.getItem('furniture_invoices');
          const existingList = existingListStr ? JSON.parse(existingListStr) : [];
          if (Array.isArray(existingList)) {
            existingList.unshift(createdInvoiceObject);
            localStorage.setItem('furniture_invoices', JSON.stringify(existingList.slice(0, 50)));
          }
          window.dispatchEvent(new CustomEvent('invoice-created', { detail: createdInvoiceObject }));
        } catch (e) {
          console.warn('LocalStorage save error on furniture checkout:', e);
        }
      }

      setSelectedInvoice(createdInvoiceObject)
      
      toast.success('Order placed successfully')
      fetchProducts()
      loadCustomers()
      setCart([])
      setSelectedCustomer('Walk-in Customer')
      setDiscount(0)
      setDiscountType('fixed')
      setDeliveryCharge(0)
      setPaidAmount(0)
      setDeliveryDate(new Date().toISOString().split('T')[0])
      setIsCheckoutSuccess(true)

    } catch (error: any) {
      console.error('Furniture checkout error details:', error)
      toast.error(error.message || 'Failed to place order')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
  const discountAmount = discountType === 'fixed' ? discount : (subtotal * discount / 100)
  const total = Math.round(subtotal + deliveryCharge - discountAmount)
  const dueAmount = Math.max(0, total - paidAmount)

  const filteredProducts = products.filter(p => 
    (activeCategory === 'All' || p.category === activeCategory) &&
    (activeSubCategory === 'All' || p.subCategory === activeSubCategory) &&
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="flex flex-col-reverse xl:flex-row gap-6 min-h-[calc(100vh-120px)] xl:h-auto min-w-0 pb-20 xl:pb-0">
        {/* Left: Product Selection */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 min-h-[600px] xl:min-h-0 xl:h-auto">
          <div className="flex flex-col md:flex-row gap-4 items-end sticky top-0 z-20 bg-slate-50/80 dark:bg-black/80 backdrop-blur-md py-4 -mt-4 mb-2">
            <div className="flex flex-col gap-1 flex-1 w-full">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Search</label>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search furniture..." 
                  className="w-full pl-10 pr-4 h-[42px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto items-end">
              <div className="flex flex-col gap-1 flex-1 md:w-48">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Category</label>
                <select
                  value={activeCategory}
                  onChange={(e) => {
                    setActiveCategory(e.target.value)
                    setActiveSubCategory('All')
                  }}
                  className="w-full px-3 h-[42px] bg-white border border-slate-200 dark:border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-black dark:text-black appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                >
                  <option value="All" className="text-black bg-white">All Categories</option>
                  {dbCategories.map(cat => (
                    <option key={cat.id} value={cat.name} className="text-black bg-white">{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl h-[42px] border border-slate-200/60 dark:border-slate-800 relative select-none shrink-0">
                <button 
                  onClick={() => {
                    setViewMode('grid')
                    try {
                      localStorage.setItem('pos-furniture-viewmode', 'grid')
                    } catch (e) {
                      console.error(e)
                    }
                  }}
                  className={cn(
                    "relative px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider transition-colors duration-200 z-10", 
                    viewMode === 'grid' ? "text-amber-600 dark:text-amber-500 font-extrabold" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <LayoutGrid size={15} className="stroke-[2.5]" />
                  <span>Grid</span>
                  {viewMode === 'grid' && (
                    <motion.div
                      layoutId="activeViewModeTab"
                      className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm -z-10 border border-slate-200/50 dark:border-slate-700/50"
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    />
                  )}
                </button>
                <button 
                  onClick={() => {
                    setViewMode('list')
                    try {
                      localStorage.setItem('pos-furniture-viewmode', 'list')
                    } catch (e) {
                      console.error(e)
                    }
                  }}
                  className={cn(
                    "relative px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider transition-colors duration-200 z-10", 
                    viewMode === 'list' ? "text-amber-600 dark:text-amber-500 font-extrabold" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <List size={15} className="stroke-[2.5]" />
                  <span>List</span>
                  {viewMode === 'list' && (
                    <motion.div
                      layoutId="activeViewModeTab"
                      className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm -z-10 border border-slate-200/50 dark:border-slate-700/50"
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="w-full pr-2 h-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                <p>Loading furniture inventory...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4 text-slate-400">
                <Armchair size={48} className="opacity-20" />
                <p>No furniture products available</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {viewMode === 'grid' ? (
                  <motion.div
                    key="grid-container"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
                  >
                    {filteredProducts.map((product, idx) => {
                      const cartItem = cart.find(item => item.id === product.id);
                      const cartQuantity = cartItem ? cartItem.quantity : 0;
                      const displayStock = Math.max(0, product.stock - cartQuantity);
                      const isLowStock = displayStock > 0 && displayStock <= 5;
                      const isOutOfStock = displayStock === 0;
                      
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.96, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.015, 0.15), duration: 0.25, ease: "easeOut" }}
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800/80 shadow-sm hover:shadow-[0_10px_25px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_10px_25px_rgba(0,0,0,0.2)] hover:border-amber-500/50 dark:hover:border-amber-500/50 transition-all duration-300 cursor-pointer group overflow-hidden flex flex-col justify-between active:scale-[0.985] h-full"
                        >
                          {/* Image container - h-20 sm:h-24 for super compact, clean feel */}
                          <div className="h-20 sm:h-24 w-full overflow-hidden bg-slate-50 dark:bg-slate-800 relative shrink-0 border-b border-slate-100 dark:border-slate-800/60">
                            <Image 
                              src={product.image || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80'} 
                              alt={product.name} 
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-500" 
                              referrerPolicy="no-referrer"
                            />
                            {/* Badges on top of image - category option right side */}
                            <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 items-center flex-wrap justify-end">
                              <span className="bg-amber-100/95 dark:bg-amber-200/95 text-black dark:text-black border border-amber-300/50 dark:border-amber-400/50 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider backdrop-blur-sm shadow-sm">
                                {product.category}
                              </span>
                              {product.subCategory && (
                                <span className="bg-slate-900/80 dark:bg-slate-100/80 text-white dark:text-slate-950 text-[8px] font-bold px-1 py-0.5 rounded backdrop-blur-sm">
                                  {product.subCategory}
                                </span>
                              )}
                            </div>

                            {/* Stock label on image - positioned on bottom-left for balance */}
                            <div className="absolute bottom-1.5 left-1.5 z-10">
                              <span className={cn(
                                "text-[7.5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm flex items-center gap-1 border shadow-sm text-black dark:text-black",
                                isOutOfStock 
                                  ? "bg-rose-100/95 dark:bg-rose-200/95 border-rose-300/50 dark:border-rose-400/50"
                                  : isLowStock
                                    ? "bg-amber-100/95 dark:bg-amber-200/95 border-amber-300/50 dark:border-amber-400/50"
                                    : "bg-emerald-100/95 dark:bg-emerald-200/95 border-emerald-300/50 dark:border-emerald-400/50"
                              )}>
                                <span className={cn(
                                  "w-1 h-1 rounded-full inline-block animate-pulse",
                                  isOutOfStock ? "bg-rose-500" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                                )} />
                                {isOutOfStock ? 'Sold Out' : `${displayStock} left`}
                              </span>
                            </div>
                          </div>

                          {/* Content panel */}
                          <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between gap-1.5">
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[11px] sm:text-xs line-clamp-1 mt-0.5 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors tracking-tight">
                                {product.name}
                              </h4>
                              {product.description && (
                                <p className="text-[9.5px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0 font-medium leading-none">
                                  {product.description}
                                </p>
                              )}
                            </div>

                            {/* Pricing & Quick Add */}
                            <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/50 pt-1.5 shrink-0">
                              <div className="min-w-0">
                                <p className="font-black text-slate-900 dark:text-slate-50 text-xs sm:text-sm leading-tight tracking-tight">
                                  ৳{product.price.toLocaleString()}
                                </p>
                              </div>
                              
                              <div className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200/50 dark:border-slate-700/50 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-600 group-hover:border-transparent transition-all duration-300 shadow-sm shrink-0 transform group-hover:scale-105 active:scale-95">
                                <Plus size={12} className="stroke-[3]" />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="list-container"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="space-y-3"
                  >
                    {filteredProducts.map((product, idx) => {
                      const cartItem = cart.find(item => item.id === product.id);
                      const cartQuantity = cartItem ? cartItem.quantity : 0;
                      const displayStock = Math.max(0, product.stock - cartQuantity);
                      const isLowStock = displayStock > 0 && displayStock <= 5;
                      const isOutOfStock = displayStock === 0;
                      
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.98, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.015, 0.15), duration: 0.25, ease: "easeOut" }}
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-150 dark:border-slate-800/80 flex items-center justify-between gap-3 hover:border-amber-500/50 dark:hover:border-amber-500/50 hover:shadow-[0_6px_20px_rgba(0,0,0,0.03)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.18)] cursor-pointer transition-all duration-300 group active:scale-[0.99] relative overflow-hidden"
                        >
                          {/* Accent left border that glides in on hover */}
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />

                          {/* Left Side: Product Image & Basic Info */}
                          <div className="flex items-center gap-3 min-w-0 pl-0.5 flex-1">
                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-750 shrink-0 shadow-inner group-hover:scale-[1.02] transition-transform duration-300">
                              <Image 
                                src={product.image || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80'} 
                                alt={product.name}
                                fill
                                sizes="56px"
                                className="object-cover group-hover:scale-110 transition-transform duration-500" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 mt-1 sm:text-sm text-xs line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors tracking-tight">
                                {product.name}
                              </h4>
                              
                              {product.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 font-medium leading-none">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right Side: Quantity/Stock & Pricing / Hover CTA */}
                          <div className="flex items-center gap-4 shrink-0 pr-0.5">
                            {/* Category Badge & Subcategory badge on right */}
                            <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                              <span className="bg-amber-100 dark:bg-amber-200 text-black dark:text-black border border-amber-300/50 dark:border-amber-400/50 text-[8.5px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded shadow-sm">
                                {product.category}
                              </span>
                              {product.subCategory && (
                                <span className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 text-[8.5px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                  {product.subCategory}
                                </span>
                              )}
                            </div>

                            {/* Stock status indicator */}
                            <div className="hidden sm:flex flex-col items-end shrink-0">
                              <span className={cn(
                                "text-[8.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border flex items-center gap-1 shadow-sm transition-colors text-black dark:text-black",
                                isOutOfStock 
                                  ? "bg-rose-100 dark:bg-rose-200 border-rose-300/50 dark:border-rose-400/50"
                                  : isLowStock
                                    ? "bg-amber-100 dark:bg-amber-200 border-amber-300/50 dark:border-amber-400/50"
                                    : "bg-emerald-100 dark:bg-emerald-200 border-emerald-300/50 dark:border-emerald-400/50"
                              )}>
                                <span className={cn(
                                  "w-1 h-1 rounded-full inline-block animate-pulse",
                                  isOutOfStock 
                                    ? "bg-rose-500" 
                                    : isLowStock 
                                      ? "bg-amber-500" 
                                      : "bg-emerald-500"
                                  )} />
                                {isOutOfStock ? 'Sold Out' : `${displayStock} left`}
                              </span>
                            </div>

                            {/* Price and Add button */}
                            <div className="flex items-center gap-3 shrink-0">
                              {/* Desktop Price */}
                              <div className="hidden sm:block text-right">
                                <p className="font-black text-slate-900 dark:text-slate-50 text-sm sm:text-base tracking-tight">
                                  ৳{product.price.toLocaleString()}
                                </p>
                              </div>

                              {/* Mobile Aligned Block: Category -> Stock -> Taka (Price) */}
                              <div className="sm:hidden flex flex-col items-end gap-1.5 shrink-0 min-w-[85px] py-0.5">
                                {/* 1. Category */}
                                <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none shadow-sm ml-0 mr-[63px]">
                                  {product.category}
                                </span>

                                {/* 2. Stock */}
                                <span className={cn(
                                  "text-[8.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border shadow-sm leading-none mr-0 mt-[-20px] mb-[4px]",
                                  isOutOfStock 
                                    ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/30"
                                    : isLowStock
                                      ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30"
                                      : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-400/30"
                                )}>
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full inline-block animate-pulse",
                                    isOutOfStock 
                                      ? "bg-rose-500" 
                                      : isLowStock 
                                        ? "bg-amber-500" 
                                        : "bg-emerald-500"
                                  )} />
                                  {isOutOfStock ? 'Sold' : `${displayStock} left`}
                                </span>

                                {/* 3. Taka (Price) */}
                                <p className="font-extrabold text-slate-900 dark:text-slate-50 text-[12px] tracking-tight leading-none mr-[9px] mb-0 mt-[-1.25px]">
                                  ৳{product.price.toLocaleString()}
                                </p>
                              </div>

                              {/* Quick selection CTA button */}
                              <div className="p-1.5 sm:p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200/60 dark:border-slate-750 group-hover:bg-amber-500 group-hover:text-white group-hover:border-transparent transition-all duration-300 transform group-hover:scale-105 active:scale-95 flex items-center justify-center shrink-0 shadow-sm">
                                <Plus size={14} className="stroke-[3]" />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Right: Cart/Checkout */}
        <div className="w-full xl:w-[380px] bg-white dark:bg-black rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col xl:h-auto min-h-0 min-w-0 self-start xl:sticky xl:top-0 xl:max-h-[calc(100vh-4rem)]">
          <div className="p-6 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShoppingCart className="text-amber-500" size={20} /> Pos Furniture
              </h2>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/10 text-black dark:text-black">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
                </span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div 
                    className="flex items-center w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 relative z-30 shadow-sm focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all"
                  >
                    {(() => {
                      if (!isCustomerDropdownOpen) {
                        const cust = customers.find(c => c.name === selectedCustomer);
                        if (cust?.photo) {
                          // eslint-disable-next-line @next/next/no-img-element
                          return <img src={cust.photo} alt={cust.name} className="w-5 h-5 rounded-full object-cover mr-2 shrink-0 border border-slate-200 dark:border-slate-700" />;
                        }
                      }
                      return <Search className="text-slate-400 dark:text-slate-500 mr-2 shrink-0" size={14} />;
                    })()}
                    <input 
                      type="text"
                      placeholder="Search or Select Customer..."
                      className="bg-transparent outline-none flex-1 text-sm w-full min-w-0 text-slate-900 dark:text-slate-100 placeholder:text-slate-450 dark:placeholder:text-slate-650 font-medium"
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
                      className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {isCustomerDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsCustomerDropdownOpen(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-1">
                        <div 
                          className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-800 dark:text-slate-200 font-bold transition-colors"
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
                            className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-800 dark:text-slate-200 transition-colors border-t border-slate-100 dark:border-slate-800/50 flex items-center gap-3"
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
                              <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                                {c.name.charAt(0)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-semibold">{c.name}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{c.phone}</span>
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
                  className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center justify-center shrink-0"
                  title="Add New Customer"
                >
                  <UserPlus size={18} />
                </button>
                <button 
                  onClick={() => {
                    setCart([])
                    setSelectedCustomer('Walk-in Customer')
                  }}
                  className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white active:scale-95 rounded-xl transition-all flex items-center justify-center border border-rose-500/20 shrink-0 shadow-sm"
                  title="Reset Order"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="w-full p-6 space-y-4 flex flex-col flex-1 overflow-y-auto min-h-0">
            <AnimatePresence>
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Armchair size={48} strokeWidth={1} />
                  <p>No furniture selected</p>
                </div>
              ) : (
                cart.map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{item.name}</span>
                        <span className="text-[10px] text-slate-400">({item.quantity} pcs)</span>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-500">= ৳{Number(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"><Minus size={12} /></button>
                      <span className="text-[10px] font-bold w-4 text-center dark:text-slate-100">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"><Plus size={12} /></button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id)} 
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3 rounded-b-xl">
            <div className="space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-slate-400 text-xs">
                <span>Subtotal</span>
                <span>৳{Math.round(subtotal).toLocaleString()}</span>
              </div>
              
              {/* Discount Section - One Line */}
              <div className="flex items-center justify-between gap-2 py-1 border-y border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-1.5 min-w-fit">
                  <span className="text-slate-600 dark:text-slate-400 text-xs">Disc.</span>
                  <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                    <button 
                      onClick={() => setDiscountType('fixed')}
                      className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded", discountType === 'fixed' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500" : "text-slate-400")}
                    >৳</button>
                    <button 
                      onClick={() => setDiscountType('percent')}
                      className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded", discountType === 'percent' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500" : "text-slate-400")}
                    >%</button>
                  </div>
                </div>
                <input 
                  type="number" 
                  className="w-40 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm text-right outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={discount === 0 ? '' : discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Delivery Charge */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">Delivery Charge</span>
                <input 
                  type="number" 
                  className="w-40 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm text-right outline-none focus:border-amber-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={deliveryCharge === 0 ? '' : deliveryCharge}
                  onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Delivery Date */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">Delivery Date</span>
                <input 
                  type="date" 
                  className="w-40 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm text-right outline-none focus:border-amber-500 transition-all"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
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
                  className="w-40 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm"
                >
                  {availableMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {checkoutError && (
              <div className="text-xs text-rose-500 font-medium bg-rose-50 dark:bg-rose-900/30 p-2 rounded-lg border border-rose-100 dark:border-rose-900/50">
                {checkoutError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button className="py-4 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                <Printer size={18} /> A4 Print
              </button>
              <button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="py-4 px-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCheckingOut ? (
                  <>
                    <RotateCcw className="animate-spin" size={18} /> Processing...
                  </>
                ) : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {isCheckoutSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutSuccess(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={40} strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Order Successful!</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8">The furniture stock has been updated and the invoice is ready.</p>
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

      <InvoiceModal 
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoice={selectedInvoice}
      />
      {/* Add Customer Modal */}
      <AddCustomerModal 
        isOpen={isAddingCustomer}
        onClose={() => setIsAddingCustomer(false)}
        onAdd={handleAddCustomer}
      />

      <AlertPopup 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        message={alertConfig.message}
        type={alertConfig.type}
        title={alertConfig.title}
      />
    </DashboardLayout>
  )
}

export default function POSFurniture() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <POSFurnitureContent />
    </Suspense>
  )
}
