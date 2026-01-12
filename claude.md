# Guide d'Architecture - Applications Excel Office.js

Ce document définit les règles et conventions pour créer des applications Excel (Add-ins) avec Office.js pour Malakoff Humanis.

---

## 1. Charte Graphique Malakoff Humanis

### Couleurs principales
```css
:root {
    /* Couleurs Malakoff Humanis */
    --mh-bleu-fonce: #003366;      /* Bleu foncé principal */
    --mh-bleu-clair: #0066CC;      /* Bleu clair / accent */
    --mh-orange: #FF6600;          /* Orange pour les accents et CTA */
    --mh-gris-fonce: #333333;      /* Texte principal */
    --mh-gris-moyen: #666666;      /* Texte secondaire */
    --mh-gris-clair: #F5F5F5;      /* Fond secondaire */
    --mh-blanc: #FFFFFF;           /* Fond principal */
    --mh-vert-succes: #28A745;     /* Succès */
    --mh-rouge-erreur: #DC3545;    /* Erreur */
    --mh-jaune-warning: #FFC107;   /* Avertissement */
}
```

### Typographie
```css
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--mh-gris-fonce);
}

h1, h2, h3 {
    color: var(--mh-bleu-fonce);
    font-weight: 600;
}
```

### Boutons standards
```css
/* Bouton principal */
.btn-primary {
    background: var(--mh-bleu-clair);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s ease;
}

.btn-primary:hover {
    background: var(--mh-bleu-fonce);
}

/* Bouton action / CTA */
.btn-action {
    background: var(--mh-orange);
    color: white;
}

.btn-action:hover {
    background: #E65C00;
}

/* Bouton secondaire */
.btn-secondary {
    background: var(--mh-gris-clair);
    color: var(--mh-gris-fonce);
    border: 1px solid #ddd;
}

/* Bouton succès */
.btn-success {
    background: var(--mh-vert-succes);
    color: white;
}

/* Bouton danger */
.btn-danger {
    background: var(--mh-rouge-erreur);
    color: white;
}
```

---

## 2. Structure de l'Application

### Architecture des fichiers
```
MonApplication/
├── manifest.xml                    # Manifeste Office Add-in
├── claude.md                       # Ce fichier de documentation
│
├── html/                           # Fichiers HTML
│   ├── taskpane.html              # Volet latéral (point d'entrée)
│   ├── app.html                   # Application principale plein écran
│   └── dialogs/                   # Dialogues et modales
│       ├── confirm-delete.html
│       └── form-edit.html
│
├── css/                            # Feuilles de styles
│   ├── variables.css              # Variables CSS (couleurs, fonts)
│   ├── base.css                   # Styles de base et reset
│   ├── components.css             # Composants réutilisables (boutons, modales)
│   ├── taskpane.css               # Styles spécifiques au taskpane
│   ├── app.css                    # Styles spécifiques à l'app principale
│   └── notifications.css          # Styles des notifications
│
├── js/                             # Scripts JavaScript
│   ├── config.js                  # Configuration et constantes
│   ├── taskpane.js                # Logique du volet latéral
│   ├── app.js                     # Logique de l'application principale
│   ├── utils/                     # Utilitaires
│   │   ├── excel-utils.js         # Fonctions CRUD Excel
│   │   ├── auth.js                # Gestion verrouillage/déverrouillage
│   │   ├── notifications.js       # Système de notifications
│   │   └── helpers.js             # Fonctions helpers diverses
│   └── components/                # Composants JS réutilisables
│       ├── modal.js
│       └── table.js
│
└── assets/                         # Ressources statiques
    ├── icons/                     # Icônes de l'application
    │   ├── icon-16.png
    │   ├── icon-32.png
    │   ├── icon-80.png
    │   └── icon-128.png
    ├── images/                    # Images diverses
    │   └── logo-mh.png
    └── fonts/                     # Polices personnalisées (si nécessaire)
```

### Organisation des CSS

#### variables.css - Variables globales
```css
:root {
    /* Couleurs Malakoff Humanis */
    --mh-bleu-fonce: #003366;
    --mh-bleu-clair: #0066CC;
    --mh-orange: #FF6600;
    --mh-gris-fonce: #333333;
    --mh-gris-moyen: #666666;
    --mh-gris-clair: #F5F5F5;
    --mh-blanc: #FFFFFF;
    --mh-vert-succes: #28A745;
    --mh-rouge-erreur: #DC3545;
    --mh-jaune-warning: #FFC107;

    /* Espacements */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;

    /* Bordures */
    --border-radius-sm: 4px;
    --border-radius-md: 8px;
    --border-radius-lg: 16px;

    /* Transitions */
    --transition-fast: 0.2s ease;
    --transition-normal: 0.3s ease;

    /* Ombres */
    --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.2);
}
```

#### Importation dans les fichiers HTML
```html
<!-- Dans taskpane.html -->
<head>
    <link rel="stylesheet" href="../css/variables.css">
    <link rel="stylesheet" href="../css/base.css">
    <link rel="stylesheet" href="../css/components.css">
    <link rel="stylesheet" href="../css/notifications.css">
    <link rel="stylesheet" href="../css/taskpane.css">
</head>

<!-- Dans app.html -->
<head>
    <link rel="stylesheet" href="../css/variables.css">
    <link rel="stylesheet" href="../css/base.css">
    <link rel="stylesheet" href="../css/components.css">
    <link rel="stylesheet" href="../css/notifications.css">
    <link rel="stylesheet" href="../css/app.css">
</head>
```

