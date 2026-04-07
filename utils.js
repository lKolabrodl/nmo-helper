/**
 * Утилиты и обёртки над Chrome API.
 * Нормализация текста, работа с хранилищем и fetch через background.
 */

/**
 * Читает значение из chrome.storage.local.
 * @param {string} key — ключ
 * @param {*} defaultValue — значение по умолчанию, если ключ не найден
 * @returns {Promise<*>} сохранённое значение или defaultValue
 */
function storageGet(key, defaultValue) {
    return new Promise(resolve => {
        chrome.storage.local.get(key, result => {
            resolve(result[key] !== undefined ? result[key] : defaultValue);
        });
    });
}

/**
 * Записывает значение в chrome.storage.local.
 * @param {string} key — ключ
 * @param {*} value — значение для сохранения
 */
function storageSet(key, value) {
    chrome.storage.local.set({ [key]: value });
}

/**
 * Выполняет HTTP-запрос через background service worker (обход CORS).
 * @param {string} url — адрес запроса
 * @param {Object} [options] — параметры запроса
 * @param {string} [options.method='GET'] — HTTP-метод
 * @param {Object} [options.headers] — заголовки
 * @param {string} [options.body] — тело запроса
 * @returns {Promise<{error: boolean, status: number, text: string}>} ответ сервера
 */
function fetchViaBackground(url, options = {}) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({
            action: 'fetch',
            url,
            method: options.method || 'GET',
            headers: options.headers || null,
            body: options.body || null,
        }, resolve);
    });
}

/**
 * Нормализует различные виды тире в обычный дефис.
 * @param {string} s — исходная строка
 * @returns {string} строка с нормализованными тире
 */
function normalizeDashes(s) {
    return s
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/\u0410/gi, 'a').replace(/\u0415/gi, 'e')
        .replace(/\u041E/gi, 'o').replace(/\u0420/gi, 'p')
        .replace(/\u0421/gi, 'c').replace(/\u0425/gi, 'x')
        .trim()
        .toLowerCase();
}

/**
 * Исправляет смешанные кириллические/латинские символы в тексте.
 * Например, русская 'а' вместо латинской 'a' в английских словах и наоборот.
 * @param {string} text — исходный текст
 * @returns {string} исправленный текст
 */
function fixMixedChars(text) {
    return text
        .replace(/\b[a-zA-Z]*[\u0430\u0410]\w*\b/g, m => m.replace(/\u0430/g, 'a'))
        .replace(/\b[a-zA-Z]*[\u043E\u041E]\w*\b/g, m => m.replace(/\u043E/g, 'o'))
        .replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[aA]\w*/g, m => m.replace(/a/gi, '\u0430'))
        .replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[oO]\w*/g, m => m.replace(/o/gi, '\u043E'));
}

/**
 * Исправляет смешанные символы во всех текстовых нодах внутри контейнера.
 * Обрабатывает элементы h3, strong, span.
 * @param {HTMLElement} div — DOM-контейнер
 */
function fixAllTextNodes(div) {
    const fix = (sel) => {
        Array.from(div.querySelectorAll(sel)).forEach(el => {
            if (!(el.innerText || '').match(/[aAoO]/)) return;
            el.innerText = fixMixedChars(el.innerText);
        });
    };
    fix('h3'); fix('strong'); fix('span');
}

/**
 * Очищает HTML-строку от навигации, скриптов и лишних элементов.
 * @param {string} html — исходный HTML
 * @returns {string} очищенный HTML
 */
function cleanHtml(html) {
    return html.replace(/\s+/g, ' ')
        .replace(/.*?(<div class="row">)/, '$1')
        .replace(/<footer.*?>.*/, '')
        .replace(/<script[^>]*>.*?<\/script>/gs, '')
        .replace(/<a[^>]*>.*?<\/a>/gs, '')
        .replace(/<div class="menu"[^>]*>.*?<\/div>/gs, '')
        .replace(/<div class="search-form"[^>]*>.*?<\/div>/gs, '')
        .replace(/<div class="info-donat-bg"[^>]*>.*?<\/div>/gs, '')
        .replace(/<div class="sticky"[^>]*>.*?<\/div>/gs, '')
        .replace(/<nav[^>]*>.*?<\/nav>/gs, '')
        .replace(/<ul[^>]*>.*?<\/ul>/gs, '');
}

/**
 * Нормализует строку для сравнения: тире, пробелы, регистр.
 * @param {string} s — исходная строка
 * @returns {string} нормализованная строка
 */
function normalizeText(s) {
    return s
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g, '-')
        .replace(/\s+/g, ' ')
        // Замена кириллических символов-двойников на латинские (для сравнения)
        .replace(/\u0410/g, 'A').replace(/\u0430/g, 'a')  // А → A, а → a
        .replace(/\u0415/g, 'E').replace(/\u0435/g, 'e')  // Е → E, е → e
        .replace(/\u041E/g, 'O').replace(/\u043E/g, 'o')  // О → O, о → o
        .replace(/\u0420/g, 'P').replace(/\u0440/g, 'p')  // Р → P, р → p
        .replace(/\u0421/g, 'C').replace(/\u0441/g, 'c')  // С → C, с → c
        .replace(/\u0425/g, 'X').replace(/\u0445/g, 'x')  // Х → X, х → x
        .trim()
        .toLowerCase();
}
