import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ShoppingBag, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../hooks';
import { LanguageToggle } from '../LanguageToggle/LanguageToggle';
import './auth.css';
import { AiMark } from '../AiMark';
import { BrandLogo } from '../BrandLogo';

interface AuthLayoutProps {
  /** Optional leading icon tile above the heading (e.g. UserPlus on Register). */
  icon?: LucideIcon;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Centered line under the form (e.g. "Already have an account? Log in"). */
  footer?: ReactNode;
  children: ReactNode;
}

// The KarobarAI mark, shared by the panel (white badge) and the mobile header (brand green). Fills
// are driven by the surrounding scope in auth.css so one geometry serves both colour treatments.
const CAPTION_KEYS = ['slide1', 'slide2', 'slide3'] as const;
const ROTATE_MS = 5000;

/**
 * Shared chrome for every public auth screen: one rounded container holding an inset espresso brand
 * panel (logo, back pill, AI listing mockup, caption carousel) and the clean form half (top row
 * with the language toggle, vertically-centered 440px content column). All layout is logical CSS,
 * so the whole thing mirrors under dir="rtl" with no RTL-specific code.
 */
export function AuthLayout({ icon: Icon, title, subtitle, footer, children }: AuthLayoutProps) {
  const { t } = useTranslation(['auth']);
  const { dir } = useLanguage();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || prefersReducedMotion) return;
    const id = window.setInterval(
      () => setSlide((current) => (current + 1) % CAPTION_KEYS.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [paused, prefersReducedMotion]);

  return (
    <div className="kaAuth">
      <div className="kaContainer">
        <aside className="kaPanel">
          <div className="kaPanelPattern" aria-hidden="true" />

          <div className="kaPanelTop">
            <span className="kaBrand">
              <BrandLogo />
            </span>
            <Link to="/" className="kaBackPill">
              <BackIcon size={14} aria-hidden="true" />
              <span>{t('auth:backToHome')}</span>
            </Link>
          </div>

          <div className="kaPanelMid">
            <h2 className="kaPanelHeadline">{t('auth:slidePanel.buyerHeadline')}</h2>

            <div className="kaMock">
              <span className="kaMockChip">
                <AiMark size={12} color="var(--accent-marigold-strong)" />
                {t('auth:mockup.chip')}
              </span>

              <div className="kaMockRow">
                <div className="kaMockPhoto" aria-hidden="true">
                  <ShoppingBag size={26} />
                </div>
                <div className="kaMockText">
                  <div className="kaMockTitleEn" lang="en">
                    {t('auth:mockup.titleEn')}
                  </div>
                  <div className="kaMockTitleUr" lang="ur">
                    {t('auth:mockup.titleUr')}
                  </div>
                </div>
              </div>

              <div className="kaMockTags">
                <span className="kaMockTag">{t('auth:mockup.tag1')}</span>
                <span className="kaMockTag">{t('auth:mockup.tag2')}</span>
                <span className="kaMockTag" lang="ur">
                  {t('auth:mockup.tag3')}
                </span>
              </div>

              <div className="kaMockFooter">
                <span className="kaMockPrice">{t('auth:mockup.price')}</span>
                <span className="kaLive">
                  <span className="kaLiveDot" aria-hidden="true" />
                  {t('auth:mockup.live')}
                </span>
              </div>
            </div>
          </div>

          <div
            className="kaPanelBottom"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div className="kaCaptions">
              {CAPTION_KEYS.map((key, index) => (
                <p
                  key={key}
                  className="kaCaption"
                  data-active={index === slide}
                  aria-hidden={index !== slide}
                >
                  {t(`auth:captions.${key}`)}
                </p>
              ))}
            </div>
            <div className="kaDots">
              {CAPTION_KEYS.map((key, index) => (
                <button
                  key={key}
                  type="button"
                  className="kaDot"
                  data-active={index === slide}
                  aria-label={t('auth:captions.goToSlide', { n: index + 1 })}
                  onClick={() => setSlide(index)}
                />
              ))}
            </div>
          </div>
        </aside>

        <main className="kaFormSide">
          <div className="kaTopRow">
            <span className="kaMobileBrand">
              <BrandLogo />
            </span>
            <LanguageToggle />
          </div>

          <div className="kaFormContent">
            <div className="kaFormColumn">
              {Icon && (
                <span className="kaIconTile" aria-hidden="true">
                  <Icon size={22} />
                </span>
              )}
              {title && <h1 className="kaTitle">{title}</h1>}
              {subtitle && <p className="kaSubtitle">{subtitle}</p>}
              {children}
              {footer && <div className="kaFooter">{footer}</div>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
