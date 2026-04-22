import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	fetchViaBackground,
	getApiModel,
	validateApiKey,
	askAI,
	buildPrompt,
	buildRequest,
	handleError,
	parseAnswer,
	type IRequestResponse,
} from './fetch';

type SendMessageFn = (msg: unknown, cb: (res: unknown) => void) => void;

const sendMessage = vi.fn();

beforeEach(() => {
	sendMessage.mockReset();
	(chrome.runtime as unknown as { sendMessage: SendMessageFn }).sendMessage = sendMessage as unknown as SendMessageFn;
});

describe('fn fetchViaBackground', () => {

	it('шлёт сообщение в background с action=fetch и переданным url', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: 'ok' }));
		await fetchViaBackground('https://example.com/api');
		expect(sendMessage).toHaveBeenCalledTimes(1);
		const [msg] = sendMessage.mock.calls[0];
		expect(msg).toMatchObject({ action: 'fetch', url: 'https://example.com/api' });
	});

	it('по умолчанию method=GET, headers=null, body=null', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '' }));
		await fetchViaBackground('https://example.com/');
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.method).toBe('GET');
		expect(msg.headers).toBeNull();
		expect(msg.body).toBeNull();
	});

	it('пробрасывает method, headers и body из options', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '' }));
		await fetchViaBackground('https://example.com/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"a":1}',
		});
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.method).toBe('POST');
		expect(msg.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(msg.body).toBe('{"a":1}');
	});

	it('резолвит промис с ответом от background', async () => {
		const response = { error: false, status: 201, text: '{"ok":true}' };
		sendMessage.mockImplementation((_msg, cb) => cb(response));
		const res = await fetchViaBackground('https://example.com/');
		expect(res).toEqual(response);
	});

	it('возвращает ошибочный ответ как есть (error=true)', async () => {
		const response = { error: true, status: 0, text: '', message: 'network fail' };
		sendMessage.mockImplementation((_msg, cb) => cb(response));
		const res = await fetchViaBackground('https://example.com/');
		expect(res).toEqual(response);
	});

	it('пустой объект options эквивалентен дефолтам', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '' }));
		await fetchViaBackground('https://example.com/', {});
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.method).toBe('GET');
		expect(msg.headers).toBeNull();
		expect(msg.body).toBeNull();
	});
});

describe('fn getApiModel', () => {
	it('claude-* → anthropic/claude-*', () => {
		expect(getApiModel('claude-3-opus')).toBe('anthropic/claude-3-opus');
	});

	it('gemini-* → gemini/gemini-*', () => {
		expect(getApiModel('gemini-2.0-pro')).toBe('gemini/gemini-2.0-pro');
	});

	it('прочие модели возвращаются как есть', () => {
		expect(getApiModel('gpt-4o')).toBe('gpt-4o');
		expect(getApiModel('o3-mini')).toBe('o3-mini');
	});
});

describe('fn validateApiKey', () => {
	it('успешный 200 → true, запрос на дефолтный AI_URL', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '{}' }));
		const ok = await validateApiKey('sk-test', 'gpt-4o');
		expect(ok).toBe(true);
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.url).toBe('https://openai.api.proxyapi.ru/v1/chat/completions');
		expect(msg.method).toBe('POST');
		expect((msg.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
		const body = JSON.parse(msg.body as string);
		expect(body.model).toBe('gpt-4o');
		expect(body.max_completion_tokens).toBe(5);
	});

	it('переданный endpoint используется вместо AI_URL', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: '{}' }));
		await validateApiKey('sk', 'claude-3-opus', 'https://custom.example/v1/chat');
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.url).toBe('https://custom.example/v1/chat');
		const body = JSON.parse(msg.body as string);
		expect(body.model).toBe('anthropic/claude-3-opus');
	});

	it('429 → true (ключ валиден, просто лимит)', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 429, text: '' }));
		await expect(validateApiKey('sk', 'gpt-4o')).resolves.toBe(true);
	});

	it('error=true → "ошибка сети"', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: true, status: 0, text: '' }));
		await expect(validateApiKey('sk', 'gpt-4o')).rejects.toThrow('ошибка сети');
	});

	it('401 → "неверный API-ключ"', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 401, text: 'unauthorized' }));
		await expect(validateApiKey('sk', 'gpt-4o')).rejects.toThrow('неверный API-ключ');
		errSpy.mockRestore();
	});

	it('403 → "неверный API-ключ"', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 403, text: 'forbidden' }));
		await expect(validateApiKey('sk', 'gpt-4o')).rejects.toThrow('неверный API-ключ');
		errSpy.mockRestore();
	});

	it('500 → "ошибка 500"', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 500, text: 'boom' }));
		await expect(validateApiKey('sk', 'gpt-4o')).rejects.toThrow('ошибка 500');
		errSpy.mockRestore();
	});
});

