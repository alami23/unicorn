'use client'

import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useSearchParams } from 'next/navigation'
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
  ArrowLeft,
  Maximize2,
  Minimize2,
  Sparkles,
  ShieldCheck,
  FileCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import InvoicePrint from './InvoicePrint'
import { getDisplayInvoiceId } from '@/lib/invoice'

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
  const [autoValidating, setAutoValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifiedInvoice, setVerifiedInvoice] = useState<any | null>(null)

  // Viewer options
  const [selectedSize, setSelectedSize] = useState<'A4' | 'A5' | 'POS' | 'Chalan'>('A4')
  const [zoom, setZoom] = useState(0.85)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const printIframeRef = useRef<HTMLIFrameElement | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const autoValidatedRef = useRef(false)

  // Core validation function
  const executeValidation = useCallback(async (invNum: string, invDate: string, invCode: string) => {
    const trimmedInv = (invNum || '').trim()
    const trimmedDate = (invDate || '').trim()
    const trimmedCode = (invCode || '').trim().toUpperCase()

    if (!trimmedInv) {
      setError('Please enter an invoice number.')
      return
    }

    if (!trimmedDate) {
      setError('Please select an invoice date.')
      return
    }

    if (!trimmedCode) {
      setError('Please enter the 8-character verification code.')
      return
    }

    if (trimmedCode.length !== 8) {
      setError(`The verification code must be exactly 8 characters. Currently entered: ${trimmedCode.length} characters.`)
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
        throw new Error(data.error || 'No matching invoice found for the provided details.')
      }

      setVerifiedInvoice(data.invoice)
      setSelectedSize('A4')
    } catch (err: any) {
      setError(err.message || 'Invoice verification failed. Please check the details and try again.')
    } finally {
      setLoading(false)
      setAutoValidating(false)
    }
  }, [])

  // Auto-parse URL parameters on mount and execute validation automatically
  useEffect(() => {
    if (autoValidatedRef.current) return

    let pInv = searchParams?.get('invoiceNumber') || searchParams?.get('inv') || searchParams?.get('invoice') || searchParams?.get('no') || ''
    let pDate = searchParams?.get('invoiceDate') || searchParams?.get('date') || ''
    let pCode = searchParams?.get('code') || searchParams?.get('c') || searchParams?.get('pin') || ''

    // Browser fallback in case searchParams wasn't immediately hydrated
    if ((!pInv || !pDate || !pCode) && typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      if (!pInv) pInv = sp.get('invoiceNumber') || sp.get('inv') || sp.get('invoice') || sp.get('no') || ''
      if (!pDate) pDate = sp.get('invoiceDate') || sp.get('date') || ''
      if (!pCode) pCode = sp.get('code') || sp.get('c') || sp.get('pin') || ''
    }

    if (pInv) setInvoiceNumber(pInv)
    if (pDate) setInvoiceDate(pDate)
    if (pCode) setCode(pCode.toUpperCase())

    // If all three parameters are present, automatically validate without user click!
    if (pInv && pDate && pCode) {
      autoValidatedRef.current = true
      setAutoValidating(true)
      executeValidation(pInv, pDate, pCode)
    }
  }, [searchParams, executeValidation])

  // Form submit handler
  const handleValidateAndSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    await executeValidation(invoiceNumber, invoiceDate, code)
  }

  // Quick fill sample for fast testing
  const handleFillSample = () => {
    setInvoiceNumber('#INV-F-260901')
    setInvoiceDate('2026-09-22')
    setCode('64F46349')
    setError(null)
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

  const handleResetSearch = () => {
    setVerifiedInvoice(null)
    setError(null)
    autoValidatedRef.current = true // Avoid re-triggering auto validation on manual reset
  }

  // Determine width based on size
  const originalWidth = selectedSize === 'POS' ? 302 : (selectedSize === 'A5' ? 559 : 794)

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {!verifiedInvoice ? (
          // ================= FORM VIEW =================
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 transition-colors duration-300 relative overflow-hidden"
          >
            {/* Auto-validating status banner overlay */}
            {autoValidating && (
              <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center mb-4">
                  <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Validating Invoice Parameters...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                  Parsing unique link parameters and verifying security token with server.
                </p>
                <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  <span>{invoiceNumber}</span>
                  <span>•</span>
                  <span>{invoiceDate}</span>
                  <span>•</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">{code}</span>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20 text-white">
                <FileCheck className="w-8 h-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-display">
                Invoice PDF Previewer
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                Enter your invoice details or use a verified link to view and download your official invoice PDF.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3.5 sm:p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{error}</p>
                </div>
              </motion.div>
            )}

            {/* Validation Form */}
            <form onSubmit={handleValidateAndSearch} className="space-y-4">
              {/* 1. Invoice Number */}
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
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
                  />
                </div>
              </div>

              {/* 2. Invoice Date */}
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
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-medium transition-all"
                  />
                </div>
              </div>

              {/* 3. 8-Character Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>8-Character Code</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  </label>
                  <span className={cn(
                    "text-[11px] font-mono px-2 py-0.5 rounded-full border",
                    code.trim().length === 8
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
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
                    placeholder="e.g. 64F46349 or CUS-9703"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono uppercase tracking-widest transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Enter the 8-character verification code shown on your invoice or sent in your link.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 mt-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Validating Invoice...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Validate & Display PDF</span>
                  </>
                )}
              </button>

              {/* Helper Links */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleFillSample}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Fill Demo Sample (#INV-F-260901)
                </button>
                {onBackToLogin && (
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        ) : (
          // ================= PREVIEW VIEW =================
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 overflow-hidden",
              isFullscreen ? "fixed inset-2 sm:inset-4 z-50 max-w-none h-[calc(100vh-16px)] sm:h-[calc(100vh-32px)]" : "max-w-4xl h-[88vh]"
            )}
          >
            {/* Top Toolbar */}
            <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Search Another Invoice"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Search Another</span>
                </button>

                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {getDisplayInvoiceId(verifiedInvoice.id)}
                  </span>
                </div>
              </div>

              {/* Center: Format Switcher */}
              <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-xl p-0.5 text-xs font-semibold">
                {(['A4', 'A5', 'POS', 'Chalan'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                      selectedSize === size
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Right: Actions (Zoom, Fullscreen, Print) */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-xl p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 min-w-[42px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(0.85)}
                    className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(f => !f)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-md shadow-indigo-500/20 text-xs sm:text-sm flex items-center gap-1.5 transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Download / Print PDF</span>
                </button>
              </div>
            </div>

            {/* Document Viewport Area */}
            <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950/70 p-4 sm:p-8 flex justify-center items-start">
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
                  className="h-fit"
                >
                  <div ref={previewRef} id="printable-invoice" className="h-fit">
                    <InvoicePrint invoice={verifiedInvoice} size={selectedSize} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Meta Info Bar */}
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <span>Customer: <strong className="text-slate-700 dark:text-slate-200">{verifiedInvoice.customer}</strong></span>
                <span>•</span>
                <span>Type: <strong className="text-slate-700 dark:text-slate-200">{verifiedInvoice.type}</strong></span>
                <span>•</span>
                <span>Total: <strong className="text-slate-900 dark:text-white">৳{Number(verifiedInvoice.total || 0).toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Official verified document preview</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LoginInvoicePreviewer(props: LoginInvoicePreviewerProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[320px]">
          <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Initializing Invoice Previewer...
          </p>
          <p className="text-xs text-slate-400 mt-1">Preparing secure verification environment</p>
        </div>
      }
    >
      <LoginInvoicePreviewerContent {...props} />
    </Suspense>
  )
}
