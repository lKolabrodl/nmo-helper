import { SELECTORS } from '../utils/constants';

type SelectorKey = keyof typeof SELECTORS;

/**
 * Находит первый элемент по fallback-цепочке селекторов для заданного ключа.
 *
 * Идёт по {@link SELECTORS}[key] по порядку и возвращает первый найденный
 * элемент. Порядок важен: более специфичные селекторы ставятся раньше общих,
 * чтобы на старой вёрстке не зацепить чужой элемент по широкому правилу.
 *
 * @param key  Ключ из {@link SELECTORS}.
 * @param root Корень поиска. По умолчанию — весь `document`.
 * @returns Первый подошедший элемент или `null`, если ни один селектор не сработал.
 */
function queryFirst<T extends Element = HTMLElement>(key: SelectorKey, root: ParentNode = document): T | null {
	for (const sel of SELECTORS[key]) {
		const el = root.querySelector<T>(sel);
		if (el) return el;
	}
	return null;
}

/**
 * Находит все элементы по первому сработавшему селектору из fallback-цепочки.
 *
 * Важно: НЕ объединяет результаты всех селекторов — как только первый даёт
 * непустой набор, поиск прекращается. Это нужно, чтобы не смешивать элементы
 * из разных версий вёрстки (например, старые radio-контейнеры + новые).
 *
 * @param key  Ключ из {@link SELECTORS}.
 * @param root Корень поиска. По умолчанию — весь `document`.
 * @returns Массив элементов (возможно пустой).
 */
function queryAll<T extends Element = HTMLElement>(key: SelectorKey, root: ParentNode = document): T[] {
	for (const sel of SELECTORS[key]) {
		const els = root.querySelectorAll<T>(sel);
		if (els.length) return Array.from(els);
	}
	return [];
}

// ─── Публичные геттеры ───────────────────────────────────────────────

/**
 * Заголовочный элемент темы теста (например, «Кардиология»).
 *
 * Используется в двух местах: показ темы в панели и передача темы в
 * system-prompt AI. Текст из него достаётся отдельно через {@link cleanTopic}
 * в `utils/text.ts`.
 *
 * @returns DOM-элемент заголовка или `null`, если пользователь ещё не открыл тест.
 */
export function getTopicElement(): HTMLElement | null {
	return queryFirst('topic');
}

/**
 * Корневой контейнер текущего вопроса (`#questionAnchor`).
 *
 * Служит «якорем» для остальных геттеров — текст, варианты, тип вопроса
 * ищутся уже внутри него, чтобы не задеть старый вопрос при переходе вперёд.
 *
 * @returns DOM-контейнер текущего вопроса или `null`, если на странице нет активного вопроса.
 */
export function getQuestionAnchor(): HTMLElement | null {
	return queryFirst('questionAnchor');
}

/**
 * Чистый текст текущего вопроса (с обрезанными пробелами по краям).
 *
 * Именно этот текст уходит в поиск на сайтах-источниках и в AI-промпт.
 * HTML-разметка (жирное, списки) теряется — это ок, парсеры и AI с ней не работают.
 *
 * @returns Текст вопроса или `null`, если нет активного вопроса / не нашёлся блок текста.
 */
export function getQuestionText(): string | null {
	const anchor = getQuestionAnchor();
	if (!anchor) return null;
	return queryFirst('questionText', anchor)?.textContent?.trim() ?? null;
}

/**
 * Сырой `innerHTML` блока вопроса (с сохранённой разметкой).
 *
 * Нужен только для баг-репортов — чтобы на сервере можно было отладить,
 * почему парсер не нашёл ответ: иногда дело в вложенных списках или
 * спецсимволах, которые `textContent` проглатывает.
 *
 * @returns Сырой HTML-фрагмент или `null`, если блока вопроса нет.
 */
export function getQuestionHtml(): string | null {
	const anchor = getQuestionAnchor();
	if (!anchor) return null;
	const el = queryFirst('questionText', anchor);
	return el?.innerHTML ?? null;
}

/**
 * DOM-элементы всех вариантов ответа для текущего вопроса.
 *
 * Возвращает `HTMLElement[]` — на них потом навешивается подсветка правильных
 * ответов (`style.backgroundColor`).
 *
 * @returns Массив элементов вариантов. Пустой — если нет активного вопроса.
 */
export function getVariantElements(): HTMLElement[] {
	const anchor = getQuestionAnchor();
	if (!anchor) return [];
	return queryAll('variant', anchor);
}

/**
 * Тексты вариантов ответов, с обрезанными пробелами.
 *
 * Порядок сохраняется — i-й элемент массива соответствует i-му варианту в UI.
 * Это критично: AI возвращает индексы, которые потом мапятся обратно на DOM
 * через {@link getVariantElements} в том же порядке.
 *
 * @returns Массив текстов вариантов в порядке отображения.
 */
