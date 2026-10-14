import React, {createContext, useContext, useState, useEffect, useRef} from 'react';
import {debounce} from '../libs';
import {
	cleanTopic,
	getTopicState, getTopicText,
	getQuestionState, getQuestionText,
	getVariantsState, getVariantTexts,
	isSingleAnswerState, isSingleAnswer,
} from '../utils';
import {PAGE_STATE_UPDATED} from '../patch/subscribePageState';

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
    readonly variantsKey: string;
    readonly isSingle: boolean;
}

/**
 * Провайдер контекста текущего вопроса на странице НМО.
 *
 * Читает вопрос из глобальной переменной; если данных нет, сканирует DOM.
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
	const prevRef = useRef<IPrevQuestion>({topic: null, question: null, variantsKey: '', isSingle: false});

	useEffect(() => {
		const _scan = () => {
			const rawTopic = getTopicState() ?? getTopicText() ?? null;
			const topic = cleanTopic(rawTopic);
			const question = getQuestionState() ?? getQuestionText() ?? null;
			const variants = getVariantsState() ?? getVariantTexts();
			const isSingle = isSingleAnswerState() ?? isSingleAnswer();
			const variantsKey = variants.join('\n');

			// Не обновляем если ничего не изменилось
			if (
				topic === prevRef.current.topic
				&& question === prevRef.current.question
				&& variantsKey === prevRef.current.variantsKey
				&& isSingle === prevRef.current.isSingle
			) return;

			prevRef.current = {topic, question, variantsKey, isSingle};
			setState({topic, rawTopic, question, variants, isSingle});
		};

		const debouncedScan = debounce(_scan, 200);

		_scan();
		window.addEventListener(PAGE_STATE_UPDATED, _scan);

		const observer = new MutationObserver(debouncedScan);
		observer.observe(document.body, {childList: true, subtree: true, characterData: true});

		return () => {
			window.removeEventListener(PAGE_STATE_UPDATED, _scan);
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
