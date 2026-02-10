/* ===========================================
   SIDEBAR.JS - Composant menu latéral
   Application Carto
   =========================================== */

/**
 * Classe Sidebar pour gérer le menu latéral
 */
class Sidebar {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.overlay = document.getElementById('sidebarOverlay');
        this.toggleBtn = document.getElementById('btnToggleSidebar');
        this.mobileMenuBtn = document.getElementById('btnMobileMenu');
        this.navItems = document.querySelectorAll('.nav-item');
        this.isCollapsed = false;
        this.isMobileOpen = false;

        this.init();
    }

    /**
     * Initialise le sidebar
     */
    init() {
        // Toggle sidebar (desktop)
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }

        // Menu mobile
        if (this.mobileMenuBtn) {
            this.mobileMenuBtn.addEventListener('click', () => this.toggleMobile());
        }

        // Fermer sur overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeMobile());
        }

        // Navigation
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => this.handleNavClick(e, item));
        });

        // Restaurer l'état depuis localStorage
        this.restoreState();
    }

    /**
     * Toggle le sidebar (collapse/expand) sur desktop
     */
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.sidebar.classList.toggle('collapsed', this.isCollapsed);

        // Sauvegarder l'état
        localStorage.setItem('sidebar_collapsed', this.isCollapsed);
    }

    /**
     * Toggle le sidebar sur mobile
     */
    toggleMobile() {
        this.isMobileOpen = !this.isMobileOpen;
        this.sidebar.classList.toggle('open', this.isMobileOpen);
        this.overlay.classList.toggle('show', this.isMobileOpen);
    }

    /**
     * Ferme le sidebar mobile
     */
    closeMobile() {
        this.isMobileOpen = false;
        this.sidebar.classList.remove('open');
        this.overlay.classList.remove('show');
    }

    /**
     * Gère le clic sur un élément de navigation
     */
    handleNavClick(event, item) {
        event.preventDefault();

        console.log('[Sidebar] Nav click:', item.dataset.page, item.dataset.table);

        // Retirer la classe active de tous les éléments
        this.navItems.forEach(nav => nav.classList.remove('active'));

        // Ajouter la classe active à l'élément cliqué
        item.classList.add('active');

        // Fermer le menu mobile si ouvert
        this.closeMobile();

        // Récupérer les données de navigation
        const page = item.dataset.page;
        const table = item.dataset.table;

        // Déclencher l'événement de navigation
        const navEvent = new CustomEvent('navigate', {
            detail: { page, table }
        });
        document.dispatchEvent(navEvent);
        console.log('[Sidebar] Navigation event dispatched');
    }

    /**
     * Active un élément de navigation par son identifiant
     * @param {string} page - ID de la page
     * @param {string} table - ID de la table (optionnel)
     */
    setActive(page, table = null) {
        this.navItems.forEach(item => {
            const itemPage = item.dataset.page;
            const itemTable = item.dataset.table;

            // Si on navigue vers une page params-*, activer l'élément "parametres-home"
            const isParamsPage = page === 'params' || (typeof page === 'string' && page.startsWith('params-'));
            const isParametresHome = itemPage === 'parametres-home';

            if (isParamsPage && isParametresHome) {
                item.classList.add('active');
            } else if (itemPage === page && (!table || itemTable === table)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Restaure l'état du sidebar depuis localStorage
     */
    restoreState() {
        const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
        if (collapsed) {
            this.isCollapsed = true;
            this.sidebar.classList.add('collapsed');
        }
    }

    /**
     * Ajoute un badge à un élément de navigation
     * @param {string} page - ID de la page
     * @param {string|number} value - Valeur du badge
     * @param {string} type - Type de badge (success, warning, danger)
     */
    setBadge(page, value, type = 'primary') {
        const item = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (!item) return;

        // Supprimer le badge existant
        const existingBadge = item.querySelector('.nav-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Ajouter le nouveau badge si valeur
        if (value) {
            const badge = document.createElement('span');
            badge.className = `nav-badge badge badge-${type}`;
            badge.textContent = value;
            item.appendChild(badge);
        }
    }
}

// Instance globale
let sidebarInstance = null;

/**
 * Initialise le sidebar
 * @returns {Sidebar} Instance du sidebar
 */
function initSidebar() {
    if (!sidebarInstance) {
        sidebarInstance = new Sidebar();
    }
    return sidebarInstance;
}

/**
 * Obtient l'instance du sidebar
 * @returns {Sidebar} Instance
 */
function getSidebar() {
    return sidebarInstance;
}
