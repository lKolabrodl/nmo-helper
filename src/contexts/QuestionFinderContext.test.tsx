import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QuestionFinderProvider, useQuestionFinder } from './QuestionFinderContext';

// Мокаем DOM-утилиты
vi.mock('../utils', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../utils')>();
	return {
		...actual,
		getTopicElement: vi.fn(() => null),
		getQuestionText: vi.fn(() => null),
		getVariantTexts: vi.fn(() => []),
		isSingleAnswer: vi.fn(() => false),
	};
});

import { getTopicElement, getQuestionText, getVariantTexts, isSingleAnswer } from '../utils';

const Consumer = () => {
	const { topic, question, variants, isSingle } = useQuestionFinder();
	return (
		<div>
			<span data-testid="topic">{topic ?? 'null'}</span>
			<span data-testid="question">{question ?? 'null'}</span>
			<span data-testid="variants">{variants.join(',') || 'empty'}</span>
			<span data-testid="isSingle">{String(isSingle)}</span>
		</div>
	);
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('QuestionFinderContext', () => {
	it('начальное состояние — всё null/пусто', () => {
		render(
			<QuestionFinderProvider><Consumer /></QuestionFinderProvider>
		);
		expect(screen.getByTestId('topic')).toHaveTextContent('null');
		expect(screen.getByTestId('question')).toHaveTextContent('null');
		expect(screen.getByTestId('variants')).toHaveTextContent('empty');
		expect(screen.getByTestId('isSingle')).toHaveTextContent('false');
	});

	it('обновляет состояние при изменении DOM', async () => {
		const topicEl = document.createElement('div');
		topicEl.innerText = 'Кардиология';

		vi.mocked(getTopicElement).mockReturnValue(topicEl);
		vi.mocked(getQuestionText).mockReturnValue('Что такое ЭКГ?');
		vi.mocked(getVariantTexts).mockReturnValue(['A', 'B', 'C']);
		vi.mocked(isSingleAnswer).mockReturnValue(true);

		render(
			<QuestionFinderProvider><Consumer /></QuestionFinderProvider>
		);

		// MutationObserver debounce 200ms
		act(() => {
			document.body.appendChild(document.createElement('div'));
			vi.advanceTimersByTime(300);
		});

		expect(screen.getByTestId('topic')).toHaveTextContent('Кардиология');
		expect(screen.getByTestId('question')).toHaveTextContent('Что такое ЭКГ?');
		expect(screen.getByTestId('variants')).toHaveTextContent('A,B,C');
		expect(screen.getByTestId('isSingle')).toHaveTextContent('true');
	});

	it('не обновляет если данные не изменились', () => {
		vi.mocked(getTopicElement).mockReturnValue(null);
		vi.mocked(getQuestionText).mockReturnValue(null);

		const renderSpy = vi.fn();
		const SpyConsumer = () => {
			const state = useQuestionFinder();
			renderSpy(state);
			return null;
		};

		render(
			<QuestionFinderProvider><SpyConsumer /></QuestionFinderProvider>
		);

		const initialCallCount = renderSpy.mock.calls.length;

		// Триггерим мутацию, но данные те же
		act(() => {
			document.body.appendChild(document.createElement('span'));
			vi.advanceTimersByTime(300);
		});

		// Не должно быть лишних ре-рендеров
		expect(renderSpy.mock.calls.length).toBe(initialCallCount);
	});
});
