'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Camera, Building2, Phone, MapPin, Mail, Loader2, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export interface Vendor {
  id: string
  name: string
  phone: string
  email: string
  address: string
  photo?: string | null
  org_id?: string
  created_at?: string
}

interface SaveVendorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (vendor: Vendor) => void
  initialData?: Partial<Vendor> | null
}

export default function SaveVendorModal({ isOpen, onClose, onSave, initialData }: SaveVendorModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    photo: null as string | null
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        address: initialData.address || '',
        photo: initialData.photo || null
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        photo: null
      })
    }
  }, [initialData, isOpen])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop() || 'png'
      const fileName = `vendors/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) {
        throw uploadError
      }

      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      setFormData(prev => ({ ...prev, photo: urlData.publicUrl }))
      toast.success('Logo uploaded successfully')
    } catch (err: any) {
      console.warn('Storage upload unavailable or restricted, converting to inline base64 image:', err)
      try {
        const reader = new FileReader()
        reader.onloadend = () => {
          if (reader.result) {
            setFormData(prev => ({ ...prev, photo: reader.result as string }))
            toast.success('Photo loaded successfully')
          }
        }
        reader.readAsDataURL(file)
      } catch (encodeErr) {
        toast.error('Failed to load image preview')
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo: null }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      toast.error('Please enter a vendor name')
      return
    }

    setIsSubmitting(true)
    const vendorId = initialData?.id || `VEND-${Math.floor(1000 + Math.random() * 9000)}`
    
    const vendorRecord: Vendor = {
      id: vendorId,
      name: trimmedName,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      photo: formData.photo,
      created_at: initialData?.created_at || new Date().toISOString()
    }

    try {
      // 1. Attempt to persist to Supabase `vendors` table
      try {
        const { error } = await supabase
          .from('vendors')
          .upsert({
            id: vendorRecord.id,
            name: vendorRecord.name,
            phone: vendorRecord.phone,
            email: vendorRecord.email,
            address: vendorRecord.address,
            photo: vendorRecord.photo
          })

        if (error) {
          console.warn('Supabase vendors table notice:', error.message)
        }
      } catch (sbErr) {
        console.warn('Supabase save error (fallback to local state/storage):', sbErr)
      }

      // 2. Also save to localStorage for offline / instant availability
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('app_saved_vendors')
          const existing: Vendor[] = raw ? JSON.parse(raw) : []
          const filtered = existing.filter(v => v.id !== vendorRecord.id && v.name.toLowerCase() !== vendorRecord.name.toLowerCase())
          const updated = [vendorRecord, ...filtered]
          localStorage.setItem('app_saved_vendors', JSON.stringify(updated))
        } catch (storageErr) {
          console.error('LocalStorage write error:', storageErr)
        }
      }

      toast.success(initialData?.id ? 'Vendor details updated' : 'Vendor details saved successfully')
      if (onSave) {
        onSave(vendorRecord)
      }
      onClose()
    } catch (err: any) {
      toast.error('Failed to save vendor details: ' + (err.message || 'Unknown error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
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
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {initialData?.id ? 'Edit Vendor Details' : 'Save Vendor Details'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Register supplier & vendor profile for bills & expenses
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 max-h-[72vh] overflow-y-auto space-y-5">
                {/* Photo / Logo Upload Section */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Vendor Logo or Photo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="relative group w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {formData.photo ? (
                        <>
                          <Image
                            src={formData.photo}
                            alt="Vendor Logo"
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="absolute inset-0 bg-slate-950/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove photo"
                          >
                            <Trash2 size={18} className="text-rose-400" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          {isUploading ? (
                            <Loader2 size={24} className="animate-spin text-amber-600 mx-auto" />
                          ) : (
                            <Camera size={24} className="mx-auto text-slate-400 group-hover:text-amber-600 transition-colors" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                        >
                          <Camera size={14} className="text-amber-600" />
                          {formData.photo ? 'Change Logo/Photo' : 'Upload Logo/Photo'}
                        </button>

                        {formData.photo && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        JPG, PNG, WebP or SVG up to 5MB. Visible on bills and vendor directory.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vendor Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    Vendor / Business Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Timber Supply Co., Hardware World"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-semibold text-slate-900 dark:text-white transition-all placeholder:font-normal"
                    />
                  </div>
                </div>

                {/* Phone & Email Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="tel"
                        placeholder="e.g. +880 1712 345678"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-medium text-slate-900 dark:text-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="email"
                        placeholder="vendor@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-medium text-slate-900 dark:text-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Address / Location
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <textarea
                      rows={3}
                      placeholder="e.g. Shop 42, Timber Market, Gabtoli, Dhaka"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 text-sm font-medium text-slate-900 dark:text-white transition-all resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-95"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Vendor Details'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
