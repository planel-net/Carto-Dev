/* ===========================================
   ROADMAP.JS - Page Roadmap et Capacité
   Application Carto
   =========================================== */

/**
 * Classe RoadmapPage pour gérer la page roadmap
 */
class RoadmapPage {
    constructor() {
        this.backlog = [];
        this.sprints = [];
        this.capacite = [];
        this.acteurs = [];
        this.months = [];
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Roadmap & Capacité</h1>
                    <p>Planification et gestion de la charge capacitaire</p>
                </div>
            </div>

            <!-- KPIs Capacité -->
            <section class="section">
                <div class="kpi-grid" id="capacityKpis">
                    <div id="kpi-capacity-total"></div>
                    <div id="kpi-charge-total"></div>
                    <div id="kpi-disponible"></div>
                    <div id="kpi-projets"></div>
                </div>
            </section>

            <!-- Graphique Capacité vs Charge -->
            <section class="section">
                <div class="chart-container">
                    <div class="chart-header">
                        <h4 class="chart-title">Capacité vs Charge par Sprint</h4>
                        <div class="chart-actions">
                            <span style="font-size: 12px; color: var(--mh-gris-moyen);">
                                Coefficient de sécurité: x${CONFIG.COEF_SECURITE}
                            </span>
                        </div>
                    </div>
                    <div class="chart-body" id="chartCapacity" style="min-height: 250px;"></div>
                </div>
            </section>

            <!-- Planning Gantt -->
            <section class="section">
                <div class="card">
                    <div class="card-header">
                        <h4>Planning des projets</h4>
                    </div>
                    <div class="card-body" style="overflow-x: auto;">
                        <div id="ganttChart"></div>
                    </div>
                </div>
            </section>

            <!-- Backlog -->
            <section class="section">
                <div class="section-header">
                    <h3 class="section-title">Backlog Projets</h3>
                </div>
                <div id="tableBacklog"></div>
            </section>
        `;

        await this.loadData();
    }

    /**
     * Charge les données
     */
    async loadData() {
        try {
            const [backlogData, sprintsData, capaciteData, acteursData, fluxData] = await Promise.all([
                readTable('tBacklog'),
                readTable('tSprints'),
                this.loadCapacite(),
                readTable('tActeurs'),
                readTable('tFlux')
            ]);

            this.backlog = backlogData.data;
            this.sprints = sprintsData.data;
            this.acteurs = acteursData.data;
            this.flux = fluxData.data;

            // Générer les mois pour les graphiques
            this.generateMonths();

            // Calculer les données de capacité
            this.calculateCapacityData();

            // Rendre les composants
            this.renderKpis();
            this.renderCapacityChart();
            this.renderGantt();
            this.renderBacklogTable();

        } catch (error) {
            console.error('Erreur chargement données roadmap:', error);
            showError('Erreur lors du chargement des données');
        }
    }

    /**
     * Charge les données de capacité (crée la table si nécessaire)
     */
    async loadCapacite() {
        try {
            const exists = await tableExists('tCapacite');
            if (exists) {
                return await readTable('tCapacite');
            }
        } catch (error) {
            console.log('Table tCapacite non trouvée, utilisation des valeurs par défaut');
        }

        // Retourner des données vides, on utilisera les valeurs par défaut
        return { data: [], headers: [], rows: [] };
    }

    /**
     * Génère la liste des mois/sprints
     */
    generateMonths() {
        // Utiliser les sprints s'ils existent
        if (this.sprints.length > 0) {
            this.months = this.sprints.map(s => s.Sprint).slice(0, 12);
        } else {
            // Générer des mois par défaut
            const now = new Date();
            this.months = [];
            for (let i = 0; i < 12; i++) {
                const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
                this.months.push(date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
            }
        }
    }

    /**
     * Calcule les données de capacité par sprint
     */
    calculateCapacityData() {
        const nbActeurs = this.acteurs.length || 5;

        // Capacité par sprint (nombre d'acteurs * capacité par défaut)
        this.capacityBySprint = this.months.map(month => {
            // Chercher si une capacité spécifique est définie
            const capaciteDefinie = this.capacite.filter(c => c.Sprint === month);
            if (capaciteDefinie.length > 0) {
                return capaciteDefinie.reduce((sum, c) => sum + (parseFloat(c.Capacité) || 0), 0);
            }
            // Sinon utiliser la valeur par défaut
            return nbActeurs * CONFIG.CAPACITE_DEFAUT;
        });

        // Charge par sprint (depuis les flux et backlog)
        this.chargeBySprint = this.months.map(month => {
            // Charge depuis les flux
            const chargeFlux = this.flux
                .filter(f => f.Sprint === month)
                .reduce((sum, f) => sum + (parseFloat(f['Charge (jh)']) || 0), 0);

            // Multiplier par le coefficient de sécurité
            return chargeFlux * CONFIG.COEF_SECURITE;
        });

        // Totaux
        this.totalCapacity = this.capacityBySprint.reduce((a, b) => a + b, 0);
        this.totalCharge = this.chargeBySprint.reduce((a, b) => a + b, 0);
        this.disponible = this.totalCapacity - this.totalCharge;
    }

    /**
     * Rendu des KPIs
     */
    renderKpis() {
        createKpiCard('kpi-capacity-total', {
            value: formatNumber(this.totalCapacity),
            label: 'Capacité totale',
            icon: '&#128200;',
            type: 'primary',
            unit: ' j/h'
        });

        createKpiCard('kpi-charge-total', {
            value: formatNumber(this.totalCharge),
            label: 'Charge planifiée',
            icon: '&#128203;',
            type: 'orange',
            unit: ' j/h'
        });

        const dispType = this.disponible >= 0 ? 'success' : 'danger';
        createKpiCard('kpi-disponible', {
            value: formatNumber(Math.abs(this.disponible)),
            label: this.disponible >= 0 ? 'Disponible' : 'Surcharge',
            icon: this.disponible >= 0 ? '&#10003;' : '&#9888;',
            type: dispType,
            unit: ' j/h'
        });

        createKpiCard('kpi-projets', {
            value: this.backlog.length,
            label: 'Projets en backlog',
            icon: '&#128203;',
            type: 'primary'
        });
    }

    /**
     * Rendu du graphique de capacité
     */
    renderCapacityChart() {
        createCapacityChart('chartCapacity', {
            months: this.months,
            capacity: this.capacityBySprint,
            charge: this.chargeBySprint
        });
    }

    /**
     * Rendu du Gantt
     */
    renderGantt() {
        // Préparer les données pour le Gantt
        const projects = this.flux
            .filter(f => f.Produit && f.Sprint)
            .slice(0, 15) // Limiter pour la lisibilité
            .map(f => {
                const sprintIndex = this.months.indexOf(f.Sprint);
                return {
                    name: f.Produit,
                    startMonth: sprintIndex >= 0 ? sprintIndex : 0,
                    duration: 1, // Par défaut 1 sprint
                    charge: f['Charge (jh)'],
                    status: this.getProjectStatus(f)
                };
            });

        if (projects.length === 0) {
            document.getElementById('ganttChart').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#128197;</div>
                    <div class="empty-state-title">Aucun projet planifié</div>
                    <p>Ajoutez des éléments dans la table Flux avec des sprints pour les voir ici.</p>
                </div>
            `;
            return;
        }

