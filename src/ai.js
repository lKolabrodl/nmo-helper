/**
 * Логика AI-режима: запросы к ProxyAPI, проверка ключа,
 * кеширование ответов, подсветка вариантов.
 */

/** Единый OpenAI-совместимый endpoint ProxyAPI для всех провайдеров */
const AI_URL = 'https://openai.api.proxyapi.ru/v1/chat/completions';

/**
 * Возвращает название модели с префиксом провайдера для единого endpoint.
 * OpenAI модели — без префикса, Gemini/Claude — с префиксом.
 * @param {string} model — короткое название модели
 * @returns {string} название модели для API
 */
function getApiModel(model) {
    if (model.startsWith('claude')) return 'anthropic/' + model;
    if (model.startsWith('gemini')) return 'gemini/' + model;
    return model;
}

/**
 * Отправляет вопрос с вариантами ответа в AI и возвращает индексы правильных вариантов.
 * @param {string} apiKey — API-ключ ProxyAPI
 * @param {string} question — текст вопроса
 * @param {string[]} options — массив текстов вариантов ответа
 * @param {boolean} isSingle — true если допускается только один ответ (radio)
 * @param {string} topic — тема теста (название из заголовка страницы)
 * @returns {Promise<number[]>} индексы правильных вариантов (0-based)
 */
async function askAI(apiKey, question, options, isSingle, topic) {
    const countHint = isSingle
        ? 'Правильный ответ ТОЛЬКО ОДИН. Ответь ОДНИМ номером, без пояснений. Например: 2'
        : 'Правильных ответов может быть несколько. Ответь номерами через запятую, без пояснений. Например: 1,3';
    const systemPrompt = topic
        ? `Ты врач-эксперт. Тема: ${topic}. Отвечай на вопросы теста, опираясь на актуальные клинические рекомендации РФ.`
        : 'Ты эксперт. Отвечай на вопросы теста.';
    const prompt = `Вопрос: ${question}\n\nВарианты:\n${options.map((o, i) => `${i + 1}) ${o}`).join('\n')}\n\n${countHint}`;

    const model = document.getElementById('nmo-ai-model').value;
    const isReasoning = /^o\d/.test(model) || /^gpt-5/.test(model);

    const params = {
        model: getApiModel(model),
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ],
    };
    if (!isReasoning) params.temperature = 0.2;

    const body = JSON.stringify(params);

    const res = await fetchViaBackground(AI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
        },
        body,
    });

    if (res.error) throw new Error('ошибка сети');
    if (res.status < 200 || res.status >= 400) {
        let detail = '';
        try { detail = JSON.parse(res.text)?.error?.message || res.text; } catch (e) { detail = res.text; }
        console.error(`NMO AI [${res.status}]:`, detail);
        if (res.status === 401 || res.status === 403) throw new Error('неверный API-ключ');
        if (res.status === 429) throw new Error('лимит запросов — подождите');
        throw new Error(`ошибка ${res.status}`);
    }

    const data = JSON.parse(res.text);
    const text = data?.choices?.[0]?.message?.content || '';
    const nums = text.match(/\d+/g);
    if (!nums) return [];
    return nums.map(n => parseInt(n, 10) - 1);
}

/**
 * Проверяет валидность API-ключа тестовым запросом.
 * @param {string} apiKey — API-ключ ProxyAPI
 * @returns {Promise<boolean>} true если ключ валиден
 * @throws {Error} при невалидном ключе или ошибке сети
 */
async function validateApiKey(apiKey) {
    const model = document.getElementById('nmo-ai-model').value;

    const res = await fetchViaBackground(AI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
            model: getApiModel(model),
            messages: [{ role: 'user', content: 'Ответь OK' }],
            max_completion_tokens: 5,
        }),
    });
    if (res.error) throw new Error('ошибка сети');
    if (res.status === 401 || res.status === 403) {
        console.error(`NMO AI [${res.status}]:`, res.text);
        throw new Error('неверный API-ключ');
    }
    if (res.status === 429) return true; // лимит — ключ валидный
    if (res.status < 200 || res.status >= 400) {
        console.error(`NMO AI [${res.status}]:`, res.text);
        throw new Error('ошибка ' + res.status);
    }
    return true;
}

/**
 * Инициализирует AI-режим: обработчики кнопок, интервал отслеживания вопросов,
 * кеширование ответов, подсветку вариантов.
 */
