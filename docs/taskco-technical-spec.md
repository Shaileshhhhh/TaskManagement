# TaskCo — Technical Spec & Pre/Post-Development Deep Dive

Internal team task-management tool. This document is the development reference: RLS,
security, testing, and documentation. It assumes the locked decisions below.

---

## 0. Locked decisions (recap)

| Area | Decision |
|---|---|
| Product | Internal team tool — **flat**: every authenticated user reads all projects/tasks |
| App | Next.js (App Router) + TypeScript, single repo |
| DB | Supabase Postgres |
| Auth | Supabase Auth — email verification, password reset, bcrypt, built-in |
| Data access | `supabase-js` via `@supabase/ssr`; types via `supabase gen types` |
| Authz | Postgres RLS — team-read / owner-write; personal tables owner-only |
| Reporting | SQL views + RPC, called via `.rpc()` |
| Calendar | `react-big-calendar`, full timeslot; single events (schema recurrence-ready) |
| Notifications | Email + in-app (v1); Resend for email |
| Activity | `activity_log`, populated by DB triggers |
| Two clocks | Attendance = working/extra hours; task timers = effort (multiple concurrent) |
| Roles | Deferred → v2 |
| Conventions | kebab files · camelCase vars · PascalCase types · snake_case DB · `{ data }`/`{ error }` |

**Build order:** migrations + RLS + triggers → auth wiring → projects → tasks
(+checklist/links/assignees/timer) → attendance → calendar → notifications/activity →
dashboard → frontend polish.

---

## 1. RLS Policies

**Rule:** every table has RLS enabled from creation. The `anon`/`authenticated` roles
get *only* what policies allow. The `service_role` key (used in Edge Functions and the
server admin client) **bypasses RLS** — used solely for triggers' side effects and the
notification sender, never exposed to the browser.

### 1.1 Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE | Class |
|---|---|---|---|---|---|
| `profiles` | authenticated | trigger only | own (`id`) | — | identity |
| `projects` | authenticated | own (`owner_id`) | own | own | team-read / owner-write |
| `tasks` | authenticated | own (`created_by`) | creator **or** assignee | creator | team-read |
| `task_assignees` | authenticated | `assigned_by = uid` | — | assigner **or** self | team-read |
| `task_checklist_items` | authenticated | collaborator | collaborator | collaborator | team-read |
| `task_links` | authenticated | collaborator | collaborator | collaborator | team-read |
| `task_time_entries` | authenticated | own (`user_id`) | own | own | team-read / owner-write |
| `attendance_sessions` | own | own | own | own | personal |
| `calendar_events` | own | own | own | own | personal |
| `notifications` | own | trigger / service | own (read flag) | own | personal |
| `activity_log` | authenticated | trigger / service | — | — | team-read |

"collaborator" = task creator or an assignee of that task (helper below).

### 1.2 Helper function

```sql
create or replace function public.is_task_collaborator(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from tasks t
                 where t.id = p_task_id and t.created_by = auth.uid())
      or exists (select 1 from task_assignees a
                 where a.task_id = p_task_id and a.user_id = auth.uid());
$$;
```

### 1.3 Representative policies

**projects** (team-read / owner-write):

```sql
alter table public.projects enable row level security;

create policy projects_select on public.projects
  for select to authenticated using (true);

create policy projects_insert on public.projects
  for insert to authenticated with check (owner_id = auth.uid());

create policy projects_update on public.projects
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy projects_delete on public.projects
  for delete to authenticated using (owner_id = auth.uid());
```

**tasks** (creator or assignee may edit):

```sql
create policy tasks_select on public.tasks
  for select to authenticated using (true);

create policy tasks_insert on public.tasks
  for insert to authenticated with check (created_by = auth.uid());

create policy tasks_update on public.tasks
  for update to authenticated
  using (created_by = auth.uid() or is_task_collaborator(id));

create policy tasks_delete on public.tasks
  for delete to authenticated using (created_by = auth.uid());
```

**attendance_sessions** (personal — owner only, all verbs):

```sql
create policy attendance_all on public.attendance_sessions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

**notifications** (read own, mark-read own, no client insert):

```sql
create policy notif_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notif_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

`calendar_events` mirrors `attendance_sessions`. `task_checklist_items` / `task_links`
gate all mutations on `is_task_collaborator(task_id)`. `activity_log` is select-only for
clients; rows are written by triggers running as definer.

---

## 2. Security Checklist

### 2.1 Before development

