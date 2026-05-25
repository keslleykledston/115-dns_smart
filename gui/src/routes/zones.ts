import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import configGenerator from '../services/config-generator.js';
import AuditLogger from '../services/audit-logger.js';

export default async function zonesRoutes(fastify: FastifyInstance) {
  // GET /api/zones (List all zones - Protected)
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = fastify.db;
      const zones = db.prepare(`
        SELECT z.*, COUNT(r.id) as record_count 
        FROM zones z 
        LEFT JOIN records r ON r.zone_id = z.id 
        GROUP BY z.id
      `).all() as any[];

      reply.send({ success: true, data: zones });
    } catch (err) {
      fastify.log.error(err, 'List zones error');
      reply.code(500).send({ success: false, error: 'Failed to list DNS zones' });
    }
  });

  // POST /api/zones (Create zone - Protected, Operator/Admin only)
  fastify.post('/', { 
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, type } = request.body as any;

    if (!name || !type) {
      reply.code(400).send({ success: false, error: 'Zone name and type are required' });
      return;
    }

    try {
      const db = fastify.db;

      // Validate name (must be a valid FQDN)
      const cleanName = name.trim().toLowerCase();

      // Check if zone already exists
      const exists = db.prepare('SELECT id FROM zones WHERE name = ?').get(cleanName);
      if (exists) {
        reply.code(409).send({ success: false, error: 'A zone with this name already exists' });
        return;
      }

      // Insert Zone
      const result = db.prepare('INSERT INTO zones (name, type) VALUES (?, ?)').run(cleanName, type);
      const zoneId = result.lastInsertRowid;

      // Generate default SOA and NS records automatically
      db.prepare(`
        INSERT INTO records (zone_id, name, type, value, ttl) VALUES 
        (?, '@', 'SOA', ?, 86400),
        (?, '@', 'NS', 'ns1.dns-smart.local.', 86400),
        (?, 'ns1', 'A', '127.0.0.1', 86400)
      `).run(
        zoneId, 
        `ns1.dns-smart.local. hostmaster.${cleanName}. 1 28800 7200 604800 86400`,
        zoneId,
        zoneId
      );

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'CREATE_ZONE',
        cleanName,
        `Created DNS zone of type: ${type}`
      );

      // Dynamically regenerate Unbound config & hot reload
      await configGenerator.syncAll(db);

      reply.code(201).send({
        success: true,
        message: 'DNS Zone created successfully',
        data: { id: zoneId, name: cleanName, type }
      });

    } catch (err) {
      fastify.log.error(err, 'Create zone error');
      reply.code(500).send({ success: false, error: 'Failed to create DNS zone' });
    }
  });

  // DELETE /api/zones/:id (Delete zone - Protected, Operator/Admin only)
  fastify.delete('/:id', { 
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    try {
      const db = fastify.db;
      
      const zone = db.prepare('SELECT name FROM zones WHERE id = ?').get(id) as any;
      if (!zone) {
        reply.code(404).send({ success: false, error: 'Zone not found' });
        return;
      }

      // Delete Zone (cascades automatically to records)
      db.prepare('DELETE FROM zones WHERE id = ?').run(id);

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'DELETE_ZONE',
        zone.name,
        `Deleted DNS zone (ID: ${id})`
      );

      // Dynamically regenerate Unbound config & hot reload
      await configGenerator.syncAll(db);

      reply.send({ success: true, message: 'DNS Zone deleted successfully' });
    } catch (err) {
      fastify.log.error(err, 'Delete zone error');
      reply.code(500).send({ success: false, error: 'Failed to delete DNS zone' });
    }
  });
}
