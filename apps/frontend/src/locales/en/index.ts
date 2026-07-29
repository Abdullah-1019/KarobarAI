// English translation bundle — "common" namespace for Day 1; per-screen namespaces are added
// alongside each feature as it lands (react-i18next).
export const common = {
  nav: {
    home: 'Home',
    orders: 'Orders',
    wishlist: 'Wishlist',
    cart: 'Cart',
    profile: 'Profile',
    dashboard: 'Dashboard',
    products: 'Products',
    analytics: 'Analytics',
    admin: 'Admin',
  },
  actions: {
    save: 'Save',
    cancel: 'Cancel',
    retry: 'Retry',
    confirm: 'Confirm',
    submit: 'Submit',
    edit: 'Edit',
    delete: 'Delete',
    close: 'Close',
  },
  state: {
    loading: 'Loading…',
    error: 'Something went wrong.',
    empty: 'Nothing here yet.',
  },
};

// Feature 1 — SCR-A01 (Register), SCR-A02 (OTP Verification), SCR-A03 (Login).
export const auth = {
  register: {
    title: 'Create your account',
    roleBuyer: 'Buyer',
    roleSeller: 'Seller',
    methodMobile: 'Mobile',
    methodEmail: 'Email',
    phoneLabel: 'Phone number',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    passwordHelp: 'At least 8 characters, with upper, lower, digit, and a special character.',
    submit: 'Create account',
    haveAccount: 'Already have an account?',
    loginLink: 'Log in',
  },
  otp: {
    title: 'Verify your phone',
    subtitle: 'Enter the 6-digit code sent to {{phone}}',
    verify: 'Verify',
    resend: 'Resend code',
    resendIn: 'Resend in {{seconds}}s',
    expiresIn: 'Code expires in {{minutes}}:{{seconds}}',
  },
  login: {
    title: 'Log in',
    identifierLabel: 'Phone or email',
    passwordLabel: 'Password',
    submit: 'Log in',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    registerLink: 'Register',
  },
  errors: {
    ACCOUNT_EXISTS: 'An account with that phone/email already exists — log in instead.',
    INVALID_CREDENTIALS: 'Invalid phone/email or password.',
    ACCOUNT_SUSPENDED: 'This account is suspended. Contact support.',
    ACCOUNT_NOT_VERIFIED: 'This account is not yet verified.',
    ACCOUNT_NOT_FOUND: 'Account not found.',
    ACCOUNT_LOCKED: 'Too many failed attempts. Try again in {{minutes}} min.',
    OTP_INCORRECT: 'Incorrect code — try again.',
    OTP_EXPIRED: 'That code expired — request a new one.',
    OTP_MAX_ATTEMPTS: 'Too many incorrect attempts — request a new code.',
    OTP_RESEND_LIMIT: 'Too many resend requests. Try again in {{minutes}} min.',
    NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
    GENERIC: 'Something went wrong. Please try again.',
  },
};
