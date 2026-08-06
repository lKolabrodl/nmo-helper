/**
 * Анонимная регистрация установки и подпись запросов к собственному NMO API.
 * Закрытый ключ хранится как неэкспортируемый CryptoKey в IndexedDB background.
 *
 * @module api/nmo-auth
 */

import {NMO_API_BASE_URL, NMO_API_HOST} from '../utils/constants';

const SIGNATURE_PROTOCOL = 'NMO-REQUEST-V1';
const INSTALLATION_ENDPOINT = `${NMO_API_BASE_URL}/installations`;
const PROTECTED_PATHS = new Set(['/api/nmo/topics', '/api/nmo/topic']);
const AUTH_HEADER_NAMES = [
	'X-NMO-Installation',
	'X-NMO-Timestamp',
	'X-NMO-Nonce',
	'X-NMO-Signature',
] as const;

const DATABASE_NAME = 'nmo-helper-auth';
const DATABASE_VERSION = 1;
const IDENTITY_STORE = 'identity';
const IDENTITY_KEY = 'current';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{87}$/;

interface IInstallationIdentity {
	readonly privateKey: CryptoKey;
	readonly publicKey: string;
	readonly installationId?: string;
}

let identityPromise: Promise<IInstallationIdentity> | null = null;
let registrationPromise: Promise<IInstallationIdentity> | null = null;

/** Проверяет, что URL относится ровно к одному из подписываемых NMO-маршрутов. */
export function isProtectedNmoApiRequest(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:'
			&& url.hostname === NMO_API_HOST
			&& url.port === ''
			&& PROTECTED_PATHS.has(url.pathname);
	} catch {
		return false;
	}
}

/**
 * Выполняет запрос к собственному NMO API с подписью текущей установки.
 * При потере серверной регистрации один раз регистрирует тот же ключ повторно.
 */
export async function fetchSignedNmoRequest(
	url: string,
	init: RequestInit = {},
): Promise<Response> {
	if (!isProtectedNmoApiRequest(url)) {
		throw new Error('Signing is not allowed for this URL.');
	}

	let identity = await ensureRegistered(await getIdentity());
	let response = await signedFetch(url, init, identity);

	if (response.status === 401) {
		identity = await ensureRegistered(await forgetRegistration(identity));
		response = await signedFetch(url, init, identity);
	}

	return response;
}

/** Собирает каноническую строку в том же формате, который проверяет сервер. */
export async function buildCanonicalNmoRequest(
	installationId: string,
	timestamp: string,
	nonce: string,
	method: string,
	target: string,
	topicTicket: string,
	body: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
	const bodyHash = await crypto.subtle.digest('SHA-256', body);
	const fields = [
		SIGNATURE_PROTOCOL,
		installationId,
		timestamp,
		nonce,
		method.toUpperCase(),
		target,
		topicTicket,
		toHex(new Uint8Array(bodyHash)),
	];
	return new TextEncoder().encode(fields.join('\n'));
}

async function signedFetch(
	value: string,
	init: RequestInit,
	identity: IInstallationIdentity,
): Promise<Response> {
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
	Object.entries(headers).forEach(([name, headerValue]) => {
		requestHeaders.set(name, headerValue);
	});

	return fetch(url.toString(), {
		...init,
		method,
		headers: requestHeaders,
	});
}

async function ensureRegistered(
	identity: IInstallationIdentity,
): Promise<IInstallationIdentity> {
	if (identity.installationId) return identity;
	if (registrationPromise) return registrationPromise;

	registrationPromise = registerIdentity(identity);
	try {
		return await registrationPromise;
	} finally {
		registrationPromise = null;
	}
}

async function registerIdentity(
	identity: IInstallationIdentity,
): Promise<IInstallationIdentity> {
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
	if (!UUID_PATTERN.test(installationId)) {
		throw new Error('NMO installation registration returned an invalid id.');
	}

	const registered = {...identity, installationId};
	await writeIdentity(registered);
	identityPromise = Promise.resolve(registered);
	return registered;
}

