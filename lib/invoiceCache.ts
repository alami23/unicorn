import { supabase, getTenantId, getCurrentUser } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'
import { preload, mutate } from 'swr'

export interface FormattedInvoice {
  id: string
  displayId: string
  customer: string
  customerPhone?: string
  customerPhoto?: string
  customerAddress?: string
  date: string
  amount: number
  paid: number
  due: number
  status: 'Paid' | 'Partial' | 'Due'
  type: string
  originalType: string
  discount: number
  deliveryCharge: number
  deliveryDate?: string
  deliveryStatus?: 'Pending' | 'Delivered' | string
  items?: any[]
  paymentMethod?: string
  createdBy: string
}

export interface InvoiceQueryParams {
  type?: 'All' | 'Furniture' | 'Wood' | string | null
  searchTerm?: string
  status?: string
  dateRange?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface InvoiceQueryResult {
  invoices: FormattedInvoice[]
  totalCount: number
  hasMore: boolean
}

/**
 * Records the user who created an invoice into local storage, database table, and app_settings
 */
export async function recordInvoiceCreator(invoiceId: string, userName: string, userId?: string) {
  if (!invoiceId || !userName) return

  // 1. Update localStorage cache for immediate retrieval
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('invoice_creators')
      const map = stored ? JSON.parse(stored) : {}
      map[invoiceId] = userName
      const rawNumber = invoiceId.includes('_') ? invoiceId.split('_')[1] : invoiceId
      map[rawNumber] = userName
      localStorage.setItem('invoice_creators', JSON.stringify(map))
    } catch (e) {}
  }

  // 2. Direct database update to furniture_invoices or wood_invoices
  try {
    const isWood = invoiceId.includes('-W-')
    const tableName = isWood ? 'wood_invoices' : 'furniture_invoices'
    await supabase.from(tableName).update({
      created_by: userId || null,
      created_by_name: userName
    }).eq('id', invoiceId)
  } catch (e) {
    // Non-blocking fallback
  }

  // 3. Persist to app_settings in Supabase
  try {
    const tenantId = getTenantId()
    if (tenantId) {
      const { data: row } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', tenantId)
        .maybeSingle()

      const currentSettings = row?.settings || {}
      const invoiceCreators = currentSettings.invoice_creators || {}
      invoiceCreators[invoiceId] = userName
      const rawNumber = invoiceId.includes('_') ? invoiceId.split('_')[1] : invoiceId
      invoiceCreators[rawNumber] = userName
      currentSettings.invoice_creators = invoiceCreators

      await supabase.from('app_settings').upsert({
        id: tenantId,
        settings: currentSettings,
        updated_at: new Date().toISOString()
      })
    }
  } catch (e) {
    // Non-blocking fallback
  }
}

/**
 * Fetch all registered users in the organization from custom_users and app_settings
 */
export async function fetchOrgUsers(): Promise<Array<{ id: string; name: string; username?: string; role?: string }>> {
  const usersList: Array<{ id: string; name: string; username?: string; role?: string }> = []
  const seenIds = new Set<string>()

  try {
    const tenantId = getTenantId()
    let query = supabase.from('custom_users').select('id, name, username, role, org_id')
    if (tenantId) {
      query = query.eq('org_id', tenantId)
    }
    const { data } = await query
    if (data && Array.isArray(data)) {
      data.forEach((u: any) => {
        const id = String(u.id)
        if (id && !seenIds.has(id)) {
          seenIds.add(id)
          usersList.push({
            id,
            name: u.name || u.username || 'User',
            username: u.username,
            role: u.role
          })
        }
      })
    }
  } catch (e) {}

  try {
    const tenantId = getTenantId()
    const settingsQuery = tenantId
      ? supabase.from('app_settings').select('settings').eq('id', tenantId).maybeSingle()
      : supabase.from('app_settings').select('settings').limit(1).maybeSingle()

    const { data: row } = await settingsQuery
    if (row?.settings?.users && Array.isArray(row.settings.users)) {
      row.settings.users.forEach((u: any) => {
        const id = String(u.id || u.username)
        if (id && !seenIds.has(id)) {
          seenIds.add(id)
          usersList.push({
            id,
            name: u.name || u.username || 'User',
            username: u.username,
            role: u.roleId || u.role
          })
        }
      })
    }
  } catch (e) {}

  return usersList
}

