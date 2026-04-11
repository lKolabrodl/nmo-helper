import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelUiProvider, usePanelUi } from './PanelUiContext';
import { PanelStatusProvider, usePanelStatus } from './PanelStatusContext';
import { Status } from '../types';

/** Тестовый компонент */
const Consumer = () => {
	const { status, setStatus } = usePanelStatus();
	return (
		<div>
			<span data-testid="title">{status.title}</span>
			<span data-testid="status">{status.status}</span>
			<button data-testid="set-ok" onClick={() => setStatus({ title: 'готово', status: Status.OK })}>ok</button>
			<button data-testid="set-err" onClick={() => setStatus({ title: 'ошибка', status: Status.ERR })}>err</button>
		</div>
	);
};

const renderWithProviders = (initialMode = 'auto') =>
	render(
		<PanelUiProvider initialCollapsed={false} initialMode={initialMode}>
			<PanelStatusProvider>
				<Consumer />
			</PanelStatusProvider>
		</PanelUiProvider>
	);

describe('PanelStatusContext', () => {
	it('начальный статус IDLE с пустым title', () => {
		renderWithProviders();
		expect(screen.getByTestId('status')).toHaveTextContent('idle');
		expect(screen.getByTestId('title')).toHaveTextContent('');
	});

	it('setStatus обновляет статус', () => {
		renderWithProviders();
		fireEvent.click(screen.getByTestId('set-ok'));
		expect(screen.getByTestId('status')).toHaveTextContent('ok');
		expect(screen.getByTestId('title')).toHaveTextContent('готово');
	});

	it('setStatus с ошибкой', () => {
		renderWithProviders();
		fireEvent.click(screen.getByTestId('set-err'));
		expect(screen.getByTestId('status')).toHaveTextContent('err');
		expect(screen.getByTestId('title')).toHaveTextContent('ошибка');
	});
});

describe('PanelStatusContext per-mode', () => {
	/** Компонент с переключением режимов */
	const ModeConsumer = () => {
		const { status, setStatus } = usePanelStatus();
		return (
			<div>
				<span data-testid="title">{status.title}</span>
				<span data-testid="status">{status.status}</span>
				<button data-testid="set-ok" onClick={() => setStatus({ title: 'найдено', status: Status.OK })}>ok</button>
			</div>
		);
	};

	const ModeSwitcher = () => {
		const { setMode } = usePanelUi();
		return (
			<div>
				<button data-testid="mode-auto" onClick={() => setMode('auto')}>auto</button>
				<button data-testid="mode-sites" onClick={() => setMode('sites')}>sites</button>
			</div>
		);
	};

	it('статус сохраняется per-mode при переключении', () => {
		render(
			<PanelUiProvider initialCollapsed={false} initialMode="auto">
				<PanelStatusProvider>
					<ModeSwitcher />
					<ModeConsumer />
				</PanelStatusProvider>
			</PanelUiProvider>
		);

		// Ставим статус в auto режиме
		fireEvent.click(screen.getByTestId('set-ok'));
		expect(screen.getByTestId('title')).toHaveTextContent('найдено');

		// Переключаемся на sites — статус должен быть IDLE
		fireEvent.click(screen.getByTestId('mode-sites'));
		expect(screen.getByTestId('title')).toHaveTextContent('');
		expect(screen.getByTestId('status')).toHaveTextContent('idle');

		// Возвращаемся на auto — статус должен сохраниться
		fireEvent.click(screen.getByTestId('mode-auto'));
		expect(screen.getByTestId('title')).toHaveTextContent('найдено');
		expect(screen.getByTestId('status')).toHaveTextContent('ok');
	});
});
