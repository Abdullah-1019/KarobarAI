import { z } from 'zod';

// Shared between apps/backend (server-side validation) and apps/frontend (client-side form
// validation) — TRD §4 calls for "shared Zod schemas with the API contract" specifically to
// avoid the two sides drifting apart. Do not redefine these locally in either app.

// REQ-F-Auth002: >=8 chars incl. upper/lower/digit/special.
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/\d/, 'Password must include a digit')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');

const roleSchema = z.enum(['BUYER', 'SELLER']);
const languageSchema = z.enum(['EN', 'UR']);

export const registerSchema = z.discriminatedUnion('method', [
  z
    .object({
      method: z.literal('mobile'),
      role: roleSchema,
      phone: z.string().min(7),
      password: passwordSchema,
      preferredLanguage: languageSchema.optional(),
    })
    .strict(),
  z
    .object({
      method: z.literal('email'),
      role: roleSchema,
      email: z.string().email(),
      password: passwordSchema,
      preferredLanguage: languageSchema.optional(),
    })
    .strict(),
]);

export const otpVerifySchema = z
  .object({
    phone: z.string().min(7),
    code: z
      .string()
      .length(6)
      .regex(/^\d{6}$/, 'OTP must be 6 digits'),
  })
  .strict();

export const otpResendSchema = z
  .object({
    phone: z.string().min(7),
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: z.string().min(3),
    password: z.string().min(1),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().min(3),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type OtpResendInput = z.infer<typeof otpResendSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
