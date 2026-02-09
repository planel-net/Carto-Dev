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
        programmes: [],
        processus: [],
        produits: [],
        dataAnas: [],
        mae: [],
        chantierProduit: [],
        chantierDataAna: [],
        chantierLien: [],
        chantiers: [],
        chantierNotes: [],
        phases: [],
        phasesLien: [],
        sprints: []
    },

    // État temporaire pour les modales
    _state: {
        selectedProduits: [],
        selectedDataAnas: [],
        selectedMAE: [],
        liens: [],
        renderProduits: null,
        renderDataAnas: null,
        renderMAE: null,
        renderLiens: null,
        mode: null, // 'add' ou 'edit'
        chantierName: null,
        rowIndex: null,
        onSuccess: null,
        activeTab: 'general', // 'general', 'phases', 'associations' ou 'notes'
        notes: [],
        editingNoteIndex: null
    },

    /**
     * Charge toutes les données nécessaires
     */
    async loadData() {
        try {
            const [
                acteursData,
                perimetresData,
                programmesData,
                processusData,
                produitsData,
                dataAnasData,
                maeData,
                chantierProduitData,
                chantierDataAnaData,
                chantierLienData,
                chantiersData,
                chantierNotesData,
                phasesData,
                phasesLienData,
                sprintsData
            ] = await Promise.all([
                readTable('tActeurs'),
                readTable('tPerimetres'),
                readTable('tProgrammes'),
                readTable('tProcessus'),
                readTable('tProduits'),
                readTable('tDataAnas'),
                readTable('tMAE'),
                readTable('tChantierProduit'),
                readTable('tChantierDataAna'),
                readTable('tChantierLien'),
                readTable('tChantiers'),
                readTable('tChantierNote'),
                readTable('tPhases'),
                readTable('tPhasesLien'),
                readTable('tSprints')
            ]);

            this._data.acteurs = acteursData.data || [];
            this._data.perimetres = perimetresData.data || [];
            this._data.programmes = programmesData.data || [];
            this._data.processus = processusData.data || [];
            this._data.produits = produitsData.data || [];
            this._data.dataAnas = dataAnasData.data || [];
            this._data.mae = maeData.data || [];
            this._data.chantierProduit = chantierProduitData.data || [];
            this._data.chantierDataAna = chantierDataAnaData.data || [];
            this._data.chantierLien = chantierLienData.data || [];
            this._data.chantiers = chantiersData.data || [];
            this._data.chantierNotes = chantierNotesData.data || [];
            this._data.phases = phasesData.data || [];
            this._data.phasesLien = phasesLienData.data || [];
            this._data.sprints = sprintsData.data || [];

            // Trier les processus par ordre
            this._data.processus.sort((a, b) => {
                const ordreA = a['Ordre'] || 999;
                const ordreB = b['Ordre'] || 999;
                return ordreA - ordreB;
            });

            // Trier les sprints par date de début
            this._data.sprints.sort((a, b) => {
                const dateA = this._parseDate(a['Début']);
                const dateB = this._parseDate(b['Début']);
                return dateA - dateB;
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

    // ==========================================
    // MODALE D'AJOUT
    // ==========================================

    /**
     * Affiche la modale d'ajout de chantier
     * @param {Function} onSuccess - Callback appelé après succès
     */
    async showAddModal(onSuccess = null) {
        await this.loadData();

        this._state.mode = 'add';
        this._state.onSuccess = onSuccess;
        this._state.selectedProduits = [];
        this._state.selectedDataAnas = [];
        this._state.selectedMAE = [];
        this._state.liens = [];

        const acteursFiltered = this._data.acteurs.filter(a => a['Equipe'] !== 'RPP');

        this._state.renderProduits = () => this._renderAssignedProduits('Add');
        this._state.renderDataAnas = () => this._renderAssignedDataAnas('Add');
        this._state.renderMAE = () => this._renderAssignedMAE('Add');
        this._state.renderLiens = () => this._renderLiensList('Add');

        const avancementOptions = ['Non démarré', 'En cadrage', 'Cadré', 'En développement', 'Développé', 'En recette', 'Recetté', 'Terminé'];

        const content = `
            <form id="formChantierModal" class="form">
                <div class="chantier-form-grid">
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
                        <label class="form-label">Programme</label>
                        <select class="form-control" name="Programme">
                            <option value="">-- Sélectionner --</option>
                            ${this._data.programmes.map(p => `
                                <option value="${escapeHtml(p['Programme'])}">${escapeHtml(p['Programme'])}</option>
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
                        <label class="form-label">Avancement</label>
                        <select class="form-control" name="Avancement">
                            <option value="">-- Sélectionner --</option>
                            ${avancementOptions.map(o => `
                                <option value="${escapeHtml(o)}">${escapeHtml(o)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Date fin souhaitée</label>
                        <input type="date" class="form-control" name="Date fin souhaitée">
                    </div>
                    <div class="form-group" style="display: flex; align-items: flex-end;">
                        <label class="checkbox-label">
                            <input type="checkbox" name="Archivé">
                            <span>Archivé</span>
                        </label>
                    </div>
                </div>
                <div class="chantier-compact-row">
                    <div class="form-group">
                        <label class="form-label">Code</label>
                        <input type="text" class="form-control" name="Code">
                    </div>
                    <div class="form-group">
                        <label class="form-label">JH Vigie</label>
                        <input type="number" class="form-control" name="JH Vigie" step="0.5" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">JH Pilotage</label>
                        <input type="number" class="form-control" name="JH Pilotage" step="0.5" min="0">
                    </div>
                </div>
                <div class="chantier-textarea-grid">
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <div class="rich-text-toolbar">
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('bold')" title="Gras"><strong>G</strong></button>
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('italic')" title="Italique"><em>I</em></button>
                            <span class="rich-text-separator"></span>
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('insertUnorderedList')" title="Liste">&#8226;</button>
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('insertOrderedList')" title="Liste numérotée">1.</button>
                        </div>
                        <div class="rich-text-editor" id="descriptionEditor" contenteditable="true" style="min-height: 100px; resize: vertical; overflow: auto;"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Enjeux</label>
                        <div class="rich-text-toolbar">
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('bold')" title="Gras"><strong>G</strong></button>
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('italic')" title="Italique"><em>I</em></button>
                            <span class="rich-text-separator"></span>
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('insertUnorderedList')" title="Liste">&#8226;</button>
                            <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('insertOrderedList')" title="Liste numérotée">1.</button>
                        </div>
                        <div class="rich-text-editor" id="enjeuxEditor" contenteditable="true" style="min-height: 100px; resize: vertical; overflow: auto;"></div>
                    </div>
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

    // ==========================================
    // MODALE D'ÉDITION (REFONTE)
    // ==========================================

    /**
     * Affiche la modale d'édition de chantier
     * @param {string} chantierName - Nom du chantier à modifier
     * @param {Function} onSuccess - Callback appelé après succès
     */
    async showEditModal(chantierName, onSuccess = null) {
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

        // Produits associés
        this._state.selectedProduits = this._data.chantierProduit
            .filter(cp => cp['Chantier'] === chantierName)
            .map(cp => cp['Produit']);

        // DataAnas associés
        this._state.selectedDataAnas = this._data.dataAnas
            .filter(d => d['Chantier'] === chantierName)
            .map(d => d['Clé']);

        // MAE associés
        this._state.selectedMAE = this._data.mae
            .filter(m => m['Chantier'] === chantierName)
            .map(m => m['Numero']);

        // Liens du chantier
        this._state.liens = this._data.chantierLien
            .filter(l => l['Chantier'] === chantierName)
            .map(l => ({ 'Nom lien': l['Nom lien'] || '', 'Lien': l['Lien'] || '' }));

        // Notes du chantier (triées par date décroissante)
        this._state.notes = this._data.chantierNotes
            .filter(n => n['Chantier'] === chantierName)
            .sort((a, b) => {
                const dateA = this._parseDate(a['Date']);
                const dateB = this._parseDate(b['Date']);
                return dateB - dateA;
            });

        const acteursFiltered = this._data.acteurs.filter(a => a['Equipe'] !== 'RPP');

        this._state.renderProduits = () => this._renderAssignedProduits('Edit');
        this._state.renderDataAnas = () => this._renderAssignedDataAnas('Edit');
        this._state.renderMAE = () => this._renderAssignedMAE('Edit');
        this._state.renderLiens = () => this._renderLiensList('Edit');

        // Phases du chantier (tri croissant par début)
        const chantierPhases = this._data.phases
            .filter(p => p['Chantier'] === chantierName);

        const phasesCount = chantierPhases.length;

        const content = `
            <!-- Mini Roadmap (toujours visible au-dessus des onglets) -->
            <div class="chantier-mini-roadmap" id="chantierMiniRoadmap">
                <!-- Généré dynamiquement -->
            </div>

            <!-- Onglets -->
            <div class="modal-tabs">
                <button type="button" class="modal-tab active" data-tab="general" onclick="ChantierModal.switchTab('general')">
                    Général
                </button>
                <button type="button" class="modal-tab" data-tab="phases" onclick="ChantierModal.switchTab('phases')">
                    Phases <span class="tab-badge" id="phasesBadge">${phasesCount > 0 ? phasesCount : ''}</span>
                </button>
                <button type="button" class="modal-tab" data-tab="associations" onclick="ChantierModal.switchTab('associations')">
                    Associations
                </button>
                <button type="button" class="modal-tab" data-tab="notes" onclick="ChantierModal.switchTab('notes')">
                    Notes <span class="tab-badge" id="notesBadge">${this._state.notes.length > 0 ? this._state.notes.length : ''}</span>
                </button>
            </div>

            <!-- Contenu onglet Général -->
            <div class="modal-tab-content active" id="tabGeneral">
                <form id="formChantierModal" class="form">
                    <div class="chantier-form-grid">
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
                            <label class="form-label">Programme</label>
                            <select class="form-control" name="Programme">
                                <option value="">-- Sélectionner --</option>
                                ${this._data.programmes.map(p => `
                                    <option value="${escapeHtml(p['Programme'])}" ${p['Programme'] === chantier['Programme'] ? 'selected' : ''}>
                                        ${escapeHtml(p['Programme'])}
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
                            <label class="form-label">Avancement</label>
                            <select class="form-control" name="Avancement">
                                <option value="">-- Sélectionner --</option>
                                ${['Non démarré', 'En cadrage', 'Cadré', 'En développement', 'Développé', 'En recette', 'Recetté', 'Terminé'].map(o => `
                                    <option value="${escapeHtml(o)}" ${o === chantier['Avancement'] ? 'selected' : ''}>
                                        ${escapeHtml(o)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date fin souhaitée</label>
                            <input type="date" class="form-control" name="Date fin souhaitée" value="${this._formatDateForInput(chantier['Date fin souhaitée'])}">
                        </div>
                        <div class="form-group" style="display: flex; align-items: flex-end;">
                            <label class="checkbox-label">
                                <input type="checkbox" name="Archivé" ${this.isArchived(chantier) ? 'checked' : ''}>
                                <span>Archivé</span>
                            </label>
                        </div>
                    </div>
                    <div class="chantier-compact-row">
                        <div class="form-group">
                            <label class="form-label">Code</label>
                            <input type="text" class="form-control" name="Code" value="${escapeHtml(chantier['Code'] || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">JH Vigie</label>
                            <input type="number" class="form-control" name="JH Vigie" step="0.5" min="0" value="${chantier['JH Vigie'] || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">JH Pilotage</label>
                            <input type="number" class="form-control" name="JH Pilotage" step="0.5" min="0" value="${chantier['JH Pilotage'] || ''}">
                        </div>
                    </div>
                    <div class="chantier-textarea-grid">
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <div class="rich-text-toolbar">
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('bold')" title="Gras"><strong>G</strong></button>
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('italic')" title="Italique"><em>I</em></button>
                                <span class="rich-text-separator"></span>
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('insertUnorderedList')" title="Liste">&#8226;</button>
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execDescriptionCommand('insertOrderedList')" title="Liste numérotée">1.</button>
                            </div>
                            <div class="rich-text-editor" id="descriptionEditor" contenteditable="true" style="min-height: 100px; resize: vertical; overflow: auto;">${chantier['Description'] || ''}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Enjeux</label>
                            <div class="rich-text-toolbar">
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('bold')" title="Gras"><strong>G</strong></button>
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('italic')" title="Italique"><em>I</em></button>
                                <span class="rich-text-separator"></span>
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('insertUnorderedList')" title="Liste">&#8226;</button>
                                <button type="button" class="rich-text-btn" onclick="ChantierModal.execEnjeuxCommand('insertOrderedList')" title="Liste numérotée">1.</button>
                            </div>
                            <div class="rich-text-editor" id="enjeuxEditor" contenteditable="true" style="min-height: 100px; resize: vertical; overflow: auto;">${chantier['Enjeux'] || ''}</div>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Contenu onglet Phases -->
            <div class="modal-tab-content" id="tabPhases">
                <div class="phases-section">
                    <div class="phases-header">
                        <h4>Phases du chantier</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showAddPhaseModal()">
                            + Ajouter une phase
                        </button>
                    </div>
                    <div id="phasesTableContainer">
                        <!-- Tableau des phases -->
                    </div>
                </div>
            </div>

            <!-- Contenu onglet Associations -->
            <div class="modal-tab-content" id="tabAssociations">
                <div class="associations-grid">
                    <!-- Section Produits -->
                    <div class="assigned-section">
                        <div class="assigned-section-header">
                            <h4>&#128202; Produits associés</h4>
                            <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showSelectProduitsModal()">
                                Assigner
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
                                Assigner
                            </button>
                        </div>
                        <div class="assigned-items-list" id="assignedDataAnasEdit">
                            <div class="assigned-items-empty">Aucun DataAna assigné</div>
                        </div>
                    </div>

                    <!-- Section MAE -->
                    <div class="assigned-section">
                        <div class="assigned-section-header">
                            <h4>&#128203; MAE associés</h4>
                            <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.showSelectMAEModal()">
                                Assigner
                            </button>
                        </div>
                        <div class="assigned-items-list" id="assignedMAEEdit">
                            <div class="assigned-items-empty">Aucun MAE assigné</div>
                        </div>
                    </div>
                </div>

                <!-- Section Liens (pleine largeur) -->
                <div class="assigned-section">
                    <div class="assigned-section-header">
                        <h4>&#128279; Liens</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="ChantierModal.addLienRow()">
                            + Ajouter
                        </button>
                    </div>
                    <div id="chantierLiensEdit">
                        <div class="assigned-items-empty">Aucun lien</div>
                    </div>
                </div>
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
                    <div class="notes-form-container" id="noteFormContainer" style="display: none;"></div>
                    <div class="notes-list" id="notesList"></div>
                </div>
            </div>
        `;

        const numChantier = chantier['NumChantier'] || '';
        const modalTitle = numChantier ? `${numChantier} - ${chantierName}` : chantierName;

        showModal({
            title: modalTitle,
            content: content,
            size: 'xl',
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

        // Rendre la mini roadmap sur l'onglet Général (actif par défaut)
        // puis verrouiller la hauteur du body pour éviter le redimensionnement au changement d'onglet
        setTimeout(() => {
            this._renderMiniRoadmap();
            // Verrouiller la hauteur du modal-body après le rendu complet de l'onglet Général
            setTimeout(() => {
                const modalBody = document.querySelector('.modal-body');
                if (modalBody) {
                    modalBody.style.minHeight = modalBody.offsetHeight + 'px';
                }
            }, 150);
        }, 100);
    },

    // ==========================================
    // AUTO-NUMBERING
    // ==========================================

    /**
     * Génère un numéro de chantier au format C-YYYY-NNN
     */
    _generateNumChantier() {
        const year = new Date().getFullYear();
        const prefix = `C-${year}-`;

        let maxNum = 0;
        for (const c of this._data.chantiers) {
            const num = c['NumChantier'] || '';
            if (num.startsWith(prefix)) {
                const n = parseInt(num.slice(prefix.length), 10);
                if (!isNaN(n) && n > maxNum) {
                    maxNum = n;
                }
            }
        }

        const next = String(maxNum + 1).padStart(3, '0');
        return `${prefix}${next}`;
    },

    // ==========================================
    // UTILITAIRES DATE
    // ==========================================

    _parseDate(dateValue) {
        if (!dateValue) return new Date(0);
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'number') {
            return new Date((dateValue - 25569) * 86400 * 1000);
        }
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? new Date(0) : parsed;
    },

    _formatDate(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    _formatDateShort(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    },

    _formatDateForInput(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toISOString().split('T')[0];
    },

    // ==========================================
    // GESTION DES ONGLETS
    // ==========================================

    switchTab(tabName) {
        this._state.activeTab = tabName;

        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        const tabGeneral = document.getElementById('tabGeneral');
        const tabPhases = document.getElementById('tabPhases');
        const tabAssociations = document.getElementById('tabAssociations');
        const tabNotes = document.getElementById('tabNotes');

        if (tabGeneral) tabGeneral.classList.toggle('active', tabName === 'general');
        if (tabPhases) tabPhases.classList.toggle('active', tabName === 'phases');
        if (tabAssociations) tabAssociations.classList.toggle('active', tabName === 'associations');
        if (tabNotes) tabNotes.classList.toggle('active', tabName === 'notes');

        if (tabName === 'general') {
            this._renderMiniRoadmap();
        }
        if (tabName === 'phases') {
            this._renderPhasesTable();
            this._renderMiniRoadmap();
        }
        if (tabName === 'associations') {
            this._state.renderProduits();
            this._state.renderDataAnas();
            this._state.renderMAE();
            this._state.renderLiens();
        }
        if (tabName === 'notes') {
            this._renderNotesList();
        }
    },

    // ==========================================
    // ONGLET PHASES
    // ==========================================

    _renderPhasesTable() {
        const container = document.getElementById('phasesTableContainer');
        if (!container) return;

        const chantierPhases = this._data.phases
            .filter(p => p['Chantier'] === this._state.chantierName)
            .sort((a, b) => {
                // Tri par début (sprint ou semaine)
                const modeA = a['Mode'] || 'Sprint';
                const modeB = b['Mode'] || 'Sprint';
                let startA, startB;

                if (modeA === 'Semaine') {
                    startA = a['Semaine début'] || '';
                } else {
                    const sIdx = this._data.sprints.findIndex(s => s['Sprint'] === a['Sprint début']);
                    startA = sIdx >= 0 ? String(sIdx).padStart(5, '0') : '';
                }
                if (modeB === 'Semaine') {
                    startB = b['Semaine début'] || '';
                } else {
                    const sIdx = this._data.sprints.findIndex(s => s['Sprint'] === b['Sprint début']);
                    startB = sIdx >= 0 ? String(sIdx).padStart(5, '0') : '';
                }
                return startA.localeCompare(startB);
            });

        if (chantierPhases.length === 0) {
            container.innerHTML = '<div class="phases-empty">Aucune phase pour ce chantier</div>';
            return;
        }

        container.innerHTML = `
            <table class="phases-table">
                <thead>
                    <tr>
                        <th>Phase</th>
                        <th>Type</th>
                        <th>Mode</th>
                        <th>Début</th>
                        <th>Fin</th>
                        <th>Date début</th>
                        <th>Date fin</th>
                    </tr>
                </thead>
                <tbody>
                    ${chantierPhases.map((phase, idx) => {
                        const mode = phase['Mode'] || 'Sprint';
                        const debut = mode === 'Semaine' ? (phase['Semaine début'] || '') : (phase['Sprint début'] || '');
                        const fin = mode === 'Semaine' ? (phase['Semaine fin'] || '') : (phase['Sprint fin'] || '');
                        const color = phase['Couleur'] || CONFIG.PHASE_COLORS[phase['Type phase']] || '#ccc';
                        const phaseIndex = this._data.phases.indexOf(phase);

                        // Calculer les dates réelles
                        let dateDebut = '', dateFin = '';
                        if (mode === 'Semaine') {
                            const dStart = this._weekCodeToDate(phase['Semaine début']);
                            const dEnd = this._weekCodeToDate(phase['Semaine fin']);
                            if (dStart) dateDebut = this._formatDate(dStart);
                            if (dEnd) {
                                const endFriday = new Date(dEnd);
                                endFriday.setDate(endFriday.getDate() + 4);
                                dateFin = this._formatDate(endFriday);
                            }
                        } else {
                            const sprintDebut = this._data.sprints.find(s => s['Sprint'] === phase['Sprint début']);
                            const sprintFin = this._data.sprints.find(s => s['Sprint'] === phase['Sprint fin']);
                            if (sprintDebut) dateDebut = this._formatDate(sprintDebut['Début']);
                            if (sprintFin) dateFin = this._formatDate(sprintFin['Fin']);
                        }

                        return `
                            <tr class="phase-row" data-phase-index="${phaseIndex}" ondblclick="ChantierModal.openEditPhase(${phaseIndex})">
                                <td>
                                    <span class="phase-color-dot" style="background:${color}"></span>
                                    ${escapeHtml(phase['Phase'])}
                                </td>
                                <td>${escapeHtml(phase['Type phase'] || '')}</td>
                                <td>${escapeHtml(mode)}</td>
                                <td>${escapeHtml(debut)}</td>
                                <td>${escapeHtml(fin)}</td>
                                <td>${escapeHtml(dateDebut)}</td>
                                <td>${escapeHtml(dateFin)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    /**
     * Ouvre PhaseModal pour ajouter une phase
     */
    showAddPhaseModal() {
        const firstSprint = this._data.sprints.length > 0 ? this._data.sprints[0]['Sprint'] : '';
        PhaseModal.showAddModal({
            chantierName: this._state.chantierName,
            sprintName: firstSprint,
            sprints: this._data.sprints,
            onSuccess: async () => {
                await this._reloadPhases();
                this._renderPhasesTable();
                this._renderMiniRoadmap();
                this._updatePhasesBadge();
            }
        });
    },

    /**
     * Ouvre PhaseModal pour éditer une phase (double-clic)
     */
    openEditPhase(phaseIndex) {
        const phase = this._data.phases[phaseIndex];
        if (!phase) return;

        PhaseModal.showEditModal({
            phase: phase,
            sprints: this._data.sprints,
            phasesLien: this._data.phasesLien,
            onSuccess: async () => {
                await this._reloadPhases();
                this._renderPhasesTable();
                this._renderMiniRoadmap();
                this._updatePhasesBadge();
            }
        });
    },

    async _reloadPhases() {
        try {
            const [phasesData, phasesLienData] = await Promise.all([
                readTable('tPhases'),
                readTable('tPhasesLien')
            ]);
            this._data.phases = phasesData.data || [];
            this._data.phasesLien = phasesLienData.data || [];
        } catch (error) {
            console.error('Erreur rechargement phases:', error);
        }
    },

    _updatePhasesBadge() {
        const badge = document.getElementById('phasesBadge');
        if (badge) {
            const count = this._data.phases.filter(p => p['Chantier'] === this._state.chantierName).length;
            badge.textContent = count > 0 ? count : '';
        }
    },

    // ==========================================
    // MINI ROADMAP (GANTT LECTURE SEULE)
    // ==========================================

    _renderMiniRoadmap() {
        const containers = document.querySelectorAll('#chantierMiniRoadmap');
        if (containers.length === 0) return;

        const chantierPhases = this._data.phases
            .filter(p => p['Chantier'] === this._state.chantierName);

        if (this._data.sprints.length === 0) {
            containers.forEach(c => c.innerHTML = '');
            return;
        }

        let visibleSprints;

        if (chantierPhases.length === 0) {
            // Fallback: sprint courant + 5 suivants
            const currentIdx = this._data.sprints.findIndex(s => this._isCurrentSprint(s));
            const startIdx = Math.max(0, currentIdx >= 0 ? currentIdx : 0);
            const endIdx = Math.min(this._data.sprints.length - 1, startIdx + 5);
            visibleSprints = this._data.sprints.slice(startIdx, endIdx + 1);
        } else {
            // Trouver les indices de sprint min/max couverts par les phases
            const allNames = this._data.sprints.map(s => s['Sprint']);
            let minIdx = Infinity, maxIdx = -1;

            chantierPhases.forEach(phase => {
                const mode = phase['Mode'] || 'Sprint';
                if (mode === 'Sprint') {
                    const sIdx = allNames.indexOf(phase['Sprint début']);
                    const eIdx = allNames.indexOf(phase['Sprint fin']);
                    if (sIdx >= 0 && sIdx < minIdx) minIdx = sIdx;
                    if (eIdx >= 0 && eIdx > maxIdx) maxIdx = eIdx;
                } else {
                    // Semaine mode: trouver les sprints correspondants
                    const wStart = phase['Semaine début'] || '';
                    const wEnd = phase['Semaine fin'] || '';
                    this._data.sprints.forEach((s, idx) => {
                        const weeks = this._getWeeksForSprint(s);
                        if (weeks.length > 0 && weeks.some(w => w >= wStart && w <= wEnd)) {
                            if (idx < minIdx) minIdx = idx;
                            if (idx > maxIdx) maxIdx = idx;
                        }
                    });
                }
            });

            if (minIdx === Infinity || maxIdx === -1) {
                containers.forEach(c => c.innerHTML = '');
                return;
            }

            visibleSprints = this._data.sprints.slice(minIdx, maxIdx + 1);
        }
        if (visibleSprints.length === 0) {
            containers.forEach(c => c.innerHTML = '');
            return;
        }

        // Construire les semaines
        const allWeeks = [];
        visibleSprints.forEach(sprint => {
            const weeks = this._getWeeksForSprint(sprint);
            weeks.forEach((weekCode, idx) => {
                allWeeks.push({
                    weekCode,
                    sprintName: sprint['Sprint'],
                    sprint: sprint,
                    isFirstOfSprint: idx === 0
                });
            });
        });

        if (allWeeks.length === 0) {
            containers.forEach(c => c.innerHTML = '');
            return;
        }

        const weekCodes = allWeeks.map(w => w.weekCode);
        const todayCode = this._formatWeekCode(new Date());

        // Date fin souhaitée
        const form = document.getElementById('formChantierModal');
        const dateFinStr = form ? form.querySelector('[name="Date fin souhaitée"]')?.value : '';
        const dateFin = dateFinStr ? new Date(dateFinStr) : null;
        let dateFinWeekCode = null;
        if (dateFin && !isNaN(dateFin.getTime())) {
            dateFinWeekCode = this._formatWeekCode(dateFin);
        }

        // Calculer les positions de chaque phase
        const phasePositions = [];
        chantierPhases.forEach(phase => {
            const mode = phase['Mode'] || 'Sprint';
            let startWeekIdx, endWeekIdx;

            if (mode === 'Semaine') {
                startWeekIdx = weekCodes.indexOf(phase['Semaine début']);
                endWeekIdx = weekCodes.indexOf(phase['Semaine fin']);
            } else {
                const startSprint = this._data.sprints.find(s => s['Sprint'] === phase['Sprint début']);
                const endSprint = this._data.sprints.find(s => s['Sprint'] === phase['Sprint fin']);
                if (startSprint && endSprint) {
                    const startWeeks = this._getWeeksForSprint(startSprint);
                    const endWeeks = this._getWeeksForSprint(endSprint);
                    startWeekIdx = weekCodes.indexOf(startWeeks[0]);
                    endWeekIdx = weekCodes.indexOf(endWeeks[endWeeks.length - 1]);
                }
            }

            if (startWeekIdx === undefined || startWeekIdx === -1) startWeekIdx = 0;
            if (endWeekIdx === undefined || endWeekIdx === -1) endWeekIdx = weekCodes.length - 1;

            phasePositions.push({
                phase,
                startIdx: startWeekIdx,
                endIdx: endWeekIdx,
                color: phase['Couleur'] || CONFIG.PHASE_COLORS[phase['Type phase']] || '#ccc'
            });
        });

        // Calculer les lanes (voies) pour éviter les chevauchements
        const sorted = [...phasePositions].sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);
        const lanes = [];
        sorted.forEach(pp => {
            let lane = -1;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] < pp.startIdx) { lane = i; break; }
            }
            if (lane === -1) { lane = lanes.length; lanes.push(pp.endIdx); }
            else { lanes[lane] = pp.endIdx; }
            pp.lane = lane;
        });
        const totalLanes = Math.max(lanes.length, 1);

        // Entête sprints
        const sprintsHeaderHtml = visibleSprints.map(sprint => {
            const weeksInSprint = this._getWeeksForSprint(sprint);
            const colspan = weeksInSprint.length;
            const isCurrent = this._isCurrentSprint(sprint);
            return `<th class="mini-gantt-sprint${isCurrent ? ' current-sprint' : ''}" colspan="${colspan}">${escapeHtml(sprint['Sprint'])}</th>`;
        }).join('');

        // Entête semaines
        const weeksHeaderHtml = allWeeks.map(w => {
            const isCurrent = w.weekCode === todayCode;
            const isDateFin = w.weekCode === dateFinWeekCode;
            return `<th class="mini-gantt-week${isCurrent ? ' current-week' : ''}${isDateFin ? ' date-fin-week' : ''}">${'S' + w.weekCode.slice(-2)}</th>`;
        }).join('');

        // Entête dates
        const datesHeaderHtml = allWeeks.map(w => {
            const monday = this._weekCodeToDate(w.weekCode);
            const isCurrent = w.weekCode === todayCode;
            const isDateFin = w.weekCode === dateFinWeekCode;
            return `<th class="mini-gantt-date${isCurrent ? ' current-week' : ''}${isDateFin ? ' date-fin-week' : ''}">${monday ? this._formatDateShort(monday) : ''}</th>`;
        }).join('');

        // Lignes de phases (une seule ligne avec lanes empilées)
        const cellWidth = 36; // px
        const laneHeight = 18;
        const rowHeight = totalLanes * laneHeight + 8;

        const phaseBarsHtml = allWeeks.map((w, colIdx) => {
            const isDateFin = w.weekCode === dateFinWeekCode;
            let cellContent = '';
            phasePositions.forEach(pp => {
                if (colIdx === pp.startIdx) {
                    const width = (pp.endIdx - pp.startIdx + 1);
                    const top = pp.lane * laneHeight + 2;
                    cellContent += `<div class="mini-gantt-bar" style="
                        position:absolute; left:1px; top:${top}px;
                        width:calc(${width * 100}% + ${(width - 1)}px - 2px);
                        height:${laneHeight - 2}px;
                        background:${pp.color};
                        border-radius:3px;
                        font-size:9px;
                        line-height:${laneHeight - 2}px;
                        padding:0 3px;
                        overflow:hidden;
                        white-space:nowrap;
                        text-overflow:ellipsis;
                        z-index:1;
                    " title="${escapeHtml(pp.phase['Phase'])}">${escapeHtml(pp.phase['Phase'])}</div>`;
                }
            });
            return `<td class="mini-gantt-cell${isDateFin ? ' date-fin-week' : ''}" style="position:relative;height:${rowHeight}px;">${cellContent}</td>`;
        }).join('');

        const html = `
            <div class="mini-gantt-label">Roadmap</div>
            <div class="mini-gantt-wrapper">
                <table class="mini-gantt-table">
                    <thead>
                        <tr>${sprintsHeaderHtml}</tr>
                        <tr>${weeksHeaderHtml}</tr>
                        <tr>${datesHeaderHtml}</tr>
                    </thead>
                    <tbody>
                        <tr>${phaseBarsHtml}</tr>
                    </tbody>
                </table>
            </div>
        `;
        containers.forEach(c => c.innerHTML = html);
    },

    // ==========================================
    // HELPERS SEMAINES (pour mini roadmap)
    // ==========================================

    _getISOWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const year = d.getUTCFullYear();
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return { year, week: weekNo };
    },

    _formatWeekCode(date) {
        const { year, week } = this._getISOWeekNumber(date);
        return `${year}S${String(week).padStart(2, '0')}`;
    },

    _weekCodeToDate(weekCode) {
        if (!weekCode || typeof weekCode !== 'string') return null;
        const match = weekCode.match(/^(\d{4})S(\d{2})$/);
        if (!match) return null;
        const year = parseInt(match[1]);
        const week = parseInt(match[2]);
        const jan4 = new Date(year, 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        const firstThursday = new Date(jan4);
        firstThursday.setDate(jan4.getDate() - dayOfWeek + 4);
        const firstMonday = new Date(firstThursday);
        firstMonday.setDate(firstThursday.getDate() - 3);
        const targetMonday = new Date(firstMonday);
        targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
        return targetMonday;
    },

    _getWeeksForSprint(sprint) {
        const weeks = [];
        const startDate = this._parseDate(sprint['Début']);
        const endDate = this._parseDate(sprint['Fin']);
        if (!startDate || !endDate) return weeks;

        startDate.setHours(12, 0, 0, 0);
        endDate.setHours(12, 0, 0, 0);

        let currentDate = new Date(startDate);
        currentDate.setHours(12, 0, 0, 0);
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
        } else if (dayOfWeek !== 1) {
            currentDate.setDate(currentDate.getDate() + (8 - dayOfWeek));
        }

        while (currentDate < endDate) {
            weeks.push(this._formatWeekCode(currentDate));
            currentDate.setDate(currentDate.getDate() + 7);
        }
        return weeks;
    },

    _isCurrentSprint(sprint) {
        if (!sprint || !sprint['Début'] || !sprint['Fin']) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = this._parseDate(sprint['Début']);
        start.setHours(0, 0, 0, 0);
        const end = this._parseDate(sprint['Fin']);
        end.setHours(23, 59, 59, 999);
        return today >= start && today <= end;
    },

    // ==========================================
    // DESCRIPTION - ÉDITEUR RICHE
    // ==========================================

    execDescriptionCommand(command) {
        document.execCommand(command, false, null);
        const editor = document.getElementById('descriptionEditor');
        if (editor) editor.focus();
    },

    // ==========================================
    // ENJEUX - ÉDITEUR RICHE
    // ==========================================

    execEnjeuxCommand(command) {
        document.execCommand(command, false, null);
        const editor = document.getElementById('enjeuxEditor');
        if (editor) editor.focus();
    },

    // ==========================================
    // SECTION LIENS
    // ==========================================

    _renderLiensList(suffix) {
        const container = document.getElementById(`chantierLiens${suffix}`);
        if (!container) return;

        if (this._state.liens.length === 0) {
            container.innerHTML = '<div class="assigned-items-empty">Aucun lien</div>';
            return;
        }

        container.innerHTML = this._state.liens.map((lien, index) => {
            const hasUrl = lien['Lien'] && lien['Lien'].trim() !== '';
            return `
            <div class="mae-lien-row" data-index="${index}">
                ${hasUrl
                    ? `<a href="${escapeHtml(lien['Lien'])}" target="_blank" rel="noopener noreferrer" class="btn-open-lien" title="Ouvrir le lien">&#128279;</a>`
                    : `<span class="btn-open-lien disabled">&#128279;</span>`
                }
                <input type="text" class="form-control" placeholder="Nom du lien"
                       value="${escapeHtml(lien['Nom lien'] || '')}"
                       data-field="nom"
                       onchange="ChantierModal.updateLien(${index}, 'nom', this.value)">
                <input type="text" class="form-control" placeholder="URL"
                       value="${escapeHtml(lien['Lien'] || '')}"
                       data-field="url"
                       onchange="ChantierModal.updateLien(${index}, 'url', this.value)">
                <button type="button" class="btn-remove-lien"
                        onclick="ChantierModal.removeLien(${index})"
                        title="Supprimer">&#10005;</button>
            </div>
        `;}).join('');
    },

    addLienRow() {
        this._state.liens.push({ 'Nom lien': '', 'Lien': '' });
        const suffix = this._state.mode === 'edit' ? 'Edit' : 'Add';
        this._renderLiensList(suffix);
    },

    updateLien(index, field, value) {
        if (field === 'nom') {
            this._state.liens[index]['Nom lien'] = value;
        } else {
            this._state.liens[index]['Lien'] = value;
            // Re-render pour mettre à jour l'icône de lien
            const suffix = this._state.mode === 'edit' ? 'Edit' : 'Add';
            this._renderLiensList(suffix);
        }
    },

    removeLien(index) {
        this._state.liens.splice(index, 1);
        const suffix = this._state.mode === 'edit' ? 'Edit' : 'Add';
        this._renderLiensList(suffix);
    },

    _collectLiens() {
        const suffix = this._state.mode === 'edit' ? 'Edit' : 'Add';
        const rows = document.querySelectorAll(`#chantierLiens${suffix} .mae-lien-row`);
        const liens = [];
        rows.forEach(row => {
            const nom = row.querySelector('[data-field="nom"]')?.value || '';
            const url = row.querySelector('[data-field="url"]')?.value || '';
            if (nom || url) {
                liens.push({ 'Nom lien': nom, 'Lien': url });
            }
        });
        return liens;
    },

    // ==========================================
    // SECTION MAE
    // ==========================================

    _renderAssignedMAE(suffix) {
        const container = document.getElementById(`assignedMAE${suffix}`);
        if (!container) return;

        if (this._state.selectedMAE.length === 0) {
            container.innerHTML = '<div class="assigned-items-empty">Aucun MAE assigné</div>';
            return;
        }

        container.innerHTML = this._state.selectedMAE.map(numero => {
            const mae = this._data.mae.find(m => m['Numero'] === numero);
            const nomDisplay = mae ? (mae['Nom'] || '') : '';
            return `
                <div class="assigned-item" data-mae="${escapeHtml(numero)}">
                    <div class="assigned-item-info assigned-item-clickable" onclick="ChantierModal.openMAEModal('${escapeJsString(numero)}')" title="Ouvrir la fiche">
                        <div class="assigned-item-name">${escapeHtml(numero)}</div>
                        ${nomDisplay ? `<div class="assigned-item-detail">${escapeHtml(nomDisplay)}</div>` : ''}
                    </div>
                    <div class="assigned-item-actions">
                        <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="ChantierModal.removeAssignedMAE('${escapeJsString(numero)}')">&#10005;</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    removeAssignedMAE(numero) {
        const idx = this._state.selectedMAE.indexOf(numero);
        if (idx > -1) {
            this._state.selectedMAE.splice(idx, 1);
            if (this._state.renderMAE) {
                this._state.renderMAE();
            }
        }
    },

    showSelectMAEModal() {
        const selectedMAE = this._state.selectedMAE;

        const selectedMAEData = this._data.mae.filter(m => selectedMAE.includes(m['Numero']));
        const unselectedMAEData = this._data.mae.filter(m => !selectedMAE.includes(m['Numero']));

        selectedMAEData.sort((a, b) => (a['Numero'] || '').localeCompare(b['Numero'] || ''));
        unselectedMAEData.sort((a, b) => (a['Numero'] || '').localeCompare(b['Numero'] || ''));

        const renderList = (searchTerm = '') => {
            const list = document.getElementById('selectionMAEList');
            if (!list) return;

            const term = searchTerm.toLowerCase();
            const filteredSelected = selectedMAEData.filter(m =>
                (m['Numero'] || '').toLowerCase().includes(term) ||
                (m['Nom'] || '').toLowerCase().includes(term)
            );
            const filteredUnselected = unselectedMAEData.filter(m =>
                (m['Numero'] || '').toLowerCase().includes(term) ||
                (m['Nom'] || '').toLowerCase().includes(term)
            );

            let html = '';

            if (filteredSelected.length > 0) {
                html += '<div class="selection-separator">Sélectionnés</div>';
                html += filteredSelected.map(m => `
                    <label class="selection-item selected">
                        <input type="checkbox" value="${escapeHtml(m['Numero'])}" checked>
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(m['Numero'])}</div>
                            ${m['Nom'] ? `<div class="selection-item-detail">${escapeHtml(m['Nom'])}</div>` : ''}
                        </div>
                    </label>
                `).join('');
            }

            if (filteredUnselected.length > 0) {
                html += '<div class="selection-separator">Disponibles</div>';
                html += filteredUnselected.map(m => `
                    <label class="selection-item">
                        <input type="checkbox" value="${escapeHtml(m['Numero'])}">
                        <div class="selection-item-info">
                            <div class="selection-item-name">${escapeHtml(m['Numero'])}</div>
                            ${m['Nom'] ? `<div class="selection-item-detail">${escapeHtml(m['Nom'])}</div>` : ''}
                        </div>
                    </label>
                `).join('');
            }

            if (html === '') {
                html = '<div class="selection-empty">Aucun MAE trouvé</div>';
            }

            list.innerHTML = html;
        };

        const content = `
            <div class="selection-modal">
                <div class="selection-search">
                    <input type="text" class="form-control" id="searchMAEInput" placeholder="Rechercher un MAE...">
                </div>
                <div class="selection-list" id="selectionMAEList"></div>
            </div>
        `;

        showModal({
            title: 'Sélectionner des MAE',
            content: content,
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Valider',
                    class: 'btn-primary',
                    action: (modal) => {
                        const checkboxes = document.querySelectorAll('#selectionMAEList input[type="checkbox"]:checked');
                        this._state.selectedMAE = Array.from(checkboxes).map(cb => cb.value);
                        if (this._state.renderMAE) {
                            this._state.renderMAE();
                        }
                        return true;
                    }
                }
            ]
        });

        setTimeout(() => {
            renderList();
            const searchInput = document.getElementById('searchMAEInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
            }
        }, 100);
    },

    // ==========================================
    // ONGLET NOTES (inchangé)
    // ==========================================

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

    showAddNoteForm() {
        this._state.editingNoteIndex = null;
        this._showNoteForm(null);
    },

    showEditNoteForm(index) {
        this._state.editingNoteIndex = index;
        const note = this._state.notes[index];
        this._showNoteForm(note);
    },

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

        setTimeout(() => {
            const editor = document.getElementById('noteEditor');
            if (editor) editor.focus();
        }, 100);
    },

    hideNoteForm() {
        const container = document.getElementById('noteFormContainer');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        this._state.editingNoteIndex = null;
    },

    execRichTextCommand(command) {
        document.execCommand(command, false, null);
        const editor = document.getElementById('noteEditor');
        if (editor) editor.focus();
    },

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
                const existingNote = this._state.notes[this._state.editingNoteIndex];
                if (existingNote._rowIndex !== undefined) {
                    await updateTableRow('tChantierNote', existingNote._rowIndex, noteData);
                    invalidateCache('tChantierNote');
                    showSuccess('Note modifiée');
                }
            } else {
                await addTableRow('tChantierNote', noteData);
                invalidateCache('tChantierNote');
                showSuccess('Note ajoutée');
            }

            await this._reloadNotes();
            this.hideNoteForm();
            this._renderNotesList();
            this._updateNotesBadge();
        } catch (error) {
            console.error('Erreur sauvegarde note:', error);
            showError('Erreur lors de la sauvegarde de la note');
        }
    },

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

    async _deleteNote(index) {
        try {
            const note = this._state.notes[index];
            if (note._rowIndex !== undefined) {
                await deleteTableRow('tChantierNote', note._rowIndex);
                invalidateCache('tChantierNote');
                showSuccess('Note supprimée');

                await this._reloadNotes();
                this._renderNotesList();
                this._updateNotesBadge();
            }
        } catch (error) {
            console.error('Erreur suppression note:', error);
            showError('Erreur lors de la suppression de la note');
        }
    },

    async _reloadNotes() {
        try {
            const notesData = await readTable('tChantierNote');
            this._data.chantierNotes = notesData.data || [];

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

    _updateNotesBadge() {
        const badge = document.getElementById('notesBadge');
        if (badge) {
            badge.textContent = this._state.notes.length > 0 ? this._state.notes.length : '';
        }
    },

    // ==========================================
    // OUVERTURE MODALES ASSOCIATIONS
    // ==========================================

    openProduitModal(produitName) {
        const produit = this._data.produits.find(p => p['Nom'] === produitName);
        if (!produit || produit._rowIndex === undefined) return;

        const fields = CONFIG.TABLES.PRODUITS.columns;
        const initialData = { ...produit };
        delete initialData._rowIndex;

        showFormModal('Modifier le produit', fields, async (formData) => {
            try {
                await updateTableRow('tProduits', produit._rowIndex, formData);
                invalidateCache('tProduits');
                showSuccess('Produit modifié');
                const produitsData = await readTable('tProduits');
                this._data.produits = produitsData.data || [];
                if (this._state.renderProduits) this._state.renderProduits();
                return true;
            } catch (error) {
                console.error('Erreur modification produit:', error);
                showError('Erreur lors de la modification du produit');
                return false;
            }
        }, initialData);
    },

    openDataAnaModal(dataAnaKey) {
        const dataAna = this._data.dataAnas.find(d => d['Clé'] === dataAnaKey);
        if (!dataAna || dataAna._rowIndex === undefined) return;

        const fields = CONFIG.TABLES.DATAANA.columns;
        const initialData = { ...dataAna };
        delete initialData._rowIndex;

        showFormModal('Modifier le DataAna', fields, async (formData) => {
            try {
                await updateTableRow('tDataAnas', dataAna._rowIndex, formData);
                invalidateCache('tDataAnas');
                showSuccess('DataAna modifié');
                const dataAnasData = await readTable('tDataAnas');
                this._data.dataAnas = dataAnasData.data || [];
                if (this._state.renderDataAnas) this._state.renderDataAnas();
                return true;
            } catch (error) {
                console.error('Erreur modification DataAna:', error);
                showError('Erreur lors de la modification du DataAna');
                return false;
            }
        }, initialData);
    },

    openMAEModal(numero) {
        if (typeof MAEModal !== 'undefined' && MAEModal.showEditModal) {
            MAEModal.showEditModal(numero, async () => {
                const maeData = await readTable('tMAE');
                this._data.mae = maeData.data || [];
                if (this._state.renderMAE) this._state.renderMAE();
            });
        }
    },

    // ==========================================
    // SAUVEGARDE
    // ==========================================

    async _saveChantier(modal, isEdit) {
        const form = document.getElementById('formChantierModal');
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }

        const formData = new FormData(form);

        // Récupérer le contenu Description depuis l'éditeur riche
        const descriptionEditor = document.getElementById('descriptionEditor');
        const descriptionContent = descriptionEditor ? descriptionEditor.innerHTML.trim() : '';
        const descriptionValue = (descriptionContent === '<br>' || descriptionContent === '<br/>' || descriptionContent === '') ? '' : descriptionContent;

        // Récupérer le contenu Enjeux depuis l'éditeur riche
        const enjeuxEditor = document.getElementById('enjeuxEditor');
        const enjeuxContent = enjeuxEditor ? enjeuxEditor.innerHTML.trim() : '';
        // Nettoyer le contenu vide
        const enjeuxValue = (enjeuxContent === '<br>' || enjeuxContent === '<br/>' || enjeuxContent === '') ? '' : enjeuxContent;

        const chantierData = {
            'Chantier': formData.get('Chantier'),
            'Code': formData.get('Code') || '',
            'Description': descriptionValue,
            'Responsable': formData.get('Responsable'),
            'Perimetre': formData.get('Perimetre'),
            'Programme': formData.get('Programme') || '',
            'Processus': formData.get('Processus'),
            'Avancement': formData.get('Avancement') || '',
            'Date fin souhaitée': formData.get('Date fin souhaitée') || '',
            'JH Vigie': formData.get('JH Vigie') ? parseFloat(formData.get('JH Vigie')) : '',
            'JH Pilotage': formData.get('JH Pilotage') ? parseFloat(formData.get('JH Pilotage')) : '',
            'Archivé': form.querySelector('input[name="Archivé"]').checked ? true : false,
            'Enjeux': enjeuxValue
        };

        // NumChantier : générer pour un nouveau chantier, préserver pour un existant
        if (!isEdit) {
            chantierData['NumChantier'] = this._generateNumChantier();
        } else {
            const existingChantier = this._data.chantiers.find(c => c['Chantier'] === this._state.chantierName);
            chantierData['NumChantier'] = (existingChantier && existingChantier['NumChantier']) || '';
        }

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
                    if (!this._state.selectedDataAnas.includes(dataAna['Clé'])) {
                        if (dataAna._rowIndex !== undefined && dataAna._rowIndex !== null) {
                            const updatedData = { ...dataAna, 'Chantier': '' };
                            delete updatedData._rowIndex;
                            await updateTableRow('tDataAnas', dataAna._rowIndex, updatedData);
                        }
                    }
                }

                // Mettre à jour les MAE : vider le champ Chantier pour ceux qui ne sont plus sélectionnés
                const previouslySelectedMAE = this._data.mae
                    .filter(m => m['Chantier'] === this._state.chantierName);

                for (const mae of previouslySelectedMAE) {
                    if (!this._state.selectedMAE.includes(mae['Numero'])) {
                        if (mae._rowIndex !== undefined && mae._rowIndex !== null) {
                            const updatedData = { ...mae, 'Chantier': '' };
                            delete updatedData._rowIndex;
                            await updateTableRow('tMAE', mae._rowIndex, updatedData);
                        }
                    }
                }

                // Supprimer les anciens liens chantier (en ordre inverse)
                const oldLiens = this._data.chantierLien
                    .filter(l => l['Chantier'] === this._state.chantierName)
                    .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                for (const lien of oldLiens) {
                    if (lien._rowIndex !== undefined && lien._rowIndex !== null) {
                        await deleteTableRow('tChantierLien', lien._rowIndex);
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
                    if (dataAna['Chantier'] !== chantierData['Chantier']) {
                        const updatedData = { ...dataAna, 'Chantier': chantierData['Chantier'] };
                        delete updatedData._rowIndex;
                        await updateTableRow('tDataAnas', dataAna._rowIndex, updatedData);
                    }
                }
            }
            invalidateCache('tDataAnas');

            // Mettre à jour le champ Chantier des MAE sélectionnés
            for (const maeNumero of this._state.selectedMAE) {
                const mae = this._data.mae.find(m => m['Numero'] === maeNumero);
                if (mae && mae._rowIndex !== undefined && mae._rowIndex !== null) {
                    if (mae['Chantier'] !== chantierData['Chantier']) {
                        const updatedData = { ...mae, 'Chantier': chantierData['Chantier'] };
                        delete updatedData._rowIndex;
                        await updateTableRow('tMAE', mae._rowIndex, updatedData);
                    }
                }
            }
            invalidateCache('tMAE');

            // Ajouter les nouveaux liens du chantier
            const currentLiens = this._collectLiens();
            for (const lien of currentLiens) {
                await addTableRow('tChantierLien', {
                    'Chantier': chantierData['Chantier'],
                    'Nom lien': lien['Nom lien'],
                    'Lien': lien['Lien']
                });
            }
            invalidateCache('tChantierLien');

            showSuccess(isEdit ? 'Chantier modifié avec succès' : 'Chantier ajouté avec succès');

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

    // ==========================================
    // SECTIONS PRODUITS ET DATAANAS (existantes)
    // ==========================================

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
                    <div class="assigned-item-info assigned-item-clickable" onclick="ChantierModal.openProduitModal('${escapeJsString(produitName)}')" title="Ouvrir la fiche">
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
                    <div class="assigned-item-info assigned-item-clickable" onclick="ChantierModal.openDataAnaModal('${escapeJsString(dataAnaKey)}')" title="Ouvrir la fiche">
                        <a href="${escapeHtml(jiraUrl)}" target="_blank" rel="noopener noreferrer" class="assigned-item-link" onclick="event.stopPropagation()">${escapeHtml(dataAnaKey)}</a>
                        ${dataAna && dataAna['Résumé'] ? `<div class="assigned-item-detail">${escapeHtml(dataAna['Résumé'])}</div>` : ''}
                    </div>
                    <div class="assigned-item-actions">
                        <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="ChantierModal.removeAssignedDataAna('${escapeJsString(dataAnaKey)}')">&#10005;</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    removeAssignedProduit(produitName) {
        const idx = this._state.selectedProduits.indexOf(produitName);
        if (idx > -1) {
            this._state.selectedProduits.splice(idx, 1);
            if (this._state.renderProduits) {
                this._state.renderProduits();
            }
        }
    },

    removeAssignedDataAna(dataAnaKey) {
        const idx = this._state.selectedDataAnas.indexOf(dataAnaKey);
        if (idx > -1) {
            this._state.selectedDataAnas.splice(idx, 1);
            if (this._state.renderDataAnas) {
                this._state.renderDataAnas();
            }
        }
    },

    showSelectProduitsModal() {
        const selectedProduits = this._state.selectedProduits;

        const selectedProduitsData = this._data.produits.filter(p => selectedProduits.includes(p['Nom']));
        const unselectedProduitsData = this._data.produits.filter(p => !selectedProduits.includes(p['Nom']));

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

    showSelectDataAnasModal() {
        const selectedDataAnas = this._state.selectedDataAnas;

        const selectedDataAnasData = this._data.dataAnas.filter(d => selectedDataAnas.includes(d['Clé']));
        const unselectedDataAnasData = this._data.dataAnas.filter(d => !selectedDataAnas.includes(d['Clé']));

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
