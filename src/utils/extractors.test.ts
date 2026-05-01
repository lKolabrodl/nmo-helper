import { describe, it, expect } from 'vitest';
import {
	extract24forcare,
	extract24forcareNumberedPPlus,
	extractRosmedH3Highlighted,
	extractRosmedH3BrPlus,
	extractRosmedNumberedPInlineBr,
	extractRosmedNumberedPPerParagraph,
	extractRosmedFlatBr,
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

describe('extract24forcare', () => {
	it('находит вопрос + strong-варианты', () => {
		const div = createDiv(`
			<h3>Вопрос?</h3>
			<p>первый<br><strong>второй</strong><br>третий</p>
		`);
		const out = extract24forcare(div);
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
		const [c] = extract24forcare(div);
		expect(c.answers).toEqual(['a', 'c']);
	});

	it('пустой h3 игнорируется', () => {
		const div = createDiv(`
			<h3></h3>
			<p><strong>a</strong></p>
		`);
		expect(extract24forcare(div)).toEqual([]);
	});

	it('пропускает h3 если следующий sibling не <p>', () => {
		const div = createDiv(`
			<h3>Q1</h3>
			<div><strong>a</strong></div>
		`);
		expect(extract24forcare(div)).toEqual([]);
	});

	it('пропускает case без правильных (нет <strong>)', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>первый<br>второй</p>
		`);
		expect(extract24forcare(div)).toEqual([]);
	});

	it('несколько вопросов подряд — по одному case на каждый', () => {
		const div = createDiv(`
			<h3>Q1</h3>
			<p>a<br><strong>b</strong></p>
			<h3>Q2</h3>
			<p><strong>x</strong><br>y</p>
		`);
		const out = extract24forcare(div);
		expect(out).toHaveLength(2);
		expect(out[0].question).toBe('Q1');
		expect(out[1].question).toBe('Q2');
	});

	it('пустой div → []', () => {
		expect(extract24forcare(createDiv(''))).toEqual([]);
	});
});

describe('extract24forcareNumberedPPlus', () => {
	it('находит «N. вопрос» в <strong> + варианты с `+` в следующем <p>', () => {
		const div = createDiv(`
			<p><strong>1. Вопрос?</strong></p>
			<p><strong>1) первый;+</strong><br>2) второй;<br>3) третий.</p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.question).toBe('Вопрос?');
		expect(c.variants).toEqual(['первый', 'второй', 'третий']);
		expect(c.answers).toEqual(['первый']);
	});

	it('несколько правильных через `+`', () => {
		const div = createDiv(`
			<p><strong>2. Q</strong></p>
			<p><strong>1) a;+</strong><br>2) b;<br><strong>3) c;+</strong></p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.answers).toEqual(['a', 'c']);
	});

	it('правильный вариант не в <strong> — детектится по `+` в тексте', () => {
		const div = createDiv(`
			<p><strong>3. Q</strong></p>
			<p>1) a;<br>2) b;+<br>3) c.</p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.answers).toEqual(['b']);
	});

	it('снимает префикс «N. » у вопроса', () => {
		const div = createDiv(`
			<p><strong>7. Лечение ИБС</strong></p>
			<p>1) a<br>2) b+</p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.question).toBe('Лечение ИБС');
	});

	it('пропускает когда в следующем <p> нет <br>', () => {
		const div = createDiv(`
			<p><strong>1. Q</strong></p>
			<p>один вариант</p>
		`);
		expect(extract24forcareNumberedPPlus(div)).toEqual([]);
	});

	it('игнорирует <p><strong> без нумерации в начале', () => {
		const div = createDiv(`
			<p><strong>Просто заголовок без номера</strong></p>
			<p>a<br>b+</p>
		`);
		expect(extract24forcareNumberedPPlus(div)).toEqual([]);
	});

	it('несколько вопросов подряд (включая пустые <p> между)', () => {
		const div = createDiv(`
			<p><strong>1. Q1</strong></p>
			<p>1) a;<br>2) b;+</p>
			<p></p>
			<p><strong>2. Q2</strong></p>
			<p>1) x;+<br>2) y;</p>
		`);
		const out = extract24forcareNumberedPPlus(div);
		expect(out).toHaveLength(2);
		expect(out[0].question).toBe('Q1');
		expect(out[0].answers).toEqual(['b']);
		expect(out[1].question).toBe('Q2');
		expect(out[1].answers).toEqual(['x']);
	});

	it('пустой div → []', () => {
		expect(extract24forcareNumberedPPlus(createDiv(''))).toEqual([]);
	});

	it('двузначный номер вопроса', () => {
		const div = createDiv(`
			<p><strong>14. Лечение дискогенной компрессии корешков конского хвоста:</strong></p>
			<p>1) антидепрессанты;<br>2) вытяжение позвоночника;<br>3) мануальная терапия;<br>4) рефлексотерапия;<br><strong>5) хирургическое лечение.+</strong></p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.question).toBe('Лечение дискогенной компрессии корешков конского хвоста:');
		expect(c.variants).toEqual([
			'антидепрессанты',
			'вытяжение позвоночника',
			'мануальная терапия',
			'рефлексотерапия',
			'хирургическое лечение',
		]);
		expect(c.answers).toEqual(['хирургическое лечение']);
	});

	it('атрибуты/классы на <strong> не мешают (correct-answer-highlight)', () => {
		const div = createDiv(`
			<p><strong>1. Q</strong></p>
			<p>1) a;<br>2) b;<br><strong class="correct-answer-highlight">3) 15 мм;+</strong><br>4) c.</p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.answers).toEqual(['15 мм']);
	});

	it('хвостовые `;`, `.`, ведущий `N)` снимаются cleanAnswer', () => {
		const div = createDiv(`
			<p><strong>1. Q</strong></p>
			<p>1) первый вариант;<br>2) второй.<br><strong>3) третий;+</strong></p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.variants).toEqual(['первый вариант', 'второй', 'третий']);
		expect(c.answers).toEqual(['третий']);
	});

	it('подряд несколько <br> игнорируется (пустые строки выкидываются)', () => {
		const div = createDiv(`
			<p><strong>1. Q</strong></p>
			<p>1) a;<br><br><br><strong>2) b;+</strong><br><br>3) c.</p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.variants).toEqual(['a', 'b', 'c']);
		expect(c.answers).toEqual(['b']);
	});

	it('читает номер прямо из <p> если нет <strong>/<b> (fallback на innerText)', () => {
		const div = createDiv(`
			<p>3. Вопрос без обёртки</p>
			<p>1) a;<br>2) b;+</p>
		`);
		const [c] = extract24forcareNumberedPPlus(div);
		expect(c.question).toBe('Вопрос без обёртки');
		expect(c.answers).toEqual(['b']);
	});

	it('реальный фрагмент со страницы 24forcare (5 вопросов разных форм)', () => {
		const div = createDiv(`
			<p><strong>1. Абсолютный стеноз позвоночного канала устанавливается при уменьшении расстояния от задней поверхности тела позвонка до ближайшей противоположной точки на дужке у основания остистого отростка менее:</strong></p>
			<p><strong>1) 10 мм;+</strong><br>2) 12 мм;<br>3) 15 мм;<br>4) 17 мм;<br>5) 8 мм.</p>
			<p><strong>2. Аномалии развития шейного отдела позвоночника:</strong></p>
			<p><strong>1) полный вариант аномалии Киммерли;+</strong><br>2) синдром Байуотерса;<br><strong>3) синдром Клиппеля-Фейля;+</strong><br>4) синдром Мак-Кэрри;<br>5) синдром Марфана.</p>
			<p><strong>3. Воронка Шеррингтона включает:</strong></p>
			<p>1) вегетативная система;<br><strong>2) мозжечок;+</strong><br>3) передний спиномозжечковый путь;<br>4) руброспинальный путь;<br><strong>5) экстрапирамидная система.+</strong></p>
			<p><strong>7. Дорсалгия считается хронической при течении заболевания:</strong></p>
			<p>1) cвыше 1 года;<br>2) cвыше 2 недель;<br><strong>3) cвыше 3 месяцев;+</strong><br>4) cвыше 5 дней.</p>
			<p><strong>14. Лечение дискогенной компрессии корешков конского хвоста:</strong></p>
			<p>1) антидепрессанты;<br>2) вытяжение позвоночника;<br>3) мануальная терапия;<br>4) рефлексотерапия;<br><strong>5) хирургическое лечение.+</strong></p>
		`);
		const out = extract24forcareNumberedPPlus(div);
		expect(out).toHaveLength(5);

		// 1: первый правильный
		expect(out[0].variants).toEqual(['10 мм', '12 мм', '15 мм', '17 мм', '8 мм']);
		expect(out[0].answers).toEqual(['10 мм']);

		// 2: первый и третий правильные
		expect(out[1].answers).toEqual([
			'полный вариант аномалии Киммерли',
			'синдром Клиппеля-Фейля',
		]);

		// 3: второй и пятый правильные
		expect(out[2].answers).toEqual(['мозжечок', 'экстрапирамидная система']);

		// 7: третий правильный
		expect(out[3].question).toBe('Дорсалгия считается хронической при течении заболевания:');
		expect(out[3].answers).toEqual(['cвыше 3 месяцев']);

		// 14: пятый (последний) правильный
		expect(out[4].answers).toEqual(['хирургическое лечение']);
	});

	it('старая h3-разметка 24forcare не подхватывается (нет нумерованных <p>)', () => {
		const div = createDiv(`
			<h3>Какой метод лечения?</h3>
			<p><strong>Лапароскопия</strong><br>Лапаротомия</p>
		`);
		expect(extract24forcareNumberedPPlus(div)).toEqual([]);
	});
});

describe('extractRosmedH3Highlighted', () => {
	it('ловит fbeeb8 в style', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><span style="background-color:#fbeeb8;">правильный</span><br>неправильный</p>
		`);
		const [c] = extractRosmedH3Highlighted(div);
		expect(c.answers).toEqual(['правильный']);
		expect(c.variants).toEqual(['правильный', 'неправильный']);
	});

	it('ловит любое `background` в style (не только fbeeb8)', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><span style="background: yellow">правильный</span><br>нет</p>
		`);
		const [c] = extractRosmedH3Highlighted(div);
		expect(c.answers).toEqual(['правильный']);
	});

	it('case-insensitive по атрибуту style', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><span STYLE="BACKGROUND: #FBEEB8">правильный</span><br>нет</p>
		`);
		const [c] = extractRosmedH3Highlighted(div);
		expect(c.answers).toEqual(['правильный']);
	});

	it('нет подсветки → case без ответов отбрасывается', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>a<br>b</p>
		`);
		expect(extractRosmedH3Highlighted(div)).toEqual([]);
	});

	it('пропускает h3 без последующего <p>', () => {
		const div = createDiv(`<h3>Q</h3><div>x</div>`);
		expect(extractRosmedH3Highlighted(div)).toEqual([]);
	});
});

describe('extractRosmedH3BrPlus', () => {
	it('ловит варианты с `+`, снимает плюс из текста', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>первый<br>второй+<br>третий</p>
		`);
		const [c] = extractRosmedH3BrPlus(div);
		expect(c.variants).toEqual(['первый', 'второй', 'третий']);
		expect(c.answers).toEqual(['второй']);
	});

	it('несколько правильных через `+`', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>a+<br>b<br>c+</p>
		`);
		const [c] = extractRosmedH3BrPlus(div);
		expect(c.answers).toEqual(['a', 'c']);
	});

	it('нет `+` нигде → case без ответов отбрасывается', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p>a<br>b</p>
		`);
		expect(extractRosmedH3BrPlus(div)).toEqual([]);
	});
});

