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
	delete window.__NMO_HELPER_STATE__;
	document.body.innerHTML = createQuizMarkup('Следующий вопрос');
});

afterEach(() => {
	cleanup();
	delete window.__NMO_HELPER_STATE__;
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

	it('сохраняет выбор до нажатия кнопки перехода', () => {
		render(<QuestionCacheCollector/>);

		fireEvent.change(document.querySelector('input')!);

		expect(mocks.setQuestion).toHaveBeenCalledWith(
			'Кардиология - 2024',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B', 'Вариант C'],
			['Вариант A', 'Вариант C'],
		);
	});

	it('игнорирует изменение настроек расширения вне текущего вопроса', () => {
		document.body.insertAdjacentHTML('beforeend', '<input class="setting" type="checkbox">');
		render(<QuestionCacheCollector/>);

		fireEvent.change(document.querySelector('.setting')!);

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

	it('берёт варианты из State и сопоставляет их с input без старых классов Material', () => {
		usePageState();
		useNewAnswerMarkup();

		collectCurrentQuestion();

		expect(mocks.setQuestion).toHaveBeenCalledWith(
			'Кардиология - 2024',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B', 'Вариант C'],
			['Вариант A', 'Вариант C'],
		);
	});

	it('использует State, если текст вопроса ещё не появился в DOM', () => {
		usePageState();
		useNewAnswerMarkup();
		document.querySelector('.question-title-text')?.remove();

		collectCurrentQuestion();

		expect(mocks.setQuestion).toHaveBeenCalledWith(
			'Кардиология - 2024',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B', 'Вариант C'],
			['Вариант A', 'Вариант C'],
		);
	});

	it('не смешивает варианты из State с другим вопросом в DOM', () => {
		usePageState();
		window.__NMO_HELPER_STATE__ = {
			...window.__NMO_HELPER_STATE__!,
			question: {question: 'Другой вопрос', variants: ['Другой A', 'Другой B'], isSingle: true},
		};

		collectCurrentQuestion();

		expect(mocks.setQuestion).toHaveBeenCalledWith(
			'Кардиология - 2024',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B', 'Вариант C'],
			['Вариант A', 'Вариант C'],
		);
	});

	it('не смешивает State другой темы с текущим тестом', () => {
		usePageState();
		window.__NMO_HELPER_STATE__ = {...window.__NMO_HELPER_STATE__!, topic: 'Другая тема'};
		useNewAnswerMarkup();

		collectCurrentQuestion();

		expect(mocks.setQuestion).not.toHaveBeenCalled();
	});

	it('не сохраняет неполный набор вариантов, пока DOM не готов', () => {
		usePageState();
		useNewAnswerMarkup();
		document.querySelector('label[for="answer-b"]')?.remove();

		collectCurrentQuestion();

		expect(mocks.setQuestion).not.toHaveBeenCalled();
	});
});

function usePageState(): void {
	const question = {
		question: 'Какой вариант правильный?',
		variants: ['Вариант A', 'Вариант B', 'Вариант C'],
		isSingle: false,
	};
	window.__NMO_HELPER_STATE__ = {
		topic: 'Кардиология - 2024 - Предварительное тестирование',
		question,
		questions: [question],
	};
}

function useNewAnswerMarkup(): void {
	document.querySelectorAll('.mdc-form-field').forEach((element, index) => {
		const id = `answer-${['a', 'b', 'c'][index]}`;
		element.outerHTML = `
			<mat-checkbox>
				<div class="mat-internal-form-field">
					<input id="${id}" type="checkbox" ${index !== 1 ? 'checked' : ''}>
					<label for="${id}"><span><b>Вариант ${['A', 'B', 'C'][index]}</b></span></label>
				</div>
			</mat-checkbox>
		`;
	});
}

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
