/**
 * Парсеры ответов с сайтов 24forcare.com и rosmedicinfo.ru.
 *
 * Этот файл — публичный фасад. Вся логика разбора разметки живёт в
 * {@link ./parsers.cases} — каждый вариант вёрстки оформлен отдельной
 * case-функцией. Здесь только склейка и поиск по QA-парам.
 *
 * @module parsers
 */

import type { ParserFunction, ISourceConfig, SourceKey } from '../types';
import { normalizeDashes, similarity } from './text';
import { SIMILARITY_THRESHOLD } from './constants';
import {
	extract24forcare,
	extractRosmedH3Highlighted,
	extractRosmedH3BrPlus,
	extractRosmedNumberedPInlineBr,
	extractRosmedNumberedPPerParagraph,
	type QaPair,
} from './parsers.cases';

// ─── Общий поиск ─────────────────────────────────────────────────────

/**
 * Ищет лучшее совпадение вопроса среди QA-пар.
 * Алгоритм: exact includes → fuzzy (Dice coefficient > SIMILARITY_THRESHOLD).
 */
function findInPairs(pairs: QaPair[], questionText: string): string[] | null {
	const nq = normalizeDashes(questionText);
	let bestScore = 0;
	let bestAnswers: string[] = [];

	for (const { question, answers } of pairs) {
		const nqa = normalizeDashes(question);

		// Точное совпадение через includes
		if (nqa.includes(nq) || nq.includes(nqa)) {
			const score = Math.min(nq.length, nqa.length) / Math.max(nq.length, nqa.length);
			if (score > bestScore) {
				bestScore = score;
				bestAnswers = answers;
			}
			continue;
		}

		// Нечёткое совпадение
		const score = similarity(nq, nqa);
		if (score > SIMILARITY_THRESHOLD && score > bestScore) {
			bestScore = score;
			bestAnswers = answers;
		}
	}

	return bestAnswers.length ? bestAnswers : null;
}

// ─── Публичные парсеры ───────────────────────────────────────────────

/**
 * Парсер ответов с 24forcare.com.
 * Извлекает QA-пары из DOM, возвращает функцию поиска по тексту вопроса.
 */
export function parseFrom24forcare(div: HTMLElement): ParserFunction {
	const pairs = extract24forcare(div);
	return (questionText) => findInPairs(pairs, questionText);
}

/**
 * Парсер ответов с rosmedicinfo.ru.
 * Прогоняет все 4 case-extractor'а, объединяет результаты.
 * Дубликаты (одна и та же пара из разных case'ов) допустимы — findInPairs
 * всё равно выберет лучшее совпадение по score.
 */
export function parseFromRosmedicinfo(div: HTMLElement): ParserFunction {
	const pairs = [
		...extractRosmedH3Highlighted(div),
		...extractRosmedH3BrPlus(div),
		...extractRosmedNumberedPInlineBr(div),
		...extractRosmedNumberedPPerParagraph(div),
	];
	return (questionText) => findInPairs(pairs, questionText);
}

// ─── Реестр источников ───────────────────────────────────────────────

/** Реестр источников ответов: ключ → парсер */
export const SOURCES: Record<SourceKey, ISourceConfig> = {
	'24forcare': { parseAnswers: parseFrom24forcare },
	'rosmedicinfo': { parseAnswers: parseFromRosmedicinfo },
};

/** Определяет источник ответов по URL */
export function detectSource(url: string): SourceKey | null {
	if (url.includes('24forcare.com')) return '24forcare';
	if (url.includes('rosmedicinfo.ru')) return 'rosmedicinfo';
	return null;
}
