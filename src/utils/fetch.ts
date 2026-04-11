/**
 * HTTP-запросы через background service worker (обход CORS).
 * @module utils/fetch
 */

import type { IFetchResponse } from '../types';

/**
 * Выполняет HTTP-запрос через background service worker.
 * Content-скрипты не могут делать cross-origin запросы напрямую,
 * поэтому запрос отправляется через chrome.runtime.sendMessage → background.ts.
 */
interface IFetchOptions {
	readonly method?: string;
	readonly headers?: Record<string, string> | null;
	readonly body?: string | null;
}

export function fetchViaBackground(url: string, options: IFetchOptions = {}): Promise<IFetchResponse> {
	return new Promise(resolve => {
		chrome.runtime.sendMessage({
			action: 'fetch',
			url,
			method: options.method || 'GET',
			headers: options.headers || null,
			body: options.body || null,
		}, resolve);
	});
}
