import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {QuestionFinderProvider} from '../../contexts/QuestionFinderContext';
import {PAGE_STATE_UPDATED} from '../../patch/subscribePageState';
import {HIGHLIGHT_CLASS} from '../../utils/constants';
import {Status} from '../../types';
import AnswerHighlighter from './AnswerHighlighter';

const mocks = vi.hoisted(() => ({get: vi.fn(), fresh: vi.fn(), setStatus: vi.fn()}));

vi.mock('../../utils/answer-cache', () => ({
	answerCache: {get: mocks.get, fresh: mocks.fresh},
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({setStatus: mocks.setStatus}),
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
	vi.useFakeTimers();
	vi.resetAllMocks();
	document.body.innerHTML = '';
	window.__NMO_HELPER_STATE__ = {
		topic: 'Тема из контекста',
		question: {question: 'Вопрос из контекста', variants: ['A', 'B'], isSingle: true},
		questions: [],
	};
	mocks.get.mockReturnValue({id: 'cached-answer', answers: ['B'], idx: [1]});
	mocks.fresh.mockReturnValue(true);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	delete window.__NMO_HELPER_STATE__;
});

function mountHighlighter() {
	return render(<QuestionFinderProvider><AnswerHighlighter/></QuestionFinderProvider>);
}

function tick() {
	act(() => vi.advanceTimersByTime(200));
}

function expectHighlighted(id: string) {
	expect(document.getElementById(id)).toHaveClass(HIGHLIGHT_CLASS);
}

function expectNotHighlighted(id: string) {
	expect(document.getElementById(id)).not.toHaveClass(HIGHLIGHT_CLASS);
}

function updateQuestion(question: string | null, variants: string[], isSingle = true) {
	act(() => {
		window.__NMO_HELPER_STATE__ = {
			topic: 'Тема из контекста',
			question: question === null ? null : {question, variants, isSingle},
			questions: [],
		};
		window.dispatchEvent(new Event(PAGE_STATE_UPDATED));
	});
}

describe('AnswerHighlighter', () => {
	it('ищет в кеше по данным контекста и подсвечивает текст без известных классов', () => {
		document.body.innerHTML = '<main><p id="b">B</p><p id="a">A</p></main>';
		mountHighlighter();
		tick();

		expect(mocks.get).toHaveBeenCalledWith('Тема из контекста', 'Вопрос из контекста', ['A', 'B']);
		expectHighlighted('b');
		expectNotHighlighted('a');
	});

	it('сопоставляет ответы с текущими вариантами, когда сохранённые индексы устарели', () => {
		document.body.innerHTML = '<div id="questionAnchor"><p id="a">A</p><p id="b">B</p></div>';
		mocks.get.mockReturnValue({id: 'cached-answer', answers: [' b '], idx: [0]});
		mountHighlighter();
		tick();

		expectHighlighted('b');
		expectNotHighlighted('a');
	});

	it('сопоставляет пронумерованные варианты по тексту', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mdc-form-field"><span id="a">1. A</span></div>
				<div class="mdc-form-field"><span id="b">2. B</span></div>
			</div>
		`;
		mountHighlighter();
		tick();

		expectHighlighted('b');
		expectNotHighlighted('a');
	});

	it('не сдвигает правильный индекс, если другой вариант не найден', () => {
		document.body.innerHTML = '<main><p id="b">B</p></main>';
		mountHighlighter();
		tick();

		expectHighlighted('b');
	});

	it('реагирует на ответ, появившийся в кеше без изменения контекста', () => {
		document.body.innerHTML = '<main><p id="a">A</p><p id="b">B</p></main>';
		mocks.get.mockReturnValue(null);
		mountHighlighter();
		tick();
		expectNotHighlighted('b');

		mocks.get.mockReturnValue({id: 'cached-answer', answers: ['B'], idx: [1]});
		tick();
		expectHighlighted('b');
		expect(mocks.setStatus).not.toHaveBeenCalled();
	});

	it('повторяет подсветку после замены DOM-элемента', () => {
		document.body.innerHTML = '<main><p id="b">B</p></main>';
		mountHighlighter();
		tick();

		const previous = document.getElementById('b')!;
		previous.outerHTML = '<label id="replacement">B</label>';
		tick();

		expectHighlighted('replacement');
		expect(previous).not.toHaveClass(HIGHLIGHT_CLASS);
	});

	it('обновляет данные после смены вопроса в контексте', () => {
		document.body.innerHTML = '<main><p id="b">B</p></main>';
		mountHighlighter();
		tick();

		act(() => {
			window.__NMO_HELPER_STATE__ = {
				topic: null,
				question: {question: 'Следующий вопрос', variants: ['C', 'D'], isSingle: true},
				questions: [],
			};
			window.dispatchEvent(new Event(PAGE_STATE_UPDATED));
		});
		document.querySelector('main')!.innerHTML = '<p id="d">D</p>';
		mocks.get.mockReturnValue({id: 'next-answer', answers: ['D'], idx: [1]});
		tick();

		expect(mocks.get).toHaveBeenLastCalledWith('', 'Следующий вопрос', ['C', 'D']);
		expectHighlighted('d');
	});

	it('снимает старую подсветку при переиспользовании узлов между вопросами', () => {
		document.body.innerHTML = '<main><p id="a">A</p><p id="b">B</p></main>';
		mountHighlighter();
		tick();
		expectHighlighted('b');

		document.getElementById('a')!.textContent = 'C';
		document.getElementById('b')!.textContent = 'D';
		mocks.get.mockReturnValue({id: 'next-answer', answers: ['C'], idx: [0]});
		updateQuestion('Следующий вопрос', ['C', 'D']);
		expectNotHighlighted('b');
		tick();

		expectHighlighted('a');
		expectNotHighlighted('b');
		expect(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(1);
	});

	it('переносит подсветку после перестановки текстов в тех же узлах без смены контекста', () => {
		document.body.innerHTML = '<main><p id="a">A</p><p id="b">B</p></main>';
		mountHighlighter();
		tick();
		expectHighlighted('b');

		document.getElementById('a')!.textContent = 'B';
		document.getElementById('b')!.textContent = 'A';
		tick();

		expectHighlighted('a');
		expectNotHighlighted('b');
	});

	it('обновляет подсветку после исправления ответа в кеше без смены вопроса', () => {
		document.body.innerHTML = '<main><p id="a">A</p><p id="b">B</p></main>';
		mountHighlighter();
		tick();
		expectHighlighted('b');

		mocks.get.mockReturnValue({id: 'cached-answer', answers: ['A'], idx: [0]});
		tick();

		expectHighlighted('a');
		expectNotHighlighted('b');
	});

	it.each([
		{label: 'ответ удалён из кеша', cached: null},
		{label: 'ответ в кеше пустой', cached: {id: 'cached-answer', answers: [], idx: []}},
		{label: 'ответ не совпадает с вариантами', cached: {id: 'cached-answer', answers: ['C'], idx: []}},
	])('очищает подсветку, если $label', ({cached}) => {
		document.body.innerHTML = '<main><p id="a">A</p><p id="b">B</p></main>';
		mountHighlighter();
		tick();
		expectHighlighted('b');

		mocks.get.mockReturnValue(cached);
		tick();

		expectNotHighlighted('a');
		expectNotHighlighted('b');
	});

	it('ждёт DOM текущих вариантов при совпадающем количестве старых элементов', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mdc-form-field"><span id="first">Старый X</span></div>
				<div class="mdc-form-field"><span id="second">Старый Y</span></div>
			</div>
		`;
		mountHighlighter();
		tick();
		expectNotHighlighted('first');
		expectNotHighlighted('second');

		document.getElementById('first')!.textContent = 'B';
		document.getElementById('second')!.textContent = 'A';
		tick();

		expectHighlighted('first');
		expectNotHighlighted('second');
	});

	it('ждёт текст текущего вопроса, даже когда варианты старого вопроса совпадают', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="question-title-text">Предыдущий вопрос</div>
				<p id="a">A</p><p id="b">B</p>
			</div>
		`;
		mountHighlighter();
		tick();
		expectNotHighlighted('a');
		expectNotHighlighted('b');
		expect(mocks.setStatus).not.toHaveBeenCalled();

		document.querySelector('.question-title-text')!.textContent = 'Вопрос из контекста';
		tick();

		expectHighlighted('b');
	});

	it('снимает подсветку, когда DOM уже показывает другой вопрос с теми же вариантами', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="question-title-text">Вопрос из контекста</div>
				<p id="a">A</p><p id="b">B</p>
			</div>
		`;
		mountHighlighter();
		tick();
		expectHighlighted('b');

		document.querySelector('.question-title-text')!.textContent = 'Следующий вопрос';
		tick();
		expectNotHighlighted('b');

		mocks.get.mockReturnValue({id: 'next-answer', answers: ['A'], idx: [0]});
		updateQuestion('Следующий вопрос', ['A', 'B']);
		tick();
		expectHighlighted('a');
		expectNotHighlighted('b');
	});

	it('сохраняет оформление портала и его изменения во время подсветки', () => {
		document.body.innerHTML = '<main><p id="b" class="portal-selected" style="color: purple; font-weight: bold">B</p></main>';
		mountHighlighter();
		tick();
		const element = document.getElementById('b')!;
		expectHighlighted('b');
		expect(element).toHaveClass('portal-selected');
		expect(element.style.color).toBe('purple');
		expect(element.style.fontWeight).toBe('bold');

		element.style.color = 'orange';
		mocks.get.mockReturnValue(null);
		tick();

		expectNotHighlighted('b');
		expect(element).toHaveClass('portal-selected');
		expect(element.style.color).toBe('orange');
		expect(element.style.fontWeight).toBe('bold');
	});

	it('восстанавливает свою отметку после удаления класса порталом', () => {
		document.body.innerHTML = '<main><p id="b">B</p></main>';
		mountHighlighter();
		tick();
		const element = document.getElementById('b')!;
		element.classList.remove(HIGHLIGHT_CLASS);
		tick();

		expectHighlighted('b');
	});

	it('снимает свою подсветку при размонтировании, сохраняя классы и цвет портала', () => {
		document.body.innerHTML = '<main><p id="b" class="portal-selected" style="color: purple">B</p></main>';
		const {unmount} = mountHighlighter();
		tick();
		expectHighlighted('b');

		unmount();

		expectNotHighlighted('b');
		expect(document.getElementById('b')).toHaveClass('portal-selected');
		expect(document.getElementById('b')?.style.color).toBe('purple');
	});

	it('очищает подсветку после исчезновения текущего вопроса', () => {
		document.body.innerHTML = '<main><p id="b">B</p></main>';
		mountHighlighter();
		tick();
		expectHighlighted('b');

		updateQuestion(null, []);

		expectNotHighlighted('b');
	});

	it('сохраняет несколько правильных вариантов для множественного выбора', () => {
		document.body.innerHTML = '<main><p id="a">A</p><p id="b">B</p><p id="c">C</p></main>';
		updateQuestion('Вопрос из контекста', ['A', 'B', 'C'], false);
		mocks.get.mockReturnValue({id: 'multi-answer', answers: ['A', 'C'], idx: [0, 2]});
		mountHighlighter();
		tick();

		expectHighlighted('a');
		expectNotHighlighted('b');
		expectHighlighted('c');
		expect(document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)).toHaveLength(2);
	});

	it('выводит статус кеша один раз для ранее сохранённого ответа', () => {
		document.body.innerHTML = '<main><p id="b">B</p></main>';
		mocks.fresh.mockReturnValue(false);
		mountHighlighter();
		tick();
		tick();

		expect(mocks.setStatus).toHaveBeenCalledExactlyOnceWith({title: 'найдено в памяти', status: Status.OK});
	});

	it('ждёт появления правильного элемента перед сменой статуса', () => {
		document.body.innerHTML = '<main><p>A</p></main>';
		mocks.fresh.mockReturnValue(false);
		mountHighlighter();
		tick();
		expect(mocks.setStatus).not.toHaveBeenCalled();

		document.querySelector('main')!.innerHTML = '<p id="b">B</p>';
		tick();
		expectHighlighted('b');
		expect(mocks.setStatus).toHaveBeenCalledExactlyOnceWith({title: 'найдено в памяти', status: Status.OK});
	});
});
