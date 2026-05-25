/**
 * DNS Smart GUI — Local Zones Management View
 */
import { $, createElement } from '../utils/dom.js';
import ApiClient from '../api.js';
import { Table } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
export class ZonesView {
    static table = null;
    static container;
    static async render(container) {
        this.container = container;
        container.innerHTML = `
      <div class="view-enter">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <h2>Local DNS Zones</h2>
            <p>Hospede domínios autoritativos e gerencie registros locais para sua LAN</p>
          </div>
          <button id="btn-add-zone" class="btn btn-primary">
            ➕ Add Local Zone
          </button>
        </div>

        <div class="glass-card">
          <div id="zones-table-container">
            <div class="shimmer" style="height: 200px; border-radius: var(--radius-sm);"></div>
          </div>
        </div>
      </div>
    `;
        this.initTable();
        await this.loadZones();
        // Attach Create Action
        $('#btn-add-zone', container).addEventListener('click', () => {
            this.showAddZoneModal();
        });
    }
    static initTable() {
        const tableDiv = $('#zones-table-container', this.container);
        this.table = new Table(tableDiv, [
            {
                key: 'name',
                label: 'Zone Domain',
                render: (val, row) => `<a href="#/zones/${row.id}/records" style="font-weight: 600; color: var(--accent-cyan); display: flex; align-items: center; gap: 8px;">🌐 ${val}</a>`
            },
            {
                key: 'type',
                label: 'Type',
                render: (val) => {
                    const typeLabels = { primary: 'Primary Authoritative', forwarder: 'Conditional Forwarder' };
                    return `<span class="badge" style="background: rgba(6, 182, 212, 0.1); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.08);">${typeLabels[val] || val}</span>`;
                }
            },
            {
                key: 'record_count',
                label: 'Records Count',
                render: (val) => `<span class="font-mono" style="font-weight: bold;">${val} records</span>`
            },
            {
                key: 'created_at',
                label: 'Created At',
                render: (val) => new Date(val).toLocaleDateString()
            },
            {
                key: 'id',
                label: 'Actions',
                render: (val, row) => {
                    const btn = createElement('button', ['btn', 'btn-danger'], { style: 'padding: 6px 12px; font-size: 0.85rem;' });
                    btn.innerText = '🗑️ Delete';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.confirmDeleteZone(row.id, row.name);
                    });
                    return btn;
                }
            }
        ]);
    }
    static async loadZones() {
        const zones = await ApiClient.get('/api/zones');
        if (zones) {
            this.table?.setData(zones);
        }
    }
    static showAddZoneModal() {
        const bodyHtml = `
      <form id="add-zone-form" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group">
          <label for="zone-name">Zone Domain Name (e.g., local.lan)</label>
          <input type="text" id="zone-name" class="input-field" placeholder="office.local" required>
        </div>
        <div class="form-group">
          <label for="zone-type">Zone Type</label>
          <select id="zone-type" class="input-field" style="background-color: var(--bg-primary);">
            <option value="primary">Primary Authoritative (Local Records)</option>
            <option value="forwarder">Conditional Forwarder</option>
          </select>
        </div>
      </form>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-submit-zone" class="btn btn-primary">Create Zone</button>
    `;
        const modal = Modal.show('Add New Local Zone', bodyHtml, footerHtml);
        $('#btn-submit-zone', modal.element).addEventListener('click', async () => {
            const name = $('#zone-name', modal.element).value;
            const type = $('#zone-type', modal.element).value;
            if (!name) {
                Toast.error('Zone domain name is required');
                return;
            }
            const submitBtn = $('#btn-submit-zone', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Creating...';
            const res = await ApiClient.post('/api/zones', { name, type });
            if (res && res.success) {
                Toast.success(`DNS Zone '${name}' successfully created!`);
                modal.close();
                await this.loadZones();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Create Zone';
            }
        });
    }
    static confirmDeleteZone(id, name) {
        const bodyHtml = `
      <div style="text-align: center; padding: 10px 0;">
        <span style="font-size: 3rem;">⚠️</span>
        <h4 style="margin-top: 16px; font-weight: bold; color: var(--text-primary);">Delete Zone '${name}'?</h4>
        <p style="margin-top: 8px; font-size: 0.9rem; color: var(--text-secondary);">
          This will permanently delete the DNS zone and all custom records hosted within it. 
          This action cannot be undone.
        </p>
      </div>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-delete-zone-confirm" class="btn btn-danger">Yes, Delete Zone</button>
    `;
        const modal = Modal.show('Confirm Deletion', bodyHtml, footerHtml);
        $('#btn-delete-zone-confirm', modal.element).addEventListener('click', async () => {
            const submitBtn = $('#btn-delete-zone-confirm', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Deleting...';
            const res = await ApiClient.delete(`/api/zones/${id}`);
            if (res && res.success) {
                Toast.success(`DNS Zone '${name}' successfully deleted.`);
                modal.close();
                await this.loadZones();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Yes, Delete Zone';
            }
        });
    }
}
export default ZonesView;
