/* ===========================================
   EXCEL-BRIDGE.JS - Communication Dialog <-> Taskpane
   Application Carto

   Le Dialog ne peut pas accéder directement à Excel.
   Ce module gère la communication via messages.
   =========================================== */

/**
 * Bridge de communication entre Dialog et Taskpane
 * Utilisé côté DIALOG pour envoyer des requêtes au Taskpane
 */
const ExcelBridge = {
    // Compteur pour les IDs de requêtes
    _requestId: 0,

    // Map des callbacks en attente de réponse
    _pendingRequests: new Map(),

    // Flag pour savoir si on est dans un dialog
    _isDialog: false,

    // Timeout par défaut (15 secondes)
    _timeout: 15000,

    /**
     * Initialise le bridge (côté Dialog)
     */
    init() {
        this._isDialog = true;
        console.log('[ExcelBridge] Initialized in dialog mode');

        // Écouter les messages du parent (Taskpane) via l'API Office.js
        // dialog.messageChild() est reçu via DialogParentMessageReceived
        if (typeof Office !== 'undefined' && Office.context && Office.context.ui) {
            Office.context.ui.addHandlerAsync(
                Office.EventType.DialogParentMessageReceived,
                (arg) => {
                    this._handleParentMessage(arg);
                },
                (result) => {
                    if (result.status === Office.AsyncResultStatus.Succeeded) {
                        console.log('[ExcelBridge] DialogParentMessageReceived handler registered');
                    } else {
                        console.error('[ExcelBridge] Failed to register handler:', result.error);
                        // Fallback: essayer window.onmessage (pour certaines versions d'Office)
                        window.addEventListener('message', (event) => {
                            this._handleParentMessage(event);
                        });
                        console.log('[ExcelBridge] Fallback to window.onmessage');
                    }
                }
            );
        }
    },

    /**
     * Envoie une requête au Taskpane et attend la réponse
     * @param {string} type - Type de requête (READ_TABLE, WRITE_ROW, etc.)
     * @param {Object} params - Paramètres de la requête
     * @returns {Promise<any>} - Données retournées par le Taskpane
     */
    async request(type, params = {}) {
        return new Promise((resolve, reject) => {
            const requestId = ++this._requestId;

            console.log(`[ExcelBridge] Sending request #${requestId}: ${type}`, params);

            // Stocker le callback
            this._pendingRequests.set(requestId, { resolve, reject });

            // Timeout
            const timeoutId = setTimeout(() => {
                if (this._pendingRequests.has(requestId)) {
                    this._pendingRequests.delete(requestId);
                    reject(new Error(`Request timeout: ${type}`));
                }
            }, this._timeout);

            // Mettre à jour le callback pour annuler le timeout
            this._pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeoutId);
                    resolve(data);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            // Envoyer le message au parent (Taskpane)
            const message = JSON.stringify({
                requestId,
                type,
                params
            });

            try {
                Office.context.ui.messageParent(message);
            } catch (error) {
                this._pendingRequests.delete(requestId);
                clearTimeout(timeoutId);
                reject(new Error(`Failed to send message: ${error.message}`));
            }
        });
    },

    /**
     * Gère les messages reçus du parent (Taskpane)
     * @param {Object} arg - Événement de message (peut être DialogParentMessageReceived ou MessageEvent)
     */
    _handleParentMessage(arg) {
        try {
            // Les messages peuvent venir de différentes sources
            // DialogParentMessageReceived: arg.message
            // window.onmessage: arg.data
            let rawData = arg.message || arg.data;

            let data;
            if (typeof rawData === 'string') {
                data = JSON.parse(rawData);
            } else {
                data = rawData;
            }

            console.log('[ExcelBridge] Received message from parent:', data);

            if (data.requestId && this._pendingRequests.has(data.requestId)) {
                const { resolve, reject } = this._pendingRequests.get(data.requestId);
                this._pendingRequests.delete(data.requestId);

                if (data.error) {
                    reject(new Error(data.error));
                } else {
                    resolve(data.result);
                }
            }
        } catch (error) {
            console.log('[ExcelBridge] Could not parse message:', arg.message || arg.data);
        }
    },

    /**
     * Raccourcis pour les opérations courantes
     */

    async readTable(tableName, useCache = true) {
        return this.request('READ_TABLE', { tableName, useCache });
    },

    async getMigrationStats(tableName, statusField) {
        return this.request('GET_MIGRATION_STATS', { tableName, statusField });
    },

    async addTableRow(tableName, rowData) {
        return this.request('ADD_ROW', { tableName, rowData });
    },

    async updateTableRow(tableName, rowIndex, rowData) {
        return this.request('UPDATE_ROW', { tableName, rowIndex, rowData });
    },

    async deleteTableRow(tableName, rowIndex) {
        return this.request('DELETE_ROW', { tableName, rowIndex });
    },

    async getUniqueValues(tableName, columnName) {
        return this.request('GET_UNIQUE_VALUES', { tableName, columnName });
    },

    async searchTable(tableName, searchTerm, searchFields) {
        return this.request('SEARCH_TABLE', { tableName, searchTerm, searchFields });
    },

    async listTables() {
        return this.request('LIST_TABLES', {});
    },

    /**
     * Envoie une commande simple (sans attente de réponse)
     */
    sendCommand(type, params = {}) {
        const message = JSON.stringify({
            type,
            params,
            isCommand: true // Pas besoin de réponse
        });

        try {
            Office.context.ui.messageParent(message);
        } catch (error) {
            console.error('[ExcelBridge] Failed to send command:', error);
        }
    },

    /**
     * Ferme le dialog
     */
    close() {
        this.sendCommand('CLOSE');
    }
};

// Auto-init si on est dans un contexte Office Dialog
if (typeof Office !== 'undefined') {
    Office.onReady(() => {
        // Vérifier si on est dans un dialog (pas de context.document)
        if (Office.context && !Office.context.document) {
            ExcelBridge.init();
        }
    });
}
