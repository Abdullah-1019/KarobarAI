import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../hooks';
import { LanguageToggle } from '../LanguageToggle/LanguageToggle';
import './auth.css';
import { BrandLogo } from '../BrandLogo';
import { AuthStage } from './AuthStage';
import { readAuthRole, writeAuthRole, type AuthRole } from './authRole';

interface AuthLayoutProps {
  /** Kept so existing screens compile; no longer drawn. An icon tile stacked above the title is a
   * templated pattern (impeccable "icon-tile-stack") — the Outfit title carries the screen. */
  icon?: LucideIcon;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Centered line under the form (e.g. "Already have an account? Log in"). */
  footer?: ReactNode;
  /** Controlled panel story (Register ties it to its role cards); otherwise the last choice. */
  role?: AuthRole;
  onRoleChange?: (role: AuthRole) => void;
  children: ReactNode;
}

const SCENES = ['s1', 's2', 's3'] as const;
// Each scene lasts as long as its progress bar takes to fill (--scene-ms in auth.css); the bar's
// animationend advances the story, so hover-pause and the bar can never drift apart, and with
// reduced motion (no fill animation) the story simply waits for a tap.

/**
 * Shared chrome for every public auth screen (Studio Light): a wash brand panel (logo, back pill,
 * a Buyer/Seller story switch, the role's headline, a three-scene animated story with story-style
 * progress bars) beside the form, which sits straight on the warm-white page. All layout is
 * logical CSS, so the whole thing mirrors under dir="rtl" with no RTL-specific code.
 */
export function AuthLayout({ title, subtitle, footer, role: roleProp, onRoleChange, children }: AuthLayoutProps) {
  const { t } = useTranslation(['auth']);
  const { dir } = useLanguage();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [ownRole, setOwnRole] = useState<AuthRole>(readAuthRole);
  const role = roleProp ?? ownRole;
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const next = () => setScene((current) => (current + 1) % SCENES.length);

  // A role change (from either the switch or Register's cards) restarts the story.
  useEffect(() => setScene(0), [role]);


  const chooseRole = (next: AuthRole) => {
    writeAuthRole(next);
    if (onRoleChange) onRoleChange(next);
    else setOwnRole(next);
  };

  const story = role === 'SELLER' ? 'seller' : 'buyer';

  return (
    <div className="kaAuth">
      <div className="kaContainer">
        <aside className="kaPanel" data-role={story}>
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

          <div
            className="kaPanelMid"
            data-paused={paused || undefined}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="kaRoleSwitch" role="group" aria-label={t('auth:stage.switchLabel')}>
              {(['BUYER', 'SELLER'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className="kaRoleSwitchBtn"
                  aria-pressed={role === value}
                  onClick={() => chooseRole(value)}
                >
                  {value === 'BUYER' ? t('auth:register.roleBuyer') : t('auth:register.roleSeller')}
                </button>
              ))}
            </div>

            <h2 key={story} className="kaPanelHeadline">
              {t(`auth:slidePanel.${story}Headline`)}
            </h2>

            <div className="kaStage" aria-hidden="true">
              <AuthStage key={`${story}-${scene}`} role={role} scene={scene} />
            </div>
            <p className="kaSrOnly" aria-live="polite">
              {t(`auth:stage.${story}.${SCENES[scene]}`)}
            </p>

            <div className="kaBars">
              {SCENES.map((key, index) => (
                <button
                  key={`${story}-${key}`}
                  type="button"
                  className="kaBar"
                  data-state={index < scene ? 'done' : index === scene ? 'active' : undefined}
                  aria-label={t('auth:captions.goToSlide', { n: index + 1 })}
                  aria-current={index === scene || undefined}
                  onClick={() => setScene(index)}
                >
                  <span
                    key={index === scene ? `${role}-${scene}` : undefined}
                    className="kaBarFill"
                    onAnimationEnd={index === scene ? next : undefined}
                  />
                </button>
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
