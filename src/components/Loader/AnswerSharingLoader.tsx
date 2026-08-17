import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {submitSharedQuestions, type ISharedQuizQuestion} from '../../api/fetch/submit-shared-questions';
import {useSettings} from '../../contexts/SettingsContext';
import {cleanTopic, getTopicElement, normalizeText} from '../../utils';
import {questionCache, type ICachedQuestionModel} from '../../utils/question-cache';
import {IconCheck} from '../icons';
import './AnswerSharingLoader.scss';

const QUIZ_RESULTS_SELECTOR = 'lib-questions-list .questionList';
const RESULT_ITEM_SELECTOR = '.questionList-item';
const RESULT_NUMBER_SELECTOR = '.questionList-item-number';
const RESULT_TITLE_SELECTOR = '.questionList-item-content-title';
const RESULT_ANSWER_SELECTOR = '.questionList-item-content-answer-text';
const RESULT_CORRECT_SELECTOR = '.questionList-item-status-wright';
const COMPLETED_STATUS_SELECTOR = '.text_value.text-success';
const RESULTS_SETTLE_DELAY_MS = 200;

/** Готовые данные одной завершённой попытки теста. */
export interface IAnswerSharingSnapshot {
	/** Очищенная тема теста. */
	readonly title: string;
	/** Только вопросы, которые портал отметил как решённые правильно. */
	readonly questions: readonly ISharedQuizQuestion[];
}

/**
 * Находит полностью завершённый тест со списком результатов.
 *
 * @param root Корень поиска. По умолчанию весь документ.
 * @returns Контейнер результатов или `null`, пока итоговый DOM не появился.
 */
export function findCompletedQuizResults(root: ParentNode = document): HTMLElement | null {
	const results = root.querySelector<HTMLElement>(QUIZ_RESULTS_SELECTOR);
	if (!results?.querySelector(RESULT_ITEM_SELECTOR)) return null;

	const page = results.closest('lib-quiz-page') ?? document;
	const isCompleted = Array.from(page.querySelectorAll<HTMLElement>(COMPLETED_STATUS_SELECTOR))
		.some(element => /заверш[её]н/i.test(collapseText(element.textContent)));

	return isCompleted ? results : null;
}

/**
 * Сопоставляет правильные строки итогового DOM с вопросами, собранными во время
 * прохождения теста. Основное соответствие строится по номеру вопроса; при
 * пропуске вопроса допускается только единственное однозначное совпадение по
 * выбранным ответам. Неоднозначные и неполные данные не включаются.
 *
 * @param results Контейнер итогового списка вопросов.
 * @param cachedQuestions Вопросы из {@link questionCache} в порядке прохождения.
 * @returns Данные для отправки либо `null`, если надёжных совпадений нет.
 */
export function createAnswerSharingSnapshot(
	results: HTMLElement,
	cachedQuestions: readonly ICachedQuestionModel[],
): IAnswerSharingSnapshot | null {
	const title = cleanTopic(collapseText(getTopicElement()?.textContent) || null);
	if (!title || !cachedQuestions.length) return null;

	const usedCacheIndexes = new Set<number>();
	const usedQuestionKeys = new Set<string>();
	const questions: ISharedQuizQuestion[] = [];

	results.querySelectorAll<HTMLElement>(RESULT_ITEM_SELECTOR).forEach(item => {
		if (!item.querySelector(RESULT_CORRECT_SELECTOR)) return;

		const text = collapseText(item.querySelector(RESULT_TITLE_SELECTOR)?.textContent);
		const answers = Array.from(item.querySelectorAll<HTMLElement>(RESULT_ANSWER_SELECTOR))
			.map(element => collapseText(element.textContent))
			.filter(Boolean);
		if (!text || !answers.length) return;

		const ordinal = Number.parseInt(
			collapseText(item.querySelector(RESULT_NUMBER_SELECTOR)?.textContent),
			10,
		) - 1;
		const cacheIndex = findCachedQuestionIndex(
			Number.isInteger(ordinal) ? ordinal : -1,
			answers,
			cachedQuestions,
			usedCacheIndexes,
		);
		if (cacheIndex < 0) return;

		const cached = cachedQuestions[cacheIndex];
		const correctIndexes = findCorrectIndexes(cached.variants, answers);
		if (!correctIndexes) return;

		const questionKey = JSON.stringify([
			normalizeText(text),
			[...cached.variants].map(normalizeText).sort(),
		]);
		if (usedQuestionKeys.has(questionKey)) return;

		usedCacheIndexes.add(cacheIndex);
		usedQuestionKeys.add(questionKey);
		questions.push({
			text,
			options: [...cached.variants],
			correct_indexes: correctIndexes,
		});
	});

	if (!questions.length) return null;
	return {
		title,
		questions,
	};
}

/**
 * Следит за появлением итогов теста, запрашивает разовое согласие при
 * выключенной настройке и отправляет только подтверждённые правильные ответы.
 */
