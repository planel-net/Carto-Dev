/* ===========================================
   APP.JS - Application principale et routing
   Application Carto
   =========================================== */

/**
 * État de l'application
 */
const AppState = {
    currentPage: 'migration',
    currentTable: null,
    isLoading: false
};

/**
 * Initialisation de l'application
 */
Office.onReady((info) => {
    console.log('[App] Office.onReady called, host:', info.host);
    console.log('[App] Office.HostType.Excel:', Office.HostType.Excel);

    // Dans une dialog, info.host peut être différent
    // Essayer d'initialiser quand même
    if (info.host === Office.HostType.Excel) {
        console.log('[App] Host is Excel, initializing...');
        initializeApp();
    } else {
        console.log('[App] Host is not Excel, but trying to initialize anyway for dialog context');
        // Tenter l'initialisation même si le host n'est pas explicitement Excel
        // Car dans une dialog, le contexte peut être différent
        initializeApp();
    }
});

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

        // Vérifier si Excel est disponible (avec timeout)
        console.log('[App] Checking Excel availability...');
        try {
            const excelCheck = Excel.run(async (context) => {
                console.log('[App] Inside Excel.run...');
                const tables = context.workbook.tables;
                tables.load('items/name');
                console.log('[App] Calling context.sync...');
                await context.sync();
                console.log('[App] Tables found:', tables.items.map(t => t.name));
                return true;
            });

            // Timeout de 5 secondes pour ne pas bloquer
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Excel check timeout')), 5000)
            );

            await Promise.race([excelCheck, timeout]);
            console.log('[App] Excel API is available');
        } catch (excelError) {
            console.warn('[App] Excel API check failed or timed out:', excelError.message);
            console.log('[App] Continuing anyway...');
        }

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
        migration: 'Migration',
        parc: 'Parc Applicatif',
        roadmap: 'Roadmap'
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

        // Rafraîchir selon la page
        switch (AppState.currentPage) {
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
