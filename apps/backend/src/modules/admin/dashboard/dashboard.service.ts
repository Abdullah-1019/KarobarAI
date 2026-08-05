import type { AdminAlertFeedDTO, AdminKpiDTO, DateRangeQueryInput } from '@karobarai/shared';

import { checkDependencies } from '../../../core/health/checkDependencies';
import { previousPeriod, resolveDateRange } from '../../analytics/analytics.dateRange';
import * as repo from './dashboard.repository';

// Task 2 — computed live, no caching layer (unlike Feature 11's seller-facing analytics): admin
// dashboard traffic is low-volume (a handful of Admin/Support accounts, not every seller), so the
// TTL-cache Engineering Decision that made sense for Feature 11 isn't needed here.

export async function getKpis(input: DateRangeQueryInput): Promise<AdminKpiDTO> {
  const range = resolveDateRange(input);
  const [current, previous, activeUsers, deps] = await Promise.all([
    repo.platformGmv(range),
    repo.platformGmv(previousPeriod(range)),
    repo.activeUsers(range),
    checkDependencies(),
  ]);

  const pctChangeVsPrevious = previous.isZero() ? null : current.minus(previous).dividedBy(previous).times(100).toNumber();
  // Instantaneous Postgres+Redis reachability snapshot — see dashboard.repository.ts's comment
  // and the handoff doc: no adapter-call counter infrastructure exists to compute a true rolling
  // uptime percentage over `range`, so this reflects "right now," not the selected period.
  const upCount = (deps.postgres ? 1 : 0) + (deps.redis ? 1 : 0);
  const adapterUptime = Math.round((upCount / 2) * 100);

  return { gmv: current.toFixed(2), activeUsers, adapterUptime, pctChangeVsPrevious };
}

export async function getAlertFeed(): Promise<AdminAlertFeedDTO> {
  return repo.alertCounts();
}
