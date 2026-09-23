'use client'

import React, { useState, useEffect, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Send, MessageSquare, Users, History, Search, Clock, CheckCircle2, AlertCircle, Filter, X, ChevronDown, Wallet } from 'lucide-react'
import { cn, safeParse } from '@/lib/utils'
import { sendSMS } from '@/lib/sms'
import { supabase } from '@/lib/supabase'
import AlertPopup from '@/components/AlertPopup'
import { useSearchParams } from 'next/navigation'

const initialSmsHistory = [
  { id: 1, recipient: 'Alice Johnson', phone: '8801711223344', message: 'Your order #INV-2024-001 has been delivered. Thank you!', date: '2024-03-20 14:30', status: 'Delivered' },
  { id: 2, recipient: 'Bob Smith', phone: '8801811223344', message: 'Reminder: Your payment of ৳7,500 is due. Please pay soon.', date: '2024-03-19 10:15', status: 'Delivered' },
  { id: 3, recipient: 'Charlie Brown', phone: '8801911223344', message: 'New Stock Alert! Premium Segun Wood beds now available.', date: '2024-03-18 16:45', status: 'Failed' },
]

const templates = [
  { title: 'Order Confirmation', text: 'Dear [Name], your order [ID] has been confirmed. Thank you for choosing FurniTrack!' },
  { title: 'Delivery Update', text: 'Hi [Name], your furniture [ID] is out for delivery and will reach you by [Time].' },
  { title: 'Payment Reminder', text: 'Dear [Name], this is a friendly reminder for your outstanding due of [Amount].' },
  { title: 'Promotional', text: 'Special Offer! Get 15% off on all Dining Sets this weekend at FurniTrack.' },
]

export default function SMSPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SMSPageContent />
    </Suspense>
  )
}

