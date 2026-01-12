/* ===========================================
   PARC.JS - Page Parc Applicatif
   Application Carto
   =========================================== */

/**
 * Classe ParcPage pour gérer la page du parc applicatif
 */
class ParcPage {
    constructor() {
        this.produits = [];
        this.processus = [];
        this.pdtProcess = [];
        this.currentView = 'list'; // 'list' ou 'process'
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Parc Applicatif</h1>
                    <p>Cartographie des rapports et applications</p>
                </div>
                <div class="page-header-right">
                    <div class="tabs">
                        <div class="tab active" data-view="list">Liste</div>
                        <div class="tab" data-view="process">Par Processus</div>
                    </div>
                </div>
            </div>

            <!-- Vue Liste -->
            <section id="viewList" class="section">
                <div id="tableProduits"></div>
            </section>

            <!-- Vue Processus -->
            <section id="viewProcess" class="section hidden">
                <div id="processMap"></div>
            </section>
        `;

        await this.loadData();
        this.attachEvents();
    }

    /**
     * Charge les données
     */
    async loadData() {
        try {
            const [produitsData, processusData, pdtProcessData] = await Promise.all([
                readTable('tProduits'),
                readTable('tProcessus'),
                readTable('tPdtProcess')
            ]);

            this.produits = produitsData.data;
            this.processus = processusData.data;
            this.pdtProcess = pdtProcessData.data;

            this.renderListView();
            this.renderProcessView();

        } catch (error) {
            console.error('Erreur chargement données parc:', error);
            showError('Erreur lors du chargement des données');
        }
    }

    /**
     * Rendu de la vue liste
     */
    renderListView() {
        const container = document.getElementById('tableProduits');
        if (!container) return;

        new DataTable(container, {
            tableName: 'tProduits',
            tableConfig: CONFIG.TABLES.PRODUITS,
            columns: [
                { field: 'Nom', label: 'Nom', type: 'text' },
                { field: 'Statut Migration', label: 'Statut', type: 'select' },
                { field: 'Responsable', label: 'Responsable', type: 'text' },
                { field: 'Type de rapport', label: 'Type', type: 'text' },
                { field: 'Perimétre fonctionnel', label: 'Périmètre', type: 'text' },
                { field: 'Gold / Shore actuel', label: 'Gold/Shore', type: 'text' }
            ],
            showToolbar: true,
            showPagination: true,
            editable: true,
            onRowClick: (row) => this.showProductDetails(row),
            onAdd: () => this.showAddProductForm()
        });
    }

    /**
     * Rendu de la vue par processus
     */
    renderProcessView() {
        const container = document.getElementById('processMap');
        if (!container) return;

        // Grouper les processus uniques
        const uniqueProcessus = [...new Set(this.processus.map(p => p.Processus))];

        let html = '<div class="process-map">';

        uniqueProcessus.forEach(processus => {
            // Trouver les produits liés à ce processus
            const produitsLies = this.pdtProcess
                .filter(pp => pp.Processus === processus)
                .map(pp => this.produits.find(p => p.Nom === pp.Produit))
                .filter(p => p);

            // Sous-processus
            const sousProcessus = this.processus
                .filter(p => p.Processus === processus && p['Sous-processus'])
                .map(p => p['Sous-processus']);

            html += `
                <div class="process-card card" style="margin-bottom: 24px;">
                    <div class="card-header" style="background: var(--mh-bleu-fonce); color: white;">
                        <h4 style="margin: 0; color: white;">${escapeHtml(processus)}</h4>
                        <span class="badge badge-secondary" style="margin-left: auto;">${produitsLies.length} produit(s)</span>
                    </div>
                    <div class="card-body">
                        ${sousProcessus.length > 0 ? `
                            <div style="margin-bottom: 16px;">
                                <strong>Sous-processus:</strong>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                    ${sousProcessus.map(sp => `<span class="badge badge-primary">${escapeHtml(sp)}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <div class="process-products" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                            ${produitsLies.map(produit => `
                                <div class="process-product-card"
                                     style="padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; cursor: pointer;"
                                     data-produit="${escapeHtml(produit.Nom)}"
                                     onclick="parcPageInstance.showProductDetails(parcPageInstance.produits.find(p => p.Nom === '${escapeHtml(produit.Nom)}'))">
                                    <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(produit.Nom)}</div>
                                    <span class="badge ${getMigrationStatusClass(produit['Statut Migration'])}">
                                        ${produit['Statut Migration'] || 'Non défini'}
                                    </span>
                                    <div style="font-size: 12px; color: var(--mh-gris-moyen); margin-top: 4px;">
                                        ${produit.Responsable || '-'}
                                    </div>
                                </div>
                            `).join('')}
                            ${produitsLies.length === 0 ? '<p class="text-muted">Aucun produit lié</p>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        // Produits sans processus
        const produitsAvecProcessus = new Set(this.pdtProcess.map(pp => pp.Produit));
        const produitsSansProcessus = this.produits.filter(p => !produitsAvecProcessus.has(p.Nom));

        if (produitsSansProcessus.length > 0) {
            html += `
                <div class="process-card card" style="margin-bottom: 24px;">
                    <div class="card-header" style="background: var(--mh-gris-moyen); color: white;">
                        <h4 style="margin: 0; color: white;">Sans processus défini</h4>
                        <span class="badge badge-secondary" style="margin-left: auto;">${produitsSansProcessus.length} produit(s)</span>
                    </div>
                    <div class="card-body">
                        <div class="process-products" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                            ${produitsSansProcessus.map(produit => `
                                <div class="process-product-card"
                                     style="padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; cursor: pointer;"
                                     onclick="parcPageInstance.showProductDetails(parcPageInstance.produits.find(p => p.Nom === '${escapeHtml(produit.Nom)}'))">
                                    <div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(produit.Nom)}</div>
                                    <span class="badge ${getMigrationStatusClass(produit['Statut Migration'])}">
                                        ${produit['Statut Migration'] || 'Non défini'}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * Affiche les détails d'un produit
     */
    showProductDetails(produit) {
        if (!produit) return;

        const columns = CONFIG.TABLES.PRODUITS.columns;

        const content = `
            <div class="product-details">
                <div class="d-flex align-center gap-2 mb-3">
                    <span class="badge ${getMigrationStatusClass(produit['Statut Migration'])}" style="font-size: 14px;">
                        ${produit['Statut Migration'] || 'Non défini'}
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    ${columns.map(col => `
                        <div class="detail-row" style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                            <div style="font-size: 12px; color: var(--mh-gris-moyen); margin-bottom: 2px;">${col.label}</div>
                            <div style="font-weight: 500;">${produit[col.field] || '-'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        showViewModal(`Fiche produit: ${produit.Nom}`, content);
    }

    /**
     * Affiche le formulaire d'ajout de produit
     */
    showAddProductForm() {
        showFormModal(
            'Ajouter un produit',
            CONFIG.TABLES.PRODUITS.columns,
            async (formData) => {
                try {
                    await addTableRow('tProduits', formData);
                    showSuccess('Produit ajouté avec succès');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de l\'ajout: ' + error.message);
                    return false;
                }
            }
        );
    }

    /**
     * Change la vue (liste / processus)
     */
    switchView(view) {
        this.currentView = view;

        // Mettre à jour les tabs
        document.querySelectorAll('.tabs .tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });

        // Afficher/masquer les sections
        document.getElementById('viewList').classList.toggle('hidden', view !== 'list');
        document.getElementById('viewProcess').classList.toggle('hidden', view !== 'process');
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        // Tabs
        document.querySelectorAll('.tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchView(tab.dataset.view);
            });
        });
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        invalidateCache('tProduits');
        invalidateCache('tProcessus');
        invalidateCache('tPdtProcess');
        await this.loadData();
    }
}

// Instance globale
let parcPageInstance = null;

/**
 * Rendu de la page Parc
 */
async function renderParcPage(container) {
    parcPageInstance = new ParcPage();
    await parcPageInstance.render(container);
}

/**
 * Rafraîchit la page Parc
 */
async function refreshParcPage() {
    if (parcPageInstance) {
        await parcPageInstance.refresh();
    }
}
