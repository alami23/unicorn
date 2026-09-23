'use client'

import React, { useState, useRef } from 'react'
import { X, Camera, User, Phone, MapPin, Mail, Save, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { safeParse } from '@/lib/utils'
import Image from 'next/image'

import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface AddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd?: (customer: any) => void
  initialData?: any
}

export default function AddCustomerModal({ isOpen, onClose, onAdd, initialData }: AddCustomerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const addressInputRef = useRef<HTMLTextAreaElement>(null)
  const balanceInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'Regular',
    initialBalance: 0,
    photo: null as string | null
  })

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        address: initialData.address || '',
        type: initialData.type || 'Regular',
        initialBalance: initialData.initialBalance || initialData.totalDue || 0,
        photo: initialData.photo || null
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        type: 'Regular',
        initialBalance: 0,
        photo: null
      })
    }
  }, [initialData, isOpen])

  const [isUploading, setIsUploading] = useState(false)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `customer/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('logos')
        .upload(fileName, file)
        
      if (error) throw error
      
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)
        
      setFormData(prev => ({ ...prev, photo: urlData.publicUrl }))
      toast.success('Photo uploaded successfully')
    } catch (error: any) {
      console.warn('Supabase storage upload failed or was restricted. Falling back to inline base64 image encoding.', error)
      
      try {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (reader.result) {
            setFormData(prev => ({ ...prev, photo: reader.result as string }))
            toast.success('Photo loaded as inline data due to storage policy limits.')
          } else {
            toast.error('Failed to encode photo as inline data.')
          }
        }
        reader.readAsDataURL(file)
      } catch (encodeError: any) {
        console.error('Failed to convert photo to base64:', encodeError)
        toast.error('Photo upload failed: ' + (error.message || 'Unknown error'))
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeletePhoto = async () => {
    if (!formData.photo) return
    
    try {
      if (formData.photo.includes('supabase.co/storage') && formData.photo.includes('logos/customer/')) {
        const urlParts = formData.photo.split('/')
        const fileName = urlParts[urlParts.length - 1]
        
        const { error } = await supabase.storage
          .from('logos')
          .remove([`customer/${fileName}`])
        
        if (error) console.error('Error deleting from storage:', error)
      }
      setFormData(prev => ({ ...prev, photo: null }))
    } catch (error: any) {
      console.error('Error removing photo:', error)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const customerData = {
      id: initialData?.id || `CUS-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      ...formData,
      totalOrders: initialData?.totalOrders || 0,
      totalDue: formData.initialBalance,
      lastPurchase: initialData?.lastPurchase || null
    }
    
    if (onAdd) {
      onAdd(customerData)
    } else {
      saveToSupabase(customerData)
    }
    
    onClose()
  }

  const saveToSupabase = async (customer: any) => {
    try {
      const dbData = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        type: customer.type,
        total_due: customer.initialBalance || 0,
        total_orders: 0,
        last_purchase: null,
        photo: customer.photo
      }

      const { error } = await supabase
        .from('customer')
        .upsert(dbData)
      
      if (error) throw error
      toast.success('Customer saved successfully')
    } catch (error: any) {
      console.error('Error saving customer:', error)
      toast.error('Failed to save customer: ' + error.message)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden"
          >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Add New Customer</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create a new profile in your directory</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 transition-all overflow-hidden relative ${isUploading ? 'opacity-50 cursor-not-allowed' : 'group-hover:border-amber-500 group-hover:text-amber-500 cursor-pointer'}`}
              >
                {isUploading ? (
                  <span className="text-xs font-bold animate-pulse">Uploading...</span>
                ) : formData.photo ? (
                  <Image src={formData.photo} alt="Preview" fill className="object-cover" />
                ) : (
                  <Camera size={32} strokeWidth={1.5} />
                )}
              </div>
              {formData.photo && !isUploading ? (
                <button
                  type="button"
                  onClick={handleDeletePhoto}
                  className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-full text-rose-500 hover:text-rose-700 shadow-md transition-all opacity-0 group-hover:opacity-100 z-10"
                  title="Remove Photo"
                >
                  <X size={14} />
                </button>
              ) : !isUploading && (
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 transition-all"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">Upload Photo</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <User size={14} className="text-amber-600" /> Full Name
              </label>
              <input 
                ref={nameInputRef}
                required
                type="text"
                enterKeyHint="next"
                value={formData.name}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault()
                    phoneInputRef.current?.focus()
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm"
                placeholder="Enter customer name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Phone size={14} className="text-amber-600" /> Phone Number
              </label>
              <input 
                ref={phoneInputRef}
                required
                type="tel"
                inputMode="tel"
                enterKeyHint="next"
                value={formData.phone}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault()
                    emailInputRef.current?.focus()
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm"
                placeholder="e.g. 017XXXXXXXX"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Mail size={14} className="text-amber-600" /> Email Address (Optional)
              </label>
              <input 
                ref={emailInputRef}
                type="email"
                inputMode="email"
                enterKeyHint="next"
                value={formData.email}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault()
                    addressInputRef.current?.focus()
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm"
                placeholder="customer@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Customer Type</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm"
              >
                <option value="Regular">Regular Customer</option>
                <option value="Premium">Premium Member</option>
                <option value="Wholesale">Wholesale Client</option>
              </select>
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MapPin size={14} className="text-amber-600" /> Full Address
              </label>
              <textarea 
                ref={addressInputRef}
                required
                enterKeyHint="next"
                value={formData.address}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.keyCode === 13) {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      balanceInputRef.current?.focus()
                    }
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm min-h-[100px] resize-none"
                placeholder="Enter complete address details..."
              />
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Initial Opening Balance (৳)</label>
              <input 
                ref={balanceInputRef}
                type="number"
                inputMode="decimal"
                enterKeyHint="send"
                value={Number.isNaN(formData.initialBalance) ? '' : formData.initialBalance}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFormData({...formData, initialBalance: parseFloat(e.target.value) || 0})}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.keyCode === 13) {
                    e.preventDefault()
                    handleSubmit(e as any)
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm"
                placeholder="0.00"
              />
              <p className="text-[10px] text-slate-400 italic">Enter any previous due amount if applicable</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-6">
            <button 
              type="submit"
              className="w-full sm:flex-1 order-1 sm:order-2 py-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-xl shadow-amber-600/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Save size={18} /> Save Customer
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 order-2 sm:order-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
