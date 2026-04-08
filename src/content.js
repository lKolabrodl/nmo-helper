/**
 * Точка входа расширения NMO Helper.
 * Читает настройки, создаёт панель и инициализирует все модули.
 *
 * Зависимости (загружаются до этого файла через manifest.json):
 *   utils.js    — storageGet, storageSet, fetchViaBackground, normalizeDashes, fixMixedChars, fixAllTextNodes
 *   parsers.js  — parseFrom24forcare, parseFromRosmedicinfo, SOURCES, detectSource
 *   ai.js       — askAI, validateApiKey, initAiMode, AI_URL
 *   search.js   — initSearch
 *   sites.js    — initSitesMode
 *   auto.js    — initAutoMode
 *   panel.js    — createPanel, initPanelBehavior
 */
(async function () {
    'use strict';

    const state = {
        savedUrl: await storageGet('customUrl', ''),
        savedCollapsed: await storageGet('panelCollapsed', false),
        savedLeft: await storageGet('panelLeft', null),
        savedTop: await storageGet('panelTop', null),
        savedAiMode: await storageGet('aiMode', false),
        savedAutoMode: await storageGet('autoMode', true),
        savedApiKey: await storageGet('apiKey', ''),
        savedModel: await storageGet('aiModel', 'gpt-4o-mini'),
    };

    const panel = createPanel(state);
    initPanelBehavior(panel);
    initSearch();
    initSitesMode();
    initAiMode();
    initAutoMode();
})();
