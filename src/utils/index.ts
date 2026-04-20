/**
 * Реэкспорт всех утилит.
 * @module utils
 */

export { storageGet, storageSet } from './storage';
export { fetchViaBackground } from './fetch';
export { parseHtml } from './html';
export { cleanTopic, normalizeDashes, normalizeText, similarity } from './text';
export { getTopicElement, getQuestionAnchor, getQuestionText, getQuestionHtml, getVariantElements, getVariantTexts, isSingleAnswer } from './dom';
