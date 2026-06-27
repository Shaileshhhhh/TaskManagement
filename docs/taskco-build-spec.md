# TaskCo — Build Specification (Claude Code Brief)

A single source of truth for building **TaskCo**, an internal team task-management
tool. Build strictly to this document. Do not add features listed in §11 (Out of Scope).

---

## 1. Overview & Locked Stack

**Product:** Internal team task manager. **Flat access model** — every authenticated
user can read all projects and tasks. Writes are owner/assignee gated. Personal data
(attendance, calendar, notifications) is private to its owner. Roles are **not** in v1.

| Layer | Decision |
|---|---|
| App | Next.js (App Router) + TypeScript — single repo, frontend + backend together |
| Styling | Tailwind CSS + shadcn/ui. Icons: **Lucide** (no emoji) |
| Database | Supabase Postgres |
| Auth | Supabase Auth — email verification, password reset, bcrypt, built-in |
| Data access | `supabase-js` via `@supabase/ssr` (browser + server clients + middleware) |
| DB types | `supabase gen types typescript` → `types/database.types.ts` |
| Authorization | Postgres RLS — team-read / owner-write; personal tables owner-only |
| Reporting | SQL views (security-invoker) + RPC, called via `.rpc()` |
| Calendar | `react-big-calendar` + drag/drop addon — full timeslot scheduling |
| Notifications | In-app + email (v1). Email via **Resend** (Supabase Edge Function) |
| Activity | `activity_log` table, written by DB triggers |
| Validation | Zod on every route handler (body + params + query) |
| Testing | Vitest (unit + integration) + Playwright (e2e) |
| Timezone | Store UTC; display + attendance math in IST |

**Two independent clocks — never conflate:**
- **Attendance** (`attendance_sessions`, check-in/out) → the *only* source of working &
  extra hours. One open session per user.
- **Task timers** (`task_time_entries`, start/stop) → effort per task. **Multiple may
  run at once.** Never sum these for "hours worked" (overlap double-counts).

---

## 2. Conventions

- **Files & folders:** kebab-case (`project-card.tsx`, `time-format.ts`). Next route files: `route.ts`.
- **Variables / functions:** camelCase. **Types / interfaces / components:** PascalCase.
- **Constants:** SCREAMING_SNAKE_CASE (e.g. `STANDARD_DAILY_HOURS = 8`).
- **DB tables / columns:** snake_case. **Zod schemas:** camelCase + `Schema` suffix.
- **API response envelope — always:** success `{ data: ... }`, failure `{ error: { message, code? } }`.
  HTTP status set appropriately (400 validation, 401 unauthenticated, 403 forbidden, 404, 500).
- **IDs:** `uuid` via `gen_random_uuid()` (non-enumerable).

---

## 3. Database Schema (Postgres / Supabase migrations)

Run as ordered migrations under `supabase/migrations/`. Auth credentials live in
Supabase-managed `auth.users`; we mirror public fields into `profiles`.

### 3.1 Enums

```sql
create type urgency_level     as enum ('low','medium','high','urgent');
create type project_status    as enum ('active','on_hold','completed','archived');
create type task_status       as enum ('todo','in_progress','done');
create type notification_type as enum ('task_assigned','task_due_soon','task_status_changed','project_due_soon','mention');
```

### 3.2 Tables

