-- ============================================================================
--  HisabMate — schema (0001_init)
--  Run this in the Supabase SQL editor, or via `supabase db push`.
--  Security (Row-Level Security policies) is applied separately in 0002_rls.sql
--  — run that file immediately after this one.
--
--  Design notes
--  ------------
--  * Money is stored as numeric(14,2). Transaction/expense amounts are always a
--    positive magnitude (CHECK amount > 0); direction is derived from `type`.
--  * Party balances are NEVER stored as an editable column — they are derived by
--    the app from opening_balance + transaction history. We only keep audit
--    snapshots (previous_balance / new_balance) on each transaction row.
--  * client_id de-duplicates offline submissions (idempotent create).
--  * Rows are soft-deleted via deleted_at (transactions, expenses) or archived
--    (parties), so history and receipts stay intact.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
--  profiles — one row per auth user (mirrors auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  businesses — a shop / ledger owned by a user
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  owner_name text not null default '',
  phone      text,
  address    text,
  logo_url   text,
  currency   text not null default '৳',
  language   text not null default 'bn' check (language in ('bn', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists businesses_owner_idx on public.businesses (owner_id);

-- ---------------------------------------------------------------------------
--  business_members — which users may access a business, and their role
-- ---------------------------------------------------------------------------
create table if not exists public.business_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);
create index if not exists business_members_user_idx on public.business_members (user_id);

-- ---------------------------------------------------------------------------
--  parties — customers and suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.parties (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  type            text not null check (type in ('customer', 'supplier')),
  name            text not null,
  phone           text,
  address         text,
  photo_url       text,
  opening_balance numeric(14,2) not null default 0,
  credit_limit    numeric(14,2),
  due_date        date,
  notes           text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists parties_business_idx      on public.parties (business_id);
create index if not exists parties_business_type_idx on public.parties (business_id, type);
create index if not exists parties_active_idx        on public.parties (business_id) where archived = false;

-- ---------------------------------------------------------------------------
--  transactions — the ledger (received / paid / credit_sale / refund)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  party_id         uuid references public.parties (id) on delete set null,
  party_type       text check (party_type in ('customer', 'supplier')),
  type             text not null check (type in ('received', 'paid', 'credit_sale', 'refund')),
  amount           numeric(14,2) not null check (amount > 0),
  note             text,
  method           text not null default 'cash' check (method in ('cash', 'bkash', 'nagad', 'bank', 'other')),
  occurred_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  created_by       uuid not null references auth.users (id),
  previous_balance numeric(14,2) not null default 0,
  new_balance      numeric(14,2) not null default 0,
  client_id        text unique,
  deleted_at       timestamptz
);
create index if not exists transactions_business_time_idx on public.transactions (business_id, occurred_at desc);
create index if not exists transactions_party_idx         on public.transactions (party_id);
create index if not exists transactions_business_type_idx on public.transactions (business_id, type);
create index if not exists transactions_live_idx          on public.transactions (business_id, occurred_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
--  expenses — business spend, categorised
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  category    text not null check (category in
                ('rent', 'electricity', 'salary', 'transport', 'purchase', 'food', 'maintenance', 'other')),
  note        text,
  method      text not null default 'cash' check (method in ('cash', 'bkash', 'nagad', 'bank', 'other')),
  occurred_at timestamptz not null default now(),
  receipt_url text,
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users (id),
  client_id   text unique,
  deleted_at  timestamptz
);
create index if not exists expenses_business_time_idx on public.expenses (business_id, occurred_at desc);
create index if not exists expenses_business_cat_idx  on public.expenses (business_id, category);
create index if not exists expenses_live_idx          on public.expenses (business_id, occurred_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
--  reminders — payment nudges sent to parties (audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  party_id    uuid not null references public.parties (id) on delete cascade,
  message     text not null,
  channel     text not null check (channel in ('whatsapp', 'sms', 'copy')),
  sent_at     timestamptz not null default now(),
  created_by  uuid not null references auth.users (id)
);
create index if not exists reminders_business_time_idx on public.reminders (business_id, sent_at desc);
create index if not exists reminders_party_idx         on public.reminders (party_id);

-- ---------------------------------------------------------------------------
--  updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists parties_set_updated_at on public.parties;
create trigger parties_set_updated_at
  before update on public.parties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
--  Auto-create a profile row when a new auth user signs up.
--  (The app also upserts the profile defensively, so this is belt-and-braces.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
