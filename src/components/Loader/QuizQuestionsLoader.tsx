import {useCallback, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {PAGE_STATE_UPDATED} from '../../patch/subscribePageState';
import {queryAll, queryFirst} from '../../api/dom';
import type {IQuizQuestionsSnapshot} from '../../utils/quiz-questions';
import ModalQuizQuestions from '../ModalQuizQuestions';

const HOST_ID = 'nmo-quiz-questions-host';
const MASCOT_URL = chrome.runtime.getURL('icons/new_icon.png');

interface IQuizQuestionsView {
	readonly host: HTMLElement;
	readonly key: string;
	readonly snapshot: IQuizQuestionsSnapshot;
}

/** Показывает загруженные вопросы только на стартовом экране текущего теста. */
const QuizQuestionsLoader = () => {
	const [view, setView] = useState<IQuizQuestionsView | null>(null);
	const [opened, setOpened] = useState<IQuizQuestionsView | null>(null);

	const close = useCallback(() => setOpened(null), []);

	useEffect(() => {
		let host: HTMLElement | null = null;

		const sync = (): void => {
			const screen = findReadyQuiz();
			if (!screen) {
				host?.remove();
				host = null;
				setView(current => current === null ? current : null);
				setOpened(current => current === null ? current : null);
				return;
			}

			if (!host) {
				host = document.createElement('span');
				host.id = HOST_ID;
				host.className = 'nmo-quiz-questions-host';
			}
			if (host.parentElement !== screen.actions) screen.actions.appendChild(host);

			const next: IQuizQuestionsView = {
				host,
				key: JSON.stringify([window.location.href, screen.snapshot]),
				snapshot: screen.snapshot,
			};
			setView(current => current?.host === next.host && current.key === next.key ? current : next);
			setOpened(current => current?.host === next.host && current.key === next.key ? current : null);
		};

		sync();
		window.addEventListener(PAGE_STATE_UPDATED, sync);
		const observer = new MutationObserver(sync);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['hidden', 'disabled', 'aria-disabled', 'aria-hidden', 'class', 'style'],
		});

		return () => {
			window.removeEventListener(PAGE_STATE_UPDATED, sync);
			observer.disconnect();
			host?.remove();
		};
	}, []);

	return (
		<>
			{view && createPortal(
				<button
					type="button"
					className="nmo-quiz-questions-trigger"
					aria-haspopup="dialog"
					onClick={() => setOpened(view)}>
					<img className="nmo-quiz-questions-icon" src={MASCOT_URL} width={24} height={24} alt="" aria-hidden="true" draggable={false}/>
					Показать вопросы
				</button>,
				view.host,
			)}
			{opened && <ModalQuizQuestions snapshot={opened.snapshot} onClose={close}/>}
		</>
	);
};

export default QuizQuestionsLoader;

function findReadyQuiz(): {actions: HTMLElement; snapshot: IQuizQuestionsSnapshot} | null {
	const state = window.__NMO_HELPER_STATE__;

	if (!state?.topic?.trim() || !state.questions.length) return null;

	for (const row of queryAll<HTMLElement>('quizInfo')) {
		if (!isVisible(row)) continue;
		const actions = queryFirst<HTMLElement>('quizStartActions', row);
		if (!actions || !isVisible(actions)) continue;

		const buttons = [...actions.querySelectorAll<HTMLButtonElement>('button')].filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true' && isVisible(button));
		if (!buttons.some(button => text(button) === 'начать тестирование') || !buttons.some(button => text(button) === 'вернуться к обучению')) continue;

		// State и DOM обновляются независимо: не показываем данные предыдущей темы
		// или частичный список, из которого приёмник State отфильтровал вопросы.
		if (text(queryFirst('topic', row)) !== normalize(state.topic)) continue;

		const countIndicator = queryAll<HTMLElement>('quizInfoIndicator', row).find(indicator => text(queryFirst('indicatorLabel', indicator)) === 'количество вопросов');
		if (!countIndicator) continue;

		const count = queryFirst('indicatorValue', countIndicator)?.textContent?.replace(/\s/g, '') ?? '';
		if (!/^\d+$/.test(count) || Number(count) !== state.questions.length) continue;

		return {actions, snapshot: {topic: state.topic.trim(), questions: state.questions}};
	}
	return null;
}

function normalize(value: string): string {
	return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function text(element: Element | null): string {
	return normalize(element?.textContent ?? '');
}

function isVisible(element: HTMLElement): boolean {
	if (element.closest('[hidden], [aria-hidden="true"]')) return false;
	for (let current: HTMLElement | null = element; current; current = current.parentElement) {
		const style = window.getComputedStyle(current);
		if (style.display === 'none' || style.visibility === 'hidden') return false;
	}
	return true;
}
