'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Send,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Calendar,
  FileText,
  Smartphone,
  CheckCircle2,
  Share2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SendInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: any
  previewUrl: string
  verificationCode: string
  onSendSms?: (phone: string, message: string) => Promise<boolean>
}

export default function SendInvoiceModal({
  isOpen,
  onClose,
  invoice,
  previewUrl,
  verificationCode,
  onSendSms
}: SendInvoiceModalProps) {
  const [copied, setCopied] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)
  const [recipientPhone, setRecipientPhone] = useState(invoice?.customerPhone || '')
  
  const customerName = invoice?.customer || 'Valued Customer'
  const invNumber = invoice?.displayId || invoice?.invoice_number || invoice?.id || 'Invoice'
  const totalAmount = invoice?.amount ? Math.round(invoice.amount).toLocaleString() : '0'
  const dueAmount = invoice?.due !== undefined ? Math.round(invoice.due).toLocaleString() : '0'

  const defaultMessage = `Dear ${customerName}, here is your Invoice ${invNumber}. Bill: ৳${totalAmount}, Due: ৳${dueAmount}. View and download your official invoice PDF online: ${previewUrl}`
  const [smsMessage, setSmsMessage] = useState(defaultMessage)

  // Copy unique URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      toast.success('Unique invoice preview link copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      toast.error('Failed to copy link.')
    }
  }

  // Copy full SMS text
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(smsMessage)
      toast.success('Invoice message copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy message.')
    }
  }

  // Open Preview in new tab
  const handleOpenPreview = () => {
    if (typeof window !== 'undefined') {
      window.open(previewUrl, '_blank', 'noopener,noreferrer')
    }
  }

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '')
    const encodedText = encodeURIComponent(smsMessage)
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone.startsWith('88') ? cleanPhone : '88' + cleanPhone}?text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  // Send via SMS
  const handleSendViaSms = async () => {
    if (!recipientPhone.trim()) {
      toast.error('Please enter a valid recipient phone number.')
      return
    }

    if (!onSendSms) {
      toast.error('SMS sending service is not available.')
      return
    }

    setSendingSms(true)
    try {
      const success = await onSendSms(recipientPhone.trim(), smsMessage)
      if (success) {
        toast.success(`Invoice link successfully sent to ${recipientPhone}`)
        onClose()
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to send SMS.')
    } finally {
      setSendingSms(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden my-8 z-10"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Send Invoice
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share auto-validating invoice preview link with customer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Metadata Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Invoice Number</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                {invNumber}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Invoice Date</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                {invoice?.date || 'N/A'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-400 block">8-Char Code</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                {verificationCode}
              </span>
            </div>
          </div>

          {/* Generated Unique URL Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Unique Auto-Validating URL</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Includes Domain, Date, Number & Code
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  readOnly
                  value={previewUrl}
                  className="w-full pl-3 pr-3 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 select-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 truncate"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className={cn(
                  "px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95 cursor-pointer",
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                )}
                title="Copy Unique URL"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleOpenPreview}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                title="Test / Open Preview in New Tab"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              When opened, the preview page automatically populates all parameters and validates the invoice PDF without manual entry.
            </p>
          </div>

          {/* Recipient Phone & SMS Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Customer Phone Number</span>
                <span className="text-[11px] text-slate-400">Recipient Mobile</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>SMS / Share Message</span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                >
                  Copy Message
                </button>
              </label>
              <textarea
                rows={3}
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none font-medium leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleOpenPreview}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Preview</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
            {onSendSms && (
              <button
                type="button"
                onClick={handleSendViaSms}
                disabled={sendingSms}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {sendingSms ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Sending SMS...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send SMS</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
