-- Supabase SQL script to configure Multi-Tenancy and Row-Level Security (RLS)
-- Run this script in your Supabase Dashboard SQL Editor!

-- 0. Ensure All Base Tables Exist
CREATE TABLE IF NOT EXISTS public.custom_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  username TEXT,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'Super Admin',
  org_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  join_date DATE NOT NULL,
  salary NUMERIC NOT NULL,
  status TEXT DEFAULT 'Active',
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bills (
  id TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'Pending',
  note TEXT,
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.furniture_inventory (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT,
  buy_price NUMERIC DEFAULT 0,
  sell_price NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0,
  stock INTEGER DEFAULT 0,
  size TEXT DEFAULT 'Standard',
  image TEXT,
  description TEXT,
  sku TEXT UNIQUE,
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.furniture_invoices (
  org_id UUID,
  invoice_number TEXT,
  customer_id TEXT REFERENCES public.customer(id),
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  type TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.wood_invoices (
  org_id UUID,
  invoice_number TEXT,
  customer_id TEXT REFERENCES public.customer(id),
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  type TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.furniture_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT REFERENCES public.furniture_invoices(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER DEFAULT 1,
  total NUMERIC NOT NULL,
  org_id UUID
);

CREATE TABLE IF NOT EXISTS public.wood_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT REFERENCES public.wood_invoices(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  cft NUMERIC,
  tag TEXT,
  car_no TEXT,
  width NUMERIC,
  length NUMERIC,
  total NUMERIC NOT NULL,
  org_id UUID
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES public.customer(id),
  date DATE NOT NULL,
  type TEXT NOT NULL,
  ref TEXT NOT NULL,
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  balance NUMERIC NOT NULL,
  method TEXT,
  notes TEXT,
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.furniture_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT DEFAULT 'Standard',
  description TEXT,
  status TEXT DEFAULT 'Active',
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wood_category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wood_category_car (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES public.wood_category(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wood_category_tag (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  buy_price NUMERIC DEFAULT 0,
  sell_price NUMERIC DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  status TEXT DEFAULT 'Active',
  org_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sms_history (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  status TEXT DEFAULT 'Sent',
  org_id UUID
);

CREATE TABLE IF NOT EXISTS public.make_excel_file (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  org_id UUID
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  settings JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. Add org_id Column & role Column to Tenant-Scoped Tables
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.custom_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Super Admin';
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.furniture_inventory ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.wood_inventory ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'Pending';
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS delivery_date DATE;
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

-- 3. Create HTTP Request Header Helper functions for RLS
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
-- Ensure default role is Super Admin
ALTER TABLE public.custom_users ALTER COLUMN role SET DEFAULT 'Super Admin';

-- Trigger function to enforce strict role modification rules at database level
CREATE OR REPLACE FUNCTION public.enforce_custom_users_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being altered
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Rule 1: Users CANNOT change their own role
    IF (OLD.id::text = current_setting('request.headers', true)::jsonb->>'x-user-id' 
        OR OLD.email = current_setting('request.headers', true)::jsonb->>'x-user-email'
        OR OLD.phone = current_setting('request.headers', true)::jsonb->>'x-user-phone') THEN
      RAISE EXCEPTION 'Users are not permitted to change their own role.';
    END IF;

    -- Rule 2: Only Super Admin role can assign or modify roles
    IF public.current_user_role() <> 'Super Admin' THEN
      RAISE EXCEPTION 'Only Super Admins are allowed to assign or modify roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_custom_users_role ON public.custom_users;
CREATE TRIGGER trg_enforce_custom_users_role
  BEFORE UPDATE ON public.custom_users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_custom_users_role_change();

DROP POLICY IF EXISTS "Allow public full access to custom_users" ON public.custom_users;
DROP POLICY IF EXISTS "Allow public select for login" ON public.custom_users;
DROP POLICY IF EXISTS "Allow public insert for signup" ON public.custom_users;
DROP POLICY IF EXISTS "Allow update own user" ON public.custom_users;
DROP POLICY IF EXISTS "Allow delete custom_users" ON public.custom_users;
DROP POLICY IF EXISTS "Restrict delete custom_users to super admin" ON public.custom_users;

-- Public read for checking username/phone/email matches during login
CREATE POLICY "Allow public select for login" ON public.custom_users FOR SELECT TO public USING (true);
-- Public insert for self-signup (defaults to 'Super Admin')
CREATE POLICY "Allow public insert for signup" ON public.custom_users FOR INSERT TO public WITH CHECK (true);
-- Update restricted to own organization or user
CREATE POLICY "Allow update own user" ON public.custom_users FOR UPDATE TO public USING (org_id::text = public.current_org_id() OR id::text = current_setting('request.headers', true)::jsonb->>'x-user-id') WITH CHECK (org_id::text = public.current_org_id() OR id::text = current_setting('request.headers', true)::jsonb->>'x-user-id');
-- Delete policy for custom_users account removal strictly restricted to Super Admin
CREATE POLICY "Restrict delete custom_users to super admin" ON public.custom_users FOR DELETE TO public USING (
  public.current_user_role() = 'Super Admin'
);

-- Migration commands for invoice creator columns
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.wood_invoices ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.wood_invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;
