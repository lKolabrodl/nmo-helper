/**
 * Авто-режим: автоматический поиск ответов на сайтах rosmedicinfo и 24forcare.
 * Определяет тему теста со страницы НМО, ищет ответы на обоих сайтах,
 * загружает и парсит HTML, подсвечивает правильные варианты.
 * Приоритет: rosmedicinfo → 24forcare.
 */

/**
 * Загружает страницу по URL, очищает HTML и создаёт парсер ответов.
 * @param {string} url — URL страницы с ответами
 * @param {string} sourceKey — ключ источника ('24forcare'|'rosmedicinfo')
 * @returns {Promise<function|null>} функция поиска ответов или null при ошибке
 */
async function loadParser(url, sourceKey) {
    try {
        const res = await fetchViaBackground(url);
        if (res.error || res.status < 200 || res.status >= 400) return null;
        if (!res.text || res.text.length < 100) return null;

        const div = document.createElement('div');
        div.innerHTML = cleanHtml(res.text);
        fixAllTextNodes(div);

        return SOURCES[sourceKey].parseAnswers(div);
    } catch (e) {
        console.error(`auto: ошибка загрузки ${sourceKey}:`, e);
        return null;
    }
}

/**
 * Ищет страницы с ответами на обоих сайтах по названию теста.
 * @param {string} query — название теста
 * @returns {Promise<{rosmed: string|null, forcare: string|null}>} найденные URL
 */
async function searchBothSites(query) {
    const result = { rosmed: null, forcare: null };

    // Параллельный поиск на обоих сайтах
    const [rosRes, fcRes] = await Promise.all([
        fetchViaBackground('https://rosmedicinfo.ru/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'do=search&subaction=search&story=' + encodeURIComponent(query),
        }).catch(() => null),
        fetchViaBackground('https://24forcare.com/search/?query=' + encodeURIComponent(query))
            .catch(() => null),
    ]);

    if (rosRes && !rosRes.error && rosRes.text) {
        const div = document.createElement('div');
        div.innerHTML = rosRes.text;
        const a = div.querySelector('.short__title a');
        if (a) result.rosmed = a.getAttribute('href') || null;
    }

    if (fcRes && !fcRes.error && fcRes.text) {
        const div = document.createElement('div');
        div.innerHTML = fcRes.text;
        const a = div.querySelector('a.item-name');
        if (a) {
            const href = a.getAttribute('href') || '';
            result.forcare = href.startsWith('http') ? href : 'https://24forcare.com/' + href.replace(/^\//, '');
        }
    }

    return result;
}

/**
 * Подсвечивает правильные ответы на странице, используя массив текстов.
 * @param {HTMLElement[]} allVariant — элементы вариантов ответа
 * @param {string[]} answers — массив текстов правильных ответов
 * @returns {boolean} true если хотя бы один вариант подсвечен
 */
function highlightAnswers(allVariant, answers) {
    let found = false;

    // Точное совпадение
    const exact = [];
    allVariant.forEach(el => {
        const v = normalizeText(el.innerText);
        answers.forEach(ans => {
            if (normalizeText(ans) === v) exact.push(el);
        });
    });
    exact.forEach(el => { if (el.style.color !== '#4ecca3') el.style.color = '#4ecca3'; });
    if (exact.length) return true;

    // Нечёткое — по границе слова
    allVariant.forEach(el => {
        const variant = normalizeText(el.innerText);
        answers.forEach(ans => {
            const a = normalizeText(ans);
            const longer = a.length >= variant.length ? a : variant;
            const shorter = a.length >= variant.length ? variant : a;
            const idx = longer.indexOf(shorter);
            if (idx === -1) return;

            const charBefore = idx > 0 ? longer[idx - 1] : ' ';
            const charAfter = idx + shorter.length < longer.length ? longer[idx + shorter.length] : ' ';
            const isBoundary = /[\s,;.\-\u2014():]/.test(charBefore) || idx === 0;
            const isEndBoundary = /[\s,;.\-\u2014():]/.test(charAfter) || (idx + shorter.length === longer.length);

            if (isBoundary && isEndBoundary) {
                if (el.style.color !== '#4ecca3') el.style.color = '#4ecca3';
                found = true;
            }
        });
    });

    return found;
}

/**
 * Инициализирует авто-режим: мониторит страницу, находит тему,
 * загружает ответы с обоих сайтов, подсвечивает варианты.
 */
