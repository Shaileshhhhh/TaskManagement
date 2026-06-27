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
- **Env status:** `.env.local` has the Supabase URL + publishable (anon) key. Still MISSING:
  `SUPABASE_SERVICE_ROLE_KEY` (needed for Phase 2 admin client + Phase 8 Edge Functions) and
  `RESEND_API_KEY` (Phase 8). DB password for migrations: `Taskco@passwor`.
- Next: Phase 2 — Supabase clients (browser/server/admin) + API scaffolding (withAuth, envelope, errors).
