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
        container.innerHTML = `
            <div class="carrousel-page">
                <div class="page-header">
                    <h1>&#127914; Carrousel des Produits</h1>
                    <p class="page-description">
                        Visualisation circulaire des produits organisés par processus métier.
                        Cliquez sur un processus pour voir ses produits, ou sur un produit pour le modifier.
                    </p>
                </div>

                <div class="carrousel-container">
                    <div id="carrouselDiagram" class="carrousel-diagram"></div>
                </div>

                <div class="carrousel-legend">
                    <div class="legend-title">Légende</div>
                    <div class="legend-items">
                        <div class="legend-item">
                            <span class="legend-circle inner"></span>
                            <span>Processus (cliquez pour détails)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-circle outer"></span>
                            <span>Produits (cliquez pour modifier)</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadData();
        this.renderCarrousel();
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
     * Rendu du carrousel
     */
    renderCarrousel() {
        const container = document.getElementById('carrouselDiagram');
        if (!container) return;

        // Grouper les produits par processus (via la colonne Processus dans tProduits)
        const produitsParProcessus = this.groupProductsByProcess();

        // Liste unique des processus qui ont des produits
        const processusWithProducts = Object.keys(produitsParProcessus).sort();

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

            if (!grouped[processus]) {
                grouped[processus] = [];
            }

            // Vérifier que le produit n'est pas déjà dans ce processus (éviter les doublons)
            const alreadyExists = grouped[processus].some(p => p['Nom'] === produitNom);
            if (!alreadyExists) {
                grouped[processus].push(produit);
            }
        });

        return grouped;
    }

    /**
     * Génère le SVG du carrousel
     */
    generateSVG(processusWithProducts, produitsParProcessus) {
        const cx = 500; // Centre X
        const cy = 500; // Centre Y
        const innerRadius = 120; // Rayon intérieur (processus)
        const outerRadius = 200; // Rayon extérieur (fin des arcs processus)
        const productRadius = 350; // Rayon pour les cercles produits
        const textRadius = 430; // Rayon pour les textes des produits

        // Calculer le nombre total de produits pour répartir l'espace proportionnellement
        const totalProducts = processusWithProducts.reduce((sum, proc) => {
            return sum + (produitsParProcessus[proc] || []).length;
        }, 0);

        let svgParts = [];
        svgParts.push(`<svg viewBox="0 0 1000 1000" class="carrousel-svg">`);

        let currentAngle = -Math.PI / 2; // Commencer en haut

        // Générer les arcs de processus (cercle intérieur)
        processusWithProducts.forEach((processus, index) => {
            const produits = produitsParProcessus[processus] || [];
            const productCount = produits.length;

            // L'angle est proportionnel au nombre de produits
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
            if (textAngle > 90 && textAngle < 270) {
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
                const productAngle = startAngle + anglePerProduct * (pIndex + 1);
                const productX = cx + productRadius * Math.cos(productAngle);
                const productY = cy + productRadius * Math.sin(productAngle);

                // Position du texte (plus loin)
                const textX = cx + textRadius * Math.cos(productAngle);
                const textY = cy + textRadius * Math.sin(productAngle);

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

                svgParts.push(`
                    <g class="carrousel-product" data-produit="${escapeHtml(produit['Nom'])}" data-row-index="${produit._rowIndex}" style="cursor: pointer;">
                        <!-- Ligne processus -> cercle produit -->
                        <line
                            x1="${cx + outerRadius * Math.cos(productAngle)}"
                            y1="${cy + outerRadius * Math.sin(productAngle)}"
                            x2="${productX}"
                            y2="${productY}"
                            stroke="${productCircleColor}"
                            stroke-width="1.5"
                            stroke-dasharray="3,3"
                            style="pointer-events: none; opacity: 0.6;"
                        />
                        <!-- Cercle du produit (gamme douce) -->
                        <circle
                            cx="${productX}"
                            cy="${productY}"
                            r="15"
                            fill="${productCircleColor}"
                            stroke="#ffffff"
                            stroke-width="2"
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
                            style="pointer-events: none; opacity: 0.5;"
                        />
                        <!-- Texte du produit (gamme intense) -->
                        <text
                            x="${textX}"
                            y="${textY}"
                            text-anchor="${textAnchor}"
                            dominant-baseline="middle"
                            class="carrousel-product-label"
                            style="font-size: 11px; font-weight: 600; fill: ${productTextColor}; pointer-events: none;"
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

        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

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
            group.addEventListener('click', async (e) => {
                const produitNom = group.dataset.produit;
                const rowIndex = parseInt(group.dataset.rowIndex);

                const produit = this.produits.find(p => p['Nom'] === produitNom && p._rowIndex === rowIndex);
                if (produit && typeof ProductModal !== 'undefined') {
                    await ProductModal.showEditModal(produit, rowIndex, async () => {
                        // Recharger les données et re-render
                        await this.loadData();
                        this.renderCarrousel();
                    });
                }
            });

            // Hover effect
            const circle = group.querySelector('circle');
            if (circle) {
                group.addEventListener('mouseenter', () => {
                    circle.setAttribute('r', '24');
                    circle.style.filter = 'brightness(1.1)';
                });
                group.addEventListener('mouseleave', () => {
                    circle.setAttribute('r', '20');
                    circle.style.filter = 'none';
                });
            }
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
