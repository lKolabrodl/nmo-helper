import {useEffect, useEffectEvent} from 'react';
import {useCycleCounter} from '../../hooks/useCycleCounter';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useSettings} from '../../contexts/SettingsContext';
import {Status} from '../../types';
import {
	findVariantElements,
	getAnswerClickTarget,
	getAnswerInput,
	getFinishQuizConfirmButton,
	getNextQuestionButton,
	getQuestionText,
	normalizeDashes,
} from '../../utils';
import {answerCache} from '../../utils/answer-cache';

/** На каждом новом count отмечает ответы либо переходит дальше, если они уже отмечены. */
const AutoSolveLoader = () => {
	const {enabled, delayMinSeconds, delayMaxSeconds} = useSettings().autoSolve;
	const {status} = usePanelStatus();
	const {topic, question, variants, isSingle} = useQuestionFinder();
	const count = useCycleCounter(enabled, delayMinSeconds, delayMaxSeconds);

	const onCycle = useEffectEvent(() => {
		if (!enabled) return;

		// если уже пришли в конец, говорим окей
		const confirmButton = getFinishQuizConfirmButton();
		if (confirmButton) return clickAvailableButton(confirmButton);


		if (status.status !== Status.OK && status.status !== Status.WARN) return;

		if (!question || !variants.length) return;

		const domQuestion = getQuestionText();
		if (domQuestion !== null && normalizeDashes(domQuestion) !== normalizeDashes(question)) return;

		const cached = answerCache.get(topic ?? '', question, variants);
		if (!cached?.answers.length) return;

		const answers = new Set(cached.answers.map(answer => answer.trim().toLowerCase()));
		const indexes = variants.flatMap((variant, index) => answers.has(variant.trim().toLowerCase()) ? [index] : []);
		if (!indexes.length) return;

		const correct = new Set(isSingle ? indexes.slice(0, 1) : indexes);

		const selected = findVariantElements(variants).every((element, index) => {
			const control = element ? getAnswerInput(element) : null;
			return control && control.checked === correct.has(index);
		});

		// следующий вопросик
		if (selected) return clickAvailableButton(getNextQuestionButton());


		variants.forEach((_variant, index) => {
			// После клика портал может заменить DOM: следующий вариант ищем заново.
			const element = findVariantElements(variants)[index];
			const control = element ? getAnswerInput(element) : null;
			if (element && control && !control.disabled && control.checked !== correct.has(index)) getAnswerClickTarget(element).click();
		});
	});

	useEffect(() => {
		if (count > 0) onCycle();
	}, [count]);

	return null;
};

export default AutoSolveLoader;

function clickAvailableButton(button: HTMLButtonElement | null): void {
	if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') button.click();
}