```sql
-- profiles (1:1 with auth.users) -------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

-- projects ------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  start_date  date,
  end_date    date,
  deadline    timestamptz,
  urgency     urgency_level  not null default 'medium',
  status      project_status not null default 'active',
  color       text,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index idx_projects_owner on public.projects(owner_id);

-- tasks ---------------------------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  description text,
  start_date  timestamptz,   -- PLANNED start (form field), not the timer
  end_date    timestamptz,   -- PLANNED end
  deadline    timestamptz,
  urgency     urgency_level not null default 'medium',
  status      task_status   not null default 'todo',
  color       text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);
create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_creator on public.tasks(created_by);
create index idx_tasks_status  on public.tasks(status);

-- task_assignees (multi-assignee; UI defaults to single in v1) --------------
create table public.task_assignees (
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index idx_assignees_user on public.task_assignees(user_id);

-- task_checklist_items ------------------------------------------------------
create table public.task_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  content    text not null,
  is_done    boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_checklist_task on public.task_checklist_items(task_id);

-- task_links (doc URLs only — no uploads) -----------------------------------
create table public.task_links (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  label      text,
  url        text not null,
  created_at timestamptz not null default now()
);
create index idx_links_task on public.task_links(task_id);

-- task_time_entries (effort clock; overlapping allowed) ---------------------
create table public.task_time_entries (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at   timestamptz,            -- null = running
  note       text,
  created_at timestamptz not null default now()
);
create index idx_time_task on public.task_time_entries(task_id);
create index idx_time_user on public.task_time_entries(user_id);

-- attendance_sessions (hours clock; one open per user) ----------------------
create table public.attendance_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  check_in_at  timestamptz not null,
  check_out_at timestamptz,          -- null = currently checked in
  ist_date     date not null,        -- IST calendar day, for grouping
  created_at   timestamptz not null default now()
);
create index idx_attend_user_date on public.attendance_sessions(user_id, ist_date);
create unique index one_open_session_per_user
  on public.attendance_sessions(user_id) where check_out_at is null;

-- calendar_events (full timeslot; recurrence-ready, single-event v1) --------
create table public.calendar_events (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  title                text not null,
  description          text,
  start_at             timestamptz not null,
  end_at               timestamptz not null,
  all_day              boolean not null default false,
  color                text,
  location             text,
  task_id              uuid references public.tasks(id) on delete set null,
  rrule                text,         -- recurrence-ready, unused v1
  recurrence_parent_id uuid references public.calendar_events(id) on delete cascade,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);
create index idx_events_user_start on public.calendar_events(user_id, start_at);

-- notifications (in-app + email) --------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,  -- recipient
  type        notification_type not null,
  title       text not null,
  body        text,
  entity_type text,                  -- 'task' | 'project' | 'event'
  entity_id   uuid,
  is_read     boolean not null default false,
  email_sent  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_notif_user_read on public.notifications(user_id, is_read);
create index idx_notif_email_pending on public.notifications(email_sent) where email_sent = false;

-- activity_log (audit feed; trigger-written) --------------------------------
create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references public.profiles(id),
  action      text not null,         -- created|updated|status_changed|assigned|checked_in|timer_started|...
  entity_type text not null,         -- project|task|event|attendance|time_entry
  entity_id   uuid not null,
  project_id  uuid references public.projects(id) on delete cascade,
  metadata    jsonb,                 -- before/after diff
  created_at  timestamptz not null default now()
);
create index idx_activity_project on public.activity_log(project_id, created_at desc);
create index idx_activity_time on public.activity_log(created_at desc);
```

### 3.3 Functions & triggers

```sql
-- mirror new auth users into profiles
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at maintenance (attach to profiles, projects, tasks, calendar_events)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_events_updated before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- collaborator check used by checklist/link RLS
create or replace function public.is_task_collaborator(p_task_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from tasks t where t.id = p_task_id and t.created_by = auth.uid())
      or exists (select 1 from task_assignees a where a.task_id = p_task_id and a.user_id = auth.uid());
$$;

-- notify assignee on assignment (example trigger; replicate the pattern for
-- due-soon, status-changed via app/cron logic)
create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from tasks where id = new.task_id;
  insert into notifications (user_id, type, title, body, entity_type, entity_id)
  values (new.user_id, 'task_assigned', 'New task assigned', v_name, 'task', new.task_id);
  return new;
end; $$;
create trigger trg_notify_task_assigned
after insert on public.task_assignees
for each row execute function public.notify_task_assigned();

-- activity logging: implement a generic trigger fn that inserts into
-- activity_log on insert/update of projects & tasks (uses TG_OP + auth.uid()
-- as actor_id, diff into metadata). Attach to projects, tasks, task_assignees.
```

### 3.4 Reporting views & RPC

> Views MUST be `security_invoker = on` so personal-table RLS (attendance) is respected.

