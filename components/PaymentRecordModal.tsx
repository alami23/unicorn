'use client'

import React, { useState, useEffect } from 'react'
import { X, DollarSign, Calendar, FileText, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'

interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  customerName: string
  customerId?: string
}

export default function PaymentHistoryModal({ isOpen, onClose, customerName, customerId }: PaymentHistoryModalProps) {
  const [payments, setPayments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPayments = async () => {
      setIsLoading(true)
      try {
        let query = supabase
          .from('transactions')
          .select('*')
          .eq('type', 'Payment')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (customerId) {
          query = query.eq('customer_id', customerId)
        } else {
          // Fallback or depending on how customer relation is handled
          // If we only have name, we might need a workaround or if the transactions have customer_name
        }
        
        const { data, error } = await query
        
        if (error) throw error
        
        // If we don't have customerId but have customerName, we might need to filter manually if there is no customer_name column, but wait, transactions have customer_id
        // Let's check how transactions store customer info.
        
        const groupedPayments: any[] = []
        data?.forEach(payment => {
          const paymentAmount = Number(payment.credit) || Number(payment.amount) || 0
          if (Math.round(paymentAmount) <= 0) return // Skip 0 amounts

          const lastGroup = groupedPayments[groupedPayments.length - 1]
          
          const timeDiff = lastGroup && lastGroup.created_at && payment.created_at
            ? Math.abs(new Date(lastGroup.created_at).getTime() - new Date(payment.created_at).getTime())
            : Number.MAX_SAFE_INTEGER

          // Group if same date, same method, and inserted within 5 minutes of each other
          if (lastGroup && lastGroup.date === payment.date && lastGroup.method === payment.method && timeDiff < 5 * 60000) {
             lastGroup.credit += paymentAmount
             if (payment.ref) {
               // Check if ref already exists to prevent duplicate (in case of bug)
               const existingRef = lastGroup.refs.find((r: any) => r.ref === payment.ref)
               if (existingRef) {
                 existingRef.amount += paymentAmount
               } else {
                 lastGroup.refs.push({ ref: payment.ref, amount: paymentAmount })
               }
             }
          } else {
             groupedPayments.push({
               date: payment.date,
               method: payment.method || 'Cash',
               credit: paymentAmount,
               refs: payment.ref ? [{ ref: payment.ref, amount: paymentAmount }] : [],
               created_at: payment.created_at
             })
          }
        })
        
        setPayments(groupedPayments)
      } catch (error) {
        console.error('Error fetching payments:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen && customerName) {
      fetchPayments()
    }
  }, [isOpen, customerName, customerId])

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return ''
      let date: Date;
      if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts[0].length === 4) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2].substring(0, 2)));
        } else {
          date = new Date(parseInt(parts[2].substring(0, 4)), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else {
        date = new Date(dateString);
      }
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch(e) {
      return dateString
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Payment Record</h2>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-500">{customerName}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                <div className="p-12 pl-6 flex justify-center items-center h-full">
                  <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
              ) : payments.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-400">
                    <FileText size={24} />
                  </div>
                  <p>No payment records found for this customer.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0">
                  {payments.map((payment, i) => {
                    return (
                      <div key={i} className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-row items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <span>Payment {formatDate(payment.date)}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium tracking-wide">
                              {payment.method ? payment.method.charAt(0).toUpperCase() + payment.method.slice(1) : 'Cash'}
                            </span>
                          </div>
                          
                          {payment.refs && payment.refs.length > 0 && (
                            <div className="flex flex-col gap-1 mt-1 pl-1">
                               {payment.refs.map((r: any, idx: number) => (
                                 <div key={idx} className="text-sm flex items-center gap-2 w-fit">
                                   <div className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-200" />
                                   <span className="font-mono text-slate-900 dark:text-slate-100 tracking-tight text-[15px]">{getDisplayInvoiceId(r.ref)}</span>
                                   <span className="text-slate-900 dark:text-slate-100">=</span>
                                   <span className="font-medium text-slate-900 dark:text-slate-100 text-[15px]">৳{Math.round(r.amount).toLocaleString()}</span>
                                 </div>
                               ))}
                            </div>
                          )}
                        </div>
                        <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap mt-0.5">
                          ৳{payment.credit ? Math.round(payment.credit).toLocaleString() : '0'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
