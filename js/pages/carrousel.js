/* ===========================================
   CARROUSEL.JS - Page Carrousel des Produits par Processus
   Application Carto
   =========================================== */

/**
 * Classe CarrouselPage pour gérer le carrousel des produits par processus
 */
class CarrouselPage {
    constructor() {
        this.produits = [];
        this.processus = [];
        this.pdtProcess = [];
        this.selectedTypes = []; // Filtre sur les types de rapports (vide = tous)
        this.selectedResponsables = []; // Filtre sur les responsables (vide = tous)

        // Zoom du carrousel
        this.zoomLevel = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2.0;
        this.zoomStep = 0.1;

        // Palette de couleurs Malakoff Humanis (3 gammes par couleur)
        // Chaque couleur a : pastel (processus), douce (cercle produit), intense (texte produit)
        this.colorPalette = [
            {
                name: 'Corail',
                pastel: '#FFF2F0',   // mh-corail-pastel
                douce: '#F3A89E',    // mh-corail-dark
                intense: '#E2250C'   // mh-corail-brand
            },
            {
                name: 'Bleu',
                pastel: '#E0F1F8',   // mh-bleu-pastel
                douce: '#BDE3F2',    // mh-bleu-light
                intense: '#1A283E'   // mh-bleu-dark
            },
            {
                name: 'Violet',
                pastel: '#EEE7F9',   // mh-violet-pastel
                douce: '#AA89E3',    // mh-violet-light
                intense: '#5514C7'   // mh-violet-dark
            },
            {
                name: 'Turquoise',
                pastel: '#DEF7F7',   // mh-bleu-turquoise-pastel
                douce: '#5AD5D9',    // mh-bleu-turquoise-light
                intense: '#006374'   // mh-bleu-turquoise-dark
            },
            {
                name: 'Rose',
                pastel: '#FDF0F7',   // mh-rose-pastel
                douce: '#F4B5D4',    // mh-rose-light
                intense: '#D81E88'   // mh-rose-dark
            },
            {
                name: 'Jaune',
                pastel: '#F9F4B9',   // mh-jaune-pastel
                douce: '#F4EC5B',    // mh-jaune-light
                intense: '#F9BD00'   // mh-jaune-dark
            },
            {
                name: 'Vert',
                pastel: '#E1FBF6',   // mh-vert-pastel
                douce: '#03DFB2',    // mh-vert-light
                intense: '#008275'   // mh-vert-dark
            },
            {
                name: 'Rose Chair',
                pastel: '#F9EFEB',   // mh-rose-chair-pastel
                douce: '#F9E2DB',    // mh-rose-chair-light-40
                intense: '#F0B7A5'   // mh-rose-chair-light
            },
            {
                name: 'Gris Sable',
                pastel: '#F9F7F6',   // mh-gris-sable-pastel
                douce: '#F4EFE7',    // mh-gris-sable-dark-40
                intense: '#E4D8C4'   // mh-gris-sable-dark
            }
        ];
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        // Mettre à jour le titre et le sous-titre du header
        document.getElementById('pageTitle').textContent = '🎪 Carrousel des Produits';
        document.getElementById('pageSubtitle').textContent = 'Visualisation circulaire des produits organisés par processus métier';

        container.innerHTML = `
            <div class="carrousel-page">
                <!-- Filtres -->
                <div class="carrousel-filters">
                    <div class="filter-group">
                        <label class="filter-label">Type de rapport :</label>
                        <div class="multi-select-wrapper" id="typeFilterWrapper">
                            <div class="multi-select-trigger" onclick="carrouselPageInstance.toggleTypeFilter()">
                                <span class="multi-select-label" id="typeFilterLabel">Tous</span>
                                <span class="multi-select-arrow">&#9662;</span>
                            </div>
                            <div class="multi-select-dropdown" id="typeFilterDropdown" style="display: none;">
                                <div class="multi-select-actions">
                                    <button type="button" class="btn btn-sm" onclick="carrouselPageInstance.selectAllTypes()">Tous</button>
                                    <button type="button" class="btn btn-sm" onclick="carrouselPageInstance.clearAllTypes()">Aucun</button>
                                </div>
                                <div class="multi-select-options" id="typeFilterOptions"></div>
                            </div>
                        </div>
                    </div>

                    <div class="filter-group">
                        <label class="filter-label">Responsable :</label>
                        <div class="multi-select-wrapper" id="responsableFilterWrapper">
                            <div class="multi-select-trigger" onclick="carrouselPageInstance.toggleResponsableFilter()">
                                <span class="multi-select-label" id="responsableFilterLabel">Tous</span>
                                <span class="multi-select-arrow">&#9662;</span>
                            </div>
                            <div class="multi-select-dropdown" id="responsableFilterDropdown" style="display: none;">
                                <div class="multi-select-actions">
                                    <button type="button" class="btn btn-sm" onclick="carrouselPageInstance.selectAllResponsables()">Tous</button>
                                    <button type="button" class="btn btn-sm" onclick="carrouselPageInstance.clearAllResponsables()">Aucun</button>
                                </div>
                                <div class="multi-select-options" id="responsableFilterOptions"></div>
                            </div>
                        </div>
                    </div>

                    <div class="carrousel-zoom-hint" title="Maintenez Ctrl (ou Cmd sur Mac) + molette pour zoomer">
                        🔍 Ctrl + molette = zoom
                    </div>
                </div>

                <div class="carrousel-container">
                    <div id="carrouselDiagram" class="carrousel-diagram"></div>
                </div>
            </div>
        `;

        await this.loadData();
        this.renderTypeFilter();
        this.renderResponsableFilter();
        this.renderCarrousel();
        this.attachGlobalEvents();
        this.attachZoomEvents();
    }

