# TaskCo — Working Notes for Claude

Internal team task manager. Build strictly to the specs in `docs/`:
- `docs/taskco-build-spec.md` — stack, schema, RLS, folder tree, API surface, build order
- `docs/taskco-technical-spec.md` — RLS deep-dive, security checklist, test cases, docs plan
- `docs/taskco-claude-code-prompts.md` — the phase-by-phase build playbook

## Locked stack
Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · Lucide icons (no emoji) ·
Supabase (Postgres + Auth) via `@supabase/ssr` · Postgres RLS for authz ·
`react-big-calendar` · Zod validation · Vitest + Playwright · Resend (email).

## Non-negotiable rules (keep in front every phase)
- **Envelope:** success `{ data }`, failure `{ error: { message, code? } }`, correct HTTP status (400/401/403/404/500).
- **RLS is the authority.** Handlers stay thin — never re-implement ownership checks in app code.
- **Flat reads, gated writes.** Everyone reads projects/tasks; owner/assignee/creator writes. Attendance, calendar, notifications are owner-only (personal).
- **Two clocks.** Attendance = working hours (one open session per user). Task timers = effort (MANY concurrent allowed). NEVER sum task timers to compute hours.
- **Time.** Store UTC; display + attendance math in IST (`Asia/Kolkata`). IST helpers live in `lib/utils/dates-ist.ts`.
- **Service-role boundary.** `lib/supabase/admin.ts` is server/edge only. The ESLint `no-restricted-imports` rule in `eslint.config.mjs` blocks it from client components/pages — do not weaken it.
- **Validate before DB.** Every route: `withAuth` → Zod-validate body/params/query → thin handler → envelope.

## Naming
kebab files · camelCase vars/fns · PascalCase types/components · snake_case DB · Zod schemas suffixed `…Schema` · constants SCREAMING_SNAKE_CASE.

## Never build (§11, out of scope v1)
Roles/permissions · manager attendance views · file uploads (links only) · recurrence implementation · multi-tenant/orgs · multiple checklists per task · multi-assignee UI (schema supports it, UI is single) · mobile · comments/mentions · realtime.

## Build status
- **Phase 0 — Bootstrap: DONE.** Next.js + TS + Tailwind + shadcn (button added), Lucide,
  `supabase init`, full §5 folder tree, `.env.example` + `.env.local` (server-only keys flagged),
  ESLint admin-import guard (verified firing), strict tsconfig, `.gitignore`.
- **Phase 1 — Database: DONE.** 5 ordered migrations (enums → tables → functions/triggers
  → RLS → views/RPC) + seed, all applied to the live Supabase project
  (`hfapvclyxtakhtvpckvk`). Verified: 11 tables all RLS-enabled, 35 policies, `handle_new_user`
  trigger creates profiles, views + `get_my_dashboard` RPC work, activity/notify triggers attached.
  `types/database.types.ts` hand-authored to match the live schema (cross-checked column-by-column)
  — REGENERATE with `supabase gen types typescript --local` once Docker/Podman is available
  (the CLI always spawns a container, so it cannot run in this environment).
- **Phase 2 — Supabase clients + API scaffolding: DONE.** lib/supabase/{client,server,middleware,admin}.ts,
  root middleware.ts (session refresh + page guard; API routes excluded so they 401-JSON instead of redirect),
  lib/api/{errors,response,handler}.ts (withAuth → 401 if no user, Zod-validate params/query/body before DB,
  central { error } envelope), lib/validations/common.ts (base Zod). Throwaway probe at /api/health-check.
  VERIFIED live: no session → 401 { error }, valid cookie session → 200 { data, userId } as seeded Alice.
- **Seed fix (Phase 2):** GoTrue requires auth.users token columns (confirmation_token, recovery_token,
  email_change*, phone_change*, reauthentication_token) to be '' not NULL — NULL caused login 500
  "Database error querying schema". seed.sql patched + live rows fixed. Seeded users:
  alice@example.com / bob@example.com, password `password123`.
- **Env status:** `.env.local` has Supabase URL + publishable (anon) key. Still MISSING:
  `SUPABASE_SERVICE_ROLE_KEY` (admin client at runtime + Phase 8) and `RESEND_API_KEY` (Phase 8).
  DB password (migrations): `Taskco@passwor`. NOTE: App Router treats `_name` folders as private
  (non-routable) — never name a route folder with a leading underscore.
- Next: Phase 3 — Auth (login/register/forgot/reset/verify pages, auth/callback + confirm routes,
  auth-guarded (app)/layout.tsx). This is the "MODULE 5 — Auth Reference Card" stopping line.
