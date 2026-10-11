import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {IRequestResponse} from './fetch';

type SendMessageFn = (message: unknown, reply: (res: unknown) => void) => void;
const sendMessage = vi.fn();
let api: typeof import('./fetch-ai');

const chatRejected: IRequestResponse = {
	error: false,
	status: 404,
	text: JSON.stringify({error: {message: 'This is not a chat model and thus not supported in the v1/chat/completions endpoint. Did you mean to use v1/completions?'}}),
};
const completed: IRequestResponse = {
	error: false,
	status: 200,
	text: JSON.stringify({
		status: 'completed',
		output: [
			{type: 'reasoning', summary: [{type: 'summary_text', text: 'Рассматриваю вариант 2'}]},
			{type: 'function_call', arguments: '{"answer":2}'},
			{type: 'message', role: 'assistant', content: [{type: 'output_text', text: '1'}, {type: 'output_text', text: '3'}]},
		],
	}),
};

beforeEach(async () => {
	vi.resetModules();
	api = await import('./fetch-ai');
	sendMessage.mockReset();
	(chrome.runtime as unknown as {sendMessage: SendMessageFn}).sendMessage = sendMessage as unknown as SendMessageFn;
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('маршрут Responses в ProxyAPI', () => {
	it('при проверке GPT-5.5 Pro повторяет отказ чата через Responses и запоминает маршрут для вопросов', async () => {
		sendMessage.mockImplementation((message, reply) => reply(message.url.endsWith('/chat/completions') ? chatRejected : completed));

		await expect(api.validateApiKey('sk-test', 'gpt-5.5-pro')).resolves.toBe(true);
		expect(sendMessage).toHaveBeenCalledTimes(2);
		const responsesRequest = sendMessage.mock.calls[1][0];
		expect(responsesRequest.url).toBe('https://api.proxyapi.ru/v1/responses');
		expect(responsesRequest.headers.Authorization).toBe('Bearer sk-test');
		expect(JSON.parse(responsesRequest.body)).toEqual({
			model: 'openai/gpt-5.5-pro',
			input: [{role: 'user', content: 'Ответь OK'}],
			max_output_tokens: 16,
			store: false,
		});

		await expect(api.askAI('sk-test', 'Q?', ['a', 'b', 'c'], false, '', 'openai/gpt-5.5-pro')).resolves.toEqual([0, 2]);
		expect(sendMessage).toHaveBeenCalledTimes(3);
		expect(sendMessage.mock.calls[2][0].url).toBe('https://api.proxyapi.ru/v1/responses');
		const body = JSON.parse(sendMessage.mock.calls[2][0].body);
		expect(body.input[0].role).toBe('system');
		expect(body.input[1].content).toContain('Вопрос: Q?');
	});

	it('повторяет запрос вопроса для любого ID модели, сохраняя промпт, лимит и таймаут', async () => {
		sendMessage.mockImplementationOnce((_message, reply) => reply({
			...chatRejected,
			status: 400,
			text: JSON.stringify({error: {message: 'This model is only supported in the Responses API.'}}),
		})).mockImplementationOnce((_message, reply) => reply(completed));

		await expect(api.askAI('sk-test', 'Q?', ['a', 'b', 'c'], false, '', 'future/new-model', undefined, {maxTokens: 32, timeoutMs: 30_000}))
			.resolves.toEqual([0, 2]);
		expect(sendMessage).toHaveBeenCalledTimes(2);
		const chatBody = JSON.parse(sendMessage.mock.calls[0][0].body);
		const request = sendMessage.mock.calls[1][0];
		expect(request.url).toBe('https://api.proxyapi.ru/v1/responses');
		expect(request.timeoutMs).toBe(30_000);
		expect(JSON.parse(request.body)).toEqual({model: 'future/new-model', input: chatBody.messages, max_output_tokens: 32, store: false});
	});

	it.each([
		{error: false, status: 404, text: '{"error":{"code":"model_not_found","message":"The model does not exist"}}'},
		{error: false, status: 400, text: '{"error":{"message":"Invalid max_completion_tokens"}}'},
		{error: false, status: 401, text: 'Unauthorized'},
		{error: false, status: 403, text: 'Forbidden'},
		{error: false, status: 402, text: 'Insufficient balance'},
		{error: false, status: 429, text: 'Rate limit'},
		{error: false, status: 500, text: 'Server error'},
		{error: true, status: 0, text: ''},
	])('не повторяет другие ошибки: $status, $text', async error => {
		sendMessage.mockImplementation((_message, reply) => reply(error));
		await expect(api.askAI('sk-test', 'Q?', ['a'], true, '', 'future/new-model')).rejects.toBeInstanceOf(api.AiRequestError);
		expect(sendMessage).toHaveBeenCalledTimes(1);
	});

	it('не запоминает неуспешный маршрут и показывает ошибку Responses без новых повторов', async () => {
		sendMessage.mockImplementation((message, reply) => reply(message.url.endsWith('/chat/completions') ? chatRejected : {
			error: false, status: 403, text: 'Forbidden',
		}));

		for (let attempt = 0; attempt < 2; attempt++) {
			await expect(api.validateApiKey('sk-test', 'openai/gpt-5.5-pro')).rejects.toThrow('доступ запрещён');
		}
		expect(sendMessage.mock.calls.map(([message]) => message.url)).toEqual([
			'https://api.proxyapi.ru/v1/chat/completions', 'https://api.proxyapi.ru/v1/responses',
			'https://api.proxyapi.ru/v1/chat/completions', 'https://api.proxyapi.ru/v1/responses',
		]);
	});

	it('при лимите Responses считает ключ принятым', async () => {
		sendMessage.mockImplementationOnce((_message, reply) => reply(chatRejected))
			.mockImplementationOnce((_message, reply) => reply({error: false, status: 429, text: 'Rate limit'}));

		await expect(api.validateApiKey('sk-test', 'openai/gpt-5.5-pro')).resolves.toBe(true);
		expect(sendMessage).toHaveBeenCalledTimes(2);
	});

	it('свой endpoint использует указанный адрес даже для модели с запомненным маршрутом Responses', async () => {
		sendMessage.mockImplementation((message, reply) => reply(message.url.endsWith('/chat/completions') ? chatRejected : completed));
		await api.validateApiKey('sk-test', 'openai/gpt-5.5-pro');
		sendMessage.mockClear();
		sendMessage.mockImplementation((_message, reply) => reply(chatRejected));

		await expect(api.askAI('sk-test', 'Q?', ['a'], true, '', 'openai/gpt-5.5-pro', 'https://custom.example/v1/chat/completions'))
			.rejects.toThrow('модель не поддерживает этот формат API');
		expect(sendMessage).toHaveBeenCalledTimes(1);
		expect(sendMessage.mock.calls[0][0].url).toBe('https://custom.example/v1/chat/completions');
	});
});
