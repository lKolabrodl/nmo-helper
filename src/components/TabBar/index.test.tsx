import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import TabBar from '.';
import { renderWithProviders } from '../../tests-helpers';

describe('TabBar', () => {
	it('рендерит три таба', () => {
		renderWithProviders(<TabBar />);
		expect(screen.getByText('Авто')).toBeInTheDocument();
		expect(screen.getByText('Сайты')).toBeInTheDocument();
		expect(screen.getByText('AI')).toBeInTheDocument();
	});

	it('активный таб имеет класс active', () => {
		renderWithProviders(<TabBar />, { initialMode: 'sites' });
		expect(screen.getByText('Сайты')).toHaveClass('active');
		expect(screen.getByText('Авто')).not.toHaveClass('active');
		expect(screen.getByText('AI')).not.toHaveClass('active');
	});

	it('клик на таб переключает режим', () => {
		renderWithProviders(<TabBar />, { initialMode: 'auto' });
		expect(screen.getByText('Авто')).toHaveClass('active');

		fireEvent.click(screen.getByText('Сайты'));
		expect(screen.getByText('Сайты')).toHaveClass('active');
		expect(screen.getByText('Авто')).not.toHaveClass('active');
	});

	it('ai-pro режим подсвечивает таб AI', () => {
		renderWithProviders(<TabBar />, { initialMode: 'ai-pro' });
		expect(screen.getByText('AI')).toHaveClass('active');
	});
});
