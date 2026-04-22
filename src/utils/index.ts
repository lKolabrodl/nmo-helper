/**
 * Реэкспорт всех утилит.
 * @module utils
 */

export { storageGet, storageSet } from '../api/storage';
export { fetchViaBackground } from '../api/fetch';
export { parseHtml } from './html';
export { cleanTopic, normalizeDashes, normalizeText } from './text';
export { similarity, detectSource } from './matching';
export { getTopicElement, getQuestionAnchor, getQuestionText, getQuestionHtml, getVariantElements, getVariantTexts, isSingleAnswer } from '../api/dom';
