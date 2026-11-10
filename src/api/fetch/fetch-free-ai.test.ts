import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import chromeStoreManifest from '../../manifest.chrome-store.json';
import type {IRequestResponse} from './fetch';
import {
	askFreeAI,
	BLOCKRUN_AI_MODEL,
	BLOCKRUN_AI_URL,
	HORDE_AI_URL,
	HORDE_ANONYMOUS_KEY,
	HORDE_MODELS_URL,
	JARVIS_AI_MODEL,
	JARVIS_AI_URL,
	KILO_AI_MODEL,
	KILO_AI_URL,
	OVH_AI_MODEL,
	OVH_AI_URL,
	OVH_GPT_OSS_MODEL,
	OVH_OPENAI_URL,
	OVH_QWEN_MODEL,
	resolveFreeAiRequest,
	selectHordeModel,
} from './fetch-free-ai';

type SendMessageFn = (msg: unknown, cb: (res: unknown) => void) => void;

const sendMessage = vi.fn();
const directRouteUrls = [OVH_OPENAI_URL, OVH_OPENAI_URL, JARVIS_AI_URL, BLOCKRUN_AI_URL, OVH_AI_URL, KILO_AI_URL];

beforeEach(() => {
	sendMessage.mockReset();
	(chrome.runtime as unknown as {sendMessage: SendMessageFn}).sendMessage = sendMessage as unknown as SendMessageFn;
});

describe('selectHordeModel', () => {
	it('предпочитает известную instruct-модель с большим числом worker-потоков', () => {
		const payload = {
			data: [
				{id: 'unknown/huge', base_model: 'unknown', worker_threads: 40, size: 120},
				{id: 'known/slow', base_model: 'mistral-instruct', known_to_horde: true, worker_threads: 2, size: 70},
				{id: 'known/fast', template: 'chatml', known_to_horde: true, worker_threads: 8, size: 24},
			],
		};

		expect(selectHordeModel(payload)).toBe('known/fast');
	});

	it('игнорирует записи без ID и без живых worker-потоков', () => {
		const payload = {
			data: [
				{id: 'offline', base_model: 'llama-3-instruct', worker_threads: 0},
				{id: '', worker_threads: 10},
				{id: 'online', base_model: 'llama-3-instruct', worker_threads: 1, size: 3},
			],
		};

		expect(selectHordeModel(payload)).toBe('online');
	});

	it('понятно сообщает об отсутствии text-моделей', () => {
		expect(() => selectHordeModel({data: []})).toThrow('нет доступных text-моделей');
		expect(() => selectHordeModel({})).toThrow('нет доступных text-моделей');
	});
});

