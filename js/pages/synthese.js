/* ===========================================
   SYNTHESE.JS - Vue de synthese unifiee
   Application Carto
   =========================================== */

class SynthesePage {
    constructor() {
        this.data = {
            chantiers: [],
            produits: [],
            mae: [],
            acteurs: [],
            perimetres: [],
            processus: [],
            flux: [],
            shores: [],
            projetsDSS: [],
            dataflows: [],
            pdtProcess: [],
            pdtsPerimetres: [],
            tablesMh: []
        };

        this.filters = {
            selectedPerimetres: [],
            selectedProcessus: [],
            selectedSousProcessus: [],
            avancement: '',
            responsable: '',
            etat: ''
        };
    }

    async render(container) {
        await this.loadData();

        container.innerHTML = `
            <div class="page-synthese">
                <!-- Filtres globaux -->
                <div class="synthese-filters-global" id="filtersGlobal">
                    <!-- Les filtres multi-select seront générés par renderFilters() -->
                </div>

                <!-- Trois colonnes -->
                <div class="synthese-columns">
                    <!-- Colonne Chantiers -->
                    <div class="synthese-column">
                        <div class="column-header">
                            <h2>Chantiers</h2>
                            <div class="filter-group">
                                <label>Avancement</label>
                                <select id="filterAvancement" class="filter-select">
                                    <option value="">Tous</option>
                                    <option value="Non démarré">Non démarré</option>
                                    <option value="En cadrage">En cadrage</option>
                                    <option value="Cadré">Cadré</option>
                                    <option value="En développement">En développement</option>
                                    <option value="Développé">Développé</option>
                                    <option value="En recette">En recette</option>
                                    <option value="Recetté">Recetté</option>
                                    <option value="Terminé">Terminé</option>
                                </select>
                            </div>
                        </div>
                        <div class="column-count" id="chantiersCount">0 chantier(s)</div>
                        <div class="column-content">
                            <table class="synthese-table" id="chantiersTable">
                                <thead>
                                    <tr>
                                        <th>Num</th>
                                        <th>Nom</th>
                                        <th>Date fin</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Colonne Produits -->
                    <div class="synthese-column">
                        <div class="column-header">
                            <h2>Produits</h2>
                            <div class="filter-group">
                                <label>Responsable</label>
                                <select id="filterResponsable" class="filter-select">
                                    <option value="">Tous</option>
                                </select>
                            </div>
                        </div>
                        <div class="column-count" id="produitsCount">0 produit(s)</div>
                        <div class="column-content">
                            <table class="synthese-table" id="produitsTable">
                                <thead>
                                    <tr>
                                        <th>Nom</th>
                                        <th>Type</th>
                                        <th>Statut</th>
                                        <th>Lineage</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Colonne MAE -->
                    <div class="synthese-column">
                        <div class="column-header">
                            <h2>MAE</h2>
                            <div class="filter-group">
                                <label>État</label>
                                <select id="filterEtat" class="filter-select">
                                    <option value="">Tous</option>
                                    <option value="En attente">En attente</option>
                                    <option value="En cours">En cours</option>
                                    <option value="Terminée">Terminée</option>
                                    <option value="Annulée">Annulée</option>
                                </select>
                            </div>
                        </div>
                        <div class="column-count" id="maeCount">0 demande(s)</div>
                        <div class="column-content">
                            <table class="synthese-table" id="maeTable">
                                <thead>
                                    <tr>
                                        <th>Clé</th>
                                        <th>Résumé</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initializeFilters();
        this.renderFilters();
        this.attachEvents();
        this.applyFiltersAndRender();
    }

    async loadData() {
        try {
            console.log('[Synthese] Chargement des données...');

            // Charger les tables une par une pour identifier les erreurs
            console.log('[Synthese] Chargement chantiers...');
            const chantiers = await readTable(CONFIG.TABLES.CHANTIER.name);

            console.log('[Synthese] Chargement produits...');
            const produits = await readTable(CONFIG.TABLES.PRODUITS.name);

            console.log('[Synthese] Chargement mae...');
            const mae = await readTable(CONFIG.TABLES.MAE.name);

            console.log('[Synthese] Chargement acteurs...');
            const acteurs = await readTable(CONFIG.TABLES.ACTEURS.name);

            console.log('[Synthese] Chargement perimetres...');
            const perimetres = await readTable(CONFIG.TABLES.PERIMETRES.name);

            console.log('[Synthese] Chargement processus...');
            const processus = await readTable(CONFIG.TABLES.PROCESSUS.name);

            console.log('[Synthese] Chargement flux...');
            const flux = await readTable(CONFIG.TABLES.FLUX.name);

            console.log('[Synthese] Chargement shores...');
            const shores = await readTable(CONFIG.TABLES.SHORES.name);

            console.log('[Synthese] Chargement projetsDSS...');
            const projetsDSS = await readTable(CONFIG.TABLES.PROJETS_DSS.name);

            console.log('[Synthese] Chargement dataflows...');
            const dataflows = await readTable(CONFIG.TABLES.DATAFLOWS.name);

            console.log('[Synthese] Chargement pdtProcess...');
            const pdtProcess = await readTable(CONFIG.TABLES.PDT_PROCESS.name);

            console.log('[Synthese] Chargement pdtsPerimetres...');
            const pdtsPerimetres = await readTable(CONFIG.TABLES.PDTS_PERIMETRES.name);

            console.log('[Synthese] Chargement tablesMh...');
            const tablesMh = await readTable(CONFIG.TABLES.TABLES_MH.name);

            console.log('[Synthese] Toutes les données chargées avec succès');

            // Extraire les tableaux depuis les résultats (format {data: [...], ...})
            const chantiersArray = chantiers.data || chantiers || [];
            const produitsArray = produits.data || produits || [];
            const maeArray = mae.data || mae || [];
            const acteursArray = acteurs.data || acteurs || [];
            const perimetresArray = perimetres.data || perimetres || [];
            const processusArray = processus.data || processus || [];
            const fluxArray = flux.data || flux || [];
            const shoresArray = shores.data || shores || [];
            const projetsDSSArray = projetsDSS.data || projetsDSS || [];
            const dataflowsArray = dataflows.data || dataflows || [];
            const pdtProcessArray = pdtProcess.data || pdtProcess || [];
            const pdtsPerimetresArray = pdtsPerimetres.data || pdtsPerimetres || [];
            const tablesMhArray = tablesMh.data || tablesMh || [];

            this.data.chantiers = chantiersArray.filter(c => c.Archivé !== 'Oui' && c.Archivé !== true);
            this.data.produits = produitsArray;
            this.data.mae = maeArray;
            this.data.acteurs = acteursArray;
            this.data.perimetres = perimetresArray;
            this.data.processus = processusArray;
            this.data.flux = fluxArray;
            this.data.shores = shoresArray;
            this.data.projetsDSS = projetsDSSArray;
            this.data.dataflows = dataflowsArray;
            this.data.pdtProcess = pdtProcessArray;
            this.data.pdtsPerimetres = pdtsPerimetresArray;
            this.data.tablesMh = tablesMhArray;
        } catch (error) {
            console.error('[Synthese] Erreur chargement donnees:', error);
            console.error('[Synthese] Stack:', error.stack);
            showError('Erreur lors du chargement des données: ' + error.message);
        }
    }

    /**
     * Initialise les valeurs des filtres au chargement
     */
    initializeFilters() {
        // Initialiser avec tous les périmètres sélectionnés
        const allPerimetres = [...new Set(this.data.perimetres.map(p => p.Périmetre))].filter(Boolean).sort();
        this.filters.selectedPerimetres = [...allPerimetres];

        // Initialiser avec tous les processus sélectionnés
        const allProcessus = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean).sort();
        this.filters.selectedProcessus = [...allProcessus];

        // Initialiser les sous-processus (vide au départ)
        this.filters.selectedSousProcessus = [];
    }

    /**
     * Rendu des filtres multi-select
     */
    renderFilters() {
        const container = document.getElementById('filtersGlobal');

        const allPerimetres = [...new Set(this.data.perimetres.map(p => p.Périmetre))].filter(Boolean).sort();
        const allProcessus = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean).sort();
        const availableSousProcessus = this.getAvailableSousProcessus();

        container.innerHTML = `
            <div class="filter-group">
                <label>Périmètre</label>
                <div class="multi-select-wrapper" id="perimetreFilterWrapper">
                    <div class="multi-select-trigger" onclick="synthesePageInstance.toggleMultiSelect('perimetre')">
                        <span class="multi-select-label">${this.getPerimetreLabel()}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown" id="perimetreDropdown">
                        <div class="multi-select-actions">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="synthesePageInstance.selectAllPerimetres()">Tous</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="synthesePageInstance.clearPerimetres()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${allPerimetres.map(p => `
                                <label class="multi-select-option">
                                    <input type="checkbox" value="${escapeHtml(p)}"
                                        ${this.filters.selectedPerimetres.includes(p) ? 'checked' : ''}
                                        onchange="synthesePageInstance.onPerimetresChange()">
                                    <span>${escapeHtml(p)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <label>Processus</label>
                <div class="multi-select-wrapper" id="processusFilterWrapper">
                    <div class="multi-select-trigger" onclick="synthesePageInstance.toggleMultiSelect('processus')">
                        <span class="multi-select-label">${this.getProcessusLabel()}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown" id="processusDropdown">
                        <div class="multi-select-actions">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="synthesePageInstance.selectAllProcessus()">Tous</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="synthesePageInstance.clearProcessus()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${allProcessus.map(p => `
                                <label class="multi-select-option">
                                    <input type="checkbox" value="${escapeHtml(p)}"
                                        ${this.filters.selectedProcessus.includes(p) ? 'checked' : ''}
                                        onchange="synthesePageInstance.onProcessusChange()">
                                    <span>${escapeHtml(p)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <label>Sous-processus</label>
                <div class="multi-select-wrapper" id="sousProcessusFilterWrapper">
                    <div class="multi-select-trigger" onclick="synthesePageInstance.toggleMultiSelect('sousProcessus')">
                        <span class="multi-select-label">${this.getSousProcessusLabel()}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown" id="sousProcessusDropdown">
                        <div class="multi-select-actions">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="synthesePageInstance.selectAllSousProcessus()">Tous</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="synthesePageInstance.clearSousProcessus()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${availableSousProcessus.length > 0 ? availableSousProcessus.map(sp => `
                                <label class="multi-select-option">
                                    <input type="checkbox" value="${escapeHtml(sp)}"
                                        ${this.filters.selectedSousProcessus.includes(sp) ? 'checked' : ''}
                                        onchange="synthesePageInstance.onSousProcessusChange()">
                                    <span>${escapeHtml(sp)}</span>
                                </label>
                            `).join('') : '<div style="padding: var(--spacing-sm); color: var(--mh-gris-moyen); font-style: italic;">Aucun sous-processus disponible</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Obtient les sous-processus disponibles basés sur les processus sélectionnés
     */
    getAvailableSousProcessus() {
        if (this.filters.selectedProcessus.length === 0) return [];

        const sousProcessus = this.data.processus
            .filter(p => this.filters.selectedProcessus.includes(p.Processus))
            .map(p => p['Sous-processus'])
            .filter(Boolean);

        return [...new Set(sousProcessus)].sort();
    }

    /**
     * Labels des filtres multi-select
     */
    getPerimetreLabel() {
        const all = [...new Set(this.data.perimetres.map(p => p.Périmetre))].filter(Boolean);
        if (this.filters.selectedPerimetres.length === all.length) return 'Tous';
        if (this.filters.selectedPerimetres.length === 0) return 'Aucun';
        return this.filters.selectedPerimetres.length + ' sélectionné(s)';
    }

    getProcessusLabel() {
        const all = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean);
        if (this.filters.selectedProcessus.length === all.length) return 'Tous';
        if (this.filters.selectedProcessus.length === 0) return 'Aucun';
        return this.filters.selectedProcessus.length + ' sélectionné(s)';
    }

    getSousProcessusLabel() {
        const available = this.getAvailableSousProcessus();
        if (available.length === 0) return 'Aucun disponible';
        if (this.filters.selectedSousProcessus.length === available.length) return 'Tous';
        if (this.filters.selectedSousProcessus.length === 0) return 'Aucun';
        return this.filters.selectedSousProcessus.length + ' sélectionné(s)';
    }

    attachEvents() {
        // Fermer les dropdowns en cliquant en dehors
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select-wrapper')) {
                document.querySelectorAll('.multi-select-dropdown').forEach(dd => {
                    dd.classList.remove('open');
                });
            }
        });

        // Filtres spécifiques des colonnes
        const filterAvancement = document.getElementById('filterAvancement');
        if (filterAvancement) {
            filterAvancement.addEventListener('change', () => {
                this.filters.avancement = filterAvancement.value;
                this.applyFiltersAndRender();
            });
        }

        const filterResponsable = document.getElementById('filterResponsable');
        if (filterResponsable) {
            filterResponsable.addEventListener('change', () => {
                this.filters.responsable = filterResponsable.value;
                this.applyFiltersAndRender();
            });
        }

        const filterEtat = document.getElementById('filterEtat');
        if (filterEtat) {
            filterEtat.addEventListener('change', () => {
                this.filters.etat = filterEtat.value;
                this.applyFiltersAndRender();
            });
        }
    }

    // === Gestion des multi-select ===

    /**
     * Toggle l'affichage d'un dropdown multi-select
     */
    toggleMultiSelect(type) {
        const dropdownIds = {
            perimetre: 'perimetreDropdown',
            processus: 'processusDropdown',
            sousProcessus: 'sousProcessusDropdown'
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

    // === Périmètre ===

    selectAllPerimetres() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        const all = [...new Set(this.data.perimetres.map(p => p.Périmetre))].filter(Boolean);
        this.filters.selectedPerimetres = [...all];
        this.updatePerimetreLabel();
        this.applyFiltersAndRender();
    }

    clearPerimetres() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.selectedPerimetres = [];
        this.updatePerimetreLabel();
        this.applyFiltersAndRender();
    }

    onPerimetresChange() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        this.filters.selectedPerimetres = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updatePerimetreLabel();
        this.applyFiltersAndRender();
    }

    updatePerimetreLabel() {
        const label = document.querySelector('#perimetreFilterWrapper .multi-select-label');
        if (label) {
            label.textContent = this.getPerimetreLabel();
        }
    }

    // === Processus ===

    selectAllProcessus() {
        const checkboxes = document.querySelectorAll('#processusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        const all = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean);
        this.filters.selectedProcessus = [...all];
        this.updateProcessusLabel();
        this.updateSousProcessusOptions();
        this.applyFiltersAndRender();
    }

    clearProcessus() {
        const checkboxes = document.querySelectorAll('#processusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.selectedProcessus = [];
        this.updateProcessusLabel();
        this.updateSousProcessusOptions();
        this.applyFiltersAndRender();
    }

    onProcessusChange() {
        const checkboxes = document.querySelectorAll('#processusDropdown input[type="checkbox"]');
        this.filters.selectedProcessus = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updateProcessusLabel();
        this.updateSousProcessusOptions();
        this.applyFiltersAndRender();
    }

    updateProcessusLabel() {
        const label = document.querySelector('#processusFilterWrapper .multi-select-label');
        if (label) {
            label.textContent = this.getProcessusLabel();
        }
    }

    // === Sous-processus ===

    selectAllSousProcessus() {
        const checkboxes = document.querySelectorAll('#sousProcessusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        const available = this.getAvailableSousProcessus();
        this.filters.selectedSousProcessus = [...available];
        this.updateSousProcessusLabel();
        this.applyFiltersAndRender();
    }

    clearSousProcessus() {
        const checkboxes = document.querySelectorAll('#sousProcessusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.selectedSousProcessus = [];
        this.updateSousProcessusLabel();
        this.applyFiltersAndRender();
    }

    onSousProcessusChange() {
        const checkboxes = document.querySelectorAll('#sousProcessusDropdown input[type="checkbox"]');
        this.filters.selectedSousProcessus = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updateSousProcessusLabel();
        this.applyFiltersAndRender();
    }

    updateSousProcessusLabel() {
        const label = document.querySelector('#sousProcessusFilterWrapper .multi-select-label');
        if (label) {
            label.textContent = this.getSousProcessusLabel();
        }
    }

    /**
     * Met à jour les options disponibles pour le filtre sous-processus
     */
    updateSousProcessusOptions() {
        const available = this.getAvailableSousProcessus();
        const container = document.querySelector('#sousProcessusDropdown .multi-select-options');

        if (!container) return;

        // Filtrer les sous-processus sélectionnés pour ne garder que ceux encore disponibles
        this.filters.selectedSousProcessus = this.filters.selectedSousProcessus.filter(sp => available.includes(sp));

        // Re-générer les options
        if (available.length === 0) {
            container.innerHTML = '<div style="padding: var(--spacing-sm); color: var(--mh-gris-moyen); font-style: italic;">Aucun sous-processus disponible</div>';
        } else {
            container.innerHTML = available.map(sp => `
                <label class="multi-select-option">
                    <input type="checkbox" value="${escapeHtml(sp)}"
                        ${this.filters.selectedSousProcessus.includes(sp) ? 'checked' : ''}
                        onchange="synthesePageInstance.onSousProcessusChange()">
                    <span>${escapeHtml(sp)}</span>
                </label>
            `).join('');
        }

        this.updateSousProcessusLabel();
    }

    applyFiltersAndRender() {
        const chantiersFiltered = this.filterChantiers();
        const produitsFiltered = this.filterProduits();
        const maeFiltered = this.filterMAE();

        this.renderChantiers(chantiersFiltered);
        this.renderProduits(produitsFiltered);
        this.renderMAE(maeFiltered);
    }

    filterChantiers() {
        // Si aucun périmètre sélectionné, retourner tableau vide
        if (this.filters.selectedPerimetres.length === 0) {
            return [];
        }

        // Si aucun processus sélectionné, retourner tableau vide
        if (this.filters.selectedProcessus.length === 0) {
            return [];
        }

        // Vérifier si tous les filtres sont sur "Tous"
        const allPerimetres = [...new Set(this.data.perimetres.map(p => p.Périmetre))].filter(Boolean);
        const allPerimetresSelected = this.filters.selectedPerimetres.length === allPerimetres.length;

        const allProcessus = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean);
        const allProcessusSelected = this.filters.selectedProcessus.length === allProcessus.length;

        const availableSousProcessus = this.getAvailableSousProcessus();
        const allSousProcessusSelected = availableSousProcessus.length === 0 ||
                                         this.filters.selectedSousProcessus.length === 0 ||
                                         this.filters.selectedSousProcessus.length === availableSousProcessus.length;

        return this.data.chantiers.filter(chantier => {
            // Si le chantier n'a pas de périmètre ou processus défini, l'inclure seulement si tous les filtres sont sur "Tous"
            const hasPerimetre = !!chantier.Perimetre;
            const hasProcessus = !!chantier.Processus;

            if (!hasPerimetre || !hasProcessus) {
                // Inclure uniquement si TOUS les filtres globaux sont à "Tous"
                if (!allPerimetresSelected || !allProcessusSelected || !allSousProcessusSelected) {
                    return false;
                }
                // Si tous les filtres sont "Tous", vérifier quand même le filtre Avancement
                if (this.filters.avancement && chantier.Avancement !== this.filters.avancement) {
                    return false;
                }
                return true;
            }

            // Filtre Périmètre (multi-select)
            if (!this.filters.selectedPerimetres.includes(chantier.Perimetre)) {
                return false;
            }

            // Filtre Processus (multi-select)
            if (!this.filters.selectedProcessus.includes(chantier.Processus)) {
                return false;
            }

            // Filtre Sous-processus (multi-select) - uniquement si des sous-processus sont disponibles et sélectionnés
            if (availableSousProcessus.length > 0 && this.filters.selectedSousProcessus.length > 0) {
                if (!this.filters.selectedSousProcessus.includes(chantier['Sous-processus'])) {
                    return false;
                }
            }

            // Filtre Avancement
            if (this.filters.avancement && chantier.Avancement !== this.filters.avancement) {
                return false;
            }

            return true;
        });
    }

    filterProduits() {
        // Si aucun périmètre sélectionné, retourner tableau vide
        if (this.filters.selectedPerimetres.length === 0) {
            return [];
        }

        // Si aucun processus sélectionné, retourner tableau vide
        if (this.filters.selectedProcessus.length === 0) {
            return [];
        }

        // Vérifier si tous les filtres sont sur "Tous"
        const allPerimetres = [...new Set(this.data.perimetres.map(p => p.Périmetre))].filter(Boolean);
        const allPerimetresSelected = this.filters.selectedPerimetres.length === allPerimetres.length;

        const allProcessus = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean);
        const allProcessusSelected = this.filters.selectedProcessus.length === allProcessus.length;

        const availableSousProcessus = this.getAvailableSousProcessus();
        const allSousProcessusSelected = availableSousProcessus.length === 0 ||
                                         this.filters.selectedSousProcessus.length === 0 ||
                                         this.filters.selectedSousProcessus.length === availableSousProcessus.length;

        // Construire l'ensemble des produits qui correspondent aux périmètres sélectionnés
        const produitsParPerimetre = new Set(
            this.data.pdtsPerimetres
                .filter(pp => this.filters.selectedPerimetres.includes(pp['Périmètre']))
                .map(pp => pp['Produit'])
        );

        return this.data.produits.filter(produit => {
            // Vérifier si le produit a un périmètre et un processus définis
            const hasPerimetre = this.data.pdtsPerimetres.some(pp => pp.Produit === produit.Nom);
            const pdtProcessEntries = this.data.pdtProcess.filter(pp => pp.Produit === produit.Nom);
            const hasProcessus = pdtProcessEntries.length > 0;

            // Si le produit n'a pas de périmètre ou processus défini, l'inclure seulement si tous les filtres sont sur "Tous"
            if (!hasPerimetre || !hasProcessus) {
                // Inclure uniquement si TOUS les filtres globaux sont à "Tous"
                if (!allPerimetresSelected || !allProcessusSelected || !allSousProcessusSelected) {
                    return false;
                }
                // Si tous les filtres sont "Tous", vérifier quand même le filtre Responsable
                if (this.filters.responsable && produit.Responsable !== this.filters.responsable) {
                    return false;
                }
                return true;
            }

            // Filtre Périmètre via tPdtsPerimetres (multi-select)
            if (!produitsParPerimetre.has(produit.Nom)) {
                return false;
            }

            // Filtre Responsable
            if (this.filters.responsable && produit.Responsable !== this.filters.responsable) {
                return false;
            }

            // Vérifier si le produit match au moins un processus sélectionné
            let matchesProcessus = false;
            for (const entry of pdtProcessEntries) {
                if (this.filters.selectedProcessus.includes(entry.Processus)) {
                    matchesProcessus = true;
                    break;
                }
            }

            if (!matchesProcessus) {
                return false;
            }

            // Filtre Sous-processus uniquement si des sous-processus sont disponibles et sélectionnés
            if (availableSousProcessus.length > 0 && this.filters.selectedSousProcessus.length > 0) {
                let matchesSousProcessus = false;
                for (const entry of pdtProcessEntries) {
                    if (this.filters.selectedSousProcessus.includes(entry['Sous-processus'])) {
                        matchesSousProcessus = true;
                        break;
                    }
                }

                if (!matchesSousProcessus) {
                    return false;
                }
            }

            return true;
        });
    }

    filterMAE() {
        // Si aucun périmètre sélectionné, retourner tableau vide
        if (this.filters.selectedPerimetres.length === 0) {
            return [];
        }

        // Si aucun processus sélectionné, retourner tableau vide
        if (this.filters.selectedProcessus.length === 0) {
            return [];
        }

        return this.data.mae.filter(mae => {
            // Filtre État
            if (this.filters.etat && mae.Etat !== this.filters.etat) {
                return false;
            }

            // Filtre Périmètre directement sur le champ "Périmètre - MAE"
            const perimetreMae = mae['Périmètre - MAE'];

            // Si pas de périmètre défini sur la MAE : inclure uniquement si tous les filtres sont "Tous"
            if (!perimetreMae) {
                // Vérifier si tous les périmètres sont sélectionnés
                const allPerimetres = [...new Set(this.data.perimetres.map(p => p.Périmetre))].filter(Boolean);
                const allPerimetresSelected = this.filters.selectedPerimetres.length === allPerimetres.length;

                // Vérifier si tous les processus sont sélectionnés
                const allProcessus = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean);
                const allProcessusSelected = this.filters.selectedProcessus.length === allProcessus.length;

                // Vérifier si aucun sous-processus n'est filtré (compatible avec affichage "Aucun" quand liste vide)
                const availableSousProcessus = this.getAvailableSousProcessus();
                const noSousProcessusFilter = availableSousProcessus.length === 0 ||
                                              this.filters.selectedSousProcessus.length === 0 ||
                                              this.filters.selectedSousProcessus.length === availableSousProcessus.length;

                // Inclure la demande MAE seulement si TOUS les filtres globaux sont à "Tous"
                return allPerimetresSelected && allProcessusSelected && noSousProcessusFilter;
            }

            // Filtre Périmètre sur le champ "Périmètre - MAE"
            if (!this.filters.selectedPerimetres.includes(perimetreMae)) {
                return false;
            }

            // Pour les filtres Processus et Sous-processus, on utilise le chantier associé s'il existe
            const chantier = this.data.chantiers.find(c => c.Chantier === mae.Chantier);

            // Si pas de chantier, on inclut la MAE (le périmètre a déjà été vérifié ci-dessus)
            if (!chantier) {
                return true;
            }

            // Si le chantier n'a pas de processus défini, l'inclure seulement si tous les filtres sont sur "Tous"
            if (!chantier.Processus) {
                const allProcessus = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean);
                const allProcessusSelected = this.filters.selectedProcessus.length === allProcessus.length;

                const availableSousProcessus = this.getAvailableSousProcessus();
                const allSousProcessusSelected = availableSousProcessus.length === 0 ||
                                                 this.filters.selectedSousProcessus.length === 0 ||
                                                 this.filters.selectedSousProcessus.length === availableSousProcessus.length;

                return allProcessusSelected && allSousProcessusSelected;
            }

            // Filtre Processus via le chantier
            if (!this.filters.selectedProcessus.includes(chantier.Processus)) {
                return false;
            }

            // Filtre Sous-processus uniquement si des sous-processus sont disponibles et sélectionnés
            const availableSousProcessus = this.getAvailableSousProcessus();
            if (availableSousProcessus.length > 0 && this.filters.selectedSousProcessus.length > 0) {
                if (!this.filters.selectedSousProcessus.includes(chantier['Sous-processus'])) {
                    return false;
                }
            }

            return true;
        });
    }

    renderChantiers(chantiers) {
        const tbody = document.querySelector('#chantiersTable tbody');
        const countEl = document.getElementById('chantiersCount');

        countEl.textContent = `${chantiers.length} chantier(s)`;

        if (chantiers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Aucun chantier</td></tr>';
            return;
        }

        tbody.innerHTML = chantiers.map(chantier => `
            <tr class="clickable-row" data-chantier="${escapeHtml(chantier.Chantier || '')}">
                <td>${escapeHtml(chantier.NumChantier || '')}</td>
                <td>${escapeHtml(chantier.Chantier || '')}</td>
                <td>${chantier['Date fin souhaitée'] ? formatDate(chantier['Date fin souhaitée']) : ''}</td>
            </tr>
        `).join('');

        // Ajouter les event listeners pour ouvrir la popup chantier
        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', async () => {
                const chantierName = row.dataset.chantier;
                if (chantierName && typeof ChantierModal !== 'undefined') {
                    await ChantierModal.showEditModal(chantierName, async () => {
                        await this.loadData();
                        this.applyFiltersAndRender();
                    });
                }
            });
        });
    }

    renderProduits(produits) {
        const tbody = document.querySelector('#produitsTable tbody');
        const countEl = document.getElementById('produitsCount');

        countEl.textContent = `${produits.length} produit(s)`;

        if (produits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Aucun produit</td></tr>';
            return;
        }

        // Trier par ordre alphabétique sur le nom
        const produitsTries = [...produits].sort((a, b) => {
            const nomA = (a.Nom || '').toLowerCase();
            const nomB = (b.Nom || '').toLowerCase();
            return nomA.localeCompare(nomB);
        });

        tbody.innerHTML = produitsTries.map(produit => {
            const status = this.getProductMigrationStatus(produit);
            const statusClass = status === 'migrated' ? 'status-green' : status === 'partial' ? 'status-orange' : 'status-red';
            const statusIcon = `<span class="status-circle ${statusClass}"></span>`;

            return `
                <tr class="clickable-row" data-produit="${escapeHtml(produit.Nom || '')}">
                    <td>${escapeHtml(produit.Nom || '')}</td>
                    <td>${escapeHtml(produit['Type de rapport'] || '')}</td>
                    <td>${statusIcon}</td>
                    <td>
                        <button class="btn-lineage btn-secondary btn-sm" data-produit="${escapeHtml(produit.Nom || '')}"
                                onclick="event.stopPropagation()">
                            Lineage
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Event listeners pour clic sur ligne (ouvrir popup produit)
        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-lineage')) return;
                const produitName = row.dataset.produit;
                const produit = this.data.produits.find(p => p.Nom === produitName);
                if (produit) {
                    this.showProductDetails(produit);
                }
            });
        });

        // Event listeners pour bouton Lineage
        tbody.querySelectorAll('.btn-lineage').forEach(btn => {
            btn.addEventListener('click', () => {
                const produitName = btn.dataset.produit;
                const produit = this.data.produits.find(p => p.Nom === produitName);
                if (produit) {
                    this.showLineageModal(produit);
                }
            });
        });
    }

    getProductMigrationStatus(produit) {
        // Rouge si shore/gold, projet DSS, dataflow et produit non migrés
        // Orange si shore/gold migré mais pas les autres
        // Vert si produit migré

        const statutMigration = produit['Statut Migration'];
        if (statutMigration && (statutMigration.toLowerCase() === 'migré' || statutMigration.toLowerCase() === 'terminé')) {
            return 'migrated';
        }

        // Verifier shore/gold
        const shoreActuel = produit['Gold / Shore actuel'];
        const shore = this.data.shores.find(s => s.Nom === shoreActuel);
        const shoreMigre = shore && shore['Migré Tech'] && shore['Migré Tech'].toLowerCase() === 'oui';

        // Verifier les flux associes
        const flux = this.data.flux.filter(f => f.Produit === produit.Nom);
        const hasMigratedFlux = flux.some(f => {
            const projet = this.data.projetsDSS.find(p => p['Nom projet'] === f['Projet DSS']);
            const dataflow = this.data.dataflows.find(d => d.Nom === f['DFNom DF']);
            const projetMigre = projet?.['Statut migration'];
            const dataflowMigre = dataflow?.['Statut migration'];
            return projetMigre && projetMigre.toLowerCase() === 'migré' && dataflowMigre && dataflowMigre.toLowerCase() === 'migré';
        });

        if (shoreMigre && !hasMigratedFlux) {
            return 'partial';
        }

        return 'not-migrated';
    }

    renderMAE(mae) {
        const tbody = document.querySelector('#maeTable tbody');
        const countEl = document.getElementById('maeCount');

        countEl.textContent = `${mae.length} demande(s)`;

        if (mae.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="empty-state">Aucune demande</td></tr>';
            return;
        }

        tbody.innerHTML = mae.map(m => {
            const cleJira = escapeHtml(m['Clé'] || '');
            const jiraUrl = cleJira ? `https://malakoffhumanis.atlassian.net/browse/${cleJira}` : '#';
            const cleHtml = cleJira ? `<a href="${jiraUrl}" target="_blank" rel="noopener noreferrer">${cleJira}</a>` : '';

            return `
                <tr class="clickable-row" data-cle="${cleJira}">
                    <td>${cleHtml}</td>
                    <td>${escapeHtml(m['Résumé'] || '')}</td>
                </tr>
            `;
        }).join('');

        // Event listeners pour ouvrir la popup MAE
        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', async () => {
                const cleJira = row.dataset.cle;
                if (cleJira && typeof MAEModal !== 'undefined') {
                    await MAEModal.showEditModal(cleJira, async () => {
                        await this.loadData();
                        this.applyFiltersAndRender();
                    });
                }
            });
        });
    }

    async showProductDetails(produit) {
        console.log('[Synthese] showProductDetails appelé avec:', produit);

        await ProductModal.showEditModal(produit, produit._rowIndex, async () => {
            await this.loadData();
            this.applyFiltersAndRender();
        });
    }

    /**
     * Affiche la modale de lineage pour un produit
     */
    showLineageModal(produit) {
        // Créer une instance de LineageModal avec les données nécessaires
        const lineageModal = new LineageModal({
            flux: this.data.flux,
            shores: this.data.shores,
            projetsDSS: this.data.projetsDSS,
            dataflows: this.data.dataflows,
            tablesMh: this.data.tablesMh
        });

        // Afficher la modale
        lineageModal.show(produit);
    }
}

// Instance globale
let synthesePageInstance = null;

async function renderSynthesePage(container) {
    synthesePageInstance = new SynthesePage();
    await synthesePageInstance.render(container);
}

async function refreshSynthesePage() {
    if (synthesePageInstance) {
        const container = document.getElementById('mainContent');
        if (container) {
            await synthesePageInstance.render(container);
        }
    }
}