```sql
create view public.v_task_total_time with (security_invoker = on) as
select task_id,
       coalesce(sum(extract(epoch from (coalesce(ended_at, now()) - started_at)))::bigint,0) as total_seconds
from public.task_time_entries
group by task_id;

create view public.v_daily_attendance with (security_invoker = on) as
select user_id, ist_date,
       coalesce(sum(extract(epoch from (coalesce(check_out_at, now()) - check_in_at)))::bigint,0) as worked_seconds,
       greatest(0, coalesce(sum(extract(epoch from (coalesce(check_out_at, now()) - check_in_at)))::bigint,0) - 8*3600) as extra_seconds
from public.attendance_sessions
group by user_id, ist_date;

-- dashboard counts (flat/team-wide via RLS; adjust to "my assigned" if desired)
create or replace function public.get_my_dashboard()
returns json language sql stable security invoker as $$
  select json_build_object(
    'total_tasks',   (select count(*) from tasks),
    'urgent_tasks',  (select count(*) from tasks where urgency in ('high','urgent') and status <> 'done'),
    'pending_tasks', (select count(*) from tasks where status <> 'done'),
    'project_count', (select count(*) from projects where status = 'active')
  );
$$;
```

---

## 4. RLS Policies

Enable RLS on **every** table. `service_role` (Edge Functions / admin client) bypasses
RLS and is the only writer for `activity_log`/`notifications` side-effects.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | authenticated | trigger only | own (`id`) | — |
| `projects` | authenticated | own (`owner_id`) | own | own |
| `tasks` | authenticated | own (`created_by`) | creator or assignee | creator |
| `task_assignees` | authenticated | `assigned_by = uid` | — | assigner or self |
| `task_checklist_items` | authenticated | collaborator | collaborator | collaborator |
| `task_links` | authenticated | collaborator | collaborator | collaborator |
| `task_time_entries` | authenticated | own | own | own |
| `attendance_sessions` | own | own | own | own |
| `calendar_events` | own | own | own | own |
| `notifications` | own | trigger/service | own (read flag) | own |
| `activity_log` | authenticated | trigger/service | — | — |

```sql
-- enable RLS on all
alter table public.profiles             enable row level security;
alter table public.projects             enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_assignees       enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_links           enable row level security;
alter table public.task_time_entries    enable row level security;
alter table public.attendance_sessions  enable row level security;
alter table public.calendar_events      enable row level security;
alter table public.notifications        enable row level security;
alter table public.activity_log         enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- projects
create policy projects_select on public.projects for select to authenticated using (true);
create policy projects_insert on public.projects for insert to authenticated with check (owner_id = auth.uid());
create policy projects_update on public.projects for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_delete on public.projects for delete to authenticated using (owner_id = auth.uid());

-- tasks
create policy tasks_select on public.tasks for select to authenticated using (true);
create policy tasks_insert on public.tasks for insert to authenticated with check (created_by = auth.uid());
create policy tasks_update on public.tasks for update to authenticated using (created_by = auth.uid() or is_task_collaborator(id));
create policy tasks_delete on public.tasks for delete to authenticated using (created_by = auth.uid());

-- task_assignees
create policy ta_select on public.task_assignees for select to authenticated using (true);
create policy ta_insert on public.task_assignees for insert to authenticated with check (assigned_by = auth.uid());
create policy ta_delete on public.task_assignees for delete to authenticated using (assigned_by = auth.uid() or user_id = auth.uid());

-- task_checklist_items
create policy tci_select on public.task_checklist_items for select to authenticated using (true);
create policy tci_insert on public.task_checklist_items for insert to authenticated with check (is_task_collaborator(task_id));
create policy tci_update on public.task_checklist_items for update to authenticated using (is_task_collaborator(task_id)) with check (is_task_collaborator(task_id));
create policy tci_delete on public.task_checklist_items for delete to authenticated using (is_task_collaborator(task_id));

-- task_links (same pattern)
create policy tl_select on public.task_links for select to authenticated using (true);
create policy tl_insert on public.task_links for insert to authenticated with check (is_task_collaborator(task_id));
create policy tl_update on public.task_links for update to authenticated using (is_task_collaborator(task_id)) with check (is_task_collaborator(task_id));
create policy tl_delete on public.task_links for delete to authenticated using (is_task_collaborator(task_id));

-- task_time_entries
create policy tte_select on public.task_time_entries for select to authenticated using (true);
create policy tte_insert on public.task_time_entries for insert to authenticated with check (user_id = auth.uid());
create policy tte_update on public.task_time_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tte_delete on public.task_time_entries for delete to authenticated using (user_id = auth.uid());

-- attendance_sessions (personal)
create policy attend_all on public.attendance_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- calendar_events (personal)
create policy events_all on public.calendar_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notifications (personal; no client insert)
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- activity_log (team-read; trigger/service writes only)
create policy activity_select on public.activity_log for select to authenticated using (true);
```

