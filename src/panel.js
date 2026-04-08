/**
 * Создание UI-панели расширения, drag-перемещение,
 * сворачивание и переключение между режимами (сайты / AI).
 */

/** Список доступных AI-моделей с метаданными */
const AI_MODELS = [
    { id: 'gpt-4.1-nano',          name: 'gpt-4.1-nano',          tier: 'low' },
    { id: 'gpt-4o-mini',           name: 'gpt-4o-mini',           tier: 'low' },
    { id: 'gpt-5.4-nano',          name: 'gpt-5.4-nano',          tier: 'low' },
    { id: 'gemini-2.0-flash-lite', name: 'gemini-2.0-flash-lite', tier: 'low' },
    { id: 'gemini-2.0-flash',      name: 'gemini-2.0-flash',      tier: 'low' },
    { id: 'claude-haiku-4-5',      name: 'claude-haiku-4.5',      tier: 'low' },
    { id: 'gpt-4.1-mini',          name: 'gpt-4.1-mini',          tier: 'medium', tag: 'rec' },
    { id: 'gpt-4o',                name: 'gpt-4o',                tier: 'medium' },
    { id: 'gpt-5-mini',            name: 'gpt-5-mini',            tier: 'medium' },
    { id: 'gpt-5.4-mini',          name: 'gpt-5.4-mini',          tier: 'medium' },
    { id: 'gemini-2.5-flash',      name: 'gemini-2.5-flash',      tier: 'medium', tag: 'rec' },
    { id: 'gpt-4.1',               name: 'gpt-4.1',               tier: 'high' },
    { id: 'gpt-5',                 name: 'gpt-5',                 tier: 'high',  tag: 'pricey' },
    { id: 'gpt-5.4',               name: 'gpt-5.4',               tier: 'high',  tag: 'pricey' },
    { id: 'o3-mini',               name: 'o3-mini',               tier: 'high',  tag: 'rec' },
    { id: 'o4-mini',               name: 'o4-mini',               tier: 'high',  tag: 'rec' },
    { id: 'gemini-2.5-pro',        name: 'gemini-2.5-pro',        tier: 'high' },
    { id: 'claude-sonnet-4-6',     name: 'claude-sonnet-4.6',     tier: 'high' },
    { id: 'o3',                    name: 'o3',                    tier: 'ultra', tag: 'pricey' },
    { id: 'gemini-3.1-pro-preview',name: 'gemini-3.1-pro',        tier: 'ultra' },
    { id: 'claude-opus-4-6',       name: 'claude-opus-4.6',       tier: 'ultra', tag: 'rec' },
];

/**
 * Создаёт HTML-панель расширения и добавляет её на страницу.
 * @param {Object} state — сохранённое состояние из chrome.storage
 * @param {string} state.savedUrl — URL страницы с ответами
 * @param {boolean} state.savedCollapsed — панель свёрнута
 * @param {number|null} state.savedLeft — позиция X
 * @param {number|null} state.savedTop — позиция Y
 * @param {boolean} state.savedAiMode — AI-режим включён
 * @param {string} state.savedApiKey — API-ключ
 * @param {string} state.savedModel — выбранная модель
 * @returns {HTMLElement} созданная панель
 */
