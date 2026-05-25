/**
 * DNS Smart GUI — Premium Toast Notifications
 */
import { createElement, $ } from '../utils/dom.js';
export class Toast {
    static containerId = 'toast-container';
    static getContainer() {
        let container = $(`#${this.containerId}`);
        if (!container) {
            container = createElement('div', ['toast-container'], { id: this.containerId });
            document.body.appendChild(container);
        }
        return container;
    }
    static show(message, type = 'info', duration = 4000) {
        const container = this.getContainer();
        const toast = createElement('div', ['toast', `toast-${type}`]);
        // Icon matching type
        const icons = {
            success: '🟢',
            error: '🔴',
            warning: '🟡',
            info: '🔵'
        };
        toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 1.2rem;">${icons[type]}</span>
        <span style="font-weight: 500; font-size: 0.95rem;">${message}</span>
      </div>
      <span class="toast-close" style="margin-left: 20px; font-weight: bold; cursor: pointer; opacity: 0.6;">✕</span>
    `;
        container.appendChild(toast);
        // Dismiss on click close button
        toast.querySelector('.toast-close')?.addEventListener('click', () => {
            this.dismiss(toast);
        });
        // Auto dismiss
        setTimeout(() => {
            this.dismiss(toast);
        }, duration);
    }
    static dismiss(toast) {
        toast.style.transform = 'translateX(120%)';
        toast.style.opacity = '0';
        toast.style.transition = 'transform 300ms ease, opacity 300ms ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
    static success(msg) { this.show(msg, 'success'); }
    static error(msg) { this.show(msg, 'error'); }
    static warning(msg) { this.show(msg, 'warning'); }
    static info(msg) { this.show(msg, 'info'); }
}