### Organisation des JavaScript

#### config.js - Configuration centralisée
```javascript
// js/config.js
const CONFIG = {
    // Noms des feuilles spéciales
    SHEETS: {
        HOME: 'Home',
        PASSWORD: 'mdp'
    },

    // Cellule contenant le mot de passe
    PASSWORD_CELL: 'B2',

    // Tables attendues
    EXPECTED_TABLES: ['tProjets', 'tContacts', 'tPjtsContacts'],

    // Options de la dialog plein écran
    DIALOG_OPTIONS: {
        height: 100,
        width: 100,
        displayInIframe: false,
        promptBeforeOpen: false
    }
};

// Export pour modules ES6
if (typeof module !== 'undefined') {
    module.exports = CONFIG;
}
```

#### Importation des scripts dans les fichiers HTML
```html
<!-- Dans taskpane.html -->
<body>
    <!-- Contenu -->

    <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
    <script src="../js/config.js"></script>
    <script src="../js/utils/helpers.js"></script>
    <script src="../js/utils/notifications.js"></script>
    <script src="../js/utils/excel-utils.js"></script>
    <script src="../js/utils/auth.js"></script>
    <script src="../js/taskpane.js"></script>
</body>

<!-- Dans app.html -->
<body>
    <!-- Contenu -->

    <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
    <script src="../js/config.js"></script>
    <script src="../js/utils/helpers.js"></script>
    <script src="../js/utils/notifications.js"></script>
    <script src="../js/utils/excel-utils.js"></script>
    <script src="../js/components/modal.js"></script>
    <script src="../js/components/table.js"></script>
    <script src="../js/app.js"></script>
</body>
```

### Volet Latéral (Taskpane)

Le volet latéral est le point d'entrée de l'application. Il permet :
- D'afficher les informations du classeur
- De lancer l'application principale en plein écran
- De gérer le verrouillage/déverrouillage du classeur

```html
<!-- html/taskpane.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Taskpane - Application</title>
    <!-- CSS -->
    <link rel="stylesheet" href="../css/variables.css">
    <link rel="stylesheet" href="../css/base.css">
    <link rel="stylesheet" href="../css/components.css">
    <link rel="stylesheet" href="../css/notifications.css">
    <link rel="stylesheet" href="../css/taskpane.css">
</head>
<body>
    <div class="taskpane-container">
        <header class="taskpane-header">
            <img src="../assets/images/logo-mh.png" alt="Malakoff Humanis" class="logo">
            <h1>Nom de l'Application</h1>
        </header>

        <main class="taskpane-content">
            <!-- Bouton pour ouvrir l'application en plein écran -->
            <button id="btnOpenApp" class="btn btn-action btn-large">
                Ouvrir l'application
            </button>

            <!-- Section de gestion du classeur -->
            <section class="workbook-controls">
                <h2>Gestion du classeur</h2>
                <button id="btnUnlock" class="btn btn-success">
                    Déverrouiller le classeur
                </button>
                <button id="btnLock" class="btn btn-danger hidden">
                    Verrouiller le classeur
                </button>
            </section>

            <!-- Informations -->
            <section class="info-section">
                <p id="statusText">Statut : Verrouillé</p>
            </section>
        </main>
    </div>

    <!-- JavaScript -->
    <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
    <script src="../js/config.js"></script>
    <script src="../js/utils/helpers.js"></script>
    <script src="../js/utils/notifications.js"></script>
    <script src="../js/utils/excel-utils.js"></script>
    <script src="../js/utils/auth.js"></script>
    <script src="../js/taskpane.js"></script>
</body>
</html>
```

---

## 3. Application Plein Écran

### Ouverture automatique sans confirmation
L'application doit s'ouvrir automatiquement en plein écran lorsque l'utilisateur clique sur "Ouvrir l'application", sans demande de confirmation.

```javascript
// js/taskpane.js
Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        document.getElementById('btnOpenApp').onclick = openFullScreenApp;
    }
});

function openFullScreenApp() {
    // Ouvrir en mode dialog plein écran
    // Note: le chemin est relatif au dossier html/
    Office.context.ui.displayDialogAsync(
        window.location.origin + '/html/app.html',
        {
            height: 100,  // 100% de la hauteur
            width: 100,   // 100% de la largeur
            displayInIframe: false,
            promptBeforeOpen: false  // Pas de confirmation
        },
        (result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
                const dialog = result.value;
                dialog.addEventHandler(Office.EventType.DialogMessageReceived, handleDialogMessage);
                dialog.addEventHandler(Office.EventType.DialogEventReceived, handleDialogEvent);
            }
        }
    );
}

function handleDialogMessage(arg) {
    // Traiter les messages de la dialog
    const message = JSON.parse(arg.message);
    // ... traitement
}

function handleDialogEvent(arg) {
    // Gérer la fermeture de la dialog
    if (arg.error === 12006) {
        // Dialog fermée par l'utilisateur
    }
}
```

