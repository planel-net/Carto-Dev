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
            responsable: 'all', // 'all' ou email du responsable ou '(vide)' pour les produits sans responsable
            processStatus: 'all', // 'all', 'with', 'without'
            selectedGroupes: [], // Groupes selectionnes (vide = tous)
            selectedPerimetres: [], // Perimetres selectionnes (vide = tous)
            selectedProcessus: [], // Processus selectionnes (vide = tous)
            selectedSubProcessus: [] // Sous-processus selectionnes (vide = tous)
        };
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="parc-page">
                <!-- Barre de filtres partagee -->
                <div id="parcFilters" class="matrix-filters"></div>

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

            // Initialiser les filtres multi-select avec toutes les valeurs (= pas de filtre)
            if (this.filters.selectedGroupes.length === 0) {
                this.filters.selectedGroupes = this.getAllGroupes();
            }
            if (this.filters.selectedPerimetres.length === 0) {
                this.filters.selectedPerimetres = this.getFilteredPerimetres();
            }
            if (this.filters.selectedProcessus.length === 0) {
                this.filters.selectedProcessus = this.getUniqueProcessus();
            }
            if (this.filters.selectedSubProcessus.length === 0) {
                this.filters.selectedSubProcessus = this.getAvailableSubProcessus();
            }

            this.renderFilters();
            this.renderProcessView();
            this.renderListView();

        } catch (error) {
            console.error('Erreur chargement donnees parc:', error);
            showError('Erreur lors du chargement des donnees');
        }
    }

    /**
     * Obtient les perimetres uniques (depuis la table de reference)
     */
    getUniquePerimetres() {
        return this.perimetres
            .map(p => p['Périmetre'])
            .filter(Boolean)
            .sort();
    }

    /**
     * Retourne la liste unique des groupes triés
     */
    getAllGroupes() {
        return [...new Set(this.perimetres.map(p => p.Groupe))].filter(Boolean).sort();
    }

    /**
     * Retourne les périmètres filtrés par les groupes sélectionnés
     */
    getFilteredPerimetres() {
        if (this.filters.selectedGroupes.length === 0) {
            return [];
        }
        const allGroupes = this.getAllGroupes();
        if (this.filters.selectedGroupes.length === allGroupes.length) {
            return this.getUniquePerimetres();
        }
        return this.perimetres
            .filter(p => this.filters.selectedGroupes.includes(p.Groupe))
            .map(p => p['Périmetre'])
            .filter(Boolean)
            .sort();
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
     * Obtient les responsables uniques avec option (vide)
     */
    getUniqueResponsables() {
        const responsables = new Set();
        let hasEmpty = false;

        this.produits.forEach(p => {
            const resp = p['Responsable'];
            if (resp && resp.trim() !== '') {
                responsables.add(resp);
            } else {
                hasEmpty = true;
            }
        });

        const result = Array.from(responsables).sort();
        if (hasEmpty) {
            result.unshift(CONFIG.EMPTY_FILTER_VALUE);
        }
        return result;
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
        const allSubProc = this.getAvailableSubProcessus();
        const allSubProcSelected = selectedSubProc.length === allSubProc.length;

        structuredProcessus.forEach(proc => {
            if (!selectedProc.includes(proc.name)) {
                return;
            }

            if (proc.subProcesses.length > 0) {
                proc.subProcesses.forEach(sub => {
                    if (!allSubProcSelected && !selectedSubProc.includes(sub)) {
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
                if (allSubProcSelected) {
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
        const allProc = this.getUniqueProcessus();
        const allSubProc = this.getAvailableSubProcessus();
        const allProcSelected = selectedProc.length === allProc.length;
        const allSubProcSelected = selectedSubProc.length === allSubProc.length;

        if (allProcSelected && allSubProcSelected) {
            return structuredProcessus;
        }

        return structuredProcessus
            .filter(proc => selectedProc.includes(proc.name))
            .map(proc => {
                if (allSubProcSelected) {
                    return proc;
                }
                return {
                    ...proc,
                    subProcesses: proc.subProcesses.filter(sub => selectedSubProc.includes(sub))
                };
            })
            .filter(proc => proc.subProcesses.length > 0 || allSubProcSelected);
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

        // Filtre par responsable
        if (this.filters.responsable !== 'all') {
            if (this.filters.responsable === CONFIG.EMPTY_FILTER_VALUE) {
                // Filtrer les produits sans responsable (vide ou null)
                filtered = filtered.filter(p => !p['Responsable'] || p['Responsable'].trim() === '');
            } else {
                // Filtrer par responsable spécifique
                filtered = filtered.filter(p => p['Responsable'] === this.filters.responsable);
            }
        }

        // Filtre par perimetre
        const allPerimetres = this.getUniquePerimetres();
        const allPerimetresSelected = this.filters.selectedPerimetres.length === allPerimetres.length;
        if (!allPerimetresSelected) {
            if (this.filters.selectedPerimetres.length === 0) {
                filtered = [];
            } else {
                const produitsParPerimetre = new Set(
                    this.pdtsPerimetres
                        .filter(pp => this.filters.selectedPerimetres.includes(pp['Périmètre']))
                        .map(pp => pp['Produit'])
                );
                filtered = filtered.filter(p => produitsParPerimetre.has(p.Nom));
            }
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
     * Rendu de la barre de filtres partagee (au-dessus des onglets)
     */
    renderFilters() {
        const container = document.getElementById('parcFilters');
        if (!container) return;

        const productTypes = this.getUniqueProductTypes();
        const responsables = this.getUniqueResponsables();
        const allGroupes = this.getAllGroupes();
        const filteredPerimetres = this.getFilteredPerimetres();
        const allProcessus = this.getUniqueProcessus();
        const availableSubProcessus = this.getAvailableSubProcessus();

        container.innerHTML = `
            <div class="matrix-filter-group">
                <label>Groupe:</label>
                <div class="multi-select-wrapper" id="groupeFilterWrapper">
                    <div class="multi-select-trigger" onclick="parcPageInstance.toggleMultiSelect('groupe')">
                        <span class="multi-select-label">${this.filters.selectedGroupes.length === allGroupes.length ? 'Tous' : (this.filters.selectedGroupes.length === 0 ? 'Aucun' : this.filters.selectedGroupes.length + ' selectionne(s)')}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown" id="groupeDropdown">
                        <div class="multi-select-actions">
                            <button type="button" class="btn btn-sm" onclick="parcPageInstance.selectAllGroupes()">Tous</button>
                            <button type="button" class="btn btn-sm" onclick="parcPageInstance.clearGroupes()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${allGroupes.map(g => `
                                <label class="multi-select-option">
                                    <input type="checkbox" value="${escapeHtml(g)}"
                                        ${this.filters.selectedGroupes.includes(g) ? 'checked' : ''}
                                        onchange="parcPageInstance.onGroupesChange()">
                                    <span>${escapeHtml(g)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
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
                <label for="filterResponsable">Responsable:</label>
                <select id="filterResponsable" onchange="parcPageInstance.onFilterChange()">
                    <option value="all">Tous</option>
                    ${responsables.map(resp => {
                        const isEmptyValue = resp === CONFIG.EMPTY_FILTER_VALUE;
                        const value = isEmptyValue ? CONFIG.EMPTY_FILTER_VALUE : resp;
                        const label = isEmptyValue ? '(vide)' : formatActorName(resp);
                        return `
                            <option value="${escapeHtml(value)}" ${this.filters.responsable === value ? 'selected' : ''}>
                                ${escapeHtml(label)}
                            </option>
                        `;
                    }).join('')}
                </select>
            </div>
            <div class="matrix-filter-group">
                <label>Périmètre:</label>
                <div class="multi-select-wrapper" id="perimetreFilterWrapper">
                    <div class="multi-select-trigger" onclick="parcPageInstance.toggleMultiSelect('perimetre')">
                        <span class="multi-select-label">${this.filters.selectedPerimetres.length === filteredPerimetres.length ? 'Tous' : (this.filters.selectedPerimetres.length === 0 ? 'Aucun' : this.filters.selectedPerimetres.length + ' selectionne(s)')}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown" id="perimetreDropdown">
                        <div class="multi-select-actions">
                            <button type="button" class="btn btn-sm" onclick="parcPageInstance.selectAllPerimetresFilter()">Tous</button>
                            <button type="button" class="btn btn-sm" onclick="parcPageInstance.clearPerimetresFilter()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${filteredPerimetres.map(p => `
                                <label class="multi-select-option">
                                    <input type="checkbox" value="${escapeHtml(p)}"
                                        ${this.filters.selectedPerimetres.includes(p) ? 'checked' : ''}
                                        onchange="parcPageInstance.onPerimetresCheckChange()">
                                    <span>${escapeHtml(p)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
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
                        <span class="multi-select-label">${this.filters.selectedProcessus.length === allProcessus.length ? 'Tous' : (this.filters.selectedProcessus.length === 0 ? 'Aucun' : this.filters.selectedProcessus.length + ' selectionne(s)')}</span>
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
                        <span class="multi-select-label">${this.filters.selectedSubProcessus.length === availableSubProcessus.length ? 'Tous' : (this.filters.selectedSubProcessus.length === 0 ? 'Aucun' : this.filters.selectedSubProcessus.length + ' selectionne(s)')}</span>
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
        `;
    }

    /**
     * Rendu de la vue processus (matrice seule, sans filtres)
     */
    renderProcessView() {
        const container = document.getElementById('processMatrix');
        if (!container) return;

        const structuredProcessus = this.getStructuredProcessus();
        const filteredStructuredProcessus = this.getFilteredStructuredProcessus(structuredProcessus);
        const filteredProducts = this.getFilteredProducts();
        const columns = this.getFilteredColumns(structuredProcessus);

        container.innerHTML = `
            <div class="process-matrix-container">
                <div class="process-matrix-table-wrapper">
                    <table class="process-matrix-table">
                        <thead>
                            <tr>
                                <th class="matrix-col-fixed matrix-col-product" rowspan="2">Produit</th>
                                <th class="matrix-col-fixed matrix-col-type" rowspan="2">Type de rapport</th>
                                ${this.renderProcessHeaders(filteredStructuredProcessus)}
                            </tr>
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
        const dropdownIds = {
            groupe: 'groupeDropdown',
            perimetre: 'perimetreDropdown',
            processus: 'processusDropdown',
            subProcessus: 'subProcessusDropdown'
        };
        const dropdownId = dropdownIds[type];
        const dropdown = document.getElementById(dropdownId);

        // Fermer tous les autres dropdowns
        Object.entries(dropdownIds).forEach(([key, id]) => {
            if (key !== type) {
                const other = document.getElementById(id);
                if (other) other.classList.remove('open');
            }
        });

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

    // === Perimetre ===

    selectAllGroupes() {
        const checkboxes = document.querySelectorAll('#groupeDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.filters.selectedGroupes = this.getAllGroupes();
        this.updateGroupeLabel();
        this.refreshPerimetreDropdown();
        this.clearSelection();
        this.refreshActiveView();
    }

    clearGroupes() {
        const checkboxes = document.querySelectorAll('#groupeDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.selectedGroupes = [];
        this.updateGroupeLabel();
        this.refreshPerimetreDropdown();
        this.clearSelection();
        this.refreshActiveView();
    }

    onGroupesChange() {
        const checkboxes = document.querySelectorAll('#groupeDropdown input[type="checkbox"]');
        this.filters.selectedGroupes = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updateGroupeLabel();
        this.refreshPerimetreDropdown();
        this.clearSelection();
        this.refreshActiveView();
    }

    updateGroupeLabel() {
        const label = document.querySelector('#groupeFilterWrapper .multi-select-label');
        if (label) {
            const allGroupes = this.getAllGroupes();
            label.textContent = this.filters.selectedGroupes.length === allGroupes.length ? 'Tous' :
                (this.filters.selectedGroupes.length === 0 ? 'Aucun' : this.filters.selectedGroupes.length + ' selectionne(s)');
        }
    }

    refreshPerimetreDropdown() {
        const optionsContainer = document.querySelector('#perimetreDropdown .multi-select-options');
        if (!optionsContainer) return;

        const filteredPerimetres = this.getFilteredPerimetres();
        optionsContainer.innerHTML = filteredPerimetres.map(p => `
            <label class="multi-select-option">
                <input type="checkbox" value="${escapeHtml(p)}"
                    ${this.filters.selectedPerimetres.includes(p) ? 'checked' : ''}
                    onchange="parcPageInstance.onPerimetresCheckChange()">
                <span>${escapeHtml(p)}</span>
            </label>
        `).join('');

        this.filters.selectedPerimetres = [...filteredPerimetres];
        this.updatePerimetreLabel();
    }

    selectAllPerimetresFilter() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.filters.selectedPerimetres = this.getFilteredPerimetres();
        this.updatePerimetreLabel();
        this.clearSelection();
        this.refreshActiveView();
    }

    clearPerimetresFilter() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.selectedPerimetres = [];
        this.updatePerimetreLabel();
        this.clearSelection();
        this.refreshActiveView();
    }

    onPerimetresCheckChange() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        this.filters.selectedPerimetres = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updatePerimetreLabel();
        this.clearSelection();
        this.refreshActiveView();
    }

    updatePerimetreLabel() {
        const label = document.querySelector('#perimetreFilterWrapper .multi-select-label');
        if (label) {
            const all = this.getUniquePerimetres();
            const allSelected = this.filters.selectedPerimetres.length === all.length;
            label.textContent = allSelected ? 'Tous' :
                (this.filters.selectedPerimetres.length === 0 ? 'Aucun' : this.filters.selectedPerimetres.length + ' selectionne(s)');
        }
    }

    // === Processus ===

    selectAllProcessus() {
        const checkboxes = document.querySelectorAll('#processusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.filters.selectedProcessus = this.getUniqueProcessus();
        this.updateProcessusLabel();
        this.refreshSubProcessusDropdown();
        this.clearSelection();
        this.refreshActiveView();
    }

    clearProcessusFilter() {
        const checkboxes = document.querySelectorAll('#processusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.selectedProcessus = [];
        this.updateProcessusLabel();
        this.refreshSubProcessusDropdown();
        this.clearSelection();
        this.refreshActiveView();
    }

    onProcessusCheckChange() {
        const checkboxes = document.querySelectorAll('#processusDropdown input[type="checkbox"]');
        this.filters.selectedProcessus = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updateProcessusLabel();
        this.refreshSubProcessusDropdown();
        this.clearSelection();
        this.refreshActiveView();
    }

    updateProcessusLabel() {
        const label = document.querySelector('#processusFilterWrapper .multi-select-label');
        if (label) {
            const all = this.getUniqueProcessus();
            const allSelected = this.filters.selectedProcessus.length === all.length;
            label.textContent = allSelected ? 'Tous' :
                (this.filters.selectedProcessus.length === 0 ? 'Aucun' : this.filters.selectedProcessus.length + ' selectionne(s)');
        }
    }

    /**
     * Rafraichit le dropdown sous-processus selon les processus selectionnes
     */
    refreshSubProcessusDropdown() {
        const optionsContainer = document.querySelector('#subProcessusDropdown .multi-select-options');
        if (!optionsContainer) return;

        const availableSubProcessus = this.getAvailableSubProcessus();

        // Reset les sous-processus qui ne sont plus disponibles
        this.filters.selectedSubProcessus = this.filters.selectedSubProcessus
            .filter(sub => availableSubProcessus.includes(sub));

        optionsContainer.innerHTML = availableSubProcessus.length > 0 ? availableSubProcessus.map(sub => `
            <label class="multi-select-option">
                <input type="checkbox" value="${escapeHtml(sub)}"
                    ${this.filters.selectedSubProcessus.includes(sub) ? 'checked' : ''}
                    onchange="parcPageInstance.onSubProcessusCheckChange()">
                <span>${escapeHtml(sub)}</span>
            </label>
        `).join('') : '<div class="multi-select-empty">Aucun sous-processus</div>';

        this.updateSubProcessusLabel();
    }

    // === Sous-processus ===

    selectAllSubProcessus() {
        const checkboxes = document.querySelectorAll('#subProcessusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.filters.selectedSubProcessus = this.getAvailableSubProcessus();
        this.updateSubProcessusLabel();
        this.clearSelection();
        this.refreshActiveView();
    }

    clearSubProcessusFilter() {
        const checkboxes = document.querySelectorAll('#subProcessusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.selectedSubProcessus = [];
        this.updateSubProcessusLabel();
        this.clearSelection();
        this.refreshActiveView();
    }

    onSubProcessusCheckChange() {
        const checkboxes = document.querySelectorAll('#subProcessusDropdown input[type="checkbox"]');
        this.filters.selectedSubProcessus = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updateSubProcessusLabel();
        this.clearSelection();
        this.refreshActiveView();
    }

    updateSubProcessusLabel() {
        const label = document.querySelector('#subProcessusFilterWrapper .multi-select-label');
        if (label) {
            const all = this.getAvailableSubProcessus();
            const allSelected = this.filters.selectedSubProcessus.length === all.length;
            label.textContent = allSelected ? 'Tous' :
                (this.filters.selectedSubProcessus.length === 0 ? 'Aucun' : this.filters.selectedSubProcessus.length + ' selectionne(s)');
        }
    }

    // === Rendu partiel (sans re-rendre les filtres) ===

    /**
     * Rafraichit la vue active (matrice ou liste) sans re-rendre les filtres
     */
    refreshActiveView() {
        if (this.currentView === 'list') {
            this.refreshListView();
        } else {
            this.refreshMatrixTable();
        }
    }

    /**
     * Rafraichit la vue liste en re-appliquant les filtres externes
     */
    refreshListView() {
        if (this._listTable) {
            this._listTable.applyFilters();
        }
    }

    /**
     * Rafraichit uniquement le tableau de la matrice sans toucher aux filtres
     */
    refreshMatrixTable() {
        const wrapper = document.querySelector('.process-matrix-table-wrapper');
        if (!wrapper) return;

        const structuredProcessus = this.getStructuredProcessus();
        const filteredStructuredProcessus = this.getFilteredStructuredProcessus(structuredProcessus);
        const filteredProducts = this.getFilteredProducts();
        const columns = this.getFilteredColumns(structuredProcessus);

        wrapper.innerHTML = `
            <table class="process-matrix-table">
                <thead>
                    <tr>
                        <th class="matrix-col-fixed matrix-col-product" rowspan="2">Produit</th>
                        <th class="matrix-col-fixed matrix-col-type" rowspan="2">Type de rapport</th>
                        ${this.renderProcessHeaders(filteredStructuredProcessus)}
                    </tr>
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
        `;

        this.attachMatrixEvents();
    }

    /**
     * Gestion du changement de filtre
     */
    onFilterChange() {
        this.filters.type = document.getElementById('filterType').value;
        this.filters.responsable = document.getElementById('filterResponsable').value;
        this.filters.processStatus = document.getElementById('filterProcessStatus').value;
        this.clearSelection();
        this.refreshActiveView();
    }

    /**
     * Rendu de la vue liste
     */
    renderListView() {
        const container = document.getElementById('tableProduits');
        if (!container) return;

        this._listTable = new DataTable(container, {
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
            externalFilter: (data) => this.applyExternalFilter(data),
            onRowClick: (row, index) => this.showEditProductForm(row, index),
            onAdd: () => this.showAddProductForm(),
            onEdit: (row, index) => this.showEditProductForm(row, index),
            onDelete: (row, index) => this.confirmDeleteProduct(row, index)
        });
    }

    /**
     * Filtre externe pour le DataTable de la vue liste
     * Applique les memes filtres que la matrice (type, responsable, perimetre, statut processus)
     */
    applyExternalFilter(data) {
        let filtered = [...data];

        // Filtre par type
        if (this.filters.type !== 'all') {
            filtered = filtered.filter(p => p['Type de rapport'] === this.filters.type);
        }

        // Filtre par responsable
        if (this.filters.responsable !== 'all') {
            if (this.filters.responsable === CONFIG.EMPTY_FILTER_VALUE) {
                filtered = filtered.filter(p => !p['Responsable'] || p['Responsable'].trim() === '');
            } else {
                filtered = filtered.filter(p => p['Responsable'] === this.filters.responsable);
            }
        }

        // Filtre par perimetre
        const allPerimetres = this.getUniquePerimetres();
        const allPerimetresSelected = this.filters.selectedPerimetres.length === allPerimetres.length;
        if (!allPerimetresSelected) {
            if (this.filters.selectedPerimetres.length === 0) {
                filtered = [];
            } else {
                const produitsParPerimetre = new Set(
                    this.pdtsPerimetres
                        .filter(pp => this.filters.selectedPerimetres.includes(pp['Périmètre']))
                        .map(pp => pp['Produit'])
                );
                filtered = filtered.filter(p => produitsParPerimetre.has(p.Nom));
            }
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
    async showAddProductForm() {
        await ProductModal.showAddModal(async () => {
            await this.refresh();
        });
    }

    /**
     * Affiche le formulaire d'edition de produit
     */
    async showEditProductForm(produit, index) {
        await ProductModal.showEditModal(produit, index, async () => {
            await this.refresh();
        });
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
            // Re-rendre la liste avec les filtres actuels
            this.refreshListView();
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

    /**
     * Détruit l'instance et libère la mémoire
     */
    destroy() {
        console.log('[Parc] Destroying instance...');

        // Vider les arrays volumineux pour libérer la mémoire
        this.produits = [];
        this.processus = [];
        this.pdtProcess = [];
        this.perimetres = [];
        this.pdtsPerimetres = [];
        this.selectedCells.clear();

        // Réinitialiser les filtres
        this.filters = null;

        console.log('[Parc] Instance destroyed');
    }
}

// Instance globale
let parcPageInstance = null;

/**
 * Rendu de la page Parc
 * @returns {ParcPage} Instance de la page
 */
async function renderParcPage(container) {
    parcPageInstance = new ParcPage();
    await parcPageInstance.render(container);
    return parcPageInstance;
}

/**
 * Rafraichit la page Parc
 */
async function refreshParcPage() {
    if (parcPageInstance) {
        await parcPageInstance.refresh();
    }
}
