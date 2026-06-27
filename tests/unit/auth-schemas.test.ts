import { describe, it, expect } from "vitest";

import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("accepts a valid email + non-empty password", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("trims the email before validating", () => {
    const result = loginSchema.safeParse({
      email: "  alice@example.com  ",
      password: "x",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("alice@example.com");
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email field entirely", () => {
    const result = loginSchema.safeParse({ password: "password123" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    fullName: "Alice Tester",
    email: "alice@example.com",
    password: "password123",
  };

  it("accepts a full, valid payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("password"))).toBe(
        true,
      );
    }
  });

  it("rejects an empty full name", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than the 72-char bcrypt limit", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "a".repeat(73),
    });
    expect(result.success).toBe(false);
  });
});