const AnswerSharingLoader = () => {
	const {enabled, setEnabled} = useSettings().testDataSharing;
	const [pending, setPending] = useState<IAnswerSharingSnapshot | null>(null);
	const [rememberChoice, setRememberChoice] = useState(false);
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

			const snapshot = createAnswerSharingSnapshot(results, questionCache.getAll());
			if (!snapshot) return;

			if (enabled) {
				handledResultsRef.current.add(results);
				sendSnapshot(snapshot);
				return;
			}

			pendingResultsRef.current = results;
			setRememberChoice(false);
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

	const closePrompt = (): void => {
		if (!pending) return;
		if (pendingResultsRef.current) {
			handledResultsRef.current.add(pendingResultsRef.current);
		}
		pendingResultsRef.current = null;
		setPending(null);
		setRememberChoice(false);
	};

	const acceptSharing = (): void => {
		if (!pending) return;

		const snapshot = pending;
		if (pendingResultsRef.current) {
			handledResultsRef.current.add(pendingResultsRef.current);
		}
		pendingResultsRef.current = null;
		setPending(null);
		if (rememberChoice) setEnabled(true);
		setRememberChoice(false);
		sendSnapshot(snapshot);
	};

	return pending ? createPortal(
		<div className="nmo-answer-sharing-backdrop">
			<section
				className="nmo-answer-sharing-dialog nmo-fade-up"
				role="dialog"
				aria-modal="true"
				aria-labelledby="nmo-answer-sharing-title"
				aria-describedby="nmo-answer-sharing-description">
				<div className="nmo-answer-sharing-icon" aria-hidden="true">
					<IconCheck size={22}/>
				</div>
				<h2 id="nmo-answer-sharing-title">Помочь другим врачам?</h2>
				<p id="nmo-answer-sharing-description">
					Поделиться правильными ответами из завершённого теста? Данные отправятся
					анонимно и помогут другим врачам быстрее находить ответы.
				</p>
				<div className="nmo-answer-sharing-count">
					Будет отправлено вопросов: <strong>{pending.questions.length}</strong>
				</div>
				<label className="nmo-answer-sharing-remember">
					<input
						type="checkbox"
						checked={rememberChoice}
						onChange={event => setRememberChoice(event.target.checked)}/>
					<span>Запомнить выбор</span>
				</label>
				<div className="nmo-answer-sharing-actions">
					<button
						type="button"
						className="nmo-answer-sharing-no"
						disabled={rememberChoice}
						title={rememberChoice ? 'Снимите «Запомнить выбор», чтобы отказаться' : undefined}
						onClick={closePrompt}>
						Нет
					</button>
					<button
						type="button"
						className="nmo-answer-sharing-yes"
						autoFocus
						onClick={acceptSharing}>
						Да, поделиться
					</button>
				</div>
			</section>
		</div>,
		document.body,
	) : null;
};

export default AnswerSharingLoader;

function sendSnapshot(snapshot: IAnswerSharingSnapshot): void {
	void submitSharedQuestions(snapshot.title, snapshot.questions).catch(error => {
		console.warn('Не удалось поделиться ответами теста:', error);
	});
}

function findCachedQuestionIndex(
	preferredIndex: number,
	answers: readonly string[],
	cachedQuestions: readonly ICachedQuestionModel[],
	usedIndexes: ReadonlySet<number>,
): number {
	if (isMatchingCachedQuestion(preferredIndex, answers, cachedQuestions, usedIndexes)) {
		return preferredIndex;
	}

	const matches = cachedQuestions
		.map((_, index) => index)
		.filter(index => isMatchingCachedQuestion(index, answers, cachedQuestions, usedIndexes));

	return matches.length === 1 ? matches[0] : -1;
}

function isMatchingCachedQuestion(
	index: number,
	answers: readonly string[],
	cachedQuestions: readonly ICachedQuestionModel[],
	usedIndexes: ReadonlySet<number>,
): boolean {
	const cached = cachedQuestions[index];
	if (!cached || usedIndexes.has(index) || cached.variants.length < 2) return false;

	return normalizedSet(cached.selectedVariants) === normalizedSet(answers)
		&& findCorrectIndexes(cached.variants, answers) !== null;
}

function findCorrectIndexes(
	variants: readonly string[],
	answers: readonly string[],
): number[] | null {
	const variantKeys = variants.map(normalizeText);
	const answerKeys = answers.map(normalizeText);
	const correctKeys = new Set(answerKeys);
	if (!correctKeys.size
		|| correctKeys.size !== answerKeys.length
		|| new Set(variantKeys).size !== variantKeys.length
	) return null;

	const indexes = variantKeys.flatMap((variant, index) =>
		correctKeys.has(variant) ? [index] : []
	);

	return indexes.length === correctKeys.size ? indexes : null;
}

function normalizedSet(values: readonly string[]): string {
	return JSON.stringify(values.map(normalizeText).sort());
}

function collapseText(value: string | null | undefined): string {
	return value?.replace(/\s+/g, ' ').trim() ?? '';
}
