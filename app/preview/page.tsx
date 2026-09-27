import { redirect } from 'next/navigation'

export default async function LegacyPreviewRedirectPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params || {})) {
    if (typeof val === 'string' && key !== 'view') {
      query.set(key, val)
    }
  }
  const queryString = query.toString()
  redirect(queryString ? `/s?${queryString}` : '/s')
}
