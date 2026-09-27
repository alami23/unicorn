import { redirect } from 'next/navigation'

export default async function PublicInvoicePreviewPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  query.set('view', 'preview')
  for (const [key, val] of Object.entries(params || {})) {
    if (typeof val === 'string' && key !== 'view') {
      query.set(key, val)
    }
  }
  redirect(`/login?${query.toString()}`)
}
