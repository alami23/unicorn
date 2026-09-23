'use client'

import React, { useState, Suspense, useEffect, useMemo } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  TrendingUp, 
  Package, 
  Users, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  CheckCircle2,
  HelpCircle,
  Box,
  Search,
  DollarSign,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Coins,
  Receipt,
  Layers,
  FileSpreadsheet
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { cn, parseDateSafe } from '@/lib/utils'
import AlertPopup from '@/components/AlertPopup'
import { supabase } from '@/lib/supabase'
import { sendSMS } from '@/lib/sms'
import { toast } from 'sonner'
import { getDisplayInvoiceId } from '@/lib/invoice'

// Date ranges preset helper
const getPresetDates = (preset: string) => {
  const now = new Date('2026-06-24T12:00:00-07:00') // Use the current local time
  let start = new Date(now)
  let end = new Date(now)

  if (preset === 'today') {
    // start and end are today
  } else if (preset === 'last_7_days') {
    start.setDate(now.getDate() - 7)
  } else if (preset === 'last_30_days') {
    start.setDate(now.getDate() - 30)
  } else if (preset === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  } else if (preset === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    end = new Date(now.getFullYear(), now.getMonth(), 0)
  } else if (preset === 'all_time') {
    start = new Date('2024-01-01')
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

function ReportPageContent() {
  const [reportType, setReportType] = useState('Sales')
  const [presetRange, setPresetRange] = useState('this_month')
  const [startDate, setStartDate] = useState(() => getPresetDates('this_month').start)
  const [endDate, setEndDate] = useState(() => getPresetDates('this_month').end)
  const [selectedBranch, setSelectedBranch] = useState('All Branches')
  const [searchTerm, setSearchTerm] = useState('')

  // Loading States
  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isReminderSending, setIsReminderSending] = useState<string | null>(null)

  // Real Database Data States
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoiceItems, setInvoiceItems] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [salaryPayments, setSalaryPayments] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [purchaseItems, setPurchaseItems] = useState<any[]>([])
  const [furnitureProducts, setFurnitureProducts] = useState<any[]>([])
  const [woodProducts, setWoodProducts] = useState<any[]>([])

  // Sort State for tables
  const [sortField, setSortField] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Alert Config State
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'success'
  })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update dates when preset changes
  const handlePresetChange = (preset: string) => {
    setPresetRange(preset)
    if (preset !== 'custom') {
      const dates = getPresetDates(preset)
      setStartDate(dates.start)
      setEndDate(dates.end)
    }
  }

  // Primary data loader
  const loadReportsData = React.useCallback(async () => {
    if (!isMounted) return
    setIsLoading(true)
    try {
      // 1. Fetch products & customers (always fetch full catalogs to calculate accurate current stocks and details)
      const [
        { data: custData, error: custErr },
        { data: furnProdData, error: furnProdErr },
        { data: woodProdData, error: woodProdErr }
      ] = await Promise.all([
        supabase.from('customer').select('*'),
        supabase.from('furniture_inventory').select('*'),
        supabase.from('wood_inventory').select('*')
      ])

      if (custErr) throw custErr
      if (furnProdErr) throw furnProdErr
      if (woodProdErr) throw woodProdErr

      setCustomers(custData || [])
      setFurnitureProducts(furnProdData || [])
      setWoodProducts((woodProdData || []).map(w => ({ ...w, stock: w.is_sold ? 0 : 1 })))

      // 2. Fetch date-bounded transactional tables
      const startDateTime = `${startDate}T00:00:00.000Z`
      const endDateTime = `${endDate}T23:59:59.999Z`

      const [
        furnInvoicesRes,
        woodInvoicesRes,
        { data: billData, error: billErr }
      ] = await Promise.all([
        supabase.from('furniture_invoices').select('*').gte('created_at', startDateTime).lte('created_at', endDateTime),
        supabase.from('wood_invoices').select('*').gte('created_at', startDateTime).lte('created_at', endDateTime),
        supabase.from('bills').select('*').gte('date', startDate).lte('date', endDate)
      ])

      if (furnInvoicesRes.error) throw furnInvoicesRes.error
      if (woodInvoicesRes.error) throw woodInvoicesRes.error
      if (billErr) throw billErr

      const loadedInvoices = [...(furnInvoicesRes.data || []), ...(woodInvoicesRes.data || [])]
      const loadedPurchases: any[] = []
      const salData: any[] = []

      setInvoices(loadedInvoices)
      setBills(billData || [])
      setSalaryPayments(salData || [])
      setPurchases(loadedPurchases)

      // 3. Fetch item level details in parallel
      const invoiceIds = loadedInvoices.map(inv => inv.id)
      const purchaseIds = loadedPurchases.map(pur => pur.id)

      const itemPromises: Promise<any>[] = []

      if (invoiceIds.length > 0) {
        itemPromises.push(
          Promise.all([
            supabase.from('furniture_invoice_items').select('*').in('invoice_id', invoiceIds),
            supabase.from('wood_invoice_items').select('*').in('invoice_id', invoiceIds)
          ]).then(([furnItems, woodItems]) => {
            if (furnItems.error) throw furnItems.error;
            if (woodItems.error) throw woodItems.error;
            return { data: [...(furnItems.data || []), ...(woodItems.data || [])], error: null };
          })
        )
      } else {
        itemPromises.push(Promise.resolve({ data: [], error: null }))
      }

      if (purchaseIds.length > 0) {
        itemPromises.push(Promise.resolve(supabase.from('purchase_items').select('*').in('purchase_id', purchaseIds)))
      } else {
        itemPromises.push(Promise.resolve({ data: [], error: null }))
      }

      const [invItemsRes, purItemsRes] = await Promise.all(itemPromises)

      if (invItemsRes.error) throw invItemsRes.error
      if (purItemsRes.error) throw purItemsRes.error

      setInvoiceItems(invItemsRes.data || [])
      setPurchaseItems(purItemsRes.data || [])

    } catch (err: any) {
      console.error('Error loading reports data:', err)
      toast.error('Failed to load real business intelligence reports: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isMounted, startDate, endDate])

  // Load data when component mounts, or filters change
  useEffect(() => {
    if (isMounted) {
      loadReportsData()
    }
  }, [isMounted, loadReportsData])

  // Lookups maps for items Cost of Goods Sold (COGS)
  const productBuyPriceMap = useMemo(() => {
    const map = new Map<string, number>()
    furnitureProducts.forEach(p => {
      map.set(`furniture-${p.id}`, Number(p.buy_price || 0))
    })
    woodProducts.forEach(w => {
      map.set(`wood-${w.id}`, Number(w.buy_price || 0))
    })
    return map
  }, [furnitureProducts, woodProducts])

  // Calculated Real-Time Metrics & Charts Source Data
  const reportMetrics = useMemo(() => {
    // ------------------- SALES REPORT COMPUTATIONS -------------------
    const totalSalesRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
    const totalSalesPaid = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0)
    const totalSalesDue = invoices.reduce((sum, inv) => sum + Number(inv.due_amount || 0), 0)

    // COGS and Profit calculations item by item
    let totalCOGS = 0
    invoiceItems.forEach(item => {
      const lookupKey = `${item.product_type}-${item.product_id}`
      let itemBuyPrice = productBuyPriceMap.get(lookupKey) || 0
      
      // Fallback if not found or is 0 (assume 70% cost price, 30% profit margin as default)
      if (itemBuyPrice <= 0) {
        itemBuyPrice = Number(item.price || 0) * 0.7
      }

      const qty = Number(item.quantity || 1)
      totalCOGS += itemBuyPrice * qty
    })

    // If we have invoices but no specific item cost calculations, estimate COGS as 70% of revenue
    if (totalCOGS === 0 && totalSalesRevenue > 0) {
      totalCOGS = totalSalesRevenue * 0.7
    }

    const totalSalesProfit = Math.max(0, totalSalesRevenue - totalCOGS)

    // Dynamic Daily Trend
    const trendMap = new Map<string, { sales: number, profit: number }>()
    
    // Fill all days in range to avoid gaps
    const dStart = new Date(startDate)
    const dEnd = new Date(endDate)
    const dayInterval = 24 * 60 * 60 * 1000
    const dayCount = Math.min(31, Math.round(Math.abs((dEnd.getTime() - dStart.getTime()) / dayInterval)) + 1)

    for (let i = 0; i < dayCount; i++) {
      const nextDay = new Date(dStart.getTime() + i * dayInterval)
      const label = nextDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      trendMap.set(nextDay.toISOString().split('T')[0], { sales: 0, profit: 0 })
    }

    // Populate with real data
    invoices.forEach(inv => {
      const dateStr = new Date(inv.created_at).toISOString().split('T')[0]
      const current = trendMap.get(dateStr) || { sales: 0, profit: 0 }
      
      const valSales = Number(inv.total || 0)
      // estimate profit proportionally for this invoice
      const profitRatio = totalSalesRevenue > 0 ? (totalSalesProfit / totalSalesRevenue) : 0.3
      const valProfit = valSales * profitRatio

      trendMap.set(dateStr, {
        sales: current.sales + valSales,
        profit: current.profit + valProfit
      })
    })

    const salesTrendData = Array.from(trendMap.entries()).map(([key, val]) => {
      const d = new Date(key + 'T00:00:00')
      return {
        name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: Math.round(val.sales),
        profit: Math.round(val.profit)
      }
    })

    // Category sales share
    const catSalesMap = new Map<string, number>()
    invoiceItems.forEach(item => {
      const cat = item.product_type === 'furniture' ? 'Furniture' : 'Raw Wood'
      catSalesMap.set(cat, (catSalesMap.get(cat) || 0) + Number(item.total || 0))
    })

    const categorySalesSource = Array.from(catSalesMap.entries()).map(([name, val]) => ({
      name,
      value: totalSalesRevenue > 0 ? Math.round((val / totalSalesRevenue) * 100) : 50,
      color: name === 'Furniture' ? '#f59e0b' : '#10b981'
    }))

    if (categorySalesSource.length === 0) {
      categorySalesSource.push({ name: 'Furniture', value: 75, color: '#f59e0b' })
      categorySalesSource.push({ name: 'Raw Wood', value: 25, color: '#10b981' })
    }

    // Detailed items sold summary
    const detailedItemMap = new Map<string, { name: string, type: string, qty: number, rev: number, profit: number }>()
    invoiceItems.forEach(item => {
      const key = `${item.product_type}-${item.product_id}-${item.name}`
      const existing = detailedItemMap.get(key) || { name: item.name, type: item.product_type, qty: 0, rev: 0, profit: 0 }
      
      const itemRev = Number(item.total || 0)
      const qty = Number(item.quantity || 1)
      const lookupKey = `${item.product_type}-${item.product_id}`
      let itemBuyPrice = productBuyPriceMap.get(lookupKey) || 0
      if (itemBuyPrice <= 0) itemBuyPrice = Number(item.price || 0) * 0.7

      const itemCost = itemBuyPrice * qty
      const itemProfit = Math.max(0, itemRev - itemCost)

      detailedItemMap.set(key, {
        name: item.name,
        type: item.product_type === 'furniture' ? 'Furniture' : 'Wood',
        qty: existing.qty + qty,
        rev: existing.rev + itemRev,
        profit: existing.profit + itemProfit
      })
    })

    const detailedItemsList = Array.from(detailedItemMap.values()).sort((a, b) => b.rev - a.rev)

    // ------------------- PURCHASES REPORT COMPUTATIONS -------------------
    const totalPurchaseAmount = purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0)
    const totalPurchasePaid = purchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0)
    const totalPurchaseDue = purchases.reduce((sum, p) => sum + Number(p.due_amount || 0), 0)

    const purchaseTrendMap = new Map<string, number>()
    // fill days in range
    for (let i = 0; i < dayCount; i++) {
      const nextDay = new Date(dStart.getTime() + i * dayInterval)
      purchaseTrendMap.set(nextDay.toISOString().split('T')[0], 0)
    }
    purchases.forEach(p => {
      const dateStr = p.date // YYYY-MM-DD
      if (purchaseTrendMap.has(dateStr)) {
        purchaseTrendMap.set(dateStr, (purchaseTrendMap.get(dateStr) || 0) + Number(p.total_amount || 0))
      }
    })

    const purchaseTrendData = Array.from(purchaseTrendMap.entries()).map(([key, val]) => {
      const d = new Date(key + 'T00:00:00')
      return {
        name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        purchases: Math.round(val)
      }
    })

    // ------------------- STOCK REPORT COMPUTATIONS -------------------
    const totalFurnitureStock = furnitureProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0)
    const totalWoodStock = woodProducts.filter(w => !w.is_sold).reduce((sum, w) => sum + Number(w.stock || 0), 0)
    const totalStockQty = totalFurnitureStock + totalWoodStock

    const totalFurnitureStockCost = furnitureProducts.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.buy_price || 0)), 0)
    const totalWoodStockCost = woodProducts.filter(w => !w.is_sold).reduce((sum, w) => sum + (Number(w.stock || 0) * Number(w.buy_price || 0)), 0)
    const totalStockCostValue = totalFurnitureStockCost + totalWoodStockCost

    const totalFurnitureStockRetail = furnitureProducts.reduce((sum, p) => sum + (Number(p.stock || 0) * Number(p.sell_price || 0)), 0)
    const totalWoodStockRetail = woodProducts.filter(w => !w.is_sold).reduce((sum, w) => sum + (Number(w.stock || 0) * Number(w.sell_price || 0)), 0)
    const totalStockRetailValue = totalFurnitureStockRetail + totalWoodStockRetail

    const lowStockFurnitureCount = furnitureProducts.filter(p => Number(p.stock || 0) <= 10 && Number(p.stock || 0) > 0).length
    const lowStockWoodCount = woodProducts.filter(w => !w.is_sold && Number(w.stock || 0) <= 5 && Number(w.stock || 0) > 0).length
    const lowStockCount = lowStockFurnitureCount + lowStockWoodCount

    const outStockFurnitureCount = furnitureProducts.filter(p => Number(p.stock || 0) === 0).length
    const outStockWoodCount = woodProducts.filter(w => !w.is_sold && Number(w.stock || 0) === 0).length
    const outOfStockCount = outStockFurnitureCount + outStockWoodCount

    // Stock Category Breakdown (Top categories in Stock)
    const stockCatMap = new Map<string, number>()
    furnitureProducts.forEach(p => {
      stockCatMap.set(p.category, (stockCatMap.get(p.category) || 0) + Number(p.stock || 0))
    })
    woodProducts.filter(w => !w.is_sold).forEach(w => {
      const cat = `${w.category} Logs`
      stockCatMap.set(cat, (stockCatMap.get(cat) || 0) + Number(w.stock || 0))
    })

    const stockBreakdownData = Array.from(stockCatMap.entries()).map(([name, stock]) => ({
      name,
      stock
    })).sort((a, b) => b.stock - a.stock).slice(0, 7)

    // ------------------- EXPENSE REPORT COMPUTATIONS -------------------
    const totalBillsExpense = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0)
    const totalSalaryExpense = salaryPayments.reduce((sum, s) => sum + Number(s.amount || 0), 0)
    const totalExpenseAmount = totalBillsExpense + totalSalaryExpense

    const expenseCategoryMap = new Map<string, number>()
    expenseCategoryMap.set('Staff Salary / Wages', totalSalaryExpense)
    bills.forEach(b => {
      const cat = b.category || 'Other Utilities'
      expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) || 0) + Number(b.amount || 0))
    })

    const expenseBreakdownData = Array.from(expenseCategoryMap.entries()).map(([name, value]) => ({
      name,
      value
    })).filter(e => e.value > 0).sort((a, b) => b.value - a.value)

    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#64748b']

    // ------------------- CUSTOMER DUE REPORT COMPUTATIONS -------------------
    const dueCustomersList = customers.filter(c => Number(c.total_due || 0) > 0)
    const totalOutstandingDue = dueCustomersList.reduce((sum, c) => sum + Number(c.total_due || 0), 0)
    const dueCustomersCount = dueCustomersList.length
    const avgDuePerCustomer = dueCustomersCount > 0 ? (totalOutstandingDue / dueCustomersCount) : 0

    return {
      totalSalesRevenue,
      totalSalesPaid,
      totalSalesDue,
      totalSalesProfit,
      salesTrendData,
      categorySalesSource,
      detailedItemsList,
      totalPurchaseAmount,
      totalPurchasePaid,
      totalPurchaseDue,
      purchaseTrendData,
      totalStockQty,
      totalStockCostValue,
      totalStockRetailValue,
      lowStockCount,
      outOfStockCount,
      stockBreakdownData,
      totalExpenseAmount,
      totalSalaryExpense,
      totalBillsExpense,
      expenseBreakdownData,
      colors,
      dueCustomersList,
      totalOutstandingDue,
      dueCustomersCount,
      avgDuePerCustomer
    }
  }, [
    invoices, 
    invoiceItems, 
    customers, 
    bills, 
    salaryPayments, 
    purchases, 
    furnitureProducts, 
    woodProducts, 
    startDate, 
    endDate,
    productBuyPriceMap
  ])

  // Reminder trigger function
  const handleSendReminderMessage = async (customer: any) => {
    setIsReminderSending(customer.id)
    try {
      const smsMessage = `Dear ${customer.name}, you have an outstanding due of BDT ${Number(customer.total_due).toLocaleString()} at our showroom. Please settle it soon. Thank you!`
      const response = await sendSMS(customer.phone, smsMessage)
      
      toast.success(`Outstanding due reminder successfully sent to ${customer.name}!`)
      setAlertConfig({
        isOpen: true,
        message: `SMS reminder delivered to ${customer.name} at ${customer.phone} successfully. Due amount: ৳${Number(customer.total_due).toLocaleString()}`,
        type: 'success'
      })
    } catch (e: any) {
      console.error(e)
      toast.error('Failed to dispatch SMS: ' + e.message)
    } finally {
      setIsReminderSending(null)
    }
  }

  // Export to Excel / CSV Client-side helper
  const triggerCsvExport = (type: string) => {
    let dataToExport: any[] = []
    let filename = `${type}_Report_${startDate}_to_${endDate}.csv`

    if (type === 'Sales') {
      dataToExport = invoices.map(inv => ({
        'Invoice ID': getDisplayInvoiceId(inv.id),
        'Customer': inv.customer_name,
        'Phone': inv.customer_phone || 'N/A',
        'Type': inv.type.toUpperCase(),
        'Discount': inv.discount,
        'Total BDT': inv.total,
        'Paid BDT': inv.paid_amount,
        'Due BDT': inv.due_amount,
        'Payment Method': inv.payment_method,
        'Created At': new Date(inv.created_at).toLocaleString()
      }))
    } else if (type === 'Purchase') {
      dataToExport = purchases.map(pur => ({
        'Purchase ID': pur.id,
        'Supplier ID': pur.supplier_id || 'N/A',
        'Date': pur.date,
        'Total Amount BDT': pur.total_amount,
        'Paid Amount BDT': pur.paid_amount,
        'Due Amount BDT': pur.due_amount,
        'Status': pur.status
      }))
    } else if (type === 'Stock') {
      const furnitureData = furnitureProducts.map(p => ({
        'SKU': p.sku || 'N/A',
        'Name': p.name,
        'Type': 'Furniture',
        'Category': p.category,
        'Stock Level': p.stock,
        'Buy Price BDT': p.buy_price,
        'Sell Price BDT': p.sell_price,
        'Estimated Cost Value': Number(p.stock) * Number(p.buy_price),
        'Estimated Retail Value': Number(p.stock) * Number(p.sell_price)
      }))
      const woodData = woodProducts.filter(w => !w.is_sold).map(w => ({
        'SKU': w.tag || 'N/A',
        'Name': `${w.category} Log`,
        'Type': 'Wood Logs',
        'Category': w.category,
        'Stock Level': w.stock,
        'Buy Price BDT': w.buy_price,
        'Sell Price BDT': w.sell_price,
        'Estimated Cost Value': Number(w.stock) * Number(w.buy_price),
        'Estimated Retail Value': Number(w.stock) * Number(w.sell_price)
      }))
      dataToExport = [...furnitureData, ...woodData]
    } else if (type === 'Customer Due') {
      dataToExport = reportMetrics.dueCustomersList.map(c => ({
        'Customer ID': c.id,
        'Customer Name': c.name,
        'Phone Number': c.phone,
        'Email Address': c.email || 'N/A',
        'Outstanding Due BDT': c.total_due,
        'Last Purchase': c.last_purchase || 'N/A'
      }))
    } else if (type === 'Expense') {
      const billData = bills.map(b => ({
        'Expense ID': b.id,
        'Vendor': b.vendor,
        'Category': b.category,
        'Amount BDT': b.amount,
        'Date': b.date,
        'Type': 'Bill Payment',
        'Status': b.status,
        'Notes': b.note || 'N/A'
      }))
      const salaryData = salaryPayments.map(s => ({
        'Expense ID': s.id,
        'Vendor/Staff': s.staff_name,
        'Category': 'Staff Salary',
        'Amount BDT': s.amount,
        'Date': s.date,
        'Type': 'Salary Payment',
        'Status': 'Paid',
        'Notes': s.notes || `Month of ${s.month}`
      }))
      dataToExport = [...billData, ...salaryData]
    } else if (type === 'Profit/Loss') {
      dataToExport = [
        { 'Financial Statement Line Item': 'Operating Sales Revenue', 'Amount (BDT)': reportMetrics.totalSalesRevenue },
        { 'Financial Statement Line Item': 'Less: Cost of Goods Sold (COGS)', 'Amount (BDT)': (reportMetrics.totalSalesRevenue - reportMetrics.totalSalesProfit) },
        { 'Financial Statement Line Item': 'GROSS PROFIT', 'Amount (BDT)': reportMetrics.totalSalesProfit },
        { 'Financial Statement Line Item': 'Less: Operating Expenses (Utilities, Salaries)', 'Amount (BDT)': reportMetrics.totalExpenseAmount },
        { 'Financial Statement Line Item': 'NET BUSINESS PROFIT', 'Amount (BDT)': (reportMetrics.totalSalesProfit - reportMetrics.totalExpenseAmount) },
        { 'Financial Statement Line Item': 'Net Profit Margin Percentage', 'Amount (BDT)': `${reportMetrics.totalSalesRevenue > 0 ? ((reportMetrics.totalSalesProfit - reportMetrics.totalExpenseAmount) / reportMetrics.totalSalesRevenue * 100).toFixed(2) : 0}%` }
      ]
    }

    if (dataToExport.length === 0) {
      toast.error('No data found in this period to export')
      return
    }

    const headers = Object.keys(dataToExport[0]).join(',')
    const rows = dataToExport.map(row => 
      Object.values(row).map(val => {
        let cleanVal = val === null || val === undefined ? '' : String(val)
        if (cleanVal.includes(',') || cleanVal.includes('"') || cleanVal.includes('\n')) {
          cleanVal = `"${cleanVal.replace(/"/g, '""')}"`
        }
        return cleanVal
      }).join(',')
    )

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`${type} Report exported successfully as Excel CSV.`)
  }

  // Handle Dynamic Print/PDF rendering using window.print() or Android Native Bridge
  const triggerPrintMode = () => {
    // Direct native Android Print Dialog integration
    if (typeof window !== 'undefined' && (window as any).AndroidPrint) {
      try {
        const fullHtml = document.documentElement ? document.documentElement.outerHTML : document.body.innerHTML
        if (typeof (window as any).AndroidPrint.printHtml === 'function') {
          (window as any).AndroidPrint.printHtml(fullHtml, `Report-${reportType}`)
          return
        } else if (typeof (window as any).AndroidPrint.printPage === 'function') {
          (window as any).AndroidPrint.printPage()
          return
        }
      } catch (e) {
        console.warn('AndroidPrint bridge error:', e)
      }
    }

    try {
      window.print()
    } catch (e) {
      toast.error('Direct print not supported in this frame context. Try opening in a new tab.')
    }
  }

  // Toggle dynamic sorting in lists
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Filter lists based on search
  const filteredSalesData = useMemo(() => {
    if (!searchTerm) return invoices
    return invoices.filter(inv => 
      inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      inv.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer_phone && inv.customer_phone.includes(searchTerm))
    )
  }, [invoices, searchTerm])

  const filteredPurchasesData = useMemo(() => {
    if (!searchTerm) return purchases
    return purchases.filter(pur => 
      pur.id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      pur.supplier_id?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [purchases, searchTerm])

  const filteredStockList = useMemo(() => {
    const furnitureList = furnitureProducts.map(p => ({
      id: `furn-${p.id}`,
      sku: p.sku || `FUR-${p.id.toString().padStart(3, '0')}`,
      name: p.name,
      type: 'Furniture',
      category: p.category,
      stock: p.stock,
      buy_price: p.buy_price,
      sell_price: p.sell_price,
      status: p.stock === 0 ? 'Out of Stock' : (p.stock <= 10 ? 'Low Stock' : 'In Stock')
    }))

    const woodList = woodProducts.filter(w => !w.is_sold).map(w => ({
      id: `wood-${w.id}`,
      sku: w.tag || `WD-${w.id.toString().padStart(3, '0')}`,
      name: `${w.category} Log`,
      type: 'Raw Wood',
      category: w.category,
      stock: w.stock,
      buy_price: w.buy_price,
      sell_price: w.sell_price,
      status: w.stock === 0 ? 'Out of Stock' : (w.stock <= 5 ? 'Low Stock' : 'In Stock')
    }))

    const combined = [...furnitureList, ...woodList]
    if (!searchTerm) return combined
    return combined.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [furnitureProducts, woodProducts, searchTerm])

  const filteredExpensesList = useMemo(() => {
    const billList = bills.map(b => ({
      id: b.id,
      name: b.vendor,
      category: b.category,
      amount: b.amount,
      date: b.date,
      type: 'Bill Utility',
      status: b.status
    }))

    const salList = salaryPayments.map(s => ({
      id: s.id,
      name: s.staff_name,
      category: 'Wages / Salary',
      amount: s.amount,
      date: s.date,
      type: 'Salary Payment',
      status: 'Paid'
    }))

    const combined = [...billList, ...salList].sort((a, b) => b.date.localeCompare(a.date))
    if (!searchTerm) return combined
    return combined.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [bills, salaryPayments, searchTerm])

  const filteredDuesList = useMemo(() => {
    if (!searchTerm) return reportMetrics.dueCustomersList
    return reportMetrics.dueCustomersList.filter(c => 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone?.includes(searchTerm) || 
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  }, [reportMetrics.dueCustomersList, searchTerm])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Dynamic Business Report Print Header (Only visible on print) */}
        <div className="hidden print:block p-6 border-b-2 border-slate-900 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black uppercase text-slate-900 tracking-wider">Business Analytics Statement</h1>
              <p className="text-sm font-bold text-slate-600 mt-1">Generated: {new Date().toLocaleString()} | Period: {startDate} to {endDate}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-800">WOOD & FURNITURE POS</h2>
              <p className="text-xs text-slate-500">Corporate HQ Office & Showroom</p>
            </div>
          </div>
        </div>

        {/* Real-time Dashboard Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="text-amber-600 shrink-0" size={26} />
              Business Reports
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={triggerPrintMode}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <Printer size={18} /> Print Statement
            </button>
            <button 
              onClick={() => triggerCsvExport(reportType)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/15 hover:shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={18} /> Export Excel (CSV)
            </button>
            <button 
              onClick={loadReportsData}
              title="Refresh Data"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all border border-slate-200/50 dark:border-slate-700/50 cursor-pointer"
            >
              <RefreshCw size={18} className={cn("ml-[280px] mr-0 -mt-[90px]", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Report Category Selectors */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar print:hidden">
          {['Sales', 'Purchase', 'Stock', 'Customer Due', 'Expense', 'Profit/Loss'].map(type => (
            <button
              key={type}
              onClick={() => {
                setReportType(type)
                setSearchTerm('')
              }}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer",
                reportType === type 
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20" 
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/70 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600"
              )}
            >
              {type} Report
            </button>
          ))}
        </div>

        {/* Filtering & Parameter Controls */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs flex flex-col md:flex-row gap-4 items-center print:hidden">
          <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
            
            {/* Range Preset Selector */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <Calendar size={16} className="text-slate-400 shrink-0" />
              <select 
                value={presetRange}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="all_time">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Dates Inputs */}
            {presetRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 outline-none" 
                />
                <span className="text-slate-400 text-xs font-bold">to</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 outline-none" 
                />
              </div>
            )}

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

            {/* Branch Selector */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400 shrink-0" />
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                <option>All Branches</option>
                <option>Main Showroom</option>
                <option>Workshop Depot A</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Searchbox */}
          {reportType !== 'Profit/Loss' && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800 w-full md:w-64">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input 
                type="text"
                placeholder={`Search ${reportType} report...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-semibold text-slate-700 dark:text-slate-300 w-full placeholder:text-slate-400"
              />
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-xs">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
            <p className="text-xs text-slate-400 font-bold mt-4 animate-pulse">Assembling dynamic report statements...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* REPORT TYPE: SALES */}
            {reportType === 'Sales' && (
              <div className="space-y-6">
                {/* Sales statistics widgets */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Gross Revenue</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">৳{reportMetrics.totalSalesRevenue.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                      <ArrowUpRight size={12} /> {invoices.length} invoices
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Cash Received</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳{reportMetrics.totalSalesPaid.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                      {reportMetrics.totalSalesRevenue > 0 ? ((reportMetrics.totalSalesPaid / reportMetrics.totalSalesRevenue) * 100).toFixed(0) : 0}% Realized
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Outstanding Due</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">৳{reportMetrics.totalSalesDue.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500/80 mt-1">
                      {reportMetrics.totalSalesRevenue > 0 ? ((reportMetrics.totalSalesDue / reportMetrics.totalSalesRevenue) * 100).toFixed(0) : 0}% Deficit
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Estimated Net Profit</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">৳{reportMetrics.totalSalesProfit.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 mt-1">
                      ~{reportMetrics.totalSalesRevenue > 0 ? ((reportMetrics.totalSalesProfit / reportMetrics.totalSalesRevenue) * 100).toFixed(1) : 0}% Profit Margin
                    </div>
                  </div>
                </div>

                {/* Sales Chart Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Revenue & Estimated Profit Trend</h3>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                          <span className="text-slate-500">Sales</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                          <span className="text-slate-500">Profit</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportMetrics.salesTrendData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', backgroundColor: '#1e293b', color: '#fff' }}
                          />
                          <Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} name="Sales (৳)" />
                          <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} name="Profit (৳)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Revenue share */}
                  <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider mb-4">Revenue Breakdown</h3>
                      <div className="h-[180px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={reportMetrics.categorySalesSource}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={6}
                              dataKey="value"
                            >
                              {reportMetrics.categorySalesSource.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val) => `${val}%`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      {reportMetrics.categorySalesSource.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="font-bold text-slate-600 dark:text-slate-400">{item.name}</span>
                          </div>
                          <span className="font-black text-slate-800 dark:text-slate-100">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Detailed Sales table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Detailed Sales Statements</h3>
                    <span className="text-xs font-bold text-slate-400">{filteredSalesData.length} entries found</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Invoice ID</th>
                          <th className="px-5 py-3 font-semibold">Customer</th>
                          <th className="px-5 py-3 font-semibold">Date</th>
                          <th className="px-5 py-3 font-semibold">Type</th>
                          <th className="px-5 py-3 font-semibold">Total Amount</th>
                          <th className="px-5 py-3 font-semibold">Paid</th>
                          <th className="px-5 py-3 font-semibold text-right">Outstanding Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredSalesData.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-xs text-slate-400 font-bold">No sales records found in the selected date range.</td>
                          </tr>
                        ) : (
                          filteredSalesData.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-xs transition-colors">
                              <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">{getDisplayInvoiceId(inv.id)}</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                                {inv.customer_name}
                                <span className="block text-[10px] text-slate-400 font-normal">{inv.customer_phone || 'Walk-in'}</span>
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-slate-600 dark:text-slate-400">{new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td className="px-5 py-3.5">
                                <span className={cn(
                                  "px-2 py-0.5 text-[9px] font-bold rounded uppercase",
                                  inv.type === 'furniture' ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                )}>
                                  {inv.type === 'solo_wood' ? 'Wood' : inv.type}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100">৳{Number(inv.total).toLocaleString()}</td>
                              <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">৳{Number(inv.paid_amount).toLocaleString()}</td>
                              <td className="px-5 py-3.5 font-bold text-right text-rose-600 dark:text-rose-400">৳{Number(inv.due_amount).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REPORT TYPE: PURCHASE */}
            {reportType === 'Purchase' && (
              <div className="space-y-6">
                {/* Purchase stats widgets */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Total Purchases</p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">৳{reportMetrics.totalPurchaseAmount.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-1">
                      {purchases.length} supplier orders
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Amount Paid</p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳{reportMetrics.totalPurchasePaid.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                      {reportMetrics.totalPurchaseAmount > 0 ? ((reportMetrics.totalPurchasePaid / reportMetrics.totalPurchaseAmount) * 100).toFixed(0) : 0}% Disbursed
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Supplier Outstanding Due</p>
                    <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">৳{reportMetrics.totalPurchaseDue.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-1">
                      {reportMetrics.totalPurchaseAmount > 0 ? ((reportMetrics.totalPurchaseDue / reportMetrics.totalPurchaseAmount) * 100).toFixed(0) : 0}% Accounts Payable
                    </div>
                  </div>
                </div>

                {/* Purchase Trend Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider mb-6">Stock Reorder & Purchase Trends</h3>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportMetrics.purchaseTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }}
                        />
                        <Line type="monotone" dataKey="purchases" stroke="#d97706" strokeWidth={3} activeDot={{ r: 6 }} name="Purchase Amount (৳)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Purchases list */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Purchase Logs</h3>
                    <span className="text-xs font-bold text-slate-400">{filteredPurchasesData.length} records found</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Purchase ID</th>
                          <th className="px-5 py-3 font-semibold">Date</th>
                          <th className="px-5 py-3 font-semibold">Status</th>
                          <th className="px-5 py-3 font-semibold">Total Amount</th>
                          <th className="px-5 py-3 font-semibold">Paid</th>
                          <th className="px-5 py-3 font-semibold text-right">Outstanding Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredPurchasesData.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-xs text-slate-400 font-bold">No purchase logs available.</td>
                          </tr>
                        ) : (
                          filteredPurchasesData.map((pur) => (
                            <tr key={pur.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-xs transition-colors">
                              <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">{pur.id}</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-600 dark:text-slate-400">{pur.date}</td>
                              <td className="px-5 py-3.5">
                                <span className={cn(
                                  "px-2 py-0.5 text-[9px] font-bold rounded uppercase",
                                  pur.status === 'Completed' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                )}>
                                  {pur.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100">৳{Number(pur.total_amount).toLocaleString()}</td>
                              <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">৳{Number(pur.paid_amount || 0).toLocaleString()}</td>
                              <td className="px-5 py-3.5 font-bold text-right text-rose-600 dark:text-rose-400">৳{Number(pur.due_amount || 0).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REPORT TYPE: STOCK */}
            {reportType === 'Stock' && (
              <div className="space-y-6">
                {/* Stock stats widgets */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Total Stock Items</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{reportMetrics.totalStockQty.toLocaleString()} pcs</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                      {furnitureProducts.length} furniture SKU, {woodProducts.filter(w => !w.is_sold).length} logs
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Stock Cost Valuation</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">৳{reportMetrics.totalStockCostValue.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mt-1">
                      Capital Investment
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Retail Value (Sales)</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳{reportMetrics.totalStockRetailValue.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                      Est. Profit Margin: ~৳{(reportMetrics.totalStockRetailValue - reportMetrics.totalStockCostValue).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1">Stock Alerts</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="text-rose-500 animate-pulse shrink-0" size={18} />
                      {reportMetrics.lowStockCount} Low
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-1">
                      {reportMetrics.outOfStockCount} items out of stock
                    </div>
                  </div>
                </div>

                {/* Stock distribution chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider mb-6">Stock Level by Product Categories</h3>
                  <div className="h-[250px] w-full">
                    {reportMetrics.stockBreakdownData.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-xs text-slate-400 font-bold">No active stock levels.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportMetrics.stockBreakdownData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} />
                          <Bar dataKey="stock" fill="#d97706" radius={[4, 4, 0, 0]} barSize={35} name="In-stock Quantity (pcs)" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Low Stock Warning Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Current Stock Ledger</h3>
                    <span className="text-xs font-bold text-slate-400">{filteredStockList.length} items logged</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3 font-semibold">SKU / ID</th>
                          <th className="px-5 py-3 font-semibold">Item Name</th>
                          <th className="px-5 py-3 font-semibold">Category</th>
                          <th className="px-5 py-3 font-semibold">Unit Type</th>
                          <th className="px-5 py-3 font-semibold">Stock Qty</th>
                          <th className="px-5 py-3 font-semibold">Buy Price</th>
                          <th className="px-5 py-3 font-semibold">Sell Price</th>
                          <th className="px-5 py-3 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredStockList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-xs text-slate-400 font-bold">No stock matches for search criteria.</td>
                          </tr>
                        ) : (
                          filteredStockList.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-xs transition-colors">
                              <td className="px-5 py-3.5 font-bold text-slate-600 dark:text-slate-400">{item.sku}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-500">{item.category}</td>
                              <td className="px-5 py-3.5 text-slate-400">{item.type}</td>
                              <td className="px-5 py-3.5 font-black text-slate-900 dark:text-slate-100">{item.stock} pcs</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-500">৳{Number(item.buy_price || 0).toLocaleString()}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-slate-300">৳{Number(item.sell_price || 0).toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-right">
                                <span className={cn(
                                  "px-2 py-0.5 text-[9px] font-bold rounded uppercase",
                                  item.status === 'In Stock' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" :
                                  item.status === 'Low Stock' ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                                  "bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                                )}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REPORT TYPE: CUSTOMER DUE */}
            {reportType === 'Customer Due' && (
              <div className="space-y-6">
                {/* Due statistics widgets */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Total Outstanding Debts</p>
                    <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">৳{reportMetrics.totalOutstandingDue.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-1">
                      Receivables accounts backlog
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Due Customers Count</p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{reportMetrics.dueCustomersCount} buyers</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                      {customers.length > 0 ? ((reportMetrics.dueCustomersCount / customers.length) * 100).toFixed(0) : 0}% of client base
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Average Debt Balance</p>
                    <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">৳{Math.round(reportMetrics.avgDuePerCustomer).toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 mt-1">
                      Average liability size
                    </div>
                  </div>
                </div>

                {/* Customer Due List Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Receivable Due Register</h3>
                    <span className="text-xs font-bold text-slate-400">{filteredDuesList.length} default customers</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Client Name</th>
                          <th className="px-5 py-3 font-semibold">Contact Details</th>
                          <th className="px-5 py-3 font-semibold">Last Purchase</th>
                          <th className="px-5 py-3 font-semibold">Outstanding Due</th>
                          <th className="px-5 py-3 font-semibold text-right print:hidden">Debt Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredDuesList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-xs text-slate-400 font-bold">Congratulations! No clients currently have outstanding dues.</td>
                          </tr>
                        ) : (
                          filteredDuesList.map((customer) => (
                            <tr key={customer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-xs transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs uppercase">
                                    {customer.name?.slice(0, 2) || 'CL'}
                                  </div>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{customer.name}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="font-semibold block text-slate-700 dark:text-slate-300">{customer.phone}</span>
                                <span className="text-[10px] text-slate-400">{customer.email || 'No Email'}</span>
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-slate-500">{customer.last_purchase || 'Never'}</td>
                              <td className="px-5 py-3.5 font-black text-rose-600 dark:text-rose-400">৳{Number(customer.total_due).toLocaleString()}</td>
                              <td className="px-5 py-3.5 text-right print:hidden">
                                <button 
                                  onClick={() => handleSendReminderMessage(customer)}
                                  disabled={isReminderSending === customer.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-lg border border-amber-200/50 dark:border-amber-800 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {isReminderSending === customer.id ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <Send size={11} />
                                      Send SMS Reminder
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REPORT TYPE: EXPENSE */}
            {reportType === 'Expense' && (
              <div className="space-y-6">
                {/* Expense stats widgets */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Total Period Expenses</p>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">৳{reportMetrics.totalExpenseAmount.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-1">
                      Cumulative overhead cost
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Staff Payroll Disbursements</p>
                    <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">৳{reportMetrics.totalSalaryExpense.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 mt-1">
                      {salaryPayments.length} payroll transactions
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Utility & Operations Bills</p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">৳{reportMetrics.totalBillsExpense.toLocaleString()}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1">
                      {bills.length} vendor invoices
                    </div>
                  </div>
                </div>

                {/* Expense Breakdown pie chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider mb-6">Expense Distribution Breakdown</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="h-[240px] w-full flex items-center justify-center">
                      {reportMetrics.expenseBreakdownData.length === 0 ? (
                        <div className="text-xs text-slate-400 font-bold">No active expense data in selected dates.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={reportMetrics.expenseBreakdownData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={85}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {reportMetrics.expenseBreakdownData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={reportMetrics.colors[index % reportMetrics.colors.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `৳${Number(value).toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="space-y-3">
                      {reportMetrics.expenseBreakdownData.map((item, idx) => (
                        <div key={item.name} className="flex items-center justify-between text-xs border-b border-slate-50 dark:border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: reportMetrics.colors[idx % reportMetrics.colors.length] }}></div>
                            <span className="font-bold text-slate-600 dark:text-slate-400">{item.name}</span>
                          </div>
                          <span className="font-black text-slate-800 dark:text-slate-100">
                            ৳{item.value.toLocaleString()} 
                            <span className="text-[10px] text-slate-400 font-normal ml-2">({((item.value / reportMetrics.totalExpenseAmount) * 100).toFixed(0)}%)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expense List Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Detailed Expense Statements</h3>
                    <span className="text-xs font-bold text-slate-400">{filteredExpensesList.length} expenses logged</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Expense ID</th>
                          <th className="px-5 py-3 font-semibold">Recipient / Vendor</th>
                          <th className="px-5 py-3 font-semibold">Category</th>
                          <th className="px-5 py-3 font-semibold">Type</th>
                          <th className="px-5 py-3 font-semibold">Payment Date</th>
                          <th className="px-5 py-3 font-semibold text-right">Amount Disbursed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredExpensesList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-xs text-slate-400 font-bold">No expenses matching criteria.</td>
                          </tr>
                        ) : (
                          filteredExpensesList.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-xs transition-colors">
                              <td className="px-5 py-3.5 font-bold text-slate-600 dark:text-slate-400">{item.id}</td>
                              <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-500">{item.category}</td>
                              <td className="px-5 py-3.5 text-slate-400">{item.type}</td>
                              <td className="px-5 py-3.5 font-semibold text-slate-600 dark:text-slate-400">{item.date}</td>
                              <td className="px-5 py-3.5 font-black text-right text-rose-600 dark:text-rose-400">৳{Number(item.amount).toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* REPORT TYPE: PROFIT/LOSS */}
            {reportType === 'Profit/Loss' && (
              <div className="space-y-6">
                {/* P&L stats summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Gross Revenue</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">৳{reportMetrics.totalSalesRevenue.toLocaleString()}</h3>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 block">Period Sales Incoming</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Cost of Goods Sold (COGS)</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-600 dark:text-slate-400">৳{(reportMetrics.totalSalesRevenue - reportMetrics.totalSalesProfit).toLocaleString()}</h3>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 block">Period Inventory Purchase value</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Total Operating Overhead</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-600 dark:text-slate-400">৳{reportMetrics.totalExpenseAmount.toLocaleString()}</h3>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 block">Wages, Utility Bills, Rent</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider mb-1">Net Operating Profit</p>
                    <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      ৳{(reportMetrics.totalSalesProfit - reportMetrics.totalExpenseAmount).toLocaleString()}
                    </h3>
                    <span className="text-[10px] font-bold text-emerald-500 mt-1 block">
                      Net Margin: {reportMetrics.totalSalesRevenue > 0 ? (((reportMetrics.totalSalesProfit - reportMetrics.totalExpenseAmount) / reportMetrics.totalSalesRevenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                {/* Professional Income Statement Ledger */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-xs overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Statement of Profit & Loss</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Period: {startDate} to {endDate} | All units in BDT (৳) | Accrual Basis Accounting</p>
                  </div>
                  <div className="p-6 space-y-4 max-w-3xl mx-auto">
                    
                    {/* Operating Revenue Section */}
                    <div>
                      <div className="flex justify-between font-bold text-xs uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span>I. Operating Income</span>
                        <span>Amount (৳)</span>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Furniture Sales Revenue</span>
                          <span>৳{invoices.filter(inv => inv.type === 'furniture').reduce((s, inv) => s + Number(inv.total), 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Raw Wood Sales Revenue</span>
                          <span>৳{invoices.filter(inv => inv.type !== 'furniture').reduce((s, inv) => s + Number(inv.total), 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xs text-slate-800 dark:text-slate-100 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/50">
                          <span>Total Gross Sales Revenue</span>
                          <span className="underline decoration-double">৳{reportMetrics.totalSalesRevenue.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* COGS Section */}
                    <div className="pt-2">
                      <div className="flex justify-between font-bold text-xs uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span>II. Cost of Goods Sold (COGS)</span>
                        <span>Amount (৳)</span>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Beginning Inventory / Capital Asset Base</span>
                          <span>৳{reportMetrics.totalStockCostValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Cost of Inventory Sold (Acquisition cost)</span>
                          <span>৳{(reportMetrics.totalSalesRevenue - reportMetrics.totalSalesProfit).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold text-xs text-slate-800 dark:text-slate-100 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/50">
                          <span>Total Cost of Goods Sold</span>
                          <span>৳{(reportMetrics.totalSalesRevenue - reportMetrics.totalSalesProfit).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Gross Profit Marker */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between font-black text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      <span>III. GROSS FINANCIAL MARGIN / PROFIT</span>
                      <span className="text-amber-600 dark:text-amber-400">৳{reportMetrics.totalSalesProfit.toLocaleString()}</span>
                    </div>

                    {/* Operating Expenses Section */}
                    <div>
                      <div className="flex justify-between font-bold text-xs uppercase text-slate-400 tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                        <span>IV. Operating Overhead & Administrative Expenses</span>
                        <span>Amount (৳)</span>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Staff Wages & Salaries</span>
                          <span>৳{reportMetrics.totalSalaryExpense.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Workshop Rental</span>
                          <span>৳{bills.filter(b => b.category === 'Rent').reduce((sum, b) => sum + Number(b.amount), 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Utilities (Electricity, Water, Fuel)</span>
                          <span>৳{bills.filter(b => b.category === 'Utility').reduce((sum, b) => sum + Number(b.amount), 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>Miscellaneous Operating Expenses</span>
                          <span>
                            ৳{bills.filter(b => b.category !== 'Rent' && b.category !== 'Utility').reduce((sum, b) => sum + Number(b.amount), 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-xs text-slate-800 dark:text-slate-100 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/50">
                          <span>Total Period Operating Expenses</span>
                          <span>৳{reportMetrics.totalExpenseAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Net Income Marker */}
                    <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/50 dark:border-emerald-900/40 flex justify-between font-black text-sm uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                      <span>V. NET RETAINED BUSINESS EARNINGS / PROFIT</span>
                      <span className="underline decoration-double text-emerald-600 dark:text-emerald-400">
                        ৳{(reportMetrics.totalSalesProfit - reportMetrics.totalExpenseAmount).toLocaleString()}
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            )}

          </div>
        )}
        
        <AlertPopup 
          isOpen={alertConfig.isOpen}
          onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
          message={alertConfig.message}
          type={alertConfig.type}
        />
      </div>
    </DashboardLayout>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    }>
      <ReportPageContent />
    </Suspense>
  )
}
