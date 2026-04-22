import type { ISourceKey } from '../types';
import { normalizeDashes, stripQuotes } from './text';
import { SIMILARITY_THRESHOLD } from './constants';

/**
 * Определяет, к какому из поддерживаемых сайтов-источников относится URL.
 *
 * @param url Любой URL (обычно активная вкладка пользователя).
 * @returns Ключ источника или `null`, если домен не поддерживается.
 */
export function detectSource(url: string): ISourceKey | null {
	if (url.includes('24forcare.com')) return '24forcare';
	if (url.includes('rosmedicinfo.ru')) return 'rosmedicinfo';
	return null;
}

/**
 * Коэффициент Дайса (Dice similarity) на биграммах — насколько похожи две
 * строки независимо от общей длины.
 *
 * Формула: `2·|A ∩ B| / (|A| + |B|)`, где `|A|`, `|B|` — число биграмм
 * (пар соседних символов) в каждой строке, `|A ∩ B|` — пересечение
 * с учётом кратности. На практике устойчив к опечаткам, перестановкам
 * слов, лишним символам лучше, чем Levenshtein по длине.
 *
 * Крайние случаи:
 *  - `a === b` → `1` (ранний выход; корректно обрабатывает и строки длиной 1).
 *  - Если хотя бы одна короче 2 символов и они не равны → `0` (биграмм нет).
 *  - Пустая строка vs непустая → `0`.
 *
 * @param a Первая строка (обычно уже нормализованная через `normalizeDashes`).
 * @param b Вторая строка.
 * @returns Число в диапазоне `[0, 1]`, где `1` — идентичны, `0` — общих биграмм нет.
 */
export function similarity(a: string, b: string): number {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;

	const bigrams = (s: string) => {
		const map = new Map<string, number>();
		for (let i = 0; i < s.length - 1; i++) {
			const pair = s.slice(i, i + 2);
			map.set(pair, (map.get(pair) || 0) + 1);
		}
		return map;
	};

	const a2 = bigrams(a), b2 = bigrams(b);
	let matches = 0;
	for (const [pair, count] of a2) {
		matches += Math.min(count, b2.get(pair) || 0);
	}
	return (2 * matches) / (a.length + b.length - 2);
}

/** Минимальная длина обоих операндов для срабатывания `includes` — отсекает шум на коротких вариантах. */
const MIN_INCLUDES_LEN = 10;

/** Нормализация для матчинга: dashes/homoglyphs/spaces/case + стрипаем кавычки. */
function normForMatch(s: string): string {
	return stripQuotes(normalizeDashes(s));
}

/**
 * Сравнивает два текста ВОПРОСА и возвращает score 0..1, где
 * `0` — не похожи достаточно, `1` — полное совпадение после нормализации.
 *
 * Три уровня по возрастающей «слабости»:
 *  1. Точное равенство после {@link normForMatch} → `1`.
 *  2. Одна строка — префикс/подстрока другой при длине ≥ {@link MIN_INCLUDES_LEN}.
 *     Score = `minLen / maxLen` (отражает, насколько «меньшая» строка целиком
 *     покрывает «большую»).
 *  3. Dice similarity ≥ {@link SIMILARITY_THRESHOLD} → возвращаем сам score.
 *
 * Порог `MIN_INCLUDES_LEN` нужен, чтобы короткие совпадения («да», «нет»)
 * не триггерили includes-ветку.
 *
 * @param stored Вопрос из модели источника.
 * @param input  Текущий вопрос пользователя.
 * @returns `0..1` — score матча.
 */
export function matchQuestion(stored: string, input: string): number {
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

/**
 * Непрерывный score похожести двух ВАРИАНТОВ ответа в диапазоне `[0, 1]`.
 *
 * Каскад по возрастающей «слабости»:
 *  1. Равенство после {@link normForMatch} → `1`.
 *  2. Одна — подстрока другой при длине обеих ≥ {@link MIN_INCLUDES_LEN} → `1`
 *     (включение семантически = «тот же вариант, возможно усечённый»).
 *  3. Dice similarity → само значение `0..1`.
 *
 * БЕЗ внутреннего порога: решение «это матч или нет» принимает вызывающий
 * в рамках top-1 assignment (см. `findAnswers`), где лучший кандидат
 * выбирается из всех, а не по порогу. Это устраняет false-positive'ы от
 * длинного общего префикса («катепсина К» vs «катепсина А», Dice ≈ 0.9) —
 * настоящий совпадающий вариант всегда даёт 1.0 и выигрывает.
 *
 * @param stored Вариант из модели источника.
 * @param input  Вариант, показанный пользователю на НМО.
 * @returns `0..1` — score похожести.
 */
export function variantScore(stored: string, input: string): number {
	const a = normForMatch(stored);
	const b = normForMatch(input);
	if (a === b) return 1;
	if (Math.min(a.length, b.length) >= MIN_INCLUDES_LEN && (a.includes(b) || b.includes(a))) return 1;
	return similarity(a, b);
}
