# TaskCo — Claude Code Prompt Playbook

Step-by-step prompts for building TaskCo with Claude Code, following the build order in
`taskco-build-spec.md` §7 (Phases 0–10). Each phase is one prompt you paste into Claude
Code, work to completion, verify, commit, then move to the next.

---

## Before you start

1. **Put both specs in the repo** so every prompt can reference them by path. Create the
   project folder, then drop in:
   - `docs/taskco-build-spec.md` (the build brief — schema, RLS, folder tree, build order)
   - `docs/taskco-technical-spec.md` (RLS deep-dive, security checklist, test cases, docs plan)
2. **Work one phase per prompt.** Don't paste the whole playbook at once. Let Claude Code
   finish a phase, verify the checkpoint, `git commit`, then start the next prompt.
3. **Read Claude's assumptions before accepting.** When it states JWT/expiry/shape/error
   assumptions, read them — that's where silent drift happens.
4. **Iterate, don't restart.** If output is ~80% right, correct the specific thing ("the
   timer route should allow concurrent entries") rather than regenerating the whole file.
5. **Debug with structure.** When something breaks, give Claude: the exact error, the
   specific block (not the whole file), what you already verified, and one specific question.
6. **Guard the out-of-scope list (§11).** If Claude starts building roles, file uploads,
   recurrence, multi-assignee UI, comments, or realtime — stop it.

A note on Supabase: a few steps need things only you can do in the Supabase dashboard or
CLI (creating the project, toggling email confirmation, setting secrets). Those are called
out as **[You do this]** inside the relevant prompt.

---

## Phase 0 — Bootstrap

```
Read docs/taskco-build-spec.md (§1 stack, §2 conventions, §5 folder structure) and
docs/taskco-technical-spec.md (§2.1 security-before-dev).

Scaffold the TaskCo project — bootstrap only, no features yet:

- Next.js (App Router) + TypeScript, single repo.
- Tailwind CSS + shadcn/ui initialised. Lucide for icons. No emoji anywhere.
- Run `supabase init` so supabase/ exists with config.toml.
- Install: @supabase/ssr, @supabase/supabase-js, react-big-calendar, zod.
- Create the full empty folder tree exactly as in build-spec §5 (app/(auth),
  app/(app), app/api, components/, lib/supabase, lib/validations, lib/api, lib/queries,
  lib/hooks, lib/utils, types/, supabase/migrations, supabase/functions, tests/unit,
  tests/integration, tests/e2e). Use placeholder files only where a folder would
  otherwise be empty.
- Create .env.example with every variable from the spec, each annotated, and clearly mark
  which are SERVER-ONLY (never NEXT_PUBLIC_): SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
  Create .env.local with the same keys (values blank for me to fill).
- Add an ESLint no-restricted-imports rule that blocks importing lib/supabase/admin from
  any "use client" file.
- tsconfig in strict mode. Add a .gitignore (node_modules, .env*, .next).

Do NOT build any pages, API routes, auth, or database logic yet. State your assumptions
about versions and config before writing files.
```

**[You do this]** Create the Supabase project (dashboard or `supabase start` for local),
then paste the URL + anon key + service-role key into `.env.local`.

**Checkpoint:** `npm run dev` serves a blank Next.js app; folder tree matches §5; the
admin-import ESLint rule fires if you try to import it in a client file. Commit.
  
---

## Phase 1 — Database

```
Read docs/taskco-build-spec.md §3 (enums, tables, functions/triggers, views, RPC) and §4
(RLS), plus docs/taskco-technical-spec.md §1 (RLS detail).

Author ordered SQL migrations under supabase/migrations/, one concern per file, applied in
this order:
1. enums (urgency_level, project_status, task_status, notification_type)
2. tables + indexes exactly as in §3.2 (profiles, projects, tasks, task_assignees,
   task_checklist_items, task_links, task_time_entries, attendance_sessions,
   calendar_events, notifications, activity_log). Keep every constraint, default, FK,
   on-delete rule, and the one_open_session_per_user partial unique index.
3. functions + triggers from §3.3: handle_new_user (mirrors auth.users -> profiles),
   set_updated_at (on projects/tasks/calendar_events), is_task_collaborator,
   notify_task_assigned, and a generic activity-log trigger fn attached to projects,
   tasks, task_assignees (uses TG_OP + auth.uid(), diff into metadata jsonb).
4. RLS: enable on EVERY table, then the policies in §4 verbatim — flat team-read on
   projects/tasks/etc., owner-only on attendance/calendar/notifications, trigger/service
   writes only on activity_log and notifications.
5. views from §3.4 with security_invoker = on (v_task_total_time, v_daily_attendance) and
   the get_my_dashboard RPC.
6. seed.sql with a couple of profiles/projects/tasks for local testing.

Then run `supabase gen types typescript` and write the result to types/database.types.ts.

Every table must have RLS enabled in the same migration that creates it — never leave a
table un-protected. Do not invent columns beyond the spec.
```

