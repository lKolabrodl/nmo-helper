import {describe, expect, it} from 'vitest';
import {QuestionCache, questionCache} from './question-cache';

describe('QuestionCache', () => {
	it('сохраняет и возвращает данные по тексту вопроса', () => {
		const cache = new QuestionCache();

		cache.set(
			'Кардиология',
			'Какой вариант правильный?',
			['Вариант A', 'Вариант B'],
			['Вариант B'],
		);

		expect(cache.has('Кардиология', 'Какой вариант правильный?')).toBe(true);
		expect(cache.get('Кардиология', 'Какой вариант правильный?')).toEqual({
			variants: ['Вариант A', 'Вариант B'],
			selectedVariants: ['Вариант B'],
		});
	});

	it('хранит отдельно разные вопросы с одинаковыми вариантами', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', 'Первый вопрос', ['A', 'B'], ['A']);
		cache.set('Кардиология', 'Второй вопрос', ['A', 'B'], ['B']);

		expect(cache.get('Кардиология', 'Первый вопрос')?.selectedVariants).toEqual(['A']);
		expect(cache.get('Кардиология', 'Второй вопрос')?.selectedVariants).toEqual(['B']);
	});

	it('нормализует регистр и пробелы в ключе вопроса', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', '  Какой   ответ?  ', ['A', 'B'], ['A']);

		expect(cache.get('Кардиология', 'КАКОЙ ОТВЕТ?')).toEqual({
			variants: ['A', 'B'],
			selectedVariants: ['A'],
		});
	});

	it('обновляет варианты и выбор при повторной записи вопроса', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', 'Какой ответ?', ['A', 'B'], ['A']);
		cache.set('Кардиология', ' КАКОЙ  ОТВЕТ? ', ['B', 'A'], ['B']);

		expect(cache.get('Кардиология', 'Какой ответ?')).toEqual({
			variants: ['B', 'A'],
			selectedVariants: ['B'],
		});
	});

	it('при смене темы очищает кеш и сразу сохраняет новый вопрос', () => {
		const cache = new QuestionCache();

		cache.set('Кардиология', 'Первый вопрос', ['A', 'B'], ['A']);
		cache.set('Кардиология', 'Второй вопрос', ['C', 'D'], ['C']);
		cache.set('Неврология', 'Третий вопрос', ['E', 'F'], ['F']);

		expect(cache.has('Кардиология', 'Первый вопрос')).toBe(false);
		expect(cache.get('Неврология', 'Третий вопрос')).toEqual({
			variants: ['E', 'F'],
			selectedVariants: ['F'],
		});
	});

	it('не считает сменой темы отличия регистра и пробелы по краям', () => {
		const cache = new QuestionCache();

		cache.set('  Кардиология  ', 'Первый вопрос', ['A', 'B'], ['A']);
		cache.set('КАРДИОЛОГИЯ', 'Второй вопрос', ['C', 'D'], ['D']);

		expect(cache.has('кардиология', 'Первый вопрос')).toBe(true);
		expect(cache.has('кардиология', 'Второй вопрос')).toBe(true);
	});

	it('защищает кеш от изменений входных и возвращённых массивов', () => {
		const cache = new QuestionCache();
		const variants = ['A', 'B'];
		const selectedVariants = ['A'];

		const saved = cache.set('Тема', 'Вопрос', variants, selectedVariants);
		variants.push('C');
		selectedVariants.push('B');
		(saved.variants as string[]).push('D');
		(saved.selectedVariants as string[]).push('B');

		const received = cache.get('Тема', 'Вопрос')!;
		(received.variants as string[]).push('E');
		(received.selectedVariants as string[]).push('B');

		expect(cache.get('Тема', 'Вопрос')).toEqual({
			variants: ['A', 'B'],
			selectedVariants: ['A'],
		});
	});

	it('возвращает null до первой записи и для неизвестного вопроса', () => {
		const cache = new QuestionCache();

		expect(cache.get('Тема', 'Вопрос')).toBeNull();
		cache.set('Тема', 'Другой вопрос', ['A', 'B'], ['A']);
		expect(cache.get('Тема', 'Вопрос')).toBeNull();
	});
});

describe('questionCache', () => {
	it('экспортируется как общий экземпляр', () => {
		expect(questionCache).toBeInstanceOf(QuestionCache);
	});
});
