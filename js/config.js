/* ===========================================
   CONFIG.JS - Configuration centralisée
   Application Carto
   =========================================== */

const CONFIG = {
    // Nom de l'application
    APP_NAME: 'Carto',
    APP_VERSION: '1.5.35',

    // Valeur spéciale pour filtrer les éléments sans valeur (périmètre/responsable vide)
    EMPTY_FILTER_VALUE: '(Non rempli)',

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
                // Noms de colonnes EXACTS d'Excel (sans espaces à la fin)
                { field: 'Nom', label: 'Nom', type: 'text', required: true },
                { field: 'Statut Migration', label: 'Statut migration', type: 'select', options: ['Terminé', 'En cours', 'Non démarré', 'Bloqué', 'Migré', 'Non migré', ''] },
                { field: 'Responsable', label: 'Responsable', type: 'select', source: 'ACTEURS', sourceField: 'Mail' },
                { field: 'Backup', label: 'Backup', type: 'select', source: 'ACTEURS', sourceField: 'Mail' },
                { field: 'Type de rapport', label: 'Type de rapport', type: 'text' },
                { field: 'Périmétre des données (SI)', label: 'Périmètre données (SI)', type: 'text' },
                { field: 'PBI / PowerAPP', label: 'PBI / PowerApp', type: 'select', options: ['PBI', 'Power BI', 'PowerApp', 'Power Apps', 'Autre', ''] },
                { field: 'Frequence', label: 'Fréquence', type: 'select', options: ['Quotidienne', 'Hebdomadaire', 'Mensuelle', 'Trimestrielle', 'Semestrielle', 'Annuelle', ''] },
                { field: 'Sensible au pb d\'actualisation quotidien', label: 'Sensible actualisation', type: 'select', options: ['Oui', 'Non', ''] },
                { field: 'Gold / Shore actuel', label: 'Gold/Shore actuel', type: 'select', source: 'SHORES', sourceField: 'Nom' },
                { field: 'Shore cible DOCC', label: 'Shore cible DOCC', type: 'text' },
                { field: 'Shore vision MH Tech', label: 'Shore vision MH Tech', type: 'select', source: 'SHORES', sourceField: 'Nom' },
                { field: 'PB migration', label: 'Problème migration', type: 'text' },
                { field: 'Extraction PBI possible / oui', label: 'Extraction PBI possible', type: 'select', options: ['Oui', 'Non', ''] },
                { field: 'Enjeux', label: 'Enjeux', type: 'textarea' },
                { field: 'Statut', label: 'Statut', type: 'select', options: ['Run', 'Evolution', 'Backlog', ''] }
            ]
        },
        PROCESSUS: {
            name: 'tProcessus',
            sheet: 'Processus',
            displayName: 'Processus',
            icon: '&#128736;',
            sortable: true, // Enable drag-and-drop sorting
            columns: [
                { field: 'Processus', label: 'Processus', type: 'text', required: true },
                { field: 'Sous-processus', label: 'Sous-processus', type: 'text' },
                { field: 'Ordre', label: 'Ordre', type: 'number' }
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
        PROGRAMMES: {
            name: 'tProgrammes',
            sheet: 'Programmes',
            displayName: 'Programmes',
            icon: '&#128218;',
            columns: [
                { field: 'Programme', label: 'Programme', type: 'text', required: true },
                { field: 'Périmètre', label: 'Périmètre', type: 'select', source: 'PERIMETRES', sourceField: 'Périmetre' }
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
                { field: 'Description', label: 'Description', type: 'textarea' },
                { field: 'Sprint début', label: 'Sprint début', type: 'select', source: 'SPRINTS', sourceField: 'Sprint' },
                { field: 'Sprint fin', label: 'Sprint fin', type: 'select', source: 'SPRINTS', sourceField: 'Sprint' },
                { field: 'Couleur', label: 'Couleur', type: 'color' }
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
                { field: 'Acteurs', label: 'Acteur', type: 'select', source: 'ACTEURS', sourceField: 'Mail', required: true },
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
        },
        // Tables pour la nouvelle Roadmap (Chantiers)
        CHANTIER: {
            name: 'tChantiers',
            sheet: 'Chantier',
            displayName: 'Chantiers',
            icon: '&#128736;',
            columns: [
                { field: 'NumChantier', label: 'N° Chantier', type: 'text' },
                { field: 'Code', label: 'Code', type: 'text' },
                { field: 'Chantier', label: 'Chantier', type: 'text', required: true },
                { field: 'Description', label: 'Description', type: 'textarea' },
                { field: 'Responsable', label: 'Responsable', type: 'select', source: 'ACTEURS', sourceField: 'Mail' },
                { field: 'Perimetre', label: 'Périmètre', type: 'select', source: 'PERIMETRES', sourceField: 'Périmetre' },
                { field: 'Programme', label: 'Programme', type: 'select', source: 'PROGRAMMES', sourceField: 'Programme' },
                { field: 'Processus', label: 'Processus', type: 'select', source: 'PROCESSUS', sourceField: 'Processus' },
                { field: 'Avancement', label: 'Avancement', type: 'select', options: ['Non démarré', 'En cadrage', 'Cadré', 'En développement', 'Développé', 'En recette', 'Recetté', 'Terminé'] },
                { field: 'Date fin souhaitée', label: 'Date fin souhaitée', type: 'date' },
                { field: 'JH Vigie', label: 'JH Vigie', type: 'number' },
                { field: 'JH Pilotage', label: 'JH Pilotage', type: 'number' },
                { field: 'Archivé', label: 'Archivé', type: 'checkbox' },
                { field: 'Enjeux', label: 'Enjeux', type: 'textarea' }
            ]
        },
        PHASES: {
            name: 'tPhases',
            sheet: 'Phases',
            displayName: 'Phases',
            icon: '&#128197;',
            columns: [
                { field: 'Phase', label: 'Phase', type: 'text', required: true },
                { field: 'Type phase', label: 'Type phase', type: 'select', options: ['EB', 'Cadrage', 'Dev', 'Recette', 'MEP'] },
                { field: 'Description', label: 'Description', type: 'textarea' },
                { field: 'Chantier', label: 'Chantier', type: 'select', source: 'CHANTIER', sourceField: 'Chantier' },
                { field: 'Mode', label: 'Mode', type: 'select', options: ['Sprint', 'Semaine'] },
                { field: 'Sprint début', label: 'Sprint début', type: 'select', source: 'SPRINTS', sourceField: 'Sprint' },
                { field: 'Sprint fin', label: 'Sprint fin', type: 'select', source: 'SPRINTS', sourceField: 'Sprint' },
                { field: 'Semaine début', label: 'Semaine début', type: 'text' },
                { field: 'Semaine fin', label: 'Semaine fin', type: 'text' },
                { field: 'Couleur', label: 'Couleur', type: 'color' },
                { field: 'Lien Teams', label: 'Lien Teams', type: 'text' }
            ]
        },
        PHASES_LIEN: {
            name: 'tPhasesLien',
            sheet: 'PhasesLien',
            displayName: 'Liens des phases',
            icon: '&#128279;',
            columns: [
                { field: 'Phase', label: 'Phase', type: 'select', source: 'PHASES', sourceField: 'Phase' },
                { field: 'Nom lien', label: 'Nom du lien', type: 'text' },
                { field: 'Lien', label: 'URL', type: 'text' }
            ]
        },
        PDTS_PERIMETRES: {
            name: 'tPdtsPerimetres',
            sheet: 'ProcessusProduits',
            displayName: 'Produits-Périmètres',
            icon: '&#128279;',
            columns: [
                { field: 'Produit', label: 'Produit', type: 'select', source: 'PRODUITS', sourceField: 'Nom', required: true },
                { field: 'Périmètre', label: 'Périmètre', type: 'select', source: 'PERIMETRES', sourceField: 'Périmetre', required: true }
            ]
        },
        CHANTIER_PRODUIT: {
            name: 'tChantierProduit',
            sheet: 'ChantierProduit',
            displayName: 'Chantiers-Produits',
            icon: '&#128279;',
            columns: [
                { field: 'Chantier', label: 'Chantier', type: 'select', source: 'CHANTIER', sourceField: 'Chantier' },
                { field: 'Produit', label: 'Produit', type: 'select', source: 'PRODUITS', sourceField: 'Nom' }
            ]
        },
        DATAANA: {
            name: 'tDataAnas',
            sheet: 'DataAna',
            displayName: 'DataAna',
            icon: '&#128202;',
            jiraSheet: 'DataAnaJira',
            columns: [
                { field: 'Clé', label: 'Clé', type: 'text', required: true, linkPattern: 'https://malakoffhumanis.atlassian.net/browse/{value}' },
                { field: 'Chantier', label: 'Chantier', type: 'select', source: 'CHANTIER', sourceField: 'Chantier' },
                { field: 'Résumé', label: 'Résumé', type: 'text' },
                { field: 'Priorité', label: 'Priorité', type: 'text' },
                { field: 'État', label: 'État', type: 'text' },
                { field: 'Personne assignée', label: 'Personne assignée', type: 'text' },
                { field: 'Charge estimée', label: 'Charge estimée', type: 'number' }
            ]
        },
        CHANTIER_DATAANA: {
            name: 'tChantierDataAna',
            sheet: 'ChantierDataAna',
            displayName: 'Chantiers-DataAnas',
            icon: '&#128279;',
            columns: [
                { field: 'Chantier', label: 'Chantier', type: 'select', source: 'CHANTIER', sourceField: 'Chantier' },
                { field: 'DataAna', label: 'DataAna', type: 'select', source: 'DATAANA', sourceField: 'Clé' }
            ]
        },
        CHANTIER_LIEN: {
            name: 'tChantierLien',
            sheet: 'ChantierLien',
            displayName: 'Liens Chantiers',
            icon: '&#128279;',
            columns: [
                { field: 'Chantier', label: 'Chantier', type: 'select', source: 'CHANTIER', sourceField: 'Chantier' },
                { field: 'Nom lien', label: 'Nom du lien', type: 'text' },
                { field: 'Lien', label: 'URL', type: 'text' }
            ]
        },
        // Tables MAE (Demandes Data)
        MAE: {
            name: 'tMAE',
            sheet: 'MAE',
            displayName: 'Demandes MAE',
            icon: '&#128203;',
            jiraSheet: 'MAEJiras',
            columns: [
                { field: 'Clé', label: 'Clé', type: 'text', required: true, linkPattern: 'https://malakoffhumanis.atlassian.net/browse/{value}' },
                { field: 'Résumé', label: 'Résumé', type: 'text' },
                { field: 'Périmètre - MAE', label: 'Périmètre - MAE', type: 'text' },
                { field: 'Rapporteur', label: 'Rapporteur', type: 'text' },
                { field: 'Start Date', label: 'Start Date', type: 'date' },
                { field: 'Date souhaitée de livraison', label: 'Date souhaitée de livraison', type: 'date' },
                { field: 'Priorité', label: 'Priorité', type: 'text' },
                { field: 'Description', label: 'Description', type: 'textarea' },
                { field: 'État', label: 'État', type: 'text', readonly: true },
                { field: 'Personne assignée', label: 'Personne assignée', type: 'text' },
                { field: 'Gold', label: 'Gold', type: 'textarea' },
                { field: 'Date d\'échéance', label: 'Date d\'échéance', type: 'date' },
                { field: 'JH DE', label: 'JH DE', type: 'number' },
                { field: 'JH DA', label: 'JH DA', type: 'number' },
                { field: 'JH DataViz', label: 'JH DataViz', type: 'number' },
                { field: 'Parent', label: 'Parent', type: 'text' },
                { field: 'Thème', label: 'Thème', type: 'text', readonly: true },
                { field: 'Chantier', label: 'Chantier', type: 'select', source: 'CHANTIER', sourceField: 'Chantier' }
            ]
        },
        MAE_NOTE: {
            name: 'tMAENote',
            sheet: 'MAENote',
            displayName: 'Notes MAE',
            icon: '&#128221;',
            columns: [
                { field: 'Clé', label: 'Clé demande', type: 'text', required: true },
                { field: 'Date', label: 'Date', type: 'text', required: true },
                { field: 'Redacteur', label: 'Rédacteur', type: 'select', source: 'ACTEURS', sourceField: 'Mail' },
                { field: 'Note', label: 'Note', type: 'textarea' }
            ]
        },
        MAE_LIEN: {
            name: 'tMAELien',
            sheet: 'MAELien',
            displayName: 'Liens MAE',
            icon: '&#128279;',
            columns: [
                { field: 'Clé', label: 'Clé demande', type: 'text', required: true },
                { field: 'Nom lien', label: 'Nom du lien', type: 'text' },
                { field: 'Lien', label: 'URL', type: 'text' }
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

    // Couleurs par type de phase (Roadmap Chantiers)
    PHASE_COLORS: {
        'EB': '#A8D5E5',        // Bleu pastel
        'Cadrage': '#B8E0B8',   // Vert pastel
        'Dev': '#F5D5A8',       // Orange pastel
        'Recette': '#F5F5A8',   // Jaune pastel
        'MEP': '#E5B8E0'        // Violet pastel
    },

    // Statuts MAE (dans l'ordre du processus)
    MAE_STATUTS: [
        { value: 'À faire', label: 'À faire', index: 0 },
        { value: 'En cours', label: 'En cours', index: 1 },
        { value: 'Livré', label: 'Livré', index: 2 },
        { value: 'Validé', label: 'Validé', index: 3 }
    ],

    // Capacité par défaut (jours par sprint par acteur)
    CAPACITE_DEFAUT: 15,

    // Coefficient de sécurité pour les estimations
    COEF_SECURITE: 2.0,

    // Options de la dialog plein écran
    // Pattern AppExcel : uniquement height et width
    DIALOG_OPTIONS: {
        height: 100,
        width: 100
    },

    // Navigation de l'application
    NAVIGATION: {
        FONCTIONNEL: [
            { id: 'synthese', label: 'Synthèse', icon: '&#128200;', page: 'synthese' },
            { id: 'migration', label: 'Cartographie', icon: '&#128640;', page: 'migration' },
            { id: 'parc', label: 'Parc Applicatif', icon: '&#128202;', page: 'parc' },
            { id: 'roadmap-chantiers', label: 'Roadmap', icon: '&#128197;', page: 'roadmap-chantiers' },
            { id: 'mae', label: 'MAE', icon: '&#128203;', page: 'mae' },
            { id: 'carrousel', label: 'Carrousel', icon: '&#127914;', page: 'carrousel' }
        ],
        PARAMETRES: [
            { id: 'parametres', label: 'Paramètres', icon: '&#9881;', page: 'parametres-home' }
        ]
    },

    // Thèmes et vignettes de la page Paramètres
    PARAMETRES_THEMES: [
        {
            id: 'migration',
            label: 'Migration',
            icon: '&#128640;',
            color: 'var(--mh-bleu-clair)',
            vignettes: [
                { id: 'flux', label: 'Flux Migration', icon: '&#128640;', table: 'FLUX' },
                { id: 'tables-mh', label: 'Tables MHTech', icon: '&#128451;', table: 'TABLES_MH' },
                { id: 'shores', label: 'Shores / Golds', icon: '&#128451;', table: 'SHORES' },
                { id: 'projets-dss', label: 'Projets DSS', icon: '&#128194;', table: 'PROJETS_DSS' },
                { id: 'dataflows', label: 'Dataflows', icon: '&#128260;', table: 'DATAFLOWS' }
            ]
        },
        {
            id: 'parametres',
            label: 'Paramètres',
            icon: '&#9881;',
            color: 'var(--mh-gris-fonce)',
            vignettes: [
                { id: 'acteurs', label: 'Acteurs', icon: '&#128100;', table: 'ACTEURS' },
                { id: 'equipes', label: 'Équipes', icon: '&#128101;', table: 'EQUIPES' },
                { id: 'processus', label: 'Processus', icon: '&#128736;', table: 'PROCESSUS' },
                { id: 'perimetres', label: 'Périmètres', icon: '&#127758;', table: 'PERIMETRES' }
            ]
        },
        {
            id: 'planification',
            label: 'Planification',
            icon: '&#128197;',
            color: 'var(--mh-orange)',
            vignettes: [
                { id: 'programmes', label: 'Programmes', icon: '&#128218;', table: 'PROGRAMMES' },
                { id: 'sprints', label: 'Sprints', icon: '&#128197;', table: 'SPRINTS' },
                { id: 'capacite', label: 'Capacité', icon: '&#128200;', table: 'CAPACITE' }
            ]
        },
        {
            id: 'activites',
            label: 'Activités',
            icon: '&#128736;',
            color: 'var(--mh-vert-succes)',
            vignettes: [
                { id: 'chantiers', label: 'Chantiers', icon: '&#128736;', table: 'CHANTIER' },
                { id: 'phases', label: 'Phases', icon: '&#128197;', table: 'PHASES' },
                { id: 'dataana', label: 'DataAna', icon: '&#128202;', table: 'DATAANA' }
            ]
        }
    ],

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
