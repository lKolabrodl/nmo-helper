import {useEffect} from 'react';
import {
	cleanTopic,
	findVariantElements,
	getAnswerInput,
	getNextQuestionButton,
	getQuestionAnchor,
	getQuestionState,
	getQuestionText,
	getTopicElement,
	getTopicState,
	getVariantElements,
	getVariantsState,
	normalizeText,
} from '../../utils';
import {questionCache} from '../../utils/question-cache';

/**
 * Сохраняет все варианты и выбранные ответы при изменении выбора и перед
 * переходом к следующему вопросу независимо от настройки отправки данных.
 *
 * Обработчик установлен на `document` в capture-фазе. Поэтому он успевает
 * прочитать текущий вопрос до того, как портал НМО заменит его DOM, и продолжает
 * работать после замены самой кнопки навигации.
 */
const QuestionCacheCollector = () => {
	useEffect(() => {
		const collectOnForwardClick = (event: MouseEvent): void => {
			if (!(event.target instanceof Element)) return;

			const clickedButton = event.target.closest<HTMLButtonElement>('button');
			if (!clickedButton || clickedButton !== getNextQuestionButton()) return;

			collectCurrentQuestion();
		};

		const collectOnAnswerChange = (event: Event): void => {
			const input = event.target;
			if (!(input instanceof HTMLInputElement)
				|| (input.type !== 'radio' && input.type !== 'checkbox')
				|| !getQuestionAnchor()?.contains(input)) return;

			collectCurrentQuestion();
		};

		document.addEventListener('click', collectOnForwardClick, true);
		document.addEventListener('change', collectOnAnswerChange, true);
		return () => {
			document.removeEventListener('click', collectOnForwardClick, true);
			document.removeEventListener('change', collectOnAnswerChange, true);
		};
	}, []);

	return null;
};

export default QuestionCacheCollector;

/**
 * Берёт вопрос и варианты из State страницы, если они соответствуют текущему
 * DOM, иначе использует DOM. Выбранные ответы читает из связанных radio/checkbox,
 * найденных по текстам вариантов, и сохраняет их в {@link questionCache}.
 *
 * Тема очищается через {@link cleanTopic} и передаётся в кеш только для
 * определения смены теста. В саму модель сохранённого вопроса она не входит.
 * Если тема, вопрос или варианты не найдены либо пользователь ничего не выбрал,
 * функция завершает работу без записи в кеш.
 *
 * @returns Ничего не возвращает.
 */
export function collectCurrentQuestion(): void {
	const topicText = getTopicElement()?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
	const domTopic = cleanTopic(topicText);
	const stateTopic = cleanTopic(getTopicState());
	const domQuestion = getQuestionText();
	const stateQuestion = getQuestionState();
	const usePageState = stateQuestion !== null
		&& (domQuestion === null || normalizeText(domQuestion) === normalizeText(stateQuestion))
		&& (!domTopic || !stateTopic || normalizeText(domTopic) === normalizeText(stateTopic));

	const topic = domTopic ?? (usePageState ? stateTopic : null);
	const question = domQuestion ?? (usePageState ? stateQuestion : null);
	if (!topic || !question) return;

	const variants = (usePageState ? getVariantsState() : null)
		?? getVariantElements().map(element => element.innerText.trim());
	if (!variants.length) return;

	const inputs = findVariantElements(variants).map(element => element ? getAnswerInput(element) : null);
	// Частичный DOM и повторные совпадения не должны портить уже сохранённый вопрос.
	if (inputs.some(input => input === null) || new Set(inputs).size !== variants.length) return;
	const selectedVariants = inputs.flatMap((input, index) =>
		input?.checked ? [variants[index]] : []
	);

	if (!selectedVariants.length) return;
	questionCache.set(topic, question, variants, selectedVariants);
}
