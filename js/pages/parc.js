/* ===========================================
   PARC.JS - Page Parc Applicatif
   Application Carto
   =========================================== */

/**
 * Classe ParcPage pour gerer la page du parc applicatif
 */
class ParcPage {
    constructor() {
        this.produits = [];
        this.processus = [];
        this.pdtProcess = [];
        this.currentView = 'process'; // 'process' par defaut (matrice), 'list' pour la liste
        this.selectedCells = new Set(); // Cellules selectionnees pour multi-select
        this.filters = {
            type: 'all',
            processStatus: 'all' // 'all', 'with', 'without'
        };
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
                        <div class="tab active" data-view="process">Vue Processus</div>
                        <div class="tab" data-view="list">Vue Liste</div>
                    </div>
                </div>
            </div>

            <!-- Vue Processus (Matrice) -->
            <section id="viewProcess" class="section">
                <div id="processMatrix"></div>
            </section>

            <!-- Vue Liste -->
            <section id="viewList" class="section hidden">
                <div id="tableProduits"></div>
            </section>

            <!-- Actions de selection multiple -->
            <div id="selectionActions" class="matrix-selection-actions hidden">
                <span class="selection-count"><strong id="selectedCount">0</strong> cellule(s) selectionnee(s)</span>
                <button class="btn btn-success btn-sm" onclick="parcPageInstance.applyStatusToSelection('Run')">Run</button>
                <button class="btn btn-primary btn-sm" onclick="parcPageInstance.applyStatusToSelection('Evolution')">Evolution</button>
                <button class="btn btn-secondary btn-sm" onclick="parcPageInstance.applyStatusToSelection('Backlog')">Backlog</button>
                <button class="btn btn-danger btn-sm" onclick="parcPageInstance.removeSelection()">Supprimer</button>
                <button class="btn btn-secondary btn-sm" onclick="parcPageInstance.clearSelection()">Annuler</button>
            </div>

            <!-- Popup de statut (cache par defaut) -->
            <div id="statusPopup" class="matrix-status-popup" style="display: none;"></div>
        `;

        await this.loadData();
        this.attachEvents();
    }

    /**
     * Charge les donnees
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

            this.renderProcessView();
            this.renderListView();

        } catch (error) {
            console.error('Erreur chargement donnees parc:', error);
            showError('Erreur lors du chargement des donnees');
        }
    }

    /**
     * Obtient les types de produits uniques
     */
    getUniqueProductTypes() {
        const types = new Set();
        this.produits.forEach(p => {
            if (p['Type de rapport']) {
                types.add(p['Type de rapport']);
            }
        });
        return Array.from(types).sort();
    }

    /**
     * Obtient les processus structures (groupes par processus principal avec sous-processus)
     */
    getStructuredProcessus() {
        const structured = {};

        this.processus.forEach(p => {
            const mainProcess = p.Processus;
            const subProcess = p['Sous-processus'];

            if (!structured[mainProcess]) {
                structured[mainProcess] = {
                    name: mainProcess,
                    subProcesses: []
                };
            }

            if (subProcess && !structured[mainProcess].subProcesses.includes(subProcess)) {
                structured[mainProcess].subProcesses.push(subProcess);
            }
        });

        return Object.values(structured);
    }

    /**
     * Filtre les produits selon les criteres
     */
    getFilteredProducts() {
        let filtered = [...this.produits];

        // Filtre par type
        if (this.filters.type !== 'all') {
            filtered = filtered.filter(p => p['Type de rapport'] === this.filters.type);
        }

        // Filtre par statut processus
        if (this.filters.processStatus !== 'all') {
            const produitsAvecProcessus = new Set(this.pdtProcess.map(pp => pp.Produit));

            if (this.filters.processStatus === 'with') {
                filtered = filtered.filter(p => produitsAvecProcessus.has(p.Nom));
            } else if (this.filters.processStatus === 'without') {
                filtered = filtered.filter(p => !produitsAvecProcessus.has(p.Nom));
            }
        }

        return filtered;
    }

    /**
     * Trouve un produit par son nom
     */
    getProductByName(productName) {
        return this.produits.find(p => p.Nom === productName);
    }

    /**
     * Verifie si un lien existe entre un produit et un processus
     */
    hasLink(productName, processName, subProcessName = null) {
        return this.pdtProcess.some(pp => {
            const matchProduct = pp.Produit === productName;
            const matchProcess = pp.Processus === processName;
            const matchSubProcess = subProcessName ? pp['Sous-processus'] === subProcessName : true;
            return matchProduct && matchProcess && matchSubProcess;
        });
    }

    /**
     * Obtient le statut d'un croisement produit/processus
     * Le statut vient du produit (tProduits.Statut), pas de la relation
     */
    getProcessStatus(productName, processName, subProcessName = null) {
        // Verifier si un lien existe
        const hasLink = this.hasLink(productName, processName, subProcessName);

        if (!hasLink) {
            return null; // Pas de lien = pas de couleur
        }

        // Le statut vient du produit
        const product = this.getProductByName(productName);
        return product ? (product.Statut || null) : null;
    }

    /**
     * Rendu de la vue processus (matrice)
     */
    renderProcessView() {
        const container = document.getElementById('processMatrix');
        if (!container) return;

        const structuredProcessus = this.getStructuredProcessus();
        const filteredProducts = this.getFilteredProducts();
        const productTypes = this.getUniqueProductTypes();

        // Construire les colonnes (processus + sous-processus)
        const columns = [];
        structuredProcessus.forEach(proc => {
            if (proc.subProcesses.length > 0) {
                proc.subProcesses.forEach(sub => {
                    columns.push({
                        process: proc.name,
                        subProcess: sub,
                        label: sub
                    });
                });
            } else {
                columns.push({
                    process: proc.name,
                    subProcess: null,
                    label: proc.name
                });
            }
        });

        let html = `
            <div class="process-matrix-container">
                <!-- Filtres -->
                <div class="matrix-filters">
                    <div class="matrix-filter-group">
                        <label for="filterType">Type:</label>
                        <select id="filterType" onchange="parcPageInstance.onFilterChange()">
                            <option value="all">Tous les types</option>
                            ${productTypes.map(type => `
                                <option value="${escapeHtml(type)}" ${this.filters.type === type ? 'selected' : ''}>
                                    ${escapeHtml(type)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="matrix-filter-group">
                        <label for="filterProcessStatus">Processus:</label>
                        <select id="filterProcessStatus" onchange="parcPageInstance.onFilterChange()">
                            <option value="all" ${this.filters.processStatus === 'all' ? 'selected' : ''}>Tous</option>
                            <option value="with" ${this.filters.processStatus === 'with' ? 'selected' : ''}>Avec processus</option>
                            <option value="without" ${this.filters.processStatus === 'without' ? 'selected' : ''}>Sans processus</option>
                        </select>
                    </div>

                    <div class="matrix-legend">
                        <div class="legend-item">
                            <span class="legend-color run"></span>
                            <span>Run</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color evolution"></span>
                            <span>Evolution</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color backlog"></span>
                            <span>Backlog</span>
                        </div>
                    </div>
                </div>

                <!-- Table Matrice -->
                <table class="process-matrix-table">
                    <thead>
                        <!-- Ligne des processus principaux -->
                        <tr>
                            <th class="matrix-col-fixed matrix-col-product" rowspan="2">Produit</th>
                            <th class="matrix-col-fixed matrix-col-type" rowspan="2">Type de rapport</th>
                            ${this.renderProcessHeaders(structuredProcessus)}
                        </tr>
                        <!-- Ligne des sous-processus -->
                        <tr>
                            ${this.renderSubProcessHeaders(structuredProcessus)}
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredProducts.length > 0 ?
                            filteredProducts.map(product => this.renderProductRow(product, columns)).join('') :
                            `<tr><td colspan="${columns.length + 2}" class="matrix-empty-message">
                                <p>Aucun produit ne correspond aux filtres selectionnes.</p>
                            </td></tr>`
                        }
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
        this.attachMatrixEvents();
    }

    /**
     * Rendu des en-tetes de processus principaux
     */
    renderProcessHeaders(structuredProcessus) {
        return structuredProcessus.map(proc => {
            const colspan = proc.subProcesses.length > 0 ? proc.subProcesses.length : 1;
            return `<th colspan="${colspan}">${escapeHtml(proc.name)}</th>`;
        }).join('');
    }

    /**
     * Rendu des en-tetes de sous-processus (texte vertical)
     */
    renderSubProcessHeaders(structuredProcessus) {
        let html = '';
        structuredProcessus.forEach(proc => {
            if (proc.subProcesses.length > 0) {
                proc.subProcesses.forEach(sub => {
                    html += `<th title="${escapeHtml(sub)}"><span class="subprocess-label">${escapeHtml(sub)}</span></th>`;
                });
            } else {
                html += `<th><span class="subprocess-label">-</span></th>`;
            }
        });
        return html;
    }

    /**
     * Rendu d'une ligne de produit
     */
    renderProductRow(product, columns) {
        const productName = product.Nom;
        const productType = product['Type de rapport'] || '-';
        const productStatus = product.Statut || '';

        let html = `
            <tr data-product="${escapeHtml(productName)}">
                <td class="matrix-col-fixed matrix-col-product">
                    <div class="product-name" title="${escapeHtml(productName)}">${escapeHtml(productName)}</div>
                </td>
                <td class="matrix-col-fixed matrix-col-type">
                    <div class="product-type" title="${escapeHtml(productType)}">${escapeHtml(productType)}</div>
                </td>
        `;

        columns.forEach(col => {
            const hasLink = this.hasLink(productName, col.process, col.subProcess);
            // La couleur vient du statut du produit, pas de la relation
            const status = hasLink ? productStatus : null;
            const statusClass = status ? `status-${status.toLowerCase()}` : 'status-empty';
            const cellId = this.getCellId(productName, col.process, col.subProcess);

            html += `
                <td class="matrix-cell ${hasLink ? statusClass : 'status-empty'}"
                    data-cell-id="${cellId}"
                    data-product="${escapeHtml(productName)}"
                    data-process="${escapeHtml(col.process)}"
                    data-subprocess="${col.subProcess ? escapeHtml(col.subProcess) : ''}"
                    data-has-link="${hasLink}"
                    data-status="${status || ''}">
                    <div class="matrix-cell-indicator"></div>
                </td>
            `;
        });

        html += '</tr>';
        return html;
    }

    /**
     * Genere un ID unique pour une cellule
     */
    getCellId(product, process, subProcess) {
        return `${product}|${process}|${subProcess || ''}`;
    }

    /**
     * Parse un ID de cellule
     */
    parseCellId(cellId) {
        const parts = cellId.split('|');
        return {
            product: parts[0],
            process: parts[1],
            subProcess: parts[2] || null
        };
    }

    /**
     * Attache les evenements de la matrice
     */
    attachMatrixEvents() {
        // Click sur les cellules
        document.querySelectorAll('.matrix-cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.onCellClick(e, cell));
        });

        // Fermer le popup si click en dehors
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('statusPopup');
            if (popup && !popup.contains(e.target) && !e.target.closest('.matrix-cell')) {
                this.hideStatusPopup();
            }
        });
    }

    /**
     * Gestion du click sur une cellule
     */
    onCellClick(event, cell) {
        event.stopPropagation();

        const cellId = cell.dataset.cellId;
        const hasLink = cell.dataset.hasLink === 'true';

        // Si Ctrl ou Cmd est appuye, mode multi-selection
        if (event.ctrlKey || event.metaKey) {
            this.toggleCellSelection(cell);
            return;
        }

        // Si des cellules sont selectionnees et on clique sans Ctrl, on deselectionne
        if (this.selectedCells.size > 0) {
            this.clearSelection();
        }

        // Si la cellule a deja un lien, on le supprime
        if (hasLink) {
            this.removeLink(cell);
        } else {
            // Sinon, on affiche le popup de selection de statut
            this.showStatusPopup(event, cell);
        }
    }

    /**
     * Toggle la selection d'une cellule
     */
    toggleCellSelection(cell) {
        const cellId = cell.dataset.cellId;

        if (this.selectedCells.has(cellId)) {
            this.selectedCells.delete(cellId);
            cell.classList.remove('selected');
        } else {
            this.selectedCells.add(cellId);
            cell.classList.add('selected');
        }

        this.updateSelectionUI();
    }

    /**
     * Efface la selection
     */
    clearSelection() {
        document.querySelectorAll('.matrix-cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
        this.selectedCells.clear();
        this.updateSelectionUI();
    }

    /**
     * Met a jour l'interface de selection
     */
    updateSelectionUI() {
        const actions = document.getElementById('selectionActions');
        const count = document.getElementById('selectedCount');

        if (this.selectedCells.size > 0) {
            actions.classList.remove('hidden');
            count.textContent = this.selectedCells.size;
        } else {
            actions.classList.add('hidden');
        }
    }

    /**
     * Affiche le popup de selection de statut
     */
    showStatusPopup(event, cell) {
        const popup = document.getElementById('statusPopup');
        const cellId = cell.dataset.cellId;

        popup.innerHTML = `
            <div class="matrix-status-popup-title">Ajouter un lien avec statut</div>
            <div class="matrix-status-option" onclick="parcPageInstance.addLinkWithStatus('${escapeHtml(cellId)}', 'Run')">
                <span class="status-color run"></span>
                <span>Run</span>
            </div>
            <div class="matrix-status-option" onclick="parcPageInstance.addLinkWithStatus('${escapeHtml(cellId)}', 'Evolution')">
                <span class="status-color evolution"></span>
                <span>Evolution</span>
            </div>
            <div class="matrix-status-option" onclick="parcPageInstance.addLinkWithStatus('${escapeHtml(cellId)}', 'Backlog')">
                <span class="status-color backlog"></span>
                <span>Backlog</span>
            </div>
        `;

        // Position du popup
        const rect = cell.getBoundingClientRect();
        popup.style.display = 'block';
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 5}px`;

        // Ajuster si le popup sort de l'ecran
        const popupRect = popup.getBoundingClientRect();
        if (popupRect.right > window.innerWidth) {
            popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
        }
        if (popupRect.bottom > window.innerHeight) {
            popup.style.top = `${rect.top - popupRect.height - 5}px`;
        }
    }

    /**
     * Cache le popup de selection de statut
     */
    hideStatusPopup() {
        const popup = document.getElementById('statusPopup');
        if (popup) {
            popup.style.display = 'none';
        }
    }

    /**
     * Ajoute un lien et met a jour le statut du produit
     */
    async addLinkWithStatus(cellId, status) {
        this.hideStatusPopup();

        const { product, process, subProcess } = this.parseCellId(cellId);

        try {
            // 1. Ajouter le lien dans tPdtProcess
            const linkData = {
                'Produit': product,
                'Processus': process,
                'Sous-processus': subProcess || ''
            };
            await addTableRow('tPdtProcess', linkData);
            this.pdtProcess.push(linkData);

            // 2. Mettre a jour le statut du produit dans tProduits
            const productIndex = this.produits.findIndex(p => p.Nom === product);
            if (productIndex !== -1) {
                this.produits[productIndex].Statut = status;
                await updateTableRow('tProduits', productIndex + 2, this.produits[productIndex]);
            }

            // 3. Mettre a jour l'interface - toutes les cellules de ce produit
            this.updateProductCellsUI(product, status);

            showSuccess(`Lien ajoute - Statut "${status}" pour ${product}`);

        } catch (error) {
            console.error('Erreur ajout lien:', error);
            showError('Erreur lors de l\'ajout du lien');
        }
    }

    /**
     * Met a jour l'UI de toutes les cellules d'un produit
     */
    updateProductCellsUI(productName, status) {
        document.querySelectorAll(`[data-product="${productName}"]`).forEach(cell => {
            if (cell.classList.contains('matrix-cell')) {
                const hasLink = cell.dataset.hasLink === 'true';
                cell.classList.remove('status-empty', 'status-run', 'status-evolution', 'status-backlog');

                if (hasLink) {
                    cell.classList.add(status ? `status-${status.toLowerCase()}` : 'status-empty');
                    cell.dataset.status = status || '';
                }

                cell.classList.add('just-updated');
                setTimeout(() => cell.classList.remove('just-updated'), 600);
            }
        });

        // Mettre a jour la cellule specifique qui vient d'etre liee
        const allCells = document.querySelectorAll('.matrix-cell');
        allCells.forEach(cell => {
            if (cell.dataset.product === productName && cell.dataset.hasLink === 'false') {
                // Verifier si un lien existe maintenant
                const process = cell.dataset.process;
                const subProcess = cell.dataset.subprocess || null;
                if (this.hasLink(productName, process, subProcess)) {
                    cell.dataset.hasLink = 'true';
                    cell.classList.remove('status-empty');
                    cell.classList.add(status ? `status-${status.toLowerCase()}` : 'status-empty');
                    cell.dataset.status = status || '';
                }
            }
        });
    }

    /**
     * Supprime le lien d'une cellule
     */
    async removeLink(cell) {
        const cellId = cell.dataset.cellId;
        const { product, process, subProcess } = this.parseCellId(cellId);

        try {
            // Trouver l'index du lien a supprimer
            const index = this.pdtProcess.findIndex(pp => {
                return pp.Produit === product &&
                       pp.Processus === process &&
                       (subProcess ? pp['Sous-processus'] === subProcess : true);
            });

            if (index !== -1) {
                // Supprimer de Excel (index + 2 car ligne 1 = en-tete)
                await deleteTableRow('tPdtProcess', index + 2);

                // Mettre a jour les donnees locales
                this.pdtProcess.splice(index, 1);

                // Mettre a jour l'interface
                cell.classList.remove('status-run', 'status-evolution', 'status-backlog');
                cell.classList.add('status-empty');
                cell.classList.add('just-updated');
                cell.dataset.hasLink = 'false';
                cell.dataset.status = '';

                setTimeout(() => cell.classList.remove('just-updated'), 600);

                showSuccess(`Lien supprime pour ${product}`);
            }

        } catch (error) {
            console.error('Erreur suppression lien:', error);
            showError('Erreur lors de la suppression');
        }
    }

    /**
     * Applique un statut a toute la selection
     */
    async applyStatusToSelection(status) {
        if (this.selectedCells.size === 0) return;

        const cellIds = Array.from(this.selectedCells);
        let successCount = 0;
        let errorCount = 0;

        // Grouper par produit pour minimiser les mises a jour
        const productUpdates = new Map();

        for (const cellId of cellIds) {
            const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
            if (!cell) continue;

            const { product, process, subProcess } = this.parseCellId(cellId);
            const hasLink = cell.dataset.hasLink === 'true';

            try {
                if (!hasLink) {
                    // Ajouter le lien
                    const linkData = {
                        'Produit': product,
                        'Processus': process,
                        'Sous-processus': subProcess || ''
                    };
                    await addTableRow('tPdtProcess', linkData);
                    this.pdtProcess.push(linkData);
                    cell.dataset.hasLink = 'true';
                }

                // Marquer le produit pour mise a jour du statut
                productUpdates.set(product, status);

                // Mettre a jour l'interface de la cellule
                cell.classList.remove('status-empty', 'status-run', 'status-evolution', 'status-backlog');
                cell.classList.add(`status-${status.toLowerCase()}`);
                cell.dataset.status = status;
                successCount++;

            } catch (error) {
                console.error('Erreur sur cellule:', cellId, error);
                errorCount++;
            }
        }

        // Mettre a jour les statuts des produits
        for (const [productName, newStatus] of productUpdates) {
            const productIndex = this.produits.findIndex(p => p.Nom === productName);
            if (productIndex !== -1) {
                this.produits[productIndex].Statut = newStatus;
                try {
                    await updateTableRow('tProduits', productIndex + 2, this.produits[productIndex]);
                    // Mettre a jour toutes les cellules de ce produit
                    this.updateProductCellsUI(productName, newStatus);
                } catch (error) {
                    console.error('Erreur mise a jour produit:', productName, error);
                }
            }
        }

        this.clearSelection();

        if (successCount > 0) {
            showSuccess(`${successCount} cellule(s) mise(s) a jour`);
        }
        if (errorCount > 0) {
            showError(`${errorCount} erreur(s) lors de la mise a jour`);
        }
    }

    /**
     * Supprime tous les liens de la selection
     */
    async removeSelection() {
        if (this.selectedCells.size === 0) return;

        const cellIds = Array.from(this.selectedCells);
        let successCount = 0;
        let errorCount = 0;

        // Trier par index decroissant pour supprimer de la fin vers le debut
        const cellsToRemove = [];
        for (const cellId of cellIds) {
            const cell = document.querySelector(`[data-cell-id="${cellId}"]`);
            if (!cell || cell.dataset.hasLink !== 'true') continue;

            const { product, process, subProcess } = this.parseCellId(cellId);
            const index = this.pdtProcess.findIndex(pp => {
                return pp.Produit === product &&
                       pp.Processus === process &&
                       (subProcess ? pp['Sous-processus'] === subProcess : true);
            });

            if (index !== -1) {
                cellsToRemove.push({ cellId, index, cell });
            }
        }

        // Trier par index decroissant
        cellsToRemove.sort((a, b) => b.index - a.index);

        for (const { cellId, index, cell } of cellsToRemove) {
            try {
                await deleteTableRow('tPdtProcess', index + 2);
                this.pdtProcess.splice(index, 1);

                cell.classList.remove('status-run', 'status-evolution', 'status-backlog');
                cell.classList.add('status-empty');
                cell.dataset.hasLink = 'false';
                cell.dataset.status = '';
                successCount++;

            } catch (error) {
                console.error('Erreur suppression:', cellId, error);
                errorCount++;
            }
        }

        this.clearSelection();

        if (successCount > 0) {
            showSuccess(`${successCount} lien(s) supprime(s)`);
        }
        if (errorCount > 0) {
            showError(`${errorCount} erreur(s) lors de la suppression`);
        }
    }

    /**
     * Gestion du changement de filtre
     */
    onFilterChange() {
        this.filters.type = document.getElementById('filterType').value;
        this.filters.processStatus = document.getElementById('filterProcessStatus').value;
        this.clearSelection();
        this.renderProcessView();
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
            columns: CONFIG.TABLES.PRODUITS.columns.map(col => ({
                field: col.field,
                label: col.label,
                type: col.type
            })),
            showToolbar: true,
            showPagination: true,
            editable: true,
            onRowClick: (row, index) => this.showEditProductForm(row, index),
            onAdd: () => this.showAddProductForm(),
            onEdit: (row, index) => this.showEditProductForm(row, index),
            onDelete: (row, index) => this.confirmDeleteProduct(row, index)
        });
    }

