'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, User, Phone, MapPin, Mail, Save, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { sanitizePhoneInput, isValidPhoneNumber } from '@/lib/utils'
import {
  findExistingCustomerByPhone,
  canonicalizePhone,
  generateCustomerId,
  isDuplicatePhoneDbError,
  ExistingCustomerRecord
} from '@/lib/customerLookup'
import Image from 'next/image'

import { supabase, getTenantId } from '@/lib/supabase'
import { toast } from 'sonner'

interface AddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd?: (customer: any) => void
  onSelectExisting?: (customer: ExistingCustomerRecord) => void
  onExistingUpdated?: (customer: ExistingCustomerRecord) => void
  initialData?: any
}

export default function AddCustomerModal({
  isOpen,
  onClose,
  onAdd,
  onSelectExisting,
  onExistingUpdated,
  initialData
}: AddCustomerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const addressInputRef = useRef<HTMLTextAreaElement>(null)
  const balanceInputRef = useRef<HTMLInputElement>(null)

  const lookupSeqRef = useRef(0)
  const lastAutoFilledIdRef = useRef<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeInvoiceDue, setActiveInvoiceDue] = useState(0)

  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const [matchedExistingCustomer, setMatchedExistingCustomer] = useState<ExistingCustomerRecord | null>(null)
  const [editPhoneConflict, setEditPhoneConflict] = useState<ExistingCustomerRecord | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'Regular',
    initialBalance: 0,
    photo: null as string | null
  })

  const populateFromExistingCustomer = useCallback(
    async (customer: ExistingCustomerRecord, preserveTypedPhone?: string) => {
      const targetSeq = lookupSeqRef.current
      lastAutoFilledIdRef.current = customer.id
      setMatchedExistingCustomer(customer)
      setEditPhoneConflict(null)

      setFormData(prev => ({
        ...prev,
        name: customer.name || '',
        phone: preserveTypedPhone !== undefined ? preserveTypedPhone : sanitizePhoneInput(customer.phone || ''),
        email: customer.email || '',
        address: customer.address || '',
        type: customer.type || 'Regular',
        initialBalance: Math.max(0, Number(customer.total_due || 0)),
        photo: customer.photo || null
      }))

      // Compute active invoice due to separate opening balance accurately
      try {
        const filterExpr = customer.id
          ? `customer_id.eq."${customer.id}",customer_name.eq."${customer.name}"`
          : `customer_name.eq."${customer.name}"`

        const [furnRes, woodRes] = await Promise.all([
          supabase.from('furniture_invoices').select('customer_id, customer_name, due_amount').or(filterExpr),
          supabase.from('wood_invoices').select('customer_id, customer_name, due_amount').or(filterExpr)
        ])

        if (targetSeq !== lookupSeqRef.current) return

        const targetNameLower = (customer.name || '').trim().toLowerCase()
        const allInvoices = [...(furnRes.data || []), ...(woodRes.data || [])].filter(inv => {
          const invNameLower = (inv.customer_name || '').trim().toLowerCase()
          if (invNameLower && targetNameLower) return invNameLower === targetNameLower
          return Boolean(customer.id && String(inv.customer_id) === String(customer.id))
        })
        const computedInvoiceDue = allInvoices.reduce(
          (sum, inv) => sum + Math.max(0, Number(inv.due_amount || 0)),
          0
        )
        setActiveInvoiceDue(computedInvoiceDue)
        const computedOpening = Math.max(0, Number(customer.total_due || 0) - computedInvoiceDue)
        setFormData(prev => ({
          ...prev,
          initialBalance: computedOpening
        }))
      } catch (err) {
        console.error('Error computing existing customer dues:', err)
      }
    },
    []
  )

  const clearAutoFilledFields = useCallback(() => {
    lastAutoFilledIdRef.current = null
    setMatchedExistingCustomer(null)
    setActiveInvoiceDue(0)
    setFormData(prev => ({
      ...prev,
      name: '',
      email: '',
      address: '',
      type: 'Regular',
      initialBalance: 0,
      photo: null
    }))
  }, [])

  const runPhoneLookup = useCallback(
    async (phoneValue: string) => {
      const sanitized = sanitizePhoneInput(phoneValue)
      const digits = sanitized.replace(/\D/g, '')
      const currentSeq = ++lookupSeqRef.current

      if (digits.length < 6) {
        setIsCheckingPhone(false)
        setEditPhoneConflict(null)
        if (!initialData && lastAutoFilledIdRef.current) {
          clearAutoFilledFields()
        }
        return null
      }

      setIsCheckingPhone(true)
      const excludeId = initialData?.id || null
      const activeTenantId = getTenantId()
      const { match, error } = await findExistingCustomerByPhone(sanitized, excludeId, activeTenantId)

      if (currentSeq !== lookupSeqRef.current) {
        return null
      }

      setIsCheckingPhone(false)

      if (error) {
        console.warn('Phone lookup warning:', error)
        return null
      }

      if (initialData) {
        // Edit mode: strictly block reassigning to another customer's phone number
        setEditPhoneConflict(match || null)
        return match
      }

      if (match) {
        if (lastAutoFilledIdRef.current !== match.id) {
          await populateFromExistingCustomer(match, sanitized)
          toast.info(`Loaded existing customer: ${match.name}`)
        }
        return match
      }

      // Phone no longer matches any existing customer -> clear auto-filled fields while keeping typed phone
      if (lastAutoFilledIdRef.current) {
        clearAutoFilledFields()
      }
      return null
    },
    [initialData, populateFromExistingCustomer, clearAutoFilledFields]
  )

  useEffect(() => {
    let isMounted = true

    lookupSeqRef.current += 1
    lastAutoFilledIdRef.current = null
    setIsCheckingPhone(false)
    setMatchedExistingCustomer(null)
    setEditPhoneConflict(null)

    if (initialData) {
      const initialInvoiceDue = Number(initialData.invoiceDue || 0)
      const initialOpening = initialData.initialBalance !== undefined
        ? Math.max(0, Number(initialData.initialBalance) || 0)
        : Math.max(0, (Number(initialData.totalDue) || 0) - initialInvoiceDue)

      setActiveInvoiceDue(initialInvoiceDue)
      setFormData({
        name: initialData.name || '',
        phone: sanitizePhoneInput(initialData.phone || ''),
        email: initialData.email || '',
        address: initialData.address || '',
        type: initialData.type || 'Regular',
        initialBalance: initialOpening,
        photo: initialData.photo || null
      })

      // Fetch authoritative active invoice dues from Supabase to ensure accurate opening balance separation
      const fetchActiveInvoiceDues = async () => {
        try {
          const filterExpr = initialData.id
            ? `customer_id.eq."${initialData.id}",customer_name.eq."${initialData.name}"`
            : `customer_name.eq."${initialData.name}"`

          const [furnRes, woodRes] = await Promise.all([
            supabase.from('furniture_invoices').select('customer_id, customer_name, due_amount').or(filterExpr),
            supabase.from('wood_invoices').select('customer_id, customer_name, due_amount').or(filterExpr)
          ])

          if (!isMounted) return

          const targetNameLower = (initialData.name || '').trim().toLowerCase()
          const allInvoices = [...(furnRes.data || []), ...(woodRes.data || [])].filter(inv => {
            const invNameLower = (inv.customer_name || '').trim().toLowerCase()
            if (invNameLower && targetNameLower) return invNameLower === targetNameLower
            return Boolean(initialData.id && String(inv.customer_id) === String(initialData.id))
          })
          const computedInvoiceDue = allInvoices.reduce(
            (sum, inv) => sum + Math.max(0, Number(inv.due_amount || 0)),
            0
          )
          setActiveInvoiceDue(computedInvoiceDue)

          const computedOpeningBalance = initialData.initialBalance !== undefined
            ? Math.max(0, Number(initialData.initialBalance) || 0)
            : Math.max(0, (Number(initialData.totalDue) || 0) - computedInvoiceDue)

          setFormData(prev => ({
            ...prev,
            initialBalance: computedOpeningBalance
          }))
        } catch (err) {
          console.error('Error fetching active invoice dues for customer:', err)
        }
      }

      if (isOpen && (initialData.id || initialData.name)) {
        fetchActiveInvoiceDues()
      }
    } else {
      setActiveInvoiceDue(0)
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

    return () => {
      isMounted = false
    }
  }, [initialData, isOpen])

  // Automatically query database as user enters a phone number
  useEffect(() => {
    if (!isOpen) return
    const sanitized = sanitizePhoneInput(formData.phone)
    const digits = sanitized.replace(/\D/g, '')

    if (initialData && canonicalizePhone(initialData.phone || '') === canonicalizePhone(sanitized)) {
      setEditPhoneConflict(null)
      setIsCheckingPhone(false)
      return
    }

    if (digits.length < 6) {
      setEditPhoneConflict(null)
      setIsCheckingPhone(false)
      if (!initialData && lastAutoFilledIdRef.current) {
        clearAutoFilledFields()
      }
      return
    }

    const timer = setTimeout(() => {
      runPhoneLookup(sanitized)
    }, 250)

    return () => clearTimeout(timer)
  }, [formData.phone, isOpen, initialData, runPhoneLookup, clearAutoFilledFields])

  const handleResetForm = () => {
    lookupSeqRef.current += 1
    lastAutoFilledIdRef.current = null
    setMatchedExistingCustomer(null)
    setEditPhoneConflict(null)
    setActiveInvoiceDue(0)
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      type: 'Regular',
      initialBalance: 0,
      photo: null
    })
    setTimeout(() => phoneInputRef.current?.focus(), 0)
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const sanitizedPhone = sanitizePhoneInput(formData.phone)
    if (!isValidPhoneNumber(sanitizedPhone)) {
      toast.error('Please enter a valid phone number (digits and optional leading + only, no spaces or special characters).')
      phoneInputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      const activeTenantId = getTenantId()
      if (!activeTenantId) {
        toast.error('Unable to identify your active tenant workspace. Please sign in again.')
        return
      }

      // Authoritative tenant-scoped live DB check before any write:
      // strictly prevents duplicate phone numbers within the same tenant while allowing the same number across different tenants
      const { match: existingMatch, error: lookupError } = await findExistingCustomerByPhone(
        sanitizedPhone,
        initialData?.id || null,
        activeTenantId
      )

      if (lookupError) {
        toast.error('Could not verify phone number availability. Please try again.')
        return
      }

      if (initialData) {
        if (existingMatch) {
          setEditPhoneConflict(existingMatch)
          toast.error(`Phone number is already registered to ${existingMatch.name} (${existingMatch.id}) in this workspace.`)
          phoneInputRef.current?.focus()
          return
        }
      } else if (existingMatch) {
        // Fast-submit race guard: if existing profile was not auto-populated yet, populate it now instead of inserting or overwriting blindly
        if (matchedExistingCustomer?.id !== existingMatch.id) {
          await populateFromExistingCustomer(existingMatch, sanitizedPhone)
          toast.warning(`Phone already belongs to ${existingMatch.name}. Existing details loaded — duplicate creation prevented.`)
          return
        }

        // Existing profile in the same tenant is loaded: update this single profile in-place (never insert a duplicate)
        const cleanOpeningBalance = Math.max(0, Number(formData.initialBalance) || 0)
        const updatedTotalDue = Math.max(0, activeInvoiceDue + cleanOpeningBalance)
        const trimmedName = formData.name.trim()
        const updatePayload = {
          name: trimmedName,
          phone: sanitizedPhone,
          email: formData.email,
          address: formData.address,
          type: formData.type,
          total_due: updatedTotalDue,
          photo: formData.photo
        }

        const { error: updateError } = await supabase
          .from('customer')
          .update(updatePayload)
          .eq('id', existingMatch.id)
          .eq('org_id', activeTenantId)

        if (updateError) throw updateError

        if (existingMatch.name && trimmedName && existingMatch.name !== trimmedName) {
          await Promise.all([
            supabase
              .from('furniture_invoices')
              .update({ customer_name: trimmedName })
              .or(`customer_id.eq."${existingMatch.id}",customer_name.eq."${existingMatch.name}"`),
            supabase
              .from('wood_invoices')
              .update({ customer_name: trimmedName })
              .or(`customer_id.eq."${existingMatch.id}",customer_name.eq."${existingMatch.name}"`)
          ])
        }

        const updatedRecord: ExistingCustomerRecord = {
          ...existingMatch,
          ...updatePayload
        }

        if (onSelectExisting) {
          onSelectExisting(updatedRecord)
          toast.success(`Selected existing customer: ${updatedRecord.name}`)
        } else {
          onExistingUpdated?.(updatedRecord)
          toast.success(`Updated existing customer: ${updatedRecord.name}`)
        }

        onClose()
        return
      }

      let latestInvoiceDue = activeInvoiceDue
      let latestOrdersCount = initialData?.totalOrders || 0

      if (initialData?.id || initialData?.name) {
        const filterExpr = initialData.id
          ? `customer_id.eq."${initialData.id}",customer_name.eq."${initialData.name}"`
          : `customer_name.eq."${initialData.name}"`

        const [furnRes, woodRes] = await Promise.all([
          supabase.from('furniture_invoices').select('customer_id, customer_name, due_amount').or(filterExpr),
          supabase.from('wood_invoices').select('customer_id, customer_name, due_amount').or(filterExpr)
        ])

        const validNames = new Set(
          [initialData.name, formData.name]
            .map(n => (n || '').trim().toLowerCase())
            .filter(Boolean)
        )
        const allInvoices = [...(furnRes.data || []), ...(woodRes.data || [])].filter(inv => {
          const invNameLower = (inv.customer_name || '').trim().toLowerCase()
          if (invNameLower) return validNames.has(invNameLower)
          return Boolean(initialData.id && String(inv.customer_id) === String(initialData.id))
        })
        latestInvoiceDue = allInvoices.reduce(
          (sum, inv) => sum + Math.max(0, Number(inv.due_amount || 0)),
          0
        )
        latestOrdersCount = allInvoices.length
      }

      const cleanOpeningBalance = Math.max(0, Number(formData.initialBalance) || 0)
      const recalculatedTotalDue = initialData
        ? Math.max(0, latestInvoiceDue + cleanOpeningBalance)
        : cleanOpeningBalance

      const customerData = {
        id: initialData?.id || generateCustomerId(),
        ...formData,
        name: formData.name.trim(),
        phone: sanitizedPhone,
        initialBalance: cleanOpeningBalance,
        invoiceDue: latestInvoiceDue,
        totalOrders: latestOrdersCount,
        totalDue: recalculatedTotalDue,
        lastPurchase: initialData?.lastPurchase || null
      }
      
      if (onAdd) {
        await onAdd(customerData)
      } else {
        await saveToSupabase(customerData)
      }
      
      onClose()
    } catch (err: any) {
      console.error('Error submitting customer:', err)
      if (isDuplicatePhoneDbError(err)) {
        toast.error('A customer with this phone number already exists in your workspace.')
      } else {
        toast.error('Failed to save customer: ' + (err?.message || 'Unknown error'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveToSupabase = async (customer: any) => {
    const dbData = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      type: customer.type,
      total_due: Number(customer.totalDue ?? customer.initialBalance ?? 0),
      total_orders: customer.totalOrders || 0,
      last_purchase: customer.lastPurchase || null,
      photo: customer.photo
    }

    const { error } = await supabase
      .from('customer')
      .upsert(dbData)
    
    if (error) throw error
    toast.success('Customer saved successfully')
  }

  const isEditConflict = Boolean(editPhoneConflict)
  const isEditingOrMatched = Boolean(initialData || matchedExistingCustomer)

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
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {initialData
                      ? 'Edit Customer'
                      : matchedExistingCustomer
                        ? 'Existing Customer'
                        : 'Add New Customer'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {initialData
                      ? 'Update existing customer profile details'
                      : matchedExistingCustomer
                        ? `Matched profile ${matchedExistingCustomer.id} by phone number`
                        : 'Create a new profile in your directory'}
                  </p>
                </div>
              </div>
              <button 
                type="button"
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
                      <Image src={formData.photo} alt="Preview" fill referrerPolicy="no-referrer" className="object-cover" />
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
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Phone size={14} className="text-amber-600" /> Phone Number
                    </label>
                    {isCheckingPhone && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        <Loader2 size={11} className="animate-spin" /> Checking...
                      </span>
                    )}
                  </div>
                  <input 
                    ref={phoneInputRef}
                    required
                    type="tel"
                    inputMode="tel"
                    pattern="^\+?\d+$"
                    title="Only digits and an optional leading '+' are allowed (no spaces or special characters)"
                    enterKeyHint="next"
                    value={formData.phone}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const cleaned = sanitizePhoneInput(e.target.value)
                      setFormData(prev => ({ ...prev, phone: cleaned }))
                    }}
                    onBlur={() => {
                      const sanitized = sanitizePhoneInput(formData.phone)
                      if (sanitized.replace(/\D/g, '').length >= 6) {
                        if (!initialData || canonicalizePhone(initialData.phone || '') !== canonicalizePhone(sanitized)) {
                          runPhoneLookup(sanitized)
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault()
                        emailInputRef.current?.focus()
                      }
                    }}
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 transition-all text-sm ${
                      isEditConflict
                        ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500/15 focus:border-rose-500'
                        : matchedExistingCustomer
                          ? 'border-emerald-400 dark:border-emerald-600 focus:ring-emerald-500/15 focus:border-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 focus:ring-amber-500/10 focus:border-amber-500'
                    }`}
                    placeholder="e.g. 017XXXXXXXX or +88017XXXXXXXX"
                  />
                  {editPhoneConflict && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle size={12} className="shrink-0" />
                      Already registered to {editPhoneConflict.name} ({editPhoneConflict.id})
                    </p>
                  )}
                  {!initialData && matchedExistingCustomer && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                      <span className="inline-flex items-center gap-1 font-medium truncate">
                        <CheckCircle2 size={12} className="shrink-0" />
                        Existing customer loaded ({matchedExistingCustomer.id})
                      </span>
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-2 shrink-0"
                      >
                        Reset
                      </button>
                    </div>
                  )}
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
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Initial Opening Balance (৳)</label>
                    {isEditingOrMatched && (Number(formData.initialBalance) || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, initialBalance: 0 }))}
                        className="text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        Reset Opening Balance to 0
                      </button>
                    )}
                  </div>
                  <input 
                    ref={balanceInputRef}
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    enterKeyHint="send"
                    value={Number.isNaN(formData.initialBalance) || formData.initialBalance === 0 ? '' : formData.initialBalance}
                    onFocus={(e) => e.target.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => ({
                        ...prev,
                        initialBalance: val === '' ? 0 : Math.max(0, parseFloat(val) || 0)
                      }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.keyCode === 13) {
                        e.preventDefault()
                        handleSubmit(e as any)
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0.00"
                  />
                  {isEditingOrMatched ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Active Invoices Due: <strong className="text-slate-700 dark:text-slate-200">৳{activeInvoiceDue.toLocaleString()}</strong></span>
                      <span>+ Opening Balance: <strong className="text-slate-700 dark:text-slate-200">৳{Math.max(0, Number(formData.initialBalance) || 0).toLocaleString()}</strong></span>
                      <span>= New Total Due: <strong className="text-amber-600 dark:text-amber-400">৳{Math.max(0, activeInvoiceDue + (Number(formData.initialBalance) || 0)).toLocaleString()}</strong></span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">Enter any previous due amount if applicable</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-6">
                <button 
                  type="submit"
                  disabled={isSubmitting || isCheckingPhone || isEditConflict}
                  className="w-full sm:flex-1 order-1 sm:order-2 py-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-xl shadow-amber-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto disabled:pointer-events-none"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isSubmitting
                    ? 'Saving...'
                    : matchedExistingCustomer && !initialData
                      ? onSelectExisting
                        ? 'Use Existing Customer'
                        : 'Update Existing Customer'
                      : initialData
                        ? 'Update Customer'
                        : 'Save Customer'}
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