export function getVariantTexts(): string[] {
	return getVariantElements().map(el => el.innerText.trim());
}

/**
 * Одиночный вопрос или множественный выбор.
 *
 * Определяется по наличию radio-инпута в блоке вопроса: если есть — один ответ,
 * иначе — checkbox, несколько. Результат влияет на формулировку AI-промпта
 * (одна цифра vs несколько через запятую) и на логику сопоставления ответов.
 *
 * @returns `true` — ровно один правильный ответ; `false` — допускается несколько (или нет активного вопроса).
 */
export function isSingleAnswer(): boolean {
	const anchor = getQuestionAnchor();
	return !!anchor && !!queryFirst('radioInput', anchor);
}

/**
 * Нативный radio/checkbox input для DOM-элемента варианта.
 *
 * В Material-разметке текст варианта лежит внутри label, а input — соседним
 * элементом в `.mdc-form-field`. Этот helper инкапсулирует обход разметки,
 * чтобы loader'ы не дублировали селекторы.
 */
export function getAnswerInput(variantElement: HTMLElement): HTMLInputElement | null {
	const field = variantElement.closest<HTMLElement>('.mdc-form-field');
	const fieldInput = field ? queryFirst<HTMLInputElement>('answerInput', field) : null;
	if (fieldInput) return fieldInput;

	const label = variantElement.closest<HTMLLabelElement>('label');
	if (label?.htmlFor) {
		const input = document.getElementById(label.htmlFor);
		if (isAnswerInput(input)) return input;
	}

	const root = variantElement.closest<HTMLElement>(
		'mat-radio-button, mat-checkbox, mat-list-item, .radio-button_answer, .checkbox-button_answer'
	);
	return root ? queryFirst<HTMLInputElement>('answerInput', root) : null;
}

/**
 * Лучший кликабельный элемент для выбора варианта.
 */
export function getAnswerClickTarget(variantElement: HTMLElement): HTMLElement {
	const field = variantElement.closest<HTMLElement>('.mdc-form-field');
	const input = getAnswerInput(variantElement);
	return input?.labels?.[0]
		?? field?.querySelector<HTMLElement>('label')
		?? (field ? queryFirst<HTMLElement>('answerTouchTarget', field) : null)
		?? input
		?? variantElement;
}

/**
 * Кнопка перехода после ответа: «Следующий вопрос» или финальная «Завершить тестирование».
 */
export function getNextQuestionButton(): HTMLButtonElement | null {
	return queryAll<HTMLButtonElement>('nextQuestionButton')
		.find(isQuestionForwardButton) ?? null;
}

/**
 * Блок действий теста рядом с кнопкой «Завершить тестирование».
 */
export function getQuizActionsElement(): HTMLElement | null {
	const finishButton = getFinishQuizButton();
	return finishButton?.closest<HTMLElement>('mat-card-actions, .mat-mdc-card-actions, .mdc-card__actions')
		?? queryFirst('quizActions');
}

/**
 * Кнопка «Завершить тестирование».
 */
export function getFinishQuizButton(root: ParentNode = document): HTMLButtonElement | null {
	return queryAll<HTMLButtonElement>('finishQuizButton', root)
		.find(isFinishQuizButton) ?? null;
}

/**
 * Кнопка «Да» в модалке подтверждения завершения тестирования.
 */
export function getFinishQuizConfirmButton(root: ParentNode = document): HTMLButtonElement | null {
	return queryAll<HTMLButtonElement>('finishQuizConfirmButton', root)
		.find(isFinishQuizConfirmButton) ?? null;
}

function isAnswerInput(element: HTMLElement | null): element is HTMLInputElement {
	return element instanceof HTMLInputElement && (element.type === 'radio' || element.type === 'checkbox');
}

function isNextQuestionButton(button: HTMLButtonElement): boolean {
	const text = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
	if (text.includes('следующий вопрос')) return true;
	return !!button.querySelector('[svgicon="arrow-right"]');
}

function isQuestionForwardButton(button: HTMLButtonElement): boolean {
	return isNextQuestionButton(button) || isQuestionFinishButton(button);
}

function isQuestionFinishButton(button: HTMLButtonElement): boolean {
	const text = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
	return text.includes('завершить тестирование')
		&& !!button.closest('.question-buttons');
}

function isFinishQuizButton(button: HTMLButtonElement): boolean {
	const text = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
	if (text.includes('завершить тестирование')) return true;
	return button.classList.contains('quiz-buttons-primary')
		&& !!button.closest('mat-card-actions, .mat-mdc-card-actions, .mdc-card__actions');
}

function isFinishQuizConfirmButton(button: HTMLButtonElement): boolean {
	const text = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
	if (text !== 'да') return false;

	const dialog = button.closest<HTMLElement>('lib-quiz-finishing-confirm-dialog, .mat-mdc-dialog-surface');
	const dialogText = dialog?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';

	return dialogText.includes('выйти из тестирования');
}
