import type { ButtonVariant } from './Button';

/**
 * Единое хранилище всех статусов кнопок баг-репорта.
 * Ключ = семантическое имя статуса, значение = { text, variant }.
 * Button рендерит text и подбирает CSS-класс по variant.
 */
export const STATUSES = {
	// Действия (триггер + кнопки формы)
	TRIGGER:       { text: 'Сообщить о проблеме',               variant: 'trigger' },
	SEND:          { text: 'Отправить',                         variant: 'primary' },
	SENDING:       { text: 'Отправка…',                         variant: 'primary' },
	CANCEL:        { text: 'Отмена',                            variant: 'ghost' },

	// Результат отправки / клиентские лимиты
	SENT:          { text: 'отчёт отправлен, спасибо',          variant: 'success' },
	DUPLICATE:     { text: 'этот вопрос уже отправлен',         variant: 'warning' },
	COOLDOWN:      { text: 'подождите до следующей отправки',   variant: 'warning' },
	DAILY_CAP:     { text: 'лимит 5 отчётов в сутки исчерпан',  variant: 'warning' },

	// Ошибки
	PAYLOAD_LARGE: { text: 'вопрос слишком большой',            variant: 'error' },
	NETWORK:       { text: 'нет сети',                          variant: 'error' },
	SERVER:        { text: 'ошибка сервера',                    variant: 'error' },
} as const satisfies Record<string, { text: string; variant: ButtonVariant }>;

export type BugReportStatus = keyof typeof STATUSES;
