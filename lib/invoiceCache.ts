import { supabase, getTenantId, getCurrentUser } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'
import { registerInvoiceCacheInvalidator } from '@/lib/supabaseCache'
import { preload, mutate } from 'swr'

export type InvoiceCategory = 'Furniture' | 'Wood'
export type InvoiceTypeFilter = 'All' | InvoiceCategory
export const ALL_INVOICE_CATEGORIES: readonly InvoiceCategory[] = ['Furniture', 'Wood']

export interface FormattedInvoice {
  id: string
  displayId: string
  customer: string
  customerId?: string | null
  customer_id?: string | null
  customerPhone?: string
  customerPhoto?: string
  customerAddress?: string
  date: string
  createdAt?: string
  amount: number
  paid: number
  due: number
  status: 'Paid' | 'Partial' | 'Due'
  type: InvoiceCategory | string
  originalType: string
  discount: number
  deliveryCharge: number
  deliveryDate?: string
  deliveryStatus?: 'Pending' | 'Delivered' | string
  items?: any[]
  paymentMethod?: string
  createdBy: string
}

/**
 * Parses a category filter (string, comma-separated list, or array) into a canonical,
 * non-empty list of included categories without mutual exclusion.
 * Examples:
 * - null / '' / 'All' / 'All Invoices' / 'Furniture,Wood' -> ['Furniture', 'Wood']
 * - 'Furniture' -> ['Furniture']
 * - 'Wood' / 'solo_wood' -> ['Wood']
 */
export const parseInvoiceCategories = (
  input?: string | readonly (InvoiceCategory | string)[] | null
): InvoiceCategory[] => {
  const included = new Set<InvoiceCategory>()

  const tokens = Array.isArray(input)
    ? input.map(v => String(v || '').trim().toLowerCase()).filter(Boolean)
    : String(input || '')
        .split(',')
        .map(v => v.trim().toLowerCase())
        .filter(Boolean)

  if (tokens.length === 0) {
    return [...ALL_INVOICE_CATEGORIES]
  }

  for (const token of tokens) {
    if (token === 'all' || token === 'all invoices' || token === 'all_invoices') {
      included.add('Furniture')
      included.add('Wood')
    } else if (
      token === 'wood' ||
      token === 'wood invoices' ||
      token === 'wood invoice' ||
      token === 'solo_wood' ||
      token === 'wood_invoices'
    ) {
      included.add('Wood')
    } else if (
      token === 'furniture' ||
      token === 'furniture invoices' ||
      token === 'furniture invoice' ||
      token === 'furniture_invoices'
    ) {
      included.add('Furniture')
    }
  }

  if (included.size === 0) {
    return [...ALL_INVOICE_CATEGORIES]
  }

  return ALL_INVOICE_CATEGORIES.filter(cat => included.has(cat))
}

export const categoriesToTypeFilter = (categories: readonly InvoiceCategory[]): InvoiceTypeFilter => {
  const hasFurniture = categories.includes('Furniture')
  const hasWood = categories.includes('Wood')
  if ((hasFurniture && hasWood) || (!hasFurniture && !hasWood)) {
    return 'All'
  }
  return hasFurniture ? 'Furniture' : 'Wood'
}

export const normalizeInvoiceTypeFilter = (type?: string | null): InvoiceTypeFilter => {
  return categoriesToTypeFilter(parseInvoiceCategories(type))
}

export const resolveQueryCategories = (params: InvoiceQueryParams = {}): InvoiceCategory[] => {
  if (params.categories && params.categories.length > 0) {
    return parseInvoiceCategories(params.categories)
  }
  return parseInvoiceCategories(params.type)
}

export const getInvoiceCompositeKey = (inv: Pick<FormattedInvoice, 'id' | 'type'>): string =>
  `${inv.type || 'Invoice'}:${inv.id}`

export interface InvoiceQueryParams {
  type?: InvoiceTypeFilter | string | null
  categories?: readonly InvoiceCategory[]
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
  hasExactCount?: boolean
  categoryCounts?: Partial<Record<InvoiceCategory, number>>
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
  fallbackCreator: string = 'Unassigned',
  sourceCategory?: InvoiceCategory
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

  const effectiveSource = sourceCategory || inv._sourceCategory
  const rawTypeLower = String(inv.type || '').trim().toLowerCase()
  const resolvedType: InvoiceCategory =
    effectiveSource === 'Wood'
      ? 'Wood'
      : effectiveSource === 'Furniture'
        ? 'Furniture'
        : rawTypeLower === 'wood' || rawTypeLower === 'solo_wood' || String(inv.id || '').includes('-W-')
          ? 'Wood'
          : 'Furniture'

