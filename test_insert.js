const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  const { data: customers, error: custErr } = await supabase.from('customer').select('id, name').limit(1);
  if (custErr) {
    console.log('Error fetching customers:', custErr);
    return;
  }
  if (!customers || customers.length === 0) {
    console.log('No customers found');
    return;
  }
  const customer = customers[0];
  console.log(`Using customer: ${customer.name} (ID: ${customer.id})`);

  console.log('Testing inserting a transaction...');
  const txnId = 'TXN-TEST-' + Math.floor(Math.random() * 1000);
  const { data, error } = await supabase.from('transactions').insert([{
    id: txnId,
    customer_id: customer.id,
    date: new Date().toISOString().split('T')[0],
    type: 'Invoice',
    ref: 'TEST-INV',
    debit: 100,
    credit: 0,
    balance: 100,
    method: 'Cash',
    notes: 'Test'
  }]);

  if (error) {
    console.log('❌ Insert transaction failed:', error);
  } else {
    console.log('✅ Insert transaction succeeded!');
    await supabase.from('transactions').delete().eq('id', txnId);
  }
}

runTest();
