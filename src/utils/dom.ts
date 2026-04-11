/**
 * DOM-утилиты для работы со страницей НМО.
 *
 * Все обращения к DOM проходят через fallback-цепочки из {@link constants.SELECTORS}.
 * @module utils/dom
 */

import { SELECTORS } from './constants';

type SelectorKey = keyof typeof SELECTORS;

/** Находит первый элемент по fallback-цепочке селекторов */
function queryFirst<T extends Element = HTMLElement>(key: SelectorKey, root: ParentNode = document): T | null {
	for (const sel of SELECTORS[key]) {
		const el = root.querySelector<T>(sel);
		if (el) return el;
	}
	return null;
}

/** Находит все элементы по первому сработавшему селектору из цепочки */
function queryAll<T extends Element = HTMLElement>(key: SelectorKey, root: ParentNode = document): T[] {
	for (const sel of SELECTORS[key]) {
		const els = root.querySelectorAll<T>(sel);
		if (els.length) return Array.from(els);
	}
	return [];
}

// ─── Публичные геттеры ───────────────────────────────────────────────

/** Элемент заголовка темы теста */
export function getTopicElement(): HTMLElement | null {
	return queryFirst('topic');
}

/** Контейнер текущего вопроса */
export function getQuestionAnchor(): HTMLElement | null {
	return queryFirst('questionAnchor');
}

/** Текст текущего вопроса */
export function getQuestionText(): string | null {
	const anchor = getQuestionAnchor();
	if (!anchor) return null;
	return queryFirst('questionText', anchor)?.textContent?.trim() ?? null;
}

/** DOM-элементы вариантов ответов */
export function getVariantElements(): HTMLElement[] {
	const anchor = getQuestionAnchor();
	if (!anchor) return [];
	return queryAll('variant', anchor);
}

/** Тексты вариантов ответов */
export function getVariantTexts(): string[] {
	return getVariantElements().map(el => el.innerText.trim());
}

/** Тип вопроса: true = один ответ (radio), false = несколько (checkbox) */
export function isSingleAnswer(): boolean {
	const anchor = getQuestionAnchor();
	return !!anchor && !!queryFirst('radioInput', anchor);
}
