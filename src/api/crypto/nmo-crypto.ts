/**
 * Криптографические примитивы аутентификации запросов к NMO API.
 *
 * Модуль отвечает только за ключи, каноническое представление запросов,
 * ECDSA-подпись и преобразование байтов. Хранение идентичности и сетевые
 * запросы остаются в `api/nmo-auth`.
 *
 * @module api/crypto/nmo-crypto
 */

/** Версия протокола, записываемая первой строкой канонического запроса. */
const SIGNATURE_PROTOCOL = 'NMO-REQUEST-V1';
/** Допустимый UUID, возвращаемый сервером как ID установки. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Base64url-представление 65-байтного открытого ключа P-256 без padding. */
const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{87}$/;

/** Заголовки аутентификации, которые всегда формируются модулем заново. */
export const AUTH_HEADER_NAMES = [
	'X-NMO-Installation',
	'X-NMO-Timestamp',
	'X-NMO-Nonce',
	'X-NMO-Signature',
] as const;

/** Локальная криптографическая идентичность одной установки расширения. */
export interface IInstallationIdentity {
	/** Неэкспортируемый закрытый ключ ECDSA P-256 для подписи запросов. */
	readonly privateKey: CryptoKey;
	/** Открытый ключ P-256 в raw/base64url-представлении. */
	readonly publicKey: string;
	/** UUID, выданный сервером после регистрации открытого ключа. */
	readonly installationId?: string;
}

/**
 * Создаёт новую идентичность с неэкспортируемым закрытым ключом ECDSA P-256.
 *
 * @returns Новая незарегистрированная идентичность установки.
 */
export async function createInstallationIdentity(): Promise<IInstallationIdentity> {
	const keyPair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'},false, ['sign', 'verify']) as CryptoKeyPair;
	const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);

	return {
		privateKey: keyPair.privateKey,
		publicKey: toBase64Url(new Uint8Array(publicKey)),
	};
}

/**
 * Проверяет структуру, параметры ключа и необязательный серверный ID записи.
 *
 * @param value Произвольное значение, прочитанное из IndexedDB.
 * @returns `true`, если значение является пригодной идентичностью установки.
 */
export function isValidIdentity(value: unknown): value is IInstallationIdentity {
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

	return candidate.installationId === undefined || isValidInstallationId(candidate.installationId);
}

/**
 * Проверяет формат серверного идентификатора установки.
 *
 * @param value Значение из ответа сервера или локального хранилища.
 * @returns `true`, если значение является допустимым UUID установки.
 */
export function isValidInstallationId(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Собирает каноническое представление запроса в том же формате, который
 * проверяет сервер. Тело включается в представление как SHA-256 в hex-формате.
 *
 * @param installationId UUID зарегистрированной установки; пустая строка при регистрации.
 * @param timestamp Unix timestamp в секундах в строковом представлении.
 * @param nonce Случайный nonce в base64url-представлении.
 * @param method HTTP-метод; перед записью приводится к верхнему регистру.
 * @param target Путь и query-string запроса без origin.
 * @param topicTicket Необязательный билет доступа из `X-NMO-Ticket`.
 * @param body Точные байты HTTP-тела.
 * @returns UTF-8-байты полей протокола, соединённых символом перевода строки.
 */
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

/**
 * Создаёт служебные заголовки ECDSA-подписи для одного запроса.
 * В подпись входят Unix timestamp, случайный 128-битный nonce и каноническое
 * представление запроса. Заголовок установки пропускается для регистрации.
 *
 * @param privateKey Неэкспортируемый закрытый ключ ECDSA P-256.
 * @param installationId UUID установки или пустая строка при регистрации.
 * @param method HTTP-метод запроса.
 * @param target Путь запроса вместе с query-string.
 * @param topicTicket Значение заголовка `X-NMO-Ticket` или пустая строка.
 * @param body Точные байты тела запроса.
 * @returns Новые заголовки аутентификации для HTTP-запроса.
 */
export async function createSignatureHeaders(privateKey: CryptoKey, installationId: string,	method: string, target: string,	topicTicket: string, body: Uint8Array<ArrayBuffer>): Promise<Record<string, string>> {
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
	const signature = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'},	privateKey,	canonical);
	const headers: Record<string, string> = {
		'X-NMO-Timestamp': timestamp,
		'X-NMO-Nonce': nonce,
		'X-NMO-Signature': toBase64Url(new Uint8Array(signature)),
	};

	if (installationId) headers['X-NMO-Installation'] = installationId;

	return headers;
}

/**
 * Преобразует поддерживаемое тело подписанного запроса в точный массив байтов.
 * Строки кодируются как UTF-8; `ArrayBufferView` копируется с учётом смещения.
 *
 * @param body Тело из `RequestInit`.
 * @returns Байты тела или пустой массив для отсутствующего тела.
 * @throws Для потоков, `Blob`, `FormData`, `URLSearchParams` и других
 * неподдерживаемых типов, которые нельзя однозначно хешировать до сериализации.
 */
export function bodyBytes(body: BodyInit | null | undefined): Uint8Array<ArrayBuffer> {
	if (body === undefined || body === null) return new Uint8Array();
	if (typeof body === 'string') return new TextEncoder().encode(body);
	if (body instanceof ArrayBuffer) return new Uint8Array(body);
	if (ArrayBuffer.isView(body)) {
		return new Uint8Array(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
	}
	throw new Error('Unsupported signed request body.');
}

/**
 * Кодирует байты в URL-safe Base64 без завершающих символов padding.
 *
 * @param value Байты для кодирования.
 * @returns Строка base64url без `=`.
 */
function toBase64Url(value: Uint8Array): string {
	let binary = '';
	value.forEach(byte => { binary += String.fromCharCode(byte); });
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

/**
 * Кодирует байты строчными шестнадцатеричными парами.
 *
 * @param value Байты для кодирования.
 * @returns Hex-строка длиной `value.length * 2`.
 */
function toHex(value: Uint8Array): string {
	return Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
}
