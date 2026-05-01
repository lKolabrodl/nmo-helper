import {createRoot} from 'react-dom/client';
import type {IExtensionState} from './types';
import {storageSet} from './utils';
import App from './App';

export function createPanel(state: IExtensionState): HTMLElement {
	const panel = document.createElement('div');
	panel.id = 'nmo-panel';
	if (state.savedCollapsed) panel.classList.add('collapsed');
	document.body.appendChild(panel);

	if (state.savedRight !== null && state.savedTop !== null) {
		panel.style.right = state.savedRight + 'px';
		panel.style.top = state.savedTop + 'px';
		panel.style.left = 'auto';
	}

	const root = createRoot(panel);
	root.render(<App initialState={state}/>);
	return panel;
}

const DRAG_HANDLES = '.nmo-titlebar, .nmo-pill, .nmo-footer';
const INTERACTIVE = 'button, a, input, textarea, select, label';

export function initPanelBehavior(panel: HTMLElement): void {
	let isDragging = false;
	let dx = 0, dy = 0;
	let panelWidth = 0;

	panel.addEventListener('mousedown', (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest(INTERACTIVE)) return;
		if (!target.closest(DRAG_HANDLES)) return;

		e.preventDefault();
		const rect = panel.getBoundingClientRect();
		// смещение курсора относительно левого-верхнего угла панели — фиксируем в mousedown
		dx = e.clientX - rect.left;
		dy = e.clientY - rect.top;
		panelWidth = rect.width;
		isDragging = true;
		panel.style.willChange = 'right, top';
	});

	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!isDragging) return;
		e.preventDefault();
		requestAnimationFrame(() => {
			const newLeft = e.clientX - dx;
			const right = document.documentElement.clientWidth - (newLeft + panelWidth);
			panel.style.right = right + 'px';
			panel.style.left = 'auto';
			panel.style.top = (e.clientY - dy) + 'px';
		});
	});

	document.addEventListener('mouseup', () => {
		if (!isDragging) return;
		isDragging = false;
		panel.style.willChange = '';
		const rect = panel.getBoundingClientRect();
		const right = document.documentElement.clientWidth - rect.right;
		storageSet('panelRight', right);
		storageSet('panelTop', rect.top);
	});
}
