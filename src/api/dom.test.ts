import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
	getTopicElement,
	getQuestionAnchor,
	getQuestionText,
	getQuestionHtml,
	getVariantElements,
	getVariantTexts,
	isSingleAnswer,
} from './dom';

// jsdom не реализует innerText — шимим через textContent для getVariantTexts
beforeAll(() => {
	if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
		Object.defineProperty(HTMLElement.prototype, 'innerText', {
			get() { return this.textContent ?? ''; },
			configurable: true,
		});
	}
});

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('fn getTopicElement', () => {
	it('находит .mat-card-title-quiz-custom', () => {
		document.body.innerHTML = '<div class="mat-card-title-quiz-custom">Кардиология</div>';
		expect(getTopicElement()?.textContent).toBe('Кардиология');
	});

	it('fallback на .mat-mdc-card-title если первый селектор не сработал', () => {
		document.body.innerHTML = '<div class="mat-mdc-card-title">Неврология</div>';
		expect(getTopicElement()?.textContent).toBe('Неврология');
	});

	it('первый селектор имеет приоритет над fallback', () => {
		document.body.innerHTML = `
			<div class="mat-mdc-card-title">old</div>
			<div class="mat-card-title-quiz-custom">new</div>
		`;
		expect(getTopicElement()?.textContent).toBe('new');
	});

	it('null если темы нет', () => {
		expect(getTopicElement()).toBeNull();
	});
});

describe('fn getQuestionAnchor', () => {
	it('находит #questionAnchor', () => {
		document.body.innerHTML = '<div id="questionAnchor">x</div>';
		expect(getQuestionAnchor()?.id).toBe('questionAnchor');
	});

	it('null если нет активного вопроса', () => {
		expect(getQuestionAnchor()).toBeNull();
	});
});

describe('fn getQuestionText', () => {
	it('возвращает trimmed текст вопроса', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="question-title-text">   Что это?   </div>
			</div>
		`;
		expect(getQuestionText()).toBe('Что это?');
	});

	it('null если нет questionAnchor', () => {
		document.body.innerHTML = '<div class="question-title-text">оторванный текст</div>';
		expect(getQuestionText()).toBeNull();
	});

	it('null если внутри anchor нет question-title-text', () => {
		document.body.innerHTML = '<div id="questionAnchor"><p>что-то</p></div>';
		expect(getQuestionText()).toBeNull();
	});

	it('ищет только внутри anchor, чужой .question-title-text снаружи игнорируется', () => {
		document.body.innerHTML = `
			<div class="question-title-text">outside</div>
			<div id="questionAnchor"><div class="question-title-text">inside</div></div>
		`;
		expect(getQuestionText()).toBe('inside');
	});

	it('textContent собирает текст из вложенной разметки', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="question-title-text">Что <b>это</b>?</div>
			</div>
		`;
		expect(getQuestionText()).toBe('Что это?');
	});
});

describe('fn getQuestionHtml', () => {
	it('возвращает innerHTML блока вопроса', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="question-title-text">Что <b>это</b>?</div>
			</div>
		`;
		expect(getQuestionHtml()).toBe('Что <b>это</b>?');
	});

	it('null если нет questionAnchor', () => {
		expect(getQuestionHtml()).toBeNull();
	});

	it('null если внутри anchor нет question-title-text', () => {
		document.body.innerHTML = '<div id="questionAnchor"></div>';
		expect(getQuestionHtml()).toBeNull();
	});
});

describe('fn getVariantElements', () => {
	it('возвращает все варианты внутри anchor в порядке DOM', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mdc-form-field"><span>A</span></div>
				<div class="mdc-form-field"><span>B</span></div>
				<div class="mdc-form-field"><span>C</span></div>
			</div>
		`;
		const els = getVariantElements();
		expect(els).toHaveLength(3);
		expect(els.map(e => e.textContent)).toEqual(['A', 'B', 'C']);
	});

	it('пустой массив если нет anchor', () => {
		document.body.innerHTML = '<div class="mdc-form-field"><span>orphan</span></div>';
		expect(getVariantElements()).toEqual([]);
	});

	it('пустой массив если внутри anchor нет вариантов', () => {
		document.body.innerHTML = '<div id="questionAnchor"></div>';
		expect(getVariantElements()).toEqual([]);
	});

	it('варианты снаружи anchor игнорируются', () => {
		document.body.innerHTML = `
			<div class="mdc-form-field"><span>out</span></div>
			<div id="questionAnchor">
				<div class="mdc-form-field"><span>in</span></div>
			</div>
		`;
		const els = getVariantElements();
		expect(els).toHaveLength(1);
		expect(els[0].textContent).toBe('in');
	});
});

describe('fn getVariantTexts', () => {
	it('возвращает trimmed innerText в порядке отображения', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mdc-form-field"><span>  альфа  </span></div>
				<div class="mdc-form-field"><span>бета</span></div>
			</div>
		`;
		expect(getVariantTexts()).toEqual(['альфа', 'бета']);
	});

	it('пустой массив если нет вариантов', () => {
		expect(getVariantTexts()).toEqual([]);
	});
});

describe('fn isSingleAnswer', () => {
	it('true если в anchor есть input[type="radio"]', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<input type="radio" name="q">
				<div class="mdc-form-field"><span>A</span></div>
			</div>
		`;
		expect(isSingleAnswer()).toBe(true);
	});

	it('false если radio нет (checkbox / множественный)', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<input type="checkbox" name="q">
				<div class="mdc-form-field"><span>A</span></div>
			</div>
		`;
		expect(isSingleAnswer()).toBe(false);
	});

	it('false если нет anchor', () => {
		document.body.innerHTML = '<input type="radio" name="q">';
		expect(isSingleAnswer()).toBe(false);
	});

	it('radio снаружи anchor не считается', () => {
		document.body.innerHTML = `
			<input type="radio" name="q">
			<div id="questionAnchor"><div class="mdc-form-field"><span>A</span></div></div>
		`;
		expect(isSingleAnswer()).toBe(false);
	});
});
