import {useEffect, useRef} from 'react';
import {askFreeAI} from '../../api/fetch/fetch-free-ai';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {Status} from '../../types';
import {answerCache} from '../../utils/answer-cache';
import {StatusTitle} from '../../utils/constants';

export interface IFreeAiSolverState {
	readonly running: boolean;
	readonly disabled: boolean;
}

interface IAIProxyFreeLoaderProps {
	readonly active: boolean;
	readonly onChange: (state: IFreeAiSolverState) => void;
}

/**
 * Headless-загрузчик бесплатного AI. Сам запускает маршрут GPT-OSS → Qwen → Llama → AI Horde,
 * сохраняет найденный ответ в кеш и показывает фактически ответившую модель или сервис.
 */
const AIProxyFreeLoader = ({active, onChange}: IAIProxyFreeLoaderProps) => {
	const {question, variants, isSingle, topic} = useQuestionFinder();
	const {setStatus} = usePanelStatus();
	const pendingRef = useRef(false);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		if (!active || !question || !variants.length) return;
		if (answerCache.has(topic, question, variants)) return;
		if (pendingRef.current) return;

		const currentQuestion = question;
		const currentTopic = topic ?? '';
		let cancelled = false;
		const controller = new AbortController();

		async function solve() {
			pendingRef.current = true;
			onChangeRef.current({running: true, disabled: false});
			setStatus({title: StatusTitle.AI_THINKING, status: Status.LOADING});

			try {
				const {correctIndexes, source} = await askFreeAI(currentQuestion, variants, isSingle, currentTopic, {
					signal: controller.signal,
					onRetry: ({attempt, maxAttempts, delayMs, reason}) => {
						if (cancelled) return;
						setStatus({
							title: `AI Horde: ${reason}. Повтор через ${delayMs / 1000} с (${attempt}/${maxAttempts})`,
							status: Status.LOADING,
						});
					},
				});
				if (cancelled) return;

				if (!correctIndexes.length) {
					setStatus({title: StatusTitle.AI_NO_ANSWER, status: Status.WARN});
					return;
				}

				const answers = correctIndexes.map(index => variants[index]);
				answerCache.set(currentTopic, currentQuestion, variants, answers);
				setStatus({
					title: `AI · ${source}: вариант${correctIndexes.length > 1 ? 'ы' : ''} ${correctIndexes.map(index => index + 1).join(', ')}`,
					status: Status.OK,
				});
			} catch (error) {
				if (cancelled) return;
				setStatus({title: (error as Error).message, status: Status.ERR});
			} finally {
				if (!cancelled) pendingRef.current = false;
			}
		}

		solve();
		return () => {
			cancelled = true;
			controller.abort();
			pendingRef.current = false;
		};
	}, [active, question, variants, isSingle, topic, setStatus]);

	return null;
};

export default AIProxyFreeLoader;
