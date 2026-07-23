export const MODAL_WINDOW_DEFAULT_MARGIN = 8;
const MODAL_WINDOW_MAX_VERTICAL_OVERFLOW_RATIO = 0.5;

export interface IModalWindowSettings {
	readonly width: number;
	readonly height: number;
	readonly x?: number;
	readonly y?: number;
	readonly minWidth?: number;
	readonly minHeight?: number;
	readonly margin?: number;
	/** Доля высоты окна, которую разрешено вынести выше или ниже viewport (от 0 до 0.5). */
	readonly verticalOverflowRatio?: number;
}

export interface IModalWindowLayout {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface IModalWindowViewport {
	readonly width: number;
	readonly height: number;
}

interface IModalWindowConstraints {
	readonly margin: number;
	readonly minWidth: number;
	readonly minHeight: number;
	readonly maxWidth: number;
	readonly maxHeight: number;
	readonly verticalOverflowRatio: number;
}

interface IStoredModalWindowLayout {
	readonly x?: unknown;
	readonly y?: unknown;
	readonly left?: unknown;
	readonly top?: unknown;
	readonly width?: unknown;
	readonly height?: unknown;
}

/** Возвращает размеры viewport без полос прокрутки, когда они доступны. */
export function getModalWindowViewport(): IModalWindowViewport {
	return {
		width: document.documentElement.clientWidth || window.innerWidth,
		height: document.documentElement.clientHeight || window.innerHeight,
	};
}

/** Создаёт начальную геометрию окна. Если x/y не заданы, окно центрируется. */
export function createDefaultModalWindowLayout(
	settings: IModalWindowSettings,
	viewport: IModalWindowViewport = getModalWindowViewport(),
): IModalWindowLayout {
	const constraints = getConstraints(settings, viewport);
	const width = clampFinite(settings.width, constraints.minWidth, constraints.maxWidth, constraints.minWidth);
	const height = clampFinite(settings.height, constraints.minHeight, constraints.maxHeight, constraints.minHeight);
	const centeredX = clamp((viewport.width - width) / 2, constraints.margin, getMaxX(width, viewport, constraints.margin));
	const centeredY = clamp(
		(viewport.height - height) / 2,
		getMinY(height, constraints),
		getMaxY(height, viewport, constraints),
	);

	return {
		x: clampFinite(settings.x ?? centeredX, constraints.margin, getMaxX(width, viewport, constraints.margin), centeredX),
		y: clampFinite(
			settings.y ?? centeredY,
			getMinY(height, constraints),
			getMaxY(height, viewport, constraints),
			centeredY,
		),
		width,
		height,
	};
}

/** Ограничивает размер и положение окна с учётом разрешённого вертикального выхода за viewport. */
export function constrainModalWindowLayout(
	layout: IModalWindowLayout,
	settings: IModalWindowSettings,
	viewport: IModalWindowViewport = getModalWindowViewport(),
): IModalWindowLayout {
	const fallback = createDefaultModalWindowLayout(settings, viewport);
	const constraints = getConstraints(settings, viewport);
	const width = clampFinite(layout.width, constraints.minWidth, constraints.maxWidth, fallback.width);
	const height = clampFinite(layout.height, constraints.minHeight, constraints.maxHeight, fallback.height);

	return {
		x: clampFinite(layout.x, constraints.margin, getMaxX(width, viewport, constraints.margin), fallback.x),
		y: clampFinite(
			layout.y,
			getMinY(height, constraints),
			getMaxY(height, viewport, constraints),
			fallback.y,
		),
		width,
		height,
	};
}

/** Перемещает окно, оставляя внутри viewport разрешённую долю его высоты. */
export function moveModalWindowLayout(
	layout: IModalWindowLayout,
	deltaX: number,
	deltaY: number,
	settings: IModalWindowSettings,
	viewport: IModalWindowViewport = getModalWindowViewport(),
): IModalWindowLayout {
	return constrainModalWindowLayout({
		...layout,
		x: layout.x + deltaX,
		y: layout.y + deltaY,
	}, settings, viewport);
}

/** Изменяет размер за левый нижний угол, сохраняя правую и верхнюю границы. */
export function resizeModalWindowFromBottomLeft(layout: IModalWindowLayout,	deltaX: number,	deltaY: number,	settings: IModalWindowSettings,	viewport: IModalWindowViewport = getModalWindowViewport()): IModalWindowLayout {
	const start = constrainModalWindowLayout(layout, settings, viewport);
	const constraints = getConstraints(settings, viewport);
	const right = start.x + start.width;
	const maxX = Math.max(constraints.margin, right - constraints.minWidth);
	const x = clampFinite(start.x + deltaX, constraints.margin, maxX, start.x);
	const maxHeight = Math.max(
		constraints.minHeight,
		viewport.height - constraints.margin - start.y,
	);

	return {
		x,
		y: start.y,
		width: right - x,
		height: clampFinite(
			start.height + deltaY,
			constraints.minHeight,
			maxHeight,
			start.height,
		),
	};
}

/** Загружает геометрию по ключу. Старые left/top поддерживаются для миграции. */
export function loadModalWindowLayout(storageKey: string,	settings: IModalWindowSettings,	viewport: IModalWindowViewport = getModalWindowViewport()): IModalWindowLayout {
	const fallback = createDefaultModalWindowLayout(settings, viewport);

	try {
		const serialized = window.localStorage.getItem(storageKey);
		if (!serialized) return fallback;

		const saved = JSON.parse(serialized) as IStoredModalWindowLayout;
		const x = isFiniteNumber(saved.x) ? saved.x : saved.left;
		const y = isFiniteNumber(saved.y) ? saved.y : saved.top;
		if (![x, y, saved.width, saved.height].every(isFiniteNumber)) return fallback;

		return constrainModalWindowLayout({
			x: x as number,
			y: y as number,
			width: saved.width as number,
			height: saved.height as number
		}, settings, viewport);

	} catch {
		return fallback;
	}
}

/** Сохраняет геометрию, не прерывая UI при недоступном localStorage. */
export function saveModalWindowLayout(storageKey: string, layout: IModalWindowLayout): void {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(layout));
	} catch {
		// Storage может быть отключён политикой браузера или владельцем страницы.
	}
}