function SMSPageContent() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams?.get('search') || ''

  const [message, setMessage] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [balance, setBalance] = useState<string>('0.00')
  const [history, setHistory] = useState<any[]>([])
  const [historySearch, setHistorySearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState('All')
  const [customers, setCustomers] = useState<any[]>([])
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false)
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false)
  const [historyCustomerSearch, setHistoryCustomerSearch] = useState('')
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean, message: string, type: 'success' | 'error' | 'warning' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'info'
  })

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertConfig({ isOpen: true, message, type })
  }

  const fetchBalance = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .single();
      
      const apiKey = data?.settings?.integrations?.smsApiKey || '';
      if (!apiKey) return;

      const response = await fetch(`/api/sms-balance?apiKey=${encodeURIComponent(apiKey)}`);
      if (!response.ok) return;
      const balanceData = await response.json();
      if (balanceData?.balance !== undefined && balanceData?.balance !== null) {
        setBalance(String(balanceData.balance));
      }
    } catch (error) {
      console.warn('Could not fetch SMS balance:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_history')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      if (data) {
        setHistory(data.map(item => ({
          id: item.id,
          recipient: item.phone, // We don't have recipient_name in schema, using phone as fallback
          phone: item.phone,
          message: item.message,
          date: new Date(item.date).toLocaleString(),
          status: item.status
        })));
      }
    } catch (error: any) {
      console.error('Error fetching SMS history:', error.message || error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customer').select('*').order('name');
      if (data) setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchHistory();
    fetchCustomers();
    
    window.addEventListener('sms_history_updated', fetchHistory)
    return () => window.removeEventListener('sms_history_updated', fetchHistory)
  }, [])

  const handleSend = async () => {
    if (!message.trim() || !recipientPhone.trim()) {
      showAlert('Please enter both recipient phone and message', 'warning')
      return
    }
    
    setIsSending(true)
    try {
      await sendSMS(recipientPhone, message)
      
      setMessage('')
      setRecipientPhone('')
      fetchBalance()
    } catch (error: any) {
      console.error('Failed to send SMS:', error)
    } finally {
      setIsSending(false)
    }
  }

  const filteredHistory = history.filter(item => {
    const searchLower = historySearch.toLowerCase()
    const matchesSearch = 
      item.recipient.toLowerCase().includes(searchLower) ||
      (item.phone && item.phone.toLowerCase().includes(searchLower)) ||
      item.message.toLowerCase().includes(searchLower)
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(historyCustomerSearch.toLowerCase()) ||
    c.phone.includes(historyCustomerSearch)
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">SMS</h1>
          </div>
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Wallet size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">Balance: </span>৳{balance}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Send SMS Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2"><Send size={20} className="text-amber-600" /> Send New Message</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recipient Type</label>
                    <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100">
                      <option>Single Customer</option>
                      <option>All Customers</option>
                      <option>Due Customers Only</option>
                      <option>Staff Members</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recipient Phone</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Enter phone number (e.g. 88017...)" 
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Message Content</label>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{message.length} / 160 characters</span>
                  </div>
                  <textarea 
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none text-sm focus:ring-2 focus:ring-amber-500/20 transition-all resize-none dark:text-slate-100"
                  />
                </div>
                <button 
                  onClick={handleSend}
                  disabled={isSending}
                  className="w-full py-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSending ? 'Sending...' : (
                    <>
                      <Send size={18} /> Send Message Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Templates & History */}
          <div className="space-y-6">
            {/* Quick Templates Dropdown */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <MessageSquare size={20} className="text-slate-400" /> Quick Templates
              </h3>
              
              <div className="relative">
                <button 
                  onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all"
                >
                  <span>Select a template...</span>
                  <ChevronDown size={18} className={cn("transition-transform", isTemplateDropdownOpen && "rotate-180")} />
                </button>

                {isTemplateDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsTemplateDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-20 overflow-hidden">
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {templates.map((temp) => (
                          <button 
                            key={temp.title}
                            onClick={() => {
                              setMessage(temp.text)
                              setIsTemplateDropdownOpen(false)
                            }}
                            className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 last:border-none transition-all group"
                          >
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600">{temp.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">{temp.text}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button className="w-full mt-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                + Create New Template
              </button>
            </div>

            {/* SMS History (Moved to right side) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <History size={18} className="text-slate-400" /> SMS History
                    </h3>
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-[10px] font-bold dark:text-slate-100"
                    >
                      <option value="All">All</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    {/* Customer Selector for History */}
                    <div className="relative">
                      <div 
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                        onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
                      >
                        <Users size={14} className="text-slate-400" />
                        <span className="flex-1 text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          {historySearch ? `Customer: ${historySearch}` : 'Select Customer...'}
                        </span>
                        <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isHistoryDropdownOpen && "rotate-180")} />
                      </div>

                      {isHistoryDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsHistoryDropdownOpen(false)} />
                          <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-20 overflow-hidden">
                            <div className="p-2 border-b border-slate-50 dark:border-slate-800">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input 
                                  type="text" 
                                  placeholder="Search customer..." 
                                  className="w-full pl-8 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border-none outline-none text-[10px] rounded-lg dark:text-slate-100"
                                  value={historyCustomerSearch}
                                  onChange={(e) => setHistoryCustomerSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                              <button 
                                onClick={() => {
                                  setHistorySearch('')
                                  setIsHistoryDropdownOpen(false)
                                }}
                                className="w-full px-3 py-2 text-left text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 border-b border-slate-50 dark:border-slate-800"
                              >
                                Clear Selection / Show All
                              </button>
                              {filteredCustomers.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => {
                                    setHistorySearch(c.phone)
                                    setIsHistoryDropdownOpen(false)
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 last:border-none group transition-colors"
                                >
                                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors">{c.name}</p>
                                  <p className="text-[9px] text-slate-500">{c.phone}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* General Search for History */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="text" 
                        placeholder="Search messages..." 
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-[11px] dark:text-slate-100"
                      />
                      {historySearch && (
                        <button 
                          onClick={() => setHistorySearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto custom-scrollbar mt-4">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((sms, index) => (
                      <div key={`${sms.id}-${index}`} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{sms.recipient}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1"><Clock size={10} /> {sms.date}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">{sms.message}</p>
                        <div className="flex items-center gap-1.5">
                          {sms.status === 'Delivered' ? (
                            <CheckCircle2 size={10} className="text-emerald-500" />
                          ) : (
                            <AlertCircle size={10} className="text-rose-500" />
                          )}
                          <span className={cn(
                            "text-[9px] font-bold uppercase",
                            sms.status === 'Delivered' ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {sms.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <History size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">No history found.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <AlertPopup 
          isOpen={alertConfig.isOpen}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
          message={alertConfig.message}
          type={alertConfig.type}
        />
      </div>
    </DashboardLayout>
  )
}
