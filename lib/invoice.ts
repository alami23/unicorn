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
