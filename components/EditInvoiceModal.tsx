'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Save, Edit, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { addNotification } from '@/lib/notifications'
import { getDisplayInvoiceId } from '@/lib/invoice'
import { fetchOrgUsers, recordInvoiceCreator } from '@/lib/invoiceCache'
import { cn } from '@/lib/utils'

interface EditInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: any
  onSave: () => void
}

export default function EditInvoiceModal({ isOpen, onClose, invoice, onSave }: EditInvoiceModalProps) {
  const [amount, setAmount] = useState<number>(0)
  const [paid, setPaid] = useState<number>(0)
  const [due, setDue] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0)
  const [createdBy, setCreatedBy] = useState<string>('')
  const [users, setUsers] = useState<Array<{ id: string; name: string; username?: string; role?: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && invoice) {
      setAmount(invoice.amount || 0)
      setPaid(invoice.paid || 0)
      setDue(invoice.due || 0)
      setDiscount(invoice.discount || 0)
      setDeliveryCharge(invoice.deliveryCharge || 0)
      setCreatedBy(invoice.createdBy && invoice.createdBy !== 'Unassigned' ? invoice.createdBy : '')

      fetchOrgUsers().then(uList => {
        setUsers(uList)
      })
    }
  }, [isOpen, invoice])

  useEffect(() => {
    // auto calculate due
    const newDue = Math.max(0, amount - paid)
    setDue(newDue)
  }, [amount, paid])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return

    setIsSubmitting(true)
    try {
      const isWood = invoice.originalType?.toLowerCase() === 'wood' || 
                     invoice.originalType?.toLowerCase() === 'solo_wood' || 
                     invoice.type?.toLowerCase() === 'wood' || 
                     invoice.type?.toLowerCase() === 'solo_wood' ||
                     invoice.id?.includes('-W-')
      const invoiceTable = isWood ? 'wood_invoices' : 'furniture_invoices'

      const matchedUser = users.find(u => 
        u.name?.toLowerCase() === createdBy.trim().toLowerCase() ||
        u.username?.toLowerCase() === createdBy.trim().toLowerCase()
      )

      const creatorNameVal = createdBy.trim() || null
      const creatorIdVal = matchedUser?.id || null

      const { error } = await supabase
        .from(invoiceTable)
        .update({
          total: amount,
          paid_amount: paid,
          due_amount: due,
          discount: discount,
          delivery_charge: deliveryCharge,
          created_by: creatorIdVal,
          created_by_name: creatorNameVal
        })
        .eq('id', invoice.id)

      if (error) throw error

      if (creatorNameVal) {
        await recordInvoiceCreator(invoice.id, creatorNameVal, creatorIdVal || undefined)
      }

      // calculate the due difference to update customer's total due
      const dueDifference = due - (invoice.due || 0)
      if (dueDifference !== 0 && invoice.customer && invoice.customer !== 'Walk-in Customer') {
        const { data: customerData } = await supabase
          .from('customer')
          .select('total_due')
          .eq('name', invoice.customer)
          .single()

        if (customerData) {
          await supabase
            .from('customer')
            .update({ total_due: Math.max(0, (customerData.total_due || 0) + dueDifference) })
            .eq('name', invoice.customer)
        }
      }

      addNotification('invoice_update', 'Invoice Updated', `Invoice ${getDisplayInvoiceId(invoice.id)} has been edited.`);
      toast.success('Invoice updated successfully')
      onSave()
      onClose()
    } catch (error) {
      console.error('Error updating invoice:', error)
      toast.error('Failed to update invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Edit size={20} className="text-amber-600" />
                <h2 className="text-lg font-bold">Edit Invoice {getDisplayInvoiceId(invoice?.id)}</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Discount</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={e => setDiscount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Delivery Charge</label>
                    <input
                      type="number"
                      value={deliveryCharge}
                      onChange={e => setDeliveryCharge(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Paid Amount</label>
                    <input
                      type="number"
                      value={paid}
                      onChange={e => setPaid(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Due Amount</label>
                    <input
                      type="number"
                      value={due}
                      readOnly
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-rose-500 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                    <User size={14} className="text-slate-400" />
                    Created By (Staff / User)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="invoice-users-list"
                      value={createdBy}
                      onChange={e => setCreatedBy(e.target.value)}
                      placeholder="e.g. Staff Name"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-sm text-slate-800 dark:text-slate-100"
                    />
                    <datalist id="invoice-users-list">
                      {users.map(u => (
                        <option key={u.id} value={u.name}>
                          {u.name} {u.role ? `(${u.role})` : ''}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Specifies the user name displayed in the invoice table and printout.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
