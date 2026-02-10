/* ===========================================
   PRODUCT-MODAL.JS - Modale partagée pour Produits
   Application Carto
   =========================================== */

/**
 * Module global pour gérer la modale de produit
 * Peut être utilisé depuis n'importe quelle page (Parc, Synthèse, etc.)
 */
const ProductModal = {
    // Données chargées
    _data: {
        produits: [],
        perimetres: [],
        pdtsPerimetres: [],
        processus: [],
        pdtProcess: []
    },

    // État temporaire pour la modale
    _state: {
        selectedPerimetres: [],
        selectedProcessus: [],
        mode: null, // 'add' ou 'edit'
        produitData: null,
        rowIndex: null,
        onSuccess: null
    },

    /**
     * Charge toutes les données nécessaires
     */
    async loadData() {
        try {
            const [
                produitsData,
                perimetresData,
                pdtsPerimetresData,
                processusData,
                pdtProcessData
            ] = await Promise.all([
                readTable('tProduits'),
                readTable('tPerimetres'),
                readTable('tPdtsPerimetres'),
                readTable('tProcessus'),
                readTable('tPdtProcess')
            ]);

            this._data.produits = produitsData.data || [];
            this._data.perimetres = perimetresData.data || [];
            this._data.pdtsPerimetres = pdtsPerimetresData.data || [];
            this._data.processus = processusData.data || [];
            this._data.pdtProcess = pdtProcessData.data || [];
        } catch (error) {
            console.error('[ProductModal] Erreur chargement données:', error);
            throw error;
        }
    },

    /**
     * Affiche la modale d'ajout d'un produit
     */
    async showAddModal(onSuccess) {
        await this.loadData();
        this._state.mode = 'add';
        this._state.produitData = null;
        this._state.rowIndex = null;
        this._state.selectedPerimetres = [];
        this._state.selectedProcessus = [];
        this._state.onSuccess = onSuccess;

        this._showModal('Ajouter un produit');
    },

    /**
     * Affiche la modale d'édition d'un produit
     */
    async showEditModal(produit, rowIndex, onSuccess) {
        await this.loadData();
        this._state.mode = 'edit';
        this._state.produitData = produit;
        this._state.rowIndex = rowIndex;
        this._state.onSuccess = onSuccess;

        // Charger les périmètres assignés
        this._state.selectedPerimetres = this._data.pdtsPerimetres
            .filter(pp => pp['Produit'] === produit['Nom'])
            .map(pp => pp['Périmètre']);

        // Charger les processus assignés
        this._state.selectedProcessus = this._data.pdtProcess
            .filter(pp => pp['Produit'] === produit['Nom'])
            .map(pp => pp['Processus']);

        this._showModal(`Modifier: ${produit.Nom}`);
    },

    /**
     * Affiche la modale principale
     */
    _showModal(title) {
        const formId = 'modal_form_' + generateId();
        const isEdit = this._state.mode === 'edit';

        // Filtrer les colonnes pour enlever "Perimétre fonctionnel"
        const columnsFiltered = CONFIG.TABLES.PRODUITS.columns.filter(col =>
            col.field !== 'Perimétre fonctionnel'
        );

        const formHtml = generateFormHtml(formId, columnsFiltered, this._state.produitData || {});
        const formHtmlTwoCols = formHtml.replace('class="form"', 'class="form form-two-columns"');

        const content = `
            ${formHtmlTwoCols}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); margin-top: var(--spacing-md);">
                <!-- Périmètres associés -->
                <div class="assigned-section">
                    <div class="assigned-section-header">
                        <h4>&#127758; Périmètres associés</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ProductModal._showSelectPerimetresModal()">
                            Assigner
                        </button>
                    </div>
                    <div class="assigned-items-list" id="assignedPerimetresProduit">
                        <div class="assigned-items-empty">Aucun périmètre assigné</div>
                    </div>
                </div>

                <!-- Processus associés -->
                <div class="assigned-section">
                    <div class="assigned-section-header">
                        <h4>&#128736; Processus associés</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ProductModal._showSelectProcessusModal()">
                            Assigner
                        </button>
                    </div>
                    <div class="assigned-items-list" id="assignedProcessusProduit">
                        <div class="assigned-items-empty">Aucun processus assigné</div>
                    </div>
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
                return await this._saveProduct(formData);
            }
        }).show();

        // Charger les options dynamiques et afficher les périmètres et processus
        setTimeout(async () => {
            const form = document.getElementById(formId);
            if (form) {
                await loadDynamicSelectOptions(form);
                if (isEdit) {
                    setFormData(form, this._state.produitData);
                }
            }
            this._renderAssignedPerimetres();
            this._renderAssignedProcessus();
        }, 100);

        return modal;
    },

    /**
     * Sauvegarde le produit et ses associations périmètres et processus
     */
    async _saveProduct(formData) {
        const isEdit = this._state.mode === 'edit';

        try {
            if (isEdit) {
                await updateTableRow('tProduits', this._state.rowIndex, formData);

                // Supprimer les anciens liens périmètres (en ordre inverse)
                const oldPerimetreLinks = this._data.pdtsPerimetres
                    .filter(pp => pp['Produit'] === this._state.produitData['Nom'])
                    .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                for (const pp of oldPerimetreLinks) {
                    if (pp._rowIndex !== undefined && pp._rowIndex !== null) {
                        await deleteTableRow('tPdtsPerimetres', pp._rowIndex);
                    }
                }

                // Supprimer les anciens liens processus (en ordre inverse)
                const oldProcessusLinks = this._data.pdtProcess
                    .filter(pp => pp['Produit'] === this._state.produitData['Nom'])
                    .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                for (const pp of oldProcessusLinks) {
                    if (pp._rowIndex !== undefined && pp._rowIndex !== null) {
                        await deleteTableRow('tPdtProcess', pp._rowIndex);
                    }
                }
            } else {
                await addTableRow('tProduits', formData);
            }
            invalidateCache('tProduits');

            // Ajouter les nouveaux liens produit-périmètre
            const produitName = formData['Nom'];
            for (const perimetre of this._state.selectedPerimetres) {
                await addTableRow('tPdtsPerimetres', {
                    'Produit': produitName,
                    'Périmètre': perimetre
                });
            }
            invalidateCache('tPdtsPerimetres');

            // Ajouter les nouveaux liens produit-processus
            for (const processus of this._state.selectedProcessus) {
                await addTableRow('tPdtProcess', {
                    'Produit': produitName,
                    'Processus': processus
                });
            }
            invalidateCache('tPdtProcess');

            showSuccess(isEdit ? 'Produit modifié avec succès' : 'Produit ajouté avec succès');

            // Callback de succès
            if (this._state.onSuccess) {
                await this._state.onSuccess();
            }

            return true;
        } catch (error) {
            console.error('[ProductModal] Erreur sauvegarde produit:', error);
            showError(isEdit ? 'Erreur lors de la modification' : 'Erreur lors de l\'ajout');
            return false;
        }
    },

    /**
     * Affiche les périmètres assignés dans la modale produit
     */
    _renderAssignedPerimetres() {
        const container = document.getElementById('assignedPerimetresProduit');
        if (!container) return;

        if (this._state.selectedPerimetres.length === 0) {
            container.innerHTML = '<div class="assigned-items-empty">Aucun périmètre assigné</div>';
            return;
        }

        container.innerHTML = this._state.selectedPerimetres.map(perimetre => `
            <div class="assigned-item">
                <div class="assigned-item-info">
                    <div class="assigned-item-name">${escapeHtml(perimetre)}</div>
                </div>
                <div class="assigned-item-actions">
                    <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="ProductModal._removePerimetre('${escapeJsString(perimetre)}')">&#10005;</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Retire un périmètre de la sélection
     */
    _removePerimetre(perimetre) {
        const idx = this._state.selectedPerimetres.indexOf(perimetre);
        if (idx > -1) {
            this._state.selectedPerimetres.splice(idx, 1);
            this._renderAssignedPerimetres();
        }
    },

    /**
     * Affiche la modale de sélection des périmètres
     */
    _showSelectPerimetresModal() {
        const allPerimetres = this._data.perimetres.map(p => p['Périmetre']).filter(Boolean).sort();
        const selected = this._state.selectedPerimetres;

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
                        this._state.selectedPerimetres = Array.from(checkboxes).map(cb => cb.value);
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
    },

    /**
     * Affiche les processus assignés dans la modale produit
     */
    _renderAssignedProcessus() {
        const container = document.getElementById('assignedProcessusProduit');
        if (!container) return;

        if (this._state.selectedProcessus.length === 0) {
            container.innerHTML = '<div class="assigned-items-empty">Aucun processus assigné</div>';
            return;
        }

        container.innerHTML = this._state.selectedProcessus.map(processus => `
            <div class="assigned-item">
                <div class="assigned-item-info">
                    <div class="assigned-item-name">${escapeHtml(processus)}</div>
                </div>
                <div class="assigned-item-actions">
                    <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="ProductModal._removeProcessus('${escapeJsString(processus)}')">&#10005;</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Retire un processus de la sélection
     */
    _removeProcessus(processus) {
        const idx = this._state.selectedProcessus.indexOf(processus);
        if (idx > -1) {
            this._state.selectedProcessus.splice(idx, 1);
            this._renderAssignedProcessus();
        }
    },

    /**
     * Affiche la modale de sélection des processus
     */
    _showSelectProcessusModal() {
        const allProcessus = this._data.processus
            .map(p => p['Processus'])
            .filter(Boolean)
            .sort();
        const selected = this._state.selectedProcessus;

        const selectedList = allProcessus.filter(p => selected.includes(p));
        const unselectedList = allProcessus.filter(p => !selected.includes(p));

        const renderList = (searchTerm = '') => {
            const list = document.getElementById('selectionProcessusList');
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
                html = '<div class="assigned-items-empty">Aucun processus trouvé</div>';
            }

            list.innerHTML = html;
        };

        const content = `
            <div class="selection-modal">
                <div class="selection-search">
                    <input type="text" class="form-control" id="searchProcessusInput" placeholder="Rechercher un processus...">
                </div>
                <div class="selection-list" id="selectionProcessusList"></div>
            </div>
        `;

        showModal({
            title: 'Sélectionner des processus',
            content: content,
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Valider',
                    class: 'btn-primary',
                    action: (modal) => {
                        const checkboxes = document.querySelectorAll('#selectionProcessusList input[type="checkbox"]:checked');
                        this._state.selectedProcessus = Array.from(checkboxes).map(cb => cb.value);
                        this._renderAssignedProcessus();
                        return true;
                    }
                }
            ]
        });

        setTimeout(() => {
            renderList();
            const searchInput = document.getElementById('searchProcessusInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
            }
        }, 100);
    }
};