**Secrets & env**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, safe (RLS is the guard).
- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` — server-only. **Never** prefixed `NEXT_PUBLIC_`, never imported in client components.
- `.env.local` gitignored; `.env.example` committed with every key documented.

**Service-role boundary**
- `lib/supabase/admin.ts` (service role) importable only from server/edge code. Add an ESLint `no-restricted-imports` rule blocking it from `"use client"` files.

**Input validation**
- Every route handler validates body + params + query with its Zod schema *before* any DB call. Invalid → `400 { error }`. No raw `request.json()` reaching the DB.

**Supabase Auth config**
- Email confirmations ON. Minimum password length set. Leaked-password protection ON.
- Redirect URL allow-list (no open redirects). JWT expiry + refresh configured.
- Keep Supabase's built-in auth rate limits; don't loosen them.

**Database**
- RLS enabled on **every** table at creation (never ship a table without it).
- `gen_random_uuid()` PKs (non-enumerable) on all tables.

### 2.2 After development

**RLS audit (also an integration-test suite)**
- For each table, run as user B against user A's rows: confirm team-read works where intended and writes are blocked everywhere they should be. Explicit IDOR check: user B cannot mutate user A's task / read user A's attendance, calendar, or notifications by guessing IDs.

**Hardening**
- App-level rate limiting on mutation + auth-adjacent routes (Upstash Ratelimit or middleware token bucket).
- Security headers via `next.config.js` / middleware: CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy.
- `npm audit` + Dependabot; `gitleaks` pre-commit secret scan.
- Error tracking (Sentry optional) with PII scrubbing.
- Confirm Supabase automated backups are on for the plan.

---

## 3. Testing & Test Cases

### 3.1 Layers

| Layer | Tool | Location | Scope |
|---|---|---|---|
| Unit | Vitest | `tests/unit` | Pure logic: Zod schemas, IST/date utils, hours math, time aggregation, envelope helpers. No DB. |
| Integration | Vitest + local Supabase | `tests/integration` | Route handlers + RPC against a real test DB, executed as user A vs user B. **This is where RLS is verified.** |
| E2E | Playwright | `tests/e2e` | Full browser flows. |

### 3.2 Representative test cases

**Auth**
- Signup creates `auth.users` row **and** a mirrored `profiles` row (trigger fires).
- Login is rejected for an unverified email.
- Any `/api/*` route returns `401` without a session.

**Projects**
- Create returns `{ data }` with `owner_id = me`.
- List returns the **whole team's** projects — user B sees user A's project (flat model).
- Update / delete by a non-owner is blocked by RLS.
- Delete cascades to that project's tasks.
- Missing `title` → Zod `400 { error }`.

**Tasks**
- Create sets `created_by = me`; filters by `status` + `priority` work.
- An **assignee** can change status; a non-assignee non-creator cannot.
- Delete by a non-creator is blocked.

**Timers (effort clock)**
- Start creates a `task_time_entries` row with `ended_at = null`.
- **Two** timers can run at once (multiple concurrent allowed).
- Stop sets `ended_at`; total = `SUM(ended_at − started_at)` across entries spanning days.

**Attendance (hours clock)**
- A second check-in with no check-out is rejected (one-open-session index).
- Working hours = sum of sessions per IST date; extra = `max(0, total − 8h)`.
- User B cannot read user A's attendance.

**Calendar**
- Create event is owner-only; range query returns only my events; user B can't see them.

**Notifications**
- Assignment trigger creates a notification row for the assignee.
- Mark-read works only on own rows; `email_sent` flips after the sender runs.

**Activity**
- Create / update / status-change fire the trigger and append to `activity_log`.
- `activity_log` is team-readable; clients cannot insert directly.

---

## 4. Documentation Plan

| File | Contents |
|---|---|
| `README.md` | Overview, stack, local setup (clone → env → `supabase start` → migrate → seed → `dev`), scripts |
| `.env.example` | Every env var, with a one-line note on each and which are server-only |
| `docs/architecture.md` | High-level diagram, the two-clock model, RLS posture, request/data flow |
| `docs/data-model.md` | ERD + per-table column reference + enums |
| `docs/api.md` | Endpoint reference: method, path, auth, Zod body, response shape, error codes + RPC reference |
| `docs/rls.md` | Per-table policy reference (the security model) |
| `docs/testing.md` | How to run each layer, what each covers, coverage expectations |
| `docs/conventions.md` | Naming, response envelope, commit message format |

**Inline:** TSDoc on service functions and Zod schemas; SQL migrations are themselves
versioned documentation of the schema's evolution.

---

## 5. Out of scope (v1)

Roles/permissions, manager/team attendance views, file uploads (links only), recurrence
*implementation* (schema-ready only), multi-tenant/orgs, multiple named checklists per
task, multi-assignee UI (schema supports it), mobile/Android, comments/mentions, realtime
(optional). All → v2 or never.
