/* ===========================================
   MAE-MODAL.JS - Modale fiche demande MAE
   Application Carto
   =========================================== */

const MAEModal = {
    _data: {
        acteurs: [],
        perimetres: [],
        demandes: [],
        notes: [],
        liens: []
    },

    _state: {
        mode: null, // 'add' ou 'edit'
        activeTab: 'demande',
        currentDemande: null,
        currentNumero: null,
        rowIndex: null,
        notes: [],
        liens: [],
        editingNoteIndex: null,
        onSuccess: null
    },

    // ---- Chargement des donnees ----

    async loadData() {
        try {
            const [acteursData, perimetresData, demandesData, notesData, liensData] = await Promise.all([
                readTable('tActeurs'),
                readTable('tPerimetres'),
                readTable('tMAE'),
                readTable('tMAENote'),
                readTable('tMAELien')
            ]);

            this._data.acteurs = acteursData.data || [];
            this._data.perimetres = perimetresData.data || [];
            this._data.demandes = demandesData.data || [];
            this._data.notes = notesData.data || [];
            this._data.liens = liensData.data || [];

            return true;
        } catch (error) {
            console.error('Erreur chargement données MAEModal:', error);
            return false;
        }
    },

    // ---- Generation du numero ----

    generateNumero() {
        const year = new Date().getFullYear();
        const prefix = year + '_';
        const existing = this._data.demandes
            .filter(d => d['Numero'] && d['Numero'].startsWith(prefix))
            .map(d => {
                const num = parseInt(d['Numero'].substring(prefix.length), 10);
                return isNaN(num) ? 0 : num;
            });

        const maxNum = existing.length > 0 ? Math.max(...existing) : 0;
        const next = (maxNum + 1).toString().padStart(3, '0');
        return prefix + next;
    },

    // ---- Utilitaires ----

    _getActeurDisplay(mail) {
        if (!mail) return '';
        const acteur = this._data.acteurs.find(a => a['Mail'] === mail);
        return acteur ? `${acteur['Prénom'] || ''} ${acteur['Nom'] || ''}`.trim() : mail;
    },

    _getDataActeurs() {
        return this._data.acteurs.filter(a => a['Equipe'] === 'Data');
    },

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

    _formatDateTime(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) + ' ' + date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    _formatDateForInput(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        return date.toISOString().split('T')[0];
    },

    _formatDateTimeForInput(dateValue) {
        const date = this._parseDate(dateValue);
        if (date.getTime() === 0) return '';
        const pad = n => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    },

    _getStatutIndex(statut) {
        const found = CONFIG.MAE_STATUTS.find(s => s.value === statut);
        return found ? found.index : 0;
    },

    _getStatusBadgeClass(statut) {
        switch (statut) {
            case 'Création': return 'creation';
            case 'Infos Data': return 'infos-data';
            case 'Validation': return 'validation';
            case 'Prêt pour démarrer': return 'pret';
            case 'En cours': return 'en-cours';
            case 'En recette': return 'en-recette';
            case 'Terminé': return 'termine';
            default: return 'creation';
        }
    },

    // ---- Rendu du pipeline header ----

    _renderPipelineHeader(currentStatut) {
        const currentIndex = this._getStatutIndex(currentStatut);
        return `
            <div class="mae-modal-pipeline">
                ${CONFIG.MAE_STATUTS.map((step, i) => {
                    let stepClass = '';
                    let isDisabled = false;

                    if (i < currentIndex) {
                        stepClass = 'completed';
                    } else if (i === currentIndex) {
                        stepClass = 'current';
                    }

                    // Steps 0-1 (Création, Infos Data) toujours non-cliquables
                    if (i <= 1) {
                        isDisabled = true;
                    }
                    // Étapes futures non-cliquables
                    else if (i > currentIndex) {
                        isDisabled = true;
                    }
                    // Si on est encore dans les 2 premières étapes, tout désactivé
                    else if (currentIndex < 2) {
                        isDisabled = true;
                    }

                    return `
                        ${i > 0 ? '<div class="mae-pipeline-arrow">&#9654;</div>' : ''}
                        <div class="mae-pipeline-step ${stepClass} ${isDisabled ? 'disabled' : ''}"
                             data-step-index="${i}"
                             onclick="MAEModal.onStepClick(${i})"
                             title="${step.label}">
                            <div class="mae-pipeline-step-box">
                                <span class="step-label">${escapeHtml(step.label)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ---- Clic sur une etape du pipeline ----

    async onStepClick(targetIndex) {
        if (this._state.mode === 'add') return;

        const currentStatut = this._state.currentDemande['Statut'] || 'Création';
        const currentIndex = this._getStatutIndex(currentStatut);

        // Pas de clic sur les 2 premières étapes
        if (targetIndex <= 1) return;

        // Pas de clic si on est encore dans les 2 premières étapes
        if (currentIndex < 2) return;

        // Pas de saut vers une étape future
        if (targetIndex > currentIndex) return;

        let newStatut;

        if (targetIndex === currentIndex) {
            // Clic sur l'étape courante (orange) → avancer à la suivante
            if (currentIndex >= CONFIG.MAE_STATUTS.length - 1) return; // Déjà à la dernière étape
            newStatut = CONFIG.MAE_STATUTS[currentIndex + 1].value;
        } else {
            // Retour à une étape précédente (>= 2) → elle redevient orange, les suivantes transparentes
            newStatut = CONFIG.MAE_STATUTS[targetIndex].value;
        }

        try {
            this._state.currentDemande['Statut'] = newStatut;
            await updateTableRow('tMAE', this._state.rowIndex, this._getSaveData());
            invalidateCache('tMAE');

            // Mettre a jour le pipeline dans la modale
            const pipelineContainer = document.querySelector('.mae-modal-pipeline');
            if (pipelineContainer) {
                pipelineContainer.outerHTML = this._renderPipelineHeader(newStatut);
            }

            // Mettre à jour le bouton validation si nécessaire
            const validationSection = document.querySelector('.mae-validation-section');
            if (validationSection) {
                validationSection.outerHTML = this._renderValidationButton();
            }

            showSuccess(`Statut mis à jour : ${newStatut}`);

            if (this._state.onSuccess) {
                await this._state.onSuccess();
            }
        } catch (error) {
            console.error('Erreur mise à jour statut:', error);
            showError('Erreur lors de la mise à jour du statut');
        }
    },

    // ---- Modale Ajout ----

    async showAddModal(onSuccess = null) {
        await this.loadData();

        this._state.mode = 'add';
        this._state.onSuccess = onSuccess;
        this._state.activeTab = 'demande';
        this._state.currentDemande = null;
        this._state.currentNumero = this.generateNumero();
        this._state.notes = [];
        this._state.liens = [];
        this._state.editingNoteIndex = null;

        const content = this._buildModalContent('Création');

        showModal({
            title: 'Nouvelle demande MAE',
            content: content,
            size: 'xl',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Créer la demande',
                    class: 'btn-primary',
                    action: async () => {
                        return await this._saveDemande(false);
                    }
                }
            ]
        });
    },

    // ---- Modale Edition ----

    async showEditModal(numero, onSuccess = null) {
        await this.loadData();

        const demande = this._data.demandes.find(d => d['Numero'] === numero);
        if (!demande) {
            showError('Demande non trouvée');
            return;
        }

        this._state.mode = 'edit';
        this._state.onSuccess = onSuccess;
        this._state.activeTab = 'demande';
        this._state.currentDemande = demande;
        this._state.currentNumero = numero;
        this._state.rowIndex = demande._rowIndex;
        this._state.editingNoteIndex = null;

        // Notes de cette demande
        this._state.notes = this._data.notes
            .filter(n => n['Numero'] === numero)
            .sort((a, b) => {
                const dateA = this._parseDate(a['Date']);
                const dateB = this._parseDate(b['Date']);
                return dateB - dateA;
            });

        // Liens de cette demande
        this._state.liens = this._data.liens.filter(l => l['Numero'] === numero);

        const currentStatut = demande['Statut'] || 'Création';
        const content = this._buildModalContent(currentStatut);

        showModal({
            title: `Demande ${escapeHtml(numero)}`,
            content: content,
            size: 'xl',
            buttons: [
                { label: 'Fermer', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Enregistrer',
                    class: 'btn-primary',
                    action: async () => {
                        return await this._saveDemande(true);
                    }
                }
            ]
        });

        setTimeout(() => {
            this._renderNotesList();
            this._renderLiensList();
        }, 100);
    },

    // ---- Construction du contenu de la modale ----

    _buildModalContent(currentStatut) {
        const isEdit = this._state.mode === 'edit';
        const d = this._state.currentDemande || {};
        const dataActeurs = this._getDataActeurs();
        const allActeurs = this._data.acteurs;

        return `
            ${isEdit ? this._renderPipelineHeader(currentStatut) : ''}

            <!-- Onglets -->
            <div class="mae-modal-tabs">
                <button type="button" class="mae-modal-tab active" data-tab="demande" onclick="MAEModal.switchTab('demande')">
                    Demande
                </button>
                <button type="button" class="mae-modal-tab" data-tab="data" onclick="MAEModal.switchTab('data')">
                    Data
                </button>
                <button type="button" class="mae-modal-tab" data-tab="notes" onclick="MAEModal.switchTab('notes')">
                    Notes <span class="tab-badge" id="maeNotesBadge">${this._state.notes.length > 0 ? this._state.notes.length : ''}</span>
                </button>
            </div>

            <!-- Onglet Demande -->
            <div class="mae-modal-tab-content active" id="maeTabDemande">
                <form id="formMAEDemande" class="form">
                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">Numéro</label>
                            <div class="form-control-readonly" id="maeNumero">${escapeHtml(this._state.currentNumero)}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Priorité</label>
                            <select class="form-control" name="Priorité">
                                <option value="">-- Sélectionner --</option>
                                ${CONFIG.MAE_PRIORITES.map(p => `
                                    <option value="${p}" ${d['Priorité'] === p ? 'selected' : ''}>${p}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label required">Nom de la modification</label>
                        <input type="text" class="form-control" name="Nom" value="${escapeHtml(d['Nom'] || '')}">
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label required">Périmètre</label>
                            <select class="form-control" name="Perimetre">
                                <option value="">-- Sélectionner --</option>
                                ${this._data.perimetres.map(p => `
                                    <option value="${escapeHtml(p['Périmetre'])}" ${d['Perimetre'] === p['Périmetre'] ? 'selected' : ''}>
                                        ${escapeHtml(p['Périmetre'])}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Demandeur</label>
                            <select class="form-control" name="Demandeur">
                                <option value="">-- Sélectionner --</option>
                                ${allActeurs.map(a => `
                                    <option value="${escapeHtml(a['Mail'])}" ${d['Demandeur'] === a['Mail'] ? 'selected' : ''}>
                                        ${escapeHtml(a['Prénom'] || '')} ${escapeHtml(a['Nom'] || '')}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label required">Date de la demande</label>
                            <input type="date" class="form-control" name="Date demande" value="${this._formatDateForInput(d['Date demande']) || new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Date souhaitée de livraison</label>
                            <input type="date" class="form-control" name="Date souhaitée" value="${this._formatDateForInput(d['Date souhaitée'])}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label required">Description</label>
                        <textarea class="form-control" name="Description" rows="4" style="white-space: pre-wrap;">${escapeHtml(d['Description'] || '')}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label required">Impact</label>
                        <textarea class="form-control" name="Impact" rows="3" style="white-space: pre-wrap;">${escapeHtml(d['Impact'] || '')}</textarea>
                    </div>
                </form>
            </div>

            <!-- Onglet Data -->
            <div class="mae-modal-tab-content" id="maeTabData">
                <form id="formMAEData" class="form">
                    <!-- Liens -->
                    <div class="mae-liens-section">
                        <div class="mae-liens-header">
                            <h4>Liens</h4>
                            <button type="button" class="btn btn-sm btn-primary" onclick="MAEModal.addLienRow()">
                                + Ajouter un lien
                            </button>
                        </div>
                        <div id="maeLiensList">
                            <!-- Liens dynamiques -->
                        </div>
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">Pris en charge par</label>
                            <select class="form-control" name="Pris en charge par">
                                <option value="">-- Sélectionner --</option>
                                ${dataActeurs.map(a => `
                                    <option value="${escapeHtml(a['Mail'])}" ${d['Pris en charge par'] === a['Mail'] ? 'selected' : ''}>
                                        ${escapeHtml(a['Prénom'] || '')} ${escapeHtml(a['Nom'] || '')}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Équipe</label>
                            <select class="form-control" name="Equipe">
                                <option value="">-- Sélectionner --</option>
                                ${CONFIG.MAE_EQUIPES.map(e => `
                                    <option value="${e}" ${d['Equipe'] === e ? 'selected' : ''}>${e}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Gold</label>
                        <textarea class="form-control" name="Gold" rows="3">${escapeHtml(d['Gold'] || '')}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Date de livraison estimée</label>
                        <input type="date" class="form-control" name="Date livraison estimée" value="${this._formatDateForInput(d['Date livraison estimée'])}">
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">JH DE</label>
                            <input type="number" class="form-control" name="JH DE" step="0.01" min="0" value="${d['JH DE'] != null && d['JH DE'] !== '' ? d['JH DE'] : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">JH DA</label>
                            <input type="number" class="form-control" name="JH DA" step="0.01" min="0" value="${d['JH DA'] != null && d['JH DA'] !== '' ? d['JH DA'] : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">JH DATA VIZ</label>
                            <input type="number" class="form-control" name="JH DATA VIZ" step="0.01" min="0" value="${d['JH DATA VIZ'] != null && d['JH DATA VIZ'] !== '' ? d['JH DATA VIZ'] : ''}">
                        </div>
                    </div>

                    ${this._renderValidationButton()}
                </form>
            </div>

            <!-- Onglet Notes -->
            <div class="mae-modal-tab-content" id="maeTabNotes">
                <div class="mae-notes-section">
                    <div class="notes-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h4 style="margin:0;color:var(--mh-bleu-fonce);">Notes</h4>
                        <button type="button" class="btn btn-sm btn-primary" onclick="MAEModal.showAddNoteForm()">
                            + Ajouter une note
                        </button>
                    </div>
                    <div id="maeNoteFormContainer" style="display: none;"></div>
                    <div id="maeNotesList"></div>
                </div>
            </div>
        `;
    },

    // ---- Bouton validation metier ----

    _renderValidationButton() {
        if (this._state.mode !== 'edit') return '';
        const currentStatut = this._state.currentDemande ? this._state.currentDemande['Statut'] : 'Création';

        if (currentStatut === 'Création') {
            return `
                <div class="mae-validation-section">
                    <button type="button" class="btn btn-success btn-validate" onclick="MAEModal.advanceToInfosData()">
                        Passer à Infos Data
                    </button>
                </div>
            `;
        }

        if (currentStatut === 'Infos Data') {
            return `
                <div class="mae-validation-section">
                    <button type="button" class="btn btn-success btn-validate" onclick="MAEModal.validateMetier()">
                        Passer à Validation
                    </button>
                </div>
            `;
        }

        return '';
    },

    // ---- Avancer a Infos Data ----

    async advanceToInfosData() {
        // Valider tous les champs de l'onglet Demande
        const form = document.getElementById('formMAEDemande');
        const fields = ['Nom', 'Perimetre', 'Demandeur', 'Date demande', 'Date souhaitée', 'Priorité', 'Description', 'Impact'];

        for (const field of fields) {
            const el = form.querySelector(`[name="${field}"]`);
            if (!el || !el.value || el.value.trim() === '') {
                showError(`Le champ "${field}" est obligatoire`);
                this.switchTab('demande');
                if (el) el.focus();
                return;
            }
        }

        // Sauvegarder d'abord
        const saved = await this._saveDemande(true, 'Infos Data');
        if (saved) {
            showSuccess('Statut mis à jour : Infos Data');
        }
    },

    // ---- Validation Metier ----

    async validateMetier() {
        // Valider les champs Data obligatoires
        const form = document.getElementById('formMAEData');
        const requiredDataFields = ['Pris en charge par', 'Equipe'];

        for (const field of requiredDataFields) {
            const el = form.querySelector(`[name="${field}"]`);
            if (!el || !el.value || el.value.trim() === '') {
                showError(`Le champ "${field}" est obligatoire pour la validation`);
                if (el) el.focus();
                return;
            }
        }

        const saved = await this._saveDemande(true, 'Validation');
        if (saved) {
            showSuccess('Statut mis à jour : Validation');
        }
    },

    // ---- Gestion des onglets ----

    switchTab(tabName) {
        this._state.activeTab = tabName;

        document.querySelectorAll('.mae-modal-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.getElementById('maeTabDemande').classList.toggle('active', tabName === 'demande');
        document.getElementById('maeTabData').classList.toggle('active', tabName === 'data');
        document.getElementById('maeTabNotes').classList.toggle('active', tabName === 'notes');

        if (tabName === 'notes') {
            this._renderNotesList();
        }
        if (tabName === 'data') {
            this._renderLiensList();
        }
    },

    // ---- Gestion des liens ----

    _renderLiensList() {
        const container = document.getElementById('maeLiensList');
        if (!container) return;

        if (this._state.liens.length === 0) {
            container.innerHTML = '<div class="mae-liens-empty">Aucun lien</div>';
            return;
        }

        container.innerHTML = this._state.liens.map((lien, index) => `
            <div class="mae-lien-row" data-index="${index}">
                <input type="text" class="form-control" placeholder="Nom du lien" value="${escapeHtml(lien['Nom lien'] || '')}" data-field="nom" onchange="MAEModal.updateLien(${index}, 'nom', this.value)">
                <input type="text" class="form-control" placeholder="URL" value="${escapeHtml(lien['Lien'] || '')}" data-field="url" onchange="MAEModal.updateLien(${index}, 'url', this.value)">
                <button type="button" class="btn-remove-lien" onclick="MAEModal.removeLien(${index})" title="Supprimer">&#10005;</button>
            </div>
        `).join('');
    },

    addLienRow() {
        this._state.liens.push({ 'Nom lien': '', 'Lien': '' });
        this._renderLiensList();
    },

    updateLien(index, field, value) {
        if (field === 'nom') {
            this._state.liens[index]['Nom lien'] = value;
        } else {
            this._state.liens[index]['Lien'] = value;
        }
    },

    removeLien(index) {
        this._state.liens.splice(index, 1);
        this._renderLiensList();
    },

    _collectLiens() {
        // Lire les valeurs actuelles depuis le DOM
        const rows = document.querySelectorAll('.mae-lien-row');
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

    // ---- Gestion des notes ----

    _renderNotesList() {
        const container = document.getElementById('maeNotesList');
        if (!container) return;

        if (this._state.notes.length === 0) {
            container.innerHTML = '<div class="notes-empty">Aucune note pour cette demande</div>';
            return;
        }

        container.innerHTML = this._state.notes.map((note, index) => {
            const dateStr = this._formatDateTime(note['Date']);
            const redacteur = this._getActeurDisplay(note['Redacteur']);
            const noteContent = note['Note'] || '';
            return `
                <div class="note-item" data-index="${index}">
                    <div class="note-header">
                        <div class="note-meta">
                            <span class="note-date">${escapeHtml(dateStr)}</span>
                            <span class="note-author">${escapeHtml(redacteur)}</span>
                        </div>
                        <div class="note-actions">
                            <button type="button" class="btn btn-icon btn-xs btn-secondary" title="Modifier" onclick="MAEModal.showEditNoteForm(${index})">
                                &#9998;
                            </button>
                            <button type="button" class="btn btn-icon btn-xs btn-danger" title="Supprimer" onclick="MAEModal.confirmDeleteNote(${index})">
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
        this._showNoteForm(this._state.notes[index]);
    },

    _showNoteForm(note) {
        const container = document.getElementById('maeNoteFormContainer');
        if (!container) return;

        const isEdit = note !== null;
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const dateValue = isEdit ? this._formatDateTimeForInput(note['Date']) : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const noteContent = isEdit ? (note['Note'] || '') : '';
        const redacteur = isEdit ? (note['Redacteur'] || '') : '';

        container.innerHTML = `
            <div class="note-form" style="border:1px solid #ddd;border-radius:4px;padding:12px;margin-bottom:12px;background:#fafafa;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <h5 style="margin:0;">${isEdit ? 'Modifier la note' : 'Nouvelle note'}</h5>
                    <button type="button" class="btn btn-icon btn-xs btn-secondary" onclick="MAEModal.hideNoteForm()">&#10005;</button>
                </div>
                <div class="mae-form-row">
                    <div class="form-group">
                        <label class="form-label required">Date</label>
                        <input type="datetime-local" class="form-control" id="maeNoteDate" value="${dateValue}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Rédacteur</label>
                        <select class="form-control" id="maeNoteRedacteur">
                            <option value="">-- Sélectionner --</option>
                            ${this._data.acteurs.map(a => `
                                <option value="${escapeHtml(a['Mail'])}" ${a['Mail'] === redacteur ? 'selected' : ''}>
                                    ${escapeHtml(a['Prénom'] || '')} ${escapeHtml(a['Nom'] || '')}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label required">Note</label>
                    <div class="rich-text-toolbar">
                        <button type="button" class="rich-text-btn" onclick="MAEModal.execRichTextCommand('bold')" title="Gras"><strong>G</strong></button>
                        <button type="button" class="rich-text-btn" onclick="MAEModal.execRichTextCommand('italic')" title="Italique"><em>I</em></button>
                        <button type="button" class="rich-text-btn" onclick="MAEModal.execRichTextCommand('underline')" title="Souligné"><u>S</u></button>
                        <span class="rich-text-separator"></span>
                        <button type="button" class="rich-text-btn" onclick="MAEModal.execRichTextCommand('insertUnorderedList')" title="Liste">&#8226;</button>
                        <button type="button" class="rich-text-btn" onclick="MAEModal.execRichTextCommand('insertOrderedList')" title="Liste numérotée">1.</button>
                    </div>
                    <div class="rich-text-editor" id="maeNoteEditor" contenteditable="true">${noteContent}</div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="MAEModal.hideNoteForm()">Annuler</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="MAEModal.saveNote()">${isEdit ? 'Modifier' : 'Ajouter'}</button>
                </div>
            </div>
        `;

        container.style.display = 'block';
        setTimeout(() => {
            const editor = document.getElementById('maeNoteEditor');
            if (editor) editor.focus();
        }, 100);
    },

    hideNoteForm() {
        const container = document.getElementById('maeNoteFormContainer');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        this._state.editingNoteIndex = null;
    },

    execRichTextCommand(command) {
        document.execCommand(command, false, null);
        const editor = document.getElementById('maeNoteEditor');
        if (editor) editor.focus();
    },

    async saveNote() {
        const dateInput = document.getElementById('maeNoteDate');
        const redacteurInput = document.getElementById('maeNoteRedacteur');
        const editor = document.getElementById('maeNoteEditor');

        if (!dateInput || !editor || !redacteurInput) return;

        const dateValue = dateInput.value;
        const redacteur = redacteurInput.value;
        const noteContent = editor.innerHTML.trim();

        if (!dateValue) { showError('Veuillez saisir une date'); return; }
        if (!redacteur) { showError('Veuillez sélectionner un rédacteur'); return; }
        if (!noteContent || noteContent === '<br>') { showError('Veuillez saisir une note'); return; }

        // Il faut que la demande existe (mode edit)
        if (this._state.mode === 'add') {
            showError('Veuillez d\'abord créer la demande avant d\'ajouter des notes');
            return;
        }

        try {
            const noteData = {
                'Numero': this._state.currentNumero,
                'Date': dateValue,
                'Redacteur': redacteur,
                'Note': noteContent
            };

            if (this._state.editingNoteIndex !== null) {
                const existingNote = this._state.notes[this._state.editingNoteIndex];
                if (existingNote._rowIndex !== undefined) {
                    await updateTableRow('tMAENote', existingNote._rowIndex, noteData);
                    invalidateCache('tMAENote');
                    showSuccess('Note modifiée');
                }
            } else {
                await addTableRow('tMAENote', noteData);
                invalidateCache('tMAENote');
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
        const dateStr = this._formatDateTime(note['Date']);

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
                await deleteTableRow('tMAENote', note._rowIndex);
                invalidateCache('tMAENote');
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
            const notesData = await readTable('tMAENote');
            this._data.notes = notesData.data || [];

            this._state.notes = this._data.notes
                .filter(n => n['Numero'] === this._state.currentNumero)
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
        const badge = document.getElementById('maeNotesBadge');
        if (badge) {
            badge.textContent = this._state.notes.length > 0 ? this._state.notes.length : '';
        }
    },

    // ---- Sauvegarde de la demande ----

    _getSaveData(overrideStatut) {
        const formDemande = document.getElementById('formMAEDemande');
        const formData = formDemande ? new FormData(formDemande) : new FormData();

        const formDataEl = document.getElementById('formMAEData');
        const formDataData = formDataEl ? new FormData(formDataEl) : new FormData();

        const currentStatut = overrideStatut || (this._state.currentDemande ? this._state.currentDemande['Statut'] : 'Création');

        return {
            'Numero': this._state.currentNumero,
            'Nom': formData.get('Nom') || '',
            'Perimetre': formData.get('Perimetre') || '',
            'Demandeur': formData.get('Demandeur') || '',
            'Date demande': formData.get('Date demande') || '',
            'Date souhaitée': formData.get('Date souhaitée') || '',
            'Priorité': formData.get('Priorité') || '',
            'Description': formData.get('Description') || '',
            'Impact': formData.get('Impact') || '',
            'Statut': currentStatut,
            'Pris en charge par': formDataData.get('Pris en charge par') || '',
            'Gold': formDataData.get('Gold') || '',
            'Date livraison estimée': formDataData.get('Date livraison estimée') || '',
            'Equipe': formDataData.get('Equipe') || '',
            'JH DE': formDataData.get('JH DE') ?? '',
            'JH DA': formDataData.get('JH DA') ?? '',
            'JH DATA VIZ': formDataData.get('JH DATA VIZ') ?? ''
        };
    },

    async _saveDemande(isEdit, overrideStatut) {
        try {
            const demandeData = this._getSaveData(overrideStatut);

            if (isEdit) {
                await updateTableRow('tMAE', this._state.rowIndex, demandeData);
                this._state.currentDemande = { ...this._state.currentDemande, ...demandeData };
            } else {
                // Mode ajout : valider les champs obligatoires de l'onglet Demande
                const requiredFields = ['Nom', 'Perimetre', 'Demandeur', 'Date demande', 'Date souhaitée', 'Priorité', 'Description', 'Impact'];
                for (const field of requiredFields) {
                    if (!demandeData[field] || demandeData[field].trim() === '') {
                        showError(`Le champ "${field}" est obligatoire`);
                        return false;
                    }
                }

                demandeData['Statut'] = 'Création';
                await addTableRow('tMAE', demandeData);
            }

            invalidateCache('tMAE');

            // Gestion des liens
            await this._saveLiens();

            showSuccess(isEdit ? 'Demande mise à jour' : 'Demande créée avec succès');

            if (this._state.onSuccess) {
                await this._state.onSuccess();
            }

            return true;

        } catch (error) {
            console.error('Erreur sauvegarde demande:', error);
            showError('Erreur lors de la sauvegarde');
            return false;
        }
    },

    async _saveLiens() {
        const currentLiens = this._collectLiens();

        // Supprimer les anciens liens (en ordre inverse)
        const oldLiens = this._data.liens
            .filter(l => l['Numero'] === this._state.currentNumero)
            .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

        for (const lien of oldLiens) {
            if (lien._rowIndex !== undefined && lien._rowIndex !== null) {
                await deleteTableRow('tMAELien', lien._rowIndex);
            }
        }

        // Ajouter les nouveaux liens
        for (const lien of currentLiens) {
            await addTableRow('tMAELien', {
                'Numero': this._state.currentNumero,
                'Nom lien': lien['Nom lien'],
                'Lien': lien['Lien']
            });
        }

        invalidateCache('tMAELien');
    }
};
