import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {submitSharedQuestions, type ISharedQuizQuestion} from '../../api/fetch/submit-shared-questions';
import {useSettings} from '../../contexts/SettingsContext';
import {cleanTopic, findCompletedQuizResults, getTopicElement, normalizeText, queryAll, queryFirst} from '../../utils';
import {questionCache} from '../../utils/question-cache';
import ModalAnswerSharing from '../ModalAnswerSharing';

const RESULTS_SETTLE_DELAY_MS = 200;

/** Готовые данные одной завершённой попытки теста. */
export interface IAnswerSharingSnapshot {
	/** Очищенная тема теста. */
	readonly title: string;
	/** Только вопросы, которые портал отметил как решённые правильно. */
	readonly questions: readonly ISharedQuizQuestion[];
}


/**
 * Следит за появлением итогов теста, запрашивает разовое согласие при
 * выключенной настройке и отправляет только подтверждённые правильные ответы.
 */
const AnswerSharingLoader = () => {
	const {enabled} = useSettings().testDataSharing;
	const [pending, setPending] = useState<IAnswerSharingSnapshot | null>(null);

	const handledResultsRef = useRef(new WeakSet<HTMLElement>());
	const pendingResultsRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		let scanTimer: number | null = null;

		const scan = (): void => {
			const results = findCompletedQuizResults();
			if (!results
				|| handledResultsRef.current.has(results)
				|| pendingResultsRef.current === results
			) return;

			const snapshot = createAnswerSharingSnapshot(results);
			if (!snapshot) return;

			if (enabled) {
				handledResultsRef.current.add(results);
				sendSnapshot(snapshot);
				return;
			}

			pendingResultsRef.current = results;
			setPending(snapshot);
		};

		const scheduleScan = (): void => {
			if (scanTimer !== null) window.clearTimeout(scanTimer);
			scanTimer = window.setTimeout(scan, RESULTS_SETTLE_DELAY_MS);
		};

		scan();
		const observer = new MutationObserver(scheduleScan);
		observer.observe(document.body, {childList: true, subtree: true, characterData: true});

		return () => {
			observer.disconnect();
			if (scanTimer !== null) window.clearTimeout(scanTimer);
		};
	}, [enabled]);

	const handleSharingChange = (save: boolean): void => {
		if (!pending) return;

		const snapshot = pending;
		if (pendingResultsRef.current) handledResultsRef.current.add(pendingResultsRef.current);

		pendingResultsRef.current = null;
		setPending(null);
		if (save) sendSnapshot(snapshot);
	};

	return pending ?
		createPortal(<ModalAnswerSharing questionCount={pending.questions.length} onChange={handleSharingChange}/>,	document.body)
		: null;
};

export default AnswerSharingLoader;

/**
 * Собирает отмеченные порталом правильные вопросы и достаёт их варианты с
 * выбранными ответами из кеша по тексту вопроса. Неполные данные не включаются.
 *
 * @param results Контейнер итогового списка вопросов.
 * @returns Данные для отправки либо `null`, если надёжных совпадений нет.
 */
export function createAnswerSharingSnapshot(results: HTMLElement): IAnswerSharingSnapshot | null {
	const title = cleanTopic(collapseText(getTopicElement()?.textContent) || null);
	if (!title) return null;

	const questionResults = queryAll<HTMLElement>('resultItem', results).flatMap(item => {
		const text = collapseText(queryFirst('resultTitle', item)?.textContent);
		return text ? [{
			text,
			key: normalizeText(text),
			isCorrect: !!queryFirst('resultCorrect', item),
		}] : [];
	});
	const questionCounts = new Map<string, number>();
	questionResults.forEach(({key}) => {
		questionCounts.set(key, (questionCounts.get(key) ?? 0) + 1);
	});

	const questions: ISharedQuizQuestion[] = [];
	questionResults.forEach(({text, key, isCorrect}) => {
		if (!isCorrect || questionCounts.get(key) !== 1) return;

		const cached = questionCache.get(title, text);
		if (!cached) return;

		const correctIndexes = findCorrectIndexes(cached.variants, cached.selectedVariants);
		if (!correctIndexes) return;

		questions.push({text, options: [...cached.variants], correct_indexes: correctIndexes});
	});

	if (!questions.length) return null;

	return {title, questions};
}

function sendSnapshot(snapshot: IAnswerSharingSnapshot): void {
	void submitSharedQuestions(snapshot.title, snapshot.questions).catch(error => {
		console.warn('Не удалось поделиться ответами теста:', error);
	});
}

function findCorrectIndexes(variants: readonly string[], answers: readonly string[]): number[] | null {
	const variantKeys = variants.map(normalizeText);
	const answerKeys = answers.map(normalizeText);
	const correctKeys = new Set(answerKeys);

	if (variants.length < 2	|| !correctKeys.size|| correctKeys.size !== answerKeys.length|| new Set(variantKeys).size !== variantKeys.length) return null;

	const indexes = variantKeys.flatMap((variant, index) =>
		correctKeys.has(variant) ? [index] : []
	);

	return indexes.length === correctKeys.size ? indexes : null;
}

function collapseText(value: string | null | undefined): string {
	return value?.replace(/\s+/g, ' ').trim() ?? '';
}
