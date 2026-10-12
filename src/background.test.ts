import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fetchSignedNmoRequest} from './api/nmo-auth';

vi.mock('./api/nmo-auth', () => ({fetchSignedNmoRequest: vi.fn()}));

type MessageListener = (message: unknown, sender: chrome.runtime.MessageSender, respond: (response: unknown) => void) => boolean;

const originalChrome = globalThis.chrome;
const originalFetch = globalThis.fetch;
const requestPermission = vi.fn();
const containsPermission = vi.fn();
const fetchMock = vi.fn();
let onMessage: MessageListener;

beforeEach(async () => {
	vi.clearAllMocks();
	vi.resetModules();
	vi.stubGlobal('__BUILD_TARGET__', 'chrome-store');
	requestPermission.mockImplementation((_permissions, callback) => callback(true));
	containsPermission.mockResolvedValue(true);
	fetchMock.mockResolvedValue(new Response('answer', {status: 200}));
	globalThis.fetch = fetchMock;
	globalThis.chrome = {
		...originalChrome,
		permissions: {request: requestPermission, contains: containsPermission},
		runtime: {
			...originalChrome.runtime,
			onMessage: {addListener: (listener: MessageListener) => { onMessage = listener; }},
		},
	} as unknown as typeof chrome;
	await import('./background');
});

afterEach(() => {
	globalThis.chrome = originalChrome;
	globalThis.fetch = originalFetch;
	vi.stubGlobal('__BUILD_TARGET__', 'chrome');
});

function send(message: unknown): Promise<unknown> {
	return new Promise(resolve => onMessage(message, {}, resolve));
}

describe('background host permissions', () => {
	it('вызывает браузерный запрос сразу, без асинхронной проверки перед ним', async () => {
		const response = send({action: 'requestHostPermission', url: 'https://api.example.com/v1?key=secret'});

		expect(requestPermission).toHaveBeenCalledWith({origins: ['https://api.example.com/*']}, expect.any(Function));
		expect(containsPermission).not.toHaveBeenCalled();
		await expect(response).resolves.toMatchObject({granted: true});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('возвращает отказ без сетевого запроса', async () => {
		requestPermission.mockImplementation((_permissions, callback) => callback(false));
		await expect(send({action: 'requestHostPermission', url: 'https://api.example.com/v1'})).resolves.toMatchObject({granted: false});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('не передаёт в Chrome широкую маску вместо адреса endpoint', async () => {
		await expect(send({action: 'requestHostPermission', url: 'https://*/*'})).resolves.toMatchObject({granted: false, message: expect.any(String)});
		expect(requestPermission).not.toHaveBeenCalled();
	});

	it('возвращает lastError браузера как отказ', async () => {
		requestPermission.mockImplementation((_permissions, callback) => {
			Object.assign(chrome.runtime, {lastError: {message: 'User gesture required'}});
			callback(false);
		});
		await expect(send({action: 'requestHostPermission', url: 'https://api.example.com/v1'})).resolves.toEqual({granted: false, message: 'User gesture required'});
	});

	it('обрабатывает синхронную ошибку permissions.request', async () => {
		requestPermission.mockImplementation(() => { throw new Error('request failed'); });
		await expect(send({action: 'requestHostPermission', url: 'https://api.example.com/v1'})).resolves.toEqual({granted: false, message: 'request failed'});
	});

	it('без разрешения не отправляет токен и тело даже на сервер с открытым CORS', async () => {
		containsPermission.mockResolvedValue(false);
		const response = await send({action: 'fetch', url: 'https://api.example.com/v1', method: 'POST', headers: {Authorization: 'Bearer secret'}, body: 'question'});

		expect(response).toMatchObject({error: true, status: 0, message: expect.stringContaining('нет разрешения')});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(fetchSignedNmoRequest).not.toHaveBeenCalled();
		expect(requestPermission).not.toHaveBeenCalled();
	});

	it('после выдачи доступа сохраняет URL, порт, метод, токен и тело запроса', async () => {
		await expect(send({action: 'fetch', url: 'http://localhost:11434/v1', method: 'POST', headers: {Authorization: 'Bearer secret'}, body: 'question'})).resolves.toEqual({error: false, status: 200, text: 'answer'});

		expect(containsPermission).toHaveBeenCalledWith({origins: ['http://localhost/*']});
		expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/v1', expect.objectContaining({method: 'POST', headers: {Authorization: 'Bearer secret'}, body: 'question'}));
	});

	it('повторно проверяет разрешение и блокирует запрос после отзыва доступа', async () => {
		await send({action: 'fetch', url: 'https://api.example.com/v1'});
		containsPermission.mockResolvedValue(false);
		await expect(send({action: 'fetch', url: 'https://api.example.com/v1'})).resolves.toMatchObject({error: true});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('сохраняет подписанный маршрут для собственной базы НМО', async () => {
		vi.mocked(fetchSignedNmoRequest).mockResolvedValue(new Response('signed answer'));
		await expect(send({action: 'fetch', url: 'https://nmo-helper.ru/api/nmo/topic'})).resolves.toEqual({error: false, status: 200, text: 'signed answer'});
		expect(fetchSignedNmoRequest).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('не меняет сетевой доступ обычной Chrome-сборки', async () => {
		vi.stubGlobal('__BUILD_TARGET__', 'chrome');
		await expect(send({action: 'fetch', url: 'https://api.example.com/v1'})).resolves.toMatchObject({error: false});
		expect(containsPermission).not.toHaveBeenCalled();
	});
});
