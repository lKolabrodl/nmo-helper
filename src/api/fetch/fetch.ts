/**
 * Общие типы и функции для HTTP-запросов через background service worker.
 *
 * @module api/fetch/fetch
 */

import {NMO_API_HOST} from '../../utils/constants';

/** Точные пути NMO API, для которых разрешено создавать подпись. */
const PROTECTED_NMO_API_PATHS = new Set(['/api/nmo/topics', '/api/nmo/topic']);

/** Унифицированный ответ background-обработчика сетевого запроса. */
export interface IRequestResponse {
	/** `true`, если запрос не удалось выполнить из-за сетевой или runtime-ошибки. */
	readonly error: boolean;
	/** HTTP-статус ответа; `0`, если ответ от сервера не был получен. */
	readonly status: number;
	/** Сырое текстовое тело ответа. */
	readonly text: string;
	/** Необязательное описание сетевой или runtime-ошибки. */
	readonly message?: string;
}

/** Параметры HTTP-запроса, передаваемые background service worker. */
export interface IRequestOptions {
	/** HTTP-метод. По умолчанию используется `GET`. */
	readonly method?: string;
	/** Заголовки запроса либо `null`, если заголовки не нужны. */
	readonly headers?: Record<string, string> | null;
	/** Строковое тело запроса либо `null`, если тело отсутствует. */
	readonly body?: string | null;
	/** Режим передачи cookies и других учётных данных. */
	readonly credentials?: RequestCredentials | null;
}

/**
 * Проверяет, что абсолютный URL относится ровно к одному из подписываемых
 * NMO-маршрутов: HTTPS, ожидаемый host без нестандартного порта и точный путь.
 *
 * @param value URL-кандидат для проверки.
 * @returns `true`, если для URL разрешено формировать заголовки подписи.
 */
export function isProtectedNmoApiRequest(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:'
			&& url.hostname === NMO_API_HOST
			&& url.port === ''
			&& PROTECTED_NMO_API_PATHS.has(url.pathname);
	} catch {
		return false;
	}
}

/**
 * Выполняет HTTP-запрос из content-скрипта через background service worker.
 *
 * Content-скрипты Chrome-расширения не могут делать cross-origin запросы
 * напрямую из-за CORS, поэтому запрос отправляется сообщением
 * `chrome.runtime.sendMessage({ action: 'fetch', ... })` в background.ts,
 * который уже выполняет настоящий `fetch` и шлёт ответ обратно.
 *
 * Функция никогда не бросает: сетевые ошибки приходят как `{ error: true }`.
 *
 * @param url     Абсолютный URL запроса.
 * @param options HTTP-метод, заголовки, тело и режим передачи credentials.
 *                По умолчанию `GET` без заголовков, тела и явного режима credentials.
 * @returns Промис, резолвящийся ответом от background. Никогда не реджектится.
 */
export function fetchViaBackground(url: string, options: IRequestOptions = {}): Promise<IRequestResponse> {
	return new Promise(resolve => {
		try {
			chrome.runtime.sendMessage({
				action: 'fetch',
				url,
				method: options.method || 'GET',
				headers: options.headers || null,
				body: options.body || null,
				credentials: options.credentials || null,
			}, (response: IRequestResponse | undefined) => {
				const runtimeError = getRuntimeErrorMessage();
				if (runtimeError) {
					resolve(requestFailure(runtimeError));
					return;
				}

				resolve(response ?? requestFailure('Background did not return a response.'));
			});
		} catch (error) {
			resolve(requestFailure(getErrorMessage(error)));
		}
	});
}

/**
 * Возвращает текст успешного ответа или бросает единообразную ошибку запроса.
 *
 * @param response Ответ {@link fetchViaBackground}.
 * @returns Непустое текстовое тело ответа.
 * @throws {Error} При сетевой ошибке, ошибочном HTTP-статусе или пустом теле.
 */
export function getResponseText(response: IRequestResponse): string {
	if (response.error) throw new Error('ошибка сети — проверь URL');
	if (response.status < 200 || response.status >= 400) {
		throw new Error(`ошибка ${response.status}: сервер отклонил запрос`);
	}
	if (!response.text.trim()) throw new Error('пустой ответ от сервера');

	return response.text;
}

/**
 * Безопасно читает ошибку последнего вызова Chrome Runtime API.
 *
 * Доступ к `chrome.runtime.lastError` сам может бросить после инвалидирования
 * контекста расширения, поэтому такое исключение также превращается в строку.
 *
 * @returns Текст runtime-ошибки либо `null`, если ошибки нет.
 */
function getRuntimeErrorMessage(): string | null {
	try {
		return chrome.runtime.lastError?.message ?? null;
	} catch (error) {
		return getErrorMessage(error);
	}
}

/**
 * Приводит произвольное выброшенное значение к читаемому сообщению.
 *
 * @param error Значение, полученное в блоке `catch`.
 * @returns `Error.message` для объекта ошибки или строковое представление значения.
 */
function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Создаёт унифицированный ответ для запроса, завершившегося без HTTP-ответа.
 *
 * @param message Описание сетевой или runtime-ошибки.
 * @returns Ошибочный ответ со статусом `0` и пустым телом.
 */
function requestFailure(message: string): IRequestResponse {
	return {error: true, status: 0, text: '', message};
}

/**
 * Проверяет, что background-запрос завершился успешно и вернул непустое тело.
 *
 * @param response Ответ {@link fetchViaBackground}.
 * @returns `true` для HTTP `[200, 400)` без сетевой ошибки и с непустым текстом.
 */
export function isSuccessful(response: IRequestResponse): boolean {
	return !response.error && response.status >= 200 && response.status < 400 && !!response.text.trim();
}

/**
 * Применяет асинхронный mapper с ограниченным числом параллельных workers.
 * Порядок элементов в результате совпадает с порядком входного массива.
 *
 * @typeParam T Тип входного элемента.
 * @typeParam R Тип результата mapper'а.
 * @param items Элементы для обработки.
 * @param limit Максимальное число одновременно работающих workers.
 * @param mapper Асинхронная функция обработки одного элемента.
 * @returns Результаты в исходном порядке.
 */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	/** Обрабатывает элементы по общему индексу, пока входной массив не закончится. */
	const worker = async () => {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			results[index] = await mapper(items[index]);
		}
	};

	await Promise.all(Array.from({length: Math.min(limit, items.length)}, () => worker()));
	return results;
}
