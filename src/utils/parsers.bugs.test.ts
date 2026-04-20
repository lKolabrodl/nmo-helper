import { describe, it, expect } from 'vitest';
import { parseFrom24forcare, parseFromRosmedicinfo } from './parsers';
import { findCorrectIndexes } from './matching';
import type { SourceKey } from '../types';

/**
 * Регрессионные тесты по баг-репортам от пользователей.
 *
 * Как добавить новый баг:
 * 1. Из пришедшего в Telegram JSON-файла `bug-report.json` скопируйте:
 *    - `topic` → комментарий к it()
 *    - `question` → questionText
 *    - `variants` → variants
 *    - `activeUrl` → source и URL (для заметки)
 * 2. Откройте `activeUrl` в браузере, сохраните HTML страницы и вставьте
 *    в `answersHtml` ниже. Можно сократить до релевантного куска
 *    (вопрос + ответы), если страница жирная — главное сохранить
 *    структуру так же как у парсера в источнике.
 * 3. Запустите `npx vitest run src/utils/parsers.bugs.test.ts` —
 *    тест покажет что парсер сейчас видит. Если ничего — баг
 *    воспроизведён. Правьте парсер в `parsers.ts`, тест станет зелёным.
 * 4. Укажите ожидаемые `correctIndexes` → тест превращается в регрессию.
 */




/**
 * jsdom не поддерживает innerText, патчим через textContent
 * (этот же приём используется в parsers.test.ts).
 */
function createDiv(html: string): HTMLElement {
	const div = document.createElement('div');
	div.innerHTML = html;
	div.querySelectorAll('*').forEach(el => {
		Object.defineProperty(el, 'innerText', {
			get() { return this.textContent; },
			set(v: string) { this.textContent = v; },
			configurable: true,
		});
	});
	return div;
}

interface IBugCase {
	readonly source: SourceKey;
	/** innerHTML страницы с ответами (или релевантный кусок) */
	readonly answersHtml: string;
	/** Текст вопроса как видит его расширение на странице НМО */
	readonly questionText: string;
	/** Варианты ответов на странице НМО в том же порядке что видит пользователь */
	readonly variants: string[];
}

interface IReproduceResult {
	/** Что парсер вытащил со страницы источника для данного вопроса */
	readonly answers: string[] | null;
	/** Индексы правильных вариантов (null если answers=null) */
	readonly correctIndexes: number[] | null;
}

function reproduceBug(c: IBugCase): IReproduceResult {
	const container = createDiv(c.answersHtml);
	const parser =
		c.source === '24forcare'
			? parseFrom24forcare(container)
			: parseFromRosmedicinfo(container);
	const answers = parser(c.questionText);
	const correctIndexes = answers ? findCorrectIndexes(c.variants, answers) : null;
	return { answers, correctIndexes };
}

describe('Баг-репорты (регрессии)', () => {
	/*
	 * Шаблон. Снять .skip, заполнить данные из баг-репорта, указать expected
	 * после починки парсера.
	 *
	 * Тема: <topic из bug-report.json>
	 * URL:  <activeUrl>
	 * Источник: 24forcare | rosmedicinfo
	 */
	it.skip('[YYYY-MM-DD] <краткое описание бага>', () => {
		const { answers, correctIndexes } = reproduceBug({
			source: '24forcare',
			answersHtml: `
				<h3>Какой диагноз?</h3>
				<p><strong>Вариант 1</strong>; <strong>Вариант 2</strong></p>
			`,
			questionText: 'Какой диагноз?',
			variants: ['Вариант 1', 'Вариант 2', 'Вариант 3'],
		});

		// До фикса — может быть null (парсер не нашёл вопрос) или пустой
		expect(answers).not.toBeNull();
		// После фикса парсера — точные индексы правильных вариантов
		expect(correctIndexes).toEqual([0, 1]);
	});


});
