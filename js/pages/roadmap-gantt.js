/* ===========================================
   ROADMAP-GANTT.JS - Page Roadmap visuelle (Gantt)
   Application Carto
   =========================================== */

/**
 * Classe RoadmapGanttPage pour gérer la vue Roadmap visuelle
 */
class RoadmapGanttPage {
    constructor() {
        this.backlog = [];
        this.sprints = [];
        this.processus = [];
        this.perimetres = [];
        this.produits = [];
        this.columns = []; // Structure: [{processus, perimetre, produit}, ...]
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Roadmap</h1>
                    <p>Vue planning des projets par processus et sprint</p>
                </div>
                <div class="page-header-right">
                    <button id="btnAddBacklogItem" class="btn btn-primary">
                        + Ajouter un projet
                    </button>
                </div>
            </div>

            <!-- Légende des états -->
            <section class="section">
                <div class="roadmap-legend">
                    <span class="legend-title">Légende :</span>
                    <span class="legend-item"><span class="legend-color" style="background: #00BCD4;"></span> Cadrage</span>
                    <span class="legend-item"><span class="legend-color" style="background: #FFEB3B;"></span> Dev</span>
                    <span class="legend-item"><span class="legend-color" style="background: #FF5722;"></span> Recette</span>
                    <span class="legend-item"><span class="legend-color" style="background: #4CAF50;"></span> En prod</span>
                </div>
            </section>

            <!-- Gantt Chart -->
            <section class="section">
                <div class="roadmap-gantt-container">
                    <div class="roadmap-gantt-wrapper" id="roadmapGanttWrapper">
                        <div class="spinner"></div>
                    </div>
                </div>
            </section>
        `;

        await this.loadData();
        this.attachEvents();
    }

    /**
     * Charge les données
     */
    async loadData() {
        try {
            const [backlogData, sprintsData, processusData, perimetresData, produitsData] = await Promise.all([
                readTable('tBacklog'),
                readTable('tSprints'),
                readTable('tProcessus'),
                readTable('tPerimetres'),
                readTable('tProduits')
            ]);

            this.backlog = backlogData.data || [];
            this.sprints = sprintsData.data || [];
            this.processus = processusData.data || [];
            this.perimetres = perimetresData.data || [];
            this.produits = produitsData.data || [];

            // Construire les colonnes (Processus -> Périmètre -> Produit)
            this.buildColumns();

            // Rendre le Gantt
            this.renderGantt();

        } catch (error) {
            console.error('Erreur chargement données roadmap-gantt:', error);
            showError('Erreur lors du chargement des données');
        }
    }

    /**
     * Construit les colonnes (Processus -> Périmètre -> Produit)
     */
    buildColumns() {
        this.columns = [];
        const seen = new Set();

        // Collecter toutes les combinaisons uniques depuis le backlog
        this.backlog.forEach(item => {
            const proc = item.Processus || 'Non défini';
            const perim = item['Périmètre'] || 'Non défini';
            const produit = item.Produit || 'Non défini';
            const key = `${proc}|${perim}|${produit}`;

            if (!seen.has(key)) {
                seen.add(key);
                this.columns.push({ processus: proc, perimetre: perim, produit: produit });
            }
        });

        // Trier par processus, puis périmètre, puis produit
        this.columns.sort((a, b) => {
            if (a.processus !== b.processus) return a.processus.localeCompare(b.processus);
            if (a.perimetre !== b.perimetre) return a.perimetre.localeCompare(b.perimetre);
            return a.produit.localeCompare(b.produit);
        });
    }

    /**
     * Obtient la liste des sprints triés
     */
    getSortedSprints() {
        // Trier les sprints par date de début
        return [...this.sprints].sort((a, b) => {
            const dateA = this.parseDate(a['Début']);
            const dateB = this.parseDate(b['Début']);
            return dateA - dateB;
        });
    }

    /**
     * Parse une date Excel ou string
     */
    parseDate(dateValue) {
        if (!dateValue) return new Date(0);
        if (typeof dateValue === 'number') {
            return new Date((dateValue - 25569) * 86400 * 1000);
        }
        return new Date(dateValue);
    }

    /**
     * Obtient le mois/année d'un sprint
     */
    getSprintMonthYear(sprint) {
        const date = this.parseDate(sprint['Début']);
        if (isNaN(date.getTime())) return '';
        const months = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
        return `${months[date.getMonth()]}`;
    }

    /**
     * Rendu du Gantt
     */
    renderGantt() {
        const container = document.getElementById('roadmapGanttWrapper');
        if (!container) return;

        const sortedSprints = this.getSortedSprints();

        if (this.columns.length === 0 || sortedSprints.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128197;</div>
                    <div class="empty-state-title">Aucune donnée disponible</div>
                    <p>Ajoutez des éléments dans le backlog avec des processus et des sprints pour les voir ici.</p>
                </div>
            `;
            return;
        }

