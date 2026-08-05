import type { AdminConfigEntryDTO, AdminConfigListDTO } from '@karobarai/shared';
import type { Prisma } from '@prisma/client';

import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../../core/errors/AppError';
import { runAuditedMutation } from '../admin.mutation';
import * as repo from './config.repository';

// Task 6.5 — returns_confidence_threshold is R1.1-scoped (the ReturnsAI automation it drives
// isn't built yet): read-only in this MVP Admin Console, never in the writable set.
const WRITABLE_KEYS = ['commission_rate_default', 'courier_weights', 'return_window_days', 'min_order_value_pkr'] as const;
const ALL_KNOWN_KEYS = [...WRITABLE_KEYS, 'returns_confidence_threshold'];

function isWritable(key: string): boolean {
  return (WRITABLE_KEYS as readonly string[]).includes(key);
}

// Task 6.2 — ConfigValidationSchema per key. A business-rule check (courier weights summing to
// 1.0 across 4 fields), not a structural Zod shape check — throws BusinessRuleError directly so
// the envelope carries the specific 422 INVALID_CONFIG_VALUE code the module doc asks for,
// rather than the generic 400 VALIDATION_ERROR the shared validateBody pipeline always emits.
const COURIER_WEIGHT_KEYS = ['cost', 'time', 'reliability', 'coverage'] as const;
const COURIER_WEIGHT_SUM_TOLERANCE = 0.001;

function validateConfigValue(key: string, value: unknown): void {
  switch (key) {
    case 'commission_rate_default':
    case 'min_order_value_pkr': {
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || (key === 'commission_rate_default' && value > 1)) {
        throw new BusinessRuleError(`Invalid value for ${key}`, { key, value }, 'INVALID_CONFIG_VALUE');
      }
      return;
    }
    case 'return_window_days': {
      if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
        throw new BusinessRuleError('return_window_days must be a positive integer', { key, value }, 'INVALID_CONFIG_VALUE');
      }
      return;
    }
    case 'courier_weights': {
      if (typeof value !== 'object' || value === null) {
        throw new BusinessRuleError('courier_weights must be an object', { key, value }, 'INVALID_CONFIG_VALUE');
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length !== COURIER_WEIGHT_KEYS.length || !COURIER_WEIGHT_KEYS.every((k) => typeof obj[k] === 'number')) {
        throw new BusinessRuleError(
          `courier_weights must have exactly the fields: ${COURIER_WEIGHT_KEYS.join(', ')}`,
          { key, value },
          'INVALID_CONFIG_VALUE',
        );
      }
      const sum = COURIER_WEIGHT_KEYS.reduce((acc, k) => acc + (obj[k] as number), 0);
      if (Math.abs(sum - 1) > COURIER_WEIGHT_SUM_TOLERANCE) {
        throw new BusinessRuleError('courier_weights must sum to 1.0 (±0.001)', { key, sum }, 'INVALID_CONFIG_VALUE');
      }
      return;
    }
    default:
      // Unreachable for writable keys (guarded by isWritable before this is called), kept as a
      // defensive default rather than a silent no-op.
      throw new BusinessRuleError(`No validation rule defined for ${key}`, { key }, 'INVALID_CONFIG_VALUE');
  }
}

export async function getAllConfig(): Promise<AdminConfigListDTO> {
  const rows = await repo.getAll();
  const items: AdminConfigEntryDTO[] = rows.map((row) => ({
    key: row.configKey,
    value: row.value,
    description: row.description,
    writable: isWritable(row.configKey),
    updatedAt: row.updatedAt.toISOString(),
  }));
  return { items };
}

export async function updateConfig(actorId: bigint, key: string, value: unknown, reason: string): Promise<AdminConfigEntryDTO> {
  if (!ALL_KNOWN_KEYS.includes(key)) {
    throw new NotFoundError(`Unknown config key: ${key}`, undefined, 'CONFIG_KEY_NOT_FOUND');
  }
  if (!isWritable(key)) {
    throw new ForbiddenError(`${key} is not configurable in this MVP (read-only)`, undefined, 'CONFIG_KEY_NOT_WRITABLE');
  }
  validateConfigValue(key, value);

  const existing = await repo.getByKey(key);
  if (!existing) {
    throw new NotFoundError(`Unknown config key: ${key}`, undefined, 'CONFIG_KEY_NOT_FOUND');
  }

  await runAuditedMutation({
    actorId,
    action: 'CONFIG_CHANGE',
    entity: 'platform_config',
    entityId: null, // platform_config's PK (config_key) is a string, not the bigint audit_logs.entity_id expects
    reason,
    before: { key, value: existing.value },
    after: { key, value },
    mutate: (tx) => repo.updateValue(tx, key, value as Prisma.InputJsonValue, actorId),
  });

  return { key, value, description: existing.description, writable: true, updatedAt: new Date().toISOString() };
}
