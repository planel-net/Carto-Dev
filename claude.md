# CartoExcel - Guide Claude Code

Application Excel Office.js (Add-in) pour Malakoff Humanis. Pilotage du parc applicatif, suivi de migration de donnees et planification de ressources. ~26K lignes, vanilla JS/CSS, deploye sur GitHub Pages.

---

## Architecture

### Dual-context : Taskpane + Dialog

```
Excel (host)
  |
  +-- Taskpane (html/taskpane.html) -- acces direct a Excel via Office.js
  |     js: taskpane.js, excel-utils.js, auth.js, persistent-cache.js
  |
  +-- Dialog (html/app.html) -- UI plein ecran, PAS d'acces direct a Excel
        js: app.js, excel-bridge.js, pages/*, components/*
        Communique avec le Taskpane via ExcelBridge (messageParent/messageChild)
```

**Regle critique** : Le Dialog ne peut PAS appeler `Excel.run()`. Toutes les operations Excel passent par `ExcelBridge.request()` qui envoie un message au Taskpane, celui-ci execute l'operation et renvoie le resultat.

### Pattern ExcelBridge

```
Dialog (app.js)                    Taskpane (taskpane.js)
  |                                   |
  | ExcelBridge.request('READ_TABLE') |
  |  --> messageParent(json) -------> |
  |                                   | readTable() via Excel.run()
  |  <-- messageChild(json) <-------- |
  | resolve(result)                   |
```

- `ExcelBridge` (js/utils/excel-bridge.js) : cote Dialog, envoie des requetes
- `handleDialogMessage` (js/taskpane.js) : cote Taskpane, recoit et traite les requetes
- Types de requetes : READ_TABLE, ADD_ROW, UPDATE_ROW, DELETE_ROW, GET_UNIQUE_VALUES, SEARCH_TABLE, LIST_TABLES, COPY_FROM_JIRA, INVALIDATE_CACHE, GET_MIGRATION_STATS

### Fonctions CRUD overridees dans app.js

Dans le Dialog, `app.js` redefinit `readTable()`, `addTableRow()`, `updateTableRow()`, `deleteTableRow()`, etc. pour utiliser le bridge au lieu d'Excel.run(). Les pages et composants appellent ces fonctions sans savoir s'ils sont dans le Taskpane ou le Dialog.

### Cache a 3 niveaux

1. **Cache memoire** (Map `tableCache`, 30s) - dans excel-utils.js, cote Taskpane
2. **Cache localStorage** (PersistentCache, fresh 30s, valid 24h) - dans persistent-cache.js, des deux cotes
3. **Excel** (source de verite) - via Excel.run(), cote Taskpane uniquement

Ecriture : invalide le cache memoire + localStorage. Lecture : memoire -> localStorage -> Excel, avec fallback en cascade.

### File d'attente d'ecriture (ExcelWriteQueue)

Serialise les operations d'ecriture Excel pour eviter les conflits de contexte. Retry automatique (3 tentatives, delai exponentiel). Definie dans excel-utils.js.

---

## Structure des fichiers

