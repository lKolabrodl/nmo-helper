import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fetchViaBackground} from './fetch';
import {
	fetchNmoApiTopic,
	NMO_API_TOPIC_ENDPOINT,
} from './fetch-nmo-api';

vi.mock('./fetch', async importOriginal => ({
	...await importOriginal<typeof import('./fetch')>(),
	fetchViaBackground: vi.fn(),
}));

const mockFetch = vi.mocked(fetchViaBackground);

beforeEach(() => {
	mockFetch.mockReset();
});

describe('fetchNmoApiTopic', () => {
	it('извлекает UID из URL и передаёт его только в заголовке', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			schema_version: 1,
			id: 'hidden-topic-id',
			title: 'Тема',
			questions: [
				{
					id: 'q1',
					text: 'Первый вопрос',
					options: ['Нет', 'Да'],
					correct_indexes: [1],
					correct_answers: ['Да'],
				},
				{
					id: 'q2',
					text: 'Второй вопрос',
					options: ['A', 'B', 'C'],
					correct_indexes: [0, 2],
					correct_answers: ['A', 'C'],
				},
			],
		})));

		await expect(fetchNmoApiTopic(`  ${NMO_API_TOPIC_ENDPOINT}/short-lived.uid  `)).resolves.toEqual([
			{question: 'Первый вопрос', variants: ['Нет', 'Да'], answers: ['Да'], idx: 0},
			{question: 'Второй вопрос', variants: ['A', 'B', 'C'], answers: ['A', 'C'], idx: 1},
		]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(NMO_API_TOPIC_ENDPOINT, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'X-NMO-Ticket': 'short-lived.uid',
			},
			credentials: 'omit',
		});
		expect(mockFetch.mock.calls[0][0]).not.toContain('short-lived.uid');
	});

	it('просит повторить поиск для истёкшего UID', async () => {
		mockFetch.mockResolvedValue(failure(404, '{"detail":"topic_not_found"}'));

		await expect(fetchNmoApiTopic(`${NMO_API_TOPIC_ENDPOINT}/expired.uid`))
			.rejects.toThrow('UID NMO API истёк — повторите поиск');
	});

	it('не отправляет запрос, если UID отсутствует в URL', async () => {
		await expect(fetchNmoApiTopic(NMO_API_TOPIC_ENDPOINT)).rejects.toThrow('некорректный URL NMO API');
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('отклоняет рассинхронизированные правильные ответы', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			questions: [{
				text: 'Вопрос',
				options: ['Нет', 'Да'],
				correct_indexes: [1],
				correct_answers: ['Нет'],
			}],
		})));

		await expect(fetchNmoApiTopic(`${NMO_API_TOPIC_ENDPOINT}/valid.uid`))
			.rejects.toThrow('некорректный ответ сервера');
	});
});

function ok(text: string) {
	return {error: false, status: 200, text};
}

function failure(status: number, text: string) {
	return {error: false, status, text};
}
