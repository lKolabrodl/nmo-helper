import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import AIProxyLoader from './AIProxyLoader';

const flushPromises = () => new Promise(r => setTimeout(r, 0));

// Мокаем askAI
vi.mock('../../utils/ai-logic', () => ({
	askAI: vi.fn(),
	validateApiKey: vi.fn(),
	getApiModel: vi.fn((m: string) => m),
}));

// Мокаем answerCache
vi.mock('../../utils/answer-cache', () => ({
	answerCache: {
		get: vi.fn(() => null),
		set: vi.fn(),
		getCorrectIndexes: vi.fn(),
		isFresh: vi.fn(),
	},
}));

// Мокаем контексты напрямую
const mockSetStatus = vi.fn();

vi.mock('../../contexts/QuestionFinderContext', () => ({
	QuestionFinderProvider: ({ children }: { children: React.ReactNode }) => children,
	useQuestionFinder: () => ({
		topic: 'Кардиология',
		rawTopic: 'Кардиология',
		question: 'Что такое ЭКГ?',
		variants: ['вариант 1', 'вариант 2', 'вариант 3'],
		isSingle: true,
	}),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	PanelStatusProvider: ({ children }: { children: React.ReactNode }) => children,
	usePanelStatus: () => ({
		status: { title: '', status: 'idle' },
		setStatus: mockSetStatus,
	}),
}));

vi.mock('../../contexts/PanelUiContext', () => ({
	PanelUiProvider: ({ children }: { children: React.ReactNode }) => children,
	usePanelUi: () => ({
		mode: 'ai',
		setMode: vi.fn(),
		collapsed: false,
		setCollapsed: vi.fn(),
	}),
}));

import { askAI } from '../../utils/ai-logic';
import { answerCache } from '../../utils/answer-cache';

const mockAskAI = vi.mocked(askAI);
const mockCacheGet = vi.mocked(answerCache.get);

beforeEach(() => {
	vi.clearAllMocks();
	mockCacheGet.mockReturnValue(null);
});

describe('AIProxyLoader', () => {
	it('не вызывает askAI когда active=false', async () => {
		const onChange = vi.fn();
		await act(async () => {
			render(<AIProxyLoader active={false} apiKey="key" model="gpt-4o-mini" onChange={onChange} />);
			await flushPromises();
		});
		expect(mockAskAI).not.toHaveBeenCalled();
	});

	it('вызывает askAI когда active=true', async () => {
		mockAskAI.mockResolvedValue([0]);
		const onChange = vi.fn();

		await act(async () => {
			render(<AIProxyLoader active={true} apiKey="key" model="gpt-4o-mini" onChange={onChange} />);
			await flushPromises();
		});

		expect(mockAskAI).toHaveBeenCalledWith(
			'key', 'Что такое ЭКГ?', ['вариант 1', 'вариант 2', 'вариант 3'],
			true, 'Кардиология', 'gpt-4o-mini', undefined,
		);
	});

	it('записывает результат в кеш', async () => {
		mockAskAI.mockResolvedValue([1]);
		const onChange = vi.fn();

		await act(async () => {
			render(<AIProxyLoader active={true} apiKey="key" model="gpt-4o-mini" onChange={onChange} />);
			await flushPromises();
		});

		expect(answerCache.set).toHaveBeenCalled();
	});

	it('не вызывает askAI если ответ уже в кеше', async () => {
		mockCacheGet.mockReturnValue({ variants: [], source: 'ai' });
		const onChange = vi.fn();

		await act(async () => {
			render(<AIProxyLoader active={true} apiKey="key" model="gpt-4o-mini" onChange={onChange} />);
			await flushPromises();
		});

		expect(mockAskAI).not.toHaveBeenCalled();
	});

	it('вызывает onChange при ошибке askAI', async () => {
		mockAskAI.mockRejectedValue(new Error('ошибка сети'));
		const onChange = vi.fn();

		await act(async () => {
			render(<AIProxyLoader active={true} apiKey="key" model="gpt-4o-mini" onChange={onChange} />);
			await flushPromises();
		});

		expect(onChange).toHaveBeenCalledWith({ running: false, disabled: false });
	});
});
