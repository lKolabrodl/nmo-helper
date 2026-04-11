import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import AiSection from '.';
import { renderWithProviders } from '../../tests-helpers';

describe('AiSection', () => {
	it('показывает ProxyAPI поля по умолчанию', () => {
		renderWithProviders(<AiSection />, { initialMode: 'ai' });
		expect(screen.getByText('API-ключ ProxyAPI')).toBeInTheDocument();
		expect(screen.getByText('Модель')).toBeInTheDocument();
	});

	it('свитч переключает на Custom поля', () => {
		renderWithProviders(<AiSection />, { initialMode: 'ai' });
		expect(screen.getByText('API-ключ ProxyAPI')).toBeInTheDocument();

		const checkbox = screen.getByRole('checkbox');
		fireEvent.click(checkbox);

		expect(screen.getByText('API Endpoint')).toBeInTheDocument();
		expect(screen.getByText('API Token')).toBeInTheDocument();
	});

	it('показывает Custom поля в ai-pro режиме', () => {
		renderWithProviders(<AiSection />, { initialMode: 'ai-pro' });
		expect(screen.getByText('API Endpoint')).toBeInTheDocument();
		expect(screen.getByText('API Token')).toBeInTheDocument();
	});

	it('показывает кнопку Запуск AI', () => {
		renderWithProviders(<AiSection />, { initialMode: 'ai' });
		expect(screen.getByText('Запуск AI')).toBeInTheDocument();
	});

	it('показывает ссылку получить ключ когда ключ пустой', () => {
		renderWithProviders(<AiSection />, { initialMode: 'ai' });
		expect(screen.getByText('Получить ключ API')).toBeInTheDocument();
	});
});
