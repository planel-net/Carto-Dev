# Gestion de la mémoire - CartoExcel

## Problématique

L'application accumule des données en mémoire lors de l'utilisation prolongée :
- Instances de pages jamais détruites
- Cache mémoire qui grossit indéfiniment
- Event listeners fantômes
- localStorage qui grossit sans limite

## Règles obligatoires

### 1. Cycle de vie des pages (CRITIQUE)

Toute page (classe) **DOIT** implémenter une méthode `destroy()` pour libérer les ressources.

#### Template destroy() pour les pages

```javascript
class MaPage {
    constructor() {
        this.donnees = [];
        this.autresDonnees = [];
        this.selectedItems = new Set();
        this.filters = { ... };
    }

    async render(container) {
        // ... rendu
    }

    /**
     * Détruit l'instance et libère la mémoire
     */
    destroy() {
        console.log('[MaPage] Destroying instance...');

        // 1. Vider TOUS les arrays volumineux
        this.donnees = [];
        this.autresDonnees = [];

        // 2. Nettoyer les Sets/Maps
        if (this.selectedItems) {
            this.selectedItems.clear();
        }

        // 3. Réinitialiser les objets complexes
        this.filters = null;

        // 4. Supprimer les listeners ConnectionStatus si utilisés
        if (this.statusListener) {
            ConnectionStatus.removeListener(this.statusListener);
            this.statusListener = null;
        }

        // Note: Les event listeners DOM sont automatiquement
        // nettoyés quand le DOM est remplacé (container.innerHTML = ...)

        console.log('[MaPage] Instance destroyed');
    }
}
```

#### Fonction render globale

La fonction `renderMaPage()` **DOIT** retourner l'instance :

```javascript
let maPageInstance = null;

/**
 * @returns {MaPage} Instance de la page
 */
async function renderMaPage(container) {
    maPageInstance = new MaPage();
    await maPageInstance.render(container);
    return maPageInstance; // IMPORTANT: retourner l'instance
}
```

### 2. Event Listeners

#### Listeners ConnectionStatus

Si une page s'abonne à `ConnectionStatus.onChange()`, elle **DOIT** se désabonner dans `destroy()` :

```javascript
constructor() {
    // Stocker la référence du listener
    this.statusListener = (status, lastSync) => {
        this.updateStatusUI(status, lastSync);
    };
    ConnectionStatus.onChange(this.statusListener);
}

destroy() {
    // Se désabonner
    if (this.statusListener) {
        ConnectionStatus.removeListener(this.statusListener);
        this.statusListener = null;
    }
}
```

#### Listeners DOM

Les listeners sur des éléments DOM sont **automatiquement nettoyés** quand on fait `container.innerHTML = ...`, donc pas besoin de les supprimer manuellement.

**Exception** : Si vous utilisez `document.addEventListener()` ou attachez des listeners en dehors du container, vous **DEVEZ** les supprimer dans `destroy()`.

### 3. Cache et performances

#### Cache mémoire (tableCache)

Le cache mémoire est **automatiquement nettoyé** toutes les 60 secondes dans `excel-utils.js` :
- Suppression des entrées expirées (> 30s)
- Limite de 50 entrées maximum
- **Aucune action requise** de votre part

#### Cache localStorage (PersistentCache)

Le cache localStorage est **automatiquement nettoyé** au démarrage de l'app dans `app.js` :
- Suppression des entrées expirées (> 24h)
- **Aucune action requise** de votre part

#### Invalider le cache après écriture

Après toute écriture Excel (add/update/delete), **toujours** invalider le cache :

```javascript
async function saveData() {
    await addTableRow('tProduits', data);

    // OBLIGATOIRE : invalider le cache
    invalidateCache('tProduits');
}
```

### 4. Composants réutilisables

Si vous créez un composant réutilisable (ex: `Table`, `Modal`, `Chart`), il **DOIT** avoir une méthode `destroy()` si :
- Il stocke des données volumineuses
- Il attache des event listeners en dehors de son DOM
- Il utilise des timers/intervals

```javascript
class MonComposant {
    constructor(options) {
        this.data = [];
        this.timer = null;
    }

    destroy() {
        this.data = [];
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
```

## Checklist nouvelle page

Lors de la création d'une nouvelle page :

- [ ] La classe a une méthode `destroy()`
- [ ] `destroy()` vide tous les arrays volumineux
- [ ] `destroy()` nettoie les Sets/Maps
- [ ] `destroy()` se désabonne de ConnectionStatus si utilisé
- [ ] La fonction `renderMaPage()` retourne l'instance
- [ ] Les écritures Excel invalident le cache
- [ ] Pas de `document.addEventListener()` sans cleanup

## Checklist modification page existante

Lors de la modification d'une page existante :

- [ ] La méthode `destroy()` existe déjà ?
- [ ] Si j'ajoute un nouvel array volumineux, je le vide dans `destroy()`
- [ ] Si j'ajoute un listener ConnectionStatus, je le nettoie dans `destroy()`
- [ ] Si j'ajoute une écriture Excel, j'invalide le cache après

## Outils de diagnostic

Pour surveiller la santé mémoire de l'app, utilisez dans la console du navigateur :

```javascript
// Voir les stats mémoire
getMemoryStats()

// Résultat :
// {
//   cacheSize: 15,              // Nombre d'entrées dans tableCache
//   pendingRequests: 0,          // Requêtes bridge en attente
//   localStorageSize: 1048576,   // Taille du localStorage (bytes)
//   connectionListeners: 3       // Nombre de listeners ConnectionStatus
// }
```

## Erreurs courantes

### ❌ Oublier de retourner l'instance

```javascript
// MAUVAIS
async function renderMaPage(container) {
    maPageInstance = new MaPage();
    await maPageInstance.render(container);
    // Oubli du return !
}
```

```javascript
// BON
async function renderMaPage(container) {
    maPageInstance = new MaPage();
    await maPageInstance.render(container);
    return maPageInstance; // ✅
}
```

### ❌ Oublier de vider un array

```javascript
// MAUVAIS
destroy() {
    this.produits = []; // ✅
    this.flux = [];     // ✅
    // Oubli de this.shores !
}
```

```javascript
// BON
destroy() {
    this.produits = [];
    this.flux = [];
    this.shores = []; // ✅ Tous les arrays sont vidés
}
```

### ❌ Ne pas invalider le cache après écriture

```javascript
// MAUVAIS
async function addProduit(data) {
    await addTableRow('tProduits', data);
    // Oubli de invalidateCache !
    showSuccess('Produit ajouté');
}
```

```javascript
// BON
async function addProduit(data) {
    await addTableRow('tProduits', data);
    invalidateCache('tProduits'); // ✅
    showSuccess('Produit ajouté');
}
```

## Pages avec destroy() implémenté

✅ **Toutes les pages sont maintenant optimisées !**

- ✅ `migration.js` (Cartographie)
- ✅ `parc.js` (Parc Applicatif)
- ✅ `mae.js` (MAE)
- ✅ `roadmap-chantiers.js` (Roadmap)
- ✅ `synthese.js` (Synthèse)
- ✅ `carrousel.js` (Carrousel)
- ✅ `roadmap-gantt.js` (Roadmap Gantt)
- ✅ `params.js` (Paramètres)
- ✅ `parametres-home.js` (Accueil Paramètres)

## Pages legacy (non utilisées)

- ⏳ `roadmap.js` (ancienne roadmap - legacy, pas prioritaire)
