import { fetchViaBackground, storageSet, cleanHtml, fixAllTextNodes, normalizeText } from './utils';
import { detectSource, SOURCES } from './parsers';
import { highlightAnswers } from './matching';
import { POLL_INTERVAL } from './constants';

export function initSitesMode(): void {
  const status = (msg: string, cls = '') => {
    const el = document.getElementById('nmo-status')!;
    el.textContent = msg;
    el.className = 'nmo-status ' + cls;
  };

  let intervalId: ReturnType<typeof setInterval> | null = null;
  const runBtn = document.getElementById('nmo-run') as HTMLButtonElement;
  const stopBtn = document.getElementById('nmo-stop') as HTMLButtonElement;

  runBtn.addEventListener('click', async () => {
    const urlInput = document.getElementById('nmo-url') as HTMLInputElement;
    const customUrl = urlInput.value.trim();

    if (!customUrl) {
      urlInput.classList.add('input-error');
      status('вставь URL с ответами', 'err');
      setTimeout(() => urlInput.classList.remove('input-error'), 600);
      urlInput.focus();
      return;
    }

    try {
      new URL(customUrl);
    } catch {
      urlInput.classList.add('input-error');
      status('некорректный URL', 'err');
      setTimeout(() => urlInput.classList.remove('input-error'), 600);
      urlInput.focus();
      return;
    }

    const activeSource = detectSource(customUrl);
    const source = activeSource ? SOURCES[activeSource] : null;

    if (!source || !activeSource) {
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

      if (!response.text || response.text.length < 100) {
        status('пустой ответ от сервера', 'err');
        runBtn.disabled = false;
        return;
      }

      const div = document.createElement('div');
      div.innerHTML = cleanHtml(response.text);
      fixAllTextNodes(div);

      const getAnswersFn = source.parseAnswers(div);
      let lastQuestion = '';

      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        const questionAnchor = document.getElementById('questionAnchor');
        if (!questionAnchor) return;
        const titleEl = questionAnchor.querySelector('.question-title-text') as HTMLElement | null;
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

        const allVariant = Array.from(questionAnchor.querySelectorAll<HTMLElement>('.mdc-form-field span'));
        const found = highlightAnswers(allVariant, answers);

        if (found) {
          status(`найдено \u2022 ${activeSource}`, 'ok');
        } else {
          status('ответ не совпал с вариантами', 'warn');
        }
      }, POLL_INTERVAL);

      status(`работает \u2022 ${activeSource}`, 'ok');
      runBtn.style.display = 'none';
      stopBtn.style.display = 'block';
    } catch (err) {
      status(`ошибка парсинга: ${(err as Error).message}`, 'err');
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
