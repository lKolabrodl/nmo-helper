import { describe, it, expect } from 'vitest';
import { extractCases, findAnswers, type QaCaseModel } from './cases';

/**
 * jsdom не поддерживает innerText, поэтому патчим через textContent
 * (то же самое, что и в parsers.test.ts).
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

describe('extractCases — 24forcare', () => {
	it('извлекает вопрос + variants + answers + idx из h3 + p > strong', () => {
		const div = createDiv(`
			<h3>Какой метод лечения?</h3>
			<p><strong>Лапароскопия</strong><br>Лапаротомия<br><strong>Торакотомия</strong></p>
		`);

		const cases = extractCases('24forcare', div);
		expect(cases).toHaveLength(1);

		const [c] = cases;
		expect(c.question).toBe('Какой метод лечения?');
		expect(c.variants).toEqual(['Лапароскопия', 'Лапаротомия', 'Торакотомия']);
		expect(c.answers).toEqual(['Лапароскопия', 'Торакотомия']);
		expect(c.idx).toBe(0);
	});

	it('возвращает пустой массив если нет вопросов', () => {
		const div = createDiv('<div>пусто</div>');
		expect(extractCases('24forcare', div)).toEqual([]);
	});
});

describe('extractCases — rosmedicinfo layout1 (h3 + span highlighted)', () => {
	it('извлекает правильные варианты по жёлтому фону', () => {
		const div = createDiv(`
			<h3>Вопрос о лечении</h3>
			<p><span style="background: #fbeeb8">Правильный ответ</span><br><span>Неправильный</span></p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question === 'Вопрос о лечении')!;

		expect(c).toBeDefined();
		expect(c.variants).toEqual(['Правильный ответ', 'Неправильный']);
		expect(c.answers).toEqual(['Правильный ответ']);
		expect(typeof c.idx).toBe('number');
	});
});

describe('extractCases — rosmedicinfo layout2 (p.MsoNormal + br + плюс)', () => {
	it('извлекает правильные варианты по `+`', () => {
		const div = createDiv(`
			<p class="MsoNormal"><b>1. Какой препарат?</b></p>
			<p class="MsoNormal">Аспирин+<br>Ибупрофен<br>Парацетамол+</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question === 'Какой препарат?')!;

		expect(c).toBeDefined();
		expect(c.variants).toEqual(['Аспирин', 'Ибупрофен', 'Парацетамол']);
		expect(c.answers).toEqual(['Аспирин', 'Парацетамол']);
		expect(typeof c.idx).toBe('number');
	});
});

describe('extractCases — idx уникален в пределах массива', () => {
	it('у разных вопросов idx не совпадают', () => {
		const div = createDiv(`
			<h3>Первый вопрос</h3>
			<p>1) a;<br><b>2) b;+</b></p>
			<h3>Второй вопрос</h3>
			<p>1) x;<br><b>2) y;+</b></p>
			<h3>Третий вопрос</h3>
			<p>1) m;<br><b>2) n;+</b></p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		expect(cases.length).toBeGreaterThanOrEqual(3);

		const idxs = cases.map(c => c.idx);
		expect(new Set(idxs).size).toBe(idxs.length);     // все уникальны
		expect(idxs).toEqual(idxs.map((_, i) => i));       // 0,1,2,...
	});
});

// ═══ findAnswers ══════════════════════════════════════════════════════════

/** Шорткат для сборки QaCase2 без ручной расстановки idx. */
const mkModel = (items: Array<Omit<QaCaseModel, 'idx'>>): QaCaseModel[] =>
	items.map((c, idx) => ({ ...c, idx }));

