import type {IAiModel} from '../../types';
import {estimateQuestionCost} from '../../utils/ai-model-cost';
import {storageGet, storageSet} from '../storage';
import {getApiModel} from '../../components/SectionAi/utils';
import {fetchViaBackground, type IRequestResponse} from './fetch';

export const AI_MODELS_URL = 'https://api.proxyapi.ru/v1/models';
export const AI_MODELS_CATALOG_URL = 'https://proxyapi.ru/models/browse';
export const AI_MODELS_CACHE_KEY = 'proxyAiModelsCache';

const MODELS_TIMEOUT_MS = 15_000;
const CACHE_VERSION = 1;
const PRICEY_MULTIPLIER = 3;
// GPT-6 Astra на 11.10.2026: 250 входных + 510 выходных токенов = 4,424 ₽.
const MAX_QUESTION_COST_RUB = 4.424;
const RECOMMENDATIONS_LIMIT = 5;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface ICatalogModel extends Omit<IAiModel, 'tier' | 'tag'> {
	readonly capabilities: readonly string[];
	readonly publishedAt: number;
	readonly contextTokens?: number;
}

interface IModelsCache {
	readonly version: number;
	readonly catalog: ICatalogModel[];
	readonly availableIds: string[] | null;
	/** Отпечаток ключа: сам секрет в кэш не записывается. */
	readonly keyHash: string;
}

export interface IModelsResult {
	readonly models: IAiModel[];
	readonly warning?: string;
}

const pendingRequests = new Map<string, Promise<IModelsResult>>();
let requestRevision = 0;

/** Сразу показывает прошлый результат, не смешивая доступность разных ключей. */
export async function getCachedModels(apiKey: string): Promise<IAiModel[]> {
	const [cache, keyHash] = await Promise.all([readCache(), hashApiKey(apiKey.trim())]);
	if (!cache || (apiKey.trim() && cache.keyHash !== keyHash)) return [];
	return mergeModels(cache.catalog, apiKey.trim() ? cache.availableIds : null);
}

/**
 * При каждом открытии ProxyAPI обновляет каталог и, если ключ задан, /v1/models.
 * Пока ключа нет, можно выбрать модель из публичного каталога. Одновременные
 * запросы с тем же ключом объединяются; успешный результат остаётся в storage.
 */
export function fetchModels(apiKey: string): Promise<IModelsResult> {
	const key = apiKey.trim();
	const pending = pendingRequests.get(key);
	if (pending) return pending;
	const request = refreshModels(key, ++requestRevision).finally(() => pendingRequests.delete(key));
	pendingRequests.set(key, request);
	return request;
}

async function refreshModels(apiKey: string, revision: number): Promise<IModelsResult> {
	const [cache, keyHash] = await Promise.all([readCache(), hashApiKey(apiKey)]);
	const [catalogResult, availableResult] = await Promise.allSettled([
		fetchCatalog(),
		apiKey ? fetchAvailableModels(apiKey) : Promise.resolve(null),
	]);

	if (availableResult.status === 'rejected') throw availableResult.reason;
	let catalog: ICatalogModel[];
	let warning: string | undefined;
	if (catalogResult.status === 'fulfilled') {
		catalog = catalogResult.value;
	} else {
		if (!cache?.catalog.length) throw catalogResult.reason;
		catalog = cache.catalog;
		warning = 'не удалось обновить цены — показаны сохранённые тарифы';
	}

	const models = mergeModels(catalog, availableResult.value);
	if (!models.length) throw new Error('нет доступных текстовых моделей ProxyAPI');
	// Старый запрос не должен перезаписать кэш после смены API-ключа.
	if (revision === requestRevision) {
		storageSet(AI_MODELS_CACHE_KEY, {version: CACHE_VERSION, catalog, availableIds: availableResult.value, keyHash});
	}
	return {models, warning};
}

async function fetchAvailableModels(apiKey: string): Promise<string[]> {
	const response = await fetchViaBackground(AI_MODELS_URL, {
		headers: {Authorization: `Bearer ${apiKey}`},
		timeoutMs: MODELS_TIMEOUT_MS,
	});
	checkResponse(response, 'список моделей');
	let payload: unknown;
	try {
		payload = JSON.parse(response.text);
	} catch {
		throw new Error('ProxyAPI вернул некорректный список моделей');
	}
	if (!isRecord(payload) || !Array.isArray(payload.data)) {
		throw new Error('ProxyAPI вернул некорректный список моделей');
	}
	return [...new Set(payload.data.flatMap(value =>
		isRecord(value) && typeof value.id === 'string' && value.id.trim() ? [getApiModel(value.id)] : [],
	))];
}

