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

	it('#1 реальный пример', () => {

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
			<p class="MsoNormal" style="margin-bottom:0cm;"></p>
			<p>&nbsp;</p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Цель сестринского процесса');
		expect(answers).toContain('обеспечение приемлемого качества жизни в болезни');
	});

	it('#2 реальный пример', () => {

		const div = createDiv(`
			<p style="margin-top:0cm;margin-right:0cm;margin-bottom:8pt;margin-left:0cm;font-size:15px;font-family:Calibri, sans-serif;"><span style="font-size:14px;"><span style="font-family:Georgia, serif;"><b>14. Выбор «укладки» пациента на операционный стол (на животе или на спине) при перкутанной нефролитотрипсии зависит от</b></span></span></p>
			<p style="margin-top:0cm;margin-right:0cm;margin-bottom:8pt;margin-left:0cm;font-size:15px;font-family:Calibri, sans-serif;"><span style="font-size:14px;"><span style="font-family:Georgia, serif;">1) пола и возраста пациента;<br><b>2) предпочтений хирурга и соматического статуса пациента;+</b><br>3) размеров камней и количества доступов;<br>4) стороны оперируемой почки.</span></span></p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Выбор «укладки» пациента на операционный стол (на животе или на спине) при перкутанной нефролитотрипсии зависит от');
		expect(answers).toContain('предпочтений хирурга и соматического статуса пациента');
	});

	it('#3 реальный пример', () => {

		const div = createDiv(`
		<p>1) выведение токсических продуктов обмена;<br>2) дэзактивизация деятельности ретикулоэндотелиальной системы;<br><b>3) усиленное выделение вазоактивных веществ, изменяющих просветы сосудов;+<br>4) угнетение симпатического звена вегетативной нервной системы.+</b></p>
		<p><br></p>
		<h3>4. В патогенезе синдрома Рейно ключевую роль играет</h3>
		<p>1) повышение липопротеинов высокой плотности в крови;<br>2) разветвленная периферическая сосудистая сеть;<br><b>3) дисбаланс между вазодилататорами и вазоконстрикторами;+</b><br>4) выделение биологически активных веществ надпочечниками.</p>
		<p><br></p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('В патогенезе синдрома Рейно ключевую роль играет');
		expect(answers).toContain('дисбаланс между вазодилататорами и вазоконстрикторами');
	});

	it('#4 реальный пример', () => {

		const div = createDiv(`
			<p class="MsoNormal" style="margin-bottom:0cm;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;"><b>&nbsp;</b></span></span></p>
			<p class="MsoNormal" style="margin-bottom:0cm;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;"><b>2. К медсестре обратился
			пациент, у него <a href="http://rosmedicinfo.ru/disease/hypertension/344-gipertonicheskaya-bolezn-klassifikaciya-simptomy-diagnostika-lechenie.html">гипертоническая болезнь</a>. Привычные цифры для него 160/100 мм
			рт.ст. Медсестра заподозрила шок и измерила давление. Результаты: 120/80 мм
			рт.ст. Стоит ли беспокоиться?</b></span></span></p>
			<p class="MsoNormal" style="margin-bottom:0cm;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;"><b>1) Да, систолическое АД
			снизилось на 40 мм рт.ст. ниже привычных цифр;+</b><br>
			2) Нет, давление может быть разным. Это нормально.</span></span></p>
			<p class="MsoNormal" style="margin-bottom:0cm;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;"><b>&nbsp;</b></span></span></p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('К медсестре обратился пациент, у него гипертоническая болезнь Привычные цифры для него 160/100 мм\n			рт.ст. Медсестра заподозрила шок и измерила давление. Результаты: 120/80 мм\n			рт.ст. Стоит ли беспокоиться?');
		expect(answers).toContain('Да, систолическое АД снизилось на 40 мм рт.ст. ниже привычных цифр');
	});

	it('#5 реальный пример', () => {

		const div = createDiv(`
			<p class="MsoNormal" style="margin-bottom:0cm;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;"><b>3. Количество стадий эфирного наркоза по
			Гведелу</b></span></span></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;">1) 3</span></span></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;">2) 2</span></span></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;"><b>3) </b><b>4 +</b></span></span></p>
			<p class="MsoNormal" style="margin-top:0cm;margin-right:0cm;margin-bottom:0cm;margin-left:36pt;text-indent:-18pt;"><span style="font-size:14px;"><span style="font-family:Arial, Helvetica, sans-serif;">4) 1</span></span></p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Количество стадий эфирного наркоза по Гведелу');
		expect(answers).toContain('4');
	});

	it('#6 реальный пример', () => {

		const div = createDiv(`
		<p><br></p>
		<p><b>2. В системе самоконтроля АККОРД буква «Р» означает&nbsp;</b></p>
		<p>1) радиус;<br>2) результат;<br><b>3) размер; +&nbsp;</b><br>4) расстояние.</p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('В системе самоконтроля АККОРД буква «Р» означает');
		expect(answers).toContain('размер');
	});

	it('#7 реальный пример', () => {

		const div = createDiv(`
		<p><span style="background-color:#fbeeb8;">1) хирургического;+</span> <br><span style="background-color:#fbeeb8;">2) дерматовенерологического;+</span> <br>3) педиатрического; <br>4) терапевтического.</p>
		<p><br></p>
		<h3>3. Взрослым пациентам с мозолями и омозолелостями физические методы деструктивной терапии рекомендуются проводить с предварительной</h3>
		<p>1) эпидуральной анестезией; <br>2) проводниковой анестезией; <br>3) аппликационной анестезией; <br><span style="background-color:#fbeeb8;">4) местной инфильтративной анестезией кожи.+</span></p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Взрослым пациентам с мозолями и омозолелостями физические методы деструктивной терапии рекомендуются проводить с предварительной');
		expect(answers).toContain('местной инфильтративной анестезией кожи');
	});

	it('#8 реальный пример', () => {

		const div = createDiv(`
		<h3>12. Дети от 1 месяца до 18 лет с активностью биотинидазы менее 10% должны получать биотин из расчета 10 мг 1 раз в сутки; обычная поддерживающая доза составляет</h3>
		<p><span style="background-color:#fbeeb8;">1) 10-50 мг в сутки; +</span> <br>2) 1-5 мг в сутки; <br>3) 100-120 мг в сутки; <br>4) 60-90 мг в сутки.</p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Дети от 1 месяца до 18 лет с активностью биотинидазы менее 10% должны получать биотин из расчета 10 мг 1 раз в сутки; обычная поддерживающая доза составляет');
		expect(answers).toContain('10-50 мг в сутки');
	});

	it('#9 реальный пример', () => {

		const div = createDiv(`
			<h3>13. Морфологический субстрат ЛГ</h3>
			<p><span style="background-color:#fbeeb8;">1) ремоделирование правого желудочка; +</span> <br>2) гипертрофия и дилатация левого желудочка; <br>3) <a href="http://rosmedicinfo.ru/disease/endo-myo-and-pericarditis-cardiomyopathy/251-endo-mio-perekardity-simptomy-diagnostika-lechenie.html">миокардит</a>; <br>4) отек головного мозга; <br>5) увеличение селезенки.</p>		
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Морфологический субстрат ЛГ');
		expect(answers).toContain('ремоделирование правого желудочка');
	});

	it('#10 реальный пример', () => {

		const div = createDiv(`
			<h3>17. Критерий острого инфаркта миокарда на фоне полной блокады левой ножки пучка Гиса: подъем сегмента ST от амплитуды предшествующего зубца S</h3>
			<p>1) ≥75%; <br><span style="background-color:#fbeeb8;">2) ≥25%; +</span> <br>3) ≥50%.</p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Критерий острого инфаркта миокарда на фоне полной блокады левой ножки пучка Гиса: подъем сегмента ST от амплитуды предшествующего зубца S');
		expect(answers).toContain('≥25%');
	});

	it('#11 реальный пример', () => {

		const div = createDiv(`
			<h3>2. Абсолютные противопоказания к двусторонней тонзиллэктомии включают</h3>
			<p><span style="background-color:#fbeeb8;">1) болезни крови (<a href="http://rosmedicinfo.ru/disease/diseases-of-the-blood/149-gemofiliya-klassifikaciya-simptomy-diagnostika-lechenie.html" title="Гемофилия: Классификация, Симптомы, Диагностика, Лечение" target="_blank">гемофилия</a>, лейкозы, <a href="http://rosmedicinfo.ru/disease/diseases-of-the-blood/928-gemorragicheskie-diatezy-u-detey-i-vzroslyh.html" target="_blank">геморрагические диатезы</a>); </span> <br><span style="background-color:#fbeeb8;">2) наличие аномальных сосудов в глотке (пульсация боковой стенки глотки); </span> <br>3) наличие всех видов декомпенсации хронического тонзиллита, кроме рецидивов острого тонзиллита (ангин); <br>4) наличие декомпенсации хронического тонзиллита в виде рецидивов острого тонзиллита (ангин); <br>5) наличие неэффективности повторных (2-3 раза в год) тщательно проведенных курсов консервативного лечения у больных хронического тонзиллита простой формы.</p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('Абсолютные противопоказания к двусторонней тонзиллэктомии включают');
		expect(answers).toContain('болезни крови (гемофилия, лейкозы, геморрагические диатезы)');
	});

	it('#12 реальный пример', () => {

		const div = createDiv(`
			<p style="margin-top:0cm;margin-right:0cm;margin-bottom:8pt;margin-left:0cm;font-size:15px;font-family:Calibri, sans-serif;"><span style="font-size:14px;"><span style="font-family:Georgia, serif;"><b>2. В каких клинических ситуациях выполнения аспирационной биопсии костного мозга при иммунной тромбоцитопении (ИТП) является обязательным?</b></span></span></p>
			<p style="margin-top:0cm;margin-right:0cm;margin-bottom:8pt;margin-left:0cm;font-size:15px;font-family:Calibri, sans-serif;"><span style="font-size:14px;"><span style="font-family:Georgia, serif;"><b>1) возраст более 60 лет для исключения МДС и лейкозов;+</b><br><b>2) отсутствие ответа на стандартную терапию в течение 6 мес.;+</b><br>3) повышение лейкоцитов периферической крови &gt; 15,0 х 109/л на терапии глюкокортикостероидами;<br>4) уровень тромбоцитов 30,0-50,0 х 109/л на фоне терапии.</span></span></p>
		`);

		const parser = parseFromRosmedicinfo(div);

		const answers = parser('В каких клинических ситуациях выполнения аспирационной биопсии костного мозга при иммунной тромбоцитопении (ИТП) является обязательным?');
		expect(answers).toContain('отсутствие ответа на стандартную терапию в течение 6 мес');
	});

});
