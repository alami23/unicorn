'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { ShieldCheck, ArrowRight, AlertCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { decodeInvoiceToken } from '@/lib/shortener'

export default function ShortLinkRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Resolving secure short link...')

  const slug = params?.slug as string

  useEffect(() => {
    if (!slug) {
      setError('Invalid link: missing short code identifier.')
      return
    }

    const resolveSlug = async () => {
      // 1. Check if it's a client-encoded fallback token (starts with t_)
      if (slug.startsWith('t_')) {
        const decoded = decodeInvoiceToken(slug)
        if (decoded) {
          setStatus('Forwarding to verified invoice...')
          const search = new URLSearchParams({
            invoiceNumber: decoded.invoiceNumber,
            invoiceDate: decoded.invoiceDate,
            code: decoded.code
          })
          router.replace(`/preview?${search.toString()}`)
          return
        }
      }

      // 2. Query the private URL shortener database
      try {
        const res = await fetch(`/api/shorten?slug=${encodeURIComponent(slug)}`)
        if (res.ok) {
          const data = await res.json()
          if (data.invoiceNumber && data.invoiceDate && data.code) {
            setStatus('Forwarding to verified invoice...')
            const search = new URLSearchParams({
              invoiceNumber: data.invoiceNumber,
              invoiceDate: data.invoiceDate,
              code: data.code
            })
            router.replace(`/preview?${search.toString()}`)
            return
          }
        }

        // If not found, try token decoding as last resort
        const fallbackDecoded = decodeInvoiceToken(slug)
        if (fallbackDecoded) {
          const search = new URLSearchParams({
            invoiceNumber: fallbackDecoded.invoiceNumber,
            invoiceDate: fallbackDecoded.invoiceDate,
            code: fallbackDecoded.code
          })
          router.replace(`/preview?${search.toString()}`)
          return
        }

        setError('This shortened invoice link was not found or may have expired.')
      } catch (err: any) {
        console.error('Error resolving short URL:', err)
        setError('Failed to resolve link. Please try again or enter details manually.')
      }
    }

    resolveSlug()
  }, [slug, router])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-slate-950/80 rounded-3xl p-8 border border-slate-800 shadow-2xl text-center"
      >
        {!error ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-5 relative">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <ShieldCheck className="w-5 h-5 absolute text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Validating Short Link
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mb-4">
              {status}
            </p>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-slate-400 text-xs font-mono border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>/s/{slug}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/40 text-rose-400 flex items-center justify-center mb-4 border border-rose-900/60">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Link Not Found
            </h2>
            <p className="text-xs text-rose-400/90 leading-relaxed mb-6">
              {error}
            </p>
            <div className="flex flex-col gap-2 w-full">
              <Link
                href="/preview"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Go to Public Invoice Search</span>
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
