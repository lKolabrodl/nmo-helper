import {act, cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Status} from '../../types';
import AutoSolveLoader from './AutoSolveLoader';

const mocks = vi.hoisted(() => ({
	autoSolveEnabled: true,
	delayMinSeconds: 0,
	delayMaxSeconds: 0,
	status: 'ok',
	topic: 'Кардиология - 2025',
	question: 'Какой вариант правильный?',
	variants: ['Вариант A', 'Вариант B', 'Вариант C'],
	isSingle: true,
	getCachedAnswer: vi.fn(),
}));

vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({
		autoSolve: {
			enabled: mocks.autoSolveEnabled,
			delayMinSeconds: mocks.delayMinSeconds,
			delayMaxSeconds: mocks.delayMaxSeconds,
		},
	}),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({
		status: {
			title: 'Ответ найден',
			status: mocks.status,
		},
	}),
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({
		topic: mocks.topic,
		question: mocks.question,
		variants: mocks.variants,
		isSingle: mocks.isSingle,
	}),
}));

vi.mock('../../utils/answer-cache', () => ({
	answerCache: {get: mocks.getCachedAnswer},
}));

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-08-22T10:00:00Z'));

	mocks.autoSolveEnabled = true;
	mocks.delayMinSeconds = 0;
	mocks.delayMaxSeconds = 0;
	mocks.status = Status.OK;
	mocks.topic = 'Кардиология - 2025';
	mocks.question = 'Какой вариант правильный?';
	mocks.variants = ['Вариант A', 'Вариант B', 'Вариант C'];
	mocks.isSingle = true;
	mocks.getCachedAnswer.mockReset().mockReturnValue({
		id: 'cached-answer-1',
		answers: ['Вариант B'],
		idx: [1],
	});

	document.body.innerHTML = createQuizMarkup('radio');
});

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('AutoSolveLoader', () => {
	it('выбирает сохранённый radio-ответ, переходит дальше и не отвечает повторно', async () => {
		const inputs = getAnswerInputs();
		const answerClick = vi.fn();
		const nextClick = vi.fn();
		inputs[1].addEventListener('click', answerClick);
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(900);

		expect(mocks.getCachedAnswer).toHaveBeenCalledWith(
			'Кардиология - 2025',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B', 'Вариант C'],
		);
		expect(inputs[0]).not.toBeChecked();
		expect(inputs[1]).toBeChecked();
		expect(inputs[2]).not.toBeChecked();
		expect(answerClick).toHaveBeenCalledOnce();
		expect(nextClick).toHaveBeenCalledOnce();

		await advanceTime(3000);

		expect(answerClick).toHaveBeenCalledOnce();
		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('соблюдает настроенную задержку перед выбором ответа', async () => {
		mocks.delayMinSeconds = 2;
		mocks.delayMaxSeconds = 2;
		const inputs = getAnswerInputs();
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(2399);

		expect(inputs[1]).not.toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();

		await advanceTime(1);

		expect(inputs[1]).toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();

		await advanceTime(300);

		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('синхронизирует checkbox-варианты с сохранённым множественным ответом', async () => {
		mocks.isSingle = false;
		mocks.getCachedAnswer.mockReturnValue({
			id: 'cached-multi-answer',
			answers: ['Вариант A', 'Вариант C'],
			idx: [0, 2],
		});
		document.body.innerHTML = createQuizMarkup('checkbox', [1, 2]);
		const inputs = getAnswerInputs();
		const clicks = inputs.map(() => vi.fn());
		const nextClick = vi.fn();
		inputs.forEach((input, index) => input.addEventListener('click', clicks[index]));
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(3400);

		expect(inputs[0]).toBeChecked();
		expect(inputs[1]).not.toBeChecked();
		expect(inputs[2]).toBeChecked();
		expect(clicks[0]).toHaveBeenCalledOnce();
		expect(clicks[1]).toHaveBeenCalledOnce();
		expect(clicks[2]).not.toHaveBeenCalled();
		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('откладывает ответ до периода бездействия после последнего движения мыши', async () => {
		const inputs = getAnswerInputs();
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);
		render(<AutoSolveLoader/>);

		fireEvent.mouseMove(document);
		await advanceTime(1499);
		fireEvent.mouseMove(document);
		await advanceTime(1500);

		expect(inputs[1]).not.toBeChecked();

		await advanceTime(301);

		expect(inputs[1]).toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();

		await advanceTime(300);

		expect(nextClick).toHaveBeenCalledOnce();
	});

	it('подтверждает завершение теста после появления диалога', async () => {
		mocks.status = Status.WARN;
		document.body.innerHTML = createQuizMarkup('radio', [], true);
		const finishClick = vi.fn();
		const confirmClick = vi.fn();
		getNextButton().addEventListener('click', () => {
			finishClick();
			window.setTimeout(() => {
				document.body.insertAdjacentHTML('beforeend', createFinishDialogMarkup());
				document.querySelector('#finish-confirm')?.addEventListener('click', confirmClick);
			}, 100);
		});

		render(<AutoSolveLoader/>);
		await advanceTime(1000);

		expect(finishClick).toHaveBeenCalledOnce();
		expect(confirmClick).toHaveBeenCalledOnce();
	});

	it.each([
		['настройка выключена', false, Status.OK, true],
		['статус панели не разрешает автоответ', true, Status.LOADING, true],
		['ответ отсутствует в кеше', true, Status.OK, false],
	] as const)('ничего не нажимает, если %s', async (_name, enabled, status, hasCachedAnswer) => {
		mocks.autoSolveEnabled = enabled;
		mocks.status = status;
		if (!hasCachedAnswer) mocks.getCachedAnswer.mockReturnValue(null);
		const inputs = getAnswerInputs();
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(5000);

		expect(inputs.every(input => !input.checked)).toBe(true);
		expect(nextClick).not.toHaveBeenCalled();
	});

	it('игнорирует кешированную запись без индексов ответа', async () => {
		mocks.getCachedAnswer.mockReturnValue({
			id: 'cached-empty-answer',
			answers: [],
			idx: [],
		});
		const nextClick = vi.fn();
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(5000);

		expect(getAnswerInputs().every(input => !input.checked)).toBe(true);
		expect(nextClick).not.toHaveBeenCalled();
	});

	it('не нажимает недоступную кнопку перехода', async () => {
		const nextButton = getNextButton();
		nextButton.setAttribute('aria-disabled', 'true');
		const nextClick = vi.fn();
		nextButton.addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(1000);

		expect(getAnswerInputs()[1]).toBeChecked();
		expect(nextClick).not.toHaveBeenCalled();
	});

	it('использует контейнер варианта, если у radio-ответа нет input', async () => {
		document.body.innerHTML = createQuizMarkupWithoutInputs();
		const variants = Array.from(document.querySelectorAll<HTMLElement>('.mdc-form-field span'));
		const answerClick = vi.fn();
		const nextClick = vi.fn();
		variants[1].addEventListener('click', answerClick);
		getNextButton().addEventListener('click', nextClick);

		render(<AutoSolveLoader/>);
		await advanceTime(1000);

		expect(answerClick).toHaveBeenCalledOnce();
		expect(nextClick).toHaveBeenCalledOnce();
	});
});

async function advanceTime(ms: number): Promise<void> {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

function getAnswerInputs(): HTMLInputElement[] {
	return Array.from(document.querySelectorAll<HTMLInputElement>('#questionAnchor input'));
}

function getNextButton(): HTMLButtonElement {
	return document.querySelector<HTMLButtonElement>('.question-buttons-primary')!;
}

function createQuizMarkup(
	type: 'radio' | 'checkbox',
	checkedIndexes: readonly number[] = [],
	finish = false,
): string {
	const variants = ['Вариант A', 'Вариант B', 'Вариант C']
		.map((variant, index) => `
			<div class="mdc-form-field">
				<input
					id="answer-${index}"
					type="${type}"
					name="answer"
					${checkedIndexes.includes(index) ? 'checked' : ''}>
				<label for="answer-${index}"><span>${variant}</span></label>
			</div>
		`)
		.join('');

	return `
		<div id="questionAnchor">
			<div class="question-title-text">Какой вариант правильный?</div>
			${variants}
		</div>
		<div class="question-buttons">
			<button class="question-buttons-primary">
				${finish ? 'Завершить тестирование' : 'Следующий вопрос'}
			</button>
		</div>
	`;
}

function createQuizMarkupWithoutInputs(): string {
	const variants = ['Вариант A', 'Вариант B', 'Вариант C']
		.map(variant => `<div class="mdc-form-field"><span>${variant}</span></div>`)
		.join('');

	return `
		<div id="questionAnchor">
			<div class="question-title-text">Какой вариант правильный?</div>
			${variants}
		</div>
		<div class="question-buttons">
			<button class="question-buttons-primary">Следующий вопрос</button>
		</div>
	`;
}

function createFinishDialogMarkup(): string {
	return `
		<div class="mat-mdc-dialog-surface">
			<p>Выйти из тестирования?</p>
			<div class="mat-mdc-dialog-actions">
				<button>Нет</button>
				<button id="finish-confirm">Да</button>
			</div>
		</div>
	`;
}
