import { createRoot } from 'react-dom/client';
import type { IExtensionState } from './types';
import { storageSet } from './utils';
import App from './App';

export function createPanel(state: IExtensionState): HTMLElement {
	const panel = document.createElement('div');
	panel.id = 'nmo-panel';
	if (state.savedCollapsed) panel.classList.add('collapsed');
	document.body.appendChild(panel);

	if (state.savedLeft !== null && state.savedTop !== null) {
		panel.style.left = state.savedLeft + 'px';
		panel.style.top = state.savedTop + 'px';
		panel.style.right = 'auto';
	}

	const root = createRoot(panel);
	root.render(<App initialState={state} />);
	return panel;
}

export function initPanelBehavior(panel: HTMLElement): void {
	let isDragging = false, dx = 0, dy = 0;

	panel.addEventListener('mousedown', (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.nmo-header')) return;
		if (target.closest('.nmo-toggle-btn')) return;
		e.preventDefault();
		isDragging = true;
		const rect = panel.getBoundingClientRect();
		dx = e.clientX - rect.left;
		dy = e.clientY - rect.top;
		panel.style.willChange = 'left, top';
	});

	document.addEventListener('mousemove', (e: MouseEvent) => {
		if (!isDragging) return;
		e.preventDefault();
		requestAnimationFrame(() => {
			panel.style.left = (e.clientX - dx) + 'px';
			panel.style.top = (e.clientY - dy) + 'px';
			panel.style.right = 'auto';
		});
	});

	document.addEventListener('mouseup', () => {
		if (isDragging) {
			isDragging = false;
			panel.style.willChange = '';
			const rect = panel.getBoundingClientRect();
			storageSet('panelLeft', rect.left);
			storageSet('panelTop', rect.top);
		}
	});
}
