import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest config for TaskCo.
 *
 * - Unit tests (tests/unit): pure logic — Zod schemas, envelope/error helpers.
 *   No network, no DB.
 * - Integration tests (tests/integration): hit the live Supabase project for
 *   auth (register/login). They read NEXT_PUBLIC_SUPABASE_* from .env.local via
 *   the setup file. Run with a longer timeout for network round-trips.
 *
 * Path aliases (@/...) are resolved from tsconfig by vite-tsconfig-paths.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
