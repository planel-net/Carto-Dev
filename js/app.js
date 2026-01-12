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
    if (info.host === Office.HostType.Excel) {
        initializeApp();
    } else {
        showError('Cette application fonctionne uniquement dans Excel.');
    }
});

/**
 * Initialise l'application
 */
async function initializeApp() {
    try {
        // Afficher le badge d'environnement
        showEnvironmentBadge();

        // Initialiser le sidebar
        initSidebar();

        // Attacher les événements de navigation
        document.addEventListener('navigate', handleNavigation);

        // Attacher les événements des boutons header
        attachHeaderEvents();

        // Charger la page par défaut
        await navigateTo('migration');

        // Masquer le loader initial
        hideLoading();

    } catch (error) {
        console.error('Erreur initialisation:', error);
        showError('Erreur lors de l\'initialisation de l\'application');
    }
}

/**
 * Gère la navigation
 */
function handleNavigation(event) {
    const { page, table } = event.detail;
    navigateTo(page, table);
}

/**
 * Navigue vers une page
 * @param {string} page - ID de la page
 * @param {string} table - Clé de la table (pour les pages params)
 */
async function navigateTo(page, table = null) {
    if (AppState.isLoading) return;

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
