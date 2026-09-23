'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck,
  Calendar,
  ChevronRight,
  RefreshCw,
  Check,
  CheckCircle2,
  PackageCheck
} from 'lucide-react'
import { format, differenceInCalendarDays, parseISO, isValid } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getTenantId, supabase, rawSupabase } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'

export interface UpcomingDelivery {
  id: string
  invoiceId: string
  displayInvoiceId: string
  customerName?: string
  deliveryDate: string // YYYY-MM-DD
  deliveryStatus: 'Pending' | 'Delivered'
}

interface UpcomingDeliveriesWidgetProps {
  className?: string
  maxItems?: number
}

// Helper to normalize any incoming delivery date representation to YYYY-MM-DD
function extractNormalizedDeliveryDate(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null

  // Check all common field naming variations
  const rawDate = 
    obj.delivery_date || 
    obj.deliveryDate || 
    obj.delivery_Date || 
    obj.DeliveryDate || 
    obj.delivery_time ||
    obj.deliveryDateTime

  if (!rawDate) return null

  const str = String(rawDate).trim()
  if (!str || str === 'null' || str === 'undefined' || str === '-') return null

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  // Handle ISO string or full datetime
  try {
    const parsed = new Date(str)
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd')
    }
  } catch {}

  // Match YYYY-MM-DD prefix if string starts with it (e.g. 2026-09-25T14:30:00Z)
  const prefixMatch = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (prefixMatch) {
    return prefixMatch[1]
  }

  return null
}

