import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';

import { config } from './core/config';
import { errorHandler } from './core/middleware/errorHandler';
import { logger } from './core/logger';
import { authRouter } from './modules/auth';
import { healthRouter } from './modules/health/health.routes';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsAllowedOrigins.length > 0 ? config.corsAllowedOrigins : false,
    // Required for the refresh-token HttpOnly cookie (HO-F1-Auth.md) to work cross-origin —
    // without this, the browser silently drops Set-Cookie on the register/login/refresh
    // responses and axios's withCredentials requests are blocked by CORS entirely.
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id']?.toString() ?? randomUUID(),
  }),
);

app.use(healthRouter);
app.use('/api/v1/auth', authRouter);

app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`api listening on :${config.port} (adapterMode=${config.adapterMode})`);
  });
}
