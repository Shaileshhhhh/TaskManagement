import { type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import type { User, SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { UnauthorizedError, ValidationError } from "@/lib/api/errors";
import { failFromError } from "@/lib/api/response";
import type { Database } from "@/types/database.types";

type Supabase = SupabaseClient<Database>;

/**
 * Validated, typed inputs handed to a route after withAuth has done its work.
 * The generics default to `undefined` so routes only opt into what they use.
 */
export interface AuthedContext<TBody, TParams, TQuery> {
  /** The authenticated user (never null inside a withAuth handler). */
  user: User;
  /** RLS-scoped server Supabase client for this request. */
  supabase: Supabase;
  /** Parsed + validated request body (if a body schema was provided). */
  body: TBody;
  /** Parsed + validated route params (if a params schema was provided). */
  params: TParams;
  /** Parsed + validated query string (if a query schema was provided). */
  query: TQuery;
  /** The raw request, for the rare case a route needs it. */
  request: NextRequest;
}

/** Next.js passes dynamic route params as `{ params: Promise<...> }`. */
type RouteArgs = { params?: Promise<Record<string, string>> };

interface WithAuthOptions<TBody, TParams, TQuery> {
  bodySchema?: ZodType<TBody>;
  paramsSchema?: ZodType<TParams>;
  querySchema?: ZodType<TQuery>;
}

type Handler<TBody, TParams, TQuery> = (
  ctx: AuthedContext<TBody, TParams, TQuery>,
) => Promise<Response> | Response;

/**
 * Wrap a route handler with authentication, validation, and error handling.
 *
 * Order of operations (validation BEFORE any DB work the route does):
 *   1. Resolve the user from the session → 401 if absent.
 *   2. Validate route params, query, then body against the provided Zod
 *      schemas → 400 with field details on failure.
 *   3. Run the handler with a typed, validated context.
 *   4. Any thrown ApiError (or unexpected error) is rendered through the
 *      { error } envelope by the central catch.
 *
 * Ownership/scoping is NOT checked here — that is RLS's job at the database.
 * Handlers stay thin.
 *
 * @example
 *   // app/api/projects/route.ts
 *   export const POST = withAuth(
 *     async ({ body, supabase, user }) => {
 *       const { data, error } = await supabase
 *         .from("projects")
 *         .insert({ ...body, owner_id: user.id })
 *         .select()
 *         .single();
 *       if (error) throw new InternalError(error.message);
 *       return created(data);
 *     },
 *     { bodySchema: projectCreateSchema },
 *   );
 */
export function withAuth<
  TBody = undefined,
  TParams = undefined,
  TQuery = undefined,
>(
  handler: Handler<TBody, TParams, TQuery>,
  options: WithAuthOptions<TBody, TParams, TQuery> = {},
) {
  return async function (
    request: NextRequest,
    routeArgs?: RouteArgs,
  ): Promise<Response> {
    try {
      const supabase = await createClient();

      // 1. Authenticate.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new UnauthorizedError();
      }

      // 2. Validate inputs (params → query → body), before any DB call.
      const params = options.paramsSchema
        ? parse(options.paramsSchema, await resolveParams(routeArgs), "params")
        : (undefined as TParams);

      const query = options.querySchema
        ? parse(
            options.querySchema,
            Object.fromEntries(request.nextUrl.searchParams),
            "query",
          )
        : (undefined as TQuery);

      const body = options.bodySchema
        ? parse(options.bodySchema, await readJson(request), "body")
        : (undefined as TBody);

      // 3. Run the route.
      return await handler({
        user,
        supabase,
        body,
        params,
        query,
        request,
      });
    } catch (err) {
      // 4. Central error envelope.
      return failFromError(err);
    }
  };
}

/** Resolve Next.js dynamic params (a promise) into a plain object. */
async function resolveParams(
  routeArgs?: RouteArgs,
): Promise<Record<string, string>> {
  if (!routeArgs?.params) return {};
  return await routeArgs.params;
}

/** Read a JSON body, tolerating an empty body as `{}`. */
async function readJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("Request body is not valid JSON.");
  }
}

/** Parse with a Zod schema, converting failures into a 400 ValidationError. */
function parse<T>(schema: ZodType<T>, input: unknown, where: string): T {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ValidationError(
        `Invalid ${where}.`,
        z.flattenError(err).fieldErrors,
      );
    }
    throw err;
  }
}
