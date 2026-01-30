/* ===========================================
   TASKPANE.JS - Logique du volet latéral
   Application Carto
   =========================================== */

// Variables globales
let dialog = null;
let isWorkbookLocked = true;

// Initialisation Office.js
Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        initializeTaskpane();
    } else {
        showNotification('Cette application fonctionne uniquement dans Excel.', 'error');
    }
});

/**
 * Initialise le taskpane
 */
async function initializeTaskpane() {
    // Afficher le badge d'environnement
    showEnvironmentBadge();

    // Attacher les événements
    document.getElementById('btnOpenApp').addEventListener('click', openFullScreenApp);
    document.getElementById('btnUnlock').addEventListener('click', handleUnlock);
    document.getElementById('btnLock').addEventListener('click', handleLock);

    // Vérifier l'état initial du classeur
    await checkWorkbookStatus();

    // Compter les tables
    await countTables();
}

/**
 * Ouvre l'application en plein écran
 * Pattern identique à AppExcel pour ouverture en popup Excel
 */
function openFullScreenApp() {
    // Si une dialog est déjà ouverte, la fermer d'abord
    if (dialog) {
        try {
            dialog.close();
        } catch (e) {
            console.log('Dialog déjà fermée');
        }
        dialog = null;
    }

    // Construction de l'URL comme dans AppExcel
    const dialogUrl = window.location.href.replace('taskpane.html', 'app.html').split('?')[0];
    console.log('[Taskpane] Opening dialog:', dialogUrl);

    Office.context.ui.displayDialogAsync(
        dialogUrl,
        { height: 95, width: 95 },
        (result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
                dialog = result.value;
                dialog.addEventHandler(Office.EventType.DialogMessageReceived, handleDialogMessage);
                dialog.addEventHandler(Office.EventType.DialogEventReceived, handleDialogEvent);
                console.log('[Taskpane] Dialog opened successfully');
            } else {
                console.error('[Taskpane] Dialog error:', result.error);
                showNotification('Impossible d\'ouvrir l\'application: ' + result.error.message, 'error');
            }
        }
    );
}

/**
 * Gère les messages reçus de la dialog
 * Inclut maintenant le bridge Excel pour les requêtes de données
 */
async function handleDialogMessage(arg) {
    try {
        const message = JSON.parse(arg.message);
        console.log('[Taskpane] Received message:', message.type, message.requestId || '');

        // Commandes simples (sans réponse attendue)
        if (message.isCommand) {
            switch (message.type) {
                case 'CLOSE':
                    if (dialog) {
                        dialog.close();
                        dialog = null;
                    }
                    break;
                case 'REFRESH':
                    checkWorkbookStatus();
                    break;
                case 'NOTIFICATION':
                    showNotification(message.params.message, message.params.type);
                    break;
            }
            return;
        }

        // Requêtes avec réponse attendue (Excel Bridge)
        if (message.requestId) {
            let result = null;
            let error = null;

            try {
                switch (message.type) {
                    case 'READ_TABLE':
                        result = await readTable(message.params.tableName, message.params.useCache);
                        break;

                    case 'GET_MIGRATION_STATS':
                        result = await getMigrationStats(message.params.tableName, message.params.statusField);
                        break;

                    case 'ADD_ROW':
                        result = await addTableRow(message.params.tableName, message.params.rowData);
                        break;

                    case 'UPDATE_ROW':
                        result = await updateTableRow(message.params.tableName, message.params.rowIndex, message.params.rowData);
                        break;

                    case 'DELETE_ROW':
                        result = await deleteTableRow(message.params.tableName, message.params.rowIndex);
                        break;

                    case 'GET_UNIQUE_VALUES':
                        result = await getUniqueValues(message.params.tableName, message.params.columnName);
                        break;

                    case 'SEARCH_TABLE':
                        result = await searchTable(message.params.tableName, message.params.searchTerm, message.params.searchFields);
                        break;

                    case 'LIST_TABLES':
                        result = await listTables();
                        break;

                    case 'COPY_FROM_JIRA':
                        result = await copyFromJira(
                            message.params.jiraSheetName,
                            message.params.tableName,
                            message.params.keyField,
                            message.params.options || {}
                        );
                        break;

                    case 'INVALIDATE_CACHE':
                        // Invalider le cache mémoire et localStorage
                        invalidateCache(message.params.tableName);
                        result = { success: true };
                        break;

                    default:
                        error = `Unknown request type: ${message.type}`;
                }
            } catch (e) {
                error = e.message;
                console.error('[Taskpane] Error handling request:', e);
            }

            // Envoyer la réponse au dialog
            sendResponseToDialog(message.requestId, result, error);
            return;
        }

        // Ancien format de messages (rétrocompatibilité)
        switch (message.type) {
            case 'CLOSE':
                if (dialog) {
                    dialog.close();
                    dialog = null;
                }
                break;
            case 'REFRESH':
                checkWorkbookStatus();
                break;
            case 'NOTIFICATION':
                showNotification(message.data?.message, message.data?.type);
                break;
            default:
                console.log('Message non géré:', message);
        }
    } catch (error) {
        console.error('Erreur parsing message:', error);
    }
}

