-- ============================================================
-- DNS Smart Server — SQLite Database Schema
-- ============================================================

-- Zones (hospedar domínios locais)
CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('primary','secondary','forwarder')),
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DNS Records inside a zone
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('A','AAAA','CNAME','MX','TXT','NS','SRV','PTR','CAA','SOA')),
  value TEXT NOT NULL,
  ttl INTEGER DEFAULT 3600,
  priority INTEGER,
  weight INTEGER,
  port INTEGER,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(zone_id, name, type, value)
);

-- Forwarders / Upstream DNS
CREATE TABLE IF NOT EXISTS forwarders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT UNIQUE NOT NULL,
  port INTEGER DEFAULT 53,
  protocol TEXT DEFAULT 'udp' CHECK(protocol IN ('udp','tcp','dot','doh')),
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  status TEXT DEFAULT 'unknown' CHECK(status IN ('up','down','degraded','unknown')),
  avg_rtt_ms REAL DEFAULT 0,
  last_check DATETIME
);

-- Blocklist sources
CREATE TABLE IF NOT EXISTS blocklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  url TEXT,
  type TEXT DEFAULT 'url' CHECK(type IN ('url','custom')),
  enabled INTEGER DEFAULT 1,
  entry_count INTEGER DEFAULT 0,
  last_updated DATETIME
);

-- Custom blocked domains (or domains imported from lists)
CREATE TABLE IF NOT EXISTS blocked_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT UNIQUE NOT NULL,
  blocklist_id INTEGER REFERENCES blocklists(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK(role IN ('admin','operator','viewer')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Aggregated historical metrics
CREATE TABLE IF NOT EXISTS metrics_hourly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT UNIQUE NOT NULL, -- Format: YYYY-MM-DD HH:00:00
  total_queries INTEGER DEFAULT 0,
  blocked_queries INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  avg_latency_ms REAL DEFAULT 0,
  p95_latency_ms REAL DEFAULT 0,
  unique_clients INTEGER DEFAULT 0,
  servfail_count INTEGER DEFAULT 0,
  nxdomain_count INTEGER DEFAULT 0
);

-- Global config settings (key-value)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
