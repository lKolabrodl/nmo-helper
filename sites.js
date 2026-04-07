/**
 * Режим сайтов: загрузка ответов по URL с 24forcare.com / rosmedicinfo.ru,
 * отслеживание вопросов на странице НМО и подсветка правильных вариантов.
 */

/**
 * Инициализирует режим поиска ответов по сайтам:
 * обработчики кнопок Запуск/Стоп, загрузка HTML, парсинг, подсветка.
 */
function initSitesMode() {
    /** Обновляет статус в панели */
    const status = (msg, cls = '') => {
        const el = document.getElementById('nmo-status');
        el.textContent = msg;
        el.className = 'nmo-status ' + cls;
    };

    let intervalId = null;
    const runBtn = document.getElementById('nmo-run');
    const stopBtn = document.getElementById('nmo-stop');

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

            const cleaned = cleanHtml(dataString);

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

                const normalize = normalizeText;

                let found = false;

                // Точное совпадение (с нормализацией)
                const exact = [];
                allVariant.forEach(el => {
                    const v = normalize(el.innerText);
                    answers.forEach(ans => {
                        if (normalize(ans) === v) exact.push(el);
                    });
                });

                exact.forEach(el => { if (el.style.color !== '#4ecca3') el.style.color = '#4ecca3'; });
                if (exact.length) found = true;

                // Нечёткое совпадение — по границе слова
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
