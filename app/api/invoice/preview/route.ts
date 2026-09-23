import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceNumber, invoiceDate, code } = body;

    // 1. Validate Input Presence
    if (!invoiceNumber || typeof invoiceNumber !== 'string' || !invoiceNumber.trim()) {
      return NextResponse.json(
        { error: 'Invoice number is required.' },
        { status: 400 }
      );
    }

    if (!invoiceDate || typeof invoiceDate !== 'string' || !invoiceDate.trim()) {
      return NextResponse.json(
        { error: 'Invoice date is required.' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json(
        { error: 'The 8-character code is required.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toLowerCase();
    if (cleanCode.length !== 8) {
      return NextResponse.json(
        { error: 'The code must be exactly 8 characters long.' },
        { status: 400 }
      );
    }

    const cleanInv = invoiceNumber.trim().toUpperCase().replace(/^#/, '');
    const cleanDate = invoiceDate.trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database service is not configured.' },
        { status: 500 }
      );
    }

    const baseClient = createClient(supabaseUrl, supabaseKey);

    // 2. Fetch all candidate organization IDs
    const { data: users, error: userError } = await baseClient
      .from('custom_users')
      .select('org_id, id');

    if (userError) {
      console.error('Error querying custom_users for preview:', userError);
    }

    const allOrgs = Array.from(new Set(users?.map(u => u.org_id).filter(Boolean) as string[] || []));

    // Sort orgs so any matching the 8-char code are evaluated first
    const sortedOrgs = allOrgs.sort((a, b) => {
      const aMatch = a.toLowerCase().startsWith(cleanCode) ? -1 : 1;
      const bMatch = b.toLowerCase().startsWith(cleanCode) ? -1 : 1;
      return aMatch - bMatch;
    });

    let foundInvoice: any = null;
    let foundTable: 'furniture_invoices' | 'wood_invoices' | null = null;
    let foundOrgId: string | null = null;

    // Search across organizations and both invoice tables
    for (const orgId of sortedOrgs) {
      const tenantClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { 'x-org-id': orgId } }
      });

      const tables: ('furniture_invoices' | 'wood_invoices')[] = ['furniture_invoices', 'wood_invoices'];

      for (const table of tables) {
        const { data: invoices, error: invErr } = await tenantClient
          .from(table)
          .select('*');

        if (invErr || !invoices) continue;

        for (const inv of invoices) {
          const rawInvNum = (inv.invoice_number || inv.id || '').toUpperCase().replace(/^#/, '');
          const invDateStr = inv.date ? String(inv.date).slice(0, 10) : '';
          const invInvoiceDateStr = inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : '';
          const invCreatedAt = inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : '';
          const invDeliveryDate = inv.delivery_date ? new Date(inv.delivery_date).toISOString().split('T')[0] : '';

          // Match invoice number
          const numberMatches =
            rawInvNum === cleanInv ||
            rawInvNum.endsWith(cleanInv) ||
            cleanInv.endsWith(rawInvNum) ||
            inv.id?.toUpperCase().includes(cleanInv);

          // Match invoice date against date, invoice_date, created_at, or delivery_date
          const dateMatches =
            invDateStr === cleanDate ||
            invInvoiceDateStr === cleanDate ||
            invCreatedAt === cleanDate ||
            invDeliveryDate === cleanDate;

          // Match 8-character code against org_id prefix, customer_id, or invoice ID prefix
          const orgMatches = orgId.toLowerCase().startsWith(cleanCode);
          const customerMatches = inv.customer_id?.toLowerCase() === cleanCode;
          const idMatches = inv.id?.toLowerCase().startsWith(cleanCode);
          const codeMatches = orgMatches || customerMatches || idMatches;

          if (numberMatches && dateMatches && codeMatches) {
            foundInvoice = inv;
            foundTable = table;
            foundOrgId = orgId;
            break;
          }
        }

        if (foundInvoice) break;
      }

      if (foundInvoice) break;
    }

    if (!foundInvoice || !foundOrgId) {
      return NextResponse.json(
        { error: 'No invoice found matching the given Invoice Number, Date, and 8-Character Code.' },
        { status: 404 }
      );
    }

    // 3. Fetch invoice items
    const tenantClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { 'x-org-id': foundOrgId } }
    });

    const itemsTable = foundTable === 'furniture_invoices' ? 'furniture_invoice_items' : 'wood_invoice_items';
    const { data: itemsData } = await tenantClient
      .from(itemsTable)
      .select('*')
      .eq('invoice_id', foundInvoice.id);

    // 4. Fetch business profile settings
    let businessSettings: any = null;
    const { data: orgSettings } = await tenantClient
      .from('app_settings')
      .select('settings')
      .eq('id', foundOrgId)
      .maybeSingle();

    if (orgSettings?.settings?.business?.name) {
      businessSettings = orgSettings.settings.business;
    } else {
      const { data: globalSettings } = await baseClient
        .from('app_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle();
      businessSettings = globalSettings?.settings?.business || orgSettings?.settings?.business || {
        name: 'Timber & Furniture ERP',
        address: '',
        email: '',
        phone: '',
        logo: ''
      };
    }

    // 5. Fetch transactions/payments
    const { data: transactionsData } = await tenantClient
      .from('transactions')
      .select('*')
      .eq('ref', foundInvoice.id)
      .gt('credit', 0)
      .order('id', { ascending: true });

    const payments = (transactionsData || []).map((t: any) => ({
      date: t.date,
      method: t.notes || 'Cash',
      amount: Number(t.credit || 0)
    }));

    // If payments list doesn't cover total paid, seed initial payment
    const totalPaid = Number(foundInvoice.paid_amount || 0);
    const recordedPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    if (totalPaid > recordedPaid) {
      payments.unshift({
        date: foundInvoice.created_at ? new Date(foundInvoice.created_at).toISOString().split('T')[0] : cleanDate,
        method: foundInvoice.payment_method || 'Cash',
        amount: totalPaid - recordedPaid
      });
    }

    // Format final invoice payload
    const formattedInvoice = {
      id: foundInvoice.id,
      invoice_number: foundInvoice.invoice_number,
      customer: foundInvoice.customer_name || 'Valued Customer',
      customerPhone: foundInvoice.customer_phone || '',
      customerAddress: foundInvoice.customer_address || '',
      customer_id: foundInvoice.customer_id || '',
      date: foundInvoice.created_at || cleanDate,
      deliveryDate: foundInvoice.delivery_date || '',
      type: foundInvoice.type || (foundTable === 'wood_invoices' ? 'Wood' : 'Furniture'),
      subtotal: Number(foundInvoice.subtotal || 0),
      discount: Number(foundInvoice.discount || 0),
      discountType: foundInvoice.discount_type || 'fixed',
      deliveryCharge: Number(foundInvoice.delivery_charge || 0),
      total: Number(foundInvoice.total || 0),
      paid: totalPaid,
      due: Number(foundInvoice.due_amount || 0),
      paymentMethod: foundInvoice.payment_method || 'Cash',
      items: (itemsData || []).map((item: any) => ({
        ...item,
        sellPrice: item.price,
        treeNo: item.tree_no || item.treeNo,
        carNo: item.car_no || item.carNo
      })),
      payments,
      business: businessSettings
    };

    return NextResponse.json({
      success: true,
      invoice: formattedInvoice
    });
  } catch (error: any) {
    console.error('Invoice Preview API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while retrieving invoice.' },
      { status: 500 }
    );
  }
}
