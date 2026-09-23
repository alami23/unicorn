import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

function getSupabaseServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

function normalizeDate(d?: string | Date | null): string {
  if (!d) return '';
  try {
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) {
      const match = String(d).match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    }
    return dateObj.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('invoice_id') || searchParams.get('invoice_number') || searchParams.get('invoice');
    const dateParam = searchParams.get('date') || searchParams.get('invoice_date') || searchParams.get('d');
    const code = searchParams.get('code') || searchParams.get('secret_token') || searchParams.get('token') || searchParams.get('c');

    if (!id || !dateParam || !code) {
      return NextResponse.json(
        { 
          error: 'Access Denied: Missing required verification parameters (Invoice ID, Invoice Date, and Security Code are required).' 
        }, 
        { status: 400 }
      );
    }

    const trimmedCode = code.trim();
    if (trimmedCode.length !== 8) {
      return NextResponse.json(
        { 
          error: 'Access Denied: Invalid security code format. Verification code must be exactly 8 characters.' 
        }, 
        { status: 403 }
      );
    }

    const targetDate = normalizeDate(dateParam);
    if (!targetDate) {
      return NextResponse.json(
        { 
          error: 'Access Denied: Invalid invoice date format.' 
        }, 
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const cleanId = id.trim();

    // Query both furniture_invoices and wood_invoices
    // Match either exact ID, or invoice_number, or ID without tenant prefix
    let invoiceData: any = null;
    let invoiceType: 'Furniture' | 'Wood' = 'Furniture';

    // 1. Try furniture_invoices
    const { data: furnInvoices, error: furnError } = await supabase
      .from('furniture_invoices')
      .select('*')
      .or(`id.eq.${cleanId},invoice_number.eq.${cleanId},id.ilike.%${cleanId}%`);

    if (furnInvoices && furnInvoices.length > 0) {
      for (const inv of furnInvoices) {
        const invDate = normalizeDate(inv.created_at) || normalizeDate(inv.delivery_date);
        const storedToken = (inv.secret_token || '').trim();
        
        // Exact 3-way verification: ID, Date, and 8-character Secret Token
        if (storedToken && storedToken === trimmedCode) {
          if (invDate === targetDate) {
            invoiceData = inv;
            invoiceType = 'Furniture';
            break;
          }
        }
      }
    }

    // 2. Try wood_invoices if not found in furniture
    if (!invoiceData) {
      const { data: woodInvoices, error: woodError } = await supabase
        .from('wood_invoices')
        .select('*')
        .or(`id.eq.${cleanId},invoice_number.eq.${cleanId},id.ilike.%${cleanId}%`);

      if (woodInvoices && woodInvoices.length > 0) {
        for (const inv of woodInvoices) {
          const invDate = normalizeDate(inv.created_at);
          const storedToken = (inv.secret_token || '').trim();

          // Exact 3-way verification: ID, Date, and 8-character Secret Token
          if (storedToken && storedToken === trimmedCode) {
            if (invDate === targetDate) {
              invoiceData = inv;
              invoiceType = 'Wood';
              break;
            }
          }
        }
      }
    }

    // If verification failed
    if (!invoiceData) {
      return NextResponse.json(
        { 
          error: 'Access Denied: Invoice details or verification code do not match our database records.' 
        }, 
        { status: 403 }
      );
    }

    // Verification succeeded! Fetch invoice items, customer, transactions and business settings
    const isWood = invoiceType === 'Wood' || invoiceData.type?.toLowerCase() === 'wood' || invoiceData.type?.toLowerCase() === 'solo_wood';
    const itemsTable = isWood ? 'wood_invoice_items' : 'furniture_invoice_items';

    const [itemsRes, paymentsRes, settingsRes, customerRes] = await Promise.all([
      supabase.from(itemsTable).select('*').eq('invoice_id', invoiceData.id),
      supabase.from('transactions').select('*').eq('ref', invoiceData.id).gt('credit', 0).order('id', { ascending: true }),
      supabase.from('app_settings').select('settings').eq('id', 'global').maybeSingle(),
      invoiceData.customer_id ? supabase.from('customer').select('*').eq('id', invoiceData.customer_id).maybeSingle() : Promise.resolve({ data: null })
    ]);

    const items = (itemsRes.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      product_id: item.product_id,
      price: Number(item.price || 0),
      sellPrice: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
      total: Number(item.total || 0),
      cft: item.cft !== undefined && item.cft !== null ? Number(item.cft) : 0,
      tag: item.tag || null,
      carNo: item.car_no || null,
      width: item.width ? Number(item.width) : 0,
      length: item.length ? Number(item.length) : 0,
      treeNo: item.tree_no || (isWood ? item.name : undefined)
    }));

    const payments = (paymentsRes.data || []).map((t: any) => ({
      date: t.date,
      method: t.notes || t.method || 'Cash',
      amount: Number(t.credit || 0)
    }));

    const formattedInvoice = {
      id: invoiceData.id,
      invoice_number: invoiceData.invoice_number || invoiceData.id,
      customer: invoiceData.customer_name,
      customer_id: invoiceData.customer_id,
      customerPhone: invoiceData.customer_phone || customerRes?.data?.phone || '',
      customerAddress: invoiceData.customer_address || customerRes?.data?.address || '',
      date: normalizeDate(invoiceData.created_at),
      deliveryDate: invoiceData.delivery_date ? normalizeDate(invoiceData.delivery_date) : null,
      deliveryStatus: invoiceData.delivery_status || 'Pending',
      type: invoiceData.type || invoiceType,
      originalType: invoiceData.type || invoiceType,
      amount: Number(invoiceData.total || 0),
      total: Number(invoiceData.total || 0),
      subtotal: Number(invoiceData.subtotal || 0),
      discount: Number(invoiceData.discount || 0),
      discountType: invoiceData.discount_type || 'fixed',
      deliveryCharge: Number(invoiceData.delivery_charge || 0),
      paid: Number(invoiceData.paid_amount || 0),
      due: Number(invoiceData.due_amount || 0),
      paymentMethod: invoiceData.payment_method || 'Cash',
      createdBy: invoiceData.created_by_name || 'Staff',
      items,
      payments,
      oldDue: customerRes?.data ? Math.max(0, (Number(customerRes.data.total_due) || 0) - Number(invoiceData.due_amount || 0)) : 0
    };

    return NextResponse.json({
      success: true,
      verified: true,
      invoice: formattedInvoice,
      settings: settingsRes?.data?.settings || null
    });

  } catch (error: any) {
    console.error('Public Invoice Verification Error:', error);
    return NextResponse.json(
      { error: 'Internal server error verifying invoice credentials.' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = body.id || body.invoice_id || body.invoice_number;
    const dateParam = body.date || body.invoice_date;
    const code = body.code || body.secret_token || body.token;

    const url = new URL(request.url);
    if (id) url.searchParams.set('id', id);
    if (dateParam) url.searchParams.set('date', dateParam);
    if (code) url.searchParams.set('code', code);

    const getReq = new Request(url.toString(), { method: 'GET' });
    return GET(getReq);
  } catch {
    return NextResponse.json({ error: 'Malformed request payload' }, { status: 400 });
  }
}
