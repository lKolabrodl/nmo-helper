/**
 * Реэкспорт всех утилит.
 * @module utils
 */

export { storageGet, storageSet } from '../api/storage';
export { fetchViaBackground } from '../api/fetch/fetch';
export {
	parseHtml,
	parseNmoApiSearchResults,
	parsePrimarySourceResults,
	parseSecondarySourceResults,
	parseThirdSourceResults,
} from './html';
export { cleanTopic, normalizeDashes, normalizeText } from './text';
export { similarity, detectSource, pickResult } from './matching';
export {getTopicState, getQuestionState, getVariantsState, isSingleAnswerState} from '../api/state';
export {
	findCompletedQuizResults,
	getAnswerClickTarget,
	getAnswerInput,
	getFinishQuizButton,
	getFinishQuizConfirmButton,
	getNextQuestionButton,
	getQuizActionsElement,
	getTopicElement,
	getTopicText,
	getQuestionAnchor,
	getQuestionText,
	getQuestionHtml,
	findVariantElements,
	getVariantElements,
	getVariantTexts,
	isSingleAnswer,
	queryAll,
	queryFirst,
} from '../api/dom';
