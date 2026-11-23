/**
 * Tenant-scoped Stale-While-Revalidate (SWR) in-memory response cache &
 * Service Worker cache synchronization for Supabase REST calls.
 *
 * Strictly partitioned by org_id so multi-tenant data can never leak across tenants,
 * and automatically invalidates affected tables on every write (POST/PATCH/PUT/DELETE).
 */

interface CachedHttpEntry {
  orgId: string
  table: string
  status: number
  statusText: string
  headers: Array<[string, string]>
  body: string
  cachedAt: number
}

const FRESH_TTL_MS = 15 * 1000 // 15s: return instantaneously without revalidation
const STALE_TTL_MS = 5 * 60 * 1000 // 5m: return instantaneously + silently revalidate in background
const MAX_ENTRIES = 180
const MAX_BODY_CHARS = 2 * 1024 * 1024 // 2MB cap per cached entry

const TABLE_INVALIDATION_GRAPH: Record<string, string[]> = {
  furniture_invoices: ['furniture_invoices', 'furniture_invoice_items', 'furniture_inventory', 'customer', 'transactions'],
  furniture_invoice_items: ['furniture_invoices', 'furniture_invoice_items', 'furniture_inventory'],
  wood_invoices: ['wood_invoices', 'wood_invoice_items', 'wood_inventory', 'customer', 'transactions'],
  wood_invoice_items: ['wood_invoices', 'wood_invoice_items', 'wood_inventory'],
  transactions: ['transactions', 'customer', 'furniture_invoices', 'wood_invoices'],
  customer: ['customer', 'transactions', 'furniture_invoices', 'wood_invoices'],
  furniture_inventory: ['furniture_inventory', 'furniture_category'],
  furniture_category: ['furniture_category', 'furniture_inventory'],
  wood_inventory: ['wood_inventory', 'wood_category', 'wood_category_car', 'wood_category_tag'],
  wood_category: ['wood_category', 'wood_inventory'],
  wood_category_car: ['wood_category_car', 'wood_inventory'],
  wood_category_tag: ['wood_category_tag', 'wood_inventory'],
  bills: ['bills', 'vendors', 'categories'],
  vendors: ['vendors', 'bills'],
  categories: ['categories', 'bills'],
  staff: ['staff'],
  app_settings: ['app_settings'],
  sms_history: ['sms_history'],
}

const INVOICE_SWR_TRIGGER_TABLES = new Set([
  'furniture_invoices',
  'wood_invoices',
  'furniture_invoice_items',
  'wood_invoice_items',
  'customer',
  'transactions',
])

const responseCache = new Map<string, CachedHttpEntry>()
const inFlightRequests = new Map<string, Promise<CachedHttpEntry | null>>()
const revalidatingKeys = new Set<string>()
let invoiceCacheInvalidator: (() => void) | null = null
let activeCachedOrgId: string | null = null

export function registerInvoiceCacheInvalidator(fn: () => void) {
  invoiceCacheInvalidator = fn
}

export function extractRestTable(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    const match = parsed.pathname.match(/\/rest\/v1\/([a-zA-Z0-9_-]+)/)
    if (!match) return null
    const table = match[1]
    if (table === 'rpc') return null
    return table
  } catch {
    return null
  }
}

export function expandInvalidatedTables(table: string): string[] {
  return TABLE_INVALIDATION_GRAPH[table] || [table]
}

function postMessageToServiceWorker(payload: Record<string, any>) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(payload)
    } else {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage(payload))
        .catch(() => {})
    }
  } catch {
    // Non-blocking fallback
  }
}

function buildCacheKey(
  orgId: string,
  method: string,
  url: string,
  headers: Record<string, string>
): string {
  const prefer = headers['prefer'] || headers['Prefer'] || ''
  const range = headers['range'] || headers['Range'] || ''
  const accept = headers['accept'] || headers['Accept'] || ''
  return `${orgId}::${method}::${url}::${prefer}::${range}::${accept}`
}

function cloneEntryToResponse(entry: CachedHttpEntry, method?: string): Response {
  const resHeaders = new Headers(entry.headers)
  resHeaders.set('x-client-cache', 'HIT')
  const isBodyless = method === 'HEAD' || entry.status === 204 || entry.status === 304
  const body = isBodyless ? null : entry.body
  return new Response(body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: resHeaders,
  })
}

function setMemoryEntry(key: string, entry: CachedHttpEntry) {
  if (entry.body.length > MAX_BODY_CHARS) return
  if (responseCache.has(key)) {
    responseCache.delete(key)
  }
  responseCache.set(key, entry)

  // LRU eviction when exceeding MAX_ENTRIES
  if (responseCache.size > MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value
    if (oldestKey) {
      responseCache.delete(oldestKey)
    }
  }
}

export function invalidateTablesCache(tables: string[], orgId?: string | null) {
  if (!tables || tables.length === 0) return
  const tableSet = new Set(tables)
  let touchesInvoiceSwr = false

  for (const [key, entry] of responseCache.entries()) {
    if (orgId && entry.orgId !== orgId) continue
    if (tableSet.has(entry.table)) {
      responseCache.delete(key)
    }
  }

  for (const table of tableSet) {
    if (INVOICE_SWR_TRIGGER_TABLES.has(table)) {
      touchesInvoiceSwr = true
      break
    }
  }

  postMessageToServiceWorker({
    type: 'INVALIDATE_TABLES',
    orgId: orgId || '',
    tables: Array.from(tableSet),
  })

  if (touchesInvoiceSwr && invoiceCacheInvalidator) {
    try {
      invoiceCacheInvalidator()
    } catch {
      // Non-blocking
    }
  }
}