        // Construire les 3 lignes d'en-tête (Processus, Périmètre, Produit)
        const { processusRow, perimetreRow, produitRow } = this.buildHeaderRows();

        // Précalculer les cellules occupées (pour le rowspan des phases multi-sprints)
        const cellsOccupied = this.buildCellsOccupied(sortedSprints);

        // Construire les lignes (Sprints)
        let rowsHtml = '';
        let currentMonth = '';

        sortedSprints.forEach((sprint, sprintIndex) => {
            const sprintName = sprint.Sprint || `Sprint ${sprintIndex + 1}`;
            const monthYear = this.getSprintMonthYear(sprint);
            const showMonth = monthYear !== currentMonth;
            currentMonth = monthYear;

            // Compter combien de sprints ont le même mois pour le rowspan
            let monthRowspan = 1;
            if (showMonth) {
                for (let i = sprintIndex + 1; i < sortedSprints.length; i++) {
                    if (this.getSprintMonthYear(sortedSprints[i]) === monthYear) {
                        monthRowspan++;
                    } else {
                        break;
                    }
                }
            }

            rowsHtml += '<tr>';

            // Colonne Mois (avec rowspan si nouveau mois)
            if (showMonth) {
                rowsHtml += `<td class="gantt-month-cell" rowspan="${monthRowspan}">${escapeHtml(monthYear)}</td>`;
            }

            // Colonne Sprint
            rowsHtml += `<td class="gantt-sprint-cell">${escapeHtml(sprintName)}</td>`;

            // Cellules pour chaque colonne (processus/périmètre/produit)
            this.columns.forEach((col, colIndex) => {
                const cellKey = `${sprintIndex}-${colIndex}`;

                // Si cette cellule est occupée par un rowspan précédent, on skip
                if (cellsOccupied.skipped.has(cellKey)) {
                    return;
                }

                // Récupérer les infos de la cellule
                const cellInfo = cellsOccupied.cells.get(cellKey);

                if (cellInfo) {
                    const { item, rowspan } = cellInfo;
                    const rowspanAttr = rowspan > 1 ? ` rowspan="${rowspan}"` : '';
                    rowsHtml += `<td class="gantt-data-cell"${rowspanAttr}>${this.renderPhaseBlock(item, rowspan)}</td>`;
                } else {
                    rowsHtml += '<td class="gantt-data-cell"></td>';
                }
            });

            rowsHtml += '</tr>';
        });

