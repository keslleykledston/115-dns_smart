import fs from 'fs';
import path from 'path';
import fileURLToPath from 'url';
import EventEmitter from 'events';
import { QueryLogEntry, DnsRecordType, DnsResponseCode } from '../shared/types/dns.js';
import { WS_TYPES } from '../shared/constants.js';

const __filename = fileURLToPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LogMonitor extends EventEmitter {
  private logPath: string;
  private fileWatcher: fs.FSWatcher | null = null;
  private currentSize = 0;
  private queryBuffer: QueryLogEntry[] = [];
  private maxBufferSize = 5000;
  private logStream: fs.ReadStream | null = null;
  private pendingLine = '';

  constructor() {
    super();
    // Shared unbound.log inside volume
    this.logPath = process.env.UNBOUND_LOG_PATH || '/etc/unbound/unbound.log';
    
    // Dev fallback
    if (!fs.existsSync(this.logPath)) {
      this.logPath = path.join(__dirname, '../../../unbound/unbound.log');
    }
  }

  /**
   * Return the recent query logs from memory
   */
  public getRecentLogs(limit = 100): QueryLogEntry[] {
    return this.queryBuffer.slice(-limit).reverse();
  }

  /**
   * Start tailing the Unbound log file
   */
  public start(broadcastCallback: (type: string, data: any) => void): void {
    console.log(`Starting Unbound query log monitor on: ${this.logPath}`);

    if (!fs.existsSync(this.logPath)) {
      // Touch the file if it doesn't exist
      try {
        fs.writeFileSync(this.logPath, '');
      } catch (err) {
        console.error(`Unable to create log file: ${this.logPath}`, err);
        return;
      }
    }

    const stat = fs.statSync(this.logPath);
    this.currentSize = stat.size;

    // Standard tail implementation using fs.watch
    this.fileWatcher = fs.watch(this.logPath, (event) => {
      if (event === 'change') {
        this.readNewContent(broadcastCallback);
      }
    });

    // Periodically prune buffer to prevent memory leakage
    setInterval(() => {
      if (this.queryBuffer.length > this.maxBufferSize) {
        this.queryBuffer = this.queryBuffer.slice(-2000);
      }
    }, 60000);
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    console.log('Stopped log monitor.');
  }

  /**
   * Reads only the newly appended content to the log file
   */
  private readNewContent(broadcastCallback: (type: string, data: any) => void): void {
    try {
      const stat = fs.statSync(this.logPath);
      
      // File was truncated/rotated
      if (stat.size < this.currentSize) {
        this.currentSize = 0;
      }

      if (stat.size === this.currentSize) {
        return;
      }

      const stream = fs.createReadStream(this.logPath, {
        start: this.currentSize,
        end: stat.size - 1,
        encoding: 'utf8',
      });

      this.currentSize = stat.size;

      stream.on('data', (chunk: string | Buffer) => {
        const lines = (this.pendingLine + chunk.toString()).split('\n');
        this.pendingLine = lines.pop() || ''; // Last element might be incomplete

        for (const line of lines) {
          if (line.trim()) {
            this.parseLogLine(line, broadcastCallback);
          }
        }
      });
    } catch (err) {
      console.error('Error reading log file:', err);
    }
  }

  /**
   * Parse Unbound log line and emit query details
   * Format logged by 'log-replies: yes':
   * info: [reply] 172.20.0.3 google.com. A IN NOERROR 0.045123 0 45
   */
  private parseLogLine(line: string, broadcastCallback: (type: string, data: any) => void): void {
    try {
      // 1. We look specifically for the info: [reply] tag
      if (!line.includes('info: [reply]')) {
        return;
      }

      const match = line.match(/info: \[reply\]\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+IN\s+([^\s]+)\s+([0-9\.]+)\s+([0-9]+)\s+([0-9]+)/);
      if (!match) return;

      const clientIp = match[1];
      let domain = match[2];
      // Strip trailing dot from domain if it exists (e.g. google.com. -> google.com)
      if (domain.endsWith('.')) {
        domain = domain.slice(0, -1);
      }
      
      const type = match[3] as DnsRecordType;
      const responseCode = match[4] as DnsResponseCode;
      const latencySeconds = parseFloat(match[5]);
      const latencyMs = Math.round(latencySeconds * 1000 * 100) / 100; // Round to 2 decimals
      const isCached = parseInt(match[6]) === 1;
      const size = parseInt(match[7]);

      // Determine block status (e.g., if responseCode is NXDOMAIN and domain is blocked)
      const isBlocked = responseCode === 'NXDOMAIN' && isCached && latencyMs < 2; // Simple heuristic for local blocklist

      const logEntry: QueryLogEntry = {
        id: Date.now() + Math.floor(Math.random() * 1000000),
        timestamp: Date.now(),
        domain,
        type,
        clientIp,
        responseCode,
        latencyMs,
        source: isBlocked ? 'blocked' : (isCached ? 'cache' : 'recursive'),
        blocked: isBlocked,
        cached: isCached,
      };

      // Append to memory log buffer
      this.queryBuffer.push(logEntry);

      // Trigger event
      this.emit('query', logEntry);

      // Stream log entry to active WebSockets immediately
      broadcastCallback(WS_TYPES.QUERY_LOG, logEntry);

    } catch (err) {
      // Fail silently for unparseable lines to protect stability
    }
  }
}

export const logMonitor = new LogMonitor();
export default logMonitor;
