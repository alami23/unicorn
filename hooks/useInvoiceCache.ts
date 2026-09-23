import useSWR, { useSWRConfig } from 'swr'
import { useCallback, useEffect, useState } from 'react'
import {
  InvoiceQueryParams,
  InvoiceQueryResult,
  FormattedInvoice,
  getInvoiceCacheKey,
  fetchInvoicesData,
  invalidateInvoiceCache,
  preloadInvoicesBackground
} from '@/lib/invoiceCache'

export function useInvoices(params: InvoiceQueryParams) {
  const [accumulatedInvoices, setAccumulatedInvoices] = useState<FormattedInvoice[]>([])
  const [page, setPage] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const { mutate } = useSWRConfig()

  // Base key for page 0
  const baseCacheKey = getInvoiceCacheKey({ ...params, page: 0 })

  // Use SWR for page 0 data
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

  // When baseData changes or filters change, reset accumulated invoices
  useEffect(() => {
    if (baseData?.invoices) {
      setAccumulatedInvoices(baseData.invoices)
      setPage(0)
    }
  }, [baseData])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [params.type, params.searchTerm, params.status, params.dateRange, params.startDate, params.endDate])

  // Load more function for infinite scroll
  const loadMore = useCallback(async () => {
    if (isLoadingMore) return
    const nextPage = page + 1
    setIsLoadingMore(true)
    try {
      const moreData = await fetchInvoicesData({ ...params, page: nextPage })
      if (moreData?.invoices?.length) {
        setAccumulatedInvoices(prev => {
          const existingIds = new Set(prev.map(item => item.id))
          const newItems = moreData.invoices.filter(item => !existingIds.has(item.id))
          return [...prev, ...newItems]
        })
        setPage(nextPage)
      }
    } catch (err) {
      console.error('Error loading more invoices:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, page, params])

  // Helper to force refetch / invalidate
  const refresh = useCallback(async () => {
    invalidateInvoiceCache()
    return mutateCurrent()
  }, [mutateCurrent])

  const totalCount = baseData?.totalCount ?? 0
  const hasMore = (baseData?.hasMore && accumulatedInvoices.length < totalCount) || false

  return {
    invoices: accumulatedInvoices.length > 0 ? accumulatedInvoices : (baseData?.invoices || []),
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
