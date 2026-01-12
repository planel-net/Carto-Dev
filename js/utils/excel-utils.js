/* ===========================================
   EXCEL-UTILS.JS - Fonctions CRUD Excel génériques
   Application Carto
   =========================================== */

/**
 * Cache pour les données des tables
 */
const tableCache = new Map();
const CACHE_DURATION = 30000; // 30 secondes

/**
 * Lit toutes les données d'une table Excel
 * @param {string} tableName - Nom de la table Excel
 * @param {boolean} useCache - Utiliser le cache
 * @returns {Promise<Object>} { headers: [], rows: [], data: [] }
 */
async function readTable(tableName, useCache = true) {
    console.log(`[readTable] Reading table: ${tableName}`);

    // Vérifier le cache
    if (useCache && tableCache.has(tableName)) {
        const cached = tableCache.get(tableName);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`[readTable] ${tableName} returned from cache`);
            return cached.data;
        }
    }

    try {
        // Vérifier si Excel est disponible
        if (typeof Excel === 'undefined') {
            console.error('[readTable] Excel API is not available');
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
                const obj = { _rowIndex: index + 2 }; // +2 car Excel est 1-based et +1 pour l'en-tête
                headers.forEach((header, colIndex) => {
                    obj[header] = row[colIndex];
                });
                return obj;
            });

            const result = { headers, rows, data };

            // Mettre en cache
            tableCache.set(tableName, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        });

        // Timeout de 10 secondes pour ne pas bloquer
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout reading table ${tableName}`)), 10000)
        );

        return await Promise.race([excelOperation, timeout]);
    } catch (error) {
        console.error(`[readTable] Error for ${tableName}:`, error);
        console.error(`[readTable] Error details - code: ${error.code}, message: ${error.message}`);
        // Retourner des données vides au lieu de lever une erreur
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
 * @param {string} tableName - Nom de la table
 * @param {Object} rowData - Données de la ligne (objet clé-valeur)
 * @returns {Promise<Object>} Ligne ajoutée avec son index
 */
async function addTableRow(tableName, rowData) {
    // Invalider le cache
    tableCache.delete(tableName);

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
}

/**
 * Met à jour une ligne d'une table Excel
 * @param {string} tableName - Nom de la table
 * @param {number} rowIndex - Index de la ligne (0-based dans le corps de la table)
 * @param {Object} rowData - Nouvelles données
 * @returns {Promise<Object>} Résultat de la mise à jour
 */
async function updateTableRow(tableName, rowIndex, rowData) {
    // Invalider le cache
    tableCache.delete(tableName);

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
}

/**
 * Supprime une ligne d'une table Excel
 * @param {string} tableName - Nom de la table
 * @param {number} rowIndex - Index de la ligne (0-based dans le corps de la table)
 * @returns {Promise<Object>} Résultat de la suppression
 */
async function deleteTableRow(tableName, rowIndex) {
    // Invalider le cache
    tableCache.delete(tableName);

    return await Excel.run(async (context) => {
        const table = context.workbook.tables.getItem(tableName);
        const row = table.rows.getItemAt(rowIndex);
        row.delete();

        await context.sync();

        return { success: true };
    });
}

/**
 * Supprime plusieurs lignes d'une table (en partant de la fin)
 * @param {string} tableName - Nom de la table
 * @param {Array<number>} rowIndexes - Indexes des lignes à supprimer
 * @returns {Promise<Object>} Résultat
 */
async function deleteTableRows(tableName, rowIndexes) {
    // Invalider le cache
    tableCache.delete(tableName);

    // Trier en ordre décroissant pour supprimer de la fin vers le début
    const sortedIndexes = [...rowIndexes].sort((a, b) => b - a);

    return await Excel.run(async (context) => {
        const table = context.workbook.tables.getItem(tableName);

        for (const index of sortedIndexes) {
            const row = table.rows.getItemAt(index);
            row.delete();
        }

        await context.sync();

        return { success: true, deletedCount: rowIndexes.length };
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
            if (status.includes('migré') || status === 'oui') {
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
    } else {
        tableCache.clear();
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
