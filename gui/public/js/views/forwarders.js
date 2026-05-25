/**
 * DNS Smart GUI — Upstream DNS Forwarders View
 */
import { $, createElement } from '../utils/dom.js';
import ApiClient from '../api.js';
import { Table } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { formatLatency } from '../utils/format.js';
export class ForwardersView {
    static table = null;
    static container;
    static async render(container) {
        this.container = container;
        container.innerHTML = `
      <div class="view-enter">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <h2>Upstream DNS Forwarders</h2>
            <p>Monitore e adicione provedores DNS recursivos (ex: Cloudflare, Google) e ordene sua prioridade</p>
          </div>
          <button id="btn-add-forwarder" class="btn btn-primary">
            ➕ Add Upstream DNS
          </button>
        </div>

        <div class="glass-card">
          <div id="forwarders-table-container">
            <div class="shimmer" style="height: 200px; border-radius: var(--radius-sm);"></div>
          </div>
        </div>
      </div>
    `;
        this.initTable();
        await this.loadForwarders();
        // Attach Add Action
        $('#btn-add-forwarder', container).addEventListener('click', () => {
            this.showAddForwarderModal();
        });
    }
    static initTable() {
        const tableDiv = $('#forwarders-table-container', this.container);
        this.table = new Table(tableDiv, [
            { key: 'name', label: 'Name', render: (val) => `<span style="font-weight: 600;">${val}</span>` },
            { key: 'address', label: 'IP Address', render: (val) => `<span class="font-mono text-cyan">${val}</span>` },
            { key: 'port', label: 'Port', render: (val) => `<span class="font-mono">${val}</span>` },
            { key: 'protocol', label: 'Protocol', render: (val) => `<span class="badge" style="background: rgba(99,179,237,0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.08);">${val.toUpperCase()}</span>` },
            { key: 'priority', label: 'Priority / Order', render: (val) => `<span class="font-mono" style="font-weight: bold;">#${val}</span>` },
            {
                key: 'status',
                label: 'Status',
                render: (val) => {
                    const badgeClass = val === 'up' ? 'badge-online' : 'badge-offline';
                    return `<span class="badge ${badgeClass}">${val.toUpperCase()}</span>`;
                }
            },
            {
                key: 'avg_rtt_ms',
                label: 'Latency (Avg RTT)',
                render: (val) => `<span class="font-mono" style="font-weight: bold; color: var(--accent-cyan);">${formatLatency(val || 12)}</span>`
            },
            {
                key: 'enabled',
                label: 'Toggle State',
                render: (val, row) => {
                    const toggle = createElement('button', ['btn', 'btn-secondary'], { style: 'padding: 4px 10px; font-size: 0.8rem;' });
                    toggle.innerText = val ? '🟢 Enabled' : '🔴 Disabled';
                    toggle.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.toggleForwarder(row);
                    });
                    return toggle;
                }
            },
            {
                key: 'id',
                label: 'Actions',
                render: (val, row) => {
                    const btn = createElement('button', ['btn', 'btn-danger'], { style: 'padding: 6px 12px; font-size: 0.85rem;' });
                    btn.innerText = '🗑️ Delete';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.confirmDeleteForwarder(row);
                    });
                    return btn;
                }
            }
        ]);
    }
    static async loadForwarders() {
        const forwarders = await ApiClient.get('/api/forwarders');
        if (forwarders) {
            this.table?.setData(forwarders);
        }
    }
    static showAddForwarderModal() {
        const bodyHtml = `
      <form id="add-forwarder-form" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label for="fwd-name">Forwarder Name</label>
          <input type="text" id="fwd-name" class="input-field" placeholder="Quad9 Secure" required>
        </div>
        <div class="form-group">
          <label for="fwd-address">IP Address</label>
          <input type="text" id="fwd-address" class="input-field" placeholder="9.9.9.9" required>
        </div>
        <div class="form-group">
          <label for="fwd-port">Port</label>
          <input type="number" id="fwd-port" class="input-field" value="53" min="1" max="65535" required>
        </div>
        <div class="form-group">
          <label for="fwd-protocol">Protocol</label>
          <select id="fwd-protocol" class="input-field" style="background-color: var(--bg-primary);">
            <option value="udp">UDP (Classic)</option>
            <option value="tcp">TCP</option>
          </select>
        </div>
        <div class="form-group">
          <label for="fwd-priority">Priority (lower is tried first)</label>
          <input type="number" id="fwd-priority" class="input-field" value="0" min="0" required>
        </div>
      </form>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-submit-forwarder" class="btn btn-primary">Add Forwarder</button>
    `;
        const modal = Modal.show('Add Upstream DNS Server', bodyHtml, footerHtml);
        $('#btn-submit-forwarder', modal.element).addEventListener('click', async () => {
            const name = $('#fwd-name', modal.element).value;
            const address = $('#fwd-address', modal.element).value;
            const port = parseInt($('#fwd-port', modal.element).value);
            const protocol = $('#fwd-protocol', modal.element).value;
            const priority = parseInt($('#fwd-priority', modal.element).value);
            if (!name || !address) {
                Toast.error('Please fill out all required fields');
                return;
            }
            const submitBtn = $('#btn-submit-forwarder', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Adding...';
            const res = await ApiClient.post('/api/forwarders', { name, address, port, protocol, priority });
            if (res && res.success) {
                Toast.success(`Upstream DNS '${name}' successfully added!`);
                modal.close();
                await this.loadForwarders();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Add Forwarder';
            }
        });
    }
    static async toggleForwarder(row) {
        const newEnabledState = !row.enabled;
        const res = await ApiClient.put(`/api/forwarders/${row.id}`, { enabled: newEnabledState });
        if (res && res.success) {
            Toast.success(`DNS forwarder successfully ${newEnabledState ? 'enabled' : 'disabled'}.`);
            await this.loadForwarders();
        }
    }
    static confirmDeleteForwarder(row) {
        const bodyHtml = `
      <div style="text-align: center; padding: 10px 0;">
        <span style="font-size: 3rem;">🗑️</span>
        <h4 style="margin-top: 16px; font-weight: bold; color: var(--text-primary);">Delete Upstream DNS?</h4>
        <p style="margin-top: 8px; font-size: 0.9rem; color: var(--text-secondary);">
          Do you want to permanently delete upstream forwarder '${row.name}' (${row.address})?
        </p>
      </div>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-delete-fwd-confirm" class="btn btn-danger">Yes, Delete</button>
    `;
        const modal = Modal.show('Delete Forwarder', bodyHtml, footerHtml);
        $('#btn-delete-fwd-confirm', modal.element).addEventListener('click', async () => {
            const submitBtn = $('#btn-delete-fwd-confirm', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Deleting...';
            const res = await ApiClient.delete(`/api/forwarders/${row.id}`);
            if (res && res.success) {
                Toast.success('Upstream DNS successfully deleted.');
                modal.close();
                await this.loadForwarders();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Yes, Delete';
            }
        });
    }
}
export default ForwardersView;
