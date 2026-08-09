import { useState } from 'react';
import { Alert, Button, Drawer, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { AdminUserListItemDTO } from '@karobarai/shared';
import { Modal, SkeletonLoader, toast } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import {
  adminUserDetailQueryKey,
  adminUsersQueryKey,
  banUser,
  getAdminUserDetail,
  listAdminUsers,
  reactivateUser,
  suspendUser,
  type AdminUserSearchParams,
} from './adminApi';
import { formatAdminError } from './adminErrors';

const STATUS_COLOR: Record<string, string> = {
  PENDING_VERIFICATION: 'default',
  ACTIVE: 'green',
  SUSPENDED: 'gold',
  BANNED: 'red',
  DEACTIVATED: 'default',
};

type PendingAction = { type: 'suspend' | 'ban' | 'reactivate'; userId: string } | null;

// SCR-AD02 — searchable/filterable user table + detail drawer with suspend/ban/reactivate.
// Search is blind-index EXACT match only (phone or email, whole value) — the backend's own
// documented limitation, not something this UI can work around (no fuzzy/partial search over
// encrypted PII is possible, per F12-admin-panel-backend.md).
export function UserManagementPage() {
  const { t } = useTranslation(['admin']);
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [role, setRole] = useState<AdminUserSearchParams['role']>();
  const [status, setStatus] = useState<AdminUserSearchParams['status']>();
  const [search, setSearch] = useState<string>();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');

  const params: AdminUserSearchParams = { role, status, search };

  const { data, isPending, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: adminUsersQueryKey(params),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => listAdminUsers(params, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const detail = useQuery({
    queryKey: adminUserDetailQueryKey(selectedUserId ?? ''),
    queryFn: () => getAdminUserDetail(selectedUserId ?? ''),
    enabled: !!selectedUserId,
  });

  const actionMutation = useMutation({
    mutationFn: (input: { type: 'suspend' | 'ban' | 'reactivate'; userId: string; reason: string }) => {
      if (input.type === 'suspend') return suspendUser(input.userId, input.reason);
      if (input.type === 'ban') return banUser(input.userId, input.reason);
      return reactivateUser(input.userId, input.reason || undefined);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: adminUserDetailQueryKey(variables.userId) });
      setPendingAction(null);
      setReason('');
      toast.success(t(`userDetail.${variables.type}Success`));
    },
    onError: (err) => toast.error(formatAdminError(t, err)),
  });

  const columns = [
    { title: t('userDetail.columnRole'), dataIndex: 'role', key: 'role', render: (r: string) => t(`userDetail.role.${r}`) },
    {
      title: t('userDetail.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{t(`userDetail.status.${s}`)}</Tag>,
    },
    { title: t('userDetail.columnEmail'), dataIndex: 'email', key: 'email', render: (v: string | null) => v ?? '—' },
    { title: t('userDetail.columnPhone'), dataIndex: 'phone', key: 'phone', render: (v: string | null) => v ?? '—' },
    { title: t('userDetail.columnStore'), dataIndex: 'storeName', key: 'storeName', render: (v: string | null) => v ?? '—' },
    {
      title: t('userDetail.columnCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, record: AdminUserListItemDTO) => (
        <Button size="small" onClick={() => setSelectedUserId(record.id)}>
          {t('userDetail.view')}
        </Button>
      ),
    },
  ];

  const isPlaceholder = reason.trim().length === 0 && pendingAction?.type !== 'reactivate';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('userDetail.title')}</Typography.Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder={t('userDetail.filterRole')}
          style={{ width: 160 }}
          value={role}
          onChange={setRole}
          options={['BUYER', 'SELLER', 'ADMIN', 'SUPPORT'].map((r) => ({ label: t(`userDetail.role.${r}`), value: r }))}
        />
        <Select
          allowClear
          placeholder={t('userDetail.filterStatus')}
          style={{ width: 180 }}
          value={status}
          onChange={setStatus}
          options={['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED'].map((s) => ({
            label: t(`userDetail.status.${s}`),
            value: s,
          }))}
        />
        <Input.Search
          placeholder={t('userDetail.searchPlaceholder')}
          style={{ width: 260 }}
          allowClear
          onSearch={(value) => setSearch(value || undefined)}
        />
      </Space>

      {isPending && <SkeletonLoader rows={4} />}
      {isError && <Alert type="error" showIcon message={formatAdminError(t, error)} />}
      {!isPending && !isError && items.length === 0 && <Empty description={t('userDetail.empty')} />}
      {!isPending && !isError && items.length > 0 && (
        <>
          <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" />
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('userDetail.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      <Drawer open={!!selectedUserId} onClose={() => setSelectedUserId(null)} title={t('userDetail.drawerTitle')} width={420}>
        {detail.isPending && <SkeletonLoader rows={5} />}
        {detail.isError && <Alert type="error" showIcon message={formatAdminError(t, detail.error)} />}
        {detail.isSuccess && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Typography.Text type="secondary">{t('userDetail.columnRole')}</Typography.Text>
              <div>{t(`userDetail.role.${detail.data.role}`)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('userDetail.columnStatus')}</Typography.Text>
              <div>
                <Tag color={STATUS_COLOR[detail.data.status]}>{t(`userDetail.status.${detail.data.status}`)}</Tag>
              </div>
            </div>
            {detail.data.email && (
              <div>
                <Typography.Text type="secondary">{t('userDetail.columnEmail')}</Typography.Text>
                <div>{detail.data.email}</div>
              </div>
            )}
            {detail.data.phone && (
              <div>
                <Typography.Text type="secondary">{t('userDetail.columnPhone')}</Typography.Text>
                <div>{detail.data.phone}</div>
              </div>
            )}
            {detail.data.storeName && (
              <div>
                <Typography.Text type="secondary">{t('userDetail.storeName')}</Typography.Text>
                <div>{detail.data.storeName}</div>
              </div>
            )}
            {detail.data.fraudRate30d !== null && (
              <div>
                <Typography.Text type="secondary">{t('userDetail.fraudRate')}</Typography.Text>
                <div>{detail.data.fraudRate30d.toFixed(1)}%</div>
              </div>
            )}
            {detail.data.commissionRate !== null && (
              <div>
                <Typography.Text type="secondary">{t('userDetail.commissionRate')}</Typography.Text>
                <div>{(Number(detail.data.commissionRate) * 100).toFixed(1)}%</div>
              </div>
            )}
            {detail.data.addressCount !== null && (
              <div>
                <Typography.Text type="secondary">{t('userDetail.addressCount')}</Typography.Text>
                <div>{detail.data.addressCount}</div>
              </div>
            )}
            <div>
              <Typography.Text type="secondary">{t('userDetail.lastLoginAt')}</Typography.Text>
              <div>{detail.data.lastLoginAt ? new Date(detail.data.lastLoginAt).toLocaleString() : t('userDetail.never')}</div>
            </div>

            {isAdmin ? (
              <Space style={{ marginTop: 16 }} wrap>
                {detail.data.status !== 'SUSPENDED' && detail.data.status !== 'BANNED' && (
                  <Button onClick={() => setPendingAction({ type: 'suspend', userId: detail.data.id })}>
                    {t('userDetail.suspend')}
                  </Button>
                )}
                {detail.data.status !== 'BANNED' && (
                  <Button danger onClick={() => setPendingAction({ type: 'ban', userId: detail.data.id })}>
                    {t('userDetail.ban')}
                  </Button>
                )}
                {(detail.data.status === 'SUSPENDED' || detail.data.status === 'BANNED') && (
                  <Button type="primary" onClick={() => setPendingAction({ type: 'reactivate', userId: detail.data.id })}>
                    {t('userDetail.reactivate')}
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
        title={pendingAction ? t(`userDetail.${pendingAction.type}ConfirmTitle`) : ''}
        onCancel={() => {
          setPendingAction(null);
          setReason('');
        }}
        onOk={() => pendingAction && actionMutation.mutate({ ...pendingAction, reason: reason.trim() })}
        confirmLoading={actionMutation.isPending}
        okButtonProps={{ danger: pendingAction?.type === 'ban', disabled: isPlaceholder }}
      >
        <Input.TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={pendingAction?.type === 'reactivate' ? t('userDetail.reasonOptional') : t('userDetail.reasonRequired')}
          maxLength={500}
          rows={3}
        />
      </Modal>
    </div>
  );
}
