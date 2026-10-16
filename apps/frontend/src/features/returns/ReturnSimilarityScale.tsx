import type { ReturnDetailDTO } from '@karobarai/shared';
import { useTranslation } from 'react-i18next';

/** One stored aggregate observation; this is not a probability or a historical series. */
export function ReturnSimilarityScale({
  inspection,
}: {
  inspection: NonNullable<ReturnDetailDTO['inspection']>;
}) {
  const { t } = useTranslation('returns');
  const score = inspection.similarityScore;
  if (score == null || !Number.isFinite(score)) return null;
  const marker = Math.max(0, Math.min(100, score * 100));
  return (
    <div aria-label={t('similarityScale.aria', { score: marker.toFixed(1) })}>
      <div
        style={{
          position: 'relative',
          height: 18,
          borderRadius: 9,
          overflow: 'hidden',
          background:
            'linear-gradient(to right, #f3d8d8 0% 60%, #f6e9c4 60% 80%, #d5eee8 80% 100%)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: `calc(${marker}% - 2px)`,
            top: 0,
            width: 4,
            height: 18,
            background: '#173a36',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
        <span>{t('similarityScale.reject')} &lt;60%</span>
        <span>{t('similarityScale.review')} 60–&lt;80%</span>
        <span>{t('similarityScale.accept')} ≥80%</span>
      </div>
      <strong>
        {marker.toFixed(1)}% {t('similarityScale.visualSimilarity')}
      </strong>
      {inspection.pairs.map((pair) => (
        <div key={pair.index} style={{ fontSize: 12 }}>
          {t('similarityScale.pair', { index: pair.index })}:{' '}
          {(pair.similarityScore * 100).toFixed(1)}%
        </div>
      ))}
    </div>
  );
}
