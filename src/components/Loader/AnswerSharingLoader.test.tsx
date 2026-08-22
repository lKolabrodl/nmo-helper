import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import AnswerSharingLoader, {createAnswerSharingSnapshot} from './AnswerSharingLoader';

const mocks = vi.hoisted(() => ({
	sharingEnabled: false,
	setSharingEnabled: vi.fn(),
	cacheQuestions: new Map<string, {
		readonly variants: readonly string[];
		readonly selectedVariants: readonly string[];
	}>(),
	getCachedQuestion: vi.fn(),
	submitSharedQuestions: vi.fn(),
}));

vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({
		testDataSharing: {
			enabled: mocks.sharingEnabled,
			setEnabled: mocks.setSharingEnabled,
		},
	}),
}));

vi.mock('../../utils/question-cache', () => ({
	questionCache: {get: mocks.getCachedQuestion},
}));

vi.mock('../../api/fetch/submit-shared-questions', () => ({
	submitSharedQuestions: mocks.submitSharedQuestions,
}));

beforeEach(() => {
	document.body.innerHTML = '';
	mocks.sharingEnabled = false;
	mocks.setSharingEnabled.mockReset();
	mocks.submitSharedQuestions.mockReset();
	mocks.submitSharedQuestions.mockResolvedValue(undefined);
	mocks.cacheQuestions.clear();
	mocks.cacheQuestions.set('Первый вопрос', {
		variants: ['A1', 'A2'],
		selectedVariants: ['A2'],
	});
	mocks.cacheQuestions.set('Второй вопрос', {
		variants: ['B1', 'B2'],
		selectedVariants: ['B1'],
	});
	mocks.cacheQuestions.set('Третий вопрос', {
		variants: ['C1', 'C2', 'C3'],
		selectedVariants: ['C1', 'C3'],
	});
	mocks.getCachedQuestion.mockReset();
	mocks.getCachedQuestion.mockImplementation(
		(_topic: string, question: string) => mocks.cacheQuestions.get(question) ?? null,
	);
});

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
});

describe('createAnswerSharingSnapshot', () => {
	it('собирает только вопросы со статусом «Верно»', () => {
		document.body.innerHTML = createResultsMarkup([
			resultItem(99, 'Первый вопрос', 'correct', ['Ответ из итогов не используется']),
			resultItem(2, 'Второй вопрос', 'wrong', ['B1']),
			resultItem(1, 'Третий вопрос', 'correct', []),
		]);
		const results = document.querySelector<HTMLElement>('.questionList')!;

		expect(createAnswerSharingSnapshot(results)).toMatchObject({
			title: 'Кардиология - 2025',
			questions: [
				{
					text: 'Первый вопрос',
					options: ['A1', 'A2'],
					correct_indexes: [1],
				},
				{
					text: 'Третий вопрос',
					options: ['C1', 'C2', 'C3'],
					correct_indexes: [0, 2],
				},
			],
		});
		expect(mocks.getCachedQuestion).toHaveBeenCalledWith(
			'Кардиология - 2025',
			'Первый вопрос',
		);
	});

	it('различает вопросы с одинаковым выбранным ответом по тексту вопроса', () => {
		mocks.cacheQuestions.set('Второй вопрос', {
			variants: ['A2', 'B2'],
			selectedVariants: ['A2'],
		});
		document.body.innerHTML = createResultsMarkup([
			resultItem(99, 'Первый вопрос', 'correct', []),
			resultItem(99, 'Второй вопрос', 'correct', []),
		]);

		expect(createAnswerSharingSnapshot(
			document.querySelector<HTMLElement>('.questionList')!,
		)?.questions).toEqual([
			{
				text: 'Первый вопрос',
				options: ['A1', 'A2'],
				correct_indexes: [1],
			},
			{
				text: 'Второй вопрос',
				options: ['A2', 'B2'],
				correct_indexes: [0],
			},
		]);
	});

	it('пропускает зелёный вопрос, которого нет в кеше', () => {
		document.body.innerHTML = createResultsMarkup([
			resultItem(8, 'Неизвестный вопрос', 'correct', ['Да']),
		]);

		expect(createAnswerSharingSnapshot(
			document.querySelector<HTMLElement>('.questionList')!,
		)).toBeNull();
	});

	it('пропускает неоднозначные выбранные варианты из кеша', () => {
		mocks.cacheQuestions.set('Некорректный вопрос', {
			variants: ['Да', 'Да'],
			selectedVariants: ['Да'],
		});
		document.body.innerHTML = createResultsMarkup([
			resultItem(1, 'Некорректный вопрос', 'correct', []),
		]);

		expect(createAnswerSharingSnapshot(
			document.querySelector<HTMLElement>('.questionList')!,
		)).toBeNull();
	});

	it.each([
		['correct' as const, 'два зелёных результата'],
		['wrong' as const, 'зелёный и неверный результаты'],
	])('не отправляет одинаковый вопрос: %s — %s', (secondStatus, _description) => {
		document.body.innerHTML = createResultsMarkup([
			resultItem(1, 'Первый вопрос', 'correct', []),
			resultItem(2, '  ПЕРВЫЙ   ВОПРОС  ', secondStatus, []),
		]);

		expect(createAnswerSharingSnapshot(
			document.querySelector<HTMLElement>('.questionList')!,
		)).toBeNull();
		expect(mocks.getCachedQuestion).not.toHaveBeenCalled();
	});
});

