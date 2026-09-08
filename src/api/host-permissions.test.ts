import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {getHostPermissionPattern, requestCustomEndpointPermission} from './host-permissions';

const runtime = chrome.runtime as unknown as {
	sendMessage: (message: unknown, callback: (response: unknown) => void) => void;
};

describe('getHostPermissionPattern', () => {
	it.each([
		[' https://API.example.com/v1/chat/completions?key=secret#fragment ', 'https://api.example.com/*'],
		['http://localhost:11434/v1/chat/completions', 'http://localhost/*'],
		['http://127.0.0.1:8080/v1/chat/completions', 'http://127.0.0.1/*'],
	])('запрашивает только конкретный хост для %s', (url, pattern) => {
		expect(getHostPermissionPattern(url)).toBe(pattern);
	});

	it.each([
		'', 'not a url', 'api.example.com/v1', 'https:api.example.com',
		'file:///test', 'javascript:alert(1)', 'ftp://example.com/test',
		'https://*/*', 'https://*.example.com/v1', 'https://user:password@example.com/v1',
	])('отклоняет некорректный адрес или широкую маску: %s', url => {
		expect(() => getHostPermissionPattern(url)).toThrow();
	});
});

describe('requestCustomEndpointPermission', () => {
	beforeEach(() => {
		vi.stubGlobal('__BUILD_TARGET__', 'chrome-store');
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal('__BUILD_TARGET__', 'chrome');
	});

	it('отправляет сообщение синхронно, пока действует жест пользователя', async () => {
		const sendMessage = vi.spyOn(runtime, 'sendMessage').mockImplementation((_message, callback) => {
			callback({granted: true});
		});

		const result = requestCustomEndpointPermission('https://api.example.com/v1');

		expect(sendMessage).toHaveBeenCalledWith({action: 'requestHostPermission', url: 'https://api.example.com/v1'}, expect.any(Function));
		await expect(result).resolves.toBe(true);
	});

	it('возвращает отказ пользователя', async () => {
		vi.spyOn(runtime, 'sendMessage').mockImplementation((_message, callback) => callback({granted: false}));
		await expect(requestCustomEndpointPermission('https://api.example.com/v1')).resolves.toBe(false);
	});

	it.each([undefined, {}, {granted: 'true'}, {granted: false, message: 'permission failed'}])('не считает ошибку или неполный ответ разрешением: %j', response => {
		vi.spyOn(runtime, 'sendMessage').mockImplementation((_message, callback) => callback(response));
		return expect(requestCustomEndpointPermission('https://api.example.com/v1')).rejects.toThrow();
	});

	it('не запрашивает разрешение в сборках с прежним доступом к хостам', async () => {
		vi.stubGlobal('__BUILD_TARGET__', 'firefox-store');
		const sendMessage = vi.spyOn(runtime, 'sendMessage');
		await expect(requestCustomEndpointPermission('https://api.example.com/v1')).resolves.toBe(true);
		expect(sendMessage).not.toHaveBeenCalled();
	});
});
