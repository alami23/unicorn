import { supabase } from '@/lib/supabase';

/**
 * Generates an invoice ID following the format:
 * - WOOD: #INV-W-260801
 * - FURNITURE: #INV-F-260801
 *
 * Here '26' represents 2-digit Year (YY), '08' 2-digit Month (MM),
 * and '01', '02', '03'... is the sequential serial number for that month.
 */
export async function generateInvoiceId(
  type: 'Wood' | 'Furniture' | 'wood' | 'furniture',
  orgId: string | null = null,
  client: any = supabase
): Promise<string> {
  const isWood = type.toLowerCase() === 'wood';
  const prefix = isWood ? '#INV-W-' : '#INV-F-';
  const tableName = isWood ? 'wood_invoices' : 'furniture_invoices';

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // e.g. "26"
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // e.g. "08"
  const basePrefix = `${prefix}${year}${month}`; // e.g. "#INV-W-2608" or "#INV-F-2608"

  // Strip leading '#' for database search flexibility
  const cleanBasePrefix = basePrefix.replace(/^#/, '');

  try {
    let query = client
      .from(tableName)
      .select('id, invoice_number');

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data: lastInvoices, error } = await query;

    if (error) {
      console.error(`Error querying ${tableName} for invoice ID generation:`, error);
    }

    let maxSerial = 0;

    if (lastInvoices && lastInvoices.length > 0) {
      for (const inv of lastInvoices) {
        if (!inv) continue;
        
        const rawVal = inv.invoice_number || inv.id;
        if (!rawVal) continue;
        
        const humanId = String(rawVal);
        const parts = humanId.split('_');
        const serialPartString = parts.length > 1 ? parts[1] : parts[0];

        const cleanId = serialPartString.replace(/^#/, '');
        if (cleanId.startsWith(cleanBasePrefix)) {
          const serialPart = cleanId.substring(cleanBasePrefix.length);
          const match = serialPart.match(/^(\d+)/);
          if (match) {
            const serialNum = parseInt(match[1], 10);
            if (!isNaN(serialNum)) {
              maxSerial = Math.max(maxSerial, serialNum);
            }
          }
        }
      }
    }

    const nextSerial = maxSerial + 1;
    const formattedSerial = String(nextSerial).padStart(2, '0');
    return `${basePrefix}${formattedSerial}`;
  } catch (err) {
    console.error('Failed to generate invoice ID:', err);
    return `${basePrefix}01`;
  }
}

/**
 * Utility to strip the org_id / UUID prefix from an invoice ID for display purposes
 * E.g. "3f820b..._#INV-F-260902" -> "#INV-F-260902"
 */
export function getDisplayInvoiceId(id: string | null | undefined): string {
  if (!id) return '';
  const idStr = String(id).trim();
  if (!idStr || idStr === '-' || idStr === 'N/A') return idStr;

  const parts = idStr.split('_');
  const invPart = parts.find(p => p.startsWith('#INV') || p.startsWith('INV'));
  const rawId = invPart || (parts.length > 1 ? parts.slice(1).join('_') : parts[0]);
  const cleanId = rawId.replace(/^#+/, '');

  if (cleanId.startsWith('INV') || rawId.startsWith('#')) {
    return `#${cleanId}`;
  }
  return cleanId;
}

/**
 * Derives the 8-character verification code for an invoice.
 * Matches org_id prefix, invoice ID tenant prefix, or customer ID.
 */
export function getInvoiceVerificationCode(inv: any): string {
  if (!inv) return '';

  // 1. If invoice id has tenant prefix (e.g. "64f46349-a37b-4f53-840f-358a3f731d1b_#INV-F-260901")
  if (inv.id && typeof inv.id === 'string' && inv.id.includes('_')) {
    const prefix = inv.id.split('_')[0];
    if (prefix.length >= 8) {
      return prefix.substring(0, 8).toUpperCase();
    }
  }

  // 2. If inv has org_id
  if (inv.org_id && typeof inv.org_id === 'string' && inv.org_id.length >= 8) {
    return inv.org_id.substring(0, 8).toUpperCase();
  }

  // 3. User session / tenant ID in localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('custom_user');
      if (stored) {
        const u = JSON.parse(stored);
        const orgId = u.org_id || u.id;
        if (orgId && typeof orgId === 'string' && orgId.length >= 8) {
          return orgId.substring(0, 8).toUpperCase();
        }
      }
    } catch (e) {}
  }

  // 4. Customer ID if exactly 8 characters
  if (inv.customer_id && typeof inv.customer_id === 'string' && inv.customer_id.length === 8) {
    return inv.customer_id.toUpperCase();
  }

  // 5. Fallback alphanumeric 8 characters from id
  if (inv.id && typeof inv.id === 'string') {
    const alphanumeric = inv.id.replace(/[^a-zA-Z0-9]/g, '');
    if (alphanumeric.length >= 8) {
      return alphanumeric.substring(0, 8).toUpperCase();
    }
  }

  return '64F46349';
}

/**
 * Generates the unique public URL to preview and verify an invoice
 */
export function generateInvoicePreviewUrl(inv: any, baseUrl?: string): string {
  if (!inv) return '';

  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const invoiceNumber = getDisplayInvoiceId(inv.id) || inv.invoice_number || inv.id || '';
  
  let invoiceDate = inv.date || '';
  if (!invoiceDate && inv.created_at) {
    invoiceDate = new Date(inv.created_at).toISOString().split('T')[0];
  }

  const code = getInvoiceVerificationCode(inv);

  const params = new URLSearchParams();
  if (invoiceNumber) params.set('invoiceNumber', invoiceNumber);
  if (invoiceDate) params.set('invoiceDate', invoiceDate);
  if (code) params.set('code', code);

  return `${origin}/preview?${params.toString()}`;
}

