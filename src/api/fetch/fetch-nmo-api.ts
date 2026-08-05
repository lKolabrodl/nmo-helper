/**
 * Клиент серверного NMO API с короткоживущими UID.
 *
 * Полный вариант загружается одним запросом по короткоживущему UID,
 * после чего преобразуется в общую модель matcher'а.
 *
 * @module api/fetch/fetch-nmo-api
 */

import {NMO_API_HOST} from '../../utils/constants';
import type {QaCaseModel} from '../../utils/cases';
import {fetchViaBackground} from './fetch';

const NMO_API_BASE_URL = `https://${NMO_API_HOST}/api/nmo`;

/** Фиксированный endpoint загрузки полного варианта. */
export const NMO_API_TOPIC_ENDPOINT = `${NMO_API_BASE_URL}/topic`;

/**
 * Загружает полный вариант по внутреннему URL результата поиска.
 * UID извлекается из последнего сегмента URL и передаётся API только в заголовке;
 * сам сетевой запрос всегда выполняется на фиксированный endpoint.
 *
 * @param url URL результата NMO API в формате `/api/nmo/topic/<uid>`.
 * @returns Готовая модель всех вопросов и правильных ответов варианта.
 * @throws {Error} Если URL невалиден, UID истёк, запрос не удался или ответ невалиден.
 */
export async function fetchNmoApiTopic(url: string): Promise<QaCaseModel[]> {
	const uid = url.trim().match(/\/api\/nmo\/topic\/([^/?#]+)$/)?.[1];
	if (!uid) throw new Error('некорректный URL NMO API');

	const response = await fetchViaBackground(NMO_API_TOPIC_ENDPOINT, {
		method: 'GET',
		headers: {
			'Accept': 'application/json',
			'X-NMO-Ticket': uid,
		},
		credentials: 'omit',
	});

	if (!response.error && response.status === 404) {
		throw new Error('UID NMO API истёк — повторите поиск');
	}
	if (response.error) throw new Error('загрузка варианта NMO API: ошибка сети');
	if (response.status < 200 || response.status >= 400) {
		throw new Error(`загрузка варианта NMO API: сервер вернул ошибку ${response.status}`);
	}
	if (!response.text.trim()) throw new Error('загрузка варианта NMO API: сервер вернул пустой ответ');

	const payload = parseJsonObject(response.text, 'загрузка варианта NMO API');
	if (!Array.isArray(payload.questions) || !payload.questions.length) {
		throw invalidPayload('загрузка варианта NMO API');
	}

	return payload.questions.map((question, idx) => parseQuestion(question, idx));
}

/** Преобразует один вопрос публичной схемы API в модель matcher'а. */
function parseQuestion(input: unknown, idx: number): QaCaseModel {
	const value = asObject(input, 'загрузка варианта NMO API');
	const question = typeof value.text === 'string' ? value.text.trim() : '';
	const variants = value.options;
	const correctIndexes = value.correct_indexes;
	const correctAnswers = value.correct_answers;

	if (
		!question
		|| !Array.isArray(variants)
		|| variants.length < 2
		|| !variants.every(item => typeof item === 'string')
		|| !Array.isArray(correctIndexes)
		|| !correctIndexes.length
		|| !Array.isArray(correctAnswers)
		|| !correctAnswers.every(item => typeof item === 'string')
	) {
		throw invalidPayload('загрузка варианта NMO API');
	}

	const indexes = correctIndexes as unknown[];
	if (!indexes.every(index => (
		typeof index === 'number'
		&& Number.isInteger(index)
		&& index >= 0
		&& index < variants.length
	))) {
		throw invalidPayload('загрузка варианта NMO API');
	}

	const uniqueIndexes = [...new Set(indexes as number[])];
	if (uniqueIndexes.length !== indexes.length) throw invalidPayload('загрузка варианта NMO API');

	const normalizedVariants = variants as string[];
	const answers = uniqueIndexes.map(index => normalizedVariants[index]);
	if (
		answers.length !== correctAnswers.length
		|| answers.some((answer, index) => answer !== correctAnswers[index])
	) {
		throw invalidPayload('загрузка варианта NMO API');
	}

	return {
		question,
		variants: normalizedVariants,
		answers,
		idx,
	};
}

/** Разбирает JSON и проверяет, что корень является объектом. */
function parseJsonObject(text: string, action: string): Record<string, unknown> {
	let payload: unknown;
	try {
		payload = JSON.parse(text) as unknown;
	} catch {
		throw invalidPayload(action);
	}
	return asObject(payload, action);
}

/** Проверяет объектную форму произвольного значения. */
function asObject(value: unknown, action: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidPayload(action);
	return value as Record<string, unknown>;
}

/** Создаёт единообразную ошибку нарушения серверной схемы. */
function invalidPayload(action: string): Error {
	return new Error(`${action}: некорректный ответ сервера`);
}
