import { describe, it, expect } from 'vitest';
import { cleanTopic, normalizeDashes, normalizeText, similarity } from './text';

describe('cleanTopic', () => {
	it('возвращает null при null', () => {
		expect(cleanTopic(null)).toBeNull();
	});

	it('убирает суффикс с годом', () => {
		expect(cleanTopic('Кардиология - 2024')).toBe('Кардиология');
	});

	it('убирает суффикс Контрольное', () => {
		expect(cleanTopic('Хирургия - Контрольное тестирование')).toBe('Хирургия');
	});

	it('тримит пробелы', () => {
		expect(cleanTopic('  Неврология  ')).toBe('Неврология');
	});

	it('оставляет чистую тему без изменений', () => {
		expect(cleanTopic('Терапия')).toBe('Терапия');
	});
});

describe('normalizeDashes', () => {
	it('заменяет unicode тире на дефис', () => {
		expect(normalizeDashes('а\u2014б')).toBe('a-б');
	});

	it('сжимает пробелы', () => {
		expect(normalizeDashes('а  б   в')).toBe('a б в');
	});

	it('заменяет кириллицу-двойники на латиницу', () => {
		// А → a, Е → e, О → o, Р → p, С → c, Х → x
		expect(normalizeDashes('АЕОРСХ')).toBe('aeopcx');
	});

	it('приводит к lowercase', () => {
		expect(normalizeDashes('ABC')).toBe('abc');
	});
});

describe('normalizeText', () => {
	it('заменяет тире и пробелы', () => {
		expect(normalizeText('а\u2013б  в')).toBe('a-б в');
	});

	it('приводит к lowercase', () => {
		expect(normalizeText('АБВ Test')).toBe('aбв test');
	});
});

describe('similarity', () => {
	it('одинаковые строки → 1', () => {
		expect(similarity('abc', 'abc')).toBe(1);
	});

	it('совершенно разные строки → близко к 0', () => {
		expect(similarity('abc', 'xyz')).toBeLessThan(0.3);
	});

	it('короткие строки (<2 символов) → 0', () => {
		expect(similarity('a', 'a')).toBe(1); // exact match
		expect(similarity('a', 'b')).toBe(0);
	});

	it('похожие строки → высокий score', () => {
		const score = similarity('кардиология', 'кардиологии');
		expect(score).toBeGreaterThan(0.8);
	});

	it('непохожие строки → низкий score', () => {
		const score = similarity('кардиология', 'офтальмология');
		expect(score).toBeLessThan(0.5);
	});
});
