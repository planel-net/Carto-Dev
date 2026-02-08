# Skill: review

Revue de code avec focus sur les patterns Office.js et les conventions du projet CartoExcel.

## Parametres attendus
L'utilisateur fournit : le fichier ou la fonctionnalite a revoir.

## Points de verification

### 1. Architecture Dialog/Bridge
- Les appels Excel passent-ils bien par le bridge depuis le Dialog ?
- Pas d'appel direct a `Excel.run()` dans les fichiers charges dans le Dialog (app.js, pages/*, components/*)
- Les operations bridge sont-elles correctement gerees dans `handleDialogMessage()` ?

### 2. Patterns Office.js
- `Excel.run()` utilise correctement avec `async/await`
- `load()` appele avant `context.sync()`
- Proprietes chargees explicitement (pas de `load()` sans arguments)
- Operations groupees dans un seul `Excel.run()` quand possible
- Pas de `context.sync()` dans une boucle

### 3. Conventions du projet
- Vanilla JS (pas de framework)
- Classes ES6 pour les composants et pages
- `async/await` (pas de `.then()`)
- Nommage : camelCase fonctions/variables, PascalCase classes
- Noms de tables : prefixe `t` + PascalCase
- Commentaires en francais
- Format des headers de fichier respecte

### 4. Gestion des erreurs
- Try/catch autour des operations Excel et bridge
- Notifications utilisateur en cas d'erreur (`showNotification()`)
- Logs console pour le debug (`console.log/error`)

### 5. Performance
- Pas de lectures inutiles (utiliser le cache `PersistentCache` si possible)
- Pas de `context.sync()` en boucle
- Chargement paresseux des donnees

### 6. Securite
- Pas d'affichage du mot de passe
- Validation des entrees utilisateur
- Feuille `mdp` toujours masquee

### 7. CSS
- Utilisation des variables CSS (`--mh-*`)
- Charte Malakoff Humanis respectee
- Pas de styles inline (sauf dynamiques necessaires)

## Format de sortie
Generer un rapport avec :
- Problemes critiques (bugs, securite)
- Ameliorations recommandees
- Points positifs
