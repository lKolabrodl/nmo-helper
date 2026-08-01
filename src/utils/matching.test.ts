import { describe, it, expect } from 'vitest';
import { detectSource, matchQuestion, pickResult, similarity, variantScore } from './matching';
import type { ISourceKey } from '../types';
import {
	SECONDARY_ANSWER_SOURCE_HOST,
	PRIMARY_ANSWER_SOURCE_HOST,
	ALTERNATIVE_ANSWER_SOURCE_HOST,
	NMO_API_HOST,
} from './constants';

describe('detectSource', () => {
	it('распознаёт дополнительную базу по URL', () => {
		expect(detectSource(`https://${SECONDARY_ANSWER_SOURCE_HOST}/test/123`)).toBe('secondary');
	});

	it('распознаёт основную базу по URL', () => {
		expect(detectSource(`https://${PRIMARY_ANSWER_SOURCE_HOST}/answers`)).toBe('primary');
	});

	it('распознаёт альтернативную базу по URL', () => {
		expect(detectSource(`https://${ALTERNATIVE_ANSWER_SOURCE_HOST}/test-medik/nmo/topic.html`)).toBe('nmo-helper');
	});

	it('распознаёт серверный NMO API как источник nmo-helper', () => {
		expect(detectSource(`https://${NMO_API_HOST}/api/nmo/topic`)).toBe('nmo-helper');
	});

	it('неизвестный домен → null', () => {
		expect(detectSource('https://example.com')).toBeNull();
	});

	it('пустая строка → null', () => {
		expect(detectSource('')).toBeNull();
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

	it('пустая строка vs непустая → 0', () => {
		expect(similarity('', 'abc')).toBe(0);
		expect(similarity('abc', '')).toBe(0);
	});

	it('обе пустые → 1 (ранний выход по равенству)', () => {
		expect(similarity('', '')).toBe(1);
	});

	it('симметричность: similarity(a,b) === similarity(b,a)', () => {
		const a = 'диагностика', b = 'диагностики';
		expect(similarity(a, b)).toBe(similarity(b, a));
	});
});

describe('matchQuestion', () => {
	it('точное совпадение → 1', () => {
		expect(matchQuestion('Цель сестринского процесса', 'Цель сестринского процесса')).toBe(1);
	});

	it('регистр не важен → 1', () => {
		expect(matchQuestion('ВОПРОС О ЛЕЧЕНИИ', 'вопрос о лечении')).toBe(1);
	});

	it('нормализация тире: «—» === «-»', () => {
		expect(matchQuestion('АД — что это', 'АД - что это')).toBe(1);
	});

	it('нормализация пробелов (\\n, табы, двойные → один)', () => {
		expect(matchQuestion('вопрос  с\nлишними\tпробелами', 'вопрос с лишними пробелами')).toBe(1);
	});

	it('кириллические омоглифы → латиница (А=A, Е=E, О=O, Р=P, С=C, Х=X)', () => {
		// "Антибиотик" с кириллической А → должен совпасть с латинской A-Антибиотик
		expect(matchQuestion('Антибиотик', 'Антибиотик')).toBe(1);
	});

	it('кавычки игнорируются при матче', () => {
		expect(matchQuestion('агент «Критик»', 'агент "Критик"')).toBe(1);
	});

	it('includes: вход — подстрока сохранённого (оба ≥ 10 символов) → score = minLen/maxLen', () => {
		const stored = 'Какие методы диагностики кардиомиопатии применяются';
		const input = 'методы диагностики кардиомиопатии применяются';
		const score = matchQuestion(stored, input);
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(1);
	});

	it('includes: сохранённый — подстрока входа (оба ≥ 10) → score > 0', () => {
		const stored = 'методы диагностики применяются';
		const input = 'Какие методы диагностики применяются здесь';
		expect(matchQuestion(stored, input)).toBeGreaterThan(0);
	});

	it('includes не срабатывает на коротких строках (< MIN_INCLUDES_LEN = 10)', () => {
		// "да" — подстрока "идея", но обе короче 10 символов → includes не работает,
		// similarity тоже низкий → 0
		expect(matchQuestion('да', 'идея')).toBe(0);
	});

	it('fuzzy: similarity выше порога (0.85) → возвращает score', () => {
		const score = matchQuestion('Морфологический субстрат ЛГ', 'Морфологичесий субстрат ЛГ');
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThan(1);
	});

	it('fuzzy: similarity ниже порога → 0', () => {
		expect(matchQuestion('кардиология лечение', 'пневмония диагностика')).toBe(0);
	});

	it('совсем разные строки → 0', () => {
		expect(matchQuestion('abc', 'xyz')).toBe(0);
	});
});

describe('variantScore', () => {
	it('точное совпадение → 1', () => {
		expect(variantScore('аспирин', 'аспирин')).toBe(1);
	});

	it('регистронезависимо → 1', () => {
		expect(variantScore('АСПИРИН', 'аспирин')).toBe(1);
	});

	it('нормализация тире → 1', () => {
		expect(variantScore('стэнфорд—бине', 'стэнфорд-бине')).toBe(1);
	});

	it('игнорирует кавычки (ёлочки vs ASCII) → 1', () => {
		expect(variantScore('«Лейтер-3»', '"Лейтер-3"')).toBe(1);
	});

	it('includes (обе ≥ 10) → 1 — подстрока = тот же вариант', () => {
		expect(variantScore('ремоделирование правого желудочка', 'ремоделирование правого желуд')).toBe(1);
	});

	it('includes не срабатывает на коротких (< 10) — "3" vs "3 стадии" → 0', () => {
		// similarity("3","3 стадии") даёт 0 т.к. "3" < 2 символов
		expect(variantScore('3', '3 стадии')).toBe(0);
	});

	it('опечатка в длинной строке → высокий score', () => {
		const s = variantScore('ингибиторы АПФ при гипертонии', 'ингибиторы АПФ при гипетонии');
		expect(s).toBeGreaterThan(0.8);
		expect(s).toBeLessThan(1);
	});

	it('непохожие строки → низкий score', () => {
		expect(variantScore('аспирин', 'парацетамол')).toBeLessThan(0.3);
	});

	it('пустые строки равны → 1', () => {
		expect(variantScore('', '')).toBe(1);
	});

	it('«катепсина К» vs «катепсина А» — высокий score, но не 1', () => {
		// Dice ~0.9 из-за общего префикса. Функция просто возвращает score —
		// решение «это матч» принимает top-1 assignment в findAnswers.
		const s = variantScore('катепсина К', 'катепсина А');
		expect(s).toBeGreaterThan(0.8);
		expect(s).toBeLessThan(1);
	});

	it('симметричность: variantScore(a,b) === variantScore(b,a)', () => {
		const a = 'ингибиторы АПФ при гипертонии';
		const b = 'ингибиторы АПФ при гипетонии';
		expect(variantScore(a, b)).toBe(variantScore(b, a));
	});
});

const mk = (source: ISourceKey, title: string): any => ({ source, title, url: `https://example.com/${encodeURIComponent(title)}` });

describe('pickResult — фильтр по source и пограничные', () => {

	it('пустой массив → undefined', () => {
		expect(pickResult([], 'primary', 'любая тема')).toBeUndefined();
	});

	it('нет результатов нужного источника → undefined', () => {
		const results = [mk('secondary', 'Тема А'), mk('secondary', 'Тема Б')];
		expect(pickResult(results, 'primary', 'Тема А')).toBeUndefined();
	});

	it('единственный результат source — возвращает его без проверки topic', () => {
		const results = [
			mk('primary', 'Совсем неподходящий заголовок'),
			mk('secondary', 'Тема А'),
		];
		const res = pickResult(results, 'primary', 'Тема А');
		expect(res?.title).toBe('Совсем неподходящий заголовок');
	});

	it('игнорирует результаты другого источника при ранжировании', () => {
		const results = [
			mk('secondary', 'Лечение гипертонии'),                    // точное, но не тот source
			mk('primary', 'Совсем другая тема про эндокринологию'),
			mk('primary', 'Лечение гипертонии у взрослых'),
		];
		const res = pickResult(results, 'primary', 'Лечение гипертонии');
		expect(res?.source).toBe('primary');
		expect(res?.title).toBe('Лечение гипертонии у взрослых');
	});

	it('сложный тест с одинаковыми названиями', () => {
		const topic = 'Сперматоцеле (по утвержденным клиническим рекомендациям) - 2025';
		const results = [
			mk('primary', 'Гидроцеле, сперматоцеле (по утвержденным клиническим рекомендациям) - 2025'),
			mk('primary', 'Сперматоцеле (по утвержденным клиническим рекомендациям) - 2025'),
		];
		const res = pickResult(results, 'primary', topic);
		expect(res?.title).toBe('Сперматоцеле (по утвержденным клиническим рекомендациям) - 2025');
	});

});

describe('pickResult — fallback на последний', () => {

	it('topic = null + несколько кандидатов → последний', () => {
		const results = [
			mk('primary', 'Старая тема 2020'),
			mk('primary', 'Свежая тема 2024'),
		];
		expect(pickResult(results, 'primary', null)?.title).toBe('Свежая тема 2024');
	});

	it('ни один title не достиг MIN_TITLE_SCORE → последний', () => {
		const results = [
			mk('primary', 'Кардиология и лечение ИБС'),
			mk('primary', 'Эндокринология и диабет'),
		];
		const res = pickResult(results, 'primary', 'Травматология и переломы');
		expect(res?.title).toBe('Эндокринология и диабет');
	});
});

describe('pickResult — ранжирование по похожести', () => {

	it('точное совпадение topic === title → выбирает его', () => {
		const results = [
			mk('primary', 'Лечение гипертонии у пожилых'),
			mk('primary', 'Диагностика инфаркта миокарда'),
			mk('primary', 'Реабилитация после инсульта'),
		];
		const res = pickResult(results, 'primary', 'Диагностика инфаркта миокарда');
		expect(res?.title).toBe('Диагностика инфаркта миокарда');
	});

	it('title — обрезанная версия topic → побеждает (includes-ветка variantScore)', () => {
		const topic = 'Лечение острого инфаркта миокарда у пациентов старше 65 лет (рекомендации 2024)';
		const results = [
			mk('primary', 'Лечение гипертонии у пожилых'),
			mk('primary', 'Лечение острого инфаркта миокарда у пациентов старше 65 лет'),  // обрезан
			mk('primary', 'Реабилитация после инсульта'),
		];
		const res = pickResult(results, 'primary', topic);
		expect(res?.title).toBe('Лечение острого инфаркта миокарда у пациентов старше 65 лет');
	});

	it('стрипает префикс «Ответы к тестам НМО:» и матчит title как подстроку topic', () => {
		const topic = 'Кардиомиопатия дилатационная (по утвержденным клиническим рекомендациям) - 2024';
		const results = [
			mk('primary', 'Ответы к тестам НМО: "Гипертоническая болезнь - 2024"'),
			mk('primary', 'Ответы к тестам НМО: "Кардиомиопатия дилатационная"'),
			mk('primary', 'Ответы к тестам НМО: "Инфаркт миокарда без подъёма ST"'),
		];
		const res = pickResult(results, 'primary', topic);
		expect(res?.title).toBe('Ответы к тестам НМО: "Кардиомиопатия дилатационная"');
	});

	it('нормализация тире/кавычек/регистра — match не пропадает', () => {
		const topic = 'Шкала Стэнфорд—Бине у детей';
		const results = [
			mk('primary', 'ШКАЛА СТЭНФОРД-БИНЕ У ДЕТЕЙ'),
			mk('primary', 'Совсем другая тема'),
		];
		expect(pickResult(results, 'primary', topic)?.title).toBe('ШКАЛА СТЭНФОРД-БИНЕ У ДЕТЕЙ');
	});

	it('при нескольких пересечениях по биграммам — выигрывает наиболее похожий (Dice)', () => {
		// Ни один title не является подстрокой topic (и наоборот) — только Dice.
		const topic = 'Хроническая обструктивная болезнь лёгких у пожилых';
		const results = [
			mk('primary', 'Бронхиальная астма у детей'),
			mk('primary', 'Хроническая обструктивная болезнь лёгких: терапия и реабилитация'),
			mk('primary', 'Острый бронхит'),
		];
		const res = pickResult(results, 'primary', topic);
		expect(res?.title).toBe('Хроническая обструктивная болезнь лёгких: терапия и реабилитация');
	});
});

describe('pickResult — БАГ репорт', () => {

	it('Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ (алкоголя, опиоидов, каннабиноидов, седативных и снотворных веществ, кокаина, других стимуляторов (кроме кофеина), летучих растворителей, никотина, галлюциногенов и нескольких психоактивных веществ). Острая интоксикация (по утвержденным клиническим рекомендациям) - 2024', () => {
		const topic = 'Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ (алкоголя, опиоидов, каннабиноидов, седативных и снотворных веществ, кокаина, других стимуляторов (кроме кофеина), летучих растворителей, никотина, галлюциногенов и нескольких психоактивных веществ). Острая интоксикация (по утвержденным клиническим рекомендациям) - 2024';

		const results: any[] = [
			'Ответы к тестам НМО: "Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ. Синдром зависимости от психоактивных веществ (кроме алкоголя и никотина) (по утвержденным клиническим рекомендациям) - 2024"',
			'Ответы к тестам НМО: "Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ Синдром отмены психоактивных веществ (кроме алкоголя и никотина) (по утвержденным клиническим рекомендациям) - 2024"',
			'Ответы к тестам НМО: "Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ (алкоголя, каннабиноидов, седативных и снотворных веществ, Психотическое расстройство (по утвержденным клиническим рекомендациям) - 2024"',
			'Ответы к тестам НМО: "Особенности сестринского наблюдения несовершеннолетних, употребляющих "солевые" наркотики"',
			'Ответы к тестам НМО: "Методика оценки анозогнозии у пациентов с зависимостью от опиоидов"',
			'Ответы к тестам НМО: "Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ (алкоголя, опиоидов, каннабиноидов, седативных и снотворных веществ, кокаина, других стимуляторов (кроме кофеина), летучих растворителей',
			'Ответы к тестам НМО: "Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ Абстинентное состояние (синдром отмены) с делирием (по утвержденным клиническим рекомендациям) - 2024"',
			'Ответы к тестам НМО: "Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ. Пагубное (с вредными последствиями) употребление (по утвержденным клиническим рекомендациям) - 2024"',
		].map(t => mk('primary', t));

		const res = pickResult(results, 'primary', topic);
		expect(res).toBeDefined();
		expect(res.title).toContain('Ответы к тестам НМО: "Психические и поведенческие расстройства, вызванные употреблением психоактивных веществ (алкоголя, опиоидов, каннабиноидов, седативных и снотворных веществ, кокаина, других стимуляторов (кроме кофеина), летучих растворителей');
	});
});
