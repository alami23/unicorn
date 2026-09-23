'use client'

import React, { useState, useRef, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { User, Phone, MapPin, Mail, Save, ArrowLeft, Camera, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { safeParse } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

function AddCustomerContent() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'Regular',
    initialBalance: 0,
    photo: null as string | null
  })

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
    const customerId = `CUS-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    
    try {
      const dbData = {
        id: customerId,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        type: formData.type,
        total_due: formData.initialBalance,
        total_orders: 0
      }
      
      const { error } = await supabase.from('customer').insert([dbData])
      if (error) throw error
      
      // Also record initial balance as a transaction if > 0
      if (formData.initialBalance > 0) {
        await supabase.from('transactions').insert([{
          id: `TXN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          type: 'Opening Balance',
          ref: 'Initial',
          debit: formData.initialBalance,
          credit: 0,
          balance: formData.initialBalance,
          method: 'N/A',
          notes: 'Opening Balance'
        }])
      }

      router.push('/customer')
    } catch (error: any) {
      console.error('Error creating customer:', error)
      alert('Failed to create customer: ' + error.message)
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
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Add New Customer</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Create a new profile in your business directory</p>
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
                    <Image src={formData.photo} alt="Preview" fill sizes="128px" className="object-cover" />
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
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Phone size={14} className="text-amber-600" /> Phone Number
                  </label>
                  <input 
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    placeholder="e.g. 017XXXXXXXX"
                  />
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
                    value={formData.initialBalance || ''}
                    onChange={(e) => setFormData({...formData, initialBalance: parseFloat(e.target.value) || 0})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">Enter any previous outstanding due amount</p>
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
                className="flex-[2] py-5 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-2xl shadow-amber-600/20 flex items-center justify-center gap-3"
              >
                <Save size={20} /> Create Customer Profile
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
