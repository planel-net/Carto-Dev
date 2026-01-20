/* ===========================================
   FORM.JS - Générateur de formulaires
   Application Carto
   =========================================== */

/**
 * Génère le HTML d'un formulaire
 * @param {string} formId - ID du formulaire
 * @param {Array} fields - Configuration des champs
 * @param {Object} data - Données initiales
 * @returns {string} HTML du formulaire
 */
function generateFormHtml(formId, fields, data = {}) {
    const fieldsHtml = fields.map(field => generateFieldHtml(field, data[field.field])).join('');

    return `
        <form id="${formId}" class="form">
            ${fieldsHtml}
        </form>
    `;
}

/**
 * Génère le HTML d'un champ de formulaire
 * @param {Object} field - Configuration du champ
 * @param {*} value - Valeur actuelle
 * @returns {string} HTML du champ
 */
function generateFieldHtml(field, value = '') {
    const { field: name, label, type, required, options, source, sourceField, placeholder } = field;
    const requiredClass = required ? 'required' : '';
    const requiredAttr = required ? 'required' : '';
    const displayValue = value !== null && value !== undefined ? value : '';

    let inputHtml = '';

    switch (type) {
        case 'select':
            inputHtml = generateSelectHtml(name, options, source, sourceField, displayValue, requiredAttr);
            break;

        case 'textarea':
            inputHtml = `
                <textarea
                    id="field_${name}"
                    name="${name}"
                    class="form-control"
                    placeholder="${placeholder || ''}"
                    ${requiredAttr}
                >${escapeHtml(String(displayValue))}</textarea>
            `;
            break;

        case 'number':
            inputHtml = `
                <input
                    type="number"
                    id="field_${name}"
                    name="${name}"
                    class="form-control"
                    value="${escapeHtml(String(displayValue))}"
                    placeholder="${placeholder || ''}"
                    step="any"
                    ${requiredAttr}
                >
            `;
            break;

        case 'date':
            const dateValue = displayValue ? formatDateForInput(displayValue) : '';
            inputHtml = `
                <input
                    type="date"
                    id="field_${name}"
                    name="${name}"
                    class="form-control"
                    value="${dateValue}"
                    ${requiredAttr}
                >
            `;
            break;

        case 'email':
            inputHtml = `
                <input
                    type="email"
                    id="field_${name}"
                    name="${name}"
                    class="form-control"
                    value="${escapeHtml(String(displayValue))}"
                    placeholder="${placeholder || 'email@exemple.com'}"
                    ${requiredAttr}
                >
            `;
            break;

        case 'checkbox':
            const checked = displayValue === true || displayValue === 'Oui' || displayValue === '1' ? 'checked' : '';
            inputHtml = `
                <div class="form-check">
                    <input
                        type="checkbox"
                        id="field_${name}"
                        name="${name}"
                        class="form-check-input"
                        ${checked}
                    >
                    <label for="field_${name}" class="form-check-label">${label}</label>
                </div>
            `;
            // Pour les checkbox, on ne veut pas le label standard
            return `<div class="form-group">${inputHtml}</div>`;

        default: // text
            inputHtml = `
                <input
                    type="text"
                    id="field_${name}"
                    name="${name}"
                    class="form-control"
                    value="${escapeHtml(String(displayValue))}"
                    placeholder="${placeholder || ''}"
                    ${requiredAttr}
                >
            `;
    }

    return `
        <div class="form-group">
            <label for="field_${name}" class="form-label ${requiredClass}">${escapeHtml(label)}</label>
            ${inputHtml}
        </div>
    `;
}

/**
 * Génère le HTML d'un select
 * @param {string} name - Nom du champ
 * @param {Array} options - Options statiques
 * @param {string} source - Source dynamique (nom de table dans CONFIG)
 * @param {string} sourceField - Champ de la source à utiliser
 * @param {*} value - Valeur sélectionnée
 * @param {string} requiredAttr - Attribut required
 * @returns {string} HTML du select
 */
