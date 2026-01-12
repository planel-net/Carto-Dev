/* ===========================================
   NOTIFICATIONS.JS - Système de notifications toast
   Application Carto
   =========================================== */

/**
 * Configuration des notifications
 */
const NOTIFICATION_CONFIG = {
    duration: 5000,
    maxNotifications: 5
};

/**
 * Icônes pour chaque type de notification
 */
const NOTIFICATION_ICONS = {
    success: '&#10003;',
    error: '&#10007;',
    warning: '&#9888;',
    info: '&#8505;'
};

/**
 * Affiche une notification toast
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification ('success', 'error', 'warning', 'info')
 * @param {Object} options - Options supplémentaires
 */
function showNotification(message, type = 'info', options = {}) {
    const container = getNotificationContainer();
    const notification = createNotificationElement(message, type, options);

    // Limiter le nombre de notifications visibles
    while (container.children.length >= NOTIFICATION_CONFIG.maxNotifications) {
        const oldest = container.firstChild;
        if (oldest) {
            oldest.remove();
        }
    }

    container.appendChild(notification);

    // Auto-fermeture
    const duration = options.duration || NOTIFICATION_CONFIG.duration;
    if (duration > 0) {
        // Ajouter la barre de progression
        const progressBar = notification.querySelector('.notification-progress-bar');
        if (progressBar) {
            progressBar.style.animationDuration = duration + 'ms';
        }

        setTimeout(() => {
            closeNotification(notification);
        }, duration);
    }

    return notification;
}

/**
 * Raccourcis pour les différents types de notifications
 */
function showSuccess(message, options = {}) {
    return showNotification(message, 'success', options);
}

function showError(message, options = {}) {
    return showNotification(message, 'error', { ...options, duration: 0 });
}

function showWarning(message, options = {}) {
    return showNotification(message, 'warning', options);
}

function showInfo(message, options = {}) {
    return showNotification(message, 'info', options);
}

/**
 * Obtient ou crée le conteneur de notifications
 * @returns {HTMLElement} Conteneur
 */
function getNotificationContainer() {
    let container = document.getElementById('notificationContainer');

    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    return container;
}

/**
 * Crée un élément de notification
 * @param {string} message - Message
 * @param {string} type - Type
 * @param {Object} options - Options
 * @returns {HTMLElement} Élément de notification
 */
function createNotificationElement(message, type, options = {}) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    const icon = options.icon || NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.info;
    const title = options.title || getDefaultTitle(type);

    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <div class="notification-content">
            ${title ? `<div class="notification-title">${escapeHtml(title)}</div>` : ''}
            <div class="notification-message">${escapeHtml(message)}</div>
        </div>
        <button class="notification-close" aria-label="Fermer">&times;</button>
        ${options.showProgress !== false ? `
        <div class="notification-progress">
            <div class="notification-progress-bar"></div>
        </div>
        ` : ''}
    `;

    // Attacher l'événement de fermeture
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => closeNotification(notification));

    return notification;
}

/**
 * Ferme une notification avec animation
 * @param {HTMLElement} notification - Élément de notification
 */
function closeNotification(notification) {
    if (!notification || notification.classList.contains('fade-out')) return;

    notification.classList.add('fade-out');

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

/**
 * Ferme toutes les notifications
 */
function clearAllNotifications() {
    const container = document.getElementById('notificationContainer');
    if (container) {
        const notifications = container.querySelectorAll('.notification');
        notifications.forEach(notification => closeNotification(notification));
    }
}

/**
 * Obtient le titre par défaut selon le type
 * @param {string} type - Type de notification
 * @returns {string} Titre
 */
function getDefaultTitle(type) {
    const titles = {
        success: 'Succès',
        error: 'Erreur',
        warning: 'Attention',
        info: 'Information'
    };
    return titles[type] || '';
}

/**
 * Affiche une notification de confirmation
 * @param {string} message - Message
 * @param {Function} onConfirm - Callback de confirmation
 * @param {Function} onCancel - Callback d'annulation
 */
function showConfirmation(message, onConfirm, onCancel) {
    const container = getNotificationContainer();

    const notification = document.createElement('div');
    notification.className = 'notification notification-warning';

    notification.innerHTML = `
        <span class="notification-icon">${NOTIFICATION_ICONS.warning}</span>
        <div class="notification-content">
            <div class="notification-title">Confirmation</div>
            <div class="notification-message">${escapeHtml(message)}</div>
            <div class="notification-actions" style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="btn btn-sm btn-danger confirm-btn">Confirmer</button>
                <button class="btn btn-sm btn-secondary cancel-btn">Annuler</button>
            </div>
        </div>
    `;

    const confirmBtn = notification.querySelector('.confirm-btn');
    const cancelBtn = notification.querySelector('.cancel-btn');

    confirmBtn.addEventListener('click', () => {
        closeNotification(notification);
        if (onConfirm) onConfirm();
    });

    cancelBtn.addEventListener('click', () => {
        closeNotification(notification);
        if (onCancel) onCancel();
    });

    container.appendChild(notification);
    return notification;
}

/**
 * Affiche une notification de chargement
 * @param {string} message - Message
 * @returns {Object} Objet avec méthodes update et close
 */
function showLoading(message = 'Chargement en cours...') {
    const container = getNotificationContainer();

    const notification = document.createElement('div');
    notification.className = 'notification notification-info';

    notification.innerHTML = `
        <span class="notification-icon">
            <span class="spinner spinner-sm"></span>
        </span>
        <div class="notification-content">
            <div class="notification-message loading-message">${escapeHtml(message)}</div>
        </div>
    `;

    container.appendChild(notification);

    return {
        update: (newMessage) => {
            const msgEl = notification.querySelector('.loading-message');
            if (msgEl) msgEl.textContent = newMessage;
        },
        close: () => closeNotification(notification),
        success: (successMessage) => {
            closeNotification(notification);
            showSuccess(successMessage);
        },
        error: (errorMessage) => {
            closeNotification(notification);
            showError(errorMessage);
        }
    };
}

// Fonction d'échappement HTML (si pas déjà définie dans helpers.js)
if (typeof escapeHtml === 'undefined') {
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
