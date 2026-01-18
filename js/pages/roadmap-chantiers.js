/* ===========================================
   ROADMAP-CHANTIERS.JS - Page Roadmap Chantiers
   Application Carto
   =========================================== */

/**
 * Instance globale de la page
 */
let roadmapChantiersPageInstance = null;

/**
 * Classe RoadmapChantiersPage pour gérer la page Roadmap Chantiers
 */
class RoadmapChantiersPage {
    constructor() {
        // Données
        this.chantiers = [];
        this.chantiersArchives = [];
        this.phases = [];
        this.phasesLien = [];
        this.chantierProduit = [];
        this.sprints = [];
        this.acteurs = [];
        this.perimetres = [];
        this.produits = [];

        // Filtres (période par défaut: 1 mois avant à 3 mois après)
        this.filters = {
            dateDebut: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            dateFin: new Date(new Date().setMonth(new Date().getMonth() + 3)),
            perimetres: [],
            responsables: []
        };

        // État
        this.editingPhaseBlock = null;
        this.draggedPhase = null;
        this.resizingPhase = null;
        this.contextMenu = null;
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="roadmap-chantiers-page">
                <!-- Header -->
                <div class="page-header roadmap-chantiers-header">
                    <div class="page-header-left">
                        <h1>Roadmap - Visualisation projets</h1>
                    </div>
                </div>

                <!-- Légende -->
                <div class="legend-container" id="legendContainer"></div>

                <!-- Filtres -->
                <div class="filters-container" id="filtersContainer"></div>

                <!-- Boutons d'action -->
                <div class="action-buttons" id="actionButtons"></div>

                <!-- Tableau Gantt -->
                <div class="gantt-wrapper">
                    <div class="gantt-container" id="ganttContainer">
                        <div class="loading-spinner">Chargement...</div>
                    </div>
                </div>
            </div>
        `;

        await this.loadData();
        this.renderLegend();
        this.renderFilters();
        this.renderActionButtons();
        this.renderGantt();
        this.attachEvents();
    }

    /**
     * Charge les données depuis Excel
     */
    async loadData() {
        try {
            const [
                chantiersData,
                phasesData,
                phasesLienData,
                chantierProduitData,
                sprintsData,
                acteursData,
                perimetresData,
                produitsData
            ] = await Promise.all([
                readTable('tChantiers'),
                readTable('tPhases'),
                readTable('tPhasesLien'),
                readTable('tChantierProduit'),
                readTable('tSprints'),
                readTable('tActeurs'),
                readTable('tPerimetres'),
                readTable('tProduits')
            ]);

            // Séparer chantiers actifs et archivés
            const allChantiers = chantiersData.data || [];
            this.chantiers = allChantiers.filter(c => !this.isArchived(c));
            this.chantiersArchives = allChantiers.filter(c => this.isArchived(c));

            this.phases = phasesData.data || [];
            this.phasesLien = phasesLienData.data || [];
            this.chantierProduit = chantierProduitData.data || [];
            this.sprints = sprintsData.data || [];
            this.acteurs = acteursData.data || [];
            this.perimetres = perimetresData.data || [];
            this.produits = produitsData.data || [];

            // Trier les sprints par date de début
            this.sprints.sort((a, b) => {
                const dateA = this.parseDate(a['Début']);
                const dateB = this.parseDate(b['Début']);
                return dateA - dateB;
            });

            // Initialiser les filtres avec toutes les valeurs (pour afficher tout par défaut)
            this.filters.perimetres = this.getAllPerimetres();
            this.filters.responsables = [...new Set(this.chantiers.map(c => c['Responsable']).filter(Boolean))];

        } catch (error) {
            console.error('Erreur chargement données roadmap chantiers:', error);
            showError('Erreur lors du chargement des données');
        }
    }

    /**
     * Vérifie si un chantier est archivé
     */
    isArchived(chantier) {
        const archived = chantier['Archivé'];
        return archived === true || archived === 'TRUE' || archived === 'Vrai' || archived === 'VRAI' || archived === 1;
    }

    /**
     * Retourne l'union des périmètres (table de référence + ceux utilisés dans les chantiers)
     * Garantit que tous les chantiers sont affichables même si leur périmètre n'est pas dans tPerimetres
     * Utilise une comparaison insensible à la casse pour dédupliquer (VdC == VDC)
     */
    getAllPerimetres() {
        const perimetresFromTable = this.perimetres.map(p => p['Périmetre']).filter(Boolean);
        const perimetresFromChantiers = this.chantiers.map(c => c['Perimetre']).filter(Boolean);
        const allPerimetres = [...perimetresFromTable, ...perimetresFromChantiers];

        // Dédupliquer en ignorant la casse (garder la première occurrence)
        const seen = new Map();
        allPerimetres.forEach(p => {
            const lower = p.toLowerCase();
            if (!seen.has(lower)) {
                seen.set(lower, p);
            }
        });

        return [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    /**
     * Parse une date (Excel ou string)
     */
    parseDate(value) {
        if (!value) return new Date(0);
        if (typeof value === 'number') {
            // Date Excel (nombre de jours depuis 1900)
            return new Date((value - 25569) * 86400 * 1000);
        }
        return new Date(value);
    }

    /**
     * Formate une date en string court
     */
    formatDate(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : this.parseDate(date);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }

    /**
     * Formate un mois (ex: "Juin 25")
     */
    formatMonth(date) {
        const d = date instanceof Date ? date : this.parseDate(date);
        const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    }

    /**
     * Rendu de la légende
     */
    renderLegend() {
        const container = document.getElementById('legendContainer');
        const colors = CONFIG.PHASE_COLORS;
        const types = ['EB', 'Cadrage', 'Dev', 'Recette', 'MEP'];

        container.innerHTML = `
            <span class="legend-label">Légende :</span>
            ${types.map(type => `
                <span class="legend-item">
                    <span class="legend-color" style="background:${colors[type]}"></span>
                    <span class="legend-text">${type}</span>
                </span>
            `).join('')}
        `;
    }

    /**
     * Rendu des filtres
     */
    renderFilters() {
        const container = document.getElementById('filtersContainer');

        // Formatage des dates pour les inputs
        const formatDateInput = (date) => {
            const d = new Date(date);
            return d.toISOString().split('T')[0];
        };

        // Liste unique des périmètres et responsables
        const perimetresList = this.getAllPerimetres();
        const responsablesList = [...new Set(this.chantiers.map(c => c['Responsable']).filter(Boolean))];

        // Calcul des labels
        const perimetreAllSelected = this.filters.perimetres.length === perimetresList.length;
        const perimetreLabel = perimetreAllSelected ? 'Tous' :
            (this.filters.perimetres.length === 0 ? 'Aucun' : this.filters.perimetres.length + ' sélectionné(s)');

        const responsableAllSelected = this.filters.responsables.length === responsablesList.length;
        const responsableLabel = responsableAllSelected ? 'Tous' :
            (this.filters.responsables.length === 0 ? 'Aucun' : this.filters.responsables.length + ' sélectionné(s)');

        container.innerHTML = `
            <div class="filter-group">
                <label>Période :</label>
                <input type="date" id="filterDateDebut" value="${formatDateInput(this.filters.dateDebut)}">
                <span>au</span>
                <input type="date" id="filterDateFin" value="${formatDateInput(this.filters.dateFin)}">
            </div>
            <div class="filter-group">
                <label>Périmètre :</label>
                <div class="multi-select-wrapper" id="perimetreFilterWrapper">
                    <div class="multi-select-trigger" onclick="roadmapChantiersPageInstance.toggleMultiSelect('perimetre')">
                        <span class="multi-select-label">${perimetreLabel}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown" id="perimetreDropdown">
                        <div class="multi-select-actions">
                            <button class="btn btn-xs" onclick="roadmapChantiersPageInstance.selectAllPerimetres()">Tous</button>
                            <button class="btn btn-xs" onclick="roadmapChantiersPageInstance.clearPerimetresFilter()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${perimetresList.map(p => `
                                <label class="multi-select-option">
                                    <input type="checkbox" value="${escapeHtml(p)}"
                                        ${this.filters.perimetres.includes(p) ? 'checked' : ''}
                                        onchange="roadmapChantiersPageInstance.onPerimetreCheckChange()">
                                    <span>${escapeHtml(p)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <label>Responsable :</label>
                <div class="multi-select-wrapper" id="responsableFilterWrapper">
                    <div class="multi-select-trigger" onclick="roadmapChantiersPageInstance.toggleMultiSelect('responsable')">
                        <span class="multi-select-label">${responsableLabel}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown" id="responsableDropdown">
                        <div class="multi-select-actions">
                            <button class="btn btn-xs" onclick="roadmapChantiersPageInstance.selectAllResponsables()">Tous</button>
                            <button class="btn btn-xs" onclick="roadmapChantiersPageInstance.clearResponsablesFilter()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${responsablesList.map(r => `
                                <label class="multi-select-option">
                                    <input type="checkbox" value="${escapeHtml(r)}"
                                        ${this.filters.responsables.includes(r) ? 'checked' : ''}
                                        onchange="roadmapChantiersPageInstance.onResponsableCheckChange()">
                                    <span>${this.formatActorName(r)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btnResetFilters">
                Réinitialiser
            </button>
        `;
    }

    /**
     * Rendu des boutons d'action
     */
    renderActionButtons() {
        const container = document.getElementById('actionButtons');
        container.innerHTML = `
            <button class="btn btn-primary" id="btnAddChantier">
                + Ajouter un chantier
            </button>
            <button class="btn btn-secondary" id="btnShowArchived">
                Réafficher un chantier archivé
            </button>
        `;
    }

    /**
     * Formate le nom d'un acteur à partir de son email
     */
    formatActorName(email) {
        if (!email) return '';
        const acteur = this.acteurs.find(a => a['Mail'] === email);
        if (acteur) {
            return `${acteur['Prénom'] || ''} ${acteur['Nom'] || ''}`.trim() || email;
        }
        return email;
    }

    /**
     * Obtient les sprints visibles selon les filtres de date
     */
    getVisibleSprints() {
        return this.sprints.filter(sprint => {
            const sprintStart = this.parseDate(sprint['Début']);
            const sprintEnd = this.parseDate(sprint['Fin']);
            return sprintEnd >= this.filters.dateDebut && sprintStart <= this.filters.dateFin;
        });
    }

    /**
     * Obtient les chantiers filtrés
     * Note: perimetres/responsables vides = aucun filtre sélectionné = ne rien afficher
     * Pour tout afficher, toutes les valeurs doivent être dans le tableau
     */
    getFilteredChantiers() {
        // Préparer les filtres en lowercase pour comparaison insensible à la casse
        const perimetresLower = this.filters.perimetres.map(p => (p || '').toLowerCase());

        return this.chantiers.filter(chantier => {
            // Filtre par périmètre (vide = afficher aucun) - comparaison insensible à la casse
            if (this.filters.perimetres.length === 0) {
                return false;
            }
            const chantierPerimetre = (chantier['Perimetre'] || '').toLowerCase();
            if (!perimetresLower.includes(chantierPerimetre)) {
                return false;
            }
            // Filtre par responsable (vide = afficher aucun)
            if (this.filters.responsables.length === 0) {
                return false;
            }
            if (!this.filters.responsables.includes(chantier['Responsable'])) {
                return false;
            }
            return true;
        });
    }

    /**
     * Obtient les phases d'un chantier
     */
    getPhasesForChantier(chantierName) {
        return this.phases.filter(p => p['Chantier'] === chantierName);
    }

    /**
     * Obtient l'index d'un sprint
     */
    getSprintIndex(sprintName) {
        return this.sprints.findIndex(s => s['Sprint'] === sprintName);
    }

    /**
     * Rendu du tableau Gantt
     */
    renderGantt() {
        const container = document.getElementById('ganttContainer');
        const visibleSprints = this.getVisibleSprints();
        const filteredChantiers = this.getFilteredChantiers();

        if (visibleSprints.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128197;</div>
                    <div class="empty-state-title">Aucun sprint dans cette période</div>
                    <p>Modifiez les dates de filtrage pour voir les sprints.</p>
                </div>
            `;
            return;
        }

        // Largeur fixe pour chaque colonne sprint (en pixels)
        const SPRINT_COL_WIDTH = 90;

        // Construire les lignes de chantiers
        const rowsHtml = filteredChantiers.map((chantier, chantierIndex) => {
            const chantierName = chantier['Chantier'];
            const chantierPhases = this.getPhasesForChantier(chantierName);

            // Calculer les phases par sprint
            const phasesBySprintRange = this.calculatePhasePositions(chantierPhases, visibleSprints);

            return `
                <tr class="gantt-chantier-row" data-chantier="${escapeHtml(chantierName)}">
                    <td class="gantt-chantier-cell">
                        <div class="chantier-info">
                            <span class="chantier-name" title="${escapeHtml(chantierName)}">${escapeHtml(chantierName)}</span>
                            <div class="chantier-actions">
                                <button class="btn btn-icon btn-xs" title="Modifier" onclick="roadmapChantiersPageInstance.showEditChantierModal('${escapeHtml(chantierName)}')">
                                    &#9998;
                                </button>
                                <button class="btn btn-icon btn-xs" title="Archiver" onclick="roadmapChantiersPageInstance.showArchiveConfirmation('${escapeHtml(chantierName)}')">
                                    &#128451;
                                </button>
                                <button class="btn btn-icon btn-xs btn-danger-icon" title="Supprimer" onclick="roadmapChantiersPageInstance.showDeleteChantierConfirmation('${escapeHtml(chantierName)}')">
                                    &#128465;
                                </button>
                            </div>
                        </div>
                    </td>
                    ${this.renderChantierCells(chantierName, chantierPhases, visibleSprints, phasesBySprintRange)}
                </tr>
            `;
        }).join('');

        // Générer les colgroup avec largeurs fixes
        const colgroupHtml = `
            <colgroup>
                <col class="gantt-col-chantier" style="width: 200px; min-width: 200px;">
                ${visibleSprints.map(() => `<col style="width: ${SPRINT_COL_WIDTH}px; min-width: ${SPRINT_COL_WIDTH}px;">`).join('')}
            </colgroup>
        `;

        // Générer le HTML des sprints (header de table)
        const sprintsHeaderHtml = visibleSprints.map(sprint => `
            <th class="gantt-sprint-header-cell" data-sprint="${escapeHtml(sprint['Sprint'])}">
                <div class="sprint-name">${escapeHtml(sprint['Sprint'])}</div>
                <div class="sprint-date">${this.formatDate(sprint['Début'])}</div>
                <div class="sprint-date">${this.formatDate(sprint['Fin'])}</div>
            </th>
        `).join('');

        container.innerHTML = `
            <div class="gantt-body-wrapper">
                <table class="gantt-chantiers-table gantt-fixed-columns">
                    ${colgroupHtml}
                    <thead>
                        <tr class="gantt-header-row">
                            <th class="gantt-chantier-header">Chantiers</th>
                            ${sprintsHeaderHtml}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml.length > 0 ? rowsHtml : `
                            <tr>
                                <td colspan="${visibleSprints.length + 1}" class="empty-row">
                                    <div class="empty-state-inline">Aucun chantier ne correspond aux filtres</div>
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        // Stocker les sprints visibles pour référence
        this._visibleSprints = visibleSprints;

        // Attacher les événements des cellules
        this.attachCellEvents();

        // Calculer les largeurs des phases après le rendu (basé sur la largeur réelle des colonnes)
        this.updatePhaseWidths();
    }

    /**
     * Calcule les positions des phases pour gérer les chevauchements
     */
    calculatePhasePositions(phases, visibleSprints) {
        const result = {};
        const visibleSprintNames = visibleSprints.map(s => s['Sprint']);

        phases.forEach(phase => {
            const startSprint = phase['Sprint début'];
            const endSprint = phase['Sprint fin'] || startSprint;

            const startIdx = visibleSprintNames.indexOf(startSprint);
            const endIdx = visibleSprintNames.indexOf(endSprint);

            if (startIdx === -1) return;

            const actualEndIdx = endIdx === -1 ? startIdx : endIdx;

            for (let i = startIdx; i <= actualEndIdx; i++) {
                const sprintName = visibleSprintNames[i];
                if (!result[sprintName]) {
                    result[sprintName] = [];
                }
                result[sprintName].push({
                    phase: phase,
                    isStart: i === startIdx,
                    isEnd: i === actualEndIdx,
                    colspan: actualEndIdx - startIdx + 1,
                    startIdx: startIdx
                });
            }
        });

        return result;
    }

    /**
     * Calcule les lanes (voies) pour les phases qui se chevauchent
     * Retourne un objet avec les infos de lane pour chaque phase et le nombre total de lanes
     */
    calculatePhaseLanes(phases, visibleSprints) {
        const visibleSprintNames = visibleSprints.map(s => s['Sprint']);
        const phaseLanes = new Map(); // phase name -> lane number
        const lanes = []; // lanes[i] = end index of last phase in lane i

        // Trier les phases par sprint de début puis par sprint de fin
        const sortedPhases = [...phases].map(phase => {
            const startSprint = phase['Sprint début'];
            const endSprint = phase['Sprint fin'] || startSprint;
            const startIdx = visibleSprintNames.indexOf(startSprint);
            const endIdx = visibleSprintNames.indexOf(endSprint);
            return {
                phase,
                startIdx: startIdx === -1 ? Infinity : startIdx,
                endIdx: endIdx === -1 ? startIdx : endIdx
            };
        }).filter(p => p.startIdx !== Infinity)
          .sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);

        // Assigner chaque phase à une lane
        sortedPhases.forEach(({ phase, startIdx, endIdx }) => {
            // Trouver la première lane disponible
            let assignedLane = -1;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] < startIdx) {
                    // Cette lane est libre (la dernière phase finit avant notre début)
                    assignedLane = i;
                    break;
                }
            }

