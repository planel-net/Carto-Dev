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
    // Constantes de dimensionnement (en pixels)
    static SPRINT_COL_WIDTH = 90;
    static PHASE_MARGIN = 4;

    constructor() {
        // Données
        this.chantiers = [];
        this.chantiersArchives = [];
        this.phases = [];
        this.phasesLien = [];
        this.chantierProduit = [];
        this.chantierDataAna = [];
        this.chantierNotes = [];
        this.sprints = [];
        this.acteurs = [];
        this.perimetres = [];
        this.produits = [];
        this.dataAnas = [];
        this.processus = [];

        // Filtres (période par défaut: 1 mois avant à 3 mois après)
        this.filters = {
            dateDebut: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            dateFin: new Date(new Date().setMonth(new Date().getMonth() + 3)),
            perimetres: [],
            responsables: [],
            perimetreProcessus: []
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
                chantierDataAnaData,
                sprintsData,
                acteursData,
                perimetresData,
                produitsData,
                dataAnasData,
                processusData
            ] = await Promise.all([
                readTable('tChantiers'),
                readTable('tPhases'),
                readTable('tPhasesLien'),
                readTable('tChantierProduit'),
                readTable('tChantierDataAna'),
                readTable('tSprints'),
                readTable('tActeurs'),
                readTable('tPerimetres'),
                readTable('tProduits'),
                readTable('tDataAnas'),
                readTable('tProcessus')
            ]);

            // Séparer chantiers actifs et archivés
            const allChantiers = chantiersData.data || [];
            this.chantiers = allChantiers.filter(c => !this.isArchived(c));
            this.chantiersArchives = allChantiers.filter(c => this.isArchived(c));

            this.phases = phasesData.data || [];
            this.phasesLien = phasesLienData.data || [];
            this.chantierProduit = chantierProduitData.data || [];
            this.chantierDataAna = chantierDataAnaData.data || [];
            this.sprints = sprintsData.data || [];
            this.acteurs = acteursData.data || [];
            this.perimetres = perimetresData.data || [];
            this.produits = produitsData.data || [];
            this.dataAnas = dataAnasData.data || [];
            this.processus = processusData.data || [];

            // Trier les processus par ordre
            this.processus.sort((a, b) => {
                const ordreA = a['Ordre'] || 999;
                const ordreB = b['Ordre'] || 999;
                return ordreA - ordreB;
            });

            // Trier les sprints par date de début
            this.sprints.sort((a, b) => {
                const dateA = this.parseDate(a['Début']);
                const dateB = this.parseDate(b['Début']);
                return dateA - dateB;
            });

            // Initialiser les filtres avec toutes les valeurs (pour afficher tout par défaut, y compris "Non rempli")
            this.filters.perimetres = this.getAllPerimetres();
            this.filters.responsables = this.getAllResponsables();
            this.filters.perimetreProcessus = this.getAllPerimetreProcessus();

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
        // Gérer tous les formats possibles: booléen, chaîne, nombre
        if (archived === true || archived === 1) return true;
        if (typeof archived === 'string') {
            const lower = archived.toLowerCase().trim();
            return lower === 'true' || lower === 'vrai' || lower === 'oui' || lower === '1';
        }
        return false;
    }

    /**
     * Retourne l'union des périmètres (table de référence + ceux utilisés dans les chantiers)
     * Garantit que tous les chantiers sont affichables même si leur périmètre n'est pas dans tPerimetres
     * Utilise une comparaison insensible à la casse pour dédupliquer (VdC == VDC)
     * Inclut l'option "(Non rempli)" si des chantiers n'ont pas de périmètre
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

        const result = [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Ajouter l'option "(Non rempli)" si des chantiers n'ont pas de périmètre
        const hasEmptyPerimetre = this.chantiers.some(c => !c['Perimetre']);
        if (hasEmptyPerimetre) {
            result.push(CONFIG.EMPTY_FILTER_VALUE);
        }

        return result;
    }

    /**
     * Retourne la liste des responsables incluant l'option "(Non rempli)" si nécessaire
     */
    getAllResponsables() {
        const responsables = [...new Set(this.chantiers.map(c => c['Responsable']).filter(Boolean))];
        const result = responsables.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Ajouter l'option "(Non rempli)" si des chantiers n'ont pas de responsable
        const hasEmptyResponsable = this.chantiers.some(c => !c['Responsable']);
        if (hasEmptyResponsable) {
            result.push(CONFIG.EMPTY_FILTER_VALUE);
        }

        return result;
    }

    /**
     * Retourne la liste des couples Périmètre-Processus existants dans les chantiers
     * Format: "Périmètre-Processus" ou juste "Périmètre" ou "Processus" si l'un est vide
     * Inclut "(Non rempli)" si des chantiers n'ont ni périmètre ni processus
     */
    getAllPerimetreProcessus() {
        const couples = new Set();
        let hasEmpty = false;

        this.chantiers.forEach(c => {
            const perimetre = c['Perimetre'] || '';
            const processus = c['Processus'] || '';

            if (!perimetre && !processus) {
                hasEmpty = true;
            } else {
                let label = '';
                if (perimetre && processus) {
                    label = `${perimetre}-${processus}`;
                } else if (perimetre) {
                    label = perimetre;
                } else {
                    label = processus;
                }
                if (label) {
                    couples.add(label);
                }
            }
        });

        const result = [...couples].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Ajouter "(Non rempli)" en dernier si des chantiers n'ont ni périmètre ni processus
        if (hasEmpty) {
            result.push(CONFIG.EMPTY_FILTER_VALUE);
        }

        return result;
    }

    /**
     * Retourne la liste des processus uniques (ordonnés par Ordre)
     */
    /**
     * Retourne la liste des processus uniques, triés par Ordre (premier Ordre trouvé pour chaque processus)
     */
    getOrderedProcessus() {
        // this.processus est déjà trié par Ordre dans loadData()
        // On garde juste les valeurs distinctes en préservant l'ordre
        const seen = new Set();
        const result = [];
        for (const p of this.processus) {
            const processusName = p['Processus'];
            if (processusName && !seen.has(processusName)) {
                seen.add(processusName);
                result.push(processusName);
            }
        }
        return result;
    }

    /**
     * Retourne la liste des couples Périmètre-Processus filtrés par les périmètres sélectionnés
     * Si aucun périmètre n'est sélectionné, retourne tous les couples
     */
    getFilteredPerimetreProcessus() {
        // Si tous les périmètres sont sélectionnés ou aucun filtre actif, retourner tous
        const allPerimetres = this.getAllPerimetres();
        const selectedPerimetres = this.filters.perimetres;

        // Périmètres sélectionnés (sans l'option "Non rempli") en lowercase pour comparaison
        const selectedPerimetresLower = selectedPerimetres
            .filter(p => p !== CONFIG.EMPTY_FILTER_VALUE)
            .map(p => p.toLowerCase());
        const includeEmptyPerimetre = selectedPerimetres.includes(CONFIG.EMPTY_FILTER_VALUE);

        const couples = new Set();
        let hasEmpty = false;

        this.chantiers.forEach(c => {
            const perimetre = c['Perimetre'] || '';
            const processus = c['Processus'] || '';

            // Vérifier si le périmètre du chantier correspond aux périmètres sélectionnés
            const perimetreMatch = perimetre === ''
                ? includeEmptyPerimetre
                : selectedPerimetresLower.includes(perimetre.toLowerCase());

            if (!perimetreMatch) return;

            if (!perimetre && !processus) {
                hasEmpty = true;
            } else {
                let label = '';
                if (perimetre && processus) {
                    label = `${perimetre}-${processus}`;
                } else if (perimetre) {
                    label = perimetre;
                } else {
                    label = processus;
                }
                if (label) {
                    couples.add(label);
                }
            }
        });

        const result = [...couples].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        if (hasEmpty) {
            result.push(CONFIG.EMPTY_FILTER_VALUE);
        }

        return result;
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

        // Liste unique des périmètres, responsables et couples périmètre-processus (filtrés par périmètre)
        const perimetresList = this.getAllPerimetres();
        const responsablesList = this.getAllResponsables();
        const perimetreProcessusList = this.getFilteredPerimetreProcessus();

        // Calcul des labels
        const perimetreAllSelected = this.filters.perimetres.length === perimetresList.length;
        const perimetreLabel = perimetreAllSelected ? 'Tous' :
            (this.filters.perimetres.length === 0 ? 'Aucun' : this.filters.perimetres.length + ' sélectionné(s)');

        const responsableAllSelected = this.filters.responsables.length === responsablesList.length;
        const responsableLabel = responsableAllSelected ? 'Tous' :
            (this.filters.responsables.length === 0 ? 'Aucun' : this.filters.responsables.length + ' sélectionné(s)');

        const perimProcessAllSelected = this.filters.perimetreProcessus.length === perimetreProcessusList.length;
        const perimProcessLabel = perimProcessAllSelected ? 'Tous' :
            (this.filters.perimetreProcessus.length === 0 ? 'Aucun' : this.filters.perimetreProcessus.length + ' sélectionné(s)');

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
                                <label class="multi-select-option${p === CONFIG.EMPTY_FILTER_VALUE ? ' empty-option' : ''}">
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
                                <label class="multi-select-option${r === CONFIG.EMPTY_FILTER_VALUE ? ' empty-option' : ''}">
                                    <input type="checkbox" value="${escapeHtml(r)}"
                                        ${this.filters.responsables.includes(r) ? 'checked' : ''}
                                        onchange="roadmapChantiersPageInstance.onResponsableCheckChange()">
                                    <span>${r === CONFIG.EMPTY_FILTER_VALUE ? r : this.formatActorName(r)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="filter-group filter-group-wide">
                <label>Périmètre-Processus :</label>
                <div class="multi-select-wrapper multi-select-wide" id="perimetreProcessusFilterWrapper">
                    <div class="multi-select-trigger" onclick="roadmapChantiersPageInstance.toggleMultiSelect('perimetreProcessus')">
                        <span class="multi-select-label">${perimProcessLabel}</span>
                        <span class="multi-select-arrow">&#9662;</span>
                    </div>
                    <div class="multi-select-dropdown multi-select-dropdown-wide" id="perimetreProcessusDropdown">
                        <div class="multi-select-actions">
                            <button class="btn btn-xs" onclick="roadmapChantiersPageInstance.selectAllPerimetreProcessus()">Tous</button>
                            <button class="btn btn-xs" onclick="roadmapChantiersPageInstance.clearPerimetreProcessusFilter()">Aucun</button>
                        </div>
                        <div class="multi-select-options">
                            ${perimetreProcessusList.map(pp => `
                                <label class="multi-select-option${pp === CONFIG.EMPTY_FILTER_VALUE ? ' empty-option' : ''}">
                                    <input type="checkbox" value="${escapeHtml(pp)}"
                                        ${this.filters.perimetreProcessus.includes(pp) ? 'checked' : ''}
                                        onchange="roadmapChantiersPageInstance.onPerimetreProcessusCheckChange()">
                                    <span>${escapeHtml(pp)}</span>
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
            <button class="btn btn-secondary" id="btnExportPdf" title="Exporter en PDF">
                &#128196; PDF
            </button>
            <button class="btn btn-secondary" id="btnShowArchived">
                Réafficher un chantier archivé
            </button>
            <button class="btn btn-secondary" id="btnRefreshTable" title="Recharger les données du tableau">
                &#8635; Actualiser tableau
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
     * Gère l'option "(Non rempli)" pour afficher les chantiers sans périmètre/responsable
     */
    getFilteredChantiers() {
        // Préparer les filtres en lowercase pour comparaison insensible à la casse
        const perimetresLower = this.filters.perimetres
            .filter(p => p !== CONFIG.EMPTY_FILTER_VALUE)
            .map(p => (p || '').toLowerCase());
        const includeEmptyPerimetre = this.filters.perimetres.includes(CONFIG.EMPTY_FILTER_VALUE);
        const includeEmptyResponsable = this.filters.responsables.includes(CONFIG.EMPTY_FILTER_VALUE);
        const includeEmptyPerimProcessus = this.filters.perimetreProcessus.includes(CONFIG.EMPTY_FILTER_VALUE);

        // Préparer les valeurs du filtre périmètre-processus en lowercase
        const perimetreProcessusLower = this.filters.perimetreProcessus
            .filter(pp => pp !== CONFIG.EMPTY_FILTER_VALUE)
            .map(pp => (pp || '').toLowerCase());

        return this.chantiers.filter(chantier => {
            // Filtre par périmètre (vide = afficher aucun) - comparaison insensible à la casse
            if (this.filters.perimetres.length === 0) {
                return false;
            }
            const chantierPerimetre = (chantier['Perimetre'] || '').toLowerCase();
            const perimetreMatch = chantierPerimetre === ''
                ? includeEmptyPerimetre
                : perimetresLower.includes(chantierPerimetre);
            if (!perimetreMatch) {
                return false;
            }

            // Filtre par responsable (vide = afficher aucun)
            if (this.filters.responsables.length === 0) {
                return false;
            }
            const chantierResponsable = chantier['Responsable'];
            const responsableMatch = !chantierResponsable
                ? includeEmptyResponsable
                : this.filters.responsables.includes(chantierResponsable);
            if (!responsableMatch) {
                return false;
            }

            // Filtre par périmètre-processus (vide = afficher aucun)
            if (this.filters.perimetreProcessus.length === 0) {
                return false;
            }
            const perimetre = chantier['Perimetre'] || '';
            const processus = chantier['Processus'] || '';

            // Construire le label périmètre-processus du chantier
            let chantierPerimProcessus = '';
            if (perimetre && processus) {
                chantierPerimProcessus = `${perimetre}-${processus}`;
            } else if (perimetre) {
                chantierPerimProcessus = perimetre;
            } else if (processus) {
                chantierPerimProcessus = processus;
            }

            const perimProcessusMatch = chantierPerimProcessus === ''
                ? includeEmptyPerimProcessus
                : perimetreProcessusLower.includes(chantierPerimProcessus.toLowerCase());
            if (!perimProcessusMatch) {
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
        const SPRINT_COL_WIDTH = RoadmapChantiersPage.SPRINT_COL_WIDTH;

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
                                <button class="btn btn-icon btn-xs" title="Modifier" onclick="roadmapChantiersPageInstance.showEditChantierModal('${escapeJsString(chantierName)}')">
                                    &#9998;
                                </button>
                                <button class="btn btn-icon btn-xs" title="Archiver" onclick="roadmapChantiersPageInstance.showArchiveConfirmation('${escapeJsString(chantierName)}')">
                                    &#128451;
                                </button>
                                <button class="btn btn-icon btn-xs btn-danger-icon" title="Supprimer" onclick="roadmapChantiersPageInstance.showDeleteChantierConfirmation('${escapeJsString(chantierName)}')">
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
                        : `<div class="empty-cell-clickzone" onclick="roadmapChantiersPageInstance.showAddPhaseModal('${escapeJsString(chantierName)}', '${escapeJsString(sprintName)}')"></div>`}
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
        const PHASE_MARGIN = RoadmapChantiersPage.PHASE_MARGIN;

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
     * Calcule la largeur basée sur les positions réelles des cellules cibles
     */
    updatePhaseWidths() {
        const PHASE_MARGIN = RoadmapChantiersPage.PHASE_MARGIN;

        // Mettre à jour chaque bloc de phase
        const phaseBlocks = document.querySelectorAll('.gantt-chantiers-table .gantt-phase-block');
        phaseBlocks.forEach(block => {
            const colspan = parseInt(block.dataset.colspan) || 1;

            // Trouver la cellule parente (première cellule où commence la phase)
            const parentCell = block.closest('.gantt-data-cell');
            if (!parentCell) return;

            // Trouver la ligne du chantier
            const row = parentCell.closest('tr');
            if (!row) return;

            // Obtenir toutes les cellules de données de cette ligne
            const dataCells = Array.from(row.querySelectorAll('.gantt-data-cell'));
            const startCellIndex = dataCells.indexOf(parentCell);
            const endCellIndex = Math.min(startCellIndex + colspan - 1, dataCells.length - 1);

            // Calculer la largeur totale des cellules couvertes
            const startCell = dataCells[startCellIndex];
            const endCell = dataCells[endCellIndex];

            if (startCell && endCell) {
                const startRect = startCell.getBoundingClientRect();
                const endRect = endCell.getBoundingClientRect();

                // Largeur = de gauche de la première cellule à droite de la dernière, moins les marges
                const totalWidth = (endRect.right - startRect.left) - (PHASE_MARGIN * 2);
                block.style.width = `${totalWidth}px`;
                block.style.minWidth = `${totalWidth}px`;
            }
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

        document.getElementById('btnExportPdf')?.addEventListener('click', () => {
            this.showPdfExportModal();
        });

        document.getElementById('btnRefreshTable')?.addEventListener('click', () => {
            this.refreshTable();
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

        // Recalculer les largeurs des phases lors du redimensionnement de la fenêtre
        let resizeTimeout = null;
        window.addEventListener('resize', () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updatePhaseWidths();
            }, 100);
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
        this.refreshPerimetreProcessusDropdown();
        this.applyFiltersWithoutRenderingFilters();
    }

    clearPerimetresFilter() {
        // "Aucun" = décocher toutes les cases = n'afficher aucun chantier
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.perimetres = [];
        this.updatePerimetreLabel();
        this.refreshPerimetreProcessusDropdown();
        this.applyFiltersWithoutRenderingFilters();
    }

    onPerimetreCheckChange() {
        const checkboxes = document.querySelectorAll('#perimetreDropdown input[type="checkbox"]');
        this.filters.perimetres = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updatePerimetreLabel();
        this.refreshPerimetreProcessusDropdown();
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

    /**
     * Rafraîchit le dropdown Périmètre-Processus en fonction des périmètres sélectionnés
     * Met à jour les options disponibles et réinitialise la sélection
     */
    refreshPerimetreProcessusDropdown() {
        const optionsContainer = document.querySelector('#perimetreProcessusDropdown .multi-select-options');
        if (!optionsContainer) return;

        // Obtenir les couples filtrés par les périmètres sélectionnés
        const filteredList = this.getFilteredPerimetreProcessus();

        // Reconstruire les options
        optionsContainer.innerHTML = filteredList.map(pp => `
            <label class="multi-select-option${pp === CONFIG.EMPTY_FILTER_VALUE ? ' empty-option' : ''}">
                <input type="checkbox" value="${escapeHtml(pp)}"
                    checked
                    onchange="roadmapChantiersPageInstance.onPerimetreProcessusCheckChange()">
                <span>${escapeHtml(pp)}</span>
            </label>
        `).join('');

        // Mettre à jour le filtre avec toutes les valeurs filtrées (tout coché par défaut)
        this.filters.perimetreProcessus = [...filteredList];
        this.updatePerimetreProcessusLabel();
    }

    selectAllResponsables() {
        // "Tous" = cocher toutes les cases = afficher tous les chantiers (y compris sans responsable)
        const checkboxes = document.querySelectorAll('#responsableDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.filters.responsables = this.getAllResponsables();
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
            const allResponsables = this.getAllResponsables();
            const allSelected = this.filters.responsables.length === allResponsables.length;
            label.textContent = allSelected ? 'Tous' :
                (this.filters.responsables.length === 0 ? 'Aucun' : this.filters.responsables.length + ' sélectionné(s)');
        }
    }

    selectAllPerimetreProcessus() {
        const checkboxes = document.querySelectorAll('#perimetreProcessusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        // Utiliser la liste filtrée par les périmètres
        this.filters.perimetreProcessus = this.getFilteredPerimetreProcessus();
        this.updatePerimetreProcessusLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    clearPerimetreProcessusFilter() {
        const checkboxes = document.querySelectorAll('#perimetreProcessusDropdown input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.filters.perimetreProcessus = [];
        this.updatePerimetreProcessusLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    onPerimetreProcessusCheckChange() {
        const checkboxes = document.querySelectorAll('#perimetreProcessusDropdown input[type="checkbox"]');
        this.filters.perimetreProcessus = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        this.updatePerimetreProcessusLabel();
        this.applyFiltersWithoutRenderingFilters();
    }

    updatePerimetreProcessusLabel() {
        const label = document.querySelector('#perimetreProcessusFilterWrapper .multi-select-label');
        if (label) {
            // Utiliser la liste filtrée par les périmètres pour le calcul du "Tous"
            const filteredPerimetreProcessus = this.getFilteredPerimetreProcessus();
            const allSelected = this.filters.perimetreProcessus.length === filteredPerimetreProcessus.length;
            label.textContent = allSelected ? 'Tous' :
                (this.filters.perimetreProcessus.length === 0 ? 'Aucun' : this.filters.perimetreProcessus.length + ' sélectionné(s)');
        }
    }

    applyFiltersWithoutRenderingFilters() {
        this.renderGantt();
        // attachCellEvents est appelé dans renderGantt, pas besoin de l'appeler ici
    }

    applyFilters() {
        this.renderFilters();
        this.attachFilterEvents();
        this.renderGantt();
        // attachCellEvents est appelé dans renderGantt, pas besoin de l'appeler ici
    }

    resetFilters() {
        // Réinitialiser avec les dates par défaut (1 mois avant à 3 mois après)
        // et tous les périmètres/responsables/périmètre-processus sélectionnés (y compris "Non rempli")
        this.filters = {
            dateDebut: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            dateFin: new Date(new Date().setMonth(new Date().getMonth() + 3)),
            perimetres: this.getAllPerimetres(),
            responsables: this.getAllResponsables(),
            perimetreProcessus: this.getAllPerimetreProcessus()
        };
        this.applyFilters();
    }

    // ==========================================
    // GESTION DES CHANTIERS
    // ==========================================

    async showAddChantierModal() {
        // Filtrer les acteurs (exclure équipe RPP)
        const acteursFiltered = this.acteurs.filter(a => a['Equipe'] !== 'RPP');

        // Listes temporaires pour les produits et DataAnas sélectionnés
        let selectedProduits = [];
        let selectedDataAnas = [];

        const renderAssignedProduits = () => {
            const container = document.getElementById('assignedProduitsAdd');
            if (!container) return;

            if (selectedProduits.length === 0) {
                container.innerHTML = '<div class="assigned-items-empty">Aucun produit assigné</div>';
                return;
            }

            container.innerHTML = selectedProduits.map(produitName => {
                const produit = this.produits.find(p => p['Nom'] === produitName);
                let responsableDisplay = '';
                if (produit && produit['Responsable']) {
                    const acteur = this.acteurs.find(a => a['Mail'] === produit['Responsable']);
                    responsableDisplay = acteur ? `${acteur['Prénom'] || ''} ${acteur['Nom'] || ''}`.trim() : produit['Responsable'];
                }
                return `
                    <div class="assigned-item" data-produit="${escapeHtml(produitName)}">
                        <div class="assigned-item-info">
                            <div class="assigned-item-name">${escapeHtml(produitName)}</div>
                            ${responsableDisplay ? `<div class="assigned-item-detail">${escapeHtml(responsableDisplay)}</div>` : ''}
                        </div>
                        <div class="assigned-item-actions">
                            <button type="button" class="btn btn-icon btn-xs btn-secondary" title="Modifier" onclick="roadmapChantiersPageInstance.editProduit('${escapeJsString(produitName)}')">&#9998;</button>
                            <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="roadmapChantiersPageInstance.removeAssignedProduitAdd('${escapeJsString(produitName)}')">&#10005;</button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        const renderAssignedDataAnas = () => {
            const container = document.getElementById('assignedDataAnasAdd');
            if (!container) return;

            if (selectedDataAnas.length === 0) {
                container.innerHTML = '<div class="assigned-items-empty">Aucun DataAna assigné</div>';
                return;
            }

            container.innerHTML = selectedDataAnas.map(dataAnaKey => {
                const dataAna = this.dataAnas.find(d => d['Clé'] === dataAnaKey);
                const jiraUrl = `https://malakoffhumanis.atlassian.net/browse/${dataAnaKey}`;
                return `
                    <div class="assigned-item" data-dataana="${escapeHtml(dataAnaKey)}">
                        <div class="assigned-item-info">
                            <a href="${escapeHtml(jiraUrl)}" target="_blank" rel="noopener noreferrer" class="assigned-item-link">${escapeHtml(dataAnaKey)}</a>
                            ${dataAna && dataAna['Résumé'] ? `<div class="assigned-item-detail">${escapeHtml(dataAna['Résumé'])}</div>` : ''}
                        </div>
                        <div class="assigned-item-actions">
                            <button type="button" class="btn btn-icon btn-xs btn-secondary" title="Modifier" onclick="roadmapChantiersPageInstance.editDataAna('${escapeJsString(dataAnaKey)}')">&#9998;</button>
                            <button type="button" class="btn btn-icon btn-xs btn-danger" title="Enlever" onclick="roadmapChantiersPageInstance.removeAssignedDataAnaAdd('${escapeJsString(dataAnaKey)}')">&#10005;</button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        // Stocker les fonctions de mise à jour pour les appels externes
        this._addModalSelectedProduits = selectedProduits;
        this._addModalSelectedDataAnas = selectedDataAnas;
        this._addModalRenderProduits = renderAssignedProduits;
        this._addModalRenderDataAnas = renderAssignedDataAnas;

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
                        <button type="button" class="btn btn-sm btn-primary" onclick="roadmapChantiersPageInstance.showSelectProduitsModal('add')">
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
                        <button type="button" class="btn btn-sm btn-primary" onclick="roadmapChantiersPageInstance.showSelectDataAnasModal('add')">
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
                            'Processus': formData.get('Processus'),
                            'Archivé': form.querySelector('input[name="Archivé"]').checked ? true : false
                        };

                        try {
                            // Ajouter le chantier
                            console.log('Ajout chantier:', chantierData);
                            await addTableRow('tChantiers', chantierData);
                            invalidateCache('tChantiers');
                            console.log('Chantier ajouté avec succès');

                            // Ajouter les liens chantier-produit
                            for (const produit of this._addModalSelectedProduits) {
                                await addTableRow('tChantierProduit', {
                                    'Chantier': chantierData['Chantier'],
                                    'Produit': produit
                                });
                            }
                            invalidateCache('tChantierProduit');

                            // Ajouter les liens chantier-dataana
                            for (const dataAna of this._addModalSelectedDataAnas) {
                                await addTableRow('tChantierDataAna', {
                                    'Chantier': chantierData['Chantier'],
                                    'DataAna': dataAna
                                });
                            }
                            invalidateCache('tChantierDataAna');

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
    }

    // Méthodes pour gérer les produits/DataAnas dans la modal d'ajout
    removeAssignedProduitAdd(produitName) {
        const idx = this._addModalSelectedProduits.indexOf(produitName);
        if (idx > -1) {
            this._addModalSelectedProduits.splice(idx, 1);
            this._addModalRenderProduits();
        }
    }

    removeAssignedDataAnaAdd(dataAnaKey) {
        const idx = this._addModalSelectedDataAnas.indexOf(dataAnaKey);
        if (idx > -1) {
            this._addModalSelectedDataAnas.splice(idx, 1);
            this._addModalRenderDataAnas();
        }
    }

    async showEditChantierModal(chantierName) {
        // Utiliser le composant partagé ChantierModal
        await ChantierModal.showEditModal(chantierName, async () => {
            await this.refresh();
        });
    }

    // ===========================================
    // MODALES DE SÉLECTION (Produits / DataAnas)
    // ===========================================

    showSelectProduitsModal(mode) {
        const isAddMode = mode === 'add';
        const selectedProduits = isAddMode ? this._addModalSelectedProduits : this._editModalSelectedProduits;
        const renderCallback = isAddMode ? this._addModalRenderProduits : this._editModalRenderProduits;

        // Séparer les produits sélectionnés et non sélectionnés
        const selectedProduitsData = this.produits.filter(p => selectedProduits.includes(p['Nom']));
        const unselectedProduitsData = this.produits.filter(p => !selectedProduits.includes(p['Nom']));

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

            // Produits sélectionnés en premier
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

            // Produits non sélectionnés
            if (filteredUnselected.length > 0) {
                if (filteredSelected.length > 0) {
                    html += '<div class="selection-separator">Autres produits</div>';
                }
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
                html = '<div class="assigned-items-empty">Aucun produit trouvé</div>';
            }

            list.innerHTML = html;
        };

        const content = `
            <div class="selection-modal-content">
                <div class="selection-modal-search">
                    <input type="text" class="form-control" id="searchProduitsSelection" placeholder="Rechercher un produit...">
                </div>
                <div class="selection-modal-list" id="selectionProduitsList"></div>
            </div>
        `;

        showModal({
            title: 'Sélectionner des produits',
            content: content,
            size: 'lg',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Valider',
                    class: 'btn-primary',
                    action: (modal) => {
                        const list = document.getElementById('selectionProduitsList');
                        const checkedBoxes = list.querySelectorAll('input[type="checkbox"]:checked');
                        const newSelection = Array.from(checkedBoxes).map(cb => cb.value);

                        // Mettre à jour la sélection
                        selectedProduits.length = 0;
                        newSelection.forEach(p => selectedProduits.push(p));

                        // Mettre à jour l'affichage
                        renderCallback();
                        return true;
                    }
                }
            ]
        });

        // Initialiser la liste et le champ de recherche
        setTimeout(() => {
            renderList();
            const searchInput = document.getElementById('searchProduitsSelection');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
            }
        }, 100);
    }

    showSelectDataAnasModal(mode) {
        const isAddMode = mode === 'add';
        const selectedDataAnas = isAddMode ? this._addModalSelectedDataAnas : this._editModalSelectedDataAnas;
        const renderCallback = isAddMode ? this._addModalRenderDataAnas : this._editModalRenderDataAnas;

        // Séparer les DataAnas sélectionnés et non sélectionnés
        const selectedDataAnasData = this.dataAnas.filter(d => selectedDataAnas.includes(d['Clé']));
        const unselectedDataAnasData = this.dataAnas.filter(d => !selectedDataAnas.includes(d['Clé']));

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

            // DataAnas sélectionnés en premier
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

            // DataAnas non sélectionnés
            if (filteredUnselected.length > 0) {
                if (filteredSelected.length > 0) {
                    html += '<div class="selection-separator">Autres DataAnas</div>';
                }
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
                html = '<div class="assigned-items-empty">Aucun DataAna trouvé</div>';
            }

            list.innerHTML = html;
        };

        const content = `
            <div class="selection-modal-content">
                <div class="selection-modal-search">
                    <input type="text" class="form-control" id="searchDataAnasSelection" placeholder="Rechercher un DataAna (clé ou résumé)...">
                </div>
                <div class="selection-modal-list" id="selectionDataAnasList"></div>
            </div>
        `;

        showModal({
            title: 'Sélectionner des DataAnas',
            content: content,
            size: 'lg',
            buttons: [
                { label: 'Annuler', class: 'btn-secondary', action: 'close' },
                {
                    label: 'Valider',
                    class: 'btn-primary',
                    action: (modal) => {
                        const list = document.getElementById('selectionDataAnasList');
                        const checkedBoxes = list.querySelectorAll('input[type="checkbox"]:checked');
                        const newSelection = Array.from(checkedBoxes).map(cb => cb.value);

                        // Mettre à jour la sélection
                        selectedDataAnas.length = 0;
                        newSelection.forEach(d => selectedDataAnas.push(d));

                        // Mettre à jour l'affichage
                        renderCallback();
                        return true;
                    }
                }
            ]
        });

        // Initialiser la liste et le champ de recherche
        setTimeout(() => {
            renderList();
            const searchInput = document.getElementById('searchDataAnasSelection');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
            }
        }, 100);
    }

    // Fonctions pour éditer un produit ou un DataAna
    async editProduit(produitName) {
        const produit = this.produits.find(p => p['Nom'] === produitName);
        if (!produit) {
            showError('Produit non trouvé');
            return;
        }

        const rowIndex = produit._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            showError('Index de ligne non trouvé');
            return;
        }

        const tableConfig = CONFIG.TABLES.PRODUITS;
        showFormModal(
            `Modifier - ${produitName}`,
            tableConfig.columns,
            async (formData) => {
                try {
                    await updateTableRow(tableConfig.name, rowIndex, formData);
                    invalidateCache(tableConfig.name);
                    showSuccess('Produit modifié avec succès');
                    // Recharger les données pour mettre à jour l'affichage
                    const produitsData = await readTable(tableConfig.name);
                    this.produits = produitsData.data || [];
                    return true;
                } catch (error) {
                    showError('Erreur lors de la modification: ' + error.message);
                    return false;
                }
            },
            produit
        );
    }

    async editDataAna(dataAnaKey) {
        const dataAna = this.dataAnas.find(d => d['Clé'] === dataAnaKey);
        if (!dataAna) {
            showError('DataAna non trouvé');
            return;
        }

        const rowIndex = dataAna._rowIndex;
        if (rowIndex === undefined || rowIndex === null) {
            showError('Index de ligne non trouvé');
            return;
        }

        const tableConfig = CONFIG.TABLES.DATAANA;
        showFormModal(
            `Modifier - ${dataAnaKey}`,
            tableConfig.columns,
            async (formData) => {
                try {
                    await updateTableRow(tableConfig.name, rowIndex, formData);
                    invalidateCache(tableConfig.name);
                    showSuccess('DataAna modifié avec succès');
                    // Recharger les données pour mettre à jour l'affichage
                    const dataAnasData = await readTable(tableConfig.name);
                    this.dataAnas = dataAnasData.data || [];
                    return true;
                } catch (error) {
                    showError('Erreur lors de la modification: ' + error.message);
                    return false;
                }
            },
            dataAna
        );
    }

    async showArchiveConfirmation(chantierName) {
        showConfirmModal(
            'Archiver le chantier',
            `Êtes-vous sûr de vouloir archiver le chantier "${chantierName}" ?`,
            async () => {
                try {
                    const chantierIndex = this.chantiers.findIndex(c => c['Chantier'] === chantierName);
                    if (chantierIndex === -1) return;

                    const chantier = this.chantiers[chantierIndex];

                    // Utiliser _rowIndex stocké par readTable
                    const rowIndex = chantier._rowIndex;
                    if (rowIndex === undefined || rowIndex === null) {
                        console.error('Row index not found for chantier:', chantierName);
                        showError('Erreur: index de ligne non trouvé');
                        return;
                    }

                    // 1. Mise à jour optimiste IMMÉDIATE de l'interface
                    const updatedChantier = { ...chantier, 'Archivé': true };
                    this.chantiers.splice(chantierIndex, 1); // Retirer des actifs
                    this.chantiersArchives.push(updatedChantier); // Ajouter aux archivés

                    // Re-rendre immédiatement
                    this.renderFilters();
                    this.attachFilterEvents();
                    this.renderGantt();

                    showSuccess('Chantier archivé');

                    // 2. Synchroniser avec Excel en arrière-plan
                    updateTableRow('tChantiers', rowIndex, updatedChantier)
                        .then(() => invalidateCache('tChantiers'))
                        .catch(error => {
                            console.error('Erreur sync Excel:', error);
                            // En cas d'erreur, restaurer l'état et recharger
                            this.refresh();
                        });
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
                        <button class="btn btn-sm btn-success" onclick="roadmapChantiersPageInstance.unarchiveChantier('${escapeJsString(c['Chantier'])}')">
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
            const chantierIndex = this.chantiersArchives.findIndex(c => c['Chantier'] === chantierName);
            if (chantierIndex === -1) {
                console.error('Chantier not found in archives:', chantierName);
                showError('Erreur: chantier non trouvé');
                return;
            }

            const chantier = this.chantiersArchives[chantierIndex];

            // Utiliser _rowIndex stocké par readTable
            const rowIndex = chantier._rowIndex;
            if (rowIndex === undefined || rowIndex === null) {
                console.error('Row index not found for chantier:', chantierName);
                showError('Erreur: index de ligne non trouvé');
                return;
            }

            // 1. Mise à jour optimiste IMMÉDIATE
            const updatedChantier = { ...chantier, 'Archivé': false };
            this.chantiersArchives.splice(chantierIndex, 1); // Retirer des archivés
            this.chantiers.push(updatedChantier); // Ajouter aux actifs

            showSuccess('Chantier réaffiché');

            // Fermer proprement la modale
            closeModal();

            // Re-rendre immédiatement après fermeture de la modale
            const self = this;
            setTimeout(() => {
                self.renderFilters();
                self.attachFilterEvents();
                self.renderGantt();
            }, 350);

            // 2. Synchroniser avec Excel en arrière-plan
            updateTableRow('tChantiers', rowIndex, updatedChantier)
                .then(() => invalidateCache('tChantiers'))
                .catch(error => {
                    console.error('Erreur sync Excel:', error);
                    // En cas d'erreur, restaurer l'état et recharger
                    self.refresh();
                });
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
                        const formData = new FormData(form);

                        // Validation manuelle pour éviter les problèmes de timing avec la validation native
                        const phaseName = (formData.get('Phase') || '').trim();
                        const typePhase = formData.get('Type phase');
                        const sprintDebut = formData.get('Sprint début');
                        const sprintFin = formData.get('Sprint fin');

                        if (!phaseName) {
                            showError('Veuillez saisir le nom de la phase');
                            return false;
                        }
                        if (!sprintDebut || !sprintFin) {
                            showError('Veuillez sélectionner les sprints de début et de fin');
                            return false;
                        }

                        const phaseData = {
                            'Phase': phaseName,
                            'Type phase': typePhase || '',
                            'Description': formData.get('Description'),
                            'Chantier': chantierName,
                            'Sprint début': sprintDebut,
                            'Sprint fin': sprintFin,
                            'Lien Teams': formData.get('Lien Teams'),
                            'Couleur': CONFIG.PHASE_COLORS[typePhase] || ''
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
                        const formData = new FormData(form);

                        // Validation manuelle pour éviter les problèmes de timing avec la validation native
                        const phaseName = (formData.get('Phase') || '').trim();
                        const typePhase = formData.get('Type phase');
                        const sprintDebut = formData.get('Sprint début');
                        const sprintFin = formData.get('Sprint fin');

                        if (!phaseName) {
                            showError('Veuillez saisir le nom de la phase');
                            return false;
                        }
                        if (!sprintDebut || !sprintFin) {
                            showError('Veuillez sélectionner les sprints de début et de fin');
                            return false;
                        }

                        const updatedPhase = {
                            'Phase': phaseName,
                            'Type phase': typePhase || '',
                            'Description': formData.get('Description'),
                            'Chantier': phase['Chantier'],
                            'Sprint début': sprintDebut,
                            'Sprint fin': sprintFin,
                            'Lien Teams': formData.get('Lien Teams'),
                            'Couleur': CONFIG.PHASE_COLORS[typePhase] || ''
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
            <div class="context-menu-item" onclick="roadmapChantiersPageInstance.hideContextMenu(); roadmapChantiersPageInstance.showAddPhaseModalForChantier('${escapeJsString(chantierName)}')">
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

        // Utiliser la constante de classe pour la largeur des cellules sprint
        const cellWidth = RoadmapChantiersPage.SPRINT_COL_WIDTH;

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
        const PHASE_MARGIN = RoadmapChantiersPage.PHASE_MARGIN;

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

    /**
     * Rafraîchit le tableau en forçant le rechargement des données depuis Excel
     * Utilisé en cas de problème de chargement réseau
     */
    async refreshTable() {
        try {
            showInfo('Actualisation du tableau en cours...');

            // Invalider tous les caches pertinents pour forcer le rechargement
            invalidateCache('tChantiers');
            invalidateCache('tPhases');
            invalidateCache('tPhasesLien');
            invalidateCache('tChantierProduit');
            invalidateCache('tChantierDataAna');
            invalidateCache('tSprints');
            invalidateCache('tActeurs');
            invalidateCache('tPerimetres');
            invalidateCache('tProduits');
            invalidateCache('tDataAnas');

            await this.refresh();
            showSuccess('Tableau actualisé');
        } catch (error) {
            console.error('Erreur actualisation:', error);
            showError('Erreur lors de l\'actualisation. Réessayez.');
        }
    }

    async refresh() {
        // Invalider les caches (taskpane + dialog) pour forcer le rechargement depuis Excel
        await Promise.all([
            invalidateCache('tChantiers'),
            invalidateCache('tPhases'),
            invalidateCache('tPhasesLien'),
            invalidateCache('tChantierProduit'),
            invalidateCache('tChantierDataAna')
        ]);

        await this.loadData();
        this.renderFilters();
        this.attachFilterEvents();
        this.renderGantt();
        // attachCellEvents est appelé dans renderGantt, pas besoin de l'appeler ici
    }

    /**
     * Affiche la modale d'export PDF
     */
    showPdfExportModal() {
        const today = new Date().toISOString().split('T')[0];

        const content = `
            <form id="formPdfExport">
                <div class="form-group">
                    <label>Notes du :</label>
                    <input type="date" name="dateDebut" id="pdfDateDebut" value="${today}" required>
                </div>
                <div class="form-group">
                    <label>au :</label>
                    <input type="date" name="dateFin" id="pdfDateFin" value="${today}" required>
                </div>
                <p class="text-muted" style="font-size: 12px; margin-top: 10px;">
                    Le tableau des chantiers utilisera les filtres actuels de la page (période, périmètre, responsable, périmètre-processus).
                </p>
            </form>
        `;

        showModal({
            title: 'Export PDF',
            content,
            size: 'sm',
            buttons: [
                {
                    label: 'Annuler',
                    class: 'btn-secondary',
                    action: 'close'
                },
                {
                    label: 'Lancer',
                    class: 'btn-primary',
                    action: async () => {
                        const dateDebut = document.getElementById('pdfDateDebut').value;
                        const dateFin = document.getElementById('pdfDateFin').value;

                        if (!dateDebut || !dateFin) {
                            showError('Veuillez renseigner les deux dates');
                            return false;
                        }

                        if (new Date(dateDebut) > new Date(dateFin)) {
                            showError('La date de début doit être antérieure à la date de fin');
                            return false;
                        }

                        await this.generatePdf(dateDebut, dateFin);
                        return true;
                    }
                }
            ]
        });
    }

    /**
     * Génère le PDF avec le tableau des chantiers et les notes
     */
    async generatePdf(notesDateDebut, notesDateFin) {
        try {
            showInfo('Génération du PDF en cours...');

            // Charger les notes depuis Excel
            const notesData = await readTable('tChantierNote');
            const allNotes = notesData.data || [];

            // Récupérer les chantiers et sprints filtrés (selon les filtres de la page)
            const filteredChantiers = this.getFilteredChantiers();
            const visibleSprints = this.getVisibleSprints();

            if (filteredChantiers.length === 0) {
                showWarning('Aucun chantier à exporter avec les filtres actuels');
                return;
            }

            // Initialiser jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 10;

            // ============================================
            // PAGE 1: Tableau des chantiers et sprints
            // ============================================

            // Titre
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Roadmap Chantiers', pageWidth / 2, 15, { align: 'center' });

            // Sous-titre avec la période du tableau
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const periodStart = this.formatDateFull(this.filters.dateDebut);
            const periodEnd = this.formatDateFull(this.filters.dateFin);
            doc.text(`Période : ${periodStart} - ${periodEnd}`, pageWidth / 2, 22, { align: 'center' });

            // Construire les données du tableau
            const tableHeaders = ['Chantier', ...visibleSprints.map(s => s['Sprint'])];
            const tableData = filteredChantiers.map(chantier => {
                const chantierName = chantier['Chantier'] || '';
                const chantierPhases = this.phases.filter(p => p['Chantier'] === chantierName);

                // Pour chaque sprint, trouver les phases actives
                const sprintsCells = visibleSprints.map(sprint => {
                    const sprintName = sprint['Sprint'];
                    const activePhases = chantierPhases.filter(phase => {
                        const phaseStart = phase['Sprint début'];
                        const phaseEnd = phase['Sprint fin'] || phaseStart;
                        return this.isSprintInRange(sprintName, phaseStart, phaseEnd);
                    });

                    if (activePhases.length === 0) return '';

                    // Retourner les types de phases actives
                    return activePhases.map(p => p['Type phase'] || '').filter(Boolean).join(', ');
                });

                return [chantierName, ...sprintsCells];
            });

            // Générer le tableau avec autoTable
            doc.autoTable({
                head: [tableHeaders],
                body: tableData,
                startY: 28,
                margin: { left: margin, right: margin },
                styles: {
                    fontSize: 7,
                    cellPadding: 2,
                    overflow: 'linebreak',
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [0, 51, 102], // MH bleu foncé
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 40, fontStyle: 'bold' } // Colonne Chantier plus large
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245]
                },
                didParseCell: (data) => {
                    // Colorer les cellules selon le type de phase
                    if (data.section === 'body' && data.column.index > 0) {
                        const cellValue = data.cell.raw;
                        if (cellValue) {
                            if (cellValue.includes('EB')) {
                                data.cell.styles.fillColor = [156, 39, 176]; // Violet
                            } else if (cellValue.includes('Cadrage')) {
                                data.cell.styles.fillColor = [0, 188, 212]; // Cyan
                            } else if (cellValue.includes('Dev')) {
                                data.cell.styles.fillColor = [255, 235, 59]; // Jaune
                                data.cell.styles.textColor = [0, 0, 0];
                            } else if (cellValue.includes('Recette')) {
                                data.cell.styles.fillColor = [255, 87, 34]; // Orange
                            } else if (cellValue.includes('MEP')) {
                                data.cell.styles.fillColor = [76, 175, 80]; // Vert
                            }
                        }
                    }
                }
            });

            // ============================================
            // PAGES SUIVANTES: Notes par chantier
            // ============================================

            // Filtrer les notes dans la période spécifiée
            const notesStartDate = new Date(notesDateDebut);
            notesStartDate.setHours(0, 0, 0, 0);
            const notesEndDate = new Date(notesDateFin);
            notesEndDate.setHours(23, 59, 59, 999);

            // Regrouper les notes par chantier
            const notesByChantier = {};
            filteredChantiers.forEach(c => {
                const chantierName = c['Chantier'];
                const chantierNotes = allNotes
                    .filter(n => {
                        if (n['Chantier'] !== chantierName) return false;
                        const noteDate = this.parseDate(n['Date']);
                        return noteDate >= notesStartDate && noteDate <= notesEndDate;
                    })
                    .sort((a, b) => {
                        const dateA = this.parseDate(a['Date']);
                        const dateB = this.parseDate(b['Date']);
                        return dateB - dateA; // Ordre décroissant
                    });

                if (chantierNotes.length > 0) {
                    notesByChantier[chantierName] = chantierNotes;
                }
            });

            const chantiersWithNotes = Object.keys(notesByChantier);

            if (chantiersWithNotes.length > 0) {
                // Nouvelle page pour les notes
                doc.addPage();

                // Titre de la section notes
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('Notes des Chantiers', pageWidth / 2, 15, { align: 'center' });

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`Période : ${this.formatDateFull(notesStartDate)} - ${this.formatDateFull(notesEndDate)}`, pageWidth / 2, 22, { align: 'center' });

                let yPosition = 32;

                for (const chantierName of chantiersWithNotes) {
                    const notes = notesByChantier[chantierName];

                    // Vérifier s'il faut une nouvelle page
                    if (yPosition > pageHeight - 40) {
                        doc.addPage();
                        yPosition = 15;
                    }

                    // Nom du chantier
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 51, 102); // MH bleu foncé
                    doc.text(chantierName, margin, yPosition);
                    yPosition += 6;

                    // Notes du chantier
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(0, 0, 0);

                    for (const note of notes) {
                        // Vérifier s'il faut une nouvelle page
                        if (yPosition > pageHeight - 20) {
                            doc.addPage();
                            yPosition = 15;
                        }

                        const noteDate = this.formatDateFull(this.parseDate(note['Date']));
                        const noteContent = this.stripHtml(note['Note'] || '');

                        // Date de la note
                        doc.setFont('helvetica', 'bold');
                        doc.text(`${noteDate} :`, margin + 2, yPosition);

                        // Contenu de la note (avec retour à la ligne automatique)
                        doc.setFont('helvetica', 'normal');
                        const maxWidth = pageWidth - margin * 2 - 4;
                        const lines = doc.splitTextToSize(noteContent, maxWidth);

                        yPosition += 4;
                        for (const line of lines) {
                            if (yPosition > pageHeight - 10) {
                                doc.addPage();
                                yPosition = 15;
                            }
                            doc.text(line, margin + 4, yPosition);
                            yPosition += 4;
                        }

                        yPosition += 3; // Espace entre les notes
                    }

                    yPosition += 5; // Espace entre les chantiers
                }
            }

            // Sauvegarder le PDF
            const fileName = `Roadmap_Chantiers_${this.formatDateFile(new Date())}.pdf`;
            doc.save(fileName);

            showSuccess('PDF généré avec succès');

        } catch (error) {
            console.error('Erreur génération PDF:', error);
            showError('Erreur lors de la génération du PDF');
        }
    }

    /**
     * Vérifie si un sprint est dans la plage d'une phase
     */
    isSprintInRange(sprintName, phaseStart, phaseEnd) {
        const sprintIndex = this.sprints.findIndex(s => s['Sprint'] === sprintName);
        const startIndex = this.sprints.findIndex(s => s['Sprint'] === phaseStart);
        const endIndex = this.sprints.findIndex(s => s['Sprint'] === phaseEnd);

        if (sprintIndex === -1 || startIndex === -1) return false;
        const effectiveEndIndex = endIndex === -1 ? startIndex : endIndex;

        return sprintIndex >= startIndex && sprintIndex <= effectiveEndIndex;
    }

    /**
     * Formate une date complète pour l'affichage
     */
    formatDateFull(date) {
        const d = date instanceof Date ? date : this.parseDate(date);
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Formate une date pour le nom de fichier
     */
    formatDateFile(date) {
        const d = date instanceof Date ? date : new Date(date);
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Supprime les balises HTML d'une chaîne
     */
    stripHtml(html) {
        if (!html) return '';
        // Créer un élément temporaire pour parser le HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;
        // Remplacer les <br> et </p> par des retours à la ligne
        let text = temp.innerHTML
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<\/li>/gi, '\n');
        temp.innerHTML = text;
        return temp.textContent || temp.innerText || '';
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
