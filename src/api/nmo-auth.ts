/**
 * Анонимная регистрация установки и подпись запросов к собственному NMO API.
 * Закрытый ключ хранится как неэкспортируемый CryptoKey в IndexedDB background.
 *
 * @module api/nmo-auth
 */

import {NMO_API_BASE_URL} from '../utils/constants';
import {
	AUTH_HEADER_NAMES,
	bodyBytes,
	createInstallationIdentity,
	createSignatureHeaders,
	isValidIdentity,
	isValidInstallationId,
} from './crypto/nmo-crypto';
import type {IInstallationIdentity} from './crypto/nmo-crypto';

/** Endpoint анонимной регистрации установки. */
const INSTALLATION_ENDPOINT = `${NMO_API_BASE_URL}/installations`;

/** Имя IndexedDB с криптографической идентичностью установки. */
const DATABASE_NAME = 'nmo-helper-auth';
/** Версия схемы {@link DATABASE_NAME}. */
const DATABASE_VERSION = 1;
/** Хранилище единственной текущей идентичности. */
const IDENTITY_STORE = 'identity';
/** Ключ текущей идентичности в {@link IDENTITY_STORE}. */
const IDENTITY_KEY = 'current';

/** Общий промис загрузки идентичности для параллельных запросов. */
let identityPromise: Promise<IInstallationIdentity> | null = null;
/** Общий промис регистрации, предотвращающий дублирующие POST-запросы. */
let registrationPromise: Promise<IInstallationIdentity> | null = null;

/**
 * Выполняет запрос к собственному NMO API с подписью текущей установки.
 * При потере серверной регистрации один раз регистрирует тот же ключ повторно.
 *
 * @param url Абсолютный URL защищённого NMO endpoint'а.
 * @param init Параметры `fetch`; служебные заголовки подписи будут заменены.
 * @returns Ответ первого запроса либо единственной повторной попытки после `401`.
 * @throws Если не удалось получить, зарегистрировать или подписать
 * идентичность установки либо выполнить сетевой запрос.
 */
export async function fetchSignedNmoRequest(url: string, init: RequestInit = {}): Promise<Response> {

	let identity = await ensureRegistered(await getIdentity());
	let response = await signedFetch(url, init, identity);

	if (response.status === 401) {
		identity = await ensureRegistered(await forgetRegistration(identity));
		response = await signedFetch(url, init, identity);
	}

	return response;
}

/**
 * Подписывает и выполняет один HTTP-запрос с переданной идентичностью.
 * Пользовательские значения служебных auth-заголовков удаляются перед записью
 * рассчитанных значений.
 *
 * @param value Абсолютный URL защищённого запроса.
 * @param init Исходные параметры `fetch`.
 * @param identity Зарегистрированная идентичность с закрытым ключом.
 * @returns Ответ браузерного `fetch` без дополнительной обработки статуса.
 */
async function signedFetch(value: string, init: RequestInit, identity: IInstallationIdentity): Promise<Response> {
	const url = new URL(value);
	const method = (init.method || 'GET').toUpperCase();
	const body = bodyBytes(init.body);
	const requestHeaders = new Headers(init.headers);
	const headers = await createSignatureHeaders(
		identity.privateKey,
		identity.installationId || '',
		method,
		url.pathname + url.search,
		requestHeaders.get('X-NMO-Ticket') || '',
		body,
	);

	AUTH_HEADER_NAMES.forEach(name => requestHeaders.delete(name));
	Object.entries(headers).forEach(([name, headerValue]) => requestHeaders.set(name, headerValue));

	return fetch(url.toString(), {...init, method, headers: requestHeaders});
}

/**
 * Возвращает зарегистрированную идентичность, регистрируя её при необходимости.
 * Параллельные вызовы без `installationId` используют один общий запрос.
 *
 * @param identity Валидная локальная идентичность установки.
 * @returns Идентичность с серверным `installationId`.
 */
async function ensureRegistered(identity: IInstallationIdentity): Promise<IInstallationIdentity> {
	if (identity.installationId) return identity;
	if (registrationPromise) return registrationPromise;

	registrationPromise = registerIdentity(identity);
	try {
		return await registrationPromise;
	} finally {
		registrationPromise = null;
	}
}

/**
 * Регистрирует открытый ключ на сервере и сохраняет полученный UUID в IndexedDB.
 * Запрос подписывается тем же закрытым ключом без ID установки.
 *
 * @param identity Ещё не зарегистрированная локальная идентичность.
 * @returns Сохранённая идентичность с выданным сервером `installationId`.
 * @throws Если сервер вернул статус не `201`, невалидный UUID или сохранение не удалось.
 */
