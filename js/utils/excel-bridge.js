/* ===========================================
   EXCEL-BRIDGE.JS - Communication Dialog <-> Taskpane
   Application Carto

   Le Dialog ne peut pas accéder directement à Excel.
   Ce module gère la communication via messages.
   =========================================== */

/**
 * Gestionnaire de statut de connexion (côté Dialog)
 * Miroir de ConnectionStatus dans excel-utils.js
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

    setStatus(status, lastSync = null) {
        this._status = status;
        if (lastSync) this._lastSync = lastSync;
        this._notify();
    },

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

    removeListener(callback) {
        const index = this._listeners.indexOf(callback);
        if (index > -1) {
            this._listeners.splice(index, 1);
        }
    },

    clearListeners() {
        this._listeners = [];
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

    // Timeout par défaut (45 secondes - augmenté pour les réseaux lents)
    _timeout: 45000,

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
        // Vérifier d'abord le cache persistant local (localStorage)
        let persistentCached = null;
        if (useCache && typeof PersistentCache !== 'undefined') {
            persistentCached = PersistentCache.get(tableName);
            if (persistentCached?.isFresh) {
                console.log(`[ExcelBridge] ${tableName} returned from localStorage (fresh)`);
                return persistentCached.data;
            }
        }

        try {
            const result = await this.request('READ_TABLE', { tableName, useCache });

            // Sauvegarder dans le cache persistant
            if (typeof PersistentCache !== 'undefined' && result && result.data) {
                PersistentCache.save(tableName, result);
            }

            // Marquer comme connecté
            ConnectionStatus.setConnected();

            return result;
        } catch (error) {
            console.error(`[ExcelBridge] Error reading ${tableName}:`, error);

            // Fallback sur le cache persistant
            if (persistentCached?.isValid) {
                console.log(`[ExcelBridge] ${tableName} fallback to localStorage`);
                ConnectionStatus.setCache();
                return persistentCached.data;
            }

            ConnectionStatus.setOffline();
            return { headers: [], rows: [], data: [] };
        }
    },

    async getMigrationStats(tableName, statusField) {
        return this.request('GET_MIGRATION_STATS', { tableName, statusField });
    },

    async addTableRow(tableName, rowData) {
        // Vérifier si on est en ligne avant d'écrire
        if (!ConnectionStatus.isOnline()) {
            throw new Error('Mode hors ligne - Modifications impossibles. Cliquez sur "Actualiser" pour reconnecter.');
        }
        const result = await this.request('ADD_ROW', { tableName, rowData });
        // Invalider le cache local après modification
        if (typeof PersistentCache !== 'undefined') {
            PersistentCache.invalidate(tableName);
        }
        return result;
    },

    async updateTableRow(tableName, rowIndex, rowData) {
        // Vérifier si on est en ligne avant d'écrire
        if (!ConnectionStatus.isOnline()) {
            throw new Error('Mode hors ligne - Modifications impossibles. Cliquez sur "Actualiser" pour reconnecter.');
        }
        const result = await this.request('UPDATE_ROW', { tableName, rowIndex, rowData });
        // Invalider le cache local après modification
        if (typeof PersistentCache !== 'undefined') {
            PersistentCache.invalidate(tableName);
        }
        return result;
    },

    async deleteTableRow(tableName, rowIndex) {
        // Vérifier si on est en ligne avant d'écrire
        if (!ConnectionStatus.isOnline()) {
            throw new Error('Mode hors ligne - Modifications impossibles. Cliquez sur "Actualiser" pour reconnecter.');
        }
        const result = await this.request('DELETE_ROW', { tableName, rowIndex });
        // Invalider le cache local après modification
        if (typeof PersistentCache !== 'undefined') {
            PersistentCache.invalidate(tableName);
        }
        return result;
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

    async copyFromJira(jiraSheetName, tableName, keyField = 'Clé', options = {}) {
        return this.request('COPY_FROM_JIRA', { jiraSheetName, tableName, keyField, options });
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
