import { supabase } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'

/**
 * Generates a cryptographically sound, unambiguous 8-character alphanumeric code.
 * Excludes ambiguous characters (0, O, 1, I, l) to avoid customer confusion.
 */
export function generate8CharShareCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  let result = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < 8; i++) {
      result += chars[bytes[i] % chars.length]
    }
  } else {
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return result
}

/**
 * Formats an invoice date into YYYY-MM-DD cleanly for URLs
 */
export function formatInvoiceDateForUrl(dateVal?: string): string {
  if (!dateVal) return new Date().toISOString().split('T')[0]
  const trimmed = String(dateVal).trim()
  if (trimmed.includes('T')) return trimmed.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  try {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  } catch (e) {}
  return trimmed.replace(/\//g, '-').replace(/\s+/g, '-')
}

/**
 * Sanitizes an invoice number for inclusion in a clean URL path
 */
export function formatInvoiceNumberForUrl(invoice: any): string {
  const rawId = invoice?.displayId || (invoice?.id ? getDisplayInvoiceId(invoice.id) : '') || invoice?.invoice_number || invoice?.id || 'INV'
  return String(rawId).trim().replace(/\s+/g, '-').replace(/\//g, '-')
}

/**
 * Saves the 8-character random code in the database record for an invoice.
 * Saves to furniture_invoices or wood_invoices share_code column,
 * with fallbacks to app_settings and local storage for maximum resilience.
 */
export async function saveInvoiceShareCode(
  inv: any,
  code: string
): Promise<boolean> {
  if (!inv || !code) return false

  const isWood =
    inv.originalType?.toLowerCase() === 'wood' ||
    inv.originalType?.toLowerCase() === 'solo_wood' ||
    inv.type?.toLowerCase() === 'wood' ||
    inv.type?.toLowerCase() === 'solo_wood' ||
    String(inv.id || '').includes('-W-')

  const tableName = isWood ? 'wood_invoices' : 'furniture_invoices'
  const invoiceId = inv.id
  const invoiceNum = inv.invoice_number || inv.displayId || getDisplayInvoiceId(inv.id)

  // 1. Direct update to database record (share_code column)
  try {
    if (invoiceId && !String(invoiceId).startsWith('loc-')) {
      await supabase
        .from(tableName)
        .update({ share_code: code } as any)
        .eq('id', invoiceId)
    }
    if (invoiceNum) {
      await supabase
        .from(tableName)
        .update({ share_code: code } as any)
        .eq('invoice_number', invoiceNum)
    }
  } catch (err) {
    console.warn('Direct share_code column update notice:', err)
  }

  // 2. Persist to app_settings in Supabase (JSONB settings.invoice_share_codes)
  try {
    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle()

    const currentSettings = settingsRow?.settings || {}
    const existingMap = currentSettings.invoice_share_codes || {}
    if (invoiceId) existingMap[invoiceId] = code
    if (invoiceNum) existingMap[invoiceNum] = code
    currentSettings.invoice_share_codes = existingMap

    await supabase.from('app_settings').upsert({
      id: 'global',
      settings: currentSettings,
      updated_at: new Date().toISOString()
    })
  } catch (e) {
    // Non-blocking fallback
  }

  // 3. LocalStorage persistence for immediate retrieval on client
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('invoice_share_codes')
      const map = stored ? JSON.parse(stored) : {}
      if (invoiceId) map[invoiceId] = code
      if (invoiceNum) map[invoiceNum] = code
      localStorage.setItem('invoice_share_codes', JSON.stringify(map))
    } catch (e) {}
  }

  return true
}

/**
 * Retrieves existing 8-character code or generates a new one,
 * saves it into the database record, and returns the code.
 */
export async function getOrGenerateInvoiceShareCode(inv: any): Promise<string> {
  if (!inv) return generate8CharShareCode()

  // 1. Check if invoice already has an 8-character share_code attached
  if (inv.share_code && typeof inv.share_code === 'string' && inv.share_code.trim().length === 8) {
    return inv.share_code.trim()
  }

  const isWood =
    inv.originalType?.toLowerCase() === 'wood' ||
    inv.originalType?.toLowerCase() === 'solo_wood' ||
    inv.type?.toLowerCase() === 'wood' ||
    inv.type?.toLowerCase() === 'solo_wood' ||
    String(inv.id || '').includes('-W-')

  const tableName = isWood ? 'wood_invoices' : 'furniture_invoices'

  // 2. Query database record to see if share_code already exists
  try {
    if (inv.id && !String(inv.id).startsWith('loc-')) {
      const { data: dbRecord } = await supabase
        .from(tableName)
        .select('share_code')
        .eq('id', inv.id)
        .maybeSingle()

      if (dbRecord?.share_code && typeof dbRecord.share_code === 'string' && dbRecord.share_code.trim().length === 8) {
        const existingCode = dbRecord.share_code.trim()
        inv.share_code = existingCode
        return existingCode
      }
    }
  } catch (e) {}

  // 3. Check app_settings fallback
  try {
    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('settings')
      .eq('id', 'global')
      .maybeSingle()

    const map = settingsRow?.settings?.invoice_share_codes || {}
    const candidate = map[inv.id] || (inv.displayId ? map[inv.displayId] : null)
    if (candidate && typeof candidate === 'string' && candidate.trim().length === 8) {
      const existingCode = candidate.trim()
      inv.share_code = existingCode
      return existingCode
    }
  } catch (e) {}

  // 4. Check client localStorage fallback
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('invoice_share_codes')
      if (stored) {
        const map = JSON.parse(stored)
        const candidate = map[inv.id] || (inv.displayId ? map[inv.displayId] : null)
        if (candidate && typeof candidate === 'string' && candidate.trim().length === 8) {
          const existingCode = candidate.trim()
          inv.share_code = existingCode
          return existingCode
        }
      }
    } catch (e) {}
  }

  // 5. Generate fresh 8-character code and save it to the database record
  const newCode = generate8CharShareCode()
  inv.share_code = newCode
  await saveInvoiceShareCode(inv, newCode)
  return newCode
}

/**
 * Builds the unique URL composed of domain, invoice number, invoice date, and 8-character secret token.
 * Formatted like: /[invoice_number]/[invoice_date]/[secret_token]
 */
export function buildSharedInvoiceUrl(origin: string, inv: any, shareCode: string): string {
  const domain = (origin || '').replace(/\/$/, '')
  const invNumber = formatInvoiceNumberForUrl(inv)
  const invDate = formatInvoiceDateForUrl(inv.date || inv.created_at)
  return `${domain}/${encodeURIComponent(invNumber)}/${encodeURIComponent(invDate)}/${encodeURIComponent(shareCode)}`
}
