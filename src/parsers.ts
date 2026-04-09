/**
 * Парсеры ответов с сайтов 24forcare.com и rosmedicinfo.ru.
 *
 * Каждый парсер принимает DOM-контейнер с HTML загруженной страницы
 * и возвращает функцию-замыкание для поиска ответов по тексту вопроса.
 * @module parsers
 */

import type { ParserFunction, SourceConfig, SourceKey } from './types';
import { normalizeDashes } from './utils';

/**
 * Парсер ответов с 24forcare.com.
 * Структура: вопрос в `<h3>`, правильные ответы в `<strong>` внутри следующего `<p>`.
 * @param div — DOM-контейнер с очищенным HTML страницы
 * @returns функция поиска ответов по тексту вопроса
 */
export function parseFrom24forcare(div: HTMLElement): ParserFunction {
  return function getAnswers(questionText: string): string[] | null {
    const nq = normalizeDashes(questionText);
    const h3 = Array.from(div.querySelectorAll('h3')).find(el => normalizeDashes(el.textContent || '').includes(nq));
    if (!h3) return null;
    const p = h3.nextElementSibling;
    if (!p || p.tagName !== 'P') return null;
    return Array.from(p.querySelectorAll('strong')).map(el =>
      ((el as HTMLElement).innerText || '').replace(/[;+.]+$/, '').replace(/^\d+\)\s*/, '').trim()
    );
  };
}

/**
 * Парсер ответов с rosmedicinfo.ru.
 * Поддерживает два формата вёрстки:
 * 1. Вопрос в `<h3>`, ответы — `<span>` с жёлтым фоном (#fbeeb8)
 * 2. Вопрос в `<b>` с нумерацией (1. 2. ...), ответы — строки с '+' в следующем `<p.MsoNormal>`
 * @param div — DOM-контейнер с очищенным HTML страницы
 * @returns функция поиска ответов по тексту вопроса
 */
export function parseFromRosmedicinfo(div: HTMLElement): ParserFunction {
  function tryLayout1(questionText: string): string[] | null {
    const nq = normalizeDashes(questionText);
    const h3 = Array.from(div.querySelectorAll('h3')).find(el => normalizeDashes(el.textContent || '').includes(nq));
    if (!h3) return null;
    const p = h3.nextElementSibling;
    if (!p || p.tagName !== 'P') return null;
    const highlighted = Array.from(p.querySelectorAll('span')).filter(span => {
      const bg = span.getAttribute('style') || '';
      return bg.includes('fbeeb8') || bg.includes('background');
    });
    if (!highlighted.length) return null;
    return highlighted.map(el =>
      ((el as HTMLElement).innerText || '').replace(/[;+.]+$/, '').replace(/^\d+\)\s*/, '').trim()
    );
  }

  function buildQaMapFromBoldPlus(): Map<string, string[]> {
    const qaMap = new Map<string, string[]>();
    const allP = Array.from(div.querySelectorAll('p.MsoNormal'));
    for (let i = 0; i < allP.length; i++) {
      const p = allP[i];
      const firstBold = p.querySelector('b');
      if (!firstBold) continue;
      const bText = ((firstBold as HTMLElement).innerText || '').trim();
      if (!/^\d+\./.test(bText)) continue;
      const qText = bText.replace(/^\d+\.\s*/, '').trim();
      const nextP = allP[i + 1];
      if (!nextP) continue;
      const lines = nextP.innerHTML.split(/<br\s*\/?>/i);
      const correctAnswers: string[] = [];
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

  function tryLayout2(questionText: string): string[] | null {
    const nq = normalizeDashes(questionText);
    for (const [q, answers] of qaMap2) {
      const nqa = normalizeDashes(q);
      if (nqa.includes(nq) || nq.includes(nqa)) return answers;
    }
    return null;
  }

  return function getAnswers(questionText: string): string[] | null {
    return tryLayout1(questionText) || tryLayout2(questionText) || null;
  };
}

/** Реестр источников ответов: ключ → парсер */
export const SOURCES: Record<SourceKey, SourceConfig> = {
  '24forcare': { parseAnswers: parseFrom24forcare },
  'rosmedicinfo': { parseAnswers: parseFromRosmedicinfo },
};

/** Определяет источник ответов по URL */
export function detectSource(url: string): SourceKey | null {
  if (url.includes('24forcare.com')) return '24forcare';
  if (url.includes('rosmedicinfo.ru')) return 'rosmedicinfo';
  return null;
}
