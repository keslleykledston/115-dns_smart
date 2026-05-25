/**
 * DNS Smart GUI — Animated Modals
 */
import { createElement } from '../utils/dom.js';
export class Modal {
    static show(title, bodyContent, footerActions = '', onClose) {
        const backdrop = createElement('div', ['modal-backdrop']);
        backdrop.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <span class="modal-close">✕</span>
        </div>
        <div class="modal-body" style="margin-bottom: 24px; color: var(--text-secondary);">
          ${bodyContent}
        </div>
        <div class="modal-footer" style="display: flex; align-items: center; justify-content: flex-end; gap: 12px;">
          ${footerActions || '<button class="btn btn-secondary btn-close-modal">Close</button>'}
        </div>
      </div>
    `;
        document.body.appendChild(backdrop);
        // Force reflow for CSS animation trigger
        void backdrop.offsetWidth;
        backdrop.classList.add('open');
        const closeFn = () => {
            backdrop.classList.remove('open');
            setTimeout(() => {
                backdrop.remove();
                if (onClose)
                    onClose();
            }, 300);
        };
        // Attach close triggers
        backdrop.querySelector('.modal-close')?.addEventListener('click', closeFn);
        backdrop.querySelector('.btn-close-modal')?.addEventListener('click', closeFn);
        // Backdrop click dismiss
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop)
                closeFn();
        });
        // Escape key dismiss
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeFn();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        return {
            element: backdrop,
            close: closeFn
        };
    }
}
