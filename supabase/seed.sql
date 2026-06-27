-- Phase 1 — Seed data for LOCAL testing only.
-- profiles FK to auth.users, so we insert minimal auth.users rows first, then
-- let nothing else depend on Supabase Auth internals. Passwords are bcrypt of
-- 'password123' for both users. Do NOT run this against production.

-- Two test users -------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'alice@example.com',
    crypt('password123', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alice Tester"}'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'bob@example.com',
    crypt('password123', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Bob Tester"}'
  )
on conflict (id) do nothing;

-- profiles are normally created by the handle_new_user trigger. The trigger
-- fires on the inserts above, but we upsert defensively in case it is disabled.
insert into public.profiles (id, email, full_name)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'Alice Tester'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',   'Bob Tester')
on conflict (id) do nothing;

-- A project owned by Alice ---------------------------------------------------
insert into public.projects (id, title, description, urgency, status, owner_id)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Website Redesign',
    'Revamp the marketing site.',
    'high', 'active',
    '11111111-1111-1111-1111-111111111111'
  )
on conflict (id) do nothing;

-- Tasks under that project ---------------------------------------------------
insert into public.tasks (id, project_id, name, description, urgency, status, created_by)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Design homepage', 'Wireframe + hi-fi mockups.',
    'urgent', 'in_progress',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Set up analytics', 'GA4 + events.',
    'medium', 'todo',
    '11111111-1111-1111-1111-111111111111'
  )
on conflict (id) do nothing;
