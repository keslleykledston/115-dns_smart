import fs from 'fs';
import path from 'path';
import fileURLToPath from 'url';
import { Database } from 'better-sqlite3';
import unboundClient from './unbound-client.js';

const __filename = fileURLToPath.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigGenerator {
  private configDir: string;

  constructor() {
    // Config files shared via volume mount /etc/unbound
    this.configDir = process.env.UNBOUND_CONFIG_DIR || '/etc/unbound';
    
    // Local fallback for dev
    if (!fs.existsSync(this.configDir)) {
      this.configDir = path.join(__dirname, '../../../unbound');
    }
  }

  /**
   * Regenerate both local-records.conf and blocklist.conf, then trigger Unbound reload
   */
  public async syncAll(db: Database): Promise<boolean> {
    try {
      console.log('Syncing all DNS configurations to Unbound...');
      
      const recordsSynced = this.generateLocalRecords(db);
      const blocklistSynced = this.generateBlocklists(db);
      const forwardersSynced = this.generateForwarders(db);

      if (recordsSynced && blocklistSynced && forwardersSynced) {
        console.log('Config files written. Triggering Unbound reload...');
        const reloadSuccess = await unboundClient.reload();
        if (reloadSuccess) {
          console.log('Unbound successfully reloaded config!');
          return true;
        } else {
          console.error('Unbound reload failed.');
        }
      }
      return false;
    } catch (err) {
      console.error('Error during Unbound sync:', err);
      return false;
    }
  }

  /**
   * Generate local-records.conf containing all local zones and records
   */
  private generateLocalRecords(db: Database): boolean {
    try {
      const filePath = path.join(this.configDir, 'local-records.conf');
      let configContent = '# Dynamically generated local zones & custom records\n# Created by DNS Smart GUI\n\n';

      // 1. Fetch active zones
      const zones = db.prepare('SELECT * FROM zones WHERE enabled = 1').all() as any[];

      for (const zone of zones) {
        configContent += `# === Zone: ${zone.name} (${zone.type}) ===\n`;
        
        // Define local-zone
        // 'primary' (redirects queries here), 'forwarder' (forward if not matched)
        const zoneType = zone.type === 'primary' ? 'transparent' : 'typetransparent';
        configContent += `local-zone: "${zone.name}." ${zoneType}\n`;

        // 2. Fetch active records for this zone
        const records = db.prepare('SELECT * FROM records WHERE zone_id = ? AND enabled = 1').all(zone.id) as any[];

        for (const record of records) {
          const name = record.name === '@' ? zone.name : `${record.name}.${zone.name}`;
          const rtype = record.type;
          const ttl = record.ttl;
          let rvalue = record.value;

          // Format value based on record type
          if (rtype === 'TXT') {
            // Unbound TXT records must be enclosed in quotes
            if (!rvalue.startsWith('"') && !rvalue.endsWith('"')) {
              rvalue = `"${rvalue}"`;
            }
          } else if (rtype === 'MX') {
            const priority = record.priority ?? 10;
            rvalue = `${priority} ${rvalue}`;
          } else if (rtype === 'SRV') {
            const priority = record.priority ?? 10;
            const weight = record.weight ?? 10;
            const port = record.port ?? 80;
            rvalue = `${priority} ${weight} ${port} ${rvalue}`;
          }

          configContent += `local-data: "${name}. ${ttl} IN ${rtype} ${rvalue}"\n`;
          
          // Generate PTR automatically for A/AAAA records if zone is a reverse zone
          if (zone.name.endsWith('in-addr.arpa') && rtype === 'A') {
            configContent += `local-data-ptr: "${rvalue} ${name}."\n`;
          }
        }
        configContent += '\n';
      }

      fs.writeFileSync(filePath, configContent);
      console.log(`Generated ${filePath}`);
      return true;
    } catch (err) {
      console.error('Failed to generate local records config:', err);
      return false;
    }
  }

  /**
   * Generate blocklist.conf with always_nxdomain entries
   */
  private generateBlocklists(db: Database): boolean {
    try {
      const filePath = path.join(this.configDir, 'blocklist.conf');
      let configContent = '# Dynamically generated DNS blocklist\n# Created by DNS Smart GUI\n\n';

      // Check if blocklisting is globally enabled in config table
      const blocklistEnabledConfig = db.prepare("SELECT value FROM config WHERE key = 'blocklist_enabled'").get() as any;
      const isEnabled = blocklistEnabledConfig ? blocklistEnabledConfig.value === 'true' : true;

      if (isEnabled) {
        // Fetch all active domains to block
        const blocklistActive = db.prepare('SELECT domain FROM blocked_domains').all() as any[];
        
        if (blocklistActive.length > 0) {
          configContent += `# Blocking ${blocklistActive.length} domains\n`;
          for (const entry of blocklistActive) {
            configContent += `local-zone: "${entry.domain}" always_nxdomain\n`;
          }
        } else {
          configContent += '# No domains in blocklist\n';
        }
      } else {
        configContent += '# Blocklist is globally disabled in config settings\n';
      }

      fs.writeFileSync(filePath, configContent);
      console.log(`Generated ${filePath}`);
      return true;
    } catch (err) {
      console.error('Failed to generate blocklist config:', err);
      return false;
    }
  }

  /**
   * Generate forwarders.conf with enabled upstream servers
   */
  private generateForwarders(db: Database): boolean {
    try {
      const filePath = path.join(this.configDir, 'forwarders.conf');
      let configContent = '# Dynamically generated DNS forwarders\n# Created by DNS Smart GUI\n\n';

      // Fetch active forwarders sorted by priority
      const forwarders = db.prepare('SELECT * FROM forwarders WHERE enabled = 1 ORDER BY priority ASC').all() as any[];

      if (forwarders.length > 0) {
        configContent += 'forward-zone:\n';
        configContent += '  name: "."\n';
        
        for (const f of forwarders) {
          // If port is custom, append @port to address
          const portSuffix = f.port && f.port !== 53 ? `@${f.port}` : '';
          configContent += `  forward-addr: ${f.address}${portSuffix}\n`;
        }
      } else {
        // If no forwarders are defined, default to pure recursive resolution!
        configContent += '# No forwarders configured. Operating in pure recursive mode.\n';
      }

      fs.writeFileSync(filePath, configContent);
      console.log(`Generated ${filePath}`);
      return true;
    } catch (err) {
      console.error('Failed to generate forwarders config:', err);
      return false;
    }
  }
}

// Export singleton instance
export const configGenerator = new ConfigGenerator();
export default configGenerator;
