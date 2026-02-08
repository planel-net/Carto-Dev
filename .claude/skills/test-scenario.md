# Skill: test-scenario

Generer un scenario de test complet pour une fonctionnalite de CartoExcel.

## Parametres attendus
L'utilisateur fournit : la fonctionnalite a tester (page, composant, operation CRUD, bridge...).

## Structure du scenario

Pour chaque fonctionnalite, generer un scenario couvrant :

### 1. Pre-requis
- Etat initial du classeur (verrouille/deverrouille)
- Tables necessaires et leurs donnees de test
- Pages a ouvrir

### 2. Tests fonctionnels
- Navigation vers la page/fonctionnalite
- Chargement des donnees (via bridge)
- Affichage correct des elements
- Interactions utilisateur (clic, saisie, selection)

### 3. Tests CRUD (si applicable)
- **Create** : Ajout d'une ligne via le formulaire, verification dans la table Excel
- **Read** : Lecture et affichage des donnees existantes
- **Update** : Modification d'une ligne, verification de la persistance
- **Delete** : Suppression avec confirmation, verification de la suppression

### 4. Tests de bord
- Champs vides ou invalides
- Caracteres speciaux (accents, apostrophes)
- Valeurs numeriques negatives ou zero
- Dates invalides
- Doublons

### 5. Tests bridge (si communication Dialog/Taskpane)
- Timeout de communication
- Message malformed
- Perte de connexion
- Cache vs donnees fraiches

### 6. Tests UI
- Responsive (redimensionnement)
- Notifications (succes, erreur, warning)
- Modales (ouverture, fermeture, validation)
- Filtres et tri

### 7. Tests de regression
- Impact sur les autres pages
- Coherence des donnees entre tables liees

## Format de sortie

Generer le scenario sous forme de checklist Markdown avec :
- [ ] Description du test
- Resultat attendu
- Donnees de test si necessaire
