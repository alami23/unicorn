import { supabase, getTenantId } from '@/lib/supabase'
import { preloadInvoicesBackground } from '@/lib/invoiceCache'

export interface CriticalRouteDef {
  href: string
  permission?: string
  tier: 1 | 2 | 3
}

export const CRITICAL_ROUTES: CriticalRouteDef[] = [
  // Tier 1: Most frequently visited high-priority views
  { href: '/', permission: 'Dashboard', tier: 1 },
  { href: '/customer', permission: 'Customer', tier: 1 },
  { href: '/invoice', permission: 'Invoices', tier: 1 },
  { href: '/invoice?type=Furniture', permission: 'Furniture Invoices', tier: 1 },
  { href: '/invoice?type=Wood', permission: 'Wood Invoices', tier: 1 },

  // Tier 2: POS checkout workflows
  { href: '/pos-wood', permission: 'pos wood', tier: 2 },
  { href: '/solo-wood', permission: 'solo wood', tier: 2 },
  { href: '/pos-furniture', permission: 'pos furniture', tier: 2 },

  // Tier 3: Inventory, Ledger, Expenses, Staff & Reports
  { href: '/furniture-inventory', permission: 'Furniture Inventory', tier: 3 },
  { href: '/wood-inventory', permission: 'Wood Inventory', tier: 3 },
  { href: '/transactions', permission: 'Transaction', tier: 3 },
  { href: '/bills', permission: 'Bills & Expenses', tier: 3 },
  { href: '/customer-statement', permission: 'Customer Statement', tier: 3 },
  { href: '/staff', permission: 'Staff', tier: 3 },
  { href: '/reports', permission: 'Reports', tier: 3 },
  { href: '/settings', permission: 'Settings', tier: 3 },
]

const ROUTE_PREFETCH_COOLDOWN_MS = 10 * 1000
const lastPrefetchedAt = new Map<string, number>()

function isSaveDataOrSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as any).connection
  if (!conn) return false
  if (conn.saveData) return true
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return true
  return false
}

function normalizeRoutePath(href: string): string {
  const [path] = href.split('?')
  return path || '/'
}

/**
 * Prefetches the exact Supabase queries executed by a target page on mount.
 * Safe to invoke on hover, focus, or touchstart (throttled per route).
 */
export function prefetchRouteData(href: string): void {
  if (typeof window === 'undefined') return
  const tenantId = getTenantId()
  if (!tenantId) return

  const path = normalizeRoutePath(href)
  const key = `${tenantId}:${path}`
  const now = Date.now()
  const prev = lastPrefetchedAt.get(key) || 0
  if (now - prev < ROUTE_PREFETCH_COOLDOWN_MS) return
  lastPrefetchedAt.set(key, now)

  const runSilent = (promises: Array<PromiseLike<any>>) => {
    Promise.allSettled(promises).catch(() => {})
  }

  switch (path) {
    case '/':
      runSilent([
        supabase.from('furniture_invoices').select('total, due_amount, paid_amount, created_at'),
        supabase.from('wood_invoices').select('total, due_amount, paid_amount, created_at'),
        supabase.from('customer').select('*', { count: 'exact', head: true }),
        supabase.from('bills').select('amount, created_at'),
        supabase.from('furniture_invoices').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('wood_invoices').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('transactions').select('*, customer:customer_id(name)').order('created_at', { ascending: false }).limit(8),
        supabase.from('furniture_inventory').select('category', { count: 'exact', head: true }),
        supabase.from('wood_inventory').select('category', { count: 'exact', head: true }),
      ])
      break

    case '/customer':
      runSilent([
        supabase.from('customer').select('*').order('name', { ascending: true }),
        supabase.from('furniture_invoices').select('id, customer_id, customer_name, due_amount'),
        supabase.from('wood_invoices').select('id, customer_id, customer_name, due_amount'),
        supabase.from('transactions').select('customer_id, type, ref, debit, credit'),
      ])
      break

    case '/customer-statement':
      runSilent([
        supabase.from('customer').select('*').order('name', { ascending: true }),
      ])
      break

    case '/invoice':
      preloadInvoicesBackground().catch(() => {})
      break

    case '/pos-furniture':
      runSilent([
        supabase.from('furniture_inventory').select('*'),
        supabase.from('furniture_category').select('id, name').order('name', { ascending: true }),
        supabase.from('customer').select('*').order('name', { ascending: true }),
        supabase.from('app_settings').select('settings').eq('id', 'global').single(),
      ])
      break

    case '/pos-wood':
      runSilent([
        supabase.from('wood_inventory').select('*'),
        supabase.from('wood_category').select('*'),
        supabase.from('wood_category_car').select('*'),
        supabase.from('wood_category_tag').select('*'),
        supabase.from('customer').select('*').order('name', { ascending: true }),
        supabase.from('app_settings').select('settings').eq('id', 'global').single(),
      ])
      break

    case '/solo-wood':
      runSilent([
        supabase.from('wood_inventory').select('*').eq('car_no', 'Solo').eq('is_sold', false),
        supabase.from('wood_category_tag').select('*').eq('status', 'Active'),
        supabase.from('customer').select('*').order('name', { ascending: true }),
        supabase.from('app_settings').select('settings').eq('id', 'global').single(),
      ])
      break

    case '/furniture-inventory':
      runSilent([
        supabase.from('furniture_inventory').select('*').order('id', { ascending: false }),
        supabase.from('furniture_category').select('*').order('name', { ascending: true }),
      ])
      break

    case '/wood-inventory':
      runSilent([
        supabase.from('wood_inventory').select('*').order('id', { ascending: false }),
        supabase.from('wood_category').select('*').order('name'),
        supabase.from('wood_category_car').select('*').order('name'),
        supabase.from('wood_category_tag').select('*').order('name'),
      ])
      break

    case '/transactions':
      runSilent([
        supabase.from('transactions').select('*, customer(name)').order('created_at', { ascending: false }),
      ])
      break

    case '/bills':
      runSilent([
        supabase.from('bills').select('*').order('date', { ascending: false }),
        supabase.from('vendors').select('*').order('name', { ascending: true }),
      ])
      break

    case '/staff':
      runSilent([
        supabase.from('staff').select('*').order('join_date', { ascending: false }),
        supabase.from('app_settings').select('settings').eq('id', 'global').single(),
      ])
      break

    case '/reports':
      runSilent([
        supabase.from('furniture_invoices').select('*'),
        supabase.from('wood_invoices').select('*'),
        supabase.from('bills').select('*'),
        supabase.from('customer').select('*').order('name', { ascending: true }),
      ])
      break

    case '/furniture-category':
      runSilent([
        supabase.from('furniture_category').select('*').order('name', { ascending: true }),
      ])
      break

    case '/wood-category':
      runSilent([
        supabase.from('wood_category').select('*').order('name'),
        supabase.from('wood_category_car').select('*').order('name'),
        supabase.from('wood_category_tag').select('*').order('name'),
      ])
      break

    default:
      break
  }
}

