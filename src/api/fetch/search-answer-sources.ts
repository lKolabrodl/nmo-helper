/**
 * Получение ответов из поддерживаемых источников.
 *
 * @module api/fetch/search-answer-sources
 */

import type {QaCaseModel} from '../../utils/cases';
import {CACHE_MAX_TOPICS, NMO_API_TOPIC_ENDPOINT} from '../../utils/constants';
import {extractFirstCases, extractNmoAnswer, extractSecondCases, extractThirdAnser, extractThirdQuestions, type INmoSourceQuestion} from '../../utils/extractors';
import {parseHtml} from '../../utils/html';
import {fetchViaBackground, getResponseText, isSuccessful, mapWithConcurrency} from './fetch';

/** Максимальное число одновременно выполняемых запросов правильных ответов. */
const ANSWER_REQUEST_CONCURRENCY = 6;
const nmoAnswerCache = new Map<string, Promise<QaCaseModel[]>>();

/** Готовый вопрос третьего источника с идентификатором и правильными вариантами. */
export interface INmoSourceCase extends QaCaseModel {
	/** Идентификатор вопроса из атрибута `data-docid`. */
	readonly docId: string;
	/** Уникальные 0-индексированные позиции правильных вариантов. */
	readonly correctIndexes: number[];
}

/** Загружает и разбирает страницу ответов первого источника. */
export async function getFirstAnswers(url: string): Promise<QaCaseModel[]> {
	const response = await fetchViaBackground(url);
	const text = getResponseText(response);

	return extractFirstCases(parseHtml(text, true));
}

/** Загружает и разбирает страницу ответов второго источника. */
export async function getSecondAnswers(url: string): Promise<QaCaseModel[]> {
	const response = await fetchViaBackground(url);
	const text = getResponseText(response);

	return extractSecondCases(parseHtml(text, true));
}

/**
 * Получает ответы полного варианта по внутреннему URL результата поиска NMO API.
 * UID извлекается из последнего сегмента URL и передаётся API только в заголовке;
 * сам сетевой запрос всегда выполняется на фиксированный endpoint.
 *
 * @param url URL результата NMO API в формате `/api/nmo/topic/<uid>`.
 * @returns Готовая модель всех вопросов и правильных ответов варианта.
 * @throws {Error} Если URL невалиден, UID истёк, запрос не удался или ответ невалиден.
 */
