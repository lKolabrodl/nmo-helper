/**
 * Чистая логика AI-режима: запросы к ProxyAPI, проверка ключа.
 * Без привязки к DOM — используется из хука use-ai.ts.
 */

import type { IFetchResponse } from '../types';
import { fetchViaBackground } from './index';
import { AI_URL } from './constants';

export function getApiModel(model: string): string {
	if (model.startsWith('claude')) return 'anthropic/' + model;
	if (model.startsWith('gemini')) return 'gemini/' + model;
	return model;
}

function buildPrompt(question: string, options: string[], isSingle: boolean, topic: string) {
	const countHint = isSingle
		? 'Правильный ответ ТОЛЬКО ОДИН. Ответь ОДНИМ номером, без пояснений. Например: 2'
		: 'Правильных ответов может быть несколько. Ответь номерами через запятую, без пояснений. Например: 1,3';
	const systemPrompt = topic
		? `Ты врач-эксперт. Тема: ${topic}. Отвечай на вопросы теста, опираясь на актуальные клинические рекомендации РФ.`
		: 'Ты эксперт. Отвечай на вопросы теста.';
	const userPrompt = `Вопрос: ${question}\n\nВарианты:\n${options.map((o, i) => `${i + 1}) ${o}`).join('\n')}\n\n${countHint}`;

	return { systemPrompt, userPrompt };
}

function buildRequest(apiKey: string, model: string, systemPrompt: string, userPrompt: string, endpoint?: string) {
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

function handleError(res: IFetchResponse): never {
	let detail: string;
	try { detail = JSON.parse(res.text)?.error?.message || res.text; } catch { detail = res.text; }
	console.error(`NMO AI [${res.status}]:`, detail);
	if (res.status === 401 || res.status === 403) throw new Error('неверный API-ключ');
	if (res.status === 402) throw new Error('нет средств на балансе');
	if (res.status === 429) throw new Error('лимит запросов — подождите');
	throw new Error(`ошибка ${res.status}`);
}

function parseAnswer(res: IFetchResponse): number[] {
	const data = JSON.parse(res.text);
	const text: string = data?.choices?.[0]?.message?.content || '';
	const nums = text.match(/\d+/g);
	if (!nums) return [];
	return nums.map(n => parseInt(n, 10) - 1);
}

export async function askAI(
	apiKey: string, question: string, options: string[],
	isSingle: boolean, topic: string, model: string, endpoint?: string,
): Promise<number[]> {
	const { systemPrompt, userPrompt } = buildPrompt(question, options, isSingle, topic);
	const { url, init } = buildRequest(apiKey, model, systemPrompt, userPrompt, endpoint);

	const res: IFetchResponse = await fetchViaBackground(url, init);

	if (res.error) throw new Error('ошибка сети');
	if (res.status < 200 || res.status >= 400) handleError(res);

	return parseAnswer(res);
}

export async function validateApiKey(apiKey: string, model: string, endpoint?: string): Promise<boolean> {
	const res: IFetchResponse = await fetchViaBackground(endpoint || AI_URL, {
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
