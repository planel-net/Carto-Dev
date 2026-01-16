/* ===========================================
   APP.JS - Application principale et routing
   Application Carto

   NOTE: Cette app tourne dans un DIALOG et ne peut pas
   accéder directement à Excel. Elle utilise ExcelBridge
   pour communiquer avec le taskpane.
   =========================================== */

/**
 * État de l'application
 */
const AppState = {
    currentPage: 'migration',
    currentTable: null,
    isLoading: false,
    bridgeReady: false
};

/**
 * Initialisation de l'application
 */
Office.onReady((info) => {
    console.log('[App] Office.onReady called, host:', info.host);
    console.log('[App] Running in DIALOG mode - using ExcelBridge for data');

    // Initialiser ExcelBridge pour la communication avec le taskpane
    if (typeof ExcelBridge !== 'undefined') {
        ExcelBridge.init();
        AppState.bridgeReady = true;
        console.log('[App] ExcelBridge initialized');
    } else {
        console.error('[App] ExcelBridge not found! Data loading will fail.');
    }

    // Initialiser l'application
    initializeApp();
});

/**
 * ============================================
 * WRAPPERS EXCEL - Communication via Bridge
 * Ces fonctions remplacent les appels directs
 * à Excel qui ne fonctionnent pas dans un dialog
 * ============================================
 */

// Override readTable pour utiliser le bridge
async function readTable(tableName, useCache = true) {
    console.log(`[App] readTable via bridge: ${tableName}`);
    if (!AppState.bridgeReady) {
        console.error('[App] Bridge not ready');
        return { headers: [], rows: [], data: [] };
    }
    try {
        return await ExcelBridge.readTable(tableName, useCache);
    } catch (error) {
        console.error(`[App] readTable error: ${error.message}`);
        return { headers: [], rows: [], data: [] };
    }
}

// Override getMigrationStats pour utiliser le bridge
async function getMigrationStats(tableName, statusField) {
    console.log(`[App] getMigrationStats via bridge: ${tableName}`);
    if (!AppState.bridgeReady) {
        return { total: 0, migre: 0, enCours: 0, nonMigre: 0, bloque: 0, percentMigre: 0 };
    }
    try {
        return await ExcelBridge.getMigrationStats(tableName, statusField);
    } catch (error) {
        console.error(`[App] getMigrationStats error: ${error.message}`);
        return { total: 0, migre: 0, enCours: 0, nonMigre: 0, bloque: 0, percentMigre: 0 };
    }
}

// Override addTableRow pour utiliser le bridge
async function addTableRow(tableName, rowData) {
    console.log(`[App] addTableRow via bridge: ${tableName}`);
    if (!AppState.bridgeReady) throw new Error('Bridge not ready');
    return await ExcelBridge.addTableRow(tableName, rowData);
}

// Override updateTableRow pour utiliser le bridge
async function updateTableRow(tableName, rowIndex, rowData) {
    console.log(`[App] updateTableRow via bridge: ${tableName}`);
    if (!AppState.bridgeReady) throw new Error('Bridge not ready');
    return await ExcelBridge.updateTableRow(tableName, rowIndex, rowData);
}

// Override deleteTableRow pour utiliser le bridge
async function deleteTableRow(tableName, rowIndex) {
    console.log(`[App] deleteTableRow via bridge: ${tableName}`);
    if (!AppState.bridgeReady) throw new Error('Bridge not ready');
    return await ExcelBridge.deleteTableRow(tableName, rowIndex);
}

// Override getUniqueValues pour utiliser le bridge
async function getUniqueValues(tableName, columnName) {
    console.log(`[App] getUniqueValues via bridge: ${tableName}.${columnName}`);
    if (!AppState.bridgeReady) return [];
    return await ExcelBridge.getUniqueValues(tableName, columnName);
}

// Override searchTable pour utiliser le bridge
async function searchTable(tableName, searchTerm, searchFields) {
    console.log(`[App] searchTable via bridge: ${tableName}`);
    if (!AppState.bridgeReady) return [];
    return await ExcelBridge.searchTable(tableName, searchTerm, searchFields);
}

// Invalider le cache (envoie commande au taskpane)
function invalidateCache(tableName = null) {
    console.log('[App] invalidateCache - sending to taskpane');
    if (AppState.bridgeReady) {
        ExcelBridge.sendCommand('INVALIDATE_CACHE', { tableName });
    }
}

/**
 * Initialise l'application
 */
async function initializeApp() {
    console.log('[App] Initialisation...');
    try {
        // Afficher le badge d'environnement
        showEnvironmentBadge();

        // Initialiser le sidebar
        console.log('[App] Init sidebar...');
        initSidebar();

        // Attacher les événements de navigation
        document.addEventListener('navigate', handleNavigation);
        console.log('[App] Navigation event listener attached');

        // Attacher les événements des boutons header
        attachHeaderEvents();

        // Charger le cache des acteurs pour le formatage des noms
        console.log('[App] Loading actors cache...');
        await loadActorsCache();
        console.log('[App] Actors cache loaded');

        // Skip Excel check - go directly to loading page
        // (Excel availability will be checked when loading data)
        console.log('[App] Skipping Excel check, loading page directly...');

        // Charger la page par défaut
        console.log('[App] Loading default page...');
        await navigateTo('migration');

        // Masquer le loader initial
        hideLoading();
        console.log('[App] Initialization complete');

    } catch (error) {
        console.error('[App] Erreur initialisation:', error);
        showError('Erreur lors de l\'initialisation de l\'application');
        hideLoading();
    }
}

