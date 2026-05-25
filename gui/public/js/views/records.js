/**
 * DNS Smart GUI — Zone DNS Records Management View
 */
import { $, createElement } from '../utils/dom.js';
import ApiClient from '../api.js';
import { Table } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
export class RecordsView {
    static table = null;
    static container;
    static zoneId;
    static zoneName = '';
    static async render(container, params) {
        this.container = container;
        this.zoneId = parseInt(params.id);
        container.innerHTML = `
      <div class="view-enter">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px;">
              <a href="#/zones" style="color: var(--accent-cyan); font-weight: 500;">🌐 Local Zones</a> &gt; <span id="zone-breadcrumb">Loading Zone...</span>
            </div>
            <h2 id="zone-title-header">Zone Records</h2>
            <p>Gerencie registros DNS específicos hospedados dentro deste domínio local</p>
          </div>
          <button id="btn-add-record" class="btn btn-primary">
            ➕ Add Record
          </button>
        </div>

        <div class="glass-card">
          <div id="records-table-container">
            <div class="shimmer" style="height: 200px; border-radius: var(--radius-sm);"></div>
          </div>
        </div>
      </div>
    `;
        this.initTable();
        await this.loadZoneAndRecords();
        // Attach Add Action
        $('#btn-add-record', container).addEventListener('click', () => {
            this.showAddRecordModal();
        });
    }
    static initTable() {
        const tableDiv = $('#records-table-container', this.container);
        this.table = new Table(tableDiv, [
            {
                key: 'name',
                label: 'Name / Host',
                render: (val) => `<span class="font-mono" style="font-weight: 600;">${val === '@' ? '@ (root)' : val}</span>`
            },
            {
                key: 'type',
                label: 'Type',
                render: (val) => `<span class="badge" style="background: rgba(139, 92, 246, 0.1); color: var(--accent-purple); border: 1px solid rgba(139, 92, 246, 0.2);">${val}</span>`
            },
            {
                key: 'value',
                label: 'Value / Target',
                render: (val, row) => {
                    let extra = '';
                    if (row.type === 'MX') {
                        extra = `<span style="opacity: 0.5; font-size: 0.85rem;">[Priority: ${row.priority ?? 10}]</span> `;
                    }
                    else if (row.type === 'SRV') {
                        extra = `<span style="opacity: 0.5; font-size: 0.85rem;">[Port: ${row.port ?? 80}, Weight: ${row.weight ?? 10}]</span> `;
                    }
                    return `<span class="font-mono text-cyan" style="word-break: break-all;">${extra}${val}</span>`;
                }
            },
            {
                key: 'ttl',
                label: 'TTL (sec)',
                render: (val) => `<span class="font-mono">${val}s</span>`
            },
            {
                key: 'enabled',
                label: 'Status',
                render: (val, row) => {
                    const toggle = createElement('button', ['btn', 'btn-secondary'], { style: 'padding: 4px 10px; font-size: 0.8rem;' });
                    toggle.innerText = val ? '🟢 Enabled' : '🔴 Disabled';
                    toggle.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.toggleRecord(row);
                    });
                    return toggle;
                }
            },
            {
                key: 'id',
                label: 'Actions',
                render: (val, row) => {
                    const btn = createElement('button', ['btn', 'btn-danger'], { style: 'padding: 6px 12px; font-size: 0.85rem;' });
                    btn.innerText = 'Delete';
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.confirmDeleteRecord(row);
                    });
                    return btn;
                }
            }
        ]);
    }
    static async loadZoneAndRecords() {
        // 1. Fetch zone details
        const zones = await ApiClient.get('/api/zones');
        if (zones) {
            const currentZone = zones.find((z) => z.id === this.zoneId);
            if (currentZone) {
                this.zoneName = currentZone.name;
                $('#zone-breadcrumb').innerText = currentZone.name;
                $('#zone-title-header').innerText = `Records for ${currentZone.name}`;
            }
        }
        // 2. Fetch records
        const records = await ApiClient.get(`/api/zones/${this.zoneId}/records`);
        if (records) {
            this.table?.setData(records);
        }
    }
    static showAddRecordModal() {
        const bodyHtml = `
      <form id="add-record-form" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label for="record-name">Name / Host (@ for zone root)</label>
          <input type="text" id="record-name" class="input-field" placeholder="www" required>
        </div>
        <div class="form-group">
          <label for="record-type">Record Type</label>
          <select id="record-type" class="input-field" style="background-color: var(--bg-primary);">
            <option value="A">A (IPv4 Address)</option>
            <option value="AAAA">AAAA (IPv6 Address)</option>
            <option value="CNAME">CNAME (Alias)</option>
            <option value="MX">MX (Mail Exchanger)</option>
            <option value="TXT">TXT (Text String)</option>
            <option value="NS">NS (Nameserver)</option>
            <option value="SRV">SRV (Service Finder)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="record-value">Value / Target</label>
          <input type="text" id="record-value" class="input-field" placeholder="192.168.1.100" required>
        </div>
        
        <!-- MX Specific -->
        <div id="group-mx" class="form-group" style="display: none;">
          <label for="record-priority">Priority</label>
          <input type="number" id="record-priority" class="input-field" value="10" min="0">
        </div>

        <!-- SRV Specific -->
        <div id="group-srv" style="display: none; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;">
          <div class="form-group">
            <label for="record-port">Port</label>
            <input type="number" id="record-port" class="input-field" value="80" min="1" max="65535">
          </div>
          <div class="form-group">
            <label for="record-weight">Weight</label>
            <input type="number" id="record-weight" class="input-field" value="10" min="0">
          </div>
        </div>

        <div class="form-group">
          <label for="record-ttl">TTL (seconds)</label>
          <input type="number" id="record-ttl" class="input-field" value="3600" min="60" required>
        </div>
      </form>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-submit-record" class="btn btn-primary">Add Record</button>
    `;
        const modal = Modal.show('Add DNS Record', bodyHtml, footerHtml);
        // Watch type change to show/hide dynamic fields
        const typeSelect = $('#record-type', modal.element);
        const groupMx = $('#group-mx', modal.element);
        const groupSrv = $('#group-srv', modal.element);
        const valueField = $('#record-value', modal.element);
        typeSelect.addEventListener('change', () => {
            const type = typeSelect.value;
            // Hide all specific groups
            groupMx.style.display = 'none';
            groupSrv.style.display = 'none';
            if (type === 'MX') {
                groupMx.style.display = 'flex';
                valueField.placeholder = 'mail.domain.com';
            }
            else if (type === 'SRV') {
                groupMx.style.display = 'flex'; // SRV also has priority
                groupSrv.style.display = 'grid';
                valueField.placeholder = 'target.domain.com';
            }
            else if (type === 'A') {
                valueField.placeholder = '192.168.1.100';
            }
            else if (type === 'AAAA') {
                valueField.placeholder = '2001:db8::1';
            }
            else if (type === 'CNAME') {
                valueField.placeholder = 'target.domain.com';
            }
            else if (type === 'TXT') {
                valueField.placeholder = 'v=spf1 include:_spf.google.com ~all';
            }
        });
        $('#btn-submit-record', modal.element).addEventListener('click', async () => {
            const name = $('#record-name', modal.element).value;
            const type = typeSelect.value;
            const value = valueField.value;
            const ttl = parseInt($('#record-ttl', modal.element).value);
            const priority = $('#record-priority', modal.element)?.value;
            const weight = $('#record-weight', modal.element)?.value;
            const port = $('#record-port', modal.element)?.value;
            if (!name || !value) {
                Toast.error('Please fill out all required fields');
                return;
            }
            const submitBtn = $('#btn-submit-record', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Adding...';
            const body = {
                name,
                type,
                value,
                ttl,
                priority: priority ? parseInt(priority) : undefined,
                weight: weight ? parseInt(weight) : undefined,
                port: port ? parseInt(port) : undefined,
            };
            const res = await ApiClient.post(`/api/zones/${this.zoneId}/records`, body);
            if (res && res.success) {
                Toast.success('DNS record added successfully!');
                modal.close();
                await this.loadZoneAndRecords();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Add Record';
            }
        });
    }
    static async toggleRecord(record) {
        const newEnabledState = !record.enabled;
        const res = await ApiClient.put(`/api/zones/${this.zoneId}/records/${record.id}`, {
            enabled: newEnabledState
        });
        if (res && res.success) {
            Toast.success(`DNS record successfully ${newEnabledState ? 'enabled' : 'disabled'}.`);
            await this.loadZoneAndRecords();
        }
    }
    static confirmDeleteRecord(record) {
        const bodyHtml = `
      <div style="text-align: center; padding: 10px 0;">
        <span style="font-size: 3rem;">🗑️</span>
        <h4 style="margin-top: 16px; font-weight: bold; color: var(--text-primary);">Delete DNS Record?</h4>
        <p style="margin-top: 8px; font-size: 0.9rem; color: var(--text-secondary);">
          Do you want to permanently delete record '${record.name === '@' ? '@' : record.name}' of type ${record.type}?
        </p>
      </div>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-delete-record-confirm" class="btn btn-danger">Yes, Delete Record</button>
    `;
        const modal = Modal.show('Delete Record', bodyHtml, footerHtml);
        $('#btn-delete-record-confirm', modal.element).addEventListener('click', async () => {
            const submitBtn = $('#btn-delete-record-confirm', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Deleting...';
            const res = await ApiClient.delete(`/api/zones/${this.zoneId}/records/${record.id}`);
            if (res && res.success) {
                Toast.success('DNS record successfully deleted.');
                modal.close();
                await this.loadZoneAndRecords();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Yes, Delete Record';
            }
        });
    }
}
export default RecordsView;
