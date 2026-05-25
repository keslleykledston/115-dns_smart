/**
 * DNS Smart GUI — WebSocket Client
 */
export const WS_TYPES = {
    METRICS_UPDATE: 'metrics_update',
    FORWARDER_STATUS: 'forwarder_status',
    QUERY_LOG: 'query_log',
    ALERT: 'alert',
    CONFIG_CHANGED: 'config_changed',
    SNAPSHOT: 'snapshot',
};
export class WebSocketClient {
    socket = null;
    reconnectInterval = 1000;
    maxReconnectInterval = 30000;
    listeners = {};
    pingTimeout = null;
    constructor() {
        // Initialise WS events Map
        Object.values(WS_TYPES).forEach(type => {
            this.listeners[type] = [];
        });
    }
    /**
     * Bind event listener
     */
    on(type, callback) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(callback);
        return () => {
            this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
        };
    }
    /**
     * Trigger callbacks
     */
    emit(type, data) {
        if (this.listeners[type]) {
            this.listeners[type].forEach(callback => {
                try {
                    callback(data);
                }
                catch (err) {
                    console.error(`Error in WS callback for ${type}:`, err);
                }
            });
        }
    }
    /**
     * Establish WebSocket connection
     */
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);
        this.socket.onopen = () => {
            console.log('WebSocket successfully connected!');
            this.reconnectInterval = 1000; // Reset backoff
            this.heartbeat();
        };
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type) {
                    this.emit(message.type, message.data);
                }
            }
            catch (err) {
                console.error('Failed to parse WS payload:', err);
            }
        };
        this.socket.onclose = () => {
            console.warn('WebSocket connection closed. Attempting reconnect...');
            this.cleanup();
            this.scheduleReconnect();
        };
        this.socket.onerror = (err) => {
            console.error('WebSocket encountered an error:', err);
            this.socket?.close();
        };
    }
    heartbeat() {
        if (this.pingTimeout)
            clearTimeout(this.pingTimeout);
        // Close socket if server doesn't respond to ping in 35 seconds (server sends ping every 30s)
        this.pingTimeout = setTimeout(() => {
            console.error('WebSocket heartbeat lost. Terminating connection.');
            this.socket?.close();
        }, 35000);
    }
    cleanup() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
    }
    scheduleReconnect() {
        setTimeout(() => {
            this.reconnectInterval = Math.min(this.reconnectInterval * 2, this.maxReconnectInterval);
            this.connect();
        }, this.reconnectInterval);
    }
    disconnect() {
        this.cleanup();
        if (this.socket) {
            this.socket.onclose = () => { }; // remove listeners
            this.socket.close();
            this.socket = null;
        }
    }
}
export const wsClient = new WebSocketClient();
export default wsClient;
