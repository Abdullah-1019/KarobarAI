import { useState } from 'react';
import { Alert, Button, Drawer, Input, Select } from 'antd';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ChevronRight, Info, PauseCircle, PlayCircle, Search, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AdminUserListItemDTO, UserStatus } from '@karobarai/shared';
import { Modal, SkeletonLoader, StatusTag, type StatusVariant, toast } from '../../components';
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
// screen uses admin:userDetail.status.* labels (plain "Suspended"), not StatusChip's
// profile:status.* wording written for the account owner, so it renders StatusTag directly.
const USER_STATUS_VARIANT: Record<UserStatus, StatusVariant> = {
  PENDING_VERIFICATION: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'error',
  BANNED: 'error',
  DEACTIVATED: 'neutral',
};
const ROLES = ['BUYER', 'SELLER', 'ADMIN', 'SUPPORT'] as const;
const STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED'] as const;

type PendingAction = { type: 'suspend' | 'ban' | 'reactivate'; userId: string } | null;

/** The account's readable name: store, then email, then phone. Never the internal id. */
function primaryName(user: Pick<AdminUserListItemDTO, 'storeName' | 'email' | 'phone'>) {
  return user.storeName ?? user.email ?? user.phone ?? null;
}

// SCR-AD02 — searchable/filterable user list + detail drawer with suspend/ban/reactivate, at
// compact admin density. Search is blind-index EXACT match only (phone or email, whole value) —
// the backend's documented limitation (no partial search over encrypted PII), so the toolbar says
// so. Rows open the drawer; actions stay Admin-only, Support sees a read-only note.
export function UserManagementPage() {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [role, setRole] = useState<AdminUserSearchParams['role']>();
  const [status, setStatus] = useState<AdminUserSearchParams['status']>();
  const [search, setSearch] = useState<string>();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');

  const params: AdminUserSearchParams = { role, status, search };

  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
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

  const isPlaceholder = reason.trim().length === 0 && pendingAction?.type !== 'reactivate';
  const user = detail.data;
  const userName = user ? primaryName(user) : null;

  return (
    <div className="adPage">
      <header className="adHead">
        <h1 className="adTitle">{t('userDetail.title')}</h1>
        <p className="adSub">{t('userDetail.subtitle')}</p>
      </header>

      <section className="adToolbar">
        <div className="adSearch">
          <Input.Search
            placeholder={t('userDetail.searchPlaceholder')}
            allowClear
            prefix={<Search size={15} aria-hidden="true" />}
            aria-describedby="ad-search-hint"
            onSearch={(value) => setSearch(value.trim() || undefined)}
          />
          <p className="adHint" id="ad-search-hint">{t('userDetail.searchHint')}</p>
        </div>
        <div className="adFilters">
          <div className="adPills" role="radiogroup" aria-label={t('userDetail.filterRole')}>
            {[undefined, ...ROLES].map((value) => (
              <button key={value ?? 'all'} type="button" role="radio" aria-checked={role === value}
                className="adPill" onClick={() => setRole(value)}>
                {value ? t(`userDetail.role.${value}`) : t('userDetail.allRoles')}
              </button>
            ))}
          </div>
          <Select
            allowClear
            className="adStatusSelect"
            placeholder={t('userDetail.allStatuses')}
            aria-label={t('userDetail.filterStatus')}
            value={status}
            onChange={setStatus}
            options={STATUSES.map((s) => ({ label: t(`userDetail.status.${s}`), value: s }))}
          />
        </div>
      </section>

      {isPending && <SkeletonLoader rows={5} />}
      {isError && (
        <Alert type="error" showIcon message={formatAdminError(t, error)}
          action={<Button size="small" shape="round" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      )}
      {!isPending && !isError && items.length === 0 && (
        <div className="adEmpty">
          <span className="adEmptyIcon" aria-hidden="true"><UserRound size={22} /></span>
          <p>{t('userDetail.empty')}</p>
        </div>
      )}
      {!isPending && !isError && items.length > 0 && (
        <>
          <ul className="adRows">
            {items.map((item, index) => {
              const name = primaryName(item);
              const secondary = [item.storeName ? item.email : null, item.phone && name !== item.phone ? item.phone : null]
                .filter(Boolean).join(' · ');
              return (
                <li key={item.id} style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                  <button type="button" className="adRow" onClick={() => setSelectedUserId(item.id)}>
                    <span className="adAvatar" data-role={item.role} aria-hidden="true">
                      {(name ?? t(`userDetail.role.${item.role}`)).charAt(0).toUpperCase()}
                    </span>
                    <span className="adRowMain">
                      <span className="adRowName" dir="auto">{name ?? t('userDetail.noContact')}</span>
                      {secondary && <span className="adRowMeta" dir="ltr">{secondary}</span>}
                    </span>
                    <span className="adRoleTag" data-role={item.role}>{t(`userDetail.role.${item.role}`)}</span>
                    <span className="adRowStatus">
                      <StatusTag variant={USER_STATUS_VARIANT[item.status as UserStatus]} label={t(`userDetail.status.${item.status}`)} />
                    </span>
                    <span className="adRowDate">{t('userDetail.joined', { date: new Date(item.createdAt).toLocaleDateString() })}</span>
                    <ChevronRight size={16} className="adChevron" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {hasNextPage && (
            <div className="adMore">
              <Button shape="round" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                {t('userDetail.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}

      <Drawer open={!!selectedUserId} onClose={() => setSelectedUserId(null)} title={t('userDetail.drawerTitle')}
        width={420} className="adDrawer">
        {detail.isPending && <SkeletonLoader rows={5} />}
        {detail.isError && <Alert type="error" showIcon message={formatAdminError(t, detail.error)} />}
        {user && (
          <div className="adDetail">
            <div className="adDetailHead">
              <span className="adAvatar adAvatar--lg" data-role={user.role} aria-hidden="true">
                {(userName ?? t(`userDetail.role.${user.role}`)).charAt(0).toUpperCase()}
              </span>
              <div className="adDetailWho">
                <p className="adDetailName" dir="auto">{userName ?? t('userDetail.noContact')}</p>
                <div className="adDetailTags">
                  <span className="adRoleTag" data-role={user.role}>{t(`userDetail.role.${user.role}`)}</span>
                  <StatusTag variant={USER_STATUS_VARIANT[user.status as UserStatus]} label={t(`userDetail.status.${user.status}`)} />
                </div>
              </div>
            </div>

            <section className="adFacts">
              <h3>{t('userDetail.sectionAccount')}</h3>
              <dl>
                {user.email && <div><dt>{t('userDetail.columnEmail')}</dt><dd dir="ltr">{user.email}</dd></div>}
                {user.phone && <div><dt>{t('userDetail.columnPhone')}</dt><dd dir="ltr">{user.phone}</dd></div>}
                <div><dt>{t('userDetail.columnCreatedAt')}</dt><dd>{new Date(user.createdAt).toLocaleDateString()}</dd></div>
                <div>
                  <dt>{t('userDetail.lastLoginAt')}</dt>
                  <dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : t('userDetail.never')}</dd>
                </div>
              </dl>
            </section>

            {(user.storeName || user.fraudRate30d !== null || user.commissionRate !== null) && (
              <section className="adFacts">
                <h3>{t('userDetail.sectionSeller')}</h3>
                <dl>
                  {user.storeName && <div><dt>{t('userDetail.storeName')}</dt><dd dir="auto">{user.storeName}</dd></div>}
                  {user.fraudRate30d !== null && (
                    <div><dt>{t('userDetail.fraudRate')}</dt><dd data-hot={user.fraudRate30d > 0 || undefined}>{user.fraudRate30d.toFixed(1)}%</dd></div>
                  )}
                  {user.commissionRate !== null && (
                    <div><dt>{t('userDetail.commissionRate')}</dt><dd>{(Number(user.commissionRate) * 100).toFixed(1)}%</dd></div>
                  )}
                </dl>
              </section>
            )}

            {user.addressCount !== null && (
              <section className="adFacts">
                <h3>{t('userDetail.sectionBuyer')}</h3>
                <dl>
                  <div><dt>{t('userDetail.addressCount')}</dt><dd>{user.addressCount}</dd></div>
                </dl>
              </section>
            )}

            {isAdmin ? (
              <section className="adFacts">
                <h3>{t('userDetail.sectionActions')}</h3>
                <div className="adActions">
                  {user.status !== 'SUSPENDED' && user.status !== 'BANNED' && (
                    <Button shape="round" icon={<PauseCircle size={16} />}
                      onClick={() => setPendingAction({ type: 'suspend', userId: user.id })}>
                      {t('userDetail.suspend')}
                    </Button>
                  )}
                  {user.status !== 'BANNED' && (
                    <Button shape="round" danger icon={<Ban size={16} />}
                      onClick={() => setPendingAction({ type: 'ban', userId: user.id })}>
                      {t('userDetail.ban')}
                    </Button>
                  )}
                  {(user.status === 'SUSPENDED' || user.status === 'BANNED') && (
                    <Button shape="round" type="primary" icon={<PlayCircle size={16} />}
                      onClick={() => setPendingAction({ type: 'reactivate', userId: user.id })}>
                      {t('userDetail.reactivate')}
                    </Button>
                  )}
                </div>
              </section>
            ) : (
              <p className="adNote"><Info size={15} aria-hidden="true" /> {t('userDetail.readOnlyNote')}</p>
            )}
          </div>
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
          aria-label={pendingAction?.type === 'reactivate' ? t('userDetail.reasonOptional') : t('userDetail.reasonRequired')}
          maxLength={500}
          rows={3}
        />
      </Modal>
    </div>
  );
}
