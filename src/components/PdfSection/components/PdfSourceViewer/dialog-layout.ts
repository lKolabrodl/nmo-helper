export const PDF_SOURCE_DIALOG_STORAGE_KEY = 'nmo-helper:pdf-source-dialog-layout:v1';
export const PDF_SOURCE_DIALOG_MARGIN = 8;
export const PDF_SOURCE_DIALOG_MIN_WIDTH = 400;
export const PDF_SOURCE_DIALOG_MIN_HEIGHT = 300;

const PDF_SOURCE_DIALOG_DEFAULT_WIDTH = 920;
const PDF_SOURCE_DIALOG_DEFAULT_HEIGHT = 720;

export interface IPdfSourceDialogLayout {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface IPdfSourceDialogViewport {
	readonly width: number;
	readonly height: number;
}

/** Возвращает размеры viewport без полос прокрутки, когда они доступны. */
export function getPdfSourceDialogViewport(): IPdfSourceDialogViewport {
	return {
		width: document.documentElement.clientWidth || window.innerWidth,
		height: document.documentElement.clientHeight || window.innerHeight,
	};
}

/** Центрирует окно с начальным размером и учитывает небольшие экраны. */
export function createDefaultPdfSourceDialogLayout(
	viewport: IPdfSourceDialogViewport = getPdfSourceDialogViewport(),
): IPdfSourceDialogLayout {
	const width = Math.min(PDF_SOURCE_DIALOG_DEFAULT_WIDTH, getMaxWidth(viewport));
	const height = Math.min(PDF_SOURCE_DIALOG_DEFAULT_HEIGHT, getMaxHeight(viewport));

	return {
		left: (viewport.width - width) / 2,
		top: (viewport.height - height) / 2,
		width,
		height,
	};
}

/** Ограничивает сохранённый размер и позицию текущей видимой областью. */
export function constrainPdfSourceDialogLayout(
	layout: IPdfSourceDialogLayout,
	viewport: IPdfSourceDialogViewport = getPdfSourceDialogViewport(),
): IPdfSourceDialogLayout {
	const maxWidth = getMaxWidth(viewport);
	const maxHeight = getMaxHeight(viewport);
	const minWidth = Math.min(PDF_SOURCE_DIALOG_MIN_WIDTH, maxWidth);
	const minHeight = Math.min(PDF_SOURCE_DIALOG_MIN_HEIGHT, maxHeight);
	const width = clampFinite(layout.width, minWidth, maxWidth, minWidth);
	const height = clampFinite(layout.height, minHeight, maxHeight, minHeight);
	const maxLeft = Math.max(PDF_SOURCE_DIALOG_MARGIN, viewport.width - PDF_SOURCE_DIALOG_MARGIN - width);
	const maxTop = Math.max(PDF_SOURCE_DIALOG_MARGIN, viewport.height - PDF_SOURCE_DIALOG_MARGIN - height);

	return {
		left: clampFinite(layout.left, PDF_SOURCE_DIALOG_MARGIN, maxLeft, PDF_SOURCE_DIALOG_MARGIN),
		top: clampFinite(layout.top, PDF_SOURCE_DIALOG_MARGIN, maxTop, PDF_SOURCE_DIALOG_MARGIN),
		width,
		height,
	};
}

/** Загружает сохранённую геометрию окна и безопасно обрабатывает закрытый localStorage. */
export function loadPdfSourceDialogLayout(): IPdfSourceDialogLayout {
	const fallback = createDefaultPdfSourceDialogLayout();

	try {
		const serialized = window.localStorage.getItem(PDF_SOURCE_DIALOG_STORAGE_KEY);
		if (!serialized) return fallback;
		const saved = JSON.parse(serialized) as Partial<IPdfSourceDialogLayout>;
		if (![saved.left, saved.top, saved.width, saved.height].every(value => typeof value === 'number')) {
			return fallback;
		}
		return constrainPdfSourceDialogLayout(saved as IPdfSourceDialogLayout);
	} catch {
		return fallback;
	}
}

/** Сохраняет геометрию окна, не прерывая UI при недоступном localStorage. */
export function savePdfSourceDialogLayout(layout: IPdfSourceDialogLayout): void {
	try {
		window.localStorage.setItem(PDF_SOURCE_DIALOG_STORAGE_KEY, JSON.stringify(layout));
	} catch {
		// Storage может быть отключён политикой браузера или владельцем страницы.
	}
}

function getMaxWidth(viewport: IPdfSourceDialogViewport): number {
	return Math.max(1, viewport.width - PDF_SOURCE_DIALOG_MARGIN * 2);
}

function getMaxHeight(viewport: IPdfSourceDialogViewport): number {
	return Math.max(1, viewport.height - PDF_SOURCE_DIALOG_MARGIN * 2);
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(Math.max(value, min), max);
}
