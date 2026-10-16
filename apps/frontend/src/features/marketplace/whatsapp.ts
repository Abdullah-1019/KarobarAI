// Optional WhatsApp contact. The number is operator-configured via VITE_WHATSAPP_NUMBER
// (international format, digits only) — there is deliberately no hardcoded fallback, so the
// floating button and footer link simply don't render on a deployment that hasn't set a real
// support number (rule K: never invent a contact detail).
const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/[^\d]/g, '');

/** wa.me deep link, or `null` when no number is configured. */
export function getWhatsAppUrl(message?: string): string | null {
  if (!WHATSAPP_NUMBER) {
    return null;
  }
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
