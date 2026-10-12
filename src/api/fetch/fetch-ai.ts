import {AI_RESPONSES_URL, AI_URL} from '../../utils/constants';
import {buildPrompt, getApiModel} from '../../components/SectionAi/utils';
import {fetchViaBackground, type IRequestOptions, type IRequestResponse} from './fetch';

// Маршрут запоминается только после успешного ответа, без списка ID моделей.
const responsesModels = new Set<string>();

/** Необязательные параметры конкретного AI-провайдера. */
export interface IAiRequestOptions {
	/** Клиентский таймаут background-fetch в миллисекундах. */
	readonly timeoutMs?: number;
	/** Лимит выходных токенов для OpenAI-совместимых endpoint'ов. */
	readonly maxTokens?: number;
	/** Дополнительные поля JSON-тела, например серверный timeout AI Horde. */
	readonly extraBody?: Readonly<Record<string, unknown>>;
}

/** Сохраняет HTTP-статус и признак временного сбоя AI-запроса. */
export class AiRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly retryable = status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600),
	) {
		super(message);
		this.name = 'AiRequestError';
	}
}

/**
 * Отправляет вопрос теста в LLM через ProxyAPI (или кастомный endpoint) и
 * возвращает номера правильных вариантов.
 *
 * Модель получает system-prompt «ты врач-эксперт по теме X» и просит вернуть
 * номера ответов через запятую. Регулярка из ответа достаёт все числа, каждое
 * уменьшается на 1 — чтобы попасть в 0-индексированный массив `options`.
 *
 * @param apiKey   Bearer-токен ProxyAPI или кастомного endpoint.
 * @param question Текст вопроса.
 * @param options  Варианты ответа в порядке, в котором они показаны пользователю.
 * @param isSingle `true` — ровно один правильный; `false` — допускается несколько.
 * @param topic    Название темы курса. Пустая строка — без темы в system-prompt.
 * @param model    ID модели (`gpt-5.4-mini`, `claude-sonnet-5`, `gemini-3.5-flash` и т.д.).
 * @param endpoint Необязательный кастомный URL (например, self-hosted OpenAI-совместимый).
 *                 Если указан, модель шлётся как есть, без префикса провайдера.
 * @returns Массив 0-индексированных номеров вариантов, помеченных моделью как правильные.
 *          Пустой массив — если в ответе не нашлось ни одной цифры.
 * @throws {Error} `ошибка сети` — сетевой сбой.
 * @throws {Error} `неверный API-ключ` — HTTP 401.
 * @throws {Error} При запрете доступа к модели или недоступной модели.
 * @throws {Error} `нет средств на балансе` — HTTP 402.
 * @throws {Error} `лимит запросов — подождите` — HTTP 429.
 * @throws {Error} `ошибка <status>` — любой другой не-2xx HTTP-статус.
 */
export async function askAI(apiKey: string, question: string, options: string[], isSingle: boolean, topic: string, model: string, endpoint?: string, requestOptions: IAiRequestOptions = {}): Promise<number[]> {
	const { systemPrompt, userPrompt } = buildPrompt(question, options, isSingle, topic);
	const { url, init } = buildRequest(apiKey, model, systemPrompt, userPrompt, endpoint, requestOptions);

	const res = await fetchAiRequest(url, init, !endpoint);

	if (res.error) {
		if (res.message?.startsWith('таймаут')) throw new AiRequestError(`${res.message} — попробуйте ещё раз`, 0);
		throw new AiRequestError('ошибка сети', 0);
	}
	if (res.status < 200 || res.status >= 400) handleError(res);

	return normalizeAnswerIndexes(parseAnswer(res), options.length);
}

/**
 * Проверяет ключ минимальным запросом «Ответь OK»: 5 токенов в Chat Completions
 * или 16 в Responses (минимум этого API), если модель отклонила формат чата.
 *
 * HTTP 429 (rate limit) трактуется как валидный ключ — раз сервер применил
 * лимит именно к этому ключу, значит он его опознал.
 *
 * @param apiKey   Bearer-токен для проверки.
 * @param model    Модель, на которой тестируется ключ. Должна быть доступна на endpoint'е.
 * @param endpoint Кастомный URL. По умолчанию используется {@link AI_URL} (ProxyAPI).
 * @returns `true`, если ключ принят сервером (включая 2xx и 429).
 * @throws {Error} `ошибка сети` — сетевой сбой.
 * @throws {Error} `неверный API-ключ` — HTTP 401.
 * @throws {Error} При запрете доступа к модели или недоступной модели.
 * @throws {Error} `ошибка <status>` — любой другой не-2xx статус (кроме 429).
 */