/**
 * Envoie une réponse au dialog
 * @param {number} requestId - ID de la requête
 * @param {any} result - Résultat de l'opération
 * @param {string} error - Message d'erreur (optionnel)
 */
function sendResponseToDialog(requestId, result, error) {
    if (!dialog) {
        console.error('[Taskpane] No dialog to send response to');
        return;
    }

    const response = {
        requestId,
        result,
        error
    };

    try {
        dialog.messageChild(JSON.stringify(response));
        console.log('[Taskpane] Response sent for request #' + requestId);
    } catch (e) {
        console.error('[Taskpane] Failed to send response:', e);
    }
}

/**
 * Gère les événements de la dialog
 */
function handleDialogEvent(arg) {
    switch (arg.error) {
        case 12002: // Dialog URL not found
            showNotification('Page non trouvée.', 'error');
            break;
        case 12003: // Dialog URL uses HTTP
            showNotification('HTTPS requis.', 'error');
            break;
        case 12006: // Dialog closed by user
            dialog = null;
            break;
        default:
            console.log('Dialog event:', arg.error);
    }
}

/**
 * Vérifie le statut du classeur (verrouillé/déverrouillé)
 */
async function checkWorkbookStatus() {
    try {
        isWorkbookLocked = await checkLockStatus();
        updateLockUI(isWorkbookLocked);
    } catch (error) {
        console.error('Erreur vérification statut:', error);
        // Supposer verrouillé en cas d'erreur
        updateLockUI(true);
    }
}

/**
 * Met à jour l'interface selon l'état de verrouillage
 */
function updateLockUI(locked) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const btnUnlock = document.getElementById('btnUnlock');
    const btnLock = document.getElementById('btnLock');
    const passwordGroup = document.getElementById('passwordGroup');

    if (locked) {
        statusDot.className = 'status-dot locked';
        statusText.textContent = 'Verrouillé';
        btnUnlock.classList.remove('hidden');
        btnLock.classList.add('hidden');
        passwordGroup.classList.remove('hidden');
    } else {
        statusDot.className = 'status-dot unlocked';
        statusText.textContent = 'Déverrouillé';
        btnUnlock.classList.add('hidden');
        btnLock.classList.remove('hidden');
        passwordGroup.classList.add('hidden');
    }
}

/**
 * Gère le déverrouillage du classeur
 */
async function handleUnlock() {
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput.value;

    if (!password) {
        showNotification('Veuillez entrer le mot de passe.', 'warning');
        return;
    }

    try {
        const result = await unlockWorkbook(password);
        if (result.success) {
            showNotification('Classeur déverrouillé avec succès.', 'success');
            passwordInput.value = '';
            updateLockUI(false);
            isWorkbookLocked = false;
        } else {
            showNotification(result.message || 'Mot de passe incorrect.', 'error');
        }
    } catch (error) {
        showNotification('Erreur lors du déverrouillage: ' + error.message, 'error');
    }
}

/**
 * Gère le verrouillage du classeur
 */
async function handleLock() {
    try {
        const result = await lockWorkbook();
        if (result.success) {
            showNotification('Classeur verrouillé avec succès.', 'success');
            updateLockUI(true);
            isWorkbookLocked = true;
        } else {
            showNotification(result.message || 'Erreur lors du verrouillage.', 'error');
        }
    } catch (error) {
        showNotification('Erreur lors du verrouillage: ' + error.message, 'error');
    }
}

/**
 * Compte les tables dans le classeur
 */
async function countTables() {
    try {
        await Excel.run(async (context) => {
            const tables = context.workbook.tables;
            tables.load('items');
            await context.sync();

            document.getElementById('tableCount').textContent = tables.items.length;
        });
    } catch (error) {
        console.error('Erreur comptage tables:', error);
        document.getElementById('tableCount').textContent = '-';
    }
}

/**
 * Obtient l'URL de base de l'application
 */
function getBaseUrl() {
    const url = window.location.href;
    return url.substring(0, url.lastIndexOf('/html'));
}

/**
 * Affiche le badge d'environnement (DEV/PROD)
 */
function showEnvironmentBadge() {
    const badge = document.getElementById('envBadge');
    if (badge) {
        const isDev = window.location.hostname.includes('localhost') ||
                      window.location.hostname.includes('-dev') ||
                      window.location.pathname.includes('/dev/') ||
                      window.location.hostname.includes('127.0.0.1');

        if (isDev) {
            badge.textContent = 'DEV';
            badge.className = 'env-badge dev';
        } else {
            badge.className = 'env-badge prod';
        }
    }
}
