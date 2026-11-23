'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getTenantId } from '@/lib/supabase'
import { CRITICAL_ROUTES, warmCriticalDataBackground } from '@/lib/routePrefetcher'

interface PrefetchManagerProps {
  hasPermission: (permission?: string) => boolean
}

/**
 * Invisible background orchestrator that:
 * 1. Registers the tenant-aware Service Worker (/sw.js) for asset & background data caching.
 * 2. Prefetches Next.js route bundles for all critical permitted pages during idle time.
 * 3. Pre-warms essential Supabase datasets in staggered priority waves so transitions feel instant.
 */
export default function PrefetchManager({ hasPermission }: PrefetchManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const hasPermissionRef = useRef(hasPermission)
  const warmedOrgRef = useRef<string | null>(null)

  useEffect(() => {
    hasPermissionRef.current = hasPermission
  }, [hasPermission])

  // 1. Register Service Worker once
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let isMounted = true
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        if (!isMounted) return
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      } catch {
        // Gracefully ignore in restricted preview iframes or non-secure contexts
      }
    }

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW, { once: true })
      return () => {
        isMounted = false
        window.removeEventListener('load', registerSW)
      }
    }

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Prefetch Next.js critical route bundles + warm essential Supabase datasets once per tenant session
  useEffect(() => {
    const orgId = getTenantId()
    if (!orgId) return
    if (warmedOrgRef.current === orgId) return
    warmedOrgRef.current = orgId

    const checkPerm = (perm?: string) => hasPermissionRef.current(perm)

    // Stagger Next.js router.prefetch calls across idle frames so initial render stays fluid
    const routeTimers: Array<ReturnType<typeof setTimeout>> = []
    const permittedRoutes = CRITICAL_ROUTES.filter((r) => checkPerm(r.permission))

    permittedRoutes.forEach((route, idx) => {
      const delay = route.tier === 1 ? 250 + idx * 80 : route.tier === 2 ? 900 + idx * 90 : 1800 + idx * 100
      const timer = setTimeout(() => {
        try {
          router.prefetch(route.href)
        } catch {
          // Non-blocking
        }
      }, delay)
      routeTimers.push(timer)
    })

    // Warm essential Supabase REST datasets in background waves
    const cancelDataWarm = warmCriticalDataBackground(checkPerm, pathname || '/')

    return () => {
      routeTimers.forEach((t) => clearTimeout(t))
      cancelDataWarm()
    }
  }, [router, pathname])

  return null
}
