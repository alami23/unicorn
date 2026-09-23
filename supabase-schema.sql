-- Supabase SQL Schema for Furniture & Wood POS Application

-- 0. Custom Users Table (For Custom Non-Supabase Auth)
CREATE TABLE IF NOT EXISTS public.custom_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  username TEXT,
  password TEXT NOT NULL, -- Storing plain/simple hash for prototype as requested
  role TEXT DEFAULT 'Super Admin',
  org_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.custom_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to custom_users" ON public.custom_users;
DROP POLICY IF EXISTS "Allow public full access to custom_users" ON public.custom_users;
CREATE POLICY "Allow public full access to custom_users" ON public.custom_users FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS public.customer (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  type TEXT DEFAULT 'Regular',
  total_orders INTEGER DEFAULT 0,
  total_due NUMERIC DEFAULT 0,
  last_purchase DATE,
  email TEXT,
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Staff Table
CREATE TABLE IF NOT EXISTS public.staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  join_date DATE NOT NULL,
  salary NUMERIC NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Bills Table
CREATE TABLE IF NOT EXISTS public.bills (
  id TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'Pending',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Furniture Products Table
CREATE TABLE IF NOT EXISTS public.furniture_inventory (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  buy_price NUMERIC DEFAULT 0,
  sell_price NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0, -- Legacy support (Sell Price)
  stock INTEGER DEFAULT 0,
  size TEXT DEFAULT 'Standard',
  image TEXT,
  description TEXT,
  sku TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Wood Products Table
CREATE TABLE IF NOT EXISTS public.wood_inventory (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  tree_no TEXT NOT NULL,
  car_no TEXT NOT NULL,
  width NUMERIC NOT NULL,
  length NUMERIC NOT NULL,
  cft NUMERIC NOT NULL,
  tag TEXT,
  buy_price NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  is_sold BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7a. Furniture Invoices Table
CREATE TABLE IF NOT EXISTS public.furniture_invoices (
  org_id UUID,
  invoice_number TEXT,
  customer_id TEXT REFERENCES public.customer(id),
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  type TEXT NOT NULL, -- 'Furniture'
  subtotal NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed',
  delivery_charge NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL,
  due_amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  delivery_date DATE,
  delivery_status TEXT DEFAULT 'Pending',
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7b. Wood Invoices Table
CREATE TABLE IF NOT EXISTS public.wood_invoices (
  org_id UUID,
  invoice_number TEXT,
  customer_id TEXT REFERENCES public.customer(id),
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  type TEXT NOT NULL, -- 'Wood', 'solo_wood'
  subtotal NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed',
  delivery_charge NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL,
  due_amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8a. Furniture Invoice Items Table
CREATE TABLE IF NOT EXISTS public.furniture_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT REFERENCES public.furniture_invoices(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL, -- 'furniture'
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER DEFAULT 1,
  total NUMERIC NOT NULL
);

-- 8b. Wood Invoice Items Table
CREATE TABLE IF NOT EXISTS public.wood_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT REFERENCES public.wood_invoices(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL, -- 'wood'
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  cft NUMERIC, -- Only for wood
  tag TEXT,
  car_no TEXT,
  width NUMERIC,
  length NUMERIC,
  total NUMERIC NOT NULL
);

-- 9. Transactions / Customer Statements Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES public.customer(id),
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'Invoice', 'Payment'
  ref TEXT NOT NULL, -- Invoice ID or Payment ID
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  balance NUMERIC NOT NULL,
  method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 24. Furniture Categories
CREATE TABLE IF NOT EXISTS public.furniture_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT DEFAULT 'Standard',
  description TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrations for existing tables (Ensure this is run within a DO block in Supabase)
DO $$
BEGIN
    -- furniture_inventory migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='furniture_inventory' AND column_name='buy_price' AND table_schema='public') THEN
        ALTER TABLE public.furniture_inventory ADD COLUMN buy_price NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='furniture_inventory' AND column_name='sell_price' AND table_schema='public') THEN
        ALTER TABLE public.furniture_inventory ADD COLUMN sell_price NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='furniture_inventory' AND column_name='stock' AND table_schema='public') THEN
        ALTER TABLE public.furniture_inventory ADD COLUMN stock INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='furniture_inventory' AND column_name='size' AND table_schema='public') THEN
        ALTER TABLE public.furniture_inventory ADD COLUMN size TEXT DEFAULT 'Standard';
    END IF;

    -- furniture_category migration
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='furniture_category' AND table_schema='public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='furniture_category' AND column_name='size' AND table_schema='public') THEN
            ALTER TABLE public.furniture_category ADD COLUMN size TEXT DEFAULT 'Standard';
        END IF;
    END IF;

    -- transactions migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='method' AND table_schema='public') THEN
        ALTER TABLE public.transactions ADD COLUMN method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='notes' AND table_schema='public') THEN
        ALTER TABLE public.transactions ADD COLUMN notes TEXT;
    END IF;

    -- furniture_invoices migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='furniture_invoices' AND column_name='delivery_status' AND table_schema='public') THEN
        ALTER TABLE public.furniture_invoices ADD COLUMN delivery_status TEXT DEFAULT 'Pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='furniture_invoices' AND column_name='delivery_date' AND table_schema='public') THEN
        ALTER TABLE public.furniture_invoices ADD COLUMN delivery_date DATE;
    END IF;
    
    -- Sync existing customer order counts
    UPDATE public.customer c
    SET total_orders = (SELECT COUNT(*) FROM public.furniture_invoices i WHERE i.customer_name = c.name) +
                       (SELECT COUNT(*) FROM public.wood_invoices i WHERE i.customer_name = c.name)
    WHERE name != 'Walk-in Customer';
