'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  DollarSign,
  Calendar,
  FileText,
  Pencil,
  Trash2,
  Lock,
  Check,
  AlertTriangle,
  Wallet,
  Loader2
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase, getTenantId } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'
import { toast } from 'sonner'

interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  customerName: string
  customerId?: string
  onPaymentsUpdated?: () => void
}

interface PaymentLineItem {
  id: string
  ref: string
  displayRef: string
  amount: number
  date: string
  method: string
  notes: string
  type: string
  balance: number
  created_at: string
  isSynthetic: boolean
  isInvoiceLinked: boolean
  canModify: boolean
}

interface GroupedPayment {
  groupKey: string
  date: string
  method: string
  credit: number
  created_at: string
  items: PaymentLineItem[]
}

const STANDARD_METHODS = ['Cash', 'bKash', 'Nagad', 'Bank', 'Cheque', 'Card']

const STANDALONE_REFS = new Set([
  '',
  'opening balance',
  'opening',
  'initial',
  'standalone',
  'direct payment',
  'manual payment',
  'balance payment',
  'due payment',
  'n/a',
  '-',
  'none'
])

function looksLikeInvoiceRef(rawRef: string): boolean {
  const trimmed = rawRef.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  if (STANDALONE_REFS.has(lower)) return false
  if (/^(pay|opn|bal|std)-/i.test(trimmed)) return false
  if (/^#/.test(trimmed)) return true
  if (/\binv\b|^inv[-_#0-9]/i.test(trimmed)) return true
  if (/-(f|w|sw|furn|wood)-/i.test(trimmed)) return true
  return false
}

function buildInvoiceKeySet(refs: Iterable<string>): Set<string> {
  const keys = new Set<string>()
  for (const raw of refs) {
    const trimmed = String(raw || '').trim()
    if (!trimmed) continue
    const disp = getDisplayInvoiceId(trimmed)
    keys.add(trimmed.toUpperCase())
    keys.add(trimmed.replace(/^#+/, '').toUpperCase())
    keys.add(disp.toUpperCase())
    keys.add(disp.replace(/^#+/, '').toUpperCase())
  }
  return keys
}

function isTxnInvoiceLinked(txn: any, knownInvoiceKeys: Set<string>): boolean {
  if (!txn || !txn.id || String(txn.id).startsWith('inv-paid-')) return true
  const tType = String(txn.type || '').trim().toLowerCase()
  if (tType === 'invoice' || tType === 'return') return true

  const rawRef = String(txn.ref || '').trim()
  if (!rawRef) return false
  const lowerRef = rawRef.toLowerCase()
  if (STANDALONE_REFS.has(lowerRef)) return false

  const dispRef = getDisplayInvoiceId(rawRef)
  const candidateKeys = [
    rawRef.toUpperCase(),
    rawRef.replace(/^#+/, '').toUpperCase(),
    dispRef.toUpperCase(),
    dispRef.replace(/^#+/, '').toUpperCase()
  ]
  if (candidateKeys.some(k => knownInvoiceKeys.has(k))) {
    return true
  }

  return looksLikeInvoiceRef(rawRef)
}

function formatLineRefLabel(rawRef: string, isInvoiceLinked: boolean): string {
  const trimmed = String(rawRef || '').trim()
  const lower = trimmed.toLowerCase()
  if (!trimmed || lower === 'opening balance' || lower === 'opening' || lower === 'initial') {
    return 'Opening Balance'
  }
  if (!isInvoiceLinked) {
    return trimmed
  }
  return getDisplayInvoiceId(trimmed)
}

function toInputDateValue(dateString: string): string {
  if (!dateString) return new Date().toISOString().split('T')[0]
  const isoMatch = String(dateString).match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]
  const parsed = new Date(dateString)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }
  return new Date().toISOString().split('T')[0]
}

export default function PaymentHistoryModal({
  isOpen,
  onClose,
  customerName,
  customerId,
  onPaymentsUpdated
}: PaymentHistoryModalProps) {
  const [payments, setPayments] = useState<GroupedPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resolvedCustomer, setResolvedCustomer] = useState<{ id: string; name: string } | null>(null)
  const knownInvoiceKeysRef = useRef<Set<string>>(new Set())

  // Inline edit state (strictly for non-invoice standalone / opening balance items)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState<string>('')
  const [editDate, setEditDate] = useState<string>('')
  const [editMethod, setEditMethod] = useState<string>('Cash')
  const [editNotes, setEditNotes] = useState<string>('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Inline delete confirmation state (strictly for non-invoice standalone / opening balance items)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)

  const resetActionStates = useCallback(() => {
    setEditingItemId(null)
    setEditAmount('')
    setEditDate('')
    setEditMethod('Cash')
    setEditNotes('')
    setDeletingItemId(null)
  }, [])

  const fetchPayments = useCallback(async () => {
    setIsLoading(true)
    try {
      let resolvedCustomerId = customerId
      let resolvedCustomerName = (customerName || '').trim()

      if ((!resolvedCustomerId || !resolvedCustomerName) && (customerName || customerId)) {
        let cusQuery = supabase.from('customer').select('id, name')
        if (resolvedCustomerId) {
          cusQuery = cusQuery.eq('id', resolvedCustomerId)
        } else {
          cusQuery = cusQuery.ilike('name', resolvedCustomerName)
        }
        const { data: cusData } = await cusQuery.maybeSingle()
        if (cusData) {
          resolvedCustomerId = cusData.id || resolvedCustomerId
          resolvedCustomerName = (cusData.name || resolvedCustomerName).trim()
        }
      }

      if (!resolvedCustomerId && !resolvedCustomerName) {
        setResolvedCustomer(null)
        setPayments([])
        setIsLoading(false)
        return
      }

      setResolvedCustomer({
        id: resolvedCustomerId || '',
        name: resolvedCustomerName
      })

      // Fetch invoices linked by either customer_id or customer_name to verify current ownership
      const invFilter = resolvedCustomerId && resolvedCustomerName
        ? `customer_id.eq."${resolvedCustomerId}",customer_name.ilike."${resolvedCustomerName}"`
        : resolvedCustomerId
          ? `customer_id.eq."${resolvedCustomerId}"`
          : `customer_name.ilike."${resolvedCustomerName}"`

      const [furnRes, woodRes] = await Promise.all([
        supabase
          .from('furniture_invoices')
          .select('id, invoice_number, customer_id, customer_name, paid_amount, due_amount, payment_method, created_at')
          .or(invFilter),
        supabase
          .from('wood_invoices')
          .select('id, invoice_number, customer_id, customer_name, paid_amount, due_amount, payment_method, created_at')
          .or(invFilter)
      ])

      const candidateInvoices = [...(furnRes.data || []), ...(woodRes.data || [])]
      const ownedInvoiceRefs = new Set<string>()
      const reassignedAwayRefs = new Set<string>()
      const ownedInvoicesMap = new Map<string, any>()

      candidateInvoices.forEach((inv: any) => {
        const invCustName = (inv.customer_name || '').trim()
        const isOwnedByName =
          resolvedCustomerName &&
          invCustName &&
          invCustName.toLowerCase() === resolvedCustomerName.toLowerCase()
        const isOwnedByIdOnly =
          !invCustName &&
          resolvedCustomerId &&
          String(inv.customer_id) === String(resolvedCustomerId)

        if (isOwnedByName || isOwnedByIdOnly) {
          if (inv.id) {
            ownedInvoiceRefs.add(String(inv.id))
            ownedInvoicesMap.set(String(inv.id), inv)
          }
          if (inv.invoice_number) {
            ownedInvoiceRefs.add(String(inv.invoice_number))
          }
        } else {
          if (inv.id) reassignedAwayRefs.add(String(inv.id))
          if (inv.invoice_number) reassignedAwayRefs.add(String(inv.invoice_number))
        }
      })

      const allKnownInvoiceKeys = buildInvoiceKeySet([
        ...ownedInvoiceRefs,
        ...reassignedAwayRefs
      ])
      knownInvoiceKeysRef.current = allKnownInvoiceKeys

      // Query transactions by customer_id AND by owned invoice refs
      const txnQueries: Promise<any>[] = []
      if (resolvedCustomerId) {
        txnQueries.push(
          Promise.resolve(
            supabase
              .from('transactions')
              .select('*')
              .eq('customer_id', resolvedCustomerId)
              .gt('credit', 0)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
          )
        )
      }
      const ownedRefList = Array.from(ownedInvoiceRefs)
      if (ownedRefList.length > 0) {
        txnQueries.push(
          Promise.resolve(
            supabase
              .from('transactions')
              .select('*')
              .in('ref', ownedRefList)
              .gt('credit', 0)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
          )
        )
      }

      const txnResults = await Promise.all(txnQueries)
      const mergedTxnsMap = new Map<string, any>()
      txnResults.forEach(res => {
        if (res?.data && Array.isArray(res.data)) {
          res.data.forEach((t: any) => {
            if (t && t.id && !mergedTxnsMap.has(String(t.id))) {
              mergedTxnsMap.set(String(t.id), t)
            }
          })
        }
      })

      // Filter out any transactions belonging to invoices reassigned to another customer
      const validPayments: any[] = Array.from(mergedTxnsMap.values()).filter((t: any) => {
        const tType = String(t.type || '').toLowerCase()
        if (tType === 'return') return false
        const refStr = String(t.ref || '').trim()
        if (refStr && reassignedAwayRefs.has(refStr)) {
          return false
        }
        if (refStr && refStr.toLowerCase() !== 'opening balance') {
          if (ownedInvoiceRefs.has(refStr)) return true
          return String(t.customer_id || '') === String(resolvedCustomerId || '')
        }
        return String(t.customer_id || '') === String(resolvedCustomerId || '')
      })

      // Ensure any owned invoice whose paid_amount exceeds recorded transaction credits is also represented
      ownedInvoicesMap.forEach((inv: any, invId: string) => {
        const invPaid = Number(inv.paid_amount || 0)
        if (invPaid <= 0) return
        const recordedForInv = validPayments
          .filter(t => String(t.ref) === invId || (inv.invoice_number && String(t.ref) === String(inv.invoice_number)))
          .reduce((sum, t) => sum + (Number(t.credit) || 0), 0)
        if (invPaid > recordedForInv) {
          const invDate = inv.created_at
            ? new Date(inv.created_at).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
          validPayments.push({
            id: `inv-paid-${invId}`,
            date: invDate,
            method: inv.payment_method || 'Cash',
            credit: invPaid - recordedForInv,
            ref: invId,
            type: 'Payment',
            notes: '',
            balance: 0,
            created_at: inv.created_at || invDate,
            isSynthetic: true
          })
        }
      })

      validPayments.sort((a, b) => {
        const dA = new Date(a.date || a.created_at || 0).getTime()
        const dB = new Date(b.date || b.created_at || 0).getTime()
        if (dB !== dA) return dB - dA
        const cA = new Date(a.created_at || 0).getTime()
        const cB = new Date(b.created_at || 0).getTime()
        return cB - cA
      })

      const groupedPayments: GroupedPayment[] = []
      validPayments.forEach((payment, idx) => {
        const paymentAmount = Number(payment.credit) || Number(payment.amount) || 0
        if (Math.round(paymentAmount) <= 0) return

        const isSynthetic = Boolean(payment.isSynthetic || String(payment.id || '').startsWith('inv-paid-'))
        const invoiceLinked = isSynthetic || isTxnInvoiceLinked(payment, allKnownInvoiceKeys)
        const canModify =
          !isSynthetic &&
          !invoiceLinked &&
          Boolean(payment.id) &&
          Boolean(resolvedCustomerId) &&
          String(payment.customer_id || '') === String(resolvedCustomerId)

        const rawRef = String(payment.ref || '').trim()
        const refLabel = rawRef || 'Opening Balance'

        const lineItem: PaymentLineItem = {
          id: String(payment.id || `row-${idx}`),
          ref: refLabel,
          displayRef: formatLineRefLabel(refLabel, invoiceLinked),
          amount: paymentAmount,
          date: toInputDateValue(payment.date || payment.created_at || ''),
          method: payment.method || 'Cash',
          notes: String(payment.notes || '').trim(),
          type: String(payment.type || 'Payment'),
          balance: Number(payment.balance || 0),
          created_at: payment.created_at || payment.date || '',
          isSynthetic,
          isInvoiceLinked: invoiceLinked,
          canModify
        }

        const lastGroup = groupedPayments[groupedPayments.length - 1]
        const timeDiff =
          lastGroup && lastGroup.created_at && payment.created_at
            ? Math.abs(new Date(lastGroup.created_at).getTime() - new Date(payment.created_at).getTime())
            : Number.MAX_SAFE_INTEGER

        // Group if same date, same method, and inserted within 5 minutes of each other
        if (
          lastGroup &&
          lastGroup.date === lineItem.date &&
          lastGroup.method === lineItem.method &&
          timeDiff < 5 * 60000
        ) {
          lastGroup.credit += paymentAmount
          if (invoiceLinked) {
            // Invoice-linked rows can be aggregated per invoice reference since they are strictly read-only here
            const existingInvoiceItem = lastGroup.items.find(
              item => item.isInvoiceLinked && item.ref === lineItem.ref
            )
            if (existingInvoiceItem) {
              existingInvoiceItem.amount += paymentAmount
            } else {
              lastGroup.items.push(lineItem)
            }
          } else {
            // Standalone / opening balance rows stay distinct 1-to-1 with their DB row ID for safe edit/delete
            lastGroup.items.push(lineItem)
          }
        } else {
          groupedPayments.push({
            groupKey: `${lineItem.id}-${idx}`,
            date: lineItem.date,
            method: lineItem.method,
            credit: paymentAmount,
            created_at: lineItem.created_at,
            items: [lineItem]
          })
        }
      })

      setPayments(groupedPayments)
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setIsLoading(false)
    }
  }, [customerId, customerName])

  useEffect(() => {
    if (isOpen && (customerName || customerId)) {
      resetActionStates()
      fetchPayments()
    } else if (!isOpen) {
      resetActionStates()
    }
  }, [isOpen, customerName, customerId, fetchPayments, resetActionStates])

  /**
   * Authoritative pre-flight verification before modifying or deleting a transaction row.
   * Ensures the record belongs to the active tenant + customer and is NOT linked to any invoice.
   */
  const verifyStandaloneTransaction = async (
    item: PaymentLineItem,
    activeTenantId: string,
    targetCustomerId: string
  ): Promise<{ freshTxn: any | null; error: string | null }> => {
    if (!item.canModify || item.isInvoiceLinked || item.isSynthetic) {
      return {
        freshTxn: null,
        error: 'Invoice-linked payments cannot be modified from this view. Please edit them from Invoices.'
      }
    }

    const { data: freshTxn, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', item.id)
      .eq('org_id', activeTenantId)
      .maybeSingle()

    if (fetchError) {
      return { freshTxn: null, error: fetchError.message }
    }
    if (!freshTxn) {
      return { freshTxn: null, error: 'Payment record could not be found or was already removed.' }
    }
    if (String(freshTxn.customer_id || '') !== String(targetCustomerId)) {
      return { freshTxn: null, error: 'This payment does not belong to the selected customer.' }
    }
    if (isTxnInvoiceLinked(freshTxn, knownInvoiceKeysRef.current)) {
      return {
        freshTxn: null,
        error: 'Invoice-linked payments cannot be modified from this view. Please edit them from Invoices.'
      }
    }

    // Extra DB-level reference check for any custom non-standard ref string
    const rawRef = String(freshTxn.ref || '').trim()
    if (rawRef && !STANDALONE_REFS.has(rawRef.toLowerCase())) {
      const refOrExpr = `id.eq."${rawRef}",invoice_number.eq."${rawRef}"`
      const [furnMatch, woodMatch] = await Promise.all([
        supabase
          .from('furniture_invoices')
          .select('id')
          .eq('org_id', activeTenantId)
          .or(refOrExpr)
          .limit(1),
        supabase
          .from('wood_invoices')
          .select('id')
          .eq('org_id', activeTenantId)
          .or(refOrExpr)
          .limit(1)
      ])

      if ((furnMatch.data && furnMatch.data.length > 0) || (woodMatch.data && woodMatch.data.length > 0)) {
        return {
          freshTxn: null,
          error: 'This payment is linked to an invoice and cannot be modified directly from Payment Record.'
        }
      }
    }

    return { freshTxn, error: null }
  }

  /**
   * Loads current customer due and active invoice due to enforce opening-balance ceilings
   * and keep customer.total_due synchronized after editing or deleting a standalone payment.
   */
  const fetchCustomerDueSnapshot = async (
    activeTenantId: string,
    targetCustomerId: string,
    targetCustomerName: string
  ) => {
    const invFilter = targetCustomerName
      ? `customer_id.eq."${targetCustomerId}",customer_name.ilike."${targetCustomerName}"`
      : `customer_id.eq."${targetCustomerId}"`

    const [cusRes, furnRes, woodRes] = await Promise.all([
      supabase
        .from('customer')
        .select('id, name, total_due')
        .eq('id', targetCustomerId)
        .eq('org_id', activeTenantId)
        .maybeSingle(),
      supabase
        .from('furniture_invoices')
        .select('id, customer_id, customer_name, due_amount')
        .eq('org_id', activeTenantId)
        .or(invFilter),
      supabase
        .from('wood_invoices')
        .select('id, customer_id, customer_name, due_amount')
        .eq('org_id', activeTenantId)
        .or(invFilter)
    ])

    if (cusRes.error) throw cusRes.error
    if (furnRes.error) throw furnRes.error
    if (woodRes.error) throw woodRes.error

    const normalizedName = (cusRes.data?.name || targetCustomerName || '').trim().toLowerCase()
    const ownedInvoices = [...(furnRes.data || []), ...(woodRes.data || [])].filter((inv: any) => {
      const invName = String(inv.customer_name || '').trim().toLowerCase()
      if (invName && normalizedName) return invName === normalizedName
      return String(inv.customer_id || '') === String(targetCustomerId)
    })

    const activeInvoiceDue = ownedInvoices.reduce(
      (sum: number, inv: any) => sum + Math.max(0, Number(inv.due_amount || 0)),
      0
    )
    const currentDbTotalDue = Math.max(0, Number(cusRes.data?.total_due || 0))
    const currentNonInvoiceDue = Math.max(0, currentDbTotalDue - activeInvoiceDue)

    return {
      currentDbTotalDue,
      activeInvoiceDue,
      currentNonInvoiceDue
    }
  }

  const startEditingItem = (item: PaymentLineItem) => {
    if (!item.canModify || item.isInvoiceLinked || item.isSynthetic) {
      toast.error('Invoice-linked payments cannot be edited from this view.')
      return
    }
    setDeletingItemId(null)
    setEditingItemId(item.id)
    setEditAmount(String(item.amount))
    setEditDate(toInputDateValue(item.date))
    setEditMethod(item.method || 'Cash')
    setEditNotes(item.notes || '')
  }

  const startDeletingItem = (item: PaymentLineItem) => {
    if (!item.canModify || item.isInvoiceLinked || item.isSynthetic) {
      toast.error('Invoice-linked payments cannot be deleted from this view.')
      return
    }
    setEditingItemId(null)
    setDeletingItemId(item.id)
  }

  const handleSaveEdit = async (item: PaymentLineItem) => {
    if (isSavingEdit) return

    const activeTenantId = getTenantId()
    const targetCustomerId = resolvedCustomer?.id || customerId || ''
    const targetCustomerName = resolvedCustomer?.name || customerName || ''

    if (!activeTenantId || !targetCustomerId) {
      toast.error('Unable to verify active workspace or customer context.')
      return
    }

    const parsedAmount = parseFloat(editAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid payment amount greater than 0.')
      return
    }

    const cleanDate = editDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      toast.error('Please select a valid payment date.')
      return
    }

    setIsSavingEdit(true)
    try {
      const { freshTxn, error: verifyError } = await verifyStandaloneTransaction(
        item,
        activeTenantId,
        targetCustomerId
      )
      if (verifyError || !freshTxn) {
        toast.error(verifyError || 'Unable to verify payment record.')
        return
      }

      const oldCredit = Math.max(0, Number(freshTxn.credit || 0))
      const { currentDbTotalDue, activeInvoiceDue, currentNonInvoiceDue } =
        await fetchCustomerDueSnapshot(activeTenantId, targetCustomerId, targetCustomerName)

      const maxAllowedAmount = oldCredit + currentNonInvoiceDue
      if (parsedAmount > maxAllowedAmount + 0.01) {
        toast.error(
          `Amount cannot exceed the customer's remaining non-invoice balance (max ৳${Math.round(maxAllowedAmount).toLocaleString()}).`
        )
        return
      }

      const creditDelta = parsedAmount - oldCredit
      const updatedTxnBalance = Math.max(0, Number(freshTxn.balance || 0) - creditDelta)
      const updatedCustomerTotalDue = Math.max(activeInvoiceDue, currentDbTotalDue - creditDelta)

      const { error: updateTxnError } = await supabase
        .from('transactions')
        .update({
          credit: parsedAmount,
          date: cleanDate,
          method: editMethod.trim() || 'Cash',
          notes: editNotes.trim(),
          balance: updatedTxnBalance
        })
        .eq('id', item.id)
        .eq('org_id', activeTenantId)

      if (updateTxnError) throw updateTxnError

      if (Math.abs(creditDelta) > 0.001) {
        const { error: updateCusError } = await supabase
          .from('customer')
          .update({ total_due: updatedCustomerTotalDue })
          .eq('id', targetCustomerId)
          .eq('org_id', activeTenantId)

        if (updateCusError) throw updateCusError
      }

      toast.success('Payment record updated')
      resetActionStates()
      await fetchPayments()
      onPaymentsUpdated?.()
    } catch (err: any) {
      console.error('Error updating standalone payment:', err)
      toast.error(err?.message || 'Failed to update payment record')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleConfirmDelete = async (item: PaymentLineItem) => {
    if (isDeletingItem) return

    const activeTenantId = getTenantId()
    const targetCustomerId = resolvedCustomer?.id || customerId || ''
    const targetCustomerName = resolvedCustomer?.name || customerName || ''

    if (!activeTenantId || !targetCustomerId) {
      toast.error('Unable to verify active workspace or customer context.')
      return
    }

    setIsDeletingItem(true)
    try {
      const { freshTxn, error: verifyError } = await verifyStandaloneTransaction(
        item,
        activeTenantId,
        targetCustomerId
      )
      if (verifyError || !freshTxn) {
        toast.error(verifyError || 'Unable to verify payment record.')
        return
      }

      const deletedCredit = Math.max(0, Number(freshTxn.credit || 0))
      const { currentDbTotalDue, activeInvoiceDue } = await fetchCustomerDueSnapshot(
        activeTenantId,
        targetCustomerId,
        targetCustomerName
      )

      const { error: deleteTxnError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', item.id)
        .eq('org_id', activeTenantId)

      if (deleteTxnError) throw deleteTxnError

      if (deletedCredit > 0) {
        const restoredTotalDue = Math.max(activeInvoiceDue, currentDbTotalDue + deletedCredit)
        const { error: updateCusError } = await supabase
          .from('customer')
          .update({ total_due: restoredTotalDue })
          .eq('id', targetCustomerId)
          .eq('org_id', activeTenantId)

        if (updateCusError) throw updateCusError
      }

      toast.success('Payment record deleted and customer balance restored')
      resetActionStates()
      await fetchPayments()
      onPaymentsUpdated?.()
    } catch (err: any) {
      console.error('Error deleting standalone payment:', err)
      toast.error(err?.message || 'Failed to delete payment record')
    } finally {
      setIsDeletingItem(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return ''
      let date: Date
      if (dateString.includes('-')) {
        const parts = dateString.split('-')
        if (parts[0].length === 4) {
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2].substring(0, 2)))
        } else {
          date = new Date(parseInt(parts[2].substring(0, 4)), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
      } else {
        date = new Date(dateString)
      }
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return dateString
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
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30 sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shrink-0">
                  <DollarSign size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Payment Record</h2>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-500 truncate">{customerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingEdit || isDeletingItem}
                className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors shadow-sm disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Lock size={13} className="shrink-0 text-slate-400" />
              <span>
                Standalone &amp; opening balance payments can be edited or deleted here. Invoice-linked payments are locked to protect invoice balances.
              </span>
            </div>

            <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                <div className="p-12 flex justify-center items-center h-full">
                  <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : payments.length === 0 ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-400">
                    <FileText size={24} />
                  </div>
                  <p>No payment records found for this customer.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0">
                  {payments.map(payment => (
                    <div
                      key={payment.groupKey}
                      className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-col gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <div className="flex flex-row items-start justify-between gap-4">
                        <div className="flex flex-col gap-1.5 w-full min-w-0">
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-2">
                            <span>Payment {formatDate(payment.date)}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium tracking-wide">
                              {payment.method ? payment.method.charAt(0).toUpperCase() + payment.method.slice(1) : 'Cash'}
                            </span>
                          </div>

                          {payment.items && payment.items.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-1 pl-1">
                              {payment.items.map((item, idx) => {
                                const isEditingThis = editingItemId === item.id
                                const isDeletingThis = deletingItemId === item.id
                                const methodOptions = STANDARD_METHODS.includes(editMethod)
                                  ? STANDARD_METHODS
                                  : [editMethod, ...STANDARD_METHODS]

                                return (
                                  <div key={`${item.id}-${idx}`} className="flex flex-col gap-2">
                                    <div className="text-sm flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                                        <div
                                          className={
                                            item.isInvoiceLinked
                                              ? 'w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0'
                                              : 'w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0'
                                          }
                                        />
                                        <span className="font-mono text-slate-900 dark:text-slate-100 tracking-tight text-[15px]">
                                          {item.displayRef}
                                        </span>
                                        <span className="text-slate-900 dark:text-slate-100">=</span>
                                        <span className="font-medium text-slate-900 dark:text-slate-100 text-[15px]">
                                          ৳{Math.round(item.amount).toLocaleString()}
                                        </span>

                                        {item.isInvoiceLinked ? (
                                          <span
                                            title="Linked to an invoice — edit or delete from the Invoices page"
                                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700/70 select-none"
                                          >
                                            <Lock size={10} />
                                            Invoice
                                          </span>
                                        ) : item.canModify ? (
                                          <div className="inline-flex items-center gap-1 ml-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                isEditingThis ? resetActionStates() : startEditingItem(item)
                                              }
                                              disabled={isSavingEdit || isDeletingItem}
                                              title="Edit standalone / opening balance payment"
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-40"
                                            >
                                              <Pencil size={13} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                isDeletingThis ? resetActionStates() : startDeletingItem(item)
                                              }
                                              disabled={isSavingEdit || isDeletingItem}
                                              title="Delete standalone / opening balance payment"
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-40"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>

                                    {item.notes &&
                                      item.notes.toLowerCase() !== item.method.toLowerCase() &&
                                      !isEditingThis && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 pl-3.5">
                                          Note: {item.notes}
                                        </p>
                                      )}

                                    {/* Inline Editor for Standalone / Opening Balance Payment */}
                                    <AnimatePresence>
                                      {isEditingThis && item.canModify && !item.isInvoiceLinked && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="mt-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                              <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                  <DollarSign size={11} /> Amount (৳)
                                                </label>
                                                <input
                                                  type="number"
                                                  min="1"
                                                  step="any"
                                                  value={editAmount}
                                                  onChange={e => setEditAmount(e.target.value)}
                                                  onWheel={e => e.currentTarget.blur()}
                                                  disabled={isSavingEdit}
                                                  className="w-full px-3 py-2 text-sm font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                  <Calendar size={11} /> Date
                                                </label>
                                                <input
                                                  type="date"
                                                  value={editDate}
                                                  onChange={e => setEditDate(e.target.value)}
                                                  disabled={isSavingEdit}
                                                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                  <Wallet size={11} /> Method
                                                </label>
                                                <select
                                                  value={editMethod}
                                                  onChange={e => setEditMethod(e.target.value)}
                                                  disabled={isSavingEdit}
                                                  className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                                                >
                                                  {methodOptions.map(m => (
                                                    <option key={m} value={m}>
                                                      {m === 'Bank' ? 'Bank Transfer' : m}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Notes
                                              </label>
                                              <input
                                                type="text"
                                                value={editNotes}
                                                onChange={e => setEditNotes(e.target.value)}
                                                disabled={isSavingEdit}
                                                placeholder="Optional payment note..."
                                                className="w-full px-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                                              />
                                            </div>

                                            <div className="flex items-center justify-end gap-2 pt-1">
                                              <button
                                                type="button"
                                                onClick={resetActionStates}
                                                disabled={isSavingEdit}
                                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSaveEdit(item)}
                                                disabled={isSavingEdit}
                                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
                                              >
                                                {isSavingEdit ? (
                                                  <Loader2 size={13} className="animate-spin" />
                                                ) : (
                                                  <Check size={13} />
                                                )}
                                                Save Changes
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    {/* Inline Delete Confirmation for Standalone / Opening Balance Payment */}
                                    <AnimatePresence>
                                      {isDeletingThis && item.canModify && !item.isInvoiceLinked && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="mt-1 p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                                              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                                              <span>
                                                Delete this <strong>৳{Math.round(item.amount).toLocaleString()}</strong> {item.displayRef} payment?{' '}
                                                <strong>৳{Math.round(item.amount).toLocaleString()}</strong> will be added back to the customer&apos;s due balance.
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 shrink-0">
                                              <button
                                                type="button"
                                                onClick={resetActionStates}
                                                disabled={isDeletingItem}
                                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleConfirmDelete(item)}
                                                disabled={isDeletingItem}
                                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
                                              >
                                                {isDeletingItem ? (
                                                  <Loader2 size={13} className="animate-spin" />
                                                ) : (
                                                  <Trash2 size={13} />
                                                )}
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap mt-0.5">
                          ৳{payment.credit ? Math.round(payment.credit).toLocaleString() : '0'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
