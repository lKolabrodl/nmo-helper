import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NMO_API_TOPIC_ENDPOINT, StatusTitle} from '../../utils/constants';
import SectionSites from './index';

interface ITestSearchResult {
	readonly source: 'first' | 'second' | 'third' | 'nmo-helper';
	readonly title: string;
	readonly url: string;
}

interface ITestVariantModel {
	readonly loading: boolean;
	readonly firstLoading: boolean;
	readonly error: string | null;
	readonly data: ITestSearchResult[];
}

interface ITestAnswerModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: Array<{
		readonly question: string;
		readonly variants: string[];
		readonly answers: string[];
		readonly idx: number;
	}> | null;
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
	stripAnswerTitlePrefix: (title: string) => title,
}));

vi.mock('../../utils/cases', () => ({
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

	it('показывает только поиск без вкладок и ручного ввода URL', () => {
		render(<SectionSites initialUrl="https://example.com/answers"/>);

		expect(screen.getByRole('button', {name: 'Найти все варианты'})).toBeInTheDocument();
		expect(screen.queryByRole('button', {name: 'Найти тест'})).not.toBeInTheDocument();
		expect(screen.queryByRole('button', {name: 'URL'})).not.toBeInTheDocument();
		expect(screen.queryByLabelText('URL базы ответов')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', {name: 'Запустить'})).not.toBeInTheDocument();
	});

	it('показывает загрузку ответов в кнопке после выбора результата', async () => {
		const result = {
			source: 'first' as const,
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
				firstLoading: false,
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
			testState.variantChange?.({loading: false, firstLoading: false, error: null, data: [result]});
		});
		fireEvent.click(screen.getByRole('button', {name: /Вариант из NMO API/}));

		await waitFor(() => {
			expect(testState.answerRequest).toEqual({
				url: resultUrl,
			});
		});
		expect(testState.storageSet).not.toHaveBeenCalled();
	});

	it('позволяет выбрать первый результат, пока остальные источники ещё загружаются', async () => {
		const result: ITestSearchResult = {source: 'first', title: 'Первый результат', url: 'https://rosmedicinfo.ru/first'};
		const laterResult: ITestSearchResult = {source: 'second', title: 'Поздний результат', url: 'https://24forcare.com/later'};
		render(<SectionSites initialUrl=""/>);

		act(() => {
			testState.variantChange?.({loading: true, firstLoading: true, error: null, data: []});
		});
		expect(screen.getByRole('button', {name: 'Ищу в базе…'})).toBeDisabled();
		expect(screen.queryByText('Ещё подгружаются результаты…')).not.toBeInTheDocument();

		act(() => {
			testState.variantChange?.({loading: true, firstLoading: false, error: null, data: [result]});
		});
		expect(screen.getByRole('status')).toHaveTextContent('Ещё подгружаются результаты…');
		const resultButton = screen.getByRole('button', {name: /Первый результат/});
		expect(resultButton).toBeEnabled();
		fireEvent.click(resultButton);
		await waitFor(() => expect(testState.answerRequest).toEqual({url: result.url}));

		act(() => {
			testState.answerChange?.({loading: true, error: null, data: null});
		});
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: StatusTitle.LOADING_ANSWERS, status: 'loading'});
		expect(screen.getByRole('button', {name: 'Загружаю ответы…'})).toBeDisabled();
		expect(screen.getByRole('status')).toHaveTextContent('Ещё подгружаются результаты…');
		testState.setStatus.mockClear();

		act(() => {
			testState.variantChange?.({loading: false, firstLoading: false, error: null, data: [laterResult, result]});
		});
		expect(screen.getByRole('button', {name: /Первый результат/})).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', {name: /Поздний результат/})).toBeEnabled();
		expect(screen.queryByText('Ещё подгружаются результаты…')).not.toBeInTheDocument();
		expect(testState.setStatus).not.toHaveBeenCalled();
	});

	it('продолжает показывать поиск после первого пустого результата и сообщает об окончательной пустой выдаче', () => {
		render(<SectionSites initialUrl=""/>);

		act(() => {
			testState.variantChange?.({loading: true, firstLoading: false, error: null, data: []});
		});
		expect(screen.getByRole('status')).toHaveTextContent('Ещё подгружаются результаты…');
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'ещё подгружаются результаты…', status: 'loading'});

		act(() => {
			testState.variantChange?.({loading: false, firstLoading: false, error: 'ничего не найдено', data: []});
		});
		expect(screen.queryByText('Ещё подгружаются результаты…')).not.toBeInTheDocument();
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'ничего не найдено', status: 'warn'});
	});

	it('обновляет статус нового поиска после ошибки загрузки выбранного результата', () => {
		const result: ITestSearchResult = {source: 'first', title: 'Первый результат', url: 'https://rosmedicinfo.ru/first'};
		render(<SectionSites initialUrl=""/>);
		act(() => {
			testState.variantChange?.({loading: false, firstLoading: false, error: null, data: [result]});
		});
		fireEvent.click(screen.getByRole('button', {name: /Первый результат/}));
		act(() => {
			testState.answerChange?.({loading: false, error: 'источник недоступен', data: null});
		});

		fireEvent.change(screen.getByPlaceholderText(/Например:/), {target: {value: 'Новый тест'}});
		fireEvent.click(screen.getByRole('button', {name: 'Найти все варианты'}));
		act(() => {
			testState.variantChange?.({loading: true, firstLoading: true, error: null, data: []});
		});

		expect(testState.setStatus).toHaveBeenLastCalledWith({title: StatusTitle.SEARCHING, status: 'loading'});
	});
});
