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
 * Headless-компонент автоматического прохождения теста.
 *
 * Пока функция включена, компонент ждёт найденный в {@link answerCache} ответ,
 * отсутствие движения мыши и допустимый статус панели. После случайной задержки
 * он отмечает правильные варианты, переходит к следующему вопросу и при
 * необходимости подтверждает завершение теста.
 *
 * @returns `null`, так как компонент управляет только DOM страницы НМО.
 */
const AutoSolveLoader = () => {

	const {enabled: autoSolveEnabled, delayMinSeconds: autoSolveDelayMinSeconds, delayMaxSeconds: autoSolveDelayMaxSeconds} = useSettings().autoSolve;
	const {status} = usePanelStatus();
	const {topic, question, variants, isSingle} = useQuestionFinder();

	const completedAnswerIdRef = useRef('');
	const plannedAnswerRef = useRef<IPlannedAutoSolve | null>(null);
	const mouseIdleTimerRef = useRef<number | null>(null);
	const mouseActiveRef = useRef(false);
	const runningRef = useRef(false);

	useEffect(() => {

		/**
		 * Приостанавливает запланированный автоответ до истечения периода
		 * бездействия после последнего движения мыши.
		 *
		 * @returns Ничего не возвращает.
		 */
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

			if (!canAutoSolveWithStatus(status.status)) return plannedAnswerRef.current = null;
			if (mouseActiveRef.current) return plannedAnswerRef.current = null;

			if (runningRef.current) return;

			if (!question || !variants.length) return plannedAnswerRef.current = null;


			const cached = answerCache.get(topic ?? '', question, variants);

			if (!cached?.idx.length) return plannedAnswerRef.current = null;


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

			void runAutoSolve(planned.idx).finally(() => runningRef.current = false);

		}, AUTO_SOLVE_CHECK_INTERVAL_MS);

		return () => {window.clearInterval(timer);plannedAnswerRef.current = null;};
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

/**
 * Вычисляет случайную задержку запуска в заданном диапазоне.
 *
 * Нижняя граница ограничивается нулём и верхним значением, а результат
 * округляется до целого количества миллисекунд.
 *
 * @param minSeconds Минимальная задержка в секундах.
 * @param maxSeconds Максимальная задержка в секундах.
 * @returns Случайную задержку в миллисекундах, включая границы диапазона.
 */
function getRandomDelayMs(minSeconds: number, maxSeconds: number): number {
	const min = Math.max(0, Math.min(minSeconds, maxSeconds));
	const max = Math.max(min, maxSeconds);
	return Math.round((min + Math.random() * (max - min)) * 1000);
}

/**
 * Проверяет, разрешает ли текущий статус панели автоматический ответ.
 *
 * @param status Текущий статус панели поиска ответа.
 * @returns `true` для успешного результата или предупреждения.
 */
function canAutoSolveWithStatus(status: typeof Status[keyof typeof Status]): boolean {
	return status === Status.OK || status === Status.WARN;
}

/**
 * Выбирает правильные варианты и запускает переход к следующему вопросу.
 *
 * @param correctIndexes 0-индексированные позиции правильных вариантов.
 * @returns Промис, который завершается после обработки кнопки перехода.
 */
async function runAutoSolve(correctIndexes: number[]): Promise<void> {
	await clickAnswerIndexes(correctIndexes);
	await wait(NEXT_CLICK_DELAY_MS);
	await clickNextQuestionButton();
}

/**
 * Определяет тип текущего вопроса и выбирает переданные варианты ответа.
 *
 * Для вопроса с одним вариантом используется только первый индекс. Для вопроса
 * с несколькими вариантами состояние всех checkbox синхронизируется с ответом.
 *
 * @param correctIndexes 0-индексированные позиции правильных вариантов.
 * @returns Промис, который завершается после выбора вариантов.
 */
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

/**
 * Синхронизирует checkbox-варианты с набором правильных индексов.
 *
 * После каждого клика функция заново дожидается DOM страницы, поскольку портал
 * НМО может перерисовать список вариантов целиком.
 *
 * @param correctIndexes 0-индексированные позиции правильных вариантов.
 * @returns Промис, который завершается после проверки всех вариантов.
 */
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

/**
 * Выбирает один radio-вариант ответа по его позиции.
 *
 * Если связанный `input` отсутствует, выполняется резервный клик по контейнеру
 * варианта.
 *
 * @param index 0-индексированная позиция правильного варианта.
 * @returns Ничего не возвращает.
 */
function clickSingleAnswerIndex(index: number | undefined): void {
	if (index === undefined) return;

	const target = getAnswerTargetAt(index);
	const control = target?.control ?? null;
	if (target && control && !control.disabled && !control.checked) {
		clickAnswerControl(control, target.variantElement);
		return;
	}

	if (!control) getVariantElements()[index]?.click();
}

/**
 * Находит актуальный DOM-контейнер варианта и связанный с ним элемент ввода.
 *
 * @param index 0-индексированная позиция варианта.
 * @returns Найденную пару элементов или `null`, если вариант недоступен.
 */
function getAnswerTargetAt(index: number): {control: HTMLInputElement; variantElement: HTMLElement} | null {
	const variantElement = getVariantElements()[index];
	if (!variantElement) return null;

	const control = getAnswerInput(variantElement);
	if (!control) return null;

	return {control, variantElement};
}

/**
 * Нажимает элемент ввода, используя кликабельную область варианта как fallback.
 *
 * Резервный клик выполняется только тогда, когда прямой клик по `input` не
 * изменил его состояние.
 *
 * @param control Элемент `radio` или `checkbox` варианта.
 * @param variantElement DOM-контейнер этого варианта.
 * @returns Ничего не возвращает.
 */
function clickAnswerControl(control: HTMLInputElement, variantElement: HTMLElement): void {
	const checkedBefore = control.checked;
	control.click();

	if (control.checked !== checkedBefore) return;

	getAnswerClickTarget(variantElement).click();
}

/**
 * Создаёт асинхронную паузу через браузерный таймер.
 *
 * @param ms Продолжительность паузы в миллисекундах.
 * @returns Промис, который разрешается после истечения таймера.
 */
function wait(ms: number): Promise<void> {
	return new Promise(resolve => window.setTimeout(resolve, ms));
}

/**
 * Ожидает замены варианта ответа в DOM после клика и даёт странице время
 * завершить перерисовку.
 *
 * Если замена не обнаружена, ожидание наблюдателя завершается по тайм-ауту.
 *
 * @param previousVariantElement Контейнер варианта до клика.
 * @param index Позиция варианта, для которой ожидается новый DOM-элемент.
 * @returns Промис, который завершается после обновления или тайм-аута и паузы стабилизации.
 */
async function waitForAnswerDomRefresh(previousVariantElement: HTMLElement, index: number): Promise<void> {
	await new Promise<void>(resolve => {
		let done = false;
		let timeout = 0;
		let observer: MutationObserver | null = null;

		/** Завершает ожидание, освобождает таймер и отключает наблюдатель. */
		const finish = (): void => {
			if (done) return;
			done = true;
			window.clearTimeout(timeout);
			observer?.disconnect();
			resolve();
		};

		/** Возвращает `true`, когда вариант по тому же индексу заменён в DOM. */
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

/**
 * Нажимает доступную кнопку перехода к следующему вопросу.
 *
 * Если кнопка завершает тест, после клика дополнительно ожидается модальное
 * подтверждение завершения.
 *
 * @returns Промис, который завершается после возможного подтверждения.
 */
async function clickNextQuestionButton(): Promise<void> {
	const button = getNextQuestionButton();
	if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;

	const shouldConfirm = isQuestionFinishButton(button);
	button.click();
	if (shouldConfirm) await clickFinishConfirmIfShown();
}

/**
 * Ожидает кнопку подтверждения завершения теста и нажимает её, если она доступна.
 *
 * @returns Промис, который завершается после клика либо истечения тайм-аута.
 */
async function clickFinishConfirmIfShown(): Promise<void> {
	const button = await waitForFinishConfirmButton();
	if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;

	button.click();
}

/**
 * Ищет кнопку подтверждения завершения теста в текущем или обновлённом DOM.
 *
 * @returns Промис с найденной кнопкой либо `null` после истечения тайм-аута.
 */
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

		/**
		 * Завершает поиск и освобождает связанные с ним ресурсы.
		 *
		 * @param button Найденная кнопка или `null`, если поиск завершён по тайм-ауту.
		 */
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

/**
 * Проверяет, является ли кнопка навигации кнопкой завершения теста.
 *
 * @param button Проверяемая кнопка.
 * @returns `true`, если текст и положение кнопки соответствуют завершению теста.
 */
function isQuestionFinishButton(button: HTMLButtonElement): boolean {
	const text = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
	return text.includes('завершить тестирование')
		&& !!button.closest('.question-buttons');
}
