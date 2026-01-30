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

        // Bouton Copie Jira
        const jiraButtonHtml = this.tableConfig.jiraSheet ? `
            <button id="btnCopyJira" class="btn btn-action btn-sm">
                <span>&#128230;</span> Copie Jira
            </button>
        ` : '';

        // Barre du haut : filtres (DataAna) ou toolbar simple
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

        const options = {
            tableName: this.tableConfig.name,
            tableConfig: this.tableConfig,
            columns: this.tableConfig.columns,
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

        // Attacher les événements des checkboxes
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const field = type === 'Etat' ? 'etats' : 'personnes';
                if (cb.checked) {
                    this._dataAnaFilters[field].add(cb.value);
                } else {
                    this._dataAnaFilters[field].delete(cb.value);
                }
                this._updateFilterLabel(type);
                this._applyDataAnaFilters();
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
}

// Instance courante
let currentParamsPage = null;

/**
 * Rendu d'une page de paramètres
 * @param {HTMLElement} container - Conteneur
 * @param {string} tableKey - Clé de la table dans CONFIG.TABLES
 */
async function renderParamsPage(container, tableKey) {
    currentParamsPage = new ParamsPage(tableKey);
    await currentParamsPage.render(container);
}

/**
 * Rafraîchit la page de paramètres courante
 */
async function refreshParamsPage() {
    if (currentParamsPage) {
        await currentParamsPage.refresh();
    }
}
