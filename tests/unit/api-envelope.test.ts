import { describe, it, expect } from "vitest";

import { ok, created, fail, failFromError } from "@/lib/api/response";
import {
  ApiError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
} from "@/lib/api/errors";

describe("response envelope helpers", () => {
  it("ok() wraps data in { data } with status 200", async () => {
    const res = ok({ hello: "world" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { hello: "world" } });
  });

  it("ok() honors a custom status", () => {
    expect(ok({ accepted: true }, 202).status).toBe(202);
  });

  it("created() uses status 201", async () => {
    const res = created({ id: "x" });
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ data: { id: "x" } });
  });

  it("fail() produces { error: { message, code } } with the given status", async () => {
    const res = fail("nope", 400, "bad_input");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("nope");
    expect(body.error.code).toBe("bad_input");
  });
});

describe("failFromError", () => {
  it("maps a known ApiError to its status + code", async () => {
    const res = failFromError(new ForbiddenError());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("forbidden");
  });

  it("includes ValidationError field details", async () => {
    const res = failFromError(
      new ValidationError("Invalid body.", { email: ["Required."] }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.details).toEqual({ email: ["Required."] });
  });

  it("treats an unknown error as a generic 500 (no detail leak)", async () => {
    const res = failFromError(new Error("boom: secret stack detail"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("secret");
  });
});

describe("ApiError hierarchy", () => {
  it("each error carries the correct HTTP status", () => {
    expect(new ValidationError().status).toBe(400);
    expect(new UnauthorizedError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
    expect(new ConflictError().status).toBe(409);
    expect(new InternalError().status).toBe(500);
  });

  it("subclasses are instances of ApiError", () => {
    expect(new NotFoundError()).toBeInstanceOf(ApiError);
  });
});
