/**
 * Background service worker.
 * Принимает сообщения от content-скриптов и проксирует fetch-запросы
 * для обхода CORS-ограничений (content-скрипты не могут делать cross-origin запросы).
 * @module background
 */

/** Формат сообщения от content-скрипта */
interface IFetchMessage {
  readonly action: 'fetch';
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string> | null;
  readonly body: string | null;
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

		fetch(message.url, {
			method: message.method || 'GET',
			headers: message.headers || undefined,
			body: message.body || undefined,
		})
			.then(async (res) => {
				const text = await res.text();
				sendResponse({ error: false, status: res.status, text });
			})
			.catch((err) => {
				sendResponse({ error: true, message: (err as Error).message });
			});

		return true;
	}
);