describe('extractRosmedNumberedPInlineBr', () => {
	it('находит «N. вопрос» + инлайн-<br> варианты с `+`', () => {
		const div = createDiv(`
			<p><b>12. Вопрос?</b></p>
			<p>1) первый<br>2) второй+<br>3) третий</p>
		`);
		const [c] = extractRosmedNumberedPInlineBr(div);
		expect(c.question).toBe('Вопрос?');
		expect(c.variants).toEqual(['первый', 'второй', 'третий']);
		expect(c.answers).toEqual(['второй']);
	});

	it('снимает префикс «N. » у вопроса', () => {
		const div = createDiv(`
			<p><b>7. Лечение ИБС</b></p>
			<p>1) a<br>2) b+</p>
		`);
		const [c] = extractRosmedNumberedPInlineBr(div);
		expect(c.question).toBe('Лечение ИБС');
	});

	it('пропускает когда в следующем <p> нет <br>', () => {
		const div = createDiv(`
			<p><b>1. Q</b></p>
			<p>один вариант</p>
		`);
		expect(extractRosmedNumberedPInlineBr(div)).toEqual([]);
	});

	it('игнорирует <p> без нумерации в начале', () => {
		const div = createDiv(`
			<p><b>Просто текст без номера</b></p>
			<p>a<br>b+</p>
		`);
		expect(extractRosmedNumberedPInlineBr(div)).toEqual([]);
	});

	it('читает номер прямо из <p> если нет <b>', () => {
		const div = createDiv(`
			<p>3. Вопрос</p>
			<p>a<br>b+</p>
		`);
		const [c] = extractRosmedNumberedPInlineBr(div);
		expect(c.question).toBe('Вопрос');
	});
});

