import { describe, it, expect } from 'vitest';
import { findCorrectIndexes, highlightByIndexes } from './matching';
import { HIGHLIGHT_COLOR } from './constants';

describe('findCorrectIndexes', () => {
	it('находит точное совпадение', () => {
		const variants = ['Лапароскопия', 'Лапаротомия', 'Торакотомия'];
		const answers = ['Лапароскопия'];
		expect(findCorrectIndexes(variants, answers)).toEqual([0]);
	});

	it('находит несколько правильных', () => {
		const variants = ['A', 'B', 'C', 'D'];
		const answers = ['A', 'C'];
		expect(findCorrectIndexes(variants, answers)).toEqual([0, 2]);
	});

	it('возвращает пустой массив если нет совпадений', () => {
		const variants = ['A', 'B', 'C'];
		const answers = ['X', 'Y'];
		expect(findCorrectIndexes(variants, answers)).toEqual([]);
	});

	it('нечёткое совпадение по подстроке на границе слова', () => {
		const variants = ['применение лапароскопии', 'лапаротомия', 'торакотомия'];
		const answers = ['лапароскопии'];
		// "лапароскопии" — подстрока "применение лапароскопии" на границе слова
		expect(findCorrectIndexes(variants, answers)).toEqual([0]);
	});

	it('работает с кириллицей-двойниками', () => {
		// А (кириллица) vs A (латиница) — normalizeText должен свести
		const variants = ['Ответ А', 'Ответ Б'];
		const answers = ['Ответ A']; // латинская A
		expect(findCorrectIndexes(variants, answers)).toEqual([0]);
	});
});

describe('highlightByIndexes', () => {
	it('подсвечивает элементы по индексам', () => {
		const els = [0, 1, 2].map(() => document.createElement('span'));
		highlightByIndexes(els, [0, 2]);
		// jsdom конвертирует hex в rgb
		expect(els[0].style.color).toBeTruthy();
		expect(els[1].style.color).toBe('');
		expect(els[2].style.color).toBeTruthy();
	});

	it('не меняет цвет повторно', () => {
		const el = document.createElement('span');
		highlightByIndexes([el], [0]);
		const color = el.style.color;
		highlightByIndexes([el], [0]);
		expect(el.style.color).toBe(color);
	});
});