export function resetRoutePrefetchHistory() {
  lastPrefetchedAt.clear()
}

/**
 * Staggered background warmer that runs during browser idle time to populate
 * the SWR + Service Worker caches for critical permitted pages without blocking UI paint.
 */
export function warmCriticalDataBackground(
  hasPermission: (permission?: string) => boolean,
  currentPath: string
): () => void {
  if (typeof window === 'undefined' || isSaveDataOrSlowConnection()) {
    return () => {}
  }

  let cancelled = false
  const timers: Array<ReturnType<typeof setTimeout>> = []

  const schedule = (delayMs: number, task: () => void) => {
    const id = setTimeout(() => {
      if (cancelled) return
      if (typeof (window as any).requestIdleCallback === 'function') {
        ;(window as any).requestIdleCallback(
          () => {
            if (!cancelled) task()
          },
          { timeout: 1500 }
        )
      } else {
        task()
      }
    }, delayMs)
    timers.push(id)
  }

  const normalizedCurrent = normalizeRoutePath(currentPath)

  // Tier 1: Warm primary pages right after initial paint settles
  schedule(650, () => {
    const tier1 = ['/customer', '/invoice', '/'].filter((p) => p !== normalizedCurrent)
    tier1.forEach((p) => {
      const def = CRITICAL_ROUTES.find((r) => normalizeRoutePath(r.href) === p)
      if (!def || hasPermission(def.permission)) {
        prefetchRouteData(p)
      }
    })
  })

  // Tier 2: Warm POS checkout datasets
  schedule(1800, () => {
    const tier2 = ['/pos-wood', '/solo-wood', '/pos-furniture'].filter((p) => p !== normalizedCurrent)
    tier2.forEach((p) => {
      const def = CRITICAL_ROUTES.find((r) => normalizeRoutePath(r.href) === p)
      if (!def || hasPermission(def.permission)) {
        prefetchRouteData(p)
      }
    })
  })

  // Tier 3: Warm inventory & financial ledger datasets
  schedule(3400, () => {
    const tier3 = ['/furniture-inventory', '/wood-inventory', '/transactions', '/bills'].filter(
      (p) => p !== normalizedCurrent
    )
    tier3.forEach((p) => {
      const def = CRITICAL_ROUTES.find((r) => normalizeRoutePath(r.href) === p)
      if (!def || hasPermission(def.permission)) {
        prefetchRouteData(p)
      }
    })
  })

  return () => {
    cancelled = true
    timers.forEach((id) => clearTimeout(id))
  }
}
