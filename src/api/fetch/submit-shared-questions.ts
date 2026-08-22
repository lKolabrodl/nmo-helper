import {NMO_API_BASE_URL} from '../../utils/constants';
import {fetchViaBackground, getResponseText} from './fetch';

const QUESTION_SUBMISSION_ENDPOINT = `${NMO_API_BASE_URL}/topics`;

/** Вопрос с правильными вариантами в формате API пополнения базы. */
export interface ISharedQuizQuestion {
	/** Текст вопроса. */
	readonly text: string;
	/** Все варианты ответа в порядке страницы НМО. */
	readonly options: readonly string[];
	/** Отсортированные 0-индексированные позиции правильных вариантов. */
	readonly correct_indexes: readonly number[];
}

/**
 * Отправляет подтверждённые вопросы в собственный NMO API.
 *
 * Запрос проходит через background service worker, где подписывается анонимным
 * ключом установки. Endpoint сам объединяет данные с существующей темой либо
 * создаёт отсутствующую тему.
 *
 * @param title Очищенное название темы теста.
 * @param questions Только вопросы, отмеченные порталом НМО как правильные.
 * @param submissionId UUID идемпотентной отправки. По умолчанию создаётся новый.
 * @throws Если входные данные пусты, запрос отклонён или сервер недоступен.
 */
export async function submitSharedQuestions(title: string,	questions: readonly ISharedQuizQuestion[],	submissionId: string = crypto.randomUUID()): Promise<void> {
	const normalizedTitle = title.trim();
	if (!normalizedTitle) throw new Error('не указана тема теста');
	if (!questions.length) throw new Error('нет правильных ответов для отправки');

	const body = JSON.stringify({
		submission_id: submissionId,
		title: normalizedTitle,
		questions,
	});
	const response = await fetchViaBackground(QUESTION_SUBMISSION_ENDPOINT, {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		},
		body,
		credentials: 'omit',
	});

	getResponseText(response);
}
