import {render, waitFor} from '@testing-library/react';
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
	it('вызывает только автоматический бесплатный маршрут и сохраняет ответ', async () => {
		mocks.askFreeAI.mockResolvedValue({correctIndexes: [1], source: 'OVH'});
		const onChange = vi.fn();

		render(<AIProxyFreeLoader active onChange={onChange}/>);

		await waitFor(() => {
			expect(mocks.setStatus).toHaveBeenLastCalledWith({
				title: 'AI · OVH: вариант 2',
				status: Status.OK,
			});
		});
		expect(mocks.askFreeAI).toHaveBeenCalledWith(
			'Вопрос?',
			['Первый', 'Второй', 'Третий'],
			true,
			'Тема',
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

	it('останавливает бесплатный режим при ошибке маршрута', async () => {
		mocks.askFreeAI.mockRejectedValue(new Error('оба сервиса недоступны'));
		const onChange = vi.fn();

		render(<AIProxyFreeLoader active onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({running: false, disabled: false});
		});
		expect(mocks.setStatus).toHaveBeenLastCalledWith({
			title: 'оба сервиса недоступны',
			status: Status.ERR,
		});
	});

	it('не запускает запрос, пока бесплатный режим выключен', () => {
		render(<AIProxyFreeLoader active={false} onChange={vi.fn()}/>);

		expect(mocks.askFreeAI).not.toHaveBeenCalled();
	});
});
