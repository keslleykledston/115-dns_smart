import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fetch from 'node-fetch';
import configGenerator from '../services/config-generator.js';
import AuditLogger from '../services/audit-logger.js';

export default async function blocklistRoutes(fastify: FastifyInstance) {
  // GET /api/blocklist (List blocklist sources - Protected)
  fastify.get('/', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = fastify.db;
      const lists = db.prepare('SELECT * FROM blocklists').all() as any[];
      reply.send({ success: true, data: lists });
    } catch (err) {
      fastify.log.error(err, 'List blocklists error');
      reply.code(500).send({ success: false, error: 'Failed to list blocklists' });
    }
  });

  // GET /api/blocklist/domains (Get individual blocked domains, paginated - Protected)
  fastify.get('/domains', { preValidation: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = 1, limit = 50, search = '' } = request.query as any;
    
    try {
      const db = fastify.db;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const querySearch = `%${search.trim().toLowerCase()}%`;

      const domains = db.prepare(`
        SELECT d.*, b.name as list_name 
        FROM blocked_domains d 
        LEFT JOIN blocklists b ON b.id = d.blocklist_id 
        WHERE d.domain LIKE ?
        ORDER BY d.id DESC 
        LIMIT ? OFFSET ?
      `).all(querySearch, parseInt(limit), offset) as any[];

      const totalResult = db.prepare(`
        SELECT COUNT(id) as count FROM blocked_domains WHERE domain LIKE ?
      `).get(querySearch) as any;

      reply.send({
        success: true,
        data: domains,
        total: totalResult?.count || 0,
        page: parseInt(page),
        pageSize: parseInt(limit),
      });

    } catch (err) {
      fastify.log.error(err, 'List blocked domains error');
      reply.code(500).send({ success: false, error: 'Failed to list blocked domains' });
    }
  });

  // POST /api/blocklist (Add a blocklist source - Protected, Admin/Operator only)
  fastify.post('/', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, url, type = 'url' } = request.body as any;

    if (!name) {
      reply.code(400).send({ success: false, error: 'Name is required' });
      return;
    }

    try {
      const db = fastify.db;
      const cleanName = name.trim();

      const exists = db.prepare('SELECT id FROM blocklists WHERE name = ?').get(cleanName);
      if (exists) {
        reply.code(409).send({ success: false, error: 'A blocklist with this name already exists' });
        return;
      }

      const result = db.prepare(`
        INSERT INTO blocklists (name, url, type, enabled) VALUES (?, ?, ?, 1)
      `).run(cleanName, url ? url.trim() : null, type);

      const listId = result.lastInsertRowid;

      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'CREATE_BLOCKLIST',
        cleanName,
        `Added blocklist source: ${cleanName}`
      );

      reply.code(201).send({
        success: true,
        message: 'Blocklist source added successfully',
        data: { id: listId, name: cleanName, url, type }
      });

    } catch (err) {
      fastify.log.error(err, 'Create blocklist error');
      reply.code(500).send({ success: false, error: 'Failed to add blocklist source' });
    }
  });

  // POST /api/blocklist/custom-domain (Add single blocked domain - Protected, Admin/Operator only)
  fastify.post('/custom-domain', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { domain } = request.body as any;

    if (!domain) {
      reply.code(400).send({ success: false, error: 'Domain is required' });
      return;
    }

    try {
      const db = fastify.db;
      const cleanDomain = domain.trim().toLowerCase();

      // Get or create Custom list
      let customList = db.prepare("SELECT id FROM blocklists WHERE name = 'Custom Blocks'").get() as any;
      if (!customList) {
        const ins = db.prepare("INSERT INTO blocklists (name, type, enabled) VALUES ('Custom Blocks', 'custom', 1)").run();
        customList = { id: ins.lastInsertRowid };
      }

      const exists = db.prepare('SELECT id FROM blocked_domains WHERE domain = ?').get(cleanDomain);
      if (exists) {
        reply.code(409).send({ success: false, error: 'This domain is already blocked' });
        return;
      }

      db.prepare('INSERT INTO blocked_domains (domain, blocklist_id) VALUES (?, ?)').run(cleanDomain, customList.id);
      db.prepare('UPDATE blocklists SET entry_count = entry_count + 1 WHERE id = ?').run(customList.id);

      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'BLOCK_DOMAIN',
        cleanDomain,
        'Added domain to custom blocklist'
      );

      await configGenerator.syncAll(db);

      reply.code(201).send({ success: true, message: `Domain ${cleanDomain} successfully blocked` });

    } catch (err) {
      fastify.log.error(err, 'Add custom blocked domain error');
      reply.code(500).send({ success: false, error: 'Failed to block domain' });
    }
  });

  // POST /api/blocklist/:id/update (Download and import domains from URL - Protected, Admin/Operator only)
  fastify.post('/:id/update', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    try {
      const db = fastify.db;

      const list = db.prepare('SELECT * FROM blocklists WHERE id = ?').get(id) as any;
      if (!list || list.type !== 'url' || !list.url) {
        reply.code(400).send({ success: false, error: 'Invalid blocklist source for URL update' });
        return;
      }

      fastify.log.info(`Downloading remote blocklist: ${list.url}`);
      
      const res = await fetch(list.url);
      if (!res.ok) {
        reply.code(502).send({ success: false, error: `Failed to download file from URL (HTTP ${res.status})` });
        return;
      }

      const text = await res.text();
      fastify.log.info(`Downloaded blocklist. Size: ${text.length} bytes. Parsing...`);

      // Parse domains from host/adblock formats
      const lines = text.split('\n');
      const domainsToBlock = new Set<string>();

      for (const line of lines) {
        const cleanLine = line.trim();
        // Skip comments
        if (!cleanLine || cleanLine.startsWith('#') || cleanLine.startsWith('!')) {
          continue;
        }

        // Match formats: '0.0.0.0 example.com' or '127.0.0.1 example.com' or just 'example.com'
        const parts = cleanLine.split(/\s+/);
        let domainCandidate = '';

        if (parts.length >= 2 && (parts[0] === '0.0.0.0' || parts[0] === '127.0.0.1')) {
          domainCandidate = parts[1];
        } else if (parts.length === 1) {
          domainCandidate = parts[0];
        }

        // Clean trailing dot
        if (domainCandidate.endsWith('.')) {
          domainCandidate = domainCandidate.slice(0, -1);
        }

        // Simple domain regex validation
        if (domainCandidate && /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,20}$/i.test(domainCandidate)) {
          domainsToBlock.add(domainCandidate.toLowerCase());
        }
      }

      fastify.log.info(`Parsed ${domainsToBlock.size} unique domains. Bulk importing to SQLite...`);

      // SQLite high-speed Transaction Bulk Insert
      const deleteOld = db.prepare('DELETE FROM blocked_domains WHERE blocklist_id = ?');
      const insertNew = db.prepare('INSERT OR IGNORE INTO blocked_domains (domain, blocklist_id) VALUES (?, ?)');

      const bulkInsert = db.transaction((domains: string[], listId: number) => {
        deleteOld.run(listId);
        for (const domain of domains) {
          insertNew.run(domain, listId);
        }
      });

      bulkInsert([...domainsToBlock], parseInt(id));

      // Update entry count and timestamp in list
      db.prepare(`
        UPDATE blocklists 
        SET entry_count = ?, last_updated = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(domainsToBlock.size, id);

      fastify.log.info(`Import complete. Triggering Unbound reload...`);

      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'UPDATE_BLOCKLIST',
        list.name,
        `Downloaded and imported ${domainsToBlock.size} domains from remote URL`
      );

      await configGenerator.syncAll(db);

      reply.send({
        success: true,
        message: `Blocklist ${list.name} successfully updated. Imported ${domainsToBlock.size} domains.`,
      });

    } catch (err) {
      fastify.log.error(err, 'Update blocklist error');
      reply.code(500).send({ success: false, error: 'Failed to update remote blocklist' });
    }
  });

  // DELETE /api/blocklist/:id (Delete source - Protected, Admin/Operator only)
  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    try {
      const db = fastify.db;
      
      const list = db.prepare('SELECT name FROM blocklists WHERE id = ?').get(id) as any;
      if (!list) {
        reply.code(404).send({ success: false, error: 'Blocklist source not found' });
        return;
      }

      // Delete blocklist (cascades to blocked_domains automatically)
      db.prepare('DELETE FROM blocklists WHERE id = ?').run(id);

      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'DELETE_BLOCKLIST',
        list.name,
        `Deleted blocklist source ID: ${id}`
      );

      await configGenerator.syncAll(db);

      reply.send({ success: true, message: 'Blocklist source deleted successfully' });

    } catch (err) {
      fastify.log.error(err, 'Delete blocklist error');
      reply.code(500).send({ success: false, error: 'Failed to delete blocklist source' });
    }
  });

  // DELETE /api/blocklist/domains/:id (Delete individual blocked domain - Protected, Admin/Operator only)
  fastify.delete('/domains/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;

    try {
      const db = fastify.db;

      const domainEntry = db.prepare('SELECT domain, blocklist_id FROM blocked_domains WHERE id = ?').get(id) as any;
      if (!domainEntry) {
        reply.code(404).send({ success: false, error: 'Blocked domain not found' });
        return;
      }

      // Delete
      db.prepare('DELETE FROM blocked_domains WHERE id = ?').run(id);
      db.prepare('UPDATE blocklists SET entry_count = max(0, entry_count - 1) WHERE id = ?').run(domainEntry.blocklist_id);

      AuditLogger.log(
        db,
        request.user.userId,
        request.user.username,
        'UNBLOCK_DOMAIN',
        domainEntry.domain,
        'Removed domain from blocklist'
      );

      await configGenerator.syncAll(db);

      reply.send({ success: true, message: `Domain ${domainEntry.domain} successfully unblocked` });

    } catch (err) {
      fastify.log.error(err, 'Delete custom blocked domain error');
      reply.code(500).send({ success: false, error: 'Failed to unblock domain' });
    }
  });
}
