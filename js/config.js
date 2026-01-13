/* ===========================================
   CONFIG.JS - Configuration centralisée
   Application Carto
   =========================================== */

const CONFIG = {
    // Nom de l'application
    APP_NAME: 'Carto',
    APP_VERSION: '1.0.16',

    // Noms des feuilles spéciales
    SHEETS: {
        HOME: 'Intro',
        PASSWORD: 'mdp'
    },

    // Cellule contenant le mot de passe
    PASSWORD_CELL: 'B2',

    // Configuration des tables Excel
    TABLES: {
        ACTEURS: {
            name: 'tActeurs',
            sheet: 'Acteurs',
            displayName: 'Acteurs',
            icon: '&#128100;',
            columns: [
                { field: 'Prénom', label: 'Prénom', type: 'text', required: true },
                { field: 'Nom', label: 'Nom', type: 'text', required: true },
                { field: 'Mail', label: 'Email', type: 'email', required: true },
                { field: 'Equipe', label: 'Équipe', type: 'select', source: 'EQUIPES', sourceField: 'Equipe', required: true }
            ]
        },
        EQUIPES: {
            name: 'tEquipe',
            sheet: 'Acteurs',
            displayName: 'Équipes',
            icon: '&#128101;',
            columns: [
                { field: 'Equipe', label: 'Équipe', type: 'text', required: true }
            ]
        },
        SHORES: {
            name: 'tShores',
            sheet: 'Shore',
            displayName: 'Shores / Golds',
            icon: '&#128451;',
            columns: [
                { field: 'Nom', label: 'Nom', type: 'text', required: true },
                { field: 'Nom_pour_tables', label: 'Nom pour tables', type: 'text' },
                { field: 'Migré Tech', label: 'Migré Tech', type: 'select', options: ['Oui', 'Non', 'En cours'] }
            ]
        },
        PROJETS_DSS: {
            name: 'tProjetsDSS',
            sheet: 'ProjetsDSS',
            displayName: 'Projets DSS',
            icon: '&#128194;',
            columns: [
                { field: 'Nom projet', label: 'Nom du projet', type: 'text', required: true },
                { field: 'Statut migration', label: 'Statut migration', type: 'select', options: ['Migré', 'En cours', 'Non migré', 'Bloqué'] },
                { field: 'Responsable', label: 'Responsable', type: 'select', source: 'ACTEURS', sourceField: 'Mail' }
            ]
        },
        DATAFLOWS: {
            name: 'tDataflows',
            sheet: 'Dataflows',
            displayName: 'Dataflows',
            icon: '&#128260;',
            columns: [
                { field: 'Nom', label: 'Nom', type: 'text', required: true },
                { field: 'Statut migration', label: 'Statut migration', type: 'select', options: ['Migré', 'En cours', 'Non migré', 'Bloqué'] },
                { field: 'Responsable', label: 'Responsable', type: 'select', source: 'ACTEURS', sourceField: 'Mail' }
            ]
        },
        PRODUITS: {
            name: 'tProduits',
            sheet: 'Produits',
            displayName: 'Produits / Rapports',
            icon: '&#128202;',
            columns: [
                { field: 'Nom', label: 'Nom', type: 'text', required: true },
                { field: 'Statut Migration', label: 'Statut migration', type: 'select', options: ['Terminé', 'En cours', 'Non démarré', 'Bloqué', 'Migré', 'Non migré', ''] },
                { field: 'Responsable', label: 'Responsable', type: 'select', source: 'ACTEURS', sourceField: 'Mail' },
                { field: 'Backup', label: 'Backup', type: 'select', source: 'ACTEURS', sourceField: 'Mail' },
                { field: 'Type de rapport', label: 'Type de rapport', type: 'text' },
                { field: 'Perimétre fonctionnel', label: 'Périmètre fonctionnel', type: 'select', source: 'PERIMETRES', sourceField: 'Périmetre' },
                { field: 'Périmétre des données (SI)', label: 'Périmètre données (SI)', type: 'text' },
                { field: 'PBI', label: 'PBI / PowerApp', type: 'select', options: ['Power BI', 'PowerApp', 'PBI', 'Autre', ''] },
                { field: 'Shore/Gold', label: 'Shore/Gold actuel', type: 'select', source: 'SHORES', sourceField: 'Nom' },
                { field: 'Shore cible DOCC', label: 'Shore cible DOCC', type: 'text' },
                { field: 'Shore vision MH Tech', label: 'Shore vision MH Tech', type: 'select', source: 'SHORES', sourceField: 'Nom' },
                { field: 'Pb de données', label: 'Problème de données', type: 'text' },
                { field: 'Extraction PBI possible / oui', label: 'Extraction PBI possible', type: 'select', options: ['Oui', 'Non'] },
                { field: 'Enjeux', label: 'Enjeux', type: 'textarea' },
                { field: 'Statut', label: 'Statut', type: 'select', options: ['Run', 'Evolution', 'Backlog', ''] }
            ]
        },
        PROCESSUS: {
            name: 'tProcessus',
            sheet: 'Processus',
            displayName: 'Processus',
            icon: '&#128736;',
            columns: [
                { field: 'Processus', label: 'Processus', type: 'text', required: true },
                { field: 'Sous-processus', label: 'Sous-processus', type: 'text' }
            ]
        },
        PDT_PROCESS: {
            name: 'tPdtProcess',
            sheet: 'ProcessusProduits',
            displayName: 'Produits-Processus',
            icon: '&#128279;',
            columns: [
                { field: 'Produit', label: 'Produit', type: 'select', source: 'PRODUITS', sourceField: 'Nom', required: true },
                { field: 'Processus', label: 'Processus', type: 'select', source: 'PROCESSUS', sourceField: 'Processus', required: true },
                { field: 'Sous-processus', label: 'Sous-processus', type: 'text' }
            ]
        },
        PERIMETRES: {
            name: 'tPerimetres',
            sheet: 'Perimetre',
            displayName: 'Périmètres',
            icon: '&#127758;',
            columns: [
                { field: 'Périmetre', label: 'Périmètre', type: 'text', required: true }
            ]
        },
        FLUX: {
            name: 'tFlux',
            sheet: 'Flux',
            displayName: 'Flux Migration',
            icon: '&#128640;',
            columns: [
                { field: 'Shore/Gold', label: 'Shore/Gold', type: 'select', source: 'SHORES', sourceField: 'Nom' },
                { field: 'Projet DSS', label: 'Projet DSS', type: 'select', source: 'PROJETS_DSS', sourceField: 'Nom projet' },
                { field: 'DFNom DF', label: 'Dataflow', type: 'select', source: 'DATAFLOWS', sourceField: 'Nom' },
                { field: 'Produit', label: 'Produit', type: 'select', source: 'PRODUITS', sourceField: 'Nom' },
                { field: 'Charge (jh)', label: 'Charge (j/h)', type: 'number' },
                { field: 'Estimation', label: 'Estimation', type: 'text' },
                { field: 'Date prévisionnelle migration', label: 'Date prévue', type: 'date' },
                { field: 'Sprint', label: 'Sprint', type: 'select', source: 'SPRINTS', sourceField: 'Sprint' },
                { field: 'Eligible SLA', label: 'Éligible SLA', type: 'select', options: ['Oui', 'Non'] },
                { field: 'Commentaire', label: 'Commentaire', type: 'textarea' }
            ]
        },
        BACKLOG: {
            name: 'tBacklog',
            sheet: 'Backlog',
            displayName: 'Backlog Projets',
            icon: '&#128203;',
            columns: [
                { field: 'Produit', label: 'Produit', type: 'select', source: 'PRODUITS', sourceField: 'Nom' },
                { field: 'Processus', label: 'Processus', type: 'select', source: 'PROCESSUS', sourceField: 'Processus' },
                { field: 'Périmètre', label: 'Périmètre', type: 'select', source: 'PERIMETRES', sourceField: 'Périmetre' },
                { field: 'Phase', label: 'Phase', type: 'text' },
                { field: 'Sprint', label: 'Sprint', type: 'select', source: 'SPRINTS', sourceField: 'Sprint' }
            ]
        },
        SPRINTS: {
            name: 'tSprints',
            sheet: 'Sprints',
            displayName: 'Sprints',
            icon: '&#128197;',
            columns: [
                { field: 'Sprint', label: 'Sprint', type: 'text', required: true },
                { field: 'Début', label: 'Date début', type: 'date', required: true },
                { field: 'Fin', label: 'Date fin', type: 'date', required: true }
            ]
        },
        CAPACITE: {
            name: 'tCapacite',
            sheet: 'Capacite',
            displayName: 'Capacité',
            icon: '&#128200;',
            columns: [
                { field: 'Acteur', label: 'Acteur', type: 'select', source: 'ACTEURS', sourceField: 'Mail', required: true },
                { field: 'Sprint', label: 'Sprint', type: 'select', source: 'SPRINTS', sourceField: 'Sprint', required: true },
                { field: 'Capacité', label: 'Capacité (j/h)', type: 'number', required: true }
            ]
        },
        TABLES_MH: {
            name: 'tTablesMHTech',
            sheet: 'Tables',
            displayName: 'Tables MHTech',
            icon: '&#128451;',
            columns: [
                { field: 'UC', label: 'UC', type: 'text' },
                { field: 'Table', label: 'Table', type: 'text', required: true },
                { field: 'OK DA ?', label: 'OK DA', type: 'select', options: ['Oui', 'Non', 'En cours'] },
                { field: 'Date de migration', label: 'Date migration', type: 'date' },
                { field: 'Recette OK ?', label: 'Recette OK', type: 'select', options: ['Oui', 'Non', 'En cours'] },
                { field: 'Commentaire', label: 'Commentaire', type: 'textarea' }
            ]
        }
    },

    // Options de statut migration
    MIGRATION_STATUS: {
        MIGRE: { value: 'Migré', color: '#28A745', label: 'Migré' },
        EN_COURS: { value: 'En cours', color: '#FFC107', label: 'En cours' },
        NON_MIGRE: { value: 'Non migré', color: '#DC3545', label: 'Non migré' },
        BLOQUE: { value: 'Bloqué', color: '#6C757D', label: 'Bloqué' }
    },

    // Options de statut Produit-Processus (couleurs pastel)
    PROCESS_STATUS: {
        RUN: { value: 'Run', color: '#C8E6C9', label: 'Run' },           // Vert pastel
        EVOLUTION: { value: 'Evolution', color: '#F8BBD9', label: 'Evolution' }, // Rose pastel
        BACKLOG: { value: 'Backlog', color: '#B2EBF2', label: 'Backlog' }  // Cyan pastel
    },

    // Capacité par défaut (jours par sprint par acteur)
    CAPACITE_DEFAUT: 15,

    // Coefficient de sécurité pour les estimations
    COEF_SECURITE: 2.0,

    // Options de la dialog plein écran
    // Pattern AppExcel : uniquement height et width
    DIALOG_OPTIONS: {
        height: 80,
        width: 80
    },

    // Navigation de l'application
    NAVIGATION: {
        FONCTIONNEL: [
            { id: 'migration', label: 'Migration', icon: '&#128640;', page: 'migration' },
            { id: 'parc', label: 'Parc Applicatif', icon: '&#128202;', page: 'parc' },
            { id: 'roadmap', label: 'Roadmap', icon: '&#128197;', page: 'roadmap' }
        ],
        PARAMETRES: [
            { id: 'acteurs', label: 'Acteurs', icon: '&#128100;', table: 'ACTEURS' },
            { id: 'equipes', label: 'Équipes', icon: '&#128101;', table: 'EQUIPES' },
            { id: 'shores', label: 'Shores / Golds', icon: '&#128451;', table: 'SHORES' },
            { id: 'projets-dss', label: 'Projets DSS', icon: '&#128194;', table: 'PROJETS_DSS' },
            { id: 'dataflows', label: 'Dataflows', icon: '&#128260;', table: 'DATAFLOWS' },
            { id: 'processus', label: 'Processus', icon: '&#128736;', table: 'PROCESSUS' },
            { id: 'perimetres', label: 'Périmètres', icon: '&#127758;', table: 'PERIMETRES' },
            { id: 'sprints', label: 'Sprints', icon: '&#128197;', table: 'SPRINTS' },
            { id: 'capacite', label: 'Capacité', icon: '&#128200;', table: 'CAPACITE' },
            { id: 'tables-mh', label: 'Tables MHTech', icon: '&#128451;', table: 'TABLES_MH' }
        ]
    },

    // Pagination par défaut
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 20,
        PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
    }
};

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
