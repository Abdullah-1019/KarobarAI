import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { CategoryDTO } from '@karobarai/shared';
import { ArrowIcon } from '../../components';
import { useLanguage } from '../../hooks';
import { CATEGORY_ART, ruleFor } from './categoryVisuals';

interface CategoryGridProps {
  categories: CategoryDTO[];
}

// SCR-B01 categories band. Tonal tiles (4 across on desktop, two columns on phones), each led
// by its category illustration — or the icon on a tonal disc when no illustration fits — then the
// localized name (2-line clamp) with the other language as a lighter sub-label, and a trailing
// arrow that slides in on hover/focus. Names come from the API (admin data); the other
// language is shown as the sub-label, and a per-key i18n label is used only if the API name is
// blank (rule G).
export function CategoryGrid({ categories }: CategoryGridProps) {
  const { language } = useLanguage();
  const { t } = useTranslation('marketplace');

  return (
    <ul className="cat-grid">
      {categories.map((category) => {
        const { key, icon: Icon } = ruleFor(category.slug);
        const art = CATEGORY_ART[key];
        const fallback = t(`categoryNames.${key}`, { defaultValue: '' });
        const nameEn = category.nameEn || fallback || category.slug;
        const nameUr = category.nameUr || fallback || category.slug;
        const name = language === 'UR' ? nameUr : nameEn;
        const other = language === 'UR' ? nameEn : nameUr;

        return (
          <li key={category.id}>
            <Link to={`/category/${category.slug}`} className={`cat-tile cat-tile--${key}`}>
              {art ? (
                <span className="cat-tile__art" aria-hidden="true">
                  <img src={art} alt="" loading="lazy" width={400} height={500} />
                </span>
              ) : (
                <span className="cat-tile__icon">
                  <Icon size={26} aria-hidden="true" />
                </span>
              )}
              <span className="cat-tile__body">
                <span className="cat-tile__name" lang={language === 'UR' ? 'ur' : 'en'}>
                  {name}
                </span>
                {other && other !== name && (
                  <span className="cat-tile__sub" lang={language === 'UR' ? 'en' : 'ur'}>
                    {other}
                  </span>
                )}
              </span>
              <span className="cat-tile__arrow">
                <ArrowIcon size={18} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
