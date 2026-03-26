# Cahier des Charges - Application Carto sur Linkzen

> Ce document decrit exhaustivement l'application **Carto** a implementer sur la plateforme **Linkzen**.
> L'application originale (CartoExcel) fonctionne comme un add-in Excel Office.js. La nouvelle version s'appuie sur PostgreSQL, FastAPI, Jinja2 et du vanilla JS, conformement a l'architecture Linkzen.

---

## Table des matieres

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Architecture technique](#2-architecture-technique)
3. [Modele de donnees PostgreSQL](#3-modele-de-donnees-postgresql)
4. [Navigation et layout](#4-navigation-et-layout)
5. [Page Synthese](#5-page-synthese)
6. [Page Cartographie (Migration)](#6-page-cartographie-migration)
7. [Page Parc Applicatif](#7-page-parc-applicatif)
8. [Page Roadmap (Gantt)](#8-page-roadmap-gantt)
9. [Page MAE (Demandes Data)](#9-page-mae-demandes-data)
10. [Page Carrousel](#10-page-carrousel)
11. [Pages Parametres](#11-pages-parametres)
12. [Composants reutilisables](#12-composants-reutilisables)
13. [Charte graphique](#13-charte-graphique)
14. [Import de donnees Excel](#14-import-de-donnees-excel)
15. [Regles metier transverses](#15-regles-metier-transverses)

---

## 1. Contexte et objectifs

### Contexte

L'application **Carto** est un outil de pilotage du parc applicatif pour Malakoff Humanis. Elle permet :
- Le suivi de la migration de donnees (pipeline Tables MH -> Shores -> Projets DSS -> Dataflows -> Produits)
- La cartographie produits/processus metier (matrice croisee)
- La planification des chantiers sous forme de Gantt interactif
- Le suivi des demandes Data (MAE) avec synchronisation Jira
- La visualisation synthetique multi-domaines

### Objectif de la migration

Passer d'une architecture Excel Office.js (Dialog + Taskpane + bridge) a une application web standard sur la plateforme Linkzen :
- **Backend** : FastAPI + SQLAlchemy + PostgreSQL (remplace Excel comme source de verite)
- **Frontend** : Jinja2 templates + vanilla JS + CSS custom (pas de framework JS, pas de Bootstrap)
- **Multi-tenant** : isolation par `tenant_id` (UUID) sur chaque table
- **Auth** : OAuth cross-subdomain (Google/Microsoft) via le control-plane Linkzen

### Ce qui disparait

- Le Taskpane Excel (sidebar)
- Le bridge Dialog <-> Taskpane (`ExcelBridge`, `messageParent`/`messageChild`)
- Le cache a 3 niveaux (memoire + localStorage + Excel)
- La file d'attente d'ecriture (`ExcelWriteQueue`)
- Le verrouillage du classeur (mot de passe)
- Les feuilles Jira (`DataAnaJira`, `MAEJiras`) - remplacees par un import direct ou API

### Ce qui est conserve

- Toutes les pages fonctionnelles (6 pages + parametres)
- Le modele de donnees (24 tables -> 24 tables PostgreSQL)
- La charte graphique Malakoff Humanis
- Les interactions utilisateur (drag & drop, resize, inline edit, etc.)
- Le theme clair/sombre (OpenFrame)

---

## 2. Architecture technique

### Stack Linkzen

| Composant | Technologie |
|-----------|-------------|
| Backend | Python 3.11 + FastAPI |
| ORM | SQLAlchemy 2.0 (declarative base) |
| Migrations | Alembic |
| BDD | PostgreSQL 15 (base `linkzen_carto`) |
| Cache | Redis 7 |
| Templates | Jinja2 (rendu cote serveur) |
| Frontend | Vanilla JavaScript + CSS custom (OpenFrame) |
| Auth | OAuth 2.0 (Google + Microsoft) cross-subdomain |
| Container | Docker + Docker Compose |
| Reverse Proxy | Traefik v2.10 |
| CI/CD | GitHub Actions |

### Structure de l'app Carto

```
apps/carto/
  app/
    __init__.py
    main.py                # FastAPI app, lifespan, routers, middleware
    config.py              # Settings (Pydantic), env vars
    database.py            # Engine, SessionLocal, Base, get_db(), init_db()
    middleware.py           # get_tenant_id(), get_current_user(), require_auth()
    templates_config.py    # Jinja2Templates
    models/                # SQLAlchemy models (1 fichier par entite)
      __init__.py
      acteur.py
      equipe.py
      shore.py
      processus.py
      perimetre.py
      programme.py
      sprint.py
      produit.py
      projet_dss.py
      dataflow.py
      flux.py
      table_mhtech.py
      data_ana.py
      chantier.py
      phase.py
      phase_lien.py
      phase_lien_url.py
      note.py
      chantier_produit.py
      chantier_data_ana.py
      chantier_lien.py
      mae.py
      mae_note.py
      mae_lien.py
      produit_processus.py
      produit_perimetre.py
      backlog.py
      capacite.py
    routers/               # APIRouter (1 fichier par domaine)
      __init__.py
      auth.py              # Login/logout, OAuth callback
      home.py              # Dashboard / Synthese
      cartographie.py      # Page Cartographie (migration)
      parc.py              # Page Parc Applicatif
      roadmap.py           # Page Roadmap (Gantt)
      mae.py               # Page MAE
      carrousel.py         # Page Carrousel
      parametres.py        # Pages Parametres (CRUD generique)
    schemas/               # Pydantic schemas (Create, Update, Out)
    services/              # Logique metier (static methods)
  templates/
    base.html              # Layout commun (header, sidebar, content, scripts)
    home.html              # Synthese
    cartographie/
      index.html           # Page migration
    parc/
      index.html           # Page parc (matrice + liste)
    roadmap/
      index.html           # Page Gantt
    mae/
      index.html           # Page MAE
    carrousel/
      index.html           # Page Carrousel
    parametres/
      home.html            # Accueil parametres (grille thematique)
      generic.html         # CRUD generique par table
  static/
    css/
      carto.css            # Styles complets (themes, composants, pages)
    js/
      carto.js             # JS global (sidebar, theme, utils)
      roadmap.js           # JS specifique Gantt (drag & drop, resize)
      parc.js              # JS specifique matrice processus
      carrousel.js         # JS specifique SVG carrousel
    images/
      logo-mh.png
  tests/
    conftest.py
    test_*.py
  Dockerfile
  requirements.txt
  alembic.ini
  alembic/versions/
```

### Conventions Linkzen

- **Multi-tenant** : chaque table a un champ `tenant_id UUID NOT NULL INDEX`
- **Timestamps** : `created_at` et `updated_at` sur chaque table
- **Primary keys** : `Integer` auto-increment (pas UUID)
- **Contraintes d'unicite** : incluent `tenant_id` (ex: `UniqueConstraint('email', 'tenant_id')`)
- **Cascade deletes** : `cascade="all, delete-orphan"` sur les relations parent-enfant
- **root_path** : tous les liens/redirects utilisent `request.app.root_path` pour Traefik
- **Roles** : user, manager, admin, superadmin (gating dans les templates)

### Endpoints API

Chaque page expose :
- **GET `/page`** : rendu HTML (template Jinja2 avec donnees)
- **GET `/page/api/...`** : endpoints JSON pour les interactions JS (AJAX)
- **POST/PUT/DELETE `/page/api/...`** : mutations de donnees

---

## 3. Modele de donnees PostgreSQL

### 3.1 Tables referentiels

#### `equipes`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK, auto-increment |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(100) | NOT NULL |
| created_at | DateTime | default=now |
| updated_at | DateTime | onupdate=now |

Unique: `(nom, tenant_id)`

#### `perimetres`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(200) | NOT NULL |
| groupe | String(200) | NOT NULL |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(nom, tenant_id)`

#### `programmes`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(200) | NOT NULL |
| perimetre_id | Integer | FK -> perimetres.id, nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(nom, tenant_id)`

#### `shores`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(200) | NOT NULL |
| nom_pour_tables | String(200) | |
| statut_migration | String(50) | "Oui" / "Non" / "En cours" |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(nom, tenant_id)`

#### `processus`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| processus | String(200) | NOT NULL |
| sous_processus | String(200) | |
| ordre | Integer | default=0 |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(processus, sous_processus, tenant_id)`
Triable par drag & drop (champ `ordre`).

#### `sprints`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(100) | NOT NULL |
| date_debut | Date | NOT NULL |
| date_fin | Date | NOT NULL |
| is_active | Boolean | default=True |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(nom, tenant_id)`

### 3.2 Tables entites principales

#### `acteurs`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| prenom | String(100) | |
| nom | String(100) | |
| email | String(200) | NOT NULL |
| equipe_id | Integer | FK -> equipes.id, nullable |
| is_active | Boolean | default=True |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(email, tenant_id)`
**Relations** : `equipe` (many-to-one -> Equipe)
**Affichage** : toujours formate en "Prenom N." (initiale du nom + point)

#### `produits`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(300) | NOT NULL |
| statut_migration | String(50) | "Termine"/"En cours"/"Non demarre"/"Bloque"/"Migre"/"Non migre" |
| responsable_id | Integer | FK -> acteurs.id, nullable |
| backup_id | Integer | FK -> acteurs.id, nullable |
| type_rapport | String(100) | |
| type_produit | String(100) | |
| criticite | String(50) | |
| pbi_powerapp | String(100) | |
| frequence | String(100) | |
| sensible_actualisation | String(50) | |
| gold_shore_actuel_id | Integer | FK -> shores.id, nullable |
| shore_cible_docc_id | Integer | FK -> shores.id, nullable |
| shore_vision_mhtech_id | Integer | FK -> shores.id, nullable |
| perimetre_donnees_si | String(200) | |
| pb_migration | String(500) | |
| extraction_pbi_possible | String(50) | |
| enjeux | Text | |
| statut | String(50) | "Run"/"Evolution"/"Backlog" |
| perimetre_id | Integer | FK -> perimetres.id, nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(nom, tenant_id)`
**Relations** : `responsable`, `backup` (-> Acteur), `gold_shore_actuel`, `shore_cible_docc`, `shore_vision_mhtech` (-> Shore), `perimetre` (-> Perimetre), `processus_links` (-> ProduitProcessus), `perimetre_links` (-> ProduitPerimetre)

#### `projets_dss`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(300) | NOT NULL |
| statut_migration | String(50) | "Migre"/"En cours"/"Non migre"/"Bloque" |
| responsable_id | Integer | FK -> acteurs.id, nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `dataflows`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(300) | NOT NULL |
| statut_migration | String(50) | |
| responsable_id | Integer | FK -> acteurs.id, nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `tables_mhtech`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| uc | String(200) | |
| table_name | String(300) | NOT NULL |
| shore_id | Integer | FK -> shores.id, nullable |
| ok_da | String(50) | "Oui"/"Non"/"En cours" |
| date_migration | Date | nullable |
| recette_ok | String(50) | |
| commentaire | Text | |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `data_anas`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| cle | String(50) | NOT NULL (cle Jira, ex: "DANA-123") |
| resume | String(500) | |
| priorite | String(50) | |
| etat | String(50) | |
| personne_assignee | String(200) | |
| charge_estimee | Float | nullable |
| chantier_id | Integer | FK -> chantiers.id, nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(cle, tenant_id)`

### 3.3 Tables Roadmap (Chantiers)

#### `chantiers`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| num_chantier | String(20) | auto-genere "C-YYYY-NNN" |
| code | String(50) | |
| nom | String(300) | NOT NULL |
| description | Text | HTML (rich text) |
| responsable_id | Integer | FK -> acteurs.id, nullable |
| perimetre_id | Integer | FK -> perimetres.id, nullable |
| programme_id | Integer | FK -> programmes.id, nullable |
| processus_id | Integer | FK -> processus.id, nullable |
| avancement | String(50) | voir enum ci-dessous |
| date_fin_souhaitee | Date | nullable |
| jh_vigie | Float | default=0 |
| jh_pilotage | Float | default=0 |
| archive | Boolean | default=False |
| enjeux | Text | HTML (rich text) |
| lien_teams | String(500) | URL |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(num_chantier, tenant_id)`

**Enum Avancement** (ordonne) : `Non demarre`, `En cadrage`, `Cadre`, `En developpement`, `Developpe`, `En recette`, `Recette`, `Termine`

**Auto-numbering** : `num_chantier` genere au format `C-YYYY-NNN` (annee courante, numero incremental 3 chiffres).

#### `phases`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| nom | String(300) | NOT NULL |
| type_phase | String(20) | "EB"/"Cadrage"/"Dev"/"Recette"/"MEP" |
| description | Text | |
| chantier_id | Integer | FK -> chantiers.id, NOT NULL |
| mode | String(20) | "Sprint" ou "Semaine" |
| sprint_debut_id | Integer | FK -> sprints.id, nullable |
| sprint_fin_id | Integer | FK -> sprints.id, nullable |
| semaine_debut | String(10) | Format "AAAAS99" (ex: "2026S05") |
| semaine_fin | String(10) | Format "AAAAS99" |
| couleur | String(7) | Hex color, defaut selon type_phase |
| ordre | Integer | default=0 |
| lien_teams | String(500) | URL |
| created_at | DateTime | |
| updated_at | DateTime | |

**Relations** : `chantier` (many-to-one), `sprint_debut`, `sprint_fin` (-> Sprint), `liens` (one-to-many -> PhaseLienUrl)

**Couleurs par defaut (CONFIG.PHASE_COLORS)** :
- EB : `#4A90D9` (bleu)
- Cadrage : `#82C341` (vert)
- Dev : `#F5A623` (orange)
- Recette : `#F8E71C` (jaune)
- MEP : `#9B59B6` (violet)

#### `phase_liens_url`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| phase_id | Integer | FK -> phases.id, NOT NULL, CASCADE |
| nom | String(200) | |
| url | String(500) | |

#### `notes` (notes de chantier)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| chantier_id | Integer | FK -> chantiers.id, NOT NULL, CASCADE |
| date_note | DateTime | NOT NULL |
| contenu | Text | HTML (rich text) |
| redacteur_id | Integer | FK -> acteurs.id, nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `chantier_produits` (N:N)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| chantier_id | Integer | FK -> chantiers.id, CASCADE |
| produit_id | Integer | FK -> produits.id, CASCADE |

Unique: `(chantier_id, produit_id, tenant_id)`

#### `chantier_data_anas` (N:N)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| chantier_id | Integer | FK -> chantiers.id, CASCADE |
| data_ana_id | Integer | FK -> data_anas.id, CASCADE |

Unique: `(chantier_id, data_ana_id, tenant_id)`

#### `chantier_liens`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| chantier_id | Integer | FK -> chantiers.id, CASCADE |
| nom | String(200) | |
| url | String(500) | |

### 3.4 Tables MAE (Demandes Data)

#### `mae` (demandes MAE)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| cle | String(50) | NOT NULL (cle Jira) |
| resume | String(500) | |
| perimetre_mae | String(200) | |
| rapporteur | String(200) | |
| start_date | Date | nullable |
| date_souhaitee_livraison | Date | nullable |
| priorite | String(50) | |
| description | Text | |
| etat | String(50) | readonly (synchro Jira) |
| personne_assignee | String(200) | readonly (synchro Jira) |
| gold | Text | |
| date_echeance | Date | nullable |
| jh_de | Float | default=0 |
| jh_da | Float | default=0 |
| jh_dataviz | Float | default=0 |
| parent | String(50) | cle Jira parent |
| theme | String(200) | readonly (synchro Jira) |
| chantier_id | Integer | FK -> chantiers.id, nullable |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(cle, tenant_id)`

#### `mae_notes`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| mae_id | Integer | FK -> mae.id, CASCADE |
| date_note | DateTime | NOT NULL |
| redacteur_id | Integer | FK -> acteurs.id, nullable |
| contenu | Text | HTML (rich text) |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `mae_liens`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| mae_id | Integer | FK -> mae.id, CASCADE |
| nom | String(200) | |
| url | String(500) | |

### 3.5 Tables de liaison

#### `produit_processus` (N:N)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| produit_id | Integer | FK -> produits.id, CASCADE |
| processus_id | Integer | FK -> processus.id, CASCADE |

Unique: `(produit_id, processus_id, tenant_id)`

#### `produit_perimetres` (N:N)

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| produit_id | Integer | FK -> produits.id, CASCADE |
| perimetre_id | Integer | FK -> perimetres.id, CASCADE |

Unique: `(produit_id, perimetre_id, tenant_id)`

#### `flux`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| shore_id | Integer | FK -> shores.id, nullable |
| projet_dss_id | Integer | FK -> projets_dss.id, nullable |
| dataflow_id | Integer | FK -> dataflows.id, nullable |
| produit_id | Integer | FK -> produits.id, nullable |
| sprint_id | Integer | FK -> sprints.id, nullable |
| charge_jh | Float | nullable |
| estimation | String(200) | |
| date_previsionnelle | Date | nullable |
| eligible_sla | String(10) | "Oui"/"Non" |
| commentaire | Text | |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `backlogs`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| numero | String(50) | |
| titre | String(300) | |
| produit_id | Integer | FK -> produits.id, nullable |
| processus_id | Integer | FK -> processus.id, nullable |
| perimetre_id | Integer | FK -> perimetres.id, nullable |
| phase | String(50) | |
| description | Text | |
| sprint_debut_id | Integer | FK -> sprints.id, nullable |
| sprint_fin_id | Integer | FK -> sprints.id, nullable |
| couleur | String(7) | |
| statut | String(50) | |
| priorite | String(50) | |
| created_at | DateTime | |
| updated_at | DateTime | |

#### `capacites`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| id | Integer | PK |
| tenant_id | UUID | NOT NULL, INDEX |
| acteur_id | Integer | FK -> acteurs.id, NOT NULL |
| sprint_id | Integer | FK -> sprints.id, NOT NULL |
| capacite | Float | NOT NULL, default=15 |
| created_at | DateTime | |
| updated_at | DateTime | |

Unique: `(acteur_id, sprint_id, tenant_id)`

---

## 4. Navigation et layout

### Layout global (`base.html`)

```
+----------------------------------------------------------+
|  HEADER (40px, fixe, fond sombre)                        |
|  [< Retour]  [Logo MH]  Carto  [Version]  [Theme] [User]|
+----------+-----------------------------------------------+
| SIDEBAR  |  CONTENU PRINCIPAL                            |
| (260px / |                                               |
|  60px    |                                               |
| collapsi-|                                               |
| ble)     |                                               |
|          |                                               |
| Section  |                                               |
| Pilotage:|                                               |
|  Synthese|                                               |
|  Carto   |                                               |
|  Parc    |                                               |
|  Roadmap |                                               |
|  MAE     |                                               |
|  Carrouse|                                               |
|          |                                               |
| Section  |                                               |
| Config:  |                                               |
|  Params  |                                               |
+----------+-----------------------------------------------+
```

### Header

- **Lien retour** : icone `<` vers le menu-app du tenant
- **Logo** : logo Malakoff Humanis (petit)
- **Titre** : "Carto"
- **Version** : badge discret avec numero de version
- **Theme toggle** : bascule clair/sombre, persistance `localStorage('carto-theme')`
- **User badge** : avatar + nom de l'utilisateur connecte, lien logout

### Sidebar

- **Collapsible** : toggle via bouton, etat persiste dans `localStorage('carto-sidebar-collapsed')`
- **Mode collapse** : icones seulement (60px), tooltips au survol
- **Mode etendu** : icones + labels (260px)
- **Sections** :
  - **Pilotage** : Synthese, Cartographie, Parc Applicatif, Roadmap, MAE, Carrousel
  - **Configuration** : Parametres
- **Item actif** : fond accent, bordure gauche coloree
- **Icons** : Unicode/emoji (pas de librairie d'icones externe)

### Navigation (routing)

| ID | Label | Route | Page |
|----|-------|-------|------|
| synthese | Synthese | `/` | Vue synthetique 3 colonnes |
| migration | Cartographie | `/cartographie` | Pipeline migration + table produits |
| parc | Parc Applicatif | `/parc` | Matrice processus + liste |
| roadmap-chantiers | Roadmap | `/roadmap` | Gantt interactif |
| mae | MAE | `/mae` | Pipeline + table demandes |
| carrousel | Carrousel | `/carrousel` | Visualisation SVG circulaire |
| parametres-home | Parametres | `/parametres` | Grille thematique |
| params | Param detail | `/parametres/<table_key>` | CRUD generique |

---

## 5. Page Synthese

**Route** : `GET /`

### Description

Vue synthetique unifiee a 3 colonnes (Chantiers, Produits, MAE) avec filtrage croise et calcul de statut migration.

### Donnees chargees (13 tables)

`chantiers`, `produits`, `mae`, `acteurs`, `perimetres`, `processus`, `flux`, `shores`, `projets_dss`, `dataflows`, `produit_processus`, `produit_perimetres`, `tables_mhtech`

### Filtres globaux (multi-select avec Tous/Aucun)

| Filtre | Source | Cascade |
|--------|--------|---------|
| Groupe | Groupes distincts de `perimetres.groupe` | -> Perimetre |
| Perimetre | `perimetres.nom` filtre par Groupe | |
| Processus | `processus.processus` (deduplique) | -> Sous-processus |
| Sous-processus | `processus.sous_processus` filtre par Processus | |

### Filtres par colonne

| Colonne | Filtre | Source |
|---------|--------|--------|
| Chantiers | Avancement | 8 statuts |
| Produits | Responsable | acteurs (format "Prenom N.") |
| MAE | Etat | Statuts MAE |

### Colonne Chantiers

- Affiche : `num_chantier`, nom, date fin souhaitee
- Clic -> modale ChantierModal (edition)
- Filtre : perimetre du chantier, processus du chantier, avancement
- Les chantiers sans perimetre sont inclus quand TOUS les perimetres sont selectionnes

### Colonne Produits

- Affiche : nom, type de rapport, icone feu tricolore (migration)
- Clic -> modale ProductModal (edition)
- Bouton "Lineage" -> modale LineageModal
- **Calcul du statut migration (feu tricolore)** :
  - **Vert (Migre)** : le shore du produit a `statut_migration` = "Oui"/"Termine"/"Migre" ET tous les flux/projetsDSS/dataflows associes sont migres
  - **Orange (Partiel)** : le shore est migre mais certains flux/projetsDSS/dataflows ne le sont pas
  - **Rouge (Non migre)** : le shore n'est pas migre
- Filtre : perimetre via `produit_perimetres`, processus via `produit_processus`, responsable

### Colonne MAE

- Affiche : cle (lien Jira), resume
- Clic -> modale MAEModal (edition)
- Filtre : `perimetre_mae`, processus du chantier associe, etat

### Logique de filtrage croise

- Les produits sont filtres via les tables de liaison (`produit_perimetres` pour les perimetres, `produit_processus` pour les processus)
- Les MAE sont filtrees par leur champ `perimetre_mae` ET par le processus de leur chantier associe
- Quand tous les perimetres sont selectionnes, les elements sans perimetre sont inclus ; sinon, ils sont exclus

---

## 6. Page Cartographie (Migration)

**Route** : `GET /cartographie`

### Description

Suivi de la migration de donnees a travers un pipeline de 5 entites, avec KPIs, analyse de dependances et tableau de progression.

### Donnees chargees (6 tables)

`produits`, `flux`, `shores`, `projets_dss`, `dataflows`, `tables_mhtech`

### Section 1 - Pipeline KPI (6 cards)

Pipeline horizontal de 6 cartes connectees par des fleches :
1. **Tables MH Tech** : % avec `ok_da` = "Oui" / total
2. **Shores / Golds** : % avec `statut_migration` = "Oui"/"Migre"/"Termine" / total
3. **Projets DSS** : % migres / total
4. **Dataflows** : % migres / total
5. **Produits / Rapports** : % migres / total
6. **Global** : agregation des 5

Chaque carte affiche : icone, pourcentage, label, barre de progression, "migre / total".
Code couleur : vert (>=70%), jaune (>=30%), rouge (<30%).

**Filtre produit** : quand un produit est selectionne, les KPIs sont recalcules uniquement pour les entites liees a ce produit via la chaine de flux. Un badge "filtre" apparait. Bouton "Reinitialiser le filtre".

### Section 2 - Analyse de dependances (Lineage)

- Dropdown de selection de produit
- Quand un produit est selectionne :
  - Recalcul des KPIs filtres
  - Trace la **lignee complete** : Tables MH Tech -> Shores -> Projets DSS -> Dataflows -> Produit
  - Modal `LineageModal` : graphe visuel avec lignes de connexion
  - Details du produit : Responsable, Type, Perimetre, Gold actuel, Probleme migration

**Matching Tables-Shore** : correspondance fuzzy via normalisation (lowercase, suppression underscores/espaces) et comparaison inclusive entre `shore.nom_pour_tables` et `tables_mhtech.uc`.

### Section 3 - Tableau de progression

| Colonne | Description |
|---------|-------------|
| Expand (+/-) | Deplie/replie les flux du produit |
| Produit | Nom du produit |
| Tables MH Tech | Mini barre de progression (migre/total, %, couleur) |
| Shores | Mini barre de progression |
| Projets DSS | Mini barre de progression |
| Dataflows | Mini barre de progression |
| Produit Status | Badge migration |
| Actions | Bouton Lineage |

**Expansion** : clic sur "+" deplie un sous-tableau de flux pour ce produit :

| Colonne flux | Description |
|--------------|-------------|
| Shore/Gold | Nom + icone statut (point colore) |
| Projet DSS | Nom + icone statut |
| Dataflow | Nom + icone statut |
| Charge (jh) | Nombre |
| Estimation | Texte |
| Date prevue | Date formatee |
| Sprint | Nom du sprint |
| Eligible SLA | Oui/Non |
| Commentaire | Texte |
| Actions | Edit / Delete |

### CRUD Flux

- **Ajouter** : modale avec produit pre-rempli (readonly), champs Shore, Projet DSS, Dataflow, Charge, Estimation, Date, Sprint, Eligible SLA, Commentaire
- **Modifier** : meme modale pre-remplie
- **Supprimer** : modale de confirmation avec affichage Produit/Shore/Projet/Dataflow

### Regles metier

- Detection du statut migration : comparaison insensible a la casse, "Termine", "Migre", "Oui" = migre
- Generation de sprints : combine S1-S12 standard + sprints existants dans les flux
- Dates : gerer les serial numbers Excel (jours depuis 1900) ET les formats date standard

---

## 7. Page Parc Applicatif

**Route** : `GET /parc`

### Description

Matrice croisee Produits x Processus (cartographie metier) + vue liste pour le CRUD produits.

### Donnees chargees (5 tables)

`produits`, `processus`, `produit_processus`, `perimetres`, `produit_perimetres`

### Barre de filtres (7 filtres, partages entre les 2 vues)

| Filtre | Type | Cascade |
|--------|------|---------|
| Groupe | Multi-select | -> Perimetre |
| Type | Single select | Types de produits extraits des donnees |
| Responsable | Single select | Avec option "(vide)" pour les champs vides |
| Perimetre | Multi-select | Filtre par Groupes selectionnes |
| Lignes | Single select | Tous / Avec processus / Sans processus |
| Processus | Multi-select | Tries par champ `ordre` |
| Sous-processus | Multi-select | Filtres par Processus selectionnes |

Legende couleurs : Run (vert), Evolution (rose), Backlog (cyan).

### Onglets : "Processus" (matrice) et "Liste"

Bouton "+ Ajouter" pour creer un produit.

### Vue Matrice (onglet Processus)

Tableau croise :
- **Lignes** = produits filtres
- **Colonnes** = processus et sous-processus (en-tetes a 2 niveaux, le processus principal couvre ses sous-processus)
- **Colonnes fixes** a gauche : Nom du produit, Type de rapport
- **Couleur des cellules** : si un lien existe dans `produit_processus`, la cellule est coloree selon le `statut` du produit (Run=vert, Evolution=rose, Backlog=cyan). Sinon, cellule blanche.

### Interactions matrice

| Geste | Action |
|-------|--------|
| Clic sur cellule liee | Supprime le lien (delete de `produit_processus`) |
| Clic sur cellule vide | Popup de choix statut (Run/Evolution/Backlog), puis : 1. cree le lien dans `produit_processus` ; 2. met a jour le `statut` du produit ; 3. met a jour toutes les cellules du produit |
| Ctrl/Cmd + clic | Mode multi-selection (toggle la cellule) |

### Barre d'actions multi-selection

Apparait quand des cellules sont selectionnees :
- Compteur de cellules selectionnees
- Boutons Run / Evolution / Backlog (applique le statut a toutes les cellules selectionnees)
- Bouton Supprimer (retire les liens de toutes les cellules selectionnees)
- Bouton Annuler (deselectionne tout)

### Vue Liste (onglet Liste)

Utilise le composant `DataTable` generique :
- Toutes les colonnes de la table `produits`
- Toolbar (recherche + ajout + refresh) et pagination
- Filtre externe appliquant les memes filtres que la matrice
- Clic sur une ligne -> modale d'edition produit
- Actions : Edit / Delete

### Modale Produit

**Ajout** : formulaire genere depuis la config colonnes de `produits`, avec selects dynamiques (acteurs, shores, perimetres).
**Edition** : meme formulaire pre-rempli.
**Detail** : modale read-only montrant tous les champs en grille + badge statut migration.

### Ordonnancement des processus

Les processus sont tries par le champ `ordre`. Les sous-processus sont regroupes sous leur processus parent (en-tetes 2 niveaux dans la matrice).

### Cascade des filtres

1. **Groupe -> Perimetre** : changer les groupes selectionnes rafraichit le dropdown perimetre
2. **Processus -> Sous-processus** : changer les processus selectionnes rafraichit le dropdown sous-processus

---

## 8. Page Roadmap (Gantt)

**Route** : `GET /roadmap`

### Description

Gantt interactif des chantiers et phases, avec drag & drop, resize, inline editing et export PDF. C'est la page la plus complexe de l'application (~2500 lignes JS dans la version originale).

### Donnees chargees (12 tables)

`chantiers`, `phases`, `phase_liens_url`, `chantier_produits`, `chantier_data_anas`, `notes`, `sprints`, `acteurs`, `perimetres`, `produits`, `data_anas`, `processus`

### Filtres (multi-select avec Tous/Aucun)

| Filtre | Source | Details |
|--------|--------|---------|
| Date debut | Date input | Default : aujourd'hui - 1 mois |
| Date fin | Date input | Default : aujourd'hui + 3 mois |
| Groupe | Groupes de perimetres | Cascade -> Perimetre |
| Perimetre | `perimetres.nom` | Filtre par Groupes |
| Responsable | `acteurs` | Format "Prenom N." |
| Avancement | 8 statuts | Multi-select |
| Perimetre Processus | Derives de processus | Multi-select |

### Logique de filtrage

Un chantier est affiche si :
- Son perimetre est dans les perimetres selectionnes (OU pas de perimetre + tous selectionnes)
- Son responsable est dans les responsables selectionnes
- Son avancement est dans les avancements selectionnes
- Son processus est dans les processus selectionnes
- Au moins une de ses phases chevauche la fenetre temporelle (date debut / date fin)
- Il n'est pas archive (sauf si le toggle archives est actif)

### Rendu du Gantt

#### En-tete (3 lignes)

| Ligne | Contenu |
|-------|---------|
| 1 | Noms des sprints, chacun couvrant ses semaines (colspan) |
| 2 | Numeros de semaines (S01-S52) |
| 3 | Dates du lundi de chaque semaine |

#### Constantes d'affichage

| Constante | Valeur | Description |
|-----------|--------|-------------|
| SPRINT_COL_WIDTH | 90px | Largeur d'une colonne sprint |
| WEEK_COL_WIDTH | 45px | Largeur d'une colonne semaine |
| PHASE_MARGIN | 4px | Marge entre les phases |

#### Marqueurs visuels

- **Sprint courant** : fond vert dans l'en-tete
- **Semaine courante** : bordure pointillee bleue sur la colonne
- **Date fin souhaitee** : trait vertical rouge par chantier

#### Lignes de chantier

Chaque chantier = 1 ligne avec :
- **Panneau gauche** (fixe) : nom du chantier (cliquable -> modale edition), badge avancement
- **Zone Gantt** (scrollable) : barres de phase positionnees horizontalement

#### Barres de phase

- Positionnees par `left` et `width` (pixels) selon le week index de debut et fin
- Colorees selon `CONFIG.PHASE_COLORS[type_phase]`
- Affichent le nom de la phase en texte
- **Multi-lanes** : si des phases se chevauchent, elles sont empilees verticalement dans des lanes non-overlapping

### Algorithme de positionnement des phases

1. `calculatePhasePositions()` : mappe chaque phase a un index de semaine debut/fin dans la fenetre visible
2. `calculatePhaseLanes()` : attribue des lanes verticales. Trie les phases par position de debut, puis assigne chaque phase a la premiere lane ou elle ne chevauche aucune phase existante.

### Systeme de semaines

- ISO 8601 via `getISOWeekNumber()`
- Code semaine : format `AAAAS99` (ex: `2026S05`)
- Helpers : `weekCodeToDate()`, `formatWeekCode()`, `getWeeksForSprint()`, `buildWeeksList()`

### Drag and Drop (implementation custom, pas de librairie)

| Etape | Description |
|-------|-------------|
| Initiation | `mousedown` sur une barre de phase, mouvement > 5px |
| Preview | Rectangle bleu pointille (`gantt-drag-preview`) suit le curseur, contraint a la meme ligne de chantier |
| Detection cellule | `findCellAtPosition(x, y)` identifie la colonne cible |
| Drop | Calcule le delta de semaines, met a jour `sprint_debut`/`sprint_fin` ou `semaine_debut`/`semaine_fin` |
| Sauvegarde | `PUT /roadmap/api/phases/{id}` |

### Resize

| Etape | Description |
|-------|-------------|
| Handle | `.gantt-resize-handle` gauche et droite sur chaque barre de phase |
| Initiation | `mousedown` sur un handle |
| Preview | Rectangle de previsualisation |
| Drop | Calcule la nouvelle semaine de debut ou fin |
| Sauvegarde | `PUT /roadmap/api/phases/{id}` |

### Interactions

| Geste | Action |
|-------|--------|
| Clic simple sur phase | Inline editing (champ texte apparait sur le nom de la phase) |
| Double-clic sur phase | Ouvre PhaseModal en mode edition |
| Clic droit sur phase | Menu contextuel : Modifier, Supprimer, Changer le type |
| Clic sur nom de chantier | Ouvre ChantierModal en mode edition |
| Bouton "+" | Ouvre ChantierModal en mode ajout |
| Toggle Archives | Affiche/masque les chantiers archives |
| Bouton Export | Genere PDF |
| Bouton Refresh | Recharge toutes les donnees |

### Barre de statistiques (KPIs)

- **Nombre de chantiers** affiches
- **JH Vigie total** : somme du champ `jh_vigie` des chantiers visibles
- **JH Pilotage total** : somme du champ `jh_pilotage`
- **Badges avancement** : compteur par statut avec code couleur

### Legende

Affiche les couleurs par type de phase : EB (bleu), Cadrage (vert), Dev (orange), Recette (jaune), MEP (violet).

### Detection archive

Valeurs truthy : `true`, `1`, `"1"`, `"vrai"`, `"oui"`, `"true"` (insensible a la casse).

### Conservation du scroll

Avant chaque re-rendu, sauvegarde `scrollTop`/`scrollLeft` du body, panneau gauche et zone Gantt. Apres le rendu, restauration synchrone.

### Resize fenetre

Handler sur `window.resize` : recalcule les largeurs de toutes les barres de phase.

### Export PDF

Generation cote client via **jsPDF + jsPDF-AutoTable** :
- Grille du Gantt avec les sprints/semaines en en-tete
- Chantiers et phases positionnees visuellement
- Ligne pointillee sur la semaine courante
- Legende des types de phase
- Format paysage A4

### Endpoints API necessaires

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/roadmap` | Page HTML |
| GET | `/roadmap/api/chantiers` | Liste JSON des chantiers avec phases |
| GET | `/roadmap/api/chantiers/{id}` | Detail chantier avec phases, notes, liens |
| POST | `/roadmap/api/chantiers` | Creer un chantier |
| PUT | `/roadmap/api/chantiers/{id}` | Modifier un chantier |
| POST | `/roadmap/api/chantiers/{id}/archive` | Archiver un chantier |
| POST | `/roadmap/api/chantiers/{id}/unarchive` | Desarchiver |
| POST | `/roadmap/api/chantiers/{id}/phases` | Ajouter une phase |
| PUT | `/roadmap/api/phases/{id}` | Modifier une phase (drag & drop, resize, edition) |
| DELETE | `/roadmap/api/phases/{id}` | Supprimer une phase |
| POST | `/roadmap/api/chantiers/{id}/notes` | Ajouter une note |
| PUT | `/roadmap/api/notes/{id}` | Modifier une note |
| DELETE | `/roadmap/api/notes/{id}` | Supprimer une note |

---

## 9. Page MAE (Demandes Data)

**Route** : `GET /mae`

### Description

Suivi des demandes Data (MAE) avec un pipeline visuel et un tableau filtrable/triable.

### Donnees chargees (5 tables)

`mae`, `acteurs`, `mae_notes`, `mae_liens`, `perimetres`

### Section 1 - Pipeline (4 etapes)

Pipeline horizontal : **A faire** -> **En cours** -> **Livre** -> **Valide**

Chaque etape affiche son label et le nombre de demandes dans ce statut.
Normalisation des statuts : comparaison insensible a la casse avec `CONFIG.MAE_STATUTS`.

### Section 2 - Filtres (5 multi-select)

| Filtre | Source | Cascade |
|--------|--------|---------|
| Groupe | Groupes de `perimetres` | -> Perimetre |
| Perimetre | Valeurs de `mae.perimetre_mae` | Filtre par Groupes |
| Etat | `CONFIG.MAE_STATUTS` + statuts trouves dans les donnees | |
| Priorite | Valeurs extraites des donnees | |
| Personne assignee | Valeurs extraites des donnees | |

Bouton "Reinitialiser" : remet tous les filtres a "Tous".
Les valeurs vides deviennent `(Non rempli)`.

### Section 3 - Barre d'actions

- Compteur de resultats ("N demande(s)")
- Bouton "Copie Jira" (import depuis Jira)
- Bouton "+ Nouvelle demande"

### Section 4 - Tableau

| Colonne | Description |
|---------|-------------|
| Cle | Gras, lien cliquable vers Jira (nouvelle fenetre) |
| Resume | Texte |
| Perimetre | Texte |
| Rapporteur | Texte |
| Etat | Badge colore (a-faire/en-cours/livre/valide) |
| Priorite | Texte |
| Personne assignee | Texte |

- En-tetes cliquables pour trier (toggle asc/desc)
- Clic sur une ligne -> modale MAEModal en mode edition
- Etat vide : icone + "Aucune demande"
- **Tri par defaut** : Start Date descendant

### Couleurs des badges statut

| Contient | Classe CSS | Couleur |
|----------|------------|---------|
| "faire" | `a-faire` | gris |
| "cours" | `en-cours` | bleu |
| "livr" | `livre` | vert |
| "valid" | `valide` | vert fonce |

### Modale MAE (MAEModal)

#### Pipeline en haut (mode edition uniquement)

Pipeline read-only montrant les etapes : completees (vert), courante (bleu), futures (gris).

#### Onglet 1 : Demande

| Champ | Type | Editable | Details |
|-------|------|----------|---------|
| Cle | text | Ajout seulement | Cle Jira, verifie l'unicite |
| Resume | text | Oui | |
| Perimetre-MAE | text | Oui | |
| Rapporteur | text | Oui | |
| Start Date | date | Oui | |
| Date souhaitee de livraison | date | Oui | |
| Priorite | text | Non (readonly) | Synchro Jira |
| Etat | text | Non (readonly) | Synchro Jira |
| Description | textarea | Oui | |
| Personne assignee | text | Non (readonly) | Synchro Jira |
| Date d'echeance | date | Oui | |
| Gold | textarea | Oui | Serveurs Gold |
| JH DE | number (step 0.01) | Oui | Jours-homme Data Engineering |
| JH DA | number (step 0.01) | Oui | Jours-homme Data Analysis |
| JH DataViz | number (step 0.01) | Oui | Jours-homme DataViz |
| Parent | text | Non (readonly) | Cle Jira parent |
| Theme | text | Non (readonly) | Calcule par Jira |
| Chantier | select | Oui | Liste des chantiers |

#### Onglet 2 : Notes et Liens

**Section Liens :**
- Ajout : champs nom + URL
- Liste existante : nom cliquable, URL, bouton ouvrir, bouton supprimer
- Stockes dans `mae_liens`

**Section Notes :**
- Ajout : datetime-local (defaut maintenant), redacteur (select acteurs), editeur rich text (contenteditable avec toolbar bold/italic/underline/listes)
- Liste existante : cards triees par date desc, avec date, auteur, contenu HTML, boutons edit/delete
- Stockees dans `mae_notes`

### Import Jira ("Copie Jira")

L'import Jira dans la version PostgreSQL peut etre implemente comme :
1. **Option A** : Import CSV/JSON uploadé par l'utilisateur
2. **Option B** : Appel API Jira direct (si credentials disponibles)
3. **Option C** : Endpoint API recepteur d'un webhook Jira

L'import :
- Cree les demandes nouvelles (cle inexistante)
- Met a jour les champs synchro des demandes existantes : Resume, Perimetre-MAE, Rapporteur, Start Date, Date souhaitee livraison, Priorite, Description, Etat, Personne assignee, Date echeance, Parent, Theme
- Match par le champ `cle` (cle Jira unique)

### Endpoints API necessaires

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/mae` | Page HTML |
| GET | `/mae/api/demandes` | Liste JSON filtrable |
| POST | `/mae/api/demandes` | Creer une demande |
| PUT | `/mae/api/demandes/{id}` | Modifier une demande |
| DELETE | `/mae/api/demandes/{id}` | Supprimer une demande |
| POST | `/mae/api/demandes/{id}/notes` | Ajouter une note |
| PUT | `/mae/api/notes/{id}` | Modifier une note |
| DELETE | `/mae/api/notes/{id}` | Supprimer une note |
| POST | `/mae/api/demandes/{id}/liens` | Ajouter un lien |
| DELETE | `/mae/api/liens/{id}` | Supprimer un lien |
| POST | `/mae/api/import-jira` | Import Jira |

---

## 10. Page Carrousel

**Route** : `GET /carrousel`

### Description

Visualisation SVG circulaire des produits organises par processus metier. Vue graphique de la matrice Produits x Processus.

### Donnees chargees (4 tables)

`produits`, `processus`, `produit_processus`, `perimetres`

### Filtres (multi-select)

| Filtre | Source |
|--------|--------|
| Type de rapport | Valeurs distinctes de `produits.type_rapport` |
| Responsable | Valeurs distinctes de `produits.responsable` + "(Non rempli)" |

### Visualisation SVG

- **ViewBox** : 900 x 1050
- **Centre** : (450, 500)
- **Arcs internes (processus)** : rayon 100-260, chaque processus obtient un arc proportionnel au nombre de ses produits. Couleurs de la palette MH.
- **Cercles externes (produits)** : rayon 290, petits cercles (r=15) positionnes a des angles dans l'arc de leur processus. Remplissage couleur pastel du processus.
- **Labels** : positionnes a rayon 380, rotation suivant l'arc
- **Lignes de connexion** : traits fins de l'arc interne vers les cercles externes

### Palette de couleurs (9 themes MH)

| Nom | Pastel | Douce | Intense |
|-----|--------|-------|---------|
| Corail | #F4B8A5 | #ED8C6F | #E5603A |
| Bleu | #A5C8E1 | #6FA3CC | #3A7EB7 |
| Violet | #C5A5D9 | #A06FBF | #7B3AA5 |
| Turquoise | #A5D9D1 | #6FBFB3 | #3AA595 |
| Rose | #D9A5C5 | #BF6FA0 | #A53A7B |
| Jaune | #F2DDA0 | #E8C96A | #DEB534 |
| Vert | #B8D9A5 | #8FBF6F | #66A53A |
| Rose Chair | #F2CFC0 | #E8AB93 | #DE8766 |
| Gris Sable | #D9D1C5 | #BFB3A0 | #A5957B |

### Regroupement

`groupProductsByProcess()` :
1. Lit la table `produit_processus` pour mapper produits -> processus
2. Groupe par nom de processus
3. Trie alphabetiquement les produits dans chaque processus
4. Deduplique les produits presents dans plusieurs sous-processus du meme processus

### Interactions

| Geste | Cible | Action |
|-------|-------|--------|
| Clic | Arc processus | Ouvre modale ProcessModal |
| Clic | Cercle produit | Ouvre modale ProductModal |
| Hover | Cercle produit | Agrandissement (r: 15 -> 20), texte gras + fond rect |
| Hover | Arc processus | Eclaircissement leger |
| Ctrl+Molette | Partout | Zoom in/out (0.5x - 2.0x, pas 0.1) |

### Zoom

- **Declencheur** : Ctrl/Cmd + molette
- **Plage** : 0.5x a 2.0x, pas de 0.1
- **Point focal** : centre sur la position du curseur
- **Transform** : CSS `transform: scale()` sur le container SVG

---

## 11. Pages Parametres

### 11.1 Accueil Parametres

**Route** : `GET /parametres`

Grille thematique de cartes navigant vers le CRUD generique.

#### Themes (4 groupes)

| Theme | Icon | Couleur | Tables |
|-------|------|---------|--------|
| Migration | :arrows_counterclockwise: | bleu | Flux, Tables MHTech, Shores, Projets DSS, Dataflows |
| Parametres | :gear: | gris | Acteurs, Equipes, Processus, Perimetres |
| Planification | :calendar: | vert | Programmes, Sprints, Capacite |
| Activites | :briefcase: | orange | Chantiers, Phases, DataAna |

Chaque carte affiche : icone, nom de la table, overlay "Configurer" au survol.
Clic -> navigation vers `/parametres/<table_key>`.

### 11.2 CRUD Generique

**Route** : `GET /parametres/<table_key>`

Page generique qui s'adapte a n'importe quelle table de CONFIG. Utilise le composant `DataTable` avec les colonnes definies pour la table.

#### Comportement standard

- Toolbar : recherche globale, bouton "+ Ajouter", bouton "Rafraichir"
- Tableau avec pagination, tri, recherche
- Actions par ligne : Modifier, Supprimer
- Modale d'ajout/edition avec formulaire genere depuis la config colonnes

#### Comportements specifiques par table

##### Table CHANTIER

- **Filtres supplementaires** : Perimetre (multi-select), Responsable (multi-select), Avancement (multi-select)
- **Colonnes masquees** : Archive, Processus, Enjeux, Description
- **Modales** : delegue a `ChantierModal` (pas le formulaire generique)

##### Table DATAANA

- **Filtres supplementaires** : Etat (multi-select, exclut "Resolue" par defaut), Personne assignee (multi-select)
- **Import Jira** : bouton "Copier depuis Jira" (importe depuis source Jira, `skipStates: ['Resolue']`, `updateFields: ['Etat']`)

##### Table PROCESSUS

- **Drag & drop** : reordonnancement par glisser-deposer (met a jour le champ `ordre`)

#### Formulaire generique (genere depuis la config)

| Type de champ | Element HTML | Details |
|---------------|-------------|---------|
| text | `<input type="text">` | Avec maxlength si specifie |
| email | `<input type="email">` | Validation email |
| number | `<input type="number" step="any">` | Decimaux autorises |
| date | `<input type="date">` | Format YYYY-MM-DD |
| select | `<select>` | Statique (options) ou dynamique (source table) |
| textarea | `<textarea>` | 3 lignes par defaut |
| checkbox | `<input type="checkbox">` | Oui/Non |
| color | `<input type="color">` | Selecteur de couleur |

**Selects dynamiques** : pour les champs avec `source` (ex: Responsable -> Acteurs), charge les valeurs depuis la table reference.
- ACTEURS : affiche "Prenom Nom", valeur = email
- PROCESSUS : trie par `ordre`
- Autres : valeurs simples

#### Validation

- Champs `required` non vides
- Format email valide (regex)
- Nombres parsables
- CSS `.is-invalid` + message d'erreur sous le champ

### Endpoints API necessaires

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/parametres` | Page accueil |
| GET | `/parametres/<key>` | Page CRUD pour la table |
| GET | `/parametres/api/<key>` | Liste JSON des lignes |
| POST | `/parametres/api/<key>` | Creer une ligne |
| PUT | `/parametres/api/<key>/{id}` | Modifier une ligne |
| DELETE | `/parametres/api/<key>/{id}` | Supprimer une ligne |
| PUT | `/parametres/api/<key>/reorder` | Reordonner (pour tables sortable) |
| POST | `/parametres/api/<key>/import-jira` | Import Jira (pour DATAANA) |

---

## 12. Composants reutilisables

### 12.1 DataTable

Composant de tableau generique avec :

| Fonctionnalite | Description |
|----------------|-------------|
| Toolbar | Recherche globale (debounce 300ms), boutons Ajouter / Rafraichir |
| Pagination | Taille configurable (10/20/50/100), navigation premiere/precedente/suivante/derniere |
| Tri | Clic sur en-tete : none -> asc -> desc -> none. Icones directionnelles. |
| Filtres par colonne | Sous les en-tetes. Texte ou select selon le nombre de valeurs distinctes. |
| Filtre externe | Fonction de filtre custom injectable (pour filtres multi-select). |
| Actions par ligne | Boutons Edit / Delete (configurables). |
| Checkboxes | Select individuel + select all en en-tete. `getSelectedRows()`. |
| Drag & drop reorder | Pour tables avec `sortable: true`. Handle grip a gauche. Met a jour champ `ordre`. |
| Formatage cellules | Dates, nombres, URLs, emails (-> "Prenom N."), cles Jira (-> lien), statuts (-> badge colore), texte long (tronque 50 car). |
| Loading | Spinner overlay pendant le chargement. |

### 12.2 Modale (systeme)

Systeme de modales empilables :
- `openModal(title, content, options)` : ouvre une modale
- Options : `size` (small/medium/large/xlarge), `onClose` callback
- Fermeture : bouton X, clic overlay, touche Escape
- Empilage : plusieurs modales peuvent etre ouvertes simultanement

### 12.3 ChantierModal

Modale specialisee pour les chantiers (ajout et edition).

**Charge 15 tables** en parallele a l'ouverture.

#### Mode Ajout

Formulaire simple (pas d'onglets) avec :
- Chantier (text, required), Code, Responsable (select acteurs, exclut equipe RPP), Perimetre (select), Programme (select), Processus (select), Avancement (select 8 valeurs), Date fin souhaitee (date), Archive (checkbox), JH Vigie (number), JH Pilotage (number), Description (rich text), Enjeux (rich text)
- Auto-numbering : `C-YYYY-NNN`

#### Mode Edition (4 onglets)

**Mini Roadmap** (toujours visible au-dessus des onglets) :
- Gantt read-only des phases du chantier
- Meme algorithme de lanes que la page Roadmap
- Marqueur "Date fin souhaitee"
- Couleurs par type de phase

**Onglet 1 - General** : memes champs que l'ajout, pre-remplis + editeur rich text HTML

**Onglet 2 - Phases** :
- Tableau : Phase, Type, Mode, Debut, Fin, Date debut, Date fin
- Bouton "Ajouter une phase" -> PhaseModal
- Double-clic sur ligne -> PhaseModal edition

**Onglet 3 - Associations** (3 colonnes + section liens) :
- **Produits** : bouton "Assigner" -> modale checkbox, liste des produits associes
- **DataAnas** : bouton "Assigner" -> modale checkbox, liste des DataAnas associes
- **MAE** : liste read-only (filtree par chantier)
- **Liens** : ajout nom+URL, liste existante avec delete

**Onglet 4 - Notes** :
- Ajout : datetime-local, redacteur (select acteurs), editeur rich text
- Liste : cards triees par date desc, date, auteur, contenu HTML, edit/delete

#### Sauvegarde

1. Cree/met a jour la ligne `chantiers`
2. Synchronise `chantier_produits` : supprime les retires, ajoute les nouveaux
3. Synchronise `chantier_data_anas` : idem
4. Synchronise `chantier_liens` : delete-all puis add
5. Met a jour `mae.chantier_id` pour les MAE associees

### 12.4 PhaseModal

Modale pour ajout/edition de phases.

#### Champs

| Champ | Type | Details |
|-------|------|---------|
| Phase | text | Required |
| Type phase | select | EB, Cadrage, Dev, Recette, MEP |
| Description | textarea | |
| Chantier | text (readonly) | Nom du chantier parent |
| Mode | radio toggle | Sprint ou Semaine |
| Sprint debut | select | (mode Sprint) |
| Sprint fin | select | (mode Sprint) |
| Semaine debut | text pattern | Format AAAAS99 (mode Semaine) |
| Semaine fin | text pattern | Format AAAAS99 (mode Semaine) |
| Lien Teams | text URL | |
| Liens supplementaires | lignes dynamiques | nom + URL + delete |

#### Validation

- Nom phase required
- Mode Sprint : les 2 sprints doivent etre selectionnes
- Mode Semaine : les 2 semaines doivent correspondre au regex `/^\d{4}S\d{2}$/`

#### Sauvegarde

1. Collecte les donnees, assigne la couleur depuis `CONFIG.PHASE_COLORS[type_phase]`
2. Cree ou met a jour `phases`
3. Gere `phase_liens_url` : delete-all puis add (lien Teams + liens supplementaires)

### 12.5 MAEModal

Voir [section 9 - Modale MAE](#modale-mae-maemodal).

### 12.6 LineageModal

Modale de visualisation de la lignee de migration d'un produit :
- Graphe visuel avec lignes de connexion
- 5 niveaux : Tables MH Tech -> Shores -> Projets DSS -> Dataflows -> Produit
- Chaque entite avec son statut migration (couleur)
- Details du produit : Responsable, Type, Perimetre, Gold actuel, Probleme migration

### 12.7 Editeur Rich Text

Utilise dans ChantierModal (Description, Enjeux) et MAEModal (Notes) :
- `contenteditable` div
- Toolbar : Gras, Italique, Souligne, Liste a puces, Liste numerotee
- Contenu stocke en HTML dans la BDD

### 12.8 Multi-select Dropdown

Pattern de filtre reutilise partout :
- Bouton dropdown affichant le label courant
- Panel avec boutons "Tous" / "Aucun"
- Checkboxes individuelles
- Labels contextuels : "Tous", "Aucun", valeur unique, "N selectionnes"
- Gestion de `(Non rempli)` pour les valeurs vides

---

## 13. Charte graphique

### Theme clair (defaut)

```css
--of-bg-primary: #ffffff
--of-bg-secondary: #f8f9fa
--of-text-primary: #2d2d2d
--of-accent: #0066CC
--of-border: #e0e0e0
--carto-surface: #ffffff
--carto-text: #2d2d2d
--carto-border: #e0e0e0
```

### Theme sombre

```css
--of-bg-primary: #1a1a2e
--of-bg-secondary: #16213e
--of-text-primary: #e0e0e0
--of-accent: #4da6ff
--of-border: #2a2a4a
--carto-surface: #1e1e3a
--carto-text: #e0e0e0
--carto-border: #2a2a4a
```

### Couleurs Malakoff Humanis

```css
--mh-corail-brand: #E2250C
--mh-bleu-dark: #1A283E
--mh-vert-dark: #008275
--mh-jaune-dark: #F9BD00
--mh-rose-dark: #D81E88
```

### Couleurs de statut

```css
--status-migre: #28A745       /* vert */
--status-en-cours: #FFC107    /* jaune */
--status-non-migre: #DC3545   /* rouge */
```

### Couleurs de phase

```css
--phase-eb: #4A90D9           /* bleu */
--phase-cadrage: #82C341      /* vert */
--phase-dev: #F5A623          /* orange */
--phase-recette: #F8E71C      /* jaune */
--phase-mep: #9B59B6          /* violet */
```

### Typographie

- Font : `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- Taille de base : 14px
- Headers : font-weight 600

### Boutons

```css
.btn-primary   /* Bleu accent - action principale */
.btn-secondary /* Gris - action secondaire */
.btn-danger    /* Rouge - suppression */
.btn           /* Bouton de base */
```

### Header

- Hauteur fixe : 40px
- Fond sombre : `#2d2d2d`
- Texte blanc

### Sidebar

- Largeur etendue : 260px
- Largeur collapsed : 60px
- Transition animee
- Item actif : fond accent + bordure gauche

---

## 14. Import de donnees Excel

### Script d'import existant

Un script Python `scripts/import_excel.py` lit le fichier `Cartographie.xlsx` (le meme fichier utilise par CartoExcel) et importe toutes les donnees dans PostgreSQL.

### Tables importees (dans l'ordre pour respecter les FK)

1. Equipes
2. Perimetres
3. Shores
4. Processus
5. Sprints
6. Acteurs (avec resolution `equipe_id`)
7. Produits (avec resolution `responsable_id`, `backup_id`, `shore_ids`, `perimetre_id`)
8. Projets DSS (avec resolution `responsable_id`)
9. Dataflows (avec resolution `responsable_id`)
10. Tables MHTech (avec resolution `shore_id`)
11. Chantiers (avec resolution `responsable_id`, `perimetre_id`, `processus_id`)
12. Phases (avec resolution `chantier_id`, `sprint_debut_id`, `sprint_fin_id`)
13. DataAna
14. MAE (avec resolution `chantier_id`)
15. Tables de liaison : ProduitProcessus, ProduitPerimetre, Flux, ChantierProduit, ChantierDataAna, etc.

### Gestion des donnees

- Parsing de dates : formats ISO + francais + serial Excel
- Parsing booleens : "oui"/"non"/"true"/"false" -> True/False
- Troncature des chaines longues
- Deduplication via contraintes d'unicite
- `tenant_id` par defaut pour toutes les lignes importees

---

## 15. Regles metier transverses

### Acteurs

- Identifies par email (unique par tenant)
- Affiches en "Prenom N." (initiale du nom + point) partout dans l'UI
- Le select acteurs dans les formulaires affiche "Prenom Nom" mais stocke l'email (ou l'ID en PostgreSQL)

### Statuts de migration

Comparaison **insensible a la casse**. Valeurs considerees comme "migre" :
- "Termine", "Migre", "Oui" (dans les 3 cas)

### Filtres

- Pattern commun multi-select avec Tous/Aucun
- Valeurs vides representees par `(Non rempli)` dans les filtres
- Cascades : Groupe -> Perimetre, Processus -> Sous-processus
- Les elements sans valeur de filtre sont inclus quand "Tous" est selectionne, exclus sinon

### Dates

- Stockage PostgreSQL : types `Date` et `DateTime` natifs
- Affichage : format francais `JJ/MM/AAAA`
- Inputs HTML : format `YYYY-MM-DD` (natif)
- Semaines : ISO 8601, code `AAAAS99`

### Suppression en cascade

Les tables enfants (`phase_liens_url`, `notes`, `mae_notes`, `mae_liens`, `chantier_produits`, `chantier_data_anas`, `chantier_liens`) sont supprimees automatiquement via `cascade="all, delete-orphan"` quand le parent est supprime.

### Rich text

Les champs description/enjeux/notes stockent du HTML. L'editeur utilise `contenteditable` + `execCommand`. Le contenu est rendu tel quel dans les modales de visualisation (attention XSS : sanitizer cote serveur recommande).

### Auto-numbering des chantiers

Format `C-YYYY-NNN` :
1. Annee courante (4 chiffres)
2. Numero incremental (3 chiffres, zero-padded)
3. Scan des chantiers existants pour trouver le max de l'annee courante

### Pagination

- Taille par defaut : 20 lignes
- Options : 10, 20, 50, 100
- Navigation : premiere, precedente, numero de page, suivante, derniere

### Securite

- Tous les contenus utilisateur inseres dans le HTML doivent etre echappes (`escapeHtml`)
- Les attributs onclick inline utilisent `escapeJsString`
- Validation des entrees cote serveur (Pydantic schemas)
- Protection CSRF pour les mutations
- Role-gating : certaines actions reservees aux admin/manager

### Performance

- Chargement parallele des tables (`Promise.all` cote JS, `asyncio.gather` cote Python si necessaire)
- Pagination cote serveur pour les grandes tables
- Eager loading SQLAlchemy (`joinedload`, `selectinload`) pour eviter le N+1
- Debounce sur la recherche (300ms)

---

## Annexe A - Constantes de configuration

### CONFIG.MAE_STATUTS

```python
MAE_STATUTS = ['A faire', 'En cours', 'Livre', 'Valide']
```

### CONFIG.PHASE_COLORS

```python
PHASE_COLORS = {
    'EB': '#4A90D9',
    'Cadrage': '#82C341',
    'Dev': '#F5A623',
    'Recette': '#F8E71C',
    'MEP': '#9B59B6'
}
```

### CONFIG.MIGRATION_STATUS

```python
MIGRATION_STATUS = {
    'Migre': {'color': '#28A745', 'label': 'Migre'},
    'En cours': {'color': '#FFC107', 'label': 'En cours'},
    'Non migre': {'color': '#DC3545', 'label': 'Non migre'},
    'Bloque': {'color': '#6c757d', 'label': 'Bloque'}
}
```

### CONFIG.PROCESS_STATUS (couleurs matrice Parc)

```python
PROCESS_STATUS = {
    'Run': '#d4edda',        # vert pastel
    'Evolution': '#f8d7da',  # rose pastel
    'Backlog': '#d1ecf1'     # cyan pastel
}
```

### CONFIG.AVANCEMENT (ordonne)

```python
AVANCEMENT = [
    'Non demarre',
    'En cadrage',
    'Cadre',
    'En developpement',
    'Developpe',
    'En recette',
    'Recette',
    'Termine'
]
```

### CONFIG.GANTT

```python
GANTT = {
    'SPRINT_COL_WIDTH': 90,   # px
    'WEEK_COL_WIDTH': 45,     # px
    'PHASE_MARGIN': 4          # px
}
```

### CONFIG.PAGINATION

```python
PAGINATION = {
    'DEFAULT_PAGE_SIZE': 20,
    'PAGE_SIZE_OPTIONS': [10, 20, 50, 100]
}
```

### CONFIG.CAPACITE

```python
CAPACITE_DEFAUT = 15  # jours/sprint/acteur
COEF_SECURITE = 2.0
```

---

## Annexe B - Groupes de perimetres

Les perimetres sont regroupes via le champ `groupe` de la table `perimetres`. Les groupes sont utilises comme premier niveau de filtrage dans les multi-select cascades. Les valeurs exactes des groupes dependent des donnees importees.

---

## Annexe C - Etat de l'implementation existante

L'app `apps/carto/` dans le repo Linkzen contient deja :

| Element | Statut | Commentaire |
|---------|--------|-------------|
| Models (23 tables) | Fait | A verifier/completer (programmes, produit_perimetres) |
| Migrations Alembic | Fait | 3 migrations |
| Routers auth | Fait | OAuth cross-subdomain |
| Page Home/Dashboard | Fait | Stats de base |
| Page Cartographie | Partiel | Pipeline + table, a verifier completude |
| Page Parc | Partiel | Matrice + liste, a verifier interactions |
| Page Roadmap | Avance | Gantt + drag & drop + modales + PDF export |
| Page MAE | Absent | A implementer |
| Page Synthese | Absent | A implementer |
| Page Carrousel | Absent | A implementer |
| Pages Parametres | Fait | CRUD pour 15+ tables |
| Import Excel | Fait | Script fonctionnel |
| Tests | Absent | A implementer |
| Schemas Pydantic | Absent | A implementer (validation) |
| Services | Absent | A implementer (logique metier) |