### Structure app.html (plein écran)
```html
<!-- html/app.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application - Malakoff Humanis</title>
    <!-- CSS -->
    <link rel="stylesheet" href="../css/variables.css">
    <link rel="stylesheet" href="../css/base.css">
    <link rel="stylesheet" href="../css/components.css">
    <link rel="stylesheet" href="../css/notifications.css">
    <link rel="stylesheet" href="../css/app.css">
</head>
<body class="fullscreen-app">
    <div class="app-container">
        <header class="app-header">
            <div class="header-left">
                <img src="../assets/images/logo-mh.png" alt="Malakoff Humanis" class="logo">
                <h1>Nom de l'Application</h1>
            </div>
            <div class="header-right">
                <button id="btnClose" class="btn btn-secondary">
                    Fermer
                </button>
            </div>
        </header>

        <main class="app-content">
            <!-- Contenu de l'application -->
        </main>

        <footer class="app-footer">
            <p>Malakoff Humanis - Application Excel</p>
        </footer>
    </div>

    <!-- JavaScript -->
    <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
    <script src="../js/config.js"></script>
    <script src="../js/utils/helpers.js"></script>
    <script src="../js/utils/notifications.js"></script>
    <script src="../js/utils/excel-utils.js"></script>
    <script src="../js/components/modal.js"></script>
    <script src="../js/components/table.js"></script>
    <script src="../js/app.js"></script>
</body>
</html>
```

---

## 4. Gestion du Verrouillage/Déverrouillage

### Feuille de mot de passe
- La feuille **"mdp"** contient le mot de passe du classeur en cellule **B2**
- Cette feuille doit **toujours rester masquée** (même après déverrouillage)

### Déverrouillage du classeur
```javascript
// js/auth.js

async function unlockWorkbook() {
    try {
        await Excel.run(async (context) => {
            const workbook = context.workbook;
            const sheets = workbook.worksheets;
            sheets.load('items/name,items/visibility');

            // Récupérer le mot de passe depuis la feuille "mdp"
            const mdpSheet = sheets.getItem('mdp');
            const passwordCell = mdpSheet.getRange('B2');
            passwordCell.load('values');

            await context.sync();

            const password = passwordCell.values[0][0];

            // Déprotéger le classeur
            workbook.protection.unprotect(password);

            // Afficher toutes les feuilles SAUF "mdp"
            for (const sheet of sheets.items) {
                if (sheet.name.toLowerCase() !== 'mdp') {
                    sheet.visibility = Excel.SheetVisibility.visible;
                }
            }

            await context.sync();

            updateUI('unlocked');
            showNotification('Classeur déverrouillé', 'success');
        });
    } catch (error) {
        console.error('Erreur déverrouillage:', error);
        showNotification('Erreur lors du déverrouillage', 'error');
    }
}
```

### Verrouillage du classeur
```javascript
async function lockWorkbook() {
    try {
        await Excel.run(async (context) => {
            const workbook = context.workbook;
            const sheets = workbook.worksheets;
            sheets.load('items/name');

            // Récupérer le mot de passe
            const mdpSheet = sheets.getItem('mdp');
            const passwordCell = mdpSheet.getRange('B2');
            passwordCell.load('values');

            await context.sync();

            const password = passwordCell.values[0][0];

            // Masquer toutes les feuilles SAUF "Home"
            for (const sheet of sheets.items) {
                if (sheet.name.toLowerCase() === 'home') {
                    sheet.visibility = Excel.SheetVisibility.visible;
                } else {
                    sheet.visibility = Excel.SheetVisibility.hidden;
                }
            }

            // Protéger le classeur avec mot de passe
            workbook.protection.protect({
                allowAutoFilter: false,
                allowDeleteColumns: false,
                allowDeleteRows: false,
                allowEditObjects: false,
                allowEditScenarios: false,
                allowFormatCells: false,
                allowFormatColumns: false,
                allowFormatRows: false,
                allowInsertColumns: false,
                allowInsertHyperlinks: false,
                allowInsertRows: false,
                allowPivotTables: false,
                allowSort: false
            }, password);

            await context.sync();

            updateUI('locked');
            showNotification('Classeur verrouillé', 'success');
        });
    } catch (error) {
        console.error('Erreur verrouillage:', error);
        showNotification('Erreur lors du verrouillage', 'error');
    }
}
```

### Vérifier l'état du verrouillage
```javascript
async function checkLockStatus() {
    try {
        await Excel.run(async (context) => {
            const protection = context.workbook.protection;
            protection.load('protected');

            await context.sync();

            return protection.protected;
        });
    } catch (error) {
        console.error('Erreur vérification:', error);
        return null;
    }
}
```

---

## 5. Accès aux Données (CRUD)

### Important : L'application peut accéder aux feuilles masquées
Même si les feuilles sont masquées et le classeur verrouillé, l'application Office.js peut toujours lire, écrire et supprimer des données.

### Lecture de données
```javascript
async function readData(sheetName, range) {
    return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        const dataRange = sheet.getRange(range);
        dataRange.load('values');

        await context.sync();

        return dataRange.values;
    });
}

// Lecture d'une table complète
async function readTable(sheetName) {
    return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        const usedRange = sheet.getUsedRange();
        usedRange.load('values');

        await context.sync();

        const data = usedRange.values;
        const headers = data[0];
        const rows = data.slice(1);

        return { headers, rows };
    });
}
```

