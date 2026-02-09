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
        pdtsPerimetres: []
    },

    // État temporaire pour la modale
    _state: {
        selectedPerimetres: [],
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
                pdtsPerimetresData
            ] = await Promise.all([
                readTable('tProduits'),
                readTable('tPerimetres'),
                readTable('tPdtsPerimetres')
            ]);

            this._data.produits = produitsData.data || [];
            this._data.perimetres = perimetresData.data || [];
            this._data.pdtsPerimetres = pdtsPerimetresData.data || [];
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
            <div class="assigned-section" style="margin-top: var(--spacing-md);">
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

        // Charger les options dynamiques et afficher les périmètres
        setTimeout(async () => {
            const form = document.getElementById(formId);
            if (form) {
                await loadDynamicSelectOptions(form);
                if (isEdit) {
                    setFormData(form, this._state.produitData);
                }
            }
            this._renderAssignedPerimetres();
        }, 100);

        return modal;
    },

    /**
     * Sauvegarde le produit et ses associations périmètres
     */
    async _saveProduct(formData) {
        const isEdit = this._state.mode === 'edit';

        try {
            if (isEdit) {
                await updateTableRow('tProduits', this._state.rowIndex, formData);

                // Supprimer les anciens liens périmètres (en ordre inverse)
                const oldLinks = this._data.pdtsPerimetres
                    .filter(pp => pp['Produit'] === this._state.produitData['Nom'])
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

            // Ajouter les nouveaux liens produit-périmètre
            const produitName = formData['Nom'];
            for (const perimetre of this._state.selectedPerimetres) {
                await addTableRow('tPdtsPerimetres', {
                    'Produit': produitName,
                    'Périmètre': perimetre
                });
            }
            invalidateCache('tPdtsPerimetres');

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
    }
};
