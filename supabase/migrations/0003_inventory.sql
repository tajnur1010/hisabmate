-- ============================================================================
--  HisabMate — products & inventory (0003_inventory)
--  Run this AFTER 0002_rls.sql. Safe to run on a live database: every statement
--  is additive (create table/index if not exists) — nothing existing is dropped,
--  altered or migrated, so current parties/transactions/expenses are untouched.
--
--  Design notes
--  ------------
--  * The golden rule from 0001 carries over to stock: a product's CURRENT STOCK
--    is never a stored editable column. It is derived by the app from
--    opening_stock + the signed effect of its stock_movements. That way an
--    edited or deleted movement simply recomputes the chain, exactly like party
--    balances. `products.opening_stock` is the direct analogue of
--    `parties.opening_balance`.
--  * quantity is always a POSITIVE magnitude (CHECK quantity > 0); direction
--    comes from `type` ('in' | 'out') — mirroring how transactions derive
--    direction from `type` rather than storing negative amounts. A physical
--    stock-count correction is therefore written as an 'in' or an 'out' row with
--    reason = 'adjust', which keeps the invariant intact and leaves an audit
--    trail instead of silently overwriting a number.
--  * quantity is numeric(14,3) so shops selling by weight/volume (kg, litre) can
--    record fractional amounts.
--  * unit_cost / unit_price snapshot the money at movement time. Product profit
--    is computed from these, never from today's price list — that would
--    retroactively rewrite history when a price changes.
--  * ref_type / ref_id are forward declarations for later phases (sales and
--    purchase invoices, returns). They stay null for manual stock entries, so
--    invoices can link their line items to stock movements without another
--    migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  product_categories — optional grouping for products ("Rice", "Cosmetics")
-- ---------------------------------------------------------------------------
create table if not exists public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists product_categories_business_idx
  on public.product_categories (business_id);

-- Case-insensitive uniqueness per shop, so "Rice" and "rice" can't both exist.
create unique index if not exists product_categories_business_name_key
  on public.product_categories (business_id, lower(name));

-- ---------------------------------------------------------------------------
--  products — the item catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  -- Deleting a category leaves its products intact, just uncategorised.
  category_id         uuid references public.product_categories (id) on delete set null,
  name                text not null,
  sku                 text,
  barcode             text,
  unit                text not null default 'pcs'
                        check (unit in ('pcs', 'kg', 'gram', 'litre', 'ml', 'dozen', 'box', 'metre', 'other')),
  purchase_price      numeric(14,2) not null default 0 check (purchase_price >= 0),
  selling_price       numeric(14,2) not null default 0 check (selling_price >= 0),
  -- Stock on hand when the product was first added. Current stock is DERIVED.
  opening_stock       numeric(14,3) not null default 0,
  -- Alert threshold; 0 disables the low-stock warning for this product.
  low_stock_threshold numeric(14,3) not null default 0 check (low_stock_threshold >= 0),
  photo_url           text,
  notes               text,
  archived            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists products_business_idx
  on public.products (business_id);
create index if not exists products_business_category_idx
  on public.products (business_id, category_id);
create index if not exists products_active_idx
  on public.products (business_id) where archived = false;

-- SKU and barcode are unique per shop when present (partial unique indexes let
-- unlimited products carry no SKU/barcode at all).
create unique index if not exists products_business_sku_key
  on public.products (business_id, sku) where sku is not null;
create unique index if not exists products_business_barcode_key
  on public.products (business_id, barcode) where barcode is not null;

-- Barcode scanning looks up by code within the shop — keep it indexed.
create index if not exists products_barcode_lookup_idx
  on public.products (business_id, barcode) where barcode is not null;

-- ---------------------------------------------------------------------------
--  stock_movements — every change to stock, append-only by intent
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  type        text not null check (type in ('in', 'out')),
  reason      text not null default 'adjust'
                check (reason in ('opening', 'purchase', 'sale', 'return_in', 'return_out',
                                  'damage', 'adjust', 'transfer')),
  quantity    numeric(14,3) not null check (quantity > 0),
  -- Money snapshots at movement time (see design notes).
  unit_cost   numeric(14,2),
  unit_price  numeric(14,2),
  note        text,
  -- Link to the document that caused this movement (invoice/return), later phases.
  ref_type    text check (ref_type in ('invoice', 'return', 'transaction', 'manual')),
  ref_id      uuid,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  client_id   text unique,
  deleted_at  timestamptz
);
create index if not exists stock_movements_business_time_idx
  on public.stock_movements (business_id, occurred_at desc);
create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id, occurred_at desc);
create index if not exists stock_movements_live_idx
  on public.stock_movements (business_id, occurred_at desc) where deleted_at is null;
create index if not exists stock_movements_ref_idx
  on public.stock_movements (ref_type, ref_id) where ref_id is not null;

-- ---------------------------------------------------------------------------
--  updated_at maintenance (reuses public.set_updated_at from 0001)
-- ---------------------------------------------------------------------------
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
--  Row-Level Security — same model as 0002: access requires membership of the
--  owning business, so one shop can never read or write another shop's stock.
-- ---------------------------------------------------------------------------
alter table public.product_categories enable row level security;
alter table public.products           enable row level security;
alter table public.stock_movements    enable row level security;

drop policy if exists product_categories_all on public.product_categories;
create policy product_categories_all on public.product_categories
  for all
  using (public.is_member_of(business_id))
  with check (public.is_member_of(business_id));

drop policy if exists products_all on public.products;
create policy products_all on public.products
  for all
  using (public.is_member_of(business_id))
  with check (public.is_member_of(business_id));

-- Movements follow the transactions pattern: inserts must be attributed to the
-- acting user, so the audit trail cannot be forged.
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select using (public.is_member_of(business_id));

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements
  for insert with check (public.is_member_of(business_id) and created_by = auth.uid());

drop policy if exists stock_movements_update on public.stock_movements;
create policy stock_movements_update on public.stock_movements
  for update using (public.is_member_of(business_id))
  with check (public.is_member_of(business_id));

drop policy if exists stock_movements_delete on public.stock_movements;
create policy stock_movements_delete on public.stock_movements
  for delete using (public.is_member_of(business_id));

-- ---------------------------------------------------------------------------
--  Privileges (RLS decides rows; roles still need table privileges).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.product_categories, public.products, public.stock_movements
  to authenticated;
