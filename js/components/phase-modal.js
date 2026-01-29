/* ===========================================
   PHASE-MODAL.JS - Modale phase réutilisable
   Application Carto
   =========================================== */

/**
 * Module global pour gérer les modales de phase
 * Réutilisable depuis roadmap-chantiers.js et chantier-modal.js
 */
const PhaseModal = {
    // Données nécessaires (injectées par l'appelant)
    _sprints: [],
    _phasesLien: [],
    _onSuccess: null,

    /**
     * Affiche la modale d'ajout de phase
     * @param {Object} options
     * @param {string} options.chantierName - Nom du chantier
     * @param {string} [options.sprintName] - Sprint pré-sélectionné
     * @param {string} [options.weekCode] - Code semaine par défaut
     * @param {Array} options.sprints - Liste des sprints
     * @param {Function} [options.onSuccess] - Callback après ajout réussi
     */
    async showAddModal(options) {
        const { chantierName, sprintName = '', weekCode = '', sprints, onSuccess } = options;
        this._sprints = sprints || [];
        this._onSuccess = onSuccess || null;

        // Générer le code semaine par défaut si non fourni
        const defaultWeekCode = weekCode || this._formatWeekCode(new Date());

        const content = `
            <form id="formPhaseModal" class="form">
                <div class="form-group">
                    <label class="form-label required">Nom de la phase</label>
                    <input type="text" class="form-control" name="Phase" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Type de phase</label>
                    <select class="form-control" name="Type phase">
                        <option value="">-- Aucun --</option>
                        <option value="EB">EB</option>
                        <option value="Cadrage">Cadrage</option>
                        <option value="Dev">Dev</option>
                        <option value="Recette">Recette</option>
                        <option value="MEP">MEP</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" name="Description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Chantier</label>
                    <input type="text" class="form-control" name="Chantier" value="${escapeHtml(chantierName)}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Mode</label>
                    <select class="form-control" name="Mode" id="phaseModalMode" onchange="PhaseModal.toggleModeFields()">
                        <option value="Sprint" selected>Sprint</option>
                        <option value="Semaine">Semaine</option>
                    </select>
                </div>
                <div class="form-row" id="phaseModalSprintFields">
                    <div class="form-group">
                        <label class="form-label required">Sprint début</label>
                        <select class="form-control" name="Sprint début">
                            ${this._sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === sprintName ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Sprint fin</label>
                        <select class="form-control" name="Sprint fin">
                            ${this._sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === sprintName ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row" id="phaseModalWeekFields" style="display: none;">
                    <div class="form-group">
                        <label class="form-label required">Semaine début</label>
                        <input type="text" class="form-control" name="Semaine début"
                               placeholder="AAAAS99" pattern="\\d{4}S\\d{2}"
                               value="${escapeHtml(defaultWeekCode)}"
                               title="Format: AAAAS99 (ex: 2026S02)">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Semaine fin</label>
                        <input type="text" class="form-control" name="Semaine fin"
                               placeholder="AAAAS99" pattern="\\d{4}S\\d{2}"
                               value="${escapeHtml(defaultWeekCode)}"
                               title="Format: AAAAS99 (ex: 2026S02)">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Lien Teams</label>
                    <input type="text" class="form-control" name="Lien Teams" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Liens supplémentaires</label>
                    <div id="phaseModalLiensContainer" class="liens-container"></div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="PhaseModal.addLienRow()">
                        + Ajouter un lien
                    </button>
                </div>
            </form>
        `;

        showModal({
            title: 'Ajouter une phase',
            content: content,
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Ajouter',
                    class: 'btn-primary',
                    action: async () => {
                        return await this._savePhase(chantierName, false, null);
                    }
                }
            ]
        });
    },

    /**
     * Affiche la modale d'édition de phase
     * @param {Object} options
     * @param {Object} options.phase - Données de la phase
     * @param {Array} options.sprints - Liste des sprints
     * @param {Array} options.phasesLien - Liens des phases
     * @param {Function} [options.onSuccess] - Callback après modification réussie
     */
    async showEditModal(options) {
        const { phase, sprints, phasesLien = [], onSuccess } = options;
        if (!phase) return;

        this._sprints = sprints || [];
        this._phasesLien = phasesLien;
        this._onSuccess = onSuccess || null;

        const rowIndex = phase._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for phase:', phase['Phase']);
            showError('Erreur: index de ligne non trouvé');
            return;
        }

        // Récupérer les liens de cette phase
        const liens = this._phasesLien.filter(l => l['Phase'] === phase['Phase']);

        // Déterminer le mode actuel
        const currentMode = phase['Mode'] || 'Sprint';
        const isWeekMode = currentMode === 'Semaine';

        const content = `
            <form id="formPhaseModal" class="form">
                <div class="form-group">
                    <label class="form-label required">Nom de la phase</label>
                    <input type="text" class="form-control" name="Phase" value="${escapeHtml(phase['Phase'])}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Type de phase</label>
                    <select class="form-control" name="Type phase">
                        <option value="">-- Aucun --</option>
                        ${['EB', 'Cadrage', 'Dev', 'Recette', 'MEP'].map(t => `
                            <option value="${t}" ${(phase['Type phase'] || '').trim() === t ? 'selected' : ''}>${t}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-control" name="Description" rows="3">${escapeHtml(phase['Description'] || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Chantier</label>
                    <input type="text" class="form-control" value="${escapeHtml(phase['Chantier'])}" readonly>
                </div>
                <div class="form-group">
                    <label class="form-label">Mode</label>
                    <select class="form-control" name="Mode" id="phaseModalMode" onchange="PhaseModal.toggleModeFields()">
                        <option value="Sprint" ${!isWeekMode ? 'selected' : ''}>Sprint</option>
                        <option value="Semaine" ${isWeekMode ? 'selected' : ''}>Semaine</option>
                    </select>
                </div>
                <div class="form-row" id="phaseModalSprintFields" style="${isWeekMode ? 'display: none;' : ''}">
                    <div class="form-group">
                        <label class="form-label required">Sprint début</label>
                        <select class="form-control" name="Sprint début">
                            ${this._sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === phase['Sprint début'] ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Sprint fin</label>
                        <select class="form-control" name="Sprint fin">
                            ${this._sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === phase['Sprint fin'] ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row" id="phaseModalWeekFields" style="${!isWeekMode ? 'display: none;' : ''}">
                    <div class="form-group">
                        <label class="form-label required">Semaine début</label>
                        <input type="text" class="form-control" name="Semaine début"
                               placeholder="AAAAS99" pattern="\\d{4}S\\d{2}"
                               value="${escapeHtml(phase['Semaine début'] || '')}"
                               title="Format: AAAAS99 (ex: 2026S02)">
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Semaine fin</label>
                        <input type="text" class="form-control" name="Semaine fin"
                               placeholder="AAAAS99" pattern="\\d{4}S\\d{2}"
                               value="${escapeHtml(phase['Semaine fin'] || '')}"
                               title="Format: AAAAS99 (ex: 2026S02)">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Lien Teams</label>
                    <input type="text" class="form-control" name="Lien Teams" value="${escapeHtml(phase['Lien Teams'] || '')}" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Liens supplémentaires</label>
                    <div id="phaseModalLiensContainer" class="liens-container">
                        ${liens.map((l, i) => `
                            <div class="lien-row" data-index="${i}">
                                <input type="text" class="form-control lien-nom" placeholder="Nom du lien" value="${escapeHtml(l['Nom lien'] || '')}">
                                <input type="text" class="form-control lien-url" placeholder="URL" value="${escapeHtml(l['Lien'] || '')}">
                                <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()">&#128465;</button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="PhaseModal.addLienRow()">
                        + Ajouter un lien
                    </button>
                </div>
            </form>
        `;

        showModal({
            title: 'Modifier la phase',
            content: content,
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Enregistrer',
                    class: 'btn-primary',
                    action: async () => {
                        return await this._savePhase(phase['Chantier'], true, phase);
                    }
                }
            ]
        });
    },

    /**
     * Bascule l'affichage des champs Sprint/Semaine
     */
    toggleModeFields() {
        const mode = document.getElementById('phaseModalMode')?.value || 'Sprint';
        const sprintFields = document.getElementById('phaseModalSprintFields');
        const weekFields = document.getElementById('phaseModalWeekFields');

        if (mode === 'Semaine') {
            if (sprintFields) sprintFields.style.display = 'none';
            if (weekFields) weekFields.style.display = 'flex';
        } else {
            if (sprintFields) sprintFields.style.display = 'flex';
            if (weekFields) weekFields.style.display = 'none';
        }
    },

    /**
     * Ajoute une ligne de lien
     */
    addLienRow() {
        const container = document.getElementById('phaseModalLiensContainer');
        if (!container) return;
        const index = container.children.length;
        const row = document.createElement('div');
        row.className = 'lien-row';
        row.dataset.index = index;
        row.innerHTML = `
            <input type="text" class="form-control lien-nom" placeholder="Nom du lien">
            <input type="text" class="form-control lien-url" placeholder="URL">
            <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()">&#128465;</button>
        `;
        container.appendChild(row);
    },

    /**
     * Collecte les liens depuis le DOM
     */
    _collectLiens() {
        const liens = [];
        document.querySelectorAll('#phaseModalLiensContainer .lien-row').forEach(row => {
            const nom = row.querySelector('.lien-nom')?.value?.trim();
            const url = row.querySelector('.lien-url')?.value?.trim();
            if (nom || url) {
                liens.push({ nom: nom || '', url: url || '' });
            }
        });
        return liens;
    },

    /**
     * Sauvegarde la phase (ajout ou modification)
     */
    async _savePhase(chantierName, isEdit, existingPhase) {
        const form = document.getElementById('formPhaseModal');
        if (!form) return false;

        const formData = new FormData(form);

        // Validation
        const phaseName = (formData.get('Phase') || '').trim();
        const typePhase = formData.get('Type phase');
        const mode = formData.get('Mode') || 'Sprint';

        if (!phaseName) {
            showError('Veuillez saisir le nom de la phase');
            return false;
        }

        const phaseData = {
            'Phase': phaseName,
            'Type phase': typePhase || '',
            'Description': formData.get('Description'),
            'Chantier': chantierName,
            'Mode': mode,
            'Sprint début': '',
            'Sprint fin': '',
            'Semaine début': '',
            'Semaine fin': '',
            'Lien Teams': formData.get('Lien Teams'),
            'Couleur': CONFIG.PHASE_COLORS[typePhase] || ''
        };

        if (mode === 'Sprint') {
            const sprintDebut = formData.get('Sprint début');
            const sprintFin = formData.get('Sprint fin');
            if (!sprintDebut || !sprintFin) {
                showError('Veuillez sélectionner les sprints de début et de fin');
                return false;
            }
            phaseData['Sprint début'] = sprintDebut;
            phaseData['Sprint fin'] = sprintFin;
        } else {
            const semaineDebut = (formData.get('Semaine début') || '').trim();
            const semaineFin = (formData.get('Semaine fin') || '').trim();
            if (!semaineDebut || !semaineFin) {
                showError('Veuillez saisir les semaines de début et de fin');
                return false;
            }
            if (!/^\d{4}S\d{2}$/.test(semaineDebut) || !/^\d{4}S\d{2}$/.test(semaineFin)) {
                showError('Format de semaine invalide. Utilisez AAAAS99 (ex: 2026S02)');
                return false;
            }
            phaseData['Semaine début'] = semaineDebut;
            phaseData['Semaine fin'] = semaineFin;
        }

        try {
            if (isEdit && existingPhase) {
                const rowIndex = existingPhase._rowIndex;
                await updateTableRow('tPhases', rowIndex, phaseData);
                invalidateCache('tPhases');

                // Supprimer les anciens liens (en ordre inverse)
                const oldLiens = this._phasesLien
                    .filter(l => l['Phase'] === existingPhase['Phase'])
                    .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                for (const lien of oldLiens) {
                    if (lien._rowIndex !== undefined && lien._rowIndex !== null) {
                        await deleteTableRow('tPhasesLien', lien._rowIndex);
                    }
                }
            } else {
                await addTableRow('tPhases', phaseData);
                invalidateCache('tPhases');
            }

            // Ajouter les nouveaux liens
            const newLiens = this._collectLiens();
            for (const lien of newLiens) {
                await addTableRow('tPhasesLien', {
                    'Phase': phaseData['Phase'],
                    'Nom lien': lien.nom,
                    'Lien': lien.url
                });
            }
            invalidateCache('tPhasesLien');

            showSuccess(isEdit ? 'Phase modifiée avec succès' : 'Phase ajoutée avec succès');

            if (this._onSuccess) {
                await this._onSuccess();
            }

            return true;
        } catch (error) {
            console.error('Erreur sauvegarde phase:', error);
            showError(isEdit ? 'Erreur lors de la modification' : 'Erreur lors de l\'ajout de la phase');
            return false;
        }
    },

    /**
     * Supprime une phase avec confirmation
     * @param {Object} options
     * @param {Object} options.phase - Données de la phase
     * @param {Array} options.phasesLien - Liens des phases
     * @param {Function} [options.onSuccess] - Callback après suppression réussie
     */
    async showDeleteConfirmation(options) {
        const { phase, phasesLien = [], onSuccess } = options;
        if (!phase) return;

        const rowIndex = phase._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for phase:', phase['Phase']);
            showError('Erreur: index de ligne non trouvé');
            return;
        }

        showConfirmModal(
            'Supprimer la phase',
            `Êtes-vous sûr de vouloir supprimer la phase "${phase['Phase']}" ?`,
            async () => {
                try {
                    // Supprimer les liens (en ordre inverse)
                    const liens = phasesLien
                        .filter(l => l['Phase'] === phase['Phase'])
                        .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                    for (const lien of liens) {
                        if (lien._rowIndex !== undefined && lien._rowIndex !== null) {
                            await deleteTableRow('tPhasesLien', lien._rowIndex);
                        }
                    }

                    // Supprimer la phase
                    await deleteTableRow('tPhases', rowIndex);

                    invalidateCache('tPhases');
                    invalidateCache('tPhasesLien');

                    showSuccess('Phase supprimée');

                    if (onSuccess) {
                        await onSuccess();
                    }
                } catch (error) {
                    console.error('Erreur suppression phase:', error);
                    showError('Erreur lors de la suppression');
                }
            }
        );
    },

    /**
     * Formate un code semaine AAAAS99 à partir d'une date
     */
    _formatWeekCode(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const year = d.getUTCFullYear();
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${year}S${String(weekNo).padStart(2, '0')}`;
    }
};
