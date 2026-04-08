/**
 * Парсеры ответов с сайтов 24forcare.com и rosmedicinfo.ru.
 * Каждый парсер принимает DOM-контейнер с HTML страницы
 * и возвращает функцию поиска ответов по тексту вопроса.
 */

/**
 * Парсер ответов с 24forcare.com.
 * Ищет вопрос по тексту h3, правильные ответы — в теге strong внутри следующего p.
 * @param {HTMLElement} div — DOM-контейнер с HTML страницы
 * @returns {function(string): string[]|null} функция поиска ответов по тексту вопроса
 */
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

/**
 * Парсер ответов с rosmedicinfo.ru.
 * Поддерживает два формата вёрстки:
 * 1. Вопрос в h3, ответы — span с жёлтым фоном (#fbeeb8)
 * 2. Вопрос в b с нумерацией, ответы — строки с '+' в следующем p.MsoNormal
 * @param {HTMLElement} div — DOM-контейнер с HTML страницы
 * @returns {function(string): string[]|null} функция поиска ответов по тексту вопроса
 */
function parseFromRosmedicinfo(div) {
    /**
     * Формат 1: вопрос в h3, ответы выделены жёлтым фоном.
     * @param {string} questionText — текст вопроса
     * @returns {string[]|null} массив правильных ответов или null
     */
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

    /**
     * Строит карту вопрос→ответы из формата с жирным текстом и '+'.
     * @returns {Map<string, string[]>} карта вопросов и правильных ответов
     */
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

    /**
     * Формат 2: поиск по карте вопросов с нечётким совпадением.
     * @param {string} questionText — текст вопроса
     * @returns {string[]|null} массив правильных ответов или null
     */
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

/** Реестр источников ответов с их парсерами */
const SOURCES = {
    '24forcare': { parseAnswers: parseFrom24forcare },
    'rosmedicinfo': { parseAnswers: parseFromRosmedicinfo },
};

/**
 * Определяет источник ответов по URL.
 * @param {string} url — URL страницы с ответами
 * @returns {string|null} ключ источника ('24forcare'|'rosmedicinfo') или null
 */
function detectSource(url) {
    if (url.includes('24forcare.com')) return '24forcare';
    if (url.includes('rosmedicinfo.ru')) return 'rosmedicinfo';
    return null;
}
