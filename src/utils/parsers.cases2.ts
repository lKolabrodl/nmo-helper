/**
 * Case-extractor'ы для парсеров ответов v2.
 *
 * В отличие от `parsers.cases.ts` (который возвращает только правильные
 * ответы как `QaPair { question, answers }`), здесь каждый extractor
 * собирает ВСЕ варианты + помечает, какие из них правильные.
 *
 * Модель на выходе:
 *  - `question` — текст вопроса
 *  - `variants` — все варианты ответа в порядке появления на странице
 *  - `answers`  — подмножество `variants`, отмеченное как правильное
 *  - `idx`      — индексы правильных вариантов внутри `variants`
 *
 * @module utils/parsers.cases2
 */

import { cleanAnswer } from './parsers.cases';
import type { ISourceKey } from '../types';
import { normalizeDashes, similarity } from './text';
import { SIMILARITY_THRESHOLD } from './constants';

export interface QaCase2 {
	readonly question: string;
	readonly variants: string[];
	readonly answers: string[];
	/** Порядковый индекс case'а в выходном массиве `parseCases2`. Уникален в рамках одного вызова. */
	readonly idx: number;
}

type QaCaseRaw = Omit<QaCase2, 'idx'>;

// ─── Общие хелперы ───────────────────────────────────────────────────

interface RawLine {
	readonly text: string;
	readonly html: string;
}

interface ICandidate {
	readonly text: string;
	readonly correct: boolean;
}

/** Разбивает HTML по `<br>`, возвращает пары текст + исходный html каждой строки. */
function splitBrLines(html: string): RawLine[] {
	const out: RawLine[] = [];
	for (const line of html.split(/<br\s*\/?>/i)) {
		const tmp = document.createElement('span');
		tmp.innerHTML = line;
		const text = (tmp.innerText || tmp.textContent || '').trim();
		if (text) out.push({ text, html: line });
	}
	return out;
}

/** Детект вопроса вида «N. ...» в `<p>` (читает `<b>` если есть, иначе весь текст). */
function readNumberedQuestionText(p: Element): string {
	const firstBold = p.querySelector('b');
	const rawText = firstBold
		? ((firstBold as HTMLElement).innerText || '').trim()
		: ((p as HTMLElement).innerText || '').trim();
	return /^\d+\./.test(rawText) ? rawText : '';
}

/** Собирает сырой case без idx (проставляется в диспатчере по позиции в массиве). */
function finalize(question: string, candidates: ICandidate[]): QaCaseRaw | null {
	const variants: string[] = [];
	const answers: string[] = [];

	for (const { text, correct } of candidates) {
		const cleaned = cleanAnswer(text.replace(/\+$/, ''));
		if (!cleaned) continue;
		variants.push(cleaned);
		if (correct) answers.push(cleaned);
	}

	return variants.length && answers.length ? { question, variants, answers } : null;
}

// ─── 24forcare.com ───────────────────────────────────────────────────

/** 24forcare: `<h3>` + следующий `<p>`, правильные обёрнуты в `<strong>`. */
function extract24forcare2(div: HTMLElement): QaCaseRaw[] {
	const out: QaCaseRaw[] = [];

	for (const h3 of Array.from(div.querySelectorAll('h3'))) {
		const question = (h3.textContent || '').trim();
		if (!question) continue;

		const p = h3.nextElementSibling;
		if (!p || p.tagName !== 'P') continue;

		const candidates = splitBrLines(p.innerHTML).map<ICandidate>(line => ({
			text: line.text,
			correct: /<strong[\s>]/i.test(line.html),
		}));

		const result = finalize(question, candidates);
		if (result) out.push(result);
	}

	return out;
}

// ─── rosmedicinfo.ru ─────────────────────────────────────────────────

