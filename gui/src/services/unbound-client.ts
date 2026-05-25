import tls from 'tls';
import fs from 'fs';
import path from 'path';
import fileURLToPath from 'url';

const __filename = fileURLToPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class UnboundClient {
  private host: string;
  private port: number;
  private certsDir: string;

  constructor() {
    this.host = process.env.DNS_SERVER_HOST || 'dns-server';
    this.port = parseInt(process.env.UNBOUND_CONTROL_PORT || '8953');
    // Certs are shared via volume at /etc/unbound or mounted locally
    this.certsDir = process.env.UNBOUND_CERTS_DIR || '/etc/unbound';
    
    // Fallback for local development
    if (!fs.existsSync(this.certsDir)) {
      this.certsDir = path.join(__dirname, '../../../unbound');
    }
  }

  /**
   * Send a command to unbound-control via TLS socket
   */
  public executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const keyFile = path.join(this.certsDir, 'unbound_control.key');
      const certFile = path.join(this.certsDir, 'unbound_control.pem');
      const caFile = path.join(this.certsDir, 'unbound_server.pem');

      if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
        return reject(new Error(`Unbound control certificates not found in ${this.certsDir}. Verify volume share.`));
      }

      const options = {
        key: fs.readFileSync(keyFile),
        cert: fs.readFileSync(certFile),
        ca: [fs.readFileSync(caFile)],
        rejectUnauthorized: false, // In docker-compose, hostname might be container IP and mismatch certificate name 'unbound'
      };

      const client = tls.connect(this.port, this.host, options, () => {
        // Send command version check/command header
        // Unbound remote control expects: "UBCT1 <command>\n"
        client.write(`UBCT1 ${command}\n`);
      });

      let responseData = '';

      client.on('data', (data) => {
        responseData += data.toString();
      });

      client.on('end', () => {
        resolve(responseData.trim());
      });

      client.on('error', (err) => {
        reject(err);
      });

      // Timeout safety
      client.setTimeout(5000);
      client.on('timeout', () => {
        client.destroy();
        reject(new Error('Connection to unbound-control timed out (5s)'));
      });
    });
  }

  /**
   * Reload Unbound configuration
   */
  public async reload(): Promise<boolean> {
    try {
      const res = await this.executeCommand('reload');
      return res.includes('ok');
    } catch (err) {
      console.error('Failed to reload Unbound:', err);
      return false;
    }
  }

  /**
   * Fetch Unbound statistics
   */
  public async getStats(): Promise<Record<string, number>> {
    try {
      const statsText = await this.executeCommand('stats_noreset');
      const stats: Record<string, number> = {};
      
      statsText.split('\n').forEach((line) => {
        const parts = line.split('=');
        if (parts.length === 2) {
          stats[parts[0]] = parseFloat(parts[1]);
        }
      });
      
      return stats;
    } catch (err) {
      console.error('Failed to fetch Unbound stats:', err);
      return {};
    }
  }

  /**
   * Check if Unbound is running and accepting control connections
   */
  public async status(): Promise<string> {
    try {
      return await this.executeCommand('status');
    } catch (err) {
      return 'stopped';
    }
  }
}

// Export singleton instance
export const unboundClient = new UnboundClient();
export default unboundClient;