```
CartoExcel/
  manifest.xml              # Add-in Office (GUID DEV, URLs GitHub Pages)
  CLAUDE.md
  html/
    taskpane.html           # Point d'entree (sidebar Excel)
    app.html                # UI principale (dialog plein ecran)
  css/
    variables.css           # Variables CSS (couleurs MH, espacements, ombres)
    base.css                # Reset et styles de base
    components.css          # Boutons, modales, badges, sidebar, formulaires
    notifications.css       # Toast notifications
    app.css                 # Layout app (header, sidebar, content)
    dashboard.css           # Cards de statistiques migration
    table.css               # Composant table generique
    process-matrix.css      # Matrice Produits x Processus
    mae.css                 # Page MAE (pipeline, cards)
    taskpane.css            # Sidebar Excel
  js/
    config.js               # CONFIG global : tables, navigation, constantes
    taskpane.js             # Init taskpane, bridge handler, lock/unlock
    app.js                  # Init dialog, routing, bridge wrappers
    utils/
      excel-utils.js        # CRUD Excel (readTable, addTableRow, etc.)
      excel-bridge.js       # Communication Dialog <-> Taskpane
      persistent-cache.js   # Cache localStorage
      auth.js               # Lock/unlock workbook, password management
      helpers.js            # formatDate, formatActorName, debounce, escapeHtml...
      notifications.js      # showNotification, showSuccess, showError
    components/
      sidebar.js            # Classe Sidebar (navigation, collapse)
      modal.js              # Systeme de modales
      table.js              # Composant table (pagination, tri, recherche)
      form.js               # Generateur de formulaires depuis CONFIG.TABLES
      chart.js              # Graphiques (barres de progression)
      phase-modal.js        # Modale phase (roadmap)
      chantier-modal.js     # Modale chantier (roadmap, onglets)
      mae-modal.js          # Modale demande MAE
    pages/
      migration.js          # Page Cartographie (dashboard migration)
      parc.js               # Page Parc Applicatif (matrice processus + liste)
      roadmap-chantiers.js  # Page Roadmap (Gantt chantiers/phases)
      roadmap-gantt.js      # Ancien Gantt (legacy)
      roadmap.js            # Ancienne roadmap (legacy)
      mae.js                # Page MAE (pipeline + table demandes)
      params.js             # Page Parametres (CRUD generique par table)
  assets/
    icons/                  # icon-16/32/80/128.png
    images/                 # logo-mh.png
```

---

## Data Model - 24 Tables Excel

Toutes les tables sont definies dans `CONFIG.TABLES` (js/config.js). Convention : prefixe `t` + PascalCase.

### Tables principales

| Cle CONFIG | Table Excel | Feuille | Description |
|------------|-------------|---------|-------------|
| PRODUITS | tProduits | Produits | Rapports/apps PBI (entite centrale) |
| CHANTIER | tChantiers | Chantier | Projets/chantiers |
| PHASES | tPhases | Phases | Phases d'un chantier (EB, Cadrage, Dev, Recette, MEP) |
| MAE | tMAE | MAE | Demandes Data (cle Jira) |
| ACTEURS | tActeurs | Acteurs | Personnes (Prenom, Nom, Mail, Equipe) |
| SPRINTS | tSprints | Sprints | Sprints (nom, debut, fin) |

### Tables de reference

| Cle CONFIG | Table Excel | Description |
|------------|-------------|-------------|
| EQUIPES | tEquipe | Equipes |
| SHORES | tShores | Shores / Golds (serveurs) |
| PROJETS_DSS | tProjetsDSS | Projets DSS |
| DATAFLOWS | tDataflows | Dataflows |
| PROCESSUS | tProcessus | Processus metier (ordonnables) |
| PERIMETRES | tPerimetres | Perimetres fonctionnels |
| TABLES_MH | tTablesMHTech | Tables techniques MHTech |
| CAPACITE | tCapacite | Capacite par acteur par sprint |
| BACKLOG | tBacklog | Backlog projets |
| DATAANA | tDataAnas | DataAna (cle Jira) |

### Tables de liaison (N:N)

| Cle CONFIG | Table Excel | Relation |
|------------|-------------|----------|
| PDT_PROCESS | tPdtProcess | Produit <-> Processus |
| FLUX | tFlux | Shore/Projet/Dataflow/Produit (migration) |
| CHANTIER_PRODUIT | tChantierProduit | Chantier <-> Produit |
| CHANTIER_DATAANA | tChantierDataAna | Chantier <-> DataAna |
| CHANTIER_LIEN | tChantierLien | Liens externes d'un chantier |
| PHASES_LIEN | tPhasesLien | Liens externes d'une phase |
| MAE_NOTE | tMAENote | Notes d'une demande MAE |
| MAE_LIEN | tMAELien | Liens externes d'une demande MAE |

### Feuilles speciales (pas des tables)

