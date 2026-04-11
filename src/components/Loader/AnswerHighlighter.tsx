import { useEffect, useRef } from 'react';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { answerCache } from '../../utils/answer-cache';
import { highlightByIndexes } from '../../utils/matching';
import { getVariantElements, getQuestionText, getTopicElement } from '../../utils';
import { cleanTopic } from '../../utils';
import { Status } from '../../types';

/**
 * Headless-компонент: каждые 200ms проверяет кеш и подсвечивает.
 * Статус "(кеш)" пишет только при смене вопроса на ранее закешированный.
 * Если ответ только что записали — молчит (статус уже поставил тот кто нашёл).
 */
const AnswerHighlighter = () => {
	const { setStatus } = usePanelStatus();
	const lastQuestionRef = useRef('');

	useEffect(() => {
		const timer = setInterval(() => {
			const question = getQuestionText();
			if (!question) return;

			const elements = getVariantElements();
			const variants = elements.map(el => el.innerText.trim());
			if (!variants.length) return;

			const topicEl = getTopicElement();
			const topic = cleanTopic(topicEl?.innerText?.trim() ?? null) ?? '';

			const cachedIndexes = answerCache.getCorrectIndexes(topic, question, variants);
			if (!cachedIndexes) return;

			highlightByIndexes(elements, cachedIndexes);

			const key = `${topic}::${question}`;
			if (lastQuestionRef.current !== key) {
				lastQuestionRef.current = key;

				// Только что записали — молчим, статус уже есть
				if (answerCache.isFresh(topic, question)) return;

				// Вернулись к ранее закешированному вопросу
				const cached = answerCache.get(topic, question)!;
				setStatus({ title: `${cached.source} (кеш)`, status: Status.OK });
			}
		}, 200);

		return () => clearInterval(timer);
	}, [setStatus]);

	return null;
};

export default AnswerHighlighter;
