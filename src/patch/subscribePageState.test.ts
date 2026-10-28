import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {installPageStateReceiver, PAGE_STATE_UPDATED, subscribePageState} from './subscribePageState';

interface Connection {
	init(state?: unknown): void;
	send(action: unknown, state: unknown): void;
	subscribe(listener: (message: {type: 'START'}) => void): void;
	unsubscribe(): void;
}
interface Receiver {
	connect(options?: unknown): Connection;
	send(action: unknown, state: unknown): void;
}
const pageWindow = window as Window & {__REDUX_DEVTOOLS_EXTENSION__?: Receiver};
let unsubscribe: () => void;
const questions = [
	{question: 'Первый вопрос', variants: ['A', 'B'], isSingle: true},
	{question: 'Второй вопрос', variants: ['C', 'D'], isSingle: false},
];
const withoutCurrentQuestion = {
	topic: 'Тестовая тема', question: null, questions,
};
const onStateUpdated = vi.fn();

function state(currentQuestion: number | null = 0) {
	return {variantState: {currentQuestion, variant: {
		title: 'Тестовая тема', finishTime: null,
		questions: [
			{stringContent: 'Первый вопрос', type: 'single', answers: [{stringContent: 'A'}, {stringContent: 'B'}]},
			{stringContent: 'Второй вопрос', type: 'multi', answers: [{stringContent: 'C'}, {stringContent: 'D'}]},
		],
	}}};
}

function message(data: unknown, origin = window.location.origin) {
	window.dispatchEvent(new MessageEvent('message', {source: window, origin, data}));
}

beforeEach(() => {
	onStateUpdated.mockClear();
	window.addEventListener(PAGE_STATE_UPDATED, onStateUpdated);
	unsubscribe = subscribePageState();
	vi.spyOn(window, 'postMessage').mockImplementation(data => message(data));
});
afterEach(() => {
	unsubscribe();
	window.removeEventListener(PAGE_STATE_UPDATED, onStateUpdated);
	vi.restoreAllMocks();
	delete pageWindow.__REDUX_DEVTOOLS_EXTENSION__;
	delete window.__NMO_HELPER_STATE__;
});

