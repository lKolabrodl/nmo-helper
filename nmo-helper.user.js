// ==UserScript==
// @name         NMO Helper
// @namespace    https://github.com/lKolabrodl/nmo-helper
// @version      1.4.1
// @description  Автоподсветка правильных ответов на тестах НМО
// @author       lKolabrodl
// @homepageURL  https://github.com/lKolabrodl/nmo-helper
// @updateURL    https://raw.githubusercontent.com/lKolabrodl/nmo-helper/main/nmo-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/lKolabrodl/nmo-helper/main/nmo-helper.user.js
// @match        https://edu.rosminzdrav.ru/*
// @match        https://*.edu.rosminzdrav.ru/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @connect      24forcare.com
// @connect      rosmedicinfo.ru
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ========================
    // СТИЛИ ПАНЕЛИ
    // ========================
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

        #nmo-panel {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 99999;
            width: 320px;
            background: #1a1a2e;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: #e0e0e0;
            overflow: hidden;
        }

        #nmo-panel.collapsed {
            width: auto;
        }

        #nmo-panel.collapsed .nmo-body {
            max-height: 0;
            padding: 0;
            overflow: hidden;
        }

        .nmo-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: linear-gradient(135deg, #16213e, #0f3460);
            cursor: move;
            user-select: none;
        }

        .nmo-header-title {
            font-weight: 600;
            font-size: 14px;
            color: #e94560;
            letter-spacing: 1px;
        }

        .nmo-toggle-btn {
            background: none;
            border: none;
            color: #aaa;
            cursor: pointer;
            font-size: 18px;
            padding: 0;
            line-height: 1;
        }

        .nmo-body {
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .nmo-field label {
            display: block;
            margin-bottom: 4px;
            color: #888;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .nmo-field select,
        .nmo-field input {
            width: 100%;
            box-sizing: border-box;
            padding: 8px 10px;
            background: #0f0f23;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            color: #e0e0e0;
            font-family: inherit;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
        }

        .nmo-field select:focus,
        .nmo-field input:focus {
            border-color: #e94560;
        }

        .nmo-btn {
            padding: 10px;
            border: none;
            border-radius: 8px;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .nmo-btn-run {
            background: linear-gradient(135deg, #e94560, #c23152);
            color: #fff;
        }

        .nmo-btn-run:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(233,69,96,0.4);
        }

        .nmo-btn-run:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .nmo-btn-stop {
            background: #333;
            color: #e94560;
        }

        .nmo-btn-stop:hover {
            background: #444;
        }

        .nmo-status {
            text-align: center;
            font-size: 12px;
            color: #666;
            min-height: 18px;
        }

        .nmo-status.ok { color: #4ecca3; }
        .nmo-status.err { color: #e94560; }
        .nmo-status.warn { color: #f0a040; }
        .nmo-status.loading { color: #f0c040; }

        .nmo-field input.input-error {
            border-color: #e94560;
            animation: nmo-shake 0.4s ease;
        }

        @keyframes nmo-shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            75% { transform: translateX(4px); }
        }

        .nmo-btn-row {
            display: flex;
            gap: 8px;
        }

        .nmo-btn-row .nmo-btn {
            flex: 1;
        }

        /* --- Секция автопоиска --- */
        .nmo-separator {
            border: none;
            border-top: 1px solid rgba(255,255,255,0.08);
            margin: 4px 0;
        }

        .nmo-beta-badge {
            display: inline-block;
            background: #f0a040;
            color: #1a1a2e;
            font-size: 9px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 4px;
            margin-left: 6px;
            vertical-align: middle;
            letter-spacing: 0.5px;
        }

        .nmo-btn-search {
            background: linear-gradient(135deg, #4ecca3, #36b08a);
            color: #fff;
        }

        .nmo-btn-search:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(78,204,163,0.4);
        }

        .nmo-btn-search:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .nmo-search-results {
            max-height: 150px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .nmo-search-results::-webkit-scrollbar {
            width: 4px;
        }

        .nmo-search-results::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
        }

        .nmo-result-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            line-height: 1.3;
            transition: all 0.15s;
        }

        .nmo-result-item:hover {
            background: rgba(78,204,163,0.1);
            border-color: rgba(78,204,163,0.3);
        }

        .nmo-result-src {
            flex-shrink: 0;
            font-size: 9px;
            font-weight: 700;
            padding: 2px 5px;
            border-radius: 3px;
            text-transform: uppercase;
        }

        .nmo-result-src.src-24 {
            background: #2d6a9f;
            color: #fff;
        }

        .nmo-result-src.src-ros {
            background: #9f2d6a;
            color: #fff;
        }

        .nmo-result-title {
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
    `);

    // ========================
    // СОЗДАНИЕ ПАНЕЛИ
    // ========================
    const savedUrl = GM_getValue('customUrl', '');
    const savedCollapsed = GM_getValue('panelCollapsed', false);
    const savedLeft = GM_getValue('panelLeft', null);
    const savedTop = GM_getValue('panelTop', null);

    const panel = document.createElement('div');
    panel.id = 'nmo-panel';
    if (savedCollapsed) panel.classList.add('collapsed');
    panel.innerHTML = `
        <div class="nmo-header">
            <span class="nmo-header-title">NMO Helper</span>
            <button class="nmo-toggle-btn" id="nmo-collapse" title="Свернуть">${savedCollapsed ? '+' : '—'}</button>
        </div>
        <div class="nmo-body">
            <div class="nmo-field">
                <label>Автопоиск <span class="nmo-beta-badge">BETA</span></label>
                <input type="text" id="nmo-search-query" placeholder="Название теста..." />
            </div>
            <button class="nmo-btn nmo-btn-search" id="nmo-search-btn">🔍 Найти ответы</button>
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
            GM_setValue('panelLeft', rect.left);
            GM_setValue('panelTop', rect.top);
        }
    });

    // Сворачивание
    document.getElementById('nmo-collapse').addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        const isCollapsed = panel.classList.contains('collapsed');
        document.getElementById('nmo-collapse').textContent = isCollapsed ? '+' : '—';
        GM_setValue('panelCollapsed', isCollapsed);
    });

    // Сохранение настроек
    document.getElementById('nmo-url').addEventListener('change', e => GM_setValue('customUrl', e.target.value.trim()));

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
            defaultUrl: 'https://24forcare.com/testyi-nmo/',
            parseAnswers: parseFrom24forcare,
        },
        'rosmedicinfo': {
            defaultUrl: 'https://rosmedicinfo.ru/',
            parseAnswers: parseFromRosmedicinfo,
        },
    };

    const normalizeDashes = (s) => s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g, '-');

    const fixMixedChars = (text) => {
        return text
            .replace(/\b[a-zA-Z]*[аА]\w*\b/g, m => m.replace(/а/g, 'a'))
            .replace(/\b[a-zA-Z]*[оО]\w*\b/g, m => m.replace(/о/g, 'o'))
            .replace(/[а-яА-ЯёЁ]+[aA]\w*/g, m => m.replace(/a/gi, 'а'))
            .replace(/[а-яА-ЯёЁ]+[oO]\w*/g, m => m.replace(/o/gi, 'о'));
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

    function searchMyAnswer(getAnswersFn) {
        const questionAnchor = document.getElementById('questionAnchor');
        if (!questionAnchor) return;
        const titleEl = questionAnchor.querySelector('.question-title-text');
        if (!titleEl) return;

        const questionText = titleEl.innerText;
        const answers = getAnswersFn(questionText);

        if (!answers || answers.length === 0) return;

        const allVariant = Array.from(questionAnchor.querySelectorAll('.mdc-form-field span'));

        const exact = [];
        allVariant.forEach(el => {
            answers.forEach(ans => {
                if (ans === el.innerText) exact.push(el);
            });
        });

        exact.forEach(el => { if (el.style.color !== 'red') el.style.color = 'red'; });
        if (exact.length) return;

        allVariant.forEach(el => {
            const variant = el.innerText;
            answers.forEach(ans => {
                if (ans.includes(variant) || variant.includes(ans)) {
                    if (el.style.color !== 'red') el.style.color = 'red';
                }
            });
        });
    }

    // ========================
    // АВТОПОИСК (BETA)
    // ========================
    const searchBtn = document.getElementById('nmo-search-btn');
    const searchResultsContainer = document.getElementById('nmo-search-results');

    searchBtn.addEventListener('click', () => {
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
        let completed = 0;
        const totalRequests = 2;

        function checkDone() {
            completed++;
            if (completed < totalRequests) return;

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
                    GM_setValue('customUrl', r.url);

                    searchStatus(`выбрано • ${r.source}`, 'ok');
                    searchResultsContainer.style.display = 'none';
                });
                searchResultsContainer.appendChild(item);
            });
        }

        // --- Поиск на 24forcare.com (GET) ---
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://24forcare.com/search/?query=' + encodeURIComponent(query),
            timeout: 15000,
            onload: function (response) {
                try {
                    const div = document.createElement('div');
                    div.innerHTML = response.responseText;

                    const links = Array.from(div.querySelectorAll('a.item-name'));
                    links.forEach(a => {
                        const href = a.getAttribute('href') || '';
                        const title = (a.textContent || '').trim();
                        if (!href || !title) return;

                        const fullUrl = href.startsWith('http') ? href : 'https://24forcare.com/' + href.replace(/^\//, '');
                        allResults.push({ source: '24forcare', title, url: fullUrl });
                    });
                } catch (e) {
                    console.error('24forcare search parse error:', e);
                }
                checkDone();
            },
            onerror: () => checkDone(),
            ontimeout: () => checkDone(),
        });

        // --- Поиск на rosmedicinfo.ru (POST) ---
        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://rosmedicinfo.ru/',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://rosmedicinfo.ru',
                'Referer': 'https://rosmedicinfo.ru/',
            },
            data: 'do=search&subaction=search&story=' + encodeURIComponent(query),
            timeout: 15000,
            onload: function (response) {
                try {
                    const div = document.createElement('div');
                    div.innerHTML = response.responseText;

                    const titles = Array.from(div.querySelectorAll('.short__title a'));
                    titles.forEach(a => {
                        const href = a.getAttribute('href') || '';
                        const title = (a.textContent || '').trim();
                        if (!href || !title) return;

                        allResults.push({ source: 'rosmedicinfo', title, url: href });
                    });
                } catch (e) {
                    console.error('rosmedicinfo search parse error:', e);
                }
                checkDone();
            },
            onerror: () => checkDone(),
            ontimeout: () => checkDone(),
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

    runBtn.addEventListener('click', () => {
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

        const url = customUrl;

        GM_setValue('customUrl', customUrl);

        status('загружаю ответы...', 'loading');
        runBtn.disabled = true;

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 15000,
            onload: function (response) {
                if (response.status < 200 || response.status >= 400) {
                    status(`ошибка ${response.status}: сервер отклонил запрос`, 'err');
                    runBtn.disabled = false;
                    return;
                }

                try {
                    const dataString = response.responseText;

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

                        // Вопрос сменился — сбрасываем статус
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
                            .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g, '-') // все тире → дефис
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

                        exact.forEach(el => { if (el.style.color !== 'red') el.style.color = 'red'; });
                        if (exact.length) found = true;

                        // нечёткое — но только по границе слова
                        if (!found) {
                            allVariant.forEach(el => {
                                const variant = normalize(el.innerText);
                                answers.forEach(ans => {
                                    const a = normalize(ans);
                                    // проверяем вхождение, но убеждаемся что оно на границе слова
                                    const longer = a.length >= variant.length ? a : variant;
                                    const shorter = a.length >= variant.length ? variant : a;
                                    const idx = longer.indexOf(shorter);
                                    if (idx === -1) return;

                                    // символ перед вхождением не должен быть цифрой или буквой
                                    const charBefore = idx > 0 ? longer[idx - 1] : ' ';
                                    const charAfter = idx + shorter.length < longer.length ? longer[idx + shorter.length] : ' ';
                                    const isBoundary = /[\s,;.\-—():]/.test(charBefore) || idx === 0;
                                    const isEndBoundary = /[\s,;.\-—():]/.test(charAfter) || (idx + shorter.length === longer.length);

                                    if (isBoundary && isEndBoundary) {
                                        if (el.style.color !== 'red') el.style.color = 'red';
                                        found = true;
                                    }
                                });
                            });
                        }

                        if (found) {
                            status(`найдено • ${activeSource}`, 'ok');
                        } else {
                            status('ответ не совпал с вариантами', 'warn');
                        }

                    }, 500);

                    status(`работает • ${activeSource}`, 'ok');
                    runBtn.style.display = 'none';
                    stopBtn.style.display = 'block';
                } catch (err) {
                    status(`ошибка парсинга: ${err.message}`, 'err');
                    console.error(err);
                }
                runBtn.disabled = false;
            },
            onerror: function (err) {
                status('ошибка сети — проверь URL', 'err');
                console.error(err);
                runBtn.disabled = false;
            },
            ontimeout: function () {
                status('таймаут — сервер не отвечает', 'err');
                runBtn.disabled = false;
            },
        });
    });

    stopBtn.addEventListener('click', () => {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        status('остановлен', '');
        stopBtn.style.display = 'none';
        runBtn.style.display = 'block';
    });

})();