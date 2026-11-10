import {act, cleanup, fireEvent, render, type RenderResult} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Status} from '../../types';
import AutoSolveLoader from './AutoSolveLoader';

const mocks = vi.hoisted(() => ({
	enabled: true,
	min: 5,
	max: 12,
	count: 0,
	status: 'ok',
	topic: 'Кардиология - 2025',
	question: 'Какой вариант правильный?' as string | null,
	variants: ['Вариант A', 'Вариант B', 'Вариант C'],
	isSingle: true,
	getCachedAnswer: vi.fn(),
	cycleCounter: vi.fn(),
}));

vi.mock('../../hooks/useCycleCounter', () => ({useCycleCounter: mocks.cycleCounter}));
vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({autoSolve: {enabled: mocks.enabled, delayMinSeconds: mocks.min, delayMaxSeconds: mocks.max}}),
}));
vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({status: {title: 'Ответ найден', status: mocks.status}}),
}));
vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({
		topic: mocks.topic, question: mocks.question, variants: mocks.variants, isSingle: mocks.isSingle,
	}),
}));
vi.mock('../../utils/answer-cache', () => ({answerCache: {get: mocks.getCachedAnswer}}));

beforeEach(() => {
	mocks.enabled = true;
	mocks.min = 5;
	mocks.max = 12;
	mocks.count = 0;
	mocks.status = Status.OK;
	mocks.topic = 'Кардиология - 2025';
	mocks.question = 'Какой вариант правильный?';
	mocks.variants = ['Вариант A', 'Вариант B', 'Вариант C'];
	mocks.isSingle = true;
	mocks.cycleCounter.mockReset().mockImplementation(() => mocks.count);
	mocks.getCachedAnswer.mockReset().mockReturnValue({id: 'cached-answer', answers: ['Вариант B'], idx: [1]});
	document.body.innerHTML = createQuizMarkup('radio');
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	document.body.innerHTML = '';
});

function nextCycle(view: RenderResult): void {
	mocks.count += 1;
	view.rerender(<AutoSolveLoader/>);
}

function getAnswerInputs(): HTMLInputElement[] {
	return Array.from(document.querySelectorAll<HTMLInputElement>('#questionAnchor input'));
}

function watchNext(): ReturnType<typeof vi.fn> {
	const click = vi.fn();
	document.querySelector('.question-buttons-primary')!.addEventListener('click', click);
	return click;
}