describe('findAnswers — базовый матчинг по вопросу', () => {

	it('точное совпадение вопроса — возвращает variants + answers case\'а', () => {
		const model = mkModel([
			{ question: 'Цель сестринского процесса', variants: ['a', 'b', 'c'], answers: ['c'] },
		]);

		const res = findAnswers(model, 'Цель сестринского процесса', ['a', 'b', 'c']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['c']);
		expect(res!.score).toBe(1);   // exact question + 100% variants overlap
	});

	it('регистронезависимый матч (нормализация к lowercase)', () => {
		const model = mkModel([
			{ question: 'ЦЕЛЬ СЕСТРИНСКОГО процесса', variants: ['a'], answers: ['a'] },
		]);

		const res = findAnswers(model, 'цель сестринского ПРОЦЕССА', ['a']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['a']);
	});

	it('матч через includes когда вход короче сохранённого вопроса', () => {
		const model = mkModel([
			{ question: 'Какие методы диагностики применяются при кардиомиопатии', variants: ['ЭхоКГ'], answers: ['ЭхоКГ'] },
		]);

		const res = findAnswers(model, 'методы диагностики применяются при кардиомиопатии', ['ЭхоКГ']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['ЭхоКГ']);
	});

	it('матч через includes когда вход длиннее (префикс «N.» из источника)', () => {
		const model = mkModel([
			{ question: '4. В патогенезе синдрома Рейно ключевую роль играет', variants: ['a'], answers: ['a'] },
		]);

		const res = findAnswers(model, 'В патогенезе синдрома Рейно ключевую роль играет', ['a']);
		expect(res).not.toBeNull();
	});

	it('нормализация пробелов (\\n, &nbsp;, табы схлопываются)', () => {
		const model = mkModel([
			{ question: 'Вопрос  с\nмножественными\t пробелами', variants: ['a'], answers: ['a'] },
		]);

		const res = findAnswers(model, 'Вопрос с множественными пробелами', ['a']);
		expect(res).not.toBeNull();
	});

	it('нормализация тире (em-dash → hyphen)', () => {
		const model = mkModel([
			{ question: 'АД — что это', variants: ['a'], answers: ['a'] },
		]);

		const res = findAnswers(model, 'АД - что это', ['a']);
		expect(res).not.toBeNull();
	});
});

describe('findAnswers — нет совпадений', () => {

	it('пустая модель → null', () => {
		expect(findAnswers([], 'любой вопрос', ['a'])).toBeNull();
	});

	it('ни один вопрос не похож → null', () => {
		const model = mkModel([
			{ question: 'Лечение гипертонии', variants: ['a'], answers: ['a'] },
			{ question: 'Диагностика инфаркта', variants: ['b'], answers: ['b'] },
		]);

		const res = findAnswers(model, 'Совсем другая тематика про эндокринологию', ['x']);
		expect(res).toBeNull();
	});

	it('similarity ниже SIMILARITY_THRESHOLD (0.85) → null', () => {
		const model = mkModel([
			{ question: 'Вопрос про кардиологию и лечение ИБС', variants: ['a'], answers: ['a'] },
		]);

		// общих биграмм мало, но тема совпадает
		const res = findAnswers(model, 'Диагностика пневмонии у детей', ['x']);
		expect(res).toBeNull();
	});
});

describe('findAnswers — fuzzy по Dice similarity (≥ 0.85)', () => {

	it('небольшая опечатка (одна буква) — матчится', () => {
		const model = mkModel([
			{ question: 'Морфологический субстрат ЛГ', variants: ['a'], answers: ['a'] },
		]);

		const res = findAnswers(model, 'Морфологичесий субстрат ЛГ', ['a']);   // «опечатка»
		expect(res).not.toBeNull();
	});
});

describe('findAnswers — фильтрация по variants при коллизии вопроса', () => {

	it('два case\'а с одинаковым вопросом — выбирает с максимальным overlap вариантов', () => {
		const model = mkModel([
			{ question: 'Какой препарат?', variants: ['aspirin', 'paracetamol'], answers: ['aspirin'] },
			{ question: 'Какой препарат?', variants: ['metformin', 'insulin'],  answers: ['insulin'] },
		]);

		// на странице показаны metformin/insulin → должен вернуть второй case
		const res = findAnswers(model, 'Какой препарат?', ['metformin', 'insulin']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['insulin']);
	});

	it('частичный overlap variants — побеждает тот, у кого совпадений больше', () => {
		const model = mkModel([
			{ question: 'Q', variants: ['a', 'b', 'c'],         answers: ['a'] },
			{ question: 'Q', variants: ['x', 'y', 'z'],         answers: ['z'] },
			{ question: 'Q', variants: ['a', 'b', 'different'], answers: ['b'] },
		]);

		const res = findAnswers(model, 'Q', ['a', 'b', 'c']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['a']);   // первый case — полный overlap, source-answer 'a' матчнул входной 'a'
	});

	it('overlap через includes (входной вариант — префикс сохранённого)', () => {
		const model = mkModel([
			{ question: 'Q', variants: ['совсем другие', 'варианты'],                                answers: ['другие'] },
			{ question: 'Q', variants: ['ремоделирование правого желудочка', 'другой полный текст'], answers: ['ремоделирование правого желудочка'] },
		]);

		// пользователь ввёл только часть — должен матчнуть второй, вернуть ВХОДНОЙ вариант
		const res = findAnswers(model, 'Q', ['ремоделирование правого']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['ремоделирование правого']);
	});

	it('ни один вариант не пересекается — выбирается кандидат с лучшим score по вопросу', () => {
		const model = mkModel([
			{ question: 'Длинный вопрос про медицину', variants: ['a'], answers: ['a'] },
			{ question: 'Длинный вопрос про медицину', variants: ['b'], answers: ['b'] },
		]);

		const res = findAnswers(model, 'Длинный вопрос про медицину', ['xxx']);
		expect(res).not.toBeNull();
		// кандидат выбрался, но ни один source-answer ('a', 'b') не нашёлся в input → answers пустой
		expect(res!.answers).toEqual([]);
		expect(res!.score).toBe(0);   // confidence = 0 потому что overlap = 0
	});
});

