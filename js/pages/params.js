/* ===========================================
   PARAMS.JS - Pages de gestion des paramètres
   Application Carto
   =========================================== */

/**
 * Classe ParamsPage pour gérer les tables de paramètres
 */
class ParamsPage {
    constructor(tableKey) {
        this.tableKey = tableKey;
        this.tableConfig = CONFIG.TABLES[tableKey];
        this.dataTable = null;

        // DataAna specific: filter state
        this._dataAnaFilters = null;
        this._filtersInitialized = false;
        if (tableKey === 'DATAANA') {
            this._dataAnaFilters = {
                etats: new Set(),
                personnes: new Set(),
                allEtats: [],
                allPersonnes: []
            };
        }

        // Chantier specific: filter state
        this._chantierFilters = null;
        this._chantierFiltersInitialized = false;
        if (tableKey === 'CHANTIER') {
            this._chantierFilters = {
                perimetres: new Set(),
                responsables: new Set(),
                avancements: new Set(),
                allPerimetres: [],
                allResponsables: [],
                allAvancements: []
            };
        }
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        if (!this.tableConfig) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    Configuration de table non trouvée pour: ${this.tableKey}
                </div>
            `;
            return;
        }

        const isDataAna = this.tableKey === 'DATAANA';
        const isChantier = this.tableKey === 'CHANTIER';

        // Bouton Copie Jira
        const jiraButtonHtml = this.tableConfig.jiraSheet ? `
            <button id="btnCopyJira" class="btn btn-action btn-sm">
                <span>&#128230;</span> Copie Jira
            </button>
        ` : '';

        // Barre du haut : filtres (DataAna / Chantier) ou toolbar simple
        let topBarHtml = '';
        if (isDataAna) {
            topBarHtml = `
                <div class="mae-filters" id="dataAnaFilters">
                    <div class="mae-filter-group" id="filterGroupEtat">
                        <label>État</label>
                        <div class="mae-filter-trigger" id="filterTriggerEtat">
                            <span class="filter-text">Chargement...</span>
                            <span class="arrow">&#9660;</span>
                        </div>
                        <div class="mae-filter-dropdown" id="filterDropdownEtat">
                            <div class="mae-filter-dropdown-actions">
                                <button data-action="all">Tous</button>
                                <button data-action="none">Aucun</button>
                            </div>
                            <div class="mae-filter-options" id="filterOptionsEtat"></div>
                        </div>
                    </div>
                    <div class="mae-filter-group" id="filterGroupPersonne">
                        <label>Personne assignée</label>
                        <div class="mae-filter-trigger" id="filterTriggerPersonne">
                            <span class="filter-text">Chargement...</span>
                            <span class="arrow">&#9660;</span>
                        </div>
                        <div class="mae-filter-dropdown" id="filterDropdownPersonne">
                            <div class="mae-filter-dropdown-actions">
                                <button data-action="all">Tous</button>
                                <button data-action="none">Aucun</button>
                            </div>
                            <div class="mae-filter-options" id="filterOptionsPersonne"></div>
                        </div>
                    </div>
                    ${jiraButtonHtml ? `<div class="mae-filters-actions">${jiraButtonHtml}</div>` : ''}
                </div>
            `;
        } else if (isChantier) {
            topBarHtml = `
                <div class="mae-filters" id="chantierFilters">
                    <div class="mae-filter-group" id="filterGroupPerimetre">
                        <label>Périmètre</label>
                        <div class="mae-filter-trigger" id="filterTriggerPerimetre">
                            <span class="filter-text">Chargement...</span>
                            <span class="arrow">&#9660;</span>
                        </div>
                        <div class="mae-filter-dropdown" id="filterDropdownPerimetre">
                            <div class="mae-filter-dropdown-actions">
                                <button data-action="all">Tous</button>
                                <button data-action="none">Aucun</button>
                            </div>
                            <div class="mae-filter-options" id="filterOptionsPerimetre"></div>
                        </div>
                    </div>
                    <div class="mae-filter-group" id="filterGroupResponsable">
                        <label>Responsable</label>
                        <div class="mae-filter-trigger" id="filterTriggerResponsable">
                            <span class="filter-text">Chargement...</span>
                            <span class="arrow">&#9660;</span>
                        </div>
                        <div class="mae-filter-dropdown" id="filterDropdownResponsable">
                            <div class="mae-filter-dropdown-actions">
                                <button data-action="all">Tous</button>
                                <button data-action="none">Aucun</button>
                            </div>
                            <div class="mae-filter-options" id="filterOptionsResponsable"></div>
                        </div>
                    </div>
                    <div class="mae-filter-group" id="filterGroupAvancement">
                        <label>Avancement</label>
                        <div class="mae-filter-trigger" id="filterTriggerAvancement">
                            <span class="filter-text">Chargement...</span>
                            <span class="arrow">&#9660;</span>
                        </div>
                        <div class="mae-filter-dropdown" id="filterDropdownAvancement">
                            <div class="mae-filter-dropdown-actions">
                                <button data-action="all">Tous</button>
                                <button data-action="none">Aucun</button>
                            </div>
                            <div class="mae-filter-options" id="filterOptionsAvancement"></div>
                        </div>
                    </div>
                </div>
            `;
        } else if (jiraButtonHtml) {
            topBarHtml = `<div class="params-toolbar">${jiraButtonHtml}</div>`;
        }

        container.innerHTML = `
            <div class="params-page">
                ${topBarHtml}
                <section class="section">
                    <div id="tableParams"></div>
                </section>
            </div>
        `;

        // Attacher l'événement du bouton Copie Jira
        if (this.tableConfig.jiraSheet) {
            const btnCopyJira = document.getElementById('btnCopyJira');
            if (btnCopyJira) {
                btnCopyJira.addEventListener('click', () => this.handleCopyFromJira());
            }
        }

        // Attacher les événements des filtres DataAna
        if (isDataAna) {
            this._attachDataAnaFilterEvents();
        }

        // Attacher les événements des filtres Chantier
        if (isChantier) {
            this._attachChantierFilterEvents();
        }

        await this.renderTable();
    }

    /**
     * Gère la copie depuis Jira
     */
    async handleCopyFromJira() {
        const jiraSheet = this.tableConfig.jiraSheet;
        const tableName = this.tableConfig.name;
        const keyField = 'Clé';
        const isDataAna = this.tableKey === 'DATAANA';

        const confirmMessage = isDataAna
            ? `Voulez-vous synchroniser les données depuis la feuille "${jiraSheet}" ?\n\n` +
              `• Nouveaux éléments ajoutés (sauf état "Résolue")\n` +
              `• État mis à jour pour les éléments existants`
            : `Voulez-vous copier les données depuis la feuille "${jiraSheet}" vers la table "${tableName}" ?\n\nLes clés existantes seront ignorées.`;

        showConfirmModal(
            'Copie depuis Jira',
            confirmMessage,
            async () => {
                try {
                    showInfo(isDataAna ? 'Synchronisation en cours...' : 'Copie en cours...');

                    const options = isDataAna ? {
                        skipStates: ['Résolue'],
                        stateField: 'État',
                        updateFields: ['État']
                    } : {};

                    const result = await copyFromJira(jiraSheet, tableName, keyField, options);

                    if (result.success) {
                        showSuccess(result.message);
                        await this.refresh();
                    } else {
                        showError('Erreur lors de la copie: ' + (result.error || 'Erreur inconnue'));
                    }
                    return true;
                } catch (error) {
                    showError('Erreur lors de la copie: ' + error.message);
                    return false;
                }
            },
            { confirmText: isDataAna ? 'Synchroniser' : 'Copier' }
        );
    }

    /**
     * Rendu du tableau
     */
    async renderTable() {
        const container = document.getElementById('tableParams');
        if (!container) return;

        // Colonnes visibles : pour CHANTIER, masquer certains champs du tableau
        let visibleColumns = this.tableConfig.columns;
        if (this.tableKey === 'CHANTIER') {
            const hiddenFields = ['Archivé', 'Processus', 'Enjeux', 'Description'];
            visibleColumns = this.tableConfig.columns.filter(c => !hiddenFields.includes(c.field));
        }

        const options = {
            tableName: this.tableConfig.name,
            tableConfig: this.tableConfig,
            columns: visibleColumns,
            showToolbar: true,
            showPagination: true,
            editable: true,
            onAdd: () => this.showAddForm(),
            onEdit: (row, index) => this.showEditForm(row, index),
            onDelete: (row, index) => this.confirmDelete(row, index)
        };

        // DataAna : ajouter filtre externe et callback chargement
        if (this.tableKey === 'DATAANA') {
            options.externalFilter = (data) => {
                if (!this._filtersInitialized) return data;
                return data.filter(row => {
                    const etat = String(row['État'] || '').trim();
                    const personne = String(row['Personne assignée'] || '').trim();
                    if (etat && !this._dataAnaFilters.etats.has(etat)) return false;
                    if (personne && !this._dataAnaFilters.personnes.has(personne)) return false;
                    return true;
                });
            };
            options.onDataLoaded = (data) => this._populateDataAnaFilters(data);
        }

        // Chantier : ajouter filtre externe et callback chargement
        if (this.tableKey === 'CHANTIER') {
            options.externalFilter = (data) => {
                if (!this._chantierFiltersInitialized) return data;
                return data.filter(row => {
                    const perimetre = String(row['Perimetre'] || '').trim();
                    const responsable = String(row['Responsable'] || '').trim();
                    const avancement = String(row['Avancement'] || '').trim();
                    if (this._chantierFilters.perimetres.size > 0 || this._chantierFilters.allPerimetres.length > 0) {
                        if (perimetre && !this._chantierFilters.perimetres.has(perimetre)) return false;
                        if (!perimetre && !this._chantierFilters.perimetres.has('(Non rempli)')) return false;
                    }
                    if (this._chantierFilters.responsables.size > 0 || this._chantierFilters.allResponsables.length > 0) {
                        if (responsable && !this._chantierFilters.responsables.has(responsable)) return false;
                        if (!responsable && !this._chantierFilters.responsables.has('(Non rempli)')) return false;
                    }
                    if (this._chantierFilters.avancements.size > 0 || this._chantierFilters.allAvancements.length > 0) {
                        if (avancement && !this._chantierFilters.avancements.has(avancement)) return false;
                        if (!avancement && !this._chantierFilters.avancements.has('(Non rempli)')) return false;
                    }
                    return true;
                });
            };
            options.onDataLoaded = (data) => this._populateChantierFilters(data);
        }

        this.dataTable = new DataTable(container, options);
    }

    // ── DataAna Filters ─────────────────────────────────────────

    /**
     * Peuple les filtres État / Personne à partir des données chargées
     */
    _populateDataAnaFilters(data) {
        const etatsSet = new Set();
        const personnesSet = new Set();

        data.forEach(row => {
            const etat = String(row['État'] || '').trim();
            const personne = String(row['Personne assignée'] || '').trim();
            if (etat) etatsSet.add(etat);
            if (personne) personnesSet.add(personne);
        });

        const newAllEtats = [...etatsSet].sort();
        const newAllPersonnes = [...personnesSet].sort();

        if (!this._filtersInitialized) {
            // Premier chargement : tout sélectionné sauf "Résolue" pour État
            this._dataAnaFilters.etats = new Set(newAllEtats.filter(e => e !== 'Résolue'));
            this._dataAnaFilters.personnes = new Set(newAllPersonnes);
            this._filtersInitialized = true;
        } else {
            // Refresh : garder les sélections, ajouter les nouvelles valeurs
            newAllEtats.forEach(e => {
                if (!this._dataAnaFilters.allEtats.includes(e)) {
                    if (e !== 'Résolue') this._dataAnaFilters.etats.add(e);
                }
            });
            newAllPersonnes.forEach(p => {
                if (!this._dataAnaFilters.allPersonnes.includes(p)) {
                    this._dataAnaFilters.personnes.add(p);
                }
            });
            // Retirer les valeurs qui n'existent plus
            this._dataAnaFilters.etats = new Set(
                [...this._dataAnaFilters.etats].filter(e => newAllEtats.includes(e))
            );
            this._dataAnaFilters.personnes = new Set(
                [...this._dataAnaFilters.personnes].filter(p => newAllPersonnes.includes(p))
            );
        }

        this._dataAnaFilters.allEtats = newAllEtats;
        this._dataAnaFilters.allPersonnes = newAllPersonnes;

        // Mettre à jour les dropdowns
        this._renderFilterOptions('Etat', this._dataAnaFilters.allEtats, this._dataAnaFilters.etats);
        this._renderFilterOptions('Personne', this._dataAnaFilters.allPersonnes, this._dataAnaFilters.personnes);
        this._updateFilterLabel('Etat');
        this._updateFilterLabel('Personne');
    }

    /**
     * Attache les événements des filtres DataAna (dropdowns, Tous/Aucun)
     */
    _attachDataAnaFilterEvents() {
        // Toggle dropdowns
        ['Etat', 'Personne'].forEach(type => {
            const trigger = document.getElementById(`filterTrigger${type}`);
            const dropdown = document.getElementById(`filterDropdown${type}`);
            if (!trigger || !dropdown) return;

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Fermer les autres dropdowns
                document.querySelectorAll('.mae-filter-dropdown.open').forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });
                document.querySelectorAll('.mae-filter-trigger.open').forEach(t => {
                    if (t !== trigger) t.classList.remove('open');
                });
                dropdown.classList.toggle('open');
                trigger.classList.toggle('open');
            });

            // Boutons Tous / Aucun
            dropdown.querySelectorAll('.mae-filter-dropdown-actions button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = e.target.dataset.action;
                    const field = type === 'Etat' ? 'etats' : 'personnes';
                    const allValues = type === 'Etat' ? this._dataAnaFilters.allEtats : this._dataAnaFilters.allPersonnes;

                    if (action === 'all') {
                        this._dataAnaFilters[field] = new Set(allValues);
                    } else {
                        this._dataAnaFilters[field] = new Set();
                    }
                    this._updateFilterCheckboxes(type);
                    this._updateFilterLabel(type);
                    this._applyDataAnaFilters();
                });
            });
        });

        // Fermer les dropdowns au clic extérieur
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mae-filter-group')) {
                document.querySelectorAll('#dataAnaFilters .mae-filter-dropdown.open').forEach(d => d.classList.remove('open'));
                document.querySelectorAll('#dataAnaFilters .mae-filter-trigger.open').forEach(t => t.classList.remove('open'));
            }
        });
    }

    /**
     * Génère les options (checkboxes) d'un dropdown filtre
     */
    _renderFilterOptions(type, allValues, selectedValues) {
        const container = document.getElementById(`filterOptions${type}`);
        if (!container) return;

        container.innerHTML = allValues.map(val => `
            <label class="mae-filter-option">
                <input type="checkbox" value="${escapeHtml(val)}" ${selectedValues.has(val) ? 'checked' : ''}>
                <span>${escapeHtml(val)}</span>
            </label>
        `).join('');

        // Déterminer si c'est un filtre DataAna ou Chantier
        const isChantierFilter = ['Perimetre', 'Responsable', 'Avancement'].includes(type);

        // Attacher les événements des checkboxes
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                if (isChantierFilter) {
                    const field = this._chantierFilterField(type);
                    if (cb.checked) {
                        this._chantierFilters[field].add(cb.value);
                    } else {
                        this._chantierFilters[field].delete(cb.value);
                    }
                    this._updateChantierFilterLabel(type);
                    this._applyChantierFilters();
                } else {
                    const field = type === 'Etat' ? 'etats' : 'personnes';
                    if (cb.checked) {
                        this._dataAnaFilters[field].add(cb.value);
                    } else {
                        this._dataAnaFilters[field].delete(cb.value);
                    }
                    this._updateFilterLabel(type);
                    this._applyDataAnaFilters();
                }
            });
        });
    }

    /**
     * Met à jour l'état des checkboxes d'un dropdown
     */
    _updateFilterCheckboxes(type) {
        const field = type === 'Etat' ? 'etats' : 'personnes';
        const container = document.getElementById(`filterOptions${type}`);
        if (!container) return;

        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = this._dataAnaFilters[field].has(cb.value);
        });
    }

    /**
     * Met à jour le libellé du filtre (trigger)
     */
    _updateFilterLabel(type) {
        const field = type === 'Etat' ? 'etats' : 'personnes';
        const allField = type === 'Etat' ? 'allEtats' : 'allPersonnes';
        const trigger = document.getElementById(`filterTrigger${type}`);
        if (!trigger) return;

        const textEl = trigger.querySelector('.filter-text');
        const selected = this._dataAnaFilters[field];
        const total = this._dataAnaFilters[allField].length;

        if (selected.size === 0) {
            textEl.textContent = 'Aucun';
        } else if (selected.size === total) {
            textEl.textContent = 'Tous';
        } else if (selected.size <= 2) {
            textEl.textContent = [...selected].join(', ');
        } else {
            textEl.textContent = `${selected.size} / ${total}`;
        }
    }

    /**
     * Applique les filtres DataAna sur le DataTable
     */
    _applyDataAnaFilters() {
        if (this.dataTable) {
            this.dataTable.currentPage = 1;
            this.dataTable.applyFilters();
        }
    }

    // ── Fin DataAna Filters ─────────────────────────────────────

    // ── Chantier Filters ──────────────────────────────────────

    /**
     * Peuple les filtres Périmètre / Responsable / Avancement à partir des données chargées
     */
    _populateChantierFilters(data) {
        const perimetresSet = new Set();
        const responsablesSet = new Set();
        const avancementsSet = new Set();
        let hasEmptyPerimetre = false;
        let hasEmptyResponsable = false;
        let hasEmptyAvancement = false;

        data.forEach(row => {
            const perimetre = String(row['Perimetre'] || '').trim();
            const responsable = String(row['Responsable'] || '').trim();
            const avancement = String(row['Avancement'] || '').trim();
            if (perimetre) perimetresSet.add(perimetre); else hasEmptyPerimetre = true;
            if (responsable) responsablesSet.add(responsable); else hasEmptyResponsable = true;
            if (avancement) avancementsSet.add(avancement); else hasEmptyAvancement = true;
        });

        const newAllPerimetres = [...perimetresSet].sort();
        if (hasEmptyPerimetre) newAllPerimetres.push('(Non rempli)');
        const newAllResponsables = [...responsablesSet].sort();
        if (hasEmptyResponsable) newAllResponsables.push('(Non rempli)');
        const newAllAvancements = [...avancementsSet].sort();
        if (hasEmptyAvancement) newAllAvancements.push('(Non rempli)');

        if (!this._chantierFiltersInitialized) {
            this._chantierFilters.perimetres = new Set(newAllPerimetres);
            this._chantierFilters.responsables = new Set(newAllResponsables);
            this._chantierFilters.avancements = new Set(newAllAvancements);
            this._chantierFiltersInitialized = true;
        } else {
            // Ajouter les nouvelles valeurs, retirer celles qui n'existent plus
            this._chantierFilters.perimetres = new Set(
                [...this._chantierFilters.perimetres].filter(v => newAllPerimetres.includes(v))
            );
            this._chantierFilters.responsables = new Set(
                [...this._chantierFilters.responsables].filter(v => newAllResponsables.includes(v))
            );
            this._chantierFilters.avancements = new Set(
                [...this._chantierFilters.avancements].filter(v => newAllAvancements.includes(v))
            );
        }

        this._chantierFilters.allPerimetres = newAllPerimetres;
        this._chantierFilters.allResponsables = newAllResponsables;
        this._chantierFilters.allAvancements = newAllAvancements;

        this._renderFilterOptions('Perimetre', this._chantierFilters.allPerimetres, this._chantierFilters.perimetres);
        this._renderFilterOptions('Responsable', this._chantierFilters.allResponsables, this._chantierFilters.responsables);
        this._renderFilterOptions('Avancement', this._chantierFilters.allAvancements, this._chantierFilters.avancements);
        this._updateChantierFilterLabel('Perimetre');
        this._updateChantierFilterLabel('Responsable');
        this._updateChantierFilterLabel('Avancement');
    }

    /**
     * Attache les événements des filtres Chantier (dropdowns, Tous/Aucun)
     */
    _attachChantierFilterEvents() {
        ['Perimetre', 'Responsable', 'Avancement'].forEach(type => {
            const trigger = document.getElementById(`filterTrigger${type}`);
            const dropdown = document.getElementById(`filterDropdown${type}`);
            if (!trigger || !dropdown) return;

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('#chantierFilters .mae-filter-dropdown.open').forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });
                document.querySelectorAll('#chantierFilters .mae-filter-trigger.open').forEach(t => {
                    if (t !== trigger) t.classList.remove('open');
                });
                dropdown.classList.toggle('open');
                trigger.classList.toggle('open');
            });

            dropdown.querySelectorAll('.mae-filter-dropdown-actions button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = e.target.dataset.action;
                    const field = this._chantierFilterField(type);
                    const allValues = this._chantierFilters[`all${this._chantierFilterAllKey(type)}`];

                    if (action === 'all') {
                        this._chantierFilters[field] = new Set(allValues);
                    } else {
                        this._chantierFilters[field] = new Set();
                    }
                    this._updateChantierFilterCheckboxes(type);
                    this._updateChantierFilterLabel(type);
                    this._applyChantierFilters();
                });
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mae-filter-group')) {
                document.querySelectorAll('#chantierFilters .mae-filter-dropdown.open').forEach(d => d.classList.remove('open'));
                document.querySelectorAll('#chantierFilters .mae-filter-trigger.open').forEach(t => t.classList.remove('open'));
            }
        });
    }

    _chantierFilterField(type) {
        return type === 'Perimetre' ? 'perimetres' : type === 'Responsable' ? 'responsables' : 'avancements';
    }

    _chantierFilterAllKey(type) {
        return type === 'Perimetre' ? 'Perimetres' : type === 'Responsable' ? 'Responsables' : 'Avancements';
    }

    /**
     * Génère les options (checkboxes) d'un dropdown filtre Chantier
     * (Réutilise _renderFilterOptions qui est partagé avec DataAna)
     */

    /**
     * Met à jour l'état des checkboxes d'un dropdown Chantier
     */
    _updateChantierFilterCheckboxes(type) {
        const field = this._chantierFilterField(type);
        const container = document.getElementById(`filterOptions${type}`);
        if (!container) return;

        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = this._chantierFilters[field].has(cb.value);
        });
    }

    /**
     * Met à jour le libellé du filtre Chantier (trigger)
     */
    _updateChantierFilterLabel(type) {
        const field = this._chantierFilterField(type);
        const allKey = `all${this._chantierFilterAllKey(type)}`;
        const trigger = document.getElementById(`filterTrigger${type}`);
        if (!trigger) return;

        const textEl = trigger.querySelector('.filter-text');
        const selected = this._chantierFilters[field];
        const total = this._chantierFilters[allKey].length;

        if (selected.size === 0) {
            textEl.textContent = 'Aucun';
        } else if (selected.size === total) {
            textEl.textContent = 'Tous';
        } else if (selected.size <= 2) {
            textEl.textContent = [...selected].join(', ');
        } else {
            textEl.textContent = `${selected.size} / ${total}`;
        }
    }

    /**
     * Applique les filtres Chantier sur le DataTable
     */
    _applyChantierFilters() {
        if (this.dataTable) {
            this.dataTable.currentPage = 1;
            this.dataTable.applyFilters();
        }
    }

    // ── Fin Chantier Filters ──────────────────────────────────

    /**
     * Affiche le formulaire d'ajout
     */
    showAddForm() {
        // Utiliser la modale partagée pour les chantiers
        if (this.tableKey === 'CHANTIER' && typeof ChantierModal !== 'undefined') {
            ChantierModal.showAddModal(async () => {
                await this.refresh();
            });
            return;
        }

        showFormModal(
            `Ajouter - ${this.tableConfig.displayName}`,
            this.tableConfig.columns,
            async (formData) => {
                try {
                    await addTableRow(this.tableConfig.name, formData);
                    showSuccess('Élément ajouté avec succès');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de l\'ajout: ' + error.message);
                    return false;
                }
            }
        );
        // Note: loadDynamicSelectOptions est appelé par showFormModal
    }

    /**
     * Affiche le formulaire de modification
     */
    showEditForm(row, index) {
        // Utiliser la modale partagée pour les chantiers
        if (this.tableKey === 'CHANTIER' && typeof ChantierModal !== 'undefined') {
            const chantierName = row['Chantier'];
            ChantierModal.showEditModal(chantierName, async () => {
                await this.refresh();
            });
            return;
        }

        // Utiliser _rowIndex de la row (index Excel réel) plutôt que l'index du tableau affiché
        const rowIndex = row._rowIndex;

        showFormModal(
            `Modifier - ${this.tableConfig.displayName}`,
            this.tableConfig.columns,
            async (formData) => {
                try {
                    await updateTableRow(this.tableConfig.name, rowIndex, formData);
                    showSuccess('Élément modifié avec succès');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de la modification: ' + error.message);
                    return false;
                }
            },
            row
        );
        // Note: loadDynamicSelectOptions et setFormData sont appelés par showFormModal
    }

    /**
     * Confirme la suppression
     */
    confirmDelete(row, index) {
        const identifiant = row[this.tableConfig.columns[0]?.field] || `Ligne ${index + 1}`;
        // Utiliser _rowIndex de la row (index Excel réel) plutôt que l'index du tableau affiché
        const rowIndex = row._rowIndex;

        showConfirmModal(
            'Confirmer la suppression',
            `Êtes-vous sûr de vouloir supprimer "${identifiant}" ?`,
            async () => {
                try {
                    await deleteTableRow(this.tableConfig.name, rowIndex);
                    showSuccess('Élément supprimé avec succès');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de la suppression: ' + error.message);
                    return false;
                }
            },
            { confirmText: 'Supprimer' }
        );
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        if (this.dataTable) {
            await this.dataTable.refresh();
        }
    }

    /**
     * Détruit l'instance et libère la mémoire
     */
    destroy() {
        console.log('[Params] Destroying instance...');

        // Détruire l'instance Table si elle existe
        if (this.dataTable && typeof this.dataTable.destroy === 'function') {
            this.dataTable.destroy();
        }
        this.dataTable = null;

        // Nettoyer les filtres DataAna
        if (this._dataAnaFilters) {
            this._dataAnaFilters.etats.clear();
            this._dataAnaFilters.personnes.clear();
            this._dataAnaFilters.allEtats = [];
            this._dataAnaFilters.allPersonnes = [];
            this._dataAnaFilters = null;
        }

        // Nettoyer les filtres Chantier
        if (this._chantierFilters) {
            this._chantierFilters.perimetres.clear();
            this._chantierFilters.responsables.clear();
            this._chantierFilters.avancements.clear();
            this._chantierFilters.allPerimetres = [];
            this._chantierFilters.allResponsables = [];
            this._chantierFilters.allAvancements = [];
            this._chantierFilters = null;
        }

        // Réinitialiser la config
        this.tableConfig = null;

        console.log('[Params] Instance destroyed');
    }
}

// Instance courante
let currentParamsPage = null;

/**
 * Rendu d'une page de paramètres
 * @param {HTMLElement} container - Conteneur
 * @param {string} tableKey - Clé de la table dans CONFIG.TABLES
 * @returns {ParamsPage} Instance de la page
 */
async function renderParamsPage(container, tableKey) {
    currentParamsPage = new ParamsPage(tableKey);
    await currentParamsPage.render(container);
    return currentParamsPage;
}

/**
 * Rafraîchit la page de paramètres courante
 */
async function refreshParamsPage() {
    if (currentParamsPage) {
        await currentParamsPage.refresh();
    }
}
