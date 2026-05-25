/**
 * DNS Smart GUI — Reusable Data Table Component
 */
import { createElement } from '../utils/dom.js';
export class Table {
    columns;
    data = [];
    container;
    onSort;
    currentSortKey = '';
    currentSortDir = 'asc';
    constructor(container, columns, onSort) {
        this.container = container;
        this.columns = columns;
        this.onSort = onSort;
    }
    setData(data) {
        this.data = data;
        this.render();
    }
    render() {
        this.container.innerHTML = '';
        const wrapper = createElement('div', ['table-container']);
        const table = createElement('table', ['custom-table']);
        // 1. Header
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        this.columns.forEach(col => {
            const th = createElement('th');
            th.innerText = col.label;
            if (col.sortable) {
                th.style.cursor = 'pointer';
                th.classList.add('sortable-header');
                if (col.key === this.currentSortKey) {
                    th.innerText += this.currentSortDir === 'asc' ? ' 🔼' : ' 🔽';
                }
                th.addEventListener('click', () => {
                    this.handleSort(col.key);
                });
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        // 2. Body
        const tbody = createElement('tbody');
        if (this.data.length === 0) {
            const tr = createElement('tr');
            const td = createElement('td');
            td.setAttribute('colspan', String(this.columns.length));
            td.style.textAlign = 'center';
            td.style.color = 'var(--text-secondary)';
            td.style.padding = '30px';
            td.innerText = 'No records found.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        else {
            this.data.forEach(row => {
                const tr = createElement('tr');
                this.columns.forEach(col => {
                    const td = createElement('td');
                    const value = row[col.key];
                    if (col.render) {
                        const rendered = col.render(value, row);
                        if (rendered instanceof HTMLElement) {
                            td.appendChild(rendered);
                        }
                        else {
                            td.innerHTML = rendered;
                        }
                    }
                    else {
                        td.innerText = value !== undefined && value !== null ? String(value) : '';
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }
        table.appendChild(tbody);
        wrapper.appendChild(table);
        this.container.appendChild(wrapper);
    }
    handleSort(key) {
        if (this.currentSortKey === key) {
            this.currentSortDir = this.currentSortDir === 'asc' ? 'desc' : 'asc';
        }
        else {
            this.currentSortKey = key;
            this.currentSortDir = 'asc';
        }
        if (this.onSort) {
            this.onSort(this.currentSortKey, this.currentSortDir);
        }
        else {
            // Default local sorting
            const sorted = [...this.data].sort((a, b) => {
                const valA = a[key];
                const valB = b[key];
                if (valA === undefined || valA === null)
                    return 1;
                if (valB === undefined || valB === null)
                    return -1;
                if (typeof valA === 'string') {
                    return this.currentSortDir === 'asc'
                        ? valA.localeCompare(valB)
                        : valB.localeCompare(valA);
                }
                return this.currentSortDir === 'asc' ? valA - valB : valB - valA;
            });
            this.setData(sorted);
        }
    }
}
