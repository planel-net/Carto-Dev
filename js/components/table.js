/* ===========================================
   TABLE.JS - Composant tableau CRUD
   Application Carto
   =========================================== */

/**
 * Classe DataTable pour afficher et gérer des données tabulaires
 */
class DataTable {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.getElementById(container) : container;
        this.tableName = options.tableName;
        this.tableConfig = options.tableConfig || CONFIG.TABLES[options.tableKey];
        this.columns = options.columns || this.tableConfig?.columns || [];
        this.data = [];
        this.filteredData = [];
        this.selectedRows = new Set();
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.currentPage = 1;
        this.pageSize = options.pageSize || CONFIG.PAGINATION.DEFAULT_PAGE_SIZE;
        this.searchTerm = '';

        // Callbacks
        this.onRowClick = options.onRowClick || null;
        this.onEdit = options.onEdit || null;
        this.onDelete = options.onDelete || null;
        this.onAdd = options.onAdd || null;
        this.onRefresh = options.onRefresh || null;

        // Options d'affichage
        this.showToolbar = options.showToolbar !== false;
        this.showPagination = options.showPagination !== false;
        this.showActions = options.showActions !== false;
        this.showCheckboxes = options.showCheckboxes || false;
        this.editable = options.editable !== false;

        this.init();
    }

    /**
     * Initialise le tableau
     */
    async init() {
        this.render();
        await this.loadData();
    }

    /**
     * Rendu du tableau
     */
    render() {
        this.container.innerHTML = `
            <div class="data-table-container">
                ${this.showToolbar ? this.renderToolbar() : ''}
                <div class="data-table-wrapper">
                    <table class="data-table" id="${this.tableName}_table">
                        <thead></thead>
                        <tbody></tbody>
                    </table>
                </div>
                ${this.showPagination ? this.renderPagination() : ''}
            </div>
        `;

        this.attachEvents();
    }

    /**
     * Rendu de la toolbar
     */
    renderToolbar() {
        return `
            <div class="table-toolbar">
                <div class="table-toolbar-left">
                    <div class="table-search">
                        <span class="search-icon">&#128269;</span>
                        <input type="text" class="form-control" placeholder="Rechercher..." id="${this.tableName}_search">
                    </div>
                </div>
                <div class="table-toolbar-right">
                    ${this.editable ? `
                    <button class="btn btn-primary btn-sm" id="${this.tableName}_add">
                        <span>+</span> Ajouter
                    </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" id="${this.tableName}_refresh">
                        <span>&#8635;</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Rendu de la pagination
     */
    renderPagination() {
        return `
            <div class="table-footer">
                <div class="table-info">
                    <span class="table-count"></span>
                    <div class="table-page-size">
                        <span>Afficher</span>
                        <select id="${this.tableName}_pageSize">
                            ${CONFIG.PAGINATION.PAGE_SIZE_OPTIONS.map(size =>
                                `<option value="${size}" ${size === this.pageSize ? 'selected' : ''}>${size}</option>`
                            ).join('')}
                        </select>
                        <span>lignes</span>
                    </div>
                </div>
                <div class="pagination" id="${this.tableName}_pagination"></div>
            </div>
        `;
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        // Recherche
        const searchInput = document.getElementById(`${this.tableName}_search`);
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                this.searchTerm = e.target.value;
                this.currentPage = 1;
                this.applyFilters();
            }, 300));
        }

        // Bouton ajouter
        const addBtn = document.getElementById(`${this.tableName}_add`);
        if (addBtn) {
            addBtn.addEventListener('click', () => this.handleAdd());
        }

        // Bouton refresh
        const refreshBtn = document.getElementById(`${this.tableName}_refresh`);
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }

        // Page size
        const pageSizeSelect = document.getElementById(`${this.tableName}_pageSize`);
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt(e.target.value);
                this.currentPage = 1;
                this.renderTable();
            });
        }
    }

    /**
     * Charge les données depuis Excel
     */
    async loadData() {
        try {
            this.showLoading(true);
            const result = await readTable(this.tableName);
            this.data = result.data;
            this.applyFilters();
        } catch (error) {
            console.error('Erreur chargement données:', error);
            showError('Erreur lors du chargement des données');
            this.data = [];
            this.filteredData = [];
            this.renderTable();
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Applique les filtres et tri
     */
    applyFilters() {
        // Filtrer par recherche
        this.filteredData = this.searchTerm
            ? searchFilter(this.data, this.searchTerm, this.columns.map(c => c.field))
            : [...this.data];

        // Trier
        if (this.sortColumn) {
            this.filteredData = sortBy(this.filteredData, this.sortColumn, this.sortDirection);
        }

        this.renderTable();
    }

    /**
     * Rendu du tableau avec les données
     */
    /**
     * Retourne les colonnes visibles (exclut les colonnes hidden)
     */
    getVisibleColumns() {
        return this.columns.filter(col => !col.hidden);
    }

    renderTable() {
        const thead = this.container.querySelector('thead');
        const tbody = this.container.querySelector('tbody');
        const visibleColumns = this.getVisibleColumns();

        // Header
        thead.innerHTML = `
            <tr>
                ${this.showCheckboxes ? '<th class="col-checkbox"><input type="checkbox" id="selectAll"></th>' : ''}
                ${visibleColumns.map(col => `
                    <th class="sortable" data-field="${col.field}">
                        ${escapeHtml(col.label)}
                        <span class="sort-icon">${this.getSortIcon(col.field)}</span>
                    </th>
                `).join('')}
                ${this.showActions ? '<th class="col-actions">Actions</th>' : ''}
            </tr>
        `;

        // Pagination
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        // Body
        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${visibleColumns.length + (this.showCheckboxes ? 1 : 0) + (this.showActions ? 1 : 0)}">
                        <div class="table-empty">
                            <div class="table-empty-icon">&#128194;</div>
                            <div class="table-empty-title">Aucune donnée</div>
                            <div class="table-empty-description">
                                ${this.searchTerm ? 'Aucun résultat pour cette recherche.' : 'Cette table est vide.'}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = pageData.map((row, index) => this.renderRow(row, startIndex + index)).join('');
        }

        // Mettre à jour la pagination
        this.updatePagination();

        // Attacher les événements du tableau
        this.attachTableEvents();
    }

    /**
     * Rendu d'une ligne
     */
    renderRow(row, index) {
        const rowIndex = row._rowIndex !== undefined ? row._rowIndex : index;
        const visibleColumns = this.getVisibleColumns();

        return `
            <tr data-index="${rowIndex}">
                ${this.showCheckboxes ? `
                    <td class="col-checkbox">
                        <input type="checkbox" class="row-checkbox" data-index="${rowIndex}">
                    </td>
                ` : ''}
                ${visibleColumns.map(col => `
                    <td class="${col.type === 'number' ? 'col-number' : ''} ${this.getCellClass(col, row[col.field])}">
                        ${this.formatCellValue(col, row[col.field], row)}
                    </td>
                `).join('')}
                ${this.showActions ? `
                    <td class="col-actions">
                        <div class="row-actions">
                            <button class="row-action-btn view" title="Voir" data-action="view" data-index="${rowIndex}">
                                &#128065;
                            </button>
                            ${this.editable ? `
                            <button class="row-action-btn edit" title="Modifier" data-action="edit" data-index="${rowIndex}">
                                &#9998;
                            </button>
                            <button class="row-action-btn delete" title="Supprimer" data-action="delete" data-index="${rowIndex}">
                                &#128465;
                            </button>
                            ` : ''}
                        </div>
                    </td>
                ` : ''}
            </tr>
        `;
    }

    /**
     * Formate la valeur d'une cellule
     * @param {Object} col - Configuration de la colonne
     * @param {*} value - Valeur de la cellule
     * @param {Object} row - Ligne complète (pour accéder au linkField si nécessaire)
     */
    formatCellValue(col, value, row = null) {
        if (value === null || value === undefined || value === '') {
            return '<span class="text-muted">-</span>';
        }

        // Formatage special pour les acteurs (Responsable, Backup, etc.)
        if (col.source === 'ACTEURS' || col.field === 'Responsable' || col.field === 'Backup' || col.field === 'Acteur') {
            const formattedName = formatActorNameSync(value);
            return `<span title="${escapeHtml(String(value))}">${escapeHtml(formattedName)}</span>`;
        }

        // Si la colonne a un linkField, afficher comme lien cliquable
        if (col.linkField && row && row[col.linkField]) {
            const url = row[col.linkField];
            const text = String(value);
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="table-link" title="Ouvrir dans Jira">${escapeHtml(text)}</a>`;
        }

        switch (col.type) {
            case 'date':
                return formatDate(value);
            case 'number':
                return formatNumber(value);
            case 'url':
                // Afficher les URLs comme liens cliquables
                const urlText = String(value);
                if (urlText.startsWith('http')) {
                    return `<a href="${escapeHtml(urlText)}" target="_blank" rel="noopener noreferrer" class="table-link">&#128279; Lien</a>`;
                }
                return escapeHtml(urlText);
            case 'select':
                if (col.field.toLowerCase().includes('statut') || col.field.toLowerCase().includes('migr')) {
                    return `<span class="badge ${getMigrationStatusClass(value)}">${escapeHtml(String(value))}</span>`;
                }
                return escapeHtml(String(value));
            default:
                const text = String(value);
                return text.length > 50 ? `<span title="${escapeHtml(text)}">${escapeHtml(truncateText(text, 50))}</span>` : escapeHtml(text);
        }
    }

    /**
     * Retourne la classe CSS pour une cellule
     */
    getCellClass(col, value) {
        if (col.type === 'select' && (col.field.toLowerCase().includes('statut') || col.field.toLowerCase().includes('migr'))) {
            return 'col-status';
        }
        if (col.type === 'date') {
            return 'col-date';
        }
        return '';
    }

    /**
     * Retourne l'icône de tri
     */
    getSortIcon(field) {
        if (this.sortColumn !== field) return '&#8597;';
        return this.sortDirection === 'asc' ? '&#8593;' : '&#8595;';
    }

    /**
     * Met à jour la pagination
     */
    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        const countEl = this.container.querySelector('.table-count');
        const paginationEl = document.getElementById(`${this.tableName}_pagination`);

        // Compteur
        if (countEl) {
            const start = (this.currentPage - 1) * this.pageSize + 1;
            const end = Math.min(this.currentPage * this.pageSize, this.filteredData.length);
            countEl.textContent = `${start}-${end} sur ${this.filteredData.length}`;
        }

        // Pagination
        if (paginationEl && totalPages > 1) {
            let html = '';

            // Bouton précédent
            html += `<button class="pagination-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>&#8592;</button>`;

            // Pages
            const maxVisiblePages = 5;
            let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }

            if (startPage > 1) {
                html += `<button class="pagination-btn" data-page="1">1</button>`;
                if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
            }

            for (let i = startPage; i <= endPage; i++) {
                html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
                html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
            }

            // Bouton suivant
            html += `<button class="pagination-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>&#8594;</button>`;

            paginationEl.innerHTML = html;

            // Événements pagination
            paginationEl.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = parseInt(btn.dataset.page);
                    if (page && page !== this.currentPage) {
                        this.currentPage = page;
                        this.renderTable();
                    }
                });
            });
        } else if (paginationEl) {
            paginationEl.innerHTML = '';
        }
    }

    /**
     * Attache les événements du tableau
     */
    attachTableEvents() {
        // Tri
        this.container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.field;
                if (this.sortColumn === field) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = field;
                    this.sortDirection = 'asc';
                }
                this.applyFilters();
            });
        });

        // Actions de ligne
        this.container.querySelectorAll('.row-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);
                const row = this.data.find(r => (r._rowIndex - 2) === index) || this.data[index];

                switch (action) {
                    case 'view':
                        this.handleView(row, index);
                        break;
                    case 'edit':
                        this.handleEdit(row, index);
                        break;
                    case 'delete':
                        this.handleDelete(row, index);
                        break;
                }
            });
        });

        // Clic sur ligne
        if (this.onRowClick) {
            this.container.querySelectorAll('tbody tr').forEach(tr => {
                tr.addEventListener('click', () => {
                    const index = parseInt(tr.dataset.index);
                    const row = this.data.find(r => (r._rowIndex - 2) === index) || this.data[index];
                    this.onRowClick(row, index);
                });
            });
        }
    }

    /**
     * Gère l'ajout d'une ligne
     */
    handleAdd() {
        if (this.onAdd) {
            this.onAdd();
        } else {
            showFormModal(
                `Ajouter - ${this.tableConfig?.displayName || this.tableName}`,
                this.columns,
                async (formData) => {
                    try {
                        await addTableRow(this.tableName, formData);
                        showSuccess('Élément ajouté avec succès');
                        await this.refresh();
                        return true;
                    } catch (error) {
                        showError('Erreur lors de l\'ajout: ' + error.message);
                        return false;
                    }
                }
            );
        }
    }

    /**
     * Gère la visualisation
     */
    handleView(row, index) {
        const content = `
            <div class="view-details">
                ${this.columns.map(col => `
                    <div class="detail-item" style="margin-bottom: 12px;">
                        <strong>${escapeHtml(col.label)}:</strong>
                        <span style="margin-left: 8px;">${this.formatCellValue(col, row[col.field])}</span>
                    </div>
                `).join('')}
            </div>
        `;

        showViewModal(`Détails - ${this.tableConfig?.displayName || this.tableName}`, content);
    }

    /**
     * Gère la modification
     */
    handleEdit(row, index) {
        if (this.onEdit) {
            this.onEdit(row, index);
        } else {
            // Utiliser _rowIndex de la row (index Excel réel) plutôt que l'index du tableau affiché
            const rowIndex = row._rowIndex;

            showFormModal(
                `Modifier - ${this.tableConfig?.displayName || this.tableName}`,
                this.columns,
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
        }
    }

    /**
     * Gère la suppression
     */
    handleDelete(row, index) {
        if (this.onDelete) {
            this.onDelete(row, index);
        } else {
            // Récupérer un identifiant pour l'affichage
            const firstCol = this.columns[0]?.field;
            const identifier = firstCol ? row[firstCol] : 'cet élément';
            // Utiliser _rowIndex de la row (index Excel réel) plutôt que l'index du tableau affiché
            const rowIndex = row._rowIndex;

            showConfirmModal(
                'Confirmer la suppression',
                `Êtes-vous sûr de vouloir supprimer "${identifier}" ?`,
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
    }

    /**
     * Rafraîchit les données
     */
    async refresh() {
        invalidateCache(this.tableName);
        await this.loadData();
        if (this.onRefresh) this.onRefresh();
    }

    /**
     * Affiche/masque le loader
     */
    showLoading(show) {
        const wrapper = this.container.querySelector('.data-table-wrapper');
        if (wrapper) {
            wrapper.classList.toggle('table-loading', show);
        }
    }

    /**
     * Retourne les données filtrées
     */
    getData() {
        return this.filteredData;
    }

    /**
     * Retourne les lignes sélectionnées
     */
    getSelectedRows() {
        return Array.from(this.selectedRows).map(index => this.data[index]);
    }
}
