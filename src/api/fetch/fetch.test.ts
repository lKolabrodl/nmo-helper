import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fetchViaBackground, getResponseText, isProtectedNmoApiRequest} from './fetch';

type SendMessageFn = (msg: unknown, cb: (res: unknown) => void) => void;

const sendMessage = vi.fn();

beforeEach(() => {
	sendMessage.mockReset();
	(chrome.runtime as unknown as { sendMessage: SendMessageFn }).sendMessage = sendMessage as unknown as SendMessageFn;
});

describe('isProtectedNmoApiRequest', () => {
	it.each([
		'https://nmo-helper.ru/api/nmo/topics?q=тема',
		'https://nmo-helper.ru/api/nmo/topic',
	])('разрешает точный защищённый endpoint: %s', value => {
		expect(isProtectedNmoApiRequest(value)).toBe(true);
	});

	it.each([
		'http://nmo-helper.ru/api/nmo/topics?q=тема',
		'https://www.nmo-helper.ru/api/nmo/topic',
		'https://nmo-helper.ru.evil.example/api/nmo/topic',
		'https://nmo-helper.ru/api/nmo/topic/uid',
		'https://nmo-helper.ru/api/version',
		'not a url',
	])('не выдаёт подпись постороннему URL: %s', value => {
		expect(isProtectedNmoApiRequest(value)).toBe(false);
	});
});

describe('fn fetchViaBackground', () => {

	it('шлёт сообщение в background с action=fetch и переданным url', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: 'ok' }));
		await fetchViaBackground('https://example.com/api');
		expect(sendMessage).toHaveBeenCalledTimes(1);
		const [msg] = sendMessage.mock.calls[0];
		expect(msg).toMatchObject({ action: 'fetch', url: 'https://example.com/api' });
	});

	it('по умолчанию method=GET, headers=null, body=null', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '' }));
		await fetchViaBackground('https://example.com/');
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.method).toBe('GET');
		expect(msg.headers).toBeNull();
		expect(msg.body).toBeNull();
		expect(msg.credentials).toBeNull();
	});

	it('пробрасывает method, headers и body из options', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '' }));
		await fetchViaBackground('https://example.com/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"a":1}',
			credentials: 'include',
		});
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.method).toBe('POST');
		expect(msg.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(msg.body).toBe('{"a":1}');
		expect(msg.credentials).toBe('include');
	});

	it('резолвит промис с ответом от background', async () => {
		const response = { error: false, status: 201, text: '{"ok":true}' };
		sendMessage.mockImplementation((_msg, cb) => cb(response));
		const res = await fetchViaBackground('https://example.com/');
		expect(res).toEqual(response);
	});

	it('возвращает ошибочный ответ как есть (error=true)', async () => {
		const response = { error: true, status: 0, text: '', message: 'network fail' };
		sendMessage.mockImplementation((_msg, cb) => cb(response));
		const res = await fetchViaBackground('https://example.com/');
		expect(res).toEqual(response);
	});

	it('пустой объект options эквивалентен дефолтам', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '' }));
		await fetchViaBackground('https://example.com/', {});
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.method).toBe('GET');
		expect(msg.headers).toBeNull();
		expect(msg.body).toBeNull();
		expect(msg.credentials).toBeNull();
	});

	it('превращает invalidated context в ошибочный ответ, а не в unhandled exception', async () => {
		sendMessage.mockImplementation(() => {
			throw new Error('Extension context invalidated.');
		});

		await expect(fetchViaBackground('https://example.com/')).resolves.toEqual({
			error: true,
			status: 0,
			text: '',
			message: 'Extension context invalidated.',
		});
	});
});

describe('getResponseText', () => {
	it('возвращает текст успешного ответа', () => {
		expect(getResponseText({error: false, status: 200, text: 'answer'})).toBe('answer');
	});

	it.each([
		{
			response: {error: true, status: 0, text: ''},
			message: 'ошибка сети — проверь URL',
		},
		{
			response: {error: false, status: 404, text: 'not found'},
			message: 'ошибка 404: сервер отклонил запрос',
		},
		{
			response: {error: false, status: 200, text: '   '},
			message: 'пустой ответ от сервера',
		},
	])('бросает единообразную ошибку: $message', ({response, message}) => {
		expect(() => getResponseText(response)).toThrow(message);
	});
});
