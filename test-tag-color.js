const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
    const { data, error } = await supabase.from('wood_category_tag').select('color').limit(1);
    console.log("DATA:", data);
    console.log("ERROR:", error);
}
run();
