/* ===========================================
   EXCEL-UTILS.JS - Fonctions CRUD Excel génériques
   Application Carto
   =========================================== */

/**
 * Cache mémoire pour les données des tables
 */
const tableCache = new Map();
const CACHE_DURATION = 30000; // 30 secondes
const EXCEL_TIMEOUT = 30000; // 30 secondes (augmenté pour les réseaux lents)

/**
 * File d'attente pour sérialiser les opérations d'écriture Excel
 * Évite les conflits de contexte quand plusieurs modifications arrivent rapidement
 * Gère aussi les conflits multi-utilisateurs avec des messages explicites
 */
const ExcelWriteQueue = {
    _queue: [],
    _isProcessing: false,
    _retryCount: 3,
    _retryDelay: 1500, // 1.5 seconde entre les retries (augmenté pour multi-utilisateurs)

    /**
     * Ajoute une opération à la file d'attente
     * @param {Function} operation - Fonction async à exécuter
     * @returns {Promise} Résultat de l'opération
     */
    async enqueue(operation) {
        return new Promise((resolve, reject) => {
            this._queue.push({ operation, resolve, reject });
            this._processNext();
        });
    },

    /**
     * Traite la prochaine opération dans la file
     */
    async _processNext() {
        if (this._isProcessing || this._queue.length === 0) {
            return;
        }

        this._isProcessing = true;
        const { operation, resolve, reject } = this._queue.shift();

        try {
            const result = await this._executeWithRetry(operation);
            resolve(result);
        } catch (error) {
            // Transformer l'erreur en message explicite
            reject(this._formatError(error));
        } finally {
            this._isProcessing = false;
            // Petit délai entre les opérations pour laisser Excel respirer
            setTimeout(() => this._processNext(), 150);
        }
    },

    /**
     * Exécute une opération avec retry automatique
     */
    async _executeWithRetry(operation, attempt = 1) {
        try {
            return await operation();
        } catch (error) {
            console.warn(`[ExcelWriteQueue] Attempt ${attempt}/${this._retryCount} failed:`, error.message);

            // Vérifier si c'est une erreur récupérable
            if (attempt < this._retryCount && this._isRetryableError(error)) {
                // Attendre avant de réessayer (délai exponentiel)
                const delay = this._retryDelay * attempt;
                console.log(`[ExcelWriteQueue] Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                return this._executeWithRetry(operation, attempt + 1);
            }

            // Toutes les tentatives ont échoué ou erreur non récupérable
            console.error(`[ExcelWriteQueue] Operation failed after ${attempt} attempt(s)`);
            throw error;
        }
    },

    /**
     * Vérifie si l'erreur peut être récupérée par un retry
     */
    _isRetryableError(error) {
        const retryableCodes = [
            'InvalidOperationInCellEditMode', // Cellule en cours d'édition
            'GeneralException', // Erreur générique souvent temporaire
            'Conflict', // Conflit de modification
            'ServiceNotAvailable', // Service temporairement indisponible
            'Timeout' // Timeout
        ];
        return retryableCodes.includes(error.code) ||
               error.message?.includes('context') ||
               error.message?.includes('sync');
    },

    /**
     * Formate l'erreur avec un message explicite pour l'utilisateur
     */
    _formatError(error) {
        let userMessage = 'Erreur lors de la modification.';

        // Analyser le type d'erreur pour donner un message clair
        if (error.code === 'InvalidOperationInCellEditMode') {
            userMessage = 'Une cellule est en cours d\'édition. Appuyez sur Entrée ou Échap dans Excel, puis réessayez.';
        } else if (error.code === 'Conflict' || error.message?.includes('conflict')) {
            userMessage = 'Conflit de modification : un autre utilisateur modifie le fichier. Veuillez réessayer dans quelques secondes.';
        } else if (error.code === 'ItemNotFound') {
            userMessage = 'L\'élément n\'existe plus. Il a peut-être été supprimé par un autre utilisateur. Actualisez la page.';
        } else if (error.code === 'ServiceNotAvailable' || error.message?.includes('unavailable')) {
            userMessage = 'Excel est temporairement indisponible. Veuillez réessayer dans quelques instants.';
        } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
            userMessage = 'La connexion avec Excel a expiré. Vérifiez votre connexion et réessayez.';
        } else if (error.message?.includes('context')) {
            userMessage = 'Opération interrompue. Veuillez réessayer.';
        }

        // Créer une nouvelle erreur avec le message formaté
        const formattedError = new Error(userMessage);
        formattedError.originalError = error;
        formattedError.code = error.code;

        console.error('[ExcelWriteQueue] Formatted error:', userMessage, '| Original:', error.message);

        return formattedError;
    }
};

/**
 * Gestionnaire de statut de connexion Excel
 */
const ConnectionStatus = {
    CONNECTED: 'connected',
    CACHE: 'cache',
    OFFLINE: 'offline',

    _status: 'connected',
    _lastSync: null,
    _listeners: [],

    get status() { return this._status; },
    get lastSync() { return this._lastSync; },

    setConnected() {
        this._status = this.CONNECTED;
        this._lastSync = Date.now();
        this._notify();
    },

    setCache() {
        this._status = this.CACHE;
        this._notify();
    },

    setOffline() {
        this._status = this.OFFLINE;
        this._notify();
    },

    isOnline() {
        return this._status === this.CONNECTED;
    },

    onChange(callback) {
        this._listeners.push(callback);
        // Notifier immédiatement du statut actuel
        callback(this._status, this._lastSync);
    },

    _notify() {
        this._listeners.forEach(cb => cb(this._status, this._lastSync));
    }
};

// Exposer globalement
if (typeof window !== 'undefined') {
    window.ConnectionStatus = ConnectionStatus;
}

/**
 * Lit toutes les données d'une table Excel
 * Utilise le cache persistant (localStorage) pour un affichage instantané
 * @param {string} tableName - Nom de la table Excel
 * @param {boolean} useCache - Utiliser le cache
 * @returns {Promise<Object>} { headers: [], rows: [], data: [] }
 */
async function readTable(tableName, useCache = true) {
    console.log(`[readTable] Reading table: ${tableName}`);

    // 1. Vérifier le cache mémoire (le plus rapide)
    if (useCache && tableCache.has(tableName)) {
        const cached = tableCache.get(tableName);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[readTable] ${tableName} returned from memory cache`);
            return cached.data;
        }
    }

    // 2. Vérifier le cache persistant (localStorage)
    let persistentCached = null;
    if (useCache && typeof PersistentCache !== 'undefined') {
        persistentCached = PersistentCache.get(tableName);
        if (persistentCached?.isFresh) {
            console.log(`[readTable] ${tableName} returned from localStorage (fresh)`);
            // Mettre aussi en cache mémoire
            tableCache.set(tableName, {
                data: persistentCached.data,
                timestamp: persistentCached.timestamp
            });
            return persistentCached.data;
        }
    }

    // 3. Essayer de lire depuis Excel
    try {
        // Vérifier si Excel est disponible
        if (typeof Excel === 'undefined') {
            console.error('[readTable] Excel API is not available');
            // Fallback sur le cache persistant même périmé
            if (persistentCached?.isValid) {
                console.log(`[readTable] ${tableName} fallback to localStorage (Excel unavailable)`);
                ConnectionStatus.setOffline();
                return persistentCached.data;
            }
            ConnectionStatus.setOffline();
            return { headers: [], rows: [], data: [] };
        }

        console.log(`[readTable] Starting Excel.run for ${tableName}...`);

        // Créer la promesse Excel.run
        const excelOperation = Excel.run(async (context) => {
            console.log(`[readTable] Inside Excel.run for ${tableName}`);
            const table = context.workbook.tables.getItem(tableName);
            const headerRange = table.getHeaderRowRange();
            const bodyRange = table.getDataBodyRange();

            headerRange.load('values');
            bodyRange.load('values');

            console.log(`[readTable] Calling context.sync for ${tableName}...`);
            await context.sync();
            console.log(`[readTable] context.sync completed for ${tableName}`);

            const headers = headerRange.values[0];
            const rows = bodyRange.values || [];

            console.log(`[readTable] ${tableName} has ${rows.length} rows`);

            // Convertir en tableau d'objets
            const data = rows.map((row, index) => {
                const obj = { _rowIndex: index }; // 0-based index pour les API getRow/getItemAt
                headers.forEach((header, colIndex) => {
                    obj[header] = row[colIndex];
                });
                return obj;
            });

            const result = { headers, rows, data };

            // Mettre en cache mémoire
            tableCache.set(tableName, {
                data: result,
                timestamp: Date.now()
            });

            // Mettre en cache persistant (localStorage)
            if (typeof PersistentCache !== 'undefined') {
                PersistentCache.save(tableName, result);
            }

            // Marquer comme connecté
            ConnectionStatus.setConnected();

            return result;
        });

        // Timeout de 30 secondes pour les réseaux lents
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout reading table ${tableName}`)), EXCEL_TIMEOUT)
        );

        return await Promise.race([excelOperation, timeout]);
    } catch (error) {
        console.error(`[readTable] Error for ${tableName}:`, error);
        console.error(`[readTable] Error details - code: ${error.code}, message: ${error.message}`);

        // Fallback sur le cache persistant
        if (persistentCached?.isValid) {
            console.log(`[readTable] ${tableName} fallback to localStorage (error: ${error.message})`);
            ConnectionStatus.setCache();
            return persistentCached.data;
        }

        // Pas de cache disponible
        ConnectionStatus.setOffline();
        return { headers: [], rows: [], data: [] };
    }
}

/**
 * Lit une cellule spécifique d'une feuille
 * @param {string} sheetName - Nom de la feuille
 * @param {string} cellAddress - Adresse de la cellule (ex: 'A1')
 * @returns {Promise<*>} Valeur de la cellule
 */
async function readCell(sheetName, cellAddress) {
    return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        const cell = sheet.getRange(cellAddress);
        cell.load('values');

        await context.sync();

        return cell.values[0][0];
    });
}

/**
 * Écrit une valeur dans une cellule
 * @param {string} sheetName - Nom de la feuille
 * @param {string} cellAddress - Adresse de la cellule
 * @param {*} value - Valeur à écrire
 */
async function writeCell(sheetName, cellAddress, value) {
    return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        const cell = sheet.getRange(cellAddress);
        cell.values = [[value]];

        await context.sync();
    });
}

/**
 * Ajoute une ligne à une table Excel
 * Utilise ExcelWriteQueue pour éviter les conflits de contexte
 * @param {string} tableName - Nom de la table
 * @param {Object} rowData - Données de la ligne (objet clé-valeur)
 * @returns {Promise<Object>} Ligne ajoutée avec son index
 */
async function addTableRow(tableName, rowData) {
    // Invalider le cache
    tableCache.delete(tableName);

    // Utiliser la file d'attente pour sérialiser les opérations
    return await ExcelWriteQueue.enqueue(async () => {
        return await Excel.run(async (context) => {
            const table = context.workbook.tables.getItem(tableName);
            const headerRange = table.getHeaderRowRange();
            headerRange.load('values');

            await context.sync();

            const headers = headerRange.values[0];

            // Convertir l'objet en tableau dans l'ordre des colonnes
            const rowValues = headers.map(header => {
                const value = rowData[header];
                return value !== undefined ? value : '';
            });

            // Ajouter la ligne
            table.rows.add(null, [rowValues]);

            await context.sync();

            return { success: true, data: rowData };
        });
    });
}

/**
 * Met à jour une ligne d'une table Excel
 * Utilise ExcelWriteQueue pour éviter les conflits de contexte
 * @param {string} tableName - Nom de la table
 * @param {number} rowIndex - Index de la ligne (0-based dans le corps de la table)
 * @param {Object} rowData - Nouvelles données
 * @returns {Promise<Object>} Résultat de la mise à jour
 */
async function updateTableRow(tableName, rowIndex, rowData) {
    // Invalider le cache
    tableCache.delete(tableName);

    // Utiliser la file d'attente pour sérialiser les opérations
    return await ExcelWriteQueue.enqueue(async () => {
        return await Excel.run(async (context) => {
            const table = context.workbook.tables.getItem(tableName);
            const headerRange = table.getHeaderRowRange();
            const bodyRange = table.getDataBodyRange();

            headerRange.load('values');

            await context.sync();

            const headers = headerRange.values[0];

            // Convertir l'objet en tableau dans l'ordre des colonnes
            const rowValues = headers.map(header => {
                const value = rowData[header];
                return value !== undefined ? value : '';
            });

            // Obtenir la ligne spécifique
            const row = bodyRange.getRow(rowIndex);
            row.values = [rowValues];

            await context.sync();

            return { success: true, data: rowData };
        });
    });
}

/**
 * Supprime une ligne d'une table Excel
 * Utilise ExcelWriteQueue pour éviter les conflits de contexte
 * @param {string} tableName - Nom de la table
 * @param {number} rowIndex - Index de la ligne (0-based dans le corps de la table)
 * @returns {Promise<Object>} Résultat de la suppression
 */
async function deleteTableRow(tableName, rowIndex) {
    // Invalider le cache
    tableCache.delete(tableName);

    // Utiliser la file d'attente pour sérialiser les opérations
    return await ExcelWriteQueue.enqueue(async () => {
        return await Excel.run(async (context) => {
            const table = context.workbook.tables.getItem(tableName);
            const row = table.rows.getItemAt(rowIndex);
            row.delete();

            await context.sync();

            return { success: true };
        });
    });
}

/**
 * Supprime plusieurs lignes d'une table (en partant de la fin)
 * Utilise ExcelWriteQueue pour éviter les conflits de contexte
 * @param {string} tableName - Nom de la table
 * @param {Array<number>} rowIndexes - Indexes des lignes à supprimer
 * @returns {Promise<Object>} Résultat
 */
async function deleteTableRows(tableName, rowIndexes) {
    // Invalider le cache
    tableCache.delete(tableName);

    // Trier en ordre décroissant pour supprimer de la fin vers le début
    const sortedIndexes = [...rowIndexes].sort((a, b) => b - a);

    // Utiliser la file d'attente pour sérialiser les opérations
    return await ExcelWriteQueue.enqueue(async () => {
        return await Excel.run(async (context) => {
            const table = context.workbook.tables.getItem(tableName);

            for (const index of sortedIndexes) {
                const row = table.rows.getItemAt(index);
                row.delete();
            }

            await context.sync();

            return { success: true, deletedCount: rowIndexes.length };
        });
    });
}

/**
 * Recherche dans une table
 * @param {string} tableName - Nom de la table
 * @param {string} searchTerm - Terme de recherche
 * @param {Array<string>} searchFields - Champs dans lesquels rechercher
 * @returns {Promise<Array>} Lignes correspondantes
 */
async function searchTable(tableName, searchTerm, searchFields = null) {
    const { data } = await readTable(tableName);

    if (!searchTerm) return data;

    const term = searchTerm.toLowerCase().trim();
    const fields = searchFields || Object.keys(data[0] || {}).filter(k => k !== '_rowIndex');

    return data.filter(row => {
        return fields.some(field => {
            const value = row[field];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(term);
        });
    });
}

/**
 * Obtient les valeurs uniques d'une colonne
 * @param {string} tableName - Nom de la table
 * @param {string} columnName - Nom de la colonne
 * @returns {Promise<Array>} Valeurs uniques
 */
async function getUniqueValues(tableName, columnName) {
    const { data } = await readTable(tableName);

    const values = data
        .map(row => row[columnName])
        .filter(value => value !== null && value !== undefined && value !== '');

    return [...new Set(values)].sort();
}

/**
 * Compte les lignes par valeur d'une colonne
 * @param {string} tableName - Nom de la table
 * @param {string} columnName - Nom de la colonne
 * @returns {Promise<Object>} Comptage { valeur: count }
 */
async function countByColumn(tableName, columnName) {
    const { data } = await readTable(tableName);

    return data.reduce((counts, row) => {
        const value = row[columnName] || 'Non défini';
        counts[value] = (counts[value] || 0) + 1;
        return counts;
    }, {});
}

/**
 * Obtient les statistiques de migration d'une table
 * @param {string} tableName - Nom de la table
 * @param {string} statusField - Nom du champ de statut
 * @returns {Promise<Object>} Statistiques
 */
async function getMigrationStats(tableName, statusField) {
    try {
        const { data } = await readTable(tableName);
        const total = data.length;

        console.log(`[getMigrationStats] ${tableName}: ${total} lignes`);

        if (total === 0) {
            return { total: 0, migre: 0, enCours: 0, nonMigre: 0, bloque: 0, percentMigre: 0 };
        }

        let migre = 0, enCours = 0, nonMigre = 0, bloque = 0;

        data.forEach(row => {
            const status = (row[statusField] || '').toLowerCase();
            // Gérer les différents formats de statut: "Terminé", "Migré", "Oui", etc.
            if (status.includes('terminé') || status.includes('migré') || status === 'oui') {
                migre++;
            } else if (status.includes('cours')) {
                enCours++;
            } else if (status.includes('bloqué')) {
                bloque++;
            } else {
                nonMigre++;
            }
        });

        return {
            total,
            migre,
            enCours,
            nonMigre,
            bloque,
            percentMigre: Math.round((migre / total) * 100)
        };
    } catch (error) {
        console.error(`[getMigrationStats] Erreur pour ${tableName}:`, error);
        return { total: 0, migre: 0, enCours: 0, nonMigre: 0, bloque: 0, percentMigre: 0 };
    }
}

/**
 * Vérifie si une table existe
 * @param {string} tableName - Nom de la table
 * @returns {Promise<boolean>} True si existe
 */
async function tableExists(tableName) {
    return await Excel.run(async (context) => {
        try {
            const tables = context.workbook.tables;
            tables.load('items/name');

            await context.sync();

            return tables.items.some(t => t.name === tableName);
        } catch (error) {
            return false;
        }
    });
}

/**
 * Liste toutes les tables du classeur
 * @returns {Promise<Array>} Liste des noms de tables
 */
async function listTables() {
    return await Excel.run(async (context) => {
        const tables = context.workbook.tables;
        tables.load('items/name');

        await context.sync();

        return tables.items.map(t => t.name);
    });
}

/**
 * Invalide le cache pour une ou toutes les tables
 * @param {string} tableName - Nom de la table (optionnel, invalide tout si non fourni)
 */
function invalidateCache(tableName = null) {
    if (tableName) {
        tableCache.delete(tableName);
        // Aussi invalider le cache persistant
        if (typeof PersistentCache !== 'undefined') {
            PersistentCache.invalidate(tableName);
        }
    } else {
        tableCache.clear();
        if (typeof PersistentCache !== 'undefined') {
            PersistentCache.clearAll();
        }
    }
}

/**
 * Exécute une opération Excel avec gestion d'erreur
 * @param {Function} operation - Opération à exécuter
 * @returns {Promise<Object>} Résultat { success, data, error }
 */
async function safeExcelOperation(operation) {
    try {
        const result = await Excel.run(operation);
        return { success: true, data: result };
    } catch (error) {
        console.error('Erreur Excel:', error);

        let message = 'Une erreur est survenue.';
        if (error.code === 'InvalidArgument') {
            message = 'Paramètres invalides.';
        } else if (error.code === 'ItemNotFound') {
            message = 'Élément non trouvé.';
        } else if (error.message) {
            message = error.message;
        }

        return { success: false, error: message };
    }
}

/**
 * Lit toutes les données d'une feuille Excel (usedRange)
 * @param {string} sheetName - Nom de la feuille Excel
 * @returns {Promise<Object>} { headers: [], rows: [], data: [] }
 */
async function readSheet(sheetName) {
    console.log(`[readSheet] Reading sheet: ${sheetName}`);

    try {
        if (typeof Excel === 'undefined') {
            console.error('[readSheet] Excel API is not available');
            return { headers: [], rows: [], data: [] };
        }

        return await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getItem(sheetName);
            const usedRange = sheet.getUsedRange();
            usedRange.load('values');

            await context.sync();

            const values = usedRange.values || [];
            if (values.length === 0) {
                return { headers: [], rows: [], data: [] };
            }

            const headers = values[0];
            const rows = values.slice(1);

            // Convertir en tableau d'objets
            const data = rows.map((row, index) => {
                const obj = { _rowIndex: index };
                headers.forEach((header, colIndex) => {
                    obj[header] = row[colIndex];
                });
                return obj;
            });

            console.log(`[readSheet] ${sheetName} has ${rows.length} rows`);
            return { headers, rows, data };
        });
    } catch (error) {
        console.error(`[readSheet] Error for ${sheetName}:`, error);
        return { headers: [], rows: [], data: [] };
    }
}

/**
 * Copie les données d'une feuille Jira vers une table, en vérifiant les doublons par clé
 * @param {string} jiraSheetName - Nom de la feuille source (Jira)
 * @param {string} tableName - Nom de la table destination
 * @param {string} keyField - Nom du champ clé pour vérifier les doublons
 * @param {Object} options - Options avancées
 * @param {string[]} options.skipStates - États à ignorer pour les nouveaux éléments
 * @param {string} options.stateField - Nom du champ état (défaut: 'État')
 * @param {string[]} options.updateFields - Champs à mettre à jour pour les éléments existants
 * @returns {Promise<Object>} Résultat { success, added, updated, skipped, error }
 */
async function copyFromJira(jiraSheetName, tableName, keyField = 'Clé', options = {}) {
    const { skipStates = [], stateField = 'État', updateFields = [] } = options;
    console.log(`[copyFromJira] Copying from ${jiraSheetName} to ${tableName}`);

    try {
        // Invalider le cache de la table destination
        tableCache.delete(tableName);

        // Lire les données source (feuille Jira)
        const jiraData = await readSheet(jiraSheetName);
        if (jiraData.data.length === 0) {
            return { success: true, added: 0, updated: 0, skipped: 0, message: 'Aucune donnée dans la feuille source' };
        }

        // Lire les données existantes dans la table destination
        const existingData = await readTable(tableName, false);
        const existingMap = new Map();
        existingData.data.forEach(row => {
            const key = String(row[keyField] || '').trim().toLowerCase();
            if (key) existingMap.set(key, row);
        });

        console.log(`[copyFromJira] Existing keys: ${existingMap.size}, Jira rows: ${jiraData.data.length}`);

        let added = 0;
        let updated = 0;
        let skippedExisting = 0;
        let skippedState = 0;

        for (const jiraRow of jiraData.data) {
            const key = String(jiraRow[keyField] || '').trim().toLowerCase();
            if (!key) continue;

            const existingRow = existingMap.get(key);

            if (existingRow) {
                // Élément existant : mettre à jour les champs spécifiés
                if (updateFields.length > 0) {
                    let needsUpdate = false;
                    const updatedRow = { ...existingRow };
                    delete updatedRow._rowIndex;

                    for (const field of updateFields) {
                        const jiraValue = String(jiraRow[field] || '').trim();
                        const existingValue = String(existingRow[field] || '').trim();
                        if (jiraValue && jiraValue !== existingValue) {
                            updatedRow[field] = jiraRow[field];
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        await updateTableRow(tableName, existingRow._rowIndex, updatedRow);
                        updated++;
                    } else {
                        skippedExisting++;
                    }
                } else {
                    skippedExisting++;
                }
            } else {
                // Nouvel élément : vérifier si l'état doit être ignoré
                if (skipStates.length > 0) {
                    const state = String(jiraRow[stateField] || '').trim();
                    if (skipStates.includes(state)) {
                        skippedState++;
                        continue;
                    }
                }

                const rowData = { ...jiraRow };
                delete rowData._rowIndex;
                await addTableRow(tableName, rowData);
                added++;
            }
        }

        console.log(`[copyFromJira] Added: ${added}, Updated: ${updated}, Skipped existing: ${skippedExisting}, Skipped state: ${skippedState}`);

        // Construire le message
        const parts = [];
        if (added > 0) parts.push(`${added} ajouté(s)`);
        if (updated > 0) parts.push(`${updated} mis à jour`);
        if (skippedState > 0) parts.push(`${skippedState} ignoré(s) (état Résolue)`);
        if (skippedExisting > 0) parts.push(`${skippedExisting} inchangé(s)`);
        const message = parts.length > 0 ? parts.join(', ') : 'Aucune modification';

        return {
            success: true,
            added,
            updated,
            skipped: skippedExisting + skippedState,
            message
        };
    } catch (error) {
        console.error(`[copyFromJira] Error:`, error);
        return { success: false, added: 0, updated: 0, skipped: 0, error: error.message };
    }
}