describe('findAnswers — confidence score', () => {

	it('exact question + полный variants overlap → score = 1', () => {
		const model = mkModel([{ question: 'Q full match', variants: ['a', 'b'], answers: ['a'] }]);
		const res = findAnswers(model, 'Q full match', ['a', 'b']);
		expect(res!.score).toBe(1);
	});

	it('exact question + пустой input variants → score = qScore (confidence = 1)', () => {
		const model = mkModel([{ question: 'Q', variants: ['a', 'b'], answers: ['a'] }]);
		const res = findAnswers(model, 'Q', []);
		expect(res!.score).toBeGreaterThan(0.9);
	});

	it('частичный variants overlap → score пропорционально понижается', () => {
		const model = mkModel([
			{ question: 'Q long enough for includes', variants: ['aaa', 'bbb', 'ccc'], answers: ['aaa'] },
		]);

		const resFull    = findAnswers(model, 'Q long enough for includes', ['aaa', 'bbb', 'ccc'])!;
		const resHalf    = findAnswers(model, 'Q long enough for includes', ['aaa', 'zzz'])!;
		const resNone    = findAnswers(model, 'Q long enough for includes', ['xxx', 'yyy'])!;

		expect(resFull.score).toBe(1);
		expect(resHalf.score).toBeCloseTo(0.5, 5);
		expect(resNone.score).toBe(0);
	});

	it('fuzzy question → score < 1', () => {
		const model = mkModel([{ question: 'Морфологический субстрат ЛГ', variants: ['a'], answers: ['a'] }]);
		const res = findAnswers(model, 'Морфологичесий субстрат ЛГ', ['a'])!;
		expect(res.score).toBeLessThan(1);
		expect(res.score).toBeGreaterThan(0);
	});
});

describe('findAnswers — устойчивость к шуму на коротких вариантах (регрессия)', () => {

	it('числовой вариант «3» не матчится к «3 стадии» через includes', () => {
		// до фикса: includes('3', '3 стадии') срабатывал и раздувал overlap
		const model = mkModel([
			{ question: 'Q', variants: ['3'],        answers: ['3'] },
			{ question: 'Q', variants: ['3 стадии'], answers: ['3 стадии'] },
		]);

		// пользователь ввёл «3 стадии» — должен матчнуть второй case, не первый (где только «3»)
		// если бы матчнулся первый case, answers был бы пустым (source-answer "3" не матчится в ['3 стадии'])
		const res = findAnswers(model, 'Q', ['3 стадии']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['3 стадии']);
	});

	it('однобуквенный вариант не раздувает overlap короткими подстроками', () => {
		const model = mkModel([
			{ question: 'Q long enough', variants: ['a'],                    answers: ['a'] },
			{ question: 'Q long enough', variants: ['полный длинный текст'], answers: ['полный длинный текст'] },
		]);

		const res = findAnswers(model, 'Q long enough', ['полный длинный текст']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['полный длинный текст']);
	});
});

