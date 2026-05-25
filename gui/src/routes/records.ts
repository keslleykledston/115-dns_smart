import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import configGenerator from '../services/config-generator.js';
import AuditLogger from '../services/audit-logger.js';

export default async function recordsRoutes(fastify: FastifyInstance) {
  // GET /api/zones/:zoneId/records (List zone records - Protected)
  fastify.get('/:zoneId/records', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { zoneId } = request.params as any;

    try {
      const db = fastify.db;
      
      const zone = db.prepare('SELECT name FROM zones WHERE id = ?').get(zoneId);
      if (!zone) {
        reply.code(404).send({ success: false, error: 'Zone not found' });
        return;
      }

      const records = db.prepare('SELECT * FROM records WHERE zone_id = ?').all(zoneId) as any[];
      reply.send({ success: true, data: records });
    } catch (err) {
      fastify.log.error(err, 'List records error');
      reply.code(500).send({ success: false, error: 'Failed to list DNS records' });
    }
  });

  // POST /api/zones/:zoneId/records (Create record - Protected, Admin/Operator only)
  fastify.post('/:zoneId/records', { 
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { zoneId } = request.params as any;
    const { name, type, value, ttl, priority, weight, port } = request.body as any;

    if (!name || !type || !value) {
      reply.code(400).send({ success: false, error: 'Name, Type, and Value are required' });
      return;
    }

    try {
      const db = fastify.db;
      
      const zone = db.prepare('SELECT name FROM zones WHERE id = ?').get(zoneId) as any;
      if (!zone) {
        reply.code(404).send({ success: false, error: 'Zone not found' });
        return;
      }

      const cleanName = name.trim().toLowerCase();
      const cleanValue = value.trim();

      // Insert Record
      const result = db.prepare(`
        INSERT INTO records (zone_id, name, type, value, ttl, priority, weight, port)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        zoneId,
        cleanName,
        type,
        cleanValue,
        ttl || 3600,
        priority ?? null,
        weight ?? null,
        port ?? null
      );

      const recordId = result.lastInsertRowid;

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'CREATE_RECORD',
        `${cleanName}.${zone.name}`,
        `Created DNS record type: ${type}, value: ${cleanValue}`
      );

      // Regenerate config & reload Unbound
      await configGenerator.syncAll(db);

      reply.code(201).send({
        success: true,
        message: 'DNS Record created successfully',
        data: { id: recordId, name: cleanName, type, value: cleanValue }
      });

    } catch (err) {
      fastify.log.error(err, 'Create record error');
      reply.code(500).send({ success: false, error: 'Failed to create DNS record' });
    }
  });

  // PUT /api/zones/:zoneId/records/:id (Update record - Protected, Admin/Operator only)
  fastify.put('/:zoneId/records/:id', { 
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { zoneId, id } = request.params as any;
    const { name, value, ttl, priority, weight, port, enabled } = request.body as any;

    try {
      const db = fastify.db;
      
      const zone = db.prepare('SELECT name FROM zones WHERE id = ?').get(zoneId) as any;
      if (!zone) {
        reply.code(404).send({ success: false, error: 'Zone not found' });
        return;
      }

      const record = db.prepare('SELECT * FROM records WHERE id = ? AND zone_id = ?').get(id, zoneId) as any;
      if (!record) {
        reply.code(404).send({ success: false, error: 'DNS Record not found in this zone' });
        return;
      }

      const cleanName = name ? name.trim().toLowerCase() : record.name;
      const cleanValue = value ? value.trim() : record.value;
      const cleanTtl = ttl !== undefined ? ttl : record.ttl;
      const cleanPriority = priority !== undefined ? priority : record.priority;
      const cleanWeight = weight !== undefined ? weight : record.weight;
      const cleanPort = port !== undefined ? port : record.port;
      const cleanEnabled = enabled !== undefined ? (enabled ? 1 : 0) : record.enabled;

      // Update Record
      db.prepare(`
        UPDATE records 
        SET name = ?, value = ?, ttl = ?, priority = ?, weight = ?, port = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(cleanName, cleanValue, cleanTtl, cleanPriority, cleanWeight, cleanPort, cleanEnabled, id);

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'UPDATE_RECORD',
        `${cleanName}.${zone.name}`,
        `Updated DNS record ID: ${id}, enabled: ${cleanEnabled}`
      );

      // Regenerate config & reload Unbound
      await configGenerator.syncAll(db);

      reply.send({ success: true, message: 'DNS Record updated successfully' });

    } catch (err) {
      fastify.log.error(err, 'Update record error');
      reply.code(500).send({ success: false, error: 'Failed to update DNS record' });
    }
  });

  // DELETE /api/zones/:zoneId/records/:id (Delete record - Protected, Admin/Operator only)
  fastify.delete('/:zoneId/records/:id', { 
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { zoneId, id } = request.params as any;

    try {
      const db = fastify.db;
      
      const zone = db.prepare('SELECT name FROM zones WHERE id = ?').get(zoneId) as any;
      if (!zone) {
        reply.code(404).send({ success: false, error: 'Zone not found' });
        return;
      }

      const record = db.prepare('SELECT name, type FROM records WHERE id = ? AND zone_id = ?').get(id, zoneId) as any;
      if (!record) {
        reply.code(404).send({ success: false, error: 'DNS Record not found in this zone' });
        return;
      }

      // Delete Record
      db.prepare('DELETE FROM records WHERE id = ?').run(id);

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'DELETE_RECORD',
        `${record.name}.${zone.name}`,
        `Deleted DNS record type: ${record.type} (ID: ${id})`
      );

      // Regenerate config & reload Unbound
      await configGenerator.syncAll(db);

      reply.send({ success: true, message: 'DNS Record deleted successfully' });

    } catch (err) {
      fastify.log.error(err, 'Delete record error');
      reply.code(500).send({ success: false, error: 'Failed to delete DNS record' });
    }
  });
}
