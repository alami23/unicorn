import useSWR from 'swr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  InvoiceQueryParams,
  InvoiceQueryResult,
  FormattedInvoice,
  getInvoiceCacheKey,
  getInvoiceCompositeKey,
  fetchInvoicesData,
  invalidateInvoiceCache,
  preloadInvoicesBackground
} from '@/lib/invoiceCache'

interface ExtraPagesState {
  cacheKey: string
  items: FormattedInvoice[]
  page: number
  hasMore: boolean | null
}

const EMPTY_INVOICES: FormattedInvoice[] = []

export function useInvoices(params: InvoiceQueryParams) {
  // Base key for page 0 (normalized & tenant-scoped)
  const baseCacheKey = getInvoiceCacheKey({ ...params, page: 0 })

  const [extraState, setExtraState] = useState<ExtraPagesState>({
    cacheKey: baseCacheKey,
    items: [],
    page: 0,
    hasMore: null
  })
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Always points to the latest active cache key so in-flight loadMore calls
  // from a previously selected category can never append into the new category.
  const activeKeyRef = useRef(baseCacheKey)
  activeKeyRef.current = baseCacheKey

  const {
    data: baseData,
    error,
    isLoading: isBaseLoading,
    isValidating,
    mutate: mutateCurrent
  } = useSWR<InvoiceQueryResult>(
    baseCacheKey,
    () => fetchInvoicesData({ ...params, page: 0 }),
    {
      revalidateOnFocus: false,
      revalidateIfStale: true,
      dedupingInterval: 5000,
      keepPreviousData: false,
    }
  )

  // Reset pagination loading flag immediately when switching tabs/filters
  useEffect(() => {
    setIsLoadingMore(false)
  }, [baseCacheKey])

  // Synchronously derive invoices strictly for the active baseCacheKey (zero stale cross-category flash)
  const activeExtra = extraState.cacheKey === baseCacheKey ? extraState : null
  const baseInvoices = baseData?.invoices ?? EMPTY_INVOICES

  const invoices = useMemo(() => {
    if (!activeExtra || activeExtra.items.length === 0) {
      return baseInvoices
    }
    const seen = new Set(baseInvoices.map(getInvoiceCompositeKey))
    const merged = [...baseInvoices]
    for (const item of activeExtra.items) {
      const key = getInvoiceCompositeKey(item)
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(item)
      }
    }
    return merged
  }, [baseInvoices, activeExtra])

  const currentPage = activeExtra ? activeExtra.page : 0
  const totalCount = baseData?.totalCount ?? 0
  const hasMore = Boolean(
    baseData &&
      (activeExtra?.hasMore ?? baseData.hasMore) &&
      invoices.length < totalCount
  )

  // Load more function for infinite scroll (strictly guarded by requestKey)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return

    const requestKey = baseCacheKey
    const nextPage = currentPage + 1
    setIsLoadingMore(true)

    try {
      const moreData = await fetchInvoicesData({ ...params, page: nextPage })
      if (activeKeyRef.current !== requestKey) {
        return
      }

      setExtraState(prev => {
        const prevItems = prev.cacheKey === requestKey ? prev.items : []
        const incoming = moreData?.invoices || []
        const seen = new Set(prevItems.map(getInvoiceCompositeKey))
        const appended = incoming.filter(item => !seen.has(getInvoiceCompositeKey(item)))

        return {
          cacheKey: requestKey,
          items: [...prevItems, ...appended],
          page: incoming.length > 0 ? nextPage : (prev.cacheKey === requestKey ? prev.page : 0),
          hasMore: incoming.length > 0 ? Boolean(moreData?.hasMore) : false
        }
      })
    } catch (err) {
      console.error('Error loading more invoices:', err)
    } finally {
      if (activeKeyRef.current === requestKey) {
        setIsLoadingMore(false)
      }
    }
  }, [isLoadingMore, hasMore, baseCacheKey, currentPage, params])

  // Helper to force refetch / invalidate and reset accumulated pages
  const refresh = useCallback(async () => {
    setExtraState({
      cacheKey: activeKeyRef.current,
      items: [],
      page: 0,
      hasMore: null
    })
    invalidateInvoiceCache()
    return mutateCurrent()
  }, [mutateCurrent])

  return {
    invoices,
    totalCount,
    hasMore,
    isLoading: isBaseLoading && !baseData,
    isValidating,
    isLoadingMore,
    error,
    loadMore,
    refresh,
    preloadBackground: preloadInvoicesBackground
  }
}

