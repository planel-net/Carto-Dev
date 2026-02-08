# Skill: add-component

Creer un nouveau composant reutilisable pour l'application CartoExcel.

## Parametres attendus
L'utilisateur fournit : le nom du composant, son role, ses interactions.

## Etapes

### 1. Creer le fichier JS dans `js/components/`

Creer `js/components/<nom-composant>.js` en suivant le pattern classe ES6 :

```javascript
/* ===========================================
   NOM-COMPOSANT.JS - Description
   Application Carto
   =========================================== */

class NomComposant {
    constructor(options = {}) {
        this.options = options;
        // Proprietes du composant
    }

    render(container) {
        // Generer le HTML du composant
    }

    destroy() {
        // Nettoyage des event listeners
    }
}
```

Composants existants pour reference :
- `sidebar.js` : Menu lateral avec toggle et navigation
- `modal.js` : Modales generiques
- `table.js` : Tableau de donnees avec tri et pagination
- `form.js` : Formulaires dynamiques bases sur CONFIG.TABLES
- `chart.js` : Graphiques
- `chantier-modal.js` : Modale specifique chantiers (onglets)
- `phase-modal.js` : Modale specifique phases
- `mae-modal.js` : Modale specifique MAE

### 2. Conventions

- Classe ES6 avec constructeur prenant un objet `options`
- Methode `render(container)` pour l'affichage
- Methode `destroy()` pour le nettoyage
- Prefixer les IDs HTML generes pour eviter les collisions
- Utiliser les variables CSS de `variables.css` pour les couleurs
- Commentaires en francais

### 3. Ajouter les styles

Si le composant necessite des styles, les ajouter dans `css/components.css` ou creer un fichier CSS dedie si les styles sont consequents.

### 4. Inclure dans les HTML

Ajouter le script dans `html/app.html` (et/ou `html/taskpane.html` si utilise dans le taskpane) avant `app.js` :
```html
<script src="../js/components/<nom-composant>.js?v=X.Y.Z"></script>
```

### 5. Documenter l'API du composant

Ajouter des commentaires JSDoc sur les methodes publiques du composant.
