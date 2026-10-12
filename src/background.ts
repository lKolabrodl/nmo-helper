/**
 * Background service worker.
 * Принимает сообщения от content-скриптов и проксирует fetch-запросы
 * для обхода CORS-ограничений (content-скрипты не могут делать cross-origin запросы).
 * @module background
 */

import {isProtectedNmoApiRequest} from './api/fetch/fetch';
import {fetchSignedNmoRequest} from './api/nmo-auth';
import {getHostPermissionPattern} from './api/host-permissions';

interface IHostPermissionMessage {
	readonly action: 'requestHostPermission';
	readonly url: string;
}

/** Формат сообщения от content-скрипта */
interface IFetchMessage {
  readonly action: 'fetch';
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string> | null;
  readonly body: string | null;
  readonly credentials: RequestCredentials | null;
  readonly timeoutMs: number | null;
}

const MAX_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

/** Не даёт сообщению от content-скрипта создать бесконечный или слишком долгий таймер. */
function normalizeRequestTimeout(timeoutMs: number | null): number | null {
	if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return null;
	return Math.min(Math.round(timeoutMs), MAX_REQUEST_TIMEOUT_MS);
}

chrome.runtime.onMessage.addListener(
	(message: IFetchMessage | IHostPermissionMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
		if (__BUILD_TARGET__ === 'chrome-store' && message?.action === 'requestHostPermission') {
			try {
				const origin = getHostPermissionPattern(message.url);
				// Не вставлять await/contains перед request: нужен жест из клика в панели.
				chrome.permissions.request({origins: [origin]}, granted => {
					const message = chrome.runtime.lastError?.message;
					sendResponse({granted: !message && granted, message});
				});
			} catch (error) {
				sendResponse({granted: false, message: (error as Error).message});
			}
			return true;
		}
		if (message?.action !== 'fetch') return false;

		const timeoutMs = normalizeRequestTimeout(message.timeoutMs);
		const abortController = timeoutMs ? new AbortController() : null;
		let timedOut = false;
		const timeoutId = timeoutMs ? setTimeout(() => {
			timedOut = true;
			abortController?.abort();
		}, timeoutMs) : null;

		const requestInit: RequestInit = {
			method: message.method || 'GET',
			headers: message.headers || undefined,
			body: message.body || undefined,
			credentials: message.credentials || undefined,
			signal: abortController?.signal,
		};
		const request = (async () => {
			if (__BUILD_TARGET__ === 'chrome-store') {
				const origin = getHostPermissionPattern(message.url);
				if (!await chrome.permissions.contains({origins: [origin]})) {
					throw new Error('нет разрешения на доступ к серверу; разрешите доступ и запустите AI снова');
				}
			}

			return isProtectedNmoApiRequest(message.url)
				? fetchSignedNmoRequest(message.url, requestInit)
				: fetch(message.url, requestInit);
		})();

		request
			.then(async (res) => {
				const text = await res.text();
				sendResponse({ error: false, status: res.status, text });
			})
			.catch((err) => {
				const message = timedOut && timeoutMs
					? `таймаут ${Math.ceil(timeoutMs / 1000)} с`
					: (err as Error).message;
				sendResponse({ error: true, status: 0, text: '', message });
			})
			.finally(() => {
				if (timeoutId) clearTimeout(timeoutId);
			});

		return true;
	}
);