describe('AnswerSharingLoader', () => {
	it('после появления результатов показывает запрос согласия', async () => {
		render(<AnswerSharingLoader/>);

		document.body.insertAdjacentHTML('afterbegin', createResultsMarkup([
			resultItem(1, 'Первый вопрос', 'correct', ['A2']),
		]));

		expect(await screen.findByRole('dialog', {name: 'Помочь другим врачам?'}))
			.toBeInTheDocument();
		expect(document.querySelector('.nmo-answer-sharing-mascot'))
			.toHaveAttribute('src', 'chrome-extension://nmo-helper/icons/new_icon.png');
		expect(mocks.submitSharedQuestions).not.toHaveBeenCalled();
	});

	it('запоминает согласие и блокирует «Нет» при включённом запоминании', async () => {
		document.body.innerHTML = createResultsMarkup([
			resultItem(1, 'Первый вопрос', 'correct', ['A2']),
		]);
		render(<AnswerSharingLoader/>);
		await screen.findByRole('dialog');

		fireEvent.click(screen.getByRole('checkbox', {name: 'Запомнить выбор'}));
		expect(screen.getByRole('button', {name: 'Нет'})).toBeDisabled();

		fireEvent.click(screen.getByRole('button', {name: 'Да, поделиться'}));

		expect(mocks.setSharingEnabled).toHaveBeenCalledWith(true);
		expect(mocks.submitSharedQuestions).toHaveBeenCalledWith(
			'Кардиология - 2025',
			[{
				text: 'Первый вопрос',
				options: ['A1', 'A2'],
				correct_indexes: [1],
			}],
		);
	});

	it('по кнопке «Нет» закрывает окно без отправки и сохранения настройки', async () => {
		document.body.innerHTML = createResultsMarkup([
			resultItem(1, 'Первый вопрос', 'correct', ['A2']),
		]);
		render(<AnswerSharingLoader/>);
		await screen.findByRole('dialog');

		fireEvent.click(screen.getByRole('button', {name: 'Нет'}));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(mocks.setSharingEnabled).not.toHaveBeenCalled();
		expect(mocks.submitSharedQuestions).not.toHaveBeenCalled();
	});

	it('после отказа снова спрашивает на новой попытке теста', async () => {
		document.body.innerHTML = createResultsMarkup([
			resultItem(1, 'Первый вопрос', 'correct', ['A2']),
		]);
		render(<AnswerSharingLoader/>);
		await screen.findByRole('dialog');

		fireEvent.click(screen.getByRole('button', {name: 'Нет'}));
		document.querySelector('lib-quiz-page')?.remove();
		document.body.insertAdjacentHTML('afterbegin', createResultsMarkup([
			resultItem(1, 'Первый вопрос', 'correct', ['A2']),
		]));

		expect(await screen.findByRole('dialog')).toBeInTheDocument();
		expect(mocks.submitSharedQuestions).not.toHaveBeenCalled();
	});

	it('при включённой настройке отправляет автоматически без модального окна', async () => {
		mocks.sharingEnabled = true;
		document.body.innerHTML = createResultsMarkup([
			resultItem(1, 'Первый вопрос', 'correct', ['A2']),
		]);

		render(<AnswerSharingLoader/>);

		await waitFor(() => expect(mocks.submitSharedQuestions).toHaveBeenCalledOnce());
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});
});

type ResultStatus = 'correct' | 'wrong' | 'noanswer';

function createResultsMarkup(items: readonly string[]): string {
	return `
		<lib-quiz-page>
			<div class="mat-card-title-quiz-custom">
				Кардиология - 2025 - Контрольное тестирование
			</div>
			<div class="text_value text-success">Завершен</div>
			<lib-questions-list>
				<div class="questionList">${items.join('')}</div>
			</lib-questions-list>
		</lib-quiz-page>
	`;
}

function resultItem(
	number: number,
	title: string,
	status: ResultStatus,
	answers: readonly string[],
): string {
	const statusMarkup = status === 'correct'
		? '<div class="questionList-item-status-wright">Верно</div>'
		: status === 'wrong'
			? '<div class="questionList-item-status-wrong">Неверно</div>'
			: '<div class="questionList-item-status-noanswer">Ответ не дан</div>';
	const answersMarkup = answers
		.map(answer => `<span class="questionList-item-content-answer-text">${answer}</span>`)
		.join('');

	return `
		<div class="questionList-item">
			<div class="questionList-item-number">${number}</div>
			<div class="questionList-item-content-title">${title}</div>
			${answersMarkup}
			<div class="questionList-item-status">${statusMarkup}</div>
		</div>
	`;
}
