/* ===========================================
   PARAMETRES-HOME.JS - Page d'accueil Paramètres
   Application Carto
   =========================================== */

/**
 * Page d'accueil des paramètres avec vignettes thématiques
 */
class ParametresHomePage {
    constructor() {
        this.themes = CONFIG.PARAMETRES_THEMES || [];
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="parametres-home-page">
                <div class="page-header">
                    <h1>
                        <span class="icon">&#9881;</span>
                        Paramètres
                    </h1>
                    <p class="page-description">
                        Configurez les données de référence et les paramètres de l'application
                    </p>
                </div>

                <div class="themes-container" id="themesContainer">
                    ${this.renderThemes()}
                </div>
            </div>
        `;

        this.attachEvents();
    }

    /**
     * Rendu des thèmes avec leurs vignettes
     */
    renderThemes() {
        return this.themes.map(theme => `
            <div class="theme-section" data-theme-id="${theme.id}">
                <div class="theme-header">
                    <span class="theme-icon" style="color: ${theme.color}">${theme.icon}</span>
                    <h2 class="theme-title">${theme.label}</h2>
                </div>
                <div class="vignettes-grid">
                    ${this.renderVignettes(theme.vignettes)}
                </div>
            </div>
        `).join('');
    }

    /**
     * Rendu des vignettes d'un thème
     */
    renderVignettes(vignettes) {
        return vignettes.map(vignette => {
            const tableConfig = CONFIG.TABLES[vignette.table];
            const displayName = tableConfig ? tableConfig.displayName : vignette.label;
            const icon = tableConfig ? tableConfig.icon : vignette.icon;

            return `
                <div class="vignette-card" data-table="${vignette.table}" data-vignette-id="${vignette.id}">
                    <div class="vignette-icon">${icon}</div>
                    <div class="vignette-label">${displayName}</div>
                    <div class="vignette-hover-overlay">
                        <span class="vignette-cta">Configurer</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        // Clic sur une vignette
        document.querySelectorAll('.vignette-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const tableKey = card.dataset.table;

                // Navigation vers la page params correspondante
                if (typeof navigateTo === 'function') {
                    navigateTo('params', tableKey);
                }
            });
        });
    }

    /**
     * Détruit la page et libère la mémoire
     */
    destroy() {
        console.log('[ParametresHome] Destroying instance...');

        // Vider le tableau des thèmes
        this.themes = [];

        console.log('[ParametresHome] Instance destroyed');
    }
}

// Instance globale
let parametresHomePageInstance = null;

/**
 * Fonction d'entrée pour afficher la page
 * @returns {ParametresHomePage} Instance de la page
 */
async function renderParametresHomePage(container) {
    try {
        if (!parametresHomePageInstance) {
            parametresHomePageInstance = new ParametresHomePage();
        }
        await parametresHomePageInstance.render(container);
        return parametresHomePageInstance;
    } catch (error) {
        console.error('Erreur lors du rendu de la page Paramètres:', error);
        showError('Erreur lors du chargement de la page Paramètres');
        return null;
    }
}

/**
 * Fonction de rafraîchissement
 */
async function refreshParametresHomePage() {
    const container = document.getElementById('mainContent');
    if (container && parametresHomePageInstance) {
        await parametresHomePageInstance.render(container);
    }
}