    /**
     * Charge les données
     */
    async loadData() {
        try {
            const [produitsData, processusData, pdtProcessData] = await Promise.all([
                readTable('tProduits'),
                readTable('tProcessus'),
                readTable('tPdtProcess')
            ]);

            this.produits = produitsData.data || [];
            this.processus = processusData.data || [];
            this.pdtProcess = pdtProcessData.data || [];
        } catch (error) {
            console.error('[Carrousel] Erreur chargement données:', error);
            showError('Erreur lors du chargement des données');
        }
    }

    /**
     * Rend le filtre des types de rapports
     */
    renderTypeFilter() {
        const container = document.getElementById('typeFilterOptions');
        if (!container) return;

        // Récupérer tous les types uniques (incluant les valeurs vides pour les cides)
        const allTypes = [...new Set(this.produits.map(p => p['Type de rapport'] || '(Vide)'))];
        allTypes.sort();

        // Générer les options (checkboxes)
        container.innerHTML = allTypes.map(type => `
            <label class="multi-select-option">
                <input type="checkbox" value="${escapeHtml(type)}"
                    ${this.selectedTypes.length === 0 || this.selectedTypes.includes(type) ? 'checked' : ''}
                    onchange="carrouselPageInstance.onTypeCheckChange()">
                <span>${escapeHtml(type)}</span>
            </label>
        `).join('');

        // Mettre à jour le label
        this.updateTypeFilterLabel();
    }

