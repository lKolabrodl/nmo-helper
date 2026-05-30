import {useEffect, useRef} from 'react';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useSettings} from '../../contexts/SettingsContext';
import {answerCache} from '../../utils/answer-cache';

/**
 * Заготовка автопрохождения.
 *
 * Сейчас только ждёт включённую настройку, найденный вопрос и готовый ответ
 * в answerCache. Реальное проставление вариантов и переход дальше будет
 * добавлено отдельным шагом.
 */
const AutoSolveLoader = () => {

	const {autoSolveEnabled, autoSolveDelayMinSeconds, autoSolveDelayMaxSeconds} = useSettings();
	const {topic, question, variants} = useQuestionFinder();
	const scheduledAnswerIdRef = useRef('');

	useEffect(() => {
		if (!autoSolveEnabled) {
			scheduledAnswerIdRef.current = '';
			return;
		}

		if (!question || !variants.length) return;

		const cached = answerCache.get(topic ?? '', question, variants);
		if (!cached?.idx.length) return;
		if (scheduledAnswerIdRef.current === cached.id) return;

		scheduledAnswerIdRef.current = cached.id;

		const timer = window.setTimeout(() => {
			// TODO: отметить cached.idx и перейти к следующему вопросу.
		}, getRandomDelayMs(autoSolveDelayMinSeconds, autoSolveDelayMaxSeconds));

		return () => {
			window.clearTimeout(timer);
			scheduledAnswerIdRef.current = '';
		};
	}, [
		autoSolveEnabled,
		autoSolveDelayMinSeconds,
		autoSolveDelayMaxSeconds,
		topic,
		question,
		variants,
	]);

	return null;
};

export default AutoSolveLoader;

function getRandomDelayMs(minSeconds: number, maxSeconds: number): number {
	const min = Math.max(0, Math.min(minSeconds, maxSeconds));
	const max = Math.max(min, maxSeconds);
	return Math.round((min + Math.random() * (max - min)) * 1000);
}
