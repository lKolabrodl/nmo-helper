import {describe, expect, it} from 'vitest';
import {NMO_API_HOST, SECOND_ANSWER_SOURCE_HOST, THIRD_ANSWER_SOURCE_HOST} from './constants';
import {
	parseHtml,
	parseNmoApiSearchResults,
	parsePrimarySourceResults,
	parseSecondarySourceResults,
	parseThirdSourceResults,
} from './html';

describe('parseHtml', () => {
	it('парсит HTML в DOM-элемент', () => {
		const div = parseHtml('<p>Привет</p>');
		expect(div.querySelector('p')?.textContent).toBe('Привет');
	});

	it('удаляет script теги', () => {
		const div = parseHtml('<p>Текст</p><script>alert("xss")</script>');
		expect(div.querySelectorAll('script').length).toBe(0);
		expect(div.querySelector('p')?.textContent).toBe('Текст');
	});

	it('удаляет iframe теги', () => {
		const div = parseHtml('<iframe src="evil.com"></iframe><p>OK</p>');
		expect(div.querySelectorAll('iframe').length).toBe(0);
	});

	it('удаляет on* атрибуты', () => {
		const div = parseHtml('<p onclick="alert(1)">Текст</p>');
		expect(div.querySelector('p')?.getAttribute('onclick')).toBeNull();
	});

	it('удаляет javascript: в href', () => {
		const div = parseHtml('<a href="javascript:alert(1)">Ссылка</a>');
		const a = div.querySelector('a');
		expect(a?.getAttribute('href')).toBeNull();
	});

	it('full=true очищает навигацию', () => {
		const html = '<nav>Меню</nav><div class="row"><h3>Вопрос</h3><p><strong>Ответ</strong></p></div><footer>Подвал</footer>';
		const div = parseHtml(html, true);
		expect(div.querySelectorAll('nav').length).toBe(0);
		expect(div.querySelector('h3')?.textContent).toBe('Вопрос');
	});

	it('full=true не зависает, если на большой странице нет div.row', () => {
		const html = `<main>${'x'.repeat(70_000)}<h3>Вопрос</h3></main>`;
		const startedAt = performance.now();

		const div = parseHtml(html, true);

		expect(div.querySelector('h3')?.textContent).toBe('Вопрос');
		expect(performance.now() - startedAt).toBeLessThan(1_000);
	});
});

describe('parseSecondarySourceResults', () => {
	it('извлекает ссылки по селектору и дополняет относительные URL', () => {
		const html = `
			<a class="item-name" href="/answer/42"> Первая тема </a>
			<a class="item-name" href="https://external.example/answer/7"> Вторая тема </a>
		`;

		expect(parseSecondarySourceResults(html)).toEqual([
			{
				source: 'second',
				title: 'Первая тема',
				url: `https://${SECOND_ANSWER_SOURCE_HOST}/answer/42`,
			},
			{
				source: 'second',
				title: 'Вторая тема',
				url: 'https://external.example/answer/7',
			},
		]);
	});

	it('пропускает неполные, неподходящие и небезопасные ссылки', () => {
		const html = `
			<a class="item-name" href="/without-title"> </a>
			<a class="item-name">Без URL</a>
			<a class="item-name" href="javascript:alert(1)">Опасная ссылка</a>
			<a href="/wrong-selector">Другой селектор</a>
		`;

		expect(parseSecondarySourceResults(html)).toEqual([]);
	});
});

describe('parsePrimarySourceResults', () => {
	it('извлекает заголовки и сохраняет URL основного источника как есть', () => {
		const html = `
			<div class="short__title">
				<a href="https://primary.example/topic/42"> Основная тема </a>
			</div>
			<div class="short__title"><a href="/relative/topic"> Относительный URL </a></div>
		`;

		expect(parsePrimarySourceResults(html)).toEqual([
			{
				source: 'first',
				title: 'Основная тема',
				url: 'https://primary.example/topic/42',
			},
			{
				source: 'first',
				title: 'Относительный URL',
				url: '/relative/topic',
			},
		]);
	});

	it('пропускает элементы вне выдачи и ссылки без обязательных данных', () => {
		const html = `
			<div class="short__title"><a href="/without-title"> </a></div>
			<div class="short__title"><a>Без URL</a></div>
			<a href="/outside-result">Вне блока результата</a>
		`;

		expect(parsePrimarySourceResults(html)).toEqual([]);
	});
});

describe('parseThirdSourceResults', () => {
	it('преобразует categories, нормализует поля и кодирует slug', () => {
		const text = JSON.stringify({
			categories: [
				{name: ' Особенности реабилитации ', slug: ' topic/42 '},
				{name: 'Вторая тема', slug: 'тема с пробелом'},
			],
		});

		expect(parseThirdSourceResults(text)).toEqual([
			{
				source: 'third',
				title: 'Особенности реабилитации',
				url: `https://${THIRD_ANSWER_SOURCE_HOST}/test-medik/nmo/topic%2F42.html`,
			},
			{
				source: 'third',
				title: 'Вторая тема',
				url: `https://${THIRD_ANSWER_SOURCE_HOST}/test-medik/nmo/${encodeURIComponent('тема с пробелом')}.html`,
			},
		]);
	});

	it('пропускает категории с отсутствующими или неверными полями', () => {
		const text = JSON.stringify({
			categories: [
				null,
				'строка',
				{name: '', slug: 'without-title'},
				{name: 'Без ссылки', slug: null},
				{name: 42, slug: 'wrong-title-type'},
				{name: 'Пустой slug', slug: '   '},
			],
		});

		expect(parseThirdSourceResults(text)).toEqual([]);
	});

	it.each([
		'not json',
		'null',
		'[]',
		'{}',
		'{"categories":{}}',
	])('безопасно обрабатывает невалидный ответ: %s', text => {
		expect(parseThirdSourceResults(text)).toEqual([]);
	});
});

describe('parseNmoApiSearchResults', () => {
	it('преобразует элементы API и нормализует заголовок с UID', () => {
		const text = JSON.stringify({
			items: [
				{
					id: 'internal-id-is-ignored',
					title: ' Диагностика заболевания ',
					uid: ' short-lived.uid ',
				},
				{
					title: 'Вторая тема',
					uid: 'second.uid',
				},
			],
		});

		expect(parseNmoApiSearchResults(text)).toEqual([
			{
				source: 'nmo-helper',
				title: 'Диагностика заболевания',
				url: `https://${NMO_API_HOST}/api/nmo/topic/short-lived.uid`,
			},
			{
				source: 'nmo-helper',
				title: 'Вторая тема',
				url: `https://${NMO_API_HOST}/api/nmo/topic/second.uid`,
			},
		]);
	});

	it.each([
		'not json',
		'null',
		'[]',
		'{}',
		'{"items":{}}',
	])('безопасно обрабатывает невалидный ответ: %s', text => {
		expect(parseNmoApiSearchResults(text)).toEqual([]);
	});
});