### Écriture de données
```javascript
async function writeData(sheetName, range, values) {
    await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        const dataRange = sheet.getRange(range);
        dataRange.values = values;

        await context.sync();
    });
}

// Ajouter une ligne à une table
async function addRow(sheetName, rowData) {
    await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        const usedRange = sheet.getUsedRange();
        usedRange.load('rowCount');

        await context.sync();

        const newRowIndex = usedRange.rowCount + 1;
        const newRange = sheet.getRange(`A${newRowIndex}`).getResizedRange(0, rowData.length - 1);
        newRange.values = [rowData];

        await context.sync();
    });
}
```

### Modification de données
```javascript
async function updateRow(sheetName, rowIndex, rowData) {
    await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        // rowIndex est 1-based (1 = en-tête, 2 = première ligne de données)
        const range = sheet.getRange(`A${rowIndex + 1}`).getResizedRange(0, rowData.length - 1);
        range.values = [rowData];

        await context.sync();
    });
}
```

### Suppression de données
```javascript
async function deleteRow(sheetName, rowIndex) {
    await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        // rowIndex est 1-based
        const row = sheet.getRange(`${rowIndex + 1}:${rowIndex + 1}`);
        row.delete(Excel.DeleteShiftDirection.up);

        await context.sync();
    });
}
```

---

## 6. Icônes de l'Application

### Tailles requises
Les icônes doivent être fournies dans les tailles suivantes :
- **16x16** : Pour les menus et petits affichages
- **32x32** : Pour les barres d'outils
- **80x80** : Pour le store et les affichages moyens
- **128x128** : Pour les grands affichages