describe('extractRosmedNumberedPPerParagraph', () => {
	it('находит вопрос + серию <p> с нумерованными вариантами', () => {
		const div = createDiv(`
			<p><b>5. Препарат?</b></p>
			<p>1) аспирин</p>
			<p>2) парацетамол+</p>
			<p>3) ибупрофен</p>
		`);
		const [c] = extractRosmedNumberedPPerParagraph(div);
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
		const out = extractRosmedNumberedPPerParagraph(div);
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
		const [c] = extractRosmedNumberedPPerParagraph(div);
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
		const [c] = extractRosmedNumberedPPerParagraph(div);
		expect(c.variants).toEqual(['a', 'b']);
	});

	it('пустой div → []', () => {
		expect(extractRosmedNumberedPPerParagraph(createDiv(''))).toEqual([]);
	});
});

describe('extractRosmedFlatBr', () => {
	it('находит вопрос + варианты в плоской <br>-раскладке', () => {
		const div = createDiv(`
			<b>1. Вопрос?</b><br>
			1) первый<br>
			<b>2) второй;+</b><br>
			3) третий
		`);
		const out = extractRosmedFlatBr(div);
		expect(out).toHaveLength(1);
		expect(out[0].question).toBe('Вопрос?');
		expect(out[0].variants).toEqual(['первый', 'второй', 'третий']);
		expect(out[0].answers).toEqual(['второй']);
	});

	it('детектит правильный по <b>, по «+», и по <strong>', () => {
		const div = createDiv(`
			<b>1. Q</b><br>
			1) a;+<br>
			<b>2) b</b><br>
			<strong>3) c</strong><br>
			4) d
		`);
		const [c] = extractRosmedFlatBr(div);
		expect(c.answers).toEqual(['a', 'b', 'c']);
	});

	it('несколько вопросов в одном контейнере, разделены <br>', () => {
		const div = createDiv(`
			<b>1. Первый?</b><br>
			1) a<br>
			<b>2) b;+</b><br>
			<br>
			<b>2. Второй?</b><br>
			1) x;+<br>
			2) y
		`);
		const out = extractRosmedFlatBr(div);
		expect(out).toHaveLength(2);
		expect(out[0].question).toBe('Первый?');
		expect(out[0].answers).toEqual(['b']);
		expect(out[1].question).toBe('Второй?');
		expect(out[1].answers).toEqual(['x']);
	});

	it('склеивает кейс, разорванный между <p> через «</p>» → <br>', () => {
		// Реальная раскладка с rosmedicinfo: последний вопрос на странице
		// часто разносится по нескольким <p> (артефакт CMS).
		const div = createDiv(`
			<p><b>1. Вопрос?</b></p>
			<p>1) первый;<br><b>2) второй;+</b><br><b>3) третий;+</b></p>
			<p><b>4) четвёртый;+</b></p>
		`);
		const [c] = extractRosmedFlatBr(div);
		expect(c.question).toBe('Вопрос?');
		expect(c.variants).toEqual(['первый', 'второй', 'третий', 'четвёртый']);
		expect(c.answers).toEqual(['второй', 'третий', 'четвёртый']);
	});

	it('реальная раскладка rosmedicinfo: один <p> с вложенными <span>', () => {
		// Один <p class="MsoNormal"> со вложенными <span> для шрифта/размера,
		// все вопросы и варианты разделены <br>. Сжатая версия настоящей
		// страницы «Переломы диафиза костей предплечья».
		const div = createDiv(`
			<p class="MsoNormal" style="margin-bottom:0cm;">
				<b><span style="font-family:Arial;font-size:14px;">1. Большие операции</span></b>
				<span style="font-size:14px;"><span style="font-family:Arial;"><br>
				1) менее 1%;<br>
				2) менее 10%;<br>
				<b>3) 1-5%;+</b><br>
				4) 5-10%.<br>
				<br>
				<b>2. В результате</b><br>
				<b>1) к достижению;+</b><br>
				2) к костному;<br>
				<b>3) к прямому;+</b><br>
				4) к относительной.<br>
				</span></span>
			</p>
		`);
		const out = extractRosmedFlatBr(div);
		expect(out).toHaveLength(2);
		expect(out[0].question).toBe('Большие операции');
		expect(out[0].variants).toEqual(['менее 1%', 'менее 10%', '1-5%', '5-10%']);
		expect(out[0].answers).toEqual(['1-5%']);
		expect(out[1].question).toBe('В результате');
		expect(out[1].answers).toEqual(['к достижению', 'к прямому']);
	});

	it('игнорирует не-нумерованные строки между вариантами', () => {
		const div = createDiv(`
			<b>1. Q</b><br>
			какой-то комментарий без нумерации<br>
			1) a<br>
			ещё текст<br>
			<b>2) b;+</b>
		`);
		const [c] = extractRosmedFlatBr(div);
		expect(c.variants).toEqual(['a', 'b']);
		expect(c.answers).toEqual(['b']);
	});

	it('возвращает [] если у вопроса нет правильных вариантов', () => {
		const div = createDiv(`
			<b>1. Q</b><br>
			1) a<br>
			2) b<br>
			3) c
		`);
		expect(extractRosmedFlatBr(div)).toEqual([]);
	});

	it('игнорирует <b> без префикса «N. »', () => {
		const div = createDiv(`
			<b>Заголовок без номера</b><br>
			1) a;+<br>
			2) b
		`);
		expect(extractRosmedFlatBr(div)).toEqual([]);
	});

	it('игнорирует «N.» без обёртки <b>/<strong>', () => {
		// Простой текст «1. ...» без <b> — это не вопрос, а часть варианта.
		const div = createDiv(`
			1. Какой-то текст<br>
			1) a;+<br>
			2) b
		`);
		expect(extractRosmedFlatBr(div)).toEqual([]);
	});

	it('пустой div → []', () => {
		expect(extractRosmedFlatBr(createDiv(''))).toEqual([]);
	});

	it('много правильных вариантов в одном вопросе', () => {
		const div = createDiv(`
			<b>1. Делятся на</b><br>
			<b>1) клиновидные;+</b><br>
			<b>2) простые;+</b><br>
			<b>3) многооскольчатые;+</b><br>
			4) иррегулярные.
		`);
		const [c] = extractRosmedFlatBr(div);
		expect(c.answers).toEqual(['клиновидные', 'простые', 'многооскольчатые']);
	});

	it('многострочный текст варианта внутри <b> схлопывает пробелы через cleanAnswer', () => {
		const div = createDiv(`
			<b>1. Q</b><br>
			<b>1) длинный ответ
			с переносом
			строки;+</b><br>
			2) короткий
		`);
		const [c] = extractRosmedFlatBr(div);
		expect(c.answers).toEqual(['длинный ответ с переносом строки']);
	});
});

describe('extractors — общие свойства', () => {
	it('все пропускают сигнал пустой строки (нет вариантов)', () => {
		const div = createDiv(`<h3>Q</h3><p></p>`);
		expect(extract24forcare(div)).toEqual([]);
		expect(extractRosmedH3Highlighted(div)).toEqual([]);
		expect(extractRosmedH3BrPlus(div)).toEqual([]);
	});

	it('cleanAnswer применяется к вариантам (пробелы/хвостовой `.`)', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><strong>  первый  </strong><br>второй.<br>третий;</p>
		`);
		const [c] = extract24forcare(div);
		expect(c.variants).toEqual(['первый', 'второй', 'третий']);
	});

	it('cleanAnswer снимает ведущую нумерацию «N) »', () => {
		const div = createDiv(`
			<h3>Q</h3>
			<p><strong>1) первый</strong><br>2) второй</p>
		`);
		const [c] = extract24forcare(div);
		expect(c.variants).toEqual(['первый', 'второй']);
	});
});
