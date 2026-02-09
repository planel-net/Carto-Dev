/* ===========================================
   SYNTHESE.JS - Vue de synthese unifiee
   Application Carto
   =========================================== */

class SynthesePage {
    constructor() {
        this.data = {
            chantiers: [],
            produits: [],
            mae: [],
            acteurs: [],
            perimetres: [],
            processus: [],
            flux: [],
            shores: [],
            projetsDSS: [],
            dataflows: [],
            pdtProcess: [],
            tablesMh: []
        };

        this.filters = {
            perimetre: '',
            processus: '',
            sousProcessus: '',
            avancement: '',
            responsable: '',
            etat: ''
        };
    }

    async render(container) {
        await this.loadData();

        container.innerHTML = `
            <div class="page-synthese">
                <div class="page-header">
                    <h1>Synthèse</h1>
                </div>

                <!-- Filtres globaux -->
                <div class="synthese-filters-global">
                    <div class="filter-group">
                        <label>Périmètre</label>
                        <select id="filterPerimetre" class="filter-select">
                            <option value="">Tous les périmètres</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Processus</label>
                        <select id="filterProcessus" class="filter-select">
                            <option value="">Tous les processus</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Sous-processus</label>
                        <select id="filterSousProcessus" class="filter-select" disabled>
                            <option value="">Tous les sous-processus</option>
                        </select>
                    </div>
                </div>

                <!-- Trois colonnes -->
                <div class="synthese-columns">
                    <!-- Colonne Chantiers -->
                    <div class="synthese-column">
                        <div class="column-header">
                            <h2>Chantiers</h2>
                            <div class="filter-group">
                                <label>Avancement</label>
                                <select id="filterAvancement" class="filter-select">
                                    <option value="">Tous</option>
                                    <option value="Non démarré">Non démarré</option>
                                    <option value="En cadrage">En cadrage</option>
                                    <option value="Cadré">Cadré</option>
                                    <option value="En développement">En développement</option>
                                    <option value="Développé">Développé</option>
                                    <option value="En recette">En recette</option>
                                    <option value="Recetté">Recetté</option>
                                    <option value="Terminé">Terminé</option>
                                </select>
                            </div>
                        </div>
                        <div class="column-count" id="chantiersCount">0 chantier(s)</div>
                        <div class="column-content">
                            <table class="synthese-table" id="chantiersTable">
                                <thead>
                                    <tr>
                                        <th>Num</th>
                                        <th>Nom</th>
                                        <th>Date fin</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Colonne Produits -->
                    <div class="synthese-column">
                        <div class="column-header">
                            <h2>Produits</h2>
                            <div class="filter-group">
                                <label>Responsable</label>
                                <select id="filterResponsable" class="filter-select">
                                    <option value="">Tous</option>
                                </select>
                            </div>
                        </div>
                        <div class="column-count" id="produitsCount">0 produit(s)</div>
                        <div class="column-content">
                            <table class="synthese-table" id="produitsTable">
                                <thead>
                                    <tr>
                                        <th>Nom</th>
                                        <th>Type</th>
                                        <th>Statut</th>
                                        <th>Lineage</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Colonne MAE -->
                    <div class="synthese-column">
                        <div class="column-header">
                            <h2>MAE</h2>
                            <div class="filter-group">
                                <label>État</label>
                                <select id="filterEtat" class="filter-select">
                                    <option value="">Tous</option>
                                    <option value="En attente">En attente</option>
                                    <option value="En cours">En cours</option>
                                    <option value="Terminée">Terminée</option>
                                    <option value="Annulée">Annulée</option>
                                </select>
                            </div>
                        </div>
                        <div class="column-count" id="maeCount">0 demande(s)</div>
                        <div class="column-content">
                            <table class="synthese-table" id="maeTable">
                                <thead>
                                    <tr>
                                        <th>Clé</th>
                                        <th>Résumé</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.populateFilters();
        this.attachEvents();
        this.applyFiltersAndRender();
    }

    async loadData() {
        try {
            console.log('[Synthese] Chargement des données...');

            // Charger les tables une par une pour identifier les erreurs
            console.log('[Synthese] Chargement chantiers...');
            const chantiers = await readTable(CONFIG.TABLES.CHANTIER.name);

            console.log('[Synthese] Chargement produits...');
            const produits = await readTable(CONFIG.TABLES.PRODUITS.name);

            console.log('[Synthese] Chargement mae...');
            const mae = await readTable(CONFIG.TABLES.MAE.name);

            console.log('[Synthese] Chargement acteurs...');
            const acteurs = await readTable(CONFIG.TABLES.ACTEURS.name);

            console.log('[Synthese] Chargement perimetres...');
            const perimetres = await readTable(CONFIG.TABLES.PERIMETRES.name);

            console.log('[Synthese] Chargement processus...');
            const processus = await readTable(CONFIG.TABLES.PROCESSUS.name);

            console.log('[Synthese] Chargement flux...');
            const flux = await readTable(CONFIG.TABLES.FLUX.name);

            console.log('[Synthese] Chargement shores...');
            const shores = await readTable(CONFIG.TABLES.SHORES.name);

            console.log('[Synthese] Chargement projetsDSS...');
            const projetsDSS = await readTable(CONFIG.TABLES.PROJETS_DSS.name);

            console.log('[Synthese] Chargement dataflows...');
            const dataflows = await readTable(CONFIG.TABLES.DATAFLOWS.name);

            console.log('[Synthese] Chargement pdtProcess...');
            const pdtProcess = await readTable(CONFIG.TABLES.PDT_PROCESS.name);

            console.log('[Synthese] Chargement tablesMh...');
            const tablesMh = await readTable(CONFIG.TABLES.TABLES_MH.name);

            console.log('[Synthese] Toutes les données chargées avec succès');

            // Extraire les tableaux depuis les résultats (format {data: [...], ...})
            const chantiersArray = chantiers.data || chantiers || [];
            const produitsArray = produits.data || produits || [];
            const maeArray = mae.data || mae || [];
            const acteursArray = acteurs.data || acteurs || [];
            const perimetresArray = perimetres.data || perimetres || [];
            const processusArray = processus.data || processus || [];
            const fluxArray = flux.data || flux || [];
            const shoresArray = shores.data || shores || [];
            const projetsDSSArray = projetsDSS.data || projetsDSS || [];
            const dataflowsArray = dataflows.data || dataflows || [];
            const pdtProcessArray = pdtProcess.data || pdtProcess || [];
            const tablesMhArray = tablesMh.data || tablesMh || [];

            this.data.chantiers = chantiersArray.filter(c => c.Archivé !== 'Oui' && c.Archivé !== true);
            this.data.produits = produitsArray;
            this.data.mae = maeArray;
            this.data.acteurs = acteursArray;
            this.data.perimetres = perimetresArray;
            this.data.processus = processusArray;
            this.data.flux = fluxArray;
            this.data.shores = shoresArray;
            this.data.projetsDSS = projetsDSSArray;
            this.data.dataflows = dataflowsArray;
            this.data.pdtProcess = pdtProcessArray;
            this.data.tablesMh = tablesMhArray;
        } catch (error) {
            console.error('[Synthese] Erreur chargement donnees:', error);
            console.error('[Synthese] Stack:', error.stack);
            showError('Erreur lors du chargement des données: ' + error.message);
        }
    }

    populateFilters() {
        // Remplir le filtre Perimetre
        const perimetreSelect = document.getElementById('filterPerimetre');
        console.log('[Synthese] Perimetres data:', this.data.perimetres);
        const perimetresUniques = [...new Set(this.data.perimetres.map(p => p.Perimetre))].filter(Boolean).sort();
        console.log('[Synthese] Perimetres uniques:', perimetresUniques);
        perimetresUniques.forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            perimetreSelect.appendChild(option);
        });

        // Remplir le filtre Processus
        const processusSelect = document.getElementById('filterProcessus');
        const processusUniques = [...new Set(this.data.processus.map(p => p.Processus))].filter(Boolean).sort();
        processusUniques.forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            processusSelect.appendChild(option);
        });

        // Remplir le filtre Responsable
        const responsableSelect = document.getElementById('filterResponsable');
        const responsablesUniques = [...new Set(this.data.acteurs.map(a => a.Mail))].filter(Boolean).sort();
        responsablesUniques.forEach(mail => {
            const acteur = this.data.acteurs.find(a => a.Mail === mail);
            const option = document.createElement('option');
            option.value = mail;
            option.textContent = formatActorName(mail);
            responsableSelect.appendChild(option);
        });
    }

    attachEvents() {
        // Filtres globaux
        document.getElementById('filterPerimetre').addEventListener('change', () => {
            this.filters.perimetre = document.getElementById('filterPerimetre').value;
            this.applyFiltersAndRender();
        });

        document.getElementById('filterProcessus').addEventListener('change', () => {
            this.filters.processus = document.getElementById('filterProcessus').value;
            this.updateSousProcessusFilter();
            this.applyFiltersAndRender();
        });

        document.getElementById('filterSousProcessus').addEventListener('change', () => {
            this.filters.sousProcessus = document.getElementById('filterSousProcessus').value;
            this.applyFiltersAndRender();
        });

        // Filtres specifiques
        document.getElementById('filterAvancement').addEventListener('change', () => {
            this.filters.avancement = document.getElementById('filterAvancement').value;
            this.applyFiltersAndRender();
        });

        document.getElementById('filterResponsable').addEventListener('change', () => {
            this.filters.responsable = document.getElementById('filterResponsable').value;
            this.applyFiltersAndRender();
        });

        document.getElementById('filterEtat').addEventListener('change', () => {
            this.filters.etat = document.getElementById('filterEtat').value;
            this.applyFiltersAndRender();
        });
    }

    updateSousProcessusFilter() {
        const sousProcessusSelect = document.getElementById('filterSousProcessus');
        sousProcessusSelect.innerHTML = '<option value="">Tous les sous-processus</option>';

        if (this.filters.processus) {
            sousProcessusSelect.disabled = false;
            const sousProcessus = this.data.processus
                .filter(p => p.Processus === this.filters.processus)
                .map(p => p['Sous-processus'])
                .filter(Boolean);
            const sousProcessusUniques = [...new Set(sousProcessus)].sort();
            sousProcessusUniques.forEach(sp => {
                const option = document.createElement('option');
                option.value = sp;
                option.textContent = sp;
                sousProcessusSelect.appendChild(option);
            });
        } else {
            sousProcessusSelect.disabled = true;
        }
        this.filters.sousProcessus = '';
    }

    applyFiltersAndRender() {
        const chantiersFiltered = this.filterChantiers();
        const produitsFiltered = this.filterProduits();
        const maeFiltered = this.filterMAE();

        this.renderChantiers(chantiersFiltered);
        this.renderProduits(produitsFiltered);
        this.renderMAE(maeFiltered);
    }

    filterChantiers() {
        return this.data.chantiers.filter(chantier => {
            // Filtre Perimetre
            if (this.filters.perimetre && chantier.Perimetre !== this.filters.perimetre) {
                return false;
            }

            // Filtre Processus
            if (this.filters.processus && chantier.Processus !== this.filters.processus) {
                return false;
            }

            // Filtre Sous-processus
            if (this.filters.sousProcessus && chantier['Sous-processus'] !== this.filters.sousProcessus) {
                return false;
            }

            // Filtre Avancement
            if (this.filters.avancement && chantier.Avancement !== this.filters.avancement) {
                return false;
            }

            return true;
        });
    }

    filterProduits() {
        return this.data.produits.filter(produit => {
            // Filtre Perimetre
            if (this.filters.perimetre && produit['Perimétre fonctionnel'] !== this.filters.perimetre) {
                return false;
            }

            // Filtre Responsable
            if (this.filters.responsable && produit.Responsable !== this.filters.responsable) {
                return false;
            }

            // Filtre Processus/Sous-processus via tPdtProcess
            if (this.filters.processus || this.filters.sousProcessus) {
                const pdtProcessEntries = this.data.pdtProcess.filter(pp => pp.Produit === produit.Nom);

                if (pdtProcessEntries.length === 0) {
                    return false;
                }

                let matchesProcessus = !this.filters.processus;
                let matchesSousProcessus = !this.filters.sousProcessus;

                for (const entry of pdtProcessEntries) {
                    if (this.filters.processus && entry.Processus === this.filters.processus) {
                        matchesProcessus = true;
                    }
                    if (this.filters.sousProcessus && entry['Sous-processus'] === this.filters.sousProcessus) {
                        matchesSousProcessus = true;
                    }
                }

                if (!matchesProcessus || !matchesSousProcessus) {
                    return false;
                }
            }

            return true;
        });
    }

    filterMAE() {
        return this.data.mae.filter(mae => {
            // Filtre Etat
            if (this.filters.etat && mae.Etat !== this.filters.etat) {
                return false;
            }

            // Filtres globaux : on filtre via le chantier associe
            if (this.filters.perimetre || this.filters.processus || this.filters.sousProcessus) {
                const chantier = this.data.chantiers.find(c => c.Chantier === mae.Chantier);
                if (!chantier) return false;

                if (this.filters.perimetre && chantier.Perimetre !== this.filters.perimetre) {
                    return false;
                }
                if (this.filters.processus && chantier.Processus !== this.filters.processus) {
                    return false;
                }
                if (this.filters.sousProcessus && chantier['Sous-processus'] !== this.filters.sousProcessus) {
                    return false;
                }
            }

            return true;
        });
    }

    renderChantiers(chantiers) {
        const tbody = document.querySelector('#chantiersTable tbody');
        const countEl = document.getElementById('chantiersCount');

        countEl.textContent = `${chantiers.length} chantier(s)`;

        if (chantiers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Aucun chantier</td></tr>';
            return;
        }

        tbody.innerHTML = chantiers.map(chantier => `
            <tr class="clickable-row" data-chantier="${escapeHtml(chantier.Chantier || '')}">
                <td>${escapeHtml(chantier.NumChantier || '')}</td>
                <td>${escapeHtml(chantier.Chantier || '')}</td>
                <td>${chantier['Date fin souhaitée'] ? formatDate(chantier['Date fin souhaitée']) : ''}</td>
            </tr>
        `).join('');

        // Ajouter les event listeners pour ouvrir la popup chantier
        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', async () => {
                const chantierName = row.dataset.chantier;
                if (chantierName && typeof ChantierModal !== 'undefined') {
                    await ChantierModal.showEditModal(chantierName, async () => {
                        await this.loadData();
                        this.applyFiltersAndRender();
                    });
                }
            });
        });
    }

    renderProduits(produits) {
        const tbody = document.querySelector('#produitsTable tbody');
        const countEl = document.getElementById('produitsCount');

        countEl.textContent = `${produits.length} produit(s)`;

        if (produits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Aucun produit</td></tr>';
            return;
        }

        tbody.innerHTML = produits.map(produit => {
            const status = this.getProductMigrationStatus(produit);
            const statusClass = status === 'migrated' ? 'status-green' : status === 'partial' ? 'status-orange' : 'status-red';
            const statusIcon = `<span class="status-circle ${statusClass}"></span>`;

            return `
                <tr class="clickable-row" data-produit="${escapeHtml(produit.Nom || '')}">
                    <td>${escapeHtml(produit.Nom || '')}</td>
                    <td>${escapeHtml(produit['Type de rapport'] || '')}</td>
                    <td>${statusIcon}</td>
                    <td>
                        <button class="btn-lineage btn-secondary btn-sm" data-produit="${escapeHtml(produit.Nom || '')}"
                                onclick="event.stopPropagation()">
                            Lineage
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Event listeners pour clic sur ligne (ouvrir popup produit)
        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-lineage')) return;
                const produitName = row.dataset.produit;
                const produit = this.data.produits.find(p => p.Nom === produitName);
                if (produit) {
                    this.showProductDetails(produit);
                }
            });
        });

        // Event listeners pour bouton Lineage
        tbody.querySelectorAll('.btn-lineage').forEach(btn => {
            btn.addEventListener('click', () => {
                const produitName = btn.dataset.produit;
                const produit = this.data.produits.find(p => p.Nom === produitName);
                if (produit) {
                    this.showLineageModal(produit);
                }
            });
        });
    }

    getProductMigrationStatus(produit) {
        // Rouge si shore/gold, projet DSS, dataflow et produit non migrés
        // Orange si shore/gold migré mais pas les autres
        // Vert si produit migré

        const statutMigration = produit['Statut Migration'];
        if (statutMigration && (statutMigration.toLowerCase() === 'migré' || statutMigration.toLowerCase() === 'terminé')) {
            return 'migrated';
        }

        // Verifier shore/gold
        const shoreActuel = produit['Gold / Shore actuel'];
        const shore = this.data.shores.find(s => s.Nom === shoreActuel);
        const shoreMigre = shore && shore['Migré Tech'] && shore['Migré Tech'].toLowerCase() === 'oui';

        // Verifier les flux associes
        const flux = this.data.flux.filter(f => f.Produit === produit.Nom);
        const hasMigratedFlux = flux.some(f => {
            const projet = this.data.projetsDSS.find(p => p['Nom projet'] === f['Projet DSS']);
            const dataflow = this.data.dataflows.find(d => d.Nom === f['DFNom DF']);
            const projetMigre = projet?.['Statut migration'];
            const dataflowMigre = dataflow?.['Statut migration'];
            return projetMigre && projetMigre.toLowerCase() === 'migré' && dataflowMigre && dataflowMigre.toLowerCase() === 'migré';
        });

        if (shoreMigre && !hasMigratedFlux) {
            return 'partial';
        }

        return 'not-migrated';
    }

    renderMAE(mae) {
        const tbody = document.querySelector('#maeTable tbody');
        const countEl = document.getElementById('maeCount');

        countEl.textContent = `${mae.length} demande(s)`;

        if (mae.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" class="empty-state">Aucune demande</td></tr>';
            return;
        }

        tbody.innerHTML = mae.map(m => {
            const cleJira = escapeHtml(m['Clé'] || '');
            const jiraUrl = cleJira ? `https://malakoffhumanis.atlassian.net/browse/${cleJira}` : '#';
            const cleHtml = cleJira ? `<a href="${jiraUrl}" target="_blank" rel="noopener noreferrer">${cleJira}</a>` : '';

            return `
                <tr class="clickable-row" data-cle="${cleJira}">
                    <td>${cleHtml}</td>
                    <td>${escapeHtml(m['Résumé'] || '')}</td>
                </tr>
            `;
        }).join('');

        // Event listeners pour ouvrir la popup MAE
        tbody.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', async () => {
                const cleJira = row.dataset.cle;
                if (cleJira && typeof MAEModal !== 'undefined') {
                    await MAEModal.showEditModal(cleJira, async () => {
                        await this.loadData();
                        this.applyFiltersAndRender();
                    });
                }
            });
        });
    }

    showProductDetails(produit) {
        console.log('[Synthese] showProductDetails appelé avec:', produit);

        // Si l'instance de la page Parc existe, utiliser son formulaire
        if (typeof parcPageInstance !== 'undefined' && parcPageInstance && typeof parcPageInstance.showEditProductForm === 'function') {
            parcPageInstance.showEditProductForm(produit, produit._rowIndex);
        } else {
            // Fallback : afficher une modale simple
            const formHtml = generateFormHtml('formEditProduct', CONFIG.TABLES.PRODUITS.columns, produit || {});
            const formHtmlTwoCols = formHtml.replace('class="form"', 'class="form form-two-columns"');

            new Modal({
                title: `Modifier: ${escapeHtml(produit.Nom || '')}`,
                content: formHtmlTwoCols,
                size: 'xl',
                confirmText: 'Modifier',
                onConfirm: async () => {
                    try {
                        const form = document.getElementById('formEditProduct');
                        const formData = new FormData(form);
                        const updatedData = {};
                        for (const [key, value] of formData.entries()) {
                            updatedData[key] = value;
                        }
                        await updateTableRow(CONFIG.TABLES.PRODUITS.name, produit._rowIndex, updatedData);
                        showSuccess('Produit modifié avec succès');
                        await this.loadData();
                        this.applyFiltersAndRender();
                        return true;
                    } catch (error) {
                        showError('Erreur lors de la modification : ' + error.message);
                        return false;
                    }
                }
            }).show();
        }
    }

    /**
     * Trouve les tables MH associées à un shore
     */
    findTablesForShore(shoreName) {
        return this.data.tablesMh.filter(t => t['Shore/Gold'] === shoreName);
    }

    /**
     * Retourne la classe CSS selon le statut de migration
     */
    getStatusClass(statut) {
        if (!statut) return 'status-grey';
        const s = statut.toLowerCase();
        if (s === 'migré' || s === 'terminé' || s === 'oui') return 'status-green';
        if (s === 'en cours' || s === 'partiel') return 'status-orange';
        return 'status-red';
    }

    /**
     * Génère le HTML du graphique de lineage (EXACTEMENT comme dans migration.js)
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

        return { html, relations };
    }

    /**
     * Dessine les lignes de connexion du graphique de lineage
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

    showLineageModal(produit) {
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

        // Afficher la modale (utiliser showModal comme dans migration.js)
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

// Instance globale
let synthesePageInstance = null;

async function renderSynthesePage(container) {
    synthesePageInstance = new SynthesePage();
    await synthesePageInstance.render(container);
}

async function refreshSynthesePage() {
    if (synthesePageInstance) {
        const container = document.getElementById('mainContent');
        if (container) {
            await synthesePageInstance.render(container);
        }
    }
}
