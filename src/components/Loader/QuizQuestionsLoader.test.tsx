import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PAGE_STATE_UPDATED, type IPageQuestionState} from '../../patch/subscribePageState';
import {downloadQuizQuestions} from '../../utils/quiz-questions';
import QuizQuestionsLoader from './QuizQuestionsLoader';

vi.mock('../../utils/quiz-questions', async importOriginal => ({
	...await importOriginal<typeof import('../../utils/quiz-questions')>(),
	downloadQuizQuestions: vi.fn(),
}));

const TOPIC = 'Тестовая тема - 2026 - Контрольное тестирование';
const QUESTIONS = [
	{question: 'Первый вопрос', variants: ['Первый вариант', 'Второй вариант'], isSingle: true},
	{question: 'Второй вопрос', variants: ['Третий вариант', 'Четвёртый вариант'], isSingle: false},
];

beforeEach(() => {
	document.body.innerHTML = '';
	delete window.__NMO_HELPER_STATE__;
	vi.mocked(downloadQuizQuestions).mockClear();
});

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
	delete window.__NMO_HELPER_STATE__;
});

describe('QuizQuestionsLoader', () => {
	it('добавляет одну кнопку рядом с действиями теста и показывает все вопросы и варианты', async () => {
		const row = appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);

		const trigger = await screen.findByRole('button', {name: 'Показать вопросы'});
		expect(row.querySelector('.quiz-buttons')).toContainElement(trigger);
		fireEvent.click(trigger);

		const dialog = screen.getByRole('dialog', {name: 'Вопросы теста'});
		expect(within(dialog).getByText(TOPIC)).toBeInTheDocument();
		for (const item of QUESTIONS) {
			expect(within(dialog).getByText(item.question)).toBeInTheDocument();
			for (const variant of item.variants) {
				expect(within(dialog).getByText(variant)).toBeInTheDocument();
			}
		}
		expect(within(dialog).getByRole('button', {name: 'Закрыть'})).toBeInTheDocument();
		expect(within(dialog).getByRole('button', {name: 'Скачать TXT'})).toBeInTheDocument();
	});

	it('ждёт состояние, когда стартовый экран уже появился', async () => {
		appendStartScreen();
		render(<QuizQuestionsLoader/>);
		expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();

		publishState();

		expect(await screen.findByRole('button', {name: 'Показать вопросы'})).toBeInTheDocument();
	});

	it('ждёт стартовый экран, когда все вопросы уже появились в состоянии', async () => {
		setState();
		render(<QuizQuestionsLoader/>);
		expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();

		act(() => { appendStartScreen(); });

		expect(await screen.findByRole('button', {name: 'Показать вопросы'})).toBeInTheDocument();
	});

	it.each([
		{label: 'неполный список', count: 3, questions: QUESTIONS},
		{label: 'пустой список', count: 2, questions: []},
	])('не показывает кнопку: $label', async ({count, questions}) => {
		appendStartScreen(count);
		setState({questions});
		render(<QuizQuestionsLoader/>);

		await act(async () => {});

		expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();
	});

	it('не показывает вопросы из состояния другой темы', async () => {
		appendStartScreen();
		setState({topic: 'Другая тема - 2026 - Контрольное тестирование'});
		render(<QuizQuestionsLoader/>);

		await act(async () => {});

		expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();
	});

	it('не считает кнопки из разных блоков стартовым экраном', async () => {
		const firstRow = appendStartScreen();
		const secondRow = appendStartScreen();
		within(firstRow).getByRole('button', {name: 'Начать тестирование'}).remove();
		within(secondRow).getByRole('button', {name: 'Вернуться к обучению'}).remove();
		setState();
		render(<QuizQuestionsLoader/>);

		await act(async () => {});

		expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();
	});

	it('дожидается активной кнопки начала тестирования', async () => {
		const row = appendStartScreen();
		const start = within(row).getByRole('button', {name: 'Начать тестирование'});
		start.setAttribute('disabled', '');
		setState();
		render(<QuizQuestionsLoader/>);
		expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();

		act(() => { start.removeAttribute('disabled'); });

		expect(await screen.findByRole('button', {name: 'Показать вопросы'})).toBeInTheDocument();
	});

	it('не предлагает просмотр без индикатора полного количества вопросов', async () => {
		const row = appendStartScreen();
		row.querySelector('.quiz-info-col-indicators-item')?.remove();
		setState();
		render(<QuizQuestionsLoader/>);

		await act(async () => {});

		expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();
	});

	it('ждёт видимости стартового экрана внутри скрытого родителя', async () => {
		const row = appendStartScreen();
		const parent = document.createElement('div');
		parent.style.display = 'none';
		row.before(parent);
		parent.appendChild(row);
		setState();
		render(<QuizQuestionsLoader/>);

		await act(async () => {});
		expect(document.querySelector('.nmo-quiz-questions-trigger')).toBeNull();

		act(() => { parent.style.removeProperty('display'); });

		expect(await screen.findByRole('button', {name: 'Показать вопросы'})).toBeInTheDocument();
	});

	it('убирает кнопку и открытое окно, когда родитель стартового экрана скрывается', async () => {
		const row = appendStartScreen();
		const parent = document.createElement('div');
		row.before(parent);
		parent.appendChild(row);
		setState();
		render(<QuizQuestionsLoader/>);
		fireEvent.click(await screen.findByRole('button', {name: 'Показать вопросы'}));
		expect(screen.getByRole('dialog', {name: 'Вопросы теста'})).toBeInTheDocument();

		act(() => { parent.style.display = 'none'; });

		await waitFor(() => {
			expect(document.querySelector('.nmo-quiz-questions-trigger')).toBeNull();
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
	});

	it('сохраняет открытое окно после обновления состояния с теми же вопросами', async () => {
		appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		fireEvent.click(await screen.findByRole('button', {name: 'Показать вопросы'}));
		const dialog = screen.getByRole('dialog', {name: 'Вопросы теста'});

		publishState({questions: QUESTIONS.map(question => ({...question, variants: [...question.variants]}))});
		await act(async () => {});

		expect(screen.getByRole('dialog', {name: 'Вопросы теста'})).toBe(dialog);
		expect(within(dialog).getByText(QUESTIONS[0].question)).toBeInTheDocument();
	});

	it('закрывает старое окно при обновлении вопросов той же темы', async () => {
		appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		fireEvent.click(await screen.findByRole('button', {name: 'Показать вопросы'}));

		const questions = [{...QUESTIONS[0], question: 'Новый вопрос той же темы'}, QUESTIONS[1]];
		publishState({questions});

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', {name: 'Показать вопросы'}));
		const dialog = screen.getByRole('dialog', {name: 'Вопросы теста'});
		expect(within(dialog).getByText('Новый вопрос той же темы')).toBeInTheDocument();
		expect(within(dialog).queryByText(QUESTIONS[0].question)).not.toBeInTheDocument();
	});

	it('скачивает полный текущий список только после нажатия «Скачать TXT»', async () => {
		appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		fireEvent.click(await screen.findByRole('button', {name: 'Показать вопросы'}));
		expect(downloadQuizQuestions).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', {name: 'Скачать TXT'}));

		expect(downloadQuizQuestions).toHaveBeenCalledExactlyOnceWith({topic: TOPIC, questions: QUESTIONS});
	});

	it.each(['button', 'escape'] as const)('закрывает окно: %s', async method => {
		appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		const trigger = await screen.findByRole('button', {name: 'Показать вопросы'});
		trigger.focus();
		fireEvent.click(trigger);
		expect(screen.getByRole('dialog', {name: 'Вопросы теста'})).toBeInTheDocument();

		if (method === 'button') fireEvent.click(screen.getByRole('button', {name: 'Закрыть'}));
		else fireEvent.keyDown(document, {key: 'Escape'});

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(trigger).toBeInTheDocument();
		expect(document.activeElement).toBe(trigger);
		expect(downloadQuizQuestions).not.toHaveBeenCalled();
	});

	it('убирает кнопку и открытое окно при сбросе состояния', async () => {
		appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		fireEvent.click(await screen.findByRole('button', {name: 'Показать вопросы'}));

		publishState(null);

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
			expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();
		});
	});

	it('закрывает окно при уходе со стартового экрана и вновь добавляет кнопку после возврата', async () => {
		const row = appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		fireEvent.click(await screen.findByRole('button', {name: 'Показать вопросы'}));

		act(() => { row.remove(); });

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
			expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();
		});
		act(() => { appendStartScreen(); });
		expect(await screen.findByRole('button', {name: 'Показать вопросы'})).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('не оставляет открытым окно старой темы при обновлении заголовка страницы', async () => {
		const row = appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		fireEvent.click(await screen.findByRole('button', {name: 'Показать вопросы'}));

		act(() => {
			row.querySelector('.mat-card-title-quiz-custom')!.textContent = 'Другая тема';
		});

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
			expect(screen.queryByRole('button', {name: 'Показать вопросы'})).not.toBeInTheDocument();
		});
	});

	it('не дублирует кнопку после повторных событий состояния и перерисовки страницы', async () => {
		const row = appendStartScreen();
		setState();
		render(<QuizQuestionsLoader/>);
		const trigger = await screen.findByRole('button', {name: 'Показать вопросы'});

		for (let i = 0; i < 3; i++) {
			publishState();
			act(() => { row.appendChild(document.createTextNode(' ')); });
		}
		await act(async () => {});

		expect(screen.getAllByRole('button', {name: 'Показать вопросы'})).toHaveLength(1);
		expect(trigger).toBeInTheDocument();
	});

	it('удаляет вынесенную кнопку и окно при размонтировании', async () => {
		appendStartScreen();
		setState();
		const {unmount} = render(<QuizQuestionsLoader/>);
		const trigger = await screen.findByRole('button', {name: 'Показать вопросы'});
		fireEvent.click(trigger);

		unmount();

		expect(trigger).not.toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});
});

