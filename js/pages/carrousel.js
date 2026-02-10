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

        // Couleurs pastel de la charte MH (une par processus)
        this.processColors = [
            '#FFF2F0', // Corail pastel
            '#E0F1F8', // Bleu pastel
            '#EEE7F9', // Violet pastel
            '#DEF7F7', // Turquoise pastel
            '#FDF0F7', // Rose pastel
            '#F9F4B9', // Jaune pastel
            '#E1FBF6', // Vert pastel
            '#F9EFEB', // Rose chair pastel
            '#F9F7F6', // Gris sable pastel
            '#FAF7F3'  // Gris sable 20%
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
            grouped[processus].push(produit);
        });

        return grouped;
    }

    /**
     * Génère le SVG du carrousel
     */
    generateSVG(processusWithProducts, produitsParProcessus) {
        const cx = 500; // Centre X
        const cy = 500; // Centre Y
        const innerRadius = 150; // Rayon intérieur (processus)
        const outerRadius = 250; // Rayon extérieur (fin des arcs processus)
        const productRadius = 380; // Rayon pour les cercles produits

        const totalProcessus = processusWithProducts.length;
        const anglePerProcessus = (2 * Math.PI) / totalProcessus;

        let svgParts = [];
        svgParts.push(`<svg viewBox="0 0 1000 1000" class="carrousel-svg">`);

        // Générer les arcs de processus (cercle intérieur)
        processusWithProducts.forEach((processus, index) => {
            const startAngle = index * anglePerProcessus - Math.PI / 2; // -90° pour commencer en haut
            const endAngle = (index + 1) * anglePerProcessus - Math.PI / 2;
            const midAngle = (startAngle + endAngle) / 2;

            const color = this.processColors[index % this.processColors.length];

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

            // Texte du processus (au milieu de l'arc)
            const labelRadius = (innerRadius + outerRadius) / 2;
            const labelX = cx + labelRadius * Math.cos(midAngle);
            const labelY = cy + labelRadius * Math.sin(midAngle);

            // Calculer la rotation du texte pour qu'il suive l'arc
            const textAngle = (midAngle * 180 / Math.PI);

            svgParts.push(`
                <text
                    x="${labelX}"
                    y="${labelY}"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    transform="rotate(${textAngle}, ${labelX}, ${labelY})"
                    class="carrousel-process-label"
                    style="pointer-events: none; font-size: 14px; font-weight: 600; fill: var(--mh-bleu-fonce);"
                >
                    ${this.truncateText(processus, 12)}
                </text>
            `);

            // Générer les cercles des produits pour ce processus
            const produits = produitsParProcessus[processus] || [];
            const totalProduits = produits.length;

            // Calculer l'angle disponible pour ce processus
            const angleSpan = anglePerProcessus;
            const anglePerProduct = angleSpan / (totalProduits + 1);

            produits.forEach((produit, pIndex) => {
                const productAngle = startAngle + anglePerProduct * (pIndex + 1);
                const productX = cx + productRadius * Math.cos(productAngle);
                const productY = cy + productRadius * Math.sin(productAngle);

                // Cercle du produit (couleur du processus, plus soutenue)
                const productColor = this.darkenColor(color, 0.3);

                svgParts.push(`
                    <g class="carrousel-product" data-produit="${escapeHtml(produit['Nom'])}" data-row-index="${produit._rowIndex}" style="cursor: pointer;">
                        <circle
                            cx="${productX}"
                            cy="${productY}"
                            r="20"
                            fill="${productColor}"
                            stroke="#ffffff"
                            stroke-width="2"
                        />
                        <text
                            x="${productX}"
                            y="${productY + 35}"
                            text-anchor="middle"
                            class="carrousel-product-label"
                            style="font-size: 11px; fill: var(--mh-bleu-fonce); pointer-events: none;"
                        >
                            ${this.truncateText(produit['Nom'], 15)}
                        </text>
                        <line
                            x1="${cx + outerRadius * Math.cos(productAngle)}"
                            y1="${cy + outerRadius * Math.sin(productAngle)}"
                            x2="${productX}"
                            y2="${productY}"
                            stroke="${productColor}"
                            stroke-width="1.5"
                            stroke-dasharray="3,3"
                            style="pointer-events: none;"
                        />
                    </g>
                `);
            });
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
     * Assombrit une couleur hexadécimale
     */
    darkenColor(hex, factor) {
        // Convertir hex en RGB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        // Assombrir
        const newR = Math.round(r * (1 - factor));
        const newG = Math.round(g * (1 - factor));
        const newB = Math.round(b * (1 - factor));

        // Reconvertir en hex
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
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
