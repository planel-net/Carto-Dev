/* ===========================================
   MAE.JS - Page principale MAE
   Application Carto
   =========================================== */

let maePageInstance = null;

class MAEPage {
    constructor() {
        this.container = null;
        this.demandes = [];
        this.acteurs = [];
        this.notes = [];
        this.liens = [];

        this.filters = {
            perimetres: [],
            statuts: [],
            priorites: [],
            assignees: []
        };

        this.sort = {
            field: 'Start Date',
            direction: 'desc'
        };
    }

    // ---- Rendu principal ----

    async render(container) {
        this.container = container;
        container.innerHTML = '<div class="loading-overlay active"><div class="spinner spinner-lg"></div></div>';

        await this.loadData();

        container.innerHTML = `
            <div class="mae-page">
                <div id="maePipeline"></div>
                <div id="maeFilters"></div>
                <div id="maeActions"></div>
                <div id="maeTable"></div>
            </div>
        `;

        this.renderPipeline();
        this.renderFilters();
        this.renderActions();
        this.renderTable();
        this.attachEvents();
    }

    // ---- Chargement des donnees ----

    async loadData() {
        try {
            const [demandesData, acteursData, notesData, liensData] = await Promise.all([
                readTable('tMAE'),
                readTable('tActeurs'),
                readTable('tMAENote'),
                readTable('tMAELien')
            ]);

            this.demandes = demandesData.data || [];
            this.acteurs = acteursData.data || [];
            this.notes = notesData.data || [];
            this.liens = liensData.data || [];

            // Initialiser les filtres (tout selectionne par defaut)
            this._initFilters();
        } catch (error) {
            console.error('Erreur chargement données MAE:', error);
            showError('Erreur lors du chargement des données MAE');
        }
    }

    _initFilters() {
        // Perimetres : extraits des donnees
        const perimSet = new Set();
        this.demandes.forEach(d => {
            if (d['Périmètre - MAE']) perimSet.add(d['Périmètre - MAE']);
        });
        const allPerimetres = [...perimSet].sort();
        if (this.demandes.some(d => !d['Périmètre - MAE'])) {
            allPerimetres.push(CONFIG.EMPTY_FILTER_VALUE);
        }

        // Statuts : config + valeurs réelles des données
        const statutSet = new Set(CONFIG.MAE_STATUTS.map(s => s.value));
        this.demandes.forEach(d => {
            if (d['État']) statutSet.add(d['État']);
        });
        const allStatuts = [...statutSet];

        // Priorites : extraites des donnees (texte libre)
        const prioSet = new Set();
        this.demandes.forEach(d => {
            if (d['Priorité']) prioSet.add(d['Priorité']);
        });
        const allPriorites = [...prioSet].sort();
        if (this.demandes.some(d => !d['Priorité'])) {
            allPriorites.push(CONFIG.EMPTY_FILTER_VALUE);
        }

        // Personnes assignees : extraites des donnees (texte libre)
        const assigneeSet = new Set();
        this.demandes.forEach(d => {
            if (d['Personne assignée']) assigneeSet.add(d['Personne assignée']);
        });
        const allAssignees = [...assigneeSet].sort();
        if (this.demandes.some(d => !d['Personne assignée'])) {
            allAssignees.push(CONFIG.EMPTY_FILTER_VALUE);
        }

        this.filters.perimetres = [...allPerimetres];
        this.filters.statuts = [...allStatuts];
        this.filters.priorites = [...allPriorites];
        this.filters.assignees = [...allAssignees];

        this._allPerimetres = allPerimetres;
        this._allStatuts = allStatuts;
        this._allPriorites = allPriorites;
        this._allAssignees = allAssignees;
    }

    // ---- Utilitaires ----