export async function getNmoAnswers(url: string): Promise<QaCaseModel[]> {
	const uid = url.trim().match(/\/api\/nmo\/topic\/([^/?#]+)$/)?.[1];
	if (!uid) throw new Error('некорректный URL NMO API');
	const cached = nmoAnswerCache.get(uid);
	if (cached) {
		nmoAnswerCache.delete(uid);
		nmoAnswerCache.set(uid, cached);
		return cloneNmoAnswers(await cached);
	}

	const answers = requestNmoAnswers(uid);
	nmoAnswerCache.set(uid, answers);
	trimNmoAnswerCache();
	try {
		return cloneNmoAnswers(await answers);
	} catch (error) {
		if (nmoAnswerCache.get(uid) === answers) nmoAnswerCache.delete(uid);
		throw error;
	}
}

async function requestNmoAnswers(uid: string): Promise<QaCaseModel[]> {
	const response = await fetchViaBackground(NMO_API_TOPIC_ENDPOINT, {
		method: 'GET',
		headers: {
			'Accept': 'application/json',
			'X-NMO-Ticket': uid,
		},
		credentials: 'omit',
	});
	const text = getResponseText(response);

	return extractNmoAnswer(text);
}

/** Очищает кеш полностью загруженных вариантов NMO API. */
export function clearNmoAnswerCache(): void {
	nmoAnswerCache.clear();
}

function cloneNmoAnswers(items: readonly QaCaseModel[]): QaCaseModel[] {
	return items.map(item => ({
		...item,
		variants: [...item.variants],
		answers: [...item.answers],
	}));
}

function trimNmoAnswerCache(): void {
	while (nmoAnswerCache.size > CACHE_MAX_TOPICS) {
		const oldestUid = nmoAnswerCache.keys().next().value;
		if (oldestUid === undefined) return;
		nmoAnswerCache.delete(oldestUid);
	}
}

/**
 * Загружает до трёх страниц третьего источника и затем получает правильные
 * индексы отдельным API-запросом для каждого уникального `data-docid`.
 *
 * HTML-страницы загружаются с `include`, чтобы сохранить их общую сессию.
 * Запросы `/api/question/.../answer` используют `omit` и не отправляют cookies.
 * Ошибка или отсутствие дополнительных страниц не мешает обработать первую.
 * В итог попадают только вопросы с успешным и валидным API-ответом.
 *
 * @param url Базовый URL первой страницы без query-string; для дополнительных
 *            страниц к нему добавляются `?page=2` и `?page=3`.
 * @returns Модели вопросов с вариантами, правильными индексами и текстами ответов.
 * @throws {Error} Если первая страница недоступна, вернула ошибочный HTTP-статус
 *                 или пустое тело.
 * @throws {Error} Если вопросы найдены, но ни один ответ API загрузить не удалось.
 */
export async function getThirdAnswers(url: string): Promise<INmoSourceCase[]> {
	const firstPageUrl = url;
	const secondPageUrl = `${url}?page=2`;
	const thirdPageUrl = `${url}?page=3`;
	const requestOptions = {credentials: 'include' as const};

	// Запрашиваем последовательно, чтобы cookie с первой страницы успела попасть
	// в дополнительные страницы. API-запросы ниже выполняются отдельно с `omit`.
	const firstPage = await fetchViaBackground(firstPageUrl, requestOptions);
	const secondPage = await fetchViaBackground(secondPageUrl, requestOptions);
	const thirdPage = await fetchViaBackground(thirdPageUrl, requestOptions);
	const firstPageText = getResponseText(firstPage);

	const questions = [
		...extractThirdQuestions(firstPageText),
		...(isSuccessful(secondPage) ? extractThirdQuestions(secondPage.text) : []),
		...(isSuccessful(thirdPage) ? extractThirdQuestions(thirdPage.text) : []),
	];

	const loaded = await mapWithConcurrency(
		questions,
		ANSWER_REQUEST_CONCURRENCY,
		question => getThirdAnswer(firstPageUrl, question),
	);

	const cases = loaded.filter((item): item is Omit<INmoSourceCase, 'idx'> => item !== null);

	// Вопросы есть, но ни один API-ответ не удалось превратить в модель.
	if (questions.length && !cases.length) throw new Error('не удалось загрузить ответы nmo-source');

	return cases.map((item, idx) => ({...item, idx}));
}

/**
 * Получает правильные индексы одного вопроса и собирает case без порядкового `idx`.
 * Cookie намеренно не отправляется: запрос выполняется с `credentials: 'omit'`.
 *
 * @param pageUrl URL HTML-страницы, используемый как origin API-эндпоинта.
 * @param question Вопрос, варианты и `data-docid`, извлечённые из HTML.
 * @returns Готовый case либо `null`, если запрос или JSON-ответ невалиден.
 */
async function getThirdAnswer(pageUrl: string, question: INmoSourceQuestion): Promise<Omit<INmoSourceCase, 'idx'> | null> {
	const answerUrl = new URL(`/api/question/${encodeURIComponent(question.docId)}/answer`, pageUrl);
	const response = await fetchViaBackground(answerUrl.toString(), {credentials: 'omit'});
	if (!isSuccessful(response)) return null;

	const correctIndexes = extractThirdAnser(response.text, question.variants.length);
	if (!correctIndexes) return null;

	return {
		...question,
		correctIndexes,
		answers: correctIndexes.map(index => question.variants[index]),
	};
}
