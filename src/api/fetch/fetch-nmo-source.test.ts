import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fetchViaBackground} from './fetch';
import {fetchNmoSource} from './fetch-nmo-source';
import {findAnswers} from '../../utils/cases';
import {ALTERNATIVE_ANSWER_SOURCE_HOST} from '../../utils/constants';

vi.mock('./fetch', async importOriginal => ({
	...await importOriginal<typeof import('./fetch')>(),
	fetchViaBackground: vi.fn(),
}));

const mockFetch = vi.mocked(fetchViaBackground);
const NMO_BASE_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}`;

beforeEach(() => {
	mockFetch.mockReset();
});

describe('fetchNmoSource', () => {
	it('загружает страницы 1 и 2, затем делает API-запрос для каждого вопроса', async () => {
		const pageOne = makePage([
			makeQuestion('101', 'Первый вопрос', ['A', 'B', 'C']),
		]);
		const pageTwo = makePage([
			makeQuestion('202', 'Второй вопрос', ['X', 'Y']),
		]);

		mockFetch.mockImplementation(async url => {
			if (url === `${NMO_BASE_URL}/test-medik/nmo/topic.html`) return ok(pageOne);
			if (url === `${NMO_BASE_URL}/test-medik/nmo/topic.html?page=2`) return ok(pageTwo);
			if (url.endsWith('/api/question/101/answer')) return ok('{"success":true,"correct_index":[3]}');
			if (url.endsWith('/api/question/202/answer')) return ok('{"success":true,"correct_index":[1,2]}');
			return failure(404, 'not found');
		});

		const model = await fetchNmoSource(`${NMO_BASE_URL}/test-medik/nmo/topic.html`);

		expect(model).toEqual([
			{
				question: 'Первый вопрос',
				variants: ['A', 'B', 'C'],
				docId: '101',
				correctIndexes: [2],
				answers: ['C'],
				idx: 0,
			},
			{
				question: 'Второй вопрос',
				variants: ['X', 'Y'],
				docId: '202',
				correctIndexes: [0, 1],
				answers: ['X', 'Y'],
				idx: 1,
			},
		]);

		const urls = mockFetch.mock.calls.map(([url]) => url);
		expect(urls).toEqual([
			`${NMO_BASE_URL}/test-medik/nmo/topic.html`,
			`${NMO_BASE_URL}/test-medik/nmo/topic.html?page=2`,
			`${NMO_BASE_URL}/api/question/101/answer`,
			`${NMO_BASE_URL}/api/question/202/answer`,
		]);
		expect(mockFetch.mock.calls.slice(0, 2).every(([, options]) => options?.credentials === 'include')).toBe(true);
		expect(mockFetch.mock.calls.slice(2).every(([, options]) => options?.credentials === 'omit')).toBe(true);
	});

	it('возвращает совместимую с matcher модель', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('/api/question/303/answer')) return ok('{"success":true,"correct_index":[2]}');
			if (url.includes('page=2')) return failure(404, 'not found');
			return ok(makePage([makeQuestion('303', 'Что выбрать?', ['Первый', 'Второй', 'Третий'])]));
		});

		const model = await fetchNmoSource(`${NMO_BASE_URL}/test-medik/nmo/topic.html`);
		const found = findAnswers(model, 'Что выбрать?', ['Третий', 'Второй', 'Первый']);

		expect(found).toEqual({answers: ['Второй'], score: 1});
	});

	it('считает отсутствие второй страницы допустимым', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('page=2')) return failure(404, '<html>Нет страницы</html>');
			if (url.includes('/api/question/404/answer')) return ok('{"success":true,"correct_index":[1]}');
			return ok(makePage([makeQuestion('404', 'Только первая страница', ['Да', 'Нет'])]));
		});

		await expect(fetchNmoSource(`${NMO_BASE_URL}/test-medik/nmo/topic.html`))
			.resolves.toMatchObject([{docId: '404', correctIndexes: [0], answers: ['Да']}]);
	});

	it('преобразует номер последнего варианта из API в 0-индексированную позицию', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('page=2')) return failure(404, 'not found');
			if (url.includes('/api/question/176184/answer')) return ok('{"success":true,"correct_index":[4]}');
			return ok(makePage([
				makeQuestion('176184', 'Какой вариант выбрать?', ['Первый', 'Второй', 'Третий', 'Четвёртый']),
			]));
		});

		await expect(fetchNmoSource(`${NMO_BASE_URL}/test-medik/nmo/topic.html`))
			.resolves.toMatchObject([{docId: '176184', correctIndexes: [3], answers: ['Четвёртый']}]);
	});

	it('пропускает отдельный неуспешный ответ API, сохраняя остальные вопросы', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('page=2')) return failure(404, 'not found');
			if (url.endsWith('/api/question/1/answer')) return ok('{"success":false}');
			if (url.endsWith('/api/question/2/answer')) return ok('{"success":true,"correct_index":[2]}');
			return ok(makePage([
				makeQuestion('1', 'Недоступный', ['A', 'B']),
				makeQuestion('2', 'Доступный', ['A', 'B']),
			]));
		});

		const model = await fetchNmoSource(`${NMO_BASE_URL}/test-medik/nmo/topic.html`);
		expect(model).toMatchObject([{docId: '2', correctIndexes: [1], idx: 0}]);
	});

	it('сообщает об ошибке, если ни один API-ответ не удалось получить', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('page=2')) return failure(404, 'not found');
			if (url.includes('/api/question/')) return failure(429, '{"success":false}');
			return ok(makePage([makeQuestion('505', 'Вопрос', ['A', 'B'])]));
		});

		await expect(fetchNmoSource(`${NMO_BASE_URL}/test-medik/nmo/topic.html`))
			.rejects.toThrow('не удалось загрузить ответы nmo-source');
	});
});

function makePage(items: readonly string[]): string {
	return `<div id="questionListApp"><ul class="categoryListApp">${items.join('')}</ul></div>`;
}

function makeQuestion(docId: string, question: string, variants: readonly string[]): string {
	return `
		<li class="vopros show">
			<h4 class="fs-14">${question}</h4>
			<ol class="answers-list">
				${variants.map(variant => `<li><p class="line-clamp">${variant}</p></li>`).join('')}
				<button class="get-answer" data-docid="${docId}">Показать ответ</button>
			</ol>
		</li>
	`;
}

function ok(text: string) {
	return {error: false, status: 200, text};
}

function failure(status: number, text: string) {
	return {error: false, status, text};
}
