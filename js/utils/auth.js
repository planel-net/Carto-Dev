/* ===========================================
   AUTH.JS - Gestion verrouillage/déverrouillage
   Application Carto
   =========================================== */

/**
 * Vérifie si le classeur est verrouillé
 * @returns {Promise<boolean>} True si verrouillé
 */
async function checkLockStatus() {
    return await Excel.run(async (context) => {
        const protection = context.workbook.protection;
        protection.load('protected');

        await context.sync();

        return protection.protected;
    });
}

/**
 * Récupère le mot de passe depuis la feuille 'mdp'
 * @returns {Promise<string>} Mot de passe
 */
async function getStoredPassword() {
    return await Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(CONFIG.SHEETS.PASSWORD);
        const cell = sheet.getRange(CONFIG.PASSWORD_CELL);
        cell.load('values');

        await context.sync();

        return cell.values[0][0] || '';
    });
}

/**
 * Déverrouille le classeur
 * @param {string} password - Mot de passe saisi par l'utilisateur
 * @returns {Promise<Object>} { success, message }
 */
async function unlockWorkbook(password) {
    return await Excel.run(async (context) => {
        try {
            // Récupérer le mot de passe stocké
            const sheet = context.workbook.worksheets.getItem(CONFIG.SHEETS.PASSWORD);
            const cell = sheet.getRange(CONFIG.PASSWORD_CELL);
            cell.load('values');

            await context.sync();

            const storedPassword = cell.values[0][0];

            // Vérifier le mot de passe
            if (password !== storedPassword) {
                return { success: false, message: 'Mot de passe incorrect.' };
            }

            // Déprotéger le classeur
            const workbook = context.workbook;
            workbook.protection.unprotect(password);

            // Charger les feuilles
            const sheets = workbook.worksheets;
            sheets.load('items/name,items/visibility');

            await context.sync();

            // Afficher toutes les feuilles SAUF 'mdp'
            for (const ws of sheets.items) {
                if (ws.name.toLowerCase() !== CONFIG.SHEETS.PASSWORD.toLowerCase()) {
                    ws.visibility = Excel.SheetVisibility.visible;
                }
            }

            await context.sync();

            return { success: true, message: 'Classeur déverrouillé.' };
        } catch (error) {
            console.error('Erreur déverrouillage:', error);

            // Gérer les erreurs spécifiques
            if (error.code === 'InvalidArgument' || error.message?.includes('password')) {
                return { success: false, message: 'Mot de passe incorrect.' };
            }

            return { success: false, message: 'Erreur lors du déverrouillage: ' + (error.message || error) };
        }
    });
}

/**
 * Verrouille le classeur
 * @returns {Promise<Object>} { success, message }
 */
async function lockWorkbook() {
    return await Excel.run(async (context) => {
        try {
            // Récupérer le mot de passe stocké
            const passwordSheet = context.workbook.worksheets.getItem(CONFIG.SHEETS.PASSWORD);
            const passwordCell = passwordSheet.getRange(CONFIG.PASSWORD_CELL);
            passwordCell.load('values');

            const sheets = context.workbook.worksheets;
            sheets.load('items/name');

            await context.sync();

            const password = passwordCell.values[0][0];

            // Feuilles qui restent visibles après verrouillage
            const visibleSheets = [
                CONFIG.SHEETS.HOME,  // Intro
                'DataAnaJira',
                'MAEJiras'
            ].map(s => s.toLowerCase());

            // Masquer toutes les feuilles sauf celles listées ci-dessus
            for (const ws of sheets.items) {
                const name = ws.name.toLowerCase();
                if (visibleSheets.includes(name)) {
                    ws.visibility = Excel.SheetVisibility.visible;
                } else {
                    ws.visibility = Excel.SheetVisibility.hidden;
                }
            }

            // Vérifier que le mot de passe existe
            if (!password) {
                return { success: false, message: 'Mot de passe non configuré dans la feuille mdp.' };
            }

            // Protéger le classeur avec mot de passe
            // Note: workbook.protection.protect() prend uniquement le mot de passe
            context.workbook.protection.protect(password);

            await context.sync();

            return { success: true, message: 'Classeur verrouillé.' };
        } catch (error) {
            console.error('Erreur verrouillage:', error);
            return { success: false, message: 'Erreur lors du verrouillage: ' + (error.message || error) };
        }
    });
}

/**
 * Change le mot de passe du classeur
 * @param {string} currentPassword - Mot de passe actuel
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {Promise<Object>} { success, message }
 */
async function changePassword(currentPassword, newPassword) {
    return await Excel.run(async (context) => {
        try {
            // Vérifier le mot de passe actuel
            const sheet = context.workbook.worksheets.getItem(CONFIG.SHEETS.PASSWORD);
            const cell = sheet.getRange(CONFIG.PASSWORD_CELL);
            cell.load('values');

            await context.sync();

            const storedPassword = cell.values[0][0];

            if (currentPassword !== storedPassword) {
                return { success: false, message: 'Mot de passe actuel incorrect.' };
            }

            // Valider le nouveau mot de passe
            if (!newPassword || newPassword.length < 4) {
                return { success: false, message: 'Le nouveau mot de passe doit faire au moins 4 caractères.' };
            }

            // Mettre à jour le mot de passe
            cell.values = [[newPassword]];

            await context.sync();

            return { success: true, message: 'Mot de passe modifié avec succès.' };
        } catch (error) {
            console.error('Erreur changement mot de passe:', error);
            return { success: false, message: 'Erreur lors du changement de mot de passe.' };
        }
    });
}

/**
 * Vérifie si une feuille spécifique est visible
 * @param {string} sheetName - Nom de la feuille
 * @returns {Promise<boolean>} True si visible
 */
async function isSheetVisible(sheetName) {
    return await Excel.run(async (context) => {
        try {
            const sheet = context.workbook.worksheets.getItem(sheetName);
            sheet.load('visibility');

            await context.sync();

            return sheet.visibility === Excel.SheetVisibility.visible;
        } catch (error) {
            console.error('Erreur vérification visibilité:', error);
            return false;
        }
    });
}

/**
 * Active une feuille spécifique
 * @param {string} sheetName - Nom de la feuille
 */
async function activateSheet(sheetName) {
    return await Excel.run(async (context) => {
        try {
            const sheet = context.workbook.worksheets.getItem(sheetName);
            sheet.activate();

            await context.sync();

            return { success: true };
        } catch (error) {
            console.error('Erreur activation feuille:', error);
            return { success: false, message: error.message };
        }
    });
}

/**
 * Vérifie si l'application a accès aux données (même si classeur verrouillé)
 * Note: L'application Office.js peut toujours accéder aux données masquées
 * @returns {Promise<boolean>} True si accès OK
 */
async function checkDataAccess() {
    return await Excel.run(async (context) => {
        try {
            // Tenter de lire une table pour vérifier l'accès
            const tables = context.workbook.tables;
            tables.load('items');

            await context.sync();

            return tables.items.length > 0;
        } catch (error) {
            console.error('Erreur vérification accès:', error);
            return false;
        }
    });
}
