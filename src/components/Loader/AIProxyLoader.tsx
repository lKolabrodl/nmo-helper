import { useEffect, useRef } from 'react';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { answerCache } from '../../utils/answer-cache';
import { askAI } from '../../api/fetch';
import { Status } from '../../types';
import { StatusTitle } from '../../utils/constants';

export interface IAiSolverState {
	readonly running: boolean;
	readonly disabled: boolean;
}

interface IAiSolverProps {
	readonly active: boolean;
	readonly apiKey: string;
	readonly model: string;
	readonly aiUrl?: string;
	readonly onChange: (state: IAiSolverState) => void;
}

/**
 * Headless-компонент: при смене вопроса отправляет его в AI,
 * записывает ответ в кеш. Подсветку делает AnswerHighlighter.
 */
const AIProxyLoader = ({ active, apiKey, model, aiUrl, onChange }: IAiSolverProps) => {
	const { question, variants, isSingle, topic } = useQuestionFinder();
	const { setStatus } = usePanelStatus();
	const pendingRef = useRef(false);

	useEffect(() => {
		if (!active || !question || !variants.length) return;

		if (answerCache.has(topic, question, variants)) return;
		if (pendingRef.current) return;

		const t = topic ?? '';

		async function solve() {
			pendingRef.current = true;
			onChange({ running: true, disabled: false });
			setStatus({ title: StatusTitle.AI_THINKING, status: Status.LOADING });

			try {
				const correctIndexes = await askAI(apiKey, question, variants, isSingle, t, model, aiUrl);

				if (correctIndexes.length === 0) {
					setStatus({ title: StatusTitle.AI_NO_ANSWER, status: Status.WARN });
					pendingRef.current = false;
					return;
				}

				const answers = correctIndexes.map(i => variants[i]);
				answerCache.set(t, question, variants, answers);

				setStatus({ title: `AI: вариант${correctIndexes.length > 1 ? 'ы' : ''} ${correctIndexes.map(i => i + 1).join(', ')}`, status: Status.OK });
			} catch (err) {
				setStatus({ title: (err as Error).message, status: Status.ERR });
				onChange({ running: false, disabled: false });
			}
			pendingRef.current = false;
		}

		solve();

	}, [active, question, variants, isSingle, topic, apiKey, model]);

	return null;
};

export default AIProxyLoader;
