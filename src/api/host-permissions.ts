export interface IHostPermissionResponse {
	readonly granted: boolean;
	readonly message?: string;
}

/** Возвращает разрешение на один HTTP(S)-хост, без пути, токена и поддоменов. */
export function getHostPermissionPattern(value: string): string {
	let url: URL;
	try {
		if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) throw new Error();
		url = new URL(value.trim());
	} catch {
		throw new Error('укажите полный URL endpoint: https://… или http://…');
	}

	if (url.username || url.password || url.hostname.includes('*')) {
		throw new Error('укажите адрес конкретного сервера без логина и пароля в URL');
	}

	// Разрешение действует на хост; нестандартный порт остаётся в URL запроса.
	return `${url.protocol}//${url.hostname}/*`;
}

/** Вызывать прямо из обработчика клика: сообщение сохраняет жест пользователя. */
export function requestCustomEndpointPermission(url: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		try {
			getHostPermissionPattern(url);
			if (__BUILD_TARGET__ !== 'chrome-store') return resolve(true);

			chrome.runtime.sendMessage({action: 'requestHostPermission', url}, (response: IHostPermissionResponse | undefined) => {
				const runtimeError = chrome.runtime.lastError?.message;
				if (runtimeError || response?.message) {
					reject(new Error(runtimeError || response?.message));
				} else if (typeof response?.granted !== 'boolean') {
					reject(new Error('не удалось запросить доступ к endpoint; обновите страницу НМО'));
				} else {
					resolve(response.granted);
				}
			});
		} catch (error) {
			reject(error);
		}
	});
}
