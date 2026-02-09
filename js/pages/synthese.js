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
            perimetres: [],
            processus: [],
            flux: [],
            shores: [],
            projetsDSS: [],
            dataflows: [],
            pdtProcess: []
        };

        this.filters = {
            perimetre: '',
            processus: '',
            sousProcessus: '',
            avancement: '',
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
                                    <option value="A venir">À venir</option>
                                    <option value="En cours">En cours</option>
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
            // Charger toutes les donnees necessaires
            const [chantiers, produits, mae, perimetres, processus, flux, shores, projetsDSS, dataflows, pdtProcess] = await Promise.all([
                readTable(CONFIG.TABLES.CHANTIER.name),
                readTable(CONFIG.TABLES.PRODUITS.name),
                readTable(CONFIG.TABLES.MAE.name),
                readTable(CONFIG.TABLES.PERIMETRES.name),
                readTable(CONFIG.TABLES.PROCESSUS.name),
                readTable(CONFIG.TABLES.FLUX.name),
                readTable(CONFIG.TABLES.SHORES.name),
                readTable(CONFIG.TABLES.PROJETS_DSS.name),
                readTable(CONFIG.TABLES.DATAFLOWS.name),
                readTable(CONFIG.TABLES.PDT_PROCESS.name)
            ]);

            this.data.chantiers = chantiers.filter(c => c.Archive !== 'Oui' && c.Archive !== true);
            this.data.produits = produits;
            this.data.mae = mae;
            this.data.perimetres = perimetres;
            this.data.processus = processus;
            this.data.flux = flux;
            this.data.shores = shores;
            this.data.projetsDSS = projetsDSS;
            this.data.dataflows = dataflows;
            this.data.pdtProcess = pdtProcess;
        } catch (error) {
            console.error('Erreur chargement donnees synthese:', error);
            showError('Erreur lors du chargement des données');
        }
    }

    populateFilters() {
        // Remplir le filtre Perimetre
        const perimetreSelect = document.getElementById('filterPerimetre');
        const perimetresUniques = [...new Set(this.data.perimetres.map(p => p['Périmètre']))].filter(Boolean).sort();
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

            // Filtre Processus/Sous-processus via tPdtProcess
            if (this.filters.processus || this.filters.sousProcessus) {
                const pdtProcessEntries = this.data.pdtProcess.filter(pp => pp.Produit === produit.Produit);

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
                <td>${chantier['Date fin'] ? formatDate(chantier['Date fin']) : ''}</td>
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
                <tr class="clickable-row" data-produit="${escapeHtml(produit.Produit || '')}">
                    <td>${escapeHtml(produit.Produit || '')}</td>
                    <td>${escapeHtml(produit['Type de Produit'] || '')}</td>
                    <td>${statusIcon}</td>
                    <td>
                        <button class="btn-lineage btn-secondary btn-sm" data-produit="${escapeHtml(produit.Produit || '')}"
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
                const produit = this.data.produits.find(p => p.Produit === produitName);
                if (produit) {
                    this.showProductDetails(produit);
                }
            });
        });

        // Event listeners pour bouton Lineage
        tbody.querySelectorAll('.btn-lineage').forEach(btn => {
            btn.addEventListener('click', () => {
                const produitName = btn.dataset.produit;
                const produit = this.data.produits.find(p => p.Produit === produitName);
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

        const produitMigre = produit['Migré (Oui, Non, En cours)'];
        if (produitMigre && (produitMigre.toLowerCase() === 'oui' || produitMigre.toLowerCase() === 'migré' || produitMigre.toLowerCase() === 'terminé')) {
            return 'migrated';
        }

        // Verifier shore/gold
        const shoreActuel = produit['Gold / Shore actuel'];
        const shore = this.data.shores.find(s => s.Nom === shoreActuel);
        const shoreMigre = shore && shore['Migré Tech'] && shore['Migré Tech'].toLowerCase() === 'oui';

        // Verifier les flux associes
        const flux = this.data.flux.filter(f => f.Produit === produit.Produit);
        const hasMigratedFlux = flux.some(f => {
            const projetMigre = this.data.projetsDSS.find(p => p['Nom Projet DSS'] === f['Projet DSS'])?.['Migré (Oui, Non, En cours)'];
            const dataflowMigre = this.data.dataflows.find(d => d.Dataflow === f.Dataflow)?.['Migré (Oui, Non, En cours)'];
            return projetMigre && projetMigre.toLowerCase() === 'oui' && dataflowMigre && dataflowMigre.toLowerCase() === 'oui';
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
            const jiraUrl = cleJira ? `https://jira.malakoffhumanis.com/browse/${cleJira}` : '#';
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
        const responsable = formatActorName(produit.Responsable);
        const backup = formatActorName(produit.Backup);
        const status = this.getProductMigrationStatus(produit);
        const statusText = status === 'migrated' ? 'Migré' : status === 'partial' ? 'Partiellement migré' : 'Non migré';
        const statusClass = status === 'migrated' ? 'status-green' : status === 'partial' ? 'status-orange' : 'status-red';

        const content = `
            <div class="product-details">
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${escapeHtml(produit['Type de Produit'] || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Périmètre:</span>
                        <span class="detail-value">${escapeHtml(produit['Perimétre fonctionnel'] || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Responsable:</span>
                        <span class="detail-value">${escapeHtml(responsable || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Backup:</span>
                        <span class="detail-value">${escapeHtml(backup || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Gold/Shore:</span>
                        <span class="detail-value">${escapeHtml(produit['Gold / Shore actuel'] || '-')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Statut migration:</span>
                        <span class="detail-value">
                            <span class="status-circle ${statusClass}"></span>
                            ${escapeHtml(statusText)}
                        </span>
                    </div>
                </div>
            </div>
        `;

        openModal(`Produit : ${escapeHtml(produit.Produit || '')}`, content, {
            size: 'md',
            buttons: [
                { label: 'Fermer', class: 'btn-secondary', action: 'close' }
            ]
        });
    }

    showLineageModal(produit) {
        const fluxProduits = this.data.flux.filter(f => f.Produit === produit.Produit);

        if (fluxProduits.length === 0) {
            openModal(`Lineage : ${escapeHtml(produit.Produit || '')}`,
                '<p class="empty-state">Aucun flux de migration défini pour ce produit.</p>',
                { size: 'md', buttons: [{ label: 'Fermer', class: 'btn-secondary', action: 'close' }] }
            );
            return;
        }

        let content = '<div class="lineage-content"><table class="synthese-table"><thead><tr>';
        content += '<th>Shore/Gold</th><th>Projet DSS</th><th>Dataflow</th><th>Sprint</th>';
        content += '</tr></thead><tbody>';

        fluxProduits.forEach(flux => {
            const shore = this.data.shores.find(s => s.Nom === flux['Shore / Gold']);
            const projet = this.data.projetsDSS.find(p => p['Nom Projet DSS'] === flux['Projet DSS']);
            const dataflow = this.data.dataflows.find(d => d.Dataflow === flux.Dataflow);

            const shoreStatus = shore?.['Migré Tech'] || '';
            const projetStatus = projet?.['Migré (Oui, Non, En cours)'] || '';
            const dataflowStatus = dataflow?.['Migré (Oui, Non, En cours)'] || '';

            const shoreClass = shoreStatus.toLowerCase() === 'oui' ? 'status-green' : 'status-red';
            const projetClass = projetStatus.toLowerCase() === 'oui' ? 'status-green' : 'status-red';
            const dataflowClass = dataflowStatus.toLowerCase() === 'oui' ? 'status-green' : 'status-red';

            content += `<tr>
                <td><span class="status-circle ${shoreClass}"></span> ${escapeHtml(flux['Shore / Gold'] || '-')}</td>
                <td><span class="status-circle ${projetClass}"></span> ${escapeHtml(flux['Projet DSS'] || '-')}</td>
                <td><span class="status-circle ${dataflowClass}"></span> ${escapeHtml(flux.Dataflow || '-')}</td>
                <td>${escapeHtml(flux.Sprint || '-')}</td>
            </tr>`;
        });

        content += '</tbody></table></div>';

        openModal(`Lineage : ${escapeHtml(produit.Produit || '')}`, content, {
            size: 'xl',
            buttons: [{ label: 'Fermer', class: 'btn-secondary', action: 'close' }]
        });
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
