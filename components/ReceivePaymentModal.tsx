'use client'

import React, { useState, useEffect } from 'react'
import { X, DollarSign, Calendar, CreditCard, User, AlertCircle, CheckCircle2, Hash, FileText, Camera, Upload, Wallet, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import { getDisplayInvoiceId } from '@/lib/invoice'
import { toast } from 'sonner'

interface ReceivePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  customerName: string
  customerPhone: string
  totalDue: number
  invoiceId?: string
  onPaymentReceived?: (payment: { amount: number, method: string, date: string, notes: string }) => void
}

export default function ReceivePaymentModal({ isOpen, onClose, customerName, customerPhone, totalDue, invoiceId, onPaymentReceived }: ReceivePaymentModalProps) {
  const [amount, setAmount] = useState<string>('')
  const [method, setMethod] = useState('Cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const currentDue = Number(totalDue) || 0
  const isZeroOrNegativeDue = currentDue <= 0
  const numAmount = parseFloat(amount) || 0
  const isOverpayment = numAmount > currentDue

  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setMethod('Cash')
      setDate(new Date().toISOString().split('T')[0])
      setNotes('')
      setIsSubmitting(false)
      setIsSuccess(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isZeroOrNegativeDue) {
      toast.error('Current Due is zero or less. Payment cannot be received.')
      return
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid payment amount greater than zero.')
      return
    }

    if (parsedAmount > currentDue) {
      toast.error(`Payment amount (৳${parsedAmount.toLocaleString()}) cannot exceed the Current Due of ৳${currentDue.toLocaleString()}. Overpayments are blocked.`)
      return
    }

    setIsSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800))
    
    setIsSubmitting(false)
    setIsSuccess(true)
    
    if (onPaymentReceived) {
      onPaymentReceived({
        amount: parsedAmount,
        method,
        date,
        notes
      })
    }

    setTimeout(() => {
      onClose()
    }, 1200)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isZeroOrNegativeDue 
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400" 
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
                )}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Receive Payment</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Record customer payment against outstanding balance</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {isSuccess ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                    <CheckCircle2 size={40} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Payment Recorded!</h3>
                    <p className="text-slate-500 dark:text-slate-400">The payment of ৳{numAmount.toLocaleString()} has been successfully recorded.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Zero / Negative Due Warning Banner */}
                  {isZeroOrNegativeDue && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-200">
                      <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-sm text-amber-900 dark:text-amber-100">No Outstanding Due</p>
                        <p>The Current Due for this {invoiceId ? 'invoice' : 'customer'} is zero (৳0). Payment submission is disabled to prevent accidental overpayment.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {invoiceId && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Hash size={10} /> Invoice ID
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{getDisplayInvoiceId(invoiceId)}</p>
                      </div>
                    )}
                    <div className={cn(
                      "p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1",
                      !invoiceId && "col-span-2"
                    )}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        Current Due
                      </p>
                      {isZeroOrNegativeDue ? (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <span className="text-base">৳</span>0
                          </p>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Zero Due
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-rose-500 flex items-center gap-1">
                          <span className="text-lg">৳</span>{currentDue.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <User size={14} className="text-slate-400" /> Customer
                    </label>
                    <input 
                      type="text" 
                      readOnly
                      value={customerName}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm font-medium text-slate-600 dark:text-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" /> Payment Date
                      </label>
                      <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Wallet size={14} className="text-slate-400" /> Method
                      </label>
                      <select 
                        value={method}
                        onChange={(e) => setMethod(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none"
                      >
                        <option value="Cash">Cash</option>
                        <option value="bKash">bKash</option>
                        <option value="Nagad">Nagad</option>
                        <option value="Bank">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <DollarSign size={14} className="text-slate-400" /> Payment Amount
                      </label>
                      {!isZeroOrNegativeDue && (
                        <span className="text-[11px] font-semibold text-slate-400">
                          Max allowable: <strong className="text-slate-700 dark:text-slate-200">৳{currentDue.toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                    <div className="relative group">
                      <div className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg",
                        isOverpayment 
                          ? "text-rose-600 dark:text-rose-400" 
                          : (isZeroOrNegativeDue ? "text-slate-400" : "text-emerald-600 dark:text-emerald-400")
                      )}>৳</div>
                      <input 
                        type="number" 
                        required
                        disabled={isZeroOrNegativeDue}
                        min="0.01"
                        max={Math.max(0, currentDue)}
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        ref={(el) => {
                          if (el) {
                            el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false })
                          }
                        }}
                        placeholder={isZeroOrNegativeDue ? "0.00 (No due remaining)" : "0.00"}
                        className={cn(
                          "w-full pl-10 pr-24 py-4 rounded-2xl outline-none text-xl font-bold transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          isZeroOrNegativeDue
                            ? "bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
                            : (isOverpayment
                                ? "bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-500 dark:border-rose-600 text-rose-600 dark:text-rose-400 focus:ring-4 focus:ring-rose-500/10"
                                : "bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 focus:ring-4 focus:ring-emerald-500/10")
                        )}
                      />
                      <button 
                        type="button"
                        disabled={isZeroOrNegativeDue}
                        onClick={() => {
                          if (currentDue > 0) {
                            setAmount(currentDue.toString())
                          }
                        }}
                        className={cn(
                          "absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all",
                          isZeroOrNegativeDue
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        )}
                      >
                        Full Due
                      </button>
                    </div>

                    {/* Overpayment Error Banner */}
                    {isOverpayment && (
                      <div className="flex items-center gap-1.5 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>Payment cannot exceed Current Due of <strong>৳{currentDue.toLocaleString()}</strong> (Overpayment of ৳{(numAmount - currentDue).toLocaleString()} blocked).</span>
                      </div>
                    )}

                    {/* Remaining Due Preview */}
                    {!isZeroOrNegativeDue && numAmount > 0 && !isOverpayment && (
                      <div className="flex justify-between items-center text-xs px-1 text-slate-500 dark:text-slate-400">
                        <span>Remaining due after payment:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ৳{Math.max(0, currentDue - numAmount).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <FileText size={14} className="text-slate-400" /> Notes
                    </label>
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add payment notes here..."
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all min-h-[100px] resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Camera size={14} className="text-slate-400" /> Payment Proof / Receipt
                    </label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-all cursor-pointer group">
                      <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:scale-110 transition-all">
                        <Upload size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">Click to upload receipt photo</p>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={isZeroOrNegativeDue || !amount || numAmount <= 0 || isOverpayment || isSubmitting}
                      className={cn(
                        "w-full py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                        isZeroOrNegativeDue
                          ? "bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-none"
                          : (isOverpayment
                              ? "bg-rose-500 text-white shadow-rose-500/20"
                              : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20")
                      )}
                    >
                      {isSubmitting ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : isZeroOrNegativeDue ? (
                        <>
                          <Ban size={20} /> Current Due is Zero (Payment Blocked)
                        </>
                      ) : isOverpayment ? (
                        <>
                          <AlertCircle size={20} /> Overpayment Blocked (Max ৳{currentDue.toLocaleString()})
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={20} /> Confirm Payment {numAmount > 0 ? `(৳${numAmount.toLocaleString()})` : ''}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