| Feuille | Role |
|---------|------|
| Intro | Page d'accueil (CONFIG.SHEETS.HOME), visible quand verrouille |
| mdp | Mot de passe en B2 (CONFIG.SHEETS.PASSWORD), TOUJOURS masquee |
| DataAnaJira | Feuille source Jira pour DataAna (import) |
| MAEJiras | Feuille source Jira pour MAE (import) |

### Relations cles

- `PRODUITS.Responsable` / `PRODUITS.Backup` -> `ACTEURS.Mail`
- `PRODUITS.Perimétre fonctionnel` -> `PERIMETRES.Périmetre`
- `PRODUITS.Gold / Shore actuel` -> `SHORES.Nom`
- `CHANTIER.Responsable` -> `ACTEURS.Mail`
- `CHANTIER.Perimetre` -> `PERIMETRES.Périmetre`
- `PHASES.Chantier` -> `CHANTIER.Chantier`
- `PHASES.Sprint début/fin` -> `SPRINTS.Sprint`
- `MAE.Chantier` -> `CHANTIER.Chantier`
- `FLUX` relie Shore + Projet DSS + Dataflow + Produit + Sprint

---

## Navigation et Pages

Definie dans `CONFIG.NAVIGATION`. Routing dans `app.js:navigateTo()`.

### Pages fonctionnelles

| ID | Page | Fichier | Description |
|----|------|---------|-------------|
| migration | Cartographie | pages/migration.js | Dashboard migration (stats, flux, produits) |
| parc | Parc Applicatif | pages/parc.js | Matrice Produits x Processus + vue liste |
| roadmap-chantiers | Roadmap | pages/roadmap-chantiers.js | Gantt des chantiers/phases (drag & drop) |
| mae | MAE | pages/mae.js | Pipeline + table demandes Data |

### Page parametres

`params` + cle table -> pages/params.js : CRUD generique pour n'importe quelle table CONFIG.

---

## Patterns de code

### Structure d'une page

Chaque page est une classe avec :
- `constructor()` : donnees, filtres, etat
- `async render(container)` : rendu HTML dans le container
- `async loadData()` : charge les tables via readTable()
- `renderXxx()` : sous-rendus (toolbar, table, filtres...)
- `attachEvents()` : event listeners
- Instance globale : `let xxxPageInstance = null;`
- Fonctions d'entree : `renderXxxPage(container)`, `refreshXxxPage()`

### Generateur de formulaires

`form.js:generateFormHtml(formId, fields, data)` utilise la config `columns` de CONFIG.TABLES pour generer automatiquement les champs. Types supportes : text, email, number, date, select (avec source dynamique), textarea, color, checkbox.

Pour les selects avec `source`, le formulaire charge les valeurs depuis la table reference via `readTable()`.

### Composant Table generique

`table.js` : pagination, tri multi-colonnes, recherche, actions par ligne. Utilise dans params.js et les pages.

### Modales

`modal.js:openModal(title, content, options)` : systeme de modales empilables.
Modales specialisees : `chantier-modal.js` (onglets General/Phases/Associations/Notes), `phase-modal.js`, `mae-modal.js`.

### Notifications

`showNotification(message, type)` - types: success, error, warning, info. Auto-dismiss 5s. Aussi: `showSuccess(msg)`, `showError(msg)`.

---

## Charte graphique Malakoff Humanis

### Couleurs (css/variables.css)

```
--mh-bleu-fonce: #003366    (texte principal, headers)
--mh-bleu-clair: #0066CC    (boutons primaires, liens)
--mh-orange: #FF6600        (CTA, boutons action)
--mh-gris-fonce: #333333    (texte)
--mh-gris-clair: #F5F5F5    (fonds secondaires)
--mh-vert-succes: #28A745   (succes, migre)
--mh-rouge-erreur: #DC3545  (erreur, non migre)
--mh-jaune-warning: #FFC107 (warning, en cours)
```

### Boutons