---

## 5. Folder Structure

```
taskco/
├─ app/
│  ├─ (auth)/
│  │  ├─ login/page.tsx
│  │  ├─ register/page.tsx
│  │  ├─ forgot-password/page.tsx
│  │  ├─ reset-password/page.tsx
│  │  └─ verify-email/page.tsx
│  ├─ (app)/
│  │  ├─ layout.tsx                # sidebar + topbar + session guard
│  │  ├─ dashboard/page.tsx
│  │  ├─ projects/
│  │  │  ├─ page.tsx
│  │  │  └─ [id]/page.tsx
│  │  ├─ tasks/[id]/page.tsx
│  │  ├─ calendar/page.tsx
│  │  ├─ attendance/page.tsx
│  │  ├─ notifications/page.tsx
│  │  ├─ activity/page.tsx
│  │  └─ settings/page.tsx
│  ├─ api/
│  │  ├─ projects/
│  │  │  ├─ route.ts               # GET list · POST create
│  │  │  └─ [id]/
│  │  │     ├─ route.ts            # GET one(+task count) · PATCH · DELETE
│  │  │     └─ tasks/route.ts      # GET (filters) · POST
│  │  ├─ tasks/[id]/
│  │  │  ├─ route.ts               # GET · PATCH · DELETE
│  │  │  ├─ checklist/route.ts
│  │  │  ├─ links/route.ts
│  │  │  ├─ assignees/route.ts
│  │  │  └─ timer/
│  │  │     ├─ start/route.ts
│  │  │     └─ stop/route.ts
│  │  ├─ checklist-items/[id]/route.ts
│  │  ├─ time-entries/route.ts
│  │  ├─ attendance/
│  │  │  ├─ check-in/route.ts
│  │  │  ├─ check-out/route.ts
│  │  │  └─ route.ts               # GET sessions / timesheet
│  │  ├─ calendar/events/
│  │  │  ├─ route.ts               # GET range · POST
│  │  │  └─ [id]/route.ts          # PATCH · DELETE
│  │  ├─ notifications/
│  │  │  ├─ route.ts               # GET
│  │  │  ├─ [id]/read/route.ts
│  │  │  └─ read-all/route.ts
│  │  ├─ activity/route.ts
│  │  └─ dashboard/route.ts        # calls get_my_dashboard RPC
│  ├─ auth/
│  │  ├─ callback/route.ts         # Supabase session exchange / email confirm
│  │  └─ confirm/route.ts
│  ├─ layout.tsx
│  ├─ globals.css
│  └─ not-found.tsx                # 404 page
├─ components/
│  ├─ ui/                          # shadcn primitives
│  ├─ layout/                      # sidebar, topbar, nav
│  ├─ projects/                    # project-card, project-form, project-dialog
│  ├─ tasks/                       # task-card, checklist, timer-button, link-list,
│  │                               #   assignee-picker, status-toggle
│  ├─ calendar/                    # calendar-view, event-dialog
│  ├─ dashboard/                   # stat-cards, urgent-list, pending-list
│  ├─ attendance/                  # check-in-button, timesheet-table
│  ├─ notifications/               # notification-bell, notification-list
│  └─ providers/                   # query-provider, supabase-provider, toaster
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts                 # browser client
│  │  ├─ server.ts                 # server client (cookies, RLS-scoped)
│  │  ├─ middleware.ts             # session refresh helper (@supabase/ssr)
│  │  └─ admin.ts                  # service-role client — SERVER/EDGE ONLY
│  ├─ validations/                 # Zod schemas per entity
│  ├─ api/
│  │  ├─ response.ts               # { data } / { error } envelope helpers
│  │  ├─ handler.ts                # withAuth() wrapper + central error catch
│  │  └─ errors.ts
│  ├─ queries/                     # server-side data fns per entity
│  ├─ hooks/                       # useProjects, useTimer, useNotifications…
│  ├─ utils/                       # dates-ist.ts, time-format.ts, cn.ts
│  └─ constants.ts                 # STANDARD_DAILY_HOURS = 8, etc.
├─ types/
│  ├─ database.types.ts            # supabase gen types output
│  └─ index.ts
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                  # tables, enums, RLS, triggers, views, RPC
│  ├─ functions/
│  │  ├─ send-notifications/       # cron → Resend
│  │  └─ deadline-reminders/
│  └─ seed.sql
├─ tests/
│  ├─ unit/                        # Vitest: validations, utils, hours math
│  ├─ integration/                 # route handlers + RLS (test DB, user A vs B)
│  └─ e2e/                         # Playwright: auth, CRUD, timer, calendar
├─ middleware.ts                   # refresh session + protect (app) routes
├─ .env.example
├─ package.json
└─ next.config.js / tsconfig / eslint / tailwind / postcss configs
```