async function fetchCatalog(): Promise<ICatalogModel[]> {
	const response = await fetchViaBackground(AI_MODELS_CATALOG_URL, {
		headers: {RSC: '1'},
		timeoutMs: MODELS_TIMEOUT_MS,
	});
	checkResponse(response, 'каталог с ценами');
	return parseModelCatalog(response.text);
}

function checkResponse(response: IRequestResponse, subject: string): void {
	if (response.error) throw new Error(response.message || `не удалось загрузить ${subject} ProxyAPI`);
	if (response.status === 401 || response.status === 403) throw new Error('ProxyAPI не принял API-ключ или запретил доступ');
	if (response.status === 429) throw new Error('лимит запросов ProxyAPI — попробуйте позже');
	if (response.status < 200 || response.status >= 300) throw new Error(`не удалось загрузить ${subject} ProxyAPI: ошибка ${response.status}`);
}

/** Читает только JSON-данные RSC/HTML; JavaScript страницы никогда не выполняется. */
export function parseModelCatalog(text: string): ICatalogModel[] {
	let flight = text;
	if (text.includes('<script')) {
		const chunks: string[] = [];
		for (const script of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
			const push = script[1].trim().match(/^self\.__next_f\.push\((\[1,[\s\S]*\])\);?$/);
			if (!push) continue;
			try {
				const payload: unknown = JSON.parse(push[1]);
				if (Array.isArray(payload) && typeof payload[1] === 'string') chunks.push(payload[1]);
			} catch { /* Пропускаем посторонние или повреждённые скрипты. */ }
		}
		flight = chunks.join('');
	}

	const records = new Map<string, unknown>();
	for (const line of flight.split('\n')) {
		const record = line.match(/^([\da-f]+):([[{].*)$/i);
		if (!record) continue;
		try {
			records.set(record[1], JSON.parse(record[2]));
		} catch { /* RSC содержит также записи, которые не являются JSON. */ }
	}
	const rows = findCatalogRows(records);
	const models = new Map<string, ICatalogModel>();
	for (const row of rows) {
		const model = toCatalogModel(row);
		if (model) models.set(model.id, model);
	}
	if (!models.size) throw new Error('ProxyAPI вернул некорректный каталог текстовых моделей');
	return [...models.values()];
}

function findCatalogRows(records: Map<string, unknown>): unknown[] {
	const stack = [...records.values()];
	for (let value = stack.pop(); value !== undefined; value = stack.pop()) {
		if (Array.isArray(value)) {
			stack.push(...value);
		} else if (isRecord(value)) {
			let rows = value.rows;
			if (typeof rows === 'string' && /^\$[\da-f]+$/i.test(rows)) rows = records.get(rows.slice(1));
			if (Array.isArray(rows)) return rows;
			stack.push(...Object.values(value));
		}
	}
	return [];
}

function toCatalogModel(value: unknown): ICatalogModel | null {
	if (!isRecord(value) || value.category !== 'text' || typeof value.key !== 'string' || !value.key.includes('/')) return null;
	const id = getApiModel(value.key);
	const name = typeof value.displayName === 'string' && value.displayName.trim() ? value.displayName : id.slice(id.indexOf('/') + 1);
	const capabilities = Array.isArray(value.capabilities) ? value.capabilities.filter((item): item is string => typeof item === 'string') : [];
	// В категории text встречаются генераторы Gemini Image и GPT Audio.
	// Vision на входе не мешает: такие модели умеют давать текстовые ответы.
	if (!isTextModel(id, name, capabilities)) return null;
	if (Array.isArray(value.outputModalities) && (value.outputModalities.length !== 1 || value.outputModalities[0] !== 'text')) return null;
	const breakdown = Array.isArray(value.breakdown) ? value.breakdown : [];
	if (breakdown.some(item => isRecord(item) && typeof item.key === 'string' && /^(?:image|audio|video)_output/.test(item.key))) return null;
	const price = (key: string): number | undefined => {
		const entry = breakdown.find(item => isRecord(item) && item.key === key);
		if (!isRecord(entry) || typeof entry.hint !== 'string' || !/1\s*[мm]\s*токен/i.test(entry.hint)) return undefined;
		return finiteNumber(entry.price);
	};
	return {
		id,
		name,
		vendor: id.split('/')[0],
		inputPrice: price('input_tokens'),
		outputPrice: price('output_tokens'),
		contextTokens: finiteNumber(value.contextTokens),
		reasoning: capabilities.includes('reasoning'),
		capabilities,
		publishedAt: finiteNumber(value.publishedAt) ?? 0,
	};
}

function isTextModel(id: string, name: string, capabilities: readonly string[]): boolean {
	return !/(?:^|[-_/\s])(image|audio|video|tts|realtime)(?:$|[-_/\s])/i.test(`${id} ${name}`) &&
		!capabilities.some(capability => /^(?:image|audio|video)_generation$/.test(capability));
}

/** Сопоставляет полный ID из API с текстовыми моделями и тарифами каталога. */
export function mergeModels(catalog: readonly ICatalogModel[], availableIds: readonly string[] | null): IAiModel[] {
	const available = availableIds === null ? null : new Set(availableIds);
	const models = catalog.filter(model => (!available || available.has(model.id)) && isTextModel(model.id, model.name, model.capabilities))
		.map(model => ({...model, reasoning: model.capabilities.includes('reasoning')}))
		.filter(model => {
			const cost = modelCost(model);
			return cost !== undefined && cost <= MAX_QUESTION_COST_RUB;
		});
	const costs = models.map(modelCost).filter((cost): cost is number => cost !== undefined && cost > 0).sort((a, b) => a - b);
	const middle = Math.floor(costs.length / 2);
	const median = costs.length ? (costs[middle] + costs[Math.floor((costs.length - 1) / 2)]) / 2 : 0;
	const recommended = selectRecommendations(models, median);
	return models.map(model => {
		const cost = modelCost(model);
		const ratio = cost === undefined || !median ? undefined : cost / median;
		const tier: IAiModel['tier'] = ratio === undefined ? undefined : ratio <= 0.5 ? 'low' : ratio <= 1.5 ? 'medium' : ratio <= PRICEY_MULTIPLIER ? 'high' : 'ultra';
		const tag: IAiModel['tag'] = ratio !== undefined && ratio > PRICEY_MULTIPLIER ? 'pricey' : recommended.has(model.id) ? 'rec' : undefined;
		return {...model, tier, tag};
	}).sort((left, right) =>
		Number(right.tag === 'rec') - Number(left.tag === 'rec') ||
		(modelCost(left) ?? Infinity) - (modelCost(right) ?? Infinity) || left.name.localeCompare(right.name, 'ru'),
	);
}

/**
 * До пяти рекомендаций: свежая стабильная модель каждого провайдера с
 * рассуждениями, JSON и контекстом от 128K; цена вопроса не выше двух медиан.
 * Это выбор по цене и заявленным возможностям, а не оценка качества ответов.
 */
function selectRecommendations(models: readonly ICatalogModel[], median: number): Set<string> {
	const candidates = models.filter(model => {
		const cost = modelCost(model);
		return cost !== undefined && median > 0 && cost <= median * 2 &&
			model.publishedAt >= Date.now() - YEAR_MS && (model.contextTokens ?? 0) >= 128_000 &&
			model.capabilities.includes('reasoning') && model.capabilities.includes('structured') &&
			!/preview|experimental|(?:^|[- /])(exp|beta|guard|moderation)(?:$|[- /])/i.test(model.id);
	}).sort((a, b) => b.publishedAt - a.publishedAt || (modelCost(a) ?? 0) - (modelCost(b) ?? 0));
	const byVendor = new Map<string, ICatalogModel>();
	for (const model of candidates) if (!byVendor.has(model.vendor)) byVendor.set(model.vendor, model);
	return new Set([...byVendor.values()]
		.sort((a, b) => (modelCost(a) ?? 0) - (modelCost(b) ?? 0))
		.slice(0, RECOMMENDATIONS_LIMIT).map(model => model.id));
}

function modelCost(model: IAiModel): number | undefined {
	return estimateQuestionCost(model);
}

async function readCache(): Promise<IModelsCache | null> {
	const value = await storageGet<unknown>(AI_MODELS_CACHE_KEY, null);
	if (!isRecord(value) || value.version !== CACHE_VERSION || typeof value.keyHash !== 'string' || !Array.isArray(value.catalog)) return null;
	if (value.availableIds !== null && (!Array.isArray(value.availableIds) || !value.availableIds.every(id => typeof id === 'string'))) return null;
	const catalog = value.catalog.filter(isCatalogModel);
	return catalog.length ? {version: CACHE_VERSION, catalog, availableIds: value.availableIds as string[] | null, keyHash: value.keyHash} : null;
}

function isCatalogModel(value: unknown): value is ICatalogModel {
	return isRecord(value) && typeof value.id === 'string' && value.id.includes('/') &&
		typeof value.name === 'string' && typeof value.vendor === 'string' &&
		Array.isArray(value.capabilities) && value.capabilities.every(item => typeof item === 'string') &&
		finiteNumber(value.publishedAt) !== undefined &&
		['inputPrice', 'outputPrice', 'contextTokens'].every(key => value[key] === undefined || finiteNumber(value[key]) !== undefined);
}

async function hashApiKey(apiKey: string): Promise<string> {
	if (!apiKey) return '';
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
	return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function finiteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
