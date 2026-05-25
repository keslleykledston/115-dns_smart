import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logMonitor from '../services/log-monitor.js';

export default async function logsRoutes(fastify: FastifyInstance) {
  // GET /api/logs (Paginated DNS query logs - Protected)
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = 1, limit = 50, search = '', type = '', rcode = '' } = request.query as any;

    try {
      const allLogs = logMonitor.getRecentLogs(1000); // Fetch last 1000 logs in memory

      const searchLower = search.trim().toLowerCase();
      const typeUpper = type.trim().toUpperCase();
      const rcodeUpper = rcode.trim().toUpperCase();

      // Apply Filters
      const filtered = allLogs.filter((entry) => {
        if (searchLower && !entry.domain.toLowerCase().includes(searchLower)) {
          return false;
        }
        if (typeUpper && entry.type !== typeUpper) {
          return false;
        }
        if (rcodeUpper && entry.responseCode !== rcodeUpper) {
          return false;
        }
        return true;
      });

      // Apply Pagination
      const parsedLimit = parseInt(limit);
      const parsedPage = parseInt(page);
      const startIndex = (parsedPage - 1) * parsedLimit;
      const paginated = filtered.slice(startIndex, startIndex + parsedLimit);

      reply.send({
        success: true,
        data: paginated,
        total: filtered.length,
        page: parsedPage,
        pageSize: parsedLimit,
      });

    } catch (err) {
      fastify.log.error(err, 'Fetch logs error');
      reply.code(500).send({ success: false, error: 'Failed to load query logs' });
    }
  });

  // DELETE /api/logs/clear (Clear in-memory buffer - Protected, Admin only)
  fastify.delete('/clear', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Trivial clear (empty array)
      (logMonitor as any).queryBuffer = [];
      reply.send({ success: true, message: 'Recent query logs buffer cleared' });
    } catch (err) {
      reply.code(500).send({ success: false, error: 'Failed to clear logs' });
    }
  });
}
