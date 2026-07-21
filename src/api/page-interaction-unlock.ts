/**
 * Снимает клиентские запреты страницы НМО на выделение текста, контекстное
 * меню и стандартные команды копирования/вырезания.
 *
 * Модуль не эмулирует действия пользователя и не вызывает `preventDefault`:
 * он останавливает только обработчики страницы, после чего браузер выполняет
 * своё стандартное действие. Элементы панели `#nmo-panel` исключены из этой
 * обработки, чтобы расширение не вмешивалось в собственный интерфейс.
 *
 * @module api/page-interaction-unlock
 */

/** ID элемента `<style>`, включающего выделение текста вне панели расширения. */
const STYLE_ID = 'nmo-page-interaction-unlock-style';

/** Ключ runtime-флага, защищающего от повторной регистрации обработчиков. */
const INIT_FLAG = '__nmoPageInteractionUnlock';

/** Окно страницы с необязательным флагом инициализации разблокировки. */
type WindowWithUnlockFlag = Window & {
	/** `true`, когда стили и event-listener'ы уже установлены. */
	__nmoPageInteractionUnlock?: boolean;
};

/**
 * Однократно включает стандартные взаимодействия браузера на странице НМО.
 *
 * Функция добавляет CSS для `user-select: text` и capture-обработчики событий
 * `contextmenu`, `copy`, `cut`, `keydown`, `keypress` и `keyup`. Повторные
 * вызовы безопасны: флаг хранится непосредственно в `window` страницы.
 *
 * @returns Ничего.
 */
export function unlockPageInteractions(): void {
	const win = window as WindowWithUnlockFlag;
	if (win[INIT_FLAG]) return;
	win[INIT_FLAG] = true;

	injectSelectionStyle();

	document.addEventListener('contextmenu', stopPageHandler, {capture: true});
	document.addEventListener('copy', stopPageHandler, {capture: true});
	document.addEventListener('cut', stopPageHandler, {capture: true});
	document.addEventListener('keydown', stopCopyShortcutHandler, {capture: true});
	document.addEventListener('keypress', stopCopyShortcutHandler, {capture: true});
	document.addEventListener('keyup', stopCopyShortcutHandler, {capture: true});
}

/**
 * Не позволяет обработчикам страницы перехватить контекстное меню, копирование
 * или вырезание, сохраняя стандартное действие браузера.
 *
 * @param event Событие `contextmenu`, `copy` или `cut` на этапе capture.
 */
function stopPageHandler(event: Event): void {
	if (isInsidePanel(event.target)) return;

	event.stopImmediatePropagation();
}

/**
 * Останавливает обработчики страницы только для поддерживаемых клавиатурных
 * комбинаций копирования и вырезания.
 *
 * @param event Клавиатурное событие на этапе capture.
 */
function stopCopyShortcutHandler(event: KeyboardEvent): void {
	if (isInsidePanel(event.target)) return;
	if (!isCopyShortcut(event)) return;

	event.stopImmediatePropagation();
}

/**
 * Определяет сочетание Ctrl/Command с `C`, `X` или `Insert`.
 *
 * @param event Клавиатурное событие.
 * @returns `true`, если событие соответствует копированию или вырезанию.
 */
function isCopyShortcut(event: KeyboardEvent): boolean {
	const key = event.key.toLowerCase();
	return (event.ctrlKey || event.metaKey) && (key === 'c' || key === 'x' || key === 'insert');
}

/**
 * Проверяет, принадлежит ли источник события панели NMO Helper.
 *
 * @param target Исходный `EventTarget`; может отсутствовать или не быть DOM-элементом.
 * @returns `true` для `#nmo-panel` и любого его потомка.
 */
function isInsidePanel(target: EventTarget | null): boolean {
	return target instanceof Element && !!target.closest('#nmo-panel');
}

/**
 * Добавляет идемпотентный CSS override, разрешающий выделение текста и touch-callout.
 *
 * Стиль применяется только вне `#nmo-panel`. Если `<head>` ещё не создан
 * (`document_start`), элемент добавляется в `document.documentElement`.
 */
function injectSelectionStyle(): void {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
		body :not(#nmo-panel):not(#nmo-panel *) {
			-webkit-user-select: text !important;
			user-select: text !important;
			-webkit-touch-callout: default !important;
		}
	`;

	(document.head ?? document.documentElement).appendChild(style);
}
