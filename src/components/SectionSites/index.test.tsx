import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NMO_API_TOPIC_ENDPOINT} from '../../api/fetch/fetch-nmo-api';
import SectionSites from './index';

interface ITestSearchResult {
	readonly source: 'primary' | 'secondary' | 'nmo-helper' | 'foo';
	readonly title: string;
	readonly url: string;
}

interface ITestVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ITestSearchResult[];
}

interface ITestAnswerModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: HTMLElement | null;
}

type VariantChange = (state: ITestVariantModel) => void;
type AnswerChange = (state: ITestAnswerModel) => void;

const testState = vi.hoisted(() => ({
	variantChange: null as VariantChange | null,
	answerChange: null as AnswerChange | null,
	answerRequest: null as null | {readonly url: string},
	setStatus: vi.fn(),
	setBugReportContext: vi.fn(),
	storageSet: vi.fn(),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({
		status: {title: '', status: 'idle'},
		setStatus: testState.setStatus,
	}),
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({
		topic: null,
		question: null,
		variants: [],
	}),
}));

vi.mock('../../contexts/BugReportContext', () => ({
	useBugReportContext: () => ({setBugReportContext: testState.setBugReportContext}),
}));

vi.mock('../../utils', () => ({
	storageSet: testState.storageSet,
}));

vi.mock('../../utils/answer-cache', () => ({
	answerCache: {
		has: vi.fn(() => false),
		set: vi.fn(),
	},
}));

vi.mock('../../utils/matching', () => ({
	detectSource: vi.fn(),
}));

vi.mock('../../utils/cases', () => ({
	extractCases: vi.fn(),
	findAnswers: vi.fn(),
}));

vi.mock('../Loader/VariantLoader', () => ({
	default: ({onChange}: {onChange: VariantChange}) => {
		testState.variantChange = onChange;
		return null;
	},
}));

vi.mock('../Loader/AnswerLoader', () => ({
	default: ({url, onChange}: {
		url: string;
		onChange: AnswerChange;
	}) => {
		if (url) {
			testState.answerChange = onChange;
			testState.answerRequest = {url};
		}
		return null;
	},
}));

describe('SectionSites', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testState.variantChange = null;
		testState.answerChange = null;
		testState.answerRequest = null;
	});

	it('показывает загрузку ответов в кнопке после выбора результата', async () => {
		const result = {
			source: 'primary' as const,
			title: 'Тестовый результат',
			url: 'https://rosmedicinfo.ru/test',
		};

		render(<SectionSites initialUrl=""/>);

		fireEvent.change(screen.getByPlaceholderText(/Например:/), {
			target: {value: 'Тест'},
		});

		act(() => {
			testState.variantChange?.({
				loading: false,
				error: null,
				data: [result],
			});
		});

		fireEvent.click(screen.getByRole('button', {name: /Тестовый результат/}));
		await waitFor(() => expect(testState.answerChange).not.toBeNull());

		act(() => {
			testState.answerChange?.({
				loading: true,
				error: null,
				data: null,
			});
		});

		const searchButton = screen.getByRole('button', {name: 'Загружаю ответы…'});
		expect(searchButton).toBeDisabled();
		expect(searchButton).toHaveAttribute('aria-busy', 'true');
	});

	it('передаёт URL с UID загрузчику и не сохраняет его в storage', async () => {
		const resultUrl = `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`;
		const result = {
			source: 'nmo-helper' as const,
			title: 'Вариант из NMO API',
			url: resultUrl,
		};

		render(<SectionSites initialUrl=""/>);

		act(() => {
			testState.variantChange?.({loading: false, error: null, data: [result]});
		});
		fireEvent.click(screen.getByRole('button', {name: /Вариант из NMO API/}));

		await waitFor(() => {
			expect(testState.answerRequest).toEqual({
				url: resultUrl,
			});
		});
		expect(testState.storageSet).not.toHaveBeenCalled();
	});
});
