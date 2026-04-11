import { describe, it, expect, beforeEach } from 'vitest';
import { answerCache } from './answer-cache';

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
});
