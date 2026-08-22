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

/** Dev-mode auto-reload: polls dev-reload.json and reloads extension on change */
declare const __DEV__: boolean;

if (__DEV__) {
	const devReloadMessage = {type: 'NMO_DEV_RELOAD'} as const;
	const nmoTabUrls = [
		'https://edu.rosminzdrav.ru/*',
		'https://*.edu.rosminzdrav.ru/*',
	];
	let lastTimestamp = 0;

	const prepareNmoTabsForReload = async (): Promise<void> => {
		try {
			const tabs = await chrome.tabs.query({url: nmoTabUrls});

			await Promise.all(tabs.map(tab => {
				if (tab.id === undefined) return Promise.resolve();
				const tabId = tab.id;

				const notification = new Promise<void>(resolve => {
					try {
						chrome.tabs.sendMessage(tabId, devReloadMessage, () => {
							// Reading lastError prevents a harmless "Receiving end does not exist"
							// warning for tabs whose content script has not started yet.
							void chrome.runtime.lastError;
							resolve();
						});
					} catch {
						resolve();
					}
				});

				const timeout = new Promise<void>(resolve => setTimeout(resolve, 500));
				return Promise.race([notification, timeout]);
			}));
		} catch {
			// Extension reload must still proceed if a tab disappears mid-query.
		}
	};

	setInterval(async () => {
		try {
			const url = chrome.runtime.getURL('dev-reload.json');
			const res = await fetch(url, { cache: 'no-store' });
			const { timestamp } = await res.json();

			if (lastTimestamp && timestamp !== lastTimestamp) {
				// eslint-disable-next-line no-console
				console.log('[NMO Dev] Reloading extension...');
				await prepareNmoTabsForReload();
				chrome.runtime.reload();
			}
			lastTimestamp = timestamp;
		} catch { /* ignore */ }
	}, 1000);
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