        createGanttChart('ganttChart', {
            projects,
            months: this.months
        });
    }

    /**
     * Détermine le statut d'un projet
     */
    getProjectStatus(flux) {
        // Logique simple basée sur les commentaires ou dates
        if (flux.Commentaire?.toLowerCase().includes('bloqué')) return 'blocked';
        if (flux.Commentaire?.toLowerCase().includes('terminé')) return 'completed';
        return 'pending';
    }

    /**
     * Rendu du tableau backlog
     */
    renderBacklogTable() {
        const container = document.getElementById('tableBacklog');
        if (!container) return;

        new DataTable(container, {
            tableName: 'tBacklog',
            tableConfig: CONFIG.TABLES.BACKLOG,
            columns: CONFIG.TABLES.BACKLOG.columns,
            showToolbar: true,
            showPagination: true,
            editable: true
        });
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        invalidateCache('tBacklog');
        invalidateCache('tSprints');
        invalidateCache('tFlux');
        await this.loadData();
    }
}

// Instance globale
let roadmapPageInstance = null;

/**
 * Rendu de la page Roadmap
 */
async function renderRoadmapPage(container) {
    roadmapPageInstance = new RoadmapPage();
    await roadmapPageInstance.render(container);
}

/**
 * Rafraîchit la page Roadmap
 */
async function refreshRoadmapPage() {
    if (roadmapPageInstance) {
        await roadmapPageInstance.refresh();
    }
}
