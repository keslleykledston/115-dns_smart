"use strict";
/**
 * DNS Smart Server — Shared Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WS_TYPES = exports.METRICS = exports.SRTT = exports.DEFAULT_CONFIG = exports.QTYPE = exports.RCODE = exports.PRIVATE_IP_RANGES = exports.DEFAULT_FORWARDERS = exports.ROOT_HINTS = void 0;
/** Root DNS server hints (IANA root servers) */
exports.ROOT_HINTS = [
    { name: 'a.root-servers.net', ip: '198.41.0.4' },
    { name: 'b.root-servers.net', ip: '170.247.170.2' },
    { name: 'c.root-servers.net', ip: '192.33.4.12' },
    { name: 'd.root-servers.net', ip: '199.7.91.13' },
    { name: 'e.root-servers.net', ip: '192.203.230.10' },
    { name: 'f.root-servers.net', ip: '192.5.5.241' },
    { name: 'g.root-servers.net', ip: '192.112.36.4' },
    { name: 'h.root-servers.net', ip: '198.97.190.53' },
    { name: 'i.root-servers.net', ip: '192.36.148.17' },
    { name: 'j.root-servers.net', ip: '192.58.128.30' },
    { name: 'k.root-servers.net', ip: '193.0.14.129' },
    { name: 'l.root-servers.net', ip: '199.7.83.42' },
    { name: 'm.root-servers.net', ip: '202.12.27.33' },
];
/** Default forwarder list */
exports.DEFAULT_FORWARDERS = [
    { name: 'Google DNS Primary', address: '8.8.8.8', port: 53, protocol: 'udp' },
    { name: 'Google DNS Secondary', address: '8.8.4.4', port: 53, protocol: 'udp' },
    { name: 'Cloudflare DNS Primary', address: '1.1.1.1', port: 53, protocol: 'udp' },
    { name: 'Cloudflare DNS Secondary', address: '1.0.0.1', port: 53, protocol: 'udp' },
    { name: 'Quad9 DNS', address: '9.9.9.9', port: 53, protocol: 'udp' },
];
/** Private IP ranges for rebinding protection */
exports.PRIVATE_IP_RANGES = [
    { start: '10.0.0.0', end: '10.255.255.255', cidr: '10.0.0.0/8' },
    { start: '172.16.0.0', end: '172.31.255.255', cidr: '172.16.0.0/12' },
    { start: '192.168.0.0', end: '192.168.255.255', cidr: '192.168.0.0/16' },
    { start: '127.0.0.0', end: '127.255.255.255', cidr: '127.0.0.0/8' },
    { start: '169.254.0.0', end: '169.254.255.255', cidr: '169.254.0.0/16' },
];
/** DNS Response Codes */
exports.RCODE = {
    NOERROR: 0,
    FORMERR: 1,
    SERVFAIL: 2,
    NXDOMAIN: 3,
    NOTIMP: 4,
    REFUSED: 5,
};
/** DNS Record Type IDs */
exports.QTYPE = {
    A: 1,
    NS: 2,
    CNAME: 5,
    SOA: 6,
    PTR: 12,
    MX: 15,
    TXT: 16,
    AAAA: 28,
    SRV: 33,
    NAPTR: 35,
    DS: 43,
    RRSIG: 46,
    NSEC: 47,
    DNSKEY: 48,
    NSEC3: 50,
    CAA: 257,
};
/** Default server configuration */
exports.DEFAULT_CONFIG = {
    server: {
        workers: 'auto',
        listenAddress: '0.0.0.0',
        dnsPort: 53,
        dotPort: 853,
        dohPort: 8443,
        metricsPort: 9153,
    },
    cache: {
        maxSize: 50000,
        minTtl: 30,
        maxTtl: 86400,
        negativeTtl: 300,
        serveStaleTtl: 259200, // 72 hours
        prefetchThreshold: 0.1, // 10% of original TTL
        prefetchMinHits: 5,
        persistOnShutdown: true,
    },
    resolver: {
        mode: 'forward',
        timeout: 5000,
        retries: 2,
        qnameMinimization: true,
        dnssecValidation: false,
    },
    security: {
        rrl: {
            enabled: true,
            responsesPerSecond: 5,
            window: 15,
            slipRatio: 2,
        },
        rebindingProtection: true,
        rebindingAllowlist: [],
        acl: {
            allowRecursion: ['0.0.0.0/0'],
            allowQuery: ['0.0.0.0/0'],
        },
    },
    blocklist: {
        enabled: true,
        action: 'nxdomain',
        sinkholeAddress: '0.0.0.0',
        sources: [],
        updateInterval: 86400,
    },
    logging: {
        level: 'info',
        queryLog: true,
        queryLogMaxEntries: 10000,
    },
    healthCheck: {
        interval: 10000,
        timeout: 3000,
        failThreshold: 3,
        recoverThreshold: 3,
    },
};
/** SRTT Algorithm constants */
exports.SRTT = {
    ALPHA: 0.2, // Weight for new measurement
    DECAY_FACTOR: 0.98, // Periodic decay factor
    DECAY_INTERVAL: 300000, // 5 minutes
    JITTER_MS: 5, // Random jitter ±5ms
    INITIAL_RTT: 100, // Initial SRTT for unknown servers
    PROBE_INTERVAL: 60000, // Re-test unused servers every 60s
};
/** Metrics collection intervals */
exports.METRICS = {
    WEBSOCKET_PUSH_INTERVAL: 2000, // Push metrics every 2s
    AGGREGATION_INTERVAL: 60000, // Aggregate every 1 minute
    HOURLY_FLUSH_INTERVAL: 3600000, // Flush to SQLite every hour
    SPARKLINE_POINTS: 60, // Last 60 data points for sparklines
    TOP_N: 10, // Top 10 domains/clients
};
/** WebSocket message types */
exports.WS_TYPES = {
    METRICS_UPDATE: 'metrics_update',
    FORWARDER_STATUS: 'forwarder_status',
    QUERY_LOG: 'query_log',
    ALERT: 'alert',
    CONFIG_CHANGED: 'config_changed',
    SNAPSHOT: 'snapshot',
};
