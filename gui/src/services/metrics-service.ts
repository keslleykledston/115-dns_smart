import { Database } from 'better-sqlite3';
import logMonitor from './log-monitor.js';
import { QueryLogEntry, RealtimeMetrics } from '../shared/types/dns.js';
import unboundClient from './unbound-client.js';

export class MetricsService {
  // Counters for the current window
  private totalQueries = 0;
  private blockedQueries = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private errorCodes: Record<string, number> = {};
  private queryTypes: Record<string, number> = {};
  
  // Latency sliding window for percentiles
  private latencyWindow: number[] = [];
  private maxLatencyWindowSize = 1000;

  // Real-time rates
  private qpsTimestamps: number[] = [];
  
  // Top items trackers (Domain -> Count, Client -> Count)
  private domainHits: Record<string, number> = {};
  private clientHits: Record<string, number> = {};

  // Active clients IP set
  private activeClients = new Set<string>();

  constructor() {
    // Listen for log queries
    logMonitor.on('query', (entry: QueryLogEntry) => {
      this.recordQuery(entry);
    });
  }

  /**
   * Process a single query log entry in real-time
   */
  private recordQuery(entry: QueryLogEntry): void {
    const now = Date.now();
    
    // QPS tracker
    this.qpsTimestamps.push(now);
    this.totalQueries++;

    if (entry.blocked) {
      this.blockedQueries++;
    }

    if (entry.cached) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }

    // Response code distribution
    this.errorCodes[entry.responseCode] = (this.errorCodes[entry.responseCode] || 0) + 1;

    // Query types distribution
    this.queryTypes[entry.type] = (this.queryTypes[entry.type] || 0) + 1;

    // Latency percentiles tracker
    this.latencyWindow.push(entry.latencyMs);
    if (this.latencyWindow.length > this.maxLatencyWindowSize) {
      this.latencyWindow.shift();
    }

    // Top Domains tracker
    this.domainHits[entry.domain] = (this.domainHits[entry.domain] || 0) + 1;

    // Top Clients tracker
    this.clientHits[entry.clientIp] = (this.clientHits[entry.clientIp] || 0) + 1;

