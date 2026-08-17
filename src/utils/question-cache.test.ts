import {describe, expect, it} from 'vitest';
import {QuestionCache, questionCache} from './question-cache';

describe('QuestionCache', () => {
	it('сохраняет и возвращает вопрос', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', ['Вариант A', 'Вариант B'], ['Вариант B']);

		expect(cache.has('Кардиология', ['Вариант A', 'Вариант B'])).toBe(true);
		expect(cache.get('Кардиология', ['Вариант A', 'Вариант B'])).toEqual({
			variants: ['Вариант A', 'Вариант B'],
			selectedVariants: ['Вариант B'],
		});
	});

	it('накапливает разные вопросы одной темы', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', ['A', 'B'], ['A']);
		cache.set('Кардиология', ['C', 'D'], ['D']);

		expect(cache.getAll()).toHaveLength(2);
	});

	it('обновляет выбранные варианты при повторной записи вопроса', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', ['A', 'B'], ['A']);
		cache.set('Кардиология', ['B', 'A'], ['B']);

		expect(cache.getAll()).toEqual([{
			variants: ['B', 'A'],
			selectedVariants: ['B'],
		}]);
	});

	it('при смене темы очищает кеш и сразу сохраняет новый вопрос', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', ['A', 'B'], ['A']);
		cache.set('Кардиология', ['C', 'D'], ['C']);
		cache.set('Неврология', ['E', 'F'], ['F']);

		expect(cache.has('Кардиология', ['A', 'B'])).toBe(false);
		expect(cache.getAll()).toEqual([{
			variants: ['E', 'F'],
			selectedVariants: ['F'],
		}]);
	});

	it('не считает сменой темы отличия регистра и пробелы по краям', () => {
		const cache = new QuestionCache();

		cache.set('  Кардиология  ', ['A', 'B'], ['A']);
		cache.set('КАРДИОЛОГИЯ', ['C', 'D'], ['D']);

		expect(cache.getAll()).toHaveLength(2);
		expect(cache.has('кардиология', ['B', 'A'])).toBe(true);
	});

	it('защищает кеш от изменений входных и возвращённых массивов', () => {
		const cache = new QuestionCache();
		const variants = ['A', 'B'];
		const selectedVariants = ['A'];

		const saved = cache.set('Тема', variants, selectedVariants);
		variants.push('C');
		selectedVariants.push('B');
		(saved.variants as string[]).push('D');
		(saved.selectedVariants as string[]).push('B');

		expect(cache.get('Тема', ['A', 'B'])).toEqual({
			variants: ['A', 'B'],
			selectedVariants: ['A'],
		});
	});

	it('возвращает пустой массив до первой записи', () => {
		expect(new QuestionCache().getAll()).toEqual([]);
	});
});

describe('questionCache', () => {
	it('экспортируется как общий экземпляр', () => {
		expect(questionCache).toBeInstanceOf(QuestionCache);
	});
});
