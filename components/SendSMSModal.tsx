'use client'

import React, { useState, useEffect } from 'react'
import { X, Send, MessageSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import { sendSMS } from '@/lib/sms'
import AlertPopup from './AlertPopup'

interface SendSMSModalProps {
  isOpen: boolean
  onClose: () => void
  customerName: string
  customerPhone: string
  initialMessage?: string
}

const templates = [
  { title: 'Order Confirmation', text: 'Dear [Name], your order has been confirmed. Thank you for choosing FurniTrack!' },
  { title: 'Delivery Update', text: 'Hi [Name], your furniture is out for delivery and will reach you soon.' },
  { title: 'Payment Reminder', text: 'Dear [Name], this is a friendly reminder for your outstanding due.' },
  { title: 'Promotional', text: 'Special Offer! Get 15% off on all Dining Sets this weekend at FurniTrack.' },
]

export default function SendSMSModal({ isOpen, onClose, customerName, customerPhone, initialMessage }: SendSMSModalProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'info'
  })

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertConfig({ isOpen: true, message, type })
  }

  useEffect(() => {
    if (isOpen) {
      setMessage(initialMessage || '')
      setStatus('idle')
      setIsSending(false)
    }
  }, [isOpen, initialMessage])

  const handleSend = async () => {
    if (!message.trim()) return

    setIsSending(true)
    try {
      await sendSMS(customerPhone, message)
      
      setIsSending(false)
      setStatus('success')
      
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      console.error('Failed to send SMS:', error)
      setIsSending(false)
    }
  }

  const applyTemplate = (text: string) => {
    const personalized = text.replace('[Name]', customerName)
    setMessage(personalized)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Send SMS</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">To: {customerName} ({customerPhone})</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {status === 'success' ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 flex flex-col items-center text-center space-y-4"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Message Sent!</h3>
                    <p className="text-slate-500 dark:text-slate-400">Your SMS has been delivered successfully.</p>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Quick Templates</label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {templates.map((temp) => (
                          <button 
                            key={temp.title}
                            onClick={() => applyTemplate(temp.text)}
                            className="text-left p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all group"
                          >
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-700 dark:group-hover:text-amber-400">{temp.title}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Message Content</label>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          message.length > 160 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
                        )}>
                          {message.length} / 160
                        </span>
                      </div>
                      <textarea 
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your message here..."
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm focus:ring-2 focus:ring-amber-500/20 transition-all resize-none dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={onClose}
                      className="flex-1 py-3.5 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={!message.trim() || isSending}
                      onClick={handleSend}
                      className="flex-[2] py-3.5 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={18} /> Send SMS Now
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <AlertPopup 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </AnimatePresence>
  )
}
