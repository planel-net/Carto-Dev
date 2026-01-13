/* ===========================================
   MODAL.JS - Composant modale réutilisable
   Application Carto
   =========================================== */

/**
 * Classe Modal pour créer des modales dynamiques
 */
class Modal {
    constructor(options = {}) {
        this.id = options.id || 'modal_' + generateId();
        this.title = options.title || '';
        this.size = options.size || 'md'; // sm, md, lg, xl
        this.closable = options.closable !== false;
        this.onClose = options.onClose || null;
        this.onConfirm = options.onConfirm || null;
        this.confirmText = options.confirmText || 'Confirmer';
        this.cancelText = options.cancelText || 'Annuler';
        this.showFooter = options.showFooter !== false;
        this.content = options.content || '';

        this.element = null;
        this.backdrop = null;
    }

    /**
     * Crée et affiche la modale
     * @returns {Modal} Instance pour chaînage
     */
    show() {
        this.createElements();
        this.attachEvents();

        // Ajouter au DOM
        const container = document.getElementById('modalContainer') || document.body;
        container.appendChild(this.backdrop);
        container.appendChild(this.element);

        // Animation d'ouverture
        requestAnimationFrame(() => {
            this.backdrop.classList.add('show');
            this.element.classList.add('show');
        });

        // Focus sur le premier input si présent
        setTimeout(() => {
            const firstInput = this.element.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();
        }, 300);

        return this;
    }

    /**
     * Crée les éléments DOM de la modale
     */
    createElements() {
        // Backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'modal-backdrop';
        this.backdrop.id = this.id + '_backdrop';

        // Modal
        this.element = document.createElement('div');
        this.element.className = `modal modal-${this.size}`;
        this.element.id = this.id;

        this.element.innerHTML = `
            <div class="modal-header">
                <h3>${escapeHtml(this.title)}</h3>
                ${this.closable ? '<button class="modal-close" aria-label="Fermer">&times;</button>' : ''}
            </div>
            <div class="modal-body">
                ${this.content}
            </div>
            ${this.showFooter ? `
            <div class="modal-footer">
                <button class="btn btn-secondary modal-cancel">${escapeHtml(this.cancelText)}</button>
                <button class="btn btn-primary modal-confirm">${escapeHtml(this.confirmText)}</button>
            </div>
            ` : ''}
        `;
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        // Fermeture sur backdrop
        if (this.closable) {
            this.backdrop.addEventListener('click', () => this.close());
        }

        // Bouton fermer
        const closeBtn = this.element.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Bouton annuler
        const cancelBtn = this.element.querySelector('.modal-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        // Bouton confirmer
        const confirmBtn = this.element.querySelector('.modal-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirm());
        }

        // Fermeture sur Escape
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.closable) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Ferme la modale
     */
    close() {
        if (this.onClose) {
            const result = this.onClose();
            if (result === false) return; // Annuler la fermeture
        }

        // Animation de fermeture
        this.backdrop.classList.remove('show');
        this.element.classList.remove('show');

        // Supprimer du DOM après animation
        setTimeout(() => {
            this.destroy();
        }, 300);
    }

    /**
     * Action de confirmation
     */
    async confirm() {
        if (this.onConfirm) {
            const confirmBtn = this.element.querySelector('.modal-confirm');
            const originalText = confirmBtn.innerHTML;

            // Afficher le loader
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="spinner spinner-sm"></span>';

            try {
                const result = await this.onConfirm();
                if (result !== false) {
                    this.close();
                }
            } catch (error) {
                showError('Erreur: ' + error.message);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = originalText;
            }
        } else {
            this.close();
        }
    }

    /**
     * Détruit la modale et nettoie les événements
     */
    destroy() {
        document.removeEventListener('keydown', this.escapeHandler);

        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }

    /**
     * Met à jour le contenu de la modale
     * @param {string} content - Nouveau contenu HTML
     */
    setContent(content) {
        const body = this.element.querySelector('.modal-body');
        if (body) {
            body.innerHTML = content;
        }
    }

    /**
     * Met à jour le titre
     * @param {string} title - Nouveau titre
     */
    setTitle(title) {
        const titleEl = this.element.querySelector('.modal-header h3');
        if (titleEl) {
            titleEl.textContent = title;
        }
    }

    /**
     * Affiche/masque le footer
     * @param {boolean} show - Afficher ou non
     */
    toggleFooter(show) {
        const footer = this.element.querySelector('.modal-footer');
        if (footer) {
            footer.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Active/désactive le bouton de confirmation
     * @param {boolean} enabled - Activé ou non
     */
    setConfirmEnabled(enabled) {
        const confirmBtn = this.element.querySelector('.modal-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = !enabled;
        }
    }
}

/**
 * Crée et affiche une modale de confirmation
 * @param {string} message - Message de confirmation
 * @param {Function} onConfirm - Callback de confirmation
 * @param {Object} options - Options supplémentaires
 */
function showConfirmModal(message, onConfirm, options = {}) {
    return new Modal({
        title: options.title || 'Confirmation',
        size: 'sm',
        content: `<p>${escapeHtml(message)}</p>`,
        confirmText: options.confirmText || 'Confirmer',
        cancelText: options.cancelText || 'Annuler',
        onConfirm
    }).show();
}

/**
 * Crée et affiche une modale d'alerte
 * @param {string} message - Message
 * @param {string} type - Type (info, warning, error, success)
 */
function showAlertModal(message, type = 'info') {
    const icons = {
        info: '&#8505;',
        warning: '&#9888;',
        error: '&#10007;',
        success: '&#10003;'
    };

    const titles = {
        info: 'Information',
        warning: 'Attention',
        error: 'Erreur',
        success: 'Succès'
    };

    return new Modal({
        title: titles[type] || titles.info,
        size: 'sm',
        content: `
            <div class="text-center">
                <div style="font-size: 48px; margin-bottom: 16px;">${icons[type] || icons.info}</div>
                <p>${escapeHtml(message)}</p>
            </div>
        `,
        showFooter: true,
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => true
    }).show();
}

/**
 * Crée et affiche une modale avec un formulaire
 * @param {string} title - Titre
 * @param {Array} fields - Champs du formulaire
 * @param {Function} onSubmit - Callback de soumission
 * @param {Object} initialData - Données initiales
 */
function showFormModal(title, fields, onSubmit, initialData = {}) {
    const formId = 'modal_form_' + generateId();
    const content = generateFormHtml(formId, fields, initialData);
    const isEdit = Object.keys(initialData).length > 0;

    const modal = new Modal({
        title,
        size: 'md',
        content,
        confirmText: isEdit ? 'Modifier' : 'Ajouter',
        onConfirm: async () => {
            const form = document.getElementById(formId);
            if (!validateForm(form)) {
                return false;
            }

            const formData = getFormData(form);
            return await onSubmit(formData);
        }
    }).show();

    // Charger les options dynamiques des selects et restaurer les valeurs
    setTimeout(async () => {
        const form = document.getElementById(formId);
        if (form) {
            await loadDynamicSelectOptions(form);
            // Restaurer les valeurs initiales apres chargement des options
            if (isEdit) {
                setFormData(form, initialData);
            }
        }
    }, 100);

    return modal;
}

/**
 * Crée et affiche une modale de visualisation (sans édition)
 * @param {string} title - Titre
 * @param {string} content - Contenu HTML
 */
function showViewModal(title, content) {
    return new Modal({
        title,
        size: 'lg',
        content,
        showFooter: false
    }).show();
}