describe('fn buildPrompt', () => {
	it('isSingle=true → инструкция про ОДИН ответ', () => {
		const { userPrompt } = buildPrompt('Q?', ['a', 'b'], true, 'Тема');
		expect(userPrompt).toContain('ТОЛЬКО ОДИН');
		expect(userPrompt).not.toContain('несколько');
	});

	it('isSingle=false → инструкция про несколько номеров', () => {
		const { userPrompt } = buildPrompt('Q?', ['a', 'b'], false, 'Тема');
		expect(userPrompt).toContain('несколько');
		expect(userPrompt).toContain('1,3');
	});

	it('непустой topic → system-prompt с темой и РФ-рекомендациями', () => {
		const { systemPrompt } = buildPrompt('Q?', [], true, 'Кардиология');
		expect(systemPrompt).toContain('врач-эксперт');
		expect(systemPrompt).toContain('Кардиология');
		expect(systemPrompt).toContain('РФ');
	});

	it('пустой topic → дефолтный system-prompt без темы', () => {
		const { systemPrompt } = buildPrompt('Q?', [], true, '');
		expect(systemPrompt).toBe('Ты эксперт. Отвечай на вопросы теста.');
	});

	it('варианты нумеруются с 1 и попадают в user-prompt', () => {
		const { userPrompt } = buildPrompt('Что?', ['альфа', 'бета', 'гамма'], true, '');
		expect(userPrompt).toContain('1) альфа');
		expect(userPrompt).toContain('2) бета');
		expect(userPrompt).toContain('3) гамма');
		expect(userPrompt).toContain('Вопрос: Что?');
	});
});

describe('fn buildRequest', () => {
	it('обычная модель → url=AI_URL, model с префиксом, temperature=0.2', () => {
		const { url, init } = buildRequest('sk', 'claude-3-opus', 'sys', 'usr');
		expect(url).toBe('https://openai.api.proxyapi.ru/v1/chat/completions');
		expect(init.method).toBe('POST');
		expect(init.headers.Authorization).toBe('Bearer sk');
		const body = JSON.parse(init.body);
		expect(body.model).toBe('anthropic/claude-3-opus');
		expect(body.temperature).toBe(0.2);
		expect(body.messages).toEqual([
			{ role: 'system', content: 'sys' },
			{ role: 'user', content: 'usr' },
		]);
	});

	it('reasoning-модель (o3) → без поля temperature', () => {
		const { init } = buildRequest('sk', 'o3-mini', 'sys', 'usr');
		const body = JSON.parse(init.body);
		expect(body).not.toHaveProperty('temperature');
	});

	it('reasoning-модель (gpt-5) → без поля temperature', () => {
		const { init } = buildRequest('sk', 'gpt-5-nano', 'sys', 'usr');
		const body = JSON.parse(init.body);
		expect(body).not.toHaveProperty('temperature');
	});

	it('кастомный endpoint → url подменяется, модель без префикса', () => {
		const { url, init } = buildRequest('sk', 'claude-3-opus', 'sys', 'usr', 'https://custom/api');
		expect(url).toBe('https://custom/api');
		const body = JSON.parse(init.body);
		expect(body.model).toBe('claude-3-opus');
	});
});

