/* ===========================================
   CHART.JS - Composants graphiques
   Application Carto
   =========================================== */

/**
 * Crée un graphique en barres simple (sans bibliothèque externe)
 * @param {string} containerId - ID du conteneur
 * @param {Object} data - Données { labels: [], values: [], colors: [] }
 * @param {Object} options - Options du graphique
 */
function createBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { labels, values, colors } = data;
    const maxValue = Math.max(...values, 1);
    const barHeight = options.barHeight || 30;
    const gap = options.gap || 8;
    const showValues = options.showValues !== false;
    const horizontal = options.horizontal !== false;

    if (horizontal) {
        container.innerHTML = `
            <div class="bar-chart horizontal">
                ${labels.map((label, i) => {
                    const percent = (values[i] / maxValue) * 100;
                    const color = colors?.[i] || getChartColor(i);
                    return `
                        <div class="bar-item" style="margin-bottom: ${gap}px;">
                            <div class="bar-label" style="width: 120px; flex-shrink: 0;">${escapeHtml(label)}</div>
                            <div class="bar-track" style="flex: 1; height: ${barHeight}px; background: #f0f0f0; border-radius: 4px; overflow: hidden;">
                                <div class="bar-fill" style="width: ${percent}%; height: 100%; background: ${color}; transition: width 0.5s ease;"></div>
                            </div>
                            ${showValues ? `<div class="bar-value" style="width: 60px; text-align: right; font-weight: 600;">${formatNumber(values[i])}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        const barWidth = options.barWidth || 40;
        container.innerHTML = `
            <div class="bar-chart vertical" style="display: flex; align-items: flex-end; justify-content: space-around; height: 200px; padding-top: 20px;">
                ${labels.map((label, i) => {
                    const percent = (values[i] / maxValue) * 100;
                    const color = colors?.[i] || getChartColor(i);
                    return `
                        <div class="bar-item" style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                            ${showValues ? `<div class="bar-value" style="font-weight: 600; margin-bottom: 4px;">${formatNumber(values[i])}</div>` : ''}
                            <div class="bar-track" style="width: ${barWidth}px; height: 160px; background: #f0f0f0; border-radius: 4px; overflow: hidden; display: flex; align-items: flex-end;">
                                <div class="bar-fill" style="width: 100%; height: ${percent}%; background: ${color}; transition: height 0.5s ease;"></div>
                            </div>
                            <div class="bar-label" style="margin-top: 8px; font-size: 12px; text-align: center;">${escapeHtml(label)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

/**
 * Crée un graphique circulaire de progression
 * @param {string} containerId - ID du conteneur
 * @param {number} percent - Pourcentage (0-100)
 * @param {Object} options - Options
 */
function createProgressCircle(containerId, percent, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const size = options.size || 120;
    const strokeWidth = options.strokeWidth || 8;
    const color = options.color || getColorForPercent(percent);
    const label = options.label || '';

    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;

    container.innerHTML = `
        <div class="progress-circle" style="width: ${size}px; height: ${size}px;">
            <svg width="${size}" height="${size}">
                <circle
                    class="progress-circle-bg"
                    cx="${size / 2}"
                    cy="${size / 2}"
                    r="${radius}"
                    stroke="#f0f0f0"
                    stroke-width="${strokeWidth}"
                    fill="none"
                />
                <circle
                    class="progress-circle-value"
                    cx="${size / 2}"
                    cy="${size / 2}"
                    r="${radius}"
                    stroke="${color}"
                    stroke-width="${strokeWidth}"
                    fill="none"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    style="transform: rotate(-90deg); transform-origin: center;"
                />
            </svg>
            <div class="progress-circle-text">
                <span class="progress-circle-percent">${Math.round(percent)}%</span>
                ${label ? `<span class="progress-circle-label">${escapeHtml(label)}</span>` : ''}
            </div>
        </div>
    `;
}

/**
 * Crée une carte KPI
 * @param {string} containerId - ID du conteneur
 * @param {Object} kpi - { value, label, icon, trend, trendValue, type }
 */
function createKpiCard(containerId, kpi) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { value, label, icon, trend, trendValue, type = 'primary', progress } = kpi;

    container.innerHTML = `
        <div class="kpi-card kpi-${type}">
            <div class="kpi-header">
                <div class="kpi-icon">${icon || '&#128202;'}</div>
                ${trend ? `
                <div class="kpi-trend ${trend}">
                    ${trend === 'up' ? '&#8593;' : '&#8595;'} ${trendValue || ''}
                </div>
                ` : ''}
            </div>
            <div class="kpi-value">${value}<span class="unit">${kpi.unit || ''}</span></div>
            <div class="kpi-label">${escapeHtml(label)}</div>
            ${progress !== undefined ? `
            <div class="kpi-progress">
                <div class="kpi-progress-header">
                    <span class="kpi-progress-label">Progression</span>
                    <span class="kpi-progress-value">${progress}%</span>
                </div>
                <div class="progress">
                    <div class="progress-bar ${getProgressBarClass(progress)}" style="width: ${progress}%"></div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

/**
 * Crée un mini graphique sparkline
 * @param {string} containerId - ID du conteneur
 * @param {Array} values - Valeurs
 * @param {Object} options - Options
 */
function createSparkline(containerId, values, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = options.width || 100;
    const height = options.height || 30;
    const color = options.color || '#0066CC';

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    container.innerHTML = `
        <svg width="${width}" height="${height}" class="sparkline">
            <polyline
                points="${points}"
                fill="none"
                stroke="${color}"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
}

/**
 * Crée un graphique de capacité (barres empilées par mois)
 * @param {string} containerId - ID du conteneur
 * @param {Object} data - { months: [], capacity: [], charge: [] }
 * @param {Object} options - Options
 */
function createCapacityChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { months, capacity, charge } = data;
    const maxValue = Math.max(...capacity, ...charge, 1);
    const barHeight = options.barHeight || 150;

    container.innerHTML = `
        <div class="capacity-chart">
            <div class="capacity-legend">
                <div class="capacity-legend-item">
                    <span class="capacity-legend-color capacity"></span>
                    <span>Capacité</span>
                </div>
                <div class="capacity-legend-item">
                    <span class="capacity-legend-color charge"></span>
                    <span>Charge</span>
                </div>
            </div>
            <div style="display: flex; align-items: flex-end; justify-content: space-between; height: ${barHeight}px; gap: 8px; padding: 0 16px;">
                ${months.map((month, i) => {
                    const capPercent = (capacity[i] / maxValue) * 100;
                    const chargePercent = (charge[i] / maxValue) * 100;
                    const isOverload = charge[i] > capacity[i];

                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                            <div style="width: 100%; max-width: 60px; height: ${barHeight - 30}px; position: relative;">
                                <div style="position: absolute; bottom: 0; left: 0; right: 50%; background: ${isOverload ? '#DC3545' : '#FF6600'}; height: ${chargePercent}%; border-radius: 4px 0 0 4px; transition: height 0.5s;"></div>
                                <div style="position: absolute; bottom: 0; left: 50%; right: 0; background: #0066CC; height: ${capPercent}%; border-radius: 0 4px 4px 0; transition: height 0.5s;"></div>
                            </div>
                            <div style="font-size: 11px; margin-top: 8px; text-align: center;">${escapeHtml(month)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="capacity-info">
                <div class="capacity-info-item">
                    <div class="capacity-info-value">${formatNumber(capacity.reduce((a, b) => a + b, 0))}</div>
                    <div class="capacity-info-label">Capacité totale (j/h)</div>
                </div>
                <div class="capacity-info-item">
                    <div class="capacity-info-value">${formatNumber(charge.reduce((a, b) => a + b, 0))}</div>
                    <div class="capacity-info-label">Charge totale (j/h)</div>
                </div>
                <div class="capacity-info-item">
                    <div class="capacity-info-value" style="color: ${charge.reduce((a, b) => a + b, 0) > capacity.reduce((a, b) => a + b, 0) ? '#DC3545' : '#28A745'}">
                        ${formatNumber(capacity.reduce((a, b) => a + b, 0) - charge.reduce((a, b) => a + b, 0))}
                    </div>
                    <div class="capacity-info-label">Disponible (j/h)</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Crée un Gantt simplifié
 * @param {string} containerId - ID du conteneur
 * @param {Object} data - { projects: [{ name, start, end, status }], months: [] }
 */
function createGanttChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { projects, months } = data;

    container.innerHTML = `
        <div class="gantt-container">
            <div class="gantt-header">
                <div class="gantt-header-label">Projet</div>
                <div class="gantt-header-timeline">
                    ${months.map(m => `<div class="gantt-header-month">${escapeHtml(m)}</div>`).join('')}
                </div>
            </div>
            <div class="gantt-body">
                ${projects.map(project => {
                    const startMonth = project.startMonth || 0;
                    const duration = project.duration || 1;
                    const leftPercent = (startMonth / months.length) * 100;
                    const widthPercent = (duration / months.length) * 100;
                    const barClass = project.status === 'completed' ? 'gantt-bar-success' :
                                     project.status === 'in-progress' ? 'gantt-bar-orange' :
                                     project.status === 'blocked' ? 'gantt-bar-danger' : 'gantt-bar-primary';

                    return `
                        <div class="gantt-row">
                            <div class="gantt-row-label">
                                <span>${escapeHtml(project.name)}</span>
                            </div>
                            <div class="gantt-row-timeline">
                                ${months.map(() => '<div class="gantt-cell"></div>').join('')}
                                <div class="gantt-bar ${barClass}"
                                     style="left: ${leftPercent}%; width: ${widthPercent}%;"
                                     title="${escapeHtml(project.name)} - ${project.charge || ''} j/h">
                                    ${project.charge ? project.charge + ' j/h' : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// FONCTIONS UTILITAIRES POUR LES GRAPHIQUES
// ============================================

/**
 * Retourne une couleur pour un index donné
 */
function getChartColor(index) {
    const colors = [
        '#0066CC', '#FF6600', '#28A745', '#DC3545', '#FFC107',
        '#17A2B8', '#6C757D', '#6610F2', '#E83E8C', '#20C997'
    ];
    return colors[index % colors.length];
}

/**
 * Retourne une couleur selon le pourcentage
 */
function getColorForPercent(percent) {
    if (percent >= 70) return '#28A745';
    if (percent >= 30) return '#FFC107';
    return '#DC3545';
}

/**
 * Retourne la classe de barre de progression
 */
function getProgressBarClass(percent) {
    if (percent >= 70) return 'progress-bar-success';
    if (percent >= 30) return 'progress-bar-warning';
    return 'progress-bar-danger';
}
