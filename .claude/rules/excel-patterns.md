# Patterns Excel Office.js - CartoExcel

## Architecture Dialog/Bridge

L'application a deux contextes d'execution :

### Taskpane (acces direct a Excel)
- `js/taskpane.js` et `js/utils/excel-utils.js` peuvent appeler `Excel.run()`
- `js/utils/auth.js` gere le verrouillage/deverrouillage

### Dialog (pas d'acces a Excel)
- `js/app.js`, `js/pages/*`, `js/components/*` n'ont PAS acces a Excel
- Ils utilisent `ExcelBridge` pour communiquer avec le Taskpane
- Les fonctions `readTable()`, `addTableRow()`, `updateTableRow()`, `deleteTableRow()` sont des wrappers bridge dans `app.js`

**Regle absolue** : Jamais de `Excel.run()` dans un fichier charge dans le Dialog.

## Patterns Excel.run()

```javascript
// Toujours async/await
await Excel.run(async (context) => {
    // 1. Obtenir les references
    const sheet = context.workbook.worksheets.getItem('NomFeuille');
    const table = sheet.tables.getItem('tNomTable');

    // 2. Charger les proprietes AVANT sync
    const range = table.getRange();
    range.load('values');
    const headerRange = table.getHeaderRowRange();
    headerRange.load('values');

    // 3. Sync pour executer
    await context.sync();

    // 4. Lire les valeurs chargees
    const data = range.values;
    const headers = headerRange.values[0];
});
```

## Regles importantes

1. **Toujours `load()` avant `context.sync()`** : Specifier les proprietes a charger
2. **Grouper les operations** : Un seul `Excel.run()` par action utilisateur
3. **Pas de `sync()` en boucle** : Charger tout, sync une fois, puis traiter
4. **Gestion d'erreur** : Try/catch avec `showNotification()` pour l'utilisateur

## Communication Bridge

```javascript
// Cote Dialog : envoyer une requete
const result = await ExcelBridge.readTable('tActeurs');

// Cote Taskpane : traiter la requete dans handleDialogMessage()
case 'readTable':
    const data = await readTableFromExcel(message.tableName);
    dialog.messageChild(JSON.stringify({ id: message.id, data }));
    break;
```

## Cache

Utiliser `PersistentCache` (`js/utils/persistent-cache.js`) pour les donnees lues frequemment et rarement modifiees. Invalider le cache apres une ecriture.

## Tables Excel

Les tables sont definies dans `CONFIG.TABLES` avec :
- `name` : nom de la table Excel (prefixe `t`)
- `sheet` : nom de la feuille
- `columns` : definition des colonnes avec types et relations
