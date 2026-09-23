'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Search, Undo2, AlertCircle, Check, ChevronRight, Minus, Plus } from 'lucide-react'
import { cn, safeParse } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getDisplayInvoiceId } from '@/lib/invoice'

interface ProcessReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ProcessReturnModal({ isOpen, onClose, onSuccess }: ProcessReturnModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [returnItems, setReturnItems] = useState<any[]>([])
  const [reason, setReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchInvoices()
      setSelectedInvoice(null)
      setReturnItems([])
      setReason('')
      setSearchTerm('')
    }
  }, [isOpen])

  const fetchInvoices = async () => {
    try {
      const [furnRes, woodRes] = await Promise.all([
        supabase
          .from('furniture_invoices')
          .select('*, items:furniture_invoice_items(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('wood_invoices')
          .select('*, items:wood_invoice_items(*)')
          .order('created_at', { ascending: false })
      ])

      if (furnRes.error) throw furnRes.error
      if (woodRes.error) throw woodRes.error

      const combined = [...(furnRes.data || []), ...(woodRes.data || [])].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setInvoices(combined.map(inv => ({
        id: inv.id,
        customer: inv.customer_name,
        date: inv.created_at.split('T')[0],
        due: Number(inv.due_amount),
        items: inv.items || []
      })))
    } catch (error) {
      console.error('Error fetching invoices:', error)
    }
  }

  const filteredInvoices = invoices.filter(inv => 
    inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5)

  const handleSelectInvoice = (inv: any) => {
    setSelectedInvoice(inv)
    setReturnItems(inv.items.map((item: any) => ({ 
      ...item, 
      returnQty: 0,
      price: Number(item.price),
      quantity: Number(item.quantity)
    })))
    setSearchTerm('')
  }

  const updateReturnQty = (index: number, delta: number) => {
    const newItems = [...returnItems]
    const item = newItems[index]
    const maxQty = item.quantity || 1
    item.returnQty = Math.max(0, Math.min(maxQty, item.returnQty + delta))
    setReturnItems(newItems)
  }

  const totalRefund = returnItems.reduce((acc, item) => acc + (item.returnQty * (item.price || item.rate || 0)), 0)

  const handleSubmit = async () => {
    if (!selectedInvoice || returnItems.every(item => item.returnQty === 0) || !reason) return

    setIsProcessing(true)

    try {
      const returnData = {
        id: `RET-${Date.now().toString().slice(-6)}`,
        invoice_id: selectedInvoice.id,
        customer_name: selectedInvoice.customer,
        date: new Date().toISOString().split('T')[0],
        amount: totalRefund,
        reason,
        status: 'Approved',
        items: returnItems.filter(item => item.returnQty > 0)
      }

      // Since invoice_returns table is removed, we process the balance update directly
      // Update customer balance if it was a credit sale
      if (selectedInvoice.due > 0) {
        const { data: customer } = await supabase
          .from('customer')
          .select('total_due')
          .eq('name', selectedInvoice.customer)
          .single()
        
        if (customer) {
          await supabase
            .from('customer')
            .update({ total_due: Math.max(0, Number(customer.total_due) - totalRefund) })
            .eq('name', selectedInvoice.customer)
        }
      }

      toast.success('Return processed successfully')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error processing return:', error)
      toast.error('Failed to process return: ' + error.message)
    } finally {
      setIsProcessing(false)
    }
  }

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
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">Process Invoice Return</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Select an invoice and items to return.</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {!selectedInvoice ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search by Invoice ID or Customer Name..." 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {searchTerm && filteredInvoices.map(inv => (
                      <button
                        key={inv.id}
                        onClick={() => handleSelectInvoice(inv)}
                        className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-rose-200 dark:hover:border-rose-900/30 hover:bg-rose-50/30 dark:hover:bg-rose-900/5 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-rose-500 transition-colors">
                            <Undo2 size={20} />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{getDisplayInvoiceId(inv.id)}</p>
                            <p className="text-xs text-slate-500">{inv.customer} • {inv.date}</p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
                      </button>
                    ))}
                    {searchTerm && filteredInvoices.length === 0 && (
                      <div className="text-center py-8 text-slate-400 italic">No invoices found matching &quot;{searchTerm}&quot;</div>
                    )}
                    {!searchTerm && (
                      <div className="text-center py-12 text-slate-400">
                        <AlertCircle size={40} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Enter an invoice ID or customer name to begin.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white">
                        <Undo2 size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Selected Invoice</p>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{getDisplayInvoiceId(selectedInvoice.id)} • {selectedInvoice.customer}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedInvoice(null)}
                      className="text-xs font-bold text-rose-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 px-1">Select Items to Return</h3>
                    <div className="space-y-2">
                      {returnItems.map((item, idx) => (
                        <div key={`return-item-${item.id || idx}-${idx}`} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{item.name || (item.treeNo ? `Tree: ${item.treeNo}` : 'Item')}</p>
                            <p className="text-xs text-slate-500">Price: ৳{(item.price || item.rate || 0).toLocaleString()} • Max Qty: {item.quantity || 1}</p>
                          </div>
                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700">
                            <button 
                              onClick={() => updateReturnQty(idx, -1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-8 text-center font-bold text-sm dark:text-slate-100">{item.returnQty}</span>
                            <button 
                              onClick={() => updateReturnQty(idx, 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 px-1">Reason for Return</h3>
                    <textarea 
                      placeholder="Explain why the items are being returned..."
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-all min-h-[100px] text-sm"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Total Refund</p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">৳{totalRefund.toLocaleString()}</p>
              </div>
              <button
                disabled={!selectedInvoice || returnItems.every(item => item.returnQty === 0) || !reason || isProcessing}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 disabled:shadow-none"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                {isProcessing ? 'Processing...' : 'Confirm Return'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
