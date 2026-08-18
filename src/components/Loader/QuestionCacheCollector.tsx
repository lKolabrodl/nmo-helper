import {useEffect} from 'react';
import {
	cleanTopic,
	getAnswerInput,
	getNextQuestionButton,
	getQuestionText,
	getTopicElement,
	getVariantElements,
} from '../../utils';
import {questionCache} from '../../utils/question-cache';

/**
 * Headless-компонент: перед переходом к следующему вопросу определяет тему
 * и всегда сохраняет все варианты с выбранными пользователем ответами в памяти.
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

		document.addEventListener('click', collectOnForwardClick, true);
		return () => document.removeEventListener('click', collectOnForwardClick, true);
	}, []);

	return null;
};

export default QuestionCacheCollector;

/**
 * Считывает текущую тему, текст вопроса, варианты ответа и состояние связанных
 * radio/checkbox из DOM страницы НМО, затем сохраняет их в {@link questionCache}.
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
	const topic = cleanTopic(topicText);
	if (!topic) return;

	const question = getQuestionText();
	if (!question) return;

	const variantElements = getVariantElements();
	if (!variantElements.length) return;

	const variants = variantElements.map(element => element.innerText.trim());
	const selectedVariants = variantElements.flatMap((element, index) =>
		getAnswerInput(element)?.checked ? [variants[index]] : []
	);

	if (!selectedVariants.length) return;
	questionCache.set(topic, question, variants, selectedVariants);
}
