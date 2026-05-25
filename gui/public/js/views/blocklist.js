/**
 * DNS Smart GUI — DNS Firewall & Blocklists View
 */
import { $, createElement } from '../utils/dom.js';
import ApiClient from '../api.js';
import { Table } from '../components/table.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
export class BlocklistView {
    static tableSources = null;
    static tableDomains = null;
    static container;
    static currentPage = 1;
    static searchVal = '';
    static async render(container) {
        this.container = container;
        container.innerHTML = `
      <div class="view-enter">
        <div class="dashboard-header">
          <div class="dashboard-title">
            <h2>DNS Firewall & Blocklists</h2>
            <p>Bloqueie anúncios, rastreadores e ameaças de malware em toda a sua rede local</p>
          </div>
          <div style="display: flex; gap: 12px;">
            <button id="btn-add-custom-block" class="btn btn-secondary">
              🚫 Block Domain
            </button>
            <button id="btn-add-source" class="btn btn-primary">
              ➕ Add Blocklist Source
            </button>
          </div>
        </div>

        <!-- Row 1: Blocklist Sources -->
        <div class="glass-card" style="margin-bottom: 30px;">
          <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">Blocklist Sources</h4>
          <div id="sources-table-container">
            <div class="shimmer" style="height: 150px; border-radius: var(--radius-sm);"></div>
          </div>
        </div>

        <!-- Row 2: Search Individual Blocked Domains -->
        <div class="glass-card">
          <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">Search Blocked Domains Database</h4>
          
          <div style="display: flex; gap: 16px; margin-bottom: 24px; max-width: 600px;">
            <input type="text" id="domain-search-input" class="input-field" placeholder="doubleclick.net">
            <button id="btn-domain-search" class="btn btn-primary" style="padding: 10px 24px;">Search</button>
          </div>

          <div id="domains-table-container">
            <div class="shimmer" style="height: 250px; border-radius: var(--radius-sm);"></div>
          </div>

          <!-- Pagination -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 24px;">
            <span id="domains-pagination-info" style="color: var(--text-secondary); font-size: 0.9rem;">
              Showing 0-0 of 0 entries
            </span>
            <div style="display: flex; gap: 8px;">
              <button id="btn-dom-prev" class="btn btn-secondary" style="padding: 8px 16px;">Previous</button>
              <button id="btn-dom-next" class="btn btn-secondary" style="padding: 8px 16px;">Next</button>
            </div>
          </div>
        </div>
      </div>
    `;
        this.initSourcesTable();
        this.initDomainsTable();
        await this.loadSources();
        await this.loadDomains();
        this.attachEvents();
    }
    static initSourcesTable() {
        const tableDiv = $('#sources-table-container', this.container);
        this.tableSources = new Table(tableDiv, [
            { key: 'name', label: 'Name', render: (val) => `<span style="font-weight: 600;">🛡️ ${val}</span>` },
            { key: 'url', label: 'Feed URL', render: (val) => val ? `<span class="font-mono text-cyan" style="font-size: 0.85rem; word-break: break-all;">${val}</span>` : '<span class="text-muted">Local Custom Blocks</span>' },
            { key: 'entry_count', label: 'Rules Count', render: (val) => `<span class="font-mono" style="font-weight: bold;">${val.toLocaleString()} domains</span>` },
            { key: 'last_updated', label: 'Last Updated', render: (val) => val ? new Date(val).toLocaleString() : '<span class="text-muted">Never</span>' },
            {
                key: 'id',
                label: 'Actions',
                render: (val, row) => {
                    const wrapper = createElement('div', [], { style: 'display: flex; gap: 8px;' });
                    if (row.type === 'url') {
                        const btnUpdate = createElement('button', ['btn', 'btn-primary'], { style: 'padding: 6px 12px; font-size: 0.85rem;' });
                        btnUpdate.innerText = '🔄 Sync Now';
                        btnUpdate.addEventListener('click', () => this.syncBlocklist(row.id, row.name));
                        wrapper.appendChild(btnUpdate);
                    }
                    const btnDel = createElement('button', ['btn', 'btn-danger'], { style: 'padding: 6px 12px; font-size: 0.85rem;' });
                    btnDel.innerText = '🗑️ Delete';
                    btnDel.addEventListener('click', () => this.confirmDeleteSource(row.id, row.name));
                    wrapper.appendChild(btnDel);
                    return wrapper;
                }
            }
        ]);
    }
    static initDomainsTable() {
        const tableDiv = $('#domains-table-container', this.container);
        this.tableDomains = new Table(tableDiv, [
            { key: 'domain', label: 'Blocked Domain Name', render: (val) => `<span class="font-mono text-cyan" style="font-weight: 600;">${val}</span>` },
            { key: 'list_name', label: 'Source List', render: (val) => `<span class="badge" style="background: rgba(239, 68, 68, 0.1); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.15);">${val || 'Custom Block'}</span>` },
            { key: 'created_at', label: 'Blocked At', render: (val) => new Date(val).toLocaleDateString() },
            {
                key: 'id',
                label: 'Action',
                render: (val, row) => {
                    const btn = createElement('button', ['btn', 'btn-danger'], { style: 'padding: 6px 12px; font-size: 0.85rem;' });
                    btn.innerText = '🔓 Unblock';
                    btn.addEventListener('click', () => this.unblockDomain(row.id, row.domain));
                    return btn;
                }
            }
        ]);
    }
    static async loadSources() {
        const sources = await ApiClient.get('/api/blocklist');
        if (sources) {
            this.tableSources?.setData(sources);
        }
    }
    static async loadDomains() {
        let url = `/api/blocklist/domains?page=${this.currentPage}&limit=10`;
        if (this.searchVal) {
            url += `&search=${encodeURIComponent(this.searchVal)}`;
        }
        const res = await ApiClient.getPaginated(url);
        if (res) {
            this.tableDomains?.setData(res.data);
            const total = res.total;
            const start = (this.currentPage - 1) * 10 + 1;
            const end = Math.min(start + 9, total);
            $('#domains-pagination-info').innerText = total > 0
                ? `Showing ${start}-${end} of ${total} blocked domains`
                : 'Showing 0-0 of 0 blocked domains';
            $('#btn-dom-prev').disabled = this.currentPage === 1;
            $('#btn-dom-next').disabled = end >= total;
        }
    }
    static attachEvents() {
        // 1. Add custom domain block
        $('#btn-add-custom-block').addEventListener('click', () => {
            this.showAddCustomBlockModal();
        });
        // 2. Add list source
        $('#btn-add-source').addEventListener('click', () => {
            this.showAddSourceModal();
        });
        // 3. Search domains
        const searchInput = $('#domain-search-input');
        const triggerSearch = async () => {
            this.searchVal = searchInput.value;
            this.currentPage = 1;
            await this.loadDomains();
        };
        $('#btn-domain-search').addEventListener('click', triggerSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')
                triggerSearch();
        });
        // 4. Pagination
        $('#btn-dom-prev').addEventListener('click', async () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                await this.loadDomains();
            }
        });
        $('#btn-dom-next').addEventListener('click', async () => {
            this.currentPage++;
            await this.loadDomains();
        });
    }
    static showAddCustomBlockModal() {
        const bodyHtml = `
      <form id="custom-block-form" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label for="block-domain">Domain Name to Block (e.g. doubleclick.net)</label>
          <input type="text" id="block-domain" class="input-field" placeholder="ads.example.com" required>
        </div>
      </form>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-submit-custom-block" class="btn btn-danger">🚫 Block Domain</button>
    `;
        const modal = Modal.show('Add Custom DNS Block', bodyHtml, footerHtml);
        $('#btn-submit-custom-block', modal.element).addEventListener('click', async () => {
            const domain = $('#block-domain', modal.element).value;
            if (!domain) {
                Toast.error('Domain is required');
                return;
            }
            const submitBtn = $('#btn-submit-custom-block', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Blocking...';
            const res = await ApiClient.post('/api/blocklist/custom-domain', { domain });
            if (res && res.success) {
                Toast.success(`Domain '${domain}' is now blocked!`);
                modal.close();
                await this.loadSources();
                await this.loadDomains();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = '🚫 Block Domain';
            }
        });
    }
    static showAddSourceModal() {
        const bodyHtml = `
      <form id="source-form" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label for="src-name">Blocklist Name</label>
          <input type="text" id="src-name" class="input-field" placeholder="Malware Blocklist" required>
        </div>
        <div class="form-group">
          <label for="src-url">Remote Raw URL (Hosts or Domain list format)</label>
          <input type="url" id="src-url" class="input-field" placeholder="https://..." required>
        </div>
      </form>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-submit-source" class="btn btn-primary">Add Source</button>
    `;
        const modal = Modal.show('Add Blocklist Source', bodyHtml, footerHtml);
        $('#btn-submit-source', modal.element).addEventListener('click', async () => {
            const name = $('#src-name', modal.element).value;
            const url = $('#src-url', modal.element).value;
            if (!name || !url) {
                Toast.error('All fields are required');
                return;
            }
            const submitBtn = $('#btn-submit-source', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Adding...';
            const res = await ApiClient.post('/api/blocklist', { name, url });
            if (res && res.success) {
                Toast.success(`Blocklist source '${name}' successfully added!`);
                modal.close();
                await this.loadSources();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Add Source';
            }
        });
    }
    static async syncBlocklist(id, name) {
        Toast.info(`Downloading and parsing blocklist '${name}' in background...`);
        const res = await ApiClient.post(`/api/blocklist/${id}/update`, {});
        if (res && res.success) {
            Toast.success(res.message);
            await this.loadSources();
            await this.loadDomains();
        }
    }
    static async unblockDomain(id, domain) {
        const res = await ApiClient.delete(`/api/blocklist/domains/${id}`);
        if (res && res.success) {
            Toast.success(`Domain '${domain}' successfully unblocked!`);
            await this.loadSources();
            await this.loadDomains();
        }
    }
    static confirmDeleteSource(id, name) {
        const bodyHtml = `
      <div style="text-align: center; padding: 10px 0;">
        <span style="font-size: 3rem;">⚠️</span>
        <h4 style="margin-top: 16px; font-weight: bold; color: var(--text-primary);">Delete Blocklist Source?</h4>
        <p style="margin-top: 8px; font-size: 0.9rem; color: var(--text-secondary);">
          Do you want to permanently delete blocklist source '${name}'? This will unblock all domains imported from this list.
        </p>
      </div>
    `;
        const footerHtml = `
      <button class="btn btn-secondary btn-close-modal">Cancel</button>
      <button id="btn-del-src-confirm" class="btn btn-danger">Yes, Delete List</button>
    `;
        const modal = Modal.show('Delete Source', bodyHtml, footerHtml);
        $('#btn-del-src-confirm', modal.element).addEventListener('click', async () => {
            const submitBtn = $('#btn-del-src-confirm', modal.element);
            submitBtn.disabled = true;
            submitBtn.innerText = 'Deleting...';
            const res = await ApiClient.delete(`/api/blocklist/${id}`);
            if (res && res.success) {
                Toast.success(`Blocklist source '${name}' deleted.`);
                modal.close();
                await this.loadSources();
                await this.loadDomains();
            }
            else {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Yes, Delete List';
            }
        });
    }
}
export default BlocklistView;
