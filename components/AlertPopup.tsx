'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertPopupProps {
  isOpen: boolean
  onClose: () => void
  message: string
  type?: 'error' | 'warning' | 'info' | 'success'
  title?: string
}

export default function AlertPopup({ isOpen, onClose, message, type = 'error', title }: AlertPopupProps) {
  useEffect(() => {
    if (isOpen) {
      const soundUrl = type === 'success' 
        ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
        : 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
      const audio = new Audio(soundUrl)
      audio.play().catch(e => console.log('Audio play failed:', e))

      // Auto dismiss side toast after 5 seconds
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, type, onClose])

  const config = {
    error: {
      icon: <AlertTriangle size={22} strokeWidth={2.5} />,
      badgeBg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-200 dark:border-rose-900/50',
      barColor: 'bg-rose-500',
      defaultTitle: 'Attention!',
    },
    success: {
      icon: <CheckCircle2 size={22} strokeWidth={2.5} />,
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-200 dark:border-emerald-900/50',
      barColor: 'bg-emerald-500',
      defaultTitle: 'Success!',
    },
    warning: {
      icon: <AlertTriangle size={22} strokeWidth={2.5} />,
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-200 dark:border-amber-900/50',
      barColor: 'bg-amber-500',
      defaultTitle: 'Warning!',
    },
    info: {
      icon: <Info size={22} strokeWidth={2.5} />,
      badgeBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-900/50',
      barColor: 'bg-blue-500',
      defaultTitle: 'Information',
    }
  }

  const current = config[type]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed top-5 right-5 z-[300] max-w-sm w-full pointer-events-none px-2 sm:px-0">
          <motion.div 
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "pointer-events-auto relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl border flex items-start gap-3.5",
              current.borderColor
            )}
          >
            {/* Accent left line */}
            <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", current.barColor)} />

            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5", current.badgeBg)}>
              {current.icon}
            </div>

            <div className="flex-1 pr-6 pt-0.5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {title || current.defaultTitle}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {message}
              </p>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

