-- ============================================================
-- DNS Smart Server — SQLite Database Seed Data
-- ============================================================

-- Default Forwarders
INSERT OR IGNORE INTO forwarders (name, address, port, protocol, priority, enabled) VALUES
('Cloudflare Primary', '1.1.1.1', 53, 'udp', 0, 1),
('Cloudflare Secondary', '1.0.0.1', 53, 'udp', 1, 1),
('Google Primary', '8.8.8.8', 53, 'udp', 2, 1),
('Google Secondary', '8.8.4.4', 53, 'udp', 3, 1),
('Quad9 Secure', '9.9.9.9', 53, 'udp', 4, 1);

-- Default Blocklist Sources
INSERT OR IGNORE INTO blocklists (name, url, type, enabled) VALUES
('StevenBlack Adware & Malware', 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts', 'url', 1),
('OISD Light', 'https://big.oisd.nl', 'url', 0);

-- Default General Configs
INSERT OR IGNORE INTO config (key, value, category) VALUES
('dns_port', '53', 'dns'),
('dot_port', '853', 'dns'),
('qname_minimization', 'true', 'dns'),
('dnssec_validation', 'true', 'dns'),
('cache_min_ttl', '30', 'cache'),
('cache_max_ttl', '86400', 'cache'),
('prefetch', 'true', 'cache'),
('serve_expired', 'true', 'cache'),
('rrl_enabled', 'true', 'security'),
('rrl_responses_per_second', '5', 'security'),
('rebinding_protection', 'true', 'security'),
('blocklist_enabled', 'true', 'blocklist'),
('blocklist_action', 'nxdomain', 'blocklist'),
('query_logging', 'true', 'logging');