export default function UpcomingDeliveriesWidget({
  className,
  maxItems
}: UpcomingDeliveriesWidgetProps) {
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<UpcomingDelivery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Fetch real furniture deliveries directly from Supabase
  const fetchDeliveries = useCallback(async () => {
    setIsRefreshing(true)
    try {
      if (!supabase) {
        setDeliveries([])
        return
      }

      const tenantId = getTenantId()
      let query = supabase
        .from('furniture_invoices')
        .select('id, invoice_number, customer_name, delivery_date, delivery_status, created_at, org_id')
        .not('delivery_date', 'is', null)
        .neq('delivery_status', 'Delivered')
        .order('delivery_date', { ascending: true })
        .limit(500)

      if (tenantId) {
        query = query.eq('org_id', tenantId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching live deliveries from Supabase:', error)
        return
      }

      if (data && Array.isArray(data)) {
        const itemsMap = new Map<string, UpcomingDelivery>()

        data.forEach((inv: any) => {
          const dDate = extractNormalizedDeliveryDate(inv)
          if (!dDate) return

          const idStr = String(inv.id || inv.invoice_number).trim()
          const displayId = getDisplayInvoiceId(inv.invoice_number || inv.id)

          // Filter out wood orders or delivered records
          if (
            displayId.includes('-W-') ||
            idStr.includes('-W-') ||
            inv.delivery_status?.toLowerCase() === 'delivered'
          ) {
            return
          }

          const uniqueKey = displayId || idStr
          itemsMap.set(uniqueKey, {
            id: idStr,
            invoiceId: idStr,
            displayInvoiceId: displayId,
            customerName: inv.customer_name?.trim() || 'Customer',
            deliveryDate: dDate,
            deliveryStatus: 'Pending'
          })
        })

        setDeliveries(Array.from(itemsMap.values()))
      } else {
        setDeliveries([])
      }
    } catch (err) {
      console.error('Error loading furniture deliveries:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDeliveries()

    // Realtime Supabase Subscription for furniture_invoices changes
    let channel: any = null
    try {
      const client = rawSupabase || supabase
      if (client?.channel) {
        channel = client
          .channel('realtime_furniture_deliveries')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'furniture_invoices'
            },
            () => {
              fetchDeliveries()
            }
          )
          .subscribe()
      }
    } catch (subErr) {
      console.warn('Realtime subscription initialization notice:', subErr)
    }

    // App-level event listeners for fast local UI feedback
    const handleCustomUpdate = () => {
      fetchDeliveries()
    }

    window.addEventListener('invoice-created', handleCustomUpdate)
    window.addEventListener('delivery-status-changed', handleCustomUpdate)

    return () => {
      if (channel && channel.unsubscribe) {
        channel.unsubscribe()
      }
      window.removeEventListener('invoice-created', handleCustomUpdate)
      window.removeEventListener('delivery-status-changed', handleCustomUpdate)
    }
  }, [fetchDeliveries])

  // DYNAMIC SORTING & FILTERING REQUIREMENT:
  // 1. Filter out all completed ('Delivered') deliveries so only 'Pending' deliveries are displayed.
  // 2. Sort pending deliveries by closest delivery date first.
  // 3. No display limits applied when maxItems is omitted, showing all pending deliveries in the scrollable list.
  const sortedDeliveries = useMemo(() => {
    const validItems = deliveries.filter((item) => Boolean(item.deliveryDate))

    const pending = validItems
      .filter((item) => item.deliveryStatus === 'Pending')
      .sort((a, b) => {
        const timeA = new Date(a.deliveryDate).getTime()
        const timeB = new Date(b.deliveryDate).getTime()
        if (isNaN(timeA)) return 1
        if (isNaN(timeB)) return -1
        return timeA - timeB // Closest delivery date at the top
      })

    return maxItems ? pending.slice(0, maxItems) : pending
  }, [deliveries, maxItems])

  // Counts for pending deliveries
  const pendingCount = useMemo(() => {
    return sortedDeliveries.length
  }, [sortedDeliveries])

  // DYNAMIC PROXIMITY CALCULATION:
  // Shows proximity tags ("Today", "Tomorrow", "In Xd"), and for past delivery dates,
  // displays only the number of days passed (e.g. "3d", "1d") without the text "overdue".
  const getProximityLabel = (dateStr: string) => {
    try {
      const deliveryDate = new Date(dateStr + 'T00:00:00')
      if (!isValid(deliveryDate)) return null

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diff = differenceInCalendarDays(deliveryDate, today)

      if (diff === 0) {
        return {
          label: 'Today',
          className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 font-bold'
        }
      } else if (diff === 1) {
        return {
          label: 'Tomorrow',
          className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 font-semibold'
        }
      } else if (diff > 1 && diff <= 3) {
        return {
          label: `In ${diff}d`,
          className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium'
        }
      } else if (diff > 3) {
        return {
          label: `In ${diff}d`,
          className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 font-medium'
        }
      } else {
        // diff < 0: Days passed since delivery date. Retain the day count only, without "overdue".
        const daysPassed = Math.abs(diff)
        return {
          label: `${daysPassed}d`,
          className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 font-semibold'
        }
      }
    } catch {
      return null
    }
  }

  // "Mark Delivered" action: updates status to Delivered and moves to bottom automatically
  const handleMarkAsDelivered = async (e: React.MouseEvent, delivery: UpcomingDelivery) => {
    e.stopPropagation() // Prevent triggering row click navigation
    if (updatingId || delivery.deliveryStatus === 'Delivered') return

    setUpdatingId(delivery.id)

    try {
      // 1. Persist update directly in Supabase furniture_invoices table
      if (supabase) {
        try {
          if (delivery.invoiceId && !delivery.invoiceId.startsWith('loc-')) {
            await supabase
              .from('furniture_invoices')
              .update({ delivery_status: 'Delivered' } as any)
              .eq('id', delivery.invoiceId)
          }
          if (delivery.displayInvoiceId) {
            await supabase
              .from('furniture_invoices')
              .update({ delivery_status: 'Delivered' } as any)
              .eq('invoice_number', delivery.displayInvoiceId)
          }
        } catch (dbErr) {
          console.warn('Supabase furniture delivery_status update notice:', dbErr)
        }
      }

      // 2. Immediate optimistic update in local state (removes/marks delivered)
      setDeliveries((prev) =>
        prev.filter((item) => item.id !== delivery.id && item.invoiceId !== delivery.invoiceId && item.displayInvoiceId !== delivery.displayInvoiceId)
      )

      // 3. Top-screen success toast notification with invoice ID and 3.5s auto-dismiss
      const targetInvoiceId = delivery.displayInvoiceId || delivery.invoiceId
      toast.success(`Invoice #${targetInvoiceId} marked as Delivered`, {
        description: delivery.customerName ? `Customer: ${delivery.customerName}` : 'Delivery status successfully updated',
        duration: 3500,
        position: 'top-center',
      })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('delivery-status-changed', { detail: { id: delivery.id, status: 'Delivered' } }))
      }
    } catch (err) {
      console.error('Failed to mark delivery as delivered:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  // Route directly to corresponding invoice view
  const handleRouteToInvoice = (delivery: UpcomingDelivery) => {
    const searchTarget = delivery.displayInvoiceId || delivery.invoiceId
    router.push(`/invoice?type=Furniture&search=${encodeURIComponent(searchTarget)}&open=true`)
  }

  return (
    <div
      id="upcoming-product-deliveries-widget"
      className={cn(
        'bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col h-full',
        className
      )}
    >
      {/* Compact Minimal Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-slate-50 tracking-tight leading-none truncate">
              Upcoming Deliveries
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 ? (
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
              {pendingCount} Pending
            </span>
          ) : (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center gap-1">
              <PackageCheck size={12} />
              All Clear
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchDeliveries()}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 transition-colors cursor-pointer"
            title="Refresh Deliveries"
            aria-label="Refresh Deliveries"
          >
            <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin text-amber-500')} />
          </button>
        </div>
      </div>

      {/* Real Furniture Delivery Rows (Scrollable for all pending deliveries) */}
      {isLoading ? (
        <div className="flex-1 min-h-[220px] flex items-center justify-center gap-2 text-xs text-slate-400">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading furniture deliveries...</span>
        </div>
      ) : sortedDeliveries.length === 0 ? (
        <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
          <Truck className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            No upcoming furniture deliveries scheduled.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Scheduled deliveries on furniture invoices will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[520px] pr-1.5 scrollbar-thin">
          {sortedDeliveries.map((item, idx) => {
            const proximity = getProximityLabel(item.deliveryDate)
            let formattedDate = item.deliveryDate
            try {
              const parsed = parseISO(item.deliveryDate)
              if (isValid(parsed)) {
                formattedDate = format(parsed, 'dd MMM yyyy')
              }
            } catch {}

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                id={`delivery-row-${idx}`}
                onClick={() => handleRouteToInvoice(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleRouteToInvoice(item)
                  }
                }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all text-left group cursor-pointer bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 hover:border-amber-300/70 dark:hover:border-amber-700/60"
                title={`Click to view invoice ${item.displayInvoiceId}`}
              >
                {/* Left: Index & Invoice ID */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold shrink-0',
                      idx === 0
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-xs sm:text-sm tracking-tight truncate block text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {item.displayInvoiceId}
                    </span>
                    {item.customerName && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        {item.customerName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Scheduled Delivery Date, Proximity & Mark Delivered Action */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {proximity && (
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-md',
                        proximity.className
                      )}
                    >
                      {proximity.label}
                    </span>
                  )}
                  <div className="flex items-center gap-1 font-medium text-xs text-slate-600 dark:text-slate-300">
                    <Calendar size={12} className="text-amber-500 shrink-0" />
                    <span>{formattedDate}</span>
                  </div>

                  {/* Mark Delivered Action Button (Compact circular icon button) */}
                  <button
                    type="button"
                    id={`mark-delivered-btn-${item.id}`}
                    onClick={(e) => handleMarkAsDelivered(e, item)}
                    disabled={updatingId === item.id}
                    title="Mark as Delivered"
                    aria-label={`Mark delivery for invoice ${item.displayInvoiceId} as delivered`}
                    className="w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all cursor-pointer border bg-white dark:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400/60 dark:hover:border-emerald-500/50 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                  >
                    {updatingId === item.id ? (
                      <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Check size={13} className="stroke-[2.5]" />
                    )}
                  </button>

                  <ChevronRight
                    size={14}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all ml-0.5 shrink-0"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
