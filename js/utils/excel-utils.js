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
                const obj = { _rowIndex: index }; // 0-based index pour les API getRow/getItemAt
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

/**
 * Lit toutes les données d'une feuille Excel (usedRange)
 * @param {string} sheetName - Nom de la feuille Excel
 * @param {string} linkColumn - Nom de la colonne contenant des liens hypertextes (optionnel)
 * @returns {Promise<Object>} { headers: [], rows: [], data: [] }
 */
async function readSheet(sheetName, linkColumn = null) {
    console.log(`[readSheet] Reading sheet: ${sheetName}, linkColumn: ${linkColumn}`);

    try {
        if (typeof Excel === 'undefined') {
            console.error('[readSheet] Excel API is not available');
            return { headers: [], rows: [], data: [] };
        }

        return await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getItem(sheetName);
            const usedRange = sheet.getUsedRange();
            usedRange.load('values, rowCount, columnCount, address');

            await context.sync();

            const values = usedRange.values || [];
            if (values.length === 0) {
                return { headers: [], rows: [], data: [] };
            }

            const headers = values[0];
            const rows = values.slice(1);

            // Trouver l'index de la colonne avec les liens
            let linkColIndex = -1;
            if (linkColumn) {
                linkColIndex = headers.indexOf(linkColumn);
            }

            // Extraire les hyperlinks si une colonne de lien est spécifiée
            const hyperlinks = {};
            if (linkColIndex >= 0 && rows.length > 0) {
                console.log(`[readSheet] Extracting hyperlinks from column ${linkColumn} (index ${linkColIndex})`);

                // Extraire la lettre de colonne depuis l'adresse
                const startAddress = usedRange.address.split('!')[1].split(':')[0];
                const colLetter = getColumnLetter(linkColIndex);

                // Lire les hyperlinks pour chaque cellule de la colonne
                for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
                    try {
                        const cellAddress = `${colLetter}${rowIdx + 2}`; // +2 car row 1 = headers
                        const cell = sheet.getRange(cellAddress);
                        cell.load('hyperlink');
                        await context.sync();

                        if (cell.hyperlink && cell.hyperlink.address) {
                            hyperlinks[rowIdx] = cell.hyperlink.address;
                        }
                    } catch (e) {
                        // Pas de lien sur cette cellule, continuer
                    }
                }
                console.log(`[readSheet] Found ${Object.keys(hyperlinks).length} hyperlinks`);
            }

            // Convertir en tableau d'objets
            const data = rows.map((row, index) => {
                const obj = { _rowIndex: index };
                headers.forEach((header, colIndex) => {
                    obj[header] = row[colIndex];
                });
                // Ajouter le lien hypertexte si disponible
                if (hyperlinks[index]) {
                    obj['_lien'] = hyperlinks[index];
                }
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
 * Convertit un index de colonne (0-based) en lettre Excel (A, B, C, ..., Z, AA, AB, ...)
 */
function getColumnLetter(colIndex) {
    let letter = '';
    let temp = colIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

/**
 * Copie les données d'une feuille Jira vers une table, en vérifiant les doublons par clé
 * @param {string} jiraSheetName - Nom de la feuille source (Jira)
 * @param {string} tableName - Nom de la table destination
 * @param {string} keyField - Nom du champ clé pour vérifier les doublons
 * @param {string} linkField - Nom du champ destination pour le lien (optionnel)
 * @returns {Promise<Object>} Résultat { success, added, skipped, error }
 */
async function copyFromJira(jiraSheetName, tableName, keyField = 'Clé', linkField = 'Lien Jira') {
    console.log(`[copyFromJira] Copying from ${jiraSheetName} to ${tableName}`);

    try {
        // Invalider le cache de la table destination
        tableCache.delete(tableName);

        // Lire les données source (feuille Jira) avec extraction des liens de la colonne Clé
        const jiraData = await readSheet(jiraSheetName, keyField);
        if (jiraData.data.length === 0) {
            return { success: true, added: 0, skipped: 0, message: 'Aucune donnée dans la feuille source' };
        }

        // Lire les données existantes dans la table destination
        const existingData = await readTable(tableName, false);
        const existingKeys = new Set(
            existingData.data.map(row => String(row[keyField] || '').trim().toLowerCase())
        );

        console.log(`[copyFromJira] Existing keys: ${existingKeys.size}`);

        // Filtrer les lignes à ajouter (celles dont la clé n'existe pas)
        const rowsToAdd = jiraData.data.filter(row => {
            const key = String(row[keyField] || '').trim().toLowerCase();
            return key && !existingKeys.has(key);
        });

        console.log(`[copyFromJira] Rows to add: ${rowsToAdd.length}`);

        // Ajouter les nouvelles lignes
        let added = 0;
        for (const row of rowsToAdd) {
            // Supprimer _rowIndex et transférer _lien vers linkField
            const rowData = { ...row };
            delete rowData._rowIndex;

            // Transférer le lien hypertexte vers le champ dédié
            if (rowData._lien && linkField) {
                rowData[linkField] = rowData._lien;
                delete rowData._lien;
            }

            await addTableRow(tableName, rowData);
            added++;
        }

        const skipped = jiraData.data.length - added;

        return {
            success: true,
            added,
            skipped,
            message: `${added} élément(s) ajouté(s), ${skipped} ignoré(s) (déjà existants)`
        };
    } catch (error) {
        console.error(`[copyFromJira] Error:`, error);
        return { success: false, added: 0, skipped: 0, error: error.message };
    }
}
