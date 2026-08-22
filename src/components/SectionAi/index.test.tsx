import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {storageGet} from '../../utils';
import {renderWithProviders} from '../../tests-helpers';
import SectionAi from './index';

describe('SectionAi', () => {
	it('по умолчанию показывает автоматический бесплатный маршрут без настроек', () => {
		renderWithProviders(<SectionAi/>, {initialMode: 'ai'});

		expect(screen.getByRole('tab', {name: 'Бесплатно'})).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByText('Бесплатный AI · автоматически')).toBeInTheDocument();
		expect(screen.getByText('Без ключей и настроек: используются открытые бесплатные модели.')).toBeInTheDocument();
		expect(screen.getByText('Ответ может занять несколько минут — скорость зависит от нагрузки.')).toBeInTheDocument();
		expect(screen.queryByLabelText('Автоматический маршрут бесплатного AI')).not.toBeInTheDocument();
		expect(screen.queryByRole('radio')).not.toBeInTheDocument();
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		expect(screen.getByRole('button', {name: 'Запустить AI'})).toBeEnabled();
		expect(screen.queryByLabelText('API-ключ ProxyAPI')).not.toBeInTheDocument();
	});

	it('запускает бесплатный маршрут одной кнопкой и блокирует смену подключения', () => {
		renderWithProviders(<SectionAi/>, {initialMode: 'ai'});

		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));

		expect(screen.getByRole('button', {name: 'Остановить'})).toBeEnabled();
		expect(screen.getByRole('tab', {name: 'ProxyAPI'})).toBeDisabled();
		expect(screen.getByRole('tab', {name: 'Свой endpoint'})).toBeDisabled();

		fireEvent.click(screen.getByRole('button', {name: 'Остановить'}));
		expect(screen.getByRole('button', {name: 'Запустить AI'})).toBeEnabled();
	});

	it('переключает ProxyAPI и свой endpoint, сохраняя выбранный вариант', async () => {
		renderWithProviders(<SectionAi/>, {initialMode: 'ai'});

		fireEvent.click(screen.getByRole('tab', {name: 'ProxyAPI'}));
		expect(screen.getByLabelText('API-ключ ProxyAPI')).toBeInTheDocument();
		expect(await storageGet('aiProvider', '')).toBe('proxy');

		fireEvent.click(screen.getByRole('tab', {name: 'Свой endpoint'}));
		expect(screen.getByLabelText('API Endpoint')).toBeInTheDocument();
		expect(screen.getByLabelText('API Token')).toBeInTheDocument();
		expect(await storageGet('aiProvider', '')).toBe('custom');
	});

	it('открывает сохранённый ProxyAPI вместо бесплатного режима', () => {
		renderWithProviders(<SectionAi/>, {initialMode: 'ai', initialAiProvider: 'proxy'});

		expect(screen.getByRole('tab', {name: 'ProxyAPI'})).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByLabelText('API-ключ ProxyAPI')).toBeInTheDocument();
		expect(screen.queryByText('Бесплатный AI')).not.toBeInTheDocument();
	});
});