describe('findAnswers — тай-брейкер по idx (стабильность)', () => {

	it('при равенстве overlap и qScore выигрывает меньший idx', () => {
		// Все 3 case'а: одинаковый вопрос, по одному варианту, разные ответы.
		// При входе [x,y,z] каждый case даст overlap=1 и qScore=1 → тай-брейкер по idx.
		const model: QaCaseModel[] = [
			{ question: 'Q long enough match', variants: ['x'], answers: ['x'], idx: 7 },
			{ question: 'Q long enough match', variants: ['y'], answers: ['y'], idx: 2 },
			{ question: 'Q long enough match', variants: ['z'], answers: ['z'], idx: 5 },
		];

		const res = findAnswers(model, 'Q long enough match', ['x', 'y', 'z']);
		expect(res).not.toBeNull();
		expect(res!.answers).toEqual(['y']);   // idx=2 выиграл → его source-answer 'y' нашёлся во входных
	});
});

describe('findAnswers — интеграция с extractCases (реальный HTML)', () => {

	it('находит вопрос в результатах extractCases по тексту', () => {
		const div = createDiv(`
			<h3>13. Морфологический субстрат ЛГ</h3>
			<p><span style="background-color:#fbeeb8;">1) ремоделирование правого желудочка; +</span> <br>2) гипертрофия и дилатация левого желудочка; <br>3) миокардит; <br>4) отек головного мозга; <br>5) увеличение селезенки.</p>
		`);

		const model = extractCases('rosmedicinfo', div);
		const userVariants = [
			'1) Ремоделирование правого желудочка',
			'2) Гипертрофия и дилатация левого желудочка',
			'3) Миокардит',
			'4) Отек головного мозга',
			'5) Увеличение селезенки',
		];
		const res = findAnswers(model, 'Морфологический субстрат ЛГ', userVariants);

		expect(res).not.toBeNull();
		expect(res!.answers).toHaveLength(1);
		expect(res!.answers[0]).toContain('Ремоделирование правого желудочка');   // возвращается ВХОДНАЯ версия
	});

	it('при дублях от разных extractor\'ов фильтр по variants даёт правильный case', () => {
		// Разметка со `span bg` И `+` одновременно — Highlighted и BrPlus дают дубль
		const div = createDiv(`
			<h3>Вопрос с двойной разметкой</h3>
			<p><span style="background-color:#fbeeb8;">1) правильный;+</span><br>2) неправильный;<br>3) тоже нет.</p>
		`);

		const model = extractCases('rosmedicinfo', div);
		// Должно быть как минимум 2 дубля с одинаковым question
		const sameQ = model.filter(c => c.question === 'Вопрос с двойной разметкой');
		expect(sameQ.length).toBeGreaterThanOrEqual(1);

		const res = findAnswers(model, 'Вопрос с двойной разметкой', ['1) правильный', '2) неправильный', '3) тоже нет']);
		expect(res).not.toBeNull();
		expect(res!.answers[0]).toContain('правильный');
	});
});


// ═════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════
//  ═══════════════════════════Баг РЕПОРТ═══════════════════════
// ═════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════