**Checkpoint:** migrations apply cleanly against your Supabase DB; `types/database.types.ts`
reflects all tables; a manual insert into `auth.users` produces a `profiles` row via the
trigger. Commit.

---

## Phase 2 — Supabase clients + API scaffolding

```
Read docs/taskco-build-spec.md §2 (envelope, conventions) and §5 (lib/ layout), and
docs/taskco-technical-spec.md §1 (service-role boundary).

Build the data-access and API plumbing — no feature routes yet:

- lib/supabase/client.ts: browser client (@supabase/ssr).
- lib/supabase/server.ts: server client, cookie-based, RLS-scoped to the signed-in user.
- lib/supabase/middleware.ts: session-refresh helper.
- lib/supabase/admin.ts: service-role client, SERVER/EDGE ONLY (the ESLint rule from
  Phase 0 must already block client imports of it).
- Root middleware.ts: refresh the session on every request and guard the (app) route group
  (redirect unauthenticated users to /login).
- lib/api/response.ts: helpers returning { data } on success and
  { error: { message, code? } } on failure, with correct HTTP status (400/401/403/404/500).
- lib/api/errors.ts: typed error classes mapping to those statuses.
- lib/api/handler.ts: a withAuth() wrapper that resolves the user, runs the route, validates
  the body/params/query against a provided Zod schema BEFORE any DB call, and routes thrown
  errors through the central catch into the { error } envelope.
- lib/validations/: a base/shared Zod setup other entities will extend.

Handlers should stay thin — ownership/scoping is enforced by RLS at the DB, not re-checked
in app code. Show me how withAuth is meant to be used in one example route comment, but do
not implement real routes yet.
```

**Checkpoint:** a throwaway test route wrapped in `withAuth` returns `401` with no session
and the `{ data }` shape with one. Commit.

---

## Phase 3 — Auth

```
Read docs/taskco-build-spec.md §7 Phase 3 and §5 app/(auth), and
docs/taskco-technical-spec.md §2.1 (Supabase Auth config).

Build authentication using Supabase Auth (built-in — do NOT hand-roll bcrypt/JWT):

- Pages under app/(auth): login, register, forgot-password, reset-password, verify-email.
  Forms styled with shadcn/ui, validated with Zod, errors surfaced via the { error } shape.
- app/auth/callback/route.ts and app/auth/confirm/route.ts for the Supabase session
  exchange / email confirmation.
- app/(app)/layout.tsx: auth-guarded shell (sidebar + topbar), redirects to /login when
  there's no session.
- Register collects full_name so the handle_new_user trigger populates profiles.

State the redirect URLs you expect me to allow-list. Do not build any project/task features.
```

**[You do this]** In Supabase Auth settings: turn **email confirmations ON**, set a minimum
password length, enable **leaked-password protection**, set the **redirect URL allow-list**
(no open redirects), and configure JWT expiry/refresh.

**Checkpoint:** you can register → receive a verification email → confirm → log in; an
unverified account is rejected at login; logging in creates/loads your `profiles` row. Commit.

---

## Phase 4 — Projects

```
Read docs/taskco-build-spec.md §6 (project endpoints) and §5, plus the projects rows in
§4 RLS. Use the existing lib/api/handler.ts withAuth wrapper and envelope helpers as the
pattern — match them exactly.

Build the projects vertical slice:

API (app/api/projects):
- GET /api/projects — list ALL team projects (flat model; RLS returns the team's rows, this
  is intentional, not a bug).
- POST /api/projects — create with owner_id = the authenticated user (RLS enforces this).
- GET /api/projects/:id — one project plus its task count.
- PATCH /api/projects/:id — owner-only update (RLS blocks non-owners).
- DELETE /api/projects/:id — owner-only; cascades to tasks.
Each handler: withAuth, Zod-validate (projectSchema in lib/validations), thin body, RLS
does the authorization. Errors use { error: { message, code? } } with correct status.

Queries: lib/queries/projects.ts for the server-side data functions.

UI (app/(app)/projects + components/projects): project list page, project detail page,
a create/edit dialog (project-form, project-dialog), and delete with a confirm step.
Use Lucide icons. No emoji.

Do not add pagination, sorting, or any field not in the schema.
```

