# Skill: add-page

Ajouter une nouvelle page/vue fonctionnelle a l'application CartoExcel.

## Parametres attendus
L'utilisateur fournit : le nom de la page, sa description fonctionnelle, les tables utilisees.

## Etapes

### 1. Creer le fichier JS dans `js/pages/`

Creer `js/pages/<nom-page>.js` en suivant le pattern des pages existantes :

```javascript
/* ===========================================
   NOM-PAGE.JS - Description de la page
   Application Carto
   =========================================== */

class NomPage {
    constructor() {
        // Etat de la page
    }

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <h2>Titre de la page</h2>
            </div>
            <div class="page-content" id="pageContent">
                <!-- Contenu -->
            </div>
        `;
        await this.loadData();
    }

    async loadData() {
        // Charger les donnees via readTable()
    }
}
```

Pages existantes pour reference : `migration.js`, `parc.js`, `roadmap-chantiers.js`, `mae.js`, `params.js`.

### 2. Ajouter le CSS si necessaire

Si la page necessite des styles specifiques, creer `css/<nom-page>.css` et l'inclure dans `html/app.html` avec un parametre cache bust `?v=X.Y.Z`.

### 3. Enregistrer dans CONFIG.NAVIGATION (`js/config.js`)

Ajouter dans `CONFIG.NAVIGATION.FONCTIONNEL` :
```javascript
{ id: '<nom-page>', label: 'Label Menu', icon: '&#128XXX;', page: '<nom-page>' }
```

### 4. Ajouter le routage dans `app.js`

Dans la fonction `navigateTo()` de `js/app.js`, ajouter le case pour la nouvelle page :
```javascript
case '<nom-page>':
    const nomPage = new NomPage();
    await nomPage.render(container);
    break;
```

### 5. Ajouter l'entree sidebar dans `html/app.html`

Dans la section `nav-section` fonctionnel :
```html
<div class="nav-item" data-page="<nom-page>" data-tooltip="Label">
    <span class="nav-item-icon">&#128XXX;</span>
    <span class="nav-item-text">Label Menu</span>
</div>
```

### 6. Inclure le script dans `html/app.html`

Ajouter avant `app.js` :
```html
<script src="../js/pages/<nom-page>.js?v=X.Y.Z"></script>
```

### 7. Verifier

- La page apparait dans le menu lateral
- La navigation fonctionne
- Les donnees se chargent via le bridge
