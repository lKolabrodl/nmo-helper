import { AI_URL } from '../utils/constants';

export interface IRequestResponse {
	readonly error: boolean;
	readonly status: number;
	readonly text: string;
	readonly message?: string;
}

interface IRequestOptions {
	readonly method?: string;
	readonly headers?: Record<string, string> | null;
	readonly body?: string | null;
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
 * @param options HTTP-метод, заголовки и тело. По умолчанию `GET` без заголовков и тела.
 * @returns Промис, резолвящийся ответом от background. Никогда не реджектится.
 */
export function fetchViaBackground(url: string, options: IRequestOptions = {}): Promise<IRequestResponse> {
	return new Promise(resolve => {
		chrome.runtime.sendMessage({
			action: 'fetch',
			url,
			method: options.method || 'GET',
			headers: options.headers || null,
			body: options.body || null,
		}, resolve);
	});
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
 * @param model    ID модели (`gpt-4o`, `claude-3-opus`, `o3-mini` и т.д.).
 * @param endpoint Необязательный кастомный URL (например, self-hosted OpenAI-совместимый).
 *                 Если указан, модель шлётся как есть, без префикса провайдера.
 * @returns Массив 0-индексированных номеров вариантов, помеченных моделью как правильные.
 *          Пустой массив — если в ответе не нашлось ни одной цифры.
 * @throws {Error} `ошибка сети` — сетевой сбой.
 * @throws {Error} `неверный API-ключ` — HTTP 401/403.
 * @throws {Error} `нет средств на балансе` — HTTP 402.
 * @throws {Error} `лимит запросов — подождите` — HTTP 429.
 * @throws {Error} `ошибка <status>` — любой другой не-2xx HTTP-статус.
 */
export async function askAI(apiKey: string, question: string, options: string[], isSingle: boolean, topic: string, model: string, endpoint?: string): Promise<number[]> {
	const { systemPrompt, userPrompt } = buildPrompt(question, options, isSingle, topic);
	const { url, init } = buildRequest(apiKey, model, systemPrompt, userPrompt, endpoint);

	const res: IRequestResponse = await fetchViaBackground(url, init);

	if (res.error) throw new Error('ошибка сети');
	if (res.status < 200 || res.status >= 400) handleError(res);

	return parseAnswer(res);
}

/**
 * Проверяет, что API-ключ валиден: шлёт минимальный chat-completion
 * (одно сообщение «Ответь OK», `max_completion_tokens: 5`) и смотрит на статус.
 *
 * HTTP 429 (rate limit) трактуется как валидный ключ — раз сервер применил
 * лимит именно к этому ключу, значит он его опознал.
 *
 * @param apiKey   Bearer-токен для проверки.
 * @param model    Модель, на которой тестируется ключ. Должна быть доступна на endpoint'е.
 * @param endpoint Кастомный URL. По умолчанию используется {@link AI_URL} (ProxyAPI).
 * @returns `true`, если ключ принят сервером (включая 2xx и 429).
 * @throws {Error} `ошибка сети` — сетевой сбой.
 * @throws {Error} `неверный API-ключ` — HTTP 401/403.
 * @throws {Error} `ошибка <status>` — любой другой не-2xx статус (кроме 429).
 */
export async function validateApiKey(apiKey: string, model: string, endpoint?: string): Promise<boolean> {
	const res: IRequestResponse = await fetchViaBackground(endpoint || AI_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + apiKey,
		},
		body: JSON.stringify({
			model: getApiModel(model),
			messages: [{ role: 'user', content: 'Ответь OK' }],
			max_completion_tokens: 5,
		}),
	});
	if (res.error) throw new Error('ошибка сети');
	if (res.status === 401 || res.status === 403) {
		console.error(`NMO AI [${res.status}]:`, res.text);
		throw new Error('неверный API-ключ');
	}
	if (res.status === 429) return true;
	if (res.status < 200 || res.status >= 400) {
		console.error(`NMO AI [${res.status}]:`, res.text);
		throw new Error('ошибка ' + res.status);
	}
	return true;
}

// help fn

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

/**
 * Собирает URL и `RequestInit` для chat-completion запроса.
 *
 * Reasoning-модели (`o1`/`o3`/`gpt-5`) не принимают поле `temperature` —
 * для них оно не включается в тело. Для кастомного endpoint'а модель шлётся
 * как есть, без префикса провайдера (см. {@link getApiModel}).
 *
 * @param apiKey       Bearer-токен.
 * @param model        ID модели.
 * @param systemPrompt Системный промпт (см. {@link buildPrompt}).
 * @param userPrompt   Пользовательский промпт (см. {@link buildPrompt}).
 * @param endpoint     Необязательный кастомный URL; по умолчанию — {@link AI_URL}.
 * @returns `{ url, init }` для передачи в {@link fetchViaBackground}.
 */
export function buildRequest(apiKey: string, model: string, systemPrompt: string, userPrompt: string, endpoint?: string) {
	const isReasoning = /^o\d/.test(model) || /^gpt-5/.test(model);

	const body: Record<string, unknown> = {
		model: endpoint ? model : getApiModel(model),
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
	};
	if (!isReasoning) body.temperature = 0.2;

	return {
		url: endpoint || AI_URL,
		init: {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + apiKey,
			},
			body: JSON.stringify(body),
		},
	};
}

/**
 * Маппит неуспешный HTTP-ответ ProxyAPI в осмысленное исключение для UI.
 * Детали сервера (`error.message` из JSON-тела, либо raw-текст) логирует
 * в `console.error` для отладки.
 *
 * Никогда не возвращается нормально — тип `never` это отражает.
 *
 * @param res Ответ от {@link fetchViaBackground} со статусом вне `[200, 400)`.
 * @throws {Error} `неверный API-ключ` — 401/403.
 * @throws {Error} `нет средств на балансе` — 402.
 * @throws {Error} `лимит запросов — подождите` — 429.
 * @throws {Error} `ошибка <status>` — любой другой статус.
 */
export function handleError(res: IRequestResponse): never {
	let detail: string;
	try { detail = JSON.parse(res.text)?.error?.message || res.text; } catch { detail = res.text; }
	console.error(`NMO AI [${res.status}]:`, detail);
	if (res.status === 401 || res.status === 403) throw new Error('неверный API-ключ');
	if (res.status === 402) throw new Error('нет средств на балансе');
	if (res.status === 429) throw new Error('лимит запросов — подождите');
	throw new Error(`ошибка ${res.status}`);
}

/**
 * Достаёт номера правильных ответов из успешного chat-completion.
 *
 * Берёт `choices[0].message.content`, вытягивает все подряд идущие цифры
 * регуляркой (так переносится и «2», и «1, 3», и «Ответы: 1 и 3») и сдвигает
 * в 0-индексированный массив. Если цифр нет — возвращает пустой массив
 * (вызывающий трактует это как «модель не смогла определиться»).
 *
 * @param res Ответ от {@link fetchViaBackground} с 2xx-статусом.
 * @returns Массив 0-индексированных номеров вариантов.
 */
export function parseAnswer(res: IRequestResponse): number[] {
	const data = JSON.parse(res.text);
	const text: string = data?.choices?.[0]?.message?.content || '';
	const nums = text.match(/\d+/g);
	if (!nums) return [];
	return nums.map(n => parseInt(n, 10) - 1);
}
