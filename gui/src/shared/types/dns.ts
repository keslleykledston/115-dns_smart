/**
 * DNS Smart Server — Shared Type Definitions
 * Used by both dns-server and gui containers
 */

// ============================================================
// DNS Protocol Types
// ============================================================

export type DnsRecordType =
  | 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'
  | 'SRV' | 'PTR' | 'CAA' | 'SOA' | 'NAPTR' | 'DNSKEY'
  | 'DS' | 'RRSIG' | 'NSEC' | 'NSEC3';

export type DnsResponseCode =
  | 'NOERROR' | 'FORMERR' | 'SERVFAIL' | 'NXDOMAIN'
  | 'NOTIMP' | 'REFUSED' | 'YXDOMAIN' | 'YXRRSET'
  | 'NXRRSET' | 'NOTAUTH' | 'NOTZONE';

export type DnsProtocol = 'udp' | 'tcp' | 'dot' | 'doh';

export type ZoneType = 'primary' | 'secondary' | 'forwarder';

// ============================================================
// Query & Response
// ============================================================

export interface DnsQuery {
  id: number;
  name: string;
  type: DnsRecordType;
  class: string;
  protocol: DnsProtocol;
  clientIp: string;
  clientPort: number;
  timestamp: number;
  size: number;
}

export interface DnsResponse {
  id: number;
  rcode: DnsResponseCode;
  answers: DnsAnswer[];
  authority: DnsAnswer[];
  additional: DnsAnswer[];
  flags: {
    aa: boolean;  // Authoritative Answer
    tc: boolean;  // Truncated
    rd: boolean;  // Recursion Desired
    ra: boolean;  // Recursion Available
    ad: boolean;  // Authenticated Data (DNSSEC)
    cd: boolean;  // Checking Disabled
  };
  latencyMs: number;
  source: 'cache' | 'recursive' | 'forward' | 'authoritative' | 'blocked';
}

export interface DnsAnswer {
  name: string;
  type: DnsRecordType;
  class: string;
  ttl: number;
  data: string | Record<string, unknown>;
}

// ============================================================
// Cache Types
// ============================================================

export interface CacheEntry {
  key: string;
  answers: DnsAnswer[];
  authority: DnsAnswer[];
  additional: DnsAnswer[];
  rcode: DnsResponseCode;
  originalTtl: number;
  insertedAt: number;
  expiresAt: number;
  hitCount: number;
  lastHitAt: number;
  isNegative: boolean;
  isDnssecValidated: boolean;
}

export interface CacheStats {
  size: number;
  capacity: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
  prefetches: number;
  staleServes: number;
}

// ============================================================
// Forwarder / Upstream Types
// ============================================================

export type ForwarderStatus = 'up' | 'down' | 'degraded' | 'unknown';

export interface ForwarderConfig {
  id: number;
  address: string;
  port: number;
  protocol: DnsProtocol;
  priority: number;
  enabled: boolean;
}

export interface ForwarderHealth {
  id: number;
  address: string;
  port: number;
  protocol: DnsProtocol;
  status: ForwarderStatus;
  avgRttMs: number;
  srtt: number;         // Smoothed RTT
  lastRttMs: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastCheckAt: number;
  rttHistory: number[]; // Last 60 RTT values for sparkline
}

// ============================================================
// Zone & Record Types (Database)
// ============================================================

export interface Zone {
  id: number;
  name: string;
  type: ZoneType;
  enabled: boolean;
  recordCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  id: number;
  zoneId: number;
  name: string;
  type: DnsRecordType;
  value: string;
  ttl: number;
  priority?: number;
  weight?: number;
  port?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Blocklist Types
// ============================================================

export interface Blocklist {
  id: number;
  name: string;
  url?: string;
  type: 'url' | 'custom';
  enabled: boolean;
  entryCount: number;
  lastUpdated?: string;
}

export interface BlockedDomain {
  id: number;
  domain: string;
  blocklistId?: number;
  createdAt: string;
}

// ============================================================
// Metrics & Statistics
// ============================================================

export interface RealtimeMetrics {
  timestamp: number;
  qps: number;
  totalQueries: number;
  blockedQueries: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  activeClients: number;
  queryTypes: Record<string, number>;
  responseCodes: Record<string, number>;
  topDomains: Array<{ domain: string; count: number }>;
  topClients: Array<{ client: string; count: number }>;
  forwarders: ForwarderHealth[];
}

export interface DashboardStats {
  totalQueries: number;
  blockedQueries: number;
  blockPercentage: number;
  cacheHitRate: number;
  activeClients: number;
  uptime: number;
  serverStatus: 'online' | 'degraded' | 'offline';
  dnsWorkers: number;
}

export interface QueryLogEntry {
  id: number;
  timestamp: number;
  domain: string;
  type: DnsRecordType;
  clientIp: string;
  responseCode: DnsResponseCode;
  latencyMs: number;
  source: string;
  blocked: boolean;
  cached: boolean;
  upstream?: string;
}

export interface MetricsHourly {
  id: number;
  timestamp: string;
  totalQueries: number;
  blockedQueries: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  uniqueClients: number;
  servfailCount: number;
  nxdomainCount: number;
}

// ============================================================
// Configuration Types
// ============================================================

export interface DnsServerConfig {
  server: {
    workers: number | 'auto';
    listenAddress: string;
    dnsPort: number;
    dotPort: number;
    dohPort: number;
    metricsPort: number;
  };
  cache: {
    maxSize: number;
    minTtl: number;
    maxTtl: number;
    negativeTtl: number;
    serveStaleTtl: number;
    prefetchThreshold: number;
    prefetchMinHits: number;
    persistOnShutdown: boolean;
  };
  resolver: {
    mode: 'recursive' | 'forward' | 'hybrid';
    timeout: number;
    retries: number;
    qnameMinimization: boolean;
    dnssecValidation: boolean;
  };
  security: {
    rrl: {
      enabled: boolean;
      responsesPerSecond: number;
      window: number;
      slipRatio: number;
    };
    rebindingProtection: boolean;
    rebindingAllowlist: string[];
    acl: {
      allowRecursion: string[];
      allowQuery: string[];
    };
  };
  blocklist: {
    enabled: boolean;
    action: 'nxdomain' | 'nodata' | 'sinkhole';
    sinkholeAddress: string;
    sources: string[];
    updateInterval: number;
  };
  logging: {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    queryLog: boolean;
    queryLogMaxEntries: number;
  };
  healthCheck: {
    interval: number;
    timeout: number;
    failThreshold: number;
    recoverThreshold: number;
  };
}

// ============================================================
// WebSocket Message Types
// ============================================================

export type WsMessageType =
  | 'metrics_update'
  | 'forwarder_status'
  | 'query_log'
  | 'alert'
  | 'config_changed'
  | 'snapshot';

export interface WsMessage {
  type: WsMessageType;
  data: unknown;
  timestamp: number;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================
// User & Auth Types
// ============================================================

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthPayload {
  userId: number;
  username: string;
  role: UserRole;
}

export interface AuditLogEntry {
  id: number;
  userId: number;
  username?: string;
  action: string;
  target?: string;
  details?: string;
  createdAt: string;
}
