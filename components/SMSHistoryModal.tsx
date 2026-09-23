'use client'

import React, { useState, useEffect } from 'react'
import { X, History, Clock, CheckCircle2, AlertCircle, Search } from 'lucide-react'
import { cn, safeParse } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface SMSHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  customerName: string
  customerPhone: string
}

export default function SMSHistoryModal({ isOpen, onClose, customerName, customerPhone }: SMSHistoryModalProps) {
  const [history, setHistory] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('sms_history')
          .select('*')
          .eq('phone', customerPhone)
          .order('date', { ascending: false })
        
        if (error) throw error
        if (data) {
          setHistory(data.map(item => ({
            id: item.id,
            phone: item.phone,
            message: item.message,
            date: new Date(item.date).toLocaleString(),
            status: item.status
          })))
        }
      } catch (err) {
        console.error('Error fetching SMS history:', err)
      }
    }

    if (isOpen) {
      fetchHistory()
    }
  }, [isOpen, customerPhone])

  if (!isOpen) return null

  const filteredHistory = history.filter(item => {
    // Match by phone number
    const matchesPhone = item.phone === customerPhone || item.recipient === customerPhone
    // Match by search query (message content)
    const matchesSearch = item.message.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesPhone && matchesSearch
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">SMS History</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{customerName} ({customerPhone})</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search in messages..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((sms, index) => (
              <div key={`${sms.id}-${index}`} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                    <Clock size={10} /> {sms.date}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {sms.status === 'Delivered' ? (
                      <CheckCircle2 size={12} className="text-emerald-500" />
                    ) : (
                      <AlertCircle size={12} className="text-rose-500" />
                    )}
                    <span className={cn(
                      "text-[10px] font-bold uppercase",
                      sms.status === 'Delivered' ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {sms.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{sms.message}</p>
              </div>
            ))
          ) : (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <History size={32} className="text-slate-200 dark:text-slate-700" />
              </div>
              <h4 className="text-slate-900 dark:text-slate-100 font-bold mb-1">No Messages Found</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">No SMS history available for this customer.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
