import {fireEvent, render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ModalWindow, {
	MODAL_WINDOW_DRAG_HANDLE_PROPS,
	MODAL_WINDOW_DRAG_IGNORE_PROPS,
} from './index';
import {
	constrainModalWindowLayout,
	createDefaultModalWindowLayout,
	loadModalWindowLayout,
	moveModalWindowLayout,
	saveModalWindowLayout,
	type IModalWindowSettings,
} from './layout';

const STORAGE_KEY = 'test:modal-window-layout';
const SETTINGS = {
	width: 920,
	height: 720,
	minWidth: 400,
	minHeight: 300,
} satisfies IModalWindowSettings;

beforeEach(() => {
	document.body.innerHTML = '';
	window.localStorage.removeItem(STORAGE_KEY);
});

describe('ModalWindow layout', () => {
	it('использует width/height/x/y из settings как начальную геометрию', () => {
		expect(createDefaultModalWindowLayout(
			{...SETTINGS, width: 640, height: 480, x: 120, y: 90},
			{width: 1000, height: 700},
		)).toEqual({x: 120, y: 90, width: 640, height: 480});
	});

	it('ограничивает минимальный размер и максимальный размер viewport', () => {
		expect(constrainModalWindowLayout(
			{x: -100, y: 900, width: 100, height: 1200},
			SETTINGS,
			{width: 1000, height: 700},
		)).toEqual({
			x: 8,
			y: 8,
			width: 400,
			height: 684,
		});
	});

	it('разрешает вынести половину высоты окна выше и ниже viewport', () => {
		const settings = {...SETTINGS, verticalOverflowRatio: 0.5};
		const layout = {x: 100, y: 80, width: 600, height: 520};
		const viewport = {width: 1000, height: 700};

		expect(moveModalWindowLayout(layout, 0, -2000, settings, viewport).y).toBe(-260);
		expect(moveModalWindowLayout(layout, 0, 2000, settings, viewport).y).toBe(440);
	});

	it('сохраняет x/y/width/height и читает старый формат left/top', () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
			left: 120,
			top: 90,
			width: 640,
			height: 480,
		}));
		expect(loadModalWindowLayout(STORAGE_KEY, SETTINGS)).toEqual({
			x: 120,
			y: 90,
			width: 640,
			height: 480,
		});

		const layout = {x: 140, y: 110, width: 620, height: 460};
		saveModalWindowLayout(STORAGE_KEY, layout);
		expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '')).toEqual(layout);
	});
});

describe('ModalWindow', () => {
	it('создаёт wrapper через portal и закрывается по backdrop или Escape', () => {
		const onClose = vi.fn();
		const {container} = renderModal(onClose);
		const backdrop = document.querySelector<HTMLElement>('.nmo-modal-window-backdrop');

		expect(container).toBeEmptyDOMElement();
		expect(backdrop).not.toBeNull();
		fireEvent.mouseDown(backdrop!);
		fireEvent.keyDown(document, {key: 'Escape'});
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it('перетаскивается за переданный drag handle', () => {
		saveModalWindowLayout(STORAGE_KEY, {x: 100, y: 80, width: 600, height: 520});
		renderModal();
		const modal = getModal();
		const header = document.querySelector<HTMLElement>('[data-nmo-modal-window-drag-handle]');
		expect(header).not.toBeNull();
		mockModalRect(modal);

		fireEvent.pointerDown(header!, {button: 0, pointerId: 1, clientX: 200, clientY: 150});
		fireEvent.pointerMove(modal, {pointerId: 1, clientX: 260, clientY: 190});

		expect(modal).toHaveClass('nmo-modal-window--dragging');
		expect(modal).toHaveStyle({left: '160px', top: '120px'});

		fireEvent.pointerUp(modal, {pointerId: 1});
		expect(modal).not.toHaveClass('nmo-modal-window--dragging');
		expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '')).toMatchObject({x: 160, y: 120});
	});

	it('изменяет размер за левый нижний угол', () => {
		saveModalWindowLayout(STORAGE_KEY, {x: 100, y: 80, width: 600, height: 520});
		renderModal();
		const modal = getModal();
		mockModalRect(modal);

		fireEvent.pointerDown(modal, {button: 0, pointerId: 2, clientX: 105, clientY: 595});
		fireEvent.pointerMove(modal, {pointerId: 2, clientX: 205, clientY: 495});

		expect(modal).toHaveClass('nmo-modal-window--resizing');
		expect(modal).toHaveStyle({left: '200px', top: '80px', width: '500px', height: '420px'});

		fireEvent.pointerUp(modal, {pointerId: 2});
		expect(modal).not.toHaveClass('nmo-modal-window--resizing');
	});

	it('не начинает перетаскивание из интерактивной области заголовка', () => {
		saveModalWindowLayout(STORAGE_KEY, {x: 100, y: 80, width: 600, height: 520});
		renderModal();
		const modal = getModal();
		const button = document.querySelector<HTMLButtonElement>('button');
		mockModalRect(modal);

		fireEvent.pointerDown(button!, {button: 0, pointerId: 3, clientX: 650, clientY: 110});
		fireEvent.pointerMove(modal, {pointerId: 3, clientX: 700, clientY: 150});

		expect(modal).not.toHaveClass('nmo-modal-window--dragging');
		expect(modal).toHaveStyle({left: '100px', top: '80px'});
	});
});

function renderModal(onClose = vi.fn()): ReturnType<typeof render> {
	return render(
		<ModalWindow
			storageKey={STORAGE_KEY}
			settings={SETTINGS}
			onClose={onClose}
			ariaLabel="Тестовое окно">
			<header {...MODAL_WINDOW_DRAG_HANDLE_PROPS}>
				Заголовок
				<div {...MODAL_WINDOW_DRAG_IGNORE_PROPS}>
					<button type="button">Действие</button>
				</div>
			</header>
			<div>Содержимое</div>
		</ModalWindow>,
	);
}

function getModal(): HTMLElement {
	const modal = document.querySelector<HTMLElement>('.nmo-modal-window');
	expect(modal).not.toBeNull();
	return modal!;
}

function mockModalRect(modal: HTMLElement): void {
	vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue({
		x: 100,
		y: 80,
		left: 100,
		top: 80,
		right: 700,
		bottom: 600,
		width: 600,
		height: 520,
		toJSON: () => ({}),
	});
}
