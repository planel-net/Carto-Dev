# Skill: deploy

Workflow de deploiement de l'application CartoExcel sur GitHub Pages.

## Etapes

1. **Verifier les modifications** : Lancer `git status` et `git diff` pour lister les fichiers modifies.

2. **Mettre a jour le cache bust** : Incrementer le numero de version `?v=X.Y.Z` dans les fichiers HTML :
   - `html/taskpane.html` : tous les liens CSS et scripts JS
   - `html/app.html` : tous les liens CSS et scripts JS
   - La version doit correspondre a `CONFIG.APP_VERSION` dans `js/config.js`
   - Si CONFIG.APP_VERSION n'est pas a jour, le mettre a jour aussi

3. **Verifier la coherence des versions** : S'assurer que la meme version apparait dans :
   - `js/config.js` (APP_VERSION)
   - `html/taskpane.html` (parametres `?v=`)
   - `html/app.html` (parametres `?v=`)

4. **Commit** : Creer un commit avec le format :
   - Release : `vX.Y.Z - Description des changements`
   - Fix : `Fix : description du correctif`
   - Autre : `Description courte en francais`

5. **Push** : Pousser sur `origin main`.

6. **Verification** : Rappeler a l'utilisateur de verifier le deploiement sur GitHub Pages apres quelques minutes.

## Conventions de version
- Majeure (X) : refonte importante, changement d'architecture
- Mineure (Y) : nouvelle fonctionnalite, nouvelle page
- Patch (Z) : correction de bug, ajustement CSS, amelioration mineure

## Exemple d'utilisation
L'utilisateur dit `/deploy` apres avoir fait des modifications. Le skill verifie tout, met a jour les versions, commit et push.
