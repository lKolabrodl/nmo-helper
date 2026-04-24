/**
 * Case-extractor'ы: достают `{ question, variants, answers }` из разных
 * DOM-раскладок сайтов-источников.
 *
 * Каждый extractor знает ровно одну раскладку и на чужой либо вернёт `[]`,
 * либо наберёт мусор — рассчитывать на «универсальный» код не надо.
 * Диспатчер (`extractCases`) прогоняет все relevant extractor'ы
 * для выбранного источника и склеивает результаты, после чего matcher
 * разбирается, какой case лучше всего совпадает с входным вопросом.
 *
 * Почему несколько extractor'ов на один сайт (rosmedicinfo): вёрстка
 * одного и того же контента на разных страницах отличается — где-то
 * правильный ответ подсвечен `<span style="background">`, где-то помечен
 * плюсом в конце строки, где-то вопросы пронумерованы и идут в отдельных
 * параграфах. Каждый кейс — отдельная функция, чтобы не плодить ветвления.
 *
 * @module utils/extractors
 */

import { cleanAnswer } from './text';

/**
 * Сырой результат extractor'а — один `case` без порядкового индекса.
 * Индекс проставляется диспатчером по позиции в итоговом массиве.
 */
export interface QaCaseRaw {
	/** Текст вопроса как он лежит в DOM источника (без нумерации вида «N.»). */
	readonly question: string;
	/** Все варианты ответа в порядке появления, уже прочищенные через {@link cleanAnswer}. */
	readonly variants: string[];
	/** Подмножество `variants`, помеченное источником как правильное. */
	readonly answers: string[];
}

/** Пара «plain-text + исходный HTML» для одной `<br>`-строки — см. {@link splitBrLines}. */
interface RawLine {
	readonly text: string;
	readonly html: string;
}

//──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────── 24forcare.com ───────────────────────────────────────────────
//──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * 24forcare — Case A: вопрос лежит в `<h3>`, варианты идут в следующем `<p>`
 * отдельными строками через `<br>`, правильные обёрнуты в `<strong>`.
 *
 * Пример раскладки:
 * ```html
 * <h3>Что такое ЭКГ?</h3>
 * <p>
 *   вариант 1<br>
 *   <strong>вариант 2</strong><br>
 *   вариант 3
 * </p>
 * ```
 *
 * Сигнал правильного ответа — наличие тега `<strong>` в исходном HTML
 * строки. Проверяется по raw HTML (а не по тексту), потому что сам
 * `innerText` тегов не содержит.
 *
 * @param div Распаршенный HTML источника (результат `parseHtml(..., true)`).
 * @returns Массив case'ов. Пустой — если на странице нет вопросов нужной формы.
 */
