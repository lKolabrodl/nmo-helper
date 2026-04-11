import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import VariantLoader from './VariantLoader';

// Мокаем fetchViaBackground
vi.mock('../../utils', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../utils')>();
	return { ...actual, fetchViaBackground: vi.fn() };
});

import { fetchViaBackground } from '../../utils';
const mockFetch = vi.mocked(fetchViaBackground);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('VariantLoader', () => {
	it('вызывает onChange с IDLE при пустом тексте', () => {
		const onChange = vi.fn();
		render(<VariantLoader text="" onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith({ loading: false, error: null, data: [] });
	});

	it('вызывает onChange с loading: true при непустом тексте', () => {
		mockFetch.mockResolvedValue({ error: false, status: 200, text: '' });
		const onChange = vi.fn();
		render(<VariantLoader text="кардиология" onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith({ loading: true, error: null, data: [] });
	});

	it('вызывает onChange с ошибкой когда ничего не найдено', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 200, text: '<html></html>' });
		const onChange = vi.fn();

		await act(async () => {
			render(<VariantLoader text="несуществующий тест" onChange={onChange} />);
		});

		const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
		expect(lastCall.loading).toBe(false);
		expect(lastCall.error).toBe('ничего не найдено');
	});

	it('парсит результаты 24forcare', async () => {
		const html24fc = '<html><body><a class="item-name" href="https://24forcare.com/test/123">Тест кардиологии</a></body></html>';
		mockFetch.mockResolvedValue({ error: false, status: 200, text: html24fc });
		const onChange = vi.fn();

		await act(async () => {
			render(<VariantLoader text="кардиология" onChange={onChange} />);
		});

		const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
		expect(lastCall.loading).toBe(false);
		expect(lastCall.error).toBeNull();
		expect(lastCall.data.length).toBeGreaterThan(0);
		expect(lastCall.data[0].source).toBe('24forcare');
	});

	it('обрабатывает сетевую ошибку gracefully', async () => {
		mockFetch.mockRejectedValue(new Error('network'));
		const onChange = vi.fn();

		await act(async () => {
			render(<VariantLoader text="тест" onChange={onChange} />);
		});

		const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
		expect(lastCall.loading).toBe(false);
		expect(lastCall.error).toBe('ничего не найдено');
	});
});
