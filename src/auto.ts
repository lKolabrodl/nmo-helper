import type { ParserFunction, SearchUrls, AutoCacheEntry } from './types';
import { fetchViaBackground, storageSet, cleanHtml, fixAllTextNodes } from './utils';
import { SOURCES } from './parsers';
import { highlightAnswers } from './matching';
import { POLL_INTERVAL } from './constants';

export async function loadParser(url: string, sourceKey: '24forcare' | 'rosmedicinfo'): Promise<ParserFunction | null> {
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

export async function searchBothSites(query: string): Promise<SearchUrls> {
  const result: SearchUrls = { rosmed: null, forcare: null };

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

export function initAutoMode(): void {
  const autoStatus = (msg: string, cls = '') => {
    const el = document.getElementById('nmo-auto-status')!;
    el.textContent = msg;
    el.className = 'nmo-status ' + cls;
  };

  let autoIntervalId: ReturnType<typeof setInterval> | null = null;
  let autoCache = new Map<string, AutoCacheEntry>();
  let rosmedParser: ParserFunction | null = null;
  let forcareParser: ParserFunction | null = null;
  let autoLoaded = false;
  let autoLoading = false;
  let autoLastTopic = '';

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

  function startAuto() {
    stopAuto();
    autoStatus('ищу тему...', 'loading');

    autoIntervalId = setInterval(async () => {
      const topicEl = document.querySelector('.mat-card-title-quiz-custom, .mat-mdc-card-title') as HTMLElement | null;
      const topic = topicEl ? topicEl.innerText.trim() : '';

      if (!topic) {
        autoStatus('тема не найдена', 'warn');
        return;
      }

      if (topic !== autoLastTopic) {
        autoLastTopic = topic;
        autoLoaded = false;
        autoLoading = false;
        rosmedParser = null;
        forcareParser = null;
        autoCache = new Map();
      }

      if (!autoLoaded && !autoLoading) {
        autoLoading = true;
        autoStatus('ищу ответы...', 'loading');

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

        const src: string[] = [];
        if (rosmedParser) src.push('rosmed');
        if (forcareParser) src.push('24fc');
        autoStatus(`загружено: ${src.join(' + ')}`, 'ok');
      }

      if (autoLoading || (!rosmedParser && !forcareParser)) return;

      const questionAnchor = document.getElementById('questionAnchor');
      if (!questionAnchor) return;
      const titleEl = questionAnchor.querySelector('.question-title-text') as HTMLElement | null;
      if (!titleEl) return;

      const currentQ = titleEl.innerText;
      const allVariant = Array.from(questionAnchor.querySelectorAll<HTMLElement>('.mdc-form-field span'));

      if (autoCache.has(currentQ)) {
        const cached = autoCache.get(currentQ)!;
        highlightAnswers(allVariant, cached.answers);
        autoStatus(`${cached.source} (кеш)`, 'ok');
        return;
      }

      let answers: string[] | null = null;
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
    }, POLL_INTERVAL);
  }

  document.getElementById('nmo-auto-mode')!.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    storageSet('autoMode', on);
    if (on) {
      startAuto();
    } else {
      stopAuto();
      autoStatus('выключено', '');
    }
  });

  if ((document.getElementById('nmo-auto-mode') as HTMLInputElement).checked) {
    startAuto();
  }
}
