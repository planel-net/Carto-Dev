/* ===========================================
   APP.JS - Application principale et routing
   Application Carto

   VERSION 2.0: Accès direct à Excel via Excel.run()
   Si l'accès direct échoue, fallback sur ExcelBridge
   =========================================== */

/**
 * État de l'application
 */
const AppState = {
    currentPage: 'migration',
    currentTable: null,
    isLoading: false,
    bridgeReady: false,
    directExcelAccess: false  // true si on peut accéder directement à Excel
};

/**
 * Initialisation de l'application
 */
Office.onReady(async (info) => {
    console.log('[App] Office.onReady called, host:', info.host);

    // Tester l'accès direct à Excel
    AppState.directExcelAccess = await testDirectExcelAccess();

    if (AppState.directExcelAccess) {
        console.log('[App] Direct Excel access available - using excel-utils.js');
    } else {
        console.log('[App] No direct Excel access - trying ExcelBridge');
        // Initialiser ExcelBridge pour la communication avec le taskpane
        if (typeof ExcelBridge !== 'undefined') {
            ExcelBridge.init();
            AppState.bridgeReady = true;
            console.log('[App] ExcelBridge initialized');
        } else {
            console.error('[App] Neither direct access nor ExcelBridge available!');
        }
    }

    // Initialiser l'application
    initializeApp();
});

/**
 * Sauvegarder les références aux fonctions de excel-utils.js
 * avant qu'elles ne soient potentiellement overrides
 */
const ExcelDirect = {
    readTable: typeof readTable === 'function' ? readTable : null,
    getMigrationStats: typeof getMigrationStats === 'function' ? getMigrationStats : null,
    addTableRow: typeof addTableRow === 'function' ? addTableRow : null,
    updateTableRow: typeof updateTableRow === 'function' ? updateTableRow : null,
    deleteTableRow: typeof deleteTableRow === 'function' ? deleteTableRow : null,
    getUniqueValues: typeof getUniqueValues === 'function' ? getUniqueValues : null,
    searchTable: typeof searchTable === 'function' ? searchTable : null,
    invalidateCache: typeof invalidateCache === 'function' ? invalidateCache : null,
    copyFromJira: typeof copyFromJira === 'function' ? copyFromJira : null
};

console.log('[App] ExcelDirect functions saved:', Object.keys(ExcelDirect).filter(k => ExcelDirect[k] !== null));

/**
 * Teste si on a un accès direct à Excel via Excel.run()
 * @returns {Promise<boolean>}
 */
async function testDirectExcelAccess() {
    try {
        await Excel.run(async (context) => {
            // Simple test: charger le nom du workbook
            const workbook = context.workbook;
            workbook.load('name');
            await context.sync();
            console.log('[App] Direct Excel test successful, workbook:', workbook.name);
        });
        return true;
    } catch (error) {
        console.log('[App] Direct Excel test failed:', error.message);
        return false;
    }
}

/**
 * ============================================
 * WRAPPERS EXCEL - Accès direct ou via Bridge
 * Utilise l'accès direct si disponible, sinon le bridge
 * ============================================
 */

// Vérifie si on peut utiliser l'accès direct
function canUseDirectAccess() {
    return AppState.directExcelAccess && ExcelDirect.readTable !== null;
}

// readTable - utilise excel-utils.js directement ou bridge
async function readTable(tableName, useCache = true) {
    if (canUseDirectAccess()) {
        console.log(`[App] readTable DIRECT: ${tableName}`);
        try {
            return await ExcelDirect.readTable(tableName, useCache);
        } catch (error) {
            console.error(`[App] readTable direct error: ${error.message}`);
            return { headers: [], rows: [], data: [] };
        }
    }

    // Fallback sur le bridge
    console.log(`[App] readTable via bridge: ${tableName}`);
    if (!AppState.bridgeReady) {
        console.error('[App] No Excel access available');
        return { headers: [], rows: [], data: [] };
    }
    try {
        return await ExcelBridge.readTable(tableName, useCache);
    } catch (error) {
        console.error(`[App] readTable error: ${error.message}`);
        return { headers: [], rows: [], data: [] };
    }
}

