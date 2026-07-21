import {Status} from '../../types';
import type {IToast} from '../ui/InlineToast';

/**
 * Добавляет префикс провайдера к имени модели, как того требует ProxyAPI:
 * `claude-*` → `anthropic/claude-*`, `gemini-*` → `gemini/gemini-*`.
 * Модели OpenAI (и прочие) возвращаются без изменений.
 *
 * Для кастомных endpoint'ов префикс не нужен — вызывающий код сам решает,
 * применять ли эту функцию.
 *
 * @param model ID модели в том виде, как он хранится в настройках.
 * @returns Имя модели, готовое к отправке в ProxyAPI.
 */
export function getApiModel(model: string): string {
	if (model.startsWith('claude')) return 'anthropic/' + model;
	if (model.startsWith('gemini')) return 'gemini/' + model;
	return model;
}

/**
 * Собирает пару system/user-промптов для запроса к LLM.
 *
 * System-prompt делает модель «врачом-экспертом» по теме курса (если тема задана)
 * и задаёт клинический контекст (РФ-рекомендации). User-prompt содержит вопрос,
 * пронумерованные варианты и инструкцию по формату ответа — одна цифра или несколько
 * через запятую, в зависимости от {@link isSingle}.
 *
 * @param question Текст вопроса.
 * @param options  Варианты ответа (будут пронумерованы с 1).
 * @param isSingle Ожидается один ответ или несколько.
 * @param topic    Название темы. Пустая строка — без темы в system-prompt.
 * @returns `{ systemPrompt, userPrompt }` — готовые строки для поля `messages`.
 */
export function buildPrompt(question: string, options: string[], isSingle: boolean, topic: string) {
	const countHint = isSingle
		? 'Правильный ответ ТОЛЬКО ОДИН. Ответь ОДНИМ номером, без пояснений. Например: 2'
		: 'Правильных ответов может быть несколько. Ответь номерами через запятую, без пояснений. Например: 1,3';
	const systemPrompt = topic
		? `Ты врач-эксперт. Тема: ${topic}. Отвечай на вопросы теста, опираясь на актуальные клинические рекомендации РФ.`
		: 'Ты эксперт. Отвечай на вопросы теста.';
	const userPrompt = `Вопрос: ${question}\n\nВарианты:\n${options.map((o, i) => `${i + 1}) ${o}`).join('\n')}\n\n${countHint}`;

	return { systemPrompt, userPrompt };
}

export function statusToToast(title: string, status: typeof Status[keyof typeof Status]): IToast {
	if (status === Status.OK) return {kind: 'success', title};
	if (status === Status.ERR) return {kind: 'danger', title};
	return {kind: 'warning', title};
}
