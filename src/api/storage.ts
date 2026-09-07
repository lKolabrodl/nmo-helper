
/**
 * Читает значение из chrome.storage.local.
 * @param key — ключ хранилища
 * @param defaultValue — значение по умолчанию, если ключ не найден
 */
export function storageGet<T>(key: string, defaultValue: T): Promise<T> {
	return new Promise<T>(resolve => {
		try {
			chrome.storage.local.get<Record<string, unknown>>(key, result => {
				if (hasRuntimeError() || !result) {
					resolve(defaultValue);
					return;
				}

				resolve((result[key] !== undefined ? result[key] : defaultValue) as T);
			});
		} catch {
			// A content script keeps running briefly after an extension update/reload.
			resolve(defaultValue);
		}
	});
}

/**
 * Записывает значение в chrome.storage.local.
 * @param key — ключ хранилища
 * @param value — значение для сохранения
 */
export function storageSet(key: string, value: unknown): void {
	try {
		chrome.storage.local.set({[key]: value}, consumeRuntimeError);
	} catch {
		// The page will be refreshed after a dev reload; the stale script must stay quiet.
	}
}

function hasRuntimeError(): boolean {
	try {
		return Boolean(chrome.runtime.lastError);
	} catch {
		return true;
	}
}

function consumeRuntimeError(): void {
	try {
		void chrome.runtime.lastError;
	} catch {
		// Access itself may fail after the extension context has been invalidated.
	}
}
