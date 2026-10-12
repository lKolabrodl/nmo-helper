import {describe, expect, it} from 'vitest';
import {estimateQuestionCost, formatQuestionCost} from './ai-model-cost';

describe('стоимость типового вопроса', () => {
	it('учитывает входной промпт и короткий ответ по разным тарифам', () => {
		const model = {inputPrice: 230, outputPrice: 1370};
		expect(estimateQuestionCost(model)).toBeCloseTo(0.0712);
		expect(formatQuestionCost(model)).toBe('≈0,071 ₽ за вопрос');
	});

	it('учитывает оплачиваемые рассуждения, а не только видимый номер ответа', () => {
		const model = {inputPrice: 230, outputPrice: 1370, reasoning: true};
		expect(estimateQuestionCost(model)).toBeCloseTo(0.7562);
		expect(formatQuestionCost(model)).toBe('≈0,756 ₽ за вопрос');
	});

	it('не округляет очень дешёвый вопрос до бесплатного', () => {
		expect(formatQuestionCost({inputPrice: 0.01, outputPrice: 0.01})).toBe('<0,001 ₽ за вопрос');
		expect(formatQuestionCost({inputPrice: 0, outputPrice: 0})).toBe('≈0,00 ₽ за вопрос');
	});

	it.each([
		{inputPrice: 100},
		{outputPrice: 300},
		{inputPrice: -10, outputPrice: 300},
		{inputPrice: 100, outputPrice: Infinity},
	])('не выдаёт неизвестную или некорректную цену за нулевую: %j', model => {
		expect(estimateQuestionCost(model)).toBeUndefined();
		expect(formatQuestionCost(model)).toBe('цена не указана');
	});
});
