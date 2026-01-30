/* ===========================================
   MAE-MODAL.JS - Modale fiche demande MAE
   Application Carto
   =========================================== */

const MAEModal = {
    _data: {
        acteurs: [],
        chantiers: [],
        demandes: [],
        notes: [],
        liens: []
    },

    _state: {
        mode: null, // 'add' ou 'edit'
        activeTab: 'demande',
        currentDemande: null,
        currentCle: null,
        rowIndex: null,
        notes: [],
        liens: [],
        editingNoteIndex: null,
        onSuccess: null
    },

    // ---- Chargement des donnees ----

    async loadData() {
        try {
            const [acteursData, chantiersData, demandesData, notesData, liensData] = await Promise.all([
                readTable('tActeurs'),
                readTable('tChantiers'),
                readTable('tMAE'),
                readTable('tMAENote'),
                readTable('tMAELien')
            ]);

            this._data.acteurs = acteursData.data || [];
            this._data.chantiers = chantiersData.data || [];
            this._data.demandes = demandesData.data || [];
            this._data.notes = notesData.data || [];
            this._data.liens = liensData.data || [];

            return true;
        } catch (error) {
            console.error('Erreur chargement données MAEModal:', error);
            return false;
        }
    },

    // ---- Utilitaires ----

    _getActeurDisplay(mail) {
        if (!mail) return '';
        const acteur = this._data.acteurs.find(a => a['Mail'] === mail);
        return acteur ? `${acteur['Prénom'] || ''} ${acteur['Nom'] || ''}`.trim() : mail;
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
            case 'À FAIRE': return 'a-faire';
            case 'EN COURS': return 'en-cours';
            case 'LIVRÉ': return 'livre';
            case 'VALIDÉ': return 'valide';
            default: return 'a-faire';
        }
    },

    // ---- Rendu du pipeline header (read-only) ----

    _renderPipelineHeader(currentStatut) {
        const currentIndex = this._getStatutIndex(currentStatut);
        return `
            <div class="mae-modal-pipeline">
                ${CONFIG.MAE_STATUTS.map((step, i) => {
                    let stepClass = '';
                    if (i < currentIndex) {
                        stepClass = 'completed';
                    } else if (i === currentIndex) {
                        stepClass = 'current';
                    }

                    return `
                        ${i > 0 ? '<div class="mae-pipeline-arrow">&#9654;</div>' : ''}
                        <div class="mae-pipeline-step ${stepClass}" title="${step.label}">
                            <div class="mae-pipeline-step-box">
                                <span class="step-label">${escapeHtml(step.label)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ---- Modale Ajout ----

    async showAddModal(onSuccess = null) {
        await this.loadData();

        this._state.mode = 'add';
        this._state.onSuccess = onSuccess;
        this._state.activeTab = 'demande';
        this._state.currentDemande = null;
        this._state.currentCle = '';
        this._state.notes = [];
        this._state.liens = [];
        this._state.editingNoteIndex = null;

        const content = this._buildModalContent('À FAIRE');

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

    async showEditModal(cle, onSuccess = null) {
        await this.loadData();

        const demande = this._data.demandes.find(d => d['Clé'] === cle);
        if (!demande) {
            showError('Demande non trouvée');
            return;
        }

        this._state.mode = 'edit';
        this._state.onSuccess = onSuccess;
        this._state.activeTab = 'demande';
        this._state.currentDemande = demande;
        this._state.currentCle = cle;
        this._state.rowIndex = demande._rowIndex;
        this._state.editingNoteIndex = null;

        // Notes de cette demande
        this._state.notes = this._data.notes
            .filter(n => n['Clé'] === cle)
            .sort((a, b) => {
                const dateA = this._parseDate(a['Date']);
                const dateB = this._parseDate(b['Date']);
                return dateB - dateA;
            });

        // Liens de cette demande
        this._state.liens = this._data.liens.filter(l => l['Clé'] === cle);

        const currentStatut = demande['État'] || 'À FAIRE';
        const content = this._buildModalContent(currentStatut);

        showModal({
            title: `Demande ${escapeHtml(cle)}`,
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

        return `
            ${isEdit ? this._renderPipelineHeader(currentStatut) : ''}

            <!-- Onglets -->
            <div class="mae-modal-tabs">
                <button type="button" class="mae-modal-tab active" data-tab="demande" onclick="MAEModal.switchTab('demande')">
                    Demande
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
                            <label class="form-label${!isEdit ? ' required' : ''}">Clé</label>
                            ${isEdit
                                ? `<div class="form-control-readonly" id="maeCle">${escapeHtml(this._state.currentCle)}</div>`
                                : `<input type="text" class="form-control" name="Clé" value="" placeholder="Ex: MPD-8">`
                            }
                        </div>
                        <div class="form-group">
                            <label class="form-label">Résumé</label>
                            <input type="text" class="form-control" name="Résumé" value="${escapeHtml(d['Résumé'] || '')}">
                        </div>
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">Périmètre - MAE</label>
                            <input type="text" class="form-control" name="Périmètre - MAE" value="${escapeHtml(d['Périmètre - MAE'] || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Rapporteur</label>
                            <input type="text" class="form-control" name="Rapporteur" value="${escapeHtml(d['Rapporteur'] || '')}">
                        </div>
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">Start Date</label>
                            <input type="date" class="form-control" name="Start Date" value="${this._formatDateForInput(d['Start Date'])}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date souhaitée de livraison</label>
                            <input type="date" class="form-control" name="Date souhaitée de livraison" value="${this._formatDateForInput(d['Date souhaitée de livraison'])}">
                        </div>
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">Priorité</label>
                            <div class="form-control-readonly">${escapeHtml(d['Priorité'] || '')}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">État</label>
                            <div class="form-control-readonly">${escapeHtml(d['État'] || (isEdit ? 'À FAIRE' : ''))}</div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" name="Description" rows="4" style="white-space: pre-wrap;">${escapeHtml(d['Description'] || '')}</textarea>
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">Personne assignée</label>
                            <div class="form-control-readonly">${escapeHtml(d['Personne assignée'] || '')}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date d'échéance</label>
                            <input type="date" class="form-control" name="Date d'échéance" value="${this._formatDateForInput(d["Date d'échéance"])}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Gold</label>
                        <textarea class="form-control" name="Gold" rows="3">${escapeHtml(d['Gold'] || '')}</textarea>
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
                            <label class="form-label">JH DataViz</label>
                            <input type="number" class="form-control" name="JH DataViz" step="0.01" min="0" value="${d['JH DataViz'] != null && d['JH DataViz'] !== '' ? d['JH DataViz'] : ''}">
                        </div>
                    </div>

                    <div class="mae-form-row">
                        <div class="form-group">
                            <label class="form-label">Parent</label>
                            <div class="form-control-readonly">${escapeHtml(d['Parent'] || '')}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Thème</label>
                            <div class="form-control-readonly">${escapeHtml(d['Thème'] || '')}</div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Chantier</label>
                        <select class="form-control" name="Chantier">
                            <option value="">-- Sélectionner --</option>
                            ${this._data.chantiers.map(c => `
                                <option value="${escapeHtml(c['Chantier'])}" ${d['Chantier'] === c['Chantier'] ? 'selected' : ''}>
                                    ${escapeHtml(c['Chantier'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </form>
            </div>

            <!-- Onglet Notes -->
            <div class="mae-modal-tab-content" id="maeTabNotes">
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

                <!-- Notes -->
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

    // ---- Gestion des onglets ----

    switchTab(tabName) {
        this._state.activeTab = tabName;

        document.querySelectorAll('.mae-modal-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.getElementById('maeTabDemande').classList.toggle('active', tabName === 'demande');
        document.getElementById('maeTabNotes').classList.toggle('active', tabName === 'notes');

        if (tabName === 'notes') {
            this._renderNotesList();
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
                <a class="btn-open-lien ${lien['Lien'] ? '' : 'disabled'}" href="${lien['Lien'] || '#'}" target="_blank" title="Ouvrir" onclick="${lien['Lien'] ? '' : 'return false;'}">&#128279;</a>
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
                'Clé': this._state.currentCle,
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
                .filter(n => n['Clé'] === this._state.currentCle)
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

    _getSaveData() {
        const form = document.getElementById('formMAEDemande');
        const formData = form ? new FormData(form) : new FormData();

        const isEdit = this._state.mode === 'edit';
        const d = this._state.currentDemande || {};

        // Clé : from form in add mode, from state in edit mode
        const cle = isEdit ? this._state.currentCle : (formData.get('Clé') || '');

        const data = {
            'Clé': cle,
            'Résumé': formData.get('Résumé') || '',
            'Périmètre - MAE': formData.get('Périmètre - MAE') || '',
            'Rapporteur': formData.get('Rapporteur') || '',
            'Start Date': formData.get('Start Date') || '',
            'Date souhaitée de livraison': formData.get('Date souhaitée de livraison') || '',
            'Priorité': d['Priorité'] || '',
            'Description': formData.get('Description') || '',
            'État': d['État'] || 'À FAIRE',
            'Personne assignée': d['Personne assignée'] || '',
            'Gold': formData.get('Gold') || '',
            "Date d'échéance": formData.get("Date d'échéance") || '',
            'JH DE': formData.get('JH DE') ?? '',
            'JH DA': formData.get('JH DA') ?? '',
            'JH DataViz': formData.get('JH DataViz') ?? '',
            'Parent': d['Parent'] || '',
            // Thème is a formula in Excel — do not save it
            'Chantier': formData.get('Chantier') || ''
        };

        return data;
    },

    async _saveDemande(isEdit) {
        try {
            const demandeData = this._getSaveData();

            if (!isEdit) {
                // Mode ajout : valider la Clé obligatoire
                if (!demandeData['Clé'] || demandeData['Clé'].trim() === '') {
                    showError('Le champ "Clé" est obligatoire');
                    return false;
                }

                // Vérifier que la clé n'existe pas déjà
                const exists = this._data.demandes.some(d => d['Clé'] === demandeData['Clé']);
                if (exists) {
                    showError(`La clé "${demandeData['Clé']}" existe déjà`);
                    return false;
                }

                await addTableRow('tMAE', demandeData);
            } else {
                await updateTableRow('tMAE', this._state.rowIndex, demandeData);
                this._state.currentDemande = { ...this._state.currentDemande, ...demandeData };
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
            .filter(l => l['Clé'] === this._state.currentCle)
            .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

        for (const lien of oldLiens) {
            if (lien._rowIndex !== undefined && lien._rowIndex !== null) {
                await deleteTableRow('tMAELien', lien._rowIndex);
            }
        }

        // Ajouter les nouveaux liens
        for (const lien of currentLiens) {
            await addTableRow('tMAELien', {
                'Clé': this._state.currentCle,
                'Nom lien': lien['Nom lien'],
                'Lien': lien['Lien']
            });
        }

        invalidateCache('tMAELien');
    }
};
