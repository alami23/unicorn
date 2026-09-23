'use client'

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { 
  ShieldCheck, 
  ShieldAlert, 
  Printer, 
  FileText, 
  Layout, 
  Smartphone, 
  Package, 
  CheckCircle2, 
  Lock, 
  Download,
  Building2,
  Calendar,
  KeyRound,
  RotateCw,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import InvoicePrint from '@/components/InvoicePrint'
import { getDisplayInvoiceId } from '@/lib/invoice'

function PublicInvoiceViewer() {
  const searchParams = useSearchParams()
  const params = useParams()

  // Support both search parameters and path parameters
  const rawId = (searchParams?.get('id') || searchParams?.get('invoice_id') || searchParams?.get('invoice_number') || searchParams?.get('invoice') || params?.invoice_number || params?.id || '') as string
  const rawDate = (searchParams?.get('date') || searchParams?.get('invoice_date') || searchParams?.get('d') || params?.invoice_date || '') as string
  const rawCode = (searchParams?.get('code') || searchParams?.get('secret_token') || searchParams?.get('token') || searchParams?.get('c') || params?.secret_token || '') as string

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [invoice, setInvoice] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)

  const [selectedSize, setSelectedSize] = useState<'A4' | 'A5' | 'POS' | 'Chalan'>('A4')
  const [zoom, setZoom] = useState(0.85)
  const [unscaledHeight, setUnscaledHeight] = useState(1123)
  const containerRef = useRef<HTMLDivElement>(null)
  const printableInvoiceRef = useRef<HTMLDivElement>(null)

  const verifyAndLoadInvoice = useCallback(async () => {
    if (!rawId || !rawDate || !rawCode) {
      setLoading(false)
      setAccessDenied(true)
      setErrorMessage('Missing required verification parameters in URL. Invoice ID, Invoice Date, and 8-Character Security Code are required to view this invoice.')
      return
    }

    setLoading(true)
    setAccessDenied(false)
    setErrorMessage('')

    try {
      const query = new URLSearchParams({
        id: rawId,
        date: rawDate,
        code: rawCode
      })

      const res = await fetch(`/api/invoice/public?${query.toString()}`)
      const data = await res.json()

      if (!res.ok || !data.verified || !data.invoice) {
        setAccessDenied(true)
        setErrorMessage(data.error || 'Access Denied: The invoice verification details (ID, Date, or Security Code) are invalid.')
        setInvoice(null)
      } else {
        setInvoice(data.invoice)
        if (data.settings) setSettings(data.settings)
        setAccessDenied(false)
      }
    } catch (err: any) {
      console.error('Invoice verification error:', err)
      setAccessDenied(true)
      setErrorMessage('Unable to verify invoice credentials. Please check your internet connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [rawId, rawDate, rawCode])

  useEffect(() => {
    verifyAndLoadInvoice()
  }, [verifyAndLoadInvoice])

  // Measure printable height
  useEffect(() => {
    if (!invoice) return
    const measure = () => {
      if (printableInvoiceRef.current) {
        const height = printableInvoiceRef.current.scrollHeight || printableInvoiceRef.current.offsetHeight
        if (height > 0) {
          setUnscaledHeight(height)
        }
      }
    }

    measure()
    const t1 = setTimeout(measure, 150)
    const t2 = setTimeout(measure, 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [invoice, selectedSize, zoom])

  const handleAutoFit = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const padding = window.innerWidth >= 640 ? 48 : 24
    const availableWidth = containerWidth - padding
    
    let targetWidth = 794 // Default A4/Chalan
    if (selectedSize === 'A5') {
      targetWidth = 559
    } else if (selectedSize === 'POS') {
      targetWidth = 302
    }

    const fitScale = Math.min(1.0, Math.max(0.2, availableWidth / targetWidth))
    setZoom(Number(fitScale.toFixed(2)))
  }, [selectedSize])

  useEffect(() => {
    handleAutoFit()
    window.addEventListener('resize', handleAutoFit)
    return () => window.removeEventListener('resize', handleAutoFit)
  }, [handleAutoFit, invoice])

  const handlePrint = () => {
    const content = document.getElementById('public-printable-invoice')
    if (!content) return

    const iframe = document.createElement('iframe')
    iframe.id = 'public-print-iframe'
    iframe.style.position = 'absolute'
    iframe.style.left = '-9999px'
    iframe.style.top = '-9999px'
    iframe.style.width = selectedSize === 'POS' ? '302px' : '1024px'
    iframe.style.height = '768px'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return

    let styles = ''
    try {
      const styleSheets = Array.from(document.styleSheets)
      styleSheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules)
          rules.forEach(rule => {
            styles += rule.cssText
          })
        } catch {}
      })
    } catch (e) {
      console.error('Error copying styles:', e)
    }

    const rawInvoiceNumber = invoice?.id ? getDisplayInvoiceId(invoice.id) : 'Invoice'
    const printTitle = `${selectedSize}-${rawInvoiceNumber}`
    const dynamicHeight = content.offsetHeight + 20

    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            ${styles}
            @media print {
              @page {
                size: ${selectedSize === 'POS' ? `80mm ${dynamicHeight}px` : (selectedSize === 'A5' ? 'A5' : 'A4')};
                margin: 0;
              }
              body { 
                margin: 0 !important; 
                padding: 0 !important; 
                background: white !important;
                width: ${selectedSize === 'POS' ? '80mm' : 'auto'} !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              #public-printable-invoice { 
                box-shadow: none !important; 
                margin: 0 !important; 
                border: none !important;
                width: ${selectedSize === 'POS' ? '80mm' : '100%'} !important;
                max-width: none !important;
                transform: none !important;
                padding: ${selectedSize === 'POS' ? '0' : 'inherited'} !important;
              }
              tr, .break-inside-avoid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
            }
          </style>
        </head>
        <body>
          <div id="public-printable-invoice">
            ${content.innerHTML}
          </div>
        </body>
      </html>
    `)
    doc.close()

    const triggerPrint = () => {
      if (iframe.contentWindow) {
        const originalTitle = document.title
        document.title = printTitle
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
        } catch (e) {
          console.warn('Print error', e)
        }
        setTimeout(() => {
          document.title = originalTitle
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 3000)
      }
    }

    const images = Array.from(doc.getElementsByTagName('img'))
    if (images.length === 0) {
      setTimeout(triggerPrint, 400)
    } else {
      const timeoutId = setTimeout(triggerPrint, 3000)
      let loaded = 0
      images.forEach(img => {
        if (img.complete) {
          loaded++
          if (loaded === images.length) {
            clearTimeout(timeoutId)
            setTimeout(triggerPrint, 250)
          }
        } else {
          img.onload = img.onerror = () => {
            loaded++
            if (loaded === images.length) {
              clearTimeout(timeoutId)
              setTimeout(triggerPrint, 250)
            }
          }
        }
      })
    }
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/60 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5 animate-pulse">
            <RotateCw size={28} className="animate-spin text-blue-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-2">Verifying Invoice Security</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Validating invoice ID, issue date, and 8-character security token against verified database records...
          </p>
          <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-500 h-full w-2/3 animate-indeterminate" />
          </div>
        </div>
      </div>
    )
  }

  // Access Denied State
  if (accessDenied || !invoice) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
        <div className="w-full max-w-lg bg-slate-900 border border-rose-900/40 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl">
          <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6 shadow-inner">
            <ShieldAlert size={40} className="text-rose-500" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold uppercase tracking-wider mb-3">
            <Lock size={12} /> Access Denied
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Invoice Verification Failed
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {errorMessage || 'The requested invoice could not be verified. You must provide a valid Invoice ID, matching Invoice Date, and the correct 8-character security code in the URL parameters.'}
          </p>

          <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-left mb-6 space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5"><Building2 size={13} /> Invoice ID:</span>
              <span className="font-mono text-slate-200">{rawId || '<Missing>'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5"><Calendar size={13} /> Invoice Date:</span>
              <span className="font-mono text-slate-200">{rawDate || '<Missing>'}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 flex items-center gap-1.5"><KeyRound size={13} /> Security Code:</span>
              <span className="font-mono text-slate-200">{rawCode ? `${rawCode.slice(0, 2)}••••${rawCode.slice(-2)}` : '<Missing>'}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            If you received this link via SMS or email, please contact the issuing store to obtain a verified link.
          </p>
        </div>
      </div>
    )
  }

  // Verified & Granted State
  let originalWidth = 794
  if (selectedSize === 'A5') {
    originalWidth = 559
  } else if (selectedSize === 'POS') {
    originalWidth = 302
  }

  const displayId = getDisplayInvoiceId(invoice.id)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar with Security Verification Badge */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={22} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Invoice {displayId}</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 size={11} /> Verified
              </span>
            </div>
            <p className="text-xs text-slate-400">Issued: {invoice.date} • Customer: {invoice.customer}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-auto">
          {/* Format Selector */}
          <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800">
            <button
              onClick={() => setSelectedSize('A4')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedSize === 'A4' ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              A4
            </button>
            <button
              onClick={() => setSelectedSize('A5')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedSize === 'A5' ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              A5
            </button>
            <button
              onClick={() => setSelectedSize('POS')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedSize === 'POS' ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              POS
            </button>
            <button
              onClick={() => setSelectedSize('Chalan')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedSize === 'Chalan' ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              Chalan
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}
              className="px-2.5 py-1 font-bold text-slate-400 hover:text-white"
            >
              -
            </button>
            <span className="w-10 text-center font-mono font-bold text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(2.0, prev + 0.1))}
              className="px-2.5 py-1 font-bold text-slate-400 hover:text-white"
            >
              +
            </button>
            <button
              onClick={handleAutoFit}
              className="ml-1 px-2 py-1 text-[11px] font-semibold text-amber-500 hover:text-amber-400"
            >
              Fit
            </button>
          </div>

          {/* Print / Download Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
          >
            <Printer size={15} /> Print / PDF
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center bg-slate-900/50"
      >
        <div className="min-w-max min-h-max flex items-start justify-center pb-12">
          <div 
            style={{ 
              width: `${originalWidth * zoom}px`, 
              height: `${unscaledHeight * zoom}px`,
              overflow: 'hidden',
              position: 'relative'
            }} 
            className="transition-all duration-200 shadow-2xl rounded-xl bg-white"
          >
            <div 
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'top left',
                width: `${originalWidth}px`,
                position: 'absolute',
                top: 0,
                left: 0
              }} 
              className="h-fit"
            >
              <div ref={printableInvoiceRef} id="public-printable-invoice" className="h-fit">
                <InvoicePrint invoice={invoice} size={selectedSize} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PublicInvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100">
        <RotateCw size={24} className="animate-spin text-blue-400" />
      </div>
    }>
      <PublicInvoiceViewer />
    </Suspense>
  )
}
