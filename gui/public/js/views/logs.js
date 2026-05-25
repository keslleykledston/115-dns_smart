/**
 * DNS Smart GUI — Advanced Query Logs Viewer View
 */
import { $ } from '../utils/dom.js';
import ApiClient from '../api.js';
import wsClient from '../websocket.js';
import { formatLatency } from '../utils/format.js';
import { Table } from '../components/table.js';
import { Toast } from '../components/toast.js';
export class LogsView {
    static table = null;
    static container;
    static rawLogs = [];
    static wsUnsubscribe = null;
    static isAutoRefresh = true;
    // Filter params
    static currentPage = 1;
    static searchVal = '';
    static typeVal = '';
    static rcodeVal = '';
    static async render(container) {
        this.container = container;
        container.innerHTML = `
      <div class="view-enter">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <h2>System Query Logs</h2>
            <p>Monitore e filtre as consultas de rede recursivas e locais processadas em tempo real</p>
          </div>
          <div style="display: flex; gap: 12px;">
            <button id="btn-clear-logs" class="btn btn-secondary">
              🧹 Clear Console Buffer
            </button>
            <button id="btn-toggle-auto-refresh" class="btn btn-primary">
              🟢 Auto Stream: ON
            </button>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="glass-card" style="margin-bottom: 24px; padding: 20px; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 16px; align-items: end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label for="filter-search">Search Domain Name</label>
            <input type="text" id="filter-search" class="input-field" placeholder="google.com">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label for="filter-type">Record Type</label>
            <select id="filter-type" class="input-field" style="background-color: var(--bg-primary);">
              <option value="">All Types</option>
              <option value="A">A</option>
              <option value="AAAA">AAAA</option>
              <option value="CNAME">CNAME</option>
              <option value="MX">MX</option>
              <option value="TXT">TXT</option>
              <option value="NS">NS</option>
              <option value="SRV">SRV</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label for="filter-rcode">Response Status</label>
            <select id="filter-rcode" class="input-field" style="background-color: var(--bg-primary);">
              <option value="">All Statuses</option>
              <option value="NOERROR">NOERROR (Success)</option>
              <option value="NXDOMAIN">NXDOMAIN (Not Found)</option>
              <option value="SERVFAIL">SERVFAIL (Server Failure)</option>
              <option value="REFUSED">REFUSED (Refused)</option>
            </select>
          </div>
          <button id="btn-apply-filters" class="btn btn-primary" style="justify-content: center; height: 46px;">
            🔍 Filter Logs
          </button>
        </div>

        <!-- Table Card -->
        <div class="glass-card">
          <div id="logs-table-container">
            <div class="shimmer" style="height: 300px; border-radius: var(--radius-sm);"></div>
          </div>
          
          <!-- Pagination -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 24px;">
            <span id="logs-pagination-info" style="color: var(--text-secondary); font-size: 0.9rem;">
              Showing 0-0 of 0 entries
            </span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-page-prev" class="btn btn-secondary" style="padding: 8px 16px;">Previous</button>
              <button id="btn-page-next" class="btn btn-secondary" style="padding: 8px 16px;">Next</button>
            </div>
          </div>
        </div>
      </div>
    `;
        this.initTable();
        await this.loadLogs();
        // Attach actions
        this.attachEvents();
    }
    static initTable() {
        const tableDiv = $('#logs-table-container', this.container);
        this.table = new Table(tableDiv, [
            {
                key: 'timestamp',
                label: 'Timestamp',
                render: (val) => `<span class="font-mono text-muted">${new Date(val).toLocaleTimeString()}</span>`
            },
            {
                key: 'domain',
                label: 'Queried Domain',
                render: (val) => `<span class="font-mono text-cyan" style="font-weight: 600;">${val}</span>`
            },
            {
                key: 'type',
                label: 'Type',
                render: (val) => `<span class="badge" style="background: rgba(139, 92, 246, 0.1); color: var(--accent-purple); border: 1px solid rgba(139, 92, 246, 0.15);">${val}</span>`
            },
            {
                key: 'clientIp',
                label: 'Client IP Address',
                render: (val) => `<span class="font-mono">${val}</span>`
            },
            {
                key: 'responseCode',
                label: 'Status Code',
                render: (val) => {
                    let badgeClass = 'badge-online';
                    if (val === 'NXDOMAIN')
                        badgeClass = 'badge-offline';
                    if (val === 'SERVFAIL')
                        badgeClass = 'badge-offline';
                    return `<span class="badge ${badgeClass}" style="text-transform: none;">${val}</span>`;
                }
            },
            {
                key: 'latencyMs',
                label: 'Latency',
                render: (val) => formatLatency(val)
            },
            {
                key: 'source',
                label: 'Source Method',
                render: (val) => {
                    const colors = { cache: 'var(--accent-green)', recursive: 'var(--accent-blue)', blocked: 'var(--accent-red)' };
                    return `<span style="font-weight: 600; color: ${colors[val] || 'var(--text-secondary)'}; text-transform: capitalize;">${val}</span>`;
                }
            }
        ]);
    }
    static async loadLogs() {
        let url = `/api/logs?page=${this.currentPage}&limit=50`;
        if (this.searchVal)
            url += `&search=${encodeURIComponent(this.searchVal)}`;
        if (this.typeVal)
            url += `&type=${this.typeVal}`;
        if (this.rcodeVal)
            url += `&rcode=${this.rcodeVal}`;
        const res = await ApiClient.getPaginated(url);
        if (res) {
            this.rawLogs = res.data;
            this.table?.setData(this.rawLogs);
            const total = res.total;
            const start = (this.currentPage - 1) * 50 + 1;
            const end = Math.min(start + 49, total);
            $('#logs-pagination-info').innerText = total > 0
                ? `Showing ${start}-${end} of ${total} logs (Buffered)`
                : 'Showing 0-0 of 0 logs';
            $('#btn-page-prev').disabled = this.currentPage === 1;
            $('#btn-page-next').disabled = end >= total;
        }
    }
    static attachEvents() {
        // 1. Toggle stream
        const toggleBtn = $('#btn-toggle-auto-refresh');
        toggleBtn.addEventListener('click', () => {
            this.isAutoRefresh = !this.isAutoRefresh;
            if (this.isAutoRefresh) {
                toggleBtn.className = 'btn btn-primary';
                toggleBtn.innerText = '🟢 Auto Stream: ON';
                this.subscribeWebSocket();
                Toast.info('Log streaming restarted.');
            }
            else {
                toggleBtn.className = 'btn btn-secondary';
                toggleBtn.innerText = '🔴 Auto Stream: OFF';
                this.unsubscribeWebSocket();
                Toast.warning('Log streaming paused.');
            }
        });
        // 2. Clear console buffer
        $('#btn-clear-logs').addEventListener('click', async () => {
            const res = await ApiClient.delete('/api/logs/clear');
            if (res && res.success) {
                Toast.success('Logs buffer successfully cleared.');
                this.rawLogs = [];
                this.table?.setData([]);
                $('#logs-pagination-info').innerText = 'Showing 0-0 of 0 logs';
            }
        });
        // 3. Apply Filters
        $('#btn-apply-filters').addEventListener('click', async () => {
            this.searchVal = $('#filter-search').value;
            this.typeVal = $('#filter-type').value;
            this.rcodeVal = $('#filter-rcode').value;
            this.currentPage = 1;
            await this.loadLogs();
            Toast.success('Filters applied successfully.');
        });
        // 4. Pagination
        $('#btn-page-prev').addEventListener('click', async () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                await this.loadLogs();
            }
        });
        $('#btn-page-next').addEventListener('click', async () => {
            this.currentPage++;
            await this.loadLogs();
        });
        // Default WebSocket subscribe
        this.subscribeWebSocket();
    }
    static subscribeWebSocket() {
        this.unsubscribeWebSocket();
        this.wsUnsubscribe = wsClient.on('query_log', (entry) => {
            // Prepend logs to table dynamically in real-time IF we are on page 1 and no filters are set
            if (this.isAutoRefresh && this.currentPage === 1 && !this.searchVal && !this.typeVal && !this.rcodeVal) {
                this.rawLogs.unshift(entry);
                if (this.rawLogs.length > 50) {
                    this.rawLogs.pop();
                }
                this.table?.setData(this.rawLogs);
            }
        });
    }
    static unsubscribeWebSocket() {
        if (this.wsUnsubscribe) {
            this.wsUnsubscribe();
            this.wsUnsubscribe = null;
        }
    }
    static destroy() {
        this.unsubscribeWebSocket();
    }
}
export default LogsView;
