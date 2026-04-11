/**
 * Логика сопоставления и подсветки ответов.
 * @module matching
 */

import { normalizeText } from './text';
import { HIGHLIGHT_COLOR } from './constants';

/**
 * Находит индексы правильных вариантов по текстовым ответам.
 *
 * Алгоритм двухуровневый:
 * 1. **Точное совпадение** — нормализованный текст варианта === нормализованный текст ответа
 * 2. **Нечёткое совпадение** — подстрока на границе слова
 *
 * @param variantTexts — тексты вариантов ответа
 * @param answers — тексты правильных ответов с сайта-источника
 * @returns массив 0-based индексов совпавших вариантов
 */
export function findCorrectIndexes(variantTexts: string[], answers: string[]): number[] {
	const indexes: number[] = [];

	// Этап 1: точное совпадение
	variantTexts.forEach((v, i) => {
		const nv = normalizeText(v);
		for (const ans of answers) {
			if (normalizeText(ans) === nv) {
				indexes.push(i);
				return;
			}
		}
	});
	if (indexes.length) return indexes;

	// Этап 2: нечёткое совпадение по границе слова
	variantTexts.forEach((v, i) => {
		const variant = normalizeText(v);
		for (const ans of answers) {
			const a = normalizeText(ans);
			const longer = a.length >= variant.length ? a : variant;
			const shorter = a.length >= variant.length ? variant : a;
			const idx = longer.indexOf(shorter);
			if (idx === -1) continue;

			const charBefore = idx > 0 ? longer[idx - 1] : ' ';
			const charAfter = idx + shorter.length < longer.length ? longer[idx + shorter.length] : ' ';
			const isBoundary = /[\s,;.\-\u2014():]/.test(charBefore) || idx === 0;
			const isEndBoundary = /[\s,;.\-\u2014():]/.test(charAfter) || (idx + shorter.length === longer.length);

			if (isBoundary && isEndBoundary) {
				indexes.push(i);
				return;
			}
		}
	});

	return indexes;
}

/**
 * Подсвечивает варианты ответов по индексам.
 *
 * @param elements — DOM-элементы вариантов
 * @param correctIndexes — индексы правильных вариантов (0-based)
 */
export function highlightByIndexes(elements: HTMLElement[], correctIndexes: number[]): void {
	elements.forEach((el, i) => {
		if (correctIndexes.includes(i) && el.style.color !== HIGHLIGHT_COLOR) {
			el.style.color = HIGHLIGHT_COLOR;
		}
	});
}
