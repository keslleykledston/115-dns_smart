/**
 * DNS Smart GUI — Formatting Utilities
 */
export const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
};
export const formatLatency = (ms) => {
    if (ms < 1) {
        return `${Math.round(ms * 1000)} μs`;
    }
    return `${ms.toFixed(2)} ms`;
};
export const formatDuration = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0)
        parts.push(`${d}d`);
    if (h > 0)
        parts.push(`${h}h`);
    if (m > 0)
        parts.push(`${m}m`);
    if (s > 0 || parts.length === 0)
        parts.push(`${s}s`);
    return parts.join(' ');
};
export const timeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5)
        return 'just now';
    if (seconds < 60)
        return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};
