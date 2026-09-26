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
  Maximize2,
  Minimize2,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Share2,
  Check,
  Lock,
  Download
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
  const [searchQuery, setSearchQuery] = useState('')

  // State machine
  const [loading, setLoading] = useState(false)
  const [initialChecking, setInitialChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifiedInvoice, setVerifiedInvoice] = useState<any | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Viewer options (exclusively A4 format)
  const selectedSize = 'A4' as const
  const [zoom, setZoom] = useState(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [unscaledHeight, setUnscaledHeight] = useState<number>(1123)

  const printIframeRef = useRef<HTMLIFrameElement | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const autoValidatedRef = useRef(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isManuallyZoomedRef = useRef(false)

  // Measure unscaled document height to prevent any truncation
  useEffect(() => {
    if (!verifiedInvoice) return

    const measure = () => {
      if (previewRef.current) {
        const height = previewRef.current.scrollHeight || previewRef.current.offsetHeight
        if (height > 0) {
          setUnscaledHeight(Math.max(1123, height))
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
  }, [verifiedInvoice])

  // Responsive zoom calculation that fits ANY device screen width perfectly
  const updateResponsiveZoom = useCallback((isManual = false) => {
    if (typeof window === 'undefined') return
    const screenWidth = window.innerWidth
    const originalDocWidth = 794

    // Determine clean padding based on viewport size
    let padding = 32
    if (screenWidth < 640) {
      padding = 16 // minimal padding on mobile for maximum readability
    } else if (screenWidth < 1024) {
      padding = 32 // tablets
    } else {
      padding = 48 // desktops
    }

    const availableWidth = Math.max(280, screenWidth - padding)
    let calculated = Number((availableWidth / originalDocWidth).toFixed(2))

    if (screenWidth >= 1024) {
      calculated = Math.min(1.0, Math.max(0.65, calculated))
    } else {
      calculated = Math.min(1.0, Math.max(0.35, calculated))
    }

    setZoom(calculated)
    if (isManual) {
      isManuallyZoomedRef.current = true
      toast.success(`Zoom set to ${Math.round(calculated * 100)}% (Fit to Screen)`)
    }
  }, [])

  // Auto-fit on mount & on window resize dynamically
  useEffect(() => {
    if (!verifiedInvoice) return

    updateResponsiveZoom(false)

    const handleResize = () => {
      if (!isManuallyZoomedRef.current) {
        updateResponsiveZoom(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [verifiedInvoice, updateResponsiveZoom])

  // Auto-fit document button action
  const handleAutoFit = useCallback(() => {
    updateResponsiveZoom(true)
  }, [updateResponsiveZoom])

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

  const [downloading, setDownloading] = useState(false)

  // Direct PDF Download Handler (without opening print dialog)
  const handleDownloadPdf = useCallback(async () => {
    if (!verifiedInvoice || downloading) return

    const content = previewRef.current
    if (!content) {
      toast.error('Invoice content is not ready')
      return
    }

    setDownloading(true)
    const toastId = toast.loading('Generating invoice PDF...')

    try {
      const { jsPDF } = await import('jspdf')
      const { toPng } = await import('html-to-image')

      // Generate crisp image from the invoice DOM node using native browser rendering engine
      const dataUrl = await toPng(content, {
        quality: 0.98,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        width: 794,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          width: '794px',
          margin: '0',
          padding: '0'
        }
      })

      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      })

      const pdfWidth = pdf.internal.pageSize.getWidth() // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight() // 297mm
      const imgHeight = (img.naturalHeight * pdfWidth) / img.naturalWidth

      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST')
      heightLeft -= pdfHeight

      // Handle multi-page if document exceeds standard A4 height
      while (heightLeft > 2) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST')
        heightLeft -= pdfHeight
      }

      const displayId = getDisplayInvoiceId(verifiedInvoice.id) || 'Invoice'
      const fileName = `Invoice-${displayId}.pdf`

      pdf.save(fileName)

      toast.success(`Invoice ${displayId} downloaded as PDF!`, { id: toastId })
    } catch (err: any) {
      console.error('Failed to generate PDF directly:', err)
      toast.error('Failed to generate PDF directly. Please try again.', { id: toastId })
    } finally {
      setDownloading(false)
    }
  }, [verifiedInvoice, downloading])

  const handleReset = () => {
    setVerifiedInvoice(null)
    setError(null)
  }

  const handleQuickSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = (searchQuery || '').trim()
    if (!q) {
      handleReset()
      return
    }
    if (q.length === 8 && !q.includes(' ') && !q.startsWith('#')) {
      setCode(q.toUpperCase())
      setVerifiedInvoice(null)
      toast.info(`Security code ${q.toUpperCase()} filled. Please confirm invoice details.`)
    } else {
      setInvoiceNumber(q)
      setVerifiedInvoice(null)
      toast.info(`Invoice ${q} filled. Please verify date & security code.`)
    }
  }

  // Width for standard A4 format (794px at 96 DPI)
  const originalWidth = 794

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans transition-colors duration-300 w-full">
      {/* Single Condensed Top Header Box */}
      <header className="w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-50 shadow-md">
        {/* Row 1: Brand & Search + Actions (Mobile & Desktop) */}
        <div className="w-full px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Far Left: Business Name & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 font-bold text-xs sm:text-sm">
              TF
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm md:text-base tracking-tight block leading-tight text-white truncate max-w-[120px] sm:max-w-[180px] md:max-w-[240px]">
                {verifiedInvoice?.business?.name || 'Timber & Furniture ERP'}
              </span>
              <span className="text-[10px] text-slate-400 hidden xl:inline leading-none">
                Official Document Portal
              </span>
            </div>
          </div>

          {verifiedInvoice ? (
            /* Integrated Controls in the Top Header Box */
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Desktop Only: Verification Status */}
              <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-emerald-400 text-xs font-semibold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>Verified from Database</span>
              </div>

              {/* Desktop Only: Invoice Details */}
              <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-medium shrink-0">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-mono font-bold text-white">
                  {getDisplayInvoiceId(verifiedInvoice.id)}
                </span>
                <span>•</span>
                <span>{verifiedInvoice.date}</span>
                {verifiedInvoice.customer && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[120px] font-semibold text-slate-200">
                      {verifiedInvoice.customer}
                    </span>
                  </>
                )}
              </div>

              {/* Desktop Only: Zoom Controls */}
              <div className="hidden lg:flex items-center bg-slate-800/90 rounded-xl p-0.5 text-xs border border-slate-700/60 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    isManuallyZoomedRef.current = true
                    setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(2))))
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors active:scale-95"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 font-mono text-[11px] text-slate-300 min-w-[38px] text-center font-bold">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    isManuallyZoomedRef.current = true
                    setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(2))))
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors active:scale-95"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    isManuallyZoomedRef.current = false
                    handleAutoFit()
                  }}
                  className="px-2 py-1 rounded-lg hover:bg-slate-700 text-indigo-400 font-semibold cursor-pointer text-[10px] border-l border-slate-700/60 active:scale-95"
                  title="Auto Fit to Screen"
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    isManuallyZoomedRef.current = true
                    setZoom(1.0)
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors active:scale-95"
                  title="Reset 100%"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Download Button (Direct PDF generation without print dialog) */}
              <button
                type="button"
                disabled={downloading}
                onClick={handleDownloadPdf}
                className={cn(
                  "px-4 sm:px-6 lg:px-5 py-2 sm:py-2.5 lg:py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs sm:text-sm lg:text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95 disabled:opacity-75 disabled:cursor-wait",
                )}
                title="Download PDF"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-3.5 lg:h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="font-bold tracking-tight">Saving...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 sm:w-5 sm:h-5 lg:w-3.5 lg:h-3.5 shrink-0" />
                    <span className="font-bold tracking-tight">Download</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Official Document Portal
              </span>
            </div>
          )}
        </div>

        {/* Row 2 on Mobile/Tablet (< lg): Neatly organized Document ID + Zoom controls */}
        {verifiedInvoice && (
          <div className="lg:hidden w-full px-3 sm:px-6 py-2 bg-slate-950/95 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-emerald-400 text-[11px] font-semibold shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Verified</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== 'undefined') {
                    navigator.clipboard.writeText(getDisplayInvoiceId(verifiedInvoice.id))
                    toast.success(`Copied Invoice ID: ${getDisplayInvoiceId(verifiedInvoice.id)}`)
                  }
                }}
                className="font-mono text-xs font-bold text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded transition-colors truncate max-w-[130px] sm:max-w-[200px] cursor-pointer"
                title="Click to copy Invoice ID"
              >
                {getDisplayInvoiceId(verifiedInvoice.id)}
              </button>
            </div>

            {/* Mobile/Tablet Zoom controls */}
            <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 text-xs border border-slate-700/60 shrink-0">
              <button
                type="button"
                onClick={() => {
                  isManuallyZoomedRef.current = true
                  setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(2))))
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors active:scale-95"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[11px] text-slate-300 min-w-[34px] text-center font-bold">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => {
                  isManuallyZoomedRef.current = true
                  setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(2))))
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors active:scale-95"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  isManuallyZoomedRef.current = false
                  handleAutoFit()
                }}
                className="px-2 py-1 rounded-lg hover:bg-slate-700 text-indigo-400 font-semibold cursor-pointer text-[10px] border-l border-slate-700/60 active:scale-95"
                title="Fit to Screen Width"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => {
                  isManuallyZoomedRef.current = true
                  setZoom(1.0)
                }}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors active:scale-95"
                title="Reset 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 flex flex-col items-center justify-center w-full min-h-[calc(100vh-64px)] transition-all duration-300",
        verifiedInvoice ? "p-0" : "p-4 sm:p-8"
      )}>
        <div className={cn(
          "w-full mx-auto flex flex-col items-center justify-center flex-1",
          verifiedInvoice ? "max-w-none" : "max-w-lg"
        )}>
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
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="w-full flex-1 flex flex-col items-center justify-center"
              >
                {/* PDF Document Viewport Area - Centered Full-Width & Full-Height Canvas */}
                <div
                  ref={containerRef}
                  className="flex-1 w-full bg-slate-950 py-4 sm:py-6 lg:py-8 px-2 sm:px-4 lg:px-6 flex justify-center items-center overflow-auto min-h-[calc(100vh-125px)]"
                >
                  <div className="flex flex-col items-center justify-center my-auto mx-auto transition-all duration-200">
                    <div
                      style={{
                        width: `${originalWidth * zoom}px`,
                        height: `${unscaledHeight * zoom}px`,
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                      className="transition-all duration-150 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.5),0_20px_45px_-10px_rgba(0,0,0,0.7)] rounded-sm bg-white border border-slate-700/60 ring-1 ring-white/10 mx-auto my-auto"
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

                {/* Bottom Verification Footer Bar */}
                <div className="px-5 py-3 md:px-8 border-t border-slate-800 bg-slate-950/90 text-xs text-slate-400 flex items-center justify-center sm:justify-end gap-3 shrink-0 w-full">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
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
