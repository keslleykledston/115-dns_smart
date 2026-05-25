/**
 * DNS Smart GUI — Centralized API Client
 */
import { Toast } from './components/toast.js';
export class ApiClient {
    static getHeaders(contentType = 'application/json') {
        const headers = {};
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }
    static async requestRaw(endpoint, method = 'GET', body = null, contentType = 'application/json') {
        try {
            const options = {
                method,
                headers: this.getHeaders(contentType),
            };
            if (body) {
                options.body = contentType === 'application/json' ? JSON.stringify(body) : body;
            }
            const res = await fetch(endpoint, options);
            // Handle auth failures globally
            if (res.status === 401) {
                if (window.location.hash !== '#/login') {
                    localStorage.removeItem('token');
                    Toast.error('Session expired. Please log in.');
                    window.location.hash = '#/login';
                }
                return null;
            }
            const json = await res.json();
            if (!res.ok) {
                Toast.error(json.error || 'API request failed');
                return null;
            }
            return json;
        }
        catch (err) {
            console.error('API Error:', err);
            Toast.error('Network error. Unable to contact server.');
            return null;
        }
    }
    static async request(endpoint, method = 'GET', body = null, contentType = 'application/json') {
        const json = await this.requestRaw(endpoint, method, body, contentType);
        return json ? json.data : null;
    }
    static get(endpoint) { return this.request(endpoint, 'GET'); }
    static getPaginated(endpoint) { return this.requestRaw(endpoint, 'GET'); }
    static post(endpoint, body) { return this.request(endpoint, 'POST', body); }
    static put(endpoint, body) { return this.request(endpoint, 'PUT', body); }
    static delete(endpoint) { return this.request(endpoint, 'DELETE'); }
}
export default ApiClient;