export function extract24forcare(div: HTMLElement): QaCaseRaw[] {
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

/**
 * 24forcare — Case B: вопрос вида «N. ...» лежит в `<p><strong>...</strong></p>`,
 * следующий `<p>` содержит ВСЕ варианты через `<br>`, правильные помечены
 * текстовым `+` в конце строки (часто также обёрнуты в `<strong>`,
 * но детектим по `+` — это более стабильный текстовый маркер).
 *
 * Пример раскладки:
 * ```html
 * <p><strong>1. Вопрос?</strong></p>
 * <p>
 *   <strong>1) первый;+</strong><br>
 *   2) второй;<br>
 *   3) третий.
 * </p>
 * ```
 *
 * Структурно идентичен {@link extractRosmedNumberedPInlineBr} — отличается
 * только тегом-обёрткой нумерованного заголовка (`<strong>` vs `<b>`),
 * это покрыто расширением {@link readNumberedQuestionText}.
 *
 * Хвостовой `+` снимается в {@link finalize} через
 * `text.replace(/\+$/, '')` перед `cleanAnswer`.
 *
 * @param div Распарсенный HTML источника.
 * @returns Массив case'ов.
 */
export function extract24forcareNumberedPPlus(div: HTMLElement): QaCaseRaw[] {
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

//──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//───────────────────────────────────────────────── rosmedicinfo.ru ────────────────────────────────────────────────
//──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * rosmedicinfo — Case A: вопрос в `<h3>` + `<p>` со строками через `<br>`,
 * правильные варианты выделены цветом фона через inline-style
 * (типично `background:#fbeeb8` — жёлтая подсветка).
 *
 * Пример:
 * ```html
 * <h3>Вопрос?</h3>
 * <p>
 *   неверный<br>
 *   <span style="background:#fbeeb8">правильный</span><br>
 *   ещё один
 * </p>
 * ```
 *
 * Сигнал правильного ответа — regex по `style="..."` с любым упоминанием
 * `fbeeb8` или `background`. Покрывает вариации: `background-color`,
 * другие hex-цвета, одинарные/двойные кавычки.
 *
 * @param div Распарсенный HTML источника.
 * @returns Массив case'ов.
 */
export function extractRosmedH3Highlighted(div: HTMLElement): QaCaseRaw[] {
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

/**
 * rosmedicinfo — Case B: вопрос в `<h3>` + `<p>` со строками через `<br>`,
 * правильные помечены текстовым `+` в конце строки.
 *
 * Пример:
 * ```html
 * <h3>Вопрос?</h3>
 * <p>
 *   неверный<br>
 *   правильный +<br>
 *   ещё один
 * </p>
 * ```
 *
 * Сам `+` из текста варианта потом снимается в {@link finalize} через
 * `text.replace(/\+$/, '')` перед передачей в `cleanAnswer`.
 *
 * @param div Распарсенный HTML источника.
 * @returns Массив case'ов.
 */
export function extractRosmedH3BrPlus(div: HTMLElement): QaCaseRaw[] {
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

/**
 * rosmedicinfo — Case C: вопрос вида «N. ...» лежит в отдельном `<p>`,
 * СЛЕДУЮЩИЙ `<p>` содержит ВСЕ варианты через `<br>`, правильные с `+`.
 *
 * Пример:
 * ```html
 * <p><b>12. Вопрос?</b></p>
 * <p>
 *   1) неверный<br>
 *   2) правильный +<br>
 *   3) ещё один
 * </p>
 * ```
 *
 * Заголовок вопроса детектится по regex `^\d+\.` в `<b>` или в самом
 * `<p>` (см. {@link readNumberedQuestionText}). Префикс «N. » снимается
 * перед тем, как отдать текст дальше.
 *
 * Отличие от Case D — здесь все варианты живут в одном `<p>`, разделённые
 * `<br>`. В D — каждый вариант в своём `<p>`.
 *
 * @param div Распарсенный HTML источника.
 * @returns Массив case'ов.
 */
export function extractRosmedNumberedPInlineBr(div: HTMLElement): QaCaseRaw[] {
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

/**
 * rosmedicinfo — Case D: вопрос вида «N. ...» в `<p>`, далее серия
 * отдельных `<p>` — по одному варианту в каждом. Правильные с `+`.
 *
 * Пример:
 * ```html
 * <p><b>12. Вопрос?</b></p>
 * <p>1) неверный</p>
 * <p>2) правильный +</p>
 * <p>3) ещё один</p>
 * <p><b>13. Следующий?</b></p>
 * ```
 *
 * Сбор вариантов идёт вперёд от текущего вопроса и прерывается:
 *  - на следующем вопросе (`\d+\. ` в начале);
 *  - на параграфе с `<br>` внутри (это Case C, не наш — пропустить case);
 *  - строки, не начинающиеся с `N)`, игнорируются.
 *
 * Из-за последнего правила extractor молча проглатывает «битые» варианты
 * без нумерации — это ок: matcher всё равно отфильтрует слабые case'ы
 * по overlap.
 *
 * @param div Распарсенный HTML источника.
 * @returns Массив case'ов.
 */
export function extractRosmedNumberedPPerParagraph(div: HTMLElement): QaCaseRaw[] {
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


//──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//─────────────────────────────────────────────────── Общие хелперы ────────────────────────────────────────────────
//──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Внутренняя модель одного кандидата до финализации. `correct` ставит
 * extractor на своём характерном сигнале (strong/span-highlight/«+»).
 */
interface ICandidate {
	readonly text: string;
	readonly correct: boolean;
}

/**
 * Разбивает HTML-фрагмент по тегу `<br>` (с учётом вариаций `<br/>`,
 * `<br />`, `<BR>`) и возвращает пары `{text, html}` для каждой строки.
 *
 * Текст получается через временный `<span>` + `innerText`, чтобы
 * корректно отработать вложенную разметку (`<strong>`, `<em>`, `<span>`)
 * и сущности (`&nbsp;`, `&amp;`). HTML-фрагмент сохраняется отдельно,
 * чтобы extractor'ы могли проверить наличие конкретных тегов/атрибутов
 * (например, `<strong>` или `style="background"`).
 *
 * Пустые строки (после trim) выкидываются.
 *
 * @param html `innerHTML` контейнера, внутри которого варианты разделены `<br>`.
 * @returns Массив пар `{text, html}`, по одной на непустую строку.
 */
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

/**
 * Достаёт текст заголовка вопроса формата «N. …» из `<p>`-элемента.
 *
 * Сначала смотрит в `<b>`/`<strong>` внутри параграфа (rosmedicinfo
 * оборачивает нумерацию в `<b>`, 24forcare — в `<strong>`), если ни того
 * ни другого нет — берёт `innerText` всего параграфа. Результат
 * возвращается, только если начинается с `<цифры>.` — иначе это обычный
 * текст, не заголовок, и функция вернёт пустую строку.
 *
 * Префикс «N. » НЕ снимается здесь — это делает вызывающий,
 * прогоняя результат через `replace` по регулярке вида «начало строки
 * + цифры + точка + пробелы».
 *
 * @param p Кандидатный `<p>`-элемент.
 * @returns Нумерованный текст вопроса или `''`, если формат не подходит.
 */
function readNumberedQuestionText(p: Element): string {
	const firstBold = p.querySelector('b, strong');
	const rawText = firstBold
		? ((firstBold as HTMLElement).innerText || '').trim()
		: ((p as HTMLElement).innerText || '').trim();
	return /^\d+\./.test(rawText) ? rawText : '';
}

/**
 * Собирает из списка кандидатов финальный `QaCaseRaw`. Прогоняет каждый
 * текст через {@link cleanAnswer} (снимает мусор типа `&nbsp;`, хвостовых
 * `.;+`, ведущей нумерации `N)`). Пустые после чистки — выкидывает.
 *
 * Возвращает `null`, если после чистки не осталось вариантов ИЛИ
 * не осталось правильных — такой case бесполезен для matcher'а.
 *
 * `text.replace(/\+$/, '')` перед `cleanAnswer` — снимает маркер-«плюс»
 * из конца строки (используется в Case B/C/D rosmedicinfo).
 *
 * @param question Текст вопроса (уже без префикса «N. »).
 * @param candidates Кандидаты от extractor'а с проставленным `correct`.
 * @returns Готовый case или `null`, если набор пустой.
 */
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
