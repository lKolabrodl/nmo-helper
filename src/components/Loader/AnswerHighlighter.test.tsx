import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import AnswerHighlighter from './AnswerHighlighter';
import { renderWithProviders } from '../../tests-helpers';

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

// Мокаем matching
vi.mock('../../utils/matching', () => ({
	highlightByIndexes: vi.fn(),
}));

// Мокаем answerCache2
vi.mock('../../utils/answer-cache2', () => ({
	answerCache2: {
		get: vi.fn(() => null),
		has: vi.fn(() => false),
		set: vi.fn(),
		fresh: vi.fn(() => false),
	},
}));

import { getQuestionText, getVariantElements, getTopicElement } from '../../utils';
import { highlightByIndexes } from '../../utils/matching';
import { answerCache2 } from '../../utils/answer-cache2';

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

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(highlightByIndexes).not.toHaveBeenCalled();
	});

	it('не подсвечивает когда нет вариантов', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		vi.mocked(getVariantElements).mockReturnValue([]);

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(highlightByIndexes).not.toHaveBeenCalled();
	});

	it('не подсвечивает когда нет кеша', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		const el = document.createElement('span');
		el.innerText = 'вариант';
		vi.mocked(getVariantElements).mockReturnValue([el]);
		vi.mocked(answerCache2.get).mockReturnValue(null);

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(highlightByIndexes).not.toHaveBeenCalled();
	});

	it('не подсвечивает когда в кеше idx пустой', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		const el = document.createElement('span');
		el.innerText = 'вариант';
		vi.mocked(getVariantElements).mockReturnValue([el]);
		vi.mocked(answerCache2.get).mockReturnValue({ id: 'x', answers: [], idx: [] });

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(highlightByIndexes).not.toHaveBeenCalled();
	});

	it('подсвечивает индексы напрямую из cached.idx', () => {
		vi.mocked(getQuestionText).mockReturnValue('Вопрос?');
		const el = document.createElement('span');
		el.innerText = 'вариант';
		vi.mocked(getVariantElements).mockReturnValue([el]);
		vi.mocked(getTopicElement).mockReturnValue(null);
		vi.mocked(answerCache2.get).mockReturnValue({ id: 'x', answers: ['вариант'], idx: [0] });
		vi.mocked(answerCache2.fresh).mockReturnValue(true);

		renderWithProviders(<AnswerHighlighter />, { initialMode: 'auto' });
		act(() => { vi.advanceTimersByTime(400); });

		expect(highlightByIndexes).toHaveBeenCalledWith([el], [0]);
	});
});
