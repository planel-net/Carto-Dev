/* ===========================================
   PROCESS-MODAL.JS - Modale partagée pour Processus
   Application Carto
   =========================================== */

/**
 * Module global pour gérer la modale de processus
 * Affiche la liste des produits associés à un processus
 */
const ProcessModal = {
    // Données chargées
    _data: {
        produits: [],
        processus: [],
        pdtProcess: []
    },

    /**
     * Charge toutes les données nécessaires
     */
    async loadData() {
        try {
            const [
                produitsData,
                processusData,
                pdtProcessData
            ] = await Promise.all([
                readTable('tProduits'),
                readTable('tProcessus'),
                readTable('tPdtProcess')
            ]);

            this._data.produits = produitsData.data || [];
            this._data.processus = processusData.data || [];
            this._data.pdtProcess = pdtProcessData.data || [];
        } catch (error) {
            console.error('[ProcessModal] Erreur chargement données:', error);
            throw error;
        }
    },

    /**
     * Affiche la modale d'un processus avec ses produits
     */
    async show(processusName) {
        await this.loadData();

        // Trouver le processus
        const processus = this._data.processus.find(p => p['Processus'] === processusName);
        if (!processus) {
            showError('Processus introuvable');
            return;
        }

        // Récupérer tous les produits liés à ce processus
        const produitsLies = this._data.pdtProcess
            .filter(pp => pp['Processus'] === processusName)
            .map(pp => pp['Produit']);

        // Récupérer les détails des produits
        const produits = this._data.produits
            .filter(p => produitsLies.includes(p['Nom']))
            .sort((a, b) => (a['Nom'] || '').localeCompare(b['Nom'] || ''));

        // Construire le contenu
        const content = `
            <div class="process-modal-content">
                <div class="process-info">
                    <div class="process-info-row">
                        <span class="process-info-label">Processus :</span>
                        <span class="process-info-value">${escapeHtml(processus['Processus'] || '')}</span>
                    </div>
                    ${processus['Sous-processus'] ? `
                        <div class="process-info-row">
                            <span class="process-info-label">Sous-processus :</span>
                            <span class="process-info-value">${escapeHtml(processus['Sous-processus'] || '')}</span>
                        </div>
                    ` : ''}
                    <div class="process-info-row">
                        <span class="process-info-label">Ordre :</span>
                        <span class="process-info-value">${escapeHtml(String(processus['Ordre'] || '-'))}</span>
                    </div>
                </div>

                <div class="process-products-section">
                    <h4>&#128202; Produits associés (${produits.length})</h4>
                    ${produits.length > 0 ? `
                        <div class="process-products-list">
                            ${produits.map(produit => {
                                const responsable = formatActorName(produit['Responsable'] || '');
                                const status = produit['Statut Migration'] || 'Non démarré';
                                const statusClass = this._getStatusClass(status);

                                return `
                                    <div class="process-product-item" onclick="ProcessModal._openProductModal('${escapeJsString(produit['Nom'])}', ${produit._rowIndex})">
                                        <div class="process-product-info">
                                            <div class="process-product-name">${escapeHtml(produit['Nom'])}</div>
                                            <div class="process-product-meta">
                                                <span class="process-product-responsable">${responsable}</span>
                                                <span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
                                            </div>
                                        </div>
                                        <div class="process-product-arrow">&#8250;</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `
                        <div class="process-products-empty">Aucun produit associé à ce processus</div>
                    `}
                </div>
            </div>
        `;

        showModal({
            title: `Processus : ${processusName}`,
            content: content,
            size: 'lg',
            buttons: [
                { label: 'Fermer', class: 'btn-secondary', action: 'close' }
            ]
        });
    },

    /**
     * Ouvre la modale d'un produit
     */
    async _openProductModal(produitNom, rowIndex) {
        const produit = this._data.produits.find(p => p['Nom'] === produitNom && p._rowIndex === rowIndex);
        if (!produit) {
            showError('Produit introuvable');
            return;
        }

        // Fermer la modale actuelle
        const currentModal = document.querySelector('.modal-overlay');
        if (currentModal) {
            currentModal.remove();
        }

        // Ouvrir la modale produit (réutiliser ProductModal si disponible)
        if (typeof ProductModal !== 'undefined' && ProductModal.showEditModal) {
            await ProductModal.showEditModal(produit, rowIndex, async () => {
                // Callback après modification : recharger les données
                await this.loadData();
            });
        } else {
            showError('ProductModal non disponible');
        }
    },

    /**
     * Retourne la classe CSS pour un statut migration
     */
    _getStatusClass(status) {
        const statusLower = (status || '').toLowerCase();
        if (statusLower.includes('migré') || statusLower.includes('terminé')) {
            return 'status-migre';
        } else if (statusLower.includes('en cours')) {
            return 'status-en-cours';
        } else if (statusLower.includes('bloqué')) {
            return 'status-bloque';
        } else {
            return 'status-non-demarre';
        }
    }
};
