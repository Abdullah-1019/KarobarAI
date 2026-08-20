import { useState } from 'react';
import { Alert, Button, Divider, Drawer, Input, Select, Space, Table, Typography } from 'antd';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { AdminUserListItemDTO, UserStatus } from '@karobarai/shared';
import { EmptyState, Modal, PageHeader, SkeletonLoader, StatusTag, type StatusVariant, toast } from '../../components';
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

// Mirrors components/StatusChip.tsx's variant mapping for the same UserStatus enum — but this
// screen uses admin:userDetail.status.* labels (e.g. plain "Suspended"), not StatusChip's
// profile:status.* wording ("Suspended — contact support", written for the account owner, not an
// admin reviewing someone else's account) — so it renders StatusTag directly with the correct
// label instead of reusing StatusChip verbatim.
const USER_STATUS_VARIANT: Record<UserStatus, StatusVariant> = {
  PENDING_VERIFICATION: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'error',
  BANNED: 'error',
  DEACTIVATED: 'neutral',
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
      render: (s: UserStatus) => <StatusTag variant={USER_STATUS_VARIANT[s]} label={t(`userDetail.status.${s}`)} />,
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
    <div>
      <PageHeader title={t('userDetail.title')} />

      <Space style={{ marginBottom: 'var(--sp-4)' }} wrap>
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
      {!isPending && !isError && items.length === 0 && <EmptyState title={t('userDetail.empty')} />}
      {!isPending && !isError && items.length > 0 && (
        <>
          <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="middle" scroll={{ x: true }} />
          {hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
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
            <Typography.Text strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              {t('userDetail.sectionAccount')}
            </Typography.Text>
            <div>
              <Typography.Text type="secondary">{t('userDetail.columnRole')}</Typography.Text>
              <div>{t(`userDetail.role.${detail.data.role}`)}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{t('userDetail.columnStatus')}</Typography.Text>
              <div>
                <StatusTag
                  variant={USER_STATUS_VARIANT[detail.data.status as UserStatus]}
                  label={t(`userDetail.status.${detail.data.status}`)}
                />
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

            {(detail.data.storeName || detail.data.fraudRate30d !== null || detail.data.commissionRate !== null) && (
              <>
                <Divider style={{ margin: 'var(--sp-1) 0' }} />
                <Typography.Text strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                  {t('userDetail.sectionSeller')}
                </Typography.Text>
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
              </>
            )}

            {detail.data.addressCount !== null && (
              <>
                <Divider style={{ margin: 'var(--sp-1) 0' }} />
                <Typography.Text strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                  {t('userDetail.sectionBuyer')}
                </Typography.Text>
                <div>
                  <Typography.Text type="secondary">{t('userDetail.addressCount')}</Typography.Text>
                  <div>{detail.data.addressCount}</div>
                </div>
              </>
            )}

            <Divider style={{ margin: 'var(--sp-1) 0' }} />
            <Typography.Text strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              {t('userDetail.sectionActivity')}
            </Typography.Text>
            <div>
              <Typography.Text type="secondary">{t('userDetail.lastLoginAt')}</Typography.Text>
              <div>{detail.data.lastLoginAt ? new Date(detail.data.lastLoginAt).toLocaleString() : t('userDetail.never')}</div>
            </div>

            {isAdmin ? (
              <>
                <Divider style={{ margin: 'var(--sp-1) 0' }} />
                <Typography.Text strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                  {t('userDetail.sectionActions')}
                </Typography.Text>
                <Space wrap>
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
              </>
            ) : (
              <Alert style={{ marginTop: 'var(--sp-4)' }} type="info" message={t('supportReadOnly')} />
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
