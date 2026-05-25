import fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import staticPlugin from '@fastify/static';
import path from 'path';
import fileURLToPath from 'url';
import dotenv from 'dotenv';

// Import our plugins
import databasePlugin from './plugins/database.js';
import authPlugin from './plugins/auth.js';
import websocketPlugin from './plugins/websocket.js';

// Import routes
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import zonesRoutes from './routes/zones.js';
import recordsRoutes from './routes/records.js';
import forwardersRoutes from './routes/forwarders.js';
import blocklistRoutes from './routes/blocklist.js';
import logsRoutes from './routes/logs.js';
import configRoutes from './routes/config.js';

// Import services
import metricsService from './services/metrics-service.js';
import logMonitor from './services/log-monitor.js';
import configGenerator from './services/config-generator.js';

dotenv.config();

const __filename = fileURLToPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
    } : undefined
  }
});

async function main() {
  try {
    // 1. Register Core Plugins
    await app.register(cors);
    await app.register(formbody);
    
    // 2. Register Custom Plugins
    await app.register(databasePlugin);
    await app.register(authPlugin);
    await app.register(websocketPlugin);

    // 3. Register SPA Front-end static assets
    const publicPath = path.join(__dirname, '../public');
    app.register(staticPlugin, {
      root: publicPath,
      prefix: '/'
    });

    // 4. Register API Routes
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await app.register(zonesRoutes, { prefix: '/api/zones' });
    // Make sure records route maps correctly (resolved with .js extension for compiled files)
    await app.register(recordsRoutes, { prefix: '/api/zones' });
    await app.register(forwardersRoutes, { prefix: '/api/forwarders' });
    await app.register(blocklistRoutes, { prefix: '/api/blocklist' });
    await app.register(logsRoutes, { prefix: '/api/logs' });
    await app.register(configRoutes, { prefix: '/api/config' });

    // 5. Initial DNS Sync
    app.log.info('Running startup DNS Sync to generate Unbound configuration files...');
    await configGenerator.syncAll(app.db);

    // 6. Start Log Tail Monitor and pipe parsed entries to WebSockets
    logMonitor.start((type, data) => {
      app.broadcast(type as any, data);
    });

    // 7. Start Metrics DB flusher
    metricsService.startFlushTimer(app.db);

    // 8. Start real-time metrics WebSocket broadcast
    // Broadcast compiled metrics update every 2 seconds
    setInterval(async () => {
      try {
        const metrics = await metricsService.getRealtimeMetrics(app.db);
        app.broadcast('metrics_update', metrics);
      } catch (err) {
        app.log.error(err, 'WebSocket metrics broadcast error');
      }
    }, 2000);

    // 9. Start server
    const port = parseInt(process.env.GUI_PORT || '3000');
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`DNS Smart GUI Dashboard available on http://localhost:${port}`);

  } catch (err) {
    app.log.error(err, 'Server boot failed');
    process.exit(1);
  }
}

// Handle Graceful Shutdown
const shutdown = async () => {
  app.log.info('Received shutdown signal. Stopping services gracefully...');
  logMonitor.stop();
  
  // Final flush of active metrics to SQLite
  if (app.db) {
    metricsService.flushHourlyMetrics(app.db);
  }

  await app.close();
  app.log.info('DNS Smart GUI successfully closed.');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main();