    /**
     * Toggle le dropdown du filtre Type
     */
    toggleTypeFilter() {
        const dropdown = document.getElementById('typeFilterDropdown');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * Sélectionne tous les types
     */
    selectAllTypes() {
        const checkboxes = document.querySelectorAll('#typeFilterOptions input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.onTypeCheckChange();
    }

    /**
     * Désélectionne tous les types
     */
    clearAllTypes() {
        const checkboxes = document.querySelectorAll('#typeFilterOptions input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.onTypeCheckChange();
    }

    /**
     * Appelé quand une checkbox de type change
     */
    onTypeCheckChange() {
        const checkboxes = document.querySelectorAll('#typeFilterOptions input[type="checkbox"]:checked');
        this.selectedTypes = Array.from(checkboxes).map(cb => cb.value);
        this.updateTypeFilterLabel();
        this.renderCarrousel();
    }

    /**
     * Met à jour le label du filtre Type
     */
    updateTypeFilterLabel() {
        const label = document.getElementById('typeFilterLabel');
        if (!label) return;

        const allTypes = [...new Set(this.produits.map(p => p['Type de rapport'] || '(Vide)'))];
        const allSelected = this.selectedTypes.length === allTypes.length;

        label.textContent = allSelected || this.selectedTypes.length === 0
            ? 'Tous'
            : (this.selectedTypes.length === 1 ? this.selectedTypes[0] : `${this.selectedTypes.length} sélectionné(s)`);
    }

    /**
     * Rend le filtre des responsables
     */
    renderResponsableFilter() {
        const container = document.getElementById('responsableFilterOptions');
        if (!container) return;

        // Récupérer tous les responsables uniques (incluant les valeurs vides)
        const responsablesSet = new Set();
        let hasEmpty = false;

        this.produits.forEach(p => {
            const resp = p['Responsable'];
            if (resp && resp.trim() !== '') {
                responsablesSet.add(resp);
            } else {
                hasEmpty = true;
            }
        });

        const allResponsables = Array.from(responsablesSet).sort();
        if (hasEmpty) {
            allResponsables.unshift(CONFIG.EMPTY_FILTER_VALUE);
        }

        // Générer les options (checkboxes)
        container.innerHTML = allResponsables.map(resp => {
            const isEmptyValue = resp === CONFIG.EMPTY_FILTER_VALUE;
            const label = isEmptyValue ? '(vide)' : formatActorName(resp);
            return `
                <label class="multi-select-option">
                    <input type="checkbox" value="${escapeHtml(resp)}"
                        ${this.selectedResponsables.length === 0 || this.selectedResponsables.includes(resp) ? 'checked' : ''}
                        onchange="carrouselPageInstance.onResponsableCheckChange()">
                    <span>${escapeHtml(label)}</span>
                </label>
            `;
        }).join('');

        // Mettre à jour le label
        this.updateResponsableFilterLabel();
    }

    /**
     * Toggle le dropdown du filtre Responsable
     */
    toggleResponsableFilter() {
        const dropdown = document.getElementById('responsableFilterDropdown');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * Sélectionne tous les responsables
     */
    selectAllResponsables() {
        const checkboxes = document.querySelectorAll('#responsableFilterOptions input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        this.onResponsableCheckChange();
    }

    /**
     * Désélectionne tous les responsables
     */
    clearAllResponsables() {
        const checkboxes = document.querySelectorAll('#responsableFilterOptions input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        this.onResponsableCheckChange();
    }

    /**
     * Appelé quand une checkbox de responsable change
     */
    onResponsableCheckChange() {
        const checkboxes = document.querySelectorAll('#responsableFilterOptions input[type="checkbox"]:checked');
        this.selectedResponsables = Array.from(checkboxes).map(cb => cb.value);
        this.updateResponsableFilterLabel();
        this.renderCarrousel();
    }

    /**
     * Met à jour le label du filtre Responsable
     */
    updateResponsableFilterLabel() {
        const label = document.getElementById('responsableFilterLabel');
        if (!label) return;

        const responsablesSet = new Set();
        let hasEmpty = false;

        this.produits.forEach(p => {
            const resp = p['Responsable'];
            if (resp && resp.trim() !== '') {
                responsablesSet.add(resp);
            } else {
                hasEmpty = true;
            }
        });

        const allResponsables = Array.from(responsablesSet);
        if (hasEmpty) allResponsables.push(CONFIG.EMPTY_FILTER_VALUE);

        const allSelected = this.selectedResponsables.length === allResponsables.length;

        label.textContent = allSelected || this.selectedResponsables.length === 0
            ? 'Tous'
            : `${this.selectedResponsables.length} sélectionné(s)`;
    }

    /**
     * Attache les événements globaux (fermer dropdown si clic extérieur)
     */
    attachGlobalEvents() {
        // Fermer les dropdowns si on clique ailleurs
        document.addEventListener('click', (e) => {
            const typeWrapper = document.getElementById('typeFilterWrapper');
            const typeDropdown = document.getElementById('typeFilterDropdown');
            if (typeWrapper && typeDropdown && !typeWrapper.contains(e.target)) {
                typeDropdown.style.display = 'none';
            }

            const respWrapper = document.getElementById('responsableFilterWrapper');
            const respDropdown = document.getElementById('responsableFilterDropdown');
            if (respWrapper && respDropdown && !respWrapper.contains(e.target)) {
                respDropdown.style.display = 'none';
            }
        });
    }

    /**
     * Attache les événements de zoom
     */
    attachZoomEvents() {
        const container = document.querySelector('.carrousel-container');
        if (container) {
            container.addEventListener('wheel', (e) => this.onCarrouselWheel(e), { passive: false });
        }
    }

    /**
     * Gestion du zoom avec la molette
     */
    onCarrouselWheel(event) {
        // Ctrl (Windows/Linux) ou Cmd (Mac) pour zoomer
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }

        event.preventDefault();

        const container = event.currentTarget;
        const diagram = container.querySelector('.carrousel-diagram');
        if (!diagram) return;

        // Calculer le nouveau niveau de zoom
        const delta = event.deltaY > 0 ? -this.zoomStep : this.zoomStep;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));

        if (newZoom === this.zoomLevel) return;

        // Position de la souris relative au container
        const rect = container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Position de scroll actuelle
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;

        // Point focal dans le contenu (avant zoom)
        const focusX = (scrollLeft + mouseX) / this.zoomLevel;
        const focusY = (scrollTop + mouseY) / this.zoomLevel;

        // Appliquer le nouveau zoom
        this.zoomLevel = newZoom;
        diagram.style.transform = `scale(${this.zoomLevel})`;
        diagram.style.transformOrigin = '0 0';

        // Ajuster le scroll pour garder le point focal sous la souris
        container.scrollLeft = focusX * this.zoomLevel - mouseX;
        container.scrollTop = focusY * this.zoomLevel - mouseY;
    }

    /**
     * Réinitialise le zoom
     */
    resetZoom() {
        this.zoomLevel = 1;
        const diagram = document.querySelector('.carrousel-diagram');
        if (diagram) {
            diagram.style.transform = 'scale(1)';
        }
    }

    /**
     * Rendu du carrousel
     */
    renderCarrousel() {
        const container = document.getElementById('carrouselDiagram');
        if (!container) return;

        // Grouper les produits par processus (via la colonne Processus dans tProduits)
        const produitsParProcessus = this.groupProductsByProcess();

        // Trier les processus selon l'ordre défini dans tProcessus
        const processusWithProducts = this.getSortedProcessus(produitsParProcessus);

        if (processusWithProducts.length === 0) {
            container.innerHTML = '<div class="carrousel-empty">Aucun produit avec processus défini</div>';
            return;
        }

        // Générer le SVG
        const svg = this.generateSVG(processusWithProducts, produitsParProcessus);
        container.innerHTML = svg;

        // Attacher les événements
        this.attachEvents();
    }

    /**
     * Groupe les produits par processus (via la table tPdtProcess)
     * Gère les couples Produit/Processus distincts et évite les doublons
     * Applique les filtres sur les types de rapports et les responsables
     */
    groupProductsByProcess() {
        const grouped = {};

        // Pour chaque lien dans tPdtProcess
        this.pdtProcess.forEach(link => {
            const processus = link['Processus'];
            const produitNom = link['Produit'];

            if (!processus || !produitNom) return;

            // Trouver le produit complet
            const produit = this.produits.find(p => p['Nom'] === produitNom);
            if (!produit) return;

            // Appliquer le filtre sur les types (si un filtre est actif)
            if (this.selectedTypes.length > 0) {
                const produitType = produit['Type de rapport'] || '(Vide)';
                if (!this.selectedTypes.includes(produitType)) {
                    return; // Ce produit ne correspond pas au filtre
                }
            }

            // Appliquer le filtre sur les responsables (si un filtre est actif)
            if (this.selectedResponsables.length > 0) {
                const produitResp = produit['Responsable'];
                const isEmptyResp = !produitResp || produitResp.trim() === '';
                const respValue = isEmptyResp ? CONFIG.EMPTY_FILTER_VALUE : produitResp;

                if (!this.selectedResponsables.includes(respValue)) {
                    return; // Ce produit ne correspond pas au filtre
                }
            }

            if (!grouped[processus]) {
                grouped[processus] = [];
            }

            // Vérifier que le produit n'est pas déjà dans ce processus (éviter les doublons)
            const alreadyExists = grouped[processus].some(p => p['Nom'] === produitNom);
            if (!alreadyExists) {
                grouped[processus].push(produit);
            }
        });

        // Trier les produits par ordre alphabétique dans chaque processus
        Object.keys(grouped).forEach(processus => {
            grouped[processus].sort((a, b) => {
                const nomA = (a['Nom'] || '').toLowerCase();
                const nomB = (b['Nom'] || '').toLowerCase();
                return nomA.localeCompare(nomB);
            });
        });

        return grouped;
    }

    /**
     * Retourne les processus triés selon l'ordre défini dans tProcessus
     */
    getSortedProcessus(produitsParProcessus) {
        const processusWithProducts = Object.keys(produitsParProcessus);

        // Trier selon l'ordre défini dans la table tProcessus
        return processusWithProducts.sort((a, b) => {
            const procA = this.processus.find(p => p['Processus'] === a);
            const procB = this.processus.find(p => p['Processus'] === b);

            const ordreA = procA ? (procA['Ordre'] || 999) : 999;
            const ordreB = procB ? (procB['Ordre'] || 999) : 999;

            return ordreA - ordreB;
        });
    }

    /**
     * Génère le SVG du carrousel
     */
    generateSVG(processusWithProducts, produitsParProcessus) {
        const cx = 450; // Centre X
        const cy = 500; // Centre Y (décalé vers le bas pour plus d'espace en haut et en bas)
        const innerRadius = 100; // Rayon intérieur (processus)
        const outerRadius = 260; // Rayon extérieur (fin des arcs processus)
        const productRadius = 290; // Rayon pour les cercles produits
        const textRadius = 420; // Rayon pour les textes des produits

        // Calculer le nombre total de produits pour répartir l'espace proportionnellement
        const totalProducts = processusWithProducts.reduce((sum, proc) => {
            return sum + (produitsParProcessus[proc] || []).length;
        }, 0);

        let svgParts = [];
        svgParts.push(`<svg viewBox="0 0 900 1050" class="carrousel-svg">`);

        // Commencer en haut et tourner dans le sens horaire (angle positif)
        let currentAngle = -Math.PI / 2;

        // Générer les arcs de processus (cercle intérieur)
        processusWithProducts.forEach((processus, index) => {
            const produits = produitsParProcessus[processus] || [];
            const productCount = produits.length;

            // L'angle est proportionnel au nombre de produits
            // Sens horaire : ajouter l'angle (rotation positive)
            const angleSpan = (productCount / totalProducts) * (2 * Math.PI);
            const startAngle = currentAngle;
            const endAngle = currentAngle + angleSpan;
            const midAngle = (startAngle + endAngle) / 2;

            // Récupérer la palette de couleurs pour ce processus
            const colorScheme = this.colorPalette[index % this.colorPalette.length];
            const color = colorScheme.pastel;

            // Arc du processus
            const arcPath = this.createArcPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle);
            svgParts.push(`
                <path
                    d="${arcPath}"
                    fill="${color}"
                    stroke="#ffffff"
                    stroke-width="3"
                    class="carrousel-process-arc"
                    data-processus="${escapeHtml(processus)}"
                    style="cursor: pointer;"
                />
            `);

            // Texte du processus (au milieu de l'arc, lisible)
            const labelRadius = (innerRadius + outerRadius) / 2;
            const labelX = cx + labelRadius * Math.cos(midAngle);
            const labelY = cy + labelRadius * Math.sin(midAngle);

            // Calculer l'angle de rotation pour que le texte soit lisible
            let textAngle = (midAngle * 180 / Math.PI);
            // Ajuster pour que le texte soit toujours lisible (pas à l'envers)
            // Si l'angle est entre 90° et 270°, le texte serait à l'envers, donc on le retourne
            if (textAngle > 90 && textAngle < 270) {
                textAngle += 180;
            } else if (textAngle < -90 && textAngle > -270) {
                textAngle += 180;
            }

            svgParts.push(`
                <text
                    x="${labelX}"
                    y="${labelY}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    transform="rotate(${textAngle}, ${labelX}, ${labelY})"
                    class="carrousel-process-label"
                    style="pointer-events: none; font-size: 13px; font-weight: 700; fill: var(--mh-bleu-fonce);"
                >
                    ${processus}
                </text>
            `);

            // Générer les cercles des produits pour ce processus
            const anglePerProduct = angleSpan / (productCount + 1);

            produits.forEach((produit, pIndex) => {
                // Sens horaire : ajouter l'angle
                const productAngle = startAngle + anglePerProduct * (pIndex + 1);
                const productX = cx + productRadius * Math.cos(productAngle);
                const productY = cy + productRadius * Math.sin(productAngle);

                // Normaliser l'angle entre 0 et 2π
                const normalizedAngle = ((productAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

                // Déterminer si le label est en zone de chevauchement (haut ou bas)
                // Haut : -45° à 45° (soit 315° à 45° en radians normalisés)
                // Bas : 135° à 225° (soit 2.36 à 3.93 radians)
                const inTopZone = normalizedAngle < Math.PI / 4 || normalizedAngle > (7 * Math.PI / 4);
                const inBottomZone = normalizedAngle > (3 * Math.PI / 4) && normalizedAngle < (5 * Math.PI / 4);

                // Alterner le rayon pour les labels en zone de chevauchement
                let labelRadius = textRadius;
                if ((inTopZone || inBottomZone) && pIndex % 2 === 1) {
                    labelRadius = textRadius + 35; // Décalage radial pour les labels impairs
                }

                // Position du texte (avec décalage si nécessaire)
                const textX = cx + labelRadius * Math.cos(productAngle);
                const textY = cy + labelRadius * Math.sin(productAngle);

                // Couleurs du produit selon la palette du processus
                const productCircleColor = colorScheme.douce;   // Gamme douce pour le cercle
                const productTextColor = colorScheme.intense;   // Gamme intense pour le texte

                // Calculer l'ancrage du texte selon la position
                let textAnchor = 'middle';
                if (textX > cx + 10) {
                    textAnchor = 'start';
                } else if (textX < cx - 10) {
                    textAnchor = 'end';
                }

                const produitId = `product-${index}-${pIndex}`;

                svgParts.push(`
                    <g class="carrousel-product" data-produit="${escapeHtml(produit['Nom'])}" data-row-index="${produit._rowIndex}" data-product-id="${produitId}">
                        <!-- Ligne processus -> cercle produit -->
                        <line
                            x1="${cx + outerRadius * Math.cos(productAngle)}"
                            y1="${cy + outerRadius * Math.sin(productAngle)}"
                            x2="${productX}"
                            y2="${productY}"
                            stroke="${productCircleColor}"
                            stroke-width="1.5"
                            stroke-dasharray="3,3"
                            class="carrousel-product-line"
                        />
                        <!-- Cercle du produit (gamme douce) -->
                        <circle
                            cx="${productX}"
                            cy="${productY}"
                            r="15"
                            fill="${productCircleColor}"
                            stroke="#ffffff"
                            stroke-width="2"
                            class="carrousel-product-circle"
                        />
                        <!-- Ligne cercle produit -> texte produit -->
                        <line
                            x1="${productX}"
                            y1="${productY}"
                            x2="${textX}"
                            y2="${textY}"
                            stroke="${productTextColor}"
                            stroke-width="1"
                            stroke-dasharray="2,2"
                            class="carrousel-product-text-line"
                        />
                        <!-- Texte du produit (gamme intense) -->
                        <text
                            x="${textX}"
                            y="${textY}"
                            text-anchor="${textAnchor}"
                            dominant-baseline="middle"
                            class="carrousel-product-label"
                            data-product-id="${produitId}"
                            style="font-size: 9px; font-weight: 600; fill: ${productTextColor};"
                        >
                            ${produit['Nom']}
                        </text>
                    </g>
                `);
            });

            currentAngle = endAngle;
        });

        svgParts.push(`</svg>`);

        return svgParts.join('');
    }

    /**
     * Crée un chemin d'arc SVG
     */
    createArcPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
        const x1 = cx + innerRadius * Math.cos(startAngle);
        const y1 = cy + innerRadius * Math.sin(startAngle);
        const x2 = cx + outerRadius * Math.cos(startAngle);
        const y2 = cy + outerRadius * Math.sin(startAngle);
        const x3 = cx + outerRadius * Math.cos(endAngle);
        const y3 = cy + outerRadius * Math.sin(endAngle);
        const x4 = cx + innerRadius * Math.cos(endAngle);
        const y4 = cy + innerRadius * Math.sin(endAngle);

        // Pour le sens horaire, on vérifie si l'arc est > 180°
        const angleSpan = endAngle - startAngle;
        const largeArcFlag = Math.abs(angleSpan) > Math.PI ? 1 : 0;

        return `
            M ${x1} ${y1}
            L ${x2} ${y2}
            A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x3} ${y3}
            L ${x4} ${y4}
            A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}
            Z
        `;
    }


    /**
     * Tronque un texte
     */
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 1) + '…';
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        // Clic sur un processus
        document.querySelectorAll('.carrousel-process-arc').forEach(arc => {
            arc.addEventListener('click', async (e) => {
                const processus = e.target.dataset.processus;
                if (processus && typeof ProcessModal !== 'undefined') {
                    await ProcessModal.show(processus);
                }
            });

            // Hover effect
            arc.addEventListener('mouseenter', (e) => {
                e.target.style.opacity = '0.8';
            });
            arc.addEventListener('mouseleave', (e) => {
                e.target.style.opacity = '1';
            });
        });

        // Clic sur un produit
        document.querySelectorAll('.carrousel-product').forEach(group => {
            const produitNom = group.dataset.produit;
            const rowIndex = parseInt(group.dataset.rowIndex);
            const productId = group.dataset.productId;

            group.addEventListener('click', async (e) => {
                const produit = this.produits.find(p => p['Nom'] === produitNom && p._rowIndex === rowIndex);
                if (produit && typeof ProductModal !== 'undefined') {
                    await ProductModal.showEditModal(produit, rowIndex, async () => {
                        // Recharger les données et re-render
                        await this.loadData();
                        this.renderCarrousel();
                    });
                }
            });

            // Hover effect : agrandir le cercle et mettre le texte en gras et plus gros
            group.addEventListener('mouseenter', () => {
                group.classList.add('hovered');
                // Agrandir le cercle en changeant son rayon
                const circle = group.querySelector('.carrousel-product-circle');
                if (circle) {
                    circle.setAttribute('r', '20');
                }
                // Mettre le texte correspondant en gras et plus gros
                const textElement = document.querySelector(`.carrousel-product-label[data-product-id="${productId}"]`);
                if (textElement) {
                    textElement.style.fontWeight = '700';
                    textElement.style.fontSize = '11px';
                }
            });

            group.addEventListener('mouseleave', () => {
                group.classList.remove('hovered');
                // Remettre le cercle à sa taille normale
                const circle = group.querySelector('.carrousel-product-circle');
                if (circle) {
                    circle.setAttribute('r', '15');
                }
                // Remettre le texte en poids et taille normaux
                const textElement = document.querySelector(`.carrousel-product-label[data-product-id="${productId}"]`);
                if (textElement) {
                    textElement.style.fontWeight = '600';
                    textElement.style.fontSize = '9px';
                }
            });
        });
    }
}

// Instance globale
let carrouselPageInstance = null;

/**
 * Fonction d'entrée pour afficher la page Carrousel
 */
async function renderCarrouselPage(container) {
    if (!carrouselPageInstance) {
        carrouselPageInstance = new CarrouselPage();
    }
    await carrouselPageInstance.render(container);
}

/**
 * Fonction pour rafraîchir la page Carrousel
 */
async function refreshCarrouselPage() {
    if (carrouselPageInstance) {
        await carrouselPageInstance.loadData();
        carrouselPageInstance.renderCarrousel();
    }
}
