import {render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import QuizActionsStatus from './index';

const context = vi.hoisted(() => ({
	enabled: true,
	actions: null as HTMLElement | null,
	finishButton: null as HTMLElement | null,
}));

vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({autoSolve: {enabled: context.enabled}}),
}));

vi.mock('../../utils', () => ({
	getQuizActionsElement: () => context.actions,
	getFinishQuizButton: () => context.finishButton,
}));

describe('QuizActionsStatus', () => {
	beforeEach(() => {
		context.enabled = true;
		context.actions = null;
		context.finishButton = null;
		document.body.innerHTML = '';
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('создаёт portal сразу после кнопки завершения теста', async () => {
		const {actions, finishButton, sibling} = createQuizActions();
		context.actions = actions;
		context.finishButton = finishButton;
		document.body.appendChild(actions);

		render(<QuizActionsStatus/>);

		await screen.findByText('Автоответ');
		const host = document.getElementById('nmo-quiz-actions-status-host');
		expect(host).not.toBeNull();
		expect(finishButton.nextSibling).toBe(host);
		expect(host?.nextSibling).toBe(sibling);
		expect(screen.getByText('вкл')).toBeInTheDocument();
		expect(host?.querySelector('[aria-live="polite"]')).toBeInTheDocument();
	});

	it('переиспользует существующий host и не создаёт дубликат', async () => {
		const {actions, finishButton} = createQuizActions();
		const existingHost = document.createElement('div');
		existingHost.id = 'nmo-quiz-actions-status-host';
		actions.prepend(existingHost);
		context.actions = actions;
		context.finishButton = finishButton;
		document.body.appendChild(actions);

		render(<QuizActionsStatus/>);

		await screen.findByText('Автоответ');
		expect(document.querySelectorAll('#nmo-quiz-actions-status-host')).toHaveLength(1);
		expect(finishButton.nextSibling).toBe(existingHost);
	});

	it('ждёт появления панели действий и синхронизируется через MutationObserver', async () => {
		render(<QuizActionsStatus/>);
		expect(screen.queryByText('Автоответ')).not.toBeInTheDocument();

		const {actions, finishButton} = createQuizActions();
		context.actions = actions;
		context.finishButton = finishButton;
		document.body.appendChild(actions);

		await screen.findByText('Автоответ');
		expect(finishButton.nextSibling).toHaveAttribute('id', 'nmo-quiz-actions-status-host');
	});

	it('не создаёт host без кнопки завершения', async () => {
		const actions = document.createElement('div');
		context.actions = actions;
		document.body.appendChild(actions);

		render(<QuizActionsStatus/>);

		await waitFor(() => {
			expect(document.getElementById('nmo-quiz-actions-status-host')).toBeNull();
		});
		expect(screen.queryByText('Автоответ')).not.toBeInTheDocument();
	});

	it('удаляет старый host, когда автоответ выключен', () => {
		context.enabled = false;
		const staleHost = document.createElement('div');
		staleHost.id = 'nmo-quiz-actions-status-host';
		document.body.appendChild(staleHost);

		render(<QuizActionsStatus/>);

		expect(document.getElementById('nmo-quiz-actions-status-host')).toBeNull();
		expect(screen.queryByText('Автоответ')).not.toBeInTheDocument();
	});

	it('удаляет созданный host при размонтировании', async () => {
		const {actions, finishButton} = createQuizActions();
		context.actions = actions;
		context.finishButton = finishButton;
		document.body.appendChild(actions);
		const {unmount} = render(<QuizActionsStatus/>);
		await screen.findByText('Автоответ');

		unmount();

		expect(document.getElementById('nmo-quiz-actions-status-host')).toBeNull();
	});
});

interface IQuizActionsFixture {
	readonly actions: HTMLDivElement;
	readonly finishButton: HTMLButtonElement;
	readonly sibling: HTMLSpanElement;
}

function createQuizActions(): IQuizActionsFixture {
	const actions = document.createElement('div');
	const finishButton = document.createElement('button');
	const sibling = document.createElement('span');
	finishButton.textContent = 'Завершить';
	sibling.textContent = 'После кнопки';
	actions.append(finishButton, sibling);
	return {actions, finishButton, sibling};
}
