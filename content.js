(function () {
    'use strict';

    // ========================
    // ОБЁРТКИ НАД CHROME API
    // ========================
    function storageGet(key, defaultValue) {
        return new Promise(resolve => {
            chrome.storage.local.get(key, result => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    }

    function storageSet(key, value) {
        chrome.storage.local.set({ [key]: value });
    }

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

    // ========================
    // ИНИЦИАЛИЗАЦИЯ
    // ========================
    async function init() {
        const savedUrl = await storageGet('customUrl', '');
        const savedCollapsed = await storageGet('panelCollapsed', false);
        const savedLeft = await storageGet('panelLeft', null);
        const savedTop = await storageGet('panelTop', null);

        // ========================
        // СОЗДАНИЕ ПАНЕЛИ
        // ========================
        const panel = document.createElement('div');
        panel.id = 'nmo-panel';
        if (savedCollapsed) panel.classList.add('collapsed');
        panel.innerHTML = `
            <div class="nmo-header">
                <span class="nmo-header-title">NMO Helper</span>
                <button class="nmo-toggle-btn" id="nmo-collapse" title="Свернуть">${savedCollapsed ? '+' : '\u2014'}</button>
            </div>
            <div class="nmo-body">
                <div class="nmo-field">
                    <label>Автопоиск <span class="nmo-beta-badge">BETA</span></label>
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
                    <button class="nmo-btn nmo-btn-run" id="nmo-run">▶ Запуск</button>
                    <button class="nmo-btn nmo-btn-stop" id="nmo-stop" style="display:none">■ Стоп</button>
                </div>
                <div class="nmo-status" id="nmo-status">готов к работе</div>
            </div>
        `;
        document.body.appendChild(panel);

        // Восстановление позиции
        if (savedLeft !== null && savedTop !== null) {
            panel.style.left = savedLeft + 'px';
            panel.style.top = savedTop + 'px';
            panel.style.right = 'auto';
        }

        // ========================
        // DRAG
        // ========================
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

        // Сохранение URL
        document.getElementById('nmo-url').addEventListener('change', e => storageSet('customUrl', e.target.value.trim()));

        // ========================
        // ЛОГИКА СКРИПТА
        // ========================
        const status = (msg, cls = '') => {
            const el = document.getElementById('nmo-status');
            el.textContent = msg;
            el.className = 'nmo-status ' + cls;
        };

        const searchStatus = (msg, cls = '') => {
            const el = document.getElementById('nmo-search-status');
            el.textContent = msg;
            el.className = 'nmo-status ' + cls;
        };

        const SOURCES = {
            '24forcare': {
                parseAnswers: parseFrom24forcare,
            },
            'rosmedicinfo': {
                parseAnswers: parseFromRosmedicinfo,
            },
        };

        const normalizeDashes = (s) => s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g, '-');

        const fixMixedChars = (text) => {
            return text
                .replace(/\b[a-zA-Z]*[\u0430\u0410]\w*\b/g, m => m.replace(/\u0430/g, 'a'))
                .replace(/\b[a-zA-Z]*[\u043E\u041E]\w*\b/g, m => m.replace(/\u043E/g, 'o'))
                .replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[aA]\w*/g, m => m.replace(/a/gi, '\u0430'))
                .replace(/[\u0430-\u044F\u0410-\u042F\u0451\u0401]+[oO]\w*/g, m => m.replace(/o/gi, '\u043E'));
        };

        const fixAllTextNodes = (div) => {
            const fix = (sel) => {
                Array.from(div.querySelectorAll(sel)).forEach(el => {
                    if (!(el.innerText || '').match(/[aAoO]/)) return;
                    el.innerText = fixMixedChars(el.innerText);
                });
            };
            fix('h3'); fix('strong'); fix('span');
        };

        function parseFrom24forcare(div) {
            return function getAnswers(questionText) {
                const nq = normalizeDashes(questionText);
                const h3 = Array.from(div.querySelectorAll('h3')).find(el => normalizeDashes(el.textContent).includes(nq));
                if (!h3) return null;
                const p = h3.nextElementSibling;
                if (!p || p.tagName !== 'P') return null;
                return Array.from(p.querySelectorAll('strong')).map(el =>
                    (el.innerText || '').replace(/[;+.]+$/, '').replace(/^\d+\)\s*/, '').trim()
                );
            };
        }

        function parseFromRosmedicinfo(div) {
            function tryLayout1(questionText) {
                const nq = normalizeDashes(questionText);
                const h3 = Array.from(div.querySelectorAll('h3')).find(el => normalizeDashes(el.textContent).includes(nq));
                if (!h3) return null;
                const p = h3.nextElementSibling;
                if (!p || p.tagName !== 'P') return null;
                const highlighted = Array.from(p.querySelectorAll('span')).filter(span => {
                    const bg = span.getAttribute('style') || '';
                    return bg.includes('fbeeb8') || bg.includes('background');
                });
                if (!highlighted.length) return null;
                return highlighted.map(el =>
                    (el.innerText || '').replace(/[;+.]+$/, '').replace(/^\d+\)\s*/, '').trim()
                );
            }

            function buildQaMapFromBoldPlus() {
                const qaMap = new Map();
                const allP = Array.from(div.querySelectorAll('p.MsoNormal'));
                for (let i = 0; i < allP.length; i++) {
                    const p = allP[i];
                    const firstBold = p.querySelector('b');
                    if (!firstBold) continue;
                    const bText = (firstBold.innerText || '').trim();
                    if (!/^\d+\./.test(bText)) continue;
                    const qText = bText.replace(/^\d+\.\s*/, '').trim();
                    const nextP = allP[i + 1];
                    if (!nextP) continue;
                    const lines = nextP.innerHTML.split(/<br\s*\/?>/i);
                    const correctAnswers = [];
                    lines.forEach(line => {
                        if (!line.includes('+')) return;
                        const tmp = document.createElement('span');
                        tmp.innerHTML = line;
                        const text = (tmp.innerText || tmp.textContent || '').trim();
                        const cleaned = text.replace(/\+$/, '').replace(/[;+.]+$/, '').replace(/^\d+\)\s*/, '').trim();
                        if (cleaned && cleaned.length > 1) correctAnswers.push(cleaned);
                    });
                    if (correctAnswers.length > 0) qaMap.set(qText, correctAnswers);
                }
                return qaMap;
            }

            const qaMap2 = buildQaMapFromBoldPlus();

            function tryLayout2(questionText) {
                const nq = normalizeDashes(questionText);
                for (const [q, answers] of qaMap2) {
                    const nqa = normalizeDashes(q);
                    if (nqa.includes(nq) || nq.includes(nqa)) return answers;
                }
                return null;
            }

            return function getAnswers(questionText) {
                return tryLayout1(questionText) || tryLayout2(questionText) || null;
            };
        }

        // ========================
        // АВТОПОИСК (BETA)
        // ========================
        const searchBtn = document.getElementById('nmo-search-btn');
        const searchResultsContainer = document.getElementById('nmo-search-results');

        searchBtn.addEventListener('click', async () => {
            const query = document.getElementById('nmo-search-query').value.trim();
            if (!query) {
                searchStatus('введите название теста', 'err');
                return;
            }

            searchStatus('ищу на обоих сайтах...', 'loading');
            searchBtn.disabled = true;
            searchResultsContainer.style.display = 'none';
            searchResultsContainer.innerHTML = '';

            const allResults = [];

            // --- Поиск на 24forcare.com (GET) ---
            try {
                const res = await fetchViaBackground('https://24forcare.com/search/?query=' + encodeURIComponent(query));
                if (res && !res.error && res.text) {
                    const div = document.createElement('div');
                    div.innerHTML = res.text;
                    const links = Array.from(div.querySelectorAll('a.item-name'));
                    links.forEach(a => {
                        const href = a.getAttribute('href') || '';
                        const title = (a.textContent || '').trim();
                        if (!href || !title) return;
                        const fullUrl = href.startsWith('http') ? href : 'https://24forcare.com/' + href.replace(/^\//, '');
                        allResults.push({ source: '24forcare', title, url: fullUrl });
                    });
                }
            } catch (e) {
                console.error('24forcare search error:', e);
            }

            // --- Поиск на rosmedicinfo.ru (POST) ---
            try {
                const res = await fetchViaBackground('https://rosmedicinfo.ru/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: 'do=search&subaction=search&story=' + encodeURIComponent(query),
                });
                if (res && !res.error && res.text) {
                    const div = document.createElement('div');
                    div.innerHTML = res.text;
                    const titles = Array.from(div.querySelectorAll('.short__title a'));
                    titles.forEach(a => {
                        const href = a.getAttribute('href') || '';
                        const title = (a.textContent || '').trim();
                        if (!href || !title) return;
                        allResults.push({ source: 'rosmedicinfo', title, url: href });
                    });
                }
            } catch (e) {
                console.error('rosmedicinfo search error:', e);
            }

            searchBtn.disabled = false;

            if (allResults.length === 0) {
                searchStatus('ничего не найдено :(', 'warn');
                return;
            }

            searchStatus(`найдено ${allResults.length} результат(ов)`, 'ok');
            searchResultsContainer.style.display = 'flex';

            allResults.forEach(r => {
                const item = document.createElement('div');
                item.className = 'nmo-result-item';
                item.innerHTML = `
                    <span class="nmo-result-src ${r.source === '24forcare' ? 'src-24' : 'src-ros'}">${r.source === '24forcare' ? '24fc' : 'rosmed'}</span>
                    <span class="nmo-result-title">${r.title}</span>
                `;
                item.addEventListener('click', () => {
                    document.getElementById('nmo-url').value = r.url;
                    storageSet('customUrl', r.url);
                    searchStatus(`выбрано \u2022 ${r.source}`, 'ok');
                    searchResultsContainer.style.display = 'none';
                });
                searchResultsContainer.appendChild(item);
            });
        });

        // Enter в поле поиска
        document.getElementById('nmo-search-query').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchBtn.click();
            }
        });

        // ========================
        // ЗАПУСК / СТОП
        // ========================
        let intervalId = null;

        const runBtn = document.getElementById('nmo-run');
        const stopBtn = document.getElementById('nmo-stop');

        function detectSource(url) {
            if (url.includes('24forcare.com')) return '24forcare';
            if (url.includes('rosmedicinfo.ru')) return 'rosmedicinfo';
            return null;
        }

        runBtn.addEventListener('click', async () => {
            const customUrl = document.getElementById('nmo-url').value.trim();
            const urlInput = document.getElementById('nmo-url');

            // Валидация URL
            if (!customUrl) {
                urlInput.classList.add('input-error');
                status('вставь URL с ответами', 'err');
                setTimeout(() => urlInput.classList.remove('input-error'), 600);
                urlInput.focus();
                return;
            }

            try {
                new URL(customUrl);
            } catch (e) {
                urlInput.classList.add('input-error');
                status('некорректный URL', 'err');
                setTimeout(() => urlInput.classList.remove('input-error'), 600);
                urlInput.focus();
                return;
            }

            const activeSource = detectSource(customUrl);
            const source = SOURCES[activeSource];

            if (!source) {
                urlInput.classList.add('input-error');
                status('URL не от rosmedicinfo.ru или 24forcare.com', 'err');
                setTimeout(() => urlInput.classList.remove('input-error'), 600);
                urlInput.focus();
                return;
            }

            storageSet('customUrl', customUrl);

            status('загружаю ответы...', 'loading');
            runBtn.disabled = true;

            try {
                const response = await fetchViaBackground(customUrl);

                if (response.error) {
                    status('ошибка сети \u2014 проверь URL', 'err');
                    runBtn.disabled = false;
                    return;
                }

                if (response.status < 200 || response.status >= 400) {
                    status(`ошибка ${response.status}: сервер отклонил запрос`, 'err');
                    runBtn.disabled = false;
                    return;
                }

                const dataString = response.text;

                if (!dataString || dataString.length < 100) {
                    status('пустой ответ от сервера', 'err');
                    runBtn.disabled = false;
                    return;
                }

                const cleaned = dataString.replace(/\s+/g, ' ')
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

                const div = document.createElement('div');
                div.innerHTML = cleaned;
                fixAllTextNodes(div);

                const getAnswersFn = source.parseAnswers(div);

                let lastQuestion = '';

                if (intervalId) clearInterval(intervalId);
                intervalId = setInterval(() => {
                    const questionAnchor = document.getElementById('questionAnchor');
                    if (!questionAnchor) return;
                    const titleEl = questionAnchor.querySelector('.question-title-text');
                    if (!titleEl) return;

                    const currentQ = titleEl.innerText;

                    if (currentQ !== lastQuestion) {
                        lastQuestion = currentQ;
                        status('ищу ответ...', 'loading');
                    }

                    const answers = getAnswersFn(currentQ);

                    if (!answers || answers.length === 0) {
                        status('ответ не найден :(', 'warn');
                        return;
                    }

                    const allVariant = Array.from(questionAnchor.querySelectorAll('.mdc-form-field span'));

                    const normalize = (s) => s
                        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g, '-')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .toLowerCase();

                    let found = false;

                    // точное совпадение (с нормализацией)
                    const exact = [];
                    allVariant.forEach(el => {
                        const v = normalize(el.innerText);
                        answers.forEach(ans => {
                            if (normalize(ans) === v) exact.push(el);
                        });
                    });

                    exact.forEach(el => { if (el.style.color !== '#4ecca3') el.style.color = '#4ecca3'; });
                    if (exact.length) found = true;

                    // нечёткое — по границе слова
                    if (!found) {
                        allVariant.forEach(el => {
                            const variant = normalize(el.innerText);
                            answers.forEach(ans => {
                                const a = normalize(ans);
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
                    }

                    if (found) {
                        status(`найдено \u2022 ${activeSource}`, 'ok');
                    } else {
                        status('ответ не совпал с вариантами', 'warn');
                    }

                }, 500);

                status(`работает \u2022 ${activeSource}`, 'ok');
                runBtn.style.display = 'none';
                stopBtn.style.display = 'block';
            } catch (err) {
                status(`ошибка парсинга: ${err.message}`, 'err');
                console.error(err);
            }
            runBtn.disabled = false;
        });

        stopBtn.addEventListener('click', () => {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
            status('остановлен', '');
            stopBtn.style.display = 'none';
            runBtn.style.display = 'block';
        });
    }

    init();
})();
