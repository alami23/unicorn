'use client'

import React, { useState, Suspense, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { ArrowUpRight, ArrowDownLeft, Calendar, Tag, CreditCard, MoreHorizontal, Eye, Trash2, Search, Filter, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn, safeParse } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'

function TransactionsPageContent() {
  const [transactionsList, setTransactionsList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewTxn, setViewTxn] = useState<any | null>(null)
  const [deleteTxnId, setDeleteTxnId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchTransactions = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, customer(name)')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        setTransactionsList(data.map(t => ({
          id: t.id,
          date: t.date,
          type: t.type,
          ref: t.ref,
          amount: t.credit > 0 ? t.credit : t.debit,
          method: t.method || 'Other',
          status: 'Completed',
          entity: t.customer?.name || 'Walk-in Customer'
        })))
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  const handleDeleteTransaction = async () => {
    if (!deleteTxnId) return
    setIsDeleting(true)
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', deleteTxnId)
      if (error) throw error
      toast.success('Transaction deleted successfully')
      setTransactionsList((prev) => prev.filter((t) => t.id !== deleteTxnId))
    } catch (error: any) {
      console.error('Error deleting transaction:', error)
      toast.error('Failed to delete transaction')
    } finally {
      setIsDeleting(false)
      setDeleteTxnId(null)
    }
  }

  const filteredTransactions = transactionsList.filter((txn) => {
    const searchString = `${txn.id} ${txn.type} ${txn.ref} ${txn.entity}`.toLowerCase()
    return searchString.includes(searchQuery.toLowerCase())
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Financial Transactions</h1>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300">Export CSV</button>
            <button className="flex-1 md:flex-none px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20">Add Transaction</button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-12rem)] md:h-auto">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search transactions..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"><Filter size={16} /> All Types</button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"><Calendar size={16} /> This Week</button>
            </div>
          </div>
          <div className="overflow-x-auto flex-1 md:flex-none">
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 md:px-6 py-4 font-semibold">Transaction ID</th>
                    <th className="px-4 md:px-6 py-4 font-semibold">Type & Ref</th>
                    <th className="hidden sm:table-cell px-4 md:px-6 py-4 font-semibold">Entity</th>
                    <th className="px-4 md:px-6 py-4 font-semibold text-right sm:text-left">Amount</th>
                    <th className="hidden md:table-cell px-4 md:px-6 py-4 font-semibold">Method</th>
                    <th className="hidden lg:table-cell px-4 md:px-6 py-4 font-semibold">Status</th>
                    <th className="px-4 md:px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{txn.id}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">{txn.date}</span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-2">
                          {['Sale', 'Due Collection', 'Invoice', 'Payment'].includes(txn.type) ? (
                            <ArrowDownLeft size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <ArrowUpRight size={14} className="text-rose-500 dark:text-rose-400 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{txn.type}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{txn.ref}</span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                        <div className="max-w-[120px] md:max-w-[200px] truncate" title={txn.entity}>
                          {txn.entity}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right sm:text-left">
                        <span className={cn(
                          "text-sm font-bold block",
                          ['Sale', 'Due Collection', 'Invoice', 'Payment'].includes(txn.type) ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {['Sale', 'Due Collection', 'Invoice', 'Payment'].includes(txn.type) ? '+' : '-'}৳{txn.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 md:px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <CreditCard size={14} /> {txn.method}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-4 md:px-6 py-4">
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded uppercase">{txn.status}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors">
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl">
                            <DropdownMenuItem className="gap-2 cursor-pointer py-3 md:py-2 text-sm" onClick={() => setViewTxn(txn)}>
                              <Eye size={16} /> View Details
                            </DropdownMenuItem>
                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                            <DropdownMenuItem className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:text-rose-400 dark:focus:bg-rose-900/40 cursor-pointer py-3 md:py-2 text-sm" onClick={() => setDeleteTxnId(txn.id)}>
                              <Trash2 size={16} /> Delete Transaction
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                        {searchQuery ? "No transactions match your search." : "No transactions found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {/* View Transaction Modal */}
        {viewTxn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">Transaction Details</h2>
                <button onClick={() => setViewTxn(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Transaction ID</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{viewTxn.id}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Date</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{viewTxn.date}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Type</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{viewTxn.type}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Reference</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{viewTxn.ref}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Entity</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px] text-right" title={viewTxn.entity}>{viewTxn.entity}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Method</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{viewTxn.method}</span>
                </div>
                <div className="flex justify-between py-4 pt-4 mt-2 bg-slate-50 dark:bg-slate-800/50 px-4 rounded-xl items-center border border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Amount</span>
                  <span className={cn(
                    "text-xl font-black",
                    ['Sale', 'Due Collection', 'Invoice', 'Payment'].includes(viewTxn.type) ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {['Sale', 'Due Collection', 'Invoice', 'Payment'].includes(viewTxn.type) ? '+' : '-'}৳{viewTxn.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button onClick={() => setViewTxn(null)} className="w-full md:w-auto px-8 py-3.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-lg shadow-slate-900/20 dark:shadow-slate-100/20">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTxnId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center"
            >
              <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600 dark:text-rose-400">
                <Trash2 size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Transaction?</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-sm md:text-base">
                Are you sure you want to delete transaction <b>{deleteTxnId}</b>? This action cannot be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-3 md:gap-4">
                <button 
                  onClick={() => setDeleteTxnId(null)}
                  className="flex-1 py-3.5 md:py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm md:text-base"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteTransaction}
                  disabled={isDeleting}
                  className="flex-1 py-3.5 md:py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  {isDeleting ? (
                    <span className="flex items-center gap-2">
                       <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                       Deleting...
                    </span>
                  ) : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <TransactionsPageContent />
    </Suspense>
  )
}

