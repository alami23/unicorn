'use client'

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import {
  FileCheck,
  ShieldCheck,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Calendar,
  FileText,
  KeyRound,
  Search,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Share2,
  Check,
  Lock,
  CheckCircle2,
  Package,
  Layers,
  Receipt,
  ScanLine
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import InvoicePrint from '@/components/InvoicePrint'
import { getDisplayInvoiceId } from '@/lib/invoice'
import { decodeInvoiceToken } from '@/lib/shortener'

function PublicInvoicePreviewContent() {
  const searchParams = useSearchParams()

  // Input states
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [code, setCode] = useState('')

  // State machine
  const [loading, setLoading] = useState(false)
  const [initialChecking, setInitialChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifiedInvoice, setVerifiedInvoice] = useState<any | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Viewer options
  const [selectedSize, setSelectedSize] = useState<'A4' | 'A5' | 'POS' | 'Chalan'>('A4')
  const [zoom, setZoom] = useState(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [unscaledHeight, setUnscaledHeight] = useState<number>(1123)

  const printIframeRef = useRef<HTMLIFrameElement | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoValidatedRef = useRef(false)

  // Measure content unscaled height dynamically to prevent truncation in A4 format
  useEffect(() => {
    if (!verifiedInvoice) return

    const measure = () => {
      if (previewRef.current) {
        const height = previewRef.current.scrollHeight || previewRef.current.offsetHeight
        if (height > 0) {
          // Standard A4 aspect ratio height at 96 DPI is 1123px (297mm)
          const standardA4Height = 1123
          const minHeight = selectedSize === 'POS' ? 400 : (selectedSize === 'A5' ? 794 : standardA4Height)
          setUnscaledHeight(Math.max(minHeight, height))
        }
      }
    }

    measure()
    const t1 = setTimeout(measure, 100)
    const t2 = setTimeout(measure, 300)
    const t3 = setTimeout(measure, 600)

    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      window.removeEventListener('resize', measure)
    }
  }, [verifiedInvoice, selectedSize])

  // Auto-fit document to screen width
  const handleAutoFit = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth - 48
    let originalWidth = 794
    if (selectedSize === 'A5') originalWidth = 559
    else if (selectedSize === 'POS') originalWidth = 302

    if (containerWidth > 0 && originalWidth > 0) {
      const calculatedZoom = Math.min(1.15, Math.max(0.35, Number((containerWidth / originalWidth).toFixed(2))))
      setZoom(calculatedZoom)
    }
  }, [selectedSize])

  // Initialize responsive zoom when invoice loads
  useEffect(() => {
    if (!verifiedInvoice) return
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth
      if (screenWidth < 640) {
        // Mobile screens: fit standard A4 comfortably
        const fitted = Math.min(0.9, Math.max(0.38, Number(((screenWidth - 32) / 794).toFixed(2))))
        setZoom(fitted)
      } else if (screenWidth < 1024) {
        setZoom(0.85)
      } else {
        setZoom(1.0) // On desktop, show 100% crisp standard A4 document
      }
    }
  }, [verifiedInvoice])

  // Core validation function against the database
  const validateInvoiceFromDatabase = useCallback(async (invNum: string, invDate: string, invCode: string) => {
    const trimmedInv = (invNum || '').trim()
    const trimmedDate = (invDate || '').trim()
    const trimmedCode = (invCode || '').trim().toUpperCase()

    if (!trimmedInv) {
      setError('Please enter an invoice number.')
      setInitialChecking(false)
      return
    }

    if (!trimmedDate) {
      setError('Please select the invoice date.')
      setInitialChecking(false)
      return
    }

    if (!trimmedCode) {
      setError('Please enter the 8-character verification code.')
      setInitialChecking(false)
      return
    }

    if (trimmedCode.length !== 8) {
      setError(`The verification code must be exactly 8 characters. Currently entered: ${trimmedCode.length} characters.`)
      setInitialChecking(false)
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/invoice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: trimmedInv,
          invoiceDate: trimmedDate,
          code: trimmedCode
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No matching invoice found in database for the provided details.')
      }

      setVerifiedInvoice(data.invoice)
      setSelectedSize('A4')
    } catch (err: any) {
      setError(err.message || 'Invoice verification failed. Please verify the invoice number, date, and 8-character code.')
    } finally {
      setLoading(false)
      setInitialChecking(false)
    }
  }, [])

  // Auto-parse URL parameters on mount and validate directly from database
  useEffect(() => {
    if (autoValidatedRef.current) return

    const parseAndValidate = async () => {
      let pInv = searchParams?.get('invoiceNumber') || searchParams?.get('inv') || searchParams?.get('invoice') || searchParams?.get('no') || ''
      let pDate = searchParams?.get('invoiceDate') || searchParams?.get('date') || ''
      let pCode = searchParams?.get('code') || searchParams?.get('c') || searchParams?.get('pin') || ''
      const pSlug = searchParams?.get('s') || searchParams?.get('slug') || searchParams?.get('short') || ''

      // Browser fallback in case searchParams wasn't immediately hydrated
      if ((!pInv || !pDate || !pCode || !pSlug) && typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search)
        if (!pInv) pInv = sp.get('invoiceNumber') || sp.get('inv') || sp.get('invoice') || sp.get('no') || ''
        if (!pDate) pDate = sp.get('invoiceDate') || sp.get('date') || ''
        if (!pCode) pCode = sp.get('code') || sp.get('c') || sp.get('pin') || ''
      }

      // If a short slug was passed as ?s=slug, resolve it first
      if (pSlug && (!pInv || !pDate || !pCode)) {
        if (pSlug.startsWith('t_')) {
          const decoded = decodeInvoiceToken(pSlug)
          if (decoded) {
            pInv = decoded.invoiceNumber
            pDate = decoded.invoiceDate
            pCode = decoded.code
          }
        } else {
          try {
            const res = await fetch(`/api/shorten?slug=${encodeURIComponent(pSlug)}`)
            if (res.ok) {
              const data = await res.json()
              if (data.invoiceNumber && data.invoiceDate && data.code) {
                pInv = data.invoiceNumber
                pDate = data.invoiceDate
                pCode = data.code
              }
            }
          } catch (e) {
            console.warn('Could not resolve query slug:', e)
          }
        }
      }

      // Clean up URI encoded parameters (e.g. %23INV-F-260901 -> #INV-F-260901)
      if (pInv) {
        try {
          pInv = decodeURIComponent(pInv)
        } catch (e) {}
        setInvoiceNumber(pInv)
      }
      if (pDate) setInvoiceDate(pDate)
      if (pCode) setCode(pCode.toUpperCase())

      // If all three parameters are present in the URL, validate directly from database!
      if (pInv && pDate && pCode) {
        autoValidatedRef.current = true
        validateInvoiceFromDatabase(pInv, pDate, pCode)
      } else {
        setInitialChecking(false)
      }
    }

    parseAndValidate()
  }, [searchParams, validateInvoiceFromDatabase])

  // Form submit handler
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await validateInvoiceFromDatabase(invoiceNumber, invoiceDate, code)
  }

  // Quick fill sample for fast testing
  const handleFillSample = () => {
    setInvoiceNumber('#INV-F-260901')
    setInvoiceDate('2026-09-22')
    setCode('64F46349')
    setError(null)
  }

  // Copy Public Share URL to clipboard
  const handleCopyShareLink = async () => {
    if (typeof window === 'undefined') return
    const currentUrl = window.location.href
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopiedLink(true)
      toast.success('Public invoice preview link copied to clipboard!')
      setTimeout(() => setCopiedLink(false), 2500)
    } catch (e) {
      toast.error('Failed to copy link')
    }
  }

  // Print / Save PDF Handler matching InvoiceModal layout
  const handlePrint = useCallback(() => {
    if (!verifiedInvoice) return

    const content = previewRef.current
    if (!content) return

    let iframe = printIframeRef.current
    if (!iframe) {
      iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.style.visibility = 'hidden'
      document.body.appendChild(iframe)
      printIframeRef.current = iframe
    }

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
        } catch {
          // Ignore cross-origin stylesheet errors
        }
      })
    } catch (e) {
      console.error('Error copying styles for printing:', e)
    }

    const displayId = getDisplayInvoiceId(verifiedInvoice.id) || 'Invoice'
    const printTitle = `${selectedSize}-${displayId}`
    const dynamicHeight = content.offsetHeight + 20

    doc.open()
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
              #printable-invoice { 
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
          <div id="printable-invoice">
            ${content.innerHTML}
          </div>
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      iframe?.contentWindow?.focus()
      iframe?.contentWindow?.print()
    }, 500)
  }, [verifiedInvoice, selectedSize])

  const handleReset = () => {
    setVerifiedInvoice(null)
    setError(null)
  }

  // Determine width based on paper format (standard A4: 794px)
  let originalWidth = 794
  if (selectedSize === 'A5') {
    originalWidth = 559
  } else if (selectedSize === 'POS') {
    originalWidth = 302
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 font-bold text-lg">
              TF
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight block leading-tight text-slate-900 dark:text-white">
                {verifiedInvoice?.business?.name || 'Timber & Furniture ERP'}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Document Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-800"
            >
              <span>Staff Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start p-2 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center">
          <AnimatePresence mode="wait">
            {/* 1. INITIAL LOADING SKELETON WHILE AUTO-VALIDATING */}
            {initialChecking && (
              <motion.div
                key="checking"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center my-12"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 relative">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <ShieldCheck className="w-5 h-5 absolute text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Verifying Invoice Authenticity
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Validating cryptographic code and formatting official A4 document layout...
                </p>
              </motion.div>
            )}

            {/* 2. VERIFIED A4 PDF DOCUMENT VIEW */}
            {!initialChecking && verifiedInvoice && (
              <motion.div
                key="viewer"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 overflow-hidden",
                  isFullscreen ? "fixed inset-2 sm:inset-4 z-50 max-w-none h-[calc(100vh-16px)] sm:h-[calc(100vh-32px)]" : "max-w-5xl"
                )}
              >
                {/* Document Top Header & Controls Toolbar */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  {/* Left: Document Info & Search Another */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-slate-200 dark:border-slate-700"
                      title="Verify another document"
                    >
                      <Search className="w-4 h-4" />
                      <span className="hidden sm:inline">Search Another</span>
                    </button>

                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified A4 Invoice
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {getDisplayInvoiceId(verifiedInvoice.id)}
                      </span>
                    </div>
                  </div>

                  {/* Center: Format Switcher (A4 default) */}
                  <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSize('A4')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                        selectedSize === 'A4'
                          ? "bg-indigo-600 text-white shadow-sm font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>A4 Format</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSize('A5')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                        selectedSize === 'A5'
                          ? "bg-indigo-600 text-white shadow-sm font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>A5</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSize('POS')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                        selectedSize === 'POS'
                          ? "bg-indigo-600 text-white shadow-sm font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>POS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSize('Chalan')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                        selectedSize === 'Chalan'
                          ? "bg-amber-600 text-white shadow-sm font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Chalan</span>
                    </button>
                  </div>

                  {/* Right: Actions (Zoom, Share, Print/Download) */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Zoom Controller */}
                    <div className="flex items-center bg-white dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <button
                        type="button"
                        onClick={() => setZoom(z => Math.max(0.35, Number((z - 0.1).toFixed(2))))}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 font-mono text-[11px] text-slate-700 dark:text-slate-300 min-w-[42px] text-center font-bold">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoFit}
                        className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer text-[10px] border-l border-slate-200 dark:border-slate-700"
                        title="Auto Fit to Screen"
                      >
                        Fit
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoom(1.0)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                        title="Reset to 100%"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Copy Share Link */}
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy Public Link"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(f => !f)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    {/* Print / Download Button */}
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-4 sm:px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* Document Viewport - Clean Desktop Canvas */}
                <div
                  ref={containerRef}
                  className="flex-1 overflow-auto bg-slate-200/70 dark:bg-slate-950 p-4 sm:p-8 flex justify-center items-start min-h-[500px]"
                >
                  <div className="min-w-max min-h-max flex items-start justify-center p-2">
                    {/* A4 Document Paper Frame with Crisp Margins & Shadows */}
                    <div
                      style={{
                        width: `${originalWidth * zoom}px`,
                        height: `${unscaledHeight * zoom}px`,
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                      className="transition-all duration-200 shadow-2xl rounded-sm bg-white border border-slate-300/80 dark:border-slate-800"
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
                        className="h-fit text-slate-900"
                      >
                        <div ref={previewRef} id="printable-invoice" className="h-fit">
                          <InvoicePrint invoice={verifiedInvoice} size={selectedSize} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Summary & Cryptographic Verification Footer */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <span>
                      Customer: <strong className="text-slate-900 dark:text-slate-100">{verifiedInvoice.customer}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Type: <strong className="text-slate-900 dark:text-slate-100">{verifiedInvoice.type}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Total Bill: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">৳{Number(verifiedInvoice.total || 0).toLocaleString()}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Balance Due: <strong className={cn(
                        "font-bold",
                        Number(verifiedInvoice.due || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        ৳{Number(verifiedInvoice.due || 0).toLocaleString()}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Cryptographically verified official A4 document</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. PUBLIC MANUAL VERIFICATION FORM (Shown when no URL params or on manual reset) */}
            {!initialChecking && !verifiedInvoice && (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 my-8"
              >
                {/* Header */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-tr from-amber-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-600/20 text-white">
                    <FileCheck className="w-8 h-8" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-display">
                    Invoice PDF Previewer
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    Enter invoice details to validate and display the official A4 document format directly from the database.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-start gap-3 text-rose-700 dark:text-rose-400 text-xs sm:text-sm font-medium"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Verification Unsuccessful</p>
                      <p className="text-xs text-rose-600 dark:text-rose-400/90 mt-0.5">{error}</p>
                    </div>
                  </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  {/* Invoice Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Invoice Number</span>
                      <span className="text-[11px] text-slate-400">e.g. #INV-F-260901</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="#INV-F-260901 or #INV-W-260901"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                  </div>

                  {/* Invoice Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Invoice Date</span>
                      <span className="text-[11px] text-slate-400">Date of issue</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                  </div>

                  {/* 8-Character Security Code */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span>8-Character Security Code</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      </label>
                      <span className={cn(
                        "text-[11px] font-mono px-2 py-0.5 rounded-full border",
                        code.trim().length === 8
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                      )}>
                        {code.trim().length} / 8 chars
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        maxLength={8}
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="e.g. 64F46349"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono uppercase tracking-widest transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Found on your invoice document or in the SMS verification message.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 mt-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Validating A4 Document...</span>
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-4 h-4" />
                        <span>Validate & View A4 Invoice</span>
                      </>
                    )}
                  </button>

                  {/* Helper Links */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleFillSample}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Fill Demo Sample (#INV-F-260901)
                    </button>
                    <Link
                      href="/login"
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Staff Sign In
                    </Link>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
        <p>
          Official Invoice Document Verification • Protected by Multi-Tenant Cryptographic Validation
        </p>
      </footer>
    </div>
  )
}

export default function PublicPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Loading Verified Document Portal...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Preparing clean A4 document format</p>
          </div>
        </div>
      }
    >
      <PublicInvoicePreviewContent />
    </Suspense>
  )
}
