-- ============================================================================
--  HisabMate — Row-Level Security (0002_rls)
--  Run this AFTER 0001_init.sql.
--
--  Model: a user may touch a business's data only if they are a member of that
--  business (business_members). The owner is added as a member during signup.
--
--  Recursion guard: policies decide membership through is_member_of(), a
--  SECURITY DEFINER function that reads business_members with RLS bypassed —
--  so the membership lookup never re-triggers the policies that call it.
-- ============================================================================

create or replace function public.is_member_of(bid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = bid
      and m.user_id = auth.uid()
  );
$$;

-- Enable RLS everywhere. With RLS on and no matching policy, access is denied.
alter table public.profiles         enable row level security;
alter table public.businesses       enable row level security;
alter table public.business_members enable row level security;
alter table public.parties          enable row level security;
alter table public.transactions     enable row level security;
alter table public.expenses         enable row level security;
alter table public.reminders        enable row level security;

-- ---------------------------------------------------------------------------
--  profiles — a user sees and edits only their own profile
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
--  businesses — owner has full control; members may read
-- ---------------------------------------------------------------------------
drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses
  for select using (owner_id = auth.uid() or public.is_member_of(id));

drop policy if exists businesses_insert on public.businesses;
create policy businesses_insert on public.businesses
  for insert with check (owner_id = auth.uid());

drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists businesses_delete on public.businesses;
create policy businesses_delete on public.businesses
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
--  business_members — you can see your own memberships and co-members;
--  only the business owner may add or remove members.
-- ---------------------------------------------------------------------------
drop policy if exists members_select on public.business_members;
create policy members_select on public.business_members
  for select using (user_id = auth.uid() or public.is_member_of(business_id));

drop policy if exists members_insert on public.business_members;
create policy members_insert on public.business_members
  for insert with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists members_update on public.business_members;
create policy members_update on public.business_members
  for update using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists members_delete on public.business_members;
create policy members_delete on public.business_members
  for delete using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
--  parties — full access scoped to businesses you belong to
-- ---------------------------------------------------------------------------
drop policy if exists parties_all on public.parties;
create policy parties_all on public.parties
  for all
  using (public.is_member_of(business_id))
  with check (public.is_member_of(business_id));

-- ---------------------------------------------------------------------------
--  transactions — member-scoped; inserts must be attributed to the actor
-- ---------------------------------------------------------------------------
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select using (public.is_member_of(business_id));

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert with check (public.is_member_of(business_id) and created_by = auth.uid());

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete using (public.is_member_of(business_id));

-- ---------------------------------------------------------------------------
--  expenses — same rules as transactions
-- ---------------------------------------------------------------------------
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select using (public.is_member_of(business_id));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert with check (public.is_member_of(business_id) and created_by = auth.uid());

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update using (public.is_member_of(business_id)) with check (public.is_member_of(business_id));

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete using (public.is_member_of(business_id));

-- ---------------------------------------------------------------------------
--  reminders — member-scoped; inserts attributed to the actor
-- ---------------------------------------------------------------------------
drop policy if exists reminders_select on public.reminders;
create policy reminders_select on public.reminders
  for select using (public.is_member_of(business_id));

drop policy if exists reminders_insert on public.reminders;
create policy reminders_insert on public.reminders
  for insert with check (public.is_member_of(business_id) and created_by = auth.uid());

drop policy if exists reminders_delete on public.reminders;
create policy reminders_delete on public.reminders
  for delete using (public.is_member_of(business_id));

-- ---------------------------------------------------------------------------
--  Privileges. RLS decides row visibility; roles still need table privileges.
--  (Supabase usually grants these by default; included so the migration is
--  self-contained. anon gets nothing — every policy requires auth.uid().)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_member_of(uuid) to authenticated;