describe('баг репорт', () => {

	it('Большие языковые модели и генеративный искусственный интеллект', () => {
		const div = createDiv(`
			<h3>25. Роль агента "Критик" - это</h3>
			<p>1) агрегация данных; <br>2) разбор текста; <br><span style="background-color:#fbeeb8;">3) проверка логической согласованности, полноты и достоверности выводов, сформированных агентами Causal Reasoning Agent (CRA) и Retrieval-Augmented Generation Agent (RAG);</span> <br>4) формирование рекомендаций по лечению.</p>
		`);

		const model = extractCases('rosmedicinfo', div);

		const question = 'Роль агента «Критик» – это';
		
		const userVariants = [
			'агрегация данных',
			'проверка логической согласованности, полноты и достоверности выводов, сформированных агентами Causal Reasoning Agent (CRA) и Retrieval-Augmented Generation Agent (RAG)',
			'разбор текста',
			'формирование рекомендаций по лечению'
		];

		const res = findAnswers(model, question, userVariants);

		expect(res).not.toBeNull();
		expect(res?.answers).toHaveLength(1);
		expect(res?.answers?.[0]).toContain('проверка логической согласованности, полноты и достоверности выводов, сформированных агентами Causal Reasoning Agent (CRA) и Retrieval-Augmented Generation Agent (RAG)');
	});

	it('Мукополисахаридоз тип II у детей (по утвержденным клиническим рекомендациям) - 2025', () => {
		const div = createDiv(`
			<h3>18. Для верификации состояния когнитивного/интеллектуального развития детей с мукополисахаридозом II типа в случае нарушения слуха используется</h3>
			<p><span style="background-color:#fbeeb8;">1) "Лейтер-3 - Международные шкалы продуктивности"; +</span> <br>2) "Шкала Стэнфорд-Бине"; <br>3) "Шкала интеллекта для детей Векслера"; <br>4) "Шкала развития М. Палмер".</p>
		`);

		const model = extractCases('rosmedicinfo', div);

		const question = 'Для верификации состояния когнитивного/интеллектуального развития детей с мукополисахаридозом II типа в случае нарушения слуха используется';

		const userVariants = [
			'«Шкала интеллекта для детей Векслера»',
			'«Лейтер-3 – Международные шкалы продуктивности»',
			'«Шкала развития М. Палмер»',
			'«Шкала Стэнфорд-Бине»'
		];

		const res = findAnswers(model, question, userVariants);

		expect(res).not.toBeNull();
		expect(res?.answers).toHaveLength(1);
		expect(res?.answers?.[0]).toContain('«Лейтер-3 – Международные шкалы продуктивности»');
	});

	it('#1 нумерованный per-paragraph вопрос с последним вариантом правильным', () => {
		const div = createDiv(`
			<p class="MsoNormal" style="margin-bottom:0cm;"><b><span style="font-family:Arial, Helvetica, sans-serif;font-size:14px;">1. Цель сестринского процесса</span></b></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;">1)<span style="line-height:normal;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
			</span>обследование пациента</span></span></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;">2)<span style="line-height:normal;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
			</span>оценка качества ухода</span></span></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;">3)<span style="line-height:normal;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
			</span>активное сотрудничество с пациентом</span></span></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;">4)<span style="line-height:normal;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
			</span><b>обеспечение приемлемого качества жизни в	болезни+</b></span></span></p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question === 'Цель сестринского процесса')!;

		expect(c).toBeDefined();
		expect(c.variants.length).toBe(4);
		expect(c.answers).toHaveLength(1);
		expect(c.answers[0]).toContain('обеспечение приемлемого качества жизни в болезни');
		expect(typeof c.idx).toBe('number');
	});

	it('#2 нумерованный inline-br вопрос с одним правильным', () => {
		const div = createDiv(`
			<p><b>14. Выбор «укладки» пациента на операционный стол (на животе или на спине) при перкутанной нефролитотрипсии зависит от</b></p>
			<p>1) пола и возраста пациента;<br><b>2) предпочтений хирурга и соматического статуса пациента;+</b><br>3) размеров камней и количества доступов;<br>4) стороны оперируемой почки.</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x =>
			x.question === 'Выбор «укладки» пациента на операционный стол (на животе или на спине) при перкутанной нефролитотрипсии зависит от',
		)!;

		expect(c).toBeDefined();
		expect(c.variants).toHaveLength(4);
		expect(c.answers).toEqual(['предпочтений хирурга и соматического статуса пациента']);
		expect(typeof c.idx).toBe('number');
	});

	it('#3 h3 + p с двумя правильными через `+`', () => {
		const div = createDiv(`
			<h3>4. В патогенезе синдрома Рейно ключевую роль играет</h3>
			<p>1) повышение липопротеинов высокой плотности в крови;<br>2) разветвленная периферическая сосудистая сеть;<br><b>3) дисбаланс между вазодилататорами и вазоконстрикторами;+</b><br>4) выделение биологически активных веществ надпочечниками.</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question.includes('В патогенезе синдрома Рейно'))!;

		expect(c).toBeDefined();
		expect(c.variants).toHaveLength(4);
		expect(c.answers).toHaveLength(1);
		expect(c.answers[0]).toContain('дисбаланс между вазодилататорами и вазоконстрикторами');
		expect(typeof c.idx).toBe('number');
	});

	it('#5 per-paragraph, короткие варианты-числа', () => {
		const div = createDiv(`
			<p class="MsoNormal"><b>3. Количество стадий эфирного наркоза по Гведелу</b></p>
			<p class="MsoNormal">1) 3</p>
			<p class="MsoNormal">2) 2</p>
			<p class="MsoNormal"><b>3) </b><b>4 +</b></p>
			<p class="MsoNormal">4) 1</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question === 'Количество стадий эфирного наркоза по Гведелу')!;

		expect(c).toBeDefined();
		expect(c.variants).toEqual(['3', '2', '4', '1']);
		expect(c.answers).toEqual(['4']);
		expect(typeof c.idx).toBe('number');
	});

	it('#6 h3 + p с одним правильным через `+`', () => {
		const div = createDiv(`
			<p><b>2. В системе самоконтроля АККОРД буква «Р» означает&nbsp;</b></p>
			<p>1) радиус;<br>2) результат;<br><b>3) размер; +&nbsp;</b><br>4) расстояние.</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question.includes('В системе самоконтроля АККОРД'))!;

		expect(c).toBeDefined();
		expect(c.variants).toHaveLength(4);
		expect(c.answers).toHaveLength(1);
		expect(c.answers[0]).toContain('размер');
		expect(typeof c.idx).toBe('number');
	});

	it('#7 h3 + highlighted span (одно правильное)', () => {
		const div = createDiv(`
			<h3>3. Взрослым пациентам с мозолями и омозолелостями физические методы деструктивной терапии рекомендуются проводить с предварительной</h3>
			<p>1) эпидуральной анестезией; <br>2) проводниковой анестезией; <br>3) аппликационной анестезией; <br><span style="background-color:#fbeeb8;">4) местной инфильтративной анестезией кожи.+</span></p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question.includes('мозолями'))!;

		expect(c).toBeDefined();
		expect(c.variants).toHaveLength(4);
		expect(c.answers).toHaveLength(1);
		expect(c.answers[0]).toContain('местной инфильтративной анестезией кожи');
		expect(typeof c.idx).toBe('number');
	});

	it('#9 h3 + highlighted span среди 5 вариантов', () => {
		const div = createDiv(`
			<h3>13. Морфологический субстрат ЛГ</h3>
			<p><span style="background-color:#fbeeb8;">1) ремоделирование правого желудочка; +</span> <br>2) гипертрофия и дилатация левого желудочка; <br>3) миокардит; <br>4) отек головного мозга; <br>5) увеличение селезенки.</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question.includes('Морфологический субстрат ЛГ'))!;

		expect(c).toBeDefined();
		expect(c.variants).toHaveLength(5);
		expect(c.answers).toHaveLength(1);
		expect(c.answers[0]).toContain('ремоделирование правого желудочка');
		expect(typeof c.idx).toBe('number');
	});

	it('#11 h3 + highlighted (два правильных подряд)', () => {
		const div = createDiv(`
			<h3>2. Абсолютные противопоказания к двусторонней тонзиллэктомии включают</h3>
			<p><span style="background-color:#fbeeb8;">1) болезни крови (гемофилия, лейкозы, геморрагические диатезы); </span> <br><span style="background-color:#fbeeb8;">2) наличие аномальных сосудов в глотке (пульсация боковой стенки глотки); </span> <br>3) наличие всех видов декомпенсации хронического тонзиллита, кроме рецидивов острого тонзиллита (ангин); <br>4) наличие декомпенсации хронического тонзиллита в виде рецидивов острого тонзиллита (ангин); <br>5) наличие неэффективности повторных (2-3 раза в год) тщательно проведенных курсов консервативного лечения у больных хронического тонзиллита простой формы.</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question.includes('тонзиллэктомии'))!;

		expect(c).toBeDefined();
		expect(c.variants).toHaveLength(5);
		expect(c.answers).toHaveLength(2);
		expect(c.answers[0]).toContain('болезни крови');
		expect(c.answers[1]).toContain('наличие аномальных сосудов в глотке');
		expect(typeof c.idx).toBe('number');
	});

	it('#12 нумерованный inline-br, два правильных через `+`', () => {
		const div = createDiv(`
			<p><b>2. В каких клинических ситуациях выполнения аспирационной биопсии костного мозга при иммунной тромбоцитопении (ИТП) является обязательным?</b></p>
			<p><b>1) возраст более 60 лет для исключения МДС и лейкозов;+</b><br><b>2) отсутствие ответа на стандартную терапию в течение 6 мес.;+</b><br>3) повышение лейкоцитов периферической крови &gt; 15,0 х 109/л на терапии глюкокортикостероидами;<br>4) уровень тромбоцитов 30,0-50,0 х 109/л на фоне терапии.</p>
		`);

		const cases = extractCases('rosmedicinfo', div);
		const c = cases.find(x => x.question.includes('аспирационной биопсии'))!;

		expect(c).toBeDefined();
		expect(c.variants).toHaveLength(4);
		expect(c.answers).toHaveLength(2);
		expect(c.answers[0]).toContain('возраст более 60 лет');
		expect(c.answers[1]).toContain('отсутствие ответа на стандартную терапию');
		expect(typeof c.idx).toBe('number');
	});
});