function createPanel(state) {
    const { savedUrl, savedCollapsed, savedLeft, savedTop, savedAiMode, savedAutoMode, savedApiKey, savedModel } = state;

    const panel = document.createElement('div');
    panel.id = 'nmo-panel';
    if (savedCollapsed) panel.classList.add('collapsed');
    panel.innerHTML = `
        <div class="nmo-header">
            <span class="nmo-header-title">NMO Helper</span>
            <span class="nmo-header-status" id="nmo-header-status"></span>
            <button class="nmo-toggle-btn" id="nmo-collapse" title="Свернуть">${savedCollapsed ? '+' : '\u2014'}</button>
        </div>
        <div class="nmo-body">
            <label class="nmo-ai-toggle">
                <input type="checkbox" id="nmo-ai-mode" ${savedAiMode ? 'checked' : ''} />
                <span>Решать с помощью AI</span>
            </label>
            <label class="nmo-ai-toggle">
                <input type="checkbox" id="nmo-auto-mode" ${savedAutoMode ? 'checked' : ''} />
                <span>Авто-поиск rosmed & 24forcare</span>
            </label>

            <div class="nmo-auto-section" ${savedAutoMode ? '' : 'style="display:none"'}>
                <div class="nmo-status" id="nmo-auto-status">выключено</div>
            </div>

            <div class="nmo-sites-section" ${savedAiMode || savedAutoMode ? 'style="display:none"' : ''}>
                <div class="nmo-field">
                    <label>Поиск</label>
                    <input type="text" id="nmo-search-query" placeholder="Название теста..." />
                </div>
                <button class="nmo-btn nmo-btn-search" id="nmo-search-btn">\uD83D\uDD0D Найти ответы</button>
                <div class="nmo-status" id="nmo-search-status"></div>
                <div class="nmo-search-results" id="nmo-search-results" style="display:none"></div>

                <hr class="nmo-separator">

                <div class="nmo-field">
                    <label>URL страницы с ответами</label>
                    <input type="text" id="nmo-url" placeholder="https://..." value="${savedUrl}" />
                </div>
                <div class="nmo-btn-row">
                    <button class="nmo-btn nmo-btn-run" id="nmo-run">\u25B6 Запуск</button>
                    <button class="nmo-btn nmo-btn-stop" id="nmo-stop" style="display:none">\u25A0 Стоп</button>
                </div>
                <div class="nmo-status" id="nmo-status">готов к работе</div>
            </div>

            <div class="nmo-ai-section" ${savedAiMode ? '' : 'style="display:none"'}>
                <div class="nmo-field">
                    <label>API-ключ ProxyAPI</label>
                    <input type="password" id="nmo-api-key" placeholder="вставьте ключ..." value="${savedApiKey}" />
                    <a class="nmo-key-hint" id="nmo-key-hint" href="https://console.proxyapi.ru/keys" target="_blank" ${savedApiKey ? 'style="display:none"' : ''}>Получить ключ API</a>
                </div>
                <div class="nmo-field">
                    <label>Модель</label>
                    <input type="hidden" id="nmo-ai-model" value="${savedModel}" />
                    <div class="nmo-dropdown" id="nmo-model-dropdown">
                        <div class="nmo-dropdown-selected" id="nmo-model-selected"></div>
                        <div class="nmo-dropdown-list" id="nmo-model-list">
                            ${AI_MODELS.map(m => `<div class="nmo-dropdown-item" data-value="${m.id}" data-tier="${m.tier}" ${m.tag ? 'data-tag="' + m.tag + '"' : ''}><span class="nmo-di-name">${m.name}</span>${m.tag === 'rec' ? '<span class="nmo-di-tag nmo-di-tag-rec">\u2605</span>' : m.tag === 'pricey' ? '<span class="nmo-di-tag nmo-di-tag-pricey">$$$</span>' : ''}<span class="nmo-di-tier nmo-di-tier-${m.tier}">${m.tier}</span></div>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="nmo-btn-row">
                    <button class="nmo-btn nmo-btn-ai" id="nmo-ai-run">\u25B6 Запуск AI</button>
                    <button class="nmo-btn nmo-btn-stop" id="nmo-ai-stop" style="display:none">\u25A0 Стоп</button>
                </div>
                <div class="nmo-status" id="nmo-ai-status">готов к работе</div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // Восстановление позиции
    if (savedLeft !== null && savedTop !== null) {
        panel.style.left = savedLeft + 'px';
        panel.style.top = savedTop + 'px';
        panel.style.right = 'auto';
    }

    return panel;
}

/**
 * Инициализирует поведение панели: drag-перемещение, сворачивание,
 * переключение AI/сайты, сохранение настроек.
 * @param {HTMLElement} panel — DOM-элемент панели
 */
