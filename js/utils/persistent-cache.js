/* ===========================================
   PERSISTENT-CACHE.JS - Cache localStorage persistant
   Application Carto

   Permet de stocker les données en cache local
   pour un affichage instantané et une résilience réseau
   =========================================== */

const PersistentCache = {
    PREFIX: 'carto_cache_',
    META_KEY: 'carto_cache_meta',
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 heures max
    FRESH_AGE: 30 * 1000, // 30 secondes = données fraîches

    /**
     * Sauvegarde les données d'une table dans le localStorage
     * @param {string} tableName - Nom de la table
     * @param {Object} data - Données à sauvegarder
     */
    save(tableName, data) {
        try {
            const key = this.PREFIX + tableName;
            const entry = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(entry));
            this._updateMeta(tableName, Date.now());
            console.log(`[PersistentCache] Saved ${tableName} to localStorage`);
        } catch (e) {
            console.warn('[PersistentCache] localStorage full or unavailable:', e);
            // Essayer de libérer de l'espace en supprimant les anciennes entrées
            this._cleanup();
        }
    },

    /**
     * Récupère les données d'une table depuis le localStorage
     * @param {string} tableName - Nom de la table
     * @returns {Object|null} { data, isFresh, isValid, age, timestamp }
     */
    get(tableName) {
        try {
            const key = this.PREFIX + tableName;
            const item = localStorage.getItem(key);

            if (!item) {
                return null;
            }

            const { data, timestamp } = JSON.parse(item);
            const age = Date.now() - timestamp;

            return {
                data,
                timestamp,
                age,
                isFresh: age < this.FRESH_AGE,
                isValid: age < this.MAX_AGE
            };
        } catch (e) {
            console.warn('[PersistentCache] Error reading cache:', e);
            return null;
        }
    },

    /**
     * Invalide le cache d'une table spécifique
     * @param {string} tableName - Nom de la table (ou null pour tout effacer)
     */
    invalidate(tableName) {
        if (tableName) {
            localStorage.removeItem(this.PREFIX + tableName);
            console.log(`[PersistentCache] Invalidated ${tableName}`);
        } else {
            this.clearAll();
        }
    },

    /**
     * Efface tout le cache
     */
    clearAll() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
        console.log(`[PersistentCache] Cleared all cache (${keys.length} entries)`);
    },

    /**
     * Obtient les métadonnées du cache (dernière sync, etc.)
     * @returns {Object} { lastSync, tables }
     */
    getMeta() {
        try {
            const meta = localStorage.getItem(this.META_KEY);
            return meta ? JSON.parse(meta) : { lastSync: null, tables: {} };
        } catch (e) {
            return { lastSync: null, tables: {} };
        }
    },

    /**
     * Met à jour les métadonnées
     */
    _updateMeta(tableName, timestamp) {
        try {
            const meta = this.getMeta();
            meta.lastSync = timestamp;
            meta.tables[tableName] = timestamp;
            localStorage.setItem(this.META_KEY, JSON.stringify(meta));
        } catch (e) {
            // Ignorer les erreurs de métadonnées
        }
    },

    /**
     * Nettoie les entrées expirées pour libérer de l'espace
     */
    _cleanup() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX) && k !== this.META_KEY);
        let cleaned = 0;

        for (const key of keys) {
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (Date.now() - item.timestamp > this.MAX_AGE) {
                    localStorage.removeItem(key);
                    cleaned++;
                }
            } catch (e) {
                localStorage.removeItem(key);
                cleaned++;
            }
        }

        console.log(`[PersistentCache] Cleaned ${cleaned} expired entries`);
    },

    /**
     * Formate l'âge du cache en texte lisible
     * @param {number} timestamp - Timestamp de la dernière sync
     * @returns {string} Texte formaté (ex: "il y a 5 min")
     */
    formatAge(timestamp) {
        if (!timestamp) return 'jamais';

        const age = Date.now() - timestamp;
        const seconds = Math.floor(age / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) return 'à l\'instant';
        if (minutes < 60) return `il y a ${minutes} min`;
        if (hours < 24) return `il y a ${hours}h`;
        return `il y a ${Math.floor(hours / 24)}j`;
    }
};

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.PersistentCache = PersistentCache;
}