            if (assignedLane === -1) {
                // Créer une nouvelle lane
                assignedLane = lanes.length;
                lanes.push(endIdx);
            } else {
                // Mettre à jour la fin de la lane
                lanes[assignedLane] = endIdx;
            }

            phaseLanes.set(phase['Phase'], assignedLane);
        });

        return {
            phaseLanes,
            totalLanes: Math.max(1, lanes.length)
        };
    }

    /**
     * Rendu des cellules d'un chantier
     * Nouvelle approche : une cellule par sprint, phases positionnées en CSS avec lanes
     */
    renderChantierCells(chantierName, chantierPhases, visibleSprints, phasesBySprintRange) {
        const cellsHtml = [];
        const renderedPhases = new Set();
        const visibleSprintNames = visibleSprints.map(s => s['Sprint']);

        // Calculer les lanes pour ce chantier
        const { phaseLanes, totalLanes } = this.calculatePhaseLanes(chantierPhases, visibleSprints);

        visibleSprints.forEach((sprint, sprintIdx) => {
            const sprintName = sprint['Sprint'];
            const phasesInCell = phasesBySprintRange[sprintName] || [];

            // Filtrer les phases qui COMMENCENT à ce sprint et pas déjà rendues
            const phasesToRender = phasesInCell.filter(p =>
                p.isStart && !renderedPhases.has(p.phase['Phase'])
            );

            // Marquer les phases comme rendues
            phasesToRender.forEach(p => renderedPhases.add(p.phase['Phase']));

            // Calculer le colspan effectif de chaque phase et ajouter les infos de lane
            const phasesWithColspan = phasesToRender.map(p => {
                const endIdx = Math.min(p.startIdx + p.colspan - 1, visibleSprintNames.length - 1);
                const effectiveColspan = endIdx - sprintIdx + 1;
                const lane = phaseLanes.get(p.phase['Phase']) || 0;
                return { ...p, effectiveColspan, lane };
            });

            // Générer le HTML des phases qui commencent ici
            const phasesHtml = phasesWithColspan.map((p) =>
                this.renderPhaseBlock(p.phase, totalLanes, p.lane, p.effectiveColspan)
            ).join('');

            // Toujours créer une cellule pour chaque sprint
            const hasPhases = phasesWithColspan.length > 0;
            const cellClass = hasPhases ? 'gantt-phase-cell' : 'gantt-empty-cell';

            cellsHtml.push(`
                <td class="gantt-data-cell ${cellClass}"
                    data-chantier="${escapeHtml(chantierName)}"
                    data-sprint="${escapeHtml(sprintName)}"
                    data-total-lanes="${totalLanes}">
                    ${hasPhases
                        ? `<div class="gantt-phases-container" data-total-lanes="${totalLanes}">${phasesHtml}</div>`
                        : `<div class="empty-cell-clickzone" onclick="roadmapChantiersPageInstance.showAddPhaseModal('${escapeHtml(chantierName)}', '${escapeHtml(sprintName)}')"></div>`}
                </td>
            `);
        });

        return cellsHtml.join('');
    }

    /**
     * Rendu d'un bloc de phase
     * La largeur sera calculée dynamiquement après le rendu via updatePhaseWidths()
     * La hauteur et position verticale dépendent du nombre de lanes
     */
    renderPhaseBlock(phase, totalLanes, lane, phaseColspan = 1) {
        const typePhase = phase['Type phase'] || '';
        const color = CONFIG.PHASE_COLORS[typePhase] || '#E0E0E0';
        const phaseName = phase['Phase'] || '';
        const phaseIndex = this.phases.findIndex(p => p['Phase'] === phaseName && p['Chantier'] === phase['Chantier']);

        // Marge à gauche de la phase (pour ne pas coller aux bords)
        const PHASE_MARGIN = 4;

        // Calculer la hauteur et la position verticale en fonction des lanes
        const heightPercent = 100 / totalLanes;
        const topPercent = (lane / totalLanes) * 100;
        const hasMultipleLanes = totalLanes > 1;

        // Note: width sera calculée dynamiquement par updatePhaseWidths() après le rendu
        return `
            <div class="gantt-phase-block ${hasMultipleLanes ? 'lane-mode' : 'fullwidth'}"
                 style="background-color: ${color}; margin-left: ${PHASE_MARGIN}px; ${hasMultipleLanes ? `height: calc(${heightPercent}% - 2px); top: ${topPercent}%;` : ''}"
                 data-phase-index="${phaseIndex}"
                 data-phase-name="${escapeHtml(phaseName)}"
                 data-chantier="${escapeHtml(phase['Chantier'])}"
                 data-colspan="${phaseColspan}"
                 data-lane="${lane}">
                <div class="gantt-resize-handle gantt-resize-handle-left" data-direction="left"></div>
                <span class="phase-name">${escapeHtml(phaseName)}</span>
                <div class="gantt-resize-handle gantt-resize-handle-right" data-direction="right"></div>
            </div>
        `;
    }

    /**
     * Met à jour les largeurs des blocs de phase après le rendu
     * Calcule la largeur réelle des colonnes depuis le DOM
     */
    updatePhaseWidths() {
        const PHASE_MARGIN = 4;

        // Trouver une cellule de sprint pour mesurer sa largeur réelle
        const sprintCell = document.querySelector('.gantt-chantiers-table .gantt-data-cell');
        if (!sprintCell) return;

        // Obtenir la largeur réelle de la cellule (sans bordures)
        const cellWidth = sprintCell.getBoundingClientRect().width;

        // Mettre à jour chaque bloc de phase
        const phaseBlocks = document.querySelectorAll('.gantt-chantiers-table .gantt-phase-block');
        phaseBlocks.forEach(block => {
            const colspan = parseInt(block.dataset.colspan) || 1;
            // Formule: (largeur_cellule × nombre_sprints) - (marge × 2)
            const widthPx = (colspan * cellWidth) - (PHASE_MARGIN * 2);
            block.style.width = `${widthPx}px`;
            block.style.minWidth = `${widthPx}px`;
        });
    }

    /**
     * Attache les événements des filtres (appelé après chaque renderFilters)
     */
    attachFilterEvents() {
        document.getElementById('filterDateDebut')?.addEventListener('change', (e) => {
            this.filters.dateDebut = new Date(e.target.value);
            this.applyFilters();
        });

        document.getElementById('filterDateFin')?.addEventListener('change', (e) => {
            this.filters.dateFin = new Date(e.target.value);
            this.applyFilters();
        });

        document.getElementById('btnResetFilters')?.addEventListener('click', () => {
            this.resetFilters();
        });
    }

    /**
     * Attache les événements généraux
     */
    attachEvents() {
        // Filtres
        this.attachFilterEvents();

        // Boutons d'action
        document.getElementById('btnAddChantier')?.addEventListener('click', () => {
            this.showAddChantierModal();
        });

        document.getElementById('btnShowArchived')?.addEventListener('click', () => {
            this.showArchivedChantiersModal();
        });

        // Fermer les dropdowns en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select-wrapper')) {
                this.closeAllDropdowns();
            }
            if (!e.target.closest('.gantt-context-menu')) {
                this.hideContextMenu();
            }
        });
    }

    /**
     * Attache les événements des cellules du Gantt
     */
    attachCellEvents() {
        const DRAG_THRESHOLD = 5; // Pixels de mouvement avant de considérer un drag

        // Événements des blocs de phase
        document.querySelectorAll('.gantt-phase-block').forEach(block => {
            let clickTimeout = null;
            let mouseDownPos = null;
            let isDragging = false;
            let justDragged = false; // Flag pour ignorer le click après un drag

            // Mousedown - début potentiel de drag
            block.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('gantt-resize-handle')) return;
                if (e.button !== 0) return; // Seulement clic gauche

                mouseDownPos = { x: e.clientX, y: e.clientY };
                isDragging = false;
                justDragged = false;

                const onMouseMove = (moveEvent) => {
                    if (!mouseDownPos) return;

                    const dx = Math.abs(moveEvent.clientX - mouseDownPos.x);
                    const dy = Math.abs(moveEvent.clientY - mouseDownPos.y);

                    if (!isDragging && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
                        // Commencer le drag
                        isDragging = true;
                        justDragged = true;
                        clearTimeout(clickTimeout);
                        this.startCustomDrag(block, moveEvent);
                    }

                    if (isDragging) {
                        this.handleCustomDragMove(moveEvent);
                    }
                };

                const onMouseUp = (upEvent) => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    if (isDragging) {
                        this.handleCustomDragEnd(upEvent);
                    }

                    mouseDownPos = null;
                    isDragging = false;
                    // Reset justDragged après un court délai pour ignorer le click suivant
                    setTimeout(() => { justDragged = false; }, 50);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            // Clic simple - édition inline (ne se déclenche que si pas de drag)
            block.addEventListener('click', (e) => {
                if (e.target.classList.contains('gantt-resize-handle')) return;
                if (justDragged) return; // Ignorer le click après un drag

                clearTimeout(clickTimeout);
                clickTimeout = setTimeout(() => {
                    this.startInlineEdit(block);
                }, 250);
            });

            // Double-clic - ouvrir la fiche
            block.addEventListener('dblclick', (e) => {
                clearTimeout(clickTimeout);
                const phaseIndex = parseInt(block.dataset.phaseIndex);
                this.showEditPhaseModal(phaseIndex);
            });

            // Clic droit - menu contextuel
            block.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const phaseIndex = parseInt(block.dataset.phaseIndex);
                this.showContextMenu(e.clientX, e.clientY, phaseIndex);
            });

            // Resize handles
            block.querySelectorAll('.gantt-resize-handle').forEach(handle => {
                handle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startResize(e, block, handle.dataset.direction);
                });
            });
        });
    }

    /**
     * Démarre le drag personnalisé d'une phase
     */
    startCustomDrag(block, e) {
        const phaseIndex = parseInt(block.dataset.phaseIndex);
        const phase = this.phases[phaseIndex];

        this.draggedPhase = {
            index: phaseIndex,
            phase: phase,
            chantier: phase['Chantier'],
            block: block
        };

        block.classList.add('dragging');
    }

    /**
     * Gère le mouvement pendant le drag personnalisé
     */
    handleCustomDragMove(e) {
        if (!this.draggedPhase) return;

        // Trouver la cellule sous le curseur
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        const cell = elementsUnder.find(el => el.classList.contains('gantt-data-cell'));

        // Nettoyer les anciennes classes
        document.querySelectorAll('.gantt-data-cell').forEach(c => {
            c.classList.remove('drag-over', 'drag-invalid');
        });

        if (cell) {
            const targetChantier = cell.dataset.chantier;
            const sourceChantier = this.draggedPhase.chantier;
            if (targetChantier === sourceChantier) {
                cell.classList.add('drag-over');
            } else {
                cell.classList.add('drag-invalid');
            }
        }
    }

    /**
     * Termine le drag personnalisé
     */
    handleCustomDragEnd(e) {
        if (!this.draggedPhase) return;

        // Trouver la cellule sous le curseur
        const elementsUnder = document.elementsFromPoint(e.clientX, e.clientY);
        const cell = elementsUnder.find(el => el.classList.contains('gantt-data-cell'));

        // Nettoyer les classes
        document.querySelectorAll('.gantt-phase-block').forEach(b => {
            b.classList.remove('dragging');
        });
        document.querySelectorAll('.gantt-data-cell').forEach(c => {
            c.classList.remove('drag-over', 'drag-invalid');
        });

        if (cell) {
            const targetChantier = cell.dataset.chantier;
            const sourceChantier = this.draggedPhase.chantier;
            if (targetChantier === sourceChantier) {
                this.handleDrop(e, cell);
            }
        }

        this.draggedPhase = null;
    }

    // ==========================================
    // GESTION DES FILTRES
    // ==========================================

    toggleMultiSelect(type) {
        const dropdown = document.getElementById(`${type}Dropdown`);
        const allDropdowns = document.querySelectorAll('.multi-select-dropdown');

        allDropdowns.forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });

        dropdown.classList.toggle('open');
    }

    closeAllDropdowns() {
        document.querySelectorAll('.multi-select-dropdown').forEach(d => {
            d.classList.remove('open');
        });
    }

    selectAllPerimetres() {
        // "Tous" = cocher toutes les cases = afficher tous les chantiers
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.filters.perimetres = this.getAllPerimetres();
        this.updatePerimetreLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    clearPerimetresFilter() {
        // "Aucun" = décocher toutes les cases = n'afficher aucun chantier
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.perimetres = [];
        this.updatePerimetreLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    onPerimetreCheckChange() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        this.filters.perimetres = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updatePerimetreLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    updatePerimetreLabel() {
        const label = document.querySelector('#perimetreFilterWrapper .multi-select-label');
        if (label) {
            const allPerimetres = this.getAllPerimetres();
            const allSelected = this.filters.perimetres.length === allPerimetres.length;
            label.textContent = allSelected ? 'Tous' :
                (this.filters.perimetres.length === 0 ? 'Aucun' : this.filters.perimetres.length + ' sélectionné(s)');
        }
    }

    selectAllResponsables() {
        // "Tous" = cocher toutes les cases = afficher tous les chantiers
        const allResponsables = [...new Set(this.chantiers.map(c => c['Responsable']).filter(Boolean))];
        const checkboxes = document.querySelectorAll('#responsableDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.filters.responsables = [...allResponsables];
        this.updateResponsableLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    clearResponsablesFilter() {
        // "Aucun" = décocher toutes les cases = n'afficher aucun chantier
        const checkboxes = document.querySelectorAll('#responsableDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.responsables = [];
        this.updateResponsableLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    onResponsableCheckChange() {
        const checkboxes = document.querySelectorAll('#responsableDropdown input[type="checkbox"]');
        this.filters.responsables = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updateResponsableLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    updateResponsableLabel() {
        const label = document.querySelector('#responsableFilterWrapper .multi-select-label');
        if (label) {
            const allResponsables = [...new Set(this.chantiers.map(c => c['Responsable']).filter(Boolean))];
            const allSelected = this.filters.responsables.length === allResponsables.length;
            label.textContent = allSelected ? 'Tous' :
                (this.filters.responsables.length === 0 ? 'Aucun' : this.filters.responsables.length + ' sélectionné(s)');
        }
    }

    applyFiltersWithoutRenderingFilters() {
        this.renderGantt();
        this.attachCellEvents();
    }

    applyFilters() {
        this.renderFilters();
        this.attachFilterEvents();
        this.renderGantt();
        this.attachCellEvents();
    }

    resetFilters() {
        // Réinitialiser avec les dates par défaut (1 mois avant à 3 mois après)
        // et tous les périmètres/responsables sélectionnés
        this.filters = {
            dateDebut: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            dateFin: new Date(new Date().setMonth(new Date().getMonth() + 3)),
            perimetres: this.getAllPerimetres(),
            responsables: [...new Set(this.chantiers.map(c => c['Responsable']).filter(Boolean))]
        };
        this.applyFilters();
    }

    // ==========================================
    // GESTION DES CHANTIERS
    // ==========================================

    async showAddChantierModal() {
        // Filtrer les acteurs (exclure équipe RPP)
        const acteursFiltered = this.acteurs.filter(a => a['Equipe'] !== 'RPP');

        const content = `
            <form id="formAddChantier" class="form">
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
                        ${this.perimetres.map(p => `
                            <option value="${escapeHtml(p['Périmetre'])}">${escapeHtml(p['Périmetre'])}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Produits associés</label>
                    <input type="text" class="form-control" id="searchProduitsAdd" placeholder="Rechercher un produit..." style="margin-bottom: 8px;">
                    <div class="checkbox-group produits-list" id="produitsListAdd">
                        ${this.produits.map(p => `
                            <label class="checkbox-label" data-produit="${escapeHtml(p['Nom']).toLowerCase()}">
                                <input type="checkbox" name="Produits" value="${escapeHtml(p['Nom'])}">
                                <span>${escapeHtml(p['Nom'])}</span>
                            </label>
                        `).join('')}
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
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Ajouter',
                    class: 'btn-primary',
                    action: async (modal) => {
                        const form = document.getElementById('formAddChantier');
                        if (!form.checkValidity()) {
                            form.reportValidity();
                            return false;
                        }

                        const formData = new FormData(form);
                        const chantierData = {
                            'Chantier': formData.get('Chantier'),
                            'Responsable': formData.get('Responsable'),
                            'Perimetre': formData.get('Perimetre'),
                            'Archivé': form.querySelector('input[name="Archivé"]').checked ? 'TRUE' : 'FALSE'
                        };

                        // Obtenir les produits sélectionnés
                        const produitsSelected = Array.from(form.querySelectorAll('input[name="Produits"]:checked'))
                            .map(cb => cb.value);

                        try {
                            // Ajouter le chantier
                            console.log('Ajout chantier:', chantierData);
                            await addTableRow('tChantiers', chantierData);
                            invalidateCache('tChantiers');
                            console.log('Chantier ajouté avec succès');

                            // Ajouter les liens chantier-produit
                            for (const produit of produitsSelected) {
                                await addTableRow('tChantierProduit', {
                                    'Chantier': chantierData['Chantier'],
                                    'Produit': produit
                                });
                            }
                            invalidateCache('tChantierProduit');

                            showSuccess('Chantier ajouté avec succès');
                            await this.refresh();
                            return true;
                        } catch (error) {
                            console.error('Erreur ajout chantier:', error);
                            const errorMsg = error.message || 'Erreur inconnue';
                            showError(`Erreur lors de l'ajout du chantier: ${errorMsg}`);
                            return false;
                        }
                    }
                }
            ]
        });

        // Attacher l'événement de recherche après le rendu de la modale
        setTimeout(() => {
            const searchInput = document.getElementById('searchProduitsAdd');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('#produitsListAdd .checkbox-label').forEach(label => {
                        const produitName = label.dataset.produit || '';
                        label.style.display = produitName.includes(term) ? '' : 'none';
                    });
                });
            }
        }, 100);
    }

    async showEditChantierModal(chantierName) {
        const chantier = this.chantiers.find(c => c['Chantier'] === chantierName) ||
                        this.chantiersArchives.find(c => c['Chantier'] === chantierName);
        if (!chantier) return;

        // Utiliser _rowIndex stocké par readTable
        const rowIndex = chantier._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for chantier:', chantierName);
            showError('Erreur: index de ligne non trouvé');
            return;
        }

        // Produits associés
        const produitsAssocies = this.chantierProduit
            .filter(cp => cp['Chantier'] === chantierName)
            .map(cp => cp['Produit']);

        // Filtrer les acteurs (exclure équipe RPP)
        const acteursFiltered = this.acteurs.filter(a => a['Equipe'] !== 'RPP');

        const content = `
            <form id="formEditChantier" class="form">
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
                        ${this.perimetres.map(p => `
                            <option value="${escapeHtml(p['Périmetre'])}" ${p['Périmetre'] === chantier['Perimetre'] ? 'selected' : ''}>
                                ${escapeHtml(p['Périmetre'])}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Produits associés</label>
                    <input type="text" class="form-control" id="searchProduitsEdit" placeholder="Rechercher un produit..." style="margin-bottom: 8px;">
                    <div class="checkbox-group produits-list" id="produitsListEdit">
                        ${this.produits.map(p => `
                            <label class="checkbox-label" data-produit="${escapeHtml(p['Nom']).toLowerCase()}">
                                <input type="checkbox" name="Produits" value="${escapeHtml(p['Nom'])}"
                                    ${produitsAssocies.includes(p['Nom']) ? 'checked' : ''}>
                                <span>${escapeHtml(p['Nom'])}</span>
                            </label>
                        `).join('')}
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
            size: 'md',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Enregistrer',
                    class: 'btn-primary',
                    action: async (modal) => {
                        const form = document.getElementById('formEditChantier');
                        if (!form.checkValidity()) {
                            form.reportValidity();
                            return false;
                        }

                        const formData = new FormData(form);
                        const updatedChantier = {
                            'Chantier': formData.get('Chantier'),
                            'Responsable': formData.get('Responsable'),
                            'Perimetre': formData.get('Perimetre'),
                            'Archivé': form.querySelector('input[name="Archivé"]').checked ? 'TRUE' : 'FALSE'
                        };

                        const nouveauxProduits = Array.from(form.querySelectorAll('input[name="Produits"]:checked'))
                            .map(cb => cb.value);

                        try {
                            // Mettre à jour le chantier
                            await updateTableRow('tChantiers', rowIndex, updatedChantier);
                            invalidateCache('tChantiers');

                            // Mettre à jour les liens produits
                            // Supprimer les anciens liens (en ordre inverse pour éviter les décalages)
                            const liensToDelete = this.chantierProduit
                                .filter(cp => cp['Chantier'] === chantierName)
                                .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                            for (const cp of liensToDelete) {
                                if (cp._rowIndex) {
                                    await deleteTableRow('tChantierProduit', cp._rowIndex);
                                }
                            }
                            // Ajouter les nouveaux liens
                            for (const produit of nouveauxProduits) {
                                await addTableRow('tChantierProduit', {
                                    'Chantier': updatedChantier['Chantier'],
                                    'Produit': produit
                                });
                            }
                            invalidateCache('tChantierProduit');

                            showSuccess('Chantier modifié avec succès');
                            await this.refresh();
                            return true;
                        } catch (error) {
                            console.error('Erreur modification chantier:', error);
                            showError('Erreur lors de la modification');
                            return false;
                        }
                    }
                }
            ]
        });

        // Attacher l'événement de recherche après le rendu de la modale
        setTimeout(() => {
            const searchInput = document.getElementById('searchProduitsEdit');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('#produitsListEdit .checkbox-label').forEach(label => {
                        const produitName = label.dataset.produit || '';
                        label.style.display = produitName.includes(term) ? '' : 'none';
                    });
                });
            }
        }, 100);
    }

    async showArchiveConfirmation(chantierName) {
        showConfirmModal(
            'Archiver le chantier',
            `Êtes-vous sûr de vouloir archiver le chantier "${chantierName}" ?`,
            async () => {
                try {
                    const chantier = this.chantiers.find(c => c['Chantier'] === chantierName);
                    if (!chantier) return;

                    // Utiliser _rowIndex stocké par readTable
                    const rowIndex = chantier._rowIndex;
                    if (rowIndex === undefined || rowIndex === null) {
                        console.error('Row index not found for chantier:', chantierName);
                        showError('Erreur: index de ligne non trouvé');
                        return;
                    }

                    const updatedChantier = { ...chantier };
                    updatedChantier['Archivé'] = 'TRUE';

                    await updateTableRow('tChantiers', rowIndex, updatedChantier);
                    invalidateCache('tChantiers');

                    showSuccess('Chantier archivé');
                    await this.refresh();
                } catch (error) {
                    console.error('Erreur archivage:', error);
                    showError('Erreur lors de l\'archivage');
                }
            }
        );
    }

    async showDeleteChantierConfirmation(chantierName) {
        showConfirmModal(
            'Supprimer le chantier',
            `Êtes-vous sûr de vouloir supprimer définitivement le chantier "${chantierName}" et toutes ses phases ?`,
            async () => {
                try {
                    // Supprimer les phases du chantier (en ordre inverse pour éviter les décalages d'index)
                    const phasesToDelete = this.phases
                        .filter(p => p['Chantier'] === chantierName)
                        .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                    for (const phase of phasesToDelete) {
                        if (phase._rowIndex === undefined || phase._rowIndex === null) continue;

                        // Supprimer les liens de la phase (en ordre inverse)
                        const liensToDelete = this.phasesLien
                            .filter(l => l['Phase'] === phase['Phase'])
                            .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                        for (const lien of liensToDelete) {
                            if (lien._rowIndex !== undefined && lien._rowIndex !== null) {
                                await deleteTableRow('tPhasesLien', lien._rowIndex);
                            }
                        }
                        await deleteTableRow('tPhases', phase._rowIndex);
                    }

                    // Supprimer les liens chantier-produit (en ordre inverse)
                    const produitsToDelete = this.chantierProduit
                        .filter(cp => cp['Chantier'] === chantierName)
                        .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                    for (const cp of produitsToDelete) {
                        if (cp._rowIndex !== undefined && cp._rowIndex !== null) {
                            await deleteTableRow('tChantierProduit', cp._rowIndex);
                        }
                    }

                    // Supprimer le chantier
                    const chantier = [...this.chantiers, ...this.chantiersArchives].find(c => c['Chantier'] === chantierName);
                    if (chantier && (chantier._rowIndex !== undefined && chantier._rowIndex !== null)) {
                        await deleteTableRow('tChantiers', chantier._rowIndex);
                    }

                    invalidateCache('tChantiers');
                    invalidateCache('tPhases');
                    invalidateCache('tPhasesLien');
                    invalidateCache('tChantierProduit');

                    showSuccess('Chantier supprimé');
                    await this.refresh();
                } catch (error) {
                    console.error('Erreur suppression:', error);
                    showError('Erreur lors de la suppression');
                }
            },
            'danger'
        );
    }

    async showArchivedChantiersModal() {
        let searchTerm = '';
        let filterPerimetre = '';
        let filterResponsable = '';

        const renderList = () => {
            let filtered = this.chantiersArchives;

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filtered = filtered.filter(c => c['Chantier'].toLowerCase().includes(term));
            }
            if (filterPerimetre) {
                filtered = filtered.filter(c => c['Perimetre'] === filterPerimetre);
            }
            if (filterResponsable) {
                filtered = filtered.filter(c => c['Responsable'] === filterResponsable);
            }

            return filtered.length === 0 ?
                '<p class="text-muted">Aucun chantier archivé trouvé</p>' :
                filtered.map(c => `
                    <div class="archived-chantier-item">
                        <div class="archived-chantier-info">
                            <strong>${escapeHtml(c['Chantier'])}</strong>
                            <span class="text-muted">${this.formatActorName(c['Responsable'])}</span>
                        </div>
                        <button class="btn btn-sm btn-success" onclick="roadmapChantiersPageInstance.unarchiveChantier('${escapeHtml(c['Chantier'])}')">
                            Réafficher
                        </button>
                    </div>
                `).join('');
        };

        const perimList = [...new Set(this.chantiersArchives.map(c => c['Perimetre']).filter(Boolean))];
        const respList = [...new Set(this.chantiersArchives.map(c => c['Responsable']).filter(Boolean))];

        const content = `
            <div class="archived-chantiers-modal">
                <div class="filters-row">
                    <input type="text" class="form-control" id="archivedSearch" placeholder="Rechercher...">
                    <select class="form-control" id="archivedFilterPerimetre">
                        <option value="">Tous les périmètres</option>
                        ${perimList.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
                    </select>
                    <select class="form-control" id="archivedFilterResponsable">
                        <option value="">Tous les responsables</option>
                        ${respList.map(r => `<option value="${escapeHtml(r)}">${this.formatActorName(r)}</option>`).join('')}
                    </select>
                </div>
                <div class="archived-chantiers-list" id="archivedList">
                    ${renderList()}
                </div>
            </div>
        `;

        showModal({
            title: 'Chantiers archivés',
            content: content,
            size: 'lg',
            buttons: [
                { label: 'Fermer', class: 'btn-secondary', action: 'close' }
            ]
        });

        // Attach filter events
        setTimeout(() => {
            document.getElementById('archivedSearch')?.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                document.getElementById('archivedList').innerHTML = renderList();
            });
            document.getElementById('archivedFilterPerimetre')?.addEventListener('change', (e) => {
                filterPerimetre = e.target.value;
                document.getElementById('archivedList').innerHTML = renderList();
            });
            document.getElementById('archivedFilterResponsable')?.addEventListener('change', (e) => {
                filterResponsable = e.target.value;
                document.getElementById('archivedList').innerHTML = renderList();
            });
        }, 100);
    }

    async unarchiveChantier(chantierName) {
        try {
            const chantier = this.chantiersArchives.find(c => c['Chantier'] === chantierName);
            if (!chantier) return;

            // Utiliser _rowIndex stocké par readTable
            const rowIndex = chantier._rowIndex;
            if (rowIndex === undefined || rowIndex === null) {
                console.error('Row index not found for chantier:', chantierName);
                showError('Erreur: index de ligne non trouvé');
                return;
            }

            const updatedChantier = { ...chantier };
            updatedChantier['Archivé'] = 'FALSE';

            await updateTableRow('tChantiers', rowIndex, updatedChantier);
            invalidateCache('tChantiers');

            showSuccess('Chantier réaffiché');

            // Fermer la modale et rafraîchir
            const modal = document.querySelector('.modal-backdrop');
            if (modal) modal.remove();

            await this.refresh();
        } catch (error) {
            console.error('Erreur réaffichage:', error);
            showError('Erreur lors du réaffichage');
        }
    }

    // ==========================================
    // GESTION DES PHASES
    // ==========================================

    async showAddPhaseModal(chantierName, sprintName) {
        const content = `
            <form id="formAddPhase" class="form">
                <div class="form-group">
                    <label class="form-label required">Nom de la phase</label>
                    <input type="text" class="form-control" name="Phase" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Type de phase</label>
                    <select class="form-control" name="Type phase" required>
                        <option value="">-- Sélectionner --</option>
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
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">Sprint début</label>
                        <select class="form-control" name="Sprint début" required>
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === sprintName ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Sprint fin</label>
                        <select class="form-control" name="Sprint fin" required>
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === sprintName ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Lien Teams</label>
                    <input type="text" class="form-control" name="Lien Teams" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Liens supplémentaires</label>
                    <div id="liensContainer" class="liens-container"></div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="roadmapChantiersPageInstance.addLienRow()">
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
                    action: async (modal) => {
                        const form = document.getElementById('formAddPhase');
                        if (!form.checkValidity()) {
                            form.reportValidity();
                            return false;
                        }

                        const formData = new FormData(form);
                        const phaseData = {
                            'Phase': formData.get('Phase'),
                            'Type phase': formData.get('Type phase'),
                            'Description': formData.get('Description'),
                            'Chantier': chantierName,
                            'Sprint début': formData.get('Sprint début'),
                            'Sprint fin': formData.get('Sprint fin'),
                            'Lien Teams': formData.get('Lien Teams'),
                            'Couleur': CONFIG.PHASE_COLORS[formData.get('Type phase')] || ''
                        };

                        try {
                            await addTableRow('tPhases', phaseData);
                            invalidateCache('tPhases');

                            // Ajouter les liens
                            const liens = this.collectLiens();
                            for (const lien of liens) {
                                await addTableRow('tPhasesLien', {
                                    'Phase': phaseData['Phase'],
                                    'Nom lien': lien.nom,
                                    'Lien': lien.url
                                });
                            }
                            invalidateCache('tPhasesLien');

                            showSuccess('Phase ajoutée avec succès');
                            await this.refresh();
                            return true;
                        } catch (error) {
                            console.error('Erreur ajout phase:', error);
                            showError('Erreur lors de l\'ajout de la phase');
                            return false;
                        }
                    }
                }
            ]
        });
    }

    /**
     * Ouvre la modale d'ajout de phase pour un chantier (sans sprint pré-sélectionné)
     */
    showAddPhaseModalForChantier(chantierName) {
        // Utiliser le premier sprint visible comme valeur par défaut
        const firstSprint = this.filteredSprints.length > 0 ? this.filteredSprints[0]['Sprint'] : '';
        this.showAddPhaseModal(chantierName, firstSprint);
    }

    async showEditPhaseModal(phaseIndex) {
        const phase = this.phases[phaseIndex];
        if (!phase) return;

        // Utiliser _rowIndex stocké par readTable
        const rowIndex = phase._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for phase:', phase['Phase']);
            showError('Erreur: index de ligne non trouvé');
            return;
        }

        // Récupérer les liens de cette phase
        const liens = this.phasesLien.filter(l => l['Phase'] === phase['Phase']);

        const content = `
            <form id="formEditPhase" class="form">
                <div class="form-group">
                    <label class="form-label required">Nom de la phase</label>
                    <input type="text" class="form-control" name="Phase" value="${escapeHtml(phase['Phase'])}" required>
                </div>
                <div class="form-group">
                    <label class="form-label required">Type de phase</label>
                    <select class="form-control" name="Type phase" required>
                        <option value="">-- Sélectionner --</option>
                        ${['EB', 'Cadrage', 'Dev', 'Recette', 'MEP'].map(t => `
                            <option value="${t}" ${phase['Type phase'] === t ? 'selected' : ''}>${t}</option>
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
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label required">Sprint début</label>
                        <select class="form-control" name="Sprint début" required>
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === phase['Sprint début'] ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Sprint fin</label>
                        <select class="form-control" name="Sprint fin" required>
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === phase['Sprint fin'] ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Lien Teams</label>
                    <input type="text" class="form-control" name="Lien Teams" value="${escapeHtml(phase['Lien Teams'] || '')}" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Liens supplémentaires</label>
                    <div id="liensContainer" class="liens-container">
                        ${liens.map((l, i) => `
                            <div class="lien-row" data-index="${i}">
                                <input type="text" class="form-control lien-nom" placeholder="Nom du lien" value="${escapeHtml(l['Nom lien'] || '')}">
                                <input type="text" class="form-control lien-url" placeholder="URL" value="${escapeHtml(l['Lien'] || '')}">
                                <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()">&#128465;</button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="roadmapChantiersPageInstance.addLienRow()">
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
                    action: async (modal) => {
                        const form = document.getElementById('formEditPhase');
                        if (!form.checkValidity()) {
                            form.reportValidity();
                            return false;
                        }

                        const formData = new FormData(form);
                        const updatedPhase = {
                            'Phase': formData.get('Phase'),
                            'Type phase': formData.get('Type phase'),
                            'Description': formData.get('Description'),
                            'Chantier': phase['Chantier'],
                            'Sprint début': formData.get('Sprint début'),
                            'Sprint fin': formData.get('Sprint fin'),
                            'Lien Teams': formData.get('Lien Teams'),
                            'Couleur': CONFIG.PHASE_COLORS[formData.get('Type phase')] || ''
                        };

                        try {
                            await updateTableRow('tPhases', rowIndex, updatedPhase);
                            invalidateCache('tPhases');

                            // Supprimer les anciens liens (en ordre inverse pour éviter les décalages)
                            const oldLiens = this.phasesLien
                                .filter(l => l['Phase'] === phase['Phase'])
                                .sort((a, b) => (b._rowIndex ?? 0) - (a._rowIndex ?? 0));

                            for (const lien of oldLiens) {
                                if (lien._rowIndex) {
                                    await deleteTableRow('tPhasesLien', lien._rowIndex);
                                }
                            }

                            // Ajouter les nouveaux liens
                            const newLiens = this.collectLiens();
                            for (const lien of newLiens) {
                                await addTableRow('tPhasesLien', {
                                    'Phase': updatedPhase['Phase'],
                                    'Nom lien': lien.nom,
                                    'Lien': lien.url
                                });
                            }
                            invalidateCache('tPhasesLien');

                            showSuccess('Phase modifiée avec succès');
                            await this.refresh();
                            return true;
                        } catch (error) {
                            console.error('Erreur modification phase:', error);
                            showError('Erreur lors de la modification');
                            return false;
                        }
                    }
                }
            ]
        });
    }

    addLienRow() {
        const container = document.getElementById('liensContainer');
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
    }

    collectLiens() {
        const liens = [];
        document.querySelectorAll('#liensContainer .lien-row').forEach(row => {
            const nom = row.querySelector('.lien-nom')?.value?.trim();
            const url = row.querySelector('.lien-url')?.value?.trim();
            if (nom || url) {
                liens.push({ nom, url });
            }
        });
        return liens;
    }

    async showDeletePhaseConfirmation(phaseIndex) {
        const phase = this.phases[phaseIndex];
        if (!phase) return;

        // Utiliser _rowIndex stocké par readTable
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
                    // Supprimer les liens (en ordre inverse pour éviter les décalages)
                    const liens = this.phasesLien
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
                    await this.refresh();
                } catch (error) {
                    console.error('Erreur suppression phase:', error);
                    showError('Erreur lors de la suppression');
                }
            }
        );
    }

    // ==========================================
    // INTERACTIONS GANTT
    // ==========================================

    startInlineEdit(block) {
        if (this.editingPhaseBlock) {
            this.cancelInlineEdit();
        }

        const nameSpan = block.querySelector('.phase-name');
        const currentName = nameSpan.textContent;
        const phaseIndex = parseInt(block.dataset.phaseIndex);

        // Vérifier que la phase existe
        if (phaseIndex < 0 || phaseIndex >= this.phases.length) {
            console.error('Index de phase invalide:', phaseIndex);
            return;
        }

        this.editingPhaseBlock = block;
        block.classList.add('editing');

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-edit-input';
        input.value = currentName;

        nameSpan.style.display = 'none';
        block.insertBefore(input, nameSpan);
        input.focus();
        input.select();

        const saveEdit = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    const phase = this.phases[phaseIndex];
                    if (!phase || (phase._rowIndex === undefined || phase._rowIndex === null)) {
                        showError('Erreur: index de ligne non trouvé');
                        this.cancelInlineEdit();
                        return;
                    }
                    // Copier les données de la phase pour éviter les mutations
                    const phaseData = { ...phase };
                    phaseData['Phase'] = newName;
                    await updateTableRow('tPhases', phase._rowIndex, phaseData);
                    invalidateCache('tPhases');
                    nameSpan.textContent = newName;
                } catch (error) {
                    console.error('Erreur édition inline:', error);
                    showError('Erreur lors de la modification');
                }
            }
            this.cancelInlineEdit();
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                this.cancelInlineEdit();
            }
        });
    }

    cancelInlineEdit() {
        if (!this.editingPhaseBlock) return;

        const block = this.editingPhaseBlock;
        const input = block.querySelector('.inline-edit-input');
        const nameSpan = block.querySelector('.phase-name');

        if (input) input.remove();
        if (nameSpan) nameSpan.style.display = '';
        block.classList.remove('editing');

        this.editingPhaseBlock = null;
    }

    showContextMenu(x, y, phaseIndex) {
        this.hideContextMenu();

        const phase = this.phases[phaseIndex];
        const chantierName = phase ? phase['Chantier'] : '';

        const menu = document.createElement('div');
        menu.className = 'gantt-context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" onclick="roadmapChantiersPageInstance.showEditPhaseModal(${phaseIndex})">
                <span>&#9998;</span> Modifier
            </div>
            <div class="context-menu-item" onclick="roadmapChantiersPageInstance.hideContextMenu(); roadmapChantiersPageInstance.showAddPhaseModalForChantier('${escapeHtml(chantierName)}')">
                <span>&#10133;</span> Ajouter une phase
            </div>
            <div class="context-menu-item danger" onclick="roadmapChantiersPageInstance.showDeletePhaseConfirmation(${phaseIndex})">
                <span>&#128465;</span> Supprimer
            </div>
        `;

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        document.body.appendChild(menu);

        this.contextMenu = menu;
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    async handleDrop(e, cell) {
        if (!this.draggedPhase) return;

        const targetChantier = cell.dataset.chantier;
        const targetSprint = cell.dataset.sprint;

        // Ne permettre le drop que sur le même chantier
        if (targetChantier !== this.draggedPhase.chantier) {
            showWarning('Déplacement possible uniquement sur la même ligne');
            return;
        }

        // Copier les données avant le traitement async
        const phaseData = { ...this.draggedPhase.phase };
        const rowIndex = this.draggedPhase.phase._rowIndex;

        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for phase');
            showError('Erreur: index de ligne non trouvé');
            return;
        }

        // Calculer le décalage
        const oldStartIdx = this.getSprintIndex(phaseData['Sprint début']);
        const oldEndIdx = this.getSprintIndex(phaseData['Sprint fin'] || phaseData['Sprint début']);
        const duration = Math.max(0, oldEndIdx - oldStartIdx);

        const newStartIdx = this.getSprintIndex(targetSprint);
        const newEndIdx = newStartIdx + duration;

        if (newEndIdx >= this.sprints.length) {
            showWarning('La phase dépasse la période visible');
            return;
        }

        try {
            phaseData['Sprint début'] = this.sprints[newStartIdx]['Sprint'];
            phaseData['Sprint fin'] = this.sprints[newEndIdx]['Sprint'];

            await updateTableRow('tPhases', rowIndex, phaseData);
            invalidateCache('tPhases');

            await this.refresh();
        } catch (error) {
            console.error('Erreur déplacement phase:', error);
            showError('Erreur lors du déplacement');
        }
    }

    startResize(e, block, direction) {
        e.preventDefault();
        const phaseIndex = parseInt(block.dataset.phaseIndex);
        const phase = this.phases[phaseIndex];

        // Stocker les handlers liés pour pouvoir les supprimer plus tard
        this._boundResizeMove = this.handleResizeMove.bind(this);
        this._boundResizeEnd = this.handleResizeEnd.bind(this);

        // Obtenir la largeur réelle d'une cellule sprint
        const sprintCell = document.querySelector('.gantt-chantiers-table .gantt-data-cell');
        const cellWidth = sprintCell ? sprintCell.getBoundingClientRect().width : 100;

        // Obtenir les indices de sprint actuels
        const startIdx = this.getSprintIndex(phase['Sprint début']);
        const endIdx = this.getSprintIndex(phase['Sprint fin'] || phase['Sprint début']);
        const currentColspan = endIdx - startIdx + 1;

        // Obtenir la position et dimensions du bloc
        const blockRect = block.getBoundingClientRect();
        const parentRect = block.parentElement.getBoundingClientRect();

        // Créer l'élément de preview en pointillés
        const preview = document.createElement('div');
        preview.className = 'gantt-resize-preview';
        preview.style.left = '0';
        preview.style.width = blockRect.width + 'px';
        block.parentElement.appendChild(preview);

        // Ajouter la classe de resize au bloc
        block.classList.add('resizing');

        this.resizingPhase = {
            index: phaseIndex,
            phase: { ...phase },
            direction: direction,
            startX: e.clientX,
            block: block,
            preview: preview,
            cellWidth: cellWidth,
            startIdx: startIdx,
            endIdx: endIdx,
            currentColspan: currentColspan,
            initialLeft: 0,
            initialWidth: blockRect.width
        };

        document.addEventListener('mousemove', this._boundResizeMove);
        document.addEventListener('mouseup', this._boundResizeEnd);
    }

    handleResizeMove(e) {
        if (!this.resizingPhase) return;

        const { direction, startX, preview, cellWidth, startIdx, endIdx, initialWidth, initialLeft } = this.resizingPhase;
        const deltaX = e.clientX - startX;

        // Calculer le nombre de sprints de décalage (arrondi à l'entier le plus proche)
        const sprintDelta = Math.round(deltaX / cellWidth);

        // Calculer les nouveaux indices
        let newStartIdx = startIdx;
        let newEndIdx = endIdx;

        if (direction === 'left') {
            // Ancrage gauche: modifier le début
            newStartIdx = startIdx + sprintDelta;
            // Limites: ne pas dépasser le début des sprints, et garder au moins 1 sprint
            newStartIdx = Math.max(0, Math.min(newStartIdx, endIdx));
        } else {
            // Ancrage droit: modifier la fin
            newEndIdx = endIdx + sprintDelta;
            // Limites: ne pas dépasser la fin des sprints, et garder au moins 1 sprint
            newEndIdx = Math.min(this.sprints.length - 1, Math.max(newEndIdx, startIdx));
        }

        const newColspan = newEndIdx - newStartIdx + 1;
        const PHASE_MARGIN = 4;

        // Calculer la nouvelle largeur et position de la preview
        const newWidth = (newColspan * cellWidth) - (PHASE_MARGIN * 2);

        if (direction === 'left') {
            // Pour l'ancrage gauche, on décale aussi la position left
            const leftOffset = (newStartIdx - startIdx) * cellWidth;
            preview.style.left = leftOffset + 'px';
        } else {
            preview.style.left = '0';
        }

        preview.style.width = newWidth + 'px';

        // Stocker les valeurs calculées pour handleResizeEnd
        this.resizingPhase.newStartIdx = newStartIdx;
        this.resizingPhase.newEndIdx = newEndIdx;
        this.resizingPhase.sprintDelta = sprintDelta;
    }

    async handleResizeEnd(e) {
        if (!this.resizingPhase) return;

        // Supprimer les event listeners avec les mêmes références
        document.removeEventListener('mousemove', this._boundResizeMove);
        document.removeEventListener('mouseup', this._boundResizeEnd);

        const { phase, direction, block, preview, newStartIdx, newEndIdx, startIdx, endIdx } = this.resizingPhase;

        // Supprimer la preview et la classe resizing
        if (preview && preview.parentNode) {
            preview.parentNode.removeChild(preview);
        }
        if (block) {
            block.classList.remove('resizing');
        }

        // Vérifier si il y a eu un changement
        const hasChanged = (direction === 'left' && newStartIdx !== startIdx) ||
                          (direction === 'right' && newEndIdx !== endIdx);

        if (!hasChanged || newStartIdx === undefined || newEndIdx === undefined) {
            this.resizingPhase = null;
            return;
        }

        // Vérifier que _rowIndex existe
        const rowIndex = phase._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for phase');
            showError('Erreur: index de ligne non trouvé');
            this.resizingPhase = null;
            return;
        }

        try {
            if (direction === 'left') {
                // Ancrage gauche: modifier Sprint début
                phase['Sprint début'] = this.sprints[newStartIdx]['Sprint'];
            } else {
                // Ancrage droit: modifier Sprint fin
                phase['Sprint fin'] = this.sprints[newEndIdx]['Sprint'];
            }

            await updateTableRow('tPhases', rowIndex, phase);
            invalidateCache('tPhases');

            await this.refresh();
        } catch (error) {
            console.error('Erreur resize phase:', error);
            showError('Erreur lors du redimensionnement');
        }

        this.resizingPhase = null;
    }

    // ==========================================
    // REFRESH
    // ==========================================

    async refresh() {
        await this.loadData();
        this.renderFilters();
        this.attachFilterEvents();
        this.renderGantt();
        this.attachCellEvents();
    }
}

/**
 * Fonction de rendu de la page (appelée depuis app.js)
 */
async function renderRoadmapChantiersPage(container) {
    roadmapChantiersPageInstance = new RoadmapChantiersPage();
    await roadmapChantiersPageInstance.render(container);
}

/**
 * Fonction de rafraîchissement (appelée depuis app.js)
 */
async function refreshRoadmapChantiersPage() {
    if (roadmapChantiersPageInstance) {
        await roadmapChantiersPageInstance.refresh();
    }
}
