import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import Header from '.';
import { renderWithProviders } from '../../tests-helpers';

describe('Header', () => {
	it('рендерит заголовок NMO Helper', () => {
		renderWithProviders(<Header />);
		expect(screen.getByText('NMO Helper')).toBeInTheDocument();
	});

	it('показывает индикатор статуса', () => {
		const { container } = renderWithProviders(<Header />);
		const indicator = container.querySelector('.nmo-indicator');
		expect(indicator).toBeInTheDocument();
	});

	it('кнопка показывает – когда панель развёрнута', () => {
		renderWithProviders(<Header />, { initialCollapsed: false });
		expect(screen.getByRole('button')).toHaveTextContent('–');
	});

	it('кнопка показывает + когда панель свёрнута', () => {
		renderWithProviders(<Header />, { initialCollapsed: true });
		expect(screen.getByRole('button')).toHaveTextContent('+');
	});

	it('клик на кнопку переключает состояние', () => {
		renderWithProviders(<Header />, { initialCollapsed: false });
		const btn = screen.getByRole('button');
		expect(btn).toHaveTextContent('–');
		fireEvent.click(btn);
		expect(btn).toHaveTextContent('+');
	});
});