describe('fn handleError', () => {
	const res = (status: number, text = ''): IRequestResponse => ({ error: false, status, text });

	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('401 → "неверный API-ключ"', () => {
		expect(() => handleError(res(401))).toThrow('неверный API-ключ');
	});

	it('403 → "неверный API-ключ"', () => {
		expect(() => handleError(res(403))).toThrow('неверный API-ключ');
	});

	it('402 → "нет средств на балансе"', () => {
		expect(() => handleError(res(402))).toThrow('нет средств на балансе');
	});

	it('429 → "лимит запросов — подождите"', () => {
		expect(() => handleError(res(429))).toThrow('лимит запросов — подождите');
	});

	it('прочий статус → "ошибка <status>"', () => {
		expect(() => handleError(res(500))).toThrow('ошибка 500');
		expect(() => handleError(res(418))).toThrow('ошибка 418');
	});

	it('детали из JSON error.message логируются в console.error', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const body = JSON.stringify({ error: { message: 'bad key shape' } });
		expect(() => handleError(res(401, body))).toThrow();
		expect(spy).toHaveBeenCalledWith('NMO AI [401]:', 'bad key shape');
	});

	it('не-JSON тело — логируется как raw text', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(() => handleError(res(500, 'Gateway Timeout'))).toThrow();
		expect(spy).toHaveBeenCalledWith('NMO AI [500]:', 'Gateway Timeout');
	});
});

describe('fn parseAnswer', () => {
	const make = (content: string): IRequestResponse => ({
		error: false,
		status: 200,
		text: JSON.stringify({ choices: [{ message: { content } }] }),
	});

	it('одна цифра → [n-1]', () => {
		expect(parseAnswer(make('2'))).toEqual([1]);
	});

	it('несколько через запятую → массив 0-индексов', () => {
		expect(parseAnswer(make('1,3'))).toEqual([0, 2]);
	});

	it('цифры внутри текста вытягиваются', () => {
		expect(parseAnswer(make('Ответы: 1 и 3'))).toEqual([0, 2]);
	});

	it('нет цифр → пустой массив', () => {
		expect(parseAnswer(make('не знаю'))).toEqual([]);
	});

	it('пустой content → пустой массив', () => {
		expect(parseAnswer(make(''))).toEqual([]);
	});

	it('отсутствующий choices → пустой массив', () => {
		const res: IRequestResponse = { error: false, status: 200, text: '{}' };
		expect(parseAnswer(res)).toEqual([]);
	});
});

describe('fn askAI', () => {
	it('успешный ответ → массив 0-индексов', async () => {
		const body = JSON.stringify({ choices: [{ message: { content: '1,3' } }] });
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: body }));
		const res = await askAI('sk', 'Q?', ['a', 'b', 'c'], false, 'Тема', 'gpt-4o');
		expect(res).toEqual([0, 2]);
	});

	it('шлёт POST на AI_URL с Bearer-токеном и правильным телом', async () => {
		const body = JSON.stringify({ choices: [{ message: { content: '1' } }] });
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 200, text: body }));
		await askAI('sk-test', 'Что?', ['a', 'b'], true, 'Тема', 'claude-3-opus');
		const [msg] = sendMessage.mock.calls[0] as [Record<string, unknown>, unknown];
		expect(msg.url).toBe('https://openai.api.proxyapi.ru/v1/chat/completions');
		expect(msg.method).toBe('POST');
		expect((msg.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
		const sentBody = JSON.parse(msg.body as string);
		expect(sentBody.model).toBe('anthropic/claude-3-opus');
		expect(sentBody.messages).toHaveLength(2);
		expect(sentBody.messages[1].content).toContain('Что?');
	});

	it('error=true → "ошибка сети"', async () => {
		sendMessage.mockImplementation((_msg, cb) => cb({ error: true, status: 0, text: '' }));
		await expect(askAI('sk', 'Q?', ['a'], true, '', 'gpt-4o')).rejects.toThrow('ошибка сети');
	});

	it('401 → "неверный API-ключ"', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 401, text: '' }));
		await expect(askAI('sk', 'Q?', ['a'], true, '', 'gpt-4o')).rejects.toThrow('неверный API-ключ');
	});

	it('402 → "нет средств на балансе"', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 402, text: '' }));
		await expect(askAI('sk', 'Q?', ['a'], true, '', 'gpt-4o')).rejects.toThrow('нет средств на балансе');
	});

	it('429 → "лимит запросов — подождите"', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		sendMessage.mockImplementation((_msg, cb) => cb({ error: false, status: 429, text: '' }));
		await expect(askAI('sk', 'Q?', ['a'], true, '', 'gpt-4o')).rejects.toThrow('лимит запросов');
	});
});
