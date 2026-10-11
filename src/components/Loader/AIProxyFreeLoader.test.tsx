import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Status} from '../../types';
import {StatusTitle} from '../../utils/constants';
import AIProxyFreeLoader from './AIProxyFreeLoader';

const mocks = vi.hoisted(() => ({
	askFreeAI: vi.fn(),
	answerCacheHas: vi.fn(),
	answerCacheSet: vi.fn(),
	setStatus: vi.fn(),
	useQuestionFinder: vi.fn(),
}));

vi.mock('../../api/fetch/fetch-free-ai', () => ({
	askFreeAI: mocks.askFreeAI,
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

beforeEach(() => {
	vi.clearAllMocks();
	mocks.answerCacheHas.mockReturnValue(false);
	mocks.useQuestionFinder.mockReturnValue({
		question: 'Вопрос?',
		variants: ['Первый', 'Второй', 'Третий'],
		isSingle: true,
		topic: 'Тема',
	});
});

describe('AIProxyFreeLoader', () => {
	it.each(['GPT-OSS 120B', 'Qwen 3.8 27B', 'OVH', 'AI Horde'])('сохраняет ответ и показывает источник %s', async source => {
		mocks.askFreeAI.mockResolvedValue({correctIndexes: [1], source});
		const onChange = vi.fn();

		render(<AIProxyFreeLoader active onChange={onChange}/>);

		await waitFor(() => {
			expect(mocks.setStatus).toHaveBeenLastCalledWith({
				title: `AI · ${source}: вариант 2`,
				status: Status.OK,
			});
		});
		expect(mocks.askFreeAI).toHaveBeenCalledWith(
			'Вопрос?',
			['Первый', 'Второй', 'Третий'],
			true,
			'Тема',
			expect.objectContaining({signal: expect.any(AbortSignal), onRetry: expect.any(Function)}),
		);
		expect(mocks.answerCacheSet).toHaveBeenCalledWith(
			'Тема',
			'Вопрос?',
			['Первый', 'Второй', 'Третий'],
			['Второй'],
		);
		expect(onChange).toHaveBeenCalledWith({running: true, disabled: false});
		expect(mocks.setStatus).toHaveBeenCalledWith({
			title: StatusTitle.AI_THINKING,
			status: Status.LOADING,
		});
	});

	it('оставляет режим включённым после ошибки и решает следующий вопрос', async () => {
		mocks.askFreeAI.mockRejectedValueOnce(new Error('оба сервиса недоступны'))
			.mockResolvedValue({correctIndexes: [0], source: 'AI Horde'});
		const onChange = vi.fn();

		const {rerender} = render(<AIProxyFreeLoader active onChange={onChange}/>);

		await waitFor(() => {
			expect(mocks.setStatus).toHaveBeenLastCalledWith({
				title: 'оба сервиса недоступны',
				status: Status.ERR,
			});
		});
		expect(onChange).toHaveBeenLastCalledWith({running: true, disabled: false});
		expect(mocks.answerCacheSet).not.toHaveBeenCalled();

		mocks.useQuestionFinder.mockReturnValue({
			question: 'Следующий вопрос?',
			variants: ['Да', 'Нет'],
			isSingle: true,
			topic: 'Тема',
		});
		rerender(<AIProxyFreeLoader active onChange={onChange}/>);

		await waitFor(() => {
			expect(mocks.answerCacheSet).toHaveBeenCalledWith('Тема', 'Следующий вопрос?', ['Да', 'Нет'], ['Да']);
		});
		expect(mocks.setStatus).toHaveBeenLastCalledWith({title: 'AI · AI Horde: вариант 1', status: Status.OK});
		expect(onChange).not.toHaveBeenCalledWith({running: false, disabled: false});
	});

	it('показывает ожидание повтора и отменяет его при остановке', async () => {
		let finishRequest!: (answer: {correctIndexes: number[]; source: string}) => void;
		mocks.askFreeAI.mockReturnValue(new Promise(resolve => { finishRequest = resolve; }));
		const {rerender} = render(<AIProxyFreeLoader active onChange={vi.fn()}/>);
		const controls = mocks.askFreeAI.mock.calls[0][4];

		act(() => controls.onRetry({attempt: 2, maxAttempts: 3, delayMs: 3000, reason: 'ошибка 500'}));
		expect(mocks.setStatus).toHaveBeenLastCalledWith({
			title: 'AI Horde: ошибка 500. Повтор через 3 с (2/3)',
			status: Status.LOADING,
		});

		rerender(<AIProxyFreeLoader active={false} onChange={vi.fn()}/>);
		expect(controls.signal.aborted).toBe(true);
		const statusCalls = mocks.setStatus.mock.calls.length;
		await act(async () => {
			controls.onRetry({attempt: 3, maxAttempts: 3, delayMs: 6000, reason: 'ошибка 500'});
			finishRequest({correctIndexes: [0], source: 'AI Horde'});
		});
		expect(mocks.setStatus).toHaveBeenCalledTimes(statusCalls);
		expect(mocks.answerCacheSet).not.toHaveBeenCalled();
	});

	it('при смене вопроса отменяет старый запрос и игнорирует его ответ', async () => {
		let finishOldRequest!: (answer: {correctIndexes: number[]; source: string}) => void;
		mocks.askFreeAI.mockReturnValueOnce(new Promise(resolve => { finishOldRequest = resolve; }))
			.mockResolvedValue({correctIndexes: [1], source: 'OVH'});
		const {rerender} = render(<AIProxyFreeLoader active onChange={vi.fn()}/>);
		const oldControls = mocks.askFreeAI.mock.calls[0][4];

		mocks.useQuestionFinder.mockReturnValue({
			question: 'Новый вопрос?',
			variants: ['Да', 'Нет'],
			isSingle: true,
			topic: 'Тема',
		});
		rerender(<AIProxyFreeLoader active onChange={vi.fn()}/>);
		expect(oldControls.signal.aborted).toBe(true);
		await waitFor(() => {
			expect(mocks.answerCacheSet).toHaveBeenCalledWith('Тема', 'Новый вопрос?', ['Да', 'Нет'], ['Нет']);
		});
		await act(async () => finishOldRequest({correctIndexes: [0], source: 'AI Horde'}));
		expect(mocks.answerCacheSet).toHaveBeenCalledOnce();
		expect(mocks.setStatus).toHaveBeenLastCalledWith({title: 'AI · OVH: вариант 2', status: Status.OK});
	});

	it('не запускает запрос, пока бесплатный режим выключен', () => {
		render(<AIProxyFreeLoader active={false} onChange={vi.fn()}/>);

		expect(mocks.askFreeAI).not.toHaveBeenCalled();
	});
});
