import type {IAiModel} from '../types';

/**
 * Типовой вопрос с четырьмя вариантами и инструкциями расширения.
 * Пример пользователя занимает около 204 входных токенов (o200k_base).
 * Взято 250 с запасом на тему/токенизацию и 10 на ответ номерами.
 * Для reasoning-моделей добавляется условный запас в 500 выходных токенов:
 * он служит ориентиром для сравнения, а не пределом или измеренным средним.
 */
export const AI_QUESTION_PRICE_PROFILE = {inputTokens: 250, answerTokens: 10, reasoningTokens: 500} as const;

/** Примерная стоимость одного вопроса в рублях, без скидок за кэш. */
export function estimateQuestionCost(model: Pick<IAiModel, 'inputPrice' | 'outputPrice' | 'reasoning'>): number | undefined {
	const {inputPrice, outputPrice} = model;
	if (inputPrice === undefined || outputPrice === undefined ||
		!Number.isFinite(inputPrice) || !Number.isFinite(outputPrice) || inputPrice < 0 || outputPrice < 0) return undefined;
	const {inputTokens, answerTokens, reasoningTokens} = AI_QUESTION_PRICE_PROFILE;
	const outputTokens = answerTokens + (model.reasoning ? reasoningTokens : 0);
	return (inputPrice * inputTokens + outputPrice * outputTokens) / 1_000_000;
}

const priceFormat = new Intl.NumberFormat('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 3});

export function formatQuestionCost(model: Pick<IAiModel, 'inputPrice' | 'outputPrice' | 'reasoning'>): string {
	const cost = estimateQuestionCost(model);
	if (cost === undefined) return 'цена не указана';
	if (cost > 0 && cost < 0.001) return '<0,001 ₽ за вопрос';
	return `≈${priceFormat.format(cost)} ₽ за вопрос`;
}