END $$;

-- Trigger to update customer total_orders automatically
CREATE OR REPLACE FUNCTION update_customer_orders_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.customer
  SET total_orders = (SELECT COUNT(*) FROM public.furniture_invoices WHERE customer_name = COALESCE(NEW.customer_name, OLD.customer_name)) +
                     (SELECT COUNT(*) FROM public.wood_invoices WHERE customer_name = COALESCE(NEW.customer_name, OLD.customer_name))
  WHERE name = COALESCE(NEW.customer_name, OLD.customer_name) AND name != 'Walk-in Customer';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_customer_orders_count_furniture ON public.furniture_invoices;
CREATE TRIGGER trg_update_customer_orders_count_furniture
AFTER INSERT OR UPDATE OR DELETE ON public.furniture_invoices
FOR EACH ROW
EXECUTE FUNCTION update_customer_orders_count();

DROP TRIGGER IF EXISTS trg_update_customer_orders_count_wood ON public.wood_invoices;
CREATE TRIGGER trg_update_customer_orders_count_wood
AFTER INSERT OR UPDATE OR DELETE ON public.wood_invoices
FOR EACH ROW
EXECUTE FUNCTION update_customer_orders_count();

-- Row Level Security (RLS) Policies (Optional but recommended)
ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public/anonymous and authenticated users to read/write all tables
DROP POLICY IF EXISTS "Allow authenticated full access to customer" ON public.customer;
DROP POLICY IF EXISTS "Allow public full access to customer" ON public.customer;
CREATE POLICY "Allow public full access to customer" ON public.customer FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public full access to staff" ON public.staff;
CREATE POLICY "Allow public full access to staff" ON public.staff FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to bills" ON public.bills;
DROP POLICY IF EXISTS "Allow public full access to bills" ON public.bills;
CREATE POLICY "Allow public full access to bills" ON public.bills FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to furniture_inventory" ON public.furniture_inventory;
DROP POLICY IF EXISTS "Allow public full access to furniture_inventory" ON public.furniture_inventory;
CREATE POLICY "Allow public full access to furniture_inventory" ON public.furniture_inventory FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to wood_inventory" ON public.wood_inventory;
DROP POLICY IF EXISTS "Allow public full access to wood_inventory" ON public.wood_inventory;
CREATE POLICY "Allow public full access to wood_inventory" ON public.wood_inventory FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to furniture_invoices" ON public.furniture_invoices;
DROP POLICY IF EXISTS "Allow public full access to furniture_invoices" ON public.furniture_invoices;
DROP POLICY IF EXISTS "Allow all access to furniture_invoices" ON public.furniture_invoices;
CREATE POLICY "Allow all access to furniture_invoices" ON public.furniture_invoices FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to wood_invoices" ON public.wood_invoices;
DROP POLICY IF EXISTS "Allow public full access to wood_invoices" ON public.wood_invoices;
DROP POLICY IF EXISTS "Allow all access to wood_invoices" ON public.wood_invoices;
CREATE POLICY "Allow all access to wood_invoices" ON public.wood_invoices FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to furniture_invoice_items" ON public.furniture_invoice_items;
DROP POLICY IF EXISTS "Allow public full access to furniture_invoice_items" ON public.furniture_invoice_items;
DROP POLICY IF EXISTS "Allow all access to furniture_invoice_items" ON public.furniture_invoice_items;
CREATE POLICY "Allow all access to furniture_invoice_items" ON public.furniture_invoice_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to wood_invoice_items" ON public.wood_invoice_items;
DROP POLICY IF EXISTS "Allow public full access to wood_invoice_items" ON public.wood_invoice_items;
DROP POLICY IF EXISTS "Allow all access to wood_invoice_items" ON public.wood_invoice_items;
CREATE POLICY "Allow all access to wood_invoice_items" ON public.wood_invoice_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public full access to transactions" ON public.transactions;
CREATE POLICY "Allow public full access to transactions" ON public.transactions FOR ALL TO public USING (true) WITH CHECK (true);

