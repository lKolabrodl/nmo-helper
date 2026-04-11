/**
 * Парсеры ответов с сайтов 24forcare.com и rosmedicinfo.ru.
 *
 * Архитектура двухслойная:
 * 1. **Extractors** — извлекают пары «вопрос → ответы» из DOM (per-layout).
 * 2. **findInPairs** — общий поиск по извлечённым парам (нормализация + similarity).
 *
 * @module parsers
 */

import type { ParserFunction, ISourceConfig, SourceKey } from '../types';
import { normalizeDashes, similarity } from './text';
import { SIMILARITY_THRESHOLD } from './constants';

// ─── Типы ────────────────────────────────────────────────────────────

interface QaPair {
	readonly question: string;
	readonly answers: string[];
}

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

// ─── Extractors ──────────────────────────────────────────────────────

/** Очищает текст ответа от мусора: завершающие символы, нумерация */
function cleanAnswer(text: string): string {
	return text.replace(/[;+.]+$/, '').replace(/^\d+\)\s*/, '').trim();
}

/**
 * Extractor для 24forcare.com.
 * Структура: вопрос в `<h3>`, правильные ответы в `<strong>` внутри следующего `<p>`.
 */
function extract24forcare(div: HTMLElement): QaPair[] {
	const pairs: QaPair[] = [];

	for (const h3 of Array.from(div.querySelectorAll('h3'))) {
		const question = (h3.textContent || '').trim();
		if (!question) continue;

		const p = h3.nextElementSibling;
		if (!p || p.tagName !== 'P') continue;

		const answers = Array.from(p.querySelectorAll('strong'))
			.map(el => cleanAnswer((el as HTMLElement).innerText || ''))
			.filter(Boolean);

		if (answers.length) pairs.push({ question, answers });
	}

	return pairs;
}

/**
 * Extractor для rosmedicinfo.ru, layout 1.
 * Структура: вопрос в `<h3>`, ответы — `<span>` с жёлтым фоном (#fbeeb8) в следующем `<p>`.
 */
function extractRosmedLayout1(div: HTMLElement): QaPair[] {
	const pairs: QaPair[] = [];

	for (const h3 of Array.from(div.querySelectorAll('h3'))) {
		const question = (h3.textContent || '').trim();
		if (!question) continue;

		const p = h3.nextElementSibling;
		if (!p || p.tagName !== 'P') continue;

		const highlighted = Array.from(p.querySelectorAll('span')).filter(span => {
			const bg = span.getAttribute('style') || '';
			return bg.includes('fbeeb8') || bg.includes('background');
		});

		const answers = highlighted
			.map(el => cleanAnswer((el as HTMLElement).innerText || ''))
			.filter(Boolean);

		if (answers.length) pairs.push({ question, answers });
	}

	return pairs;
}

/**
 * Extractor для rosmedicinfo.ru, layout 2.
 * Структура: вопрос в `<b>` с нумерацией (1. 2. ...) внутри `<p.MsoNormal>`,
 * ответы — строки с '+' в следующем `<p.MsoNormal>`.
 */
function extractRosmedLayout2(div: HTMLElement): QaPair[] {
	const pairs: QaPair[] = [];
	const allP = Array.from(div.querySelectorAll('p.MsoNormal'));

	for (let i = 0; i < allP.length; i++) {
		const p = allP[i];

		const firstBold = p.querySelector('b');
		const rawText = firstBold
			? ((firstBold as HTMLElement).innerText || '').trim()
			: ((p as HTMLElement).innerText || '').trim();
		if (!/^\d+\./.test(rawText)) continue;

		const question = rawText.replace(/^\d+\.\s*/, '').trim();
		const nextP = allP[i + 1];
		if (!nextP) continue;

		const lines = nextP.innerHTML.split(/<br\s*\/?>/i);
		const answers: string[] = [];

		for (const line of lines) {
			if (!line.includes('+')) continue;
			const tmp = document.createElement('span');
			tmp.innerHTML = line;
			const text = (tmp.innerText || tmp.textContent || '').trim();
			const cleaned = cleanAnswer(text.replace(/\+$/, ''));
			if (cleaned) answers.push(cleaned);
		}

		if (answers.length) pairs.push({ question, answers });
	}

	return pairs;
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
 * Объединяет оба layout, возвращает функцию поиска по тексту вопроса.
 */
export function parseFromRosmedicinfo(div: HTMLElement): ParserFunction {
	const pairs = [...extractRosmedLayout1(div), ...extractRosmedLayout2(div)];
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
