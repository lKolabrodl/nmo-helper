import { describe, it, expect } from 'vitest';
import { parseHtml } from './html';

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
});
