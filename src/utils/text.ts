/**
 * Нормализация текста для сравнения.
 * @module utils/text
 */

/**
 * Очищает тему от суффиксов (год, «Контрольное...»).
 */
export function cleanTopic(topic: string | null): string | null {
	if (!topic) return null;
	return topic
		.replace(/\s*-\s*\d{4}.*$/, '')
		.replace(/\s*-\s*Контрольное.*$/i, '')
		.trim();
}

/** Регулярка для всех Unicode-тире и дефисов */
const DASH_RE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u00AD\uFE58\uFE63\uFF0D]/g;

/**
 * Нормализует текст для поиска: тире → дефис, пробелы, кириллица-двойники → латиница, lowercase.
 * Используется для сравнения текста вопроса с заголовками на сайтах-источниках.
 */
export function normalizeDashes(s: string): string {
	return s
		.replace(DASH_RE, '-')
		.replace(/\s+/g, ' ')
		.replace(/\u0410/gi, 'a').replace(/\u0415/gi, 'e')
		.replace(/\u041E/gi, 'o').replace(/\u0420/gi, 'p')
		.replace(/\u0421/gi, 'c').replace(/\u0425/gi, 'x')
		.trim()
		.toLowerCase();
}

/**
 * Нормализует строку для точного сравнения вариантов ответов.
 * Сохраняет регистр кириллических символов перед заменой на латинские аналоги.
 */
/**
 * Bigram similarity (Dice coefficient).
 * Возвращает 0..1 — насколько похожи две строки.
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

export function normalizeText(s: string): string {
	return s
		.replace(DASH_RE, '-')
		.replace(/\s+/g, ' ')
		.replace(/\u0410/g, 'A').replace(/\u0430/g, 'a')
		.replace(/\u0415/g, 'E').replace(/\u0435/g, 'e')
		.replace(/\u041E/g, 'O').replace(/\u043E/g, 'o')
		.replace(/\u0420/g, 'P').replace(/\u0440/g, 'p')
		.replace(/\u0421/g, 'C').replace(/\u0441/g, 'c')
		.replace(/\u0425/g, 'X').replace(/\u0445/g, 'x')
		.trim()
		.toLowerCase();
}
