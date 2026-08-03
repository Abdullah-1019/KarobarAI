import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from '../config';

// TRD §9's /tracking namespace (order_status_update, tracking_location_update). The Feature 8
// module doc's Pre-Generation Reuse Review claims this gateway already exists from "Feature 0/2
// architecture phase" — it didn't: socket.io was an installed dependency with zero wiring
// anywhere in this codebase. Built now, minimal: one namespace, clients join a per-order room
// (`order:<orderId>`) so a viewer only receives updates for the order they opened.
let io: SocketIOServer | undefined;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  if (!io) {
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.corsAllowedOrigins.length > 0 ? config.corsAllowedOrigins : false,
        credentials: true,
      },
    });
    io.of('/tracking').on('connection', (socket) => {
      socket.on('subscribe', (orderId: string) => {
        socket.join(`order:${orderId}`);
      });
    });
  }
  return io;
}

function getTrackingNamespace() {
  if (!io) throw new Error('Socket.IO server not initialized — call initSocketServer() first');
  return io.of('/tracking');
}

export function emitTrackingUpdate(
  orderId: string,
  event: 'order_status_update' | 'tracking_location_update',
  payload: unknown,
): void {
  getTrackingNamespace()
    .to(`order:${orderId}`)
    .emit(event, payload);
}
