import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import configGenerator from '../services/config-generator.js';
import AuditLogger from '../services/audit-logger.js';

export default async function forwardersRoutes(fastify: FastifyInstance) {
  // GET /api/forwarders (List all forwarders - Protected)
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = fastify.db;
      const forwarders = db.prepare('SELECT * FROM forwarders ORDER BY priority ASC').all() as any[];
      reply.send({ success: true, data: forwarders });
    } catch (err) {
      fastify.log.error(err, 'List forwarders error');
      reply.code(500).send({ success: false, error: 'Failed to list forwarders' });
    }
  });

  // POST /api/forwarders (Create forwarder - Protected, Admin/Operator only)
  fastify.post('/', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, address, port, protocol, priority } = request.body as any;

    if (!name || !address) {
      reply.code(400).send({ success: false, error: 'Name and IP Address are required' });
      return;
    }

    try {
      const db = fastify.db;
      const cleanAddress = address.trim();

      // Check if address already exists
      const exists = db.prepare('SELECT id FROM forwarders WHERE address = ?').get(cleanAddress);
      if (exists) {
        reply.code(409).send({ success: false, error: 'A forwarder with this address already exists' });
        return;
      }

      // Insert Forwarder
      const result = db.prepare(`
        INSERT INTO forwarders (name, address, port, protocol, priority)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        cleanAddress,
        port || 53,
        protocol || 'udp',
        priority || 0
      );

      const fwdId = result.lastInsertRowid;

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'CREATE_FORWARDER',
        cleanAddress,
        `Created upstream forwarder: ${name}`
      );

      // Regenerate config & reload Unbound
      await configGenerator.syncAll(db);

      reply.code(201).send({
        success: true,
        message: 'Forwarder created successfully',
        data: { id: fwdId, name, address: cleanAddress }
      });

    } catch (err) {
      fastify.log.error(err, 'Create forwarder error');
      reply.code(500).send({ success: false, error: 'Failed to create forwarder' });
    }
  });

  // PUT /api/forwarders/:id (Update forwarder status/enable - Protected, Admin/Operator only)
  fastify.put('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { name, port, protocol, priority, enabled } = request.body as any;

    try {
      const db = fastify.db;

      const forwarder = db.prepare('SELECT * FROM forwarders WHERE id = ?').get(id) as any;
      if (!forwarder) {
        reply.code(404).send({ success: false, error: 'Forwarder not found' });
        return;
      }

      const cleanName = name !== undefined ? name.trim() : forwarder.name;
      const cleanPort = port !== undefined ? port : forwarder.port;
      const cleanProtocol = protocol !== undefined ? protocol : forwarder.protocol;
      const cleanPriority = priority !== undefined ? priority : forwarder.priority;
      const cleanEnabled = enabled !== undefined ? (enabled ? 1 : 0) : forwarder.enabled;

      db.prepare(`
        UPDATE forwarders 
        SET name = ?, port = ?, protocol = ?, priority = ?, enabled = ?
        WHERE id = ?
      `).run(cleanName, cleanPort, cleanProtocol, cleanPriority, cleanEnabled, id);

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'UPDATE_FORWARDER',
        forwarder.address,
        `Updated forwarder ID: ${id}, enabled: ${cleanEnabled}`
      );

      // Regenerate config & reload Unbound
      await configGenerator.syncAll(db);

      reply.send({ success: true, message: 'Forwarder updated successfully' });

    } catch (err) {
      fastify.log.error(err, 'Update forwarder error');
      reply.code(500).send({ success: false, error: 'Failed to update forwarder' });
    }
  });

  // DELETE /api/forwarders/:id (Delete forwarder - Protected, Admin/Operator only)
  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    try {
      const db = fastify.db;

      const forwarder = db.prepare('SELECT name, address FROM forwarders WHERE id = ?').get(id) as any;
      if (!forwarder) {
        reply.code(404).send({ success: false, error: 'Forwarder not found' });
        return;
      }

      // Delete forwarder
      db.prepare('DELETE FROM forwarders WHERE id = ?').run(id);

      // Audit Log
      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'DELETE_FORWARDER',
        forwarder.address,
        `Deleted forwarder: ${forwarder.name}`
      );

      // Regenerate config & reload Unbound
      await configGenerator.syncAll(db);

      reply.send({ success: true, message: 'Forwarder deleted successfully' });

    } catch (err) {
      fastify.log.error(err, 'Delete forwarder error');
      reply.code(500).send({ success: false, error: 'Failed to delete forwarder' });
    }
  });
}
