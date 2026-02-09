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
        this.perimetres = [];
        this.pdtsPerimetres = [];
        this.currentView = 'process'; // 'process' par defaut (matrice), 'list' pour la liste
        this.selectedCells = new Set(); // Cellules selectionnees pour multi-select
        this.filters = {
            type: 'all',
            processStatus: 'all', // 'all', 'with', 'without'
            selectedProcessus: [], // Processus selectionnes (vide = tous)
            selectedSubProcessus: [] // Sous-processus selectionnes (vide = tous)
        };
        // Etat pour la modale produit (perimetres assignes)
        this._selectedPerimetres = [];
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="parc-page">
                <!-- Toolbar avec tabs et bouton ajouter -->
                <div class="parc-toolbar">
                    <div class="tabs tabs-compact">
                        <div class="tab active" data-view="process">Processus</div>
                        <div class="tab" data-view="list">Liste</div>
                    </div>
                    <button id="btnAddProduit" class="btn btn-primary btn-sm">
                        + Ajouter
                    </button>
                </div>

            <!-- Vue Processus (Matrice) -->
            <section id="viewProcess" class="section parc-section">
                <div id="processMatrix"></div>
            </section>

            <!-- Vue Liste -->
            <section id="viewList" class="section parc-section hidden">
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
            </div>
        `;

        await this.loadData();
        this.attachEvents();
    }

    /**
     * Charge les donnees
     */
    async loadData() {
        try {
            const [produitsData, processusData, pdtProcessData, perimetresData, pdtsPerimetresData] = await Promise.all([
                readTable('tProduits'),
                readTable('tProcessus'),
                readTable('tPdtProcess'),
                readTable('tPerimetres'),
                readTable('tPdtsPerimetres')
            ]);

            this.produits = produitsData.data;
            this.processus = processusData.data;
            this.pdtProcess = pdtProcessData.data;
            this.perimetres = perimetresData.data;
            this.pdtsPerimetres = pdtsPerimetresData.data;

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
     * Tries par la colonne Ordre de chaque ligne processus/sous-processus
     * Les colonnes contigues avec le meme processus sont regroupees
     */
    getStructuredProcessus() {
        // 1. Creer une liste plate de toutes les colonnes (processus + sous-processus) avec leur ordre
        const columns = [];
        const seen = new Set(); // Pour eviter les doublons

        this.processus.forEach(p => {
            const mainProcess = p.Processus;
            const subProcess = p['Sous-processus'] || null;
            const ordre = p.Ordre !== undefined && p.Ordre !== '' ? Number(p.Ordre) : Infinity;
            const key = `${mainProcess}|${subProcess || ''}`;

            if (!seen.has(key)) {
                seen.add(key);
                columns.push({
                    process: mainProcess,
                    subProcess: subProcess,
                    ordre: ordre
                });
            }
        });

        // 2. Trier par ordre
        columns.sort((a, b) => a.ordre - b.ordre);

        // 3. Grouper les colonnes contigues avec le meme processus
        const structured = [];
        let currentGroup = null;

        columns.forEach(col => {
            if (currentGroup && currentGroup.name === col.process) {
                // Meme processus que le groupe courant, on ajoute le sous-processus
                if (col.subProcess) {
                    currentGroup.subProcesses.push(col.subProcess);
                }
            } else {
                // Nouveau processus ou premier element
                currentGroup = {
                    name: col.process,
                    subProcesses: col.subProcess ? [col.subProcess] : []
                };
                structured.push(currentGroup);
            }
        });

        return structured;
    }

    /**
     * Obtient les processus uniques (noms principaux)
     * Tries par la colonne Ordre (valeur minimum si plusieurs lignes pour le meme processus)
     * Utilise pour le filtre de processus dans la toolbar
     */
    getUniqueProcessus() {
        const processOrdre = {};

        this.processus.forEach(p => {
            if (p.Processus) {
                const ordre = p.Ordre !== undefined && p.Ordre !== '' ? Number(p.Ordre) : Infinity;
                if (processOrdre[p.Processus] === undefined) {
                    processOrdre[p.Processus] = ordre;
                } else {
                    processOrdre[p.Processus] = Math.min(processOrdre[p.Processus], ordre);
                }
            }
        });

        // Trier par ordre minimum puis retourner les noms
        return Object.keys(processOrdre).sort((a, b) => {
            return processOrdre[a] - processOrdre[b];
        });
    }

    /**
     * Obtient les sous-processus disponibles (filtres par processus selectionnes)
     * Tries par la colonne Ordre (valeur minimum si plusieurs lignes pour le meme sous-processus)
     */
    getAvailableSubProcessus() {
        const subProcessOrdre = {};
        const selectedProc = this.filters.selectedProcessus;

        this.processus.forEach(p => {
            // Si aucun processus selectionne, on prend tous les sous-processus
            // Sinon, on filtre par les processus selectionnes
            if (selectedProc.length === 0 || selectedProc.includes(p.Processus)) {
                if (p['Sous-processus']) {
                    const ordre = p.Ordre !== undefined && p.Ordre !== '' ? Number(p.Ordre) : Infinity;
                    if (subProcessOrdre[p['Sous-processus']] === undefined) {
                        subProcessOrdre[p['Sous-processus']] = ordre;
                    } else {
                        subProcessOrdre[p['Sous-processus']] = Math.min(subProcessOrdre[p['Sous-processus']], ordre);
                    }
                }
            }
        });

        // Trier par ordre puis retourner les noms
        return Object.keys(subProcessOrdre).sort((a, b) => {
            return subProcessOrdre[a] - subProcessOrdre[b];
        });
    }

    /**
     * Filtre les colonnes (processus/sous-processus) selon les filtres
     */
    getFilteredColumns(structuredProcessus) {
        const columns = [];
        const selectedProc = this.filters.selectedProcessus;
        const selectedSubProc = this.filters.selectedSubProcessus;

        structuredProcessus.forEach(proc => {
            // Si des processus sont selectionnes, on filtre
            if (selectedProc.length > 0 && !selectedProc.includes(proc.name)) {
                return;
            }

            if (proc.subProcesses.length > 0) {
                proc.subProcesses.forEach(sub => {
                    // Si des sous-processus sont selectionnes, on filtre
                    if (selectedSubProc.length > 0 && !selectedSubProc.includes(sub)) {
                        return;
                    }
                    columns.push({
                        process: proc.name,
                        subProcess: sub,
                        label: sub
                    });
                });
            } else {
                // Processus sans sous-processus
                if (selectedSubProc.length === 0) {
                    columns.push({
                        process: proc.name,
                        subProcess: null,
                        label: proc.name
                    });
                }
            }
        });

        return columns;
    }

    /**
     * Filtre les processus structures selon les filtres
     */
    getFilteredStructuredProcessus(structuredProcessus) {
        const selectedProc = this.filters.selectedProcessus;
        const selectedSubProc = this.filters.selectedSubProcessus;

        if (selectedProc.length === 0 && selectedSubProc.length === 0) {
            return structuredProcessus;
        }

        return structuredProcessus
            .filter(proc => selectedProc.length === 0 || selectedProc.includes(proc.name))
            .map(proc => {
                if (selectedSubProc.length === 0) {
                    return proc;
                }
                return {
                    ...proc,
                    subProcesses: proc.subProcesses.filter(sub => selectedSubProc.includes(sub))
                };
            })
            .filter(proc => proc.subProcesses.length > 0 || selectedSubProc.length === 0);
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
        const filteredStructuredProcessus = this.getFilteredStructuredProcessus(structuredProcessus);
        const filteredProducts = this.getFilteredProducts();
        const productTypes = this.getUniqueProductTypes();
        const allProcessus = this.getUniqueProcessus();
        const availableSubProcessus = this.getAvailableSubProcessus();

        // Construire les colonnes filtrees
        const columns = this.getFilteredColumns(structuredProcessus);

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
                        <label for="filterProcessStatus">Lignes:</label>
                        <select id="filterProcessStatus" onchange="parcPageInstance.onFilterChange()">
                            <option value="all" ${this.filters.processStatus === 'all' ? 'selected' : ''}>Tous</option>
                            <option value="with" ${this.filters.processStatus === 'with' ? 'selected' : ''}>Avec processus</option>
                            <option value="without" ${this.filters.processStatus === 'without' ? 'selected' : ''}>Sans processus</option>
                        </select>
                    </div>
                    <div class="matrix-filter-group">
                        <label>Processus:</label>
                        <div class="multi-select-wrapper" id="processusFilterWrapper">
                            <div class="multi-select-trigger" onclick="parcPageInstance.toggleMultiSelect('processus')">
                                <span class="multi-select-label">${this.filters.selectedProcessus.length === 0 ? 'Tous' : this.filters.selectedProcessus.length + ' selectionne(s)'}</span>
                                <span class="multi-select-arrow">&#9662;</span>
                            </div>
                            <div class="multi-select-dropdown" id="processusDropdown">
                                <div class="multi-select-actions">
                                    <button type="button" class="btn btn-sm" onclick="parcPageInstance.selectAllProcessus()">Tous</button>
                                    <button type="button" class="btn btn-sm" onclick="parcPageInstance.clearProcessusFilter()">Aucun</button>
                                </div>
                                <div class="multi-select-options">
                                    ${allProcessus.map(proc => `
                                        <label class="multi-select-option">
                                            <input type="checkbox" value="${escapeHtml(proc)}"
                                                ${this.filters.selectedProcessus.includes(proc) ? 'checked' : ''}
                                                onchange="parcPageInstance.onProcessusCheckChange()">
                                            <span>${escapeHtml(proc)}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="matrix-filter-group">
                        <label>Sous-processus:</label>
                        <div class="multi-select-wrapper" id="subProcessusFilterWrapper">
                            <div class="multi-select-trigger" onclick="parcPageInstance.toggleMultiSelect('subProcessus')">
                                <span class="multi-select-label">${this.filters.selectedSubProcessus.length === 0 ? 'Tous' : this.filters.selectedSubProcessus.length + ' selectionne(s)'}</span>
                                <span class="multi-select-arrow">&#9662;</span>
                            </div>
                            <div class="multi-select-dropdown" id="subProcessusDropdown">
                                <div class="multi-select-actions">
                                    <button type="button" class="btn btn-sm" onclick="parcPageInstance.selectAllSubProcessus()">Tous</button>
                                    <button type="button" class="btn btn-sm" onclick="parcPageInstance.clearSubProcessusFilter()">Aucun</button>
                                </div>
                                <div class="multi-select-options">
                                    ${availableSubProcessus.length > 0 ? availableSubProcessus.map(sub => `
                                        <label class="multi-select-option">
                                            <input type="checkbox" value="${escapeHtml(sub)}"
                                                ${this.filters.selectedSubProcessus.includes(sub) ? 'checked' : ''}
                                                onchange="parcPageInstance.onSubProcessusCheckChange()">
                                            <span>${escapeHtml(sub)}</span>
                                        </label>
                                    `).join('') : '<div class="multi-select-empty">Aucun sous-processus</div>'}
                                </div>
                            </div>
                        </div>
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

                <!-- Wrapper avec scroll pour le tableau -->
                <div class="process-matrix-table-wrapper">
                    <table class="process-matrix-table">
                        <thead>
                            <!-- Ligne des processus principaux -->
                            <tr>
                                <th class="matrix-col-fixed matrix-col-product" rowspan="2">Produit</th>
                                <th class="matrix-col-fixed matrix-col-type" rowspan="2">Type de rapport</th>
                                ${this.renderProcessHeaders(filteredStructuredProcessus)}
                            </tr>
                            <!-- Ligne des sous-processus -->
                            <tr>
                                ${this.renderSubProcessHeaders(filteredStructuredProcessus)}
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredProducts.length > 0 && columns.length > 0 ?
                                filteredProducts.map(product => this.renderProductRow(product, columns)).join('') :
                                `<tr><td colspan="${columns.length + 2}" class="matrix-empty-message">
                                    <p>${columns.length === 0 ? 'Selectionnez au moins un processus ou sous-processus.' : 'Aucun produit ne correspond aux filtres selectionnes.'}</p>
                                </td></tr>`
                            }
                        </tbody>
                    </table>
                </div>
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

        // Fermer le popup et les dropdowns si click en dehors
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('statusPopup');
            if (popup && !popup.contains(e.target) && !e.target.closest('.matrix-cell')) {
                this.hideStatusPopup();
            }

            // Fermer les dropdowns multi-select si click en dehors
            if (!e.target.closest('.multi-select-wrapper')) {
                this.closeAllDropdowns();
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
            <div class="matrix-status-option" onclick="parcPageInstance.addLinkWithStatus('${escapeJsString(cellId)}', 'Run')">
                <span class="status-color run"></span>
                <span>Run</span>
            </div>
            <div class="matrix-status-option" onclick="parcPageInstance.addLinkWithStatus('${escapeJsString(cellId)}', 'Evolution')">
                <span class="status-color evolution"></span>
                <span>Evolution</span>
            </div>
            <div class="matrix-status-option" onclick="parcPageInstance.addLinkWithStatus('${escapeJsString(cellId)}', 'Backlog')">
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
                await updateTableRow('tProduits', productIndex, this.produits[productIndex]);
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
                // index du findIndex est déjà 0-based, ce qui correspond à table.rows.getItemAt()
                await deleteTableRow('tPdtProcess', index);

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
                    await updateTableRow('tProduits', productIndex, this.produits[productIndex]);
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
                await deleteTableRow('tPdtProcess', index);
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
     * Toggle l'affichage d'un dropdown multi-select
     */
    toggleMultiSelect(type) {
        const dropdownId = type === 'processus' ? 'processusDropdown' : 'subProcessusDropdown';
        const otherDropdownId = type === 'processus' ? 'subProcessusDropdown' : 'processusDropdown';
        const dropdown = document.getElementById(dropdownId);
        const otherDropdown = document.getElementById(otherDropdownId);

        // Fermer l'autre dropdown
        if (otherDropdown) {
            otherDropdown.classList.remove('open');
        }

        // Toggle le dropdown actuel
        if (dropdown) {
            dropdown.classList.toggle('open');
        }
    }

    /**
     * Ferme tous les dropdowns
     */
    closeAllDropdowns() {
        document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.remove('open'));
    }

    /**
     * Selectionne tous les processus
     */
    selectAllProcessus() {
        this.filters.selectedProcessus = [];
        this.filters.selectedSubProcessus = []; // Reset aussi les sous-processus
        this.closeAllDropdowns();
        this.clearSelection();
        this.renderProcessView();
    }

    /**
     * Efface le filtre processus
     */
    clearProcessusFilter() {
        const allProcessus = this.getUniqueProcessus();
        this.filters.selectedProcessus = [...allProcessus];
        this.filters.selectedSubProcessus = []; // Reset les sous-processus
        this.closeAllDropdowns();
        this.clearSelection();
        this.renderProcessView();
    }

    /**
     * Selectionne tous les sous-processus
     */
    selectAllSubProcessus() {
        this.filters.selectedSubProcessus = [];
        this.closeAllDropdowns();
        this.clearSelection();
        this.renderProcessView();
    }

    /**
     * Efface le filtre sous-processus
     */
    clearSubProcessusFilter() {
        const availableSubProcessus = this.getAvailableSubProcessus();
        this.filters.selectedSubProcessus = [...availableSubProcessus];
        this.closeAllDropdowns();
        this.clearSelection();
        this.renderProcessView();
    }

    /**
     * Gestion du changement de checkbox processus
     */
    onProcessusCheckChange() {
        const checkboxes = document.querySelectorAll('#processusDropdown input[type="checkbox"]');
        this.filters.selectedProcessus = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Reset les sous-processus qui ne sont plus disponibles
        const availableSubProcessus = this.getAvailableSubProcessus();
        this.filters.selectedSubProcessus = this.filters.selectedSubProcessus
            .filter(sub => availableSubProcessus.includes(sub));

        this.clearSelection();
        this.renderProcessView();
    }

    /**
     * Gestion du changement de checkbox sous-processus
     */
    onSubProcessusCheckChange() {
        const checkboxes = document.querySelectorAll('#subProcessusDropdown input[type="checkbox"]');
        this.filters.selectedSubProcessus = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        this.clearSelection();
        this.renderProcessView();
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
     * Affiche le formulaire d'ajout de produit (avec section perimetres)
     */
    showAddProductForm() {
        this._selectedPerimetres = [];
        this._showProductModal('Ajouter un produit', null, null);
    }

    /**
     * Affiche le formulaire d'edition de produit (avec section perimetres)
     */
    showEditProductForm(produit, index) {
        // Charger les perimetres deja assignes
        this._selectedPerimetres = this.pdtsPerimetres
            .filter(pp => pp['Produit'] === produit['Nom'])
            .map(pp => pp['Périmètre']);
        this._showProductModal(`Modifier: ${produit.Nom}`, produit, index);
    }

    /**
     * Affiche la modale produit avec formulaire + section perimetres
     */
    _showProductModal(title, produit, rowIndex) {
        const isEdit = produit !== null;
        const formId = 'modal_form_' + generateId();
        const formHtml = generateFormHtml(formId, CONFIG.TABLES.PRODUITS.columns, produit || {});

        // Injecter la classe two-columns dans le formulaire
        const formHtmlTwoCols = formHtml.replace('class="form"', 'class="form form-two-columns"');

        const content = `
            ${formHtmlTwoCols}
            <div class="assigned-section" style="margin-top: var(--spacing-md);">
                <div class="assigned-section-header">
                    <h4>&#127758; Périmètres associés</h4>
                    <button type="button" class="btn btn-sm btn-primary" onclick="parcPageInstance._showSelectPerimetresModal()">
                        Assigner
                    </button>
                </div>
                <div class="assigned-items-list" id="assignedPerimetresProduit">
                    <div class="assigned-items-empty">Aucun périmètre assigné</div>
                </div>
            </div>
        `;

        const modal = new Modal({
            title,
            size: 'lg',
            content,
            confirmText: isEdit ? 'Modifier' : 'Ajouter',
            onConfirm: async () => {
                const form = document.getElementById(formId);
                if (!validateForm(form)) {
                    return false;
                }
                const formData = getFormData(form);
                return await this._saveProduct(formData, isEdit, rowIndex, produit);
            }
        }).show();

        // Charger les options dynamiques et afficher les perimetres
        setTimeout(async () => {
            const form = document.getElementById(formId);
            if (form) {
                await loadDynamicSelectOptions(form);
                if (isEdit) {
                    setFormData(form, produit);
                }
            }
            this._renderAssignedPerimetres();
        }, 100);

        return modal;
    }

    /**
     * Sauvegarde le produit et ses associations perimetres
     */
    async _saveProduct(formData, isEdit, rowIndex, originalProduit) {
        try {
            if (isEdit) {
                await updateTableRow('tProduits', rowIndex, formData);

                // Supprimer les anciens liens perimetres (en ordre inverse)
                const oldLinks = this.pdtsPerimetres
                    .filter(pp => pp['Produit'] === originalProduit['Nom'])
                    .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                for (const pp of oldLinks) {
                    if (pp._rowIndex !== undefined && pp._rowIndex !== null) {
                        await deleteTableRow('tPdtsPerimetres', pp._rowIndex);
                    }
                }
            } else {
                await addTableRow('tProduits', formData);
            }
            invalidateCache('tProduits');

            // Ajouter les nouveaux liens produit-perimetre
            const produitName = formData['Nom'];
            for (const perimetre of this._selectedPerimetres) {
                await addTableRow('tPdtsPerimetres', {
                    'Produit': produitName,
                    'Périmètre': perimetre
                });
            }
            invalidateCache('tPdtsPerimetres');

            showSuccess(isEdit ? 'Produit modifié avec succès' : 'Produit ajouté avec succès');
            await this.refresh();
            return true;
        } catch (error) {
            console.error('Erreur sauvegarde produit:', error);
            showError(isEdit ? 'Erreur lors de la modification' : 'Erreur lors de l\'ajout');
            return false;
        }
    }

    /**
     * Affiche les perimetres assignes dans la modale produit
     */
    _renderAssignedPerimetres() {
        const container = document.getElementById('assignedPerimetresProduit');
        if (!container) return;

        if (this._selectedPerimetres.length === 0) {
            container.innerHTML = '<div class="assigned-items-empty">Aucun périmètre assigné</div>';
            return;
        }

        container.innerHTML = this._selectedPerimetres.map(perimetre => `
            <div class="assigned-item">
                <div class="assigned-item-info">
                    <div class="assigned-item-name">${escapeHtml(perimetre)}</div>
                </div>
                <div class="assigned-item-actions">
                    <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="parcPageInstance._removePerimetre('${escapeJsString(perimetre)}')">&#10005;</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Retire un perimetre de la selection
     */
    _removePerimetre(perimetre) {
        const idx = this._selectedPerimetres.indexOf(perimetre);
        if (idx > -1) {
            this._selectedPerimetres.splice(idx, 1);
            this._renderAssignedPerimetres();
        }
    }

    /**
     * Affiche la modale de selection des perimetres
     */
    _showSelectPerimetresModal() {
        const allPerimetres = this.perimetres.map(p => p['Périmetre']).filter(Boolean).sort();
        const selected = this._selectedPerimetres;

        const selectedList = allPerimetres.filter(p => selected.includes(p));
        const unselectedList = allPerimetres.filter(p => !selected.includes(p));

        const renderList = (searchTerm = '') => {
            const list = document.getElementById('selectionPerimetresList');
            if (!list) return;

            const term = searchTerm.toLowerCase();
            const filteredSelected = selectedList.filter(p => p.toLowerCase().includes(term));
            const filteredUnselected = unselectedList.filter(p => p.toLowerCase().includes(term));

            let html = '';

            if (filteredSelected.length > 0) {
                html += '<div class="selection-separator">Sélectionnés</div>';
                html += filteredSelected.map(p => `
                    <label class="selection-item selected">
                        <input type="checkbox" value="${escapeHtml(p)}" checked>
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(p)}</div>
                        </div>
                    </label>
                `).join('');
            }

            if (filteredUnselected.length > 0) {
                html += '<div class="selection-separator">Disponibles</div>';
                html += filteredUnselected.map(p => `
                    <label class="selection-item">
                        <input type="checkbox" value="${escapeHtml(p)}">
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(p)}</div>
                        </div>
                    </label>
                `).join('');
            }

            if (html === '') {
                html = '<div class="assigned-items-empty">Aucun périmètre trouvé</div>';
            }

            list.innerHTML = html;
        };

        const content = `
            <div class="selection-modal">
                <div class="selection-search">
                    <input type="text" class="form-control" id="searchPerimetresInput" placeholder="Rechercher un périmètre...">
                </div>
                <div class="selection-list" id="selectionPerimetresList"></div>
            </div>
        `;

        showModal({
            title: 'Sélectionner des périmètres',
            content: content,
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Valider',
                    class: 'btn-primary',
                    action: (modal) => {
                        const checkboxes = document.querySelectorAll('#selectionPerimetresList input[type="checkbox"]:checked');
                        this._selectedPerimetres = Array.from(checkboxes).map(cb => cb.value);
                        this._renderAssignedPerimetres();
                        return true;
                    }
                }
            ]
        });

        setTimeout(() => {
            renderList();
            const searchInput = document.getElementById('searchPerimetresInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
            }
        }, 100);
    }

    /**
     * Confirme la suppression d'un produit
     */
    confirmDeleteProduct(produit, index) {
        showConfirmModal(
            'Supprimer le produit',
            `Êtes-vous sûr de vouloir supprimer le produit "${produit.Nom}" ? Cette action est irréversible.`,
            async () => {
                try {
                    // index est déjà l'index 0-based dans le body de la table
                    await deleteTableRow('tProduits', index);
                    showSuccess('Produit supprimé avec succès');
                    await this.refresh();
                } catch (error) {
                    showError('Erreur lors de la suppression: ' + error.message);
                }
            },
            { confirmText: 'Supprimer' }
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

        // Bouton ajouter
        const btnAdd = document.getElementById('btnAddProduit');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.showAddProductForm());
        }
    }

    /**
     * Rafraichit la page
     */
    async refresh() {
        invalidateCache('tProduits');
        invalidateCache('tProcessus');
        invalidateCache('tPdtProcess');
        invalidateCache('tPerimetres');
        invalidateCache('tPdtsPerimetres');
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