export function clearTenantDataCache(orgId?: string | null) {
  if (!orgId) {
    responseCache.clear()
    inFlightRequests.clear()
    revalidatingKeys.clear()
    activeCachedOrgId = null
    postMessageToServiceWorker({ type: 'CLEAR_ALL_CACHES' })
    return
  }

  for (const [key, entry] of responseCache.entries()) {
    if (entry.orgId === orgId) {
      responseCache.delete(key)
    }
  }
  postMessageToServiceWorker({ type: 'CLEAR_TENANT_CACHE', orgId })
}

function extractRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return String(input)
}

function preserveEssentialHeaders(response: Response): Array<[string, string]> {
  const result: Array<[string, string]> = []
  const allowList = ['content-type', 'content-range', 'content-location', 'preference-applied']
  allowList.forEach((name) => {
    const val = response.headers.get(name)
    if (val !== null) {
      result.push([name, val])
    }
  })
  return result
}

function trackedNetworkFetch(input: RequestInfo | URL, options: RequestInit): Promise<Response> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('db-fetch-start'))
  }
  return fetch(input, { ...options, cache: 'no-store' }).finally(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('db-fetch-end'))
    }
  })
}

/**
 * Wraps `window.fetch` for Supabase client calls with:
 * - Tenant-scoped in-memory Stale-While-Revalidate reads (GET & HEAD)
 * - Concurrent identical read deduplication
 * - Automatic relational table invalidation on writes (POST/PATCH/PUT/DELETE)
 */
export function cachedSupabaseFetch(
  input: RequestInfo | URL,
  options: RequestInit,
  plainHeaders: Record<string, string>,
  orgId: string
): Promise<Response> {
  const url = extractRequestUrl(input)
  const method = (
    options.method ||
    (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
  ).toUpperCase()

  const table = extractRestTable(url)

  // Detect tenant change cleanly and isolate caches
  if (orgId && activeCachedOrgId && activeCachedOrgId !== orgId) {
    clearTenantDataCache(activeCachedOrgId)
  }
  if (orgId) {
    activeCachedOrgId = orgId
  }

  // Non-REST requests (auth, storage, rpc, etc.): pass straight through
  if (!table) {
    return trackedNetworkFetch(input, options)
  }

  // Mutations (POST/PATCH/PUT/DELETE): bypass cache and invalidate affected tables immediately
  if (method !== 'GET' && method !== 'HEAD') {
    const affectedTables = expandInvalidatedTables(table)
    return trackedNetworkFetch(input, options).then((res) => {
      if (res.ok) {
        invalidateTablesCache(affectedTables, orgId || null)
      }
      return res
    })
  }

  // Read requests without tenant context or explicit bypass header: direct network fetch
  const bypassHeader = plainHeaders['x-bypass-cache'] || plainHeaders['X-Bypass-Cache']
  if (!orgId || bypassHeader === '1') {
    return trackedNetworkFetch(input, options)
  }

  const cacheKey = buildCacheKey(orgId, method, url, plainHeaders)
  const existing = responseCache.get(cacheKey)
  const now = Date.now()

  const executeBackgroundRefresh = async (): Promise<CachedHttpEntry | null> => {
    const response = await fetch(input, { ...options, cache: 'no-store' })
    if (response.status === 200 || response.status === 206) {
      const bodyText = method === 'HEAD' ? '' : await response.clone().text()
      const entry: CachedHttpEntry = {
        orgId,
        table,
        status: response.status,
        statusText: response.statusText,
        headers: preserveEssentialHeaders(response),
        body: bodyText,
        cachedAt: Date.now(),
      }
      setMemoryEntry(cacheKey, entry)
      return entry
    }
    return null
  }

  // 1. Fresh hit: return in <1ms without network call or spinner
  if (existing && now - existing.cachedAt <= FRESH_TTL_MS) {
    return Promise.resolve(cloneEntryToResponse(existing, method))
  }

  // 2. Stale hit: return in <1ms AND silently refresh in background
  if (existing && now - existing.cachedAt <= STALE_TTL_MS) {
    if (!revalidatingKeys.has(cacheKey)) {
      revalidatingKeys.add(cacheKey)
      executeBackgroundRefresh()
        .catch(() => {})
        .finally(() => {
          revalidatingKeys.delete(cacheKey)
        })
    }
    return Promise.resolve(cloneEntryToResponse(existing, method))
  }

  // 3. Cache miss (or expired): deduplicate concurrent identical reads
  const inFlight = inFlightRequests.get(cacheKey)
  if (inFlight) {
    return inFlight.then((entry) => {
      if (entry) return cloneEntryToResponse(entry, method)
      return trackedNetworkFetch(input, options)
    })
  }

  const networkPromise = (async () => {
    try {
      const response = await trackedNetworkFetch(input, options)
      if (response.status === 200 || response.status === 206) {
        const bodyText = method === 'HEAD' ? '' : await response.clone().text()
        const entry: CachedHttpEntry = {
          orgId,
          table,
          status: response.status,
          statusText: response.statusText,
          headers: preserveEssentialHeaders(response),
          body: bodyText,
          cachedAt: Date.now(),
        }
        setMemoryEntry(cacheKey, entry)
        return { entry, rawResponse: null as Response | null }
      }
      return { entry: null as CachedHttpEntry | null, rawResponse: response }
    } finally {
      inFlightRequests.delete(cacheKey)
    }
  })()

  inFlightRequests.set(
    cacheKey,
    networkPromise.then((res) => res.entry).catch(() => null)
  )

  return networkPromise.then((res) => {
    if (res.entry) return cloneEntryToResponse(res.entry, method)
    return res.rawResponse as Response
  })
}