async function createSignatureHeaders(
	privateKey: CryptoKey,
	installationId: string,
	method: string,
	target: string,
	topicTicket: string,
	body: Uint8Array<ArrayBuffer>,
): Promise<Record<string, string>> {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
	const nonce = toBase64Url(nonceBytes);
	const canonical = await buildCanonicalNmoRequest(
		installationId,
		timestamp,
		nonce,
		method,
		target,
		topicTicket,
		body,
	);
	const signature = await crypto.subtle.sign(
		{name: 'ECDSA', hash: 'SHA-256'},
		privateKey,
		canonical,
	);
	const headers: Record<string, string> = {
		'X-NMO-Timestamp': timestamp,
		'X-NMO-Nonce': nonce,
		'X-NMO-Signature': toBase64Url(new Uint8Array(signature)),
	};
	if (installationId) headers['X-NMO-Installation'] = installationId;
	return headers;
}

async function getIdentity(): Promise<IInstallationIdentity> {
	if (!identityPromise) identityPromise = loadOrCreateIdentity();
	try {
		return await identityPromise;
	} catch (error) {
		identityPromise = null;
		throw error;
	}
}

async function loadOrCreateIdentity(): Promise<IInstallationIdentity> {
	const stored = await readIdentity();
	if (isValidIdentity(stored)) return stored;

	const keyPair = await crypto.subtle.generateKey(
		{name: 'ECDSA', namedCurve: 'P-256'},
		false,
		['sign', 'verify'],
	) as CryptoKeyPair;
	const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
	const identity: IInstallationIdentity = {
		privateKey: keyPair.privateKey,
		publicKey: toBase64Url(new Uint8Array(publicKey)),
	};
	await writeIdentity(identity);
	return identity;
}

async function forgetRegistration(
	identity: IInstallationIdentity,
): Promise<IInstallationIdentity> {
	const unregistered: IInstallationIdentity = {
		privateKey: identity.privateKey,
		publicKey: identity.publicKey,
	};
	await writeIdentity(unregistered);
	identityPromise = Promise.resolve(unregistered);
	return unregistered;
}

function isValidIdentity(value: unknown): value is IInstallationIdentity {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<IInstallationIdentity>;
	const algorithm = candidate.privateKey?.algorithm as EcKeyAlgorithm | undefined;
	if (
		typeof candidate.publicKey !== 'string'
		|| !PUBLIC_KEY_PATTERN.test(candidate.publicKey)
		|| !candidate.privateKey
		|| candidate.privateKey.type !== 'private'
		|| candidate.privateKey.extractable
		|| algorithm?.name !== 'ECDSA'
		|| algorithm.namedCurve !== 'P-256'
		|| !candidate.privateKey.usages.includes('sign')
	) return false;
	return candidate.installationId === undefined
		|| (
			typeof candidate.installationId === 'string'
			&& UUID_PATTERN.test(candidate.installationId)
		);
}

function bodyBytes(body: BodyInit | null | undefined): Uint8Array<ArrayBuffer> {
	if (body === undefined || body === null) return new Uint8Array();
	if (typeof body === 'string') return new TextEncoder().encode(body);
	if (body instanceof ArrayBuffer) return new Uint8Array(body);
	if (ArrayBuffer.isView(body)) {
		return new Uint8Array(
			new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
		);
	}
	throw new Error('Unsupported signed request body.');
}

function readIdentity(): Promise<unknown> {
	return withDatabase(database => new Promise((resolve, reject) => {
		const transaction = database.transaction(IDENTITY_STORE, 'readonly');
		const request = transaction.objectStore(IDENTITY_STORE).get(IDENTITY_KEY);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error || new Error('Could not read NMO identity.'));
	}));
}

function writeIdentity(identity: IInstallationIdentity): Promise<void> {
	return withDatabase(database => new Promise((resolve, reject) => {
		const transaction = database.transaction(IDENTITY_STORE, 'readwrite');
		transaction.objectStore(IDENTITY_STORE).put(identity, IDENTITY_KEY);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error || new Error('Could not save NMO identity.'));
		transaction.onabort = () => reject(transaction.error || new Error('Could not save NMO identity.'));
	}));
}

function withDatabase<T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> {
	return openDatabase().then(async database => {
		try {
			return await operation(database);
		} finally {
			database.close();
		}
	});
}

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

function toBase64Url(value: Uint8Array): string {
	let binary = '';
	value.forEach(byte => { binary += String.fromCharCode(byte); });
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function toHex(value: Uint8Array): string {
	return Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
}
