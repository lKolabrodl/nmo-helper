import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {QuestionFinderProvider} from '../../contexts/QuestionFinderContext';
import {PAGE_STATE_UPDATED} from '../../patch/subscribePageState';
import {HIGHLIGHT_COLOR} from '../../utils/constants';
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
	expect(document.getElementById(id)).toHaveStyle({color: HIGHLIGHT_COLOR});
}

describe('AnswerHighlighter', () => {
	it('ищет в кеше по данным контекста и подсвечивает текст без известных классов', () => {
		document.body.innerHTML = '<main><p id="b">B</p><p id="a">A</p></main>';
		mountHighlighter();
		tick();

		expect(mocks.get).toHaveBeenCalledWith('Тема из контекста', 'Вопрос из контекста', ['A', 'B']);
		expectHighlighted('b');
		expect(document.getElementById('a')?.style.color).toBe('');
	});

	it('сопоставляет ответы с текущими вариантами, когда сохранённые индексы устарели', () => {
		document.body.innerHTML = '<div id="questionAnchor"><p id="a">A</p><p id="b">B</p></div>';
		mocks.get.mockReturnValue({id: 'cached-answer', answers: [' b '], idx: [0]});
		mountHighlighter();
		tick();

		expectHighlighted('b');
		expect(document.getElementById('a')?.style.color).toBe('');
	});

	it('использует запасной селектор, когда текст варианта не найден', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mdc-form-field"><span id="a">1. A</span></div>
				<div class="mdc-form-field"><span id="b">2. B</span></div>
			</div>
		`;
		mountHighlighter();
		tick();

		expectHighlighted('b');
		expect(document.getElementById('a')?.style.color).toBe('');
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
		expect(document.getElementById('b')?.style.color).toBe('');

		mocks.get.mockReturnValue({id: 'cached-answer', answers: ['B'], idx: [1]});
		tick();
		expectHighlighted('b');
		expect(mocks.setStatus).not.toHaveBeenCalled();
	});

	it('повторяет подсветку после замены DOM-элемента', () => {
		document.body.innerHTML = '<main><p id="b">B</p></main>';
		mountHighlighter();
		tick();

		document.getElementById('b')!.outerHTML = '<label id="replacement">B</label>';
		tick();

		expectHighlighted('replacement');
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
