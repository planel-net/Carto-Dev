# Skill: cache-bust

Mettre a jour les versions de cache bust dans les fichiers HTML pour forcer le rechargement des ressources.

## Etapes

### 1. Determiner la nouvelle version

- Lire la version actuelle dans `js/config.js` (`CONFIG.APP_VERSION`)
- Si l'utilisateur specifie une version, l'utiliser
- Sinon, incrementer le patch (X.Y.Z -> X.Y.Z+1)

### 2. Mettre a jour CONFIG.APP_VERSION

Dans `js/config.js`, mettre a jour :
```javascript
APP_VERSION: 'X.Y.Z',
```

### 3. Mettre a jour taskpane.html

Remplacer tous les parametres `?v=` dans `html/taskpane.html` :
- Liens CSS : `<link rel="stylesheet" href="...?v=X.Y.Z">`
- Scripts JS : `<script src="...?v=X.Y.Z"></script>`

### 4. Mettre a jour app.html

Remplacer tous les parametres `?v=` dans `html/app.html` :
- Liens CSS : `<link rel="stylesheet" href="...?v=X.Y.Z">`
- Scripts JS : `<script src="...?v=X.Y.Z"></script>`

### 5. Verification

Afficher un resume des fichiers modifies et la nouvelle version.

## Important
- Les deux fichiers HTML doivent avoir la MEME version
- La version doit correspondre a CONFIG.APP_VERSION
- Ne pas oublier les scripts JS en bas des fichiers HTML (pas seulement les CSS)
