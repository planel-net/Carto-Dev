# Skill: fix-bridge

Diagnostiquer et corriger les problemes de communication Dialog/Taskpane via ExcelBridge.

## Architecture du bridge

L'application CartoExcel utilise une architecture Dialog :
- **Taskpane** (`taskpane.js`) : a acces direct a Excel via `Excel.run()`
- **Dialog** (`app.html`) : n'a PAS acces a Excel, communique via `ExcelBridge`
- **Bridge** (`excel-bridge.js`) : envoie des messages JSON du Dialog vers le Taskpane

### Flux de donnees
```
Dialog (app.js) --> ExcelBridge.readTable() --> messageParent(JSON)
                                                     |
                                                     v
Taskpane (taskpane.js) <-- handleDialogMessage() <-- Office.EventType.DialogMessageReceived
                |
                v
          Excel.run() --> lecture/ecriture Excel
                |
                v
          dialog.messageChild(JSON) --> ExcelBridge callback
```

## Diagnostic

### 1. Verifier les logs console

Ouvrir F12 dans les DEUX fenetres (Taskpane ET Dialog) et chercher :
- `[App]` : logs du Dialog
- `[Taskpane]` : logs du Taskpane
- `[Bridge]` : logs du bridge

### 2. Problemes frequents

**Le bridge ne repond pas** :
- Verifier que `ExcelBridge.init()` est appele dans `app.js`
- Verifier que `handleDialogMessage()` dans `taskpane.js` traite bien le type de message
- Verifier que le dialog est bien ouvert (pas ferme prematurement)

**Timeout des requetes** :
- Le bridge a un timeout par defaut. Augmenter si l'operation Excel est longue
- Verifier qu'il n'y a pas de `context.sync()` manquant dans le handler taskpane

**Donnees incorrectes** :
- Verifier le format du message JSON (type, tableName, data)
- Verifier que les noms de tables correspondent a CONFIG.TABLES
- Verifier la serialisation/deserialisation des dates

**Bridge perdu apres longue inactivite** :
- Le Dialog peut perdre la connexion. Verifier ConnectionStatus
- Implementer un heartbeat ou un mecanisme de reconnexion

### 3. Fichiers a inspecter

1. `js/utils/excel-bridge.js` : logique du bridge cote Dialog
2. `js/taskpane.js` : fonction `handleDialogMessage()` cote Taskpane
3. `js/utils/excel-utils.js` : fonctions Excel brutes
4. `js/app.js` : wrappers readTable/addTableRow/etc. cote Dialog

### 4. Ajout d'une nouvelle operation bridge

Si une nouvelle operation est necessaire :
1. Ajouter le type de message dans `ExcelBridge` (excel-bridge.js)
2. Ajouter le handler dans `handleDialogMessage()` (taskpane.js)
3. Ajouter le wrapper dans `app.js`
