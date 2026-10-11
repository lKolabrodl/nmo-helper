import {fetchViaBackground} from './fetch';
import {AiRequestError, askAI, type IAiRequestOptions} from './fetch-ai';

export type FreeAiService = 'gpt-oss' | 'qwen' | 'ovh' | 'horde';

export interface IFreeAiRequestConfig {
	readonly apiKey: string;
	readonly endpoint: string;
	readonly model: string;
	readonly requestOptions: IAiRequestOptions;
}

export interface IFreeAiAnswer {
	readonly correctIndexes: number[];
	readonly source: 'GPT-OSS 120B' | 'Qwen 3.8 27B' | 'OVH' | 'AI Horde';
}

export interface IFreeAiRetryInfo {
	readonly attempt: number;
	readonly maxAttempts: number;
	readonly delayMs: number;
	readonly reason: string;
}

export interface IFreeAiRequestControls {
	/** Отменяет дальнейшие запросы и ожидание повтора. */
	readonly signal?: AbortSignal;
	readonly onRetry?: (retry: IFreeAiRetryInfo) => void;
}

interface IHordeModel {
	readonly id: string;
	readonly baseModel: string;
	readonly template: string;
	readonly workerThreads: number;
	readonly size: number;
	readonly knownToHorde: boolean;
}

export const OVH_AI_URL = 'https://llama-3-3-70b-instruct.endpoints.kepler.ai.cloud.ovh.net/api/openai_compat/v1/chat/completions';
export const OVH_AI_MODEL = 'Meta-Llama-3_3-70B-Instruct';
export const OVH_OPENAI_URL = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions';
export const OVH_GPT_OSS_MODEL = 'gpt-oss-120b';
export const OVH_QWEN_MODEL = 'Qwen3.8-27B';
export const HORDE_AI_URL = 'https://oai.aihorde.net/v1/chat/completions';
export const HORDE_MODELS_URL = 'https://oai.aihorde.net/v1/models';
export const HORDE_ANONYMOUS_KEY = '0000000000';

const OVH_TIMEOUT_MS = 30_000;
const HORDE_QUEUE_TIMEOUT_SECONDS = 120;
const HORDE_CLIENT_TIMEOUT_MS = 125_000;
const HORDE_MODELS_TIMEOUT_MS = 10_000;
const HORDE_MAX_ATTEMPTS = 3;
const HORDE_RETRY_DELAY_MS = 3000;
const OVH_ROUTES = [
	{service: 'gpt-oss', source: 'GPT-OSS 120B'},
	{service: 'qwen', source: 'Qwen 3.8 27B'},
	{service: 'ovh', source: 'OVH'},
] as const;

/**
 * Бесплатный автоматический маршрут: GPT-OSS → Qwen → Llama → AI Horde.
 * При ошибке или пустом ответе пробует следующую модель без регистрации.
 * Временные ошибки Horde повторяются с паузой,
 * каждый раз со свежим выбором доступной модели.
 */
export async function askFreeAI(question: string, options: string[], isSingle: boolean, topic: string, controls: IFreeAiRequestControls = {}): Promise<IFreeAiAnswer> {
	const {signal, onRetry} = controls;
	throwIfAborted(signal);
	const ovhFailures: string[] = [];

	for (const {service, source} of OVH_ROUTES) {
		throwIfAborted(signal);
		try {
			const config = await resolveFreeAiRequest(service);
			throwIfAborted(signal);
			const correctIndexes = await askWithConfig(config, question, options, isSingle, topic);
			throwIfAborted(signal);
			if (correctIndexes.length) return {correctIndexes, source};
			ovhFailures.push(`${source} — не определил ответ`);
		} catch (error) {
			throwIfAborted(signal);
			ovhFailures.push(`${source} — ${getErrorMessage(error)}`);
		}
	}

	for (let attempt = 1; ; attempt += 1) {
		throwIfAborted(signal);
		try {
			const config = await resolveFreeAiRequest('horde');
			throwIfAborted(signal);
			const correctIndexes = await askWithConfig(config, question, options, isSingle, topic);
			throwIfAborted(signal);
			return {correctIndexes, source: 'AI Horde'};
		} catch (error) {
			throwIfAborted(signal);
			if (!(error instanceof AiRequestError && error.retryable) || attempt >= HORDE_MAX_ATTEMPTS) {
				throw createErrorWithCause(`бесплатный AI недоступен: ${ovhFailures.join('; ')}; Horde — ${getErrorMessage(error)}`, error);
			}
			const delayMs = HORDE_RETRY_DELAY_MS * attempt;
			onRetry?.({attempt: attempt + 1, maxAttempts: HORDE_MAX_ATTEMPTS, delayMs, reason: getErrorMessage(error)});
			await waitForRetry(delayMs, signal);
		}
	}
}

