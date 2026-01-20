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
        chantiers: [],
        chantierNotes: []
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
        onSuccess: null, // Callback après succès
        activeTab: 'general', // 'general' ou 'notes'
        notes: [], // Notes du chantier en cours d'édition
        editingNoteIndex: null // Index de la note en cours d'édition
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
                chantiersData,
                chantierNotesData
            ] = await Promise.all([
                readTable('tActeurs'),
                readTable('tPerimetres'),
                readTable('tProcessus'),
                readTable('tProduits'),
                readTable('tDataAnas'),
                readTable('tChantierProduit'),
                readTable('tChantierDataAna'),
                readTable('tChantiers'),
                readTable('tChantierNote')
            ]);

            this._data.acteurs = acteursData.data || [];
            this._data.perimetres = perimetresData.data || [];
            this._data.processus = processusData.data || [];
            this._data.produits = produitsData.data || [];
            this._data.dataAnas = dataAnasData.data || [];
            this._data.chantierProduit = chantierProduitData.data || [];
            this._data.chantierDataAna = chantierDataAnaData.data || [];
            this._data.chantiers = chantiersData.data || [];
            this._data.chantierNotes = chantierNotesData.data || [];

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
                <div class="form-group">
                    <label class="form-label">Date fin souhaitée</label>
                    <input type="date" class="form-control" name="Date fin souhaitée">
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
        this._state.activeTab = 'general';
        this._state.editingNoteIndex = null;

        // Produits et DataAnas associés
        this._state.selectedProduits = this._data.chantierProduit
            .filter(cp => cp['Chantier'] === chantierName)
            .map(cp => cp['Produit']);

        // DataAnas associés : on filtre directement tDataAnas par le champ Chantier
        this._state.selectedDataAnas = this._data.dataAnas
            .filter(d => d['Chantier'] === chantierName)
            .map(d => d['Clé']);

        // Notes du chantier (triées par date décroissante)
        this._state.notes = this._data.chantierNotes
            .filter(n => n['Chantier'] === chantierName)
            .sort((a, b) => {
                const dateA = this._parseDate(a['Date']);
                const dateB = this._parseDate(b['Date']);
                return dateB - dateA; // Plus récent en premier
            });

        // Filtrer les acteurs (exclure équipe RPP)
        const acteursFiltered = this._data.acteurs.filter(a => a['Equipe'] !== 'RPP');

        this._state.renderProduits = () => this._renderAssignedProduits('Edit');
        this._state.renderDataAnas = () => this._renderAssignedDataAnas('Edit');

        const content = `
            <!-- Onglets -->
            <div class="modal-tabs">
                <button type="button" class="modal-tab active" data-tab="general" onclick="ChantierModal.switchTab('general')">
                    Général
                </button>
                <button type="button" class="modal-tab" data-tab="notes" onclick="ChantierModal.switchTab('notes')">
                    Notes <span class="tab-badge" id="notesBadge">${this._state.notes.length > 0 ? this._state.notes.length : ''}</span>
                </button>
            </div>

            <!-- Contenu onglet Général -->
            <div class="modal-tab-content active" id="tabGeneral">
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
                    <div class="form-group">
                        <label class="form-label">Date fin souhaitée</label>
                        <input type="date" class="form-control" name="Date fin souhaitée" value="${this._formatDateForInput(chantier['Date fin souhaitée'])}">
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
            </div>

            <!-- Contenu onglet Notes -->
            <div class="modal-tab-content" id="tabNotes">
                <div class="notes-section">
                    <div class="notes-header">
                        <h4>Notes du chantier</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showAddNoteForm()">
                            + Ajouter une note
                        </button>
                    </div>
                    <div class="notes-form-container" id="noteFormContainer" style="display: none;">
                        <!-- Formulaire d'ajout/édition de note -->
                    </div>
                    <div class="notes-list" id="notesList">
                        <!-- Liste des notes -->
                    </div>
                </div>
            </div>
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
                    action: async () => {
                        return await this._saveChantier(null, true);
                    }
                }
            ]
        });

        // Rendre les listes initiales après le rendu de la modale
        setTimeout(() => {
            this._state.renderProduits();
            this._state.renderDataAnas();
            this._renderNotesList();
        }, 100);
    },

    /**
     * Parse une date depuis différents formats
     */
    _parseDate(dateValue) {
        if (!dateValue) return new Date(0);
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'number') {
            // Excel serial date
            return new Date((dateValue - 25569) * 86400 * 1000);
        }
        // Essayer de parser comme string
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    },

    /**
     * Formate une date pour l'affichage
     */
    _formatDate(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    /**
     * Formate une date pour un input date
     */
    _formatDateForInput(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toISOString().split('T')[0];
    },

    /**
     * Change d'onglet
     */
    switchTab(tabName) {
        this._state.activeTab = tabName;

        // Mettre à jour les boutons d'onglets
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Mettre à jour le contenu des onglets
        document.getElementById('tabGeneral').classList.toggle('active', tabName === 'general');
        document.getElementById('tabNotes').classList.toggle('active', tabName === 'notes');

        // Si on passe à l'onglet notes, s'assurer que la liste est à jour
        if (tabName === 'notes') {
            this._renderNotesList();
        }
    },

    /**
     * Rend la liste des notes
     */
    _renderNotesList() {
        const container = document.getElementById('notesList');
        if (!container) return;

        if (this._state.notes.length === 0) {
            container.innerHTML = '<div class="notes-empty">Aucune note pour ce chantier</div>';
            return;
        }

        container.innerHTML = this._state.notes.map((note, index) => {
            const dateStr = this._formatDate(note['Date']);
            const noteContent = note['Note'] || '';
            return `
                <div class="note-item" data-index="${index}">
                    <div class="note-header">
                        <span class="note-date">${escapeHtml(dateStr)}</span>
                        <div class="note-actions">
                            <button type="button" class="btn btn-icon btn-xs btn-secondary" title="Modifier" onclick="ChantierModal.showEditNoteForm(${index})">
                                &#9998;
                            </button>
                            <button type="button" class="btn btn-icon btn-xs btn-danger" title="Supprimer" onclick="ChantierModal.confirmDeleteNote(${index})">
                                &#128465;
                            </button>
                        </div>
                    </div>
                    <div class="note-content">${noteContent}</div>
                </div>
            `;
        }).join('');
    },

    /**
     * Affiche le formulaire d'ajout de note
     */
    showAddNoteForm() {
        this._state.editingNoteIndex = null;
        this._showNoteForm(null);
    },

    /**
     * Affiche le formulaire d'édition de note
     */
    showEditNoteForm(index) {
        this._state.editingNoteIndex = index;
        const note = this._state.notes[index];
        this._showNoteForm(note);
    },

    /**
     * Affiche le formulaire de note (ajout ou édition)
     */
    _showNoteForm(note) {
        const container = document.getElementById('noteFormContainer');
        if (!container) return;

        const isEdit = note !== null;
        const dateValue = isEdit ? this._formatDateForInput(note['Date']) : new Date().toISOString().split('T')[0];
        const noteContent = isEdit ? (note['Note'] || '') : '';

        container.innerHTML = `
            <div class="note-form">
                <div class="note-form-header">
                    <h5>${isEdit ? 'Modifier la note' : 'Nouvelle note'}</h5>
                    <button type="button" class="btn btn-icon btn-xs btn-secondary" onclick="ChantierModal.hideNoteForm()">
                        &#10005;
                    </button>
                </div>
                <div class="form-group">
                    <label class="form-label required">Date</label>
                    <input type="date" class="form-control" id="noteDate" value="${dateValue}" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Note</label>
                    <div class="rich-text-toolbar">
                        <button type="button" class="rich-text-btn" onclick="ChantierModal.execRichTextCommand('bold')" title="Gras">
                            <strong>G</strong>
                        </button>
                        <button type="button" class="rich-text-btn" onclick="ChantierModal.execRichTextCommand('italic')" title="Italique">
                            <em>I</em>
                        </button>
                        <button type="button" class="rich-text-btn" onclick="ChantierModal.execRichTextCommand('underline')" title="Souligné">
                            <u>S</u>
                        </button>
                        <span class="rich-text-separator"></span>
                        <button type="button" class="rich-text-btn" onclick="ChantierModal.execRichTextCommand('insertUnorderedList')" title="Liste à puces">
                            &#8226;
                        </button>
                        <button type="button" class="rich-text-btn" onclick="ChantierModal.execRichTextCommand('insertOrderedList')" title="Liste numérotée">
                            1.
                        </button>
                    </div>
                    <div class="rich-text-editor" id="noteEditor" contenteditable="true">${noteContent}</div>
                </div>
                <div class="note-form-actions">
                    <button type="button" class="btn btn-secondary" onclick="ChantierModal.hideNoteForm()">Annuler</button>
                    <button type="button" class="btn btn-primary" onclick="ChantierModal.saveNote()">
                        ${isEdit ? 'Modifier' : 'Ajouter'}
                    </button>
                </div>
            </div>
        `;

        container.style.display = 'block';

        // Focus sur l'éditeur
        setTimeout(() => {
            const editor = document.getElementById('noteEditor');
            if (editor) editor.focus();
        }, 100);
    },

    /**
     * Cache le formulaire de note
     */
    hideNoteForm() {
        const container = document.getElementById('noteFormContainer');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        this._state.editingNoteIndex = null;
    },

    /**
     * Exécute une commande de texte enrichi
     */
    execRichTextCommand(command) {
        document.execCommand(command, false, null);
        // Remettre le focus sur l'éditeur
        const editor = document.getElementById('noteEditor');
        if (editor) editor.focus();
    },

    /**
     * Sauvegarde une note (ajout ou modification)
     */
    async saveNote() {
        const dateInput = document.getElementById('noteDate');
        const editor = document.getElementById('noteEditor');

        if (!dateInput || !editor) return;

        const dateValue = dateInput.value;
        const noteContent = editor.innerHTML.trim();

        if (!dateValue) {
            showError('Veuillez saisir une date');
            return;
        }

        if (!noteContent || noteContent === '<br>') {
            showError('Veuillez saisir une note');
            return;
        }

        try {
            const noteData = {
                'Chantier': this._state.chantierName,
                'Date': dateValue,
                'Note': noteContent
            };

            if (this._state.editingNoteIndex !== null) {
                // Modification
                const existingNote = this._state.notes[this._state.editingNoteIndex];
                if (existingNote._rowIndex !== undefined) {
                    await updateTableRow('tChantierNote', existingNote._rowIndex, noteData);
                    invalidateCache('tChantierNote');
                    showSuccess('Note modifiée');
                }
            } else {
                // Ajout
                await addTableRow('tChantierNote', noteData);
                invalidateCache('tChantierNote');
                showSuccess('Note ajoutée');
            }

            // Recharger les notes
            await this._reloadNotes();
            this.hideNoteForm();
            this._renderNotesList();
            this._updateNotesBadge();

        } catch (error) {
            console.error('Erreur sauvegarde note:', error);
            showError('Erreur lors de la sauvegarde de la note');
        }
    },

    /**
     * Demande confirmation avant suppression d'une note
     */
    confirmDeleteNote(index) {
        const note = this._state.notes[index];
        const dateStr = this._formatDate(note['Date']);

        showConfirmModal(
            'Supprimer la note',
            `Êtes-vous sûr de vouloir supprimer la note du ${dateStr} ?`,
            async () => {
                await this._deleteNote(index);
            },
            { confirmText: 'Supprimer', cancelText: 'Annuler' }
        );
    },

    /**
     * Supprime une note
     */
    async _deleteNote(index) {
        try {
            const note = this._state.notes[index];
            if (note._rowIndex !== undefined) {
                await deleteTableRow('tChantierNote', note._rowIndex);
                invalidateCache('tChantierNote');
                showSuccess('Note supprimée');

                // Recharger les notes
                await this._reloadNotes();
                this._renderNotesList();
                this._updateNotesBadge();
            }
        } catch (error) {
            console.error('Erreur suppression note:', error);
            showError('Erreur lors de la suppression de la note');
        }
    },

    /**
     * Recharge les notes depuis Excel
     */
    async _reloadNotes() {
        try {
            const notesData = await readTable('tChantierNote');
            this._data.chantierNotes = notesData.data || [];

            // Filtrer et trier pour le chantier courant
            this._state.notes = this._data.chantierNotes
                .filter(n => n['Chantier'] === this._state.chantierName)
                .sort((a, b) => {
                    const dateA = this._parseDate(a['Date']);
                    const dateB = this._parseDate(b['Date']);
                    return dateB - dateA;
                });
        } catch (error) {
            console.error('Erreur rechargement notes:', error);
        }
    },

    /**
     * Met à jour le badge du nombre de notes
     */
    _updateNotesBadge() {
        const badge = document.getElementById('notesBadge');
        if (badge) {
            badge.textContent = this._state.notes.length > 0 ? this._state.notes.length : '';
        }
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
            'Date fin souhaitée': formData.get('Date fin souhaitée') || '',
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

                // Mettre à jour les DataAnas : vider le champ Chantier pour ceux qui ne sont plus sélectionnés
                const previouslySelectedDataAnas = this._data.dataAnas
                    .filter(d => d['Chantier'] === this._state.chantierName);

                for (const dataAna of previouslySelectedDataAnas) {
                    // Si ce DataAna n'est plus dans la sélection, vider son champ Chantier
                    if (!this._state.selectedDataAnas.includes(dataAna['Clé'])) {
                        if (dataAna._rowIndex !== undefined && dataAna._rowIndex !== null) {
                            const updatedData = { ...dataAna, 'Chantier': '' };
                            delete updatedData._rowIndex;
                            await updateTableRow('tDataAnas', dataAna._rowIndex, updatedData);
                        }
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

            // Mettre à jour le champ Chantier des DataAnas sélectionnés
            for (const dataAnaKey of this._state.selectedDataAnas) {
                const dataAna = this._data.dataAnas.find(d => d['Clé'] === dataAnaKey);
                if (dataAna && dataAna._rowIndex !== undefined && dataAna._rowIndex !== null) {
                    // Mettre à jour uniquement si le chantier est différent
                    if (dataAna['Chantier'] !== chantierData['Chantier']) {
                        const updatedData = { ...dataAna, 'Chantier': chantierData['Chantier'] };
                        delete updatedData._rowIndex;
                        await updateTableRow('tDataAnas', dataAna._rowIndex, updatedData);
                    }
                }
            }
            invalidateCache('tDataAnas');

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
