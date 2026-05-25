/**
 * DNS Smart GUI — Premium Real-Time Dashboard View
 */
import { $, createElement } from '../utils/dom.js';
import ApiClient from '../api.js';
import wsClient from '../websocket.js';
import { formatNumber, formatLatency } from '../utils/format.js';
import { createLineChart, createDoughnutChart, createBarChart, createSparkline, updateChartData, appendChartData, chartColors } from '../components/charts.js';
import { Table } from '../components/table.js';
export class DashboardView {
    static qpsChart = null;
    static typesChart = null;
    static codesChart = null;
    static domainsChart = null;
    static clientsChart = null;
    static sparklines = {};
    static wsUnsubscribe = null;
    static wsLogsUnsubscribe = null;
    static queryLogsTable = null;
    static rawQueryLogs = [];
    static async render(container) {
        container.innerHTML = `
      <div class="view-enter">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <h2>Real-Time DNS Dashboard</h2>
            <p>Monitors network recursion, metrics aggregates, and client security</p>
          </div>
          <div id="dashboard-clock" style="font-family: var(--font-mono); color: var(--text-secondary); background: var(--bg-glass); border: 1px solid var(--border-glass); padding: 8px 16px; border-radius: var(--radius-sm);">
            Live Feed Active
          </div>
        </div>

        <!-- 5 Stats Summary Cards -->
        <div class="stats-grid">
          <div class="glass-card stat-card">
            <div class="stat-header"><span>Total Queries</span><span>🌐</span></div>
            <div id="stat-total-queries" class="stat-value">0</div>
            <div class="sparkline-container"><canvas id="spark-total"></canvas></div>
          </div>
          <div class="glass-card stat-card" style="border-top-color: var(--accent-red);">
            <div class="stat-header"><span>Blocked Queries</span><span>🛡️</span></div>
            <div id="stat-blocked-queries" class="stat-value" style="color: var(--accent-red);">0</div>
            <div class="sparkline-container"><canvas id="spark-blocked"></canvas></div>
          </div>
          <div class="glass-card stat-card" style="border-top-color: var(--accent-yellow);">
            <div class="stat-header"><span>Block Percentage</span><span>🎯</span></div>
            <div id="stat-block-pct" class="stat-value" style="color: var(--accent-yellow);">0%</div>
            <div class="sparkline-container"><canvas id="spark-pct"></canvas></div>
          </div>
          <div class="glass-card stat-card" style="border-top-color: var(--accent-green);">
            <div class="stat-header"><span>Cache Hit Rate</span><span>⚡</span></div>
            <div id="stat-cache-hit" class="stat-value" style="color: var(--accent-green);">0%</div>
            <div class="sparkline-container"><canvas id="spark-hit"></canvas></div>
          </div>
          <div class="glass-card stat-card" style="border-top-color: var(--accent-purple);">
            <div class="stat-header"><span>Active Clients</span><span>👤</span></div>
            <div id="stat-active-clients" class="stat-value" style="color: var(--accent-purple);">0</div>
            <div class="sparkline-container"><canvas id="spark-clients"></canvas></div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-grid">
          <!-- Live QPS line chart -->
          <div class="glass-card">
            <div class="chart-header">
              <h4>Queries Per Second (QPS)</h4>
              <span id="live-qps" class="badge badge-online pulse-glow-green" style="font-family: var(--font-mono);">0.00 QPS</span>
            </div>
            <div class="chart-canvas-container">
              <canvas id="qps-chart"></canvas>
            </div>
          </div>
          
          <!-- Query Types Distribution -->
          <div class="glass-card">
            <div class="chart-header">
              <h4>Query Types</h4>
            </div>
            <div class="chart-canvas-container">
              <canvas id="types-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Donut & Bar Charts Row -->
        <div class="charts-row-equal">
          <div class="glass-card">
            <div class="chart-header"><h4>Top Queried Domains</h4></div>
            <div class="chart-canvas-container"><canvas id="domains-chart"></canvas></div>
          </div>
          <div class="glass-card">
            <div class="chart-header"><h4>Top Active Clients</h4></div>
            <div class="chart-canvas-container"><canvas id="clients-chart"></canvas></div>
          </div>
        </div>

        <!-- Upstream Health Monitors Section -->
        <div class="glass-card" style="margin-bottom: 30px;">
          <div class="chart-header">
            <h4>🧠 Upstream DNS Forwarder Latency (SRTT Selection Active)</h4>
          </div>
          <div id="forwarder-health-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Live scrolling query logs console -->
        <div class="glass-card live-query-section">
          <div class="live-query-header">
            <h4>🟢 Live Queries Stream</h4>
            <a href="#/logs" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;">View Full logs</a>
          </div>
          <div id="dashboard-query-logs-container">
            <!-- Renders dynamically -->
          </div>
        </div>
      </div>
    `;
        // Initialize UI elements, charts
        this.initCharts();
        this.initLogsTable(container);
        // Initial Load
        await this.loadInitialData();
        // Subscribe to WS updates
        this.wsUnsubscribe = wsClient.on('metrics_update', (data) => {
            this.updateDashboardMetrics(data);
        });
        this.wsLogsUnsubscribe = wsClient.on('query_log', (entry) => {
            this.appendLiveQuery(entry);
        });
    }
    static initCharts() {
        const qpsCanvas = $('#qps-chart');
        const typesCanvas = $('#types-chart');
        const domainsCanvas = $('#domains-chart');
        const clientsCanvas = $('#clients-chart');
        this.qpsChart = createLineChart(qpsCanvas, 'QPS');
        this.typesChart = createDoughnutChart(typesCanvas, ['A', 'AAAA', 'CNAME', 'MX', 'TXT'], [0, 0, 0, 0, 0]);
        this.domainsChart = createBarChart(domainsCanvas, 'Hits', chartColors.blue);
        this.clientsChart = createBarChart(clientsCanvas, 'Queries', chartColors.purple);
        // Mini Sparklines
        const sparks = ['total', 'blocked', 'pct', 'hit', 'clients'];
        const colors = [chartColors.blue, chartColors.red, chartColors.yellow, chartColors.green, chartColors.purple];
        sparks.forEach((s, idx) => {
            const canvas = $(`#spark-${s}`);
            if (canvas) {
                this.sparklines[s] = createSparkline(canvas, Array(15).fill(0), colors[idx]);
            }
        });
    }
    static initLogsTable(container) {
        const tableDiv = $('#dashboard-query-logs-container', container);
        this.queryLogsTable = new Table(tableDiv, [
            { key: 'timestamp', label: 'Time', render: (val) => new Date(val).toLocaleTimeString() },
            { key: 'domain', label: 'Query Domain', render: (val) => `<span class="font-mono text-cyan">${val}</span>` },
            { key: 'type', label: 'Type', render: (val) => `<span class="badge" style="background: rgba(99, 179, 237, 0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.08);">${val}</span>` },
            { key: 'clientIp', label: 'Client IP', render: (val) => `<span class="font-mono">${val}</span>` },
            {
                key: 'responseCode',
                label: 'Status',
                render: (val) => {
                    let badgeClass = 'badge-online';
                    if (val === 'NXDOMAIN')
                        badgeClass = 'badge-offline';
                    if (val === 'SERVFAIL')
                        badgeClass = 'badge-offline';
                    return `<span class="badge ${badgeClass}" style="text-transform: none;">${val}</span>`;
                }
            },
            { key: 'latencyMs', label: 'Latency', render: (val) => formatLatency(val) },
            {
                key: 'source',
                label: 'Source',
                render: (val) => {
                    const colors = { cache: 'var(--accent-green)', recursive: 'var(--accent-blue)', blocked: 'var(--accent-red)' };
                    return `<span style="font-weight: 600; color: ${colors[val] || 'var(--text-secondary)'}; text-transform: capitalize;">${val}</span>`;
                }
            }
        ]);
    }
    static async loadInitialData() {
        // 1. Load summary cards
        const summary = await ApiClient.get('/api/dashboard/stats');
        if (summary) {
            $('#stat-total-queries').innerText = formatNumber(summary.totalQueries);
            $('#stat-blocked-queries').innerText = formatNumber(summary.blockedQueries);
            $('#stat-block-pct').innerText = `${summary.blockPercentage.toFixed(2)}%`;
            $('#stat-cache-hit').innerText = `${summary.cacheHitRate.toFixed(2)}%`;
            $('#stat-active-clients').innerText = formatNumber(summary.activeClients);
            const statusBadge = $('#server-status-badge');
            statusBadge.innerText = summary.serverStatus.toUpperCase();
            statusBadge.className = `badge ${summary.serverStatus === 'online' ? 'badge-online' : 'badge-offline'}`;
        }
        // 2. Load recent logs to populate console initially
        const logs = await ApiClient.get('/api/logs?limit=15');
        if (logs) {
            this.rawQueryLogs = logs;
            this.queryLogsTable?.setData(this.rawQueryLogs);
        }
        // 3. Load realtime metrics snapshot to initial charts populate
        const snap = await ApiClient.get('/api/dashboard/realtime');
        if (snap) {
            this.updateDashboardMetrics(snap);
        }
    }
    static updateDashboardMetrics(metrics) {
        if (!metrics)
            return;
        // Trigger glowing transitions on changes
        this.updateCardValue($('#stat-total-queries'), formatNumber(metrics.totalQueries));
        this.updateCardValue($('#stat-blocked-queries'), formatNumber(metrics.blockedQueries));
        const blockPct = metrics.totalQueries > 0 ? (metrics.blockedQueries / metrics.totalQueries) * 100 : 0;
        this.updateCardValue($('#stat-block-pct'), `${blockPct.toFixed(2)}%`);
        this.updateCardValue($('#stat-cache-hit'), `${metrics.cacheHitRate.toFixed(2)}%`);
        this.updateCardValue($('#stat-active-clients'), formatNumber(metrics.activeClients));
        $('#live-qps').innerText = `${metrics.qps.toFixed(2)} QPS`;
        // QPS Sliding Chart append
        appendChartData(this.qpsChart, metrics.qps);
        // Sparklines data rolling
        this.rollSparkline('total', metrics.totalQueries);
        this.rollSparkline('blocked', metrics.blockedQueries);
        this.rollSparkline('pct', blockPct);
        this.rollSparkline('hit', metrics.cacheHitRate);
        this.rollSparkline('clients', metrics.activeClients);
        // Query Types Doughnut
        if (metrics.queryTypes) {
            const labels = Object.keys(metrics.queryTypes);
            const data = Object.values(metrics.queryTypes);
            updateChartData(this.typesChart, data, labels);
        }
        // Top Domains bar chart
        if (metrics.topDomains) {
            const labels = metrics.topDomains.map((d) => d.domain);
            const data = metrics.topDomains.map((d) => d.count);
            updateChartData(this.domainsChart, data, labels);
        }
        // Top Clients bar chart
        if (metrics.topClients) {
            const labels = metrics.topClients.map((c) => c.client);
            const data = metrics.topClients.map((c) => c.count);
            updateChartData(this.clientsChart, data, labels);
        }
        // Upstream Forwarders Health cards
        if (metrics.forwarders) {
            this.renderForwardersHealth(metrics.forwarders);
        }
    }
    static updateCardValue(element, newValue) {
        if (element.innerText !== newValue) {
            element.innerText = newValue;
            element.classList.remove('count-change');
            void element.offsetWidth; // Force CSS reflow
            element.classList.add('count-change');
        }
    }
    static rollSparkline(sparkKey, newValue) {
        const chart = this.sparklines[sparkKey];
        if (!chart)
            return;
        const data = chart.data.datasets[0].data;
        data.push(newValue);
        if (data.length > 15) {
            data.shift();
        }
        chart.update('none');
    }
    static renderForwardersHealth(forwarders) {
        const container = $('#forwarder-health-container');
        if (!container)
            return;
        container.innerHTML = '';
        forwarders.forEach(f => {
            const isUp = f.status === 'up' || f.status === 'unknown';
            const card = createElement('div', ['glass-card'], { style: `padding: 16px; border-radius: var(--radius-sm); border-left: 4px solid ${isUp ? 'var(--accent-green)' : 'var(--accent-red)'}; display: flex; flex-direction: column; gap: 8px;` });
            const statusClass = isUp ? 'badge-online' : 'badge-offline';
            const statusText = isUp ? 'online' : f.status;
            card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 600; font-family: var(--font-mono);">${f.address}</span>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
          <span style="color: var(--text-secondary); font-size: 0.85rem;">Avg Latency (SRTT):</span>
          <span style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">${f.avgRttMs.toFixed(1)} ms</span>
        </div>
      `;
            container.appendChild(card);
        });
    }
    static appendLiveQuery(entry) {
        this.rawQueryLogs.push(entry);
        if (this.rawQueryLogs.length > 50) {
            this.rawQueryLogs.shift();
        }
        this.queryLogsTable?.setData(this.rawQueryLogs);
    }
    static destroy() {
        this.cleanup();
    }
    static cleanup() {
        if (this.wsUnsubscribe) {
            this.wsUnsubscribe();
            this.wsUnsubscribe = null;
        }
        if (this.wsLogsUnsubscribe) {
            this.wsLogsUnsubscribe();
            this.wsLogsUnsubscribe = null;
        }
        // Destroy charts
        if (this.qpsChart)
            this.qpsChart.destroy();
        if (this.typesChart)
            this.typesChart.destroy();
        if (this.domainsChart)
            this.domainsChart.destroy();
        if (this.clientsChart)
            this.clientsChart.destroy();
        Object.values(this.sparklines).forEach(s => s.destroy());
        this.sparklines = {};
    }
}
export default DashboardView;
