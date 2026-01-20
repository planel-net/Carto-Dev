/* ===========================================
   CHANTIER-MODAL.JS - Modales partagées pour Chantiers
   Application Carto
   =========================================== */

/**
 * Module global pour gérer les modales de chantier
 * Peut être utilisé depuis n'importe quelle page (Roadmap, Paramètres, etc.)
 */
const ChantierModal = {
    // Données chargées
    _data: {
        acteurs: [],
        perimetres: [],
        processus: [],
        produits: [],
        dataAnas: [],
        chantierProduit: [],
        chantierDataAna: [],
        chantiers: []
    },

    // État temporaire pour les modales
    _state: {
        selectedProduits: [],
        selectedDataAnas: [],
        renderProduits: null,
        renderDataAnas: null,
        mode: null, // 'add' ou 'edit'
        chantierName: null,
        rowIndex: null,
        onSuccess: null // Callback après succès
    },

    /**
     * Charge toutes les données nécessaires
     */
    async loadData() {
        try {
            const [
                acteursData,
                perimetresData,
                processusData,
                produitsData,
                dataAnasData,
                chantierProduitData,
                chantierDataAnaData,
                chantiersData
            ] = await Promise.all([
                readTable('tActeurs'),
                readTable('tPerimetres'),
                readTable('tProcessus'),
                readTable('tProduits'),
                readTable('tDataAnas'),
                readTable('tChantierProduit'),
                readTable('tChantierDataAna'),
                readTable('tChantiers')
            ]);

            this._data.acteurs = acteursData.data || [];
            this._data.perimetres = perimetresData.data || [];
            this._data.processus = processusData.data || [];
            this._data.produits = produitsData.data || [];
            this._data.dataAnas = dataAnasData.data || [];
            this._data.chantierProduit = chantierProduitData.data || [];
            this._data.chantierDataAna = chantierDataAnaData.data || [];
            this._data.chantiers = chantiersData.data || [];

            // Trier les processus par ordre
            this._data.processus.sort((a, b) => {
                const ordreA = a['Ordre'] || 999;
                const ordreB = b['Ordre'] || 999;
                return ordreA - ordreB;
            });

            return true;
        } catch (error) {
            console.error('Erreur chargement données ChantierModal:', error);
            return false;
        }
    },

    /**
     * Retourne les processus distincts triés par Ordre
     */
    getOrderedProcessus() {
        const seen = new Set();
        const result = [];
        for (const p of this._data.processus) {
            const processusName = p['Processus'];
            if (processusName && !seen.has(processusName)) {
                seen.add(processusName);
                result.push(processusName);
            }
        }
        return result;
    },

    /**
     * Vérifie si un chantier est archivé
     */
    isArchived(chantier) {
        const archived = chantier['Archivé'];
        if (archived === true || archived === 1) return true;
        if (typeof archived === 'string') {
            const lower = archived.toLowerCase().trim();
            return lower === 'true' || lower === 'vrai' || lower === 'oui' || lower === '1';
        }
        return false;
    },

    /**
     * Affiche la modale d'ajout de chantier
     * @param {Function} onSuccess - Callback appelé après succès
     */
    async showAddModal(onSuccess = null) {
        // Charger les données
        await this.loadData();

        this._state.mode = 'add';
        this._state.onSuccess = onSuccess;
        this._state.selectedProduits = [];
        this._state.selectedDataAnas = [];

        // Filtrer les acteurs (exclure équipe RPP)
        const acteursFiltered = this._data.acteurs.filter(a => a['Equipe'] !== 'RPP');

        this._state.renderProduits = () => this._renderAssignedProduits('Add');
        this._state.renderDataAnas = () => this._renderAssignedDataAnas('Add');

        const content = `
            <form id="formChantierModal" class="form">
                <div class="form-group">
                    <label class="form-label required">Nom du chantier</label>
                    <input type="text" class="form-control" name="Chantier" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Responsable</label>
                    <select class="form-control" name="Responsable">
                        <option value="">-- Sélectionner --</option>
                        ${acteursFiltered.map(a => `
                            <option value="${escapeHtml(a['Mail'])}">${escapeHtml(a['Prénom'] || '')} ${escapeHtml(a['Nom'] || '')}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Périmètre</label>
                    <select class="form-control" name="Perimetre">
                        <option value="">-- Sélectionner --</option>
                        ${this._data.perimetres.map(p => `
                            <option value="${escapeHtml(p['Périmetre'])}">${escapeHtml(p['Périmetre'])}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Processus</label>
                    <select class="form-control" name="Processus">
                        <option value="">-- Sélectionner --</option>
                        ${this.getOrderedProcessus().map(p => `
                            <option value="${escapeHtml(p)}">${escapeHtml(p)}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Section Produits -->
                <div class="assigned-section">
                    <div class="assigned-section-header">
                        <h4>&#128202; Produits associés</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showSelectProduitsModal()">
                            Assigner produit
                        </button>
                    </div>
                    <div class="assigned-items-list" id="assignedProduitsAdd">
                        <div class="assigned-items-empty">Aucun produit assigné</div>
                    </div>
                </div>

                <!-- Section DataAnas -->
                <div class="assigned-section">
                    <div class="assigned-section-header">
                        <h4>&#128202; DataAnas associés</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showSelectDataAnasModal()">
                            Assigner DataAna
                        </button>
                    </div>
                    <div class="assigned-items-list" id="assignedDataAnasAdd">
                        <div class="assigned-items-empty">Aucun DataAna assigné</div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="Archivé">
                        <span>Archivé</span>
                    </label>
                </div>
            </form>
        `;

        showModal({
            title: 'Ajouter un chantier',
            content: content,
            size: 'lg',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Ajouter',
                    class: 'btn-primary',
                    action: async (modal) => {
                        return await this._saveChantier(modal, false);
                    }
                }
            ]
        });
    },

    /**
     * Affiche la modale d'édition de chantier
     * @param {string} chantierName - Nom du chantier à modifier
     * @param {Function} onSuccess - Callback appelé après succès
     */
    async showEditModal(chantierName, onSuccess = null) {
        // Charger les données
        await this.loadData();

        const chantier = this._data.chantiers.find(c => c['Chantier'] === chantierName);
        if (!chantier) {
            showError('Chantier non trouvé');
            return;
        }

        const rowIndex = chantier._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for chantier:', chantierName);
            showError('Erreur: index de ligne non trouvé');
            return;
        }

        this._state.mode = 'edit';
        this._state.onSuccess = onSuccess;
        this._state.chantierName = chantierName;
        this._state.rowIndex = rowIndex;

        // Produits et DataAnas associés
        this._state.selectedProduits = this._data.chantierProduit
            .filter(cp => cp['Chantier'] === chantierName)
            .map(cp => cp['Produit']);

        this._state.selectedDataAnas = this._data.chantierDataAna
            .filter(cd => cd['Chantier'] === chantierName)
            .map(cd => cd['DataAna']);

        // Filtrer les acteurs (exclure équipe RPP)
        const acteursFiltered = this._data.acteurs.filter(a => a['Equipe'] !== 'RPP');

        this._state.renderProduits = () => this._renderAssignedProduits('Edit');
        this._state.renderDataAnas = () => this._renderAssignedDataAnas('Edit');

        const content = `
            <form id="formChantierModal" class="form">
                <div class="form-group">
                    <label class="form-label required">Nom du chantier</label>
                    <input type="text" class="form-control" name="Chantier" value="${escapeHtml(chantier['Chantier'])}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Responsable</label>
                    <select class="form-control" name="Responsable">
                        <option value="">-- Sélectionner --</option>
                        ${acteursFiltered.map(a => `
                            <option value="${escapeHtml(a['Mail'])}" ${a['Mail'] === chantier['Responsable'] ? 'selected' : ''}>
                                ${escapeHtml(a['Prénom'] || '')} ${escapeHtml(a['Nom'] || '')}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Périmètre</label>
                    <select class="form-control" name="Perimetre">
                        <option value="">-- Sélectionner --</option>
                        ${this._data.perimetres.map(p => `
                            <option value="${escapeHtml(p['Périmetre'])}" ${p['Périmetre'] === chantier['Perimetre'] ? 'selected' : ''}>
                                ${escapeHtml(p['Périmetre'])}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Processus</label>
                    <select class="form-control" name="Processus">
                        <option value="">-- Sélectionner --</option>
                        ${this.getOrderedProcessus().map(p => `
                            <option value="${escapeHtml(p)}" ${p === chantier['Processus'] ? 'selected' : ''}>
                                ${escapeHtml(p)}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Section Produits -->
                <div class="assigned-section">
                    <div class="assigned-section-header">
                        <h4>&#128202; Produits associés</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showSelectProduitsModal()">
                            Assigner produit
                        </button>
                    </div>
                    <div class="assigned-items-list" id="assignedProduitsEdit">
                        <div class="assigned-items-empty">Aucun produit assigné</div>
                    </div>
                </div>

                <!-- Section DataAnas -->
                <div class="assigned-section">
                    <div class="assigned-section-header">
                        <h4>&#128202; DataAnas associés</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showSelectDataAnasModal()">
                            Assigner DataAna
                        </button>
                    </div>
                    <div class="assigned-items-list" id="assignedDataAnasEdit">
                        <div class="assigned-items-empty">Aucun DataAna assigné</div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="Archivé" ${this.isArchived(chantier) ? 'checked' : ''}>
                        <span>Archivé</span>
                    </label>
                </div>
            </form>
        `;

        showModal({
            title: 'Modifier le chantier',
            content: content,
            size: 'lg',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Enregistrer',
                    class: 'btn-primary',
                    action: async (modal) => {
                        return await this._saveChantier(modal, true);
                    }
                }
            ]
        });

        // Rendre les listes initiales après le rendu de la modale
        setTimeout(() => {
            this._state.renderProduits();
            this._state.renderDataAnas();
        }, 100);
    },

    /**
     * Sauvegarde le chantier (ajout ou modification)
     */
    async _saveChantier(modal, isEdit) {
        const form = document.getElementById('formChantierModal');
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }

        const formData = new FormData(form);
        const chantierData = {
            'Chantier': formData.get('Chantier'),
            'Responsable': formData.get('Responsable'),
            'Perimetre': formData.get('Perimetre'),
            'Processus': formData.get('Processus'),
            'Archivé': form.querySelector('input[name="Archivé"]').checked ? true : false
        };

        try {
            if (isEdit) {
                // Mettre à jour le chantier
                await updateTableRow('tChantiers', this._state.rowIndex, chantierData);
                invalidateCache('tChantiers');

                // Supprimer les anciens liens produits (en ordre inverse)
                const liensProduitsToDelete = this._data.chantierProduit
                    .filter(cp => cp['Chantier'] === this._state.chantierName)
                    .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                for (const cp of liensProduitsToDelete) {
                    if (cp._rowIndex !== undefined && cp._rowIndex !== null) {
                        await deleteTableRow('tChantierProduit', cp._rowIndex);
                    }
                }

                // Supprimer les anciens liens DataAnas (en ordre inverse)
                const liensDataAnasToDelete = this._data.chantierDataAna
                    .filter(cd => cd['Chantier'] === this._state.chantierName)
                    .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                for (const cd of liensDataAnasToDelete) {
                    if (cd._rowIndex !== undefined && cd._rowIndex !== null) {
                        await deleteTableRow('tChantierDataAna', cd._rowIndex);
                    }
                }
            } else {
                // Ajouter le chantier
                await addTableRow('tChantiers', chantierData);
                invalidateCache('tChantiers');
            }

            // Ajouter les liens chantier-produit
            for (const produit of this._state.selectedProduits) {
                await addTableRow('tChantierProduit', {
                    'Chantier': chantierData['Chantier'],
                    'Produit': produit
                });
            }
            invalidateCache('tChantierProduit');

            // Ajouter les liens chantier-dataana
            for (const dataAna of this._state.selectedDataAnas) {
                await addTableRow('tChantierDataAna', {
                    'Chantier': chantierData['Chantier'],
                    'DataAna': dataAna
                });
            }
            invalidateCache('tChantierDataAna');

            showSuccess(isEdit ? 'Chantier modifié avec succès' : 'Chantier ajouté avec succès');

            // Appeler le callback de succès
            if (this._state.onSuccess) {
                await this._state.onSuccess();
            }

            return true;
        } catch (error) {
            console.error('Erreur sauvegarde chantier:', error);
            showError(isEdit ? 'Erreur lors de la modification' : 'Erreur lors de l\'ajout');
            return false;
        }
    },

    /**
     * Rendu des produits assignés
     */
    _renderAssignedProduits(suffix) {
        const container = document.getElementById(`assignedProduits${suffix}`);
        if (!container) return;

        if (this._state.selectedProduits.length === 0) {
            container.innerHTML = '<div class="assigned-items-empty">Aucun produit assigné</div>';
            return;
        }

        container.innerHTML = this._state.selectedProduits.map(produitName => {
            const produit = this._data.produits.find(p => p['Nom'] === produitName);
            let responsableDisplay = '';
            if (produit && produit['Responsable']) {
                const acteur = this._data.acteurs.find(a => a['Mail'] === produit['Responsable']);
                responsableDisplay = acteur ? `${acteur['Prénom'] || ''} ${acteur['Nom'] || ''}`.trim() : produit['Responsable'];
            }
            return `
                <div class="assigned-item" data-produit="${escapeHtml(produitName)}">
                    <div class="assigned-item-info">
                        <div class="assigned-item-name">${escapeHtml(produitName)}</div>
                        ${responsableDisplay ? `<div class="assigned-item-detail">${escapeHtml(responsableDisplay)}</div>` : ''}
                    </div>
                    <div class="assigned-item-actions">
                        <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="ChantierModal.removeAssignedProduit('${escapeJsString(produitName)}')">&#10005;</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Rendu des DataAnas assignés
     */
    _renderAssignedDataAnas(suffix) {
        const container = document.getElementById(`assignedDataAnas${suffix}`);
        if (!container) return;

        if (this._state.selectedDataAnas.length === 0) {
            container.innerHTML = '<div class="assigned-items-empty">Aucun DataAna assigné</div>';
            return;
        }

        container.innerHTML = this._state.selectedDataAnas.map(dataAnaKey => {
            const dataAna = this._data.dataAnas.find(d => d['Clé'] === dataAnaKey);
            const jiraUrl = `https://malakoffhumanis.atlassian.net/browse/${dataAnaKey}`;
            return `
                <div class="assigned-item" data-dataana="${escapeHtml(dataAnaKey)}">
                    <div class="assigned-item-info">
                        <a href="${escapeHtml(jiraUrl)}" target="_blank" rel="noopener noreferrer" class="assigned-item-link">${escapeHtml(dataAnaKey)}</a>
                        ${dataAna && dataAna['Résumé'] ? `<div class="assigned-item-detail">${escapeHtml(dataAna['Résumé'])}</div>` : ''}
                    </div>
                    <div class="assigned-item-actions">
                        <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="ChantierModal.removeAssignedDataAna('${escapeJsString(dataAnaKey)}')">&#10005;</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Supprime un produit assigné
     */
    removeAssignedProduit(produitName) {
        const idx = this._state.selectedProduits.indexOf(produitName);
        if (idx > -1) {
            this._state.selectedProduits.splice(idx, 1);
            if (this._state.renderProduits) {
                this._state.renderProduits();
            }
        }
    },

    /**
     * Supprime un DataAna assigné
     */
    removeAssignedDataAna(dataAnaKey) {
        const idx = this._state.selectedDataAnas.indexOf(dataAnaKey);
        if (idx > -1) {
            this._state.selectedDataAnas.splice(idx, 1);
            if (this._state.renderDataAnas) {
                this._state.renderDataAnas();
            }
        }
    },

    /**
     * Affiche la modale de sélection de produits
     */
    showSelectProduitsModal() {
        const selectedProduits = this._state.selectedProduits;

        // Séparer les produits sélectionnés et non sélectionnés
        const selectedProduitsData = this._data.produits.filter(p => selectedProduits.includes(p['Nom']));
        const unselectedProduitsData = this._data.produits.filter(p => !selectedProduits.includes(p['Nom']));

        // Trier alphabétiquement
        selectedProduitsData.sort((a, b) => (a['Nom'] || '').localeCompare(b['Nom'] || ''));
        unselectedProduitsData.sort((a, b) => (a['Nom'] || '').localeCompare(b['Nom'] || ''));

        const renderList = (searchTerm = '') => {
            const list = document.getElementById('selectionProduitsList');
            if (!list) return;

            const term = searchTerm.toLowerCase();
            const filteredSelected = selectedProduitsData.filter(p => (p['Nom'] || '').toLowerCase().includes(term));
            const filteredUnselected = unselectedProduitsData.filter(p => (p['Nom'] || '').toLowerCase().includes(term));

            let html = '';

            if (filteredSelected.length > 0) {
                html += '<div class="selection-separator">Sélectionnés</div>';
                html += filteredSelected.map(p => `
                    <label class="selection-item selected">
                        <input type="checkbox" value="${escapeHtml(p['Nom'])}" checked>
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(p['Nom'])}</div>
                            ${p['Responsable'] ? `<div class="selection-item-detail">${escapeHtml(p['Responsable'])}</div>` : ''}
                        </div>
                    </label>
                `).join('');
            }

            if (filteredUnselected.length > 0) {
                html += '<div class="selection-separator">Disponibles</div>';
                html += filteredUnselected.map(p => `
                    <label class="selection-item">
                        <input type="checkbox" value="${escapeHtml(p['Nom'])}">
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(p['Nom'])}</div>
                            ${p['Responsable'] ? `<div class="selection-item-detail">${escapeHtml(p['Responsable'])}</div>` : ''}
                        </div>
                    </label>
                `).join('');
            }

            if (html === '') {
                html = '<div class="selection-empty">Aucun produit trouvé</div>';
            }

            list.innerHTML = html;
        };

        const content = `
            <div class="selection-modal">
                <div class="selection-search">
                    <input type="text" class="form-control" id="searchProduitsInput" placeholder="Rechercher un produit...">
                </div>
                <div class="selection-list" id="selectionProduitsList"></div>
            </div>
        `;

        showModal({
            title: 'Sélectionner des produits',
            content: content,
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Valider',
                    class: 'btn-primary',
                    action: (modal) => {
                        const checkboxes = document.querySelectorAll('#selectionProduitsList input[type="checkbox"]:checked');
                        this._state.selectedProduits = Array.from(checkboxes).map(cb => cb.value);
                        if (this._state.renderProduits) {
                            this._state.renderProduits();
                        }
                        return true;
                    }
                }
            ]
        });

        setTimeout(() => {
            renderList();
            const searchInput = document.getElementById('searchProduitsInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
            }
        }, 100);
    },

    /**
     * Affiche la modale de sélection de DataAnas
     */
    showSelectDataAnasModal() {
        const selectedDataAnas = this._state.selectedDataAnas;

        // Séparer les DataAnas sélectionnés et non sélectionnés
        const selectedDataAnasData = this._data.dataAnas.filter(d => selectedDataAnas.includes(d['Clé']));
        const unselectedDataAnasData = this._data.dataAnas.filter(d => !selectedDataAnas.includes(d['Clé']));

        // Trier alphabétiquement
        selectedDataAnasData.sort((a, b) => (a['Clé'] || '').localeCompare(b['Clé'] || ''));
        unselectedDataAnasData.sort((a, b) => (a['Clé'] || '').localeCompare(b['Clé'] || ''));

        const renderList = (searchTerm = '') => {
            const list = document.getElementById('selectionDataAnasList');
            if (!list) return;

            const term = searchTerm.toLowerCase();
            const filteredSelected = selectedDataAnasData.filter(d =>
                (d['Clé'] || '').toLowerCase().includes(term) ||
                (d['Résumé'] || '').toLowerCase().includes(term)
            );
            const filteredUnselected = unselectedDataAnasData.filter(d =>
                (d['Clé'] || '').toLowerCase().includes(term) ||
                (d['Résumé'] || '').toLowerCase().includes(term)
            );

            let html = '';

            if (filteredSelected.length > 0) {
                html += '<div class="selection-separator">Sélectionnés</div>';
                html += filteredSelected.map(d => `
                    <label class="selection-item selected">
                        <input type="checkbox" value="${escapeHtml(d['Clé'])}" checked>
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(d['Clé'])}</div>
                            ${d['Résumé'] ? `<div class="selection-item-detail">${escapeHtml(d['Résumé'])}</div>` : ''}
                        </div>
                    </label>
                `).join('');
            }

            if (filteredUnselected.length > 0) {
                html += '<div class="selection-separator">Disponibles</div>';
                html += filteredUnselected.map(d => `
                    <label class="selection-item">
                        <input type="checkbox" value="${escapeHtml(d['Clé'])}">
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(d['Clé'])}</div>
                            ${d['Résumé'] ? `<div class="selection-item-detail">${escapeHtml(d['Résumé'])}</div>` : ''}
                        </div>
                    </label>
                `).join('');
            }

            if (html === '') {
                html = '<div class="selection-empty">Aucun DataAna trouvé</div>';
            }

            list.innerHTML = html;
        };

        const content = `
            <div class="selection-modal">
                <div class="selection-search">
                    <input type="text" class="form-control" id="searchDataAnasInput" placeholder="Rechercher un DataAna...">
                </div>
                <div class="selection-list" id="selectionDataAnasList"></div>
            </div>
        `;

        showModal({
            title: 'Sélectionner des DataAnas',
            content: content,
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Valider',
                    class: 'btn-primary',
                    action: (modal) => {
                        const checkboxes = document.querySelectorAll('#selectionDataAnasList input[type="checkbox"]:checked');
                        this._state.selectedDataAnas = Array.from(checkboxes).map(cb => cb.value);
                        if (this._state.renderDataAnas) {
                            this._state.renderDataAnas();
                        }
                        return true;
                    }
                }
            ]
        });

        setTimeout(() => {
            renderList();
            const searchInput = document.getElementById('searchDataAnasInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
            }
        }, 100);
    }
};