- `.btn-primary` : bleu clair (actions standard)
- `.btn-action` : orange (CTA principal)
- `.btn-success` : vert
- `.btn-danger` : rouge
- `.btn-secondary` : gris clair

### Typographie

Font: Segoe UI. Headers: bleu fonce, font-weight 600.

---

## Verrouillage du classeur

- Feuille `mdp` (toujours masquee) contient le mot de passe en B2
- Verrouillage : masque toutes les feuilles sauf Intro, DataAnaJira, MAEJiras
- Deverrouillage : rend toutes les feuilles visibles sauf mdp
- L'add-in accede aux donnees meme quand le classeur est verrouille (Office.js contourne la protection)

---

## Environnements Dev / Prod

Deux repos GitHub separes avec GUIDs differents dans le manifest :

| | Dev | Prod |
|---|---|---|
| Repo | planel-net/Carto-Dev | planel-net/Carto |
| URL | planel-net.github.io/Carto-Dev/ | planel-net.github.io/Carto/ |
| Nom Excel | "Carto (DEV)" | "Carto" |
| Badge | Orange "DEV" en haut a gauche | Masque |

Detection automatique via `window.location.hostname.includes('-dev')`.

---

## Conventions

### Commits

En francais. Format : `[Composant] : description` ou `vX.Y.Z - Description`.
Exemples :
- `Fix Roadmap : restauration synchrone du scroll apres deplacement de phase`
- `v1.4.0 - Refonte MAE : colonnes Jira, pipeline read-only, Copie Jira`
- `Verrouillage : garder DataAnaJira, MAEJiras et Intro visibles`

### Versioning

`APP_VERSION` dans config.js. Cache bust via query string `?v=X.Y.Z` dans app.html.
Manifest : `<Version>1.0.17.0</Version>` (format a 4 chiffres).

### Code

- Vanilla JS uniquement, pas de framework/bundler
- Classes pour les pages et composants complexes
- Fonctions globales pour les utilitaires
- `escapeHtml()` pour tout contenu utilisateur insere dans le DOM
- `escapeJsString()` pour les attributs onclick inline
- Dates Excel : serials numeriques, convertis via `formatDate()` dans helpers.js
- Acteurs identifies par email (Mail), affiches via `formatActorName(email)` -> "Prenom N."
- Toute operation d'ecriture passe par ExcelWriteQueue (cote Taskpane)

### Performance Excel

- `load()` uniquement les proprietes necessaires
- Regrouper dans un seul `Excel.run()`
- Minimiser les `context.sync()`
- Batch operations : `addTableRows()`, `updateTableRows()`, `deleteTableRows()`
- Timeout de 30s sur les operations Excel

### Scripts dans les HTML

Ordre d'import important (pas de modules ES6) :
```
office.js -> config.js -> helpers.js -> notifications.js ->
  persistent-cache.js -> excel-utils.js|excel-bridge.js ->
  composants -> page principale
```

Le Taskpane charge `excel-utils.js` + `auth.js`.
Le Dialog charge `excel-bridge.js` + `persistent-cache.js` + composants + pages.

---

## Pieges courants

1. **Ne jamais appeler Excel.run() dans le Dialog** : utiliser ExcelBridge.request()
2. **_rowIndex est 0-based** : c'est l'index dans le corps de la table (pas le header)
3. **Noms de colonnes Excel** : respecter la casse exacte (ex: `Perimétre fonctionnel` avec un accent mal place)
4. **Invalider le cache** apres toute ecriture (memoire + localStorage + notifier le Dialog)
5. **Pas de modules ES6** : tout est en globals, attention aux collisions de noms
6. **messageParent/messageChild** : serialiser en JSON, taille limitee
7. **Types de phases** : EB, Cadrage, Dev, Recette, MEP (avec couleurs dans CONFIG.PHASE_COLORS)
8. **Statuts migration** : comparaison insensible a la casse, gerer "Termine", "Migre", "Oui"
9. **Feuilles Jira** (DataAnaJira, MAEJiras) : source externe, import via `copyFromJira()`
