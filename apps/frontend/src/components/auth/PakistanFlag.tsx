// Pakistan flag as inline SVG (3:2) — the 🇵🇰 emoji renders as "PK" letters on Windows, so the phone
// prefix draws its own: white hoist band, green field, crescent and five-pointed star.
export function PakistanFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 20" aria-hidden="true" focusable="false">
      <rect width="30" height="20" fill="#01411C" />
      <rect width="7.5" height="20" fill="#FFFFFF" />
      <circle cx="18.6" cy="10.6" r="6" fill="#FFFFFF" />
      <circle cx="20.2" cy="9" r="5.2" fill="#01411C" />
      <path
        d="M23 6.04L22.92 7.33L24.09 7.85L22.84 8.17L22.71 9.45L22.02 8.36L20.76 8.63L21.58 7.64L20.94 6.52L22.14 7Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
