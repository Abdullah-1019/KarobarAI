import { useState } from 'react';
import { Alert, Button, Drawer, Input } from 'antd';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight, EyeOff, Info, Package, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Modal, PriceDisplay, ProductThumbnail, SkeletonLoader, StatusTag, type StatusVariant, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { getProduct, productQueryKey } from '../catalog/catalogApi';
import {
  adminModerationQueryKey,
  adminProductDetailQueryKey,
  getAdminProductDetail,
  listModerationQueue,
  restoreProduct,
  takedownProduct,
  type AdminModerationParams,
} from './adminApi';
import { formatAdminError } from './adminErrors';

type StatusFilter = NonNullable<AdminModerationParams['status']> | 'ALL';
type PendingAction = { type: 'takedown' | 'restore'; productId: string } | null;

const FILTERS: StatusFilter[] = ['ALL', 'LIVE', 'DRAFT', 'OUT_OF_STOCK', 'REMOVED'];
const PRODUCT_STATUS_VARIANT: Record<string, StatusVariant> = {
  LIVE: 'success',
  DRAFT: 'neutral',
  OUT_OF_STOCK: 'warning',
  REMOVED: 'error',
};

// SCR-AD05 — every listing across every seller, filterable by status, at compact admin density.
// No `reported`/flagged filter: no product-reporting mechanism exists anywhere in this codebase
// (no table, no buyer "report" action), so this is all-products-by-status, not a complaints queue.
// The admin list DTO carries no image, so rows show a status-tinted mark; the drawer tries the
// public product read for a photo (it 404s for drafts/removed listings, which just keep the mark).
export function ProductModerationPage() {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');

  const params: AdminModerationParams = { status: statusFilter === 'ALL' ? undefined : statusFilter };

  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: adminModerationQueryKey(params),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listModerationQueue(params, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const detail = useQuery({
    queryKey: adminProductDetailQueryKey(selectedProductId ?? ''),
    queryFn: () => getAdminProductDetail(selectedProductId ?? ''),
    enabled: !!selectedProductId,
  });
  const product = detail.data;
  const publicProduct = useQuery({
    queryKey: productQueryKey(selectedProductId ?? ''),
    queryFn: () => getProduct(selectedProductId ?? ''),
    enabled: !!selectedProductId && product?.status !== 'REMOVED' && product?.status !== 'DRAFT' && !!product,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const photo = publicProduct.data ? [...publicProduct.data.images].sort((a, b) => a.position - b.position)[0]?.url ?? null : null;

  const actionMutation = useMutation({
    mutationFn: (input: { type: 'takedown' | 'restore'; productId: string; reason: string }) =>
      input.type === 'takedown' ? takedownProduct(input.productId, input.reason) : restoreProduct(input.productId, input.reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] });
      queryClient.invalidateQueries({ queryKey: adminProductDetailQueryKey(variables.productId) });
      setPendingAction(null);
      setReason('');
      toast.success(t(`moderation.${variables.type}Success`));
    },
    onError: (err) => toast.error(formatAdminError(t, err)),
  });

  return (
    <div className="adPage">
      <header className="adHead">
        <h1 className="adTitle">{t('moderation.title')}</h1>
        <p className="adSub">{t('moderation.subtitle')}</p>
      </header>

      <div className="adPills adPills--bar" role="radiogroup" aria-label={t('moderation.columnStatus')}>
        {FILTERS.map((value) => (
          <button key={value} type="button" role="radio" aria-checked={statusFilter === value}
            className="adPill" onClick={() => setStatusFilter(value)}>
            {value === 'ALL' ? t('moderation.statusAll') : t(`moderation.status.${value}`)}
          </button>
        ))}
      </div>

      {isPending && <SkeletonLoader rows={5} />}
      {isError && (
        <Alert type="error" showIcon message={formatAdminError(t, error)}
          action={<Button size="small" shape="round" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      )}
      {!isPending && !isError && items.length === 0 && (
        <div className="adEmpty">
          <span className="adEmptyIcon" aria-hidden="true"><Package size={22} /></span>
          <p>{t('moderation.empty')}</p>
        </div>
      )}
      {!isPending && !isError && items.length > 0 && (
        <>
          <ul className="adRows" key={statusFilter}>
            {items.map((item, index) => (
              <li key={item.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                <button type="button" className="adRow adRow--product" onClick={() => setSelectedProductId(item.id)}>
                  <span className="adMark" data-status={item.status} aria-hidden="true">
                    {item.status === 'REMOVED' ? <EyeOff size={16} /> : <Package size={16} />}
                  </span>
                  <span className="adRowMain">
                    <span className="adRowName" dir="auto">{item.titleEn}</span>
                    <span className="adRowMeta" dir="auto">{item.storeName}</span>
                  </span>
                  <span className="adRowStatus">
                    <StatusTag variant={PRODUCT_STATUS_VARIANT[item.status] ?? 'neutral'} label={t(`moderation.status.${item.status}`)} />
                  </span>
                  <span className="adRowDate">{t('moderation.added', { date: new Date(item.createdAt).toLocaleDateString() })}</span>
                  <ChevronRight size={16} className="adChevron" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <div className="adMore">
              <Button shape="round" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('moderation.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      <Drawer open={!!selectedProductId} onClose={() => setSelectedProductId(null)} title={t('moderation.drawerTitle')}
        width={440} className="adDrawer">
        {detail.isPending && <SkeletonLoader rows={5} />}
        {detail.isError && <Alert type="error" showIcon message={formatAdminError(t, detail.error)} />}
        {product && (
          <div className="adDetail">
            <div className="adProductHead" data-status={product.status}>
              <ProductThumbnail src={photo} size={88} radius="md" />
              <div className="adDetailWho">
                <p className="adDetailName" dir="auto">{product.titleEn}</p>
                {product.titleUr && <p className="adDetailAlt" dir="rtl">{product.titleUr}</p>}
                <div className="adDetailTags">
                  <StatusTag variant={PRODUCT_STATUS_VARIANT[product.status] ?? 'neutral'} label={t(`moderation.status.${product.status}`)} />
                </div>
              </div>
            </div>
            {product.status === 'REMOVED' && (
              <p className="adNote"><EyeOff size={15} aria-hidden="true" /> {t('moderation.removedNote')}</p>
            )}

            <section className="adFacts">
              <dl>
                <div><dt>{t('moderation.columnStore')}</dt><dd dir="auto">{product.storeName}</dd></div>
                <div><dt>{t('moderation.price')}</dt><dd><PriceDisplay amount={product.price} size="sm" /></dd></div>
                <div><dt>{t('moderation.stock')}</dt><dd data-hot={product.stock === 0 || undefined}>{t('moderation.inStock', { count: product.stock })}</dd></div>
                <div><dt>{t('moderation.columnCreatedAt')}</dt><dd>{new Date(product.createdAt).toLocaleDateString()}</dd></div>
              </dl>
            </section>

            {product.descriptionEn && (
              <section className="adFacts">
                <h3>{t('moderation.description')}</h3>
                <p className="adDesc" dir="auto">{product.descriptionEn}</p>
              </section>
            )}

            {product.status === 'LIVE' && (
              <Link to={`/product/${product.id}`} target="_blank" rel="noreferrer" className="adGhostLink">
                {t('moderation.viewOnStore')} <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            )}

            {isAdmin ? (
              <section className="adFacts">
                <h3>{t('moderation.sectionActions')}</h3>
                <div className="adActions">
                  {product.status !== 'REMOVED' ? (
                    <Button shape="round" danger icon={<Trash2 size={16} />}
                      onClick={() => setPendingAction({ type: 'takedown', productId: product.id })}>
                      {t('moderation.takedown')}
                    </Button>
                  ) : (
                    <Button shape="round" type="primary" icon={<RotateCcw size={16} />}
                      onClick={() => setPendingAction({ type: 'restore', productId: product.id })}>
                      {t('moderation.restore')}
                    </Button>
                  )}
                </div>
              </section>
            ) : (
              <p className="adNote"><Info size={15} aria-hidden="true" /> {t('moderation.readOnlyNote')}</p>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={!!pendingAction}
        title={pendingAction ? t(`moderation.${pendingAction.type}ConfirmTitle`) : ''}
        onCancel={() => {
          setPendingAction(null);
          setReason('');
        }}
        onOk={() => pendingAction && actionMutation.mutate({ ...pendingAction, reason: reason.trim() })}
        confirmLoading={actionMutation.isPending}
        okButtonProps={{ danger: pendingAction?.type === 'takedown', disabled: !reason.trim() }}
      >
        <Input.TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('moderation.reasonRequired')}
          aria-label={t('moderation.reasonRequired')}
          maxLength={500}
          rows={3}
        />
      </Modal>
    </div>
  );
}
