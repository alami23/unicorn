'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Send,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Calendar,
  FileText
} from 'lucide-react'
import { toast } from 'sonner'
import { sendSMS } from '@/lib/sms'

interface ShareInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: any
  shareUrl: string
  shareCode: string
  defaultPhone?: string
  businessName?: string
}

export default function ShareInvoiceModal({
  isOpen,
  onClose,
  invoice,
  shareUrl,
  shareCode,
  defaultPhone = '',
  businessName = 'Store'
}: ShareInvoiceModalProps) {
  const [copied, setCopied] = useState(false)
  const [phone, setPhone] = useState(defaultPhone)
  const [isSendingSMS, setIsSendingSMS] = useState(false)
  const [smsSent, setSmsSent] = useState(false)

  // Update phone when defaultPhone changes
  React.useEffect(() => {
    if (defaultPhone) setPhone(defaultPhone)
  }, [defaultPhone])

  if (!isOpen || !invoice) return null

  const invoiceNumber = invoice.displayId || invoice.id || 'INV'
  const customerName = invoice.customer || invoice.customer_name || 'Customer'
  const totalAmount = Math.round(invoice.amount || invoice.total || 0).toLocaleString()
  const dueAmount = Math.round(invoice.due || invoice.due_amount || 0).toLocaleString()

  const defaultMessage = `Dear ${customerName}, here is your Invoice ${invoiceNumber} from ${businessName}. Total: ৳${totalAmount}, Due: ৳${dueAmount}. View & Download PDF: ${shareUrl}`

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      toast.success('Unique invoice URL copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      toast.error('Failed to copy link to clipboard')
    }
  }

  const handleSendSMS = async () => {
    const targetPhone = phone.trim()
    if (!targetPhone) {
      toast.error('Please enter a recipient phone number')
      return
    }

    setIsSendingSMS(true)
    try {
      await sendSMS(targetPhone, defaultMessage)
      setSmsSent(true)
      toast.success('Invoice shared via SMS successfully!')
    } catch (error) {
      console.error('Failed to send SMS:', error)
      toast.error('Failed to send SMS. Please verify your SMS configuration.')
    } finally {
      setIsSendingSMS(false)
    }
  }

  const handleWhatsAppShare = () => {
    const encodedText = encodeURIComponent(defaultMessage)
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone.startsWith('88') ? cleanPhone : '88' + cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`
    window.open(waUrl, '_blank')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Send size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Send & Share Invoice
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Public link with PDF view & download access
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
            {/* Invoice Meta Badges */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                <FileText size={14} className="text-blue-500" />
                <span>{invoiceNumber}</span>
              </div>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Calendar size={14} className="text-slate-400" />
                <span>{invoice.date || 'Today'}</span>
              </div>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck size={14} />
                <span>Code: <code className="font-mono bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded text-[11px] font-bold">{shareCode}</code></span>
              </div>
            </div>

            {/* Generated Unique Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Unique Shareable URL</span>
                <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> Saved in database record
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 truncate select-all">
                  {shareUrl}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                >
                  {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-colors shrink-0"
                  title="Open in new tab"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Customers can open this link on mobile or desktop to view and download the invoice PDF without logging in.
              </p>
            </div>

            {/* SMS Sharing Section */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Smartphone size={15} className="text-blue-500" />
                  <span>Send via SMS to Customer</span>
                </div>
                {smsSent && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check size={12} /> Sent
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 01700000000"
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendSMS}
                  disabled={isSendingSMS || !phone.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                >
                  {isSendingSMS ? (
                    <span className="animate-spin text-white">⏳</span>
                  ) : (
                    <Send size={13} />
                  )}
                  <span>{isSendingSMS ? 'Sending...' : 'Send SMS'}</span>
                </button>
              </div>

              {/* Message Preview */}
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Message Preview: </span>
                {defaultMessage}
              </div>
            </div>

            {/* Quick WhatsApp Action */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Or share directly on WhatsApp:
              </span>
              <button
                onClick={handleWhatsAppShare}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-200/60 dark:border-emerald-800/40"
              >
                <MessageSquare size={13} />
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