### Format et style
- Format : **PNG** avec transparence
- Style : Flat design, couleurs MH (bleu foncé #003366 ou orange #FF6600)
- Fond : Transparent ou blanc

### Exemple de génération avec SVG
```svg
<!-- Icône exemple - À convertir en PNG -->
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="16" fill="#003366"/>
    <text x="64" y="80" font-family="Segoe UI" font-size="48" font-weight="bold"
          fill="white" text-anchor="middle">APP</text>
</svg>
```

---

## 7. Manifest.xml

### Structure du manifeste
```xml
<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:type="TaskPaneApp">

    <Id>GUID-UNIQUE-ICI</Id>
    <Version>1.0.0.0</Version>
    <ProviderName>Malakoff Humanis</ProviderName>
    <DefaultLocale>fr-FR</DefaultLocale>
    <DisplayName DefaultValue="Nom de l'Application"/>
    <Description DefaultValue="Description de l'application"/>

    <IconUrl DefaultValue="https://votre-domaine.com/assets/icons/icon-32.png"/>
    <HighResolutionIconUrl DefaultValue="https://votre-domaine.com/assets/icons/icon-128.png"/>

    <SupportUrl DefaultValue="https://support.malakoffhumanis.com"/>

    <Hosts>
        <Host Name="Workbook"/>
    </Hosts>

    <Requirements>
        <Sets>
            <Set Name="ExcelApi" MinVersion="1.1"/>
        </Sets>
    </Requirements>

    <DefaultSettings>
        <SourceLocation DefaultValue="https://votre-domaine.com/taskpane.html"/>
    </DefaultSettings>

    <Permissions>ReadWriteDocument</Permissions>

    <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
                      xsi:type="VersionOverridesV1_0">
        <Hosts>
            <Host xsi:type="Workbook">
                <DesktopFormFactor>
                    <GetStarted>
                        <Title resid="GetStarted.Title"/>
                        <Description resid="GetStarted.Description"/>
                        <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
                    </GetStarted>
                    <FunctionFile resid="Commands.Url"/>
                    <ExtensionPoint xsi:type="PrimaryCommandSurface">
                        <OfficeTab id="TabHome">
                            <Group id="CommandsGroup">
                                <Label resid="CommandsGroup.Label"/>
                                <Icon>
                                    <bt:Image size="16" resid="Icon.16x16"/>
                                    <bt:Image size="32" resid="Icon.32x32"/>
                                    <bt:Image size="80" resid="Icon.80x80"/>
                                </Icon>
                                <Control xsi:type="Button" id="TaskpaneButton">
                                    <Label resid="TaskpaneButton.Label"/>
                                    <Supertip>
                                        <Title resid="TaskpaneButton.Label"/>
                                        <Description resid="TaskpaneButton.Tooltip"/>
                                    </Supertip>
                                    <Icon>
                                        <bt:Image size="16" resid="Icon.16x16"/>
                                        <bt:Image size="32" resid="Icon.32x32"/>
                                        <bt:Image size="80" resid="Icon.80x80"/>
                                    </Icon>
                                    <Action xsi:type="ShowTaskpane">
                                        <TaskpaneId>ButtonId1</TaskpaneId>
                                        <SourceLocation resid="Taskpane.Url"/>
                                    </Action>
                                </Control>
                            </Group>
                        </OfficeTab>
                    </ExtensionPoint>
                </DesktopFormFactor>
            </Host>
        </Hosts>

        <Resources>
            <bt:Images>
                <bt:Image id="Icon.16x16" DefaultValue="https://votre-domaine.com/assets/icons/icon-16.png"/>
                <bt:Image id="Icon.32x32" DefaultValue="https://votre-domaine.com/assets/icons/icon-32.png"/>
                <bt:Image id="Icon.80x80" DefaultValue="https://votre-domaine.com/assets/icons/icon-80.png"/>
            </bt:Images>
            <bt:Urls>
                <bt:Url id="Commands.Url" DefaultValue="https://votre-domaine.com/commands.html"/>
                <bt:Url id="Taskpane.Url" DefaultValue="https://votre-domaine.com/taskpane.html"/>
                <bt:Url id="GetStarted.LearnMoreUrl" DefaultValue="https://docs.malakoffhumanis.com"/>
            </bt:Urls>
            <bt:ShortStrings>
                <bt:String id="GetStarted.Title" DefaultValue="Démarrer"/>
                <bt:String id="CommandsGroup.Label" DefaultValue="Malakoff Humanis"/>
                <bt:String id="TaskpaneButton.Label" DefaultValue="Nom Application"/>
            </bt:ShortStrings>
            <bt:LongStrings>
                <bt:String id="GetStarted.Description" DefaultValue="Cliquez sur le bouton pour ouvrir l'application."/>
                <bt:String id="TaskpaneButton.Tooltip" DefaultValue="Ouvrir l'application Malakoff Humanis"/>
            </bt:LongStrings>
        </Resources>
    </VersionOverrides>
</OfficeApp>
```

---

## 8. Notifications et Alertes

### Composant de notification
```javascript
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer') || createNotificationContainer();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${getIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(notification);

    // Auto-dismiss après 5 secondes
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function getIcon(type) {
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
}
```

### Styles des notifications
```css
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.notification {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
    min-width: 280px;
}

.notification-success {
    background: #d4edda;
    border-left: 4px solid var(--mh-vert-succes);
    color: #155724;
}

.notification-error {
    background: #f8d7da;
    border-left: 4px solid var(--mh-rouge-erreur);
    color: #721c24;
}

.notification-warning {
    background: #fff3cd;
    border-left: 4px solid var(--mh-jaune-warning);
    color: #856404;
}

.notification-info {
    background: #d1ecf1;
    border-left: 4px solid var(--mh-bleu-clair);
    color: #0c5460;
}

.notification.fade-out {
    animation: fadeOut 0.3s ease forwards;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}
```

---

## 9. Structure des Feuilles Excel

### Feuilles obligatoires
| Nom de la feuille | Description | Visibilité par défaut |
|-------------------|-------------|----------------------|
| **Home** | Page d'accueil / tableau de bord | Visible |
| **mdp** | Contient le mot de passe en B2 | Toujours masquée |

### Convention de nommage des tables
- Préfixer les noms de tables avec `t` : `tClients`, `tProjets`, `tUtilisateurs`
- Utiliser le PascalCase pour les noms composés
- Éviter les caractères spéciaux et accents

### Structure de la feuille mdp
| Colonne A | Colonne B |
|-----------|-----------|
| Paramètre | Valeur |
| Password | [mot_de_passe] |
| Version | 1.0 |
| LastModified | [date] |

---

## 10. Bonnes Pratiques

### Gestion des erreurs
```javascript
async function safeExcelOperation(operation) {
    try {
        return await Excel.run(async (context) => {
            return await operation(context);
        });
    } catch (error) {
        console.error('Erreur Excel:', error);

        if (error.code === 'InvalidArgument') {
            showNotification('Paramètres invalides', 'error');
        } else if (error.code === 'ItemNotFound') {
            showNotification('Élément non trouvé', 'error');
        } else {
            showNotification('Une erreur est survenue', 'error');
        }

        throw error;
    }
}
```

### Performance
- Charger uniquement les propriétés nécessaires avec `load()`
- Regrouper les opérations dans un seul `Excel.run()`
- Utiliser `context.sync()` uniquement quand nécessaire
- Éviter les boucles avec `sync()` à chaque itération

### Sécurité
- Ne jamais afficher le mot de passe à l'utilisateur
- Valider toutes les entrées utilisateur
- Utiliser HTTPS pour le déploiement
- Implémenter une gestion de session si nécessaire

---

## 11. Checklist de Développement

### Avant de commencer
- [ ] Définir le nom et l'objectif de l'application
- [ ] Lister les feuilles Excel nécessaires
- [ ] Créer la structure des fichiers
- [ ] Générer les icônes (16, 32, 80, 128 px)

### Développement
- [ ] Créer le taskpane.html avec les boutons de contrôle
- [ ] Implémenter l'ouverture plein écran automatique
- [ ] Créer le système de verrouillage/déverrouillage
- [ ] Implémenter les opérations CRUD
- [ ] Appliquer la charte graphique Malakoff Humanis
- [ ] Ajouter les notifications

### Tests
- [ ] Tester le verrouillage/déverrouillage
- [ ] Tester l'accès aux feuilles masquées
- [ ] Tester sur Excel Desktop et Excel Online
- [ ] Vérifier le responsive design

### Déploiement
- [ ] Mettre à jour le manifest.xml avec les bonnes URLs
- [ ] Déployer sur un serveur HTTPS
- [ ] Distribuer le manifest aux utilisateurs

---

## 12. Gestion des Environnements (Dev / Prod)

### Méthode : Deux repositories GitHub séparés

Pour isoler complètement le développement de la production, nous utilisons **deux repositories GitHub distincts** :

```
GitHub
├── mon-app-dev/     → https://USERNAME.github.io/mon-app-dev/
│   ├── manifest.xml (GUID: AAA-111-DEV)
│   └── ... fichiers de développement
│
└── mon-app/         → https://USERNAME.github.io/mon-app/
    ├── manifest.xml (GUID: BBB-222-PROD)
    └── ... fichiers de production
```

| Environnement | Repository | URL GitHub Pages | Manifest |
|---------------|------------|------------------|----------|
| **Développement** | `mon-app-dev` | `https://USERNAME.github.io/mon-app-dev/` | `manifest.xml` avec GUID DEV |
| **Production** | `mon-app` | `https://USERNAME.github.io/mon-app/` | `manifest.xml` avec GUID PROD |

**Avantages de cette approche :**
- Isolation complète entre dev et prod
- Pas de risque de déployer du code non testé en production
- Les deux add-ins peuvent être installés simultanément dans Excel
- Workflow simple : développer → tester → copier vers prod

### Étapes manuelles pour créer les deux environnements

> **ACTION MANUELLE REQUISE** : Le développeur doit créer ces deux repositories sur GitHub.

1. **Créer le repository de développement** : `mon-app-dev` (public)
2. **Créer le repository de production** : `mon-app` (public)
3. **Activer GitHub Pages** sur les deux repositories (Settings > Pages > Branch: main)
4. **Générer deux GUID différents** sur [guidgenerator.com](https://www.guidgenerator.com/)

### Structure des fichiers (identique dans les deux repos)

```
mon-app-dev/  (ou mon-app/)
├── manifest.xml              # Manifest avec GUID unique pour cet environnement
├── html/
│   ├── taskpane.html
│   └── app.html
├── css/
│   ├── variables.css
│   ├── base.css
│   └── ...
├── js/
│   ├── config.js
│   ├── config-env.js         # Détection automatique de l'environnement
│   └── ...
└── assets/
    └── icons/
```

> **Note** : Chaque repository a son propre `manifest.xml` avec un GUID différent et des URLs pointant vers son propre GitHub Pages.

### Configuration JavaScript par environnement

```javascript
// js/config-env.js

// Détection automatique de l'environnement basée sur l'URL
const ENV = {
    isDev: window.location.hostname.includes('localhost') ||
           window.location.hostname.includes('-dev') ||
           window.location.pathname.includes('/dev/'),

    // URLs de base
    get baseUrl() {
        return this.isDev
            ? 'https://USERNAME.github.io/mon-app-dev'
            : 'https://USERNAME.github.io/mon-app';
    },

    // Configuration spécifique
    get config() {
        return {
            debug: this.isDev,
            logLevel: this.isDev ? 'debug' : 'error',
            apiEndpoint: this.isDev
                ? 'https://api-dev.example.com'
                : 'https://api.example.com'
        };
    }
};

// Afficher l'environnement actuel (utile pour debug)
console.log(`Environment: ${ENV.isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
```

### Manifest.xml pour chaque environnement

Chaque repository contient son propre `manifest.xml` avec des valeurs spécifiques.

#### Dans le repo `mon-app-dev` (Développement)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp ...>
    <Id>aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa</Id>  <!-- GUID DEV unique -->
    <Version>1.0.0.0</Version>
    <DisplayName DefaultValue="Mon App (DEV)"/>
    <Description DefaultValue="Version développement - Ne pas utiliser en production"/>

    <DefaultSettings>
        <SourceLocation DefaultValue="https://USERNAME.github.io/mon-app-dev/html/taskpane.html"/>
    </DefaultSettings>

    <!-- Toutes les URLs pointent vers mon-app-dev -->
</OfficeApp>
```

#### Dans le repo `mon-app` (Production)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp ...>
    <Id>bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb</Id>  <!-- GUID PROD unique (différent!) -->
    <Version>1.0.0.0</Version>
    <DisplayName DefaultValue="Mon App"/>
    <Description DefaultValue="Application de gestion"/>

    <DefaultSettings>
        <SourceLocation DefaultValue="https://USERNAME.github.io/mon-app/html/taskpane.html"/>
    </DefaultSettings>

    <!-- Toutes les URLs pointent vers mon-app -->
</OfficeApp>
```

> **IMPORTANT** :
> - Les deux manifests **DOIVENT** avoir des **GUID différents** (`<Id>`)
> - Sinon Excel considérera que c'est la même application et n'installera qu'une seule version
> - Générer les GUID sur [guidgenerator.com](https://www.guidgenerator.com/)

### Workflow de développement recommandé

```
1. DÉVELOPPEMENT (repo: mon-app-dev)
   ├── Développer et modifier les fichiers
   ├── Push sur GitHub → déploiement automatique GitHub Pages
   ├── Charger manifest.xml (DEV) dans Excel
   └── Tester l'application

2. VALIDATION
   ├── Tester toutes les fonctionnalités
   ├── Vérifier la console (F12) pour les erreurs
   └── Faire valider par les utilisateurs test

3. MISE EN PRODUCTION (repo: mon-app)
   ├── Copier les fichiers validés de mon-app-dev vers mon-app
   ├── Mettre à jour le numéro de version dans manifest.xml
   ├── Push sur GitHub → déploiement automatique GitHub Pages
   └── Les utilisateurs reçoivent automatiquement la mise à jour
```

### Mise en production : copier les fichiers

> **ACTION MANUELLE REQUISE** : Copier les fichiers du repo dev vers le repo prod.

**Option A : Via l'interface GitHub**
1. Télécharger les fichiers depuis `mon-app-dev`
2. Uploader dans `mon-app`
3. Commit les changements

**Option B : Via Git en ligne de commande**
```bash
# Depuis le dossier local mon-app-dev
cp -r html css js assets ../mon-app/

# Aller dans le repo prod
cd ../mon-app

# Commit et push
git add .
git commit -m "v1.x.x - Description des changements"
git push origin main
```

### Indicateur visuel d'environnement (Recommandé)

Ajouter un badge visuel pour savoir si on est en dev ou prod :

```html
<!-- Dans taskpane.html et app.html -->
<div id="envBadge" class="env-badge"></div>
```

```css
/* css/components.css */
.env-badge {
    position: fixed;
    top: 0;
    left: 0;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: bold;
    z-index: 99999;
}

.env-badge.dev {
    background: #ff6600;
    color: white;
}

.env-badge.prod {
    display: none; /* Masquer en prod */
}
```

```javascript
// js/utils/helpers.js
function showEnvironmentBadge() {
    const badge = document.getElementById('envBadge');
    if (badge) {
        if (ENV.isDev) {
            badge.textContent = 'DEV';
            badge.className = 'env-badge dev';
        } else {
            badge.className = 'env-badge prod';
        }
    }
}

// Appeler au chargement
document.addEventListener('DOMContentLoaded', showEnvironmentBadge);
```

### Tableau récapitulatif des deux environnements

| Aspect | Développement | Production |
|--------|---------------|------------|
| **Repository GitHub** | `mon-app-dev` | `mon-app` |
| **URL GitHub Pages** | `https://USER.github.io/mon-app-dev/` | `https://USER.github.io/mon-app/` |
| **Fichier manifest** | `manifest.xml` (dans repo dev) | `manifest.xml` (dans repo prod) |
| **GUID (Id)** | `aaaaaaaa-aaaa-...` (unique) | `bbbbbbbb-bbbb-...` (différent) |
| **Nom affiché dans Excel** | "Mon App (DEV)" | "Mon App" |
| **Badge visuel** | Orange "DEV" en haut à gauche | Aucun (masqué) |
| **Logs console** | Activés (debug) | Désactivés (error seulement) |
| **Utilisateurs** | Développeurs uniquement | Tous les utilisateurs |

---

## 13. Déploiement sur GitHub Pages (Étapes Manuelles)

> **IMPORTANT** : Cette section décrit les étapes que le développeur doit effectuer **manuellement** car elles nécessitent une interaction avec GitHub et Excel.

### Étape 1 : Créer un repository GitHub public

1. Aller sur [github.com](https://github.com) et se connecter
2. Cliquer sur le bouton **"+"** en haut à droite, puis **"New repository"**
3. Configurer le repository :
   - **Repository name** : `nom-de-votre-application` (ex: `gestion-excel-mh`)
   - **Description** : Description de l'application
   - **Visibility** : **Public** (obligatoire pour GitHub Pages gratuit)
   - Cocher **"Add a README file"**
4. Cliquer sur **"Create repository"**

### Étape 2 : Uploader les fichiers de l'application

**Option A : Via l'interface GitHub**
1. Dans le repository, cliquer sur **"Add file"** > **"Upload files"**
2. Glisser-déposer tous les fichiers et dossiers de l'application
3. Cliquer sur **"Commit changes"**

**Option B : Via Git en ligne de commande**
```bash
# Cloner le repository
git clone https://github.com/VOTRE-USERNAME/nom-de-votre-application.git

# Copier les fichiers de l'application dans le dossier
cd nom-de-votre-application

# Ajouter tous les fichiers
git add .

# Commit
git commit -m "Initial commit - Application Excel"

# Push
git push origin main
```

### Étape 3 : Activer GitHub Pages

1. Aller dans les **Settings** du repository (onglet en haut)
2. Dans le menu de gauche, cliquer sur **"Pages"**
3. Dans la section **"Source"** :
   - **Source** : Deploy from a branch
   - **Branch** : `main` (ou `master`)
   - **Folder** : `/ (root)`
4. Cliquer sur **"Save"**
5. Attendre quelques minutes que le site soit déployé
6. L'URL sera : `https://VOTRE-USERNAME.github.io/nom-de-votre-application/`

### Étape 4 : Mettre à jour le manifest.xml avec les URLs GitHub Pages

Remplacer toutes les occurrences de `https://votre-domaine.com` par votre URL GitHub Pages :

```xml
<!-- Avant -->
<SourceLocation DefaultValue="https://votre-domaine.com/taskpane.html"/>
<bt:Url id="Taskpane.Url" DefaultValue="https://votre-domaine.com/taskpane.html"/>
<bt:Image id="Icon.16x16" DefaultValue="https://votre-domaine.com/assets/icons/icon-16.png"/>

<!-- Après -->
<SourceLocation DefaultValue="https://VOTRE-USERNAME.github.io/nom-de-votre-application/html/taskpane.html"/>
<bt:Url id="Taskpane.Url" DefaultValue="https://VOTRE-USERNAME.github.io/nom-de-votre-application/html/taskpane.html"/>
<bt:Image id="Icon.16x16" DefaultValue="https://VOTRE-USERNAME.github.io/nom-de-votre-application/assets/icons/icon-16.png"/>
```

**Fichier manifest.xml à modifier :**
| Élément | Nouvelle valeur |
|---------|-----------------|
| `SourceLocation` | `https://USERNAME.github.io/REPO/html/taskpane.html` |
| `Taskpane.Url` | `https://USERNAME.github.io/REPO/html/taskpane.html` |
| `Commands.Url` | `https://USERNAME.github.io/REPO/html/commands.html` |
| `Icon.16x16` | `https://USERNAME.github.io/REPO/assets/icons/icon-16.png` |
| `Icon.32x32` | `https://USERNAME.github.io/REPO/assets/icons/icon-32.png` |
| `Icon.80x80` | `https://USERNAME.github.io/REPO/assets/icons/icon-80.png` |
| `IconUrl` | `https://USERNAME.github.io/REPO/assets/icons/icon-32.png` |
| `HighResolutionIconUrl` | `https://USERNAME.github.io/REPO/assets/icons/icon-128.png` |

### Étape 5 : Commit et push du manifest mis à jour

```bash
git add manifest.xml
git commit -m "Update manifest with GitHub Pages URLs"
git push origin main
```

---

## 14. Installation du Add-in dans Excel (Étapes Manuelles)

> **IMPORTANT** : Ces étapes doivent être effectuées **manuellement** par le développeur ou l'utilisateur final.

### Option A : Excel Desktop (Windows/Mac)

#### Méthode 1 : Chargement manuel (Développement)

1. Ouvrir Excel
2. Aller dans **Fichier** > **Options** > **Centre de gestion de la confidentialité**
3. Cliquer sur **"Paramètres du Centre de gestion de la confidentialité"**
4. Sélectionner **"Catalogues de compléments approuvés"**
5. Ajouter le chemin du dossier contenant le `manifest.xml`
6. Cocher **"Afficher dans le menu"**
7. Redémarrer Excel
8. Aller dans **Insertion** > **Mes compléments** > **Dossier partagé**
9. Sélectionner votre application

#### Méthode 2 : Sideloading via le ruban (Plus simple)

1. Ouvrir Excel
2. Aller dans **Insertion** > **Compléments** > **Obtenir des compléments**
3. Cliquer sur **"Charger mon complément"** (en bas à gauche)
4. Cliquer sur **"Parcourir"**
5. Sélectionner le fichier `manifest.xml`
6. Cliquer sur **"Charger"**

### Option B : Excel Online (Web)

1. Ouvrir Excel Online (office.com)
2. Ouvrir un classeur
3. Aller dans **Insertion** > **Compléments Office**
4. Cliquer sur **"Charger mon complément"**
5. Cliquer sur **"Parcourir"** et sélectionner le `manifest.xml`
6. Cliquer sur **"Charger"**

### Option C : Déploiement centralisé (Production - Admin Microsoft 365)

Pour un déploiement à grande échelle dans une organisation :

1. Se connecter au [Centre d'administration Microsoft 365](https://admin.microsoft.com)
2. Aller dans **Paramètres** > **Applications intégrées**
3. Cliquer sur **"Charger des applications personnalisées"**
4. Choisir **"Charger un fichier manifeste"**
5. Sélectionner le fichier `manifest.xml`
6. Configurer les utilisateurs qui auront accès
7. Déployer

---

## 15. Vérification du Déploiement

### Checklist de vérification

- [ ] Le site GitHub Pages est accessible : `https://USERNAME.github.io/REPO/`
- [ ] La page taskpane.html se charge : `https://USERNAME.github.io/REPO/html/taskpane.html`
- [ ] Les icônes sont visibles dans le navigateur
- [ ] Le manifest.xml contient les bonnes URLs
- [ ] Le GUID dans le manifest est unique (générer sur [guidgenerator.com](https://www.guidgenerator.com/))
- [ ] L'add-in apparaît dans Excel après le chargement
- [ ] Le volet latéral s'ouvre correctement
- [ ] L'application plein écran se lance sans demande de confirmation

### Résolution des problèmes courants

| Problème | Solution |
|----------|----------|
| "Le complément n'a pas pu être chargé" | Vérifier que les URLs dans le manifest sont correctes et accessibles |
| Page blanche dans le taskpane | Ouvrir la console (F12) et vérifier les erreurs JavaScript |
| Icônes non affichées | Vérifier les URLs des icônes et leur format (PNG) |
| "Cross-origin request blocked" | S'assurer que l'application est sur HTTPS (GitHub Pages) |
| Dialog plein écran ne s'ouvre pas | Vérifier que `promptBeforeOpen: false` est bien configuré |

---

## 16. Ressources

### Documentation Office.js
- [Documentation officielle Excel JavaScript API](https://docs.microsoft.com/en-us/office/dev/add-ins/excel/)
- [Référence API Excel](https://docs.microsoft.com/en-us/javascript/api/excel)

### Outils
- [Script Lab](https://aka.ms/getscriptlab) - Pour tester du code Office.js
- [Yeoman Generator](https://github.com/OfficeDev/generator-office) - Pour créer des projets
