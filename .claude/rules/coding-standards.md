# Coding Standards - CartoExcel

## Langage
- **Vanilla JavaScript uniquement** : pas de React, Vue, Angular, jQuery ou autre framework/librairie
- ES6+ : classes, arrow functions, template literals, destructuring, spread operator
- `async/await` pour tout code asynchrone (jamais `.then()/.catch()`)

## Nommage
- **Fonctions et variables** : `camelCase` (ex: `loadData`, `currentPage`, `tableConfig`)
- **Classes** : `PascalCase` (ex: `ParamsPage`, `Sidebar`, `ExcelBridge`)
- **Constantes globales** : `UPPER_SNAKE_CASE` (ex: `CONFIG`, `APP_VERSION`)
- **Tables Excel** : prefixe `t` + `PascalCase` (ex: `tActeurs`, `tChantierProduit`)
- **Cles CONFIG.TABLES** : `UPPER_SNAKE_CASE` (ex: `ACTEURS`, `CHANTIER_PRODUIT`)
- **Fichiers** : `kebab-case` (ex: `excel-bridge.js`, `roadmap-chantiers.js`)
- **IDs HTML** : `camelCase` (ex: `btnOpenApp`, `statusText`, `sidebarNav`)
- **Classes CSS** : `kebab-case` (ex: `nav-item`, `sidebar-header`, `btn-action`)

## Structure des fichiers JS
Chaque fichier commence par un header :
```javascript
/* ===========================================
   NOM-FICHIER.JS - Description courte
   Application Carto
   =========================================== */
```

## Commentaires
- En **francais**
- JSDoc pour les fonctions publiques
- Commentaires de section avec `// ===` pour les blocs importants

## Style
- Suivre le style existant du fichier (point-virgule ou non selon le fichier)
- Indentation : 4 espaces
- Guillemets simples pour les strings JS, doubles pour les attributs HTML

## Classes ES6
Les composants et pages utilisent des classes :
```javascript
class MonComposant {
    constructor(options = {}) { }
    async render(container) { }
    destroy() { }
}
```
