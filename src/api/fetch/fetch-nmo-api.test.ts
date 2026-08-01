import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fetchViaBackground} from './fetch';
import {
	fetchNmoApiTopic,
	NMO_API_SEARCH_ENDPOINT,
	NMO_API_TOPIC_ENDPOINT,
	searchNmoApi,
} from './fetch-nmo-api';

vi.mock('./fetch', async importOriginal => ({
	...await importOriginal<typeof import('./fetch')>(),
	fetchViaBackground: vi.fn(),
}));

const mockFetch = vi.mocked(fetchViaBackground);

beforeEach(() => {
	mockFetch.mockReset();
});

describe('searchNmoApi', () => {
	it('возвращает тикеты поиска и не раскрывает внутренний ID темы', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			items: [{
				title: 'Диагностика заболевания',
				question_count: 46,
				ticket: 'short-lived.ticket',
			}],
		})));

		await expect(searchNmoApi('  диагностика  ')).resolves.toEqual([{
			title: 'Диагностика заболевания',
			questionCount: 46,
			ticket: 'short-lived.ticket',
		}]);

		const expectedUrl = new URL(NMO_API_SEARCH_ENDPOINT);
		expectedUrl.searchParams.set('q', 'диагностика');
		expect(mockFetch).toHaveBeenCalledWith(expectedUrl.toString(), {
			method: 'GET',
			headers: {'Accept': 'application/json'},
			credentials: 'omit',
		});
	});

	it('не отправляет запрос короче трёх символов', async () => {
		await expect(searchNmoApi(' Я ')).resolves.toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('отклоняет неожиданный формат поиска', async () => {
		mockFetch.mockResolvedValue(ok('{"items":[{"title":"Тема","question_count":1}]}'));

		await expect(searchNmoApi('Тема')).rejects.toThrow('некорректный ответ сервера');
	});
});

describe('fetchNmoApiTopic', () => {
	it('загружает весь вариант одним запросом и передаёт тикет только в заголовке', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			schema_version: 1,
			id: 'hidden-topic-id',
			title: 'Тема',
			question_count: 2,
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

		await expect(fetchNmoApiTopic('  short-lived.ticket  ')).resolves.toEqual([
			{question: 'Первый вопрос', variants: ['Нет', 'Да'], answers: ['Да'], idx: 0},
			{question: 'Второй вопрос', variants: ['A', 'B', 'C'], answers: ['A', 'C'], idx: 1},
		]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(NMO_API_TOPIC_ENDPOINT, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'X-NMO-Ticket': 'short-lived.ticket',
			},
			credentials: 'omit',
		});
		expect(mockFetch.mock.calls[0][0]).not.toContain('short-lived.ticket');
	});

	it('просит повторить поиск для истёкшего тикета', async () => {
		mockFetch.mockResolvedValue(failure(404, '{"detail":"topic_not_found"}'));

		await expect(fetchNmoApiTopic('expired.ticket')).rejects.toThrow('тикет NMO API истёк — повторите поиск');
	});

	it('отклоняет рассинхронизированные правильные ответы', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			question_count: 1,
			questions: [{
				text: 'Вопрос',
				options: ['Нет', 'Да'],
				correct_indexes: [1],
				correct_answers: ['Нет'],
			}],
		})));

		await expect(fetchNmoApiTopic('valid.ticket')).rejects.toThrow('некорректный ответ сервера');
	});
});

function ok(text: string) {
	return {error: false, status: 200, text};
}

function failure(status: number, text: string) {
	return {error: false, status, text};
}
