import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import SitesSection from '.';
import { renderWithProviders } from '../../tests-helpers';

describe('SitesSection', () => {
	it('рендерит поле поиска', () => {
		renderWithProviders(<SitesSection initialUrl="" />, { initialMode: 'sites' });
		expect(screen.getByPlaceholderText('Название теста...')).toBeInTheDocument();
	});

	it('рендерит поле URL', () => {
		renderWithProviders(<SitesSection initialUrl="" />, { initialMode: 'sites' });
		expect(screen.getByPlaceholderText('https://...')).toBeInTheDocument();
	});

	it('показывает кнопку Найти ответы', () => {
		renderWithProviders(<SitesSection initialUrl="" />, { initialMode: 'sites' });
		expect(screen.getByText('Найти ответы')).toBeInTheDocument();
	});

	it('показывает кнопку Запуск', () => {
		renderWithProviders(<SitesSection initialUrl="" />, { initialMode: 'sites' });
		expect(screen.getByText('Запуск')).toBeInTheDocument();
	});

	it('initialUrl заполняет поле URL', () => {
		renderWithProviders(<SitesSection initialUrl="https://test.com" />, { initialMode: 'sites' });
		const input = screen.getByPlaceholderText('https://...') as HTMLInputElement;
		expect(input.value).toBe('https://test.com');
	});

	it('ввод текста в поле поиска обновляет значение', () => {
		renderWithProviders(<SitesSection initialUrl="" />, { initialMode: 'sites' });
		const input = screen.getByPlaceholderText('Название теста...') as HTMLInputElement;
		fireEvent.change(input, { target: { value: 'кардиология' } });
		expect(input.value).toBe('кардиология');
	});
});
