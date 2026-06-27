/**
 * Service-role Supabase client — SERVER / EDGE ONLY.
 *
 * This client uses SUPABASE_SERVICE_ROLE_KEY and therefore BYPASSES Row Level
 * Security. It must never be imported into a client component or any file that
 * could ship to the browser. An ESLint `no-restricted-imports` rule enforces
 * this boundary (see eslint.config.mjs).
 *
 * The real implementation is built in Phase 2. This stub exists so the import
 * guard has a concrete target during Phase 0.
 */

// Implemented in Phase 2 (Supabase clients + API scaffolding).
export {};
