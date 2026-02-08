# CartoExcel

Application Excel Office.js (Add-in).
Pilotage du parc applicatif, suivi de migration de donnees et planification de ressources.

---

## Installation pour le developpement

### Prerequis

- **Excel** Desktop (Windows/Mac) ou Excel Online
- **Git** pour cloner le projet
- **Claude Code** (CLI) pour le developpement assiste par IA
- Un navigateur pour acceder a GitHub Pages

### 1. Cloner le projet

```bash
git clone https://github.com/planel-net/Carto-Dev.git
cd Carto-Dev
```

### 2. Rendre les hooks executables

Les hooks Claude Code sont des scripts shell. Apres le clone, il faut les rendre executables :

```bash
chmod +x .claude/hooks/*.sh
```

### 3. Charger l'add-in dans Excel

#### Excel Desktop (Windows/Mac)

1. Ouvrir Excel avec le fichier `Cartographie.xlsx`
2. Aller dans **Insertion** > **Complements** > **Obtenir des complements**
3. Cliquer sur **Charger mon complement** (en bas a gauche)
4. Cliquer sur **Parcourir** et selectionner le fichier `manifest.xml`
5. Cliquer sur **Charger**
6. Le bouton "Carto" apparait dans le ruban, onglet Accueil

#### Excel Online

1. Ouvrir Excel Online (office.com) et ouvrir le classeur
2. Aller dans **Insertion** > **Complements Office**
3. Cliquer sur **Charger mon complement**
4. Selectionner le fichier `manifest.xml`
5. Cliquer sur **Charger**

### 4. Utiliser l'application

1. Cliquer sur le bouton **Carto** dans le ruban
2. Le volet lateral (taskpane) s'ouvre
3. Cliquer sur **Deverrouiller le classeur**
4. Cliquer sur **Ouvrir l'application** pour l'interface plein ecran

---

## Developper avec Claude Code

### Lancer Claude Code

```bash
cd Carto-Dev
claude
```

Claude Code charge automatiquement :
- `CLAUDE.md` : architecture, data model, conventions du projet
- `.claude/rules/` : regles de codage, patterns Excel, CSS, git, securite
- `.claude/hooks/` : verifications automatiques a chaque edition

### Commandes disponibles (Skills)

Taper ces commandes directement dans Claude Code :

| Commande | Description |
|----------|-------------|
| `/deploy` | Deployer : verifie les modifs, met a jour le cache bust, commit, push, verifie GitHub Pages |
| `/add-table` | Ajouter une nouvelle table Excel : CONFIG.TABLES, CRUD, bridge, navigation |
| `/add-page` | Ajouter une nouvelle page/vue : fichier JS, CSS, routing, sidebar |
| `/add-component` | Creer un composant reutilisable : classe ES6, styles, integration |
| `/fix-bridge` | Diagnostiquer un probleme de communication Dialog/Taskpane |
| `/test-scenario` | Generer un scenario de test complet pour une fonctionnalite |
| `/cache-bust` | Mettre a jour les versions `?v=X.Y.Z` dans les fichiers HTML |
| `/review` | Revue de code : patterns Office.js, bridge, conventions, securite |

### Agents specialises

Pour des taches complexes, demander a Claude d'utiliser un agent specialise :

| Agent | Expertise |
|-------|-----------|
| `front-dev` | Composants UI, DOM, vanilla JS, pages |
| `back-dev` | CRUD Excel, ExcelBridge, cache, donnees |
| `tester` | Scenarios de test, debugging Office.js (F12) |
| `excel-panel` | Manifest, Dialog API, protection classeur |
| `ux-designer` | Charte graphique MH, CSS, accessibilite |
| `architect` | Patterns, refactoring, performance, structure |
| `claude-expert` | Configuration Claude Code, CLAUDE.md, workflow |

Exemple : *"Utilise l'agent front-dev pour ajouter un filtre sur la page Parc"*

### Hooks automatiques

Ces verifications se declenchent automatiquement :

| Moment | Verification |
|--------|-------------|
| Avant edition JS/CSS | Rappel des conventions (vanilla JS, variables CSS MH) |
| Avant push git | Verification des URLs dans manifest.xml |
| Apres edition config.js | Alerte sur les impacts potentiels |
| Fin de session | Verification coherence des versions de cache bust |

---

## Architecture

```
Excel (host)
  |
  +-- Taskpane (sidebar) -- acces direct a Excel via Office.js
  |     taskpane.js, excel-utils.js, auth.js
  |
  +-- Dialog (plein ecran) -- UI principale, PAS d'acces direct a Excel
        app.js, excel-bridge.js, pages/*, components/*
        Communique avec le Taskpane via ExcelBridge
```

**Regle critique** : le Dialog ne peut pas appeler `Excel.run()`. Toutes les operations Excel passent par le bridge (messages JSON entre Dialog et Taskpane).

Voir `CLAUDE.md` pour la documentation technique complete.

---

## Structure des fichiers

```
CartoExcel/
  manifest.xml              # Manifest Office Add-in
  CLAUDE.md                 # Documentation technique pour Claude Code
  README.md                 # Ce fichier
  html/
    taskpane.html           # Sidebar Excel (point d'entree)
    app.html                # Application plein ecran
  css/                      # Styles (variables MH, composants, pages)
  js/
    config.js               # Configuration centralisee (tables, navigation)
    taskpane.js             # Logique sidebar + handler bridge
    app.js                  # Routage + wrappers bridge
    utils/                  # Helpers, CRUD Excel, bridge, cache, auth
    components/             # Modal, table, form, sidebar, chart
    pages/                  # Migration, parc, roadmap, MAE, params
  assets/                   # Icones et images
  .claude/
    agents/                 # 7 agents specialises
    skills/                 # 8 commandes (slash commands)
    rules/                  # 6 fichiers de conventions
    hooks/                  # 5 scripts de verification automatique
    settings.json           # Configuration partagee (hooks)
```

---

## Conventions

- **JavaScript** : vanilla JS uniquement, pas de framework ni bundler
- **CSS** : variables dans `variables.css`, charte Malakoff Humanis
- **Commits** : en francais, format `[Composant] : description` ou `vX.Y.Z - Description`
- **Tables Excel** : prefixe `t` + PascalCase (ex: `tChantiers`, `tProduits`)
- **Deploiement** : GitHub Pages, deux repos separes (Dev / Prod)

---

## Environnements

| | Developpement | Production |
|---|---|---|
| Repo | `planel-net/Carto-Dev` | `planel-net/Carto` |
| URL | `planel-net.github.io/Carto-Dev/` | `planel-net.github.io/Carto/` |
| Nom dans Excel | Carto (DEV) | Carto |
| Badge visuel | Orange "DEV" | Masque |

Pour deployer en production : copier les fichiers valides de `Carto-Dev` vers `Carto`, mettre a jour la version dans le manifest, push.
