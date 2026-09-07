/**
 * Background service worker.
 * Принимает сообщения от content-скриптов и проксирует fetch-запросы
 * для обхода CORS-ограничений (content-скрипты не могут делать cross-origin запросы).
 * @module background
 */

import {isProtectedNmoApiRequest} from './api/fetch/fetch';
import {fetchSignedNmoRequest} from './api/nmo-auth';

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
	(message: IFetchMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
		if (message.action !== 'fetch') return false;

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
		const request = isProtectedNmoApiRequest(message.url)
			? fetchSignedNmoRequest(message.url, requestInit)
			: fetch(message.url, requestInit);

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
