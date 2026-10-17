import { matchQuestion, variantScore } from './matching';
import { normalizeDashes, stripQuotes } from './text';

export interface QaCaseModel {
	readonly question: string;
	readonly variants: string[];
	readonly answers: string[];
	/** Порядковый индекс case'а в модели. Уникален в рамках одного извлечения. */
	readonly idx: number;
}

/**
 * Минимальный score в `variantScore`, чтобы считать пару «совпадением».
 * Применяется только как нижний порог в top-1 assignment — чтобы утиль-шум
 * (Dice случайных коротких строк) не попадал в ответы. Реальный отбор идёт
 * через «лучший кандидат», не через этот порог.
 */
const MIN_VARIANT_SCORE = 0.7;

// ─── Поиск по модели ─────────────────────────────────────────────────

export interface IParse2Result {
	/** Правильные варианты из ВХОДНЫХ `variants` (подмножество, не source-версия). */
	readonly answers: string[];
	/** 0..1 — уверенность матча: qScore × (доля входных вариантов, нашедших совпадение). */
	readonly score: number;
}

type PreparedCase = QaCaseModel & {sortedVariants: string[]};
type AnswerMatch = {indexes: number[]; score: number};

/**
 * Ищет case в модели по (question, variants).
 *
 * 1. Ищет точный вопрос и набор вариантов после нормализации оформления.
 *    Если такого набора нет, сопоставляет варианты точных вопросов; если нет
 *    и точного вопроса — использует `matchQuestion` (includes / similarity).
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
	const normalize = (text: string) => stripQuotes(normalizeDashes(text));

	const normalizedQuestion = normalize(question);
	const normalizedVariants = variants.map(normalize);
	const sortedVariants = [...normalizedVariants].sort();

	const normalizedModel = model.map(c => {
		const answers = c.answers.map(normalize);
		const variants = c.variants.map(normalize);
		const sortedVariants = variants.slice(0).sort();
		const question = normalize(c.question);
		return {...c, question, variants: c.variants, answers, sortedVariants};
	});

	const findExact = findExactAnswers(normalizedModel, normalizedQuestion, normalizedVariants, sortedVariants);
	const findFuzzy = findExact ? null : findFuzzyAnswers(normalizedModel, normalizedQuestion, normalizedVariants);
	const found = findExact ?? findFuzzy;
	if (!found) return null;

	return {answers: found.indexes.map(index => variants[index]), score: found.score};
}

/** Точный поиск по подготовленным текстам и отсортированным копиям вариантов. */
function findExactAnswers(model: PreparedCase[], question: string, variants: string[], sortedVariants: string[]): AnswerMatch | null {
	const exact = model.find(c => c.question === question && c.sortedVariants.length === sortedVariants.length
		&& c.sortedVariants.every((variant, index) => variant === sortedVariants[index]));

	if (!exact) return null;

	const answers = new Set(exact.answers);

	return {indexes: variants.flatMap((variant, index) => answers.has(variant) ? [index] : []), score: 1};
}

/** Нечёткий поиск с приоритетом точного текста вопроса. */
function findFuzzyAnswers(model: QaCaseModel[], question: string, variants: string[]): AnswerMatch | null {
	const exactQuestions = model.filter(c => c.question === question);

	const candidates = (exactQuestions.length ? exactQuestions : model)
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

	return {indexes: assignedIdx, score: winner.qScore * confidence};
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
