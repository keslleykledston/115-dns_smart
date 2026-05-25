import fp from 'fastify-plugin';
import Database from 'better-sqlite3';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import fileURLToPath from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DatabasePlugin {
  db: Database.Database;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
  }
}

export default fp(async function (fastify: FastifyInstance) {
  const dbDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'dns-smart.db');
  fastify.log.info(`Connecting to SQLite database at ${dbPath}`);
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Load Schema
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  fastify.log.info('Database schema checked/loaded successfully.');

  // Load Seed
  const seedPath = path.join(__dirname, '../db/seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  db.exec(seedSql);
  fastify.log.info('Database base seed applied.');

  // Programmatic Hashed Admin Account Seeding
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'dnssmart2024';

  const userExists = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser);
  if (!userExists) {
    fastify.log.info(`Creating initial admin user: ${adminUser}`);
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPass, salt);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(adminUser, hash, 'admin');
    fastify.log.info('Admin user created successfully.');
  }

  fastify.decorate('db', db);

  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Closing SQLite database connection');
    db.close();
  });
});