  const parsedCreatedAt = inv.created_at ? new Date(inv.created_at) : null
  const formattedDate =
    parsedCreatedAt && !Number.isNaN(parsedCreatedAt.getTime())
      ? parsedCreatedAt.toISOString().split('T')[0]
      : ''

  return {
    id: inv.id,
    displayId: getDisplayInvoiceId(inv.invoice_number || inv.id, resolvedType === 'Wood'),
    customer: inv.customer_name,
    customerId: inv.customer_id || null,
    customer_id: inv.customer_id || null,
    customerPhone: inv.customer_phone,
    customerPhoto: inv.customer?.photo,
    customerAddress: inv.customer_address,
    date: formattedDate,
    createdAt: inv.created_at || '',
    amount: Number(inv.total || 0),
    paid: Number(inv.paid_amount || 0),
    due: Number(inv.due_amount || 0),
    status: Number(inv.due_amount || 0) === 0 ? 'Paid' : (Number(inv.paid_amount || 0) > 0 ? 'Partial' : 'Due'),
    type: resolvedType,
    originalType: inv.type || resolvedType,
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
  const tenantId = getTenantId() || 'anon'
  const normType = categoriesToTypeFilter(resolveQueryCategories(params))
  const search = (params.searchTerm || '').trim().toLowerCase()
  const status = params.status || 'All'
  const dateRange = params.dateRange || 'All time'
  const start = params.startDate || ''
  const end = params.endDate || ''
  const page = params.page || 0
  const limit = params.limit || (page === 0 ? 12 : 10)

  return `invoices:${tenantId}:${normType}:${search}:${status}:${dateRange}:${start}:${end}:${page}:${limit}`
}

const getSafeTimestamp = (inv: any): number => {
  const raw = inv?.created_at || inv?.createdAt || inv?.date
  if (!raw) return 0
  const ts = new Date(raw).getTime()
  return Number.isFinite(ts) ? ts : 0
}

export const compareInvoiceIdsDesc = (a: any, b: any): number => {
  const idA = getDisplayInvoiceId(a?.invoice_number || a?.displayId || a?.id, true)
  const idB = getDisplayInvoiceId(b?.invoice_number || b?.displayId || b?.id, true)

  const matchA = idA.match(/#?INV-[WF]-(\d{4})(\d+)/i)
  const matchB = idB.match(/#?INV-[WF]-(\d{4})(\d+)/i)

  if (matchA && matchB) {
    const yymmDiff = parseInt(matchB[1], 10) - parseInt(matchA[1], 10)
    if (yymmDiff !== 0) return yymmDiff
    const serialDiff = parseInt(matchB[2], 10) - parseInt(matchA[2], 10)
    if (serialDiff !== 0) return serialDiff
  }

  const cmp = idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' })
  if (cmp !== 0) return cmp

  return getSafeTimestamp(b) - getSafeTimestamp(a)
}

interface BuildInvoiceQueryOptions {
  includeCustomerPhoto?: boolean
  includeInvoiceNumberSearch?: boolean
}

export const buildInvoiceQuery = (
  tableName: string,
  params: InvoiceQueryParams,
  options: BuildInvoiceQueryOptions = {}
) => {
  const { includeCustomerPhoto = true, includeInvoiceNumberSearch = true } = options

  let q = supabase
    .from(tableName)
    .select(includeCustomerPhoto ? '*, customer(photo)' : '*', { count: 'exact' })

  // Use identical deterministic primary ordering across both tables so combined
  // aggregation merges furniture_invoices and wood_invoices without dropping or skewing either category.
  q = q.order('created_at', { ascending: false }).order('id', { ascending: false })

  if (params.searchTerm) {
    const rawSearch = params.searchTerm.trim().replace(/[,()]/g, '')
    const cleanInvSearch = rawSearch.replace(/^#+/, '')
    if (cleanInvSearch && includeInvoiceNumberSearch) {
      q = q.or(`id.ilike.%${cleanInvSearch}%,invoice_number.ilike.%${cleanInvSearch}%,customer_name.ilike.%${rawSearch}%`)
    } else if (cleanInvSearch) {
      q = q.or(`id.ilike.%${cleanInvSearch}%,customer_name.ilike.%${rawSearch}%`)
    } else if (rawSearch) {
      q = q.or(`id.ilike.%${rawSearch}%,customer_name.ilike.%${rawSearch}%`)
    }
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
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
      q = q.gte('created_at', startOfDay).lte('created_at', endOfDay)
    } else if (params.dateRange === 'Last 7 Days') {
      const startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0)
      q = q.gte('created_at', startRange.toISOString())
    } else if (params.dateRange === 'This Month') {
      const startRange = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString()
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

async function executeInvoiceTableQuery(
  tableName: 'furniture_invoices' | 'wood_invoices',
  category: InvoiceCategory,
  params: InvoiceQueryParams,
  rangeStart: number,
  rangeEnd: number
) {
  let res = await buildInvoiceQuery(tableName, params).range(rangeStart, rangeEnd)

  // Graceful fallback if a live table is missing the customer FK relationship (PGRST200)
  // or legacy invoice_number column (42703), preventing one category from silently vanishing.
  if (res.error) {
    const errMsg = `${res.error.code || ''} ${res.error.message || ''} ${res.error.details || ''}`.toLowerCase()
    const isRelationshipErr = errMsg.includes('pgrst200') || errMsg.includes('relationship') || errMsg.includes('customer')
    const isInvoiceNumColErr = errMsg.includes('42703') || errMsg.includes('invoice_number')

    if (isRelationshipErr || isInvoiceNumColErr) {
      res = await buildInvoiceQuery(tableName, params, {
        includeCustomerPhoto: !isRelationshipErr,
        includeInvoiceNumberSearch: !isInvoiceNumColErr
      }).range(rangeStart, rangeEnd)
    }
  }

  const rows = res.error
    ? []
    : (res.data || []).map((row: any) => ({ ...row, _sourceCategory: category }))

  const hasExactCount = !res.error && typeof res.count === 'number'

  return {
    category,
    rows,
    count: res.error ? 0 : (res.count ?? rows.length),
    hasExactCount,
    error: res.error
  }
}

export async function fetchInvoicesData(params: InvoiceQueryParams = {}): Promise<InvoiceQueryResult> {
  const currentPage = params.page || 0
  const limit = params.limit || (currentPage === 0 ? 12 : 10)
  const start = currentPage === 0 ? 0 : 12 + (currentPage - 1) * 10
  const end = start + limit - 1

  const selectedCategories = resolveQueryCategories(params)
  const includeFurniture = selectedCategories.includes('Furniture')
  const includeWood = selectedCategories.includes('Wood')
  const isAggregated = includeFurniture && includeWood

  // Fetch all selected category tables concurrently without mutually exclusive branching.
  // When aggregating multiple tables, query [0..end] from each identically ordered table
  // so the global top [start..end] slice is mathematically exact across both categories.
  const queryStart = isAggregated ? 0 : start
  const tasks: Array<ReturnType<typeof executeInvoiceTableQuery>> = []
  if (includeFurniture) {
    tasks.push(executeInvoiceTableQuery('furniture_invoices', 'Furniture', params, queryStart, end))
  }
  if (includeWood) {
    tasks.push(executeInvoiceTableQuery('wood_invoices', 'Wood', params, queryStart, end))
  }

  const results = await Promise.all(tasks)
  const succeeded = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)

  if (succeeded.length === 0 && failed.length > 0) {
    throw failed[0].error
  }
  for (const f of failed) {
    console.error(`Failed to fetch ${f.category} invoices:`, f.error)
  }

  const categoryCounts: Partial<Record<InvoiceCategory, number>> = {}
  let totalCount = 0
  for (const r of results) {
    categoryCounts[r.category] = r.count
    totalCount += r.count
  }

  let rawData: any[] = []
  if (isAggregated) {
    const combined = results
      .flatMap(r => r.rows)
      .sort((a, b) => {
        const timeDiff = getSafeTimestamp(b) - getSafeTimestamp(a)
        if (timeDiff !== 0) return timeDiff
        return compareInvoiceIdsDesc(a, b)
      })
    rawData = combined.slice(start, end + 1)
  } else {
    const singleRows = results[0]?.rows || []
    rawData = includeWood && !includeFurniture
      ? [...singleRows].sort(compareInvoiceIdsDesc)
      : singleRows
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

  const invoices = rawData.map(inv =>
    formatInvoice(inv, creatorsMap, usersMap, fallbackCreator, inv._sourceCategory)
  )
  const hasExactCount = succeeded.length > 0 && succeeded.every(r => r.hasExactCount)
  const hasMore = hasExactCount
    ? start + rawData.length < totalCount
    : rawData.length >= limit

  return {
    invoices,
    totalCount,
    hasMore,
    hasExactCount,
    categoryCounts
  }
}

/**
 * Preload invoices in the background immediately after login or on app initialization.
 * Caches initial page for Wood, Furniture, and All invoices using SWR.
 */
let isPreloading = false
export async function preloadInvoicesBackground() {
  if (isPreloading || !getTenantId()) return
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

/**
 * Synchronously clear all SWR invoice cache entries without revalidating (used on logout / tenant switch)
 */
export function clearInvoiceCache() {
  mutate(
    (key) => typeof key === 'string' && key.startsWith('invoices:'),
    undefined,
    { revalidate: false }
  )
}

// Hook SWR invoice cache invalidation into automatic Supabase write invalidation
registerInvoiceCacheInvalidator(invalidateInvoiceCache)
