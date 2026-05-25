/**
 * DNS Smart GUI — SPA Core Application Router
 * Bootstraps views, handles hash routes, checks authentications, starts WebSocket sync
 */
import { $ } from './utils/dom.js';
import { Toast } from './components/toast.js';
import wsClient from './websocket.js';
// Views
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { ZonesView } from './views/zones.js';
import { RecordsView } from './views/records.js';
import { LogsView } from './views/logs.js';
import { ForwardersView } from './views/forwarders.js';
import { BlocklistView } from './views/blocklist.js';
import { ConfigView } from './views/config.js';
export class App {
    static activeView = null;
    static init() {
        // 1. Listen for route hash changes
        window.addEventListener('hashchange', () => this.route());
        // 2. Attach logout click handler
        $('#btn-logout')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        // 3. Trigger initial routing
        this.route();
    }
    /**
     * Main router resolution
     */
    static async route() {
        const hash = window.location.hash || '#/dashboard';
        // Verify session authentication state
        const token = localStorage.getItem('token');
        if (!token && hash !== '#/login') {
            window.location.hash = '#/login';
            return;
        }
        if (token && hash === '#/login') {
            window.location.hash = '#/dashboard';
            return;
        }
        // Toggle central layout panels depending on routing
        if (hash === '#/login') {
            $('#app-container').style.display = 'none';
            $('#login-container').style.display = 'flex';
            this.cleanupActiveView();
            LoginView.render($('#login-container'), () => {
                // Success callback: boot central app layout
                $('#login-container').style.display = 'none';
                $('#app-container').style.display = 'flex';
                window.location.hash = '#/dashboard';
                wsClient.connect(); // Begin WebSocket connection
            });
            return;
        }
        // App dashboard layout mode
        $('#login-container').style.display = 'none';
        $('#app-container').style.display = 'flex';
        // Auto start WebSocket connection if not already active
        wsClient.connect();
        this.cleanupActiveView();
        this.updateSidebarNavigation(hash);
        const mainFrame = $('#main-frame');
        mainFrame.innerHTML = '<div class="shimmer" style="height: 100%; border-radius: var(--radius-lg);"></div>';
        // Parse route params: e.g. #/zones/3/records -> path='/zones/:id/records', params={id: '3'}
        const parsed = this.parseRoute(hash);
        try {
            switch (parsed.path) {
                case '/dashboard':
                    this.activeView = DashboardView;
                    await DashboardView.render(mainFrame);
                    break;
                case '/zones':
                    this.activeView = ZonesView;
                    await ZonesView.render(mainFrame);
                    break;
                case '/zones/:id/records':
                    this.activeView = RecordsView;
                    await RecordsView.render(mainFrame, parsed.params);
                    break;
                case '/logs':
                    this.activeView = LogsView;
                    await LogsView.render(mainFrame);
                    break;
                case '/forwarders':
                    this.activeView = ForwardersView;
                    await ForwardersView.render(mainFrame);
                    break;
                case '/blocklist':
                    this.activeView = BlocklistView;
                    await BlocklistView.render(mainFrame);
                    break;
                case '/config':
                    this.activeView = ConfigView;
                    await ConfigView.render(mainFrame);
                    break;
                default:
                    mainFrame.innerHTML = `
            <div class="glass-card flex-center" style="flex-direction: column; gap: 16px; padding: 60px;">
              <span style="font-size: 3rem;">🔍</span>
              <h3>Page Not Found</h3>
              <p style="color: var(--text-secondary);">The requested control panel page could not be located.</p>
              <a href="#/dashboard" class="btn btn-primary" style="margin-top: 10px;">Return Dashboard</a>
            </div>
          `;
                    break;
            }
        }
        catch (err) {
            console.error('Failed to render view:', err);
            mainFrame.innerHTML = `
        <div class="glass-card flex-center" style="flex-direction: column; gap: 16px; padding: 60px; border-color: var(--accent-red);">
          <span style="font-size: 3rem;">⚠️</span>
          <h3>View Render Failure</h3>
          <p style="color: var(--text-secondary);">An unexpected interface execution error occurred.</p>
        </div>
      `;
        }
    }
    static cleanupActiveView() {
        if (this.activeView && typeof this.activeView.destroy === 'function') {
            this.activeView.destroy();
        }
        this.activeView = null;
    }
    static updateSidebarNavigation(hash) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        // Highlight matches based on route prefixes
        let activeRoute = 'dashboard';
        if (hash.startsWith('#/zones'))
            activeRoute = 'zones';
        else if (hash.startsWith('#/logs'))
            activeRoute = 'logs';
        else if (hash.startsWith('#/forwarders'))
            activeRoute = 'forwarders';
        else if (hash.startsWith('#/blocklist'))
            activeRoute = 'blocklist';
        else if (hash.startsWith('#/config'))
            activeRoute = 'config';
        const activeLink = document.querySelector(`.nav-item[data-route="${activeRoute}"]`);
        if (activeLink)
            activeLink.classList.add('active');
    }
    /**
     * Matches hash router strings and parses parameters
     * e.g. #/zones/3/records matches path '/zones/:id/records' and returns { id: '3' }
     */
    static parseRoute(hash) {
        const routeUrl = hash.replace('#', '') || '/';
        // Register routing definitions
        const routeDefinitions = [
            '/dashboard',
            '/zones',
            '/zones/:id/records',
            '/logs',
            '/forwarders',
            '/blocklist',
            '/config'
        ];
        const urlParts = routeUrl.split('/');
        const params = {};
        let matchedPath = '';
        for (const definition of routeDefinitions) {
            const defParts = definition.split('/');
            if (defParts.length !== urlParts.length) {
                continue;
            }
            let isMatch = true;
            const currentParams = {};
            for (let i = 0; i < defParts.length; i++) {
                if (defParts[i].startsWith(':')) {
                    const paramName = defParts[i].slice(1);
                    currentParams[paramName] = urlParts[i];
                }
                else if (defParts[i] !== urlParts[i]) {
                    isMatch = false;
                    break;
                }
            }
            if (isMatch) {
                matchedPath = definition;
                Object.assign(params, currentParams);
                break;
            }
        }
        return {
            path: matchedPath || routeUrl,
            params
        };
    }
    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        wsClient.disconnect();
        Toast.success('Logged out successfully.');
        window.location.hash = '#/login';
    }
}
// Bootstrap
document.addEventListener('DOMContentLoaded', () => App.init());
