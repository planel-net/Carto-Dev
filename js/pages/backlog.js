/* ===========================================
   BACKLOG.JS - Page de gestion du Backlog
   Application Carto

   Features:
   - CRUD complet
   - Filtres par colonne
   - Recherche globale
   - Tri par colonne
   - Numérotation automatique AAAA-MM-num
   =========================================== */

/**
 * Classe BacklogPage pour gérer la page backlog
 */
class BacklogPage {
    constructor() {
        this.tableConfig = CONFIG.TABLES.BACKLOGS;
        this.data = [];
        this.filteredData = [];
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchTerm = '';
        this.columnFilters = {};
        this.currentPage = 1;
        this.pageSize = CONFIG.PAGINATION.DEFAULT_PAGE_SIZE;
        this.perimetres = [];
        this.acteurs = [];
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>${this.tableConfig.icon || ''} ${this.tableConfig.displayName}</h1>
                    <p>Gestion du backlog avec filtres et tri</p>
                </div>
                <div class="page-header-right">
                    <button id="btnAddBacklog" class="btn btn-action">
                        <span>&#43;</span> Ajouter
                    </button>
                </div>
            </div>

            <section class="section">
                <!-- Barre de recherche globale -->
                <div class="backlog-toolbar">
                    <div class="search-box">
                        <input type="text" id="searchInput" class="form-control"
                               placeholder="Rechercher dans tous les champs..." />
                    </div>
                    <div class="toolbar-actions">
                        <button id="btnClearFilters" class="btn btn-secondary btn-sm">
                            <span>&#10005;</span> Effacer les filtres
                        </button>
                    </div>
                </div>

                <!-- Tableau avec filtres -->
                <div class="backlog-table-container">
                    <table class="backlog-table" id="backlogTable">
                        <thead>
                            <tr class="header-row" id="headerRow"></tr>
                            <tr class="filter-row" id="filterRow"></tr>
                        </thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div class="pagination-container" id="paginationContainer"></div>
            </section>
        `;

        // Charger les donnees de reference
        await this.loadReferenceData();

        // Charger et afficher les donnees
        await this.loadData();

        // Attacher les evenements
        this.attachEvents();
    }

    /**
     * Charge les donnees de reference (perimetres, acteurs)
     */
    async loadReferenceData() {
        try {
            const [perimetresData, acteursData] = await Promise.all([
                readTable('tPerimetres'),
                readTable('tActeurs')
            ]);
            this.perimetres = perimetresData.data || [];
            this.acteurs = acteursData.data || [];
        } catch (error) {
            console.error('Erreur chargement donnees reference:', error);
            this.perimetres = [];
            this.acteurs = [];
        }
    }

    /**
     * Charge les donnees du backlog
     */
    async loadData() {
        try {
            const result = await readTable(this.tableConfig.name);
            this.data = result.data || [];
            this.applyFilters();
            this.renderTable();
        } catch (error) {
            console.error('Erreur chargement backlog:', error);
            showError('Erreur lors du chargement du backlog');
        }
    }

    /**
     * Applique les filtres et le tri
     */
    applyFilters() {
        let filtered = [...this.data];

        // Filtre de recherche globale
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(row => {
                return this.tableConfig.columns.some(col => {
                    const value = row[col.field];
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(term);
                });
            });
        }

        // Filtres par colonne
        Object.keys(this.columnFilters).forEach(field => {
            const filterValue = this.columnFilters[field];
            if (filterValue && filterValue !== '') {
                filtered = filtered.filter(row => {
                    const value = row[field];
                    if (value === null || value === undefined) return filterValue === '(Vide)';
                    if (filterValue === '(Vide)') return !value || value === '';
                    return String(value).toLowerCase().includes(filterValue.toLowerCase());
                });
            }
        });

        // Tri
        if (this.sortColumn) {
            filtered.sort((a, b) => {
                let valA = a[this.sortColumn];
                let valB = b[this.sortColumn];

                // Gestion des valeurs nulles
                if (valA === null || valA === undefined) valA = '';
                if (valB === null || valB === undefined) valB = '';

                // Tri numerique pour les dates et nombres
                const colConfig = this.tableConfig.columns.find(c => c.field === this.sortColumn);
                if (colConfig && (colConfig.type === 'number' || colConfig.type === 'date')) {
                    if (colConfig.type === 'date') {
                        valA = valA ? new Date(valA).getTime() : 0;
                        valB = valB ? new Date(valB).getTime() : 0;
                    } else {
                        valA = parseFloat(valA) || 0;
                        valB = parseFloat(valB) || 0;
                    }
                } else {
                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                }

                if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        this.filteredData = filtered;
        this.currentPage = 1;
    }

    /**
     * Rendu du tableau complet
     */
    renderTable() {
        this.renderHeaders();
        this.renderFilters();
        this.renderBody();
        this.renderPagination();
    }

    /**
     * Rendu des en-tetes avec tri
     */
    renderHeaders() {
        const headerRow = document.getElementById('headerRow');
        if (!headerRow) return;

        let html = '';
        this.tableConfig.columns.forEach(col => {
            const isSorted = this.sortColumn === col.field;
            const sortIcon = isSorted
                ? (this.sortDirection === 'asc' ? ' &#9650;' : ' &#9660;')
                : ' <span class="sort-hint">&#8645;</span>';

            html += `
                <th class="sortable ${isSorted ? 'sorted' : ''}" data-field="${col.field}">
                    ${escapeHtml(col.label)}${sortIcon}
                </th>
            `;
        });
        html += '<th class="actions-col">Actions</th>';
        headerRow.innerHTML = html;
    }

    /**
     * Rendu des filtres par colonne
     */
    renderFilters() {
        const filterRow = document.getElementById('filterRow');
        if (!filterRow) return;

        let html = '';
        this.tableConfig.columns.forEach(col => {
            const currentValue = this.columnFilters[col.field] || '';

            if (col.type === 'select' || col.source) {
                // Dropdown pour les selects
                const options = this.getFilterOptions(col);
                html += `
                    <th class="filter-cell">
                        <select class="filter-select" data-field="${col.field}">
                            <option value="">Tous</option>
                            ${options.map(opt => `
                                <option value="${escapeHtml(opt)}" ${currentValue === opt ? 'selected' : ''}>
                                    ${escapeHtml(opt)}
                                </option>
                            `).join('')}
                            <option value="(Vide)" ${currentValue === '(Vide)' ? 'selected' : ''}>(Vide)</option>
                        </select>
                    </th>
                `;
            } else {
                // Input texte pour les autres
                html += `
                    <th class="filter-cell">
                        <input type="text" class="filter-input" data-field="${col.field}"
                               placeholder="Filtrer..." value="${escapeHtml(currentValue)}" />
                    </th>
                `;
            }
        });
        html += '<th class="filter-cell"></th>'; // Colonne actions
        filterRow.innerHTML = html;
    }

    /**
     * Obtient les options de filtre pour une colonne
     */
    getFilterOptions(col) {
        // Si c'est une source externe
        if (col.source === 'PERIMETRES') {
            return this.perimetres.map(p => p['Périmetre'] || p['Perimetre']).filter(Boolean);
        }
        if (col.source === 'ACTEURS') {
            return this.acteurs.map(a => {
                const prenom = a['Prénom'] || '';
                const nom = a['Nom'] || '';
                return `${prenom} ${nom.charAt(0)}.`.trim();
            }).filter(Boolean);
        }
        if (col.options) {
            return col.options.filter(Boolean);
        }

        // Sinon, extraire les valeurs uniques des donnees
        const values = new Set();
        this.data.forEach(row => {
            const val = row[col.field];
            if (val !== null && val !== undefined && val !== '') {
                values.add(String(val));
            }
        });
        return Array.from(values).sort();
    }

    /**
     * Rendu du corps du tableau
     */
    renderBody() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        // Pagination
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${this.tableConfig.columns.length + 1}" class="empty-cell">
                        <div class="empty-state-small">
                            <span>&#128203;</span>
                            <p>Aucun element trouve</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        pageData.forEach((row, index) => {
            html += '<tr>';
            this.tableConfig.columns.forEach(col => {
                const value = row[col.field];
                html += `<td>${this.formatCellValue(value, col)}</td>`;
            });
            html += `
                <td class="actions-cell">
                    <button class="btn-icon btn-edit" data-index="${row._rowIndex}" title="Modifier">
                        <span>&#9998;</span>
                    </button>
                    <button class="btn-icon btn-delete" data-index="${row._rowIndex}" title="Supprimer">
                        <span>&#128465;</span>
                    </button>
                </td>
            `;
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    /**
     * Formate une valeur de cellule
     */
    formatCellValue(value, col) {
        if (value === null || value === undefined || value === '') {
            return '<span class="text-muted">-</span>';
        }

        // Format date
        if (col.type === 'date') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('fr-FR');
            }
        }

        // Format nombre
        if (col.type === 'number') {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                return formatNumber(num);
            }
        }

        // Format responsable (acteur)
        if (col.source === 'ACTEURS' && col.sourceField === 'Mail') {
            return formatActorNameSync(value) || escapeHtml(value);
        }

        return escapeHtml(String(value));
    }

    /**
     * Rendu de la pagination
     */
    renderPagination() {
        const container = document.getElementById('paginationContainer');
        if (!container) return;

        const totalItems = this.filteredData.length;
        const totalPages = Math.ceil(totalItems / this.pageSize);
        const startItem = totalItems > 0 ? (this.currentPage - 1) * this.pageSize + 1 : 0;
        const endItem = Math.min(this.currentPage * this.pageSize, totalItems);

        let html = `
            <div class="pagination-info">
                Affichage ${startItem}-${endItem} sur ${totalItems} elements
            </div>
            <div class="pagination-controls">
                <select class="page-size-select" id="pageSizeSelect">
                    ${CONFIG.PAGINATION.PAGE_SIZE_OPTIONS.map(size => `
                        <option value="${size}" ${this.pageSize === size ? 'selected' : ''}>
                            ${size} par page
                        </option>
                    `).join('')}
                </select>
                <div class="pagination-buttons">
                    <button class="btn btn-secondary btn-sm" id="btnPrevPage"
                            ${this.currentPage <= 1 ? 'disabled' : ''}>
                        &laquo; Precedent
                    </button>
                    <span class="page-indicator">Page ${this.currentPage} / ${totalPages || 1}</span>
                    <button class="btn btn-secondary btn-sm" id="btnNextPage"
                            ${this.currentPage >= totalPages ? 'disabled' : ''}>
                        Suivant &raquo;
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    /**
     * Attache les evenements
     */
    attachEvents() {
        // Bouton ajouter
        const btnAdd = document.getElementById('btnAddBacklog');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.showAddForm());
        }

