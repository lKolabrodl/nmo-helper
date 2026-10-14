import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {installPageStateReceiver, subscribePageState} from './subscribePageState';

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

function state(currentQuestion = 0) {
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
	unsubscribe = subscribePageState();
	vi.spyOn(window, 'postMessage').mockImplementation(data => message(data));
});
afterEach(() => {
	unsubscribe();
	vi.restoreAllMocks();
	delete pageWindow.__REDUX_DEVTOOLS_EXTENSION__;
	delete window.__NMO_HELPER_STATE__;
});

describe('подписка на State страницы', () => {
	it('получает первый снимок NgRx без Redux DevTools и заменяет его при обновлении', async () => {
		installPageStateReceiver();
		const receiver = pageWindow.__REDUX_DEVTOOLS_EXTENSION__!;
		const connection = receiver.connect({autoPause: true});
		connection.init();
		connection.subscribe(({type}) => {
			if (type === 'START') receiver.send(null, {currentStateIndex: 0, computedStates: [{state: state()}]});
		});
		await Promise.resolve();
		expect(window.__NMO_HELPER_STATE__).toEqual({
			topic: 'Тестовая тема', question: 'Первый вопрос', variants: ['A', 'B'], isSingle: true,
		});
		connection.send({type: 'NEXT'}, state(1));
		expect(window.__NMO_HELPER_STATE__).toEqual({
			topic: 'Тестовая тема', question: 'Второй вопрос', variants: ['C', 'D'], isSingle: false,
		});
		connection.send({type: 'RESET'}, {variantState: {currentQuestion: null, variant: null}});
		expect(window.__NMO_HELPER_STATE__).toBeNull();
	});

	it('берёт выбранный снимок из computedStates', () => {
		installPageStateReceiver();
		pageWindow.__REDUX_DEVTOOLS_EXTENSION__!.send(null, {
			currentStateIndex: 0, computedStates: [{state: state()}, {state: state(1)}],
		});
		expect(window.__NMO_HELPER_STATE__?.question).toBe('Первый вопрос');
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
		message({source: '@devtools-page', type: 'ACTION', payload: JSON.stringify(state(1))});
		expect(window.__NMO_HELPER_STATE__?.question).toBe('Второй вопрос');
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
