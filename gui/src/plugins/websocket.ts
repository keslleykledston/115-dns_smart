import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { WsMessage, WsMessageType } from '../shared/types/dns.js';

declare module 'fastify' {
  interface FastifyInstance {
    broadcast: (type: WsMessageType, data: any) => void;
  }
}

export default fp(async function (fastify: FastifyInstance) {
  // Register the standard Fastify WebSocket plugin
  await fastify.register(websocket);

  const clients = new Set<WebSocket>();

  // Decorate fastify with a broadast utility
  fastify.decorate('broadcast', function (type: WsMessageType, data: any) {
    const payload = JSON.stringify({
      type,
      data,
      timestamp: Date.now()
    } as WsMessage);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });

  // Heartbeat helper: Pings clients every 30 seconds to clean dead connections
  const interval = setInterval(() => {
    for (const client of clients) {
      if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
        clients.delete(client);
        continue;
      }
      
      // Send standard WebSocket ping frame
      client.ping();
    }
  }, 30000);

  fastify.addHook('onClose', async () => {
    clearInterval(interval);
    for (const client of clients) {
      client.terminate();
    }
    clients.clear();
  });

  // WebSocket Route registration
  fastify.route({
    method: 'GET',
    url: '/ws',
    handler: (req, reply) => {
      reply.code(400).send({ error: 'Upgrade required for WebSocket connection' });
    },
    wsHandler: (conn: any, req) => {
      const socket = conn.socket;
      clients.add(socket);
      fastify.log.info(`WebSocket Client connected. Total active: ${clients.size}`);

      // Handle close
      socket.on('close', () => {
        clients.delete(socket);
        fastify.log.info(`WebSocket Client disconnected. Total active: ${clients.size}`);
      });

      // Handle errors
      socket.on('error', (err: Error) => {
        clients.delete(socket);
        fastify.log.error(err, 'WebSocket Error');
      });
    }
  });
});