**Checkpoint:** create/list/view/edit/delete projects through the UI; a second user can
*see* your project (flat read) but cannot edit or delete it; deleting a project removes its
tasks. Commit.

---

## Phase 5 — Tasks (build in passes, verify between each)

This is the largest phase. Do it as four prompts, verifying after each.

**5a — Core task CRUD**
```
Read build-spec §6 (task endpoints), §3.2 tasks, and §4 tasks RLS. Match the project routes
you just built as the pattern.

Build app/api/projects/:id/tasks (GET with status + priority/urgency filters, POST create
with created_by = me) and app/api/tasks/:id (GET one with checklist/links/assignees, PATCH
by creator-or-assignee, DELETE by creator). Zod schemas in lib/validations. UI: task-card,
task detail page, status-toggle. RLS does authorization; keep handlers thin.

Remember: tasks.start_date/end_date are PLANNED dates (form fields), NOT the timer.
```

**5b — Checklist + links**
```
Read §3.2 (task_checklist_items, task_links) and their §4 RLS (gated on
is_task_collaborator). Build app/api/tasks/:id/checklist and .../links (+ the
checklist-items/:id route for toggling is_done / reordering by position). UI: checklist
and link-list components on the task detail page. Links are URLs only — no file uploads.
```

**5c — Assignees**
```
Read §3.2 task_assignees and §4 ta_* policies. Build app/api/tasks/:id/assignees
(POST assign with assigned_by = me, DELETE unassign by assigner-or-self). The assignment
INSERT must fire the notify_task_assigned trigger. UI: assignee-picker, but SINGLE-assignee
in v1 — the schema supports multiple, the UI does not. Do not build multi-assignee UI.
```

**5d — Task timers (effort clock)**
```
Read build-spec §1 (two-clock rule) and §3.2 task_time_entries, §3.4 v_task_total_time.
Build app/api/tasks/:id/timer/start (creates an entry with ended_at = null) and
.../timer/stop (sets ended_at), plus GET /api/time-entries (filter by task/user). UI: a
timer-button.

CRITICAL: multiple timers may run concurrently — do NOT enforce one-open-entry, and do NOT
add logic that stops other running timers on start. Total task time comes from
v_task_total_time. Never sum task timers to compute "hours worked" — that's attendance's job.
```

**Checkpoint:** create tasks, filter by status/urgency, edit as assignee, add checklist
items/links, assign a user (which generates a notification row), and run **two timers at
once**. Commit after each pass.

---

## Phase 6 — Attendance (hours clock)

```
Read build-spec §1 (attendance = the only source of hours), §3.2 attendance_sessions
(one-open-session index), §3.4 v_daily_attendance, §4 attendance policy. Read
taskco-technical-spec.md §3.2 attendance test cases.

Build app/api/attendance/check-in (open a session), check-out (close the current one), and
GET /api/attendance (own sessions / timesheet). Enforce one open session per user — a second
check-in with no check-out must be rejected (the partial unique index backs this; surface a
clean 400). Hours come from v_daily_attendance; extra = max(0, worked - 8h). All attendance
math displays in IST though timestamps are stored UTC — put IST helpers in lib/utils/dates-ist.ts.

UI: check-in-button and timesheet-table under components/attendance. Attendance is personal —
a user can only ever see their own.
```

**Checkpoint:** check in, attempt a second check-in (rejected), check out; the timesheet
shows worked + extra hours grouped by IST date; another user cannot read your attendance.
Commit.

---

## Phase 7 — Calendar

```
Read build-spec §1 (calendar single-event v1), §3.2 calendar_events, §4 events policy.

Build app/api/calendar/events (GET by range, POST create) and .../events/:id (PATCH, DELETE).
Events are personal (owner-only). UI: react-big-calendar with month/week/day views, timeslot
create, drag/resize (drag-and-drop addon), and an event-dialog. An event may optionally link
to a task (task_id).

The schema has rrule/recurrence_parent_id but recurrence is OUT OF SCOPE — single events only.
Do not implement recurrence logic.
```

**Checkpoint:** create/drag/resize/delete events on the calendar; a range query returns only
your events; another user can't see them. Commit.

