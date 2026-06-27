import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The service-role Supabase client (lib/supabase/admin) bypasses RLS and must
// NEVER reach the browser. We block importing it everywhere by default, then
// re-allow it only in trusted server/edge locations. Client components and
// pages (which may carry "use client") are therefore never permitted to import
// it — a build-time guard backing the §2.1 service-role boundary.
const RESTRICTED_ADMIN_IMPORT = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/lib/supabase/admin", "**/lib/supabase/admin"],
            message:
              "lib/supabase/admin is the service-role client (bypasses RLS). Import it only from server/edge code (app/api, lib/queries, lib/api, supabase/functions) — never from client components or pages.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  RESTRICTED_ADMIN_IMPORT,
  // Re-allow the admin client only in trusted server/edge locations.
  {
    files: [
      "app/api/**/*.{ts,tsx}",
      "lib/queries/**/*.{ts,tsx}",
      "lib/api/**/*.{ts,tsx}",
      "lib/supabase/**/*.{ts,tsx}",
      "supabase/functions/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
