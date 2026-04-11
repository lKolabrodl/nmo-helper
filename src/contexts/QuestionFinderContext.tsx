import React, {createContext, useContext, useState, useEffect, useRef} from 'react';
import {debounce} from 'lodash-es';
import {cleanTopic, getTopicElement, getQuestionText, getVariantTexts, isSingleAnswer} from '../utils';

interface IQuestionState {
    readonly topic: string | null;
    readonly rawTopic: string | null;
    readonly question: string | null;
    readonly variants: string[];
    readonly isSingle: boolean;
}

const INIT_STATE: IQuestionState = {topic: null, rawTopic: null, question: null, variants: [], isSingle: false};

const QuestionFinderContext = createContext<IQuestionState>(INIT_STATE);

interface IPrevQuestion {
    readonly topic: string | null;
    readonly question: string | null;
}

/**
 * Провайдер контекста текущего вопроса на странице НМО.
 *
 * Использует MutationObserver для отслеживания изменений DOM на странице теста.
 * Автоматически определяет тему теста, текст вопроса, варианты ответов и тип вопроса.
 * Обновляет состояние только при реальном изменении данных (debounce 200ms).
 *
 * @example
 * ```tsx
 * <QuestionFinderProvider>
 *   <App />
 * </QuestionFinderProvider>
 *
 * // В дочернем компоненте:
 * const { topic, question, variants, isSingle } = useQuestionFinder();
 * ```
 */
export const QuestionFinderProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const [state, setState] = useState<IQuestionState>(INIT_STATE);
	const prevRef = useRef<IPrevQuestion>({topic: null, question: null});

	useEffect(() => {
		const _scan = () => {

			// Тема теста (заголовок карточки на странице НМО)
			const topicEl = getTopicElement();
			const rawTopic = topicEl ? topicEl.innerText.trim() : null;
			const topic = cleanTopic(rawTopic);

			// Текст вопроса
			const question = getQuestionText();

			// Не обновляем если ничего не изменилось
			if (topic === prevRef.current.topic && question === prevRef.current.question) return;

			// Тексты вариантов ответов
			const variants = getVariantTexts();

			// Тип вопроса: radio = один ответ, checkbox = несколько
			const isSingle = isSingleAnswer();

			prevRef.current = {topic, question};
			setState({topic, rawTopic, question, variants, isSingle});
		};

		const debouncedScan = debounce(_scan, 200);

		_scan();

		const observer = new MutationObserver(debouncedScan);
		observer.observe(document.body, {childList: true, subtree: true, characterData: true});

		return () => {
			observer.disconnect();
			debouncedScan.cancel();
		};
	}, []);

	return (
		<QuestionFinderContext.Provider value={state}>
			{children}
		</QuestionFinderContext.Provider>
	);
};

export const useQuestionFinder = () => {
	return useContext(QuestionFinderContext);
};
