import type { ISourceKey } from '../types';
import { matchQuestion, variantScore } from './matching';
import {
	extract24forcare,
	extract24forcareNumberedPPlus,
	extractRosmedH3Highlighted,
	extractRosmedH3BrPlus,
	extractRosmedNumberedPInlineBr,
	extractRosmedNumberedPPerParagraph,
	extractRosmedFlatBr,
	type QaCaseRaw,
} from './extractors';

export interface QaCaseModel {
	readonly question: string;
	readonly variants: string[];
	readonly answers: string[];
	/** Порядковый индекс case'а в выходном массиве `extractCases`. Уникален в рамках одного вызова. */
	readonly idx: number;
}

/**
 * Минимальный score в `variantScore`, чтобы считать пару «совпадением».
 * Применяется только как нижний порог в top-1 assignment — чтобы утиль-шум
 * (Dice случайных коротких строк) не попадал в ответы. Реальный отбор идёт
 * через «лучший кандидат», не через этот порог.
 */
const MIN_VARIANT_SCORE = 0.7;

// ─── Публичный диспатчер ─────────────────────────────────────────────

/**
 * Достаёт все вопросы из HTML-дерева источника.
 * @param source — ключ источника (24forcare / rosmedicinfo)
 * @param div    — распарсенный HTML-документ (результат `parseHtml(..., true)`)
 */
export function extractCases(source: ISourceKey, div: HTMLElement): QaCaseModel[] {
	let raw: QaCaseRaw[] = [];
	if (source === '24forcare') raw = [
		...extract24forcare(div),
		...extract24forcareNumberedPPlus(div),
	];
	else if (source === 'rosmedicinfo') {
		raw = [
			...extractRosmedH3Highlighted(div),
			...extractRosmedH3BrPlus(div),
			...extractRosmedNumberedPInlineBr(div),
			...extractRosmedNumberedPPerParagraph(div),
			...extractRosmedFlatBr(div),
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
 * 2. Для каждого считает overlap через top-1 assignment:
 *    каждый source-вариант выбирает ЛУЧШИЙ ещё не занятый входной вариант
 *    по `variantScore`. Один входной вариант не может быть «подхвачен» дважды.
 * 3. Сортирует: `overlap desc → qScore desc → idx asc` — стабильный тай-брейкер.
 * 4. Тем же top-1 assignment сопоставляет source-answers победителя со ВХОДНЫМИ
 *    variants и возвращает подмножество ВХОДНЫХ как `answers`.
 *
 * Ключевая идея: «лучший» вместо «любой выше порога» — настоящее совпадение
 * всегда даёт score 1.0 и выигрывает у похожих-но-разных меток
 * (напр., «катепсина К» выигрывает у «катепсина А» со score 0.9, даже если
 * обе прошли бы порог). Порог {@link MIN_VARIANT_SCORE} — только floor против
 * утиль-шума, не инструмент отбора.
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

	const scored = candidates.map(cand => ({
		...cand,
		overlap: assignTopOne(cand.c.variants, variants).length,
	}));

	scored.sort((a, b) =>
		(b.overlap - a.overlap) ||
		(b.qScore - a.qScore) ||
		(a.c.idx - b.c.idx),
	);

	const winner = scored[0];
	const confidence = variants.length ? winner.overlap / variants.length : 1;

	// Top-1 assignment source-answers → input variants.
	// Возвращаем подмножество ВХОДНЫХ variants в порядке их появления.
	const assignedIdx = assignTopOne(winner.c.answers, variants).sort((a, b) => a - b);
	const answers = assignedIdx.map(i => variants[i]);

	return {
		answers,
		score: winner.qScore * confidence,
	};
}

/**
 * Жадное назначение: каждому элементу из `sources` ищет индекс лучшего
 * ещё не занятого элемента в `targets` по {@link variantScore}. Если лучший
 * score ниже {@link MIN_VARIANT_SCORE} — source-элемент пропускается (пары нет).
 *
 * @returns Массив индексов в `targets`, каждый уникален. Порядок соответствует
 *          порядку обхода `sources`.
 */
function assignTopOne(sources: readonly string[], targets: readonly string[]): number[] {
	const used = new Set<number>();
	const assigned: number[] = [];
	for (const src of sources) {
		let bestIdx = -1;
		let bestScore = 0;
		targets.forEach((tgt, i) => {
			if (used.has(i)) return;
			const s = variantScore(src, tgt);
			if (s > bestScore) { bestScore = s; bestIdx = i; }
		});
		if (bestIdx >= 0 && bestScore >= MIN_VARIANT_SCORE) {
			assigned.push(bestIdx);
			used.add(bestIdx);
		}
	}
	return assigned;
}