describe('AutoSolveLoader', () => {
	it('с реальным хуком ждёт интервал перед выбором и новый цикл после движения мыши', async () => {
		const {useCycleCounter} = await vi.importActual<typeof import('../../hooks/useCycleCounter')>('../../hooks/useCycleCounter');
		mocks.cycleCounter.mockImplementation(useCycleCounter);
		mocks.min = 2;
		mocks.max = 2;
		vi.useFakeTimers();
		const next = watchNext();
		render(<AutoSolveLoader/>);
		act(() => vi.advanceTimersByTime(1999));
		expect(getAnswerInputs()[1]).not.toBeChecked();
		act(() => vi.advanceTimersByTime(1));
		expect(getAnswerInputs()[1]).toBeChecked();
		expect(next).not.toHaveBeenCalled();
		fireEvent.mouseMove(document);
		act(() => vi.advanceTimersByTime(1500));
		act(() => vi.advanceTimersByTime(1999));
		expect(next).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(1));
		expect(next).toHaveBeenCalledOnce();
	});

	it('передаёт хуку только enabled, min и max и ждёт первого цикла', () => {
		render(<AutoSolveLoader/>);
		expect(mocks.cycleCounter).toHaveBeenLastCalledWith(true, 5, 12);
		expect(mocks.getCachedAnswer).not.toHaveBeenCalled();
		expect(getAnswerInputs().every(input => !input.checked)).toBe(true);
	});

	it('отмечает radio-ответ на одном цикле и переходит на следующем', () => {
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(getAnswerInputs().map(input => input.checked)).toEqual([false, true, false]);
		expect(next).not.toHaveBeenCalled();
		nextCycle(view);
		expect(next).toHaveBeenCalledOnce();
	});

	it('читает свежий вопрос и статус только при изменении count', () => {
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(mocks.getCachedAnswer).toHaveBeenCalledOnce();

		mocks.topic = 'Другая тема';
		mocks.question = 'Другой вопрос';
		mocks.status = Status.WARN;
		document.querySelector('.question-title-text')!.textContent = mocks.question;
		getAnswerInputs()[1].checked = false;
		view.rerender(<AutoSolveLoader/>);
		expect(mocks.getCachedAnswer).toHaveBeenCalledOnce();
		expect(getAnswerInputs()[1]).not.toBeChecked();
		expect(next).not.toHaveBeenCalled();

		nextCycle(view);
		expect(mocks.getCachedAnswer).toHaveBeenLastCalledWith(mocks.topic, mocks.question, mocks.variants);
		expect(getAnswerInputs()[1]).toBeChecked();
		expect(next).not.toHaveBeenCalled();
	});

	it('на следующем цикле замечает ответ, появившийся в кеше', () => {
		mocks.getCachedAnswer.mockReturnValue(null);
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(getAnswerInputs()[1]).not.toBeChecked();
		mocks.getCachedAnswer.mockReturnValue({id: 'cached-answer', answers: ['Вариант B'], idx: [1]});
		view.rerender(<AutoSolveLoader/>);
		expect(getAnswerInputs()[1]).not.toBeChecked();
		nextCycle(view);
		expect(getAnswerInputs()[1]).toBeChecked();
	});

	it('синхронизирует весь множественный ответ и проверяет его следующим циклом', () => {
		mocks.isSingle = false;
		mocks.getCachedAnswer.mockReturnValue({id: 'multi', answers: ['Вариант A', 'Вариант C'], idx: [0, 2]});
		document.body.innerHTML = createQuizMarkup('checkbox', [1, 2]);
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(getAnswerInputs().map(input => input.checked)).toEqual([true, false, true]);
		expect(next).not.toHaveBeenCalled();
		nextCycle(view);
		expect(next).toHaveBeenCalledOnce();
	});

	it('ищет следующий checkbox заново после синхронной перерисовки портала', () => {
		mocks.isSingle = false;
		mocks.getCachedAnswer.mockReturnValue({id: 'multi', answers: ['Вариант A', 'Вариант C'], idx: [0, 2]});
		document.body.innerHTML = createQuizMarkup('checkbox');
		const next = watchNext();
		const refresh = () => {
			const checked = getAnswerInputs().flatMap((input, index) => input.checked ? [index] : []);
			const template = document.createElement('template');
			template.innerHTML = createQuizMarkup('checkbox', checked);
			document.getElementById('questionAnchor')!.replaceWith(template.content.querySelector('#questionAnchor')!);
			getAnswerInputs().forEach(input => input.addEventListener('click', refresh));
		};
		getAnswerInputs().forEach(input => input.addEventListener('click', refresh));
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(getAnswerInputs().map(input => input.checked)).toEqual([true, false, true]);
		expect(next).not.toHaveBeenCalled();
		nextCycle(view);
		expect(next).toHaveBeenCalledOnce();
	});

	it('не переходит дальше при неудачном клике и пробует снова только на новом count', () => {
		const answerClick = vi.fn((event: Event) => event.preventDefault());
		getAnswerInputs()[1].addEventListener('click', answerClick);
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(answerClick).toHaveBeenCalledOnce();
		expect(getAnswerInputs()[1]).not.toBeChecked();
		view.rerender(<AutoSolveLoader/>);
		expect(answerClick).toHaveBeenCalledOnce();
		nextCycle(view);
		expect(answerClick).toHaveBeenCalledTimes(2);
		expect(next).not.toHaveBeenCalled();
	});

	it('ждёт полного множественного ответа, если один из checkbox недоступен', () => {
		mocks.isSingle = false;
		mocks.getCachedAnswer.mockReturnValue({id: 'multi', answers: ['Вариант A', 'Вариант C'], idx: [0, 2]});
		document.body.innerHTML = createQuizMarkup('checkbox');
		getAnswerInputs()[2].disabled = true;
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		nextCycle(view);
		expect(getAnswerInputs().map(input => input.checked)).toEqual([true, false, false]);
		expect(next).not.toHaveBeenCalled();
		getAnswerInputs()[2].disabled = false;
		nextCycle(view);
		expect(getAnswerInputs()[2]).toBeChecked();
		expect(next).not.toHaveBeenCalled();
		nextCycle(view);
		expect(next).toHaveBeenCalledOnce();
	});

	it('сразу нажимает next, если правильный вариант уже отмечен вручную', () => {
		getAnswerInputs()[1].checked = true;
		const answerClick = vi.fn();
		getAnswerInputs()[1].addEventListener('click', answerClick);
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(answerClick).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledOnce();
	});

	it('сопоставляет ответы по тексту, когда порядок вариантов и сохранённые индексы различаются', () => {
		mocks.variants = ['Вариант B', 'Вариант A', 'Вариант C'];
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(getAnswerInputs().map(input => input.checked)).toEqual([false, true, false]);
		expect(next).not.toHaveBeenCalled();
		nextCycle(view);
		expect(next).toHaveBeenCalledOnce();
	});

	it.each([
		['выключен', false, Status.OK, true],
		['ответ ещё загружается', true, Status.LOADING, true],
		['ошибка поиска', true, Status.ERR, true],
		['ответа нет в кеше', true, Status.OK, false],
	] as const)('ничего не нажимает, если %s', (_name, enabled, status, hasAnswer) => {
		mocks.enabled = enabled;
		mocks.status = status;
		if (!hasAnswer) mocks.getCachedAnswer.mockReturnValue(null);
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(getAnswerInputs().every(input => !input.checked)).toBe(true);
		expect(next).not.toHaveBeenCalled();
	});

	it('не выбирает ответ, если DOM уже показывает другой вопрос', () => {
		document.querySelector('.question-title-text')!.textContent = 'Другой вопрос';
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(mocks.getCachedAnswer).not.toHaveBeenCalled();
		expect(getAnswerInputs().every(input => !input.checked)).toBe(true);
	});

	it('не переходит дальше без возможности прочитать отметки', () => {
		document.querySelectorAll('#questionAnchor input').forEach(input => input.remove());
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		nextCycle(view);
		expect(next).not.toHaveBeenCalled();
	});

	it('не нажимает недоступную кнопку перехода', () => {
		getAnswerInputs()[1].checked = true;
		const button = document.querySelector('.question-buttons-primary')!;
		button.setAttribute('aria-disabled', 'true');
		const next = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(next).not.toHaveBeenCalled();
		button.removeAttribute('aria-disabled');
		nextCycle(view);
		expect(next).toHaveBeenCalledOnce();
	});

	it('подтверждает завершение на следующем цикле после появления диалога', () => {
		document.body.innerHTML = createQuizMarkup('radio', [1], true);
		const finish = watchNext();
		const view = render(<AutoSolveLoader/>);
		nextCycle(view);
		expect(finish).toHaveBeenCalledOnce();
		document.body.insertAdjacentHTML('beforeend', `
			<div class="mat-mdc-dialog-surface">
				<p>Выйти из тестирования?</p>
				<div class="mat-mdc-dialog-actions"><button id="confirm">Да</button></div>
			</div>
		`);
		const confirm = vi.fn();
		document.getElementById('confirm')!.addEventListener('click', confirm);
		mocks.question = null;
		mocks.status = Status.LOADING;
		view.rerender(<AutoSolveLoader/>);
		expect(confirm).not.toHaveBeenCalled();
		nextCycle(view);
		expect(confirm).toHaveBeenCalledOnce();
	});
});

function createQuizMarkup(type: 'radio' | 'checkbox', checked: readonly number[] = [], finish = false): string {
	return `
		<div id="questionAnchor">
			<div class="question-title-text">Какой вариант правильный?</div>
			${['Вариант A', 'Вариант B', 'Вариант C'].map((text, index) => `
				<div class="mdc-form-field">
					<input id="answer-${index}" type="${type}" name="answer" ${checked.includes(index) ? 'checked' : ''}>
					<label for="answer-${index}"><span>${text}</span></label>
				</div>
			`).join('')}
		</div>
		<div class="question-buttons">
			<button class="question-buttons-primary">${finish ? 'Завершить тестирование' : 'Следующий вопрос'}</button>
		</div>
	`;
}
