/**
 * Единое хранилище всех статусов баг-репорта (UX-тексты).
 * Логика вёрстки/состояний — в index.tsx.
 */
export const STATUSES = {
	TRIGGER:       {text: 'Сообщить о проблеме'},
	SEND:          {text: 'Отправить'},
	SENDING:       {text: 'Отправка…'},
	CANCEL:        {text: 'Отмена'},

	SENT:          {text: 'Спасибо! Отчёт отправлен.'},
	DUPLICATE:     {text: 'этот вопрос уже отправлен'},
	COOLDOWN:      {text: 'подождите до следующей отправки'},
	DAILY_CAP:     {text: 'лимит 5 отчётов в сутки исчерпан'},

	PAYLOAD_LARGE: {text: 'вопрос слишком большой'},
	NETWORK:       {text: 'нет сети'},
	SERVER:        {text: 'ошибка сервера'},
} as const satisfies Record<string, {text: string}>;

export type BugReportStatus = keyof typeof STATUSES;