/**
 * Gère la navigation
 */
function handleNavigation(event) {
    console.log('[App] handleNavigation event received:', event.detail);
    const { page, table } = event.detail;
    navigateTo(page, table);
}

/**
 * Navigue vers une page
 * @param {string} page - ID de la page
 * @param {string} table - Clé de la table (pour les pages params)
 */
async function navigateTo(page, table = null) {
    console.log('[App] navigateTo:', page, table, 'isLoading:', AppState.isLoading);
    if (AppState.isLoading) {
        console.log('[App] Navigation blocked - already loading');
        return;
    }

    AppState.currentPage = page;
    AppState.currentTable = table;

    const container = document.getElementById('pageContainer');
    const pageTitle = document.getElementById('pageTitle');

    // Afficher le loader
    showLoading();

    try {
        // Mettre à jour le titre
        updatePageTitle(page, table);

        // Mettre à jour le sidebar
        const sidebar = getSidebar();
        if (sidebar) {
            sidebar.setActive(page, table);
        }

        // Rendre la page appropriée
        switch (page) {
            case 'roadmap-gantt':
                await renderRoadmapGanttPage(container);
                break;

            case 'roadmap-chantiers':
                await renderRoadmapChantiersPage(container);
                break;

            case 'migration':
                await renderMigrationPage(container);
                break;

            case 'parc':
                await renderParcPage(container);
                break;

            case 'roadmap':
                await renderRoadmapPage(container);
                break;

            case 'params':
                if (table) {
                    await renderParamsPage(container, table);
                } else {
                    container.innerHTML = '<div class="alert alert-warning">Veuillez sélectionner une table.</div>';
                }
                break;

            default:
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">&#128679;</div>
                        <div class="empty-state-title">Page en construction</div>
                        <p>Cette page n'est pas encore disponible.</p>
                    </div>
                `;
        }

    } catch (error) {
        console.error('Erreur navigation:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <strong>Erreur:</strong> ${error.message || 'Impossible de charger la page.'}
            </div>
        `;
    } finally {
        hideLoading();
    }
}

/**
 * Met à jour le titre de la page
 */
function updatePageTitle(page, table) {
    const pageTitle = document.getElementById('pageTitle');
    if (!pageTitle) return;

    const titles = {
        migration: 'Cartographie',
        parc: 'Parc Applicatif',
        'roadmap-gantt': 'Roadmap',
        roadmap: 'Backlog'
    };

    if (page === 'params' && table) {
        const tableConfig = CONFIG.TABLES[table];
        pageTitle.textContent = tableConfig?.displayName || table;
    } else {
        pageTitle.textContent = titles[page] || 'Carto';
    }
}

/**
 * Attache les événements des boutons du header
 */
function attachHeaderEvents() {
    // Bouton actualiser
    const refreshBtn = document.getElementById('btnRefresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshCurrentPage);
    }

    // Bouton fermer
    const closeBtn = document.getElementById('btnCloseApp');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeApp);
    }
}

/**
 * Rafraîchit la page courante
 */
async function refreshCurrentPage() {
    showLoading();

    try {
        // Invalider le cache
        invalidateCache();

        // Recharger le cache des acteurs
        invalidateActorsCache();
        await loadActorsCache();

        // Rafraîchir selon la page
        switch (AppState.currentPage) {
            case 'roadmap-gantt':
                await refreshRoadmapGanttPage();
                break;
            case 'roadmap-chantiers':
                await refreshRoadmapChantiersPage();
                break;
            case 'migration':
                await refreshMigrationPage();
                break;
            case 'parc':
                await refreshParcPage();
                break;
            case 'roadmap':
                await refreshRoadmapPage();
                break;
            case 'params':
                await refreshParamsPage();
                break;
            default:
                await navigateTo(AppState.currentPage, AppState.currentTable);
        }

        showSuccess('Données actualisées');

    } catch (error) {
        console.error('Erreur refresh:', error);
        showError('Erreur lors de l\'actualisation');
    } finally {
        hideLoading();
    }
}

/**
 * Ferme l'application (dialog)
 */
function closeApp() {
    try {
        // Envoyer un message au taskpane pour fermer la dialog
        Office.context.ui.messageParent(JSON.stringify({ type: 'CLOSE' }));
    } catch (error) {
        // Si on n'est pas dans une dialog, ne rien faire
        console.log('Pas dans une dialog, fermeture ignorée');
    }
}

/**
 * Affiche le loader
 */
function showLoading() {
    AppState.isLoading = true;
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/**
 * Masque le loader
 */
function hideLoading() {
    AppState.isLoading = false;
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Affiche le badge d'environnement
 */
function showEnvironmentBadge() {
    const badge = document.getElementById('envBadge');
    if (badge) {
        const isDev = window.location.hostname.includes('localhost') ||
                      window.location.hostname.includes('-dev') ||
                      window.location.pathname.includes('/dev/') ||
                      window.location.hostname.includes('127.0.0.1');

        if (isDev) {
            badge.textContent = 'DEV';
            badge.className = 'env-badge dev';
        } else {
            badge.className = 'env-badge prod';
        }
    }
}

/**
 * Export des fonctions globales pour les autres modules
 */
window.navigateTo = navigateTo;
window.refreshCurrentPage = refreshCurrentPage;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
