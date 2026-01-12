/* ===========================================
   HELPERS.JS - Fonctions utilitaires
   Application Carto
   =========================================== */

/**
 * Formate une date en français
 * @param {Date|string} date - Date à formater
 * @param {string} format - Format de sortie ('short', 'long', 'iso')
 * @returns {string} Date formatée
 */
function formatDate(date, format = 'short') {
    if (!date) return '';

    const d = date instanceof Date ? date : new Date(date);

    if (isNaN(d.getTime())) return '';

    const options = {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric' },
        iso: null
    };

    if (format === 'iso') {
        return d.toISOString().split('T')[0];
    }

    return d.toLocaleDateString('fr-FR', options[format] || options.short);
}

/**
 * Formate un nombre
 * @param {number} value - Valeur à formater
 * @param {number} decimals - Nombre de décimales
 * @returns {string} Nombre formaté
 */
function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined || isNaN(value)) return '-';

    return Number(value).toLocaleString('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Formate un pourcentage
 * @param {number} value - Valeur (0-100 ou 0-1)
 * @param {number} decimals - Nombre de décimales
 * @returns {string} Pourcentage formaté
 */
function formatPercent(value, decimals = 0) {
    if (value === null || value === undefined || isNaN(value)) return '-';

    // Si la valeur est entre 0 et 1, multiplier par 100
    const percent = value <= 1 && value >= 0 ? value * 100 : value;

    return formatNumber(percent, decimals) + '%';
}

/**
 * Tronque un texte
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} Texte tronqué
 */
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Génère un ID unique
 * @returns {string} ID unique
 */
function generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce une fonction
 * @param {Function} func - Fonction à debouncer
 * @param {number} wait - Délai en millisecondes
 * @returns {Function} Fonction debouncée
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle une fonction
 * @param {Function} func - Fonction à throttler
 * @param {number} limit - Limite en millisecondes
 * @returns {Function} Fonction throttlée
 */
function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Clone profondément un objet
 * @param {Object} obj - Objet à cloner
 * @returns {Object} Clone de l'objet
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));

    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * Compare deux objets
 * @param {Object} obj1 - Premier objet
 * @param {Object} obj2 - Deuxième objet
 * @returns {boolean} True si égaux
 */
function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== 'object' || obj1 === null || obj2 === null) return false;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => deepEqual(obj1[key], obj2[key]));
}

/**
 * Convertit une chaîne en slug
 * @param {string} text - Texte à convertir
 * @returns {string} Slug
 */
function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

/**
 * Capitalise la première lettre
 * @param {string} text - Texte à capitaliser
 * @returns {string} Texte capitalisé
 */
function capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Valide une adresse email
 * @param {string} email - Email à valider
 * @returns {boolean} True si valide
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Retourne la classe CSS pour un statut de migration
 * @param {string} status - Statut de migration
 * @returns {string} Classe CSS
 */
function getMigrationStatusClass(status) {
    if (!status) return 'badge-secondary';

    const statusLower = status.toLowerCase();
    if (statusLower.includes('migré') || statusLower === 'oui') return 'badge-migre';
    if (statusLower.includes('cours')) return 'badge-en-cours';
    if (statusLower.includes('bloqué')) return 'badge-bloque';
    return 'badge-non-migre';
}

/**
 * Retourne la couleur pour un statut de migration
 * @param {string} status - Statut de migration
 * @returns {string} Couleur hexadécimale
 */
function getMigrationStatusColor(status) {
    if (!status) return '#6C757D';

    const statusLower = status.toLowerCase();
    if (statusLower.includes('migré') || statusLower === 'oui') return '#28A745';
    if (statusLower.includes('cours')) return '#FFC107';
    if (statusLower.includes('bloqué')) return '#6C757D';
    return '#DC3545';
}

/**
 * Calcule le pourcentage d'un statut
 * @param {Array} data - Tableau de données
 * @param {string} field - Champ à analyser
 * @param {string} targetStatus - Statut cible
 * @returns {number} Pourcentage (0-100)
 */
function calculateStatusPercentage(data, field, targetStatus) {
    if (!data || data.length === 0) return 0;

    const matching = data.filter(item => {
        const value = item[field];
        if (!value) return false;
        return value.toLowerCase().includes(targetStatus.toLowerCase());
    });

    return (matching.length / data.length) * 100;
}

/**
 * Groupe les données par une clé
 * @param {Array} data - Données à grouper
 * @param {string} key - Clé de groupement
 * @returns {Object} Données groupées
 */
function groupBy(data, key) {
    if (!data || !Array.isArray(data)) return {};

    return data.reduce((groups, item) => {
        const value = item[key] || 'Non défini';
        if (!groups[value]) {
            groups[value] = [];
        }
        groups[value].push(item);
        return groups;
    }, {});
}

/**
 * Trie un tableau par une clé
 * @param {Array} data - Données à trier
 * @param {string} key - Clé de tri
 * @param {string} order - Ordre ('asc' ou 'desc')
 * @returns {Array} Données triées
 */
function sortBy(data, key, order = 'asc') {
    if (!data || !Array.isArray(data)) return [];

    return [...data].sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        // Gestion des valeurs null/undefined
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        // Comparaison de chaînes
        if (typeof valA === 'string' && typeof valB === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Filtre les données selon un terme de recherche
 * @param {Array} data - Données à filtrer
 * @param {string} searchTerm - Terme de recherche
 * @param {Array} fields - Champs à rechercher
 * @returns {Array} Données filtrées
 */
function searchFilter(data, searchTerm, fields = null) {
    if (!data || !searchTerm) return data || [];

    const term = searchTerm.toLowerCase().trim();
    if (!term) return data;

    return data.filter(item => {
        const searchFields = fields || Object.keys(item);
        return searchFields.some(field => {
            const value = item[field];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(term);
        });
    });
}

/**
 * Obtient une valeur imbriquée dans un objet
 * @param {Object} obj - Objet source
 * @param {string} path - Chemin (ex: 'a.b.c')
 * @param {*} defaultValue - Valeur par défaut
 * @returns {*} Valeur trouvée ou défaut
 */
function getNestedValue(obj, path, defaultValue = undefined) {
    if (!obj || !path) return defaultValue;

    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result === null || result === undefined) return defaultValue;
        result = result[key];
    }

    return result !== undefined ? result : defaultValue;
}

/**
 * Définit une valeur imbriquée dans un objet
 * @param {Object} obj - Objet cible
 * @param {string} path - Chemin (ex: 'a.b.c')
 * @param {*} value - Valeur à définir
 */
function setNestedValue(obj, path, value) {
    if (!obj || !path) return;

    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current)) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}

/**
 * Échappe les caractères HTML
 * @param {string} text - Texte à échapper
 * @returns {string} Texte échappé
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Parse un nombre depuis une chaîne
 * @param {string} value - Valeur à parser
 * @returns {number|null} Nombre ou null
 */
function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(String(value).replace(',', '.').replace(/\s/g, ''));
    return isNaN(parsed) ? null : parsed;
}

/**
 * Génère une couleur à partir d'un texte (hash)
 * @param {string} text - Texte source
 * @returns {string} Couleur hexadécimale
 */
function stringToColor(text) {
    if (!text) return '#6C757D';

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
        '#0066CC', '#FF6600', '#28A745', '#DC3545', '#FFC107',
        '#17A2B8', '#6C757D', '#6610F2', '#E83E8C', '#20C997'
    ];

    return colors[Math.abs(hash) % colors.length];
}
