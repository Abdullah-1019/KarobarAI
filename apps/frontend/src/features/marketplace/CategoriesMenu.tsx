import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useLanguage } from '../../hooks';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { CATEGORY_ART, ruleFor, tintFor } from './categoryVisuals';

// "Categories" in the floating pill nav (the sample Home design's Shop / Categories / Sell row).
// Lists the real, admin-managed categories (the same cached query the Category page uses), each
// with its cut-out art on its tile tint so the menu reads like the category grid in miniature. The
// trigger is a real button; the menu items are links, so middle-click and keyboard both work.
export function CategoriesMenu() {
  const { t } = useTranslation('marketplace');
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const { data: categories } = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: getCategories,
    staleTime: 10 * 60 * 1000,
  });

  const items: MenuProps['items'] = (categories ?? []).map((category) => {
    const art = CATEGORY_ART[ruleFor(category.slug).key];
    return {
      key: category.slug,
      label: (
        <Link to={`/category/${category.slug}`} className="categories-menu__item">
          <span
            className="categories-menu__swatch"
            style={{ background: tintFor(category.slug) }}
            aria-hidden="true"
          >
            {art && <img src={art} alt="" />}
          </span>
          {language === 'UR' ? category.nameUr : category.nameEn}
        </Link>
      ),
    };
  });

  return (
    <Dropdown
      menu={{ items, onClick: () => setOpen(false) }}
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottom"
      overlayClassName="categories-menu"
      disabled={!items.length}
    >
      <button
        type="button"
        className="storefront-nav__link storefront-nav__link--menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('nav.categories')}
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </Dropdown>
  );
}
