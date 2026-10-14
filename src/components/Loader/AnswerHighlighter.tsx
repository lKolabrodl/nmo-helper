import { useEffect, useRef } from 'react';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { answerCache } from '../../utils/answer-cache';
import { findVariantElements } from '../../utils';
import { HIGHLIGHT_COLOR } from '../../utils/constants';
import { Status } from '../../types';

/**
 * Подсвечивает цветом `HIGHLIGHT_COLOR` DOM-элементы из `elements`,
 * индексы которых входят в `correctIndexes`. Idempotent: уже
 * подсвеченные не трогает, чтобы не перетирать inline-стиль на ровном месте.
 */
export function highlightByIndexes(elements: (HTMLElement | null)[], correctIndexes: number[]): void {
	elements.forEach((el, i) => {
		if (el && correctIndexes.includes(i) && el.style.color !== HIGHLIGHT_COLOR) {
			el.style.color = HIGHLIGHT_COLOR;
		}
	});
}

/**
 * Headless-компонент: каждые 200ms проверяет answerCache и подсвечивает.
 * Статус «кеш» выводится только при смене вопроса на ранее закешированный.
 * Если ответ только что записали — молчит (статус уже поставил тот, кто нашёл).
 *
 * Тема, вопрос и варианты берутся из QuestionFinderContext. DOM-элементы
 * ищутся по текстам вариантов, затем по известным селекторам. Правильные
 * индексы вычисляются по сохранённым ответам в текущем порядке контекста,
 * поскольку порядок вариантов в кеше или DOM может отличаться.
 */
const AnswerHighlighter = () => {
	const { setStatus } = usePanelStatus();
	const { topic, question, variants } = useQuestionFinder();
	const lastKeyRef = useRef('');

	useEffect(() => {
		const timer = setInterval(() => {
			if (!question || !variants.length) return;

			const cached = answerCache.get(topic ?? '', question, variants);
			if (!cached) return;

			const answers = new Set(cached.answers.map(answer => answer.trim().toLowerCase()));
			const correctIndexes = variants.flatMap((variant, index) =>
				answers.has(variant.trim().toLowerCase()) ? [index] : []);
			if (!correctIndexes.length) return;

			const elements = findVariantElements(variants);
			if (!correctIndexes.some(index => elements[index])) return;
			highlightByIndexes(elements, correctIndexes);

			if (lastKeyRef.current === cached.id) return;
			lastKeyRef.current = cached.id;

			// Только что записали — молчим, статус уже есть
			if (answerCache.fresh(topic ?? '', question, variants)) return;

			// Вернулись к ранее закешированному вопросу
			setStatus({ title: 'найдено в памяти', status: Status.OK });

		}, 200);

		return () => clearInterval(timer);
	}, [setStatus, topic, question, variants]);

	return null;
};

export default AnswerHighlighter;
