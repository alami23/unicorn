'use client'

import React, { useState, useMemo } from 'react'
import { X, Search, Building2, Phone, Mail, MapPin, Edit2, Trash2, Plus, ArrowRight, User } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { Vendor } from '@/components/SaveVendorModal'

interface Bill {
  id: string
  vendor: string
  category: string
  amount: number
  date: string
  status: 'Paid' | 'Pending'
  note: string
}

interface VendorsListModalProps {
  isOpen: boolean
  onClose: () => void
  vendors: Vendor[]
  bills: Bill[]
  onAddVendor: () => void
  onEditVendor: (vendor: Vendor) => void
  onDeleteVendor: (vendor: Vendor) => void
  onBillVendor: (vendorName: string) => void
}

export default function VendorsListModal({
  isOpen,
  onClose,
  vendors,
  bills,
  onAddVendor,
  onEditVendor,
  onDeleteVendor,
  onBillVendor
}: VendorsListModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredVendors = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return vendors
    return vendors.filter(v => 
      v.name.toLowerCase().includes(q) ||
      (v.phone && v.phone.toLowerCase().includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q)) ||
      (v.address && v.address.toLowerCase().includes(q))
    )
  }, [vendors, searchTerm])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-3xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Saved Vendors
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      {vendors.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Directory of registered suppliers and vendors
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAddVendor}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>New Vendor</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search vendors by name, phone, email, address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>
            </div>

            {/* Vendors List Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
              {filteredVendors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {filteredVendors.map((vendor) => {
                    const vendorBills = bills.filter(
                      b => b.vendor.toLowerCase().trim() === vendor.name.toLowerCase().trim()
                    )
                    const totalSpent = vendorBills.reduce((acc, b) => acc + b.amount, 0)

                    return (
                      <div
                        key={vendor.id}
                        className="p-4 bg-slate-50/70 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 hover:border-amber-400/50 dark:hover:border-amber-600/50 transition-all flex flex-col justify-between space-y-3.5"
                      >
                        <div>
                          {/* Vendor Top row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                {vendor.photo ? (
                                  <Image
                                    src={vendor.photo}
                                    alt={vendor.name}
                                    fill
                                    className="object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Building2 size={20} className="text-amber-600 dark:text-amber-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {vendor.name}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {vendor.id}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onEditVendor(vendor)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Edit Vendor"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteVendor(vendor)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                title="Delete Vendor"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Contact Details */}
                          <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                            {vendor.phone && (
                              <div className="flex items-center gap-2">
                                <Phone size={12} className="text-slate-400 shrink-0" />
                                <a href={`tel:${vendor.phone}`} className="hover:underline font-medium">
                                  {vendor.phone}
                                </a>
                              </div>
                            )}
                            {vendor.email && (
                              <div className="flex items-center gap-2">
                                <Mail size={12} className="text-slate-400 shrink-0" />
                                <a href={`mailto:${vendor.email}`} className="hover:underline font-medium truncate">
                                  {vendor.email}
                                </a>
                              </div>
                            )}
                            {vendor.address && (
                              <div className="flex items-start gap-2">
                                <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 leading-relaxed text-[11px]">
                                  {vendor.address}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Stats & Bill action */}
                        <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                              Total Bills
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              ৳{totalSpent.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({vendorBills.length})
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onBillVendor(vendor.name)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          >
                            <span>Record Bill</span>
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center text-slate-500 dark:text-slate-400 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Building2 size={28} />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {searchTerm ? 'No matching vendors found' : 'No saved vendors yet'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                      {searchTerm
                        ? 'Try modifying your search keywords'
                        : 'Register suppliers to quickly tag them in bills and maintain profile records.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onAddVendor}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Add First Vendor</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Showing {filteredVendors.length} of {vendors.length} vendors
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAddVendor}
                  className="sm:hidden px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all active:scale-95"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
