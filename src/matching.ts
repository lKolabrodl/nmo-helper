/**
 * Логика сопоставления и подсветки ответов.
 * Общий модуль для auto.ts и sites.ts — убирает дублирование кода.
 * @module matching
 */

import { normalizeText } from './utils';
import { HIGHLIGHT_COLOR } from './constants';

/**
 * Подсвечивает правильные ответы на странице теста НМО.
 *
 * Алгоритм двухуровневый:
 * 1. **Точное совпадение** — нормализованный текст варианта === нормализованный текст ответа
 * 2. **Нечёткое совпадение** — один текст является подстрокой другого, но только на границе слов
 *    (пробел, запятая, тире и т.д.), чтобы не совпадать по частям слов
 *
 * @param allVariant — DOM-элементы вариантов ответа (span внутри .mdc-form-field)
 * @param answers — массив текстов правильных ответов с сайта-источника
 * @returns true если хотя бы один вариант подсвечен
 */
export function highlightAnswers(allVariant: HTMLElement[], answers: string[]): boolean {
  // Этап 1: точное совпадение (с нормализацией тире, регистра, кириллицы)
  const exact: HTMLElement[] = [];
  allVariant.forEach(el => {
    const v = normalizeText(el.innerText);
    answers.forEach(ans => {
      if (normalizeText(ans) === v) exact.push(el);
    });
  });
  exact.forEach(el => {
    if (el.style.color !== HIGHLIGHT_COLOR) el.style.color = HIGHLIGHT_COLOR;
  });
  if (exact.length) return true;

  // Этап 2: нечёткое совпадение по границе слова
  let found = false;
  allVariant.forEach(el => {
    const variant = normalizeText(el.innerText);
    answers.forEach(ans => {
      const a = normalizeText(ans);
      const longer = a.length >= variant.length ? a : variant;
      const shorter = a.length >= variant.length ? variant : a;
      const idx = longer.indexOf(shorter);
      if (idx === -1) return;

      // Проверяем что совпадение на границе слова (не в середине)
      const charBefore = idx > 0 ? longer[idx - 1] : ' ';
      const charAfter = idx + shorter.length < longer.length ? longer[idx + shorter.length] : ' ';
      const isBoundary = /[\s,;.\-\u2014():]/.test(charBefore) || idx === 0;
      const isEndBoundary = /[\s,;.\-\u2014():]/.test(charAfter) || (idx + shorter.length === longer.length);

      if (isBoundary && isEndBoundary) {
        if (el.style.color !== HIGHLIGHT_COLOR) el.style.color = HIGHLIGHT_COLOR;
        found = true;
      }
    });
  });

  return found;
}
