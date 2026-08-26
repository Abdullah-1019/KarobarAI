import { useTranslation } from 'react-i18next';

// Desktop-only split-panel shared by all 5 auth screens (Register/OTP/Login/Forgot/Reset —
// SCR-A01–A04), imported once by AuthLayout. Hidden under the 768px breakpoint (see
// `.karobarai-auth-panel` in global.css) — mobile gets a compact eyebrow icon instead
// (AuthLayout's `icon` prop), since a rotating panel doesn't fit a fixed-viewport phone layout
// without pushing the real form off-screen.
//
// v2 (taste correction): the original version layered four decorative systems at once — a
// blurred gradient blob, a dot-grid texture, a fake "browser mockup" illustration, and a
// sparkle accent — on top of the slide rotation. That reads as generic/templated, not "sleek
// minimal" (validated against real split-auth patterns — Notion/Linear/Vercel-style pages run
// on restraint: one confident typographic statement, not layered decoration). This version
// keeps exactly one texture (a faint dot grid) and replaces the fake UI mockup with one small,
// abstract line-icon per slide — the headline carries the panel, not the graphic.
//
// Copy comes from `auth:slidePanel.*` (locales/{en,ur}/index.ts) so it switches language with
// the rest of the app automatically — no separate RTL variant needed.
const SLIDES = [
  { key: 'slide1' as const, mark: 'store' as const },
  { key: 'slide2' as const, mark: 'reach' as const },
  { key: 'slide3' as const, mark: 'insights' as const },
];

export function AuthSlidePanel() {
  const { t } = useTranslation(['auth']);

  return (
    <div className="karobarai-auth-panel">
      <div className="karobarai-auth-panel-dots" aria-hidden="true" />

      <div className="karobarai-auth-brand">
        <svg width="30" height="30" viewBox="0 0 512 512" aria-hidden="true">
          <rect width="512" height="512" rx="104" className="karobarai-auth-brand-bg" />
          <polygon points="256,150 382,280 130,280" className="karobarai-auth-brand-fg1" />
          <rect x="146" y="280" width="220" height="132" rx="14" className="karobarai-auth-brand-fg2" />
          <circle cx="256" cy="140" r="22" className="karobarai-auth-brand-dot" />
        </svg>
        <span className="karobarai-auth-brand-word">KarobarAI</span>
      </div>

      <div className="karobarai-auth-stage">
        {SLIDES.map((slide, index) => (
          <div key={slide.key} className={`karobarai-auth-slide s${index + 1}`}>
            <SlideMark kind={slide.mark} />
            <h2 className="karobarai-auth-slide-headline">{t(`auth:slidePanel.${slide.key}Headline`)}</h2>
            <p className="karobarai-auth-slide-sub">{t(`auth:slidePanel.${slide.key}Sub`)}</p>
          </div>
        ))}
      </div>

      <div className="karobarai-auth-dots" aria-hidden="true">
        <span className="karobarai-auth-dot d1" />
        <span className="karobarai-auth-dot d2" />
        <span className="karobarai-auth-dot d3" />
      </div>
    </div>
  );
}

// One small, abstract line mark per slide — same stroke-based icon language as the rest of the
// app (BackLink, form field icons), never a fake dashboard/browser/card composition.
function SlideMark({ kind }: { kind: 'store' | 'reach' | 'insights' }) {
  const common = {
    className: 'karobarai-auth-mark',
    viewBox: '0 0 44 44',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (kind === 'store') {
    return (
      <svg {...common}>
        <path d="M8 18 L8 34 Q8 36 10 36 L34 36 Q36 36 36 34 L36 18" />
        <path d="M5 10 L14 10 L12 18 L7 18 Z" />
        <path d="M14 10 L23 10 L22.5 18 L12 18 Z" />
        <path d="M23 10 L32 10 L37 18 L22.5 18 Z" />
        <path d="M18 36 L18 26 L26 26 L26 36" />
      </svg>
    );
  }
  if (kind === 'reach') {
    return (
      <svg {...common}>
        <path d="M22 4 C14 4 8 10 8 18 C8 28 22 40 22 40 C22 40 36 28 36 18 C36 10 30 4 22 4 Z" />
        <circle cx="22" cy="18" r="6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 34 L15 22 L23 28 L40 8" />
      <path d="M30 8 L40 8 L40 18" />
    </svg>
  );
}
