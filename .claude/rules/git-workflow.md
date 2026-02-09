# Git Workflow - CartoExcel

## Branche
- Branche unique : `main`
- Deploiement automatique via GitHub Pages sur push

## Format des commits

Messages en **francais**, formats selon le type :

### Release (nouvelle fonctionnalite)
```
vX.Y.Z - Description de la fonctionnalite
```
Exemples :
- `v1.4.0 - Refonte MAE : colonnes Jira, pipeline read-only, Copie Jira`
- `v1.3.0 - Reorganisation onglets modale chantier`

### Correction de bug
```
Fix : description du correctif
```
Ou avec le contexte :
```
Fix NomPage : description du correctif
```
Exemples :
- `Fix MAE : statuts en casse mixte + comparaison insensible a la casse`
- `Fix Roadmap : restauration synchrone du scroll apres deplacement de phase`
- `Fix : preserver NumChantier lors de la modification d'un chantier`

### Cache bust / deploiement
```
taskpane vX.Y.Z : cache bust pour fichier(s) modifie(s)
```

### Amelioration mineure
```
Description courte de l'amelioration
```
Exemples :
- `Onglet Notes : liste etiree sur toute la hauteur disponible`
- `Roadmap : preserver la position de scroll apres modification`

## Versioning (Semver)
- **Majeur (X)** : refonte importante
- **Mineur (Y)** : nouvelle fonctionnalite, nouvelle page
- **Patch (Z)** : correction de bug, ajustement CSS

### Regle obligatoire
**A chaque commit pousse, incrementer la version** :
1. Mettre a jour `APP_VERSION` dans `js/config.js`
2. Mettre a jour le cache bust (`?v=X.Y.Z`) dans `html/app.html` et `html/taskpane.html`
3. Mettre a jour la version affichee dans `html/taskpane.html` (`id="appVersion"`)
4. Ne jamais pousser sans avoir incremente la version

## Deploiement
Apres chaque push sur `main`, GitHub Pages deploie automatiquement. Penser a mettre a jour le cache bust dans les HTML avant le push.
