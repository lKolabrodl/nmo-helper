import { describe, it, expect } from 'vitest';
import {
	extract24forcare2,
	extractRosmedH3Highlighted2,
	extractRosmedH3BrPlus2,
	extractRosmedNumberedPInlineBr2,
	extractRosmedNumberedPPerParagraph2,
} from './extractors';

/**
 * jsdom не поддерживает innerText → патчим через textContent
 * (как в cases.test.ts — extractor'ы читают innerText в splitBrLines
 * и readNumberedQuestionText).
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

describe('extract24forcare2', () => {
	it('находит вопрос + strong-варианты', () => {
		const div = createDiv(`
			<h3>Вопрос?</h3>
			<p>первый<br><strong>второй</strong><br>третий</p>
		`);
		const out = extract24forcare2(div);
		expect(out).toHaveLength(1);
		expect(out[0].question).toBe('Вопрос?');
		expect(out[0].variants).toEqual(['первый', 'второй', 'третий']);
		expect(out[0].answers).toEqual(['второй']);
	});

	it('несколько правильных strong', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><strong>a</strong><br>b<br><strong>c</strong></p>
		`);
		const [c] = extract24forcare2(div);
		expect(c.answers).toEqual(['a', 'c']);
	});

	it('пустой h3 игнорируется', () => {
		const div = createDiv(`
			<h3></h3>
			<p><strong>a</strong></p>
		`);
		expect(extract24forcare2(div)).toEqual([]);
	});

	it('пропускает h3 если следующий sibling не <p>', () => {
		const div = createDiv(`
			<h3>Q1</h3>
			<div><strong>a</strong></div>
		`);
		expect(extract24forcare2(div)).toEqual([]);
	});

	it('пропускает case без правильных (нет <strong>)', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>первый<br>второй</p>
		`);
		expect(extract24forcare2(div)).toEqual([]);
	});

	it('несколько вопросов подряд — по одному case на каждый', () => {
		const div = createDiv(`
			<h3>Q1</h3>
			<p>a<br><strong>b</strong></p>
			<h3>Q2</h3>
			<p><strong>x</strong><br>y</p>
		`);
		const out = extract24forcare2(div);
		expect(out).toHaveLength(2);
		expect(out[0].question).toBe('Q1');
		expect(out[1].question).toBe('Q2');
	});

	it('пустой div → []', () => {
		expect(extract24forcare2(createDiv(''))).toEqual([]);
	});
});

describe('extractRosmedH3Highlighted2', () => {
	it('ловит fbeeb8 в style', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><span style="background-color:#fbeeb8;">правильный</span><br>неправильный</p>
		`);
		const [c] = extractRosmedH3Highlighted2(div);
		expect(c.answers).toEqual(['правильный']);
		expect(c.variants).toEqual(['правильный', 'неправильный']);
	});

	it('ловит любое `background` в style (не только fbeeb8)', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><span style="background: yellow">правильный</span><br>нет</p>
		`);
		const [c] = extractRosmedH3Highlighted2(div);
		expect(c.answers).toEqual(['правильный']);
	});

	it('case-insensitive по атрибуту style', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><span STYLE="BACKGROUND: #FBEEB8">правильный</span><br>нет</p>
		`);
		const [c] = extractRosmedH3Highlighted2(div);
		expect(c.answers).toEqual(['правильный']);
	});

	it('нет подсветки → case без ответов отбрасывается', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>a<br>b</p>
		`);
		expect(extractRosmedH3Highlighted2(div)).toEqual([]);
	});

	it('пропускает h3 без последующего <p>', () => {
		const div = createDiv(`<h3>Q</h3><div>x</div>`);
		expect(extractRosmedH3Highlighted2(div)).toEqual([]);
	});
});

describe('extractRosmedH3BrPlus2', () => {
	it('ловит варианты с `+`, снимает плюс из текста', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>первый<br>второй+<br>третий</p>
		`);
		const [c] = extractRosmedH3BrPlus2(div);
		expect(c.variants).toEqual(['первый', 'второй', 'третий']);
		expect(c.answers).toEqual(['второй']);
	});

	it('несколько правильных через `+`', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>a+<br>b<br>c+</p>
		`);
		const [c] = extractRosmedH3BrPlus2(div);
		expect(c.answers).toEqual(['a', 'c']);
	});

	it('нет `+` нигде → case без ответов отбрасывается', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>a<br>b</p>
		`);
		expect(extractRosmedH3BrPlus2(div)).toEqual([]);
	});
});

describe('extractRosmedNumberedPInlineBr2', () => {
	it('находит «N. вопрос» + инлайн-<br> варианты с `+`', () => {
		const div = createDiv(`
			<p><b>12. Вопрос?</b></p>
			<p>1) первый<br>2) второй+<br>3) третий</p>
		`);
		const [c] = extractRosmedNumberedPInlineBr2(div);
		expect(c.question).toBe('Вопрос?');
		expect(c.variants).toEqual(['первый', 'второй', 'третий']);
		expect(c.answers).toEqual(['второй']);
	});

	it('снимает префикс «N. » у вопроса', () => {
		const div = createDiv(`
			<p><b>7. Лечение ИБС</b></p>
			<p>1) a<br>2) b+</p>
		`);
		const [c] = extractRosmedNumberedPInlineBr2(div);
		expect(c.question).toBe('Лечение ИБС');
	});

	it('пропускает когда в следующем <p> нет <br>', () => {
		const div = createDiv(`
			<p><b>1. Q</b></p>
			<p>один вариант</p>
		`);
		expect(extractRosmedNumberedPInlineBr2(div)).toEqual([]);
	});

	it('игнорирует <p> без нумерации в начале', () => {
		const div = createDiv(`
			<p><b>Просто текст без номера</b></p>
			<p>a<br>b+</p>
		`);
		expect(extractRosmedNumberedPInlineBr2(div)).toEqual([]);
	});

	it('читает номер прямо из <p> если нет <b>', () => {
		const div = createDiv(`
			<p>3. Вопрос</p>
			<p>a<br>b+</p>
		`);
		const [c] = extractRosmedNumberedPInlineBr2(div);
		expect(c.question).toBe('Вопрос');
	});
});

describe('extractRosmedNumberedPPerParagraph2', () => {
	it('находит вопрос + серию <p> с нумерованными вариантами', () => {
		const div = createDiv(`
			<p><b>5. Препарат?</b></p>
			<p>1) аспирин</p>
			<p>2) парацетамол+</p>
			<p>3) ибупрофен</p>
		`);
		const [c] = extractRosmedNumberedPPerParagraph2(div);
		expect(c.question).toBe('Препарат?');
		expect(c.variants).toEqual(['аспирин', 'парацетамол', 'ибупрофен']);
		expect(c.answers).toEqual(['парацетамол']);
	});

	it('останавливается на следующем «N. »', () => {
		const div = createDiv(`
			<p><b>1. Q1</b></p>
			<p>1) a</p>
			<p>2) b+</p>
			<p><b>2. Q2</b></p>
			<p>1) x</p>
			<p>2) y+</p>
		`);
		const out = extractRosmedNumberedPPerParagraph2(div);
		expect(out).toHaveLength(2);
		expect(out[0].variants).toEqual(['a', 'b']);
		expect(out[1].variants).toEqual(['x', 'y']);
	});

	it('игнорирует <p> с <br> внутри (это чужая раскладка Case C)', () => {
		const div = createDiv(`
			<p><b>1. Q</b></p>
			<p>1) a<br>2) b</p>
			<p>3) c+</p>
		`);
		const [c] = extractRosmedNumberedPPerParagraph2(div);
		// <p> с <br> пропущен — остался только «3) c+»
		expect(c.variants).toEqual(['c']);
		expect(c.answers).toEqual(['c']);
	});

	it('пропускает параграфы без нумерованного префикса', () => {
		const div = createDiv(`
			<p><b>1. Q</b></p>
			<p>просто текст</p>
			<p>1) a</p>
			<p>2) b+</p>
		`);
		const [c] = extractRosmedNumberedPPerParagraph2(div);
		expect(c.variants).toEqual(['a', 'b']);
	});

	it('пустой div → []', () => {
		expect(extractRosmedNumberedPPerParagraph2(createDiv(''))).toEqual([]);
	});
});

describe('extractors — общие свойства', () => {
	it('все пропускают сигнал пустой строки (нет вариантов)', () => {
		const div = createDiv(`<h3>Q</h3><p></p>`);
		expect(extract24forcare2(div)).toEqual([]);
		expect(extractRosmedH3Highlighted2(div)).toEqual([]);
		expect(extractRosmedH3BrPlus2(div)).toEqual([]);
	});

	it('cleanAnswer применяется к вариантам (пробелы/хвостовой `.`)', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><strong>  первый  </strong><br>второй.<br>третий;</p>
		`);
		const [c] = extract24forcare2(div);
		expect(c.variants).toEqual(['первый', 'второй', 'третий']);
	});

	it('cleanAnswer снимает ведущую нумерацию «N) »', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><strong>1) первый</strong><br>2) второй</p>
		`);
		const [c] = extract24forcare2(div);
		expect(c.variants).toEqual(['первый', 'второй']);
	});
});
