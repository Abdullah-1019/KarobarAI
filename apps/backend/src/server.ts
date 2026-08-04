import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { config } from './core/config';
import { errorHandler } from './core/middleware/errorHandler';
import { logger } from './core/logger';
import { initSocketServer } from './core/socket';
import { swaggerSpec } from './core/swagger';
import { addressRouter } from './modules/address';
import { authRouter } from './modules/auth';
import { cartRouter } from './modules/cart';
import { publicCatalogRouter, sellerProductRouter } from './modules/catalog';
import { healthRouter } from './modules/health/health.routes';
import { notificationRouter, startNotificationConsumer } from './modules/notification';
import { checkoutRouter, orderRouter, sellerOrderRouter } from './modules/order';
import { profileRouter } from './modules/profile';
import { adminReturnsRouter, returnsRouter, sellerReturnsRouter } from './modules/returns';
import {
  authenticatedTrackingRouter,
  courierRouter,
  publicTrackingRouter,
  startCourierAssignmentConsumer,
  startTrackingPollJob,
} from './modules/tracking';

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
app.use('/api/v1/profile', profileRouter);
app.use('/api/v1', publicCatalogRouter);
app.use('/api/v1/seller/products', sellerProductRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/addresses', addressRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/orders', courierRouter);
app.use('/api/v1/seller/orders', sellerOrderRouter);
app.use('/api/v1/tracking', authenticatedTrackingRouter);
app.use('/api/v1/t', publicTrackingRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/returns', returnsRouter);
app.use('/api/v1/seller/returns', sellerReturnsRouter);
app.use('/api/v1/admin/returns', adminReturnsRouter);

// Swagger UI (TRD §9) serves an inline <script> bundle — the global helmet() CSP above would
// block it, so this path gets its own relaxed CSP rather than weakening it everywhere.
app.use('/api-docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);

// http.createServer(app) instead of app.listen() directly — Socket.IO (Feature 8's /tracking
// gateway) needs the raw http.Server to attach its upgrade handler to. initSocketServer() is
// called unconditionally (not inside the require.main guard below) so tests importing `app`
// still get a working, emit-capable Socket.IO instance (harmless no-op with zero connections);
// only the actual `.listen()` call — and the BullMQ worker/poll-job bootstrap — are guarded to
// real process startup.
export const httpServer = http.createServer(app);
initSocketServer(httpServer);

if (require.main === module) {
  httpServer.listen(config.port, () => {
    logger.info(`api listening on :${config.port} (adapterMode=${config.adapterMode})`);
  });
  startCourierAssignmentConsumer();
  startTrackingPollJob().catch((err) => logger.error({ err }, 'failed to start tracking poll job'));
  startNotificationConsumer();
}
