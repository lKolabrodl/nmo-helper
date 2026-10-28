export interface IPageQuestion {
	readonly question: string;
	readonly variants: string[];
	readonly isSingle: boolean;
}

/** До старта теста question равен null, но questions уже может быть заполнен. */
export interface IPageQuestionState {
	readonly topic: string | null;
	readonly question: IPageQuestion | null;
	readonly questions: IPageQuestion[];
}

declare global {
	interface Window {
		__NMO_HELPER_STATE__?: IPageQuestionState | null;
	}
}

export const PAGE_STATE_UPDATED = 'nmo-helper-state-updated';
const MESSAGE_SOURCE = '@nmo-helper-state';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getQuestion(value: unknown): IPageQuestion | null {
	if (!isRecord(value) || typeof value.stringContent !== 'string'
		|| !Array.isArray(value.answers) || !value.answers.length
		|| (value.type !== 'single' && value.type !== 'multi')) return null;
	const variants: string[] = [];
	for (const answer of value.answers as unknown[]) {
		if (!isRecord(answer) || typeof answer.stringContent !== 'string' || !answer.stringContent.trim()) return null;
		variants.push(answer.stringContent.trim());
	}
	return {question: value.stringContent.trim(), variants, isSingle: value.type === 'single'};
}

function isPageQuestion(value: unknown): value is IPageQuestion {
	return isRecord(value) && typeof value.question === 'string'
		&& Array.isArray(value.variants) && value.variants.every(item => typeof item === 'string')
		&& typeof value.isSingle === 'boolean';
}

function isPageQuestionState(value: unknown): value is IPageQuestionState {
	if (!isRecord(value) || (value.topic !== null && typeof value.topic !== 'string')
		|| !Array.isArray(value.questions) || !value.questions.every(isPageQuestion)) return false;
	return value.question === null || isPageQuestion(value.question);
}

/** Оставляет из State тему, текущий вопрос и все загруженные вопросы теста с вариантами. */
function getQuestionState(value: unknown): IPageQuestionState | null | undefined {
	if (typeof value === 'string') {
		try { value = JSON.parse(value); } catch { return undefined; }
	}
	if (Array.isArray(value)) value = value[value.length - 1];
	if (!isRecord(value)) return undefined;
	if (Array.isArray(value.computedStates)) {
		const index = typeof value.currentStateIndex === 'number'
			? value.currentStateIndex : value.computedStates.length - 1;
		const entry: unknown = value.computedStates[index] ?? value.computedStates[value.computedStates.length - 1];
		value = isRecord(entry) ? entry.state : undefined;
	}
	if (!isRecord(value) || !isRecord(value.variantState)) return undefined;
	const {variant, currentQuestion} = value.variantState;
	if (!isRecord(variant) || variant.finishTime || !Array.isArray(variant.questions)) return null;
	const questions = (variant.questions as unknown[]).map(getQuestion);
	const question = typeof currentQuestion === 'number' && Number.isInteger(currentQuestion)
		? questions[currentQuestion] : null;
	return {
		topic: typeof variant.title === 'string' ? variant.title.trim() : null,
		question: question ?? null,
		questions: questions.filter((item): item is IPageQuestion => item !== null),
	};
}

/** Подписка из content.ts: каждое обновление заменяет глобальную переменную. */
export function subscribePageState(): () => void {
	const listener = (event: MessageEvent<unknown>): void => {
		if (event.source !== window || event.origin !== window.location.origin || !isRecord(event.data)) return;
		const message = event.data;
		let question: IPageQuestionState | null | undefined;
		if (message.source === MESSAGE_SOURCE) {
			const payload = message.payload;
			if (payload !== null && !isPageQuestionState(payload)) return;
			question = payload;
		} else if (message.source === '@devtools-page'
			&& ['INIT', 'ACTION', 'STATE', 'PARTIAL_STATE'].includes(String(message.type))) {
			question = getQuestionState(message.payload);
		}
		if (question === undefined) return;
		window.__NMO_HELPER_STATE__ = question;
		window.dispatchEvent(new Event(PAGE_STATE_UPDATED));
	};
	window.addEventListener('message', listener);
	return () => window.removeEventListener('message', listener);
}

/** Приёмник NgRx без Redux DevTools. Запускается в MAIN до приложения сайта. */
export function installPageStateReceiver(): void {
	const pageWindow = window as Window & {__REDUX_DEVTOOLS_EXTENSION__?: unknown};
	if (pageWindow.__REDUX_DEVTOOLS_EXTENSION__) return;
	const publish = (state: unknown): void => {
		const question = getQuestionState(state);
		if (question === undefined) return;
		window.__NMO_HELPER_STATE__ = question;
		window.postMessage({source: MESSAGE_SOURCE, payload: question}, window.location.origin);
	};
	pageWindow.__REDUX_DEVTOOLS_EXTENSION__ = {
		send: (_action: unknown, state: unknown) => publish(state),
		connect: () => {
			let active = true;
			return {
				init: publish,
				send: (_action: unknown, state: unknown) => publish(state),
				subscribe: (listener: (message: {type: 'START'}) => void) => {
					// Даём NgRx установить подписки перед запросом первого снимка.
					Promise.resolve().then(() => { if (active) listener({type: 'START'}); });
				},
				unsubscribe: () => { active = false; },
				error: () => {},
			};
		},
	};
}
