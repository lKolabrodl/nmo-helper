import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {storageGet} from '../../utils';
import {renderWithProviders} from '../../tests-helpers';
import AiSection from './index';

describe('AiSection', () => {
	it('по умолчанию показывает заглушку бесплатного AI', () => {
		renderWithProviders(<AiSection/>, {initialMode: 'ai'});

		expect(screen.getByRole('tab', {name: 'Бесплатно'})).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByText('Бесплатный AI')).toBeInTheDocument();
		expect(screen.getByRole('button', {name: 'Скоро будет доступно'})).toBeDisabled();
		expect(screen.queryByLabelText('API-ключ ProxyAPI')).not.toBeInTheDocument();
	});

	it('переключает ProxyAPI и свой endpoint, сохраняя выбранный вариант', async () => {
		renderWithProviders(<AiSection/>, {initialMode: 'ai'});

		fireEvent.click(screen.getByRole('tab', {name: 'ProxyAPI'}));
		expect(screen.getByLabelText('API-ключ ProxyAPI')).toBeInTheDocument();
		expect(await storageGet('aiProvider', '')).toBe('proxy');

		fireEvent.click(screen.getByRole('tab', {name: 'Свой endpoint'}));
		expect(screen.getByLabelText('API Endpoint')).toBeInTheDocument();
		expect(screen.getByLabelText('API Token')).toBeInTheDocument();
		expect(await storageGet('aiProvider', '')).toBe('custom');
	});

	it('открывает сохранённый ProxyAPI вместо бесплатной заглушки', () => {
		renderWithProviders(<AiSection/>, {initialMode: 'ai', initialAiProvider: 'proxy'});

		expect(screen.getByRole('tab', {name: 'ProxyAPI'})).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByLabelText('API-ключ ProxyAPI')).toBeInTheDocument();
		expect(screen.queryByText('Бесплатный AI')).not.toBeInTheDocument();
	});
});
