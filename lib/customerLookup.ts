import { supabase, getTenantId } from '@/lib/supabase'
import { sanitizePhoneInput } from '@/lib/utils'

export interface ExistingCustomerRecord {
  id: string
  org_id?: string | null
  name: string
  phone: string
  email?: string | null
  address?: string | null
  type?: string | null
  total_due?: number | null
  total_orders?: number | null
  last_purchase?: string | null
  photo?: string | null
}

/**
 * Generates a collision-resistant customer ID safe across multiple tenants.
 */
export function generateCustomerId(): string {
  const timePart = Date.now().toString(36).slice(-4).toUpperCase()
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `CUS-${timePart}${randPart}`
}

/**
 * Checks whether a Supabase/PostgreSQL error represents a tenant-scoped duplicate phone violation.
 */
export function isDuplicatePhoneDbError(error: any): boolean {
  if (!error || error.code !== '23505') return false
  const haystack = `${error.message || ''} ${error.details || ''} ${error.constraint || ''}`.toLowerCase()
  return haystack.includes('phone') || haystack.includes('uq_customer_org')
}

/**
 * Produces a canonical digits-only key for duplicate comparison.
 * Normalizes Bangladesh numbers (+8801XXXXXXXXX / 8801XXXXXXXXX -> 01XXXXXXXXX)
 * so formatting differences cannot bypass duplicate detection.
 */
export function canonicalizePhone(rawPhone: string): string {
  if (!rawPhone) return ''
  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('8801')) {
    return '0' + digits.slice(3)
  }
  return digits
}

/**
 * Builds exact-match candidate variants for fast indexed Supabase `.in('phone', ...)` lookups.
 */
export function buildPhoneLookupVariants(rawPhone: string): string[] {
  const sanitized = sanitizePhoneInput(rawPhone)
  const digits = sanitized.replace(/\D/g, '')
  const variants = new Set<string>()

  if (sanitized) variants.add(sanitized)
  if (digits) variants.add(digits)

  // Bangladesh local <-> international format variants
  if (digits.length === 11 && digits.startsWith('01')) {
    const local10 = digits.slice(1)
    variants.add(`0${local10}`)
    variants.add(`880${local10}`)
    variants.add(`+880${local10}`)
  } else if (digits.length === 13 && digits.startsWith('8801')) {
    const local10 = digits.slice(3)
    variants.add(`0${local10}`)
    variants.add(`880${local10}`)
    variants.add(`+880${local10}`)
  }

  return Array.from(variants)
}

/**
 * Queries the `customer` table strictly within the active tenant (`org_id`)
 * to check whether another customer under the SAME tenant already has this phone number.
 * Allows the same phone number to exist independently under different tenants.
 */
export async function findExistingCustomerByPhone(
  rawPhone: string,
  excludeCustomerId?: string | null,
  explicitTenantId?: string | null
): Promise<{ match: ExistingCustomerRecord | null; error: string | null }> {
  const sanitized = sanitizePhoneInput(rawPhone)
  const digits = sanitized.replace(/\D/g, '')
  const canonicalTarget = canonicalizePhone(sanitized)

  if (digits.length < 6) {
    return { match: null, error: null }
  }

  const activeTenantId = explicitTenantId ?? getTenantId()
  // Fail closed when tenant context is missing so cross-tenant lookups can never occur
  if (!activeTenantId) {
    return { match: null, error: 'Active tenant context is missing.' }
  }

  try {
    const variants = buildPhoneLookupVariants(sanitized)
    const selectFields =
      'id, org_id, name, phone, email, address, type, total_due, total_orders, last_purchase, photo'

    const isSameTenantOtherCustomer = (row: ExistingCustomerRecord) => {
      if (!row.org_id || String(row.org_id) !== String(activeTenantId)) {
        return false
      }
      if (excludeCustomerId && String(row.id) === String(excludeCustomerId)) {
        return false
      }
      return true
    }

    // 1. Fast tenant-scoped indexed lookup across normalized phone variants
    const { data: exactRows, error: exactError } = await supabase
      .from('customer')
      .select(selectFields)
      .eq('org_id', activeTenantId)
      .in('phone', variants)
      .limit(5)

    if (exactError) {
      return { match: null, error: exactError.message }
    }

    const filteredExact = (exactRows || []).filter((row: ExistingCustomerRecord) =>
      isSameTenantOtherCustomer(row)
    )

    if (filteredExact.length > 0) {
      return { match: filteredExact[0] as ExistingCustomerRecord, error: null }
    }

    // 2. Tenant-scoped fallback suffix check to catch legacy rows that may have spaces/dashes
    if (digits.length >= 8) {
      const suffix = digits.slice(-8)
      const { data: fuzzyRows, error: fuzzyError } = await supabase
        .from('customer')
        .select(selectFields)
        .eq('org_id', activeTenantId)
        .ilike('phone', `%${suffix}`)
        .limit(10)

      if (fuzzyError) {
        return { match: null, error: fuzzyError.message }
      }

      const matchedLegacy = (fuzzyRows || []).find((row: ExistingCustomerRecord) => {
        if (!isSameTenantOtherCustomer(row)) {
          return false
        }
        return canonicalizePhone(row.phone || '') === canonicalTarget
      })

      if (matchedLegacy) {
        return { match: matchedLegacy as ExistingCustomerRecord, error: null }
      }
    }

    return { match: null, error: null }
  } catch (err: any) {
    return { match: null, error: err?.message || 'Failed to check phone number' }
  }
}