    /**
     * Affiche les details d'un produit
     */
    showProductDetails(produit) {
        if (!produit) return;

        const columns = CONFIG.TABLES.PRODUITS.columns;

        const content = `
            <div class="product-details">
                <div class="d-flex align-center gap-2 mb-3">
                    <span class="badge ${getMigrationStatusClass(produit['Statut Migration'])}" style="font-size: 14px;">
                        ${produit['Statut Migration'] || 'Non defini'}
                    </span>
                    ${produit.Statut ? `<span class="badge" style="background-color: var(--process-${produit.Statut.toLowerCase()}); font-size: 14px;">${produit.Statut}</span>` : ''}
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
                    showSuccess('Produit ajoute avec succes');
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
     * Affiche le formulaire d'edition de produit
     */
    showEditProductForm(produit, index) {
        showFormModal(
            `Modifier: ${produit.Nom}`,
            CONFIG.TABLES.PRODUITS.columns,
            async (formData) => {
                try {
                    await updateTableRow('tProduits', index + 2, formData);
                    showSuccess('Produit modifie avec succes');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de la modification: ' + error.message);
                    return false;
                }
            },
            produit
        );
    }

    /**
     * Confirme la suppression d'un produit
     */
    confirmDeleteProduct(produit, index) {
        showConfirmModal(
            `Etes-vous sur de vouloir supprimer le produit "${produit.Nom}" ? Cette action est irreversible.`,
            async () => {
                try {
                    await deleteTableRow('tProduits', index + 2);
                    showSuccess('Produit supprime avec succes');
                    await this.refresh();
                } catch (error) {
                    showError('Erreur lors de la suppression: ' + error.message);
                }
            },
            { title: 'Supprimer le produit', confirmText: 'Supprimer' }
        );
    }

    /**
     * Change la vue (liste / processus)
     */
    switchView(view) {
        this.currentView = view;

        // Mettre a jour les tabs
        document.querySelectorAll('.tabs .tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });

        // Afficher/masquer les sections
        document.getElementById('viewList').classList.toggle('hidden', view !== 'list');
        document.getElementById('viewProcess').classList.toggle('hidden', view !== 'process');

        // Cacher les actions de selection si on change de vue
        if (view === 'list') {
            this.clearSelection();
        }
    }

    /**
     * Attache les evenements
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
     * Rafraichit la page
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
 * Rafraichit la page Parc
 */
async function refreshParcPage() {
    if (parcPageInstance) {
        await parcPageInstance.refresh();
    }
}
