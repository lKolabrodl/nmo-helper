import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {QuestionFinderProvider, useQuestionFinder} from './QuestionFinderContext';
import {pickResult} from '../utils/matching';
import {PAGE_STATE_UPDATED} from '../patch/subscribePageState';

beforeAll(() => {
	if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
		Object.defineProperty(HTMLElement.prototype, 'innerText', {
			get() { return this.textContent ?? ''; },
			configurable: true,
		});
	}
});

beforeEach(() => {
	document.body.innerHTML = '';
	delete window.__NMO_HELPER_STATE__;
});

afterEach(cleanup);

const TOPIC = 'Выпадение прямой кишки (по утвержденным клиническим рекомендациям)';

function QuestionState() {
	const {topic, rawTopic, question, variants, isSingle} = useQuestionFinder();
	const result = pickResult([
		{source: 'nmo-helper' as const, title: `${TOPIC} - 2021`, url: 'topic-2021'},
		{source: 'nmo-helper' as const, title: `${TOPIC} - 2024`, url: 'topic-2024'},
	], 'nmo-helper', topic);
	return <>
		<output data-testid="topic">{topic}</output>
		<output data-testid="raw-topic">{rawTopic}</output>
		<output data-testid="question">{question}</output>
		<output data-testid="variants">{JSON.stringify(variants)}</output>
		<output data-testid="single">{String(isSingle)}</output>
		<output data-testid="result">{result?.url}</output>
	</>;
}

describe('QuestionFinderProvider — тема и год', () => {
	it('выбирает тему 2024 года и сохраняет её при переходе к следующему вопросу', async () => {
		document.body.innerHTML = `
			<div class="mat-card-title-quiz-custom">Посторонняя карточка</div>
			<lib-quiz-page>
				<div id="questionAnchor">
					<div class="mat-mdc-card-title question-title-text">У пациентов с внутренним выпадением прямой кишки рекомендуется выполнять</div>
					<div class="mdc-form-field"><input type="radio"><span>операцию Лонго</span></div>
				</div>
				<div class="v-label v-label-h2">${TOPIC} - 2024 - Итоговое тестирование</div>
			</lib-quiz-page>
		`;
		render(<QuestionFinderProvider><QuestionState/></QuestionFinderProvider>);

		expect(screen.getByTestId('topic')).toHaveTextContent(`${TOPIC} - 2024`);
		expect(screen.getByTestId('raw-topic')).toHaveTextContent(`${TOPIC} - 2024 - Итоговое тестирование`);
		expect(screen.getByTestId('result')).toHaveTextContent('topic-2024');

		document.querySelector('.question-title-text')!.textContent = 'Следующий вопрос';
		await waitFor(() => expect(screen.getByTestId('question')).toHaveTextContent('Следующий вопрос'));

		expect(screen.getByTestId('topic')).toHaveTextContent(`${TOPIC} - 2024`);
		expect(screen.getByTestId('result')).toHaveTextContent('topic-2024');
	});
});

describe('QuestionFinderProvider — глобальная переменная', () => {
	it('читает тему до старта теста и ждёт текущий вопрос, не подставляя первый из списка', () => {
		const topic = `${TOPIC} - 2024 - Контрольное тестирование`;
		const questions = [{question: 'Первый вопрос', variants: ['A', 'B'], isSingle: true}];
		window.__NMO_HELPER_STATE__ = {topic, question: null, questions};
		render(<QuestionFinderProvider><QuestionState/></QuestionFinderProvider>);

		expect(screen.getByTestId('topic')).toHaveTextContent(`${TOPIC} - 2024`);
		expect(screen.getByTestId('raw-topic')).toHaveTextContent(topic);
		expect(screen.getByTestId('question')).toBeEmptyDOMElement();
		expect(screen.getByTestId('variants')).toHaveTextContent('[]');

		act(() => {
			window.__NMO_HELPER_STATE__ = {topic, question: questions[0], questions};
			window.dispatchEvent(new Event(PAGE_STATE_UPDATED));
		});
		expect(screen.getByTestId('question')).toHaveTextContent('Первый вопрос');
		expect(screen.getByTestId('variants')).toHaveTextContent('["A","B"]');
		expect(screen.getByTestId('single')).toHaveTextContent('true');
	});

	it('берёт тему, вопрос и варианты из переменной вместо HTML', () => {
		document.body.innerHTML = '<div id="questionAnchor"><div class="question-title-text">Вопрос из HTML</div></div>';
		window.__NMO_HELPER_STATE__ = {
			topic: `${TOPIC} - 2024 - Контрольное тестирование`,
			question: {question: 'Вопрос из State', variants: ['B', 'A'], isSingle: true},
			questions: [],
		};
		render(<QuestionFinderProvider><QuestionState/></QuestionFinderProvider>);
		expect(screen.getByTestId('topic')).toHaveTextContent(`${TOPIC} - 2024`);
		expect(screen.getByTestId('question')).toHaveTextContent('Вопрос из State');
		expect(screen.getByTestId('variants')).toHaveTextContent('["B","A"]');
		expect(screen.getByTestId('single')).toHaveTextContent('true');
	});

	it('реагирует на обновление переменной без изменений DOM', () => {
		document.body.innerHTML = `
			<div class="v-label v-label-h2">${TOPIC} - 2024 - Итоговое тестирование</div>
			<div id="questionAnchor"><input type="radio"></div>
		`;
		render(<QuestionFinderProvider><QuestionState/></QuestionFinderProvider>);
		act(() => {
			window.__NMO_HELPER_STATE__ = {
				topic: null,
				question: {question: 'Новый вопрос', variants: ['C', 'D'], isSingle: false},
				questions: [],
			};
			window.dispatchEvent(new Event(PAGE_STATE_UPDATED));
		});
		expect(screen.getByTestId('topic')).toHaveTextContent(`${TOPIC} - 2024`);
		expect(screen.getByTestId('question')).toHaveTextContent('Новый вопрос');
		expect(screen.getByTestId('variants')).toHaveTextContent('["C","D"]');
		expect(screen.getByTestId('single')).toHaveTextContent('false');
	});

	it('использует HTML, если в переменной нет вариантов', () => {
		document.body.innerHTML = '<div id="questionAnchor"><div class="question-title-text">Вопрос из HTML</div></div>';
		window.__NMO_HELPER_STATE__ = {
			topic: 'Тема',
			question: {question: 'Неполный вопрос', variants: [], isSingle: true},
			questions: [],
		};
		render(<QuestionFinderProvider><QuestionState/></QuestionFinderProvider>);
		expect(screen.getByTestId('question')).toHaveTextContent('Вопрос из HTML');
		act(() => {
			window.__NMO_HELPER_STATE__ = null;
			window.dispatchEvent(new Event(PAGE_STATE_UPDATED));
		});
		expect(screen.getByTestId('question')).toHaveTextContent('Вопрос из HTML');
	});
});
