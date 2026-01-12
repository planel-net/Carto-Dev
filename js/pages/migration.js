/* ===========================================
   MIGRATION.JS - Page de suivi de la migration
   Application Carto
   =========================================== */

/**
 * Classe MigrationPage pour gérer la page de migration
 */
class MigrationPage {
    constructor() {
        this.stats = {
            shores: { total: 0, migre: 0, percent: 0 },
            projetsDss: { total: 0, migre: 0, percent: 0 },
            dataflows: { total: 0, migre: 0, percent: 0 },
            produits: { total: 0, migre: 0, percent: 0 }
        };
        this.produits = [];
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        console.log('[Migration] render() called');

        container.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Pilotage de la Migration</h1>
                    <p>Vue d'ensemble de l'avancement de la migration du parc applicatif</p>
                </div>
            </div>

            <!-- KPIs Migration -->
            <section class="section">
                <div class="migration-status-grid" id="migrationKpis">
                    <div class="migration-status-card" id="kpi-shores">
                        <div class="spinner"></div>
                    </div>
                    <div class="migration-status-card" id="kpi-projetsdss">
                        <div class="spinner"></div>
                    </div>
                    <div class="migration-status-card" id="kpi-dataflows">
                        <div class="spinner"></div>
                    </div>
                    <div class="migration-status-card" id="kpi-produits">
                        <div class="spinner"></div>
                    </div>
                    <div class="migration-status-card" id="kpi-global">
                        <div class="spinner"></div>
                    </div>
                </div>
            </section>

            <!-- Graphiques -->
            <section class="section">
                <div class="grid grid-2">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h4 class="chart-title">Avancement par type</h4>
                        </div>
                        <div class="chart-body" id="chartAvancement"></div>
                    </div>
                    <div class="chart-container">
                        <div class="chart-header">
                            <h4 class="chart-title">Statuts détaillés</h4>
                        </div>
                        <div class="chart-body" id="chartStatuts"></div>
                    </div>
                </div>
            </section>

            <!-- Vue dépendances -->
            <section class="section">
                <div class="card">
                    <div class="card-header">
                        <h4>Analyse des dépendances</h4>
                    </div>
                    <div class="card-body">
                        <div class="form-group" style="max-width: 400px;">
                            <label class="form-label">Sélectionner un produit</label>
                            <select id="selectProduit" class="form-select">
                                <option value="">-- Choisir un produit --</option>
                            </select>
                        </div>
                        <div id="dependencyView" style="margin-top: 24px;">
                            <p class="text-muted">Sélectionnez un produit pour voir sa chaîne de dépendances.</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Tableau des produits non migrés -->
            <section class="section">
                <div class="section-header">
                    <h3 class="section-title">Produits non migrés</h3>
                </div>
                <div id="tableNonMigres"></div>
            </section>
        `;

        await this.loadData();
        this.attachEvents();
    }

    /**
     * Charge les données
     */
    async loadData() {
        console.log('[Migration] loadData starting...');
        try {
            // Charger les statistiques de chaque type
            console.log('[Migration] Loading stats for tShores...');
            const shoresStats = await getMigrationStats('tShores', 'Migré Tech');
            console.log('[Migration] tShores stats:', shoresStats);

            console.log('[Migration] Loading stats for tProjetsDSS...');
            const dssStats = await getMigrationStats('tProjetsDSS', 'Statut migration');
            console.log('[Migration] tProjetsDSS stats:', dssStats);

            console.log('[Migration] Loading stats for tDataflows...');
            const dfStats = await getMigrationStats('tDataflows', 'Statut migration');
            console.log('[Migration] tDataflows stats:', dfStats);

            console.log('[Migration] Loading stats for tProduits...');
            const produitsStats = await getMigrationStats('tProduits', 'Statut Migration');
            console.log('[Migration] tProduits stats:', produitsStats);

            console.log('[Migration] Loading tProduits data...');
            const produitsData = await readTable('tProduits');
            console.log('[Migration] tProduits data count:', produitsData.data.length);

            this.stats = {
                shores: shoresStats,
                projetsDss: dssStats,
                dataflows: dfStats,
                produits: produitsStats
            };

            this.produits = produitsData.data;

            // Mettre à jour l'interface
            console.log('[Migration] Rendering KPIs...');
            this.renderKpis();
            console.log('[Migration] Rendering charts...');
            this.renderCharts();
            console.log('[Migration] Loading produits select...');
            this.loadProduitsSelect();
            console.log('[Migration] Rendering non-migres table...');
            this.renderNonMigresTable();
            console.log('[Migration] loadData complete');

        } catch (error) {
            console.error('[Migration] Erreur chargement données:', error);
            showError('Erreur lors du chargement des données de migration: ' + error.message);
        }
    }

    /**
     * Rendu des KPIs
     */
    renderKpis() {
        // Shores
        this.renderKpiCard('kpi-shores', {
            label: 'Shores / Golds',
            value: this.stats.shores.percentMigre,
            total: this.stats.shores.total,
            migre: this.stats.shores.migre,
            icon: '&#128451;'
        });

        // Projets DSS
        this.renderKpiCard('kpi-projetsdss', {
            label: 'Projets DSS',
            value: this.stats.projetsDss.percentMigre,
            total: this.stats.projetsDss.total,
            migre: this.stats.projetsDss.migre,
            icon: '&#128194;'
        });

        // Dataflows
        this.renderKpiCard('kpi-dataflows', {
            label: 'Dataflows',
            value: this.stats.dataflows.percentMigre,
            total: this.stats.dataflows.total,
            migre: this.stats.dataflows.migre,
            icon: '&#128260;'
        });

        // Produits
        this.renderKpiCard('kpi-produits', {
            label: 'Produits / Rapports',
            value: this.stats.produits.percentMigre,
            total: this.stats.produits.total,
            migre: this.stats.produits.migre,
            icon: '&#128202;'
        });

        // Global
        const totalItems = this.stats.shores.total + this.stats.projetsDss.total + this.stats.dataflows.total + this.stats.produits.total;
        const totalMigre = this.stats.shores.migre + this.stats.projetsDss.migre + this.stats.dataflows.migre + this.stats.produits.migre;
        const globalPercent = totalItems > 0 ? Math.round((totalMigre / totalItems) * 100) : 0;

        this.renderKpiCard('kpi-global', {
            label: 'Migration Globale',
            value: globalPercent,
            total: totalItems,
            migre: totalMigre,
            icon: '&#127919;',
            isGlobal: true
        });
    }

    /**
     * Rendu d'une carte KPI
     */
    renderKpiCard(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const statusClass = data.value >= 70 ? 'status-success' : data.value >= 30 ? 'status-warning' : 'status-danger';

        container.className = `migration-status-card ${statusClass}`;
        container.innerHTML = `
            <div class="status-icon">${data.icon}</div>
            <div class="status-value">${data.value}%</div>
            <div class="status-label">${data.label}</div>
            <div class="status-progress">
                <div class="status-progress-bar" style="width: ${data.value}%"></div>
            </div>
            <div style="font-size: 12px; color: var(--mh-gris-moyen); margin-top: 8px;">
                ${data.migre} / ${data.total} ${data.isGlobal ? 'éléments' : ''}
            </div>
        `;
    }

    /**
     * Rendu des graphiques
     */
    renderCharts() {
        // Graphique d'avancement par type
        createBarChart('chartAvancement', {
            labels: ['Shores', 'Projets DSS', 'Dataflows', 'Produits'],
            values: [
                this.stats.shores.percentMigre,
                this.stats.projetsDss.percentMigre,
                this.stats.dataflows.percentMigre,
                this.stats.produits.percentMigre
            ],
            colors: [
                getColorForPercent(this.stats.shores.percentMigre),
                getColorForPercent(this.stats.projetsDss.percentMigre),
                getColorForPercent(this.stats.dataflows.percentMigre),
                getColorForPercent(this.stats.produits.percentMigre)
            ]
        }, { horizontal: true, showValues: true });

        // Graphique des statuts
        const statuts = {
            'Migré': this.stats.produits.migre,
            'En cours': this.stats.produits.enCours,
            'Non migré': this.stats.produits.nonMigre,
            'Bloqué': this.stats.produits.bloque
        };

        createBarChart('chartStatuts', {
            labels: Object.keys(statuts),
            values: Object.values(statuts),
            colors: ['#28A745', '#FFC107', '#DC3545', '#6C757D']
        }, { horizontal: false, showValues: true });
    }

    /**
     * Charge la liste des produits dans le select
     */
    loadProduitsSelect() {
        const select = document.getElementById('selectProduit');
        if (!select) return;

        select.innerHTML = '<option value="">-- Choisir un produit --</option>';

        this.produits.forEach((produit, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = produit.Nom;
            select.appendChild(option);
        });
    }

    /**
     * Affiche la vue des dépendances pour un produit
     */
    async showDependencies(produitIndex) {
        const container = document.getElementById('dependencyView');
        const produit = this.produits[produitIndex];

        if (!produit) {
            container.innerHTML = '<p class="text-muted">Sélectionnez un produit pour voir sa chaîne de dépendances.</p>';
            return;
        }

        // Charger les données liées
        const [flux, projetsDss, dataflows, shores] = await Promise.all([
            readTable('tFlux'),
            readTable('tProjetsDSS'),
            readTable('tDataflows'),
            readTable('tShores')
        ]);

        // Trouver le flux correspondant au produit
        const fluxProduit = flux.data.find(f => f.Produit === produit.Nom);

        // Construire la chaîne de dépendances
        const shore = fluxProduit ? shores.data.find(s => s.Nom === fluxProduit['Shore/Gold']) : null;
        const projetDss = fluxProduit ? projetsDss.data.find(p => p['Nom projet'] === fluxProduit['Projet DSS']) : null;
        const dataflow = fluxProduit ? dataflows.data.find(d => d.Nom === fluxProduit['DFNom DF']) : null;

        container.innerHTML = `
            <div class="dependency-chain">
                ${shore ? this.renderDependencyNode('Shore / Gold', shore.Nom, shore['Migré Tech']) : ''}
                ${shore ? '<div class="dependency-arrow">&#8594;</div>' : ''}

                ${projetDss ? this.renderDependencyNode('Projet DSS', projetDss['Nom projet'], projetDss['Statut migration']) : ''}
                ${projetDss ? '<div class="dependency-arrow">&#8594;</div>' : ''}

                ${dataflow ? this.renderDependencyNode('Dataflow', dataflow.Nom, dataflow['Statut migration']) : ''}
                ${dataflow ? '<div class="dependency-arrow">&#8594;</div>' : ''}

                ${this.renderDependencyNode('Produit', produit.Nom, produit['Statut Migration'])}
            </div>

            ${!fluxProduit ? '<p class="text-muted mt-2">Aucun flux de migration défini pour ce produit.</p>' : ''}

            <div class="card mt-3" style="max-width: 600px;">
                <div class="card-body">
                    <h5 style="margin-bottom: 12px;">Détails du produit</h5>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
                        <div><strong>Responsable:</strong></div>
                        <div>${produit.Responsable || '-'}</div>
                        <div><strong>Type:</strong></div>
                        <div>${produit['Type de rapport'] || '-'}</div>
                        <div><strong>Périmètre:</strong></div>
                        <div>${produit['Perimétre fonctionnel'] || '-'}</div>
                        <div><strong>Gold actuel:</strong></div>
                        <div>${produit['Gold / Shore actuel'] || '-'}</div>
                        <div><strong>Problème:</strong></div>
                        <div>${produit['PB migration'] || '-'}</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rendu d'un noeud de dépendance
     */
    renderDependencyNode(type, name, status) {
        const statusClass = this.getStatusClass(status);
        return `
            <div class="dependency-item">
                <div class="dependency-node ${statusClass}">
                    <div class="dependency-node-label">${type}</div>
                    <div class="dependency-node-name">${escapeHtml(name || 'Non défini')}</div>
                    <span class="badge ${getMigrationStatusClass(status)}" style="margin-top: 8px;">
                        ${status || 'Non défini'}
                    </span>
                </div>
            </div>
        `;
    }

    /**
     * Retourne la classe CSS selon le statut
     */
    getStatusClass(status) {
        if (!status) return 'status-non-migre';
        const s = status.toLowerCase();
        if (s.includes('migré') || s === 'oui') return 'status-migre';
        if (s.includes('cours')) return 'status-en-cours';
        return 'status-non-migre';
    }

    /**
     * Rendu du tableau des produits non migrés
     */
    renderNonMigresTable() {
        const container = document.getElementById('tableNonMigres');
        if (!container) return;

        const nonMigres = this.produits.filter(p => {
            const status = (p['Statut Migration'] || '').toLowerCase();
            return !status.includes('migré');
        });

        if (nonMigres.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="card-body text-center">
                        <div style="font-size: 48px; margin-bottom: 16px;">&#127881;</div>
                        <h4>Tous les produits sont migrés !</h4>
                    </div>
                </div>
            `;
            return;
        }

        new DataTable(container, {
            tableName: 'tProduits',
            tableConfig: CONFIG.TABLES.PRODUITS,
            columns: [
                { field: 'Nom', label: 'Produit', type: 'text' },
                { field: 'Statut Migration', label: 'Statut', type: 'select' },
                { field: 'Responsable', label: 'Responsable', type: 'text' },
                { field: 'PB migration', label: 'Problème', type: 'text' }
            ],
            showToolbar: false,
            showPagination: true,
            editable: true
        });
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        const selectProduit = document.getElementById('selectProduit');
        if (selectProduit) {
            selectProduit.addEventListener('change', (e) => {
                const index = e.target.value;
                if (index !== '') {
                    this.showDependencies(parseInt(index));
                } else {
                    document.getElementById('dependencyView').innerHTML =
                        '<p class="text-muted">Sélectionnez un produit pour voir sa chaîne de dépendances.</p>';
                }
            });
        }
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        await this.loadData();
    }
}

// Instance globale
let migrationPageInstance = null;

/**
 * Rendu de la page Migration
 */
async function renderMigrationPage(container) {
    migrationPageInstance = new MigrationPage();
    await migrationPageInstance.render(container);
}

/**
 * Rafraîchit la page Migration
 */
async function refreshMigrationPage() {
    if (migrationPageInstance) {
        await migrationPageInstance.refresh();
    }
}
