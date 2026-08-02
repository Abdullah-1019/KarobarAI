import { Card, Typography } from 'antd';
import { Link } from 'react-router-dom';

import type { CategoryDTO } from '@karobarai/shared';
import { useLanguage } from '../../hooks';

interface CategoryGridProps {
  categories: CategoryDTO[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  const { language } = useLanguage();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
      {categories.map((category) => (
        <Link key={category.id} to={`/category/${category.slug}`}>
          <Card hoverable size="small" styles={{ body: { padding: 12, textAlign: 'center' } }}>
            <Typography.Text>{language === 'UR' ? category.nameUr : category.nameEn}</Typography.Text>
          </Card>
        </Link>
      ))}
    </div>
  );
}
