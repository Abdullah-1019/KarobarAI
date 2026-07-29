// Validation schemas moved to packages/shared/src/schemas/auth.ts (TRD §4: "shared Zod schemas
// with the API contract") so the frontend can reuse the exact same rules. Re-exported here so
// existing imports in this module (`./auth.dto`) keep working unchanged.
export {
  passwordSchema,
  registerSchema,
  otpVerifySchema,
  otpResendSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@karobarai/shared';
export type {
  RegisterInput,
  OtpVerifyInput,
  OtpResendInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '@karobarai/shared';
