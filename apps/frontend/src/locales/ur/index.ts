// Urdu translation bundle — "common" namespace for Day 1; per-screen namespaces are added
// alongside each feature as it lands (react-i18next).
export const common = {
  nav: {
    home: 'ہوم',
    orders: 'آرڈرز',
    wishlist: 'پسندیدہ',
    cart: 'ٹوکری',
    profile: 'پروفائل',
    dashboard: 'ڈیش بورڈ',
    products: 'مصنوعات',
    analytics: 'تجزیات',
    admin: 'ایڈمن',
  },
  actions: {
    save: 'محفوظ کریں',
    cancel: 'منسوخ کریں',
    retry: 'دوبارہ کوشش کریں',
    confirm: 'تصدیق کریں',
    submit: 'جمع کروائیں',
    edit: 'ترمیم کریں',
    delete: 'حذف کریں',
    close: 'بند کریں',
  },
  state: {
    loading: 'لوڈ ہو رہا ہے…',
    error: 'کچھ غلط ہو گیا۔',
    empty: 'ابھی یہاں کچھ نہیں ہے۔',
  },
};

// Feature 1 — SCR-A01 (Register), SCR-A02 (OTP Verification), SCR-A03 (Login).
export const auth = {
  register: {
    title: 'اپنا اکاؤنٹ بنائیں',
    roleBuyer: 'خریدار',
    roleSeller: 'بیچنے والا',
    methodMobile: 'موبائل',
    methodEmail: 'ای میل',
    phoneLabel: 'فون نمبر',
    emailLabel: 'ای میل ایڈریس',
    passwordLabel: 'پاس ورڈ',
    passwordHelp: 'کم از کم 8 حروف، بڑا حرف، چھوٹا حرف، ہندسہ، اور خاص علامت شامل ہو۔',
    submit: 'اکاؤنٹ بنائیں',
    haveAccount: 'پہلے سے اکاؤنٹ ہے؟',
    loginLink: 'لاگ اِن کریں',
  },
  otp: {
    title: 'اپنا فون نمبر تصدیق کریں',
    subtitle: '{{phone}} پر بھیجا گیا 6 ہندسوں کا کوڈ درج کریں',
    verify: 'تصدیق کریں',
    resend: 'کوڈ دوبارہ بھیجیں',
    resendIn: '{{seconds}} سیکنڈ میں دوبارہ بھیجیں',
    expiresIn: 'کوڈ کی میعاد {{minutes}}:{{seconds}} میں ختم ہو جائے گی',
  },
  login: {
    title: 'لاگ اِن کریں',
    identifierLabel: 'فون یا ای میل',
    passwordLabel: 'پاس ورڈ',
    submit: 'لاگ اِن کریں',
    forgotPassword: 'پاس ورڈ بھول گئے؟',
    noAccount: 'اکاؤنٹ نہیں ہے؟',
    registerLink: 'رجسٹر کریں',
  },
  errors: {
    ACCOUNT_EXISTS: 'اس فون/ای میل سے پہلے ہی اکاؤنٹ موجود ہے — لاگ اِن کریں۔',
    INVALID_CREDENTIALS: 'غلط فون/ای میل یا پاس ورڈ۔',
    ACCOUNT_SUSPENDED: 'یہ اکاؤنٹ معطل ہے۔ سپورٹ سے رابطہ کریں۔',
    ACCOUNT_NOT_VERIFIED: 'یہ اکاؤنٹ ابھی تصدیق شدہ نہیں ہے۔',
    ACCOUNT_NOT_FOUND: 'اکاؤنٹ نہیں ملا۔',
    ACCOUNT_LOCKED: 'بہت زیادہ ناکام کوششیں۔ {{minutes}} منٹ میں دوبارہ کوشش کریں۔',
    OTP_INCORRECT: 'غلط کوڈ — دوبارہ کوشش کریں۔',
    OTP_EXPIRED: 'اس کوڈ کی میعاد ختم ہو گئی — نیا کوڈ حاصل کریں۔',
    OTP_MAX_ATTEMPTS: 'بہت زیادہ غلط کوششیں — نیا کوڈ حاصل کریں۔',
    OTP_RESEND_LIMIT: 'بہت زیادہ درخواستیں۔ {{minutes}} منٹ میں دوبارہ کوشش کریں۔',
    NETWORK_ERROR: 'سرور تک رسائی نہیں ہو سکی۔ اپنا کنکشن چیک کریں اور دوبارہ کوشش کریں۔',
    GENERIC: 'کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔',
  },
};
