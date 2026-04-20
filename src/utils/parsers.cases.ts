/**
 * Case-extractor'ы для парсеров ответов.
 *
 * Каждая функция распознаёт один конкретный вариант вёрстки на странице
 * источника и возвращает список пар «вопрос → правильные ответы». Все
 * extractor'ы независимы — запускаются параллельно в `parsers.ts`,
 * дубликаты фильтруются на этапе matching'а.
 *
 * Добавить новый случай: написать extractor, вернуть `QaPair[]`,
 * подключить в `parsers.ts`. Покрыть тестом в `parsers.test.ts`.
 *
 * @module utils/parsers.cases
 */

export interface QaPair {
	readonly question: string;
	readonly answers: string[];
}

// ─── Общие хелперы ───────────────────────────────────────────────────

/**
 * Очищает текст ответа от мусора:
 * - любые пробельные серии (включая \n, \t, nbsp) → один пробел;
 * - завершающие `;+.`;
 * - ведущая нумерация `N)`.
 *
 * Схлопывание пробелов важно потому что в jsdom-тестах `innerText`
 * замещается `textContent` и не нормализует whitespace как реальный
 * браузер. Страхуемся и на проде — страницы источников иногда
 * содержат `&nbsp;` / отступы посреди ответа.
 */
export function cleanAnswer(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.replace(/[\s;+.]+$/, '')
		.replace(/^\d+\)\s*/, '')
		.trim();
}

/**
 * Достаёт правильные ответы из HTML-фрагмента: разбивает по `<br>`,
 * оставляет строки с `+` (маркер правильного ответа на rosmed).
 */
export function extractPlusLinesFromHtml(html: string): string[] {
	const out: string[] = [];
	for (const line of html.split(/<br\s*\/?>/i)) {
		if (!line.includes('+')) continue;
		const tmp = document.createElement('span');
		tmp.innerHTML = line;
		const text = (tmp.innerText || tmp.textContent || '').trim();
		const cleaned = cleanAnswer(text.replace(/\+$/, ''));
		if (cleaned) out.push(cleaned);
	}
	return out;
}

/**
 * Если `<p>` начинается с «N.» (в `<b>` или без) — возвращает raw-текст
 * с ведущей нумерацией. Иначе `''`. Используется для детекта вопроса.
 */
function readNumberedQuestionText(p: Element): string {
	const firstBold = p.querySelector('b');
	const rawText = firstBold
		? ((firstBold as HTMLElement).innerText || '').trim()
		: ((p as HTMLElement).innerText || '').trim();
	return /^\d+\./.test(rawText) ? rawText : '';
}

// ─── 24forcare.com ───────────────────────────────────────────────────

/**
 * 24forcare: вопрос в `<h3>`, правильные ответы — `<strong>` в следующем `<p>`.
 */
export function extract24forcare(div: HTMLElement): QaPair[] {
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

// ─── rosmedicinfo.ru ─────────────────────────────────────────────────

/**
 * Case A: вопрос в `<h3>`, ответы — `<span>` с жёлтым фоном (#fbeeb8) в
 * следующем `<p>`. Старый стиль на rosmedicinfo.
 */
export function extractRosmedH3Highlighted(div: HTMLElement): QaPair[] {
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
 * Case B: вопрос в `<h3>`, ответы — строки с `+` в конце, разделённые `<br>`
 * в следующем `<p>`. Встречается на более новых страницах где жёлтой
 * подсветки уже нет, вместо неё правильные помечают `<b>` и `+`.
 */
export function extractRosmedH3BrPlus(div: HTMLElement): QaPair[] {
	const pairs: QaPair[] = [];

	for (const h3 of Array.from(div.querySelectorAll('h3'))) {
		const question = (h3.textContent || '').trim();
		if (!question) continue;

		const p = h3.nextElementSibling;
		if (!p || p.tagName !== 'P') continue;

		const answers = extractPlusLinesFromHtml(p.innerHTML);
		if (answers.length) pairs.push({ question, answers });
	}

	return pairs;
}

/**
 * Case C: вопрос — «N. ...» в любом `<p>` (обычно в `<b>`). Все ответы
 * в одном следующем `<p>`, разделены `<br>`, правильные с `+`.
 * Исторически самая частая разметка.
 */
export function extractRosmedNumberedPInlineBr(div: HTMLElement): QaPair[] {
	const pairs: QaPair[] = [];
	const allP = Array.from(div.querySelectorAll('p'));

	for (let i = 0; i < allP.length; i++) {
		const p = allP[i];
		const rawText = readNumberedQuestionText(p);
		if (!rawText) continue;

		const nextP = allP[i + 1];
		if (!nextP || !nextP.innerHTML.includes('<br')) continue;

		const question = rawText.replace(/^\d+\.\s*/, '').trim();
		const answers = extractPlusLinesFromHtml(nextP.innerHTML);
		if (answers.length) pairs.push({ question, answers });
	}

	return pairs;
}

/**
 * Case D: вопрос — «N. ...» в любом `<p>` (обычно в `<b>`). Ответы
 * идут серией последовательных `<p>` (по одному ответу на параграф).
 * Правильные помечены `+` в конце и/или `<b>`. Скан останавливается
 * на следующем вопросе.
 */
export function extractRosmedNumberedPPerParagraph(div: HTMLElement): QaPair[] {
	const pairs: QaPair[] = [];
	const allP = Array.from(div.querySelectorAll('p'));

	for (let i = 0; i < allP.length; i++) {
		const p = allP[i];
		const rawText = readNumberedQuestionText(p);
		if (!rawText) continue;

		const question = rawText.replace(/^\d+\.\s*/, '').trim();
		const answers: string[] = [];

		for (let j = i + 1; j < allP.length; j++) {
			const nextP = allP[j];
			const nextText = ((nextP as HTMLElement).innerText || '').trim();
			if (/^\d+\.\s/.test(nextText)) break; // следующий вопрос
			if (nextP.innerHTML.includes('<br')) continue; // inline-br — это Case C
			if (!/^\d+\)/.test(nextText) && !nextText.includes('+')) continue;

			answers.push(...extractPlusLinesFromHtml(nextP.innerHTML));
		}

		if (answers.length) pairs.push({ question, answers });
	}

	return pairs;
}