    _parseDate(dateValue) {
        if (!dateValue) return new Date(0);
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'number') {
            return new Date((dateValue - 25569) * 86400 * 1000);
        }
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    }

    _formatDate(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    _normalizeStatut(statut) {
        if (!statut) return '';
        const lower = statut.toLowerCase().trim();
        for (const s of CONFIG.MAE_STATUTS) {
            if (s.value.toLowerCase() === lower) return s.value;
        }
        return statut;
    }

    _getStatusBadgeClass(statut) {
        const normalized = (statut || '').toLowerCase().trim();
        if (normalized.includes('faire')) return 'a-faire';
        if (normalized.includes('cours')) return 'en-cours';
        if (normalized.includes('livr')) return 'livre';
        if (normalized.includes('valid')) return 'valide';
        return 'a-faire';
    }

    // ---- Pipeline / Processus visuel ----

    renderPipeline() {
        const container = document.getElementById('maePipeline');
        if (!container) return;

        const counts = {};
        CONFIG.MAE_STATUTS.forEach(s => { counts[s.value] = 0; });
        this.demandes.forEach(d => {
            const statut = this._normalizeStatut(d['État']) || CONFIG.MAE_STATUTS[0].value;
            if (counts[statut] !== undefined) {
                counts[statut]++;
            }
        });

        container.innerHTML = `
            <div class="mae-pipeline">
                ${CONFIG.MAE_STATUTS.map((step, i) => `
                    ${i > 0 ? '<div class="mae-pipeline-arrow">&#9654;</div>' : ''}
                    <div class="mae-pipeline-step ${counts[step.value] > 0 ? 'current' : ''}">
                        <div class="mae-pipeline-step-box">
                            <span class="step-label">${escapeHtml(step.label)}</span>
                            <span class="step-count">${counts[step.value]}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ---- Filtres ----

    renderFilters() {
        const container = document.getElementById('maeFilters');
        if (!container) return;

        container.innerHTML = `
            <div class="mae-filters">
                <!-- Filtre Perimetre -->
                <div class="mae-filter-group" data-filter="perimetre">
                    <label>Périmètre</label>
                    <div class="mae-filter-trigger" onclick="maePageInstance.toggleFilter('perimetre')">
                        <span id="maeFilterPerimetreLabel">${this._getFilterLabel('perimetre')}</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mae-filter-dropdown" id="maeFilterPerimetreDropdown">
                        <div class="mae-filter-dropdown-actions">
                            <button onclick="maePageInstance.selectAll('perimetre')">Tout</button>
                            <button onclick="maePageInstance.clearFilter('perimetre')">Aucun</button>
                        </div>
                        ${this._allPerimetres.map(p => `
                            <label class="mae-filter-option">
                                <input type="checkbox" value="${escapeHtml(p)}" ${this.filters.perimetres.includes(p) ? 'checked' : ''} onchange="maePageInstance.onFilterChange('perimetre')">
                                <span>${escapeHtml(p)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <!-- Filtre Etat -->
                <div class="mae-filter-group" data-filter="statut">
                    <label>État</label>
                    <div class="mae-filter-trigger" onclick="maePageInstance.toggleFilter('statut')">
                        <span id="maeFilterStatutLabel">${this._getFilterLabel('statut')}</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mae-filter-dropdown" id="maeFilterStatutDropdown">
                        <div class="mae-filter-dropdown-actions">
                            <button onclick="maePageInstance.selectAll('statut')">Tout</button>
                            <button onclick="maePageInstance.clearFilter('statut')">Aucun</button>
                        </div>
                        ${this._allStatuts.map(s => `
                            <label class="mae-filter-option">
                                <input type="checkbox" value="${escapeHtml(s)}" ${this.filters.statuts.includes(s) ? 'checked' : ''} onchange="maePageInstance.onFilterChange('statut')">
                                <span>${escapeHtml(s)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <!-- Filtre Priorite -->
                <div class="mae-filter-group" data-filter="priorite">
                    <label>Priorité</label>
                    <div class="mae-filter-trigger" onclick="maePageInstance.toggleFilter('priorite')">
                        <span id="maeFilterPrioriteLabel">${this._getFilterLabel('priorite')}</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mae-filter-dropdown" id="maeFilterPrioriteDropdown">
                        <div class="mae-filter-dropdown-actions">
                            <button onclick="maePageInstance.selectAll('priorite')">Tout</button>
                            <button onclick="maePageInstance.clearFilter('priorite')">Aucun</button>
                        </div>
                        ${this._allPriorites.map(p => `
                            <label class="mae-filter-option">
                                <input type="checkbox" value="${escapeHtml(p)}" ${this.filters.priorites.includes(p) ? 'checked' : ''} onchange="maePageInstance.onFilterChange('priorite')">
                                <span>${escapeHtml(p)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <!-- Filtre Personne assignee -->
                <div class="mae-filter-group" data-filter="assignee">
                    <label>Personne assignée</label>
                    <div class="mae-filter-trigger" onclick="maePageInstance.toggleFilter('assignee')">
                        <span id="maeFilterAssigneeLabel">${this._getFilterLabel('assignee')}</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mae-filter-dropdown" id="maeFilterAssigneeDropdown">
                        <div class="mae-filter-dropdown-actions">
                            <button onclick="maePageInstance.selectAll('assignee')">Tout</button>
                            <button onclick="maePageInstance.clearFilter('assignee')">Aucun</button>
                        </div>
                        ${this._allAssignees.map(a => `
                            <label class="mae-filter-option">
                                <input type="checkbox" value="${escapeHtml(a)}" ${this.filters.assignees.includes(a) ? 'checked' : ''} onchange="maePageInstance.onFilterChange('assignee')">
                                <span>${escapeHtml(a)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="mae-filters-actions">
                    <button class="btn btn-secondary btn-sm" onclick="maePageInstance.resetFilters()">Réinitialiser</button>
                </div>
            </div>
        `;
    }

    _getFilterLabel(filterType) {
        const map = {
            perimetre: { all: this._allPerimetres, selected: this.filters.perimetres },
            statut: { all: this._allStatuts, selected: this.filters.statuts },
            priorite: { all: this._allPriorites, selected: this.filters.priorites },
            assignee: { all: this._allAssignees, selected: this.filters.assignees }
        };
        const { all, selected } = map[filterType];
        if (!all || all.length === 0) return 'Aucun';
        if (selected.length === all.length) return 'Tous';
        if (selected.length === 0) return 'Aucun';
        if (selected.length === 1) return selected[0];
        return `${selected.length} sélectionnés`;
    }

    toggleFilter(filterType) {
        const dropdownId = `maeFilter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Dropdown`;
        const dropdown = document.getElementById(dropdownId);

        // Fermer tous les autres
        document.querySelectorAll('.mae-filter-dropdown.open').forEach(d => {
            if (d.id !== dropdownId) d.classList.remove('open');
        });
        document.querySelectorAll('.mae-filter-trigger.open').forEach(t => {
            if (!t.closest(`[data-filter="${filterType}"]`)) t.classList.remove('open');
        });

        if (dropdown) {
            dropdown.classList.toggle('open');
            const trigger = dropdown.previousElementSibling;
            if (trigger) trigger.classList.toggle('open');
        }
    }

    onFilterChange(filterType) {
        const dropdownId = `maeFilter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Dropdown`;
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const checked = dropdown.querySelectorAll('input[type="checkbox"]:checked');
        const values = Array.from(checked).map(cb => cb.value);

        switch (filterType) {
            case 'perimetre': this.filters.perimetres = values; break;
            case 'statut': this.filters.statuts = values; break;
            case 'priorite': this.filters.priorites = values; break;
            case 'assignee': this.filters.assignees = values; break;
        }

        this._updateFilterLabel(filterType);
        this.renderPipeline();
        this.renderTable();
    }

    selectAll(filterType) {
        switch (filterType) {
            case 'perimetre': this.filters.perimetres = [...this._allPerimetres]; break;
            case 'statut': this.filters.statuts = [...this._allStatuts]; break;
            case 'priorite': this.filters.priorites = [...this._allPriorites]; break;
            case 'assignee': this.filters.assignees = [...this._allAssignees]; break;
        }
        this._recheckFilterCheckboxes(filterType);
        this._updateFilterLabel(filterType);
        this.renderPipeline();
        this.renderTable();
    }

    clearFilter(filterType) {
        switch (filterType) {
            case 'perimetre': this.filters.perimetres = []; break;
            case 'statut': this.filters.statuts = []; break;
            case 'priorite': this.filters.priorites = []; break;
            case 'assignee': this.filters.assignees = []; break;
        }
        this._recheckFilterCheckboxes(filterType);
        this._updateFilterLabel(filterType);
        this.renderPipeline();
        this.renderTable();
    }

    _recheckFilterCheckboxes(filterType) {
        const dropdownId = `maeFilter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Dropdown`;
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const map = {
            perimetre: this.filters.perimetres,
            statut: this.filters.statuts,
            priorite: this.filters.priorites,
            assignee: this.filters.assignees
        };

        dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = map[filterType].includes(cb.value);
        });
    }

    _updateFilterLabel(filterType) {
        const labelId = `maeFilter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Label`;
        const label = document.getElementById(labelId);
        if (label) {
            label.textContent = this._getFilterLabel(filterType);
        }
    }

    resetFilters() {
        this.filters.perimetres = [...this._allPerimetres];
        this.filters.statuts = [...this._allStatuts];
        this.filters.priorites = [...this._allPriorites];
        this.filters.assignees = [...this._allAssignees];

        ['perimetre', 'statut', 'priorite', 'assignee'].forEach(f => {
            this._recheckFilterCheckboxes(f);
            this._updateFilterLabel(f);
        });

        this.renderPipeline();
        this.renderTable();
    }

    // ---- Boutons d'action ----

    renderActions() {
        const container = document.getElementById('maeActions');
        if (!container) return;

        container.innerHTML = `
            <div class="mae-actions">
                <span class="mae-result-count" id="maeResultCount"></span>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-action btn-sm" id="btnMaeCopyJira">
                        <span>&#128230;</span> Copie Jira
                    </button>
                    <button class="btn btn-action" onclick="maePageInstance.addDemande()">
                        + Nouvelle demande
                    </button>
                </div>
            </div>
        `;

        const btnCopyJira = document.getElementById('btnMaeCopyJira');
        if (btnCopyJira) {
            btnCopyJira.addEventListener('click', () => this.handleCopyFromJira());
        }
    }

    // ---- Copie Jira ----

    async handleCopyFromJira() {
        const jiraSheet = CONFIG.TABLES.MAE.jiraSheet;
        const tableName = CONFIG.TABLES.MAE.name;
        const keyField = 'Clé';

        const confirmMessage = `Voulez-vous synchroniser les données depuis la feuille "${jiraSheet}" ?\n\n` +
            `• Nouveaux éléments ajoutés\n` +
            `• Champs Jira mis à jour pour les éléments existants`;

        showConfirmModal(
            'Copie Jira MAE',
            confirmMessage,
            async () => {
                try {
                    const options = {
                        updateFields: [
                            'Résumé', 'Périmètre - MAE', 'Rapporteur', 'Start Date',
                            'Date souhaitée de livraison', 'Priorité', 'Description',
                            'État', 'Personne assignée', 'Date d\'échéance',
                            'Parent', 'Thème'
                        ]
                    };

                    const result = await copyFromJira(jiraSheet, tableName, keyField, options);

                    if (result && result.success) {
                        showSuccess(result.message || 'Synchronisation terminée');
                        await this.refresh();
                    } else {
                        showError((result && result.message) || 'Erreur lors de la synchronisation');
                    }
                } catch (error) {
                    console.error('Erreur Copie Jira MAE:', error);
                    showError('Erreur lors de la synchronisation Jira');
                }
            },
            { confirmText: 'Synchroniser', cancelText: 'Annuler' }
        );
    }

    // ---- Filtrage des demandes ----

    _getFilteredDemandes() {
        return this.demandes.filter(d => {
            const perimetre = d['Périmètre - MAE'] || CONFIG.EMPTY_FILTER_VALUE;
            const statut = d['État'] || 'À FAIRE';
            const priorite = d['Priorité'] || CONFIG.EMPTY_FILTER_VALUE;
            const assignee = d['Personne assignée'] || CONFIG.EMPTY_FILTER_VALUE;

            if (!this.filters.perimetres.includes(perimetre)) return false;
            if (!this.filters.statuts.includes(statut)) return false;
            if (!this.filters.priorites.includes(priorite)) return false;
            if (!this.filters.assignees.includes(assignee)) return false;

            return true;
        });
    }

    // ---- Tri ----

    _sortDemandes(demandes) {
        const field = this.sort.field;
        const dir = this.sort.direction === 'asc' ? 1 : -1;

        return [...demandes].sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            // Dates
            if (field.includes('Date') || field === 'Start Date') {
                const dA = this._parseDate(valA);
                const dB = this._parseDate(valB);
                return (dA - dB) * dir;
            }

            // Nombres
            if (field.startsWith('JH')) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
                return (valA - valB) * dir;
            }

            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
            return valA.localeCompare(valB) * dir;
        });
    }

    onSort(field) {
        if (this.sort.field === field) {
            this.sort.direction = this.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sort.field = field;
            this.sort.direction = 'asc';
        }
        this.renderTable();
    }

    // ---- Tableau ----

    renderTable() {
        const container = document.getElementById('maeTable');
        if (!container) return;

        const filtered = this._getFilteredDemandes();
        const sorted = this._sortDemandes(filtered);

        // Mise a jour du compteur
        const countEl = document.getElementById('maeResultCount');
        if (countEl) {
            countEl.textContent = `${sorted.length} demande${sorted.length > 1 ? 's' : ''}`;
        }

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="mae-table-container">
                    <div class="mae-empty-state">
                        <div class="mae-empty-state-icon">&#128203;</div>
                        <div class="mae-empty-state-text">Aucune demande</div>
                    </div>
                </div>
            `;
            return;
        }

        const columns = [
            { field: 'Clé', label: 'Clé' },
            { field: 'Résumé', label: 'Résumé' },
            { field: 'Périmètre - MAE', label: 'Périmètre' },
            { field: 'Rapporteur', label: 'Rapporteur' },
            { field: 'État', label: 'État' },
            { field: 'Priorité', label: 'Priorité' },
            { field: 'Personne assignée', label: 'Personne assignée' }
        ];

        container.innerHTML = `
            <div class="mae-table-container">
                <table class="mae-table">
                    <thead>
                        <tr>
                            ${columns.map(col => {
                                const isSorted = this.sort.field === col.field;
                                const icon = isSorted ? (this.sort.direction === 'asc' ? '&#9650;' : '&#9660;') : '&#8693;';
                                return `
                                    <th class="${isSorted ? 'sorted' : ''}" onclick="maePageInstance.onSort('${col.field}')">
                                        ${escapeHtml(col.label)}
                                        <span class="sort-icon">${icon}</span>
                                    </th>
                                `;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(d => {
                            const statut = d['État'] || 'À FAIRE';
                            return `
                                <tr onclick="maePageInstance.openDemande('${escapeJsString(d['Clé'])}')">
                                    <td><strong>${escapeHtml(d['Clé'] || '')}</strong></td>
                                    <td>${escapeHtml(d['Résumé'] || '')}</td>
                                    <td>${escapeHtml(d['Périmètre - MAE'] || '')}</td>
                                    <td>${escapeHtml(d['Rapporteur'] || '')}</td>
                                    <td><span class="mae-status-badge ${this._getStatusBadgeClass(statut)}">${escapeHtml(statut)}</span></td>
                                    <td>${escapeHtml(d['Priorité'] || '')}</td>
                                    <td>${escapeHtml(d['Personne assignée'] || '')}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // ---- Evenements ----

    attachEvents() {
        // Fermer les dropdowns au clic exterieur
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mae-filter-group')) {
                document.querySelectorAll('.mae-filter-dropdown.open').forEach(d => d.classList.remove('open'));
                document.querySelectorAll('.mae-filter-trigger.open').forEach(t => t.classList.remove('open'));
            }
        });
    }

    // ---- Actions ----

    addDemande() {
        MAEModal.showAddModal(async () => {
            await this.refresh();
        });
    }

    openDemande(cle) {
        MAEModal.showEditModal(cle, async () => {
            await this.refresh();
        });
    }

    // ---- Refresh ----

    async refresh() {
        await this.loadData();
        this.renderPipeline();
        this.renderFilters();
        this.renderTable();
    }
}

// ---- Fonctions globales ----

async function renderMAEPage(container) {
    maePageInstance = new MAEPage();
    await maePageInstance.render(container);
}

async function refreshMAEPage() {
    if (maePageInstance) {
        await maePageInstance.refresh();
    }
}
