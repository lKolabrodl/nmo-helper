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
export {
	findCompletedQuizResults,
	getAnswerClickTarget,
	getAnswerInput,
	getFinishQuizButton,
	getFinishQuizConfirmButton,
	getNextQuestionButton,
	getQuizActionsElement,
	getTopicElement,
	getQuestionAnchor,
	getQuestionText,
	getQuestionHtml,
	getVariantElements,
	getVariantTexts,
	isSingleAnswer,
	queryAll,
	queryFirst,
} from '../api/dom';