---

## Phase 8 — Notifications + Activity

```
Read build-spec §3.2 (notifications, activity_log), §3.3 (notify trigger, activity trigger),
§4 (notif + activity policies), §7 Phase 8, and the notification cases in
taskco-technical-spec.md §3.2.

Build:
- GET /api/notifications (own), POST /api/notifications/:id/read, POST .../read-all. UI:
  notification-bell + notification-list. Clients can mark-read but never INSERT notifications.
- GET /api/activity feed. activity_log is team-readable, written only by triggers — clients
  cannot insert.
- Supabase Edge Function send-notifications: cron-driven, sends pending emails via Resend,
  flips email_sent to true. Service-role only.
- Supabase Edge Function deadline-reminders: cron scanning deadline columns, inserting
  due-soon notifications.

State which cron schedules and which env vars (RESEND_API_KEY) you expect.
```

**[You do this]** Set `RESEND_API_KEY` as an Edge Function secret and schedule the two cron
functions in Supabase.

**Checkpoint:** assigning a task creates an in-app notification; mark-read works only on your
rows; after the sender runs, `email_sent` flips; the activity feed shows create/update/
status-change entries. Commit.

---

## Phase 9 — Dashboard

```
Read build-spec §3.4 get_my_dashboard and §7 Phase 9. Build GET /api/dashboard calling the
get_my_dashboard RPC via .rpc(), and app/(app)/dashboard/page.tsx with stat-cards
(total/urgent/pending tasks, active project count), an urgent-list, a pending-list, and a
project list. Reuse existing query/hook patterns. No new schema.
```

**Checkpoint:** dashboard renders live counts from the RPC and updates as you add/complete
tasks. Commit.

---

## Phase 10 — Cross-cutting (404, hardening, tests, docs)

```
Read build-spec §7 Phase 10, §8 (security), §9 (testing), §10 (docs), and
taskco-technical-spec.md §2.2 (hardening), §3 (test cases), §4 (docs plan).

Finish the app:

- app/not-found.tsx (404) and error states.
- Security headers via next.config.js / middleware: CSP, HSTS, X-Frame-Options: DENY,
  X-Content-Type-Options: nosniff, Referrer-Policy. App-level rate limiting on mutation +
  auth-adjacent routes (Upstash Ratelimit or a middleware token bucket).
- Tests:
  - Unit (Vitest, tests/unit): Zod schemas, IST/date utils, hours math, time aggregation,
    envelope helpers.
  - Integration (Vitest + local Supabase, tests/integration): route handlers + RPC run as
    user A vs user B. This is where RLS is verified — include the explicit IDOR checks:
    user B can read user A's project (flat) but cannot mutate it; user B canNOT read user
    A's attendance / calendar / notifications by guessing IDs; two concurrent timers allowed;
    one-open-attendance enforced; working-hours != summed task timers.
  - E2E (Playwright, tests/e2e): signup -> verify -> login, project/task CRUD, timers,
    attendance, calendar, notifications.
- Docs: README, .env.example (server-only flagged), docs/architecture.md, docs/data-model.md
  (ERD + table reference), docs/api.md (+ RPC), docs/rls.md, docs/testing.md,
  docs/conventions.md. Add TSDoc to service functions and Zod schemas.

Then run the full RLS/IDOR audit from technical-spec §2.2 and report any policy that lets a
user touch data they shouldn't.
```

**Checkpoint:** `npm run test` and Playwright green; the RLS/IDOR audit passes; security
headers present; docs complete. Tag a v1 commit.

---

## Quick reference — keep these rules in front of Claude every phase

- **Envelope:** `{ data }` on success, `{ error: { message, code? } }` on failure. Correct status codes.
- **Flat reads, gated writes:** everyone reads projects/tasks; only owner/assignee/creator writes. Attendance, calendar, notifications are owner-only.
- **RLS is the authority** — handlers stay thin, don't re-implement ownership in app code.
- **Two clocks:** attendance = hours (one open session); task timers = effort (many concurrent). Never sum timers for hours.
- **Time:** store UTC, display + attendance math in IST.
- **Naming:** kebab files, camelCase vars, PascalCase types/components, snake_case DB, Zod schemas `…Schema`.
- **Never build (§11):** roles/permissions, manager attendance views, file uploads, recurrence, multi-tenant, multiple checklists per task, multi-assignee UI, mobile, comments/mentions, realtime.
