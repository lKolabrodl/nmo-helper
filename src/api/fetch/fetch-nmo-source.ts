/**
 * Загружает вопросы и правильные ответы из источника nmo-source.
 *
 * Модуль отвечает только за сетевой сценарий: получение двух HTML-страниц,
 * запрос `/api/question/{docid}/answer` для каждого вопроса и сборку модели,
 * совместимой с общим matcher'ом NMO Helper. Разбор HTML находится в
 * `utils/extractors.ts`.
 *
 * @module api/fetch/fetch-nmo-source
 */

import {fetchViaBackground, isSuccessful, mapWithConcurrency} from './fetch';
import type {QaCaseModel} from '../../utils/cases';
import {parseNmoSourceQuestions, type INmoSourceQuestion} from '../../utils/extractors';

/** Максимальное число одновременно выполняемых запросов правильных ответов. */
const ANSWER_REQUEST_CONCURRENCY = 6;

/** Готовый вопрос nmo-source с идентификатором и правильными вариантами. */
export interface INmoSourceCase extends QaCaseModel {
	/** Идентификатор вопроса из атрибута `data-docid`. */
	readonly docId: string;
	/** Уникальные 0-индексированные позиции правильных вариантов. */
	readonly correctIndexes: number[];
}

/** Необработанная форма JSON-ответа `/api/question/{docid}/answer`. */
interface INmoAnswerResponse {
	/** Сервер подтвердил успешное получение ответа. */
	readonly success?: unknown;
	/** Предполагаемый массив 0-индексированных позиций правильных вариантов. */
	readonly correct_index?: unknown;
}

/**
 * Загружает обе возможные страницы nmo-source и затем получает правильные
 * индексы отдельным API-запросом для каждого уникального `data-docid`.
 *
 * HTML-страницы загружаются с `include`, чтобы сохранить их общую сессию.
 * Запросы `/api/question/.../answer` используют `omit` и не отправляют cookies.
 * Ошибка или отсутствие второй страницы не мешает обработать первую.
 * В итог попадают только вопросы с успешным и валидным API-ответом.
 *
 * @param url Базовый URL первой страницы без query-string; для второй страницы
 *            к нему напрямую добавляется `?page=2`.
 * @returns Модели вопросов с вариантами, правильными индексами и текстами ответов.
 * @throws {Error} Если первая страница недоступна, вернула ошибочный HTTP-статус
 *                 или пустое тело.
 * @throws {Error} Если вопросы найдены, но ни один ответ API загрузить не удалось.
 */
export async function fetchNmoSource(url: string): Promise<INmoSourceCase[]> {
	const firstPageUrl = url;
	const secondPageUrl = `${url}?page=2`;
	const requestOptions = {credentials: 'include' as const};

	// Запрашиваем последовательно, чтобы cookie с первой страницы успела попасть
	// во вторую страницу. API-запросы ниже выполняются отдельно с `omit`.
	const firstPage = await fetchViaBackground(firstPageUrl, requestOptions);
	const secondPage = await fetchViaBackground(secondPageUrl, requestOptions);

	if (firstPage.error) throw new Error('ошибка сети — проверь URL');
	if (firstPage.status < 200 || firstPage.status >= 400) throw new Error(`ошибка ${firstPage.status}: сервер отклонил запрос`);
	if (!firstPage.text.trim()) throw new Error('пустой ответ от сервера');


	const questions = [
		...parseNmoSourceQuestions(firstPage.text),
		...(isSuccessful(secondPage) ? parseNmoSourceQuestions(secondPage.text) : []),
	];

	const loaded = await mapWithConcurrency(
		questions,
		ANSWER_REQUEST_CONCURRENCY,
		question => fetchNmoQuestionAnswer(firstPageUrl, question),
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
async function fetchNmoQuestionAnswer(pageUrl: string,	question: INmoSourceQuestion): Promise<Omit<INmoSourceCase, 'idx'> | null> {
	const answerUrl = new URL(`/api/question/${encodeURIComponent(question.docId)}/answer`, pageUrl);
	const response = await fetchViaBackground(answerUrl.toString(), {credentials: 'omit'});
	if (!isSuccessful(response)) return null;

	const correctIndexes = parseCorrectIndexes(response.text, question.variants.length);
	if (!correctIndexes) return null;

	return {
		...question,
		correctIndexes,
		answers: correctIndexes.map(index => question.variants[index]),
	};
}

/**
 * Разбирает `correct_index` и оставляет только уникальные допустимые индексы.
 *
 * @param text Сырое JSON-тело ответа API.
 * @param variantCount Число вариантов вопроса для проверки границ индекса.
 * @returns Массив валидных 0-индексированных позиций либо `null`, если формат
 *          ответа неверен или `success !== true`.
 */
function parseCorrectIndexes(text: string, variantCount: number): number[] | null {
	let data: INmoAnswerResponse;
	try {
		data = JSON.parse(text) as INmoAnswerResponse;
	} catch {
		return null;
	}

	if (data.success !== true || !Array.isArray(data.correct_index)) return null;

	return [...new Set(data.correct_index.filter((value): value is number =>
		typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < variantCount,
	))];
}
