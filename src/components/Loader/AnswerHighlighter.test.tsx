import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {act} from '@testing-library/react';
import AnswerHighlighter from './AnswerHighlighter';
import {renderWithProviders} from '../../tests-helpers';
import {getQuestionText, getVariantElements, getTopicElement} from '../../utils';
import {answerCache} from '../../utils/answer-cache';

// Мокаем DOM-утилиты
vi.mock('../../utils', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../utils')>();
	return {
		...actual,
		getQuestionText: vi.fn(() => null),
		getVariantElements: vi.fn(() => []),
		getTopicElement: vi.fn(() => null),
	};
});

// Мокаем answerCache
vi.mock('../../utils/answer-cache', () => ({
	answerCache: {
		get: vi.fn(() => null),
		has: vi.fn(() => false),
		set: vi.fn(),
		fresh: vi.fn(() => false),
	},
}));



beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('AnswerHighlighter', () => {
	it('не подсвечивает когда нет вопроса', () => {
		vi.mocked(getQuestionText).mockReturnValue(null);
		const el = document.createElement('span');
		el.innerText = 'вариант';
		vi.mocked(getVariantElements).mockReturnValue([el]);

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(el.style.color).toBe('');
	});

	it('не подсвечивает когда нет вариантов', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		vi.mocked(getVariantElements).mockReturnValue([]);

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		expect(() => act(() => { vi.advanceTimersByTime(400); })).not.toThrow();
	});

	it('не подсвечивает когда нет кеша', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		const el = document.createElement('span');
		el.innerText = 'вариант';
		vi.mocked(getVariantElements).mockReturnValue([el]);
		vi.mocked(answerCache.get).mockReturnValue(null);

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(el.style.color).toBe('');
	});

	it('не подсвечивает когда в кеше idx пустой', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		const el = document.createElement('span');
		el.innerText = 'вариант';
		vi.mocked(getVariantElements).mockReturnValue([el]);
		vi.mocked(answerCache.get).mockReturnValue({ id: 'x', answers: [], idx: [] });

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(el.style.color).toBe('');
	});

	it('подсвечивает индексы напрямую из cached.idx', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		const el = document.createElement('span');
		el.innerText = 'вариант';
		vi.mocked(getVariantElements).mockReturnValue([el]);
		vi.mocked(getTopicElement).mockReturnValue(null);
		vi.mocked(answerCache.get).mockReturnValue({ id: 'x', answers: ['вариант'], idx: [0] });
		vi.mocked(answerCache.fresh).mockReturnValue(true);

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(el.style.color).toBeTruthy();
	});
});