describe('resolveFreeAiRequest', () => {
	it.each([
		{service: 'gpt-oss', model: OVH_GPT_OSS_MODEL, extraBody: {temperature: 0, reasoning_effort: 'low'}},
		{service: 'qwen', model: OVH_QWEN_MODEL, extraBody: {temperature: 0}},
	] as const)('$service работает без ключа и оставляет место для рассуждения', async ({service, model, extraBody}) => {
		expect(await resolveFreeAiRequest(service)).toEqual({
			apiKey: '',
			endpoint: OVH_OPENAI_URL,
			model,
			requestOptions: {timeoutMs: 30_000, maxTokens: 2048, extraBody},
		});
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it.each([
		{service: 'jarvis', endpoint: JARVIS_AI_URL, model: JARVIS_AI_MODEL},
		{service: 'blockrun', endpoint: BLOCKRUN_AI_URL, model: BLOCKRUN_AI_MODEL},
	] as const)('$service использует бесплатный маршрут без ключа с ограничением времени', async ({service, endpoint, model}) => {
		expect(chromeStoreManifest.host_permissions).toContain(`${new URL(endpoint).origin}/*`);
		expect(await resolveFreeAiRequest(service)).toEqual({
			apiKey: '',
			endpoint,
			model,
			requestOptions: {timeoutMs: 30_000, maxTokens: 2048, extraBody: {temperature: 0}},
		});
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('OVH работает без ключа и получает клиентский таймаут 30 секунд', async () => {
		const config = await resolveFreeAiRequest('ovh');

		expect(config).toEqual({
			apiKey: '',
			endpoint: OVH_AI_URL,
			model: OVH_AI_MODEL,
			requestOptions: {
				timeoutMs: 30_000,
				maxTokens: 32,
				extraBody: {temperature: 0},
			},
		});
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('Kilo работает без ключа и оставляет место для рассуждения бесплатной модели', async () => {
		expect(await resolveFreeAiRequest('kilo')).toEqual({
			apiKey: '',
			endpoint: KILO_AI_URL,
			model: KILO_AI_MODEL,
			requestOptions: {
				timeoutMs: 30_000,
				maxTokens: 2048,
				extraBody: {temperature: 0},
			},
		});
		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('AI Horde получает список моделей и использует anonymous key', async () => {
		const response = JSON.stringify({
			data: [
				{id: 'horde/instruct', base_model: 'mistral-instruct', known_to_horde: true, worker_threads: 4, size: 24},
			],
		});
		sendMessage.mockImplementation((_msg, cb) => cb({error: false, status: 200, text: response}));

		const config = await resolveFreeAiRequest('horde');
		const [message] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];

		expect(message).toMatchObject({
			action: 'fetch',
			url: HORDE_MODELS_URL,
			method: 'GET',
			timeoutMs: 10_000,
		});
		expect(message.headers).toEqual({Authorization: `Bearer ${HORDE_ANONYMOUS_KEY}`});
		expect(config).toEqual({
			apiKey: HORDE_ANONYMOUS_KEY,
			endpoint: HORDE_AI_URL,
			model: 'horde/instruct',
			requestOptions: {
				timeoutMs: 125_000,
				maxTokens: 32,
				extraBody: {temperature: 0, timeout: 120},
			},
		});
	});

	it('превращает таймаут списка Horde в понятную ошибку', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({
			error: true,
			status: 0,
			text: '',
			message: 'таймаут 10 с',
		}));

		await expect(resolveFreeAiRequest('horde')).rejects.toThrow('AI Horde не отвечает за 10 с');
	});
});

describe('askFreeAI automatic route', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('сначала использует Qwen без ключа и читает только итоговый ответ', async () => {
		const answer = JSON.stringify({choices: [{message: {content: '2', reasoning: 'Сравниваю варианты 1, 2 и 3.'}}]});
		sendMessage.mockImplementation((_msg, cb) => cb({error: false, status: 200, text: answer}));

		const result = await askFreeAI('Вопрос?', ['a', 'b', 'c'], true, 'Тема');
		const [message] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];

		expect(result).toEqual({correctIndexes: [1], source: 'Qwen 3.8 27B'});
		expect(sendMessage).toHaveBeenCalledTimes(1);
		expect(message.url).toBe(OVH_OPENAI_URL);
		expect((message.headers as Record<string, string>).Authorization).toBeUndefined();
		expect(JSON.parse(message.body as string)).toMatchObject({model: OVH_QWEN_MODEL, max_tokens: 2048, temperature: 0});
	});

	it.each([
		{error: false, status: 429, text: ''},
		{error: false, status: 503, text: ''},
		{error: true, status: 0, text: '', message: 'таймаут 30 с'},
	])('после сбоя Qwen ($status) переходит на GPT-OSS без ключа', async failure => {
		const answer = JSON.stringify({choices: [{message: {content: '1,3'}}]});
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			const body = JSON.parse(message.body as string);
			return cb(body.model === OVH_QWEN_MODEL ? failure : {error: false, status: 200, text: answer});
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b', 'c'], false, 'Тема'))
			.resolves.toEqual({correctIndexes: [0, 2], source: 'GPT-OSS 120B'});
		expect(sendMessage).toHaveBeenCalledTimes(2);
		const gptRequest = sendMessage.mock.calls[1][0] as Record<string, unknown>;
		expect(gptRequest.url).toBe(OVH_OPENAI_URL);
		expect((gptRequest.headers as Record<string, string>).Authorization).toBeUndefined();
		expect(JSON.parse(gptRequest.body as string)).toMatchObject({model: OVH_GPT_OSS_MODEL, max_tokens: 2048, temperature: 0, reasoning_effort: 'low'});
	});

	it.each([null, 'не знаю', '99'])('пробует GPT-OSS, если Qwen не выбрал допустимый вариант (%s)', async content => {
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			const model = JSON.parse(message.body as string).model;
			const text = JSON.stringify({choices: [{message: {content: model === OVH_QWEN_MODEL ? content : '2', reasoning: 'Вариант 1.'}}]});
			return cb({error: false, status: 200, text});
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b'], true, ''))
			.resolves.toEqual({correctIndexes: [1], source: 'GPT-OSS 120B'});
		expect(sendMessage).toHaveBeenCalledTimes(2);
	});

	it.each([
		{source: 'JarvisClaw', endpoint: JARVIS_AI_URL, model: JARVIS_AI_MODEL, position: 2},
		{source: 'BlockRun', endpoint: BLOCKRUN_AI_URL, model: BLOCKRUN_AI_MODEL, position: 3},
	])('использует $source без Authorization, сохраняя вопрос и несколько правильных вариантов', async ({source, endpoint, model, position}) => {
		const answer = JSON.stringify({choices: [{message: {content: '1,3', reasoning: 'Сравниваю 1, 2 и 3.'}}]});
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			return cb(message.url === endpoint
				? {error: false, status: 200, text: answer}
				: {error: false, status: 429, text: ''});
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b', 'c'], false, 'Тема'))
			.resolves.toEqual({correctIndexes: [0, 2], source});
		expect(sendMessage.mock.calls.map(([message]) => message.url)).toEqual(directRouteUrls.slice(0, position + 1));
		const request = sendMessage.mock.calls[position][0] as Record<string, unknown>;
		expect(request).toMatchObject({method: 'POST', timeoutMs: 30_000});
		expect(request.headers).toEqual({'Content-Type': 'application/json'});
		const body = JSON.parse(request.body as string);
		expect(body).toMatchObject({model, max_tokens: 2048, temperature: 0});
		expect(body).not.toHaveProperty('reasoning_effort');
		expect(body.messages).toEqual(JSON.parse(sendMessage.mock.calls[0][0].body as string).messages);
	});

	it.each([
		{error: false, status: 429, text: ''},
		{error: false, status: 503, text: ''},
		{error: true, status: 0, text: '', message: 'таймаут 30 с'},
		{error: false, status: 200, text: 'not JSON'},
		{error: false, status: 200, text: JSON.stringify({choices: [{message: {content: null, reasoning: 'Ответ 2.'}}]})},
		{error: false, status: 200, text: JSON.stringify({choices: [{message: {content: '99'}}]})},
	])('при сбое новых шлюзов ($status, $text) продолжает маршрут через Llama', async failure => {
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			if (message.url === OVH_AI_URL) return cb({error: false, status: 200, text: JSON.stringify({choices: [{message: {content: '2'}}]})});
			return cb(failure);
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b'], true, ''))
			.resolves.toEqual({correctIndexes: [1], source: 'OVH'});
		expect(sendMessage.mock.calls.map(([message]) => message.url)).toEqual(directRouteUrls.slice(0, -1));
	});

	it('сохраняет Llama после Qwen, GPT-OSS и новых шлюзов, если они не определили ответ', async () => {
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			const content = message.url === OVH_AI_URL ? '2' : null;
			return cb({error: false, status: 200, text: JSON.stringify({choices: [{message: {content}}]})});
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b'], true, ''))
			.resolves.toEqual({correctIndexes: [1], source: 'OVH'});
		expect(sendMessage).toHaveBeenCalledTimes(5);
		expect(sendMessage.mock.calls.map(([message]) => JSON.parse(message.body as string).model))
			.toEqual([OVH_QWEN_MODEL, OVH_GPT_OSS_MODEL, JARVIS_AI_MODEL, BLOCKRUN_AI_MODEL, OVH_AI_MODEL]);
	});

	it('после лимита предыдущих сервисов отправляет тот же вопрос в Kilo без ключа', async () => {
		const answer = JSON.stringify({choices: [{message: {content: '1,3', reasoning: 'Сравниваю варианты 1, 2 и 3.'}}]});
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			if (message.url === KILO_AI_URL) return cb({error: false, status: 200, text: answer});
			return cb({error: false, status: 429, text: ''});
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b', 'c'], false, 'Тема'))
			.resolves.toEqual({correctIndexes: [0, 2], source: 'Kilo'});
		expect(sendMessage.mock.calls.map(([message]) => message.url))
			.toEqual(directRouteUrls);
		const kiloRequest = sendMessage.mock.calls[5][0] as Record<string, unknown>;
		expect(kiloRequest).toMatchObject({method: 'POST', timeoutMs: 30_000});
		expect(kiloRequest.headers).toEqual({'Content-Type': 'application/json'});
		const body = JSON.parse(kiloRequest.body as string);
		expect(body).toMatchObject({model: KILO_AI_MODEL, max_tokens: 2048, temperature: 0});
		expect(body).not.toHaveProperty('reasoning_effort');
		const firstRequest = sendMessage.mock.calls[0][0] as Record<string, unknown>;
		expect(body.messages).toEqual(JSON.parse(firstRequest.body as string).messages);
	});

	it.each([
		{error: false, status: 429, text: ''},
		{error: false, status: 503, text: ''},
		{error: true, status: 0, text: '', message: 'таймаут 30 с'},
	])('после сбоя Kilo ($status) сам выбирает модель Horde и повторяет вопрос', async failure => {
		const models = JSON.stringify({
			data: [
				{id: 'horde/auto', base_model: 'mistral-instruct', known_to_horde: true, worker_threads: 6, size: 24},
			],
		});
		const answer = JSON.stringify({choices: [{message: {content: '1,3'}}]});

		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			if (message.url === KILO_AI_URL) return cb(failure);
			if (message.url === HORDE_MODELS_URL) return cb({error: false, status: 200, text: models});
			if (message.url === HORDE_AI_URL) return cb({error: false, status: 200, text: answer});
			return cb({error: false, status: 429, text: ''});
		});

		const result = await askFreeAI('Вопрос?', ['a', 'b', 'c'], false, 'Тема');
		const hordeRequest = sendMessage.mock.calls[7][0] as Record<string, unknown>;

		expect(result).toEqual({correctIndexes: [0, 2], source: 'AI Horde'});
		expect(sendMessage).toHaveBeenCalledTimes(8);
		expect(sendMessage.mock.calls.map(([message]) => message.url))
			.toEqual([...directRouteUrls, HORDE_MODELS_URL, HORDE_AI_URL]);
		expect(hordeRequest.url).toBe(HORDE_AI_URL);
		expect((hordeRequest.headers as Record<string, string>).Authorization).toBe(`Bearer ${HORDE_ANONYMOUS_KEY}`);
		expect(JSON.parse(hordeRequest.body as string)).toMatchObject({model: 'horde/auto', timeout: 120});
	});

	it.each([null, 'не знаю', '99'])('переходит на Horde, если Kilo не выбрал допустимый вариант (%s)', async content => {
		const models = JSON.stringify({
			data: [{id: 'horde/auto', template: 'chatml', worker_threads: 1}],
		});
		const emptyAnswer = JSON.stringify({choices: [{message: {content: 'не знаю'}}]});
		const hordeAnswer = JSON.stringify({choices: [{message: {content: '1'}}]});
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			if (message.url === KILO_AI_URL) return cb({error: false, status: 200, text: JSON.stringify({choices: [{message: {content}}]})});
			if (message.url === HORDE_MODELS_URL) return cb({error: false, status: 200, text: models});
			if (message.url === HORDE_AI_URL) return cb({error: false, status: 200, text: hordeAnswer});
			return cb({error: false, status: 200, text: emptyAnswer});
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b'], true, ''))
			.resolves.toEqual({correctIndexes: [0], source: 'AI Horde'});
		expect(sendMessage).toHaveBeenCalledTimes(8);
	});

	it('сохраняет ошибки обоих новых шлюзов и Kilo, если все сервисы недоступны', async () => {
		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => cb({
			error: false,
			status: message.url === KILO_AI_URL ? 403 : 401,
			text: '',
		}));

		await expect(askFreeAI('Вопрос?', ['a', 'b'], true, ''))
			.rejects.toThrow(/JarvisClaw — .*; BlockRun — .*; OVH — .*; Kilo — .*; Horde — /);
		expect(sendMessage).toHaveBeenCalledTimes(7);
		expect(sendMessage.mock.calls[6][0].url).toBe(HORDE_MODELS_URL);
	});

	it.each([
		{name: 'JarvisClaw', endpoint: JARVIS_AI_URL, position: 2},
		{name: 'BlockRun', endpoint: BLOCKRUN_AI_URL, position: 3},
		{name: 'Kilo', endpoint: KILO_AI_URL, position: 5},
	])('после остановки во время запроса $name не обращается к следующим сервисам', async ({endpoint, position}) => {
		let finishRequest!: (res: IRequestResponse) => void;
		const requestStarted = new Promise<void>(resolve => {
			sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
				if (message.url !== endpoint) return cb({error: false, status: 429, text: ''});
				finishRequest = cb;
				resolve();
			});
		});
		const controller = new AbortController();
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, '', {signal: controller.signal})
			.catch(error => error);

		await requestStarted;
		controller.abort();
		finishRequest({error: false, status: 429, text: ''});

		expect(await outcome).toMatchObject({name: 'AbortError'});
		expect(sendMessage.mock.calls.map(([message]) => message.url))
			.toEqual(directRouteUrls.slice(0, position + 1));
	});

	it('после остановки во время запроса Qwen не обращается к остальным моделям', async () => {
		let finishRequest!: (res: IRequestResponse) => void;
		const requestStarted = new Promise<void>(resolve => {
			sendMessage.mockImplementation((_message, cb) => {
				finishRequest = cb;
				resolve();
			});
		});
		const controller = new AbortController();
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, '', {signal: controller.signal})
			.catch(error => error);

		await requestStarted;
		controller.abort();
		finishRequest({error: false, status: 429, text: ''});

		expect(await outcome).toMatchObject({name: 'AbortError'});
		expect(sendMessage).toHaveBeenCalledTimes(1);
	});
});

