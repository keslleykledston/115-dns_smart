import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import metricsService from '../services/metrics-service.js';
import unboundClient from '../services/unbound-client.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // GET /api/dashboard/stats (Summary Cards - Protected)
  fastify.get('/stats', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: Reply) => {
    try {
      const db = fastify.db;
      
      // 1. Get running status from Unbound
      const statusText = await unboundClient.status();
      const isOnline = statusText.includes('running');

      // 2. Fetch basic system metadata
      const totalQueries = db.prepare('SELECT SUM(total_queries) as total FROM metrics_hourly').get() as any;
      const totalBlocked = db.prepare('SELECT SUM(blocked_queries) as total FROM metrics_hourly').get() as any;
      const totalHits = db.prepare('SELECT SUM(cache_hits) as total FROM metrics_hourly').get() as any;

      const liveMetrics = await metricsService.getRealtimeMetrics(db);

      // Accumulate metrics
      const aggregatedQueries = (totalQueries?.total || 0) + liveMetrics.totalQueries;
      const aggregatedBlocked = (totalBlocked?.total || 0) + liveMetrics.blockedQueries;
      const aggregatedHits = (totalHits?.total || 0) + (liveMetrics.totalQueries * (liveMetrics.cacheHitRate / 100));

      const blockPercentage = aggregatedQueries > 0 ? Math.round((aggregatedBlocked / aggregatedQueries) * 10000) / 100 : 0;
      const cacheHitRate = aggregatedQueries > 0 ? Math.round((aggregatedHits / aggregatedQueries) * 10000) / 100 : 0;

      reply.send({
        success: true,
        data: {
          totalQueries: aggregatedQueries,
          blockedQueries: aggregatedBlocked,
          blockPercentage,
          cacheHitRate,
          activeClients: liveMetrics.activeClients,
          uptime: process.uptime(),
          serverStatus: isOnline ? 'online' : 'offline',
          dnsWorkers: 2, // bound to our docker config
        }
      });
    } catch (err) {
      fastify.log.error(err, 'Stats error');
      reply.code(500).send({ success: false, error: 'Failed to fetch dashboard stats' });
    }
  });

  // GET /api/dashboard/realtime (JSON metrics snapshot - Protected)
  fastify.get('/realtime', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await metricsService.getRealtimeMetrics(fastify.db);
      reply.send({
        success: true,
        data: metrics
      });
    } catch (err) {
      fastify.log.error(err, 'Realtime metrics error');
      reply.code(500).send({ success: false, error: 'Failed to load real-time metrics' });
    }
  });

  // GET /api/dashboard/history (Hourly metrics for charts - Protected)
  fastify.get('/history', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get historical hourly logs for the last 24 entries
      const history = fastify.db.prepare(`
        SELECT * FROM metrics_hourly 
        ORDER BY timestamp DESC 
        LIMIT 24
      `).all() as any[];

      reply.send({
        success: true,
        data: history.reverse() // Send chronologically
      });
    } catch (err) {
      fastify.log.error(err, 'History metrics error');
      reply.code(500).send({ success: false, error: 'Failed to load metrics history' });
    }
  });
}

// Inline custom FastifyReply definition to satisfy TypeScript typing
type Reply = FastifyReply;
