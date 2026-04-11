import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PanelUiProvider, usePanelUi } from './PanelUiContext';

/** Тестовый компонент для чтения/записи контекста */
const Consumer = () => {
	const { collapsed, setCollapsed, mode, setMode } = usePanelUi();
	return (
		<div>
			<span data-testid="collapsed">{String(collapsed)}</span>
			<span data-testid="mode">{mode}</span>
			<button data-testid="toggle" onClick={() => setCollapsed(!collapsed)}>toggle</button>
			<button data-testid="set-ai" onClick={() => setMode('ai')}>ai</button>
			<button data-testid="set-sites" onClick={() => setMode('sites')}>sites</button>
		</div>
	);
};

const renderWithUi = (initialMode = 'auto', initialCollapsed = false) =>
	render(
		<PanelUiProvider initialCollapsed={initialCollapsed} initialMode={initialMode}>
			<Consumer />
		</PanelUiProvider>
	);

describe('PanelUiContext', () => {
	it('предоставляет начальные значения', () => {
		renderWithUi('sites', true);
		expect(screen.getByTestId('mode')).toHaveTextContent('sites');
		expect(screen.getByTestId('collapsed')).toHaveTextContent('true');
	});

	it('фолбэк на sites при невалидном режиме', () => {
		renderWithUi('invalid');
		expect(screen.getByTestId('mode')).toHaveTextContent('sites');
	});

	it('setCollapsed переключает состояние', () => {
		renderWithUi('auto', false);
		expect(screen.getByTestId('collapsed')).toHaveTextContent('false');
		fireEvent.click(screen.getByTestId('toggle'));
		expect(screen.getByTestId('collapsed')).toHaveTextContent('true');
	});

	it('setMode меняет режим', () => {
		renderWithUi('auto');
		expect(screen.getByTestId('mode')).toHaveTextContent('auto');
		fireEvent.click(screen.getByTestId('set-ai'));
		expect(screen.getByTestId('mode')).toHaveTextContent('ai');
	});

	it('setMode на sites работает', () => {
		renderWithUi('ai');
		fireEvent.click(screen.getByTestId('set-sites'));
		expect(screen.getByTestId('mode')).toHaveTextContent('sites');
	});
});
