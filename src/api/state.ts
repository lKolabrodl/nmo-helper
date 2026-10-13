import type {IPageQuestionState} from '../patch/subscribePageState';

/** Используем State только при наличии текущего вопроса и вариантов. */
function getPageQuestionState(): IPageQuestionState | null {
	const state = window.__NMO_HELPER_STATE__;
	return state?.question && state.variants.length ? state : null;
}

export function getTopicState(): string | null {
	return getPageQuestionState()?.topic ?? null;
}

export function getQuestionState(): string | null {
	return getPageQuestionState()?.question ?? null;
}

export function getVariantsState(): string[] | null {
	return getPageQuestionState()?.variants ?? null;
}

export function isSingleAnswerState(): boolean | null {
	return getPageQuestionState()?.isSingle ?? null;
}
