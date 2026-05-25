/**
 * DNS Smart GUI — Chart.js Wrappers
 * Premium dark charts, smooth streaming, glow effects, customized tooltips
 */
// Centralized colors mirroring variables.css
export const chartColors = {
    blue: '#3b82f6',
    cyan: '#06b6d4',
    green: '#10b981',
    yellow: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    borderGlass: 'rgba(99, 179, 237, 0.12)',
    textSecondary: '#94a3b8',
};
// Global default overrides
const getGlobalOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: chartColors.textSecondary,
                font: { family: 'Outfit, sans-serif', size: 12 }
            }
        },
        tooltip: {
            backgroundColor: '#0b1120',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: chartColors.borderGlass,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            boxPadding: 6,
            bodyFont: { family: 'Outfit, sans-serif' },
            titleFont: { family: 'Outfit, sans-serif', weight: 'bold' }
        }
    },
    scales: {
        x: {
            grid: { color: 'rgba(0, 0, 0, 0)', drawBorder: false },
            ticks: { color: chartColors.textSecondary, font: { family: 'Outfit, sans-serif' } }
        },
        y: {
            grid: { color: chartColors.borderGlass, drawBorder: false },
            ticks: { color: chartColors.textSecondary, font: { family: 'Outfit, sans-serif' } }
        }
    }
});
/**
 * Create a real-time sliding line chart (e.g. QPS Over Time)
 */
export function createLineChart(canvas, label, color = chartColors.cyan) {
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 200);
    gradient.addColorStop(0, `${color}33`); // 20% opacity
    gradient.addColorStop(1, `${color}00`); // 0% opacity
    const options = getGlobalOptions();
    return new window.Chart(canvas, {
        type: 'line',
        data: {
            labels: Array(30).fill(''), // 30 history ticks
            datasets: [{
                    label,
                    data: Array(30).fill(0),
                    borderColor: color,
                    borderWidth: 2,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4, // Smooth curved lines
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHitRadius: 10,
                }]
        },
        options: {
            ...options,
            scales: {
                x: {
                    ...options.scales.x,
                    ticks: { display: false } // Hide ticks for streaming look
                },
                y: {
                    ...options.scales.y,
                    suggestedMin: 0,
                }
            }
        }
    });
}
/**
 * Create a statistics doughnut chart (e.g. Query Types / Response Codes)
 */
export function createDoughnutChart(canvas, labels, data) {
    const options = getGlobalOptions();
    return new window.Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                    data,
                    backgroundColor: [
                        chartColors.blue,
                        chartColors.cyan,
                        chartColors.purple,
                        chartColors.green,
                        chartColors.yellow,
                        chartColors.pink,
                        chartColors.red
                    ],
                    borderWidth: 1,
                    borderColor: '#0a0e1a',
                }]
        },
        options: {
            ...options,
            cutout: '70%', // Thin doughnut look
            plugins: {
                ...options.plugins,
                legend: {
                    position: 'right',
                    labels: {
                        color: chartColors.textSecondary,
                        font: { family: 'Outfit, sans-serif' },
                        boxWidth: 12
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}
/**
 * Create a horizontal ranking bar chart (e.g. Top domains / clients)
 */
export function createBarChart(canvas, label, color = chartColors.blue) {
    const options = getGlobalOptions();
    return new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                    label,
                    data: [],
                    backgroundColor: color,
                    borderRadius: 6,
                    barThickness: 14,
                }]
        },
        options: {
            ...options,
            indexAxis: 'y', // Horizontal bars
            plugins: {
                ...options.plugins,
                legend: { display: false }
            },
            scales: {
                x: {
                    ...options.scales.x,
                    grid: { color: chartColors.borderGlass }
                },
                y: {
                    ...options.scales.y,
                    grid: { display: false }
                }
            }
        }
    });
}
/**
 * Renders a tiny inline sparkline (inside stat cards)
 */
export function createSparkline(canvas, data, color = chartColors.cyan) {
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 40);
    gradient.addColorStop(0, `${color}15`);
    gradient.addColorStop(1, `${color}00`);
    return new window.Chart(canvas, {
        type: 'line',
        data: {
            labels: Array(data.length).fill(''),
            datasets: [{
                    data,
                    borderColor: color,
                    borderWidth: 1.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}
/**
 * Updates a chart with smooth animation
 */
export function updateChartData(chart, newData, newLabels) {
    if (!chart)
        return;
    chart.data.datasets[0].data = newData;
    if (newLabels) {
        chart.data.labels = newLabels;
    }
    chart.update('none'); // Update without animation triggers for performance
}
/**
 * Append data point to a sliding line chart (sliding window)
 */
export function appendChartData(chart, newValue, label = '') {
    if (!chart)
        return;
    const dataset = chart.data.datasets[0];
    dataset.data.push(newValue);
    chart.data.labels.push(label);
    if (dataset.data.length > 30) {
        dataset.data.shift();
        chart.data.labels.shift();
    }
    chart.update('none');
}
