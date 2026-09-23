'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Printer, 
  Share2, 
  Phone, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Smartphone, 
  Search, 
  Copy, 
  ExternalLink,
  Receipt,
  Download,
  Building2,
  Calendar,
  Truck
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'
import InvoicePrint from '@/components/InvoicePrint'
import { toast } from 'sonner'

interface PublicInvoiceViewProps {
  initialId?: string
}

export default function PublicInvoiceView({ initialId }: PublicInvoiceViewProps) {
  const router = useRouter()
  const [invoiceId, setInvoiceId] = useState<string>(initialId || '')
  const [manualInputId, setManualInputId] = useState<string>('')
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [notFound, setNotFound] = useState<boolean>(false)
  const [selectedSize, setSelectedSize] = useState<'A4' | 'A5' | 'POS' | 'Chalan'>('A4')
  const [settings, setSettings] = useState<any>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [copied, setCopied] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const printAreaRef = useRef<HTMLDivElement>(null)

  // Fetch store settings for contact & brand info
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('settings')
          .eq('id', 'global')
          .maybeSingle()
        if (data && data.settings) {
          setSettings(data.settings)
        }
      } catch (err) {
        console.error('Failed to load global store settings:', err)
      }
    }
    fetchSettings()
  }, [])

  // Auto-fit responsive zoom for A4/POS preview
  const handleAutoFit = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const horizontalPadding = window.innerWidth >= 640 ? 48 : 24
    const availableWidth = Math.max(280, containerWidth - horizontalPadding)

    let targetWidth = 794 // Default A4/Chalan
    if (selectedSize === 'A5') {
      targetWidth = 559
    } else if (selectedSize === 'POS') {
      targetWidth = 302
    }

    if (availableWidth < targetWidth) {
      const fitScale = Math.min(1.0, Math.max(0.35, availableWidth / targetWidth))
      setZoom(Number(fitScale.toFixed(2)))
    } else {
      setZoom(1.0)
    }
  }, [selectedSize])

  useEffect(() => {
    handleAutoFit()
    const timer = setTimeout(handleAutoFit, 150)
    window.addEventListener('resize', handleAutoFit)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleAutoFit)
    }
  }, [selectedSize, invoice, handleAutoFit])

  // Load Invoice data by ID
  const loadInvoice = useCallback(async (targetId: string) => {
    if (!targetId || !targetId.trim()) {
      setLoading(false)
      setNotFound(true)
      return
    }

    setLoading(true)
    setNotFound(false)

    try {
      const clean = targetId.trim()
      const withoutHash = clean.replace(/^#/, '')
      const withHash = `#${withoutHash}`

      // 1. Check Furniture Invoices
      let inv: any = null
      let isWood = false

      const furnQueries = [
        supabase.from('furniture_invoices').select('*').eq('id', clean).maybeSingle(),
        supabase.from('furniture_invoices').select('*').eq('invoice_number', clean).maybeSingle(),
        supabase.from('furniture_invoices').select('*').eq('invoice_number', withoutHash).maybeSingle(),
        supabase.from('furniture_invoices').select('*').eq('invoice_number', withHash).maybeSingle(),
        supabase.from('furniture_invoices').select('*').eq('id', withoutHash).maybeSingle(),
        supabase.from('furniture_invoices').select('*').eq('id', withHash).maybeSingle(),
      ]

      for (const q of furnQueries) {
        try {
          const { data, error } = await q
          if (data && !error) {
            inv = data
            isWood = false
            break
          }
        } catch (e) {}
      }

      // 2. Check Wood Invoices if not found
      if (!inv) {
        const woodQueries = [
          supabase.from('wood_invoices').select('*').eq('id', clean).maybeSingle(),
          supabase.from('wood_invoices').select('*').eq('invoice_number', clean).maybeSingle(),
          supabase.from('wood_invoices').select('*').eq('invoice_number', withoutHash).maybeSingle(),
          supabase.from('wood_invoices').select('*').eq('invoice_number', withHash).maybeSingle(),
          supabase.from('wood_invoices').select('*').eq('id', withoutHash).maybeSingle(),
          supabase.from('wood_invoices').select('*').eq('id', withHash).maybeSingle(),
        ]

        for (const q of woodQueries) {
          try {
            const { data, error } = await q
            if (data && !error) {
              inv = data
              isWood = true
              break
            }
          } catch (e) {}
        }
      }

      // 3. Fallback: ilike match on invoice_number
      if (!inv) {
        try {
          const { data: furnMatch } = await supabase
            .from('furniture_invoices')
            .select('*')
            .ilike('invoice_number', `%${withoutHash}%`)
            .limit(1)
            .maybeSingle()
          if (furnMatch) {
            inv = furnMatch
            isWood = false
          }
        } catch (e) {}
      }

      if (!inv) {
        try {
          const { data: woodMatch } = await supabase
            .from('wood_invoices')
            .select('*')
            .ilike('invoice_number', `%${withoutHash}%`)
            .limit(1)
            .maybeSingle()
          if (woodMatch) {
            inv = woodMatch
            isWood = true
          }
        } catch (e) {}
      }

      // 4. Fallback: check browser cache/localStorage if available
      if (!inv && typeof window !== 'undefined') {
        try {
          const storedFurn = localStorage.getItem('furniture_invoices')
          if (storedFurn) {
            const parsed = JSON.parse(storedFurn)
            if (Array.isArray(parsed)) {
              inv = parsed.find((item: any) =>
                item.id === clean ||
                item.invoice_number === clean ||
                item.invoice_number === withoutHash ||
                item.displayId === clean
              )
              if (inv) isWood = false
            }
          }
        } catch (e) {}

        if (!inv) {
          try {
            const storedWood = localStorage.getItem('wood_invoices')
            if (storedWood) {
              const parsed = JSON.parse(storedWood)
              if (Array.isArray(parsed)) {
                inv = parsed.find((item: any) =>
                  item.id === clean ||
                  item.invoice_number === clean ||
                  item.invoice_number === withoutHash ||
                  item.displayId === clean
                )
                if (inv) isWood = true
              }
            }
          } catch (e) {}
        }
      }

      if (!inv) {
        setNotFound(true)
        setLoading(false)
        return
      }

      // Fetch Items
      let items = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : []
      if (items.length === 0) {
        const itemsTable = isWood ? 'wood_invoice_items' : 'furniture_invoice_items'
        try {
          const { data: dbItems } = await supabase
            .from(itemsTable)
            .select('*')
            .eq('invoice_id', inv.id)
          if (dbItems && dbItems.length > 0) {
            items = dbItems
          } else if (inv.invoice_number) {
            const { data: dbItemsByNum } = await supabase
              .from(itemsTable)
              .select('*')
              .eq('invoice_id', inv.invoice_number)
            if (dbItemsByNum && dbItemsByNum.length > 0) {
              items = dbItemsByNum
            }
          }
        } catch (e) {}
      }

      // Fetch Payments from transactions
      let payments: any[] = []
      try {
        const { data: txnData } = await supabase
          .from('transactions')
          .select('*')
          .or(`ref.eq.${inv.id},ref.eq.${inv.invoice_number || inv.id}`)
          .gt('credit', 0)
          .order('date', { ascending: true })

        if (txnData && txnData.length > 0) {
          payments = txnData.map((t: any) => ({
            date: t.date,
            method: t.notes || 'Cash',
            amount: Number(t.credit)
          }))
        }
      } catch (e) {}

      const finalPaid = Number(inv.paid_amount ?? inv.paid ?? 0)
      const totalRecordedPayments = payments.reduce((sum, p) => sum + p.amount, 0)
      if (finalPaid > totalRecordedPayments) {
        payments.unshift({
          date: inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : (inv.date || new Date().toISOString().split('T')[0]),
          method: inv.payment_method || inv.paymentMethod || 'Cash',
          amount: finalPaid - totalRecordedPayments
        })
      }

      // Customer previous due lookup
      let oldDue = 0
      const custName = inv.customer_name || inv.customer
      if (custName && custName !== 'Walk-in Customer') {
        try {
          const { data: custData } = await supabase
            .from('customer')
            .select('total_due')
            .eq('name', custName)
            .maybeSingle()
          if (custData) {
            const curDue = Number(inv.due_amount ?? inv.due ?? 0)
            oldDue = Math.max(0, (custData.total_due || 0) - curDue)
          }
        } catch (e) {}
      }

      const finalDue = Number(inv.due_amount ?? inv.due ?? 0)
      const finalTotal = Number(inv.total ?? 0)

      setInvoice({
        id: inv.id,
        displayId: getDisplayInvoiceId(inv.id || inv.invoice_number),
        customer: custName || 'Valued Customer',
        customerPhone: inv.customer_phone || inv.customerPhone || '',
        customerAddress: inv.customer_address || inv.customerAddress || '',
        date: inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : (inv.date || new Date().toISOString().split('T')[0]),
        amount: finalTotal,
        total: finalTotal,
        paid: finalPaid,
        due: finalDue,
        status: finalDue === 0 ? 'Paid' : (finalPaid > 0 ? 'Partial' : 'Due'),
        type: isWood ? 'Wood' : (inv.type || 'Furniture'),
        originalType: isWood ? 'wood' : (inv.originalType || 'furniture'),
        discount: Number(inv.discount || 0),
        discountType: inv.discount_type || 'flat',
        deliveryCharge: Number(inv.delivery_charge || 0),
        deliveryDate: inv.delivery_date,
        deliveryStatus: inv.delivery_status || 'Pending',
        paymentMethod: inv.payment_method || 'Cash',
        items,
        payments,
        oldDue
      })
      setNotFound(false)
    } catch (err) {
      console.error('Error loading public invoice:', err)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (invoiceId) {
      loadInvoice(invoiceId)
    } else {
      setLoading(false)
      setNotFound(true)
    }
  }, [invoiceId, loadInvoice])

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice?.displayId || invoiceId}`,
          text: `View my invoice ${invoice?.displayId || invoiceId} from ${businessName}`,
          url
        })
        return
      } catch (err) {}
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Invoice link copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch (e) {
      toast.info(`Invoice URL: ${url}`)
    }
  }

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInputId.trim()) return
    const cleaned = manualInputId.trim()
    setInvoiceId(cleaned)
    router.push(`/invoice/view/${encodeURIComponent(cleaned)}`)
  }

  const business = settings?.business || {}
  const businessName = business.name || 'FurniTrack'
  const businessPhone = business.phone || business.secondaryPhone || ''

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* Top Public Header Bar (Hidden in Print) */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 print:hidden shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                  {businessName}
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Public Invoice
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {invoice ? `Invoice ${invoice.displayId}` : 'Digital Order Slip'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {businessPhone && (
              <a
                href={`tel:${businessPhone}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                title={`Call ${businessName}`}
              >
                <Phone size={14} className="text-amber-500" />
                <span>Call Store</span>
              </a>
            )}

            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
              title="Share invoice link"
            >
              {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Share2 size={14} />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={loading || !invoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-colors disabled:opacity-50"
              title="Print or Save as PDF"
            >
              <Printer size={15} />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col items-center">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading invoice details...</p>
          </div>
        ) : notFound || !invoice ? (
          <div className="w-full max-w-md my-auto bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invoice Not Found</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              We couldn&apos;t locate the invoice with reference <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-amber-600 font-mono text-xs">{invoiceId || 'None'}</code>. Please verify your invoice number or check with the store.
            </p>

            <form onSubmit={handleManualSearch} className="space-y-3 mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter Invoice No. (e.g. INV-F-260801)"
                  value={manualInputId}
                  onChange={(e) => setManualInputId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Search size={15} />
                <span>Search Invoice</span>
              </button>
            </form>

            {businessPhone && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-1.5 text-xs text-slate-500">
                <span>Need assistance? Contact the store directly:</span>
                <a href={`tel:${businessPhone}`} className="font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                  <Phone size={12} /> {businessPhone}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-4">
            {/* Customer Summary Card (Hidden in Print) */}
            <div className="w-full bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 dark:border-slate-800 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {invoice.displayId}
                    </h1>
                    <span className={cn(
                      "text-xs font-semibold px-2.5 py-0.5 rounded-full border",
                      invoice.status === 'Paid'
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                        : invoice.status === 'Partial'
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40"
                    )}>
                      {invoice.status === 'Paid' ? 'Paid in Full' : (invoice.status === 'Partial' ? 'Partially Paid' : 'Payment Due')}
                    </span>
                    {invoice.type === 'Furniture' && (
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                        invoice.deliveryStatus === 'Delivered'
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      )}>
                        {invoice.deliveryStatus === 'Delivered' ? (
                          <>
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Delivered</span>
                          </>
                        ) : (
                          <>
                            <Truck size={12} className="text-amber-600" />
                            <span>Pending Delivery</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Billed to: <span className="font-semibold text-slate-700 dark:text-slate-200">{invoice.customer}</span>
                    {invoice.customerPhone ? ` • ${invoice.customerPhone}` : ''}
                    {invoice.date ? ` • Issued on ${invoice.date}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Bill</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">৳{Math.round(invoice.total).toLocaleString()}</p>
                  </div>
                  {Number(invoice.due || 0) > 0 && (
                    <div className="text-left sm:text-right pl-4 border-l border-slate-200 dark:border-slate-700">
                      <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 uppercase tracking-wider">Current Due</p>
                      <p className="text-lg font-black text-rose-600 dark:text-rose-400">৳{Math.round(invoice.due).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Format Switcher */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-medium">View Format:</span>
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {(['A4', 'A5', 'POS', 'Chalan'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                          selectedSize === size
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Zoom: {Math.round(zoom * 100)}%
                </div>
              </div>
            </div>

            {/* Scaled Printable Sheet Container */}
            <div 
              ref={containerRef}
              className="w-full flex justify-center py-2 overflow-x-auto print:overflow-visible print:p-0 print:m-0"
            >
              <div 
                ref={printAreaRef}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  marginBottom: zoom < 1 ? `-${Math.round((1 - zoom) * 800)}px` : '0px'
                }}
                className="transition-transform duration-200 ease-out origin-top shadow-xl print:shadow-none bg-white rounded-lg print:rounded-none overflow-hidden print:overflow-visible"
              >
                <InvoicePrint invoice={invoice} size={selectedSize} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 print:hidden bg-white/50 dark:bg-slate-900/50">
        <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
        <p className="mt-1 text-[11px] text-slate-400">This invoice was generated electronically and is valid without physical seal.</p>
      </footer>

      {/* Print Stylesheet Overrides */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header, footer, nav, button {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}
