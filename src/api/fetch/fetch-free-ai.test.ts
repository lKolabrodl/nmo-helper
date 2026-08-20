import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
	askFreeAI,
	HORDE_AI_URL,
	HORDE_ANONYMOUS_KEY,
	HORDE_MODELS_URL,
	OVH_AI_MODEL,
	OVH_AI_URL,
	resolveFreeAiRequest,
	selectHordeModel,
} from './fetch-free-ai';

type SendMessageFn = (msg: unknown, cb: (res: unknown) => void) => void;

const sendMessage = vi.fn();

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
	it('сначала использует OVH и не трогает Horde при успешном ответе', async () => {
		const answer = JSON.stringify({choices: [{message: {content: '2'}}]});
		sendMessage.mockImplementation((_msg, cb) => cb({error: false, status: 200, text: answer}));

		const result = await askFreeAI('Вопрос?', ['a', 'b', 'c'], true, 'Тема');
		const [message] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];

		expect(result).toEqual({correctIndexes: [1], source: 'OVH'});
		expect(sendMessage).toHaveBeenCalledTimes(1);
		expect(message.url).toBe(OVH_AI_URL);
		expect((message.headers as Record<string, string>).Authorization).toBeUndefined();
	});

	it('при лимите OVH сам выбирает модель Horde и повторяет вопрос', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const models = JSON.stringify({
			data: [
				{id: 'horde/auto', base_model: 'mistral-instruct', known_to_horde: true, worker_threads: 6, size: 24},
			],
		});
		const answer = JSON.stringify({choices: [{message: {content: '1,3'}}]});

		sendMessage.mockImplementation((message: Record<string, unknown>, cb) => {
			if (message.url === OVH_AI_URL) return cb({error: false, status: 429, text: ''});
			if (message.url === HORDE_MODELS_URL) return cb({error: false, status: 200, text: models});
			return cb({error: false, status: 200, text: answer});
		});

		const result = await askFreeAI('Вопрос?', ['a', 'b', 'c'], false, 'Тема');
		const hordeRequest = sendMessage.mock.calls[2][0] as Record<string, unknown>;

		expect(result).toEqual({correctIndexes: [0, 2], source: 'AI Horde'});
		expect(sendMessage).toHaveBeenCalledTimes(3);
		expect(hordeRequest.url).toBe(HORDE_AI_URL);
		expect((hordeRequest.headers as Record<string, string>).Authorization).toBe(`Bearer ${HORDE_ANONYMOUS_KEY}`);
		expect(JSON.parse(hordeRequest.body as string)).toMatchObject({model: 'horde/auto', timeout: 120});
		errorSpy.mockRestore();
	});

	it('переходит на Horde, если OVH не определил вариант', async () => {
		const models = JSON.stringify({
			data: [{id: 'horde/auto', template: 'chatml', worker_threads: 1}],
		});
		const emptyAnswer = JSON.stringify({choices: [{message: {content: 'не знаю'}}]});
		const hordeAnswer = JSON.stringify({choices: [{message: {content: '1'}}]});
		let call = 0;
		sendMessage.mockImplementation((_message, cb) => {
			call += 1;
			if (call === 1) return cb({error: false, status: 200, text: emptyAnswer});
			if (call === 2) return cb({error: false, status: 200, text: models});
			return cb({error: false, status: 200, text: hordeAnswer});
		});

		await expect(askFreeAI('Вопрос?', ['a', 'b'], true, ''))
			.resolves.toEqual({correctIndexes: [0], source: 'AI Horde'});
	});
});
