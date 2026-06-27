import { config } from "dotenv";

/**
 * Test setup. Loads .env.local so integration tests can reach Supabase using
 * the same public keys the app uses. Unit tests don't depend on these but
 * loading them is harmless.
 */
config({ path: ".env.local" });
