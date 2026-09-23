'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import LoginInvoicePreviewer from '@/components/LoginInvoicePreviewer'

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navbar */}
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold text-lg">
              TF
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight block leading-tight text-slate-900 dark:text-white">
                Timber & Furniture ERP
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Verified Document & Invoice Preview
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>Staff Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Preview Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center">
          <Suspense
            fallback={
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Loading Invoice Preview Portal...
                </p>
              </div>
            }
          >
            <LoginInvoicePreviewer onBackToLogin={() => {
              if (typeof window !== 'undefined') window.location.href = '/login'
            }} />
          </Suspense>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full py-4 px-6 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40">
        <p>
          Secure End-to-End Invoice Verification • Protected by Multi-Tenant Cryptographic Validation
        </p>
      </footer>
    </div>
  )
}