describe('askFreeAI recovery', () => {
	const models = JSON.stringify({data: [{id: 'horde/auto', template: 'chatml', worker_threads: 1}]});
	const answer: IRequestResponse = {
		error: false,
		status: 200,
		text: JSON.stringify({choices: [{message: {content: '2'}}]}),
	};

	function mockHordeResponses(responses: IRequestResponse[]) {
		let index = 0;
		sendMessage.mockImplementation((message: Record<string, unknown>, cb: (res: IRequestResponse) => void) => {
			if (directRouteUrls.includes(message.url as string)) return cb({error: false, status: 429, text: ''});
			if (message.url === HORDE_MODELS_URL) return cb({error: false, status: 200, text: models});
			return cb(responses[Math.min(index++, responses.length - 1)]);
		});
	}

	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('после 500 повторяет тот же вопрос через 3 секунды и обновляет список моделей', async () => {
		mockHordeResponses([{error: false, status: 500, text: 'Internal Server Error'}, answer]);
		const onRetry = vi.fn();
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, 'Тема', {onRetry})
			.then(value => ({value}), error => ({error}));

		await vi.advanceTimersByTimeAsync(0);
		expect(onRetry).toHaveBeenCalledWith({attempt: 2, maxAttempts: 3, delayMs: 3000, reason: 'ошибка 500'});
		expect(sendMessage).toHaveBeenCalledTimes(8);
		await vi.advanceTimersByTimeAsync(2999);
		expect(sendMessage).toHaveBeenCalledTimes(8);
		await vi.advanceTimersByTimeAsync(1);

		expect(await outcome).toEqual({value: {correctIndexes: [1], source: 'AI Horde'}});
		const requests = sendMessage.mock.calls.map(([message]) => message as Record<string, unknown>);
		expect(requests.filter(message => message.url === HORDE_MODELS_URL)).toHaveLength(2);
		const completions = requests.filter(message => message.url === HORDE_AI_URL);
		expect(completions).toHaveLength(2);
		expect(completions[1].body).toBe(completions[0].body);
	});

	it.each([
		{error: false, status: 502, text: 'Bad Gateway'},
		{error: false, status: 504, text: 'Gateway Timeout'},
		{error: true, status: 0, text: '', message: 'таймаут 125 с'},
		{error: false, status: 406, text: JSON.stringify({detail: 'Request timed out.'})},
		{error: false, status: 429, text: ''},
	])('восстанавливается после другого временного сбоя ($status, $message)', async failure => {
		mockHordeResponses([failure, answer]);
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, '')
			.then(value => ({value}), error => ({error}));

		await vi.advanceTimersByTimeAsync(3000);

		expect(await outcome).toEqual({value: {correctIndexes: [1], source: 'AI Horde'}});
		expect(sendMessage).toHaveBeenCalledTimes(10);
	});

	it('ограничивает постоянную ошибку сервера тремя попытками с паузами 3 и 6 секунд', async () => {
		mockHordeResponses([{error: false, status: 503, text: 'Service Unavailable'}]);
		const onRetry = vi.fn();
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, '', {onRetry})
			.catch(error => error);

		await vi.advanceTimersByTimeAsync(3000);
		expect(sendMessage).toHaveBeenCalledTimes(10);
		await vi.advanceTimersByTimeAsync(5999);
		expect(sendMessage).toHaveBeenCalledTimes(10);
		await vi.advanceTimersByTimeAsync(1);

		expect(await outcome).toMatchObject({message: expect.stringContaining('Horde — ошибка 503')});
		expect(onRetry.mock.calls.map(([retry]) => retry.delayMs)).toEqual([3000, 6000]);
		expect(sendMessage).toHaveBeenCalledTimes(12);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(sendMessage).toHaveBeenCalledTimes(12);
	});

	it('не повторяет запрос с неверным ключом', async () => {
		mockHordeResponses([{error: false, status: 401, text: 'Unauthorized'}]);
		const onRetry = vi.fn();

		await expect(askFreeAI('Вопрос?', ['a', 'b'], true, '', {onRetry}))
			.rejects.toThrow('Horde — неверный API-ключ');
		await vi.advanceTimersByTimeAsync(60_000);
		expect(sendMessage).toHaveBeenCalledTimes(8);
		expect(onRetry).not.toHaveBeenCalled();
	});

	it('восстанавливается после 500 при получении списка моделей', async () => {
		let modelRequests = 0;
		sendMessage.mockImplementation((message: Record<string, unknown>, cb: (res: IRequestResponse) => void) => {
			if (directRouteUrls.includes(message.url as string)) return cb({error: false, status: 429, text: ''});
			if (message.url === HORDE_MODELS_URL) {
				modelRequests += 1;
				return cb(modelRequests === 1
					? {error: false, status: 500, text: ''}
					: {error: false, status: 200, text: models});
			}
			return cb(answer);
		});
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, '')
			.then(value => ({value}), error => ({error}));

		await vi.advanceTimersByTimeAsync(3000);

		expect(await outcome).toEqual({value: {correctIndexes: [1], source: 'AI Horde'}});
		expect(modelRequests).toBe(2);
		expect(sendMessage).toHaveBeenCalledTimes(9);
	});

	it('отменяет отложенный повтор при остановке', async () => {
		mockHordeResponses([{error: false, status: 500, text: ''}, answer]);
		const controller = new AbortController();
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, '', {signal: controller.signal})
			.catch(error => error);

		await vi.advanceTimersByTimeAsync(0);
		expect(sendMessage).toHaveBeenCalledTimes(8);
		controller.abort();
		expect(await outcome).toMatchObject({name: 'AbortError'});
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(sendMessage).toHaveBeenCalledTimes(8);
	});

	it('не повторяет ошибку запроса, завершившегося после отмены', async () => {
		let finishCompletion!: (res: IRequestResponse) => void;
		sendMessage.mockImplementation((message: Record<string, unknown>, cb: (res: IRequestResponse) => void) => {
			if (directRouteUrls.includes(message.url as string)) return cb({error: false, status: 429, text: ''});
			if (message.url === HORDE_MODELS_URL) return cb({error: false, status: 200, text: models});
			finishCompletion = cb;
		});
		const controller = new AbortController();
		const onRetry = vi.fn();
		const outcome = askFreeAI('Вопрос?', ['a', 'b'], true, '', {signal: controller.signal, onRetry})
			.catch(error => error);

		await vi.advanceTimersByTimeAsync(0);
		controller.abort();
		finishCompletion({error: false, status: 500, text: ''});
		expect(await outcome).toMatchObject({name: 'AbortError'});
		await vi.advanceTimersByTimeAsync(60_000);
		expect(onRetry).not.toHaveBeenCalled();
		expect(sendMessage).toHaveBeenCalledTimes(8);
	});
});
