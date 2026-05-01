/**
 * Проверка наличия новой версии расширения.
 *
 * Заглушка под будущий серверный API: всегда возвращает текущую версию
 * как latest. Реальный эндпоинт подключим позже — сигнатура останется.
 */

export interface IVersionInfo {
	readonly current: string;
	readonly latest: string;
	readonly url?: string;
}

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '';

export async function checkVersion(): Promise<IVersionInfo> {
	// TODO: заменить на реальный fetch к серверу версий.
	await new Promise(r => setTimeout(r, 700));
	return { current: EXT_VERSION, latest: EXT_VERSION };
}

export function isOutdated(info: IVersionInfo): boolean {
	if (!info.current || !info.latest) return false;
	return cmp(info.current, info.latest) < 0;
}

function cmp(a: string, b: string): number {
	const pa = a.split('.').map(n => parseInt(n, 10) || 0);
	const pb = b.split('.').map(n => parseInt(n, 10) || 0);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const da = pa[i] ?? 0, db = pb[i] ?? 0;
		if (da !== db) return da < db ? -1 : 1;
	}
	return 0;
}
