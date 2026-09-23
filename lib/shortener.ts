import { supabase } from '@/lib/supabase'
import { getDisplayInvoiceId, getInvoiceVerificationCode } from '@/lib/invoice'

/**
 * Generates a random alphanumeric slug of given length
 */
export function generateRandomSlug(length = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Creates a reversible compact fallback token for an invoice
 */
export function encodeInvoiceToken(invoiceNumber: string, invoiceDate: string, code: string): string {
  try {
    const raw = `${invoiceNumber}|${invoiceDate}|${code}`
    if (typeof window !== 'undefined' && window.btoa) {
      return 't_' + window.btoa(unescape(encodeURIComponent(raw)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    }
  } catch (e) {}
  return generateRandomSlug(7)
}

/**
 * Decodes a reversible compact fallback token
 */
export function decodeInvoiceToken(token: string): { invoiceNumber: string; invoiceDate: string; code: string } | null {
  if (!token || !token.startsWith('t_')) return null
  try {
    const base64 = token.substring(2)
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    
    // Add padding if needed
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    let decoded = ''
    if (typeof window !== 'undefined' && window.atob) {
      decoded = decodeURIComponent(escape(window.atob(padded)))
    } else {
      decoded = Buffer.from(padded, 'base64').toString('utf-8')
    }

    const parts = decoded.split('|')
    if (parts.length >= 3) {
      return {
        invoiceNumber: parts[0],
        invoiceDate: parts[1],
        code: parts[2]
      }
    }
  } catch (e) {
    console.error('Failed to decode invoice token:', e)
  }
  return null
}

export interface ShortenResult {
  shortUrl: string
  fullUrl: string
  slug: string
  invoiceNumber: string
  invoiceDate: string
  code: string
}

/**
 * Shortens an invoice preview URL using the private shortener service
 */
export async function shortenInvoiceUrl(inv: any, baseUrl?: string): Promise<ShortenResult> {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  const invoiceNumber = getDisplayInvoiceId(inv.id) || inv.invoice_number || inv.id || ''

  let invoiceDate = inv.date || ''
  if (!invoiceDate && inv.created_at) {
    invoiceDate = new Date(inv.created_at).toISOString().split('T')[0]
  }

  const code = getInvoiceVerificationCode(inv)

  const params = new URLSearchParams()
  if (invoiceNumber) params.set('invoiceNumber', invoiceNumber)
  if (invoiceDate) params.set('invoiceDate', invoiceDate)
  if (code) params.set('code', code)

  const fullUrl = `${origin}/preview?${params.toString()}`

  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber,
        invoiceDate,
        code,
        targetUrl: fullUrl
      })
    })

    if (res.ok) {
      const data = await res.json()
      if (data.slug) {
        return {
          shortUrl: `${origin}/s/${data.slug}`,
          fullUrl,
          slug: data.slug,
          invoiceNumber,
          invoiceDate,
          code
        }
      }
    }
  } catch (e) {
    console.warn('API shortener unavailable, using client fallback token', e)
  }

  // Client-side fallback token
  const fallbackToken = encodeInvoiceToken(invoiceNumber, invoiceDate, code)
  return {
    shortUrl: `${origin}/s/${fallbackToken}`,
    fullUrl,
    slug: fallbackToken,
    invoiceNumber,
    invoiceDate,
    code
  }
}