        // Recherche globale
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                this.searchTerm = e.target.value;
                this.applyFilters();
                this.renderBody();
                this.renderPagination();
            }, 300));
        }

        // Effacer les filtres
        const btnClear = document.getElementById('btnClearFilters');
        if (btnClear) {
            btnClear.addEventListener('click', () => this.clearFilters());
        }

        // Tri par colonne (delegation)
        const headerRow = document.getElementById('headerRow');
        if (headerRow) {
            headerRow.addEventListener('click', (e) => {
                const th = e.target.closest('th.sortable');
                if (th) {
                    const field = th.dataset.field;
                    if (this.sortColumn === field) {
                        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.sortColumn = field;
                        this.sortDirection = 'asc';
                    }
                    this.applyFilters();
                    this.renderTable();
                }
            });
        }

        // Filtres par colonne (delegation)
        const filterRow = document.getElementById('filterRow');
        if (filterRow) {
            filterRow.addEventListener('input', debounce((e) => {
                if (e.target.classList.contains('filter-input')) {
                    this.columnFilters[e.target.dataset.field] = e.target.value;
                    this.applyFilters();
                    this.renderBody();
                    this.renderPagination();
                }
            }, 300));

            filterRow.addEventListener('change', (e) => {
                if (e.target.classList.contains('filter-select')) {
                    this.columnFilters[e.target.dataset.field] = e.target.value;
                    this.applyFilters();
                    this.renderBody();
                    this.renderPagination();
                }
            });
        }

        // Actions sur les lignes (delegation)
        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;

                const rowIndex = parseInt(btn.dataset.index);
                const row = this.data.find(r => r._rowIndex === rowIndex);

                if (btn.classList.contains('btn-edit')) {
                    this.showEditForm(row, rowIndex);
                } else if (btn.classList.contains('btn-delete')) {
                    this.confirmDelete(row, rowIndex);
                }
            });
        }

        // Pagination
        const paginationContainer = document.getElementById('paginationContainer');
        if (paginationContainer) {
            paginationContainer.addEventListener('click', (e) => {
                if (e.target.id === 'btnPrevPage' && this.currentPage > 1) {
                    this.currentPage--;
                    this.renderBody();
                    this.renderPagination();
                } else if (e.target.id === 'btnNextPage') {
                    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
                    if (this.currentPage < totalPages) {
                        this.currentPage++;
                        this.renderBody();
                        this.renderPagination();
                    }
                }
            });

            paginationContainer.addEventListener('change', (e) => {
                if (e.target.id === 'pageSizeSelect') {
                    this.pageSize = parseInt(e.target.value);
                    this.currentPage = 1;
                    this.renderBody();
                    this.renderPagination();
                }
            });
        }
    }

    /**
     * Efface tous les filtres
     */
    clearFilters() {
        this.searchTerm = '';
        this.columnFilters = {};
        this.sortColumn = null;
        this.sortDirection = 'asc';

        // Reinitialiser les inputs
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        this.applyFilters();
        this.renderTable();
    }

    /**
     * Genere le prochain numero au format AAAA-MM-num
     */
    generateNextNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `${year}-${month}-`;

        // Trouver le plus grand numero du mois courant
        let maxNum = 0;
        this.data.forEach(row => {
            const num = row['Numéro'];
            if (num && num.startsWith(prefix)) {
                const numPart = parseInt(num.substring(prefix.length));
                if (!isNaN(numPart) && numPart > maxNum) {
                    maxNum = numPart;
                }
            }
        });

        return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }

    /**
     * Affiche le formulaire d'ajout
     */
    showAddForm() {
        // Generer le numero automatiquement
        const nextNumber = this.generateNextNumber();

        // Preparer les colonnes sans le champ Numero (sera ajoute automatiquement)
        const columnsForForm = this.tableConfig.columns.filter(col => col.field !== 'Numéro');

        showFormModal(
            `Ajouter - ${this.tableConfig.displayName}`,
            columnsForForm,
            async (formData) => {
                try {
                    // Ajouter le numero genere
                    formData['Numéro'] = nextNumber;

                    await addTableRow(this.tableConfig.name, formData);
                    showSuccess('Element ajoute avec succes');
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
     * Affiche le formulaire de modification
     */
    showEditForm(row, rowIndex) {
        // Le numero ne doit pas etre modifiable
        const columnsForForm = this.tableConfig.columns.map(col => {
            if (col.field === 'Numéro') {
                return { ...col, readonly: true };
            }
            return col;
        });

        showFormModal(
            `Modifier - ${this.tableConfig.displayName}`,
            columnsForForm,
            async (formData) => {
                try {
                    // Conserver le numero existant
                    formData['Numéro'] = row['Numéro'];

                    await updateTableRow(this.tableConfig.name, rowIndex, formData);
                    showSuccess('Element modifie avec succes');
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

    /**
     * Confirme la suppression
     */
    confirmDelete(row, rowIndex) {
        const identifiant = row['Numéro'] || row['Titre'] || `Ligne ${rowIndex + 1}`;

        showConfirmModal(
            'Confirmer la suppression',
            `Etes-vous sur de vouloir supprimer "${identifiant}" ?`,
            async () => {
                try {
                    await deleteTableRow(this.tableConfig.name, rowIndex);
                    showSuccess('Element supprime avec succes');
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
     * Rafraichit la page
     */
    async refresh() {
        invalidateCache(this.tableConfig.name);
        await this.loadReferenceData();
        await this.loadData();
    }
}

// Instance globale
let backlogPageInstance = null;

/**
 * Rendu de la page Backlog
 */
async function renderBacklogPage(container) {
    backlogPageInstance = new BacklogPage();
    await backlogPageInstance.render(container);
}

/**
 * Rafraichit la page Backlog
 */
async function refreshBacklogPage() {
    if (backlogPageInstance) {
        await backlogPageInstance.refresh();
    }
}
