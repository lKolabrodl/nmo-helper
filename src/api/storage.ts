
/**
 * Читает значение из chrome.storage.local.
 * @param key — ключ хранилища
 * @param defaultValue — значение по умолчанию, если ключ не найден
 */
export function storageGet<T>(key: string, defaultValue: T): Promise<T> {
	return new Promise<T>(resolve => {
		chrome.storage.local.get(key, (result: Record<string, unknown>) => {
			resolve((result[key] !== undefined ? result[key] : defaultValue) as T);
		});
	});
}

/**
 * Записывает значение в chrome.storage.local.
 * @param key — ключ хранилища
 * @param value — значение для сохранения
 */
export function storageSet(key: string, value: unknown): void {
	chrome.storage.local.set({ [key]: value });
}
