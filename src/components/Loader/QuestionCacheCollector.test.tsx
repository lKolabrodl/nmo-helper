import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render} from '@testing-library/react';
import QuestionCacheCollector, {collectCurrentQuestion} from './QuestionCacheCollector';

const mocks = vi.hoisted(() => ({
	setQuestion: vi.fn(),
}));

vi.mock('../../utils/question-cache', () => ({
	questionCache: {set: mocks.setQuestion},
}));

beforeAll(() => {
	if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
		Object.defineProperty(HTMLElement.prototype, 'innerText', {
			get() { return this.textContent ?? ''; },
			configurable: true,
		});
	}
});

beforeEach(() => {
	mocks.setQuestion.mockReset();
	document.body.innerHTML = createQuizMarkup('Следующий вопрос');
});

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
});

describe('QuestionCacheCollector', () => {
	it('сохраняет ответы перед переходом независимо от настройки отправки данных', () => {
		render(<QuestionCacheCollector/>);

		fireEvent.click(document.querySelector('.next-button-label')!);

		expect(mocks.setQuestion).toHaveBeenCalledOnce();
	});

	it('работает с новой кнопкой после смены вопроса и сохраняет последний вопрос', () => {
		render(<QuestionCacheCollector/>);

		const buttons = document.querySelector('.question-buttons')!;
		buttons.innerHTML = '<button class="question-buttons-primary"><span>Завершить тестирование</span></button>';
		fireEvent.click(buttons.querySelector('span')!);

		expect(mocks.setQuestion).toHaveBeenCalledOnce();
	});

	it('игнорирует другие кнопки', () => {
		render(<QuestionCacheCollector/>);

		fireEvent.click(document.querySelector('.other-button')!);

		expect(mocks.setQuestion).not.toHaveBeenCalled();
	});
});

describe('collectCurrentQuestion', () => {
	it('сохраняет очищенную тему, все варианты и выбранные ответы', () => {
		collectCurrentQuestion();

		expect(mocks.setQuestion).toHaveBeenCalledOnce();
		expect(mocks.setQuestion).toHaveBeenCalledWith(
			'Кардиология - 2024',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B', 'Вариант C'],
			['Вариант A', 'Вариант C'],
		);
	});

	it('не записывает вопрос без темы', () => {
		document.querySelector('.mat-card-title-quiz-custom')?.remove();

		collectCurrentQuestion();

		expect(mocks.setQuestion).not.toHaveBeenCalled();
	});

	it('не записывает вопрос без вариантов', () => {
		document.querySelectorAll('.mdc-form-field').forEach(element => element.remove());

		collectCurrentQuestion();

		expect(mocks.setQuestion).not.toHaveBeenCalled();
	});

	it('не записывает вопрос без текста вопроса', () => {
		document.querySelector('.question-title-text')?.remove();

		collectCurrentQuestion();

		expect(mocks.setQuestion).not.toHaveBeenCalled();
	});

	it('не записывает вопрос без выбранного ответа', () => {
		document.querySelectorAll<HTMLInputElement>('input').forEach(input => {
			input.checked = false;
		});

		collectCurrentQuestion();

		expect(mocks.setQuestion).not.toHaveBeenCalled();
	});
});

function createQuizMarkup(forwardButtonText: string): string {
	return `
		<div class="mat-card-title-quiz-custom">
			Кардиология - 2024 - Предварительное тестирование
		</div>
		<div id="questionAnchor">
			<div class="question-title-text">Какой вариант правильный?</div>
			<label class="mdc-form-field">
				<input type="checkbox" checked>
				<span>Вариант A</span>
			</label>
			<label class="mdc-form-field">
				<input type="checkbox">
				<span>Вариант B</span>
			</label>
			<label class="mdc-form-field">
				<input type="checkbox" checked>
				<span>Вариант C</span>
			</label>
		</div>
		<div class="question-buttons">
			<button class="question-buttons-primary">
				<span class="next-button-label">${forwardButtonText}</span>
			</button>
		</div>
		<button class="other-button">Другая кнопка</button>
	`;
}