export const formatInvoice = (
  inv: any,
  creatorsMap: Record<string, string> = {},
  usersMap: Record<string, string> = {},
  fallbackCreator: string = 'Unassigned'
): FormattedInvoice => {
  const invoiceNum = inv.invoice_number || (inv.id && inv.id.includes('_') ? inv.id.split('_')[1] : inv.id)

  let resolvedCreatedBy = ''

  // 1. Explicit created_by_name stored in the database row
  if (inv.created_by_name && typeof inv.created_by_name === 'string' && inv.created_by_name.trim()) {
    const trimmed = inv.created_by_name.trim()
    resolvedCreatedBy = usersMap[trimmed] || usersMap[trimmed.toLowerCase()] || trimmed
  }

  // 2. Resolve created_by (which holds the creator user UUID / ID or username)
  if (!resolvedCreatedBy && inv.created_by) {
    const key = String(inv.created_by).trim()
    const lowerKey = key.toLowerCase()
    if (usersMap[key]) {
      resolvedCreatedBy = usersMap[key]
    } else if (usersMap[lowerKey]) {
      resolvedCreatedBy = usersMap[lowerKey]
    } else if (!/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(key) && !/^u\d+$/i.test(key)) {
      resolvedCreatedBy = key
    }
  }

  // 3. Resolve from creatorsMap (persisted in app_settings or localStorage)
  if (!resolvedCreatedBy) {
    if (inv.id && creatorsMap[inv.id]) {
      resolvedCreatedBy = creatorsMap[inv.id]
    } else if (invoiceNum && creatorsMap[invoiceNum]) {
      resolvedCreatedBy = creatorsMap[invoiceNum]
    }
  }

  // 4. Resolve from nested creator or user objects
  if (!resolvedCreatedBy) {
    const candidate = inv.creator_name || inv.creator?.name || inv.creator || inv.user_name || inv.user?.name
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      resolvedCreatedBy = candidate.trim()
    }
  }

  // 5. Final fallback (e.g. 'Unassigned' - never default to Super Admin)
  if (!resolvedCreatedBy) {
    resolvedCreatedBy = fallbackCreator || 'Unassigned'
  }

  return {
    id: inv.id,
    displayId: getDisplayInvoiceId(inv.id),
    customer: inv.customer_name,
    customerPhone: inv.customer_phone,
    customerPhoto: inv.customer?.photo,
    customerAddress: inv.customer_address,
    date: inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : '',
    amount: Number(inv.total || 0),
    paid: Number(inv.paid_amount || 0),
    due: Number(inv.due_amount || 0),
    status: Number(inv.due_amount || 0) === 0 ? 'Paid' : (Number(inv.paid_amount || 0) > 0 ? 'Partial' : 'Due'),
    type: inv.type === 'solo_wood' ? 'Wood' : (inv.type || 'Invoice'),
    originalType: inv.type,
    discount: Number(inv.discount || 0),
    deliveryCharge: Number(inv.delivery_charge || 0),
    deliveryDate: inv.delivery_date,
    deliveryStatus: inv.delivery_status || 'Pending',
    items: inv.items,
    paymentMethod: inv.payment_method,
    createdBy: resolvedCreatedBy
  }
}

export const getInvoiceCacheKey = (params: InvoiceQueryParams = {}): string => {
  const normType = !params.type || params.type === 'All' ? 'All' : (params.type === 'Wood' ? 'Wood' : 'Furniture')
  const search = (params.searchTerm || '').trim().toLowerCase()
  const status = params.status || 'All'
  const dateRange = params.dateRange || 'All time'
  const start = params.startDate || ''
  const end = params.endDate || ''
  const page = params.page || 0
  const limit = params.limit || (page === 0 ? 12 : 10)

  return `invoices:${normType}:${search}:${status}:${dateRange}:${start}:${end}:${page}:${limit}`
}

export const buildInvoiceQuery = (tableName: string, params: InvoiceQueryParams) => {
  let q = supabase
    .from(tableName)
    .select('*, customer(photo)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.searchTerm) {
    q = q.or(`id.ilike.%${params.searchTerm}%,customer_name.ilike.%${params.searchTerm}%`)
  }

  if (params.status && params.status !== 'All') {
    if (params.status === 'Paid') {
      q = q.eq('due_amount', 0)
    } else if (params.status === 'Partial') {
      q = q.gt('paid_amount', 0).gt('due_amount', 0)
    } else if (params.status === 'Due') {
      q = q.eq('paid_amount', 0).gt('due_amount', 0)
    }
  }

  if (params.dateRange && params.dateRange !== 'All time') {
    const now = new Date()
    if (params.dateRange === 'Today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString()
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString()
      q = q.gte('created_at', startOfDay).lte('created_at', endOfDay)
    } else if (params.dateRange === 'Last 7 Days') {
      const startRange = new Date(now)
      startRange.setDate(now.getDate() - 7)
      startRange.setHours(0, 0, 0, 0)
      q = q.gte('created_at', startRange.toISOString())
    } else if (params.dateRange === 'This Month') {
      const startRange = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endRange = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
      q = q.gte('created_at', startRange).lte('created_at', endRange)
    } else if (params.dateRange === 'Custom') {
      if (params.startDate) q = q.gte('created_at', new Date(params.startDate).toISOString())
      if (params.endDate) {
        const endRange = new Date(params.endDate)
        endRange.setHours(23, 59, 59, 999)
        q = q.lte('created_at', endRange.toISOString())
      }
    }
  }

  return q
}

