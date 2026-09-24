'use client'

import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Calendar,
  KeyRound,
  Search,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Maximize2,
  Minimize2,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Share2,
  Check,
  Lock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import InvoicePrint from './InvoicePrint'
import { getDisplayInvoiceId, generateInvoicePreviewUrl } from '@/lib/invoice'
import { shortenInvoiceUrl, decodeInvoiceToken } from '@/lib/shortener'
import { toast } from 'sonner'

interface LoginInvoicePreviewerProps {
  onBackToLogin?: () => void
  initialInvoiceNumber?: string
  initialInvoiceDate?: string
  initialCode?: string
}

function LoginInvoicePreviewerContent({
  onBackToLogin,
  initialInvoiceNumber = '',
  initialInvoiceDate = '',
  initialCode = ''
}: LoginInvoicePreviewerProps) {
  const searchParams = useSearchParams()

  // Input states
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber)
  const [invoiceDate, setInvoiceDate] = useState(initialInvoiceDate)
  const [code, setCode] = useState(initialCode)

  // State machine
  const [loading, setLoading] = useState(false)
  const [initialChecking, setInitialChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifiedInvoice, setVerifiedInvoice] = useState<any | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Viewer options
  const [selectedSize, setSelectedSize] = useState<'A4' | 'A5' | 'POS' | 'Chalan'>('A4')
  const [zoom, setZoom] = useState(0.85)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const printIframeRef = useRef<HTMLIFrameElement | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const autoValidatedRef = useRef(false)

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
      let pSlug = searchParams?.get('s') || searchParams?.get('slug') || searchParams?.get('short') || ''

      // Browser fallback in case searchParams wasn't immediately hydrated
      if ((!pInv || !pDate || !pCode || !pSlug) && typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search)
        if (!pInv) pInv = sp.get('invoiceNumber') || sp.get('inv') || sp.get('invoice') || sp.get('no') || ''
        if (!pDate) pDate = sp.get('invoiceDate') || sp.get('date') || ''
        if (!pCode) pCode = sp.get('code') || sp.get('c') || sp.get('pin') || ''
        if (!pSlug) pSlug = sp.get('s') || sp.get('slug') || sp.get('short') || ''
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

      // If all three parameters are present, automatically validate from database
      if (pInv && pDate && pCode) {
        autoValidatedRef.current = true
        setInitialChecking(true)
        validateInvoiceFromDatabase(pInv, pDate, pCode)
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
    if (!verifiedInvoice) return
    try {
      const shortenResult = await shortenInvoiceUrl(verifiedInvoice)
      const url = shortenResult?.shortUrl || generateInvoicePreviewUrl(verifiedInvoice)
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setCopiedLink(true)
        toast.success('Public invoice preview link copied to clipboard!')
        setTimeout(() => setCopiedLink(false), 2500)
      }
    } catch {
      const url = generateInvoicePreviewUrl(verifiedInvoice)
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          setCopiedLink(true)
          toast.success('Public invoice preview link copied to clipboard!')
          setTimeout(() => setCopiedLink(false), 2500)
        }).catch(() => {
          toast.error('Failed to copy link')
        })
      }
    }
  }

  // Print / Save PDF Handler
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
    const printTitle = `Invoice-${displayId}`
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

  // Determine width based on paper format
  const originalWidth = selectedSize === 'POS' ? 302 : (selectedSize === 'A5' ? 559 : 794)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-colors duration-300 w-full">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 font-bold text-lg">
              TF
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight block leading-tight text-white">
                {verifiedInvoice?.business?.name || 'Timber & Furniture ERP'}
              </span>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Official Public Document Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onBackToLogin ? (
              <button
                type="button"
                onClick={onBackToLogin}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-800 cursor-pointer shadow-sm"
              >
                <span>Staff Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-800 shadow-sm"
              >
                <span>Staff Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {/* 1. INITIAL LOADING SKELETON WHILE AUTO-VALIDATING */}
            {initialChecking && (
              <motion.div
                key="checking"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-slate-900/90 rounded-3xl shadow-2xl p-8 border border-slate-800 flex flex-col items-center justify-center text-center my-12"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-5 relative">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <ShieldCheck className="w-5 h-5 absolute text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Verifying Invoice Authenticity
                </h3>
                <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
                  Querying database records and cryptographically validating security code...
                </p>
                {invoiceNumber && (
                  <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 text-[11px] font-mono text-slate-300 border border-slate-700/60">
                    <span>{invoiceNumber}</span>
                    <span>•</span>
                    <span>{invoiceDate}</span>
                    <span>•</span>
                    <span className="text-indigo-400 font-bold">{code}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* 2. VERIFIED PDF VIEWER VIEW */}
            {!initialChecking && verifiedInvoice && (
              <motion.div
                key="viewer"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "w-full bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col transition-all duration-300 overflow-hidden",
                  isFullscreen ? "fixed inset-2 sm:inset-4 z-50 max-w-none h-[calc(100vh-16px)] sm:h-[calc(100vh-32px)]" : "max-w-5xl h-[88vh]"
                )}
              >
                {/* Document Top Header & Controls Toolbar */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
                  {/* Left: Invoice Identity */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-slate-800"
                      title="Verify another document"
                    >
                      <Search className="w-4 h-4" />
                      <span className="hidden sm:inline">Search Another</span>
                    </button>

                    <div className="h-4 w-px bg-slate-800 hidden sm:block" />

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified from Database
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-white font-mono">
                        {getDisplayInvoiceId(verifiedInvoice.id)}
                      </span>
                    </div>
                  </div>

                  {/* Center: Format Switcher */}
                  <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 text-xs font-semibold border border-slate-700/60">
                    {(['A4', 'A5', 'POS', 'Chalan'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                          selectedSize === size
                            ? "bg-indigo-600 text-white shadow-sm font-bold"
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  {/* Right: Actions (Zoom, Share, Fullscreen, Print/Download) */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Zoom Controller */}
                    <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 text-xs border border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 font-mono text-[11px] text-slate-300 min-w-[42px] text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoom(0.85)}
                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Copy Share Link */}
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="p-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy Public Link"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(f => !f)}
                      className="p-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    {/* Print / Download Button */}
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Download / Print PDF</span>
                    </button>
                  </div>
                </div>

                {/* PDF Document Viewport Area */}
                <div className="flex-1 overflow-auto bg-slate-950/80 p-4 sm:p-8 flex justify-center items-start">
                  <div
                    style={{
                      width: `${originalWidth * zoom}px`,
                      minHeight: `${800 * zoom}px`,
                      position: 'relative'
                    }}
                    className="transition-all duration-150 shadow-2xl rounded-sm bg-white"
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

                {/* Bottom Summary & Verification Footer Bar */}
                <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <span>
                      Customer: <strong className="text-slate-200">{verifiedInvoice.customer}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Type: <strong className="text-slate-200">{verifiedInvoice.type}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Total Bill: <strong className="text-emerald-400 font-bold">৳{Number(verifiedInvoice.total || 0).toLocaleString()}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Balance Due: <strong className={cn(
                        "font-bold",
                        Number(verifiedInvoice.due || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                      )}>
                        ৳{Number(verifiedInvoice.due || 0).toLocaleString()}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    <span>Official verified invoice record from database</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. PUBLIC MANUAL VERIFICATION FORM (Shown when no URL params or on manual reset/error) */}
            {!initialChecking && !verifiedInvoice && (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-lg bg-slate-900/90 rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-800 my-8"
              >
                {/* Header */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20 text-white">
                    <FileCheck className="w-8 h-8" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
                    Invoice PDF Previewer
                  </h1>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm">
                    Enter your invoice details to validate and display the official PDF directly from the database.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-5 p-3.5 sm:p-4 bg-rose-950/40 border border-rose-900/60 rounded-2xl flex items-start gap-3 text-rose-400 text-xs sm:text-sm font-medium"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">Verification Unsuccessful</p>
                      <p className="text-xs text-rose-400/90 mt-0.5">{error}</p>
                    </div>
                  </motion.div>
                )}

                {/* Form */}
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  {/* Invoice Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center justify-between">
                      <span>Invoice Number</span>
                      <span className="text-[11px] text-slate-500">e.g. #INV-F-260901</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <FileText className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="#INV-F-260901 or #INV-W-260901"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                  </div>

                  {/* Invoice Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center justify-between">
                      <span>Invoice Date</span>
                      <span className="text-[11px] text-slate-500">Date of issue</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                  </div>

                  {/* 8-Character Security Code */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-medium text-slate-300 flex items-center gap-1.5">
                        <span>8-Character Security Code</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      </label>
                      <span className={cn(
                        "text-[11px] font-mono px-2 py-0.5 rounded-full border",
                        code.trim().length === 8
                          ? "bg-emerald-950/50 text-emerald-400 border-emerald-800"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      )}>
                        {code.trim().length} / 8 chars
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        maxLength={8}
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="e.g. 64F46349"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono uppercase tracking-widest transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Found on your invoice document or in the SMS verification message.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 mt-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Validating from Database...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Validate & View PDF</span>
                      </>
                    )}
                  </button>

                  {/* Helper Links */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleFillSample}
                      className="text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Fill Demo Sample (#INV-F-260901)
                    </button>
                    {onBackToLogin ? (
                      <button
                        type="button"
                        onClick={onBackToLogin}
                        className="text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Staff Sign In
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        className="text-slate-400 hover:text-slate-200"
                      >
                        Staff Sign In
                      </Link>
                    )}
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full py-4 px-6 text-center text-xs text-slate-500 border-t border-slate-800/80 bg-slate-950/60">
        <p>
          Secure End-to-End Invoice Verification • Protected by Multi-Tenant Cryptographic Validation
        </p>
      </footer>
    </div>
  )
}

export default function LoginInvoicePreviewer(props: LoginInvoicePreviewerProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 w-full">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-800 flex flex-col items-center justify-center text-center">
            <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold text-slate-200">
              Loading Invoice Document Portal...
            </p>
            <p className="text-xs text-slate-400 mt-1">Preparing verification environment</p>
          </div>
        </div>
      }
    >
      <LoginInvoicePreviewerContent {...props} />
    </Suspense>
  )
}
