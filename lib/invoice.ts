import { supabase } from '@/lib/supabase';

/**
 * Generates an 8-character random alphanumeric secret token
 */
export function generateSecretToken(length: number = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let token = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      token += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return token;
}

/**
 * Formats any date or ISO string into standard YYYY-MM-DD
 */
export function getInvoiceDateString(dateVal?: string | Date | null): string {
  if (!dateVal) {
    return new Date().toISOString().split('T')[0];
  }
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      const match = String(dateVal).match(/\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
      return new Date().toISOString().split('T')[0];
    }
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Generates the secure public invoice view URL
 */
export function generatePublicInvoiceUrl(
  invoiceId: string,
  invoiceDate: string,
  secretToken: string,
  origin?: string
): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const cleanId = encodeURIComponent(invoiceId);
  const cleanDate = encodeURIComponent(invoiceDate);
  const cleanCode = encodeURIComponent(secretToken);
  return `${base}/invoice/view?id=${cleanId}&date=${cleanDate}&code=${cleanCode}`;
}

/**
 * Ensures an invoice in Supabase has a valid 8-character secret_token.
 * If missing, generates one and saves to the database.
 */
export async function ensureInvoiceSecretToken(
  invoiceId: string,
  type?: string,
  existingToken?: string | null
): Promise<string> {
  if (existingToken && existingToken.length === 8) {
    return existingToken;
  }

  const isWood = type?.toLowerCase() === 'wood' || 
                 type?.toLowerCase() === 'solo_wood' || 
                 invoiceId.includes('-W-');
  const tableName = isWood ? 'wood_invoices' : 'furniture_invoices';

  try {
    const { data: inv } = await supabase
      .from(tableName)
      .select('secret_token, created_at')
      .eq('id', invoiceId)
      .maybeSingle();

    if (inv?.secret_token && inv.secret_token.length === 8) {
      return inv.secret_token;
    }

    const newToken = generateSecretToken(8);
    await supabase
      .from(tableName)
      .update({ secret_token: newToken })
      .eq('id', invoiceId);

    return newToken;
  } catch (err) {
    console.error('Error ensuring invoice secret token:', err);
    return generateSecretToken(8);
  }
}

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

