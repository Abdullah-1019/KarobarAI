  import { Router } from 'express';

  import { authenticate } from '../../core/middleware/authenticate';
  import { validateBody } from '../../core/middleware/validate';
  import {
    forgotPasswordHandler,
    loginHandler,
    logoutHandler,
    meHandler,
    otpResendHandler,
    otpVerifyHandler,
    refreshHandler,
    registerHandler,
    resetPasswordHandler,
  } from './auth.controller';
  import {
    forgotPasswordSchema,
    loginSchema,
    otpResendSchema,
    otpVerifySchema,
    registerSchema,
    resetPasswordSchema,
  } from './auth.dto';

  export const authRouter = Router();

  authRouter.post('/register', validateBody(registerSchema), registerHandler);
  authRouter.post('/otp/verify', validateBody(otpVerifySchema), otpVerifyHandler);
  authRouter.post('/otp/resend', validateBody(otpResendSchema), otpResendHandler);
  authRouter.post('/login', validateBody(loginSchema), loginHandler);
  authRouter.post('/refresh', refreshHandler);
  authRouter.post('/logout', logoutHandler);
  authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPasswordHandler);
  authRouter.post('/reset-password', validateBody(resetPasswordSchema), resetPasswordHandler);
  authRouter.get('/me', authenticate, meHandler);
