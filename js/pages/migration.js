/* ===========================================
   MIGRATION.JS - Page Backlog (anciennement Cartographie)
   Application Carto
   =========================================== */

/**
 * Classe MigrationPage pour gérer la page de migration
 */
class MigrationPage {
    constructor() {
        this.stats = {
            tablesMh: { total: 0, migre: 0, percent: 0 },
            shores: { total: 0, migre: 0, percent: 0 },
            projetsDss: { total: 0, migre: 0, percent: 0 },
            dataflows: { total: 0, migre: 0, percent: 0 },
            produits: { total: 0, migre: 0, percent: 0 }
        };
        this.filteredStats = null; // Stats filtrées pour un produit sélectionné
        this.selectedProduitIndex = null;
        this.produits = [];
        this.flux = [];
        this.shores = [];
        this.projetsDss = [];
        this.dataflows = [];
        this.tablesMh = [];
        this.expandedRows = new Set();
    }

    /**
     * Normalise une chaîne pour comparaison (lowercase, sans underscores)
     */
    normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/_/g, '').replace(/\s+/g, '');
    }

    /**
     * Trouve les tables MH Tech associées à un Shore via la colonne UC
     */
    findTablesForShore(shoreName) {
        if (!shoreName || !this.tablesMh.length) return [];
        const normalizedShoreName = this.normalizeString(shoreName);
        return this.tablesMh.filter(t => {
            const normalizedUC = this.normalizeString(t.UC);
            return normalizedUC === normalizedShoreName ||
                   normalizedShoreName.includes(normalizedUC) ||
                   normalizedUC.includes(normalizedShoreName);
        });
    }

    /**
     * Calcule les stats filtrées pour un produit spécifique
     */
    calculateFilteredStats(produit, fluxProduits) {
        const uniqueShores = new Set();
        const uniqueProjetsDss = new Set();
        const uniqueDataflows = new Set();
        const uniqueTables = new Set();

        fluxProduits.forEach(f => {
            if (f['Shore/Gold']) uniqueShores.add(f['Shore/Gold']);
            if (f['Projet DSS']) uniqueProjetsDss.add(f['Projet DSS']);
            if (f['DFNom DF']) uniqueDataflows.add(f['DFNom DF']);
        });

        // Trouver les tables associées via les shores
        uniqueShores.forEach(shoreName => {
            const tables = this.findTablesForShore(shoreName);
            tables.forEach(t => uniqueTables.add(t.Table));
        });

        // Calculer les stats pour chaque type
        const calcStats = (items, sourceData, nameField, statusField) => {
            const total = items.size;
            let migre = 0;
            items.forEach(itemName => {
                const item = sourceData.find(s => s[nameField] === itemName);
                if (item) {
                    const status = (item[statusField] || '').toLowerCase();
                    if (status.includes('terminé') || status.includes('migré') || status === 'oui') {
                        migre++;
                    }
                }
            });
            return { total, migre, percentMigre: total > 0 ? Math.round((migre / total) * 100) : 0 };
        };

        // Tables stats
        const tablesStats = (() => {
            const total = uniqueTables.size;
            let migre = 0;
            uniqueTables.forEach(tableName => {
                const table = this.tablesMh.find(t => t.Table === tableName);
                if (table) {
                    const status = (table['OK DA ?'] || '').toLowerCase();
                    if (status === 'oui' || status.includes('migré')) {
                        migre++;
                    }
                }
            });
            return { total, migre, percentMigre: total > 0 ? Math.round((migre / total) * 100) : 0 };
        })();

        // Statut du produit lui-même
        const prodStatus = (produit['Statut Migration'] || '').toLowerCase();
        const produitMigre = prodStatus.includes('terminé') || prodStatus.includes('migré') ? 1 : 0;

        this.filteredStats = {
            tablesMh: tablesStats,
            shores: calcStats(uniqueShores, this.shores, 'Nom', 'Migré Tech'),
            projetsDss: calcStats(uniqueProjetsDss, this.projetsDss, 'Nom projet', 'Statut migration'),
            dataflows: calcStats(uniqueDataflows, this.dataflows, 'Nom', 'Statut migration'),
            produits: { total: 1, migre: produitMigre, percentMigre: produitMigre * 100 }
        };
    }

    /**
     * Réinitialise le filtre des KPIs
     */
    clearFilter() {
        this.filteredStats = null;
        this.selectedProduitIndex = null;

        // Réinitialiser le select
        const selectProduit = document.getElementById('selectProduit');
        if (selectProduit) {
            selectProduit.value = '';
        }

        // Réinitialiser la vue des dépendances
        const dependencyView = document.getElementById('dependencyView');
        if (dependencyView) {
            dependencyView.innerHTML = '<p class="text-muted">Sélectionnez un produit pour voir sa chaîne de dépendances complète.</p>';
        }

        // Recalculer les KPIs
        this.renderKpis();

        showSuccess('Filtre réinitialisé');
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        console.log('[Migration] render() called');

        container.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Cartographie</h1>
                    <p>Vue d'ensemble de l'avancement de la migration du parc applicatif</p>
                </div>
            </div>

            <!-- KPIs Migration avec flèches -->
            <section class="section">
                <div class="kpi-header-row">
                    <span></span>
                    <button id="btnClearFilter" class="btn btn-sm btn-secondary" style="display: none;">
                        &#10005; Réinitialiser le filtre
                    </button>
                </div>
                <div class="migration-pipeline" id="migrationKpis">
                    <div class="migration-status-card" id="kpi-tablesmh">
                        <div class="spinner"></div>
                    </div>
                    <div class="pipeline-arrow">&#8594;</div>
                    <div class="migration-status-card" id="kpi-shores">
                        <div class="spinner"></div>
                    </div>
                    <div class="pipeline-arrow">&#8594;</div>
                    <div class="migration-status-card" id="kpi-projetsdss">
                        <div class="spinner"></div>
                    </div>
                    <div class="pipeline-arrow">&#8594;</div>
                    <div class="migration-status-card" id="kpi-dataflows">
                        <div class="spinner"></div>
                    </div>
                    <div class="pipeline-arrow">&#8594;</div>
                    <div class="migration-status-card" id="kpi-produits">
                        <div class="spinner"></div>
                    </div>
                    <div class="pipeline-spacer"></div>
                    <div class="migration-status-card kpi-total" id="kpi-global">
                        <div class="spinner"></div>
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
                            <p class="text-muted">Sélectionnez un produit pour voir sa chaîne de dépendances complète.</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Tableau de suivi par produit -->
            <section class="section">
                <div class="section-header">
                    <h3 class="section-title">Suivi par produit</h3>
                </div>
                <div class="card">
                    <div class="card-body" style="padding: 0;">
                        <div id="productProgressTable"></div>
                    </div>
                </div>
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
            // Charger les statistiques et données de chaque type en parallèle
            console.log('[Migration] Loading all stats and data...');
            const [tablesMhStats, shoresStats, dssStats, dfStats, produitsStats,
                   produitsData, fluxData, shoresData, projetsDssData, dataflowsData, tablesMhData] = await Promise.all([
                getMigrationStats('tTablesMHTech', 'OK DA ?'),
                getMigrationStats('tShores', 'Migré Tech'),
                getMigrationStats('tProjetsDSS', 'Statut migration'),
                getMigrationStats('tDataflows', 'Statut migration'),
                getMigrationStats('tProduits', 'Statut Migration'),
                readTable('tProduits'),
                readTable('tFlux'),
                readTable('tShores'),
                readTable('tProjetsDSS'),
                readTable('tDataflows'),
                readTable('tTablesMHTech')
            ]);

            console.log('[Migration] Stats loaded:', { tablesMhStats, shoresStats, dssStats, dfStats, produitsStats });

            this.stats = {
                tablesMh: tablesMhStats,
                shores: shoresStats,
                projetsDss: dssStats,
                dataflows: dfStats,
                produits: produitsStats
            };

            this.produits = produitsData.data;
            this.flux = fluxData.data;
            this.shores = shoresData.data;
            this.projetsDss = projetsDssData.data;
            this.dataflows = dataflowsData.data;
            this.tablesMh = tablesMhData.data;

            // Mettre à jour l'interface
            console.log('[Migration] Rendering KPIs...');
            this.renderKpis();
            console.log('[Migration] Loading produits select...');
            this.loadProduitsSelect();
            console.log('[Migration] Rendering product progress table...');
            this.renderProductProgressTable();
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
        // Utiliser les stats filtrées si un produit est sélectionné
        const stats = this.filteredStats || this.stats;
        const isFiltered = !!this.filteredStats;
        const filterLabel = isFiltered ? ' (filtré)' : '';

        // Afficher/masquer le bouton de réinitialisation du filtre
        const clearFilterBtn = document.getElementById('btnClearFilter');
        if (clearFilterBtn) {
            clearFilterBtn.style.display = isFiltered ? 'inline-block' : 'none';
        }

        // Tables MH Tech
        this.renderKpiCard('kpi-tablesmh', {
            label: 'Tables MH Tech' + filterLabel,
            value: stats.tablesMh.percentMigre,
            total: stats.tablesMh.total,
            migre: stats.tablesMh.migre,
            icon: '&#128451;',
            isFiltered
        });

        // Shores
        this.renderKpiCard('kpi-shores', {
            label: 'Shores / Golds' + filterLabel,
            value: stats.shores.percentMigre,
            total: stats.shores.total,
            migre: stats.shores.migre,
            icon: '&#128451;',
            isFiltered
        });

        // Projets DSS
        this.renderKpiCard('kpi-projetsdss', {
            label: 'Projets DSS' + filterLabel,
            value: stats.projetsDss.percentMigre,
            total: stats.projetsDss.total,
            migre: stats.projetsDss.migre,
            icon: '&#128194;',
            isFiltered
        });

        // Dataflows
        this.renderKpiCard('kpi-dataflows', {
            label: 'Dataflows' + filterLabel,
            value: stats.dataflows.percentMigre,
            total: stats.dataflows.total,
            migre: stats.dataflows.migre,
            icon: '&#128260;',
            isFiltered
        });

        // Produits
        this.renderKpiCard('kpi-produits', {
            label: 'Produits / Rapports' + filterLabel,
            value: stats.produits.percentMigre,
            total: stats.produits.total,
            migre: stats.produits.migre,
            icon: '&#128202;',
            isFiltered
        });

        // Global (inclut tous les types)
        const totalItems = stats.tablesMh.total + stats.shores.total + stats.projetsDss.total + stats.dataflows.total + stats.produits.total;
        const totalMigre = stats.tablesMh.migre + stats.shores.migre + stats.projetsDss.migre + stats.dataflows.migre + stats.produits.migre;
        const globalPercent = totalItems > 0 ? Math.round((totalMigre / totalItems) * 100) : 0;

        this.renderKpiCard('kpi-global', {
            label: isFiltered ? 'Lineage Produit' : 'Migration Globale',
            value: globalPercent,
            total: totalItems,
            migre: totalMigre,
            icon: '&#127919;',
            isGlobal: true,
            isFiltered
        });
    }

    /**
     * Rendu d'une carte KPI
     */
    renderKpiCard(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const statusClass = data.value >= 70 ? 'status-success' : data.value >= 30 ? 'status-warning' : 'status-danger';
        const filteredClass = data.isFiltered ? 'is-filtered' : '';

        container.className = `migration-status-card ${statusClass} ${filteredClass}`;
        container.innerHTML = `
            ${data.isFiltered ? '<div class="kpi-filter-badge">Filtré</div>' : ''}
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
            container.innerHTML = '<p class="text-muted">Sélectionnez un produit pour voir sa chaîne de dépendances complète.</p>';
            // Réinitialiser les stats filtrées
            this.filteredStats = null;
            this.selectedProduitIndex = null;
            this.renderKpis();
            return;
        }

        // Mémoriser le produit sélectionné
        this.selectedProduitIndex = produitIndex;

        // Afficher un spinner pendant le chargement
        container.innerHTML = '<div class="spinner"></div>';

        // Trouver tous les flux correspondant au produit
        const fluxProduits = this.flux.filter(f => f.Produit === produit.Nom);

        // Calculer les stats filtrées pour ce produit
        this.calculateFilteredStats(produit, fluxProduits);
        this.renderKpis();

        if (fluxProduits.length === 0) {
            container.innerHTML = `
                <p class="text-muted">Aucun flux de migration défini pour ce produit.</p>
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
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Construire le graphique visuel de lineage
        const lineageGraph = this.renderLineageGraph(produit, fluxProduits);

        let html = `
            <h5 style="margin-bottom: 12px;">Lineage complet</h5>
            ${lineageGraph.html}

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

        container.innerHTML = html;

        // Dessiner les lignes de connexion après que le DOM soit prêt
        this.drawLineageConnections(lineageGraph.relations);
    }

    /**
     * Rendu d'un noeud de dépendance
     */
    renderDependencyNode(type, name, status, icon = null) {
        const statusClass = this.getStatusClass(status);
        return `
            <div class="dependency-item">
                <div class="dependency-node ${statusClass}">
                    ${icon ? `<div class="dependency-node-icon">${icon}</div>` : ''}
                    <div class="dependency-node-label">${type}</div>
                    <div class="dependency-node-name">${escapeHtml(name || 'Non défini')}</div>
                    ${status ? `<span class="badge ${getMigrationStatusClass(status)}" style="margin-top: 8px;">${status}</span>` : ''}
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
        // Gérer les différents formats: "Terminé", "Migré", "Oui"
        if (s.includes('terminé') || s.includes('migré') || s === 'oui') return 'status-migre';
        if (s.includes('cours')) return 'status-en-cours';
        return 'status-non-migre';
    }

    /**
     * Formate une date pour l'affichage
     */
    formatDate(dateValue) {
        if (!dateValue) return '-';
        try {
            // Gérer les dates Excel (nombre de jours depuis 1900)
            if (typeof dateValue === 'number') {
                const date = new Date((dateValue - 25569) * 86400 * 1000);
                return date.toLocaleDateString('fr-FR');
            }
            // Gérer les chaînes de date
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return dateValue;
            return date.toLocaleDateString('fr-FR');
        } catch {
            return dateValue || '-';
        }
    }

    /**
     * Tronque un texte à une longueur maximale
     */
    truncateText(text, maxLength) {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * Rendu du tableau de suivi par produit
     */
    async renderProductProgressTable() {
        const container = document.getElementById('productProgressTable');
        if (!container) return;

        // Calculer les stats par produit (utilise les données déjà chargées)
        const productStats = this.produits.map(produit => {
            // Trouver les flux de ce produit
            const productFlux = this.flux.filter(f => f.Produit === produit.Nom);

            // Collecter les éléments uniques liés à ce produit
            const uniqueShores = new Set();
            const uniqueProjetsDss = new Set();
            const uniqueDataflows = new Set();
            const uniqueTables = new Set();

            productFlux.forEach(f => {
                if (f['Shore/Gold']) uniqueShores.add(f['Shore/Gold']);
                if (f['Projet DSS']) uniqueProjetsDss.add(f['Projet DSS']);
                if (f['DFNom DF']) uniqueDataflows.add(f['DFNom DF']);
            });

            // Trouver les tables associées via les shores (utilise la colonne UC)
            uniqueShores.forEach(shoreName => {
                const tables = this.findTablesForShore(shoreName);
                tables.forEach(t => uniqueTables.add(t.Table));
            });

            // Calculer les stats de migration pour chaque type
            const calcStats = (items, sourceData, nameField, statusField) => {
                const total = items.size;
                let migre = 0;
                items.forEach(itemName => {
                    const item = sourceData.find(s => s[nameField] === itemName);
                    if (item) {
                        const status = (item[statusField] || '').toLowerCase();
                        if (status.includes('terminé') || status.includes('migré') || status === 'oui') {
                            migre++;
                        }
                    }
                });
                return { total, migre, percent: total > 0 ? Math.round((migre / total) * 100) : 0 };
            };

            const tablesStats = (() => {
                const total = uniqueTables.size;
                let migre = 0;
                uniqueTables.forEach(tableName => {
                    const table = this.tablesMh.find(t => t.Table === tableName);
                    if (table) {
                        const status = (table['OK DA ?'] || '').toLowerCase();
                        if (status === 'oui' || status.includes('migré')) {
                            migre++;
                        }
                    }
                });
                return { total, migre, percent: total > 0 ? Math.round((migre / total) * 100) : 0 };
            })();

            const shoresStats = calcStats(uniqueShores, this.shores, 'Nom', 'Migré Tech');
            const dssStats = calcStats(uniqueProjetsDss, this.projetsDss, 'Nom projet', 'Statut migration');
            const dfStats = calcStats(uniqueDataflows, this.dataflows, 'Nom', 'Statut migration');

            // Statut du produit lui-même
            const prodStatus = (produit['Statut Migration'] || '').toLowerCase();
            const produitMigre = prodStatus.includes('terminé') || prodStatus.includes('migré') ? 1 : 0;

            return {
                produit,
                flux: productFlux,
                stats: {
                    tables: tablesStats,
                    shores: shoresStats,
                    projetsDss: dssStats,
                    dataflows: dfStats,
                    produit: { total: 1, migre: produitMigre, percent: produitMigre * 100 }
                }
            };
        });

        // Générer le HTML du tableau
        let html = `
            <table class="product-progress-table">
                <thead>
                    <tr>
                        <th style="width: 40px;"></th>
                        <th>Produit</th>
                        <th>Tables MH Tech</th>
                        <th>Shores</th>
                        <th>Projets DSS</th>
                        <th>Dataflows</th>
                        <th>Produit</th>
                        <th style="width: 100px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        productStats.forEach((ps, index) => {
            const isExpanded = this.expandedRows.has(index);
            html += `
                <tr class="product-row" data-index="${index}">
                    <td>
                        <button class="btn-expand" data-index="${index}" title="${isExpanded ? 'Réduire' : 'Développer'}">
                            ${isExpanded ? '−' : '+'}
                        </button>
                    </td>
                    <td><strong>${escapeHtml(ps.produit.Nom)}</strong></td>
                    <td>${this.renderMiniProgress(ps.stats.tables)}</td>
                    <td>${this.renderMiniProgress(ps.stats.shores)}</td>
                    <td>${this.renderMiniProgress(ps.stats.projetsDss)}</td>
                    <td>${this.renderMiniProgress(ps.stats.dataflows)}</td>
                    <td>${this.renderMiniProgress(ps.stats.produit)}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary btn-lineage" data-index="${index}" title="Voir le lineage complet">
                            Lineage
                        </button>
                    </td>
                </tr>
            `;

            // Lignes de détail des flux (si développé)
            if (isExpanded && ps.flux.length > 0) {
                // Afficher un sous-tableau avec toutes les colonnes du flux
                html += `
                    <tr class="flux-detail-row">
                        <td></td>
                        <td colspan="7" style="padding: 0; background: var(--mh-gris-clair);">
                            <div class="flux-nested-table-wrapper">
                                <table class="flux-nested-table">
                                    <thead>
                                        <tr>
                                            <th>Shore/Gold</th>
                                            <th>Projet DSS</th>
                                            <th>Dataflow</th>
                                            <th>Charge (jh)</th>
                                            <th>Estimation</th>
                                            <th>Date prévue</th>
                                            <th>Sprint</th>
                                            <th>Éligible SLA</th>
                                            <th>Commentaire</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                `;

                ps.flux.forEach((fluxItem) => {
                    const fluxId = this.flux.findIndex(f =>
                        f.Produit === fluxItem.Produit &&
                        f['Shore/Gold'] === fluxItem['Shore/Gold'] &&
                        f['Projet DSS'] === fluxItem['Projet DSS'] &&
                        f['DFNom DF'] === fluxItem['DFNom DF']
                    );

                    // Trouver les statuts de migration pour chaque élément
                    const shore = this.shores.find(s => s.Nom === fluxItem['Shore/Gold']);
                    const projetDss = this.projetsDss.find(p => p['Nom projet'] === fluxItem['Projet DSS']);
                    const dataflow = this.dataflows.find(d => d.Nom === fluxItem['DFNom DF']);

                    const shoreStatus = this.getStatusClass(shore ? shore['Migré Tech'] : null);
                    const dssStatus = this.getStatusClass(projetDss ? projetDss['Statut migration'] : null);
                    const dfStatus = this.getStatusClass(dataflow ? dataflow['Statut migration'] : null);

                    html += `
                        <tr>
                            <td><span class="migration-status-icon ${shoreStatus}"></span>${escapeHtml(fluxItem['Shore/Gold'] || '-')}</td>
                            <td><span class="migration-status-icon ${dssStatus}"></span>${escapeHtml(fluxItem['Projet DSS'] || '-')}</td>
                            <td><span class="migration-status-icon ${dfStatus}"></span>${escapeHtml(fluxItem['DFNom DF'] || '-')}</td>
                            <td>${escapeHtml(fluxItem['Charge (jh)'] || '-')}</td>
                            <td>${escapeHtml(fluxItem['Estimation'] || '-')}</td>
                            <td>${this.formatDate(fluxItem['Date prévisionnelle migration'])}</td>
                            <td>${escapeHtml(fluxItem['Sprint'] || '-')}</td>
                            <td>${escapeHtml(fluxItem['Eligible SLA'] || '-')}</td>
                            <td class="flux-comment-cell" title="${escapeHtml(fluxItem['Commentaire'] || '')}">${escapeHtml(this.truncateText(fluxItem['Commentaire'], 30))}</td>
                            <td class="flux-actions-cell">
                                <button class="btn btn-xs btn-secondary btn-edit-flux" data-flux-index="${fluxId}" data-produit-index="${index}" title="Modifier">
                                    &#9998;
                                </button>
                                <button class="btn btn-xs btn-danger btn-delete-flux" data-flux-index="${fluxId}" data-produit-index="${index}" title="Supprimer">
                                    &#128465;
                                </button>
                            </td>
                        </tr>
                    `;
                });

                html += `
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                `;
            } else if (isExpanded && ps.flux.length === 0) {
                html += `
                    <tr class="flux-detail-row">
                        <td></td>
                        <td colspan="7" style="padding: 16px 40px; font-style: italic; color: var(--mh-gris-moyen); background: var(--mh-gris-clair);">
                            Aucun flux défini pour ce produit.
                            <button class="btn btn-sm btn-primary btn-add-flux" data-produit-index="${index}" style="margin-left: 16px;">
                                + Ajouter un flux
                            </button>
                        </td>
                    </tr>
                `;
            }
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;

        // Attacher les événements
        this.attachProgressTableEvents();
    }

    /**
     * Rendu d'une mini barre de progression
     */
    renderMiniProgress(stats) {
        const colorClass = stats.percent >= 70 ? 'success' : stats.percent >= 30 ? 'warning' : 'danger';
        return `
            <div class="mini-progress">
                <div class="mini-progress-bar">
                    <div class="mini-progress-fill ${colorClass}" style="width: ${stats.percent}%"></div>
                </div>
                <div class="mini-progress-text">
                    <span class="mini-progress-count">${stats.migre}/${stats.total}</span>
                    <span class="mini-progress-percent">${stats.percent}%</span>
                </div>
            </div>
        `;
    }

    /**
     * Attache les événements du tableau de progression
     */
    attachProgressTableEvents() {
        // Boutons d'expansion
        document.querySelectorAll('.btn-expand').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                if (this.expandedRows.has(index)) {
                    this.expandedRows.delete(index);
                } else {
                    this.expandedRows.add(index);
                }
                this.renderProductProgressTable();
            });
        });

        // Boutons de lineage
        document.querySelectorAll('.btn-lineage').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.showLineagePopup(index);
            });
        });

        // Boutons d'édition de flux
        document.querySelectorAll('.btn-edit-flux').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fluxIndex = parseInt(e.currentTarget.dataset.fluxIndex);
                this.editFlux(fluxIndex);
            });
        });

        // Boutons de suppression de flux
        document.querySelectorAll('.btn-delete-flux').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fluxIndex = parseInt(e.currentTarget.dataset.fluxIndex);
                this.confirmDeleteFlux(fluxIndex);
            });
        });

        // Boutons d'ajout de flux
        document.querySelectorAll('.btn-add-flux').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const produitIndex = parseInt(e.currentTarget.dataset.produitIndex);
                this.addFlux(produitIndex);
            });
        });
    }

    /**
     * Ouvre le formulaire d'édition d'un flux
     */
    async editFlux(fluxIndex) {
        const flux = this.flux[fluxIndex];
        if (!flux) {
            showError('Flux non trouvé');
            return;
        }

        // Préparer les options pour les selects
        const shoresOptions = this.shores.map(s => s.Nom);
        const projetsDssOptions = this.projetsDss.map(p => p['Nom projet']);
        const dataflowsOptions = this.dataflows.map(d => d.Nom);
        const produitsOptions = this.produits.map(p => p.Nom);

        const content = `
            <form id="formEditFlux" class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Produit</label>
                        <select name="Produit" class="form-select" required>
                            ${produitsOptions.map(p => `<option value="${escapeHtml(p)}" ${p === flux.Produit ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Shore/Gold</label>
                        <select name="Shore/Gold" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${shoresOptions.map(s => `<option value="${escapeHtml(s)}" ${s === flux['Shore/Gold'] ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Projet DSS</label>
                        <select name="Projet DSS" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${projetsDssOptions.map(p => `<option value="${escapeHtml(p)}" ${p === flux['Projet DSS'] ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Dataflow</label>
                        <select name="DFNom DF" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${dataflowsOptions.map(d => `<option value="${escapeHtml(d)}" ${d === flux['DFNom DF'] ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Charge (jh)</label>
                        <input type="number" name="Charge (jh)" class="form-input" value="${flux['Charge (jh)'] || ''}" step="0.5" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Estimation</label>
                        <input type="text" name="Estimation" class="form-input" value="${escapeHtml(flux['Estimation'] || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Date prévisionnelle migration</label>
                        <input type="date" name="Date prévisionnelle migration" class="form-input" value="${this.formatDateForInput(flux['Date prévisionnelle migration'])}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sprint</label>
                        <select name="Sprint" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${this.getSprintOptions().map(s => `<option value="${escapeHtml(s)}" ${s === flux['Sprint'] ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Éligible SLA</label>
                        <select name="Eligible SLA" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            <option value="Oui" ${flux['Eligible SLA'] === 'Oui' ? 'selected' : ''}>Oui</option>
                            <option value="Non" ${flux['Eligible SLA'] === 'Non' ? 'selected' : ''}>Non</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Commentaire</label>
                    <textarea name="Commentaire" class="form-textarea" rows="3">${escapeHtml(flux['Commentaire'] || '')}</textarea>
                </div>
            </form>
        `;

        showModal({
            title: 'Modifier le flux',
            content: content,
            size: 'large',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Enregistrer',
                    class: 'btn-primary',
                    action: async () => {
                        await this.saveFlux(fluxIndex);
                    }
                }
            ]
        });
    }

    /**
     * Génère la liste des sprints disponibles
     */
    getSprintOptions() {
        // Extraire les sprints uniques existants dans les flux
        const existingSprints = new Set();
        this.flux.forEach(f => {
            if (f['Sprint']) {
                existingSprints.add(f['Sprint']);
            }
        });

        // Sprints standards (S1 à S12 par défaut)
        const standardSprints = [];
        for (let i = 1; i <= 12; i++) {
            standardSprints.push(`S${i}`);
        }

        // Combiner les sprints existants et standards, en éliminant les doublons
        const allSprints = new Set([...standardSprints, ...existingSprints]);
        return Array.from(allSprints).sort((a, b) => {
            // Trier par numéro si le format est S[num]
            const numA = parseInt(a.replace(/\D/g, '')) || 999;
            const numB = parseInt(b.replace(/\D/g, '')) || 999;
            return numA - numB;
        });
    }

    /**
     * Formate une date pour un input date
     */
    formatDateForInput(dateValue) {
        if (!dateValue) return '';
        try {
            let date;
            if (typeof dateValue === 'number') {
                date = new Date((dateValue - 25569) * 86400 * 1000);
            } else {
                date = new Date(dateValue);
            }
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
        } catch {
            return '';
        }
    }

    /**
     * Sauvegarde un flux modifié
     */
    async saveFlux(fluxIndex) {
        const form = document.getElementById('formEditFlux');
        if (!form) return;

        const formData = new FormData(form);
        const updatedFlux = {};

        for (const [key, value] of formData.entries()) {
            updatedFlux[key] = value;
        }

        try {
            // Mettre à jour dans Excel via la table tFlux
            await updateTableRow('tFlux', fluxIndex + 2, updatedFlux); // +2 car index Excel commence à 1 et il y a l'en-tête

            showSuccess('Flux mis à jour avec succès');
            closeModal();

            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Erreur lors de la mise à jour du flux:', error);
            showError('Erreur lors de la mise à jour: ' + error.message);
        }
    }

    /**
     * Confirmation de suppression d'un flux
     */
    confirmDeleteFlux(fluxIndex) {
        const flux = this.flux[fluxIndex];
        if (!flux) return;

        showModal({
            title: 'Confirmer la suppression',
            content: `
                <p>Êtes-vous sûr de vouloir supprimer ce flux ?</p>
                <div class="alert alert-warning" style="margin-top: 16px;">
                    <strong>Produit:</strong> ${escapeHtml(flux.Produit || '-')}<br>
                    <strong>Shore:</strong> ${escapeHtml(flux['Shore/Gold'] || '-')}<br>
                    <strong>Projet DSS:</strong> ${escapeHtml(flux['Projet DSS'] || '-')}<br>
                    <strong>Dataflow:</strong> ${escapeHtml(flux['DFNom DF'] || '-')}
                </div>
                <p class="text-danger" style="margin-top: 12px;">Cette action est irréversible.</p>
            `,
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Supprimer',
                    class: 'btn-danger',
                    action: async () => {
                        await this.deleteFlux(fluxIndex);
                    }
                }
            ]
        });
    }

    /**
     * Supprime un flux
     */
    async deleteFlux(fluxIndex) {
        try {
            await deleteTableRow('tFlux', fluxIndex + 2); // +2 car index Excel

            showSuccess('Flux supprimé avec succès');
            closeModal();

            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Erreur lors de la suppression du flux:', error);
            showError('Erreur lors de la suppression: ' + error.message);
        }
    }

    /**
     * Ouvre le formulaire d'ajout d'un flux pour un produit
     */
    addFlux(produitIndex) {
        const produit = this.produits[produitIndex];
        if (!produit) return;

        // Préparer les options pour les selects
        const shoresOptions = this.shores.map(s => s.Nom);
        const projetsDssOptions = this.projetsDss.map(p => p['Nom projet']);
        const dataflowsOptions = this.dataflows.map(d => d.Nom);

        const content = `
            <form id="formAddFlux" class="form">
                <div class="form-group">
                    <label class="form-label">Produit</label>
                    <input type="text" name="Produit" class="form-input" value="${escapeHtml(produit.Nom)}" readonly>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Shore/Gold</label>
                        <select name="Shore/Gold" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${shoresOptions.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Projet DSS</label>
                        <select name="Projet DSS" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${projetsDssOptions.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Dataflow</label>
                        <select name="DFNom DF" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${dataflowsOptions.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Charge (jh)</label>
                        <input type="number" name="Charge (jh)" class="form-input" step="0.5" min="0">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Estimation</label>
                        <input type="text" name="Estimation" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Date prévisionnelle migration</label>
                        <input type="date" name="Date prévisionnelle migration" class="form-input">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Sprint</label>
                        <select name="Sprint" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${this.getSprintOptions().map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Éligible SLA</label>
                        <select name="Eligible SLA" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            <option value="Oui">Oui</option>
                            <option value="Non">Non</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Commentaire</label>
                    <textarea name="Commentaire" class="form-textarea" rows="3"></textarea>
                </div>
            </form>
        `;

        showModal({
            title: 'Ajouter un flux',
            content: content,
            size: 'large',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Ajouter',
                    class: 'btn-primary',
                    action: async () => {
                        await this.createFlux();
                    }
                }
            ]
        });
    }

    /**
     * Crée un nouveau flux
     */
    async createFlux() {
        const form = document.getElementById('formAddFlux');
        if (!form) return;

        const formData = new FormData(form);
        const newFlux = {};

        for (const [key, value] of formData.entries()) {
            newFlux[key] = value;
        }

        try {
            await addTableRow('tFlux', newFlux);

            showSuccess('Flux ajouté avec succès');
            closeModal();

            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Erreur lors de l\'ajout du flux:', error);
            showError('Erreur lors de l\'ajout: ' + error.message);
        }
    }

    /**
     * Génère le graphique visuel de lineage pour un produit
     */
    renderLineageGraph(produit, fluxProduits) {
        // Collecter tous les éléments uniques pour chaque colonne
        const tablesSet = new Set();
        const shoresSet = new Set();
        const projetsDssSet = new Set();
        const dataflowsSet = new Set();

        // Mapper les relations pour dessiner les lignes
        const relations = [];

        fluxProduits.forEach(fluxItem => {
            const shoreName = fluxItem['Shore/Gold'];
            const projetDssName = fluxItem['Projet DSS'];
            const dataflowName = fluxItem['DFNom DF'];

            if (shoreName) {
                shoresSet.add(shoreName);
                // Trouver les tables associées au shore
                const tablesAssociees = this.findTablesForShore(shoreName);
                tablesAssociees.forEach(t => {
                    tablesSet.add(t.Table);
                    relations.push({ from: t.Table, fromType: 'table', to: shoreName, toType: 'shore' });
                });
            }

            if (projetDssName) {
                projetsDssSet.add(projetDssName);
                if (shoreName) {
                    relations.push({ from: shoreName, fromType: 'shore', to: projetDssName, toType: 'dss' });
                }
            }

            if (dataflowName) {
                dataflowsSet.add(dataflowName);
                if (projetDssName) {
                    relations.push({ from: projetDssName, fromType: 'dss', to: dataflowName, toType: 'dataflow' });
                }
                relations.push({ from: dataflowName, fromType: 'dataflow', to: produit.Nom, toType: 'produit' });
            } else if (projetDssName) {
                relations.push({ from: projetDssName, fromType: 'dss', to: produit.Nom, toType: 'produit' });
            } else if (shoreName) {
                relations.push({ from: shoreName, fromType: 'shore', to: produit.Nom, toType: 'produit' });
            }
        });

        // Convertir en arrays
        const tables = Array.from(tablesSet);
        const shores = Array.from(shoresSet);
        const projetsDss = Array.from(projetsDssSet);
        const dataflows = Array.from(dataflowsSet);

        // Helper pour obtenir le statut d'un élément
        const getTableStatus = (name) => {
            const table = this.tablesMh.find(t => t.Table === name);
            return this.getStatusClass(table ? table['OK DA ?'] : null);
        };

        const getShoreStatus = (name) => {
            const shore = this.shores.find(s => s.Nom === name);
            return this.getStatusClass(shore ? shore['Migré Tech'] : null);
        };

        const getDssStatus = (name) => {
            const dss = this.projetsDss.find(p => p['Nom projet'] === name);
            return this.getStatusClass(dss ? dss['Statut migration'] : null);
        };

        const getDataflowStatus = (name) => {
            const df = this.dataflows.find(d => d.Nom === name);
            return this.getStatusClass(df ? df['Statut migration'] : null);
        };

        // Générer le HTML du graphique
        let html = `
            <div class="lineage-graph-container">
                <div class="lineage-graph-header">
                    <div class="lineage-column-header">Tables</div>
                    <div class="lineage-column-header">Shores</div>
                    <div class="lineage-column-header">Projets DSS</div>
                    <div class="lineage-column-header">Dataflows</div>
                    <div class="lineage-column-header">Produit</div>
                </div>
                <div class="lineage-graph-body" id="lineageGraphBody">
                    <svg class="lineage-connections" id="lineageConnections"></svg>
                    <div class="lineage-column lineage-tables-column" id="lineageColTables">
                        ${tables.length > 0 ? tables.map(name => `
                            <div class="lineage-node ${getTableStatus(name)}" data-type="table" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-shores-column" id="lineageColShores">
                        ${shores.length > 0 ? shores.map(name => `
                            <div class="lineage-node ${getShoreStatus(name)}" data-type="shore" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-dss-column" id="lineageColDss">
                        ${projetsDss.length > 0 ? projetsDss.map(name => `
                            <div class="lineage-node ${getDssStatus(name)}" data-type="dss" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-dataflows-column" id="lineageColDataflows">
                        ${dataflows.length > 0 ? dataflows.map(name => `
                            <div class="lineage-node ${getDataflowStatus(name)}" data-type="dataflow" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-produit-column" id="lineageColProduit">
                        <div class="lineage-node ${this.getStatusClass(produit['Statut Migration'])}" data-type="produit" data-name="${escapeHtml(produit.Nom)}">
                            ${escapeHtml(produit.Nom)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Retourner le HTML et les relations pour dessiner les lignes plus tard
        return { html, relations };
    }

    /**
     * Dessine les lignes de connexion du graphique de lineage
     * @param {Array} relations - Les relations à dessiner
     * @param {number} delay - Délai en ms avant de dessiner (défaut: 100ms, utiliser 400ms pour les modales)
     */
    drawLineageConnections(relations, delay = 100) {
        setTimeout(() => {
            const svg = document.getElementById('lineageConnections');
            const body = document.getElementById('lineageGraphBody');
            if (!svg || !body) return;

            // Calculer la taille du SVG
            svg.setAttribute('width', body.scrollWidth);
            svg.setAttribute('height', body.scrollHeight);

            // Créer les lignes
            let pathsHtml = '';
            const drawnConnections = new Set();

            relations.forEach(rel => {
                const connectionKey = `${rel.from}-${rel.to}`;
                if (drawnConnections.has(connectionKey)) return;
                drawnConnections.add(connectionKey);

                const fromNode = body.querySelector(`[data-type="${rel.fromType}"][data-name="${CSS.escape(rel.from)}"]`);
                const toNode = body.querySelector(`[data-type="${rel.toType}"][data-name="${CSS.escape(rel.to)}"]`);

                if (fromNode && toNode) {
                    const fromRect = fromNode.getBoundingClientRect();
                    const toRect = toNode.getBoundingClientRect();
                    const bodyRect = body.getBoundingClientRect();

                    const x1 = fromRect.right - bodyRect.left;
                    const y1 = fromRect.top + fromRect.height / 2 - bodyRect.top;
                    const x2 = toRect.left - bodyRect.left;
                    const y2 = toRect.top + toRect.height / 2 - bodyRect.top;

                    // Courbe de Bézier pour un effet plus agréable
                    const midX = (x1 + x2) / 2;
                    pathsHtml += `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" class="lineage-connection-line" />`;
                }
            });

            svg.innerHTML = pathsHtml;
        }, delay);
    }

    /**
     * Affiche la popup de lineage pour un produit
     */
    async showLineagePopup(produitIndex) {
        const produit = this.produits[produitIndex];
        if (!produit) return;

        // Utiliser les données déjà chargées
        const fluxProduits = this.flux.filter(f => f.Produit === produit.Nom);

        let content;
        let relations = [];

        if (fluxProduits.length === 0) {
            content = `
                <div class="lineage-popup-content">
                    <p class="text-muted">Aucun flux de migration défini pour ce produit.</p>
                </div>
            `;
        } else {
            // Générer le graphique visuel de lineage
            const lineageGraph = this.renderLineageGraph(produit, fluxProduits);
            relations = lineageGraph.relations;

            content = `
                <div class="lineage-popup-content">
                    ${lineageGraph.html}
                </div>
            `;
        }

        // Afficher la modale
        showModal({
            title: `Lineage : ${produit.Nom}`,
            content: content,
            size: 'xl',
            buttons: [
                { label: 'Fermer', class: 'btn-secondary', action: 'close' }
            ]
        });

        // Dessiner les lignes de connexion après que le DOM soit prêt (délai plus long pour la modale)
        if (relations.length > 0) {
            this.drawLineageConnections(relations, 400);
        }
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
                    this.clearFilter();
                }
            });
        }

        // Bouton de réinitialisation du filtre
        const clearFilterBtn = document.getElementById('btnClearFilter');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => this.clearFilter());
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
