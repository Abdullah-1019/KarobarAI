import Redis from 'ioredis';

import { config } from '../config';

// Shared ioredis client (cache + BullMQ backend, TRD §5.1/§19). Connected lazily; no keys used yet.
export const redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
