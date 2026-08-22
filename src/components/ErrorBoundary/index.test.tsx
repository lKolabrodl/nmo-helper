import {render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import ErrorBoundary from './index';

const ThrowError = ({error}: {readonly error: Error}): never => {
	throw error;
};

describe('ErrorBoundary', () => {
	afterEach(() => vi.restoreAllMocks());

	it('показывает дочерний интерфейс, пока ошибок нет', () => {
		render(<ErrorBoundary><div>Рабочий компонент</div></ErrorBoundary>);

		expect(screen.getByText('Рабочий компонент')).toBeInTheDocument();
		expect(document.querySelector('.nmo-error-boundary')).not.toBeInTheDocument();
	});

	it('заменяет упавший компонент сообщением об ошибке', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		render(<ErrorBoundary><ThrowError error={new Error('не удалось загрузить секцию')}/></ErrorBoundary>);

		expect(screen.getByText('ошибка: не удалось загрузить секцию')).toBeInTheDocument();
		expect(consoleError).toHaveBeenCalledWith(
			'[NMO] ErrorBoundary:',
			expect.any(Error),
			expect.any(String),
		);
	});

	it('использует безопасный текст для ошибки без сообщения', () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		render(<ErrorBoundary><ThrowError error={new Error('')}/></ErrorBoundary>);

		expect(screen.getByText('ошибка: неизвестная ошибка')).toBeInTheDocument();
	});
});