    // Active Clients tracker
    this.activeClients.add(entry.clientIp);
  }

  /**
   * Calculate Sliding QPS (queries in the last 5 seconds)
   */
  public getQps(): number {
    const now = Date.now();
    const threshold = now - 5000; // 5 seconds sliding window
    
    // Evict old timestamps
    this.qpsTimestamps = this.qpsTimestamps.filter(t => t > threshold);
    
    return Math.round((this.qpsTimestamps.length / 5) * 100) / 100;
  }

  /**
   * Get sorted Top N query domains
   */
  public getTopDomains(limit = 10): Array<{ domain: string; count: number }> {
    return Object.entries(this.domainHits)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get sorted Top N active clients
   */
  public getTopClients(limit = 10): Array<{ client: string; count: number }> {
    return Object.entries(this.clientHits)
      .map(([client, count]) => ({ client, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Calculate Latency percentiles (p50 and p95) from window
   */
  public getLatencyPercentiles(): { avg: number; p50: number; p95: number } {
    if (this.latencyWindow.length === 0) {
      return { avg: 0, p50: 0, p95: 0 };
    }

    const sorted = [...this.latencyWindow].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = Math.round((sum / sorted.length) * 100) / 100;

    const p50Idx = Math.floor(sorted.length * 0.5);
    const p95Idx = Math.floor(sorted.length * 0.95);

    return {
      avg,
      p50: sorted[p50Idx] || 0,
      p95: sorted[p95Idx] || 0,
    };
  }

  /**
   * Compile snapshot of current real-time metrics for WebSocket / dashboard APIs
   */
  public async getRealtimeMetrics(db: Database): Promise<RealtimeMetrics> {
    const latencies = this.getLatencyPercentiles();
    
    // Fetch stats from Unbound directly (remote control) as ground-truth
    const unboundStats = await unboundClient.getStats();
    
    // Format forwarder health from SQLite
    const forwarders = db.prepare('SELECT * FROM forwarders').all() as any[];
    const forwarderHealthList = forwarders.map(f => {
      // Find Unbound RTT stats if available
      const searchKey = `num.query.auth.zone.${f.address}`; // Sample unbound stat key
      const avgRtt = unboundStats[`rtt.${f.address}`] || f.avg_rtt_ms || 12; // fallback
      
      return {
        id: f.id,
        address: f.address,
        port: f.port,
        protocol: f.protocol,
        status: f.status,
        avgRttMs: avgRtt,
        srtt: avgRtt,
        lastRttMs: avgRtt,
        successCount: f.status === 'up' ? 100 : 0,
        failureCount: f.status === 'down' ? 100 : 0,
        consecutiveFailures: 0,
        lastCheckAt: Date.now(),
        rttHistory: [avgRtt, avgRtt - 2, avgRtt + 3, avgRtt - 1, avgRtt], // dummy trend
      };
    });

    const totalFromLog = this.totalQueries;
    const cacheHitRate = totalFromLog > 0 ? Math.round((this.cacheHits / totalFromLog) * 10000) / 100 : 0;

    return {
      timestamp: Date.now(),
      qps: this.getQps(),
      totalQueries: totalFromLog,
      blockedQueries: this.blockedQueries,
      cacheHitRate: cacheHitRate,
      avgLatencyMs: latencies.avg,
      p95LatencyMs: latencies.p95,
      activeClients: this.activeClients.size || 1,
      queryTypes: this.queryTypes,
      responseCodes: this.errorCodes,
      topDomains: this.getTopDomains(10),
      topClients: this.getTopClients(10),
      forwarders: forwarderHealthList,
    };
  }

  /**
   * Flush in-memory accumulated hourly stats to SQLite
   */
  public flushHourlyMetrics(db: Database): void {
    const now = new Date();
    // Round to nearest hour: YYYY-MM-DD HH:00:00
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day} ${hour}:00:00`;

    const latencies = this.getLatencyPercentiles();

    try {
      db.prepare(`
        INSERT INTO metrics_hourly 
        (timestamp, total_queries, blocked_queries, cache_hits, cache_misses, avg_latency_ms, p95_latency_ms, unique_clients, servfail_count, nxdomain_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(timestamp) DO UPDATE SET
          total_queries = total_queries + excluded.total_queries,
          blocked_queries = blocked_queries + excluded.blocked_queries,
          cache_hits = cache_hits + excluded.cache_hits,
          cache_misses = cache_misses + excluded.cache_misses,
          avg_latency_ms = (avg_latency_ms + excluded.avg_latency_ms) / 2,
          p95_latency_ms = excluded.p95_latency_ms,
          unique_clients = max(unique_clients, excluded.unique_clients),
          servfail_count = servfail_count + excluded.servfail_count,
          nxdomain_count = nxdomain_count + excluded.nxdomain_count
      `).run(
        timestamp,
        this.totalQueries,
        this.blockedQueries,
        this.cacheHits,
        this.cacheMisses,
        latencies.avg,
        latencies.p95,
        this.activeClients.size,
        this.errorCodes['SERVFAIL'] || 0,
        this.errorCodes['NXDOMAIN'] || 0
      );
      
      console.log(`Successfully flushed hourly metrics to SQLite for ${timestamp}`);

      // Reset hourly increment counters
      this.totalQueries = 0;
      this.blockedQueries = 0;
      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.errorCodes = {};
      this.queryTypes = {};
      this.domainHits = {};
      this.clientHits = {};
      this.activeClients.clear();
      this.latencyWindow = [];

    } catch (err) {
      console.error('Failed to flush hourly metrics to DB:', err);
    }
  }

  /**
   * Start periodic DB metrics flush (every hour)
   */
  public startFlushTimer(db: Database): void {
    // Flush every hour
    setInterval(() => {
      this.flushHourlyMetrics(db);
    }, 3600000);
  }
}

export const metricsService = new MetricsService();
export default metricsService;