function initAutoMode() {
    /** Обновляет статус авто-режима */
    const autoStatus = (msg, cls = '') => {
        const el = document.getElementById('nmo-auto-status');
        el.textContent = msg;
        el.className = 'nmo-status ' + cls;
    };

    let autoIntervalId = null;
    let autoCache = new Map();
    let rosmedParser = null;
    let forcareParser = null;
    let autoLoaded = false;
    let autoLoading = false;
    let autoLastTopic = '';

    /** Останавливает авто-режим */
    function stopAuto() {
        if (autoIntervalId) clearInterval(autoIntervalId);
        autoIntervalId = null;
        autoCache = new Map();
        rosmedParser = null;
        forcareParser = null;
        autoLoaded = false;
        autoLoading = false;
        autoLastTopic = '';
    }

    /** Запускает авто-режим */
    function startAuto() {
        stopAuto();
        autoStatus('ищу тему...', 'loading');

        autoIntervalId = setInterval(async () => {
            // Ищем тему теста на странице
            const topicEl = document.querySelector('.mat-card-title-quiz-custom, .mat-mdc-card-title');
            const topic = topicEl ? topicEl.innerText.trim() : '';

            if (!topic) {
                autoStatus('тема не найдена', 'warn');
                return;
            }

            // Тема сменилась — перезагрузить
            if (topic !== autoLastTopic) {
                autoLastTopic = topic;
                autoLoaded = false;
                autoLoading = false;
                rosmedParser = null;
                forcareParser = null;
                autoCache = new Map();
            }

            // Загрузка ответов (один раз)
            if (!autoLoaded && !autoLoading) {
                autoLoading = true;
                autoStatus('ищу ответы...', 'loading');

                // Убираем суффиксы вроде "- 2025 - Контрольное тестирование"
                const searchQuery = topic
                    .replace(/\s*-\s*\d{4}.*$/, '')
                    .replace(/\s*-\s*Контрольное.*$/i, '')
                    .trim();

                const urls = await searchBothSites(searchQuery);

                if (!urls.rosmed && !urls.forcare) {
                    autoStatus('ответы не найдены на сайтах', 'warn');
                    autoLoading = false;
                    autoLoaded = true;
                    return;
                }

                // Загружаем оба параллельно
                const [rp, fp] = await Promise.all([
                    urls.rosmed ? loadParser(urls.rosmed, 'rosmedicinfo') : null,
                    urls.forcare ? loadParser(urls.forcare, '24forcare') : null,
                ]);

                rosmedParser = rp;
                forcareParser = fp;
                autoLoaded = true;
                autoLoading = false;

                if (!rosmedParser && !forcareParser) {
                    autoStatus('не удалось загрузить ответы', 'err');
                    return;
                }

                const src = [];
                if (rosmedParser) src.push('rosmed');
                if (forcareParser) src.push('24fc');
                autoStatus(`загружено: ${src.join(' + ')}`, 'ok');
            }

            if (autoLoading || (!rosmedParser && !forcareParser)) return;

            // Мониторинг вопросов
            const questionAnchor = document.getElementById('questionAnchor');
            if (!questionAnchor) return;
            const titleEl = questionAnchor.querySelector('.question-title-text');
            if (!titleEl) return;

            const currentQ = titleEl.innerText;

            const allVariant = Array.from(questionAnchor.querySelectorAll('.mdc-form-field span'));

            // Кеш
            if (autoCache.has(currentQ)) {
                const cached = autoCache.get(currentQ);
                highlightAnswers(allVariant, cached.answers);
                autoStatus(`${cached.source} (кеш)`, 'ok');
                return;
            }

            // Приоритет: rosmed → 24forcare
            let answers = null;
            let source = '';

            if (rosmedParser) {
                answers = rosmedParser(currentQ);
                if (answers && answers.length) source = 'rosmed';
            }

            if ((!answers || !answers.length) && forcareParser) {
                answers = forcareParser(currentQ);
                if (answers && answers.length) source = '24forcare';
            }

            if (!answers || !answers.length) {
                autoStatus('ответ не найден', 'warn');
                return;
            }

            autoCache.set(currentQ, { answers, source });

            const found = highlightAnswers(allVariant, answers);
            if (found) {
                autoStatus(`найдено \u2022 ${source}`, 'ok');
            } else {
                autoStatus('ответ не совпал с вариантами', 'warn');
            }
        }, 500);
    }

    // Слушаем галочку
    document.getElementById('nmo-auto-mode').addEventListener('change', e => {
        const on = e.target.checked;
        storageSet('autoMode', on);
        if (on) {
            startAuto();
        } else {
            stopAuto();
            autoStatus('выключено', '');
        }
    });

    // Если галочка была сохранена — запустить сразу
    if (document.getElementById('nmo-auto-mode').checked) {
        startAuto();
    }
}