function initPanelBehavior(panel) {
    // Drag
    const header = panel.querySelector('.nmo-header');
    let isDragging = false, dx = 0, dy = 0;

    header.addEventListener('mousedown', e => {
        e.preventDefault();
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        dx = e.clientX - rect.left;
        dy = e.clientY - rect.top;
        panel.style.willChange = 'left, top';
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        e.preventDefault();
        requestAnimationFrame(() => {
            panel.style.left = (e.clientX - dx) + 'px';
            panel.style.top = (e.clientY - dy) + 'px';
            panel.style.right = 'auto';
        });
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.style.willChange = '';
            const rect = panel.getBoundingClientRect();
            storageSet('panelLeft', rect.left);
            storageSet('panelTop', rect.top);
        }
    });

    // Сворачивание
    document.getElementById('nmo-collapse').addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        const isCollapsed = panel.classList.contains('collapsed');
        document.getElementById('nmo-collapse').textContent = isCollapsed ? '+' : '\u2014';
        storageSet('panelCollapsed', isCollapsed);
    });

    // Переключение режимов (взаимное исключение)
    const sitesSection = panel.querySelector('.nmo-sites-section');
    const aiSection = panel.querySelector('.nmo-ai-section');
    const autoSection = panel.querySelector('.nmo-auto-section');
    const aiCheckbox = document.getElementById('nmo-ai-mode');
    const autoCheckbox = document.getElementById('nmo-auto-mode');

    /** Обновляет видимость секций по состоянию галочек */
    function updateSections() {
        const ai = aiCheckbox.checked;
        const auto = autoCheckbox.checked;
        sitesSection.style.display = (ai || auto) ? 'none' : '';
        aiSection.style.display = ai ? '' : 'none';
        autoSection.style.display = auto ? '' : 'none';
    }

    aiCheckbox.addEventListener('change', () => {
        if (aiCheckbox.checked) {
            autoCheckbox.checked = false;
            storageSet('autoMode', false);
            autoCheckbox.dispatchEvent(new Event('change'));
        }
        storageSet('aiMode', aiCheckbox.checked);
        updateSections();
    });

    autoCheckbox.addEventListener('change', () => {
        if (autoCheckbox.checked) {
            aiCheckbox.checked = false;
            storageSet('aiMode', false);
        }
        storageSet('autoMode', autoCheckbox.checked);
        updateSections();
    });

    // Кастомный dropdown модели
    const modelInput = document.getElementById('nmo-ai-model');
    const modelSelected = document.getElementById('nmo-model-selected');
    const modelList = document.getElementById('nmo-model-list');
    const modelDropdown = document.getElementById('nmo-model-dropdown');

    /** Обновляет отображение выбранной модели */
    function updateModelDisplay(value) {
        const m = AI_MODELS.find(m => m.id === value);
        if (m) {
            const tagHtml = m.tag === 'rec' ? '<span class="nmo-tag nmo-tag-rec">\u2605</span>' : m.tag === 'pricey' ? '<span class="nmo-tag nmo-tag-pricey">$$$</span>' : '';
            modelSelected.innerHTML = `<span class="nmo-model-name">${m.name}</span>${tagHtml}<span class="nmo-tier nmo-tier-${m.tier}">${m.tier}</span>`;
        }
    }
    updateModelDisplay(modelInput.value);

    modelSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = modelDropdown.classList.contains('open');
        modelDropdown.classList.toggle('open');
        if (!wasOpen) {
            const rect = modelSelected.getBoundingClientRect();
            modelList.style.left = rect.left + 'px';
            modelList.style.top = rect.bottom + 'px';
            modelList.style.width = rect.width + 'px';
        }
    });

    modelList.addEventListener('click', (e) => {
        const item = e.target.closest('.nmo-dropdown-item');
        if (!item) return;
        modelInput.value = item.dataset.value;
        storageSet('aiModel', item.dataset.value);
        updateModelDisplay(item.dataset.value);
        modelDropdown.classList.remove('open');
    });

    document.addEventListener('click', () => {
        modelDropdown.classList.remove('open');
    });

    // Сохранение API-ключа
    document.getElementById('nmo-api-key').addEventListener('input', e => {
        const val = e.target.value.trim();
        storageSet('apiKey', val);
        document.getElementById('nmo-key-hint').style.display = val ? 'none' : '';
    });

    // Сохранение URL
    document.getElementById('nmo-url').addEventListener('change', e => storageSet('customUrl', e.target.value.trim()));

    // Синхронизация статуса в хедере (для свёрнутого режима)
    const headerStatus = document.getElementById('nmo-header-status');
    const statusIds = ['nmo-ai-status', 'nmo-auto-status', 'nmo-status'];
    setInterval(() => {
        let activeId = 'nmo-status';
        if (aiCheckbox.checked) activeId = 'nmo-ai-status';
        else if (autoCheckbox.checked) activeId = 'nmo-auto-status';
        const el = document.getElementById(activeId);
        if (el) {
            headerStatus.textContent = el.textContent;
            headerStatus.className = 'nmo-header-status ' + (el.className.replace('nmo-status', '').trim());
        }
    }, 500);
}
