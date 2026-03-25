import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const createPostSchema = z.object({
  platform: z.enum(["linkedin", "facebook", "instagram", "pinterest", "twitter"]),
  topic: z.string().min(3, "Topic must be at least 3 characters").max(1000, "Topic is too long"),
  tone: z.enum(["professional", "casual", "inspirational", "humorous", "educational"]),
  language: z.enum(["English", "German", "French", "Spanish"]),
});

export const templateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100, "Name is too long"),
  platform: z.string().optional(),
  tone: z.string().optional(),
  topic: z.string().max(1000, "Topic is too long").optional(),
  language: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
