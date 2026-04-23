import { useEffect, useRef } from 'react';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { answerCache } from '../../utils/answer-cache';
import { getVariantElements, getQuestionText, getTopicElement, cleanTopic } from '../../utils';
import { HIGHLIGHT_COLOR } from '../../utils/constants';
import { Status } from '../../types';

/**
 * Подсвечивает цветом `HIGHLIGHT_COLOR` DOM-элементы из `elements`,
 * индексы которых входят в `correctIndexes`. Idempotent: уже
 * подсвеченные не трогает, чтобы не перетирать inline-стиль на ровном месте.
 */
export function highlightByIndexes(elements: HTMLElement[], correctIndexes: number[]): void {
	elements.forEach((el, i) => {
		if (correctIndexes.includes(i) && el.style.color !== HIGHLIGHT_COLOR) {
			el.style.color = HIGHLIGHT_COLOR;
		}
	});
}

/**
 * Headless-компонент: каждые 200ms проверяет answerCache и подсвечивает.
 * Статус «кеш» выводится только при смене вопроса на ранее закешированный.
 * Если ответ только что записали — молчит (статус уже поставил тот, кто нашёл).
 *
 * Индексы берутся напрямую из `cached.idx` — QuestionFinder читает variants
 * из DOM в стабильном порядке, `set` и `get` видят одинаковый массив,
 * поэтому сохранённые позиции остаются валидными.
 */
const AnswerHighlighter = () => {
	const { setStatus } = usePanelStatus();
	const lastKeyRef = useRef('');

	useEffect(() => {
		const timer = setInterval(() => {
			const question = getQuestionText();
			if (!question) return;

			const elements = getVariantElements();
			const variants = elements.map(el => el.innerText.trim());
			if (!variants.length) return;

			const topicEl = getTopicElement();
			const topic = cleanTopic(topicEl?.innerText?.trim() ?? null) ?? '';

			const cached = answerCache.get(topic, question, variants);
			if (!cached || !cached.idx.length) return;

			highlightByIndexes(elements, cached.idx);

			if (lastKeyRef.current === cached.id) return;
			lastKeyRef.current = cached.id;

			// Только что записали — молчим, статус уже есть
			if (answerCache.fresh(topic, question, variants)) return;

			// Вернулись к ранее закешированному вопросу
			setStatus({ title: 'найдено в памяти', status: Status.OK });
		}, 200);

		return () => clearInterval(timer);
	}, [setStatus]);

	return null;
};

export default AnswerHighlighter;