        // Assembler le tableau
        container.innerHTML = `
            <table class="roadmap-gantt-table">
                <thead>
                    <tr class="gantt-header-row">
                        <th class="gantt-fixed-col gantt-month-header" rowspan="3">Mois</th>
                        <th class="gantt-fixed-col gantt-sprint-header" rowspan="3">Sprint</th>
                        ${processusRow}
                    </tr>
                    <tr class="gantt-subheader-row">
                        ${perimetreRow}
                    </tr>
                    <tr class="gantt-produit-row">
                        ${produitRow}
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        // Attacher les événements sur les blocs de phase
        this.attachPhaseBlockEvents();
    }

    /**
     * Construit les lignes d'en-tête (Processus, Périmètre, Produit)
     */
    buildHeaderRows() {
        let processusRow = '';
        let perimetreRow = '';
        let produitRow = '';

        // Grouper par processus
        const processusGroups = {};
        this.columns.forEach((col, index) => {
            if (!processusGroups[col.processus]) {
                processusGroups[col.processus] = [];
            }
            processusGroups[col.processus].push({ ...col, index });
        });

        // Grouper par processus+périmètre
        const perimetreGroups = {};
        this.columns.forEach((col, index) => {
            const key = `${col.processus}|${col.perimetre}`;
            if (!perimetreGroups[key]) {
                perimetreGroups[key] = [];
            }
            perimetreGroups[key].push({ ...col, index });
        });

        // Construire la ligne Processus
        Object.keys(processusGroups).forEach(proc => {
            const cols = processusGroups[proc];
            processusRow += `<th class="gantt-process-header" colspan="${cols.length}">${escapeHtml(proc)}</th>`;
        });

        // Construire la ligne Périmètre
        Object.keys(perimetreGroups).forEach(key => {
            const cols = perimetreGroups[key];
            const perim = cols[0].perimetre;
            perimetreRow += `<th class="gantt-perim-header" colspan="${cols.length}">${escapeHtml(perim)}</th>`;
        });

        // Construire la ligne Produit
        this.columns.forEach(col => {
            produitRow += `<th class="gantt-produit-header">${escapeHtml(col.produit)}</th>`;
        });

        return { processusRow, perimetreRow, produitRow };
    }

    /**
     * Précalcule les cellules occupées pour gérer les rowspans
     */
    buildCellsOccupied(sortedSprints) {
        const cells = new Map(); // cellKey -> { item, rowspan }
        const skipped = new Set(); // cellKeys à ignorer (occupés par rowspan)

        // Pour chaque item du backlog, déterminer sa position et son rowspan
        this.backlog.forEach(item => {
            const colIndex = this.columns.findIndex(col =>
                col.processus === (item.Processus || 'Non défini') &&
                col.perimetre === (item['Périmètre'] || 'Non défini') &&
                col.produit === (item.Produit || 'Non défini')
            );

            if (colIndex === -1) return;

            const sprintDebut = item['Sprint début'];
            const sprintFin = item['Sprint fin'] || sprintDebut;

            const startIndex = sortedSprints.findIndex(s => s.Sprint === sprintDebut);
            const endIndex = sortedSprints.findIndex(s => s.Sprint === sprintFin);

            if (startIndex === -1) return;

            const actualEndIndex = endIndex === -1 ? startIndex : endIndex;
            const rowspan = actualEndIndex - startIndex + 1;

            const cellKey = `${startIndex}-${colIndex}`;

            // Enregistrer la cellule de départ
            cells.set(cellKey, { item, rowspan });

            // Marquer les cellules suivantes comme "skipped"
            for (let i = startIndex + 1; i <= actualEndIndex; i++) {
                skipped.add(`${i}-${colIndex}`);
            }
        });

        return { cells, skipped };
    }

    /**
     * Vérifie si un item est dans un sprint donné
     */
    isInSprint(item, sprintName) {
        const sprintDebut = item['Sprint début'];
        const sprintFin = item['Sprint fin'];

        // Si les deux sont définis, vérifier la plage
        if (sprintDebut && sprintFin) {
            const sortedSprints = this.getSortedSprints();
            const sprintDebutIndex = sortedSprints.findIndex(s => s.Sprint === sprintDebut);
            const sprintFinIndex = sortedSprints.findIndex(s => s.Sprint === sprintFin);
            const currentSprintIndex = sortedSprints.findIndex(s => s.Sprint === sprintName);

            if (sprintDebutIndex !== -1 && sprintFinIndex !== -1 && currentSprintIndex !== -1) {
                return currentSprintIndex >= sprintDebutIndex && currentSprintIndex <= sprintFinIndex;
            }
        }

        // Si seulement sprint début est défini
        if (sprintDebut) {
            return sprintDebut === sprintName;
        }

        return false;
    }

    /**
     * Rendu d'un bloc de phase (pleine largeur)
     */
    renderPhaseBlock(item, rowspan = 1) {
        const phase = item.Phase || 'Sans phase';
        const produit = item.Produit || '';
        const color = item.Couleur || this.getDefaultColor(phase);
        const backlogIndex = this.backlog.indexOf(item);

        return `
            <div class="gantt-phase-block gantt-phase-fullwidth"
                 data-backlog-index="${backlogIndex}"
                 style="background-color: ${escapeHtml(color)};"
                 title="${escapeHtml(produit)} - ${escapeHtml(phase)}">
                <span class="phase-text">${escapeHtml(phase)}</span>
            </div>
        `;
    }

    /**
     * Obtient une couleur par défaut selon la phase
     */
    getDefaultColor(phase) {
        const phaseLower = (phase || '').toLowerCase();
        if (phaseLower.includes('cadrage')) return '#00BCD4';
        if (phaseLower.includes('dev')) return '#FFEB3B';
        if (phaseLower.includes('recette')) return '#FF5722';
        if (phaseLower.includes('prod')) return '#4CAF50';
        return '#9E9E9E';
    }

    /**
     * Attache les événements sur les blocs de phase
     */
    attachPhaseBlockEvents() {
        document.querySelectorAll('.gantt-phase-block').forEach(block => {
            block.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.backlogIndex);
                if (!isNaN(index)) {
                    this.editBacklogItem(index);
                }
            });
        });
    }

    /**
     * Ouvre le formulaire d'édition d'un item backlog
     */
    async editBacklogItem(index) {
        const item = this.backlog[index];
        if (!item) {
            showError('Élément non trouvé');
            return;
        }

        // Préparer les options pour les selects
        const processusOptions = this.processus.map(p => p.Processus).filter(Boolean);
        const perimetresOptions = this.perimetres.map(p => p['Périmetre']).filter(Boolean);
        const sprintsOptions = this.sprints.map(s => s.Sprint).filter(Boolean);
        const produitsOptions = this.produits.map(p => p.Nom).filter(Boolean);

        const content = `
            <form id="formEditBacklog" class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Produit</label>
                        <select name="Produit" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${produitsOptions.map(p => `<option value="${escapeHtml(p)}" ${p === item.Produit ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Processus</label>
                        <select name="Processus" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${processusOptions.map(p => `<option value="${escapeHtml(p)}" ${p === item.Processus ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Périmètre</label>
                        <select name="Périmètre" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${perimetresOptions.map(p => `<option value="${escapeHtml(p)}" ${p === item['Périmètre'] ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phase</label>
                        <input type="text" name="Phase" class="form-input" value="${escapeHtml(item.Phase || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Sprint début</label>
                        <select name="Sprint début" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${sprintsOptions.map(s => `<option value="${escapeHtml(s)}" ${s === item['Sprint début'] ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sprint fin</label>
                        <select name="Sprint fin" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${sprintsOptions.map(s => `<option value="${escapeHtml(s)}" ${s === item['Sprint fin'] ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Couleur</label>
                    <div class="color-picker-row">
                        <input type="color" name="Couleur" class="form-color" value="${item.Couleur || this.getDefaultColor(item.Phase)}">
                        <div class="color-presets">
                            <span class="color-preset" data-color="#00BCD4" style="background: #00BCD4;" title="Cadrage"></span>
                            <span class="color-preset" data-color="#FFEB3B" style="background: #FFEB3B;" title="Dev"></span>
                            <span class="color-preset" data-color="#FF5722" style="background: #FF5722;" title="Recette"></span>
                            <span class="color-preset" data-color="#4CAF50" style="background: #4CAF50;" title="En prod"></span>
                            <span class="color-preset" data-color="#9C27B0" style="background: #9C27B0;" title="Violet"></span>
                            <span class="color-preset" data-color="#E91E63" style="background: #E91E63;" title="Rose"></span>
                            <span class="color-preset" data-color="#2196F3" style="background: #2196F3;" title="Bleu"></span>
                            <span class="color-preset" data-color="#FF9800" style="background: #FF9800;" title="Orange"></span>
                        </div>
                    </div>
                </div>
            </form>
        `;

        showModal({
            title: 'Modifier le projet',
            content: content,
            size: 'medium',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Supprimer',
                    class: 'btn-danger',
                    action: async () => {
                        await this.deleteBacklogItem(index);
                    }
                },
                {
                    label: 'Enregistrer',
                    class: 'btn-primary',
                    action: async () => {
                        await this.saveBacklogItem(index);
                    }
                }
            ]
        });

        // Attacher les événements sur les presets de couleur
        setTimeout(() => {
            document.querySelectorAll('.color-preset').forEach(preset => {
                preset.addEventListener('click', (e) => {
                    const color = e.currentTarget.dataset.color;
                    const colorInput = document.querySelector('input[name="Couleur"]');
                    if (colorInput) {
                        colorInput.value = color;
                    }
                });
            });
        }, 100);
    }

    /**
     * Sauvegarde un item backlog modifié
     */
    async saveBacklogItem(index) {
        const form = document.getElementById('formEditBacklog');
        if (!form) return;

        const formData = new FormData(form);
        const updatedItem = {};

        for (const [key, value] of formData.entries()) {
            updatedItem[key] = value;
        }

        try {
            await updateTableRow('tBacklog', index + 2, updatedItem);

            showSuccess('Projet mis à jour avec succès');
            closeModal();

            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            showError('Erreur lors de la mise à jour: ' + error.message);
        }
    }

    /**
     * Supprime un item backlog
     */
    async deleteBacklogItem(index) {
        const item = this.backlog[index];
        if (!item) return;

        // Demander confirmation
        const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer "${item.Produit || 'cet élément'}" ?`);
        if (!confirmed) return;

        try {
            await deleteTableRow('tBacklog', index + 2);

            showSuccess('Projet supprimé avec succès');
            closeModal();

            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            showError('Erreur lors de la suppression: ' + error.message);
        }
    }

    /**
     * Ouvre le formulaire d'ajout d'un nouvel item backlog
     */
    async addBacklogItem() {
        // Préparer les options pour les selects
        const processusOptions = this.processus.map(p => p.Processus).filter(Boolean);
        const perimetresOptions = this.perimetres.map(p => p['Périmetre']).filter(Boolean);
        const sprintsOptions = this.sprints.map(s => s.Sprint).filter(Boolean);
        const produitsOptions = this.produits.map(p => p.Nom).filter(Boolean);

        const content = `
            <form id="formAddBacklog" class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Produit</label>
                        <select name="Produit" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${produitsOptions.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Processus</label>
                        <select name="Processus" class="form-select" required>
                            <option value="">-- Sélectionner --</option>
                            ${processusOptions.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Périmètre</label>
                        <select name="Périmètre" class="form-select" required>
                            <option value="">-- Sélectionner --</option>
                            ${perimetresOptions.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phase</label>
                        <input type="text" name="Phase" class="form-input" placeholder="Ex: Cadrage, Dev, Recette...">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Sprint début</label>
                        <select name="Sprint début" class="form-select" required>
                            <option value="">-- Sélectionner --</option>
                            ${sprintsOptions.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sprint fin</label>
                        <select name="Sprint fin" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${sprintsOptions.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Couleur</label>
                    <div class="color-picker-row">
                        <input type="color" name="Couleur" class="form-color" value="#00BCD4">
                        <div class="color-presets">
                            <span class="color-preset" data-color="#00BCD4" style="background: #00BCD4;" title="Cadrage"></span>
                            <span class="color-preset" data-color="#FFEB3B" style="background: #FFEB3B;" title="Dev"></span>
                            <span class="color-preset" data-color="#FF5722" style="background: #FF5722;" title="Recette"></span>
                            <span class="color-preset" data-color="#4CAF50" style="background: #4CAF50;" title="En prod"></span>
                            <span class="color-preset" data-color="#9C27B0" style="background: #9C27B0;" title="Violet"></span>
                            <span class="color-preset" data-color="#E91E63" style="background: #E91E63;" title="Rose"></span>
                            <span class="color-preset" data-color="#2196F3" style="background: #2196F3;" title="Bleu"></span>
                            <span class="color-preset" data-color="#FF9800" style="background: #FF9800;" title="Orange"></span>
                        </div>
                    </div>
                </div>
            </form>
        `;

        showModal({
            title: 'Ajouter un projet',
            content: content,
            size: 'medium',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Ajouter',
                    class: 'btn-primary',
                    action: async () => {
                        await this.createBacklogItem();
                    }
                }
            ]
        });

        // Attacher les événements sur les presets de couleur
        setTimeout(() => {
            document.querySelectorAll('.color-preset').forEach(preset => {
                preset.addEventListener('click', (e) => {
                    const color = e.currentTarget.dataset.color;
                    const colorInput = document.querySelector('input[name="Couleur"]');
                    if (colorInput) {
                        colorInput.value = color;
                    }
                });
            });
        }, 100);
    }

    /**
     * Crée un nouvel item backlog
     */
    async createBacklogItem() {
        const form = document.getElementById('formAddBacklog');
        if (!form) return;

        const formData = new FormData(form);
        const newItem = {};

        for (const [key, value] of formData.entries()) {
            newItem[key] = value;
        }

        // Validation basique
        if (!newItem.Processus || !newItem['Périmètre'] || !newItem['Sprint début']) {
            showError('Veuillez remplir les champs obligatoires');
            return;
        }

        try {
            await addTableRow('tBacklog', newItem);

            showSuccess('Projet ajouté avec succès');
            closeModal();

            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Erreur lors de l\'ajout:', error);
            showError('Erreur lors de l\'ajout: ' + error.message);
        }
    }

    /**
     * Attache les événements de la page
     */
    attachEvents() {
        const addBtn = document.getElementById('btnAddBacklogItem');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addBacklogItem());
        }
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        invalidateCache('tBacklog');
        invalidateCache('tSprints');
        invalidateCache('tProcessus');
        invalidateCache('tPerimetres');
        await this.loadData();
    }
}

// Instance globale
let roadmapGanttPageInstance = null;

/**
 * Rendu de la page Roadmap Gantt
 */
async function renderRoadmapGanttPage(container) {
    roadmapGanttPageInstance = new RoadmapGanttPage();
    await roadmapGanttPageInstance.render(container);
}

/**
 * Rafraîchit la page Roadmap Gantt
 */
async function refreshRoadmapGanttPage() {
    if (roadmapGanttPageInstance) {
        await roadmapGanttPageInstance.refresh();
    }
}