-- 10. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  settings JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated full access to app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public full access to app_settings" ON public.app_settings;
CREATE POLICY "Allow public full access to app_settings" ON public.app_settings FOR ALL TO public USING (true) WITH CHECK (true);

-- 11. Wood Categories
CREATE TABLE IF NOT EXISTS public.wood_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Wood Sub-Categories (Car Numbers)
CREATE TABLE IF NOT EXISTS public.wood_category_car (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES public.wood_category(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Wood Tags
CREATE TABLE IF NOT EXISTS public.wood_category_tag (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  buy_price NUMERIC DEFAULT 0,
  sell_price NUMERIC DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. SMS History
CREATE TABLE IF NOT EXISTS public.sms_history (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  status TEXT DEFAULT 'Sent'
);

-- 23. Storage Buckets
ALTER TABLE public.wood_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_category_car ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_category_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_history ENABLE ROW LEVEL SECURITY;
-- Policies
DROP POLICY IF EXISTS "Allow authenticated full access to wood_category" ON public.wood_category;
DROP POLICY IF EXISTS "Allow public full access to wood_category" ON public.wood_category;
CREATE POLICY "Allow public full access to wood_category" ON public.wood_category FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to wood_category_car" ON public.wood_category_car;
DROP POLICY IF EXISTS "Allow public full access to wood_category_car" ON public.wood_category_car;
CREATE POLICY "Allow public full access to wood_category_car" ON public.wood_category_car FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to wood_category_tag" ON public.wood_category_tag;
DROP POLICY IF EXISTS "Allow public full access to wood_category_tag" ON public.wood_category_tag;
CREATE POLICY "Allow public full access to wood_category_tag" ON public.wood_category_tag FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to sms_history" ON public.sms_history;
DROP POLICY IF EXISTS "Allow public full access to sms_history" ON public.sms_history;
CREATE POLICY "Allow public full access to sms_history" ON public.sms_history FOR ALL TO public USING (true) WITH CHECK (true);

-- 23. Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.furniture_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to furniture_category" ON public.furniture_category;
CREATE POLICY "Allow public full access to furniture_category" ON public.furniture_category FOR ALL TO public USING (true) WITH CHECK (true);


-- 25. License Keys Table
CREATE TABLE IF NOT EXISTS public.license_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  used_by_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for License Keys
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to license_keys" ON public.license_keys;
CREATE POLICY "Allow public full access to license_keys" ON public.license_keys FOR ALL TO public USING (true) WITH CHECK (true);

-- 26. Excel Temp Rows
CREATE TABLE IF NOT EXISTS public.make_excel_file (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  car_no TEXT,
  tag TEXT,
  tree_no TEXT,
  width TEXT,
  length TEXT,
  buy_price TEXT,
  sell_price TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Excel Temp Rows
ALTER TABLE public.make_excel_file ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to make_excel_file" ON public.make_excel_file;
CREATE POLICY "Allow public full access to make_excel_file" ON public.make_excel_file FOR ALL TO public USING (true) WITH CHECK (true);

-- =========================================================================
-- MULTI-TENANCY & ROW-LEVEL SECURITY ENFORCEMENT CONFIGURATIONS
-- =========================================================================

-- 1. Add org_id Column to All Tenant-Scoped Tables & Ensure role Column on custom_users
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Super Admin';
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.furniture_inventory ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.wood_inventory ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.wood_invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.furniture_invoice_items ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.wood_invoice_items ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.furniture_category ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.wood_category ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.wood_category_car ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.wood_category_tag ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.sms_history ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.make_excel_file ADD COLUMN IF NOT EXISTS org_id UUID;

-- 2. Migrate Existing Rows to the First Registered User's Organization
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the organization ID of the oldest user
  SELECT org_id INTO default_org_id FROM public.custom_users ORDER BY created_at LIMIT 1;
  
  -- If no user exists, generate a default one
  IF default_org_id IS NULL THEN
    default_org_id := gen_random_uuid();
  END IF;

  -- Backfill NULL org_id fields for existing rows
  UPDATE public.customer SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.staff SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.bills SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.furniture_inventory SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.wood_inventory SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.furniture_invoices SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.wood_invoices SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.furniture_invoice_items SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.wood_invoice_items SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.transactions SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.furniture_category SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.wood_category SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.wood_category_car SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.wood_category_tag SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.sms_history SET org_id = default_org_id WHERE org_id IS NULL;
  UPDATE public.make_excel_file SET org_id = default_org_id WHERE org_id IS NULL;

  -- Also migrate settings
  IF EXISTS (SELECT 1 FROM public.app_settings WHERE id = 'global') THEN
    INSERT INTO public.app_settings (id, settings)
    SELECT default_org_id::text, settings FROM public.app_settings WHERE id = 'global'
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3. Create HTTP Request Header Helper function for RLS
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS TEXT AS $$
  SELECT coalesce(
    current_setting('request.headers', true)::jsonb->>'x-org-id',
    ''
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT coalesce(
    (SELECT role FROM public.custom_users 
     WHERE (id::text = current_setting('request.headers', true)::jsonb->>'x-user-id' 
        OR email = current_setting('request.headers', true)::jsonb->>'x-user-email'
        OR phone = current_setting('request.headers', true)::jsonb->>'x-user-phone') 
     LIMIT 1),
    current_setting('request.headers', true)::jsonb->>'x-user-role',
    'Staff'
  );
$$ LANGUAGE sql STABLE;

-- 4. Enable Row-Level Security (RLS) on All Scoped Tables
ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furniture_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_category_car ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wood_category_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.make_excel_file ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 5. Drop Legacy Permissive Public Policies
DROP POLICY IF EXISTS "Allow public full access to customer" ON public.customer;
DROP POLICY IF EXISTS "Allow public full access to staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public full access to bills" ON public.bills;
DROP POLICY IF EXISTS "Allow public full access to furniture_inventory" ON public.furniture_inventory;
DROP POLICY IF EXISTS "Allow public full access to wood_inventory" ON public.wood_inventory;
DROP POLICY IF EXISTS "Allow all access to furniture_invoices" ON public.furniture_invoices;
DROP POLICY IF EXISTS "Allow all access to wood_invoices" ON public.wood_invoices;
DROP POLICY IF EXISTS "Allow all access to furniture_invoice_items" ON public.furniture_invoice_items;
DROP POLICY IF EXISTS "Allow all access to wood_invoice_items" ON public.wood_invoice_items;
DROP POLICY IF EXISTS "Allow public full access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public full access to wood_category" ON public.wood_category;
DROP POLICY IF EXISTS "Allow public full access to wood_category_car" ON public.wood_category_car;
DROP POLICY IF EXISTS "Allow public full access to wood_category_tag" ON public.wood_category_tag;
DROP POLICY IF EXISTS "Allow public full access to sms_history" ON public.sms_history;
DROP POLICY IF EXISTS "Allow public full access to furniture_category" ON public.furniture_category;
DROP POLICY IF EXISTS "Allow public full access to make_excel_file" ON public.make_excel_file;
DROP POLICY IF EXISTS "Allow public full access to app_settings" ON public.app_settings;

-- 6. Drop Existing Isolation Policies (for idempotent script re-runs)
DROP POLICY IF EXISTS "Tenant isolation for customer" ON public.customer;
DROP POLICY IF EXISTS "Tenant isolation for staff" ON public.staff;
DROP POLICY IF EXISTS "Tenant isolation for bills" ON public.bills;
DROP POLICY IF EXISTS "Tenant isolation for furniture_inventory" ON public.furniture_inventory;
DROP POLICY IF EXISTS "Tenant isolation for wood_inventory" ON public.wood_inventory;
DROP POLICY IF EXISTS "Tenant isolation for furniture_invoices" ON public.furniture_invoices;
DROP POLICY IF EXISTS "Tenant isolation for wood_invoices" ON public.wood_invoices;
DROP POLICY IF EXISTS "Tenant isolation for furniture_invoice_items" ON public.furniture_invoice_items;
DROP POLICY IF EXISTS "Tenant isolation for wood_invoice_items" ON public.wood_invoice_items;
DROP POLICY IF EXISTS "Tenant isolation for transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant isolation for wood_category" ON public.wood_category;
DROP POLICY IF EXISTS "Tenant isolation for wood_category_car" ON public.wood_category_car;
DROP POLICY IF EXISTS "Tenant isolation for wood_category_tag" ON public.wood_category_tag;
DROP POLICY IF EXISTS "Tenant isolation for sms_history" ON public.sms_history;
DROP POLICY IF EXISTS "Tenant isolation for furniture_category" ON public.furniture_category;
DROP POLICY IF EXISTS "Tenant isolation for make_excel_file" ON public.make_excel_file;
DROP POLICY IF EXISTS "Tenant isolation for app_settings" ON public.app_settings;

-- 7. Create Enforced Multi-Tenancy RLS Policies
CREATE POLICY "Tenant isolation for customer" ON public.customer FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for staff" ON public.staff FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for bills" ON public.bills FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for furniture_inventory" ON public.furniture_inventory FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for wood_inventory" ON public.wood_inventory FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for furniture_invoices" ON public.furniture_invoices FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for wood_invoices" ON public.wood_invoices FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for furniture_invoice_items" ON public.furniture_invoice_items FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for wood_invoice_items" ON public.wood_invoice_items FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for transactions" ON public.transactions FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for wood_category" ON public.wood_category FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for wood_category_car" ON public.wood_category_car FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for wood_category_tag" ON public.wood_category_tag FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for sms_history" ON public.sms_history FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for furniture_category" ON public.furniture_category FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
CREATE POLICY "Tenant isolation for make_excel_file" ON public.make_excel_file FOR ALL TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
DROP POLICY IF EXISTS "Tenant isolation for app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "App settings read policy" ON public.app_settings;
DROP POLICY IF EXISTS "App settings write policy" ON public.app_settings;

-- Allow all organization users to view application settings (Read-Only)
CREATE POLICY "App settings read policy" ON public.app_settings 
FOR SELECT TO public 
USING (id = public.current_org_id() OR id = 'global' OR true);

-- Restrict modifying application settings strictly to Super Admin & Admin roles
CREATE POLICY "App settings write policy" ON public.app_settings 
FOR ALL TO public 
USING (
  (id = public.current_org_id() OR id = 'global') 
  AND public.current_user_role() IN ('Super Admin', 'Admin')
) 
WITH CHECK (
  (id = public.current_org_id() OR id = 'global') 
  AND public.current_user_role() IN ('Super Admin', 'Admin')
);

-- 8. Custom Users Policies & Role-Based Security Policies
DROP POLICY IF EXISTS "Allow public full access to custom_users" ON public.custom_users;
DROP POLICY IF EXISTS "Allow public select for login" ON public.custom_users;
DROP POLICY IF EXISTS "Allow public insert for signup" ON public.custom_users;
DROP POLICY IF EXISTS "Allow update own user" ON public.custom_users;
DROP POLICY IF EXISTS "Allow delete custom_users" ON public.custom_users;
DROP POLICY IF EXISTS "Restrict delete custom_users to super admin" ON public.custom_users;

-- Public read for checking username/phone/email matches during login
CREATE POLICY "Allow public select for login" ON public.custom_users FOR SELECT TO public USING (true);
-- Public insert for self-signup
CREATE POLICY "Allow public insert for signup" ON public.custom_users FOR INSERT TO public WITH CHECK (true);
-- Update restricted to own organization
CREATE POLICY "Allow update own user" ON public.custom_users FOR UPDATE TO public USING (org_id::text = public.current_org_id()) WITH CHECK (org_id::text = public.current_org_id());
-- Delete policy for custom_users account removal restricted to Super Admin or tenant owner
CREATE POLICY "Restrict delete custom_users to super admin" ON public.custom_users FOR DELETE TO public USING (
  role = 'Super Admin' OR public.current_user_role() = 'Super Admin' OR org_id::text = public.current_org_id()
);

-- Migration commands for invoice creator columns
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.wood_invoices ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.wood_invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;

