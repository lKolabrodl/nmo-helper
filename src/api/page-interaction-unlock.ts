const STYLE_ID = 'nmo-page-interaction-unlock-style';
const INIT_FLAG = '__nmoPageInteractionUnlock';

type WindowWithUnlockFlag = Window & {
	__nmoPageInteractionUnlock?: boolean;
};

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

function stopPageHandler(event: Event): void {
	if (isInsidePanel(event.target)) return;

	event.stopImmediatePropagation();
}

function stopCopyShortcutHandler(event: KeyboardEvent): void {
	if (isInsidePanel(event.target)) return;
	if (!isCopyShortcut(event)) return;

	event.stopImmediatePropagation();
}

function isCopyShortcut(event: KeyboardEvent): boolean {
	const key = event.key.toLowerCase();
	return (event.ctrlKey || event.metaKey) && (key === 'c' || key === 'x' || key === 'insert');
}

function isInsidePanel(target: EventTarget | null): boolean {
	return target instanceof Element && !!target.closest('#nmo-panel');
}

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
