import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import configGenerator from '../services/config-generator.js';
import AuditLogger from '../services/audit-logger.js';

export default async function configRoutes(fastify: FastifyInstance) {
  // GET /api/config (Get all configurations - Protected)
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = fastify.db;
      const configs = db.prepare('SELECT * FROM config').all() as any[];
      
      const configMap: Record<string, string> = {};
      for (const c of configs) {
        configMap[c.key] = c.value;
      }

      reply.send({ success: true, data: configMap });
    } catch (err) {
      fastify.log.error(err, 'Fetch config error');
      reply.code(500).send({ success: false, error: 'Failed to load configurations' });
    }
  });

  // PUT /api/config (Update multiple configurations - Protected, Admin only)
  fastify.put('/', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const settings = request.body as Record<string, string>;

    if (!settings || typeof settings !== 'object') {
      reply.code(400).send({ success: false, error: 'Settings object is required' });
      return;
    }

    try {
      const db = fastify.db;

      // SQLite High-speed transaction to update multiple configs
      const updateConfig = db.prepare('INSERT OR REPLACE INTO config (key, value, category, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)');
      
      const transaction = db.transaction((updates: Record<string, string>) => {
        for (const [key, value] of Object.entries(updates)) {
          // Fetch existing category if available
          const existing = db.prepare('SELECT category FROM config WHERE key = ?').get(key) as any;
          const category = existing ? existing.category : 'general';
          updateConfig.run(key, String(value), category);
        }
      });

      transaction(settings);

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'UPDATE_CONFIG',
        'system',
        `Updated system configurations: ${Object.keys(settings).join(', ')}`
      );

      // Regenerate config & reload Unbound
      await configGenerator.syncAll(db);

      reply.send({ success: true, message: 'Configurations updated successfully' });

    } catch (err) {
      fastify.log.error(err, 'Update config error');
      reply.code(500).send({ success: false, error: 'Failed to update configurations' });
    }
  });
}
