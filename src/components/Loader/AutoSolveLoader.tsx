import {useEffect, useRef} from 'react';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useSettings} from '../../contexts/SettingsContext';
import {Status} from '../../types';
import {
	getAnswerClickTarget,
	getAnswerInput,
	getFinishQuizConfirmButton,
	getNextQuestionButton,
	getVariantElements,
} from '../../utils';
import {answerCache} from '../../utils/answer-cache';

const MOUSE_IDLE_DELAY_MS = 1500;
const NEXT_CLICK_DELAY_MS = 300;
const AUTO_SOLVE_CHECK_INTERVAL_MS = 300;
const MULTI_ANSWER_DOM_REFRESH_TIMEOUT_MS = 700;
const MULTI_ANSWER_DOM_SETTLE_MS = 500;
const FINISH_CONFIRM_TIMEOUT_MS = 5000;

interface IPlannedAutoSolve {
	readonly id: string;
	readonly idx: number[];
	readonly runAt: number;
}

/**
 * Заготовка автопрохождения.
 *
 * Сейчас только ждёт включённую настройку, найденный вопрос и готовый ответ
 * в answerCache. Реальное проставление вариантов и переход дальше будет
 * добавлено отдельным шагом.
 */
const AutoSolveLoader = () => {

	const {autoSolveEnabled, autoSolveDelayMinSeconds, autoSolveDelayMaxSeconds} = useSettings();
	const {status} = usePanelStatus();
	const {topic, question, variants, isSingle} = useQuestionFinder();

	const completedAnswerIdRef = useRef('');
	const plannedAnswerRef = useRef<IPlannedAutoSolve | null>(null);
	const mouseIdleTimerRef = useRef<number | null>(null);
	const mouseActiveRef = useRef(false);
	const runningRef = useRef(false);

	useEffect(() => {
		const markMouseActive = (): void => {
			mouseActiveRef.current = true;
			plannedAnswerRef.current = null;

			if (mouseIdleTimerRef.current !== null) window.clearTimeout(mouseIdleTimerRef.current);

			mouseIdleTimerRef.current = window.setTimeout(() => {
				mouseActiveRef.current = false;
				mouseIdleTimerRef.current = null;
			}, MOUSE_IDLE_DELAY_MS);

		};

		document.addEventListener('mousemove', markMouseActive);

		return () => {
			document.removeEventListener('mousemove', markMouseActive);
			if (mouseIdleTimerRef.current !== null) window.clearTimeout(mouseIdleTimerRef.current);
		};
	}, []);

	useEffect(() => {

		const timer = window.setInterval(() => {

			if (!autoSolveEnabled) {
				completedAnswerIdRef.current = '';
				plannedAnswerRef.current = null;
				return;
			}

			if (!canAutoSolveWithStatus(status.status)) {
				plannedAnswerRef.current = null;
				return;
			}

			if (mouseActiveRef.current) {
				plannedAnswerRef.current = null;
				return;
			}

			if (runningRef.current) return;
			if (!question || !variants.length) {
				plannedAnswerRef.current = null;
				return;
			}

			const cached = answerCache.get(topic ?? '', question, variants);
			if (!cached?.idx.length) {
				plannedAnswerRef.current = null;
				return;
			}

			const answerId = `${cached.id}::${isSingle ? 'single' : 'multi'}`;
			if (completedAnswerIdRef.current === answerId) return;

			const planned = plannedAnswerRef.current;
			if (!planned || planned.id !== answerId) {
				plannedAnswerRef.current = {
					id: answerId,
					idx: [...cached.idx],
					runAt: Date.now() + getRandomDelayMs(autoSolveDelayMinSeconds, autoSolveDelayMaxSeconds),
				};
				return;
			}

			if (Date.now() < planned.runAt) return;

			plannedAnswerRef.current = null;
			completedAnswerIdRef.current = answerId;
			runningRef.current = true;

			void runAutoSolve(planned.idx).finally(() => {
				runningRef.current = false;
			});
		}, AUTO_SOLVE_CHECK_INTERVAL_MS);

		return () => {
			window.clearInterval(timer);
			plannedAnswerRef.current = null;
		};
	}, [
		autoSolveEnabled,
		autoSolveDelayMinSeconds,
		autoSolveDelayMaxSeconds,
		status.status,
		status.title,
		topic,
		question,
		variants,
		isSingle,
	]);

	return null;
};

export default AutoSolveLoader;

function getRandomDelayMs(minSeconds: number, maxSeconds: number): number {
	const min = Math.max(0, Math.min(minSeconds, maxSeconds));
	const max = Math.max(min, maxSeconds);
	return Math.round((min + Math.random() * (max - min)) * 1000);
}