// getMigrationStats
async function getMigrationStats(tableName, statusField) {
    if (canUseDirectAccess() && ExcelDirect.getMigrationStats) {
        console.log(`[App] getMigrationStats DIRECT: ${tableName}`);
        try {
            return await ExcelDirect.getMigrationStats(tableName, statusField);
        } catch (error) {
            console.error(`[App] getMigrationStats direct error: ${error.message}`);
            return { total: 0, migre: 0, enCours: 0, nonMigre: 0, bloque: 0, percentMigre: 0 };
        }
    }

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

// addTableRow
async function addTableRow(tableName, rowData) {
    if (canUseDirectAccess() && ExcelDirect.addTableRow) {
        console.log(`[App] addTableRow DIRECT: ${tableName}`);
        return await ExcelDirect.addTableRow(tableName, rowData);
    }
    console.log(`[App] addTableRow via bridge: ${tableName}`);
    if (!AppState.bridgeReady) throw new Error('No Excel access available');
    return await ExcelBridge.addTableRow(tableName, rowData);
}

// updateTableRow
async function updateTableRow(tableName, rowIndex, rowData) {
    if (canUseDirectAccess() && ExcelDirect.updateTableRow) {
        console.log(`[App] updateTableRow DIRECT: ${tableName}`);
        return await ExcelDirect.updateTableRow(tableName, rowIndex, rowData);
    }
    console.log(`[App] updateTableRow via bridge: ${tableName}`);
    if (!AppState.bridgeReady) throw new Error('No Excel access available');
    return await ExcelBridge.updateTableRow(tableName, rowIndex, rowData);
}

// deleteTableRow
async function deleteTableRow(tableName, rowIndex) {
    if (canUseDirectAccess() && ExcelDirect.deleteTableRow) {
        console.log(`[App] deleteTableRow DIRECT: ${tableName}`);
        return await ExcelDirect.deleteTableRow(tableName, rowIndex);
    }
    console.log(`[App] deleteTableRow via bridge: ${tableName}`);
    if (!AppState.bridgeReady) throw new Error('No Excel access available');
    return await ExcelBridge.deleteTableRow(tableName, rowIndex);
}

// getUniqueValues
async function getUniqueValues(tableName, columnName) {
    if (canUseDirectAccess() && ExcelDirect.getUniqueValues) {
        console.log(`[App] getUniqueValues DIRECT: ${tableName}.${columnName}`);
        return await ExcelDirect.getUniqueValues(tableName, columnName);
    }
    console.log(`[App] getUniqueValues via bridge: ${tableName}.${columnName}`);
    if (!AppState.bridgeReady) return [];
    return await ExcelBridge.getUniqueValues(tableName, columnName);
}

// searchTable
async function searchTable(tableName, searchTerm, searchFields) {
    if (canUseDirectAccess() && ExcelDirect.searchTable) {
        console.log(`[App] searchTable DIRECT: ${tableName}`);
        return await ExcelDirect.searchTable(tableName, searchTerm, searchFields);
    }
    console.log(`[App] searchTable via bridge: ${tableName}`);
    if (!AppState.bridgeReady) return [];
    return await ExcelBridge.searchTable(tableName, searchTerm, searchFields);
}

// Invalider le cache
async function invalidateCache(tableName = null) {
    console.log('[App] invalidateCache:', tableName);

    // Invalider le cache local
    if (typeof PersistentCache !== 'undefined') {
        if (tableName) {
            PersistentCache.invalidate(tableName);
        } else {
            PersistentCache.clearAll();
        }
    }

    // Si accès direct, utiliser excel-utils
    if (canUseDirectAccess() && ExcelDirect.invalidateCache) {
        ExcelDirect.invalidateCache(tableName);
        console.log('[App] Cache invalidated (direct):', tableName || 'all');
        return;
    }

    // Sinon, envoyer au taskpane via bridge
    if (AppState.bridgeReady) {
        try {
            await ExcelBridge.request('INVALIDATE_CACHE', { tableName });
            console.log('[App] Cache invalidated (bridge):', tableName || 'all');
        } catch (error) {
            console.error('[App] Error invalidating cache:', error);
        }
    }
}

// copyFromJira
async function copyFromJira(jiraSheetName, tableName, keyField = 'Clé') {
    if (canUseDirectAccess() && ExcelDirect.copyFromJira) {
        console.log(`[App] copyFromJira DIRECT: ${jiraSheetName} -> ${tableName}`);
        return await ExcelDirect.copyFromJira(jiraSheetName, tableName, keyField);
    }
    console.log(`[App] copyFromJira via bridge: ${jiraSheetName} -> ${tableName}`);
    if (!AppState.bridgeReady) throw new Error('No Excel access available');
    return await ExcelBridge.copyFromJira(jiraSheetName, tableName, keyField);
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

            case 'backlog':
                await renderBacklogPage(container);
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
 * Met à jour le titre et sous-titre de la page
 */
function updatePageTitle(page, table) {
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    if (!pageTitle) return;

    const pageTitles = {
        migration: { title: 'Cartographie', subtitle: 'Vue d\'ensemble de la migration du parc applicatif' },
        parc: { title: 'Parc Applicatif', subtitle: 'Cartographie des rapports et applications' },
        'roadmap-gantt': { title: 'Roadmap', subtitle: 'Visualisation des projets et phases' },
        'roadmap-chantiers': { title: 'Roadmap', subtitle: 'Visualisation des projets et phases' },
        roadmap: { title: 'Ancienne Roadmap', subtitle: '' },
        backlog: { title: 'Backlog', subtitle: 'Gestion du backlog avec filtres et tri' }
    };

    if (page === 'params' && table) {
        const tableConfig = CONFIG.TABLES[table];
        pageTitle.textContent = tableConfig?.displayName || table;
        if (pageSubtitle) {
            pageSubtitle.textContent = `Gestion de la table ${tableConfig?.name || table}`;
        }
    } else {
        const config = pageTitles[page] || { title: 'Carto', subtitle: '' };
        pageTitle.textContent = config.title;
        if (pageSubtitle) {
            pageSubtitle.textContent = config.subtitle;
            pageSubtitle.style.display = config.subtitle ? 'block' : 'none';
        }
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

    // Bouton Admin
    const adminBtn = document.getElementById('btnAdmin');
    if (adminBtn) {
        adminBtn.addEventListener('click', showAdminModal);
    }

    // Mettre à jour la version dans le sidebar
    const versionEl = document.getElementById('sidebarVersion');
    if (versionEl) {
        versionEl.textContent = CONFIG.APP_VERSION;
    }

    // Initialiser l'indicateur de connexion
    initConnectionStatusIndicator();
}

/**
 * Affiche la modale d'administration
 */
async function showAdminModal() {
    // Vérifier le statut du verrouillage
    let isLocked = false;
    try {
        isLocked = await checkLockStatus();
    } catch (error) {
        console.error('[App] Error checking lock status:', error);
    }

    const modal = new Modal({
        id: 'admin-modal',
        title: 'Administration',
        size: 'sm',
        closable: true
    });

    const statusClass = isLocked ? 'locked' : 'unlocked';
    const statusText = isLocked ? 'Verrouillé' : 'Déverrouillé';
    const statusColor = isLocked ? 'var(--mh-rouge-erreur)' : 'var(--mh-vert-succes)';

    modal.setContent(`
        <div class="admin-modal-content">
            <div class="admin-status-section">
                <h4>Statut du classeur</h4>
                <div class="admin-status ${statusClass}">
                    <span class="status-dot" style="background-color: ${statusColor}"></span>
                    <span class="status-text">${statusText}</span>
                </div>
            </div>

            ${isLocked ? `
            <div class="admin-unlock-section">
                <h4>Déverrouiller</h4>
                <div class="form-group">
                    <input type="password" id="adminPassword" class="form-control" placeholder="Mot de passe">
                </div>
                <button id="btnAdminUnlock" class="btn btn-success btn-block">
                    Déverrouiller le classeur
                </button>
            </div>
            ` : `
            <div class="admin-lock-section">
                <button id="btnAdminLock" class="btn btn-danger btn-block">
                    Verrouiller le classeur
                </button>
            </div>
            `}

            <div class="admin-info-section">
                <p class="text-muted text-sm">
                    Version : ${CONFIG.APP_VERSION}
                </p>
            </div>
        </div>
    `);

    modal.show();

    // Attacher les événements
    if (isLocked) {
        const unlockBtn = document.getElementById('btnAdminUnlock');
        const passwordInput = document.getElementById('adminPassword');

        if (unlockBtn) {
            unlockBtn.addEventListener('click', async () => {
                const password = passwordInput.value;
                if (!password) {
                    showNotification('Veuillez saisir le mot de passe', 'warning');
                    return;
                }

                unlockBtn.disabled = true;
                unlockBtn.textContent = 'Déverrouillage...';

                try {
                    const result = await unlockWorkbook(password);
                    if (result.success) {
                        showNotification('Classeur déverrouillé', 'success');
                        modal.close();
                    } else {
                        showNotification(result.message, 'error');
                        unlockBtn.disabled = false;
                        unlockBtn.textContent = 'Déverrouiller le classeur';
                    }
                } catch (error) {
                    showNotification('Erreur: ' + error.message, 'error');
                    unlockBtn.disabled = false;
                    unlockBtn.textContent = 'Déverrouiller le classeur';
                }
            });
        }

        // Permettre la validation avec Enter
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('btnAdminUnlock')?.click();
                }
            });
            passwordInput.focus();
        }
    } else {
        const lockBtn = document.getElementById('btnAdminLock');
        if (lockBtn) {
            lockBtn.addEventListener('click', async () => {
                lockBtn.disabled = true;
                lockBtn.textContent = 'Verrouillage...';

                try {
                    const result = await lockWorkbook();
                    if (result.success) {
                        showNotification('Classeur verrouillé', 'success');
                        modal.close();
                    } else {
                        showNotification(result.message, 'error');
                        lockBtn.disabled = false;
                        lockBtn.textContent = 'Verrouiller le classeur';
                    }
                } catch (error) {
                    showNotification('Erreur: ' + error.message, 'error');
                    lockBtn.disabled = false;
                    lockBtn.textContent = 'Verrouiller le classeur';
                }
            });
        }
    }
}

