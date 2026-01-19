/* ===========================================
   PARAMS.JS - Pages de gestion des paramètres
   Application Carto
   =========================================== */

/**
 * Classe ParamsPage pour gérer les tables de paramètres
 */
class ParamsPage {
    constructor(tableKey) {
        this.tableKey = tableKey;
        this.tableConfig = CONFIG.TABLES[tableKey];
        this.dataTable = null;
    }

    /**
     * Rendu de la page
     */
    async render(container) {
        if (!this.tableConfig) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    Configuration de table non trouvée pour: ${this.tableKey}
                </div>
            `;
            return;
        }

        // Afficher le bouton Copie Jira si la table a une source Jira
        const jiraButtonHtml = this.tableConfig.jiraSheet ? `
            <button id="btnCopyJira" class="btn btn-action btn-sm">
                <span>&#128230;</span> Copie Jira
            </button>
        ` : '';

        container.innerHTML = `
            <div class="params-page">
                ${jiraButtonHtml ? `<div class="params-toolbar">${jiraButtonHtml}</div>` : ''}
                <section class="section">
                    <div id="tableParams"></div>
                </section>
            </div>
        `;

        // Attacher l'événement du bouton Copie Jira
        if (this.tableConfig.jiraSheet) {
            const btnCopyJira = document.getElementById('btnCopyJira');
            if (btnCopyJira) {
                btnCopyJira.addEventListener('click', () => this.handleCopyFromJira());
            }
        }

        await this.renderTable();
    }

    /**
     * Gère la copie depuis Jira
     */
    async handleCopyFromJira() {
        const jiraSheet = this.tableConfig.jiraSheet;
        const tableName = this.tableConfig.name;
        const keyField = 'Clé';

        showConfirmModal(
            'Copie depuis Jira',
            `Voulez-vous copier les données depuis la feuille "${jiraSheet}" vers la table "${tableName}" ?\n\nLes clés existantes seront ignorées.`,
            async () => {
                try {
                    showInfo('Copie en cours...');

                    // Appeler la fonction de copie via ExcelBridge
                    const result = await copyFromJira(jiraSheet, tableName, keyField);

                    if (result.success) {
                        showSuccess(result.message);
                        await this.refresh();
                    } else {
                        showError('Erreur lors de la copie: ' + (result.error || 'Erreur inconnue'));
                    }
                    return true;
                } catch (error) {
                    showError('Erreur lors de la copie: ' + error.message);
                    return false;
                }
            },
            { confirmText: 'Copier' }
        );
    }

    /**
     * Rendu du tableau
     */
    async renderTable() {
        const container = document.getElementById('tableParams');
        if (!container) return;

        this.dataTable = new DataTable(container, {
            tableName: this.tableConfig.name,
            tableConfig: this.tableConfig,
            columns: this.tableConfig.columns,
            showToolbar: true,
            showPagination: true,
            editable: true,
            onAdd: () => this.showAddForm(),
            onEdit: (row, index) => this.showEditForm(row, index),
            onDelete: (row, index) => this.confirmDelete(row, index)
        });
    }

    /**
     * Affiche le formulaire d'ajout
     */
    showAddForm() {
        showFormModal(
            `Ajouter - ${this.tableConfig.displayName}`,
            this.tableConfig.columns,
            async (formData) => {
                try {
                    await addTableRow(this.tableConfig.name, formData);
                    showSuccess('Élément ajouté avec succès');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de l\'ajout: ' + error.message);
                    return false;
                }
            }
        );
        // Note: loadDynamicSelectOptions est appelé par showFormModal
    }

    /**
     * Affiche le formulaire de modification
     */
    showEditForm(row, index) {
        // Utiliser _rowIndex de la row (index Excel réel) plutôt que l'index du tableau affiché
        const rowIndex = row._rowIndex;

        showFormModal(
            `Modifier - ${this.tableConfig.displayName}`,
            this.tableConfig.columns,
            async (formData) => {
                try {
                    await updateTableRow(this.tableConfig.name, rowIndex, formData);
                    showSuccess('Élément modifié avec succès');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de la modification: ' + error.message);
                    return false;
                }
            },
            row
        );
        // Note: loadDynamicSelectOptions et setFormData sont appelés par showFormModal
    }

    /**
     * Confirme la suppression
     */
    confirmDelete(row, index) {
        const identifiant = row[this.tableConfig.columns[0]?.field] || `Ligne ${index + 1}`;
        // Utiliser _rowIndex de la row (index Excel réel) plutôt que l'index du tableau affiché
        const rowIndex = row._rowIndex;

        showConfirmModal(
            'Confirmer la suppression',
            `Êtes-vous sûr de vouloir supprimer "${identifiant}" ?`,
            async () => {
                try {
                    await deleteTableRow(this.tableConfig.name, rowIndex);
                    showSuccess('Élément supprimé avec succès');
                    await this.refresh();
                    return true;
                } catch (error) {
                    showError('Erreur lors de la suppression: ' + error.message);
                    return false;
                }
            },
            { confirmText: 'Supprimer' }
        );
    }

    /**
     * Rafraîchit la page
     */
    async refresh() {
        if (this.dataTable) {
            await this.dataTable.refresh();
        }
    }
}

// Instance courante
let currentParamsPage = null;

/**
 * Rendu d'une page de paramètres
 * @param {HTMLElement} container - Conteneur
 * @param {string} tableKey - Clé de la table dans CONFIG.TABLES
 */
async function renderParamsPage(container, tableKey) {
    currentParamsPage = new ParamsPage(tableKey);
    await currentParamsPage.render(container);
}

/**
 * Rafraîchit la page de paramètres courante
 */
async function refreshParamsPage() {
    if (currentParamsPage) {
        await currentParamsPage.refresh();
    }
}
