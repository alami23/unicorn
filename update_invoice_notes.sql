-- Add notes column to furniture_invoices and wood_invoices
ALTER TABLE public.furniture_invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.wood_invoices ADD COLUMN IF NOT EXISTS notes TEXT;