export async function validateApiKey(apiKey: string, model: string, endpoint?: string): Promise<boolean> {
	const res = await fetchAiRequest(endpoint || AI_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + apiKey,
		},
		body: JSON.stringify({
			model: endpoint ? model : getApiModel(model),
			messages: [{ role: 'user', content: 'Ответь OK' }],
			max_completion_tokens: 5,
		}),
	}, !endpoint);
	if (res.error) throw new Error('ошибка сети');
	if (res.status === 429) return true;
	if (res.status < 200 || res.status >= 400) handleError(res);
	return true;
}

/**
 * Собирает URL и `RequestInit` для chat-completion запроса.
 *
 * `temperature` намеренно не задаётся: она не нужна для ответа одним номером,
 * а новые Claude отклоняют её нестандартное значение с HTTP 400. Для кастомного
 * endpoint'а модель шлётся как есть, без префикса провайдера
 * (см. {@link getApiModel}).
 *
 * @param apiKey       Bearer-токен.
 * @param model        ID модели.
 * @param systemPrompt Системный промпт (см. {@link buildPrompt}).
 * @param userPrompt   Пользовательский промпт (см. {@link buildPrompt}).
 * @param endpoint     Необязательный кастомный URL; по умолчанию — {@link AI_URL}.
 * @returns `{ url, init }` для передачи в {@link fetchViaBackground}.
 */
export function buildRequest(apiKey: string, model: string, systemPrompt: string, userPrompt: string, endpoint?: string, requestOptions: IAiRequestOptions = {}) {
	const body: Record<string, unknown> = {
		...requestOptions.extraBody,
		model: endpoint ? model : getApiModel(model),
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
	};
	if (requestOptions.maxTokens !== undefined) body.max_tokens = requestOptions.maxTokens;

	const headers: Record<string, string> = {'Content-Type': 'application/json'};
	if (apiKey) headers.Authorization = 'Bearer ' + apiKey;

	return {
		url: endpoint || AI_URL,
		init: {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			timeoutMs: requestOptions.timeoutMs,
		},
	};
}

/** Повторяет запрос через Responses только при явном отказе формата чата. */
async function fetchAiRequest(url: string, init: IRequestOptions & {readonly body: string}, useProxyRouting: boolean): Promise<IRequestResponse> {
	const {messages, max_completion_tokens, max_tokens, ...body}: Record<string, unknown> = JSON.parse(init.body);
	const model = typeof body.model === 'string' ? body.model : '';
	const sendResponses = async () => {
		const responsesBody: Record<string, unknown> = {...body, input: messages, store: false};
		const maxTokens = max_completion_tokens ?? max_tokens;
		if (typeof maxTokens === 'number') responsesBody.max_output_tokens = Math.max(16, maxTokens);
		const res = await fetchViaBackground(AI_RESPONSES_URL, {...init, body: JSON.stringify(responsesBody)});
		if (!res.error && res.status >= 200 && res.status < 300) responsesModels.add(model);
		return res;
	};

	if (useProxyRouting && responsesModels.has(model)) return sendResponses();
	const res = await fetchViaBackground(url, init);
	if (useProxyRouting && isChatFormatUnsupported(res)) return sendResponses();
	return res;
}

function isChatFormatUnsupported(res: IRequestResponse): boolean {
	if (res.error || ![400, 404, 422].includes(res.status)) return false;
	const {detail} = getErrorDetails(res);
	return /\bnot a chat model\b/i.test(detail) ||
		/\b(?:not supported|unsupported)\b[^\n]{0,160}\bchat(?:\/|\s+)completions\b/i.test(detail) ||
		/\bchat(?:\/|\s+)completions\b[^\n]{0,160}\b(?:not supported|unsupported)\b/i.test(detail) ||
		/\bonly supported\b[^\n]{0,160}\bresponses\b/i.test(detail);
}

