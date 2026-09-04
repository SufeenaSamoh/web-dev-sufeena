-- Hana Inventory Stock — Supabase schema
-- Run this once in the Supabase SQL editor (project yzoxtjbduqwogagytkgg).
-- Safe to re-run: uses IF NOT EXISTS and idempotent policy setup.

create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact_person text default '',
  phone text default '',
  email text default '',
  address text default '',
  active boolean not null default true,
  remark text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  unit text not null default 'kg',
  stock_unit text default 'kg',
  recipe_unit text default 'g',
  conversion_factor numeric default 1 check (conversion_factor > 0),
  item_type text default 'raw' check (item_type in ('raw', 'prepared')),
  barcode text default '',
  description text default '',
  purchase_price numeric not null default 0,
  current_stock numeric not null default 0,
  minimum_stock numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null default 'employee',
  branch_id uuid references public.branches(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  type text not null check (type in ('beginning','purchase','usage','adjustment')),
  quantity numeric not null,
  unit_price numeric,
  date timestamptz not null default now(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  ref_id uuid,
  remark text,
  expiry_date timestamptz,
  employee text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_date timestamptz not null default now(),
  invoice_number text default '',
  employee text default '',
  remark text default '',
  total numeric not null default 0,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  quantity numeric not null,
  unit_price numeric not null default 0,
  expiry_date timestamptz,
  remark text
);

create table if not exists public.company_settings (
  id text primary key,
  company_name text default '',
  logo_url text default '',
  address text default '',
  phone text default '',
  email text default '',
  updated_at timestamptz not null default now()
);

-- Recipe Master
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  menu_code text not null,
  menu_name text not null,
  ingredient_code text not null references public.items(code) on update cascade on delete cascade,
  ingredient_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'g',
  sub_recipe_code text default '',
  active boolean not null default true,
  is_deleted boolean not null default false,
  status text not null default 'active',
  reason text default '',
  action_timestamp timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Daily/Weekly Sales Records
create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  menu_code text not null,
  menu_name text not null,
  quantity_sold numeric not null default 0,
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text default 'สาขาหลัก',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_recipes (
  id uuid primary key default gen_random_uuid(),
  produced_item_code text not null,
  yield_quantity numeric(12, 4) not null default 1,
  yield_unit text not null,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  production_recipe_id uuid not null references public.production_recipes(id) on delete cascade,
  ingredient_code text not null,
  ingredient_name text not null,
  quantity numeric(12, 4) not null,
  unit text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  produced_item_code text not null,
  produced_item_name text,
  batch_quantity numeric(12, 4) not null,
  yield_unit text not null,
  produced_at timestamptz not null default now(),
  branch_id uuid references public.branches(id) on delete set null,
  branch_name text,
  note text,
  created_by text not null default 'Staff',
  created_at timestamptz not null default now()
);

create table if not exists public.production_batch_consumptions (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references public.production_batches(id) on delete cascade,
  ingredient_code text not null,
  ingredient_name text not null,
  quantity_consumed numeric(12, 4) not null,
  unit text not null,
  created_at timestamptz not null default now()
);

-- Data API grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.categories, public.suppliers, public.branches, public.items,
  public.users, public.transactions, public.purchases, public.purchase_items,
  public.company_settings, public.recipes, public.sales_records,
  public.production_recipes, public.production_recipe_ingredients,
  public.production_batches, public.production_batch_consumptions
  to anon, authenticated;
grant all on
  public.categories, public.suppliers, public.branches, public.items,
  public.users, public.transactions, public.purchases, public.purchase_items,
  public.company_settings, public.recipes, public.sales_records,
  public.production_recipes, public.production_recipe_ingredients,
  public.production_batches, public.production_batch_consumptions
  to service_role;

-- Permissive RLS so the anon publishable key can read/write.
-- Tighten to your auth model before going to production.
do $$
declare t text;
begin
  for t in select unnest(array['categories','suppliers','branches','items','users','transactions','purchases','purchase_items','company_settings','recipes','sales_records','production_recipes','production_recipe_ingredients','production_batches','production_batch_consumptions'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allow_all" on public.%I', t);
    execute format('create policy "allow_all" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;