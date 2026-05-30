import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {useSettings} from '../../contexts/SettingsContext';
import {getFinishQuizButton, getQuizActionsElement} from '../../utils';
import './styles.scss';

const STATUS_HOST_ID = 'nmo-quiz-actions-status-host';

const QuizActionsStatus: React.FC = () => {
	const {autoSolveEnabled} = useSettings();
	const [host, setHost] = useState<HTMLElement | null>(null);

	useEffect(() => {
		let disposed = false;

		const syncHost = (): void => {
			if (!autoSolveEnabled) {
				setHostIfChanged(setHost, null);
				document.getElementById(STATUS_HOST_ID)?.remove();
				return;
			}

			const actions = getQuizActionsElement();
			const finishButton = actions ? getFinishQuizButton(actions) : null;

			if (!actions || !finishButton) {
				setHostIfChanged(setHost, null);
				return;
			}

			let nextHost = actions.querySelector<HTMLElement>(`#${STATUS_HOST_ID}`);
			if (!nextHost) {
				nextHost = document.createElement('div');
				nextHost.id = STATUS_HOST_ID;
				nextHost.className = 'nmo-quiz-actions-status-host';
			}

			if (nextHost.parentElement !== actions || finishButton.nextSibling !== nextHost) {
				finishButton.after(nextHost);
			}

			setHostIfChanged(setHost, nextHost);
		};

		syncHost();

		const observer = new MutationObserver(() => {
			if (!disposed) syncHost();
		});
		observer.observe(document.body, {childList: true, subtree: true});

		return () => {
			disposed = true;
			observer.disconnect();
			const currentHost = document.getElementById(STATUS_HOST_ID);
			currentHost?.remove();
		};
	}, [autoSolveEnabled]);

	if (!host || !autoSolveEnabled) return null;

	return createPortal(
		<div className="nmo-quiz-actions-status" aria-live="polite">
			<span className="nmo-quiz-actions-status-item on">
				<span className="nmo-quiz-actions-status-dot"/>
				<span className="nmo-quiz-actions-status-label">Автоответ</span>
				<span className="nmo-quiz-actions-status-value">вкл</span>
			</span>
		</div>,
		host
	);
};

export default QuizActionsStatus;

function setHostIfChanged(
	setHost: React.Dispatch<React.SetStateAction<HTMLElement | null>>,
	nextHost: HTMLElement | null
): void {
	setHost(currentHost => currentHost === nextHost ? currentHost : nextHost);
}
