import type {IPageQuestion} from '../patch/subscribePageState';

/** Используем State только при наличии текущего вопроса и вариантов. */
function getPageQuestionState(): IPageQuestion | null {
	const question = window.__NMO_HELPER_STATE__?.question;
	return question?.question && question.variants.length ? question : null;
}

export function getTopicState(): string | null {
	return window.__NMO_HELPER_STATE__?.topic ?? null;
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
