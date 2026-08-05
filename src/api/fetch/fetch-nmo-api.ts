/**
 * Клиент серверного NMO API с короткоживущими тикетами.
 *
 * Полный вариант загружается одним запросом по короткоживущему тикету,
 * после чего преобразуется в общую модель matcher'а.
 *
 * @module api/fetch/fetch-nmo-api
 */

import {NMO_API_HOST} from '../../utils/constants';
import type {QaCaseModel} from '../../utils/cases';
import {fetchViaBackground, type IRequestResponse} from './fetch';

const NMO_API_BASE_URL = `https://${NMO_API_HOST}/api/nmo`;

/** Ticket-only endpoint полного варианта. */
export const NMO_API_TOPIC_ENDPOINT = `${NMO_API_BASE_URL}/topic`;

/**
 * Загружает полный вариант по короткоживущему тикету одним запросом.
 * Тикет передаётся только в заголовке и никогда не попадает в URL.
 *
 * @param ticket Тикет из результата поиска NMO API.
 * @returns Готовая модель всех вопросов и правильных ответов варианта.
 * @throws {Error} Если тикет истёк, запрос не удался или ответ невалиден.
 */
export async function fetchNmoApiTopic(ticket: string): Promise<QaCaseModel[]> {
	const normalizedTicket = ticket.trim();
	if (!normalizedTicket) throw new Error('отсутствует тикет NMO API — повторите поиск');

	const response = await fetchViaBackground(NMO_API_TOPIC_ENDPOINT, {
		method: 'GET',
		headers: {
			'Accept': 'application/json',
			'X-NMO-Ticket': normalizedTicket,
		},
		credentials: 'omit',
	});

	if (!response.error && response.status === 404) {
		throw new Error('тикет NMO API истёк — повторите поиск');
	}
	assertSuccessfulResponse(response, 'загрузка варианта NMO API');

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

/** Проверяет транспортный результат background fetch. */
function assertSuccessfulResponse(response: IRequestResponse, action: string): void {
	if (response.error) throw new Error(`${action}: ошибка сети`);
	if (response.status < 200 || response.status >= 400) {
		throw new Error(`${action}: сервер вернул ошибку ${response.status}`);
	}
	if (!response.text.trim()) throw new Error(`${action}: сервер вернул пустой ответ`);
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
