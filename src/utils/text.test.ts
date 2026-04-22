import { describe, it, expect } from 'vitest';
import { cleanAnswer, cleanTopic, normalizeDashes, normalizeText, stripQuotes } from './text';

describe('fn cleanTopic', () => {
	it('возвращает null при null', () => {
		expect(cleanTopic(null)).toBeNull();
	});

	it('сохраняет «- YYYY» без типа тестирования', () => {
		expect(cleanTopic('Кардиология - 2024')).toBe('Кардиология - 2024');
	});

	it('срезает «- Предварительное тестирование», оставляя год', () => {
		expect(cleanTopic('Кардиология - 2024 - Предварительное тестирование')).toBe('Кардиология - 2024');
	});

	it('срезает «- Контрольное тестирование», оставляя год', () => {
		expect(cleanTopic('Хирургия - 2024 - Контрольное тестирование')).toBe('Хирургия - 2024');
	});

	it('срезает «- Итоговое тестирование», оставляя год', () => {
		expect(cleanTopic('Неврология - 2023 - Итоговое тестирование')).toBe('Неврология - 2023');
	});

	it('срезает «- Контрольное» без года', () => {
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

	it('кириллические омоглифы → латиница (полный набор)', () => {
		// АЕОРСХ (верхний регистр) → aeopcx (после lowercase)
		expect(normalizeText('АЕОРСХ')).toBe('aeopcx');
		// аеорсх (нижний регистр) тоже → латиница
		expect(normalizeText('аеорсх')).toBe('aeopcx');
	});

	it('идемпотентна — двойное применение не меняет результат', () => {
		const once = normalizeText('АД — Что\u00A0это');
		expect(normalizeText(once)).toBe(once);
	});
});

describe('cleanAnswer', () => {
	it('пустая строка → пустая', () => {
		expect(cleanAnswer('')).toBe('');
	});

	it('trim пробелов', () => {
		expect(cleanAnswer('   abc   ')).toBe('abc');
	});

	it('схлопывает любые последовательности пробельных (включая \\n, \\t) в один пробел', () => {
		expect(cleanAnswer('a  b\nc\t\td')).toBe('a b c d');
	});

	it('удаляет хвостовой `;`', () => {
		expect(cleanAnswer('ответ;')).toBe('ответ');
	});

	it('удаляет хвостовой `+`', () => {
		expect(cleanAnswer('ответ+')).toBe('ответ');
	});

	it('удаляет хвостовой `.`', () => {
		expect(cleanAnswer('ответ.')).toBe('ответ');
	});

	it('удаляет комбинацию хвостовых `;+.` и пробелов', () => {
		expect(cleanAnswer('ответ ;+.  ')).toBe('ответ');
	});

	it('удаляет ведущую нумерацию «N) »', () => {
		expect(cleanAnswer('1) первый')).toBe('первый');
		expect(cleanAnswer('12) двенадцатый')).toBe('двенадцатый');
	});

	it('не трогает нумерацию в середине/конце', () => {
		expect(cleanAnswer('тест 1) inline')).toBe('тест 1) inline');
	});

	it('не трогает «N.» (это не маркер варианта, это номер вопроса)', () => {
		expect(cleanAnswer('1. тест')).toBe('1. тест');
	});

	it('комбинация: нумерация + хвост + внутренние пробелы', () => {
		expect(cleanAnswer('3)   ответ ;  ')).toBe('ответ');
	});

	it('ведущие пробелы перед «N)» мешают снятию нумерации (документируем поведение)', () => {
		// regex `^\d+\)` не смотрит за пробелы, trim в конце — поэтому «3)» остаётся
		expect(cleanAnswer('  3) ответ')).toBe('3) ответ');
	});
});

describe('stripQuotes', () => {
	it('убирает ASCII-двойные кавычки', () => {
		expect(stripQuotes('"Критик"')).toBe('Критик');
	});

	it('убирает ASCII-одинарные', () => {
		expect(stripQuotes("'Критик'")).toBe('Критик');
	});

	it('убирает «ёлочки»', () => {
		expect(stripQuotes('«Критик»')).toBe('Критик');
	});

	it('убирает “английские” кавычки', () => {
		expect(stripQuotes('\u201CКритик\u201D')).toBe('Критик');
	});

	it('убирает „немецкие" кавычки', () => {
		expect(stripQuotes('\u201EКритик\u201C')).toBe('Критик');
	});

	it('убирает ‘одинарные изогнутые’', () => {
		expect(stripQuotes('\u2018Критик\u2019')).toBe('Критик');
	});

	it('смешанный набор кавычек в одной строке', () => {
		expect(stripQuotes('«a» "b" \'c\' \u201Cd\u201D')).toBe('a b c d');
	});

	it('пустая строка → пустая', () => {
		expect(stripQuotes('')).toBe('');
	});

	it('без кавычек — без изменений', () => {
		expect(stripQuotes('обычный текст')).toBe('обычный текст');
	});
});
