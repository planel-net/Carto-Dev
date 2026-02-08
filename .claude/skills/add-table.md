# Skill: add-table

Ajouter une nouvelle table Excel au projet CartoExcel.

## Parametres attendus
L'utilisateur fournit : le nom de la table, les colonnes, la feuille Excel, et eventuellement les relations avec d'autres tables.

## Etapes

### 1. Ajouter la configuration dans CONFIG.TABLES (`js/config.js`)

Ajouter une entree dans `CONFIG.TABLES` en suivant le format existant :

```javascript
NOM_TABLE: {
    name: 'tNomTable',        // Prefixe t + PascalCase
    sheet: 'NomFeuille',       // Nom de la feuille Excel
    displayName: 'Nom affiche',
    icon: '&#128XXX;',         // Icone HTML entity
    columns: [
        { field: 'NomColonne', label: 'Label affiche', type: 'text', required: true },
        // Types: text, number, date, email, select, textarea, checkbox, color
        // Pour select avec source: { type: 'select', source: 'TABLE_SOURCE', sourceField: 'Champ' }
        // Pour select avec options fixes: { type: 'select', options: ['A', 'B', 'C'] }
    ]
}
```

### 2. Ajouter dans la navigation (`js/config.js`)

Si la table doit apparaitre dans les parametres, ajouter dans `CONFIG.NAVIGATION.PARAMETRES` :
```javascript
{ id: 'nom-table', label: 'Nom Table', icon: '&#128XXX;', table: 'NOM_TABLE' }
```

### 3. Ajouter le support bridge si necessaire (`js/taskpane.js`)

Les operations CRUD passent par le bridge generique (readTable, addTableRow, updateTableRow, deleteTableRow). Si la table necessite des operations specifiques, les ajouter dans `handleDialogMessage()` de `js/taskpane.js`.

### 4. Ajouter l'entree sidebar dans `html/app.html`

Dans la section `nav-section` des parametres, ajouter :
```html
<div class="nav-item" data-table="NOM_TABLE" data-tooltip="Nom Table">
    <span class="nav-item-icon">&#128XXX;</span>
    <span class="nav-item-text">Nom Table</span>
</div>
```

### 5. Verifier le fonctionnement

- La table apparait dans le menu Parametres
- Le CRUD fonctionne (ajout, modification, suppression)
- Les relations select se chargent correctement

## Tables existantes pour reference
tActeurs, tEquipe, tShores, tProjetsDSS, tDataflows, tProduits, tProcessus, tPdtProcess, tPerimetres, tFlux, tSprints, tCapacite, tBacklog, tChantiers, tPhases, tPhasesLien, tChantierProduit, tChantierDataAna, tChantierLien, tTablesMHTech, tDataAnas, tMAE, tMAENote, tMAELien
