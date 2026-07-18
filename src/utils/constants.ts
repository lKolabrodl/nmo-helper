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

/** Ссылка на инструкцию по обновлению расширения */
export const UPDATE_URL = 'https://nmo-helper.ru/instruction#update';

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
	/** Нативный input внутри варианта ответа */
	answerInput: [
		'input[type="radio"], input[type="checkbox"]',
	],
	/** Интерактивная область варианта ответа */
	answerTouchTarget: [
		'.mat-mdc-radio-touch-target',
		'.mat-mdc-checkbox-touch-target',
	],
	/** Radio-инпут для определения типа «один ответ» */
	radioInput: [
		'input[type="radio"]',
	],
	/** Кнопка перехода после ответа: следующий вопрос или финальное завершение */
	nextQuestionButton: [
		'.question-buttons-primary',
		'.question-buttons button',
		'button',
	],
	/** Блок действий теста: список вопросов + завершение тестирования */
	quizActions: [
		'mat-card-actions.mat-mdc-card-actions',
		'.mat-mdc-card-actions.mdc-card__actions',
		'.mat-mdc-card-actions',
	],
	/** Кнопка завершения тестирования */
	finishQuizButton: [
		'.quiz-buttons-primary',
		'button',
	],
	/** Кнопки в модалке подтверждения завершения тестирования */
	finishQuizConfirmButton: [
		'lib-quiz-finishing-confirm-dialog button',
		'.mat-mdc-dialog-surface button',
		'.mat-mdc-dialog-actions button',
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
 *  v2: поддерживает поле message. */
export const BUG_REPORT_ENDPOINT = 'https://nmo-helper.ru/api/v2/bug-report';

/** Ключ chrome.storage.local для клиентского состояния баг-репортов (дедуп/кулдаун/дневной лимит) */
export const BUG_REPORT_STORAGE_KEY = 'bugReports';

/**
 * Список доступных AI-моделей через ProxyAPI.
 * - tier: уровень (low → ultra) — основан на rate limits и позиции в линейке.
 * - tag: 'rec' — рекомендованная, 'pricey' — дорогая (ставится на флагманов).
 *
 * id — точный идентификатор у ProxyAPI; name — отображаемое имя в дропдауне.
 * Anthropic id с дефисами (`claude-opus-4-8`), name с точкой (`claude-opus-4.8`).
 */
export const DEFAULT_AI_MODEL = 'gpt-5.4-mini';

export const AI_MODELS: IAiModel[] = [
	// low — быстрые / дешёвые для простых задач
	{ id: 'gpt-5.4-nano',           name: 'gpt-5.4-nano',           tier: 'low' },
	{ id: 'gemini-2.0-flash',       name: 'gemini-2.0-flash',       tier: 'low' },
	{ id: 'gemini-2.0-flash-lite',  name: 'gemini-2.0-flash-lite',  tier: 'low' },
	{ id: 'gemini-2.5-flash-lite',  name: 'gemini-2.5-flash-lite',  tier: 'low' },
	{ id: 'gemini-3.1-flash-lite',  name: 'gemini-3.1-flash-lite',  tier: 'low' },
	{ id: 'claude-haiku-4-5',       name: 'claude-haiku-4.5',       tier: 'low' },

	// medium — баланс цены и качества
	{ id: 'gpt-5.4-mini',           name: 'gpt-5.4-mini',           tier: 'medium', tag: 'rec' },
	{ id: 'gpt-5.6-luna',           name: 'gpt-5.6-luna',           tier: 'medium' },
	{ id: 'gemini-2.5-flash',       name: 'gemini-2.5-flash',       tier: 'medium', tag: 'rec' },
	{ id: 'gemini-3-flash-preview', name: 'gemini-3-flash',         tier: 'medium' },
	{ id: 'gemini-3.1-flash-preview', name: 'gemini-3.1-flash',     tier: 'medium' },
	{ id: 'claude-sonnet-4-5',      name: 'claude-sonnet-4.5',      tier: 'medium' },

	// high — флагманы для точности
	{ id: 'gpt-5.4',                name: 'gpt-5.4',                tier: 'high',   tag: 'pricey' },
	{ id: 'gpt-5.6-terra',          name: 'gpt-5.6-terra',          tier: 'high',   tag: 'rec' },
	{ id: 'gemini-2.5-pro',         name: 'gemini-2.5-pro',         tier: 'high' },
	{ id: 'gemini-3.5-flash',       name: 'gemini-3.5-flash',       tier: 'high' },
	{ id: 'claude-sonnet-4-6',      name: 'claude-sonnet-4.6',      tier: 'high',   tag: 'rec' },
	{ id: 'claude-sonnet-5',        name: 'claude-sonnet-5',        tier: 'high',   tag: 'rec' },

	// ultra — премиум reasoning / pro-модели
	{ id: 'gpt-5.5',                name: 'gpt-5.5',                tier: 'ultra',  tag: 'pricey' },
	{ id: 'gpt-5.4-pro',            name: 'gpt-5.4-pro',            tier: 'ultra',  tag: 'pricey' },
	{ id: 'gpt-5.5-pro',            name: 'gpt-5.5-pro',            tier: 'ultra',  tag: 'pricey' },
	{ id: 'gpt-5.6-sol',            name: 'gpt-5.6-sol',            tier: 'ultra',  tag: 'pricey' },
	{ id: 'gemini-3-pro-preview',   name: 'gemini-3-pro',           tier: 'ultra' },
	{ id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro',         tier: 'ultra' },
	{ id: 'claude-fable-5',         name: 'claude-fable-5',         tier: 'ultra',  tag: 'pricey' },
	{ id: 'claude-opus-4-5',        name: 'claude-opus-4.5',        tier: 'ultra' },
	{ id: 'claude-opus-4-6',        name: 'claude-opus-4.6',        tier: 'ultra' },
	{ id: 'claude-opus-4-7',        name: 'claude-opus-4.7',        tier: 'ultra' },
	{ id: 'claude-opus-4-8',        name: 'claude-opus-4.8',        tier: 'ultra',  tag: 'rec' },
];

const AI_MODEL_IDS = new Set(AI_MODELS.map(model => model.id));

/** Возвращает доступную ProxyAPI-модель или актуальную модель по умолчанию. */
export function normalizeAiModel(model: string): string {
	return AI_MODEL_IDS.has(model) ? model : DEFAULT_AI_MODEL;
}