/** Готовит параметры бесплатного запроса; для Horde сначала выбирает живую instruct-модель. */
export async function resolveFreeAiRequest(service: FreeAiService): Promise<IFreeAiRequestConfig> {
	if (service === 'gpt-oss' || service === 'qwen') {
		const isGptOss = service === 'gpt-oss';
		return {
			apiKey: '',
			endpoint: OVH_OPENAI_URL,
			model: isGptOss ? OVH_GPT_OSS_MODEL : OVH_QWEN_MODEL,
			requestOptions: {
				timeoutMs: OVH_TIMEOUT_MS,
				// Лимит включает рассуждение: 32 токена обрывают ответ до выбора варианта.
				maxTokens: 2048,
				extraBody: isGptOss ? {temperature: 0, reasoning_effort: 'low'} : {temperature: 0},
			},
		};
	}

	if (service === 'ovh') {
		return {
			apiKey: '',
			endpoint: OVH_AI_URL,
			model: OVH_AI_MODEL,
			requestOptions: {
				timeoutMs: OVH_TIMEOUT_MS,
				maxTokens: 32,
				extraBody: {temperature: 0},
			},
		};
	}

	return {
		apiKey: HORDE_ANONYMOUS_KEY,
		endpoint: HORDE_AI_URL,
		model: await resolveHordeModel(),
		requestOptions: {
			timeoutMs: HORDE_CLIENT_TIMEOUT_MS,
			maxTokens: 32,
			extraBody: {
				temperature: 0,
				timeout: HORDE_QUEUE_TIMEOUT_SECONDS,
			},
		},
	};
}

/** Загружает текущих text-worker'ов AI Horde и выбирает наиболее подходящую модель. */
export async function resolveHordeModel(): Promise<string> {
	const res = await fetchViaBackground(HORDE_MODELS_URL, {
		headers: {Authorization: `Bearer ${HORDE_ANONYMOUS_KEY}`},
		timeoutMs: HORDE_MODELS_TIMEOUT_MS,
	});

	if (res.error) {
		if (res.message?.startsWith('таймаут')) throw new AiRequestError('AI Horde не отвечает за 10 с', 0);
		throw new AiRequestError('не удалось получить модели AI Horde', 0);
	}
	if (res.status < 200 || res.status >= 400) throw new AiRequestError(`AI Horde: ошибка ${res.status}`, res.status);

	let payload: unknown;
	try {
		payload = JSON.parse(res.text);
	} catch {
		throw new Error('AI Horde вернул некорректный список моделей');
	}

	return selectHordeModel(payload);
}

/**
 * Выбирает доступную instruct/chat-модель. Сначала учитывается пригодность для
 * диалога, затем наличие в официальном справочнике, число worker-потоков и размер.
 */
export function selectHordeModel(payload: unknown): string {
	const rawModels = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
	const models = rawModels.map(toHordeModel).filter((model): model is IHordeModel => model !== null);

	if (!models.length) throw new Error('сейчас нет доступных text-моделей AI Horde');

	models.sort((left, right) => scoreHordeModel(right) - scoreHordeModel(left) || left.id.localeCompare(right.id));
	return models[0].id;
}

function toHordeModel(value: unknown): IHordeModel | null {
	if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null;
	const workerThreads = toFiniteNumber(value.worker_threads);
	if (workerThreads <= 0) return null;

	return {
		id: value.id,
		baseModel: typeof value.base_model === 'string' ? value.base_model : '',
		template: typeof value.template === 'string' ? value.template : '',
		workerThreads,
		size: Math.max(0, toFiniteNumber(value.size)),
		knownToHorde: value.known_to_horde === true,
	};
}

function scoreHordeModel(model: IHordeModel): number {
	const descriptor = `${model.id} ${model.baseModel} ${model.template}`;
	const isInstructionModel = /instruct|chatml|llama-3|qwen[23]/i.test(descriptor);
	return (isInstructionModel ? 1_000_000 : 0)
		+ (model.knownToHorde ? 100_000 : 0)
		+ Math.min(model.workerThreads, 100) * 1_000
		+ Math.min(model.size, 200);
}

function toFiniteNumber(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function askWithConfig(config: IFreeAiRequestConfig, question: string, options: string[], isSingle: boolean, topic: string): Promise<number[]> {
	return askAI(
		config.apiKey,
		question,
		options,
		isSingle,
		topic,
		config.model,
		config.endpoint,
		config.requestOptions,
	);
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
}

/** Убирает таймер при остановке режима или переходе к другому вопросу. */
function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
	throwIfAborted(signal);
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer);
			reject(new DOMException('Запрос отменён', 'AbortError'));
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, delayMs);
		signal?.addEventListener('abort', onAbort, {once: true});
	});
}

/** Совместимый с ES2020 вариант `new Error(message, {cause})`. */
function createErrorWithCause(message: string, cause: unknown): Error {
	const error = new Error(message);
	Object.defineProperty(error, 'cause', {value: cause, configurable: true});
	return error;
}