function canAutoSolveWithStatus(status: typeof Status[keyof typeof Status]): boolean {
	return status === Status.OK || status === Status.WARN;
}

async function runAutoSolve(correctIndexes: number[]): Promise<void> {
	await clickAnswerIndexes(correctIndexes);
	await wait(NEXT_CLICK_DELAY_MS);
	await clickNextQuestionButton();
}

async function clickAnswerIndexes(correctIndexes: number[]): Promise<void> {
	const elements = getVariantElements();
	if (!elements.length) return;

	const controls = elements.map(getAnswerInput);
	const isMultiChoice = controls.some(control => control?.type === 'checkbox');

	if (isMultiChoice) {
		await clickMultiAnswerIndexes(correctIndexes);
		return;
	}

	clickSingleAnswerIndex(correctIndexes[0]);
}

async function clickMultiAnswerIndexes(correctIndexes: number[]): Promise<void> {
	const correct = new Set(correctIndexes);
	const length = getVariantElements().length;

	for (let index = 0; index < length; index += 1) {
		const target = getAnswerTargetAt(index);
		if (!target || target.control.type !== 'checkbox' || target.control.disabled) continue;

		const shouldBeChecked = correct.has(index);
		if (target.control.checked === shouldBeChecked) continue;

		clickAnswerControl(target.control, target.variantElement);
		await waitForAnswerDomRefresh(target.variantElement, index);
	}
}

function clickSingleAnswerIndex(index: number | undefined): void {
	if (index === undefined) return;

	const target = getAnswerTargetAt(index);
	const control = target?.control ?? null;
	if (control && !control.disabled && !control.checked) {
		clickAnswerControl(control, target.variantElement);
		return;
	}

	if (!control) getVariantElements()[index]?.click();
}

function getAnswerTargetAt(index: number): {control: HTMLInputElement; variantElement: HTMLElement} | null {
	const variantElement = getVariantElements()[index];
	if (!variantElement) return null;

	const control = getAnswerInput(variantElement);
	if (!control) return null;

	return {control, variantElement};
}

function clickAnswerControl(control: HTMLInputElement, variantElement: HTMLElement): void {
	const checkedBefore = control.checked;
	control.click();

	if (control.checked !== checkedBefore) return;

	getAnswerClickTarget(variantElement).click();
}

function wait(ms: number): Promise<void> {
	return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForAnswerDomRefresh(previousVariantElement: HTMLElement, index: number): Promise<void> {
	await new Promise<void>(resolve => {
		let done = false;
		let timeout = 0;
		let observer: MutationObserver | null = null;

		const finish = (): void => {
			if (done) return;
			done = true;
			window.clearTimeout(timeout);
			observer?.disconnect();
			resolve();
		};

		const isRefreshed = (): boolean => {
			const currentVariantElement = getVariantElements()[index];
			return !!currentVariantElement && currentVariantElement !== previousVariantElement;
		};

		observer = new MutationObserver(() => {
			if (isRefreshed()) finish();
		});
		timeout = window.setTimeout(finish, MULTI_ANSWER_DOM_REFRESH_TIMEOUT_MS);

		observer.observe(document.body, {childList: true, subtree: true});

		if (isRefreshed()) finish();
	});

	await wait(MULTI_ANSWER_DOM_SETTLE_MS);
}

async function clickNextQuestionButton(): Promise<void> {
	const button = getNextQuestionButton();
	if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;

	const shouldConfirm = isQuestionFinishButton(button);
	button.click();
	if (shouldConfirm) await clickFinishConfirmIfShown();
}

async function clickFinishConfirmIfShown(): Promise<void> {
	const button = await waitForFinishConfirmButton();
	if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;

	button.click();
}

function waitForFinishConfirmButton(): Promise<HTMLButtonElement | null> {
	return new Promise(resolve => {
		const existingButton = getFinishQuizConfirmButton();
		if (existingButton) {
			resolve(existingButton);
			return;
		}

		let done = false;
		let timeout = 0;
		let observer: MutationObserver | null = null;

		const finish = (button: HTMLButtonElement | null): void => {
			if (done) return;
			done = true;
			window.clearTimeout(timeout);
			observer?.disconnect();
			resolve(button);
		};

		observer = new MutationObserver(() => {
			const button = getFinishQuizConfirmButton();
			if (button) finish(button);
		});
		timeout = window.setTimeout(() => finish(null), FINISH_CONFIRM_TIMEOUT_MS);

		observer.observe(document.body, {childList: true, subtree: true});
	});
}

function isQuestionFinishButton(button: HTMLButtonElement): boolean {
	const text = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
	return text.includes('завершить тестирование')
		&& !!button.closest('.question-buttons');
}