async function registerIdentity(identity: IInstallationIdentity): Promise<IInstallationIdentity> {
	const bodyText = JSON.stringify({public_key: identity.publicKey});
	const body = new TextEncoder().encode(bodyText);
	const headers = await createSignatureHeaders(
		identity.privateKey,
		'',
		'POST',
		'/api/nmo/installations',
		'',
		body,
	);
	const response = await fetch(INSTALLATION_ENDPOINT, {
		method: 'POST',
		headers: {
			...headers,
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		},
		body: bodyText,
		credentials: 'omit',
	});

	if (response.status !== 201) {
		throw new Error(`NMO installation registration failed: ${response.status}`);
	}

	const payload = await response.json() as {installation_id?: unknown};
	const installationId = typeof payload.installation_id === 'string'
		? payload.installation_id
		: '';

	if (!isValidInstallationId(installationId)) {
		throw new Error('NMO installation registration returned an invalid id.');
	}

	const registered = {...identity, installationId};
	await writeIdentity(registered);

	identityPromise = Promise.resolve(registered);
	return registered;
}

/**
 * Получает локальную идентичность через общий кеширующий промис.
 * После ошибки кеш сбрасывается, чтобы следующий вызов мог повторить загрузку.
 *
 * @returns Валидная существующая или вновь созданная идентичность.
 */
async function getIdentity(): Promise<IInstallationIdentity> {
	if (!identityPromise) identityPromise = loadOrCreateIdentity();
	try {
		return await identityPromise;
	} catch (error) {
		identityPromise = null;
		throw error;
	}
}

/**
 * Загружает идентичность из IndexedDB либо создаёт новую пару ECDSA P-256.
 * Некорректная сохранённая запись заменяется новой; закрытый ключ создаётся
 * неэкспортируемым.
 *
 * @returns Валидная локальная идентичность, сохранённая в IndexedDB.
 */
async function loadOrCreateIdentity(): Promise<IInstallationIdentity> {
	const stored = await readIdentity();
	if (isValidIdentity(stored)) return stored;

	const identity = await createInstallationIdentity();
	await writeIdentity(identity);
	return identity;
}

/**
 * Удаляет только серверный ID регистрации, сохраняя исходную пару ключей.
 * Используется после `401`, чтобы повторно зарегистрировать ту же установку.
 *
 * @param identity Текущая зарегистрированная идентичность.
 * @returns Сохранённая идентичность без `installationId`.
 */
async function forgetRegistration(identity: IInstallationIdentity): Promise<IInstallationIdentity> {
	const unregistered: IInstallationIdentity = {
		privateKey: identity.privateKey,
		publicKey: identity.publicKey,
	};

	await writeIdentity(unregistered);
	identityPromise = Promise.resolve(unregistered);
	return unregistered;
}

/**
 * Читает текущую идентичность из IndexedDB без предположений о её структуре.
 *
 * @returns Сохранённое значение либо `undefined`, если запись отсутствует.
 */
function readIdentity(): Promise<unknown> {
	return withDatabase(database => new Promise((resolve, reject) => {
		const transaction = database.transaction(IDENTITY_STORE, 'readonly');
		const request = transaction.objectStore(IDENTITY_STORE).get(IDENTITY_KEY);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error || new Error('Could not read NMO identity.'));
	}));
}

/**
 * Атомарно записывает текущую идентичность в IndexedDB.
 *
 * @param identity Валидная идентичность для сохранения.
 * @returns Промис завершения read-write транзакции.
 */
function writeIdentity(identity: IInstallationIdentity): Promise<void> {
	return withDatabase(database => new Promise((resolve, reject) => {
		const transaction = database.transaction(IDENTITY_STORE, 'readwrite');
		transaction.objectStore(IDENTITY_STORE).put(identity, IDENTITY_KEY);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error || new Error('Could not save NMO identity.'));
		transaction.onabort = () => reject(transaction.error || new Error('Could not save NMO identity.'));
	}));
}

/**
 * Открывает IndexedDB на время одной операции и гарантированно закрывает соединение.
 *
 * @typeParam T Тип результата операции.
 * @param operation Асинхронная операция с открытым соединением IndexedDB.
 * @returns Результат переданной операции.
 */
function withDatabase<T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> {
	return openDatabase().then(async database => {
		try {
			return await operation(database);
		} finally {
			database.close();
		}
	});
}

/**
 * Открывает базу идентичности и при обновлении схемы создаёт object store.
 *
 * @returns Открытое соединение IndexedDB.
 * @throws Если открытие завершилось ошибкой или заблокировано другой версией базы.
 */
function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(IDENTITY_STORE)) {
				request.result.createObjectStore(IDENTITY_STORE);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error || new Error('Could not open NMO identity storage.'));
		request.onblocked = () => reject(new Error('NMO identity storage is blocked.'));
	});
}
