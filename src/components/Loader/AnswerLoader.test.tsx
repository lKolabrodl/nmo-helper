import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import AnswerLoader from './AnswerLoader';

vi.mock('../../utils', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../utils')>();
	return { ...actual, fetchViaBackground: vi.fn() };
});

import { fetchViaBackground } from '../../utils';
const mockFetch = vi.mocked(fetchViaBackground);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('AnswerLoader', () => {
	it('вызывает onChange с IDLE при пустом URL', () => {
		const onChange = vi.fn();
		render(<AnswerLoader url="" onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith({ loading: false, error: null, data: null });
	});

	it('ошибка при некорректном URL', () => {
		const onChange = vi.fn();
		render(<AnswerLoader url="не-url" onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ error: 'некорректный URL', data: null })
		);
	});

	it('ошибка при URL не из списка источников', () => {
		const onChange = vi.fn();
		render(<AnswerLoader url="https://google.com" onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ error: 'URL не от rosmed или 24forcare' })
		);
	});

	it('вызывает onChange с loading при валидном URL', () => {
		mockFetch.mockResolvedValue({ error: false, status: 200, text: '<html></html>' });
		const onChange = vi.fn();
		render(<AnswerLoader url="https://24forcare.com/test/123" onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith({ loading: true, error: null, data: null });
	});

	it('ошибка при сетевой ошибке', async () => {
		mockFetch.mockResolvedValue({ error: true, status: 0, text: '' });
		const onChange = vi.fn();

		await act(async () => {
			render(<AnswerLoader url="https://24forcare.com/test/123" onChange={onChange} />);
		});

		const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
		expect(lastCall.error).toContain('ошибка сети');
	});

	it('ошибка при пустом ответе сервера', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 200, text: 'short' });
		const onChange = vi.fn();

		await act(async () => {
			render(<AnswerLoader url="https://24forcare.com/test/123" onChange={onChange} />);
		});

		const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
		expect(lastCall.error).toContain('пустой ответ');
	});

	it('возвращает парсер при успешной загрузке', async () => {
		const html = '<html><body>' + 'x'.repeat(200) + '<h3>Вопрос</h3><p><strong>Ответ</strong></p></body></html>';
		mockFetch.mockResolvedValue({ error: false, status: 200, text: html });
		const onChange = vi.fn();

		await act(async () => {
			render(<AnswerLoader url="https://24forcare.com/test/123" onChange={onChange} />);
		});

		const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
		expect(lastCall.loading).toBe(false);
		expect(lastCall.error).toBeNull();
		expect(typeof lastCall.data).toBe('function');
	});
});
