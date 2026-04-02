import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createPostSchema,
  templateSchema,
} from "@/lib/validations";

describe("loginSchema", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "pass123" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "pass123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "pass123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: "test@example.com" }).success).toBe(false);
    expect(loginSchema.safeParse({ password: "pass123" }).success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts valid signup input", () => {
    const result = signupSchema.safeParse({ email: "test@example.com", password: "Pass1234" });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({ email: "test@example.com", password: "Pa1" });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase letter", () => {
    const result = signupSchema.safeParse({ email: "test@example.com", password: "PASSWORD1" });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase letter", () => {
    const result = signupSchema.safeParse({ email: "test@example.com", password: "password1" });
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = signupSchema.safeParse({ email: "test@example.com", password: "Password" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({ email: "bad", password: "Pass1234" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid password", () => {
    const result = resetPasswordSchema.safeParse({ password: "NewPass1" + "2" });
    expect(result.success).toBe(true);
  });

  it("rejects weak password", () => {
    expect(resetPasswordSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "alllowercase1" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "ALLUPPERCASE1" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "NoNumbers" }).success).toBe(false);
  });
});

describe("createPostSchema", () => {
  const validPost = {
    platform: "linkedin",
    topic: "Test topic here",
    tone: "professional",
    language: "English",
  };

  it("accepts valid post input", () => {
    expect(createPostSchema.safeParse(validPost).success).toBe(true);
  });

  it("accepts all valid platforms", () => {
    for (const p of ["linkedin", "facebook", "instagram", "pinterest", "twitter"]) {
      expect(createPostSchema.safeParse({ ...validPost, platform: p }).success).toBe(true);
    }
  });

  it("rejects invalid platform", () => {
    expect(createPostSchema.safeParse({ ...validPost, platform: "tiktok" }).success).toBe(false);
  });

  it("accepts all valid tones", () => {
    for (const t of ["professional", "casual", "inspirational", "humorous", "educational"]) {
      expect(createPostSchema.safeParse({ ...validPost, tone: t }).success).toBe(true);
    }
  });

  it("rejects invalid tone", () => {
    expect(createPostSchema.safeParse({ ...validPost, tone: "angry" }).success).toBe(false);
  });

  it("accepts all valid languages", () => {
    for (const l of ["English", "German", "French", "Spanish"]) {
      expect(createPostSchema.safeParse({ ...validPost, language: l }).success).toBe(true);
    }
  });

  it("rejects invalid language", () => {
    expect(createPostSchema.safeParse({ ...validPost, language: "Japanese" }).success).toBe(false);
  });

  it("rejects topic shorter than 3 characters", () => {
    expect(createPostSchema.safeParse({ ...validPost, topic: "ab" }).success).toBe(false);
  });

  it("rejects topic longer than 1000 characters", () => {
    expect(createPostSchema.safeParse({ ...validPost, topic: "a".repeat(1001) }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(createPostSchema.safeParse({}).success).toBe(false);
  });
});

describe("templateSchema", () => {
  it("accepts valid template", () => {
    expect(templateSchema.safeParse({ name: "My Template" }).success).toBe(true);
  });

  it("accepts template with all optional fields", () => {
    const result = templateSchema.safeParse({
      name: "Template",
      platform: "linkedin",
      tone: "casual",
      topic: "Test topic",
      language: "English",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(templateSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    expect(templateSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects topic longer than 1000 characters", () => {
    expect(templateSchema.safeParse({ name: "T", topic: "a".repeat(1001) }).success).toBe(false);
  });
});