/** Case A: `<h3>` + `<p>` с `<span style="background:#fbeeb8">` на правильных. */
function extractRosmedH3Highlighted2(div: HTMLElement): QaCaseRaw[] {
	const out: QaCaseRaw[] = [];

	for (const h3 of Array.from(div.querySelectorAll('h3'))) {
		const question = (h3.textContent || '').trim();
		if (!question) continue;

		const p = h3.nextElementSibling;
		if (!p || p.tagName !== 'P') continue;

		const candidates = splitBrLines(p.innerHTML).map<ICandidate>(line => ({
			text: line.text,
			correct: /style\s*=\s*["'][^"']*(?:fbeeb8|background)/i.test(line.html),
		}));

		const result = finalize(question, candidates);
		if (result) out.push(result);
	}

	return out;
}

/** Case B: `<h3>` + `<p>` со строками через `<br>`, правильные с `+` в конце. */
function extractRosmedH3BrPlus2(div: HTMLElement): QaCaseRaw[] {
	const out: QaCaseRaw[] = [];

	for (const h3 of Array.from(div.querySelectorAll('h3'))) {
		const question = (h3.textContent || '').trim();
		if (!question) continue;

		const p = h3.nextElementSibling;
		if (!p || p.tagName !== 'P') continue;

		const candidates = splitBrLines(p.innerHTML).map<ICandidate>(line => ({
			text: line.text,
			correct: line.text.includes('+'),
		}));

		const result = finalize(question, candidates);
		if (result) out.push(result);
	}

	return out;
}

/** Case C: вопрос «N. ...» в `<p>`, следующий `<p>` содержит все варианты через `<br>`. */
function extractRosmedNumberedPInlineBr2(div: HTMLElement): QaCaseRaw[] {
	const out: QaCaseRaw[] = [];
	const allP = Array.from(div.querySelectorAll('p'));

	for (let i = 0; i < allP.length; i++) {
		const rawText = readNumberedQuestionText(allP[i]);
		if (!rawText) continue;

		const nextP = allP[i + 1];
		if (!nextP || !nextP.innerHTML.includes('<br')) continue;

		const question = rawText.replace(/^\d+\.\s*/, '').trim();
		const candidates = splitBrLines(nextP.innerHTML).map<ICandidate>(line => ({
			text: line.text,
			correct: line.text.includes('+'),
		}));

		const result = finalize(question, candidates);
		if (result) out.push(result);
	}

	return out;
}

/** Case D: вопрос «N. ...» + серия `<p>` с ответами (по одному на параграф). */
function extractRosmedNumberedPPerParagraph2(div: HTMLElement): QaCaseRaw[] {
	const out: QaCaseRaw[] = [];
	const allP = Array.from(div.querySelectorAll('p'));

	for (let i = 0; i < allP.length; i++) {
		const rawText = readNumberedQuestionText(allP[i]);
		if (!rawText) continue;

		const question = rawText.replace(/^\d+\.\s*/, '').trim();
		const candidates: ICandidate[] = [];

		for (let j = i + 1; j < allP.length; j++) {
			const nextP = allP[j];
			const nextText = ((nextP as HTMLElement).innerText || '').trim();
			if (/^\d+\.\s/.test(nextText)) break;               // следующий вопрос
			if (nextP.innerHTML.includes('<br')) continue;       // inline-br — это Case C
			if (!/^\d+\)/.test(nextText)) continue;              // не нумерованный вариант

			candidates.push({ text: nextText, correct: nextText.includes('+') });
		}

		const result = finalize(question, candidates);
		if (result) out.push(result);
	}

	return out;
}

// ─── Публичный диспатчер ─────────────────────────────────────────────

/**
 * Достаёт все вопросы из HTML-дерева источника.
 * @param source — ключ источника (24forcare / rosmedicinfo)
 * @param div    — распарсенный HTML-документ (результат `parseHtml(..., true)`)
 */
export function parseCases2(source: ISourceKey, div: HTMLElement): QaCase2[] {
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

/** Минимальная длина обоих операндов для срабатывания `includes` — отсекает шум на коротких вариантах. */
const MIN_INCLUDES_LEN = 10;
/** Порог Dice similarity для fuzzy-матча ВАРИАНТОВ (для вопроса используется `SIMILARITY_THRESHOLD`). */
const VARIANT_SIMILARITY_THRESHOLD = 0.85;

/** Все виды кавычек — убираем, чтобы «Критик» и "Критик" матчились одинаково. */
const QUOTE_RE = /[\u00AB\u00BB\u201C\u201D\u201E\u201F\u2018\u2019\u201A\u201B"']/g;

/** Нормализация для матчинга: dashes/homoglyphs/spaces/case + стрипаем кавычки. */
function normForMatch(s: string): string {
	return normalizeDashes(s).replace(QUOTE_RE, '');
}

export interface IParse2Result {
	/** Правильные варианты из ВХОДНЫХ `variants` (подмножество, не source-версия). */
	readonly answers: string[];
	/** 0..1 — уверенность матча: qScore × (доля входных вариантов, нашедших совпадение). */
	readonly score: number;
}

/** Возвращает score 0..1 матча вопросов или 0 если не похожи. */
function matchQuestion(stored: string, input: string): number {
	const a = normForMatch(stored);
	const b = normForMatch(input);
	if (a === b) return 1;

	const minLen = Math.min(a.length, b.length);
	if (minLen >= MIN_INCLUDES_LEN && (a.includes(b) || b.includes(a))) {
		return minLen / Math.max(a.length, b.length);
	}

	const s = similarity(a, b);
	return s > SIMILARITY_THRESHOLD ? s : 0;
}

/** Пара вариантов «похожи достаточно для матча»: exact → includes (≥10 симв.) → similarity. */
function variantMatches(stored: string, input: string): boolean {
	const a = normForMatch(stored);
	const b = normForMatch(input);
	if (a === b) return true;
	if (Math.min(a.length, b.length) >= MIN_INCLUDES_LEN && (a.includes(b) || b.includes(a))) return true;
	return similarity(a, b) > VARIANT_SIMILARITY_THRESHOLD;
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
export function parse2(model: QaCase2[], question: string, variants: string[]): IParse2Result | null {
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