function initAiMode() {
    /** Обновляет статус AI-режима в панели */
    const aiStatus = (msg, cls = '') => {
        const el = document.getElementById('nmo-ai-status');
        el.textContent = msg;
        el.className = 'nmo-status ' + cls;
    };

    const aiRunBtn = document.getElementById('nmo-ai-run');
    const aiStopBtn = document.getElementById('nmo-ai-stop');
    let aiIntervalId = null;
    let aiPending = false;
    let aiCache = new Map();
    let aiLastQuestion = '';

    aiRunBtn.addEventListener('click', async () => {
        const apiKey = document.getElementById('nmo-api-key').value.trim();
        if (!apiKey) {
            aiStatus('введите API-ключ', 'err');
            return;
        }

        aiRunBtn.disabled = true;
        aiStatus('проверяю ключ...', 'loading');

        try {
            await validateApiKey(apiKey);
        } catch (err) {
            aiStatus(err.message, 'err');
            aiRunBtn.disabled = false;
            return;
        }
        aiRunBtn.disabled = false;

        aiPending = false;
        aiCache = new Map();
        aiLastQuestion = '';

        /**
         * Обрабатывает один вопрос: проверяет кеш, при промахе — запрашивает AI.
         * @param {string} currentQ — текст текущего вопроса
         * @param {HTMLElement[]} allVariant — элементы вариантов ответа
         * @param {boolean} isSingle — один ответ (radio) или несколько (checkbox)
         * @param {string} topic — тема теста
         */
        async function handleQuestion(currentQ, allVariant, isSingle, topic) {
            aiPending = true;
            aiStatus('думаю...', 'loading');

            const optionTexts = allVariant.map(el => el.innerText.trim());

            try {
                const correctIndexes = await askAI(apiKey, currentQ, optionTexts, isSingle, topic);

                if (correctIndexes.length === 0) {
                    aiStatus('AI не определил ответ', 'warn');
                    aiPending = false;
                    return;
                }

                aiCache.set(currentQ, correctIndexes);

                allVariant.forEach((el, i) => {
                    if (correctIndexes.includes(i)) {
                        el.style.color = '#4ecca3';
                    }
                });

                aiStatus(`AI: вариант${correctIndexes.length > 1 ? 'ы' : ''} ${correctIndexes.map(i => i + 1).join(', ')}`, 'ok');
            } catch (err) {
                aiStatus(err.message, 'err');
            }
            aiPending = false;
        }

        if (aiIntervalId) clearInterval(aiIntervalId);
        aiIntervalId = setInterval(() => {
            if (aiPending) return;

            const questionAnchor = document.getElementById('questionAnchor');
            if (!questionAnchor) return;
            const titleEl = questionAnchor.querySelector('.question-title-text');
            if (!titleEl) return;

            const currentQ = titleEl.innerText;
            const allVariant = Array.from(questionAnchor.querySelectorAll('.mdc-form-field span'));

            // Кеш — переподсвечивать каждый тик (DOM может перерисоваться)
            if (aiCache.has(currentQ)) {
                const cached = aiCache.get(currentQ);
                allVariant.forEach((el, i) => {
                    if (cached.includes(i)) {
                        if (el.style.color !== '#4ecca3') el.style.color = '#4ecca3';
                    }
                });
                if (currentQ !== aiLastQuestion) {
                    aiLastQuestion = currentQ;
                    aiStatus(`AI (кеш): вариант${cached.length > 1 ? 'ы' : ''} ${cached.map(i => i + 1).join(', ')}`, 'ok');
                }
                return;
            }

            if (currentQ === aiLastQuestion) return;
            aiLastQuestion = currentQ;

            const isSingle = !!questionAnchor.querySelector('input[type="radio"]');
            const topicEl = document.querySelector('.mat-card-title-quiz-custom, .mat-mdc-card-title');
            const topic = topicEl ? topicEl.innerText.trim() : '';
            handleQuestion(currentQ, allVariant, isSingle, topic);
        }, 500);

        aiStatus('работает', 'ok');
        aiRunBtn.style.display = 'none';
        aiStopBtn.style.display = 'block';
    });

    aiStopBtn.addEventListener('click', () => {
        if (aiIntervalId) clearInterval(aiIntervalId);
        aiIntervalId = null;
        aiCache = new Map();
        aiStatus('остановлен', '');
        aiStopBtn.style.display = 'none';
        aiRunBtn.style.display = 'block';
    });
}
