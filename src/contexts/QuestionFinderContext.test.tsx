import {render, screen, waitFor} from '@testing-library/react';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {QuestionFinderProvider, useQuestionFinder} from './QuestionFinderContext';
import {pickResult} from '../utils/matching';

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
});

const TOPIC = 'Выпадение прямой кишки (по утвержденным клиническим рекомендациям)';

function QuestionState() {
	const {topic, rawTopic, question} = useQuestionFinder();
	const result = pickResult([
		{source: 'nmo-helper' as const, title: `${TOPIC} - 2021`, url: 'topic-2021'},
		{source: 'nmo-helper' as const, title: `${TOPIC} - 2024`, url: 'topic-2024'},
	], 'nmo-helper', topic);
	return <>
		<output data-testid="topic">{topic}</output>
		<output data-testid="raw-topic">{rawTopic}</output>
		<output data-testid="question">{question}</output>
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
