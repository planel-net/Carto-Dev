# Securite - CartoExcel

## Protection du classeur

### Mot de passe
- Stocke dans la feuille `mdp`, cellule `B2`
- La feuille `mdp` doit **toujours rester masquee** (`Excel.SheetVisibility.hidden`)
- Meme apres deverrouillage, `mdp` reste masquee
- Ne jamais afficher le mot de passe a l'utilisateur dans l'interface

### Verrouillage (auth.js)
- **Verrouiller** : masquer toutes les feuilles sauf `Intro` (CONFIG.SHEETS.HOME), proteger le classeur
- **Deverrouiller** : afficher toutes les feuilles sauf `mdp`, deproteger le classeur
- Les feuilles Jira (`DataAnaJira`, `MAEJiras`) restent visibles meme en mode verrouille

### Acces aux donnees
- L'add-in Office.js peut toujours lire/ecrire dans les feuilles masquees
- Le verrouillage empeche l'acces **utilisateur** direct, pas l'acces **programmatique**

## Validation des entrees

- Valider les champs `required` avant ecriture en base
- Echapper les caracteres speciaux dans les valeurs affichees en HTML
- Verifier les types (number, date, email) avant sauvegarde

## Communication Dialog/Taskpane

- Les messages bridge sont des JSON serialises
- Valider la structure des messages recus
- Ne pas transmettre de donnees sensibles (mot de passe) via le bridge

## Deploiement

- GitHub Pages HTTPS uniquement
- Le manifest.xml reference des URLs HTTPS
- Pas de donnees sensibles dans le code source