**Every API handler** runs through `lib/api/handler.ts` (`withAuth` → validate with the
matching Zod schema → return `{ data }` or `{ error }`). Ownership/scoping is enforced by
RLS at the DB, so handlers stay thin.

---

## 6. API Surface

| Method | Endpoint | Purpose |
|---|---|---|
| — | (Supabase Auth) | signup / login / verify / reset handled by `supabase.auth.*` |
| GET | `/api/dashboard` | dashboard counts (via `get_my_dashboard`) |
| GET | `/api/projects` | list all team projects |
| POST | `/api/projects` | create project (owner = me) |
| GET | `/api/projects/:id` | one project + task count |
| PATCH | `/api/projects/:id` | update (owner only) |
| DELETE | `/api/projects/:id` | delete (owner only; cascades to tasks) |
| GET | `/api/projects/:id/tasks` | list tasks (filter: status, priority) |
| POST | `/api/projects/:id/tasks` | create task |
| GET | `/api/tasks/:id` | one task (checklist, links, assignees) |
| PATCH | `/api/tasks/:id` | update (creator/assignee) |
| DELETE | `/api/tasks/:id` | delete (creator) |
| POST/DELETE | `/api/tasks/:id/checklist` | add / manage checklist items |
| POST/DELETE | `/api/tasks/:id/links` | add / remove doc links |
| POST/DELETE | `/api/tasks/:id/assignees` | assign / unassign |
| POST | `/api/tasks/:id/timer/start` | start a time entry |
| POST | `/api/tasks/:id/timer/stop` | stop running entry |
| GET | `/api/time-entries` | list entries (filter by task/user) |
| POST | `/api/attendance/check-in` | open attendance session |
| POST | `/api/attendance/check-out` | close attendance session |
| GET | `/api/attendance` | sessions / timesheet (own) |
| GET/POST | `/api/calendar/events` | list (range) / create |
| PATCH/DELETE | `/api/calendar/events/:id` | update / delete |
| GET | `/api/notifications` | list own |
| POST | `/api/notifications/:id/read` | mark read |
| POST | `/api/notifications/read-all` | mark all read |
| GET | `/api/activity` | activity feed |

---

## 7. Build Order (execute sequentially)

**Phase 0 — Bootstrap.** Next.js + TS + Tailwind + shadcn/ui. `supabase init`. Install
`@supabase/ssr @supabase/supabase-js react-big-calendar zod`. Scaffold folder tree.
Add `.env.local` (+ `.env.example`). ESLint `no-restricted-imports` blocking
`lib/supabase/admin` from `"use client"` files.

