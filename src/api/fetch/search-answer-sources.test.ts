import {beforeEach, describe, expect, it, vi} from 'vitest';
import {findAnswers} from '../../utils/cases';
import {ALTERNATIVE_ANSWER_SOURCE_HOST, NMO_API_TOPIC_ENDPOINT} from '../../utils/constants';
import {fetchViaBackground} from './fetch';
import {clearNmoAnswerCache, getFirstAnswers, getNmoAnswers, getSecondAnswers, getThirdAnswers} from './search-answer-sources';

vi.mock('./fetch', async importOriginal => ({
	...await importOriginal<typeof import('./fetch')>(),
	fetchViaBackground: vi.fn(),
}));

const mockFetch = vi.mocked(fetchViaBackground);
const THIRD_BASE_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}`;

beforeEach(() => {
	mockFetch.mockReset();
	clearNmoAnswerCache();
});

describe('getFirstAnswers', () => {
	it('загружает и разбирает HTML страницы ответов', async () => {
		const url = 'https://first.example/topic';
		mockFetch.mockResolvedValue(ok(makeFirstAnswerPage()));

		const result = await getFirstAnswers(url);

		expect(mockFetch).toHaveBeenCalledWith(url);
		expect(result).toEqual([{
			question: 'Вопрос первой базы',
			variants: ['Неверный', 'Верный'],
			answers: ['Верный'],
			idx: 0,
		}]);
	});

	it.each([
		{response: networkFailure(), message: 'ошибка сети — проверь URL'},
		{response: failure(500, 'server error'), message: 'ошибка 500: сервер отклонил запрос'},
		{response: ok('   '), message: 'пустой ответ от сервера'},
	])('отклоняет неуспешный ответ: $message', async ({response, message}) => {
		mockFetch.mockResolvedValue(response);

		await expect(getFirstAnswers('https://first.example/topic')).rejects.toThrow(message);
	});
});

describe('getSecondAnswers', () => {
	it('самостоятельно загружает и разбирает HTML второго источника', async () => {
		const url = 'https://second.example/topic';
		mockFetch.mockResolvedValue(ok(makeSecondAnswerPage()));

		const result = await getSecondAnswers(url);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith(url);
		expect(result).toEqual([{
			question: 'Вопрос второй базы',
			variants: ['Верный', 'Неверный'],
			answers: ['Верный'],
			idx: 0,
		}]);
	});

	it.each([
		{response: networkFailure(), message: 'ошибка сети — проверь URL'},
		{response: failure(500, 'server error'), message: 'ошибка 500: сервер отклонил запрос'},
		{response: ok('   '), message: 'пустой ответ от сервера'},
	])('отклоняет неуспешный ответ: $message', async ({response, message}) => {
		mockFetch.mockResolvedValue(response);

		await expect(getSecondAnswers('https://second.example/topic')).rejects.toThrow(message);
	});
});

describe('getNmoAnswers', () => {
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

		await expect(getNmoAnswers(`  ${NMO_API_TOPIC_ENDPOINT}/short-lived.uid  `)).resolves.toEqual([
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

	it('использует общую ошибку для истёкшего UID', async () => {
		mockFetch.mockResolvedValue(failure(404, '{"detail":"topic_not_found"}'));

		await expect(getNmoAnswers(`${NMO_API_TOPIC_ENDPOINT}/expired.uid`))
			.rejects.toThrow('ошибка 404: сервер отклонил запрос');
	});

	it('не загружает один и тот же полный вариант повторно', async () => {
		mockFetch.mockResolvedValue(ok(JSON.stringify({
			questions: [{
				text: 'Вопрос',
				options: ['Нет', 'Да'],
				correct_answers: ['Да'],
			}],
		})));

		const url = `${NMO_API_TOPIC_ENDPOINT}/cached.uid`;
		const first = await getNmoAnswers(url);
		first[0].answers.push('Локальное изменение');
		const repeated = await getNmoAnswers(url);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(repeated[0].answers).toEqual(['Да']);
	});

	it('не отправляет запрос, если UID отсутствует в URL', async () => {
		await expect(getNmoAnswers(NMO_API_TOPIC_ENDPOINT)).rejects.toThrow('некорректный URL NMO API');
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it.each([
		'not json',
		'{}',
		'{"questions":{}}',
	])('логирует ошибку разбора и возвращает пустой массив: %s', async text => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		mockFetch.mockResolvedValue(ok(text));

		await expect(getNmoAnswers(`${NMO_API_TOPIC_ENDPOINT}/valid.uid`)).resolves.toEqual([]);
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});

describe('getThirdAnswers', () => {
	it('загружает страницы 1, 2 и 3, затем делает API-запрос для каждого вопроса', async () => {
		const pageOne = makePage([
			makeQuestion('101', 'Первый вопрос', ['A', 'B', 'C']),
		]);
		const pageTwo = makePage([
			makeQuestion('202', 'Второй вопрос', ['X', 'Y']),
		]);
		const pageThree = makePage([
			makeQuestion('303', 'Третий вопрос', ['Первый', 'Второй']),
		]);

		mockFetch.mockImplementation(async url => {
			if (url === `${THIRD_BASE_URL}/test-medik/nmo/topic.html`) return ok(pageOne);
			if (url === `${THIRD_BASE_URL}/test-medik/nmo/topic.html?page=2`) return ok(pageTwo);
			if (url === `${THIRD_BASE_URL}/test-medik/nmo/topic.html?page=3`) return ok(pageThree);
			if (url.endsWith('/api/question/101/answer')) return ok('{"success":true,"correct_index":[3]}');
			if (url.endsWith('/api/question/202/answer')) return ok('{"success":true,"correct_index":[1,2]}');
			if (url.endsWith('/api/question/303/answer')) return ok('{"success":true,"correct_index":[2]}');
			return failure(404, 'not found');
		});

		const model = await getThirdAnswers(`${THIRD_BASE_URL}/test-medik/nmo/topic.html`);

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
			{
				question: 'Третий вопрос',
				variants: ['Первый', 'Второй'],
				docId: '303',
				correctIndexes: [1],
				answers: ['Второй'],
				idx: 2,
			},
		]);

		const urls = mockFetch.mock.calls.map(([url]) => url);
		expect(urls).toEqual([
			`${THIRD_BASE_URL}/test-medik/nmo/topic.html`,
			`${THIRD_BASE_URL}/test-medik/nmo/topic.html?page=2`,
			`${THIRD_BASE_URL}/test-medik/nmo/topic.html?page=3`,
			`${THIRD_BASE_URL}/api/question/101/answer`,
			`${THIRD_BASE_URL}/api/question/202/answer`,
			`${THIRD_BASE_URL}/api/question/303/answer`,
		]);
		expect(mockFetch.mock.calls.slice(0, 3).every(([, options]) => options?.credentials === 'include')).toBe(true);
		expect(mockFetch.mock.calls.slice(3).every(([, options]) => options?.credentials === 'omit')).toBe(true);
	});

	it('возвращает совместимую с matcher модель', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('/api/question/303/answer')) return ok('{"success":true,"correct_index":[2]}');
			if (url.includes('?page=')) return failure(404, 'not found');
			return ok(makePage([makeQuestion('303', 'Что выбрать?', ['Первый', 'Второй', 'Третий'])]));
		});

		const model = await getThirdAnswers(`${THIRD_BASE_URL}/test-medik/nmo/topic.html`);
		const found = findAnswers(model, 'Что выбрать?', ['Третий', 'Второй', 'Первый']);

		expect(found).toEqual({answers: ['Второй'], score: 1});
	});

	it('считает отсутствие дополнительных страниц допустимым', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('?page=')) return failure(404, '<html>Нет страницы</html>');
			if (url.includes('/api/question/404/answer')) return ok('{"success":true,"correct_index":[1]}');
			return ok(makePage([makeQuestion('404', 'Только первая страница', ['Да', 'Нет'])]));
		});

		await expect(getThirdAnswers(`${THIRD_BASE_URL}/test-medik/nmo/topic.html`))
			.resolves.toMatchObject([{docId: '404', correctIndexes: [0], answers: ['Да']}]);
	});

	it('преобразует номер последнего варианта из API в 0-индексированную позицию', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('?page=')) return failure(404, 'not found');
			if (url.includes('/api/question/176184/answer')) return ok('{"success":true,"correct_index":[4]}');
			return ok(makePage([
				makeQuestion('176184', 'Какой вариант выбрать?', ['Первый', 'Второй', 'Третий', 'Четвёртый']),
			]));
		});

		await expect(getThirdAnswers(`${THIRD_BASE_URL}/test-medik/nmo/topic.html`))
			.resolves.toMatchObject([{docId: '176184', correctIndexes: [3], answers: ['Четвёртый']}]);
	});

	it('пропускает отдельный неуспешный ответ API, сохраняя остальные вопросы', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('?page=')) return failure(404, 'not found');
			if (url.endsWith('/api/question/1/answer')) return ok('{"success":false}');
			if (url.endsWith('/api/question/2/answer')) return ok('{"success":true,"correct_index":[2]}');
			return ok(makePage([
				makeQuestion('1', 'Недоступный', ['A', 'B']),
				makeQuestion('2', 'Доступный', ['A', 'B']),
			]));
		});

		const model = await getThirdAnswers(`${THIRD_BASE_URL}/test-medik/nmo/topic.html`);
		expect(model).toMatchObject([{docId: '2', correctIndexes: [1], idx: 0}]);
	});

	it('сообщает об ошибке, если ни один API-ответ не удалось получить', async () => {
		mockFetch.mockImplementation(async url => {
			if (url.includes('?page=')) return failure(404, 'not found');
			if (url.includes('/api/question/')) return failure(429, '{"success":false}');
			return ok(makePage([makeQuestion('505', 'Вопрос', ['A', 'B'])]));
		});

		await expect(getThirdAnswers(`${THIRD_BASE_URL}/test-medik/nmo/topic.html`))
			.rejects.toThrow('не удалось загрузить ответы nmo-source');
	});
});

function makePage(items: readonly string[]): string {
	return `<div id="questionListApp"><ul class="categoryListApp">${items.join('')}</ul></div>`;
}

function makeFirstAnswerPage(): string {
	return `<div class="row">
		<h3>Вопрос первой базы</h3>
		<p>Неверный<br><span style="background:#fbeeb8">Верный</span></p>
	</div><!--${'padding'.repeat(20)}-->`;
}

function makeSecondAnswerPage(): string {
	return `<div class="row">
		<h3>Вопрос второй базы</h3>
		<p><strong>Верный</strong><br>Неверный</p>
	</div><!--${'padding'.repeat(20)}-->`;
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

function networkFailure() {
	return {error: true, status: 0, text: ''};
}
