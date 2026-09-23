'use client'

import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Trees, Armchair, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CreateInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateInvoiceModal({ isOpen, onClose }: CreateInvoiceModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">Create New Invoice</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Select the type of invoice you want to create.</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/pos-wood"
                onClick={onClose}
                className="group relative flex flex-col gap-4 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-600/20 group-hover:scale-110 transition-transform">
                  <Trees size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Wood POS</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create invoice for timber, logs, and wood items.</p>
                </div>
                <ArrowRight className="absolute bottom-6 right-6 text-amber-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={20} />
              </Link>

              <Link
                href="/pos-furniture"
                onClick={onClose}
                className="group relative flex flex-col gap-4 p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform">
                  <Armchair size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Furniture POS</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create invoice for ready-made furniture items.</p>
                </div>
                <ArrowRight className="absolute bottom-6 right-6 text-blue-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={20} />
              </Link>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-center text-slate-400">
                You will be redirected to the respective Point of Sale interface.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
