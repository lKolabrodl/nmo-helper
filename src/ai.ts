/**
 * AI-режим: запросы к ProxyAPI, проверка ключа, кеширование ответов, подсветка.
 * @module ai
 */

import type { FetchResponse } from './types';
import { fetchViaBackground } from './utils';
import { AI_URL, HIGHLIGHT_COLOR, POLL_INTERVAL } from './constants';

/**
 * Добавляет префикс провайдера к названию модели для единого OpenAI-совместимого endpoint.
 * Claude → anthropic/, Gemini → gemini/, OpenAI — без префикса.
 */
export function getApiModel(model: string): string {
  if (model.startsWith('claude')) return 'anthropic/' + model;
  if (model.startsWith('gemini')) return 'gemini/' + model;
  return model;
}

/**
 * Отправляет вопрос с вариантами ответа в AI и возвращает индексы правильных вариантов.
 * @returns массив 0-based индексов правильных вариантов
 */
export async function askAI(
  apiKey: string,
  question: string,
  options: string[],
  isSingle: boolean,
  topic: string
): Promise<number[]> {
  const countHint = isSingle
    ? 'Правильный ответ ТОЛЬКО ОДИН. Ответь ОДНИМ номером, без пояснений. Например: 2'
    : 'Правильных ответов может быть несколько. Ответь номерами через запятую, без пояснений. Например: 1,3';
  const systemPrompt = topic
    ? `Ты врач-эксперт. Тема: ${topic}. Отвечай на вопросы теста, опираясь на актуальные клинические рекомендации РФ.`
    : 'Ты эксперт. Отвечай на вопросы теста.';
  const prompt = `Вопрос: ${question}\n\nВарианты:\n${options.map((o, i) => `${i + 1}) ${o}`).join('\n')}\n\n${countHint}`;

  const modelEl = document.getElementById('nmo-ai-model') as HTMLInputElement;
  const model = modelEl.value;
  const isReasoning = /^o\d/.test(model) || /^gpt-5/.test(model);

  const params: Record<string, unknown> = {
    model: getApiModel(model),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  };
  if (!isReasoning) params.temperature = 0.2;

  const res: FetchResponse = await fetchViaBackground(AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(params),
  });

  if (res.error) throw new Error('ошибка сети');
  if (res.status < 200 || res.status >= 400) {
    let detail = '';
    try { detail = JSON.parse(res.text)?.error?.message || res.text; } catch { detail = res.text; }
    console.error(`NMO AI [${res.status}]:`, detail);
    if (res.status === 401 || res.status === 403) throw new Error('неверный API-ключ');
    if (res.status === 429) throw new Error('лимит запросов — подождите');
    throw new Error(`ошибка ${res.status}`);
  }

  const data = JSON.parse(res.text);
  const text: string = data?.choices?.[0]?.message?.content || '';
  const nums = text.match(/\d+/g);
  if (!nums) return [];
  return nums.map(n => parseInt(n, 10) - 1);
}

/** Проверяет валидность API-ключа минимальным тестовым запросом */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  const modelEl = document.getElementById('nmo-ai-model') as HTMLInputElement;
  const model = modelEl.value;

  const res: FetchResponse = await fetchViaBackground(AI_URL, {
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
  if (res.status === 429) return true;
  if (res.status < 200 || res.status >= 400) {
    console.error(`NMO AI [${res.status}]:`, res.text);
    throw new Error('ошибка ' + res.status);
  }
  return true;
}

/**
 * Инициализирует AI-режим: обработчики кнопок Запуск/Стоп,
 * интервал отслеживания вопросов, кеширование ответов, подсветку.
 */
export function initAiMode(): void {
  const aiStatus = (msg: string, cls = '') => {
    const el = document.getElementById('nmo-ai-status')!;
    el.textContent = msg;
    el.className = 'nmo-status ' + cls;
  };

  const aiRunBtn = document.getElementById('nmo-ai-run') as HTMLButtonElement;
  const aiStopBtn = document.getElementById('nmo-ai-stop') as HTMLButtonElement;
  let aiIntervalId: ReturnType<typeof setInterval> | null = null;
  let aiPending = false;
  let aiCache = new Map<string, number[]>();
  let aiLastQuestion = '';

  aiRunBtn.addEventListener('click', async () => {
    const apiKey = (document.getElementById('nmo-api-key') as HTMLInputElement).value.trim();
    if (!apiKey) {
      aiStatus('введите API-ключ', 'err');
      return;
    }

    aiRunBtn.disabled = true;
    aiStatus('проверяю ключ...', 'loading');

    try {
      await validateApiKey(apiKey);
    } catch (err) {
      aiStatus((err as Error).message, 'err');
      aiRunBtn.disabled = false;
      return;
    }
    aiRunBtn.disabled = false;

    aiPending = false;
    aiCache = new Map();
    aiLastQuestion = '';

    async function handleQuestion(currentQ: string, allVariant: HTMLElement[], isSingle: boolean, topic: string) {
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
            el.style.color = HIGHLIGHT_COLOR;
          }
        });

        aiStatus(`AI: вариант${correctIndexes.length > 1 ? 'ы' : ''} ${correctIndexes.map(i => i + 1).join(', ')}`, 'ok');
      } catch (err) {
        aiStatus((err as Error).message, 'err');
      }
      aiPending = false;
    }

    if (aiIntervalId) clearInterval(aiIntervalId);
    aiIntervalId = setInterval(() => {
      if (aiPending) return;

      const questionAnchor = document.getElementById('questionAnchor');
      if (!questionAnchor) return;
      const titleEl = questionAnchor.querySelector('.question-title-text') as HTMLElement | null;
      if (!titleEl) return;

      const currentQ = titleEl.innerText;
      const allVariant = Array.from(questionAnchor.querySelectorAll<HTMLElement>('.mdc-form-field span'));

      if (aiCache.has(currentQ)) {
        const cached = aiCache.get(currentQ)!;
        allVariant.forEach((el, i) => {
          if (cached.includes(i)) {
            if (el.style.color !== HIGHLIGHT_COLOR) el.style.color = HIGHLIGHT_COLOR;
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
      const topicEl = document.querySelector('.mat-card-title-quiz-custom, .mat-mdc-card-title') as HTMLElement | null;
      const topic = topicEl ? topicEl.innerText.trim() : '';
      handleQuestion(currentQ, allVariant, isSingle, topic);
    }, POLL_INTERVAL);

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
