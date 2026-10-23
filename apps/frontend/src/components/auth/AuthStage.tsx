import { Bell, Camera, Check, Heart, Home, ShoppingBag, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AiMark } from '../AiMark';
import type { AuthRole } from './authRole';

const IMG = '/demo/products/';

// One animated scene of the auth panel story. Each scene is remounted (keyed by role + index) so
// its CSS entrance plays from the start; everything is decorative, and the panel announces the
// scene title separately for screen readers.
export function AuthStage({ role, scene }: { role: AuthRole; scene: number }) {
  const { t } = useTranslation(['auth']);

  if (role === 'SELLER') {
    if (scene === 0) {
      return (
        <div className="kaScene kaSceneSnap">
          <div className="kaSnapFrame">
            <Camera className="kaSnapGhost" size={36} />
            <img className="kaSnapPhoto" src={`${IMG}fashion-clothing.svg`} alt="" />
            <span className="kaSnapFlash" />
          </div>
          <span className="kaStagePill kaPop" style={{ animationDelay: '900ms' }}>
            <Camera size={14} />
            {t('auth:stage.photo')}
          </span>
        </div>
      );
    }
    if (scene === 1) {
      return (
        <div className="kaScene kaSceneWrite">
          <div className="kaWritePhoto">
            <img src={`${IMG}fashion-clothing.svg`} alt="" />
            <span className="kaScanLine" />
          </div>
          <div className="kaWriteText">
            <span className="kaMockChip kaPop">
              <AiMark size={12} color="var(--ai-accent)" />
              {t('auth:mockup.chip')}
            </span>
            <span className="kaType kaTypeEn" dir="ltr" lang="en">
              {t('auth:mockup.titleEn')}
            </span>
            <span className="kaType kaTypeUr" dir="rtl" lang="ur">
              {t('auth:mockup.titleUr')}
            </span>
            <span className="kaWriteTags">
              <span className="kaMockTag">{t('auth:mockup.tag1')}</span>
              <span className="kaMockTag">{t('auth:mockup.tag2')}</span>
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className="kaScene kaSceneLive">
        <div className="kaLiveCard">
          <div className="kaMockPhoto">
            <img src={`${IMG}fashion-clothing.svg`} alt="" />
          </div>
          <div className="kaMockText">
            <div className="kaMockTitleEn" lang="en">
              {t('auth:mockup.titleEn')}
            </div>
            <div className="kaMockPrice">{t('auth:mockup.price')}</div>
            <span className="kaLive">
              <span className="kaLiveDot" />
              {t('auth:mockup.live')}
            </span>
          </div>
        </div>
        <div className="kaToast">
          <span className="kaToastIcon">
            <Bell size={16} />
          </span>
          <span>{t('auth:stage.newOrder')}</span>
        </div>
      </div>
    );
  }

  if (scene === 0) {
    const tiles = ['fashion-clothing', 'home-kitchen', 'beauty-personal-care', 'mobile-accessories'];
    return (
      <div className="kaScene kaSceneBrowse">
        {tiles.map((name, index) => (
          <span key={name} className="kaTile kaPop" data-cat={name} style={{ animationDelay: `${index * 120}ms` }}>
            <img src={`${IMG}${name}.svg`} alt="" />
            {index === 1 && (
              <span className="kaTileHeart">
                <Heart size={14} fill="currentColor" />
              </span>
            )}
          </span>
        ))}
      </div>
    );
  }
  if (scene === 1) {
    return (
      <div className="kaScene kaSceneCart">
        <div className="kaCartRow">
          <span className="kaTile kaFly" data-cat="home-kitchen">
            <img src={`${IMG}home-kitchen.svg`} alt="" />
          </span>
          <span className="kaCartBag">
            <ShoppingBag size={26} />
            <span className="kaCartBadge">1</span>
          </span>
        </div>
        <span className="kaStagePill kaStagePill--ok kaPop" style={{ animationDelay: '1300ms' }}>
          <Check size={14} strokeWidth={3} />
          {t('auth:stage.cod')}
        </span>
      </div>
    );
  }
  return (
    <div className="kaScene kaSceneRoute">
      <div className="kaRoute" dir="ltr">
        <svg viewBox="0 0 280 140" className="kaRouteSvg">
          <path className="kaRoutePath" d="M30 110 C 90 110, 80 30, 150 40 S 230 90, 250 30" />
        </svg>
        <span className="kaRoutePin kaRoutePin--from">
          <Store size={16} />
        </span>
        <span className="kaRoutePin kaRoutePin--to">
          <Home size={16} />
        </span>
        <span className="kaRider" />
      </div>
      <span className="kaStagePill kaStagePill--ok kaPop" style={{ animationDelay: '2100ms' }}>
        <Check size={14} strokeWidth={3} />
        {t('auth:stage.delivered')}
      </span>
    </div>
  );
}
