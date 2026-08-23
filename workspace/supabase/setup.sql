-- Case Desk — one-time Supabase setup.
--
-- Run this in the Supabase SQL editor AFTER `npx prisma db push` has created
-- the tables, and AFTER you have created the private `casebooks` bucket.
-- It is safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Who counts as a coach
-- ---------------------------------------------------------------------------
-- Storage policies need to answer "is this JWT a real coach?", and the answer
-- lives in the app's own User table. A plain subquery cannot read it once RLS
-- is on in step 3 — the policy would run as `authenticated`, hit an RLS'd table
-- with no policies, get nothing back, and deny everything. SECURITY DEFINER
-- runs the check as the function owner instead, which bypasses RLS.
--
-- This matters because the login form issues a Supabase identity to any email
-- that asks for a link (that is how an invited coach gets one on first
-- sign-in). The app then turns away anyone without an Invite — but Supabase
-- Storage would not. Without this check, any stranger holding a valid JWT
-- could read every casebook PDF straight out of the Storage API.

create or replace function public.is_case_desk_coach()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public."User" u
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_case_desk_coach() from public;
grant execute on function public.is_case_desk_coach() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Storage policies
-- ---------------------------------------------------------------------------
-- Casebook files are uploaded from the browser on behalf of a signed-in coach
-- and read back through short-lived signed URLs. Without these policies every
-- upload fails with a 403. Change 'casebooks' if you set a different
-- NEXT_PUBLIC_SUPABASE_BUCKET.

drop policy if exists "coaches read casebooks" on storage.objects;
create policy "coaches read casebooks" on storage.objects
  for select to authenticated
  using (bucket_id = 'casebooks' and public.is_case_desk_coach());

drop policy if exists "coaches upload casebooks" on storage.objects;
create policy "coaches upload casebooks" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'casebooks' and public.is_case_desk_coach());

-- Used by the admin-only "delete casebook" path, which removes the stored file
-- alongside the row.
drop policy if exists "coaches delete casebooks" on storage.objects;
create policy "coaches delete casebooks" on storage.objects
  for delete to authenticated
  using (bucket_id = 'casebooks' and public.is_case_desk_coach());

-- ---------------------------------------------------------------------------
-- 3. Lock the auto-generated REST API out of the app's tables
-- ---------------------------------------------------------------------------
-- Supabase exposes every table in `public` over PostgREST using the publishable
-- key, which ships to every browser by design. This app never uses that path —
-- it talks to Postgres through Prisma, which connects as `postgres` and
-- bypasses RLS. So enabling RLS with no policies closes the REST hole and
-- changes nothing for the app.
--
-- Without this, anyone holding the publishable key could read every candidate
-- name, every score, and every private coach note.

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- IMPORTANT: this relies on Prisma connecting as the `postgres` role, which has
-- BYPASSRLS. If you ever follow Supabase's optional guide to create a dedicated
-- `prisma` database user, that role MUST be created with `bypassrls` or every
-- query in the app will silently return nothing.
--
-- After running this, load /library and confirm the demo case is still listed.
-- If the app has gone blank, RLS is biting the app's own role — undo with:
--
--   do $$ declare t record; begin
--     for t in select tablename from pg_tables where schemaname = 'public' loop
--       execute format('alter table public.%I disable row level security', t.tablename);
--     end loop;
--   end $$;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- Every row should show rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Should list exactly the three casebook policies.
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
