import { useEffect, useRef } from 'react';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { answerCache } from '../../utils/answer-cache';
import { findVariantElements, getQuestionText, normalizeDashes } from '../../utils';
import { HIGHLIGHT_CLASS } from '../../utils/constants';
import { Status } from '../../types';

/**
 * Headless-компонент: каждые 200ms проверяет answerCache и подсвечивает.
 * Статус «кеш» выводится только при смене вопроса на ранее закешированный.
 * Если ответ только что записали — молчит (статус уже поставил тот, кто нашёл).
 *
 * Тема, вопрос и варианты берутся из QuestionFinderContext. DOM-элементы
 * ищутся по текстам вариантов. Правильные индексы вычисляются по сохранённым
 * ответам в текущем порядке контекста,
 * поскольку порядок вариантов в кеше или DOM может отличаться.
 * Неактуальные отметки снимаются при каждой проверке и в cleanup эффекта.
 */
const AnswerHighlighter = () => {
	const { setStatus } = usePanelStatus();
	const { topic, question, variants } = useQuestionFinder();
	const lastKeyRef = useRef('');

	useEffect(() => {
		const highlighted = new Set<HTMLElement>();
		const syncHighlights = (next: Set<HTMLElement>) => {
			for (const element of highlighted) {
				if (!next.has(element) && element.classList.contains(HIGHLIGHT_CLASS)) {
					element.classList.remove(HIGHLIGHT_CLASS);
				}
			}
			highlighted.clear();
			for (const element of next) {
				if (!element.classList.contains(HIGHLIGHT_CLASS)) element.classList.add(HIGHLIGHT_CLASS);
				highlighted.add(element);
			}
		};

		const timer = setInterval(() => {
			const currentQuestion = question ?? '';
			const domQuestion = getQuestionText();
			const questionMatches = domQuestion === null || normalizeDashes(domQuestion) === normalizeDashes(currentQuestion);
			const cached = (currentQuestion && variants.length && questionMatches) ? answerCache.get(topic ?? '', currentQuestion, variants) : null;
			const next = new Set<HTMLElement>();

			if (cached) {
				const answers = new Set(cached.answers.map(answer => answer.trim().toLowerCase()));
				const elements = findVariantElements(variants);
				variants.forEach((variant, index) => {
					const element = elements[index];
					if (element && answers.has(variant.trim().toLowerCase())) next.add(element);
				});
			}

			syncHighlights(next);
			if (!cached || !next.size) return;

			if (lastKeyRef.current === cached.id) return;
			lastKeyRef.current = cached.id;

			// Только что записали — молчим, статус уже есть
			if (answerCache.fresh(topic ?? '', currentQuestion, variants)) return;

			// Вернулись к ранее закешированному вопросу
			setStatus({ title: 'найдено в памяти', status: Status.OK });

		}, 200);

		return () => {
			clearInterval(timer);
			syncHighlights(new Set());
		};
	}, [setStatus, topic, question, variants]);

	return null;
};

export default AnswerHighlighter;
