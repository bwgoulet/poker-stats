-- Local runner only. Supabase already supplies these roles, tables and helpers.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}', email_confirmed_at timestamptz);
create table auth.identities(provider_id text, user_id uuid references auth.users(id) on delete cascade, provider text, identity_data jsonb);
-- Exists before migrations so the profile backfill is exercised too.
insert into auth.users values ('90000000-0000-4000-8000-000000000001', 'legacy@example.test', '{"full_name":"Legacy Player","role":"admin"}', now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
