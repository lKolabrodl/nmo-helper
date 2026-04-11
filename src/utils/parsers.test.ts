import { describe, it, expect } from 'vitest';
import { parseFrom24forcare, parseFromRosmedicinfo, detectSource } from './parsers';

/**
 * jsdom не поддерживает innerText, поэтому extractors падают.
 * Создаём DOM вручную и патчим innerText через textContent.
 */
function createDiv(html: string): HTMLElement {
	const div = document.createElement('div');
	div.innerHTML = html;
	// Патчим innerText для всех элементов (jsdom workaround)
	div.querySelectorAll('*').forEach(el => {
		Object.defineProperty(el, 'innerText', {
			get() { return this.textContent; },
			set(v: string) { this.textContent = v; },
			configurable: true,
		});
	});
	return div;
}

describe('detectSource', () => {
	it('определяет 24forcare', () => {
		expect(detectSource('https://24forcare.com/test/123')).toBe('24forcare');
	});

	it('определяет rosmedicinfo', () => {
		expect(detectSource('https://rosmedicinfo.ru/test/456')).toBe('rosmedicinfo');
	});

	it('возвращает null для неизвестного', () => {
		expect(detectSource('https://google.com')).toBeNull();
	});
});

describe('parseFrom24forcare', () => {
	it('извлекает ответы из h3 + p > strong', () => {
		const div = createDiv(`
			<h3>Какой метод лечения?</h3>
			<p><strong>Лапароскопия</strong>; <strong>Торакотомия</strong></p>
		`);
		const parser = parseFrom24forcare(div);
		const answers = parser('Какой метод лечения?');
		expect(answers).toContain('Лапароскопия');
		expect(answers).toContain('Торакотомия');
	});

	it('возвращает null если вопрос не найден', () => {
		const div = createDiv('<h3>Другой вопрос</h3><p><strong>Ответ</strong></p>');
		const parser = parseFrom24forcare(div);
		expect(parser('Несуществующий вопрос')).toBeNull();
	});

	it('находит вопрос по includes', () => {
		const div = createDiv('<h3>Какие методы диагностики применяются при кардиомиопатии</h3><p><strong>ЭхоКГ</strong></p>');
		const parser = parseFrom24forcare(div);
		const answers = parser('методы диагностики применяются при кардиомиопатии');
		expect(answers).toContain('ЭхоКГ');
	});
});

describe('parseFromRosmedicinfo', () => {
	it('layout1: извлекает ответы из h3 + span с жёлтым фоном', () => {
		const div = createDiv(`
			<h3>Вопрос о лечении</h3>
			<p><span style="background: #fbeeb8">Правильный ответ</span> <span>Неправильный</span></p>
		`);
		const parser = parseFromRosmedicinfo(div);
		const answers = parser('Вопрос о лечении');
		expect(answers).toContain('Правильный ответ');
	});

	it('layout2: извлекает ответы из p.MsoNormal с нумерацией и +', () => {
		const div = createDiv(`
			<p class="MsoNormal"><b>1. Какой препарат?</b></p>
			<p class="MsoNormal">Аспирин+<br>Ибупрофен<br>Парацетамол+</p>
		`);
		const parser = parseFromRosmedicinfo(div);
		const answers = parser('Какой препарат?');
		expect(answers).toContain('Аспирин');
		expect(answers).toContain('Парацетамол');
	});

	it('возвращает null если вопрос не найден', () => {
		const div = createDiv('<h3>Другой</h3><p><span style="background: #fbeeb8">Ответ</span></p>');
		const parser = parseFromRosmedicinfo(div);
		expect(parser('Совсем не тот вопрос абсолютно другая тематика')).toBeNull();
	});
});