describe('подписка на State страницы', () => {
	it('получает вопросы до старта и обновляет текущий вопрос через приёмник NgRx', async () => {
		installPageStateReceiver();
		const receiver = pageWindow.__REDUX_DEVTOOLS_EXTENSION__!;
		const connection = receiver.connect({autoPause: true});
		connection.init();
		connection.subscribe(({type}) => {
			if (type === 'START') receiver.send(null, {currentStateIndex: 0, computedStates: [{state: state(null)}]});
		});
		await Promise.resolve();
		expect(window.__NMO_HELPER_STATE__).toEqual(withoutCurrentQuestion);
		expect(onStateUpdated).toHaveBeenCalledTimes(1);
		connection.send({type: 'START_TEST'}, state());
		expect(window.__NMO_HELPER_STATE__).toEqual({
			topic: 'Тестовая тема', question: questions[0], questions,
		});
		connection.send({type: 'NEXT'}, state(1));
		expect(window.__NMO_HELPER_STATE__).toEqual({
			topic: 'Тестовая тема', question: questions[1], questions,
		});
		connection.send({type: 'CLEAR_CURRENT'}, state(null));
		expect(window.__NMO_HELPER_STATE__).toEqual(withoutCurrentQuestion);
		expect(onStateUpdated).toHaveBeenCalledTimes(4);
		connection.send({type: 'RESET'}, {variantState: {currentQuestion: null, variant: null}});
		expect(window.__NMO_HELPER_STATE__).toBeNull();
		expect(onStateUpdated).toHaveBeenCalledTimes(5);
	});

	it.each([
		{label: 'null', currentQuestion: null},
		{label: 'отсутствует', currentQuestion: undefined},
		{label: 'отрицательный индекс', currentQuestion: -1},
		{label: 'индекс за пределами списка', currentQuestion: 2},
		{label: 'дробный индекс', currentQuestion: 0.5},
		{label: 'строка вместо индекса', currentQuestion: '0'},
	])('сохраняет список вопросов без текущего вопроса, когда currentQuestion $label', ({currentQuestion}) => {
		const variantState: {variant: unknown; currentQuestion?: unknown} = {variant: state().variantState.variant};
		if (currentQuestion !== undefined) variantState.currentQuestion = currentQuestion;
		installPageStateReceiver();
		pageWindow.__REDUX_DEVTOOLS_EXTENSION__!.send(null, {variantState});
		expect(window.__NMO_HELPER_STATE__).toEqual(withoutCurrentQuestion);
		expect(onStateUpdated).toHaveBeenCalledTimes(1);
	});

	it('очищает снимок при завершении теста', () => {
		const snapshot = state();
		installPageStateReceiver();
		const receiver = pageWindow.__REDUX_DEVTOOLS_EXTENSION__!;
		receiver.send(null, snapshot);
		receiver.send(null, {variantState: {
			...snapshot.variantState,
			variant: {...snapshot.variantState.variant, finishTime: '2026-10-28T12:00:00Z'},
		}});
		expect(window.__NMO_HELPER_STATE__).toBeNull();
		expect(onStateUpdated).toHaveBeenCalledTimes(2);
	});

	it('берёт выбранный снимок из computedStates', () => {
		installPageStateReceiver();
		pageWindow.__REDUX_DEVTOOLS_EXTENSION__!.send(null, {
			currentStateIndex: 0, computedStates: [{state: state()}, {state: state(1)}],
		});
		expect(window.__NMO_HELPER_STATE__?.question).toEqual(questions[0]);
	});

	it('пропускает повреждённые и неподдерживаемые соседние вопросы, сохраняя текущий', () => {
		const snapshot = state();
		installPageStateReceiver();
		pageWindow.__REDUX_DEVTOOLS_EXTENSION__!.send(null, {
			variantState: {
				currentQuestion: 2,
				variant: {
					...snapshot.variantState.variant,
					questions: [
						null,
						...snapshot.variantState.variant.questions,
						{stringContent: 'Свободный ответ', type: 'text', answers: []},
						{stringContent: 'Пустые варианты', type: 'single', answers: []},
						{stringContent: 'Повреждённый вариант', type: 'multi', answers: [{stringContent: ' '}]},
						{stringContent: 42, type: 'single', answers: [{stringContent: 'A'}]},
					],
				},
			},
		});
		expect(window.__NMO_HELPER_STATE__).toEqual({
			topic: 'Тестовая тема', question: questions[1], questions,
		});
	});

	it('отменяет START при отключении подписки NgRx', async () => {
		installPageStateReceiver();
		const connection = pageWindow.__REDUX_DEVTOOLS_EXTENSION__!.connect();
		const listener = vi.fn();
		connection.subscribe(listener);
		connection.unsubscribe();
		await Promise.resolve();
		expect(listener).not.toHaveBeenCalled();
	});

	it('при установленном DevTools читает его сообщения и сохраняет его интерфейс', () => {
		const native = {connect: vi.fn(), send: vi.fn()};
		pageWindow.__REDUX_DEVTOOLS_EXTENSION__ = native;
		installPageStateReceiver();
		expect(pageWindow.__REDUX_DEVTOOLS_EXTENSION__).toBe(native);
		message({source: '@devtools-page', type: 'INIT', payload: JSON.stringify(state(null))});
		expect(window.__NMO_HELPER_STATE__).toEqual(withoutCurrentQuestion);
		message({source: '@devtools-page', type: 'ACTION', payload: JSON.stringify(state(1))});
		expect(window.__NMO_HELPER_STATE__).toEqual({
			topic: 'Тестовая тема', question: questions[1], questions,
		});
		expect(onStateUpdated).toHaveBeenCalledTimes(2);
	});

	it('проверяет вложенный текущий вопрос и отклоняет прежнюю плоскую модель', () => {
		const payload = {...withoutCurrentQuestion, question: questions[0]};
		message({source: '@nmo-helper-state', payload});
		expect(window.__NMO_HELPER_STATE__).toEqual(payload);
		const previous = window.__NMO_HELPER_STATE__;
		for (const invalidPayload of [
			{topic: payload.topic, ...questions[0], questions},
			{...payload, question: {...questions[0], variants: ['A', 42]}},
			{...payload, question: {...questions[0], isSingle: null}},
		]) {
			message({source: '@nmo-helper-state', payload: invalidPayload});
			expect(window.__NMO_HELPER_STATE__).toBe(previous);
		}
		expect(onStateUpdated).toHaveBeenCalledTimes(1);
	});

	it.each([
		{label: 'отсутствующий список', invalidQuestions: undefined},
		{label: 'null вместо списка', invalidQuestions: null},
		{label: 'объект вместо списка', invalidQuestions: {}},
		{label: 'null вместо вопроса', invalidQuestions: [null]},
		{label: 'нестроковый текст', invalidQuestions: [{...questions[0], question: 42}]},
		{label: 'нестроковый вариант', invalidQuestions: [{...questions[0], variants: ['A', 42]}]},
		{label: 'неверный тип ответа', invalidQuestions: [{...questions[0], isSingle: 'true'}]},
	])('отклоняет повреждённый questions в сообщении приёмника: $label', ({invalidQuestions}) => {
		const payload = withoutCurrentQuestion;
		message({source: '@nmo-helper-state', payload});
		expect(window.__NMO_HELPER_STATE__).toEqual(payload);
		const previous = window.__NMO_HELPER_STATE__;
		message({source: '@nmo-helper-state', payload: {...payload, questions: invalidQuestions}});
		expect(window.__NMO_HELPER_STATE__).toBe(previous);
		expect(onStateUpdated).toHaveBeenCalledTimes(1);
	});

	it('игнорирует посторонние сообщения и освобождает подписку', () => {
		message({source: '@devtools-page', type: 'ACTION', payload: '{broken'});
		message({source: '@devtools-page', type: 'ACTION', payload: state()}, 'https://other.example');
		message({source: '@nmo-helper-state', payload: {question: 'invalid'}});
		expect(window.__NMO_HELPER_STATE__).toBeUndefined();
		unsubscribe();
		message({source: '@devtools-page', type: 'ACTION', payload: state()});
		expect(window.__NMO_HELPER_STATE__).toBeUndefined();
	});
});
