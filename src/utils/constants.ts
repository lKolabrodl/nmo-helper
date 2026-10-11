/**
 * Константы расширения NMO Helper.
 * @module constants
 */

/** Цвет подсветки правильных ответов */
export const HIGHLIGHT_COLOR = '#4ecca3';

/** Порог нечёткого совпадения (Dice coefficient) для поиска вопросов на сайтах-источниках */
export const SIMILARITY_THRESHOLD = 0.85;

/** Минимальный порог нечёткого совпадения */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** Максимальное количество тем в кеше ответов (LRU — старые вытесняются) */
export const CACHE_MAX_TOPICS = 10;

/** Ссылка на страницу обновления расширения */
export const UPDATE_URL = 'https://nmo-helper.ru/update';

/** Домены баз поиска ответов. Конкретные адреса хранятся только здесь. */
export const FIRST_ANSWER_SOURCE_HOST = 'rosmedicinfo.ru';
export const SECOND_ANSWER_SOURCE_HOST = '24forcare.com';
export const THIRD_ANSWER_SOURCE_HOST = 'testotvet.com';
//
export const NMO_API_HOST = 'nmo-helper.ru';
export const NMO_API_BASE_URL = `https://${NMO_API_HOST}/api/nmo`;
export const NMO_API_TOPIC_ENDPOINT = `${NMO_API_BASE_URL}/topic`;

/**
 * DOM-селекторы страницы НМО.
 * Каждый ключ — массив CSS-селекторов в порядке приоритета (fallback-цепочка).
 * При изменении вёрстки портала — правим только здесь.
 */
export const SELECTORS = {
	/** Заголовок темы теста: специфичные классы раньше общей карточки Material. */
	topic: ['.mat-card-title-quiz-custom', '.v-label.v-label-h2', '.mat-mdc-card-title'],
	/** Контейнер текущего вопроса */
	questionAnchor: ['#questionAnchor'],
	/** Текст вопроса (внутри questionAnchor) */
	questionText: ['.question-title-text'],
	/** Варианты ответов (внутри questionAnchor) */
	variant: ['.mdc-form-field span'],
	/** Нативный input внутри варианта ответа */
	answerInput: ['input[type="radio"], input[type="checkbox"]'],
	/** Интерактивная область варианта ответа */
	answerTouchTarget: ['.mat-mdc-radio-touch-target', '.mat-mdc-checkbox-touch-target'],
	/** Radio-инпут для определения типа «один ответ» */
	radioInput: ['input[type="radio"]'],
	/** Кнопка перехода после ответа: следующий вопрос или финальное завершение */
	nextQuestionButton: ['.question-buttons-primary', '.question-buttons button', 'button'],
	/** Блок действий теста: список вопросов + завершение тестирования */
	quizActions: ['mat-card-actions.mat-mdc-card-actions', '.mat-mdc-card-actions.mdc-card__actions', '.mat-mdc-card-actions'],
	/** Кнопка завершения тестирования */
	finishQuizButton: ['.quiz-buttons-primary', 'button'],
	/** Кнопки в модалке подтверждения завершения тестирования */
	finishQuizConfirmButton: ['lib-quiz-finishing-confirm-dialog button', '.mat-mdc-dialog-surface button', '.mat-mdc-dialog-actions button'],

	/** Список вопросов в результатах завершённого теста */
	quizResults: ['lib-questions-list .questionList'],
	/** Элемент вопроса в списке результатов */
	resultItem: ['.questionList-item'],
	/** Заголовок вопроса в списке результатов */
	resultTitle: ['.questionList-item-content-title'],
	/** Статус правильного ответа в списке результатов */
	resultCorrect: ['.questionList-item-status-wright'],
	/** Статус завершённого теста */
	completedStatus: ['.text_value.text-success'],
} as const;

/** Тексты статусов панели */
export const StatusTitle = {
	SEARCHING: 'ищу в базах ответов...',
	SEARCHING_ANSWERS: 'ищу ответы...',
	LOADING_ANSWERS: 'загружаю ответы...',
	LOADING_FAILED: 'не удалось загрузить ответы',
	NOT_FOUND: 'ответы не найдены в базах',
	ANSWER_NOT_FOUND: 'ответ не найден',
	ANSWER_MISMATCH: 'ответ не совпал с вариантами (такое бывает)',
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
export const AI_URL = 'https://api.proxyapi.ru/v1/chat/completions';
export const AI_RESPONSES_URL = 'https://api.proxyapi.ru/v1/responses';

/** Эндпоинт серверного приёма баг-репортов (проксируется nginx'ом в Python-бот).
 *  v2: поддерживает поле message. */
export const BUG_REPORT_ENDPOINT = 'https://nmo-helper.ru/api/v2/bug-report';

/** Ключ chrome.storage.local для клиентского состояния баг-репортов (дедуп/кулдаун/дневной лимит) */
export const BUG_REPORT_STORAGE_KEY = 'bugReports';
