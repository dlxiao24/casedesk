-- Case Desk — one-time Supabase setup.
--
-- Run this in the Supabase SQL editor AFTER `npx prisma db push` has created
-- the tables, and AFTER you have created the private storage bucket.
-- It is safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Storage policies
-- ---------------------------------------------------------------------------
-- Casebook files are uploaded from the browser with the anon key on behalf of a
-- signed-in coach, and read back through short-lived signed URLs. Without these
-- policies every upload fails with a 403.
--
-- Change 'casebooks' below if you set NEXT_PUBLIC_SUPABASE_BUCKET to something
-- else. The bucket itself must be created first, and must be PRIVATE.

drop policy if exists "coaches read casebooks" on storage.objects;
create policy "coaches read casebooks" on storage.objects
  for select to authenticated using (bucket_id = 'casebooks');

drop policy if exists "coaches upload casebooks" on storage.objects;
create policy "coaches upload casebooks" on storage.objects
  for insert to authenticated with check (bucket_id = 'casebooks');

-- Needed by the admin-only "delete casebook" path, which removes the stored
-- file alongside the row.
drop policy if exists "coaches delete casebooks" on storage.objects;
create policy "coaches delete casebooks" on storage.objects
  for delete to authenticated using (bucket_id = 'casebooks');

-- ---------------------------------------------------------------------------
-- 2. Lock the auto-generated REST API out of the app's tables
-- ---------------------------------------------------------------------------
-- Supabase exposes every table in `public` over PostgREST using the anon key.
-- This app never uses that path — it talks to Postgres through Prisma, which
-- connects as `postgres` and bypasses RLS. So enabling RLS with no policies
-- closes the REST hole and changes nothing for the app.
--
-- Without this, anyone holding the anon key (which ships to the browser, by
-- design) could read every candidate name, score, and private coach note.

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- IMPORTANT: this only works because Prisma connects as the `postgres` role,
-- which has BYPASSRLS. If you ever follow Supabase's optional guide to create a
-- dedicated `prisma` database user, that role MUST be created with `bypassrls`
-- or every query in the app will silently return nothing.
--
-- After running this, load /library and confirm the demo case is still listed.
-- If the app has gone blank, RLS is biting the app's own role — undo with:
--
--   do $$ declare t record; begin
--     for t in select tablename from pg_tables where schemaname = 'public' loop
--       execute format('alter table public.%I disable row level security', t.tablename);
--     end loop;
--   end $$;

-- Verify: every row below should show rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