function appendStartScreen(count = 2): HTMLElement {
	const row = document.createElement('div');
	row.className = 'quiz-info-row';
	row.innerHTML = `
		<div class="quiz-info-col">
			<mat-card-title class="mat-card-title-quiz-custom"> ${TOPIC} </mat-card-title>
			<div class="quiz-info-col-indicators-item">
				<lib-status-indicator><div class="info-display">
					<div class="text text_label">Количество\nвопросов</div>
					<div class="text text_value">${count}</div>
				</div></lib-status-indicator>
			</div>
		</div>
		<div class="quiz-buttons"><mat-card-actions class="mat-mdc-card-actions mdc-card__actions">
			<button type="button" class="quiz-buttons-stroked"><span>Вернуться к обучению</span></button>
			<button type="button" class="quiz-buttons-primary"><span>Начать тестирование</span></button>
		</mat-card-actions></div>`;
	document.body.appendChild(row);
	return row;
}

function setState(overrides: Partial<IPageQuestionState> = {}): void {
	window.__NMO_HELPER_STATE__ = {topic: TOPIC, question: null, questions: QUESTIONS, ...overrides};
}

function publishState(overrides: Partial<IPageQuestionState> | null = {}): void {
	act(() => {
		if (overrides === null) window.__NMO_HELPER_STATE__ = null;
		else setState(overrides);
		window.dispatchEvent(new Event(PAGE_STATE_UPDATED));
	});
}