/**
 * Initialise et met à jour l'indicateur de statut de connexion
 */
function initConnectionStatusIndicator() {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    // S'abonner aux changements de statut
    if (typeof ConnectionStatus !== 'undefined') {
        ConnectionStatus.onChange((status, lastSync) => {
            updateConnectionStatusUI(status, lastSync);
        });
    }
}

/**
 * Met à jour l'interface de l'indicateur de connexion
 */
function updateConnectionStatusUI(status, lastSync) {
    const statusEl = document.getElementById('connectionStatus');
    if (!statusEl) return;

    const textEl = statusEl.querySelector('.connection-text');
    const syncEl = statusEl.querySelector('.connection-sync');

    // Supprimer toutes les classes de statut
    statusEl.classList.remove('connected', 'cache', 'offline');

    // Appliquer le nouveau statut
    switch (status) {
        case 'connected':
            statusEl.classList.add('connected');
            statusEl.title = 'Connecté à Excel - Données synchronisées';
            if (textEl) textEl.textContent = 'Connecté';
            if (syncEl) {
                syncEl.textContent = lastSync ? `(${formatSyncTime(lastSync)})` : '';
            }
            break;

        case 'cache':
            statusEl.classList.add('cache');
            statusEl.title = 'Mode cache local - Lecture seule';
            if (textEl) textEl.textContent = 'Cache local';
            if (syncEl) {
                const meta = typeof PersistentCache !== 'undefined' ? PersistentCache.getMeta() : null;
                syncEl.textContent = meta?.lastSync ? `(${formatSyncTime(meta.lastSync)})` : '';
            }
            break;

        case 'offline':
            statusEl.classList.add('offline');
            statusEl.title = 'Hors ligne - Modifications impossibles';
            if (textEl) textEl.textContent = 'Hors ligne';
            if (syncEl) syncEl.textContent = '';
            break;
    }
}

/**
 * Formate le temps depuis la dernière synchronisation
 */
function formatSyncTime(timestamp) {
    if (!timestamp) return '';

    const age = Date.now() - timestamp;
    const seconds = Math.floor(age / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'à l\'instant';
    if (minutes < 60) return `il y a ${minutes} min`;
    if (hours < 24) return `il y a ${hours}h`;
    return `il y a ${Math.floor(hours / 24)}j`;
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
            case 'backlog':
                await refreshBacklogPage();
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
