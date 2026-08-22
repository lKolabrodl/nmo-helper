import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Status} from '../../types';
import {StatusTitle} from '../../utils/constants';
import AIProxyLoader from './AIProxyLoader';

const mocks = vi.hoisted(() => ({
	askAI: vi.fn(),
	answerCacheHas: vi.fn(),
	answerCacheSet: vi.fn(),
	setStatus: vi.fn(),
	useQuestionFinder: vi.fn(),
}));

vi.mock('../../api/fetch/fetch-ai', () => ({
	askAI: mocks.askAI,
}));

vi.mock('../../utils/answer-cache', () => ({
	answerCache: {
		has: mocks.answerCacheHas,
		set: mocks.answerCacheSet,
	},
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: mocks.useQuestionFinder,
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({setStatus: mocks.setStatus}),
}));

const QUESTION = {
	question: 'Какой вариант верный?',
	variants: ['Первый', 'Второй', 'Третий'],
	isSingle: true,
	topic: 'Кардиология',
};

describe('AIProxyLoader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.answerCacheHas.mockReturnValue(false);
		mocks.useQuestionFinder.mockReturnValue(QUESTION);
	});

	it('запрашивает AI и сохраняет одиночный ответ', async () => {
		mocks.askAI.mockResolvedValue([1]);
		const onChange = vi.fn();

		render(<AIProxyLoader active apiKey="secret" model="gpt-test" onChange={onChange}/>);

		await waitFor(() => {
			expect(mocks.setStatus).toHaveBeenLastCalledWith({
				title: 'AI: вариант 2',
				status: Status.OK,
			});
		});
		expect(mocks.askAI).toHaveBeenCalledWith(
			'secret',
			QUESTION.question,
			QUESTION.variants,
			true,
			QUESTION.topic,
			'gpt-test',
			undefined,
		);
		expect(mocks.answerCacheSet).toHaveBeenCalledWith(
			QUESTION.topic,
			QUESTION.question,
			QUESTION.variants,
			['Второй'],
		);
		expect(onChange).toHaveBeenCalledWith({running: true, disabled: false});
		expect(mocks.setStatus).toHaveBeenCalledWith({
			title: StatusTitle.AI_THINKING,
			status: Status.LOADING,
		});
	});

	it('показывает все номера для множественного ответа', async () => {
		mocks.askAI.mockResolvedValue([0, 2]);

		render(<AIProxyLoader active apiKey="key" model="model" onChange={vi.fn()}/>);

		await waitFor(() => {
			expect(mocks.setStatus).toHaveBeenLastCalledWith({
				title: 'AI: варианты 1, 3',
				status: Status.OK,
			});
		});
		expect(mocks.answerCacheSet).toHaveBeenCalledWith(
			QUESTION.topic,
			QUESTION.question,
			QUESTION.variants,
			['Первый', 'Третий'],
		);
	});

	it('передаёт адрес пользовательского endpoint', async () => {
		mocks.askAI.mockResolvedValue([0]);

		render(
			<AIProxyLoader
				active
				apiKey="token"
				model="custom-model"
				aiUrl="https://ai.example/v1"
				onChange={vi.fn()}/>,
		);

		await waitFor(() => expect(mocks.askAI).toHaveBeenCalled());
		expect(mocks.askAI).toHaveBeenCalledWith(
			'token',
			QUESTION.question,
			QUESTION.variants,
			true,
			QUESTION.topic,
			'custom-model',
			'https://ai.example/v1',
		);
	});

	it('показывает предупреждение, когда AI не выбрал вариант', async () => {
		mocks.askAI.mockResolvedValue([]);

		render(<AIProxyLoader active apiKey="key" model="model" onChange={vi.fn()}/>);

		await waitFor(() => {
			expect(mocks.setStatus).toHaveBeenLastCalledWith({
				title: StatusTitle.AI_NO_ANSWER,
				status: Status.WARN,
			});
		});
		expect(mocks.answerCacheSet).not.toHaveBeenCalled();
	});

	it('останавливает режим и показывает текст ошибки запроса', async () => {
		mocks.askAI.mockRejectedValue(new Error('неверный API-ключ'));
		const onChange = vi.fn();

		render(<AIProxyLoader active apiKey="bad" model="model" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({running: false, disabled: false});
		});
		expect(mocks.setStatus).toHaveBeenLastCalledWith({
			title: 'неверный API-ключ',
			status: Status.ERR,
		});
		expect(mocks.answerCacheSet).not.toHaveBeenCalled();
	});

	it.each([
		{name: 'режим выключен', active: false, question: QUESTION, cached: false},
		{name: 'нет вопроса', active: true, question: {...QUESTION, question: null}, cached: false},
		{name: 'нет вариантов', active: true, question: {...QUESTION, variants: []}, cached: false},
		{name: 'ответ уже есть в кеше', active: true, question: QUESTION, cached: true},
	])('не запускает запрос: $name', ({active, question, cached}) => {
		mocks.useQuestionFinder.mockReturnValue(question);
		mocks.answerCacheHas.mockReturnValue(cached);

		render(<AIProxyLoader active={active} apiKey="key" model="model" onChange={vi.fn()}/>);

		expect(mocks.askAI).not.toHaveBeenCalled();
		expect(mocks.answerCacheSet).not.toHaveBeenCalled();
	});

	it('игнорирует завершение запроса после размонтирования', async () => {
		let resolveRequest!: (indexes: number[]) => void;
		mocks.askAI.mockReturnValue(new Promise<number[]>(resolve => { resolveRequest = resolve; }));
		const {unmount} = render(
			<AIProxyLoader active apiKey="key" model="model" onChange={vi.fn()}/>,
		);
		await waitFor(() => expect(mocks.askAI).toHaveBeenCalledOnce());

		unmount();
		await act(async () => resolveRequest([0]));

		expect(mocks.answerCacheSet).not.toHaveBeenCalled();
		expect(mocks.setStatus).not.toHaveBeenCalledWith(expect.objectContaining({status: Status.OK}));
	});
});
