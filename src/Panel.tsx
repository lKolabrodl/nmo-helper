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

const DRAG_HANDLES = '.nmo-titlebar, .nmo-pill';
const INTERACTIVE = 'button, a, input, textarea, select, label';

export function initPanelBehavior(panel: HTMLElement): void {
	let isDragging = false, dx = 0, dy = 0;

	panel.addEventListener('mousedown', (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest(INTERACTIVE)) return;
		if (!target.closest(DRAG_HANDLES)) return;

		e.preventDefault();
		isDragging = true;
		const rect = panel.getBoundingClientRect();
		dx = e.clientX - rect.left;
		dy = e.clientY - rect.top;
		panel.style.willChange = 'right, top';
	});

	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!isDragging) return;
		e.preventDefault();
		requestAnimationFrame(() => {
			const rect = panel.getBoundingClientRect();
			const newLeft = e.clientX - dx;
			const right = window.innerWidth - (newLeft + rect.width);
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
		const right = window.innerWidth - rect.right;
		storageSet('panelRight', right);
		storageSet('panelTop', rect.top);
	});
}