**Phase 1 — Database.** Migrations: enums → tables → indexes → functions/triggers → RLS
→ views → RPC. Add `seed.sql`. Run `supabase gen types` → `types/database.types.ts`.

**Phase 2 — Supabase clients + API scaffolding.** `client.ts`, `server.ts`,
`middleware.ts`, `admin.ts`. Root `middleware.ts` refreshes session + guards `(app)`.
`lib/api/response.ts`, `handler.ts` (`withAuth`), `errors.ts`. Base Zod schemas.

**Phase 3 — Auth.** Register / login / forgot / reset / verify pages + `auth/callback`.
Configure Supabase: email confirmations ON, password rules, redirect allow-list,
leaked-password protection. Auth-guarded `(app)/layout.tsx`.

**Phase 4 — Projects.** API routes + Zod + `queries/projects` + UI (list, detail,
create/edit dialog, delete with confirm).

**Phase 5 — Tasks.** Task routes (+ status/priority filters), checklist, links,
assignees, timer start/stop. UI: task-card, task detail, checklist, link-list,
assignee-picker, status-toggle, timer-button (supports multiple concurrent timers).

**Phase 6 — Attendance.** check-in / check-out routes (enforce one-open-session).
Timesheet UI; hours from `v_daily_attendance` (IST).

**Phase 7 — Calendar.** Events CRUD routes. `react-big-calendar` month/week/day with
timeslot create + drag/resize; event dialog; optional task link.

**Phase 8 — Notifications + Activity.** Notification center + bell; activity feed.
`send-notifications` Edge Function (cron → Resend, flips `email_sent`);
`deadline-reminders` cron scanning `deadline`.

**Phase 9 — Dashboard.** Wire `get_my_dashboard`; stat cards, urgent list, pending list,
project list.

**Phase 10 — Cross-cutting.** `not-found.tsx` (404). Security headers + rate limiting.
Tests (unit/integration/e2e). Docs (§10).

---

## 8. Security Checklist

**Before dev:** service-role key server-only (never `NEXT_PUBLIC_`); Zod-validate every
request before any DB call; RLS enabled on every table at creation; Supabase auth
hardening (confirmations, password rules, redirect allow-list); `uuid` PKs.

**After dev:** RLS/IDOR audit (run as user B against user A's rows — confirm team-read
works and personal tables + cross-user writes are blocked); app-level rate limiting on
mutations (Upstash or middleware); security headers (CSP, HSTS, `X-Frame-Options: DENY`,
`nosniff`, Referrer-Policy); `npm audit` + Dependabot; `gitleaks` pre-commit; backups on.

---

## 9. Testing

| Layer | Tool | Location | Scope |
|---|---|---|---|
| Unit | Vitest | `tests/unit` | Zod schemas, IST/date utils, hours math, aggregation, envelope |
| Integration | Vitest + local Supabase | `tests/integration` | Route handlers + RPC as user A vs B; **RLS verification** |
| E2E | Playwright | `tests/e2e` | signup→verify→login, project/task CRUD, timers, attendance, calendar, notifications |

**Must-cover cases:** unverified-email login rejected; flat read (user B sees user A's
project); non-owner update blocked; delete cascades; two concurrent timers allowed;
one-open-attendance enforced; working-hours ≠ summed task timers; attendance/calendar/
notifications not visible cross-user (IDOR).

---

## 10. Documentation Deliverables

`README.md` (setup), `.env.example` (all vars, server-only flagged), `docs/architecture.md`,
`docs/data-model.md` (ERD + table reference), `docs/api.md` (+ RPC), `docs/rls.md`,
`docs/testing.md`, `docs/conventions.md`. TSDoc on services & Zod schemas; migrations are
versioned schema documentation.

---

## 11. Out of Scope (v1) — do NOT build

Roles/permissions; manager/team attendance views; file uploads (links only); recurrence
*implementation* (schema is recurrence-ready but only single events ship); multi-tenant /
orgs; multiple named checklists per task; multi-assignee *UI* (schema supports it, UI is
single-assignee); mobile/Android; comments/mentions; realtime (optional, not required).
