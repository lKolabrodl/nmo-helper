import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
	findCompletedQuizResults,
	findVariantElements,
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

describe('fn findCompletedQuizResults', () => {
	it('находит список только у завершённого теста', () => {
		document.body.innerHTML = `
			<lib-quiz-page>
				<div class="text_value text-success">Завершен</div>
				<lib-questions-list>
					<div class="questionList">
						<div class="questionList-item"></div>
					</div>
				</lib-questions-list>
			</lib-quiz-page>
		`;

		expect(findCompletedQuizResults()).toBe(document.querySelector('.questionList'));

		document.querySelector('.text-success')?.remove();
		expect(findCompletedQuizResults()).toBeNull();
	});
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

	it('предпочитает заголовок темы общей карточке Material', () => {
		document.body.innerHTML = `
			<div class="mat-mdc-card-title">Посторонняя карточка</div>
			<div class="v-label v-label-h2">Хирургия - 2024</div>
		`;
		expect(getTopicElement()?.textContent).toBe('Хирургия - 2024');
	});

	it('не принимает заголовок вопроса внутри questionAnchor за тему', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mat-mdc-card-title question-title-text">Машинное обучение</div>
			</div>
			<div class="v-label v-label-h2">Применение искусственного интеллекта</div>
		`;
		expect(getTopicElement()?.textContent).toBe('Применение искусственного интеллекта');
	});

	it('пропускает карточку с вложенным вопросом и проверяет следующий заголовок', () => {
		document.body.innerHTML = `
			<div class="mat-mdc-card-title">
				<div id="questionAnchor"><div class="question-title-text">Вопрос</div></div>
			</div>
			<div class="mat-mdc-card-title">Настоящая тема</div>
		`;
		expect(getTopicElement()?.textContent).toBe('Настоящая тема');
	});

	it('ищет тему внутри активной страницы теста', () => {
		document.body.innerHTML = `
			<div class="mat-card-title-quiz-custom">Другая страница</div>
			<lib-quiz-page>
				<div class="mat-mdc-card-title">Хирургия - 2024</div>
				<div id="questionAnchor"><div class="question-title-text">Вопрос</div></div>
			</lib-quiz-page>
		`;
		expect(getTopicElement()?.textContent).toBe('Хирургия - 2024');
	});

	it('не подставляет вопрос, когда заголовок темы отсутствует', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mat-mdc-card-title question-title-text">Вопрос</div>
			</div>
		`;
		expect(getTopicElement()).toBeNull();
	});

	it('пропускает пустой заголовок перед настоящей темой', () => {
		document.body.innerHTML = `
			<div class="mat-card-title-quiz-custom"> </div>
			<div class="mat-card-title-quiz-custom">Хирургия</div>
		`;
		expect(getTopicElement()?.textContent).toBe('Хирургия');
	});

	it('допускает одинаковый текст настоящей темы и вопроса', () => {
		document.body.innerHTML = `
			<div class="v-label v-label-h2">Машинное обучение</div>
			<div id="questionAnchor"><div class="question-title-text">Машинное обучение</div></div>
		`;
		expect(getTopicElement()?.textContent).toBe('Машинное обучение');
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

describe('fn findVariantElements', () => {
	it('находит варианты без известных классов и контейнера вопроса', () => {
		document.body.innerHTML = '<main><label id="a">A</label><label id="b">B</label></main>';

		expect(findVariantElements(['A', 'B'])).toEqual([
			document.getElementById('a'), document.getElementById('b'),
		]);
	});

	it('сохраняет порядок контекста и выбирает полный текст во вложенной разметке', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<label id="b">Вариант <b>B</b></label>
				<label><span id="a">Вариант A</span></label>
			</div>
		`;

		expect(findVariantElements(['Вариант A', 'Вариант B'])).toEqual([
			document.getElementById('a'), document.getElementById('b'),
		]);
	});

	it('сравнивает полный текст с учётом пробелов, переносов и регистра', () => {
		document.body.innerHTML = '<div id="questionAnchor"><p id="a">  Вариант&nbsp;\n A  </p><p>Вариант A и B</p></div>';

		expect(findVariantElements(['вариант A'])).toEqual([document.getElementById('a')]);
		expect(findVariantElements(['A'])).toEqual([null]);
	});

	it('не принимает совпадение снаружи активного вопроса', () => {
		document.body.innerHTML = '<p>A</p><div id="questionAnchor"><p id="a">A</p></div>';

		expect(findVariantElements(['A'])).toEqual([document.getElementById('a')]);
	});

	it('пропускает панель расширения, скрытые элементы и скрипты', () => {
		document.body.innerHTML = `
			<div id="nmo-panel"><span>A</span></div>
			<p hidden>A</p><div aria-hidden="true"><span>A</span></div>
			<script>A</script><style>/* A */</style><main><p id="a">A</p></main>
		`;
		let excludedTextReads = 0;
		for (const element of document.querySelectorAll('#nmo-panel, #nmo-panel *, [hidden], [aria-hidden="true"], [aria-hidden="true"] *, script, style')) {
			Object.defineProperty(element, 'innerText', {
				get() {
					excludedTextReads += 1;
					return element.textContent ?? '';
				},
			});
		}

		expect(findVariantElements(['A'])).toEqual([document.getElementById('a')]);
		expect(excludedTextReads).toBe(0);
	});

	it.each([
		'<section hidden><div id="questionAnchor"><div class="mdc-form-field"><span>A</span></div></div></section>',
		'<div id="questionAnchor"><div class="mdc-form-field"><span hidden>1. A</span></div></div>',
	])('не возвращает скрытый вариант даже через запасной селектор: %s', html => {
		document.body.innerHTML = html;

		expect(findVariantElements(['A'])).toEqual([null]);
	});

	it('возвращает разные элементы для одинаковых вариантов', () => {
		document.body.innerHTML = '<div id="questionAnchor"><label><span id="a1">A</span></label><label id="a2">A</label></div>';

		expect(findVariantElements(['A', 'A'])).toEqual([
			document.getElementById('a1'), document.getElementById('a2'),
		]);
	});

	it('предпочитает совпадение по тексту элементу из известного селектора', () => {
		document.body.innerHTML = '<div id="questionAnchor"><div class="mdc-form-field"><span>Другое</span></div><p id="a">A</p></div>';

		expect(findVariantElements(['A'])).toEqual([document.getElementById('a')]);
	});

	it('использует селекторы для ненайденного текста и сохраняет найденный элемент', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mdc-form-field"><span id="a">1. A</span></div>
				<div class="mdc-form-field"><span><b id="b">B</b></span></div>
			</div>
		`;

		expect(findVariantElements(['A', 'B'])).toEqual([
			document.getElementById('a'), document.getElementById('b'),
		]);
	});

	it('оставляет пропуски, чтобы индексы найденных вариантов не сдвигались', () => {
		document.body.innerHTML = '<div id="questionAnchor"><p id="b">B</p></div>';

		expect(findVariantElements(['A', 'B'])).toEqual([null, document.getElementById('b')]);
	});

	it('не использует fallback-элемент, который уже занят другим вариантом', () => {
		document.body.innerHTML = `
			<div id="questionAnchor">
				<div class="mdc-form-field"><span><b id="b">B</b></span></div>
				<div class="mdc-form-field"><span>Другое</span></div>
			</div>
		`;

		expect(findVariantElements(['A', 'B'])).toEqual([null, document.getElementById('b')]);
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