function generateSelectHtml(name, options, source, sourceField, value, requiredAttr) {
    // Placeholder pour le chargement dynamique
    const dataAttrs = source ? `data-source="${source}" data-source-field="${sourceField || ''}"` : '';

    let optionsHtml = '<option value="">-- Sélectionner --</option>';

    if (options && Array.isArray(options)) {
        optionsHtml += options.map(opt => {
            const selected = opt === value ? 'selected' : '';
            return `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
        }).join('');
    }

    return `
        <select
            id="field_${name}"
            name="${name}"
            class="form-select"
            ${dataAttrs}
            ${requiredAttr}
        >
            ${optionsHtml}
        </select>
    `;
}

/**
 * Charge les options dynamiques pour les selects
 * @param {HTMLFormElement} form - Formulaire
 */
async function loadDynamicSelectOptions(form) {
    const selects = form.querySelectorAll('select[data-source]');

    for (const select of selects) {
        const source = select.dataset.source;
        const sourceField = select.dataset.sourceField;
        const currentValue = select.value;

        if (source && CONFIG.TABLES[source]) {
            const tableConfig = CONFIG.TABLES[source];
            const field = sourceField || tableConfig.columns[0]?.field;

            try {
                // Pour les acteurs, charger les donnees completes pour formater les noms
                if (source === 'ACTEURS') {
                    const result = await readTable(tableConfig.name);
                    const acteurs = result.data || [];

                    // Conserver la premiere option (placeholder)
                    const placeholder = select.options[0];
                    select.innerHTML = '';
                    select.appendChild(placeholder);

                    // Ajouter les options avec nom formate
                    acteurs.forEach(acteur => {
                        const val = acteur[field]; // Email
                        const displayName = formatActorShortName(acteur);
                        const option = document.createElement('option');
                        option.value = val;
                        option.textContent = displayName;
                        option.title = val; // Afficher l'email au survol
                        if (val === currentValue) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                } else if (source === 'PROCESSUS') {
                    // Pour les processus, charger les données et trier par Ordre, puis dédupliquer
                    const result = await readTable(tableConfig.name);
                    const processusData = result.data || [];

                    // Trier par Ordre
                    processusData.sort((a, b) => {
                        const ordreA = a['Ordre'] || 999;
                        const ordreB = b['Ordre'] || 999;
                        return ordreA - ordreB;
                    });

                    // Extraire les valeurs distinctes en préservant l'ordre
                    const seen = new Set();
                    const values = [];
                    for (const p of processusData) {
                        const val = p[field];
                        if (val && !seen.has(val)) {
                            seen.add(val);
                            values.push(val);
                        }
                    }

                    // Conserver la premiere option (placeholder)
                    const placeholder = select.options[0];
                    select.innerHTML = '';
                    select.appendChild(placeholder);

                    // Ajouter les options
                    values.forEach(val => {
                        const option = document.createElement('option');
                        option.value = val;
                        option.textContent = val;
                        if (val === currentValue) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                } else {
                    const values = await getUniqueValues(tableConfig.name, field);

                    // Conserver la premiere option (placeholder)
                    const placeholder = select.options[0];
                    select.innerHTML = '';
                    select.appendChild(placeholder);

                    // Ajouter les options
                    values.forEach(val => {
                        const option = document.createElement('option');
                        option.value = val;
                        option.textContent = val;
                        if (val === currentValue) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error(`Erreur chargement options pour ${source}:`, error);
            }
        }
    }
}

/**
 * Valide un formulaire
 * @param {HTMLFormElement} form - Formulaire à valider
 * @returns {boolean} True si valide
 */
function validateForm(form) {
    let isValid = true;

    // Reset des erreurs
    form.querySelectorAll('.form-control, .form-select').forEach(input => {
        input.classList.remove('is-invalid');
    });
    form.querySelectorAll('.invalid-feedback').forEach(el => el.remove());

    // Validation HTML5
    if (!form.checkValidity()) {
        isValid = false;
    }

    // Validation personnalisée
    form.querySelectorAll('[required]').forEach(input => {
        const value = input.value.trim();
        if (!value) {
            markFieldInvalid(input, 'Ce champ est obligatoire');
            isValid = false;
        }
    });

    // Validation email
    form.querySelectorAll('input[type="email"]').forEach(input => {
        if (input.value && !isValidEmail(input.value)) {
            markFieldInvalid(input, 'Adresse email invalide');
            isValid = false;
        }
    });

    // Validation nombres
    form.querySelectorAll('input[type="number"]').forEach(input => {
        if (input.value && isNaN(parseFloat(input.value))) {
            markFieldInvalid(input, 'Nombre invalide');
            isValid = false;
        }
    });

    return isValid;
}

/**
 * Marque un champ comme invalide
 * @param {HTMLElement} input - Élément input
 * @param {string} message - Message d'erreur
 */
function markFieldInvalid(input, message) {
    input.classList.add('is-invalid');

    const feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    feedback.textContent = message;

    input.parentNode.appendChild(feedback);
}

/**
 * Récupère les données d'un formulaire
 * @param {HTMLFormElement} form - Formulaire
 * @returns {Object} Données du formulaire
 */
function getFormData(form) {
    const data = {};
    const formData = new FormData(form);

    // Parcourir tous les champs
    for (const [name, value] of formData.entries()) {
        data[name] = value;
    }

    // Gérer les checkboxes - utiliser des booléens pour Excel
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        data[checkbox.name] = checkbox.checked;
    });

    console.log('[getFormData] Data collected:', data);
    return data;
}

/**
 * Remplit un formulaire avec des données
 * @param {HTMLFormElement} form - Formulaire
 * @param {Object} data - Données
 */
function setFormData(form, data) {
    console.log('[setFormData] Data received:', data);

    Object.entries(data).forEach(([name, value]) => {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) {
            console.log(`[setFormData] Field not found: "${name}" (value: "${value}")`);
            return;
        }
        console.log(`[setFormData] Setting field "${name}" to "${value}"`);

        if (input.type === 'checkbox') {
            input.checked = value === true || value === 'Oui' || value === '1';
        } else if (input.type === 'date') {
            input.value = formatDateForInput(value);
        } else if (input.tagName === 'SELECT') {
            // Pour les selects, verifier si l'option existe
            const valueToSet = value !== null && value !== undefined ? String(value) : '';

            // Chercher si l'option existe deja
            let optionExists = false;
            for (let i = 0; i < input.options.length; i++) {
                if (input.options[i].value === valueToSet) {
                    optionExists = true;
                    break;
                }
            }

            // Si la valeur n'existe pas et n'est pas vide, l'ajouter comme option
            if (!optionExists && valueToSet) {
                const newOption = document.createElement('option');
                newOption.value = valueToSet;
                newOption.textContent = valueToSet;
                input.appendChild(newOption);
            }

            input.value = valueToSet;
        } else {
            input.value = value !== null && value !== undefined ? value : '';
        }
    });
}

/**
 * Formate une date pour un input date
 * @param {*} value - Valeur de date
 * @returns {string} Date formatée YYYY-MM-DD
 */
function formatDateForInput(value) {
    if (!value) return '';

    // Si c'est déjà au bon format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    // Si c'est un nombre (Excel serial date)
    if (typeof value === 'number') {
        const date = excelDateToJS(value);
        return date.toISOString().split('T')[0];
    }

    // Essayer de parser comme date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }

    return '';
}

/**
 * Convertit une date Excel en date JavaScript
 * @param {number} excelDate - Date Excel (serial number)
 * @returns {Date} Date JavaScript
 */
function excelDateToJS(excelDate) {
    // Excel compte depuis le 1er janvier 1900
    // Mais il y a un bug avec l'année 1900 (faux bissextile)
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const excelEpoch = new Date(1899, 11, 30); // 30 décembre 1899
    return new Date(excelEpoch.getTime() + excelDate * millisecondsPerDay);
}

/**
 * Reset un formulaire
 * @param {HTMLFormElement} form - Formulaire
 */
function resetForm(form) {
    form.reset();

    // Supprimer les classes d'erreur
    form.querySelectorAll('.form-control, .form-select').forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
    });
    form.querySelectorAll('.invalid-feedback').forEach(el => el.remove());
}
