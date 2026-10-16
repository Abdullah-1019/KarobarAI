import { Skeleton } from './Skeleton';

export function ProductCardSkeleton() {
  return (
    <article style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <Skeleton width="100%" height="0" style={{ paddingBottom: '125%' }} radius="0" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', padding: 'var(--sp-3)' }}>
        <Skeleton width="90%" height={14} />
        <Skeleton width="60%" height={14} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <Skeleton width={60} height={18} />
          <Skeleton width={36} height={36} radius="999px" />
        </div>
      </div>
    </article>
  );
}
