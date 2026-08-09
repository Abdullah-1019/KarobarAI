import { useState } from 'react';
import { Alert, Button, Drawer, Empty, Segmented, Space, Table, Typography, Input } from 'antd';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { AdminProductListItemDTO } from '@karobarai/shared';
import { Modal, SkeletonLoader, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
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

// SCR-AD05 — moderation queue across every seller, filterable by status. No `reported`/flagged
// filter is exposed — the module doc's own confirmed gap: no product-reporting mechanism exists
// anywhere in this codebase (no table, no buyer-facing "report" action), so this is deliberately
// all-products-filterable-by-status only, not a queue of complaints.
export function ProductModerationPage() {
  const { t } = useTranslation(['admin']);
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');

  const params: AdminModerationParams = { status: statusFilter === 'ALL' ? undefined : statusFilter };

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
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

  const columns = [
    { title: t('moderation.columnTitle'), dataIndex: 'titleEn', key: 'titleEn' },
    { title: t('moderation.columnStore'), dataIndex: 'storeName', key: 'storeName' },
    { title: t('moderation.columnStatus'), dataIndex: 'status', key: 'status', render: (s: string) => t(`moderation.status.${s}`) },
    {
      title: t('moderation.columnCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, record: AdminProductListItemDTO) => (
        <Button size="small" onClick={() => setSelectedProductId(record.id)}>
          {t('moderation.view')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('moderation.title')}</Typography.Title>

      <Segmented
        style={{ marginBottom: 16 }}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as StatusFilter)}
        options={[
          { label: t('moderation.statusAll'), value: 'ALL' },
          { label: t('moderation.status.DRAFT'), value: 'DRAFT' },
          { label: t('moderation.status.LIVE'), value: 'LIVE' },
          { label: t('moderation.status.OUT_OF_STOCK'), value: 'OUT_OF_STOCK' },
          { label: t('moderation.status.REMOVED'), value: 'REMOVED' },
        ]}
      />

      {isPending && <SkeletonLoader rows={4} />}
      {isError && <Alert type="error" showIcon message={formatAdminError(t, error)} />}
      {!isPending && !isError && items.length === 0 && <Empty description={t('moderation.empty')} />}
      {!isPending && !isError && items.length > 0 && (
        <>
          <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" />
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('moderation.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      <Drawer open={!!selectedProductId} onClose={() => setSelectedProductId(null)} title={t('moderation.drawerTitle')} width={420}>
        {detail.isPending && <SkeletonLoader rows={5} />}
        {detail.isError && <Alert type="error" showIcon message={formatAdminError(t, detail.error)} />}
        {detail.isSuccess && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Typography.Text type="secondary">{t('moderation.columnTitle')}</Typography.Text>
              <div>{detail.data.titleEn}</div>
              {detail.data.titleUr && <div dir="rtl">{detail.data.titleUr}</div>}
            </div>
            <div>
              <Typography.Text type="secondary">{t('moderation.columnStore')}</Typography.Text>
              <div>{detail.data.storeName}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('moderation.columnStatus')}</Typography.Text>
              <div>{t(`moderation.status.${detail.data.status}`)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('moderation.price')}</Typography.Text>
              <div>Rs. {Number(detail.data.price).toLocaleString()}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('moderation.stock')}</Typography.Text>
              <div>{detail.data.stock}</div>
            </div>
            {detail.data.descriptionEn && (
              <div>
                <Typography.Text type="secondary">{t('moderation.description')}</Typography.Text>
                <div>{detail.data.descriptionEn}</div>
              </div>
            )}

            {isAdmin ? (
              <Space style={{ marginTop: 16 }}>
                {detail.data.status !== 'REMOVED' ? (
                  <Button danger onClick={() => setPendingAction({ type: 'takedown', productId: detail.data.id })}>
                    {t('moderation.takedown')}
                  </Button>
                ) : (
                  <Button type="primary" onClick={() => setPendingAction({ type: 'restore', productId: detail.data.id })}>
                    {t('moderation.restore')}
                  </Button>
                )}
              </Space>
            ) : (
              <Alert style={{ marginTop: 16 }} type="info" message={t('supportReadOnly')} />
            )}
          </Space>
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
          maxLength={500}
          rows={3}
        />
      </Modal>
    </div>
  );
}
