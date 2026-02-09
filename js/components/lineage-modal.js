/* ===========================================
   LINEAGE-MODAL.JS - Composant modal Lineage
   Application Carto
   =========================================== */

/**
 * Classe LineageModal pour afficher le lineage complet d'un produit
 */
class LineageModal {
    constructor(data) {
        // data doit contenir : flux, shores, projetsDSS, dataflows, tablesMh
        this.data = data;
    }

    /**
     * Normalise une chaîne pour comparaison (lowercase, sans underscores)
     */
    normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/_/g, '').replace(/\s+/g, '');
    }

    /**
     * Trouve les tables MH Tech associées à un Shore via la colonne UC
     */
    findTablesForShore(shoreName) {
        if (!shoreName || !this.data.tablesMh || !this.data.tablesMh.length) return [];
        const normalizedShoreName = this.normalizeString(shoreName);
        return this.data.tablesMh.filter(t => {
            const normalizedUC = this.normalizeString(t.UC);
            return normalizedUC === normalizedShoreName ||
                   normalizedShoreName.includes(normalizedUC) ||
                   normalizedUC.includes(normalizedShoreName);
        });
    }

    /**
     * Retourne la classe CSS selon le statut
     */
    getStatusClass(status) {
        if (!status) return 'status-non-migre';
        const s = status.toLowerCase();
        // Gérer les différents formats: "Terminé", "Migré", "Oui"
        if (s.includes('terminé') || s.includes('migré') || s === 'oui') return 'status-migre';
        if (s.includes('cours')) return 'status-en-cours';
        return 'status-non-migre';
    }

    /**
     * Génère le HTML du graphique de lineage pour un produit
     * @param {Object} produit - Le produit
     * @param {Array} fluxProduits - Les flux associés au produit
     * @param {string} idSuffix - Suffixe optionnel pour les IDs (utile pour éviter les doublons dans les modales)
     */
    renderLineageGraph(produit, fluxProduits, idSuffix = '') {
        // Collecter tous les éléments uniques pour chaque colonne
        const tablesSet = new Set();
        const shoresSet = new Set();
        const projetsDssSet = new Set();
        const dataflowsSet = new Set();

        // Mapper les relations pour dessiner les lignes
        const relations = [];

        // Track which shores have been connected to tables (pour n'avoir qu'une seule flèche)
        const shoresConnectedToTables = new Set();

        fluxProduits.forEach(fluxItem => {
            const shoreName = fluxItem['Shore/Gold'];
            const projetDssName = fluxItem['Projet DSS'];
            const dataflowName = fluxItem['DFNom DF'];

            if (shoreName) {
                shoresSet.add(shoreName);
                // Trouver les tables associées au shore
                const tablesAssociees = this.findTablesForShore(shoreName);
                tablesAssociees.forEach(t => {
                    tablesSet.add(t.Table);
                });
                // Ajouter UNE SEULE flèche de la première table vers le shore
                if (tablesAssociees.length > 0 && !shoresConnectedToTables.has(shoreName)) {
                    relations.push({ from: tablesAssociees[0].Table, fromType: 'table', to: shoreName, toType: 'shore' });
                    shoresConnectedToTables.add(shoreName);
                }
            }

            if (projetDssName) {
                projetsDssSet.add(projetDssName);
                if (shoreName) {
                    relations.push({ from: shoreName, fromType: 'shore', to: projetDssName, toType: 'dss' });
                }
            }

            if (dataflowName) {
                dataflowsSet.add(dataflowName);
                if (projetDssName) {
                    relations.push({ from: projetDssName, fromType: 'dss', to: dataflowName, toType: 'dataflow' });
                }
                relations.push({ from: dataflowName, fromType: 'dataflow', to: produit.Nom, toType: 'produit' });
            } else if (projetDssName) {
                relations.push({ from: projetDssName, fromType: 'dss', to: produit.Nom, toType: 'produit' });
            } else if (shoreName) {
                relations.push({ from: shoreName, fromType: 'shore', to: produit.Nom, toType: 'produit' });
            }
        });

        // Convertir en arrays
        const tables = Array.from(tablesSet);
        const shores = Array.from(shoresSet);
        const projetsDss = Array.from(projetsDssSet);
        const dataflows = Array.from(dataflowsSet);

        // Helper pour obtenir le statut d'un élément
        const getTableStatus = (name) => {
            const table = this.data.tablesMh.find(t => t.Table === name);
            return this.getStatusClass(table ? table['OK DA ?'] : null);
        };

        const getShoreStatus = (name) => {
            const shore = this.data.shores.find(s => s.Nom === name);
            return this.getStatusClass(shore ? shore['Migré Tech'] : null);
        };

        const getDssStatus = (name) => {
            const dss = this.data.projetsDSS.find(p => p['Nom projet'] === name);
            return this.getStatusClass(dss ? dss['Statut migration'] : null);
        };

        const getDataflowStatus = (name) => {
            const df = this.data.dataflows.find(d => d.Nom === name);
            return this.getStatusClass(df ? df['Statut migration'] : null);
        };

        // Générer le HTML du graphique
        let html = `
            <div class="lineage-graph-container">
                <div class="lineage-graph-header">
                    <div class="lineage-column-header">Tables</div>
                    <div class="lineage-column-header">Shores</div>
                    <div class="lineage-column-header">Projets DSS</div>
                    <div class="lineage-column-header">Dataflows</div>
                    <div class="lineage-column-header">Produit</div>
                </div>
                <div class="lineage-graph-body" id="lineageGraphBody${idSuffix}">
                    <svg class="lineage-connections" id="lineageConnections${idSuffix}"></svg>
                    <div class="lineage-column lineage-tables-column" id="lineageColTables">
                        ${tables.length > 0 ? tables.map(name => `
                            <div class="lineage-node ${getTableStatus(name)}" data-type="table" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-shores-column" id="lineageColShores">
                        ${shores.length > 0 ? shores.map(name => `
                            <div class="lineage-node ${getShoreStatus(name)}" data-type="shore" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-dss-column" id="lineageColDss">
                        ${projetsDss.length > 0 ? projetsDss.map(name => `
                            <div class="lineage-node ${getDssStatus(name)}" data-type="dss" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-dataflows-column" id="lineageColDataflows">
                        ${dataflows.length > 0 ? dataflows.map(name => `
                            <div class="lineage-node ${getDataflowStatus(name)}" data-type="dataflow" data-name="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>
                        `).join('') : '<div class="lineage-empty">-</div>'}
                    </div>
                    <div class="lineage-column lineage-produit-column" id="lineageColProduit">
                        <div class="lineage-node ${this.getStatusClass(produit['Statut Migration'])}" data-type="produit" data-name="${escapeHtml(produit.Nom)}">
                            ${escapeHtml(produit.Nom)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Retourner le HTML et les relations pour dessiner les lignes plus tard
        return { html, relations };
    }

    /**
     * Dessine les lignes de connexion du graphique de lineage
     * @param {Array} relations - Les relations à dessiner
     * @param {number} delay - Délai en ms avant de dessiner (défaut: 100ms, utiliser 400ms pour les modales)
     * @param {string} idSuffix - Suffixe des IDs (pour différencier inline vs modale)
     */
    drawLineageConnections(relations, delay = 100, idSuffix = '') {
        setTimeout(() => {
            const svg = document.getElementById('lineageConnections' + idSuffix);
            const body = document.getElementById('lineageGraphBody' + idSuffix);
            if (!svg || !body) return;

            // Calculer la taille du SVG
            svg.setAttribute('width', body.scrollWidth);
            svg.setAttribute('height', body.scrollHeight);

            // Créer les lignes
            let pathsHtml = '';
            const drawnConnections = new Set();

            relations.forEach(rel => {
                const connectionKey = `${rel.from}-${rel.to}`;
                if (drawnConnections.has(connectionKey)) return;
                drawnConnections.add(connectionKey);

                const fromNode = body.querySelector(`[data-type="${rel.fromType}"][data-name="${CSS.escape(rel.from)}"]`);
                const toNode = body.querySelector(`[data-type="${rel.toType}"][data-name="${CSS.escape(rel.to)}"]`);

                if (fromNode && toNode) {
                    const fromRect = fromNode.getBoundingClientRect();
                    const toRect = toNode.getBoundingClientRect();
                    const bodyRect = body.getBoundingClientRect();

                    const x1 = fromRect.right - bodyRect.left;
                    const y1 = fromRect.top + fromRect.height / 2 - bodyRect.top;
                    const x2 = toRect.left - bodyRect.left;
                    const y2 = toRect.top + toRect.height / 2 - bodyRect.top;

                    // Courbe de Bézier pour un effet plus agréable
                    const midX = (x1 + x2) / 2;
                    pathsHtml += `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" class="lineage-connection-line" />`;
                }
            });

            svg.innerHTML = pathsHtml;
        }, delay);
    }

    /**
     * Affiche la modale de lineage pour un produit
     * @param {Object} produit - Le produit à afficher
     */
    show(produit) {
        // Trouver tous les flux correspondant au produit
        const fluxProduits = this.data.flux.filter(f => f.Produit === produit.Nom);

        let content;
        let relations = [];

        if (fluxProduits.length === 0) {
            content = `
                <div class="lineage-popup-content">
                    <p class="text-muted">Aucun flux de migration défini pour ce produit.</p>
                </div>
            `;
        } else {
            // Générer le graphique visuel de lineage avec suffixe unique pour la modale
            const lineageGraph = this.renderLineageGraph(produit, fluxProduits, '_modal');
            relations = lineageGraph.relations;

            content = `
                <div class="lineage-popup-content">
                    ${lineageGraph.html}
                </div>
            `;
        }

        // Afficher la modale
        showModal({
            title: `Lineage : ${produit.Nom}`,
            content: content,
            size: 'xl',
            buttons: [
                { label: 'Fermer', class: 'btn-secondary', action: 'close' }
            ]
        });

        // Dessiner les lignes de connexion après que le DOM soit prêt (délai plus long pour la modale)
        if (relations.length > 0) {
            this.drawLineageConnections(relations, 400, '_modal');
        }
    }
}
