import type { ISourceKey } from '../types';
import { matchQuestion, variantMatches } from './matching';
import {
	extract24forcare2,
	extractRosmedH3Highlighted2,
	extractRosmedH3BrPlus2,
	extractRosmedNumberedPInlineBr2,
	extractRosmedNumberedPPerParagraph2,
	type QaCaseRaw,
} from './extractors';

export interface QaCaseModel {
	readonly question: string;
	readonly variants: string[];
	readonly answers: string[];
	/** Порядковый индекс case'а в выходном массиве `extractCases`. Уникален в рамках одного вызова. */
	readonly idx: number;
}

// ─── Публичный диспатчер ─────────────────────────────────────────────

/**
 * Достаёт все вопросы из HTML-дерева источника.
 * @param source — ключ источника (24forcare / rosmedicinfo)
 * @param div    — распарсенный HTML-документ (результат `parseHtml(..., true)`)
 */
export function extractCases(source: ISourceKey, div: HTMLElement): QaCaseModel[] {
	let raw: QaCaseRaw[] = [];
	if (source === '24forcare') raw = [...extract24forcare2(div)];
	else if (source === 'rosmedicinfo') {
		raw = [
			...extractRosmedH3Highlighted2(div),
			...extractRosmedH3BrPlus2(div),
			...extractRosmedNumberedPInlineBr2(div),
			...extractRosmedNumberedPPerParagraph2(div),
		];
	}

	return raw.map((c, idx) => ({...c, idx}));
}

// ─── Поиск по модели ─────────────────────────────────────────────────

export interface IParse2Result {
	/** Правильные варианты из ВХОДНЫХ `variants` (подмножество, не source-версия). */
	readonly answers: string[];
	/** 0..1 — уверенность матча: qScore × (доля входных вариантов, нашедших совпадение). */
	readonly score: number;
}

/**
 * Ищет case в модели по (question, variants).
 *
 * 1. Фильтрует кандидатов по вопросу (`matchQuestion` — exact / includes≥10 / similarity).
 * 2. Для каждого считает overlap: сколько УНИКАЛЬНЫХ входных вариантов матчнулись
 *    хоть к одному сохранённому (`variantMatches`).
 * 3. Сортирует: `overlap desc → qScore desc → idx asc` — стабильный тай-брейкер.
 * 4. Сопоставляет source-ответы победителя со ВХОДНЫМИ variants и возвращает
 *    подмножество ВХОДНЫХ как `answers`.
 *
 * @returns
 *  - `null` — вопрос не нашёлся в модели
 *  - `{ answers: [], score }` — вопрос нашёлся, но source-ответы не сопоставились с входными variants
 *  - `{ answers: [...], score }` — нормальный матч
 */
export function findAnswers(model: QaCaseModel[], question: string, variants: string[]): IParse2Result | null {
	const candidates = model
		.map(c => ({ c, qScore: matchQuestion(c.question, question) }))
		.filter(x => x.qScore > 0);

	if (!candidates.length) return null;

	const scored = candidates.map(cand => {
		const matched = new Set<number>();
		cand.c.variants.forEach(v => {
			variants.forEach((iv, i) => {
				if (!matched.has(i) && variantMatches(v, iv)) matched.add(i);
			});
		});
		return { ...cand, overlap: matched.size };
	});

	scored.sort((a, b) =>
		(b.overlap - a.overlap) ||
		(b.qScore - a.qScore) ||
		(a.c.idx - b.c.idx),
	);

	const winner = scored[0];
	const confidence = variants.length ? winner.overlap / variants.length : 1;

	// подмножество ВХОДНЫХ variants, которые матчнулись к source-answers победителя
	const answers = variants.filter(iv => winner.c.answers.some(sa => variantMatches(sa, iv)));

	return {
		answers,
		score: winner.qScore * confidence,
	};
}
