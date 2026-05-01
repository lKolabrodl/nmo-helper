/**
 * Проверка наличия новой версии расширения.
 *
 * Сервер: GET https://nmo-helper.ru/api/version → {ok, latest, url}.
 * Защита от спама — клиентский кэш в chrome.storage.local + throttle.
 */

import {fetchViaBackground} from './fetch';
import {storageGet, storageSet} from './storage';

const VERSION_ENDPOINT = 'https://nmo-helper.ru/api/version';
const CACHE_KEY = 'versionCheck';

/** Максимальный возраст кэша для автоматических проверок (6 часов) */
const TTL_AUTO_MS = 6 * 60 * 60 * 1000;
/** Минимальный интервал между ручными проверками (30 секунд) */
const TTL_MANUAL_MS = 30 * 1000;

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '';

export interface IVersionInfo {
	readonly current: string;
	readonly latest: string;
}

interface ICacheEntry {
	readonly checkedAt: number;
	readonly latest: string;
}

/**
 * Возвращает данные о версии расширения. По умолчанию использует кэш с
 * TTL 6 часов. При `force=true` (ручной клик) — TTL 30 секунд (анти-спам).
 *
 * Сетевые ошибки и 429 от сервера никогда не бросаются: возвращаем cached,
 * либо «у вас актуальная версия», чтобы UI не визуализировал ошибку.
 */
export async function checkVersion(force = false): Promise<IVersionInfo> {
	const cache = await storageGet<ICacheEntry | null>(CACHE_KEY, null);
	const ttl = force ? TTL_MANUAL_MS : TTL_AUTO_MS;
	const fresh = cache && Date.now() - cache.checkedAt < ttl;

	if (fresh) return {current: EXT_VERSION, latest: cache.latest};


	const res = await fetchViaBackground(VERSION_ENDPOINT, {method: 'GET'});

	// сеть упала или сервер ругается — возвращаем кэш, либо «всё хорошо»
	if (res.error || res.status === 429 || res.status < 200 || res.status >= 300) {
		if (cache) return {current: EXT_VERSION, latest: cache.latest};
		return {current: EXT_VERSION, latest: EXT_VERSION};
	}

	let body: {ok?: boolean; latest?: string} = {};
	try { body = JSON.parse(res.text); } catch { /* noop */ }

	const latest = (body.latest || '').trim() || EXT_VERSION;
	const entry: ICacheEntry = {checkedAt: Date.now(), latest};
	storageSet(CACHE_KEY, entry);

	return {current: EXT_VERSION, latest};
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
