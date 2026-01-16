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
        if (isNaN(date.getTime())) return { month: '', year: '' };
        const months = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
        return {
            month: months[date.getMonth()],
            year: String(date.getFullYear()).slice(-2)
        };
    }

    /**
     * Formate une date pour affichage (dd/mm)
     */
    formatDateShort(dateValue) {
        const date = this.parseDate(dateValue);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    }

    /**
     * Obtient les dates de début et fin d'un sprint
     */
    getSprintDates(sprint) {
        const debut = this.formatDateShort(sprint['Début']);
        const fin = this.formatDateShort(sprint['Fin']);
        if (!debut) return '';
        if (!fin) return debut;
        return `${debut} - ${fin}`;
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
        let currentMonthKey = '';

        sortedSprints.forEach((sprint, sprintIndex) => {
            const sprintName = sprint.Sprint || `Sprint ${sprintIndex + 1}`;
            const sprintDates = this.getSprintDates(sprint);
            const monthYearObj = this.getSprintMonthYear(sprint);
            const monthKey = `${monthYearObj.month}-${monthYearObj.year}`;
            const showMonth = monthKey !== currentMonthKey;
            currentMonthKey = monthKey;

            // Compter combien de sprints ont le même mois pour le rowspan
            let monthRowspan = 1;
            if (showMonth) {
                for (let i = sprintIndex + 1; i < sortedSprints.length; i++) {
                    const nextMonthYear = this.getSprintMonthYear(sortedSprints[i]);
                    const nextMonthKey = `${nextMonthYear.month}-${nextMonthYear.year}`;
                    if (nextMonthKey === monthKey) {
                        monthRowspan++;
                    } else {
                        break;
                    }
                }
            }

            rowsHtml += `<tr data-sprint-index="${sprintIndex}" data-sprint-name="${escapeHtml(sprintName)}">`;

            // Colonne Mois avec année (avec rowspan si nouveau mois)
            if (showMonth) {
                rowsHtml += `<td class="gantt-month-cell" rowspan="${monthRowspan}">
                    <div class="month-with-year">
                        <span class="month-name">${escapeHtml(monthYearObj.month)}</span>
                        <span class="month-year">${escapeHtml(monthYearObj.year)}</span>
                    </div>
                </td>`;
            }

            // Colonne Sprint avec dates
            rowsHtml += `<td class="gantt-sprint-cell">
                <div class="sprint-name">${escapeHtml(sprintName)}</div>
                <div class="sprint-dates">${escapeHtml(sprintDates)}</div>
            </td>`;

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
                    rowsHtml += `<td class="gantt-data-cell" data-sprint-index="${sprintIndex}" data-col-index="${colIndex}"${rowspanAttr}>${this.renderPhaseBlock(item, rowspan, sprintIndex, colIndex)}</td>`;
                } else {
                    rowsHtml += `<td class="gantt-data-cell" data-sprint-index="${sprintIndex}" data-col-index="${colIndex}"></td>`;
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
    renderPhaseBlock(item, rowspan = 1, sprintIndex = 0, colIndex = 0) {
        const phase = item.Phase || 'Sans phase';
        const produit = item.Produit || '';
        const description = item.Description || '';
        const color = item.Couleur || this.getDefaultColor(phase);
        const backlogIndex = this.backlog.indexOf(item);

        // Créer un identifiant unique basé sur les données de l'item
        const itemKey = `${produit}|${item.Processus || ''}|${item['Périmètre'] || ''}|${phase}|${item['Sprint début'] || ''}`;

        // Construire le tooltip avec description si remplie
        let tooltip = `${produit} - ${phase}`;
        if (description) {
            tooltip += `\n\n${description}`;
        }

        // Ajouter des handles de redimensionnement si rowspan > 1 ou si c'est une vignette simple
        const resizeHandles = `
            <div class="gantt-resize-handle gantt-resize-handle-top" data-resize="top"></div>
            <div class="gantt-resize-handle gantt-resize-handle-bottom" data-resize="bottom"></div>
        `;

        return `
            <div class="gantt-phase-block gantt-phase-fullwidth"
                 data-backlog-index="${backlogIndex}"
                 data-item-key="${escapeHtml(itemKey)}"
                 data-sprint-start="${sprintIndex}"
                 data-rowspan="${rowspan}"
                 data-col-index="${colIndex}"
                 draggable="true"
                 style="background-color: ${escapeHtml(color)};"
                 title="${escapeHtml(tooltip)}">
                ${resizeHandles}
                <span class="phase-text" data-phase="${escapeHtml(phase)}">${escapeHtml(phase)}</span>
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
        const blocks = document.querySelectorAll('.gantt-phase-block');

        blocks.forEach(block => {
            let clickTimer = null;
            let isEditing = false;

            // Double-clic : ouvrir la fiche
            block.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                const index = parseInt(block.dataset.backlogIndex);
                if (!isNaN(index)) {
                    this.editBacklogItem(index);
                }
            });

            // Simple clic : édition inline du titre
            block.addEventListener('click', (e) => {
                // Ignorer si on clique sur un handle de resize
                if (e.target.classList.contains('gantt-resize-handle')) return;

                e.preventDefault();
                e.stopPropagation();

                // Utiliser un timer pour différencier simple et double clic
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                    return;
                }

                clickTimer = setTimeout(() => {
                    clickTimer = null;
                    if (!isEditing) {
                        this.startInlineEdit(block);
                    }
                }, 250);
            });

            // Clic droit : menu contextuel
            block.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(block.dataset.backlogIndex);
                if (!isNaN(index)) {
                    this.showContextMenu(e.clientX, e.clientY, index);
                }
            });

            // Drag & Drop
            block.addEventListener('dragstart', (e) => {
                if (isEditing) {
                    e.preventDefault();
                    return;
                }
                block.classList.add('dragging');
                // Envoyer l'index ET la clé unique pour retrouver l'item
                const transferData = `${block.dataset.backlogIndex}|||${block.dataset.itemKey || ''}`;
                e.dataTransfer.setData('text/plain', transferData);
                e.dataTransfer.effectAllowed = 'move';
            });

            block.addEventListener('dragend', (e) => {
                block.classList.remove('dragging');
                document.querySelectorAll('.gantt-data-cell.drag-over, .gantt-data-cell.drag-invalid').forEach(cell => {
                    cell.classList.remove('drag-over', 'drag-invalid');
                });
            });

            // Resize handles
            const resizeHandles = block.querySelectorAll('.gantt-resize-handle');
            resizeHandles.forEach(handle => {
                handle.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startResize(block, handle.dataset.resize, e);
                });
            });
        });

        // Drag over sur les cellules vides
        document.querySelectorAll('.gantt-data-cell').forEach(cell => {
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingBlock = document.querySelector('.gantt-phase-block.dragging');
                if (draggingBlock) {
                    // Vérifier si la cellule est dans la même colonne
                    const dragColIndex = draggingBlock.dataset.colIndex;
                    const cellColIndex = cell.dataset.colIndex;

                    if (dragColIndex === cellColIndex) {
                        cell.classList.add('drag-over');
                        cell.classList.remove('drag-invalid');
                        e.dataTransfer.dropEffect = 'move';
                    } else {
                        cell.classList.add('drag-invalid');
                        cell.classList.remove('drag-over');
                        e.dataTransfer.dropEffect = 'none';
                    }
                }
            });

            cell.addEventListener('dragleave', (e) => {
                cell.classList.remove('drag-over', 'drag-invalid');
            });

            cell.addEventListener('drop', async (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over', 'drag-invalid');

                const transferData = e.dataTransfer.getData('text/plain');
                const [backlogIndexStr, itemKey] = transferData.split('|||');
                const backlogIndex = parseInt(backlogIndexStr);
                const targetSprintIndex = parseInt(cell.dataset.sprintIndex);
                const targetColIndex = parseInt(cell.dataset.colIndex);

                if (!isNaN(backlogIndex) && !isNaN(targetSprintIndex)) {
                    await this.moveItemToSprint(backlogIndex, targetSprintIndex, targetColIndex, itemKey);
                }
            });
        });
    }

    /**
     * Démarre l'édition inline du titre
     */
    startInlineEdit(block) {
        const phaseText = block.querySelector('.phase-text');
        if (!phaseText) return;

        const currentText = phaseText.dataset.phase || phaseText.textContent;
        const backlogIndex = parseInt(block.dataset.backlogIndex);

        block.classList.add('editing');

        // Créer l'input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'phase-text-input';
        input.value = currentText;
        input.placeholder = 'Phase...';

        // Remplacer le texte par l'input
        phaseText.style.display = 'none';
        block.appendChild(input);
        input.focus();
        input.select();

        const finishEdit = async (save) => {
            if (save && input.value !== currentText) {
                await this.updatePhaseInline(backlogIndex, input.value);
            }
            block.classList.remove('editing');
            input.remove();
            phaseText.style.display = '';
        };

        input.addEventListener('blur', () => finishEdit(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                finishEdit(false);
            }
        });
    }

    /**
     * Met à jour la phase en inline
     */
    async updatePhaseInline(index, newPhase) {
        const item = this.backlog[index];
        if (!item) return;

        try {
            const updatedItem = { ...item, Phase: newPhase };
            await updateTableRow('tBacklog', index + 2, updatedItem);
            showSuccess('Phase mise à jour');
            await this.loadData();
        } catch (error) {
            console.error('Erreur mise à jour inline:', error);
            showError('Erreur lors de la mise à jour');
        }
    }

    /**
     * Affiche le menu contextuel
     */
    showContextMenu(x, y, backlogIndex) {
        // Supprimer tout menu existant
        this.hideContextMenu();

        const item = this.backlog[backlogIndex];
        if (!item) return;

        const menu = document.createElement('div');
        menu.className = 'gantt-context-menu';
        menu.innerHTML = `
            <div class="gantt-context-menu-item" data-action="edit">
                <span>✏️</span> Modifier
            </div>
            <div class="gantt-context-menu-separator"></div>
            <div class="gantt-context-menu-item danger" data-action="delete">
                <span>🗑️</span> Supprimer
            </div>
        `;

        // Positionner le menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        document.body.appendChild(menu);

        // Ajuster si dépasse de l'écran
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }

        // Événements du menu
        menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
            this.hideContextMenu();
            this.editBacklogItem(backlogIndex);
        });

        menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
            this.hideContextMenu();
            this.confirmDeleteBacklogItem(backlogIndex);
        });

        // Fermer le menu si on clique ailleurs
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 10);
    }

    /**
     * Cache le menu contextuel
     */
    hideContextMenu() {
        const existingMenu = document.querySelector('.gantt-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    /**
     * Confirme la suppression d'un item
     */
    async confirmDeleteBacklogItem(index) {
        const item = this.backlog[index];
        if (!item) return;

        const produit = item.Produit || 'cet élément';
        const phase = item.Phase || '';
        const message = phase
            ? `Êtes-vous sûr de vouloir supprimer "${produit} - ${phase}" ?`
            : `Êtes-vous sûr de vouloir supprimer "${produit}" ?`;

        if (confirm(message)) {
            await this.deleteBacklogItem(index);
        }
    }

    /**
     * Déplace un item vers un autre sprint
     */
    async moveItemToSprint(backlogIndex, targetSprintIndex, targetColIndex, itemKey) {
        // Retrouver l'item par sa clé unique si possible (plus fiable que l'index)
        let item = this.backlog[backlogIndex];
        let actualIndex = backlogIndex;

        if (itemKey) {
            // Chercher l'item par sa clé pour éviter les erreurs d'index
            const foundIndex = this.backlog.findIndex(b => {
                const key = `${b.Produit || ''}|${b.Processus || ''}|${b['Périmètre'] || ''}|${b.Phase || ''}|${b['Sprint début'] || ''}`;
                return key === itemKey;
            });
            if (foundIndex !== -1) {
                item = this.backlog[foundIndex];
                actualIndex = foundIndex;
            }
        }

        if (!item) {
            showError('Élément non trouvé');
            return;
        }

        const sortedSprints = this.getSortedSprints();
        const targetSprint = sortedSprints[targetSprintIndex];
        if (!targetSprint) return;

        // Vérifier que la cellule cible est vide ou c'est le même item
        const existingItemInTarget = this.backlog.find((b, idx) => {
            if (idx === actualIndex) return false; // C'est le même item
            const colIdx = this.columns.findIndex(col =>
                col.processus === (b.Processus || 'Non défini') &&
                col.perimetre === (b['Périmètre'] || 'Non défini') &&
                col.produit === (b.Produit || 'Non défini')
            );
            if (colIdx !== targetColIndex) return false;

            const sprintDebut = b['Sprint début'];
            const sprintFin = b['Sprint fin'] || sprintDebut;
            const startIdx = sortedSprints.findIndex(s => s.Sprint === sprintDebut);
            const endIdx = sortedSprints.findIndex(s => s.Sprint === sprintFin);

            return targetSprintIndex >= startIdx && targetSprintIndex <= endIdx;
        });

        if (existingItemInTarget) {
            showError('Cette cellule est déjà occupée');
            return;
        }

        try {
            const block = document.querySelector(`[data-backlog-index="${backlogIndex}"]`);
            const currentRowspan = parseInt(block?.dataset.rowspan) || 1;
            const updatedItem = { ...item };

            // Calculer le nouveau sprint de fin
            updatedItem['Sprint début'] = targetSprint.Sprint;

            if (currentRowspan > 1) {
                const newEndIndex = Math.min(targetSprintIndex + currentRowspan - 1, sortedSprints.length - 1);
                updatedItem['Sprint fin'] = sortedSprints[newEndIndex].Sprint;
            } else {
                updatedItem['Sprint fin'] = targetSprint.Sprint;
            }

            await updateTableRow('tBacklog', actualIndex + 2, updatedItem);
            showSuccess('Projet déplacé');
            await this.loadData();
        } catch (error) {
            console.error('Erreur déplacement:', error);
            showError('Erreur lors du déplacement');
        }
    }

    /**
     * Démarre le redimensionnement d'une vignette
     */
    startResize(block, direction, startEvent) {
        const backlogIndex = parseInt(block.dataset.backlogIndex);
        const item = this.backlog[backlogIndex];
        if (!item) return;

        block.classList.add('resizing');

        const sortedSprints = this.getSortedSprints();
        const startY = startEvent.clientY;
        const rowHeight = 48; // Hauteur d'une ligne
        const currentRowspan = parseInt(block.dataset.rowspan) || 1;
        const currentSprintStart = parseInt(block.dataset.sprintStart);

        const onMouseMove = (e) => {
            const deltaY = e.clientY - startY;
            const deltaRows = Math.round(deltaY / rowHeight);

            if (deltaRows !== 0) {
                // Prévisualiser visuellement (optionnel)
            }
        };

        const onMouseUp = async (e) => {
            block.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const deltaY = e.clientY - startY;
            const deltaRows = Math.round(deltaY / rowHeight);

            if (deltaRows === 0) return;

            try {
                const updatedItem = { ...item };

                if (direction === 'top') {
                    // Modifier le sprint de début
                    const newStartIndex = Math.max(0, currentSprintStart + deltaRows);
                    if (newStartIndex < sortedSprints.length) {
                        updatedItem['Sprint début'] = sortedSprints[newStartIndex].Sprint;
                    }
                } else {
                    // Modifier le sprint de fin
                    const currentEndIndex = currentSprintStart + currentRowspan - 1;
                    const newEndIndex = Math.max(currentSprintStart, Math.min(currentEndIndex + deltaRows, sortedSprints.length - 1));
                    updatedItem['Sprint fin'] = sortedSprints[newEndIndex].Sprint;
                }

                await updateTableRow('tBacklog', backlogIndex + 2, updatedItem);
                showSuccess('Durée mise à jour');
                await this.loadData();
            } catch (error) {
                console.error('Erreur redimensionnement:', error);
                showError('Erreur lors du redimensionnement');
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
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

        // Préparer les options pour les selects (avec déduplication)
        const processusOptions = [...new Set(this.processus.map(p => p.Processus).filter(Boolean))];
        const perimetresOptions = [...new Set(this.perimetres.map(p => p['Périmetre']).filter(Boolean))];
        const sprintsOptions = [...new Set(this.sprints.map(s => s.Sprint).filter(Boolean))];
        const produitsOptions = [...new Set(this.produits.map(p => p.Nom).filter(Boolean))];

        const content = `
            <form id="formEditBacklog" class="form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Produit</label>
                        <select name="Produit" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${produitsOptions.map(p => `<option value="${escapeHtml(p)}" ${(p || '').trim() === (item.Produit || '').trim() ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Processus</label>
                        <select name="Processus" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${processusOptions.map(p => `<option value="${escapeHtml(p)}" ${(p || '').trim() === (item.Processus || '').trim() ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Périmètre</label>
                        <select name="Périmètre" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${perimetresOptions.map(p => `<option value="${escapeHtml(p)}" ${(p || '').trim() === (item['Périmètre'] || '').trim() ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phase</label>
                        <input type="text" name="Phase" class="form-input" value="${escapeHtml(item.Phase || '')}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea name="Description" class="form-textarea" rows="3" placeholder="Description détaillée de la phase...">${escapeHtml(item.Description || '')}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Sprint début</label>
                        <select name="Sprint début" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${sprintsOptions.map(s => `<option value="${escapeHtml(s)}" ${(s || '').trim() === (item['Sprint début'] || '').trim() ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sprint fin</label>
                        <select name="Sprint fin" class="form-select">
                            <option value="">-- Sélectionner --</option>
                            ${sprintsOptions.map(s => `<option value="${escapeHtml(s)}" ${(s || '').trim() === (item['Sprint fin'] || '').trim() ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
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
                        await this.confirmDeleteBacklogItem(index);
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
     * Supprime un item backlog (appelé après confirmation)
     */
    async deleteBacklogItem(index) {
        const item = this.backlog[index];
        if (!item) return;

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
     * Supprime avec confirmation depuis le modal
     */
    async deleteBacklogItemWithConfirm(index) {
        await this.confirmDeleteBacklogItem(index);
    }

    /**
     * Ouvre le formulaire d'ajout d'un nouvel item backlog
     */
    async addBacklogItem() {
        // Préparer les options pour les selects (avec déduplication)
        const processusOptions = [...new Set(this.processus.map(p => p.Processus).filter(Boolean))];
        const perimetresOptions = [...new Set(this.perimetres.map(p => p['Périmetre']).filter(Boolean))];
        const sprintsOptions = [...new Set(this.sprints.map(s => s.Sprint).filter(Boolean))];
        const produitsOptions = [...new Set(this.produits.map(p => p.Nom).filter(Boolean))];

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
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea name="Description" class="form-textarea" rows="3" placeholder="Description détaillée de la phase..."></textarea>
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
