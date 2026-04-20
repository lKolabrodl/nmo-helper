import { describe, it, expect, beforeEach } from 'vitest';
import { answerCache, AnswerCache } from './answer-cache';

beforeEach(() => {
	answerCache.clear();
});

describe('answerCache', () => {
	const answer = {
		variants: [
			{ title: 'Лапароскопия', answer: true },
			{ title: 'Лапаротомия', answer: false },
		],
		source: 'ai' as const,
	};

	it('get возвращает null для несуществующего', () => {
		expect(answerCache.get('тема', 'вопрос')).toBeNull();
	});

	it('set + get работают', () => {
		answerCache.set('Хирургия', 'Какой метод?', answer);
		expect(answerCache.get('Хирургия', 'Какой метод?')).toEqual(answer);
	});

	it('разные темы не пересекаются', () => {
		answerCache.set('Тема1', 'Вопрос', answer);
		expect(answerCache.get('Тема2', 'Вопрос')).toBeNull();
	});

	it('isFresh возвращает true один раз после set', () => {
		answerCache.set('Т', 'В', answer);
		expect(answerCache.isFresh('Т', 'В')).toBe(true);
		expect(answerCache.isFresh('Т', 'В')).toBe(false); // второй раз false
	});

	it('getCorrectIndexes возвращает индексы правильных', () => {
		answerCache.set('Т', 'В', answer);
		// currentVariants в другом порядке
		const indexes = answerCache.getCorrectIndexes('Т', 'В', ['Лапаротомия', 'Лапароскопия']);
		expect(indexes).toEqual([1]); // Лапароскопия на позиции 1
	});

	it('getCorrectIndexes возвращает null для несуществующего', () => {
		expect(answerCache.getCorrectIndexes('Т', 'В', ['A'])).toBeNull();
	});

	it('getCorrectIndexes возвращает null если ни один не совпал', () => {
		answerCache.set('Т', 'В', answer);
		expect(answerCache.getCorrectIndexes('Т', 'В', ['Неизвестный вариант'])).toBeNull();
	});

	it('clearTopic очищает одну тему', () => {
		answerCache.set('Т1', 'В', answer);
		answerCache.set('Т2', 'В', answer);
		answerCache.clearTopic('Т1');
		expect(answerCache.get('Т1', 'В')).toBeNull();
		expect(answerCache.get('Т2', 'В')).toEqual(answer);
	});

	it('clear очищает всё', () => {
		answerCache.set('Т1', 'В', answer);
		answerCache.set('Т2', 'В', answer);
		answerCache.clear();
		expect(answerCache.get('Т1', 'В')).toBeNull();
		expect(answerCache.get('Т2', 'В')).toBeNull();
	});

	it('LRU: вытесняет старейшую тему при превышении лимита', () => {
		const lru = new AnswerCache(2);
		lru.set('Т1', 'В', answer);
		lru.set('Т2', 'В', answer);
		lru.set('Т3', 'В', answer); // Т1 должна быть вытеснена
		expect(lru.get('Т1', 'В')).toBeNull();
		expect(lru.get('Т2', 'В')).toEqual(answer);
		expect(lru.get('Т3', 'В')).toEqual(answer);
	});

	it('LRU: повторная запись в тему освежает её', () => {
		const lru = new AnswerCache(2);
		lru.set('Т1', 'В1', answer);
		lru.set('Т2', 'В1', answer);
		lru.set('Т1', 'В2', answer); // освежает Т1
		lru.set('Т3', 'В1', answer); // вытесняет Т2 (а не Т1)
		expect(lru.get('Т1', 'В1')).toEqual(answer);
		expect(lru.get('Т2', 'В1')).toBeNull();
		expect(lru.get('Т3', 'В1')).toEqual(answer);
	});

	it('exportAll возвращает null для пустого кеша', () => {
		expect(answerCache.exportAll()).toBeNull();
	});

	it('exportAll возвращает все темы и вопросы', () => {
		answerCache.set('Хирургия', 'Какой метод?', answer);
		answerCache.set('Хирургия', 'Какой препарат?', answer);
		answerCache.set('Терапия', 'Доза?', answer);

		const exported = answerCache.exportAll();
		expect(exported).not.toBeNull();
		expect(Object.keys(exported!)).toEqual(['Хирургия', 'Терапия']);
		expect(exported!['Хирургия']).toHaveLength(2);
		expect(exported!['Терапия']).toHaveLength(1);
		expect(exported!['Хирургия'][0]).toEqual({
			question: 'Какой метод?',
			variants: [
				{ title: 'Лапароскопия', answer: true },
				{ title: 'Лапаротомия', answer: false },
			],
			source: 'ai',
		});
	});

	it('exportCsv возвращает null для пустого кеша', () => {
		expect(answerCache.exportCsv()).toBeNull();
	});

	it('exportCsv возвращает CSV со всеми данными', () => {
		answerCache.set('Хирургия', 'Какой метод?', answer);

		const csv = answerCache.exportCsv()!;
		const lines = csv.split('\n');
		expect(lines[0]).toBe('Тема;Вопрос;Правильные ответы;Все варианты;Источник');
		expect(lines[1]).toContain('Хирургия');
		expect(lines[1]).toContain('Какой метод?');
		expect(lines[1]).toContain('Лапароскопия');
		expect(lines[1]).toContain('Лапаротомия');
		expect(lines[1]).toContain('ai');
	});

	it('set сохраняет данные в chrome.storage.local', () => {
		answerCache.set('Т', 'В', answer);
		// Проверяем что chrome.storage.local.set был вызван с данными
		chrome.storage.local.get('answerCacheData', (result: Record<string, unknown>) => {
			const data = result['answerCacheData'] as Record<string, Record<string, unknown>>;
			expect(data).toBeTruthy();
			expect(data['Т']).toBeTruthy();
			expect(data['Т']['В']).toEqual(answer);
		});
	});

	it('load восстанавливает данные из chrome.storage.local', async () => {
		// Записываем напрямую в storage
		const stored = {
			'Тема': {
				'Вопрос': answer,
			},
		};
		chrome.storage.local.set({ answerCacheData: stored });

		// Создаём новый инстанс и загружаем
		const fresh = new AnswerCache(10);
		await fresh.load();

		expect(fresh.get('Тема', 'Вопрос')).toEqual(answer);
	});

	it('clear очищает chrome.storage.local', () => {
		answerCache.set('Т', 'В', answer);
		answerCache.clear();

		chrome.storage.local.get('answerCacheData', (result: Record<string, unknown>) => {
			const data = result['answerCacheData'] as Record<string, unknown>;
			expect(Object.keys(data)).toHaveLength(0);
		});
	});
});
