'use client'

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { User, Phone, MapPin, Mail, Save, ArrowLeft, Camera, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { sanitizePhoneInput, isValidPhoneNumber } from '@/lib/utils'
import {
  findExistingCustomerByPhone,
  generateCustomerId,
  isDuplicatePhoneDbError,
  ExistingCustomerRecord
} from '@/lib/customerLookup'
import { supabase, getTenantId } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

function AddCustomerContent() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const lookupSeqRef = useRef(0)
  const lastAutoFilledIdRef = useRef<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const [matchedExistingCustomer, setMatchedExistingCustomer] = useState<ExistingCustomerRecord | null>(null)
  const [activeInvoiceDue, setActiveInvoiceDue] = useState(0)

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
        if (lastAutoFilledIdRef.current) {
          clearAutoFilledFields()
        }
        return null
      }

      setIsCheckingPhone(true)
      const activeTenantId = getTenantId()
      const { match, error } = await findExistingCustomerByPhone(sanitized, null, activeTenantId)

      if (currentSeq !== lookupSeqRef.current) {
        return null
      }

      setIsCheckingPhone(false)

      if (error) {
        console.warn('Phone lookup warning:', error)
        return null
      }

      if (match) {
        if (lastAutoFilledIdRef.current !== match.id) {
          await populateFromExistingCustomer(match, sanitized)
          toast.info(`Loaded existing customer: ${match.name}`)
        }
        return match
      }

      if (lastAutoFilledIdRef.current) {
        clearAutoFilledFields()
      }
      return null
    },
    [populateFromExistingCustomer, clearAutoFilledFields]
  )

  useEffect(() => {
    const sanitized = sanitizePhoneInput(formData.phone)
    const digits = sanitized.replace(/\D/g, '')

    if (digits.length < 6) {
      setIsCheckingPhone(false)
      if (lastAutoFilledIdRef.current) {
        clearAutoFilledFields()
      }
      return
    }

    const timer = setTimeout(() => {
      runPhoneLookup(sanitized)
    }, 250)

    return () => clearTimeout(timer)
  }, [formData.phone, runPhoneLookup, clearAutoFilledFields])

  const handleResetForm = () => {
    lookupSeqRef.current += 1
    lastAutoFilledIdRef.current = null
    setMatchedExistingCustomer(null)
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }))
      }
      reader.readAsDataURL(file)
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
        null,
        activeTenantId
      )

      if (lookupError) {
        toast.error('Could not verify phone number availability. Please try again.')
        return
      }

      if (existingMatch) {
        // Fast-submit race guard: if existing profile was not auto-populated yet, populate it now without inserting or overwriting blindly
        if (matchedExistingCustomer?.id !== existingMatch.id) {
          await populateFromExistingCustomer(existingMatch, sanitizedPhone)
          toast.warning(`Phone already belongs to ${existingMatch.name}. Existing details loaded — duplicate creation prevented.`)
          return
        }

        const cleanOpeningBalance = Math.max(0, Number(formData.initialBalance) || 0)
        const updatedTotalDue = Math.max(0, activeInvoiceDue + cleanOpeningBalance)
        const trimmedName = formData.name.trim()
        const { error: updateError } = await supabase
          .from('customer')
          .update({
            name: trimmedName,
            phone: sanitizedPhone,
            email: formData.email,
            address: formData.address,
            type: formData.type,
            total_due: updatedTotalDue,
            photo: formData.photo
          })
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

        toast.success(`Updated existing customer: ${trimmedName}`)
        router.push('/customer')
        return
      }

      const customerId = generateCustomerId()
      const cleanOpeningBalance = Math.max(0, Number(formData.initialBalance) || 0)
      const dbData = {
        id: customerId,
        name: formData.name.trim(),
        phone: sanitizedPhone,
        email: formData.email,
        address: formData.address,
        type: formData.type,
        total_due: cleanOpeningBalance,
        total_orders: 0,
        photo: formData.photo
      }
      
      const { error } = await supabase.from('customer').insert([dbData])
      if (error) throw error
      
      // Also record initial balance as a transaction if > 0
      if (cleanOpeningBalance > 0) {
        await supabase.from('transactions').insert([{
          id: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          type: 'Opening Balance',
          ref: 'Initial',
          debit: cleanOpeningBalance,
          credit: 0,
          balance: cleanOpeningBalance,
          method: 'N/A',
          notes: 'Opening Balance'
        }])
      }

      toast.success('Customer created successfully')
      router.push('/customer')
    } catch (error: any) {
      console.error('Error creating customer:', error)
      if (isDuplicatePhoneDbError(error)) {
        toast.error('A customer with this phone number already exists in your workspace.')
      } else {
        toast.error('Failed to save customer: ' + (error?.message || 'Unknown error'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/customer"
              className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                {matchedExistingCustomer ? 'Existing Customer' : 'Add New Customer'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {matchedExistingCustomer
                  ? `Matched profile ${matchedExistingCustomer.id} by phone number`
                  : 'Create a new profile in your business directory'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
            {/* Profile Photo Section */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:border-amber-500 group-hover:text-amber-500 transition-all cursor-pointer overflow-hidden relative"
                >
                  {formData.photo ? (
                    <Image src={formData.photo} alt="Preview" fill sizes="128px" referrerPolicy="no-referrer" className="object-cover" />
                  ) : (
                    <Camera size={40} strokeWidth={1.5} />
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-4">Upload Customer Photo</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
              {/* Basic Information */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Basic Information</h3>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <User size={14} className="text-amber-600" /> Full Name
                  </label>
                  <input 
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
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
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: sanitizePhoneInput(e.target.value)})}
                    onBlur={() => {
                      const sanitized = sanitizePhoneInput(formData.phone)
                      if (sanitized.replace(/\D/g, '').length >= 6) {
                        runPhoneLookup(sanitized)
                      }
                    }}
                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl outline-none focus:ring-4 dark:text-slate-100 transition-all text-sm ${
                      matchedExistingCustomer
                        ? 'border-emerald-400 dark:border-emerald-600 focus:ring-emerald-500/15 focus:border-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-amber-500/10 focus:border-amber-500'
                    }`}
                    placeholder="e.g. 017XXXXXXXX or +88017XXXXXXXX"
                  />
                  {matchedExistingCustomer && (
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
                    <Mail size={14} className="text-amber-600" /> Email Address
                  </label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    placeholder="customer@example.com"
                  />
                </div>
              </div>

              {/* Account Details */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Account Details</h3>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Customer Category</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 dark:text-slate-100 transition-all text-sm appearance-none"
                  >
                    <option value="Regular">Regular Customer</option>
                    <option value="Premium">Premium Member</option>
                    <option value="Wholesale">Wholesale Client</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Initial Opening Balance (৳)</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={formData.initialBalance || ''}
                    onChange={(e) => setFormData({...formData, initialBalance: Math.max(0, parseFloat(e.target.value) || 0)})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    placeholder="0.00"
                  />
                  {matchedExistingCustomer ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Active Invoices Due: <strong className="text-slate-700 dark:text-slate-200">৳{activeInvoiceDue.toLocaleString()}</strong></span>
                      <span>+ Opening: <strong className="text-slate-700 dark:text-slate-200">৳{Math.max(0, Number(formData.initialBalance) || 0).toLocaleString()}</strong></span>
                      <span>= Total Due: <strong className="text-amber-600 dark:text-amber-400">৳{Math.max(0, activeInvoiceDue + (Number(formData.initialBalance) || 0)).toLocaleString()}</strong></span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Enter any previous outstanding due amount</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <MapPin size={14} className="text-amber-600" /> Full Address
                  </label>
                  <textarea 
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 dark:text-slate-100 transition-all text-sm min-h-[120px] resize-none"
                    placeholder="Enter complete address details..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col md:flex-row gap-4">
              <Link 
                href="/customer"
                className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-center"
              >
                Cancel
              </Link>
              <button 
                type="submit"
                disabled={isSubmitting || isCheckingPhone}
                className="flex-[2] py-5 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-2xl shadow-amber-600/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto disabled:pointer-events-none"
              >
                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {isSubmitting
                  ? matchedExistingCustomer
                    ? 'Updating Profile...'
                    : 'Creating Profile...'
                  : matchedExistingCustomer
                    ? 'Update Existing Customer'
                    : 'Create Customer Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function AddCustomerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <AddCustomerContent />
    </Suspense>
  )
}
