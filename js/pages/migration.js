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
            tablesMh: { total: 0, migre: 0, percent: 0 },
            shores: { total: 0, migre: 0, percent: 0 },
            projetsDss: { total: 0, migre: 0, percent: 0 },
            dataflows: { total: 0, migre: 0, percent: 0 },
            produits: { total: 0, migre: 0, percent: 0 }
        };
        this.produits = [];
        this.flux = [];
        this.expandedRows = new Set();
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
            // Charger les statistiques de chaque type en parallèle
            console.log('[Migration] Loading all stats...');
            const [tablesMhStats, shoresStats, dssStats, dfStats, produitsStats, produitsData, fluxData] = await Promise.all([
                getMigrationStats('tTablesMHTech', 'OK DA ?'),
                getMigrationStats('tShores', 'Migré Tech'),
                getMigrationStats('tProjetsDSS', 'Statut migration'),
                getMigrationStats('tDataflows', 'Statut migration'),
                getMigrationStats('tProduits', 'Statut Migration'),
                readTable('tProduits'),
                readTable('tFlux')
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
        // Tables MH Tech
        this.renderKpiCard('kpi-tablesmh', {
            label: 'Tables MH Tech',
            value: this.stats.tablesMh.percentMigre,
            total: this.stats.tablesMh.total,
            migre: this.stats.tablesMh.migre,
            icon: '&#128451;'
        });

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

        // Global (inclut tous les types)
        const totalItems = this.stats.tablesMh.total + this.stats.shores.total + this.stats.projetsDss.total + this.stats.dataflows.total + this.stats.produits.total;
        const totalMigre = this.stats.tablesMh.migre + this.stats.shores.migre + this.stats.projetsDss.migre + this.stats.dataflows.migre + this.stats.produits.migre;
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
            return;
        }

        // Afficher un spinner pendant le chargement
        container.innerHTML = '<div class="spinner"></div>';

        // Charger les données liées
        const [flux, projetsDss, dataflows, shores, tablesMh] = await Promise.all([
            readTable('tFlux'),
            readTable('tProjetsDSS'),
            readTable('tDataflows'),
            readTable('tShores'),
            readTable('tTablesMHTech')
        ]);

        // Trouver tous les flux correspondant au produit
        const fluxProduits = flux.data.filter(f => f.Produit === produit.Nom);

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

        // Construire le graphique de dépendances et le tableau détaillé
        let html = `
            <div class="dependency-chain">
                ${this.renderDependencyNode('Tables MH Tech', '(Données sources)', null, '&#128451;')}
                <div class="dependency-arrow">&#8594;</div>
                ${this.renderDependencyNode('Shore / Gold', '(Stockage)', null, '&#128451;')}
                <div class="dependency-arrow">&#8594;</div>
                ${this.renderDependencyNode('Projet DSS', '(Traitement)', null, '&#128194;')}
                <div class="dependency-arrow">&#8594;</div>
                ${this.renderDependencyNode('Dataflow', '(Pipeline)', null, '&#128260;')}
                <div class="dependency-arrow">&#8594;</div>
                ${this.renderDependencyNode('Produit', produit.Nom, produit['Statut Migration'], '&#128202;')}
            </div>

            <h5 style="margin-top: 24px; margin-bottom: 12px;">Détail du lineage complet</h5>
            <div class="lineage-table-wrapper">
                <table class="lineage-table">
                    <thead>
                        <tr>
                            <th>Tables MH Tech</th>
                            <th>Shore / Gold</th>
                            <th>Projet DSS</th>
                            <th>Dataflow</th>
                            <th>Produit</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Pour chaque flux, construire une ligne de lineage
        fluxProduits.forEach(fluxItem => {
            const shore = shores.data.find(s => s.Nom === fluxItem['Shore/Gold']);
            const projetDss = projetsDss.data.find(p => p['Nom projet'] === fluxItem['Projet DSS']);
            const dataflow = dataflows.data.find(d => d.Nom === fluxItem['DFNom DF']);

            // Trouver les tables MH Tech associées au Shore
            const shoreNomPourTables = shore ? shore['Nom_pour_tables'] : null;
            const tablesAssociees = shoreNomPourTables ?
                tablesMh.data.filter(t => t.Table && t.Table.includes(shoreNomPourTables)) : [];

            html += `
                <tr>
                    <td>
                        ${tablesAssociees.length > 0 ?
                            tablesAssociees.map(t => `<span class="badge ${this.getStatusClass(t['OK DA ?'])}">${escapeHtml(t.Table)}</span>`).join('<br>') :
                            '<span class="text-muted">-</span>'}
                    </td>
                    <td>
                        <span class="badge ${this.getStatusClass(shore ? shore['Migré Tech'] : null)}">
                            ${escapeHtml(fluxItem['Shore/Gold'] || '-')}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${this.getStatusClass(projetDss ? projetDss['Statut migration'] : null)}">
                            ${escapeHtml(fluxItem['Projet DSS'] || '-')}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${this.getStatusClass(dataflow ? dataflow['Statut migration'] : null)}">
                            ${escapeHtml(fluxItem['DFNom DF'] || '-')}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${this.getStatusClass(produit['Statut Migration'])}">
                            ${escapeHtml(produit.Nom)}
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>

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
     * Rendu du tableau de suivi par produit
     */
    async renderProductProgressTable() {
        const container = document.getElementById('productProgressTable');
        if (!container) return;

        // Charger toutes les données nécessaires
        const [shores, projetsDss, dataflows, tablesMh] = await Promise.all([
            readTable('tShores'),
            readTable('tProjetsDSS'),
            readTable('tDataflows'),
            readTable('tTablesMHTech')
        ]);

        // Calculer les stats par produit
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

            // Trouver les tables associées via les shores
            uniqueShores.forEach(shoreName => {
                const shore = shores.data.find(s => s.Nom === shoreName);
                if (shore && shore['Nom_pour_tables']) {
                    tablesMh.data.forEach(t => {
                        if (t.Table && t.Table.includes(shore['Nom_pour_tables'])) {
                            uniqueTables.add(t.Table);
                        }
                    });
                }
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
                    const table = tablesMh.data.find(t => t.Table === tableName);
                    if (table) {
                        const status = (table['OK DA ?'] || '').toLowerCase();
                        if (status === 'oui' || status.includes('migré')) {
                            migre++;
                        }
                    }
                });
                return { total, migre, percent: total > 0 ? Math.round((migre / total) * 100) : 0 };
            })();

            const shoresStats = calcStats(uniqueShores, shores.data, 'Nom', 'Migré Tech');
            const dssStats = calcStats(uniqueProjetsDss, projetsDss.data, 'Nom projet', 'Statut migration');
            const dfStats = calcStats(uniqueDataflows, dataflows.data, 'Nom', 'Statut migration');

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
                ps.flux.forEach((fluxItem) => {
                    html += `
                        <tr class="flux-detail-row">
                            <td></td>
                            <td colspan="6" style="padding-left: 40px; font-size: 13px; background: var(--mh-gris-clair);">
                                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                                    <span><strong>Shore:</strong> ${escapeHtml(fluxItem['Shore/Gold'] || '-')}</span>
                                    <span><strong>Projet DSS:</strong> ${escapeHtml(fluxItem['Projet DSS'] || '-')}</span>
                                    <span><strong>Dataflow:</strong> ${escapeHtml(fluxItem['DFNom DF'] || '-')}</span>
                                    <span><strong>Sprint:</strong> ${escapeHtml(fluxItem['Sprint'] || '-')}</span>
                                </div>
                            </td>
                            <td style="background: var(--mh-gris-clair);"></td>
                        </tr>
                    `;
                });
            } else if (isExpanded && ps.flux.length === 0) {
                html += `
                    <tr class="flux-detail-row">
                        <td></td>
                        <td colspan="7" style="padding-left: 40px; font-style: italic; color: var(--mh-gris-moyen); background: var(--mh-gris-clair);">
                            Aucun flux défini pour ce produit
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
                const index = parseInt(e.target.dataset.index);
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
                const index = parseInt(e.target.dataset.index);
                this.showLineagePopup(index);
            });
        });
    }

    /**
     * Affiche la popup de lineage pour un produit
     */
    async showLineagePopup(produitIndex) {
        const produit = this.produits[produitIndex];
        if (!produit) return;

        // Charger les données
        const [flux, projetsDss, dataflows, shores, tablesMh] = await Promise.all([
            readTable('tFlux'),
            readTable('tProjetsDSS'),
            readTable('tDataflows'),
            readTable('tShores'),
            readTable('tTablesMHTech')
        ]);

        const fluxProduits = flux.data.filter(f => f.Produit === produit.Nom);

        // Construire le contenu de la popup
        let content = `
            <div class="lineage-popup-content">
                <h4 style="margin-bottom: 16px;">Lineage complet : ${escapeHtml(produit.Nom)}</h4>

                <div class="dependency-chain" style="margin-bottom: 24px;">
                    ${this.renderDependencyNode('Tables MH Tech', '(Données sources)', null, '&#128451;')}
                    <div class="dependency-arrow">&#8594;</div>
                    ${this.renderDependencyNode('Shore / Gold', '(Stockage)', null, '&#128451;')}
                    <div class="dependency-arrow">&#8594;</div>
                    ${this.renderDependencyNode('Projet DSS', '(Traitement)', null, '&#128194;')}
                    <div class="dependency-arrow">&#8594;</div>
                    ${this.renderDependencyNode('Dataflow', '(Pipeline)', null, '&#128260;')}
                    <div class="dependency-arrow">&#8594;</div>
                    ${this.renderDependencyNode('Produit', produit.Nom, produit['Statut Migration'], '&#128202;')}
                </div>

                <h5 style="margin-bottom: 12px;">Détail des flux</h5>
        `;

        if (fluxProduits.length === 0) {
            content += '<p class="text-muted">Aucun flux de migration défini pour ce produit.</p>';
        } else {
            content += `
                <div class="lineage-table-wrapper">
                    <table class="lineage-table">
                        <thead>
                            <tr>
                                <th>Tables MH Tech</th>
                                <th>Shore / Gold</th>
                                <th>Projet DSS</th>
                                <th>Dataflow</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            fluxProduits.forEach(fluxItem => {
                const shore = shores.data.find(s => s.Nom === fluxItem['Shore/Gold']);
                const projetDss = projetsDss.data.find(p => p['Nom projet'] === fluxItem['Projet DSS']);
                const dataflow = dataflows.data.find(d => d.Nom === fluxItem['DFNom DF']);

                const shoreNomPourTables = shore ? shore['Nom_pour_tables'] : null;
                const tablesAssociees = shoreNomPourTables ?
                    tablesMh.data.filter(t => t.Table && t.Table.includes(shoreNomPourTables)) : [];

                content += `
                    <tr>
                        <td>
                            ${tablesAssociees.length > 0 ?
                                tablesAssociees.map(t => `<span class="badge ${this.getStatusClass(t['OK DA ?'])}">${escapeHtml(t.Table)}</span>`).join('<br>') :
                                '<span class="text-muted">-</span>'}
                        </td>
                        <td>
                            <span class="badge ${this.getStatusClass(shore ? shore['Migré Tech'] : null)}">
                                ${escapeHtml(fluxItem['Shore/Gold'] || '-')}
                            </span>
                        </td>
                        <td>
                            <span class="badge ${this.getStatusClass(projetDss ? projetDss['Statut migration'] : null)}">
                                ${escapeHtml(fluxItem['Projet DSS'] || '-')}
                            </span>
                        </td>
                        <td>
                            <span class="badge ${this.getStatusClass(dataflow ? dataflow['Statut migration'] : null)}">
                                ${escapeHtml(fluxItem['DFNom DF'] || '-')}
                            </span>
                        </td>
                    </tr>
                `;
            });

            content += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        content += '</div>';

        // Afficher la modale
        showModal({
            title: 'Lineage du produit',
            content: content,
            size: 'large',
            buttons: [
                { label: 'Fermer', class: 'btn-secondary', action: 'close' }
            ]
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
