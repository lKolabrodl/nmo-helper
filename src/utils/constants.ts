/**
 * Константы расширения NMO Helper.
 * @module constants
 */

import type { IAiModel } from '../types';

/** Цвет подсветки правильных ответов */
export const HIGHLIGHT_COLOR = '#4ecca3';

/** Порог нечёткого совпадения (Dice coefficient) для поиска вопросов на сайтах-источниках */
export const SIMILARITY_THRESHOLD = 0.85;

/** Минимальный порог нечёткого совпадения */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** Максимальное количество тем в кеше ответов (LRU — старые вытесняются) */
export const CACHE_MAX_TOPICS = 10;

/**
 * DOM-селекторы страницы НМО.
 * Каждый ключ — массив CSS-селекторов в порядке приоритета (fallback-цепочка).
 * При изменении вёрстки портала — правим только здесь.
 */
export const SELECTORS = {
	/** Заголовок темы теста */
	topic: [
		'.mat-card-title-quiz-custom',
		'.mat-mdc-card-title',
		'.v-label.v-label-h2'
	],
	/** Контейнер текущего вопроса */
	questionAnchor: [
		'#questionAnchor',
	],
	/** Текст вопроса (внутри questionAnchor) */
	questionText: [
		'.question-title-text',
	],
	/** Варианты ответов (внутри questionAnchor) */
	variant: [
		'.mdc-form-field span',
	],
	/** Radio-инпут для определения типа «один ответ» */
	radioInput: [
		'input[type="radio"]',
	],
} as const;

/** Тексты статусов панели */
export const StatusTitle = {
	SEARCHING: 'ищу на обоих сайтах...',
	SEARCHING_ANSWERS: 'ищу ответы...',
	LOADING_ANSWERS: 'загружаю ответы...',
	LOADING_FAILED: 'не удалось загрузить ответы',
	NOT_FOUND: 'ответы не найдены на сайтах',
	ANSWER_NOT_FOUND: 'ответ не найден',
	ANSWER_MISMATCH: 'ответ не совпал с вариантами',
	ANSWER_LOW_CONFIDENCE: 'низкая уверенность',
	AI_THINKING: 'думаю...',
	AI_NO_ANSWER: 'AI не определил ответ',
	CHECKING_KEY: 'проверяю ключ...',
	ENTER_KEY: 'введите API-ключ',
	ENTER_QUERY: 'введите название теста',
	ENTER_URL: 'вставь URL с ответами',
	RUNNING: 'работает',
	STOPPED: 'остановлен',
} as const;

/** Единый OpenAI-совместимый endpoint ProxyAPI для всех провайдеров */
export const AI_URL = 'https://openai.api.proxyapi.ru/v1/chat/completions';

/** Эндпоинт серверного приёма баг-репортов (проксируется nginx'ом в Python-бот).
 *  v2: поддерживает поле message и блокирует старые версии (HTTP 426). */
export const BUG_REPORT_ENDPOINT = 'https://nmo-helper.ru/api/v2/bug-report';

/** Ключ chrome.storage.local для клиентского состояния баг-репортов (дедуп/кулдаун/дневной лимит) */
export const BUG_REPORT_STORAGE_KEY = 'bugReports';

/**
 * Список доступных AI-моделей через ProxyAPI.
 * - tier: уровень (low → ultra) — основан на rate limits и позиции в линейке.
 * - tag: 'rec' — рекомендованная, 'pricey' — дорогая (ставится на флагманов).
 *
 * id — точный идентификатор у ProxyAPI; name — отображаемое имя в дропдауне.
 * Anthropic id с дефисами (`claude-opus-4-7`), name с точкой (`claude-opus-4.7`).
 */
export const AI_MODELS: IAiModel[] = [
	// low — быстрые / дешёвые для простых задач
	{ id: 'gpt-4o-mini',            name: 'gpt-4o-mini',            tier: 'low' },
	{ id: 'gpt-4.1-nano',           name: 'gpt-4.1-nano',           tier: 'low' },
	{ id: 'gpt-5-nano',             name: 'gpt-5-nano',             tier: 'low' },
	{ id: 'gpt-5.4-nano',           name: 'gpt-5.4-nano',           tier: 'low' },
	{ id: 'gemini-2.0-flash',       name: 'gemini-2.0-flash',       tier: 'low' },
	{ id: 'gemini-2.5-flash-lite',  name: 'gemini-2.5-flash-lite',  tier: 'low' },
	{ id: 'claude-haiku-4-5',       name: 'claude-haiku-4.5',       tier: 'low' },

	// medium — баланс цены и качества
	{ id: 'gpt-4.1-mini',           name: 'gpt-4.1-mini',           tier: 'medium', tag: 'rec' },
	{ id: 'gpt-4o',                 name: 'gpt-4o',                 tier: 'medium' },
	{ id: 'gpt-5-mini',             name: 'gpt-5-mini',             tier: 'medium' },
	{ id: 'gpt-5.4-mini',           name: 'gpt-5.4-mini',           tier: 'medium' },
	{ id: 'gemini-2.5-flash',       name: 'gemini-2.5-flash',       tier: 'medium', tag: 'rec' },
	{ id: 'gemini-3-flash-preview', name: 'gemini-3-flash',         tier: 'medium' },
	{ id: 'claude-sonnet-4-5',      name: 'claude-sonnet-4.5',      tier: 'medium' },

	// high — флагманы для точности
	{ id: 'gpt-4.1',                name: 'gpt-4.1',                tier: 'high' },
	{ id: 'gpt-5',                  name: 'gpt-5',                  tier: 'high' },
	{ id: 'gpt-5.4',                name: 'gpt-5.4',                tier: 'high',   tag: 'pricey' },
	{ id: 'o3-mini',                name: 'o3-mini',                tier: 'high',   tag: 'rec' },
	{ id: 'o4-mini',                name: 'o4-mini',                tier: 'high',   tag: 'rec' },
	{ id: 'gemini-2.5-pro',         name: 'gemini-2.5-pro',         tier: 'high' },
	{ id: 'claude-sonnet-4-6',      name: 'claude-sonnet-4.6',      tier: 'high',   tag: 'rec' },

	// ultra — премиум reasoning / pro-модели
	{ id: 'gpt-5.5',                name: 'gpt-5.5',                tier: 'ultra',  tag: 'pricey' },
	{ id: 'o3',                     name: 'o3',                     tier: 'ultra',  tag: 'pricey' },
	{ id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro',         tier: 'ultra' },
	{ id: 'claude-opus-4-7',        name: 'claude-opus-4.7',        tier: 'ultra',  tag: 'rec' },
];
