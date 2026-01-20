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
    static WEEK_COL_WIDTH = 45;
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
                chantierNotesData,
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
                readTable('tChantierNote'),
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
            this.chantierNotes = chantierNotesData.data || [];
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
     * Retourne le nombre de notes pour un chantier
     */
    getNoteCount(chantierName) {
        return this.chantierNotes.filter(n => n['Chantier'] === chantierName).length;
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
     * Vérifie si un sprint est le sprint actuel (date du jour entre début et fin)
     */
    isCurrentSprint(sprint) {
        if (!sprint || !sprint['Début'] || !sprint['Fin']) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sprintStart = this.parseDate(sprint['Début']);
        sprintStart.setHours(0, 0, 0, 0);
        const sprintEnd = this.parseDate(sprint['Fin']);
        sprintEnd.setHours(23, 59, 59, 999);
        return today >= sprintStart && today <= sprintEnd;
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

    // ==========================================
    // GESTION DES SEMAINES ISO 8601
    // ==========================================

    /**
     * Calcule le numéro de semaine ISO 8601 (règle française)
     * La semaine 1 est celle qui contient le premier jeudi de l'année
     * Les semaines commencent le lundi
     * @param {Date} date - La date à analyser
     * @returns {Object} { year: number, week: number }
     */
    getISOWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        // Jeudi de la semaine courante (ISO 8601: les semaines sont définies par leur jeudi)
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        // Premier jeudi de l'année
        const yearStart = new Date(d.getFullYear(), 0, 4);
        // Numéro de semaine = nombre de semaines depuis le premier jeudi
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return { year: d.getFullYear(), week: weekNo };
    }

    /**
     * Parse un code semaine au format AAAAS99
     * @param {string} weekCode - Code semaine (ex: "2026S02")
     * @returns {Object|null} { year: number, week: number } ou null si invalide
     */
    parseWeekCode(weekCode) {
        if (!weekCode || typeof weekCode !== 'string') return null;
        const match = weekCode.match(/^(\d{4})S(\d{2})$/);
        if (!match) return null;
        return { year: parseInt(match[1]), week: parseInt(match[2]) };
    }

    /**
     * Convertit un code semaine en date du lundi de cette semaine
     * @param {string} weekCode - Code semaine (ex: "2026S02")
     * @returns {Date|null} Date du lundi de la semaine ou null si invalide
     */
    weekCodeToDate(weekCode) {
        const parsed = this.parseWeekCode(weekCode);
        if (!parsed) return null;

        // Trouver le premier jeudi de l'année (qui définit la semaine 1)
        const jan4 = new Date(parsed.year, 0, 4);
        const dayOfWeek = jan4.getDay() || 7; // Convertir 0 (dimanche) en 7
        const firstThursday = new Date(jan4);
        firstThursday.setDate(jan4.getDate() - dayOfWeek + 4); // Jeudi de la semaine 1

        // Lundi de la semaine 1
        const firstMonday = new Date(firstThursday);
        firstMonday.setDate(firstThursday.getDate() - 3);

        // Ajouter le nombre de semaines
        const targetMonday = new Date(firstMonday);
        targetMonday.setDate(firstMonday.getDate() + (parsed.week - 1) * 7);

        return targetMonday;
    }

    /**
     * Formate une date en code semaine AAAAS99
     * @param {Date} date - La date
     * @returns {string} Code semaine (ex: "2026S02")
     */
    formatWeekCode(date) {
        const { year, week } = this.getISOWeekNumber(date);
        return `${year}S${String(week).padStart(2, '0')}`;
    }

    /**
     * Retourne la liste des semaines (codes) pour un sprint
     * @param {Object} sprint - Le sprint avec Début et Fin
     * @returns {Array<string>} Liste des codes semaines (ex: ["2026S02", "2026S03", "2026S04"])
     */
    getWeeksForSprint(sprint) {
        const weeks = [];
        const startDate = this.parseDate(sprint['Début']);
        const endDate = this.parseDate(sprint['Fin']);

        // Trouver le lundi de la première semaine du sprint
        let currentDate = new Date(startDate);
        const dayOfWeek = currentDate.getDay() || 7; // 1=lundi, 7=dimanche
        if (dayOfWeek !== 1) {
            // Revenir au lundi précédent ou celui de cette semaine
            currentDate.setDate(currentDate.getDate() - (dayOfWeek - 1));
        }

        while (currentDate <= endDate) {
            const weekCode = this.formatWeekCode(currentDate);
            if (!weeks.includes(weekCode)) {
                weeks.push(weekCode);
            }
            // Passer à la semaine suivante
            currentDate.setDate(currentDate.getDate() + 7);
        }

        return weeks;
    }

    /**
     * Construit la liste aplatie de toutes les semaines des sprints visibles
     * @param {Array} visibleSprints - Les sprints visibles
     * @returns {Array<Object>} Liste des semaines avec info sprint { weekCode, sprintName, isFirstOfSprint }
     */
    buildWeeksList(visibleSprints) {
        const allWeeks = [];
        visibleSprints.forEach(sprint => {
            const weeks = this.getWeeksForSprint(sprint);
            weeks.forEach((weekCode, idx) => {
                allWeeks.push({
                    weekCode,
                    sprintName: sprint['Sprint'],
                    sprint: sprint,
                    isFirstOfSprint: idx === 0
                });
            });
        });
        return allWeeks;
    }

    /**
     * Vérifie si une semaine est la semaine courante
     * @param {string} weekCode - Code semaine
     * @returns {boolean}
     */
    isCurrentWeek(weekCode) {
        const todayCode = this.formatWeekCode(new Date());
        return weekCode === todayCode;
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

        // Largeur fixe pour chaque colonne semaine (en pixels)
        const WEEK_COL_WIDTH = RoadmapChantiersPage.WEEK_COL_WIDTH;

        // Construire la liste des semaines pour tous les sprints visibles
        const allWeeks = this.buildWeeksList(visibleSprints);
        const totalWeekColumns = allWeeks.length;

        // Stocker les semaines pour référence ultérieure
        this._allWeeks = allWeeks;

        // Construire les lignes de chantiers
        const rowsHtml = filteredChantiers.map((chantier, chantierIndex) => {
            const chantierName = chantier['Chantier'];
            const chantierPhases = this.getPhasesForChantier(chantierName);

            // Calculer les phases par position (semaine)
            const phasesByWeekRange = this.calculatePhasePositions(chantierPhases, visibleSprints, allWeeks);

            const noteCount = this.getNoteCount(chantierName);
            return `
                <tr class="gantt-chantier-row" data-chantier="${escapeHtml(chantierName)}">
                    <td class="gantt-chantier-cell">
                        <div class="chantier-info">
                            <span class="chantier-name" title="${escapeHtml(chantierName)}">${escapeHtml(chantierName)}</span>
                            <div class="chantier-actions">
                                ${noteCount > 0 ? `<span class="notes-badge" title="${noteCount} note${noteCount > 1 ? 's' : ''}">${noteCount}</span>` : ''}
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
                    ${this.renderChantierCells(chantierName, chantierPhases, visibleSprints, phasesByWeekRange, allWeeks)}
                </tr>
            `;
        }).join('');

        // Générer les colgroup avec largeurs fixes (une colonne par semaine)
        const colgroupHtml = `
            <colgroup>
                <col class="gantt-col-chantier" style="width: 200px; min-width: 200px;">
                ${allWeeks.map(w => `<col class="gantt-col-week" style="width: ${WEEK_COL_WIDTH}px; min-width: ${WEEK_COL_WIDTH}px;">`).join('')}
            </colgroup>
        `;

        // Générer le HTML des sprints (première ligne header avec colspan)
        const sprintsHeaderHtml = visibleSprints.map(sprint => {
            const isCurrentSprintClass = this.isCurrentSprint(sprint) ? ' current-sprint' : '';
            const weeksInSprint = this.getWeeksForSprint(sprint);
            const colspan = weeksInSprint.length;
            return `
            <th class="gantt-sprint-header-cell${isCurrentSprintClass}" colspan="${colspan}" data-sprint="${escapeHtml(sprint['Sprint'])}">
                <div class="sprint-name">${escapeHtml(sprint['Sprint'])}</div>
            </th>
        `;
        }).join('');

        // Générer le HTML des semaines (deuxième ligne header - numéro de semaine)
        const weeksHeaderHtml = allWeeks.map((weekInfo, idx) => {
            const isCurrentWeekClass = this.isCurrentWeek(weekInfo.weekCode) ? ' current-week' : '';
            const isFirstWeekClass = weekInfo.isFirstOfSprint ? ' first-week' : '';
            // Afficher seulement S99 (sans l'année)
            const weekLabel = 'S' + weekInfo.weekCode.slice(-2);
            return `
            <th class="gantt-week-header-cell${isCurrentWeekClass}${isFirstWeekClass}"
                data-week="${escapeHtml(weekInfo.weekCode)}"
                data-sprint="${escapeHtml(weekInfo.sprintName)}"
                data-week-idx="${idx}">
                ${weekLabel}
            </th>
        `;
        }).join('');

        // Générer le HTML des dates (troisième ligne header - date du lundi)
        const datesHeaderHtml = allWeeks.map((weekInfo, idx) => {
            const isCurrentWeekClass = this.isCurrentWeek(weekInfo.weekCode) ? ' current-week' : '';
            const isFirstWeekClass = weekInfo.isFirstOfSprint ? ' first-week' : '';
            // Obtenir la date du lundi de cette semaine
            const mondayDate = this.weekCodeToDate(weekInfo.weekCode);
            const dateLabel = mondayDate ? this.formatDate(mondayDate) : '';
            return `
            <th class="gantt-week-header-cell gantt-date-header-cell${isCurrentWeekClass}${isFirstWeekClass}"
                data-week="${escapeHtml(weekInfo.weekCode)}"
                data-week-idx="${idx}">
                ${dateLabel}
            </th>
        `;
        }).join('');

        container.innerHTML = `
            <div class="gantt-body-wrapper">
                <table class="gantt-chantiers-table gantt-fixed-columns">
                    ${colgroupHtml}
                    <thead>
                        <tr class="gantt-header-row gantt-sprint-row">
                            <th class="gantt-chantier-header" rowspan="3">Chantiers</th>
                            ${sprintsHeaderHtml}
                        </tr>
                        <tr class="gantt-header-row gantt-week-row">
                            ${weeksHeaderHtml}
                        </tr>
                        <tr class="gantt-header-row gantt-date-row">
                            ${datesHeaderHtml}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml.length > 0 ? rowsHtml : `
                            <tr>
                                <td colspan="${totalWeekColumns + 1}" class="empty-row">
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
     * Maintenant basé sur les semaines (chaque colonne = une semaine)
     * @param {Array} phases - Les phases du chantier
     * @param {Array} visibleSprints - Les sprints visibles
     * @param {Array} allWeeks - La liste complète des semaines (de buildWeeksList)
     * @returns {Object} Mapping weekCode -> liste de phases dans cette semaine
     */
    calculatePhasePositions(phases, visibleSprints, allWeeks) {
        const result = {};
        const weekCodes = allWeeks.map(w => w.weekCode);

        phases.forEach(phase => {
            const mode = phase['Mode'] || 'Sprint';
            let startWeekIdx, endWeekIdx;

            if (mode === 'Semaine') {
                // Mode Semaine: utiliser directement les codes semaines
                const startWeek = phase['Semaine début'];
                const endWeek = phase['Semaine fin'] || startWeek;

                if (!startWeek) return; // Pas de semaine définie

                startWeekIdx = weekCodes.indexOf(startWeek);
                endWeekIdx = weekCodes.indexOf(endWeek);

                // Phase hors de la période visible
                if (startWeekIdx === -1 && endWeekIdx === -1) {
                    // Vérifier si la phase chevauche quand même
                    const startParsed = this.parseWeekCode(startWeek);
                    const endParsed = this.parseWeekCode(endWeek);
                    const firstVisible = this.parseWeekCode(weekCodes[0]);
                    const lastVisible = this.parseWeekCode(weekCodes[weekCodes.length - 1]);

                    if (!startParsed || !endParsed || !firstVisible || !lastVisible) return;

                    // Comparer les semaines
                    const startNum = startParsed.year * 100 + startParsed.week;
                    const endNum = endParsed.year * 100 + endParsed.week;
                    const firstVisNum = firstVisible.year * 100 + firstVisible.week;
                    const lastVisNum = lastVisible.year * 100 + lastVisible.week;

                    if (endNum < firstVisNum || startNum > lastVisNum) {
                        return; // Pas de chevauchement
                    }

                    // Ajuster les indices
                    startWeekIdx = startNum < firstVisNum ? 0 : weekCodes.indexOf(startWeek);
                    endWeekIdx = endNum > lastVisNum ? weekCodes.length - 1 : weekCodes.indexOf(endWeek);
                } else {
                    // Ajuster si une extrémité est hors limites
                    if (startWeekIdx === -1) startWeekIdx = 0;
                    if (endWeekIdx === -1) endWeekIdx = weekCodes.length - 1;
                }
            } else {
                // Mode Sprint (défaut): trouver les semaines correspondant aux sprints
                const startSprint = phase['Sprint début'];
                const endSprint = phase['Sprint fin'] || startSprint;

                if (!startSprint) return; // Pas de sprint défini

                // Trouver les indices globaux des sprints
                const allSprintNames = this.sprints.map(s => s['Sprint']);
                const startSprintGlobalIdx = allSprintNames.indexOf(startSprint);
                const endSprintGlobalIdx = allSprintNames.indexOf(endSprint);

                if (startSprintGlobalIdx === -1) return;

                // Trouver les semaines du sprint de début et de fin
                const startSprintObj = this.sprints[startSprintGlobalIdx];
                const endSprintObj = this.sprints[endSprintGlobalIdx !== -1 ? endSprintGlobalIdx : startSprintGlobalIdx];

                const startSprintWeeks = this.getWeeksForSprint(startSprintObj);
                const endSprintWeeks = this.getWeeksForSprint(endSprintObj);

                const phaseStartWeek = startSprintWeeks[0];
                const phaseEndWeek = endSprintWeeks[endSprintWeeks.length - 1];

                startWeekIdx = weekCodes.indexOf(phaseStartWeek);
                endWeekIdx = weekCodes.indexOf(phaseEndWeek);

                // Ajuster si hors limites (phase commence avant ou finit après la période visible)
                if (startWeekIdx === -1 && endWeekIdx === -1) {
                    // Vérifier chevauchement
                    const startParsed = this.parseWeekCode(phaseStartWeek);
                    const endParsed = this.parseWeekCode(phaseEndWeek);
                    const firstVisible = this.parseWeekCode(weekCodes[0]);
                    const lastVisible = this.parseWeekCode(weekCodes[weekCodes.length - 1]);

                    if (!startParsed || !endParsed || !firstVisible || !lastVisible) return;

                    const startNum = startParsed.year * 100 + startParsed.week;
                    const endNum = endParsed.year * 100 + endParsed.week;
                    const firstVisNum = firstVisible.year * 100 + firstVisible.week;
                    const lastVisNum = lastVisible.year * 100 + lastVisible.week;

                    if (endNum < firstVisNum || startNum > lastVisNum) {
                        return; // Pas de chevauchement
                    }

                    startWeekIdx = 0;
                    endWeekIdx = weekCodes.length - 1;
                } else {
                    if (startWeekIdx === -1) startWeekIdx = 0;
                    if (endWeekIdx === -1) endWeekIdx = weekCodes.length - 1;
                }
            }

            // Ajouter la phase à toutes les semaines qu'elle couvre
            const actualEndIdx = endWeekIdx === -1 ? startWeekIdx : endWeekIdx;

            for (let i = startWeekIdx; i <= actualEndIdx; i++) {
                const weekCode = weekCodes[i];
                if (!result[weekCode]) {
                    result[weekCode] = [];
                }
                result[weekCode].push({
                    phase: phase,
                    isStart: i === startWeekIdx,
                    isEnd: i === actualEndIdx,
                    colspan: actualEndIdx - startWeekIdx + 1,
                    startIdx: startWeekIdx
                });
            }
        });

        return result;
    }

    /**
     * Calcule les lanes (voies) pour les phases qui se chevauchent
     * Maintenant basé sur les semaines
     * @param {Array} phases - Les phases du chantier
     * @param {Array} allWeeks - La liste complète des semaines
     * @returns {Object} { phaseLanes: Map, totalLanes: number }
     */
    calculatePhaseLanes(phases, allWeeks) {
        const weekCodes = allWeeks.map(w => w.weekCode);
        const phaseLanes = new Map(); // phase name -> lane number
        const lanes = []; // lanes[i] = end index of last phase in lane i

        if (weekCodes.length === 0) {
            return { phaseLanes, totalLanes: 1 };
        }

        const firstVisibleWeek = weekCodes[0];
        const lastVisibleWeek = weekCodes[weekCodes.length - 1];

        // Calculer les indices de début/fin en semaines pour chaque phase
        // UNIQUEMENT pour les phases visibles dans la période courante
        const sortedPhases = [...phases].map(phase => {
            const mode = phase['Mode'] || 'Sprint';
            let phaseStartWeek, phaseEndWeek;

            if (mode === 'Semaine') {
                phaseStartWeek = phase['Semaine début'];
                phaseEndWeek = phase['Semaine fin'] || phaseStartWeek;
                if (!phaseStartWeek) return { phase, startIdx: Infinity, endIdx: 0 };
            } else {
                const startSprint = phase['Sprint début'];
                const endSprint = phase['Sprint fin'] || startSprint;
                if (!startSprint) return { phase, startIdx: Infinity, endIdx: 0 };

                const allSprintNames = this.sprints.map(s => s['Sprint']);
                const startSprintIdx = allSprintNames.indexOf(startSprint);
                const endSprintIdx = allSprintNames.indexOf(endSprint);

                if (startSprintIdx === -1) return { phase, startIdx: Infinity, endIdx: 0 };

                const startSprintObj = this.sprints[startSprintIdx];
                const endSprintObj = this.sprints[endSprintIdx !== -1 ? endSprintIdx : startSprintIdx];

                const startSprintWeeks = this.getWeeksForSprint(startSprintObj);
                const endSprintWeeks = this.getWeeksForSprint(endSprintObj);

                phaseStartWeek = startSprintWeeks[0];
                phaseEndWeek = endSprintWeeks[endSprintWeeks.length - 1];
            }

            // Vérifier si la phase a une visibilité dans la période courante
            // Phase invisible si elle finit avant le début OU commence après la fin
            if (phaseEndWeek < firstVisibleWeek || phaseStartWeek > lastVisibleWeek) {
                return { phase, startIdx: Infinity, endIdx: 0 }; // Exclure
            }

            // Calculer les indices avec clamping approprié
            let startIdx = weekCodes.indexOf(phaseStartWeek);
            let endIdx = weekCodes.indexOf(phaseEndWeek);

            // Si la phase commence avant la période visible, clamper à 0
            if (startIdx === -1 && phaseStartWeek < firstVisibleWeek) {
                startIdx = 0;
            }
            // Si la phase finit après la période visible, clamper à la fin
            if (endIdx === -1 && phaseEndWeek > lastVisibleWeek) {
                endIdx = weekCodes.length - 1;
            }

            return {
                phase,
                startIdx: startIdx,
                endIdx: endIdx
            };
        }).filter(p => p.startIdx !== Infinity && p.startIdx >= 0 && p.endIdx >= 0)
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
     * Nouvelle approche : une cellule par SEMAINE, phases positionnées en CSS avec lanes
     * @param {string} chantierName - Nom du chantier
     * @param {Array} chantierPhases - Phases du chantier
     * @param {Array} visibleSprints - Sprints visibles
     * @param {Object} phasesByWeekRange - Mapping weekCode -> phases
     * @param {Array} allWeeks - Liste de toutes les semaines
     */
    renderChantierCells(chantierName, chantierPhases, visibleSprints, phasesByWeekRange, allWeeks) {
        const cellsHtml = [];
        const renderedPhases = new Set();
        const weekCodes = allWeeks.map(w => w.weekCode);

        // Calculer les lanes pour ce chantier (basé sur les semaines)
        const { phaseLanes, totalLanes } = this.calculatePhaseLanes(chantierPhases, allWeeks);

        allWeeks.forEach((weekInfo, weekIdx) => {
            const weekCode = weekInfo.weekCode;
            const sprintName = weekInfo.sprintName;
            const isFirstWeek = weekInfo.isFirstOfSprint;
            const phasesInCell = phasesByWeekRange[weekCode] || [];

            // Filtrer les phases qui COMMENCENT à cette semaine et pas déjà rendues
            const phasesToRender = phasesInCell.filter(p =>
                p.isStart && !renderedPhases.has(p.phase['Phase'])
            );

            // Marquer les phases comme rendues
            phasesToRender.forEach(p => renderedPhases.add(p.phase['Phase']));

            // Calculer le colspan effectif de chaque phase et ajouter les infos de lane
            const phasesWithColspan = phasesToRender.map(p => {
                const endIdx = Math.min(p.startIdx + p.colspan - 1, weekCodes.length - 1);
                const effectiveColspan = endIdx - weekIdx + 1;
                const lane = phaseLanes.get(p.phase['Phase']) || 0;
                return { ...p, effectiveColspan, lane };
            });

            // Générer le HTML des phases qui commencent ici
            const phasesHtml = phasesWithColspan.map((p) =>
                this.renderPhaseBlock(p.phase, totalLanes, p.lane, p.effectiveColspan, weekIdx)
            ).join('');

            // Toujours créer une cellule pour chaque semaine
            const hasPhases = phasesWithColspan.length > 0;
            const cellClass = hasPhases ? 'gantt-phase-cell' : 'gantt-empty-cell';
            const firstWeekClass = isFirstWeek ? ' first-week' : '';

            cellsHtml.push(`
                <td class="gantt-data-cell gantt-week-cell${firstWeekClass} ${cellClass}"
                    data-chantier="${escapeHtml(chantierName)}"
                    data-sprint="${escapeHtml(sprintName)}"
                    data-week="${escapeHtml(weekCode)}"
                    data-week-idx="${weekIdx}"
                    data-total-lanes="${totalLanes}">
                    ${hasPhases
                        ? `<div class="gantt-phases-container" data-total-lanes="${totalLanes}">${phasesHtml}</div>`
                        : `<div class="empty-cell-clickzone" onclick="roadmapChantiersPageInstance.showAddPhaseModal('${escapeJsString(chantierName)}', '${escapeJsString(sprintName)}', '${escapeJsString(weekCode)}')"></div>`}
                </td>
            `);
        });

        return cellsHtml.join('');
    }

    /**
     * Rendu d'un bloc de phase
     * La largeur sera calculée dynamiquement après le rendu via updatePhaseWidths()
     * La hauteur et position verticale dépendent du nombre de lanes
     * Le z-index est basé sur startSprintIdx pour que les phases qui commencent plus tard
     * soient au-dessus (important pour les interactions sur les zones de chevauchement)
     */
    renderPhaseBlock(phase, totalLanes, lane, phaseColspan = 1, startSprintIdx = 0) {
        const typePhase = phase['Type phase'] || '';
        const color = CONFIG.PHASE_COLORS[typePhase] || '#E0E0E0';
        const phaseName = phase['Phase'] || '';
        const description = phase['Description'] || '';
        const phaseIndex = this.phases.findIndex(p => p['Phase'] === phaseName && p['Chantier'] === phase['Chantier']);

        // Marge à gauche de la phase (pour ne pas coller aux bords)
        const PHASE_MARGIN = RoadmapChantiersPage.PHASE_MARGIN;

        // Calculer la hauteur et la position verticale en fonction des lanes
        const heightPercent = 100 / totalLanes;
        const topPercent = (lane / totalLanes) * 100;
        const hasMultipleLanes = totalLanes > 1;

        // Z-index basé sur le sprint de départ: les phases qui commencent plus tard sont au-dessus
        // Cela permet d'interagir avec les phases même quand d'autres phases les chevauchent visuellement
        const zIndex = 10 + startSprintIdx;

        // Tooltip: afficher la description si disponible, sinon le nom de la phase
        const tooltip = description ? `${phaseName}\n\n${description}` : phaseName;

        // Note: width sera calculée dynamiquement par updatePhaseWidths() après le rendu
        return `
            <div class="gantt-phase-block ${hasMultipleLanes ? 'lane-mode' : 'fullwidth'}"
                 style="background-color: ${color}; margin-left: ${PHASE_MARGIN}px; z-index: ${zIndex}; ${hasMultipleLanes ? `height: calc(${heightPercent}% - 2px); top: ${topPercent}%;` : ''}"
                 title="${escapeHtml(tooltip)}"
                 data-phase-index="${phaseIndex}"
                 data-phase-name="${escapeHtml(phaseName)}"
                 data-chantier="${escapeHtml(phase['Chantier'])}"
                 data-colspan="${phaseColspan}"
                 data-lane="${lane}"
                 data-start-sprint-idx="${startSprintIdx}">
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
        const colspan = parseInt(block.dataset.colspan) || 1;

        // Créer l'élément de prévisualisation en pointillés bleus
        const preview = document.createElement('div');
        preview.className = 'gantt-drag-preview';
        preview.style.display = 'none'; // Masqué jusqu'à ce qu'on survole une cellule valide
        document.body.appendChild(preview);

        this.draggedPhase = {
            index: phaseIndex,
            phase: phase,
            chantier: phase['Chantier'],
            block: block,
            colspan: colspan,
            preview: preview
        };

        block.classList.add('dragging');
    }

    /**
     * Trouve la cellule de données à une position donnée (méthode robuste basée sur les coordonnées)
     */
    findCellAtPosition(x, y) {
        const cells = document.querySelectorAll('.gantt-chantiers-table .gantt-data-cell');
        for (const cell of cells) {
            const rect = cell.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return cell;
            }
        }
        return null;
    }

    /**
     * Gère le mouvement pendant le drag personnalisé
     */
    handleCustomDragMove(e) {
        if (!this.draggedPhase) return;

        const { preview, colspan, chantier: sourceChantier } = this.draggedPhase;

        // Trouver la cellule sous le curseur (méthode basée sur les coordonnées, plus robuste)
        const cell = this.findCellAtPosition(e.clientX, e.clientY);

        // Nettoyer les anciennes classes
        document.querySelectorAll('.gantt-data-cell').forEach(c => {
            c.classList.remove('drag-over', 'drag-invalid');
        });

        if (cell) {
            const targetChantier = cell.dataset.chantier;
            if (targetChantier === sourceChantier) {
                cell.classList.add('drag-over');

                // Afficher et positionner le preview
                if (preview) {
                    preview.style.display = 'block';

                    // Trouver la ligne et les cellules pour calculer la position
                    const row = cell.closest('tr');
                    if (row) {
                        const dataCells = Array.from(row.querySelectorAll('.gantt-data-cell'));
                        const cellIndex = dataCells.indexOf(cell);
                        const endCellIndex = Math.min(cellIndex + colspan - 1, dataCells.length - 1);

                        // Obtenir les positions pour calculer la largeur du preview
                        const startCellRect = cell.getBoundingClientRect();
                        const endCell = dataCells[endCellIndex];
                        const endCellRect = endCell ? endCell.getBoundingClientRect() : startCellRect;

                        // Calculer la position et la taille du preview
                        const PHASE_MARGIN = RoadmapChantiersPage.PHASE_MARGIN;
                        const previewWidth = (endCellRect.right - startCellRect.left) - (PHASE_MARGIN * 2);
                        const previewHeight = startCellRect.height - 8; // Marge verticale

                        preview.style.position = 'fixed';
                        preview.style.left = (startCellRect.left + PHASE_MARGIN) + 'px';
                        preview.style.top = (startCellRect.top + 4) + 'px';
                        preview.style.width = previewWidth + 'px';
                        preview.style.height = previewHeight + 'px';
                    }
                }
            } else {
                cell.classList.add('drag-invalid');
                // Masquer le preview si on survole une cellule invalide
                if (preview) {
                    preview.style.display = 'none';
                }
            }
        } else {
            // Masquer le preview si on ne survole pas de cellule
            if (preview) {
                preview.style.display = 'none';
            }
        }
    }

    /**
     * Termine le drag personnalisé
     */
    handleCustomDragEnd(e) {
        if (!this.draggedPhase) return;

        const { preview } = this.draggedPhase;

        // Supprimer le preview
        if (preview && preview.parentNode) {
            preview.parentNode.removeChild(preview);
        }

        // Trouver la cellule sous le curseur (méthode basée sur les coordonnées)
        const cell = this.findCellAtPosition(e.clientX, e.clientY);

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

    async showAddPhaseModal(chantierName, sprintName, weekCode = '') {
        // Générer le code semaine par défaut si non fourni
        const defaultWeekCode = weekCode || this.formatWeekCode(new Date());

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
                <div class="form-group">
                    <label class="form-label">Mode</label>
                    <select class="form-control" name="Mode" id="addPhaseMode" onchange="roadmapChantiersPageInstance.toggleAddPhaseModeFields()">
                        <option value="Sprint" selected>Sprint</option>
                        <option value="Semaine">Semaine</option>
                    </select>
                </div>
                <div class="form-row" id="addPhaseSprintFields">
                    <div class="form-group">
                        <label class="form-label required">Sprint début</label>
                        <select class="form-control" name="Sprint début">
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === sprintName ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Sprint fin</label>
                        <select class="form-control" name="Sprint fin">
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === sprintName ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row" id="addPhaseWeekFields" style="display: none;">
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
                    action: async () => {
                        const form = document.getElementById('formAddPhase');
                        const formData = new FormData(form);

                        // Validation manuelle
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
                            // Valider le format
                            if (!/^\d{4}S\d{2}$/.test(semaineDebut) || !/^\d{4}S\d{2}$/.test(semaineFin)) {
                                showError('Format de semaine invalide. Utilisez AAAAS99 (ex: 2026S02)');
                                return false;
                            }
                            phaseData['Semaine début'] = semaineDebut;
                            phaseData['Semaine fin'] = semaineFin;
                        }

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
     * Bascule l'affichage des champs Sprint/Semaine dans la modale d'ajout
     */
    toggleAddPhaseModeFields() {
        const mode = document.getElementById('addPhaseMode')?.value || 'Sprint';
        const sprintFields = document.getElementById('addPhaseSprintFields');
        const weekFields = document.getElementById('addPhaseWeekFields');

        if (mode === 'Semaine') {
            if (sprintFields) sprintFields.style.display = 'none';
            if (weekFields) weekFields.style.display = 'flex';
        } else {
            if (sprintFields) sprintFields.style.display = 'flex';
            if (weekFields) weekFields.style.display = 'none';
        }
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

        // Déterminer le mode actuel
        const currentMode = phase['Mode'] || 'Sprint';
        const isWeekMode = currentMode === 'Semaine';

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
                <div class="form-group">
                    <label class="form-label">Mode</label>
                    <select class="form-control" name="Mode" id="editPhaseMode" onchange="roadmapChantiersPageInstance.toggleEditPhaseModeFields()">
                        <option value="Sprint" ${!isWeekMode ? 'selected' : ''}>Sprint</option>
                        <option value="Semaine" ${isWeekMode ? 'selected' : ''}>Semaine</option>
                    </select>
                </div>
                <div class="form-row" id="editPhaseSprintFields" style="${isWeekMode ? 'display: none;' : ''}">
                    <div class="form-group">
                        <label class="form-label required">Sprint début</label>
                        <select class="form-control" name="Sprint début">
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === phase['Sprint début'] ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label required">Sprint fin</label>
                        <select class="form-control" name="Sprint fin">
                            ${this.sprints.map(s => `
                                <option value="${escapeHtml(s['Sprint'])}" ${s['Sprint'] === phase['Sprint fin'] ? 'selected' : ''}>
                                    ${escapeHtml(s['Sprint'])}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row" id="editPhaseWeekFields" style="${!isWeekMode ? 'display: none;' : ''}">
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
                    action: async () => {
                        const form = document.getElementById('formEditPhase');
                        const formData = new FormData(form);

                        // Validation manuelle
                        const phaseName = (formData.get('Phase') || '').trim();
                        const typePhase = formData.get('Type phase');
                        const mode = formData.get('Mode') || 'Sprint';

                        if (!phaseName) {
                            showError('Veuillez saisir le nom de la phase');
                            return false;
                        }

                        const updatedPhase = {
                            'Phase': phaseName,
                            'Type phase': typePhase || '',
                            'Description': formData.get('Description'),
                            'Chantier': phase['Chantier'],
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
                            updatedPhase['Sprint début'] = sprintDebut;
                            updatedPhase['Sprint fin'] = sprintFin;
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
                            updatedPhase['Semaine début'] = semaineDebut;
                            updatedPhase['Semaine fin'] = semaineFin;
                        }

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

    /**
     * Bascule l'affichage des champs Sprint/Semaine dans la modale d'édition
     */
    toggleEditPhaseModeFields() {
        const mode = document.getElementById('editPhaseMode')?.value || 'Sprint';
        const sprintFields = document.getElementById('editPhaseSprintFields');
        const weekFields = document.getElementById('editPhaseWeekFields');

        if (mode === 'Semaine') {
            if (sprintFields) sprintFields.style.display = 'none';
            if (weekFields) weekFields.style.display = 'flex';
        } else {
            if (sprintFields) sprintFields.style.display = 'flex';
            if (weekFields) weekFields.style.display = 'none';
        }
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
        const targetWeek = cell.dataset.week;

        // Ne permettre le drop que sur le même chantier
        if (targetChantier !== this.draggedPhase.chantier) {
            showWarning('Déplacement possible uniquement sur la même ligne');
            return;
        }

        // Copier les données avant le traitement async
        const phaseData = { ...this.draggedPhase.phase };
        const rowIndex = this.draggedPhase.phase._rowIndex;
        const mode = phaseData['Mode'] || 'Sprint';

        if (rowIndex === undefined || rowIndex === null) {
            console.error('Row index not found for phase');
            showError('Erreur: index de ligne non trouvé');
            return;
        }

        try {
            if (mode === 'Semaine') {
                // Mode Semaine: calculer en semaines
                const weekCodes = this._allWeeks ? this._allWeeks.map(w => w.weekCode) : [];
                const oldStartWeek = phaseData['Semaine début'];
                const oldEndWeek = phaseData['Semaine fin'] || oldStartWeek;

                const oldStartIdx = weekCodes.indexOf(oldStartWeek);
                const oldEndIdx = weekCodes.indexOf(oldEndWeek);
                const duration = oldStartIdx >= 0 && oldEndIdx >= 0 ? Math.max(0, oldEndIdx - oldStartIdx) : 0;

                const newStartIdx = weekCodes.indexOf(targetWeek);
                if (newStartIdx === -1) {
                    showWarning('Semaine cible non trouvée');
                    return;
                }

                const newEndIdx = newStartIdx + duration;
                if (newEndIdx >= weekCodes.length) {
                    showWarning('La phase dépasse la période visible');
                    return;
                }

                phaseData['Semaine début'] = weekCodes[newStartIdx];
                phaseData['Semaine fin'] = weekCodes[newEndIdx];
            } else {
                // Mode Sprint: calculer en sprints
                const oldStartIdx = this.getSprintIndex(phaseData['Sprint début']);
                const oldEndIdx = this.getSprintIndex(phaseData['Sprint fin'] || phaseData['Sprint début']);
                const duration = Math.max(0, oldEndIdx - oldStartIdx);

                const newStartIdx = this.getSprintIndex(targetSprint);
                const newEndIdx = newStartIdx + duration;

                if (newEndIdx >= this.sprints.length) {
                    showWarning('La phase dépasse la période visible');
                    return;
                }

                phaseData['Sprint début'] = this.sprints[newStartIdx]['Sprint'];
                phaseData['Sprint fin'] = this.sprints[newEndIdx]['Sprint'];
            }

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

        // Utiliser la largeur des cellules semaine
        const cellWidth = RoadmapChantiersPage.WEEK_COL_WIDTH;

        // Obtenir le mode de la phase
        const mode = phase['Mode'] || 'Sprint';

        // Calculer les indices de semaines pour cette phase
        const allWeeks = this._allWeeks || [];
        const weekCodes = allWeeks.map(w => w.weekCode);

        let startIdx, endIdx;

        if (mode === 'Semaine') {
            const startWeek = phase['Semaine début'];
            const endWeek = phase['Semaine fin'] || startWeek;
            startIdx = weekCodes.indexOf(startWeek);
            endIdx = weekCodes.indexOf(endWeek);
        } else {
            // Mode Sprint: trouver les semaines correspondantes
            const startSprint = phase['Sprint début'];
            const endSprint = phase['Sprint fin'] || startSprint;

            const allSprintNames = this.sprints.map(s => s['Sprint']);
            const startSprintIdx = allSprintNames.indexOf(startSprint);
            const endSprintIdx = allSprintNames.indexOf(endSprint);

            if (startSprintIdx === -1) {
                console.error('Sprint de début non trouvé');
                return;
            }

            const startSprintObj = this.sprints[startSprintIdx];
            const endSprintObj = this.sprints[endSprintIdx !== -1 ? endSprintIdx : startSprintIdx];

            const startSprintWeeks = this.getWeeksForSprint(startSprintObj);
            const endSprintWeeks = this.getWeeksForSprint(endSprintObj);

            startIdx = weekCodes.indexOf(startSprintWeeks[0]);
            endIdx = weekCodes.indexOf(endSprintWeeks[endSprintWeeks.length - 1]);
        }

        if (startIdx === -1) startIdx = 0;
        if (endIdx === -1) endIdx = weekCodes.length - 1;

        const currentColspan = endIdx - startIdx + 1;

        // Obtenir la position et dimensions du bloc
        const blockRect = block.getBoundingClientRect();

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
            initialWidth: blockRect.width,
            mode: mode,
            weekCodes: weekCodes
        };

        document.addEventListener('mousemove', this._boundResizeMove);
        document.addEventListener('mouseup', this._boundResizeEnd);
    }

    handleResizeMove(e) {
        if (!this.resizingPhase) return;

        const { direction, startX, preview, cellWidth, startIdx, endIdx, weekCodes } = this.resizingPhase;
        const deltaX = e.clientX - startX;

        // Calculer le nombre de semaines de décalage (arrondi à l'entier le plus proche)
        const weekDelta = Math.round(deltaX / cellWidth);

        // Calculer les nouveaux indices
        let newStartIdx = startIdx;
        let newEndIdx = endIdx;

        if (direction === 'left') {
            // Ancrage gauche: modifier le début
            newStartIdx = startIdx + weekDelta;
            // Limites: ne pas dépasser le début des semaines, et garder au moins 1 semaine
            newStartIdx = Math.max(0, Math.min(newStartIdx, endIdx));
        } else {
            // Ancrage droit: modifier la fin
            newEndIdx = endIdx + weekDelta;
            // Limites: ne pas dépasser la fin des semaines, et garder au moins 1 semaine
            newEndIdx = Math.min(weekCodes.length - 1, Math.max(newEndIdx, startIdx));
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
        this.resizingPhase.weekDelta = weekDelta;
    }

    async handleResizeEnd(e) {
        if (!this.resizingPhase) return;

        // Supprimer les event listeners avec les mêmes références
        document.removeEventListener('mousemove', this._boundResizeMove);
        document.removeEventListener('mouseup', this._boundResizeEnd);

        const { phase, direction, block, preview, newStartIdx, newEndIdx, startIdx, endIdx, mode, weekCodes } = this.resizingPhase;

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
            const newStartWeek = weekCodes[newStartIdx];
            const newEndWeek = weekCodes[newEndIdx];

            if (mode === 'Semaine') {
                // Mode Semaine: mettre à jour les semaines directement
                if (direction === 'left') {
                    phase['Semaine début'] = newStartWeek;
                } else {
                    phase['Semaine fin'] = newEndWeek;
                }
            } else {
                // Mode Sprint (défaut): trouver le sprint correspondant à la semaine
                // et mettre à jour Sprint début/fin
                const findSprintForWeek = (weekCode) => {
                    for (const sprint of this.sprints) {
                        const sprintWeeks = this.getWeeksForSprint(sprint);
                        if (sprintWeeks.includes(weekCode)) {
                            return sprint['Sprint'];
                        }
                    }
                    return null;
                };

                if (direction === 'left') {
                    const newSprint = findSprintForWeek(newStartWeek);
                    if (newSprint) {
                        phase['Sprint début'] = newSprint;
                    }
                } else {
                    const newSprint = findSprintForWeek(newEndWeek);
                    if (newSprint) {
                        phase['Sprint fin'] = newSprint;
                    }
                }
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
     * Convertit une couleur hexadécimale en RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [200, 200, 200];
    }

    /**
     * Dessine la légende des couleurs sur le PDF
     */
    drawPdfLegend(doc, startY, margin) {
        const phaseTypes = ['EB', 'Cadrage', 'Dev', 'Recette', 'MEP'];
        const colors = CONFIG.PHASE_COLORS;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Légende :', margin, startY);

        let xPos = margin + 18;
        phaseTypes.forEach(type => {
            const rgb = this.hexToRgb(colors[type]);

            // Rectangle de couleur
            doc.setFillColor(rgb[0], rgb[1], rgb[2]);
            doc.rect(xPos, startY - 3, 8, 4, 'F');
            doc.setDrawColor(150, 150, 150);
            doc.rect(xPos, startY - 3, 8, 4, 'S');

            // Label
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(type, xPos + 10, startY);

            xPos += 30;
        });

        return startY + 6;
    }

    /**
     * Construit le texte des filtres appliqués
     */
    buildFiltersText() {
        const filters = [];

        // Période
        const periodStart = this.formatDateFull(this.filters.dateDebut);
        const periodEnd = this.formatDateFull(this.filters.dateFin);
        filters.push(`Période : ${periodStart} - ${periodEnd}`);

        // Périmètres
        const allPerimetres = this.getAllPerimetres();
        if (this.filters.perimetres.length === allPerimetres.length) {
            filters.push('Périmètres : Tous');
        } else if (this.filters.perimetres.length > 0) {
            const perimetresStr = this.filters.perimetres.length <= 3
                ? this.filters.perimetres.join(', ')
                : `${this.filters.perimetres.length} sélectionné(s)`;
            filters.push(`Périmètres : ${perimetresStr}`);
        }

        // Responsables
        const allResponsables = this.getAllResponsables();
        if (this.filters.responsables.length === allResponsables.length) {
            filters.push('Responsables : Tous');
        } else if (this.filters.responsables.length > 0) {
            const responsablesDisplay = this.filters.responsables.slice(0, 3).map(r => this.formatActorName(r));
            const responsablesStr = this.filters.responsables.length <= 3
                ? responsablesDisplay.join(', ')
                : `${this.filters.responsables.length} sélectionné(s)`;
            filters.push(`Responsables : ${responsablesStr}`);
        }

        // Périmètre-Processus
        const allPerimProcessus = this.getAllPerimetreProcessus();
        if (this.filters.perimetreProcessus.length === allPerimProcessus.length) {
            filters.push('Périmètre-Processus : Tous');
        } else if (this.filters.perimetreProcessus.length > 0) {
            const ppStr = this.filters.perimetreProcessus.length <= 3
                ? this.filters.perimetreProcessus.join(', ')
                : `${this.filters.perimetreProcessus.length} sélectionné(s)`;
            filters.push(`Périmètre-Processus : ${ppStr}`);
        }

        return filters;
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
            doc.setTextColor(0, 51, 102);
            doc.text('Roadmap Chantiers', pageWidth / 2, 12, { align: 'center' });

            // Filtres appliqués
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            const filtersText = this.buildFiltersText();
            let yPos = 17;
            filtersText.forEach(filter => {
                doc.text(filter, pageWidth / 2, yPos, { align: 'center' });
                yPos += 4;
            });

            // Légende des couleurs (uniquement page 1)
            yPos = this.drawPdfLegend(doc, yPos + 2, margin);

            // Calculer la largeur des colonnes (égales pour tous les sprints)
            const availableWidth = pageWidth - margin * 2;
            const chantierColWidth = 40;
            const sprintColWidth = (availableWidth - chantierColWidth) / visibleSprints.length;

            // Construire les en-têtes du tableau avec dates des sprints
            const tableHeaders = [
                [
                    { content: 'Chantier', rowSpan: 2, styles: { valign: 'middle' } },
                    ...visibleSprints.map(s => ({
                        content: s['Sprint'],
                        styles: { halign: 'center', fontStyle: 'bold' }
                    }))
                ],
                visibleSprints.map(s => ({
                    content: `${this.formatDate(s['Début'])} - ${this.formatDate(s['Fin'])}`,
                    styles: { halign: 'center', fontSize: 5 }
                }))
            ];

            // Construire les données du tableau avec gestion des phases multiples ET fusion de cellules
            const tableData = [];
            const phasesMap = new Map(); // Pour stocker les infos de phases par cellule (clé: rowIdx-colIdx où colIdx est 1-based)
            const cellSpans = new Map(); // Pour stocker les colSpan de chaque cellule

            filteredChantiers.forEach((chantier, rowIdx) => {
                const chantierName = chantier['Chantier'] || '';
                const chantierPhases = this.phases.filter(p => p['Chantier'] === chantierName);
                const row = [chantierName];

                let sprintIdx = 0;
                while (sprintIdx < visibleSprints.length) {
                    const sprint = visibleSprints[sprintIdx];
                    const sprintName = sprint['Sprint'];
                    const colIdx = sprintIdx + 1; // Index de colonne (1-based car colonne 0 = chantier)

                    // Collecter les phases actives pour ce sprint
                    const activePhases = chantierPhases.filter(phase => {
                        const phaseStart = phase['Sprint début'];
                        const phaseEnd = phase['Sprint fin'] || phaseStart;
                        return this.isSprintInRange(sprintName, phaseStart, phaseEnd);
                    });

                    if (activePhases.length === 0) {
                        // Pas de phase, cellule vide
                        row.push('');
                        phasesMap.set(`${rowIdx}-${colIdx}`, []);
                        cellSpans.set(`${rowIdx}-${colIdx}`, 1);
                        sprintIdx++;
                    } else if (activePhases.length === 1) {
                        // Une seule phase - vérifier si on peut fusionner sur plusieurs sprints
                        const phase = activePhases[0];
                        const phaseEndSprint = phase['Sprint fin'] || phase['Sprint début'];

                        // Calculer combien de sprints consécutifs cette phase couvre
                        let colSpan = 1;
                        for (let nextIdx = sprintIdx + 1; nextIdx < visibleSprints.length; nextIdx++) {
                            const nextSprintName = visibleSprints[nextIdx]['Sprint'];
                            if (!this.isSprintInRange(nextSprintName, phase['Sprint début'], phaseEndSprint)) {
                                break;
                            }
                            // Vérifier qu'il n'y a pas d'autres phases sur ce sprint
                            const nextActivePhases = chantierPhases.filter(p => {
                                const pStart = p['Sprint début'];
                                const pEnd = p['Sprint fin'] || pStart;
                                return this.isSprintInRange(nextSprintName, pStart, pEnd);
                            });
                            if (nextActivePhases.length !== 1 || nextActivePhases[0] !== phase) {
                                break;
                            }
                            colSpan++;
                        }

                        const phasesInfo = [{
                            title: phase['Phase'] || phase['Type phase'] || '',
                            type: phase['Type phase'] || ''
                        }];

                        if (colSpan > 1) {
                            row.push({ content: '', colSpan: colSpan });
                        } else {
                            row.push('');
                        }

                        phasesMap.set(`${rowIdx}-${colIdx}`, phasesInfo);
                        cellSpans.set(`${rowIdx}-${colIdx}`, colSpan);
                        sprintIdx += colSpan;
                    } else {
                        // Plusieurs phases - pas de fusion, empilement vertical
                        const phasesInfo = activePhases.map(p => ({
                            title: p['Phase'] || p['Type phase'] || '',
                            type: p['Type phase'] || ''
                        }));

                        row.push('');
                        phasesMap.set(`${rowIdx}-${colIdx}`, phasesInfo);
                        cellSpans.set(`${rowIdx}-${colIdx}`, 1);
                        sprintIdx++;
                    }
                }

                tableData.push(row);
            });

            // Générer les colonnes styles avec largeurs égales
            const columnStyles = { 0: { cellWidth: chantierColWidth, fontStyle: 'bold', valign: 'middle' } };
            for (let i = 1; i <= visibleSprints.length; i++) {
                columnStyles[i] = { cellWidth: sprintColWidth, halign: 'center', valign: 'middle' };
            }

            // Générer le tableau avec autoTable
            const self = this;
            let isFirstPage = true;

            doc.autoTable({
                head: tableHeaders,
                body: tableData,
                startY: yPos + 2,
                margin: { left: margin, right: margin },
                tableWidth: availableWidth,
                styles: {
                    fontSize: 6,
                    cellPadding: 0,
                    overflow: 'hidden',
                    lineWidth: 0.1,
                    valign: 'middle',
                    halign: 'center',
                    minCellHeight: 8
                },
                headStyles: {
                    fillColor: [0, 51, 102],
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle',
                    fontSize: 6,
                    cellPadding: 1
                },
                columnStyles: columnStyles,
                alternateRowStyles: {
                    fillColor: [255, 255, 255]
                },
                didDrawCell: function(data) {
                    // Dessiner les phases avec couleurs dans les cellules du body
                    if (data.section === 'body' && data.column.index > 0) {
                        const phases = phasesMap.get(`${data.row.index}-${data.column.index}`);
                        if (phases && phases.length > 0) {
                            const cellX = data.cell.x;
                            const cellY = data.cell.y;
                            const cellW = data.cell.width;
                            const cellH = data.cell.height;
                            const padding = 0.5;

                            // Diviser la cellule verticalement pour chaque phase
                            const phaseHeight = (cellH - padding * 2) / phases.length;

                            phases.forEach((phase, idx) => {
                                const phaseY = cellY + padding + (idx * phaseHeight);
                                const phaseW = cellW - padding * 2;
                                const phaseH = phaseHeight - 0.3;

                                // Couleur de fond
                                const color = CONFIG.PHASE_COLORS[phase.type];
                                if (color) {
                                    const rgb = self.hexToRgb(color);
                                    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
                                } else {
                                    doc.setFillColor(220, 220, 220); // Gris clair par défaut
                                }

                                // Dessiner le rectangle de fond
                                doc.rect(cellX + padding, phaseY, phaseW, phaseH, 'F');

                                // Texte de la phase
                                doc.setFontSize(phases.length > 1 ? 4 : 5);
                                doc.setFont('helvetica', 'normal');
                                doc.setTextColor(0, 0, 0);

                                // Tronquer le texte si nécessaire
                                let text = phase.title;
                                const maxTextWidth = phaseW - 1;
                                while (doc.getTextWidth(text) > maxTextWidth && text.length > 3) {
                                    text = text.slice(0, -4) + '...';
                                }

                                // Centrer le texte verticalement et horizontalement
                                const textX = cellX + cellW / 2;
                                const textY = phaseY + phaseH / 2 + 1;
                                doc.text(text, textX, textY, { align: 'center', maxWidth: maxTextWidth });
                            });
                        }
                    }
                },
                didDrawPage: function(data) {
                    // Titre sur les pages suivantes (sans légende)
                    if (!isFirstPage) {
                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 51, 102);
                        doc.text('Roadmap Chantiers (suite)', pageWidth / 2, 10, { align: 'center' });
                    }
                    isFirstPage = false;
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
                doc.setTextColor(0, 51, 102);
                doc.text('Notes des Chantiers', pageWidth / 2, 12, { align: 'center' });

                // Période des notes (uniquement ici)
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(`Période des notes : ${this.formatDateFull(notesStartDate)} - ${this.formatDateFull(notesEndDate)}`, pageWidth / 2, 18, { align: 'center' });

                let yPosition = 26;

                for (const chantierName of chantiersWithNotes) {
                    const notes = notesByChantier[chantierName];

                    // Vérifier s'il faut une nouvelle page
                    if (yPosition > pageHeight - 40) {
                        doc.addPage();
                        // Répéter le titre sur les nouvelles pages
                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 51, 102);
                        doc.text('Notes des Chantiers (suite)', pageWidth / 2, 10, { align: 'center' });
                        yPosition = 18;
                    }

                    // Nom du chantier
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 51, 102);
                    doc.text(chantierName, margin, yPosition);
                    yPosition += 5;

                    // Notes du chantier
                    doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);

                    for (const note of notes) {
                        // Vérifier s'il faut une nouvelle page
                        if (yPosition > pageHeight - 20) {
                            doc.addPage();
                            doc.setFontSize(12);
                            doc.setFont('helvetica', 'bold');
                            doc.setTextColor(0, 51, 102);
                            doc.text('Notes des Chantiers (suite)', pageWidth / 2, 10, { align: 'center' });
                            yPosition = 18;
                        }

                        const noteDate = this.formatDateFull(this.parseDate(note['Date']));
                        const noteHtml = note['Note'] || '';

                        // Date de la note
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(0, 51, 102);
                        doc.text(`${noteDate} :`, margin + 2, yPosition);
                        yPosition += 4;

                        // Rendu du contenu avec formatage
                        yPosition = this.renderFormattedNote(doc, noteHtml, margin + 4, yPosition, pageWidth - margin * 2 - 8, pageHeight);

                        yPosition += 3; // Espace entre les notes
                    }

                    yPosition += 4; // Espace entre les chantiers
                }
            }

            // Générer le PDF et le télécharger
            const fileName = `Roadmap_Chantiers_${this.formatDateFile(new Date())}.pdf`;
            doc.save(fileName);
            showSuccess(`PDF "${fileName}" téléchargé dans votre dossier Téléchargements`);

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

    /**
     * Rend une note formatée dans le PDF (gras, italique, listes)
     */
    renderFormattedNote(doc, html, x, y, maxWidth, pageHeight) {
        if (!html) return y;

        const margin = 10;
        const lineHeight = 4;

        // Parser le HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Fonction pour vérifier et gérer le saut de page
        const checkPageBreak = (currentY, needed = lineHeight) => {
            if (currentY > pageHeight - 15) {
                doc.addPage();
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 51, 102);
                doc.text('Notes des Chantiers (suite)', doc.internal.pageSize.getWidth() / 2, 10, { align: 'center' });
                return 18;
            }
            return currentY;
        };

        // Fonction récursive pour parcourir les nœuds
        const processNode = (node, currentY, indent = 0, listCounter = null) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);
                    const lines = doc.splitTextToSize(text, maxWidth - indent);
                    for (const line of lines) {
                        currentY = checkPageBreak(currentY);
                        doc.text(line, x + indent, currentY);
                        currentY += lineHeight;
                    }
                }
                return currentY;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return currentY;

            const tagName = node.tagName.toLowerCase();

            // Gestion des styles
            if (tagName === 'b' || tagName === 'strong') {
                doc.setFont('helvetica', 'bold');
                for (const child of node.childNodes) {
                    currentY = processNode(child, currentY, indent, listCounter);
                }
                doc.setFont('helvetica', 'normal');
                return currentY;
            }

            if (tagName === 'i' || tagName === 'em') {
                doc.setFont('helvetica', 'italic');
                for (const child of node.childNodes) {
                    currentY = processNode(child, currentY, indent, listCounter);
                }
                doc.setFont('helvetica', 'normal');
                return currentY;
            }

            if (tagName === 'u') {
                // jsPDF ne supporte pas nativement le souligné, on le simule
                const text = node.textContent.trim();
                if (text) {
                    doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);
                    const lines = doc.splitTextToSize(text, maxWidth - indent);
                    for (const line of lines) {
                        currentY = checkPageBreak(currentY);
                        doc.text(line, x + indent, currentY);
                        // Dessiner une ligne de soulignement
                        const textWidth = doc.getTextWidth(line);
                        doc.setDrawColor(0, 0, 0);
                        doc.line(x + indent, currentY + 0.5, x + indent + textWidth, currentY + 0.5);
                        currentY += lineHeight;
                    }
                }
                return currentY;
            }

            // Liste non ordonnée
            if (tagName === 'ul') {
                const listItems = node.querySelectorAll(':scope > li');
                for (const li of listItems) {
                    currentY = checkPageBreak(currentY);
                    doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);
                    doc.text('•', x + indent, currentY);
                    for (const child of li.childNodes) {
                        currentY = processNode(child, currentY, indent + 5, null);
                    }
                }
                return currentY;
            }

            // Liste ordonnée
            if (tagName === 'ol') {
                const listItems = node.querySelectorAll(':scope > li');
                let counter = 1;
                for (const li of listItems) {
                    currentY = checkPageBreak(currentY);
                    doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);
                    doc.text(`${counter}.`, x + indent, currentY);
                    for (const child of li.childNodes) {
                        currentY = processNode(child, currentY, indent + 6, null);
                    }
                    counter++;
                }
                return currentY;
            }

            // Paragraphe ou div
            if (tagName === 'p' || tagName === 'div') {
                for (const child of node.childNodes) {
                    currentY = processNode(child, currentY, indent, listCounter);
                }
                return currentY;
            }

            // Saut de ligne
            if (tagName === 'br') {
                return currentY + lineHeight * 0.5;
            }

            // Autres éléments : traiter les enfants
            for (const child of node.childNodes) {
                currentY = processNode(child, currentY, indent, listCounter);
            }

            return currentY;
        };

        // Traiter tous les nœuds enfants
        doc.setFont('helvetica', 'normal');
        let currentY = y;
        for (const child of temp.childNodes) {
            currentY = processNode(child, currentY, 0, null);
        }

        return currentY;
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