function getErrorDetails(res: IRequestResponse): {detail: string; code: unknown} {
	let detail = res.text;
	let code: unknown;
	try {
		const json = JSON.parse(res.text);
		const message = json?.error?.message || json?.detail || json?.message;
		if (typeof message === 'string') detail = message;
		code = json?.error?.code;
	} catch { /* Не-JSON ответ остаётся текстом для диагностики. */ }
	return {detail, code};
}

/**
 * Маппит неуспешный HTTP-ответ ProxyAPI в осмысленное исключение для UI.
 * Детали сервера (`error.message` из JSON-тела, либо raw-текст) логирует
 * в `console.error` для отладки.
 *
 * Никогда не возвращается нормально — тип `never` это отражает.
 *
 * @param res Ответ от {@link fetchViaBackground} со статусом вне `[200, 400)`.
 * @throws {Error} `неверный API-ключ` — 401.
 * @throws {Error} При запрете доступа к модели или недоступной модели.
 * @throws {Error} `нет средств на балансе` — 402.
 * @throws {Error} `лимит запросов — подождите` — 429.
 * @throws {Error} `ошибка <status>` — любой другой статус.
 */
export function handleError(res: IRequestResponse): never {
	const {detail, code} = getErrorDetails(res);
	console.error(`NMO AI [${res.status}]:`, detail);
	if (res.status === 401) throw new AiRequestError('неверный API-ключ', res.status);
	if (res.status === 403) throw new AiRequestError('доступ запрещён — проверьте ограничения API-ключа', res.status);
	if (res.status === 402) throw new AiRequestError('нет средств на балансе', res.status);
	if (res.status === 429) throw new AiRequestError('лимит запросов — подождите', res.status);
	if (isChatFormatUnsupported(res)) throw new AiRequestError('модель не поддерживает этот формат API — выберите другую модель или адрес', res.status);
	if (code === 'model_not_found' || /\bmodel\b[^\n]{0,200}\b(?:does not exist|not found|not supported|not available|do not have access)\b/i.test(detail)) {
		throw new AiRequestError('модель не найдена или недоступна — выберите другую', res.status);
	}
	if (res.status === 404) throw new AiRequestError('модель или адрес API не найдены — проверьте выбор модели и адрес', res.status);
	if (res.status === 406 && /timed out|timeout/i.test(detail)) throw new AiRequestError('таймаут очереди — попробуйте ещё раз', res.status, true);
	if (res.status === 406 && /not possible|not enough generations/i.test(detail)) throw new AiRequestError('нет доступного AI-узла — попробуйте позже', res.status, true);
	throw new AiRequestError(`ошибка ${res.status}`, res.status);
}

/** Удаляет повторы и числа, которые не соответствуют вариантам на странице. */
export function normalizeAnswerIndexes(indexes: number[], optionCount: number): number[] {
	return [...new Set(indexes.filter(index => index >= 0 && index < optionCount))];
}

/**
 * Достаёт номера ответов из Chat Completions или Responses.
 *
 * Берёт `choices[0].message.content` или текст сообщений assistant в `output`.
 * Рассуждения и вызовы инструментов в `output` пропускаются. Вытягивает цифры
 * регуляркой (так переносится и «2», и «1, 3», и «Ответы: 1 и 3») и сдвигает
 * в 0-индексированный массив. Если цифр нет — возвращает пустой массив
 * (вызывающий трактует это как «модель не смогла определиться»).
 *
 * @param res Ответ от {@link fetchViaBackground} с 2xx-статусом.
 * @returns Массив 0-индексированных номеров вариантов.
 */
export function parseAnswer(res: IRequestResponse): number[] {
	const data: unknown = JSON.parse(res.text);
	if (!isRecord(data)) return [];
	const choice = Array.isArray(data.choices) ? data.choices[0] : null;
	const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null;
	const text = typeof message?.content === 'string' ? message.content : responseOutputText(data);
	const nums = text.match(/\d+/g);
	if (!nums) return [];
	return nums.map(n => parseInt(n, 10) - 1);
}

function responseOutputText(data: Record<string, unknown>): string {
	if (typeof data.output_text === 'string') return data.output_text;
	if (!Array.isArray(data.output)) return '';
	return data.output.flatMap(item => {
		if (!isRecord(item) || item.type !== 'message' || item.role !== 'assistant' || !Array.isArray(item.content)) return [];
		return item.content.flatMap(part => isRecord(part) && part.type === 'output_text' && typeof part.text === 'string' ? [part.text] : []);
	}).join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