export async function fetchInvoicesData(params: InvoiceQueryParams = {}): Promise<InvoiceQueryResult> {
  const currentPage = params.page || 0
  const limit = params.limit || (currentPage === 0 ? 12 : 10)
  const start = currentPage === 0 ? 0 : 12 + (currentPage - 1) * 10
  const end = start + limit - 1

  const normType = !params.type || params.type === 'All' ? 'All' : (params.type === 'Wood' ? 'Wood' : 'Furniture')

  let rawData: any[] = []
  let totalCount = 0

  if (normType === 'All') {
    const [furnRes, woodRes] = await Promise.all([
      buildInvoiceQuery('furniture_invoices', params).range(0, start + limit - 1),
      buildInvoiceQuery('wood_invoices', params).range(0, start + limit - 1)
    ])

    if (furnRes.error) throw furnRes.error
    if (woodRes.error) throw woodRes.error

    const combined = [...(furnRes.data || []), ...(woodRes.data || [])].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    rawData = combined.slice(start, end + 1)
    totalCount = (furnRes.count || 0) + (woodRes.count || 0)
  } else if (normType === 'Furniture') {
    const res = await buildInvoiceQuery('furniture_invoices', params).range(start, end)
    if (res.error) throw res.error
    rawData = res.data || []
    totalCount = res.count || 0
  } else if (normType === 'Wood') {
    const res = await buildInvoiceQuery('wood_invoices', params).range(start, end)
    if (res.error) throw res.error
    rawData = res.data || []
    totalCount = res.count || 0
  }

  // 1. Load users map from custom_users table and app_settings
  const usersMap: Record<string, string> = {}
  try {
    const tenantId = getTenantId()
    let userQuery = supabase.from('custom_users').select('id, name, username, email, phone, role, org_id')
    if (tenantId) {
      userQuery = userQuery.eq('org_id', tenantId)
    }
    const { data: uData } = await userQuery
    if (uData && Array.isArray(uData)) {
      uData.forEach((u: any) => {
        const displayName = u.name?.trim() || u.username?.trim() || u.email?.trim()
        if (displayName) {
          if (u.id) usersMap[String(u.id)] = displayName
          if (u.username) usersMap[String(u.username).toLowerCase()] = displayName
          if (u.email) usersMap[String(u.email).toLowerCase()] = displayName
        }
      })
    }
  } catch (e) {
    console.warn('Could not fetch custom_users in fetchInvoicesData:', e)
  }

  // 2. Load invoice creators map from localStorage & app_settings
  let creatorsMap: Record<string, string> = {}
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('invoice_creators')
      if (stored) creatorsMap = JSON.parse(stored)
    } catch (e) {}
  }

  try {
    const tenantId = getTenantId()
    const settingsQuery = tenantId
      ? supabase.from('app_settings').select('settings').eq('id', tenantId).maybeSingle()
      : supabase.from('app_settings').select('settings').limit(1).maybeSingle()

    const { data: settingsRow } = await settingsQuery
    if (settingsRow?.settings) {
      if (settingsRow.settings.invoice_creators) {
        creatorsMap = { ...settingsRow.settings.invoice_creators, ...creatorsMap }
      }
      if (settingsRow.settings.users && Array.isArray(settingsRow.settings.users)) {
        settingsRow.settings.users.forEach((u: any) => {
          const displayName = u.name?.trim() || u.username?.trim() || u.email?.trim()
          if (displayName) {
            if (u.id) usersMap[String(u.id)] = displayName
            if (u.username) usersMap[String(u.username).toLowerCase()] = displayName
            if (u.email) usersMap[String(u.email).toLowerCase()] = displayName
          }
        })
      }
    }
  } catch (e) {
    // Non-blocking fallback
  }

  // Never default unassigned invoices to the Super Admin
  const fallbackCreator = 'Unassigned'

  const invoices = rawData.map(inv => formatInvoice(inv, creatorsMap, usersMap, fallbackCreator))
  const hasMore = start + rawData.length < totalCount

  return {
    invoices,
    totalCount,
    hasMore
  }
}

/**
 * Preload invoices in the background immediately after login or on app initialization.
 * Caches initial page for Wood, Furniture, and All invoices using SWR.
 */
let isPreloading = false
export async function preloadInvoicesBackground() {
  if (isPreloading) return
  isPreloading = true

  try {
    const defaultParams = { page: 0 }

    // Preload into SWR cache using SWR mutate & preload
    const woodKey = getInvoiceCacheKey({ type: 'Wood', ...defaultParams })
    const furnitureKey = getInvoiceCacheKey({ type: 'Furniture', ...defaultParams })
    const allKey = getInvoiceCacheKey({ type: 'All', ...defaultParams })

    // Execute in parallel in the background
    await Promise.allSettled([
      mutate(woodKey, fetchInvoicesData({ type: 'Wood', ...defaultParams }), { revalidate: false }),
      mutate(furnitureKey, fetchInvoicesData({ type: 'Furniture', ...defaultParams }), { revalidate: false }),
      mutate(allKey, fetchInvoicesData({ type: 'All', ...defaultParams }), { revalidate: false })
    ])
  } catch (error) {
    console.warn('Background invoice preload warning:', error)
  } finally {
    isPreloading = false
  }
}

/**
 * Invalidate all invoice cache entries (e.g. after payment, edit, or delete)
 */
export function invalidateInvoiceCache() {
  mutate(
    (key) => typeof key === 'string' && key.startsWith('invoices:'),
    undefined,
    { revalidate: true }
  )
}
