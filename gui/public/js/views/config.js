/**
 * DNS Smart GUI — Settings & Configuration View
 */
import { $ } from '../utils/dom.js';
import ApiClient from '../api.js';
import { Toast } from '../components/toast.js';
export class ConfigView {
    static container;
    static configMap = {};
    static async render(container) {
        this.container = container;
        container.innerHTML = `
      <div class="view-enter">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <h2>System Settings</h2>
            <p>Ajuste os parâmetros do cache do Unbound, segurança recursiva, rate limiting e logs</p>
          </div>
          <button id="btn-save-config" class="btn btn-primary">
            💾 Save Configurations
          </button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 30px;">
          
          <!-- DNS RESOLUTION & RECURSION -->
          <div class="glass-card">
            <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px; color: var(--accent-cyan);">🌐 DNS Resolution & Recursion</h4>
            
            <div class="form-group">
              <label for="cfg-dnssec_validation">DNSSEC Cryptographic Validation</label>
              <select id="cfg-dnssec_validation" class="input-field" style="background-color: var(--bg-primary);">
                <option value="true">Enable DNSSEC validation</option>
                <option value="false">Disable validation (faster but unverified)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="cfg-qname_minimization">QNAME Minimization (RFC 7816 Privacy)</label>
              <select id="cfg-qname_minimization" class="input-field" style="background-color: var(--bg-primary);">
                <option value="true">Enable (Minimal labels sent upstream)</option>
                <option value="false">Disable (Send full domain labels)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="cfg-dns_port">Standard DNS Port (Requires container reload)</label>
              <input type="number" id="cfg-dns_port" class="input-field" value="53" min="1" max="65535">
            </div>
          </div>

          <!-- UNBOUND CACHE PARAMS -->
          <div class="glass-card">
            <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px; color: var(--accent-green);">⚡ Caching & Performance</h4>
            
            <div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;">
              <div>
                <label for="cfg-cache_min_ttl">Minimum TTL (sec)</label>
                <input type="number" id="cfg-cache_min_ttl" class="input-field" value="30" min="0">
              </div>
              <div>
                <label for="cfg-cache_max_ttl">Maximum TTL (sec)</label>
                <input type="number" id="cfg-cache_max_ttl" class="input-field" value="86400" min="0">
              </div>
            </div>

            <div class="form-group">
              <label for="cfg-prefetch">Predictive Cache Prefetching (Keeps popular domains warm)</label>
              <select id="cfg-prefetch" class="input-field" style="background-color: var(--bg-primary);">
                <option value="true">Enable Prefetching</option>
                <option value="false">Disable Prefetching</option>
              </select>
            </div>

            <div class="form-group">
              <label for="cfg-serve_expired">Serve-Expired (Graceful 72h offline cache fallback)</label>
              <select id="cfg-serve_expired" class="input-field" style="background-color: var(--bg-primary);">
                <option value="true">Enable (RFC 8767 fallback)</option>
                <option value="false">Disable serve-expired</option>
              </select>
            </div>
          </div>

          <!-- SECURITY & RATE LIMITS -->
          <div class="glass-card">
            <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px; color: var(--accent-yellow);">🛡️ Security & DDoS Mitigation</h4>
            
            <div class="form-group" style="display: grid; grid-template-columns: 3fr 1fr; gap: 12px; width: 100%; align-items: end;">
              <div class="form-group" style="margin-bottom: 0;">
                <label for="cfg-rrl_enabled">Response Rate Limiting (RRL)</label>
                <select id="cfg-rrl_enabled" class="input-field" style="background-color: var(--bg-primary);">
                  <option value="true">Enable Rate Limiting (Token Bucket)</option>
                  <option value="false">Disable Rate Limiting</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="cfg-rrl_responses_per_second">RPS Limit</label>
                <input type="number" id="cfg-rrl_responses_per_second" class="input-field" value="5" min="1">
              </div>
            </div>

            <div class="form-group">
              <label for="cfg-rebinding_protection">DNS Rebinding Protection</label>
              <select id="cfg-rebinding_protection" class="input-field" style="background-color: var(--bg-primary);">
                <option value="true">Enable (Strip private IPs from recursive answers)</option>
                <option value="false">Disable protection</option>
              </select>
            </div>
          </div>

          <!-- BLOCKLISTS & FIREWALL -->
          <div class="glass-card">
            <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px; color: var(--accent-red);">🚫 Adblocker & Firewall</h4>
            
            <div class="form-group">
              <label for="cfg-blocklist_enabled">Global Adblocker Engine State</label>
              <select id="cfg-blocklist_enabled" class="input-field" style="background-color: var(--bg-primary);">
                <option value="true">Adblocker Enabled</option>
                <option value="false">Adblocker Disabled (Bypass firewall)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="cfg-blocklist_action">Blocked Domain Action Response</label>
              <select id="cfg-blocklist_action" class="input-field" style="background-color: var(--bg-primary);">
                <option value="nxdomain">Return NXDOMAIN (Not Found)</option>
                <option value="nodata">Return NODATA (Empty response)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="cfg-query_logging">Queries Console Log Logging</label>
              <select id="cfg-query_logging" class="input-field" style="background-color: var(--bg-primary);">
                <option value="true">Log Queries (Required for dashboard charts)</option>
                <option value="false">Disable Logs (Increases speed / privacy)</option>
              </select>
            </div>
          </div>

        </div>
      </div>
    `;
        await this.loadConfig();
        this.attachEvents();
    }
    static async loadConfig() {
        const config = await ApiClient.get('/api/config');
        if (config) {
            this.configMap = config;
            // Populate form fields dynamically
            Object.entries(config).forEach(([key, val]) => {
                const input = $(`#cfg-${key}`);
                if (input) {
                    input.value = String(val);
                }
            });
        }
    }
    static attachEvents() {
        $('#btn-save-config').addEventListener('click', async () => {
            const submitBtn = $('#btn-save-config');
            submitBtn.disabled = true;
            submitBtn.innerText = 'Saving...';
            const updates = {};
            // Gather input values dynamically
            Object.keys(this.configMap).forEach(key => {
                const input = $(`#cfg-${key}`);
                if (input) {
                    updates[key] = input.value;
                }
            });
            const res = await ApiClient.put('/api/config', updates);
            if (res && res.success) {
                Toast.success('Configurations saved and hot-reloaded inside Unbound!');
                await this.loadConfig();
            }
            submitBtn.disabled = false;
            submitBtn.innerText = '💾 Save Configurations';
        });
    }
}
export default ConfigView;