function getConstraints(settings: IModalWindowSettings, viewport: IModalWindowViewport): IModalWindowConstraints {
	const margin = normalizeNonNegative(settings.margin, MODAL_WINDOW_DEFAULT_MARGIN);
	const maxWidth = Math.max(1, viewport.width - margin * 2);
	const maxHeight = Math.max(1, viewport.height - margin * 2);

	return {
		margin,
		minWidth: Math.min(normalizePositive(settings.minWidth, 1), maxWidth),
		minHeight: Math.min(normalizePositive(settings.minHeight, 1), maxHeight),
		maxWidth,
		maxHeight,
		verticalOverflowRatio: normalizeRatio(settings.verticalOverflowRatio),
	};
}

function getMaxX(width: number, viewport: IModalWindowViewport, margin: number): number {
	return Math.max(margin, viewport.width - margin - width);
}

function getMinY(height: number, constraints: IModalWindowConstraints): number {
	return getVerticalEdgeMargin(constraints) - height * constraints.verticalOverflowRatio;
}

function getMaxY(
	height: number,
	viewport: IModalWindowViewport,
	constraints: IModalWindowConstraints,
): number {
	return Math.max(
		getMinY(height, constraints),
		viewport.height - getVerticalEdgeMargin(constraints) - height
			+ height * constraints.verticalOverflowRatio,
	);
}

function getVerticalEdgeMargin(constraints: IModalWindowConstraints): number {
	return constraints.margin * (
		1 - constraints.verticalOverflowRatio / MODAL_WINDOW_MAX_VERTICAL_OVERFLOW_RATIO
	);
}

function normalizePositive(value: number | undefined, fallback: number): number {
	return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function normalizeNonNegative(value: number | undefined, fallback: number): number {
	return isFiniteNumber(value) && value >= 0 ? value : fallback;
}

function normalizeRatio(value: number | undefined): number {
	return isFiniteNumber(value)
		? clamp(value, 0, MODAL_WINDOW_MAX_VERTICAL_OVERFLOW_RATIO)
		: 0;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
	return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
