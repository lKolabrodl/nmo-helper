import {act, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FIRST_ANSWER_SOURCE_HOST, NMO_API_TOPIC_ENDPOINT, SECOND_ANSWER_SOURCE_HOST, StatusTitle, THIRD_ANSWER_SOURCE_HOST} from '../../utils/constants';
import SectionAuto from './index';

interface ITestAnswerModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ITestQaCase[] | null;
}

interface ITestQaCase {
	readonly question: string;
	readonly variants: string[];
	readonly answers: string[];
	readonly idx: number;
}

interface ITestSearchResult {
	readonly source: 'first' | 'second' | 'third' | 'nmo-helper';
	readonly title: string;
	readonly url: string;
}

interface ITestVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ITestSearchResult[];
}

interface ITestFoundAnswer {
	readonly answers: string[];
	readonly score: number;
}

type AnswerChange = (state: ITestAnswerModel) => void;
type VariantChange = (state: ITestVariantModel) => void;

const testState = vi.hoisted(() => ({
	variantChange: null as VariantChange | null,
	answerChanges: new Map<string, AnswerChange>(),
	foundBySource: new Map<string, ITestFoundAnswer | null>(),
	questionState: {
		topic: 'Тема',
		rawTopic: 'Тема',
		question: 'Вопрос',
		variants: ['Ответ A', 'Ответ B'],
		isSingle: true,
	},
	setStatus: vi.fn(),
	setBugReportContext: vi.fn(),
	cacheSet: vi.fn(),
	cacheHas: vi.fn(),
	askFreeAI: vi.fn(),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({
		status: {title: '', status: 'idle'},
		setStatus: testState.setStatus,
	}),
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => testState.questionState,
}));

vi.mock('../../contexts/BugReportContext', () => ({
	useBugReportContext: () => ({setBugReportContext: testState.setBugReportContext}),
}));

vi.mock('../../utils/answer-cache', () => ({
	answerCache: {
		set: testState.cacheSet,
		has: testState.cacheHas,
	},
}));

vi.mock('../../api/fetch/fetch-free-ai', () => ({
	askFreeAI: testState.askFreeAI,
}));

vi.mock('../../utils', () => ({
	pickResult: (results: ITestSearchResult[], source: ITestSearchResult['source']) => (
		results.find(result => result.source === source)
	),
}));

vi.mock('../../utils/cases', () => ({
	findAnswers: (model: ITestQaCase[]) => testState.foundBySource.get(model[0].question) ?? null,
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
			testState.answerChanges.set(url, onChange);
		}
		return null;
	},
}));

const PRIMARY_SOURCE_URL = `https://${FIRST_ANSWER_SOURCE_HOST}/test`;
const SECONDARY_SOURCE_URL = `https://${SECOND_ANSWER_SOURCE_HOST}/test`;
const NMO_API_RESULT_URL = `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`;
const FOO_URL = `https://${THIRD_ANSWER_SOURCE_HOST}/test-medik/nmo/test.html`;
const OTHER_SOURCE_URLS = [PRIMARY_SOURCE_URL, SECONDARY_SOURCE_URL, FOO_URL];

describe('SectionAuto', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testState.variantChange = null;
		testState.answerChanges.clear();
		testState.foundBySource.clear();
		testState.questionState = {
			topic: 'Тема',
			rawTopic: 'Тема',
			question: 'Вопрос',
			variants: ['Ответ A', 'Ответ B'],
			isSingle: true,
		};
		testState.cacheHas.mockReturnValue(false);
		testState.askFreeAI.mockReset().mockResolvedValue({correctIndexes: [1], source: 'Free AI'});
	});

	it('отдельно инициализирует контекст при входе в режим «Авто»', async () => {
		render(<SectionAuto/>);

		await waitFor(() => {
			expect(testState.setBugReportContext).toHaveBeenCalledWith({mode: 'auto', url: ''});
			expect(testState.variantChange).not.toBeNull();
		});
	});

	it('передаёт AnswerLoader URL результата вместе с UID', async () => {
		render(<SectionAuto/>);

		startSourceLoading({
			source: 'nmo-helper',
			title: 'Тема API',
			url: NMO_API_RESULT_URL,
		});

		await waitFor(() => {
			expect(testState.answerChanges.has(NMO_API_RESULT_URL)).toBe(true);
		});
	});

	it('загружает остальные источники только после ошибки nmo-helper', async () => {
		render(<SectionAuto/>);

		startSourceLoading(
			{
				source: 'nmo-helper',
				title: 'Тема API',
				url: NMO_API_RESULT_URL,
			},
			{source: 'third', title: 'Тема foo', url: FOO_URL},
		);

		await waitFor(() => {
			expect(testState.answerChanges.size).toBe(1);
			expect(testState.answerChanges.has(NMO_API_RESULT_URL)).toBe(true);
			expect(testState.answerChanges.has(PRIMARY_SOURCE_URL)).toBe(false);
			expect(testState.answerChanges.has(SECONDARY_SOURCE_URL)).toBe(false);
			expect(testState.answerChanges.has(FOO_URL)).toBe(false);
		});

		act(() => {
			testState.answerChanges.get(NMO_API_RESULT_URL)?.({
				loading: false,
				error: 'Источник недоступен',
				data: null,
			});
		});

		await waitFor(() => {
			expect(testState.answerChanges.size).toBe(4);
			expect(testState.answerChanges.has(NMO_API_RESULT_URL)).toBe(true);
			expect(testState.answerChanges.has(PRIMARY_SOURCE_URL)).toBe(true);
			expect(testState.answerChanges.has(SECONDARY_SOURCE_URL)).toBe(true);
			expect(testState.answerChanges.has(FOO_URL)).toBe(true);
		});
	});

	it('не загружает остальные источники, если URL nmo-helper не найден', () => {
		render(<SectionAuto/>);
		startSourceLoading({source: 'third', title: 'Тема', url: FOO_URL});

		expect(testState.answerChanges.size).toBe(0);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it.each([
		{label: 'null', data: null},
		{label: '[]', data: []},
	])('не загружает остальные источники после успешного пустого ответа nmo-helper ($label)', async ({data}) => {
		render(<SectionAuto/>);
		startSourceLoading(
			{source: 'nmo-helper', title: 'Тема API', url: NMO_API_RESULT_URL},
			{source: 'third', title: 'Тема', url: FOO_URL},
		);
		act(() => {
			testState.answerChanges.get(NMO_API_RESULT_URL)?.({loading: false, error: null, data});
		});
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());

		expect([...testState.answerChanges.keys()]).toEqual([NMO_API_RESULT_URL]);
	});

	it('не загружает остальные источники, когда nmo-helper вернул данные', async () => {
		testState.foundBySource.set('nmo-helper', {answers: ['Ответ A'], score: 1});
		render(<SectionAuto/>);

		startSourceLoading(
			{
				source: 'nmo-helper',
				title: 'Тема API',
				url: NMO_API_RESULT_URL,
			},
			{source: 'third', title: 'Тема foo', url: FOO_URL},
		);

		await waitFor(() => expect(testState.answerChanges.size).toBe(1));

		act(() => {
			testState.answerChanges.get(NMO_API_RESULT_URL)?.({
				loading: false,
				error: null,
				data: makeModel('nmo-helper'),
			});
		});

		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledWith(
				'Тема',
				'Вопрос',
				['Ответ A', 'Ответ B'],
				['Ответ A'],
			);
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • nmo-helper', status: 'ok'});
			expect(testState.answerChanges.size).toBe(1);
			expect(testState.answerChanges.has(PRIMARY_SOURCE_URL)).toBe(false);
			expect(testState.answerChanges.has(SECONDARY_SOURCE_URL)).toBe(false);
			expect(testState.answerChanges.has(FOO_URL)).toBe(false);
		});
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it.each([
		{label: 'null', data: null},
		{label: '[]', data: []},
	])('запускает бесплатный AI во вкладке «Авто» после ошибки nmo-helper и пустых данных ($label) остальных источников', async ({data}) => {
		const {rerender} = render(<SectionAuto/>);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		startSourceLoading(
			{source: 'nmo-helper', title: 'Тема API', url: NMO_API_RESULT_URL},
			{source: 'third', title: 'Тема', url: FOO_URL},
		);

		expect(testState.askFreeAI).not.toHaveBeenCalled();
		act(() => {
			testState.answerChanges.get(NMO_API_RESULT_URL)?.({loading: false, error: 'Источник недоступен', data: null});
		});
		await waitFor(() => expect(testState.answerChanges.size).toBe(4));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({loading: false, error: null, data});
			testState.answerChanges.get(SECONDARY_SOURCE_URL)?.({loading: false, error: null, data});
		});
		expect(testState.askFreeAI).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(FOO_URL)?.({loading: false, error: null, data});
		});
		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledWith('Тема', 'Вопрос', ['Ответ A', 'Ответ B'], ['Ответ B']);
		});
		expect(testState.askFreeAI).toHaveBeenCalledExactlyOnceWith(
			'Вопрос', ['Ответ A', 'Ответ B'], true, 'Тема',
			expect.objectContaining({signal: expect.any(AbortSignal)}),
		);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'AI · Free AI: вариант 2', status: 'ok'});
		expect(testState.setBugReportContext).toHaveBeenLastCalledWith({mode: 'auto', url: ''});
		expect(screen.getByText('Автоматически')).toBeVisible();
		expect(testState.askFreeAI.mock.calls[0][4].signal.aborted).toBe(true);

		rerender(<SectionAuto/>);
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'AI · Free AI: вариант 2', status: 'ok'});
	});

	it.each(['пустого ответа', 'ошибки'])('выключает AI после %s без повторного запуска на текущем вопросе', async outcome => {
		if (outcome === 'ошибки') testState.askFreeAI.mockRejectedValue(new Error('AI недоступен'));
		else testState.askFreeAI.mockResolvedValue({correctIndexes: [], source: 'Free AI'});
		const {rerender} = render(<SectionAuto/>);
		startSourceLoading();
		await waitFor(() => expect(testState.answerChanges.size).toBe(4));
		act(() => {
			for (const url of OTHER_SOURCE_URLS) {
				testState.answerChanges.get(url)?.({loading: false, error: null, data: []});
			}
		});

		await waitFor(() => expect(testState.askFreeAI.mock.calls[0][4].signal.aborted).toBe(true));
		rerender(<SectionAuto/>);
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		expect(testState.cacheSet).not.toHaveBeenCalled();
		expect(testState.setStatus).toHaveBeenLastCalledWith(outcome === 'ошибки'
			? {title: 'AI недоступен', status: 'err'}
			: {title: StatusTitle.AI_NO_ANSWER, status: 'warn'});
	});

	it('сохраняет ошибку загрузки, если все источники недоступны', async () => {
		render(<SectionAuto/>);
		startSourceLoading();
		await waitFor(() => expect(testState.answerChanges.size).toBe(4));

		act(() => {
			for (const url of OTHER_SOURCE_URLS) {
				testState.answerChanges.get(url)?.({loading: false, error: 'Источник недоступен', data: null});
			}
		});

		expect(testState.setStatus).toHaveBeenLastCalledWith({title: StatusTitle.LOADING_FAILED, status: 'err'});
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it('использует бесплатный AI для следующего вопроса той же темы с пустыми источниками', async () => {
		const {rerender} = render(<SectionAuto/>);
		startSourceLoading();
		await waitFor(() => expect(testState.answerChanges.size).toBe(4));
		act(() => {
			for (const url of OTHER_SOURCE_URLS) {
				testState.answerChanges.get(url)?.({loading: false, error: null, data: null});
			}
		});
		await waitFor(() => expect(testState.cacheSet).toHaveBeenCalledOnce());

		testState.questionState = {...testState.questionState, question: 'Следующий вопрос'};
		rerender(<SectionAuto/>);

		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenLastCalledWith('Тема', 'Следующий вопрос', ['Ответ A', 'Ответ B'], ['Ответ B']);
		});
		expect(testState.askFreeAI).toHaveBeenCalledTimes(2);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'AI · Free AI: вариант 2', status: 'ok'});
	});

	it('при смене темы отменяет AI и сначала проверяет источники новой темы', async () => {
		let finishRequest!: (answer: {correctIndexes: number[]; source: string}) => void;
		testState.askFreeAI.mockReturnValue(new Promise(resolve => { finishRequest = resolve; }));
		const {rerender} = render(<SectionAuto/>);
		startSourceLoading();
		await waitFor(() => expect(testState.answerChanges.size).toBe(4));
		act(() => {
			for (const url of OTHER_SOURCE_URLS) {
				testState.answerChanges.get(url)?.({loading: false, error: null, data: null});
			}
		});
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
		const {signal} = testState.askFreeAI.mock.calls[0][4];

		testState.questionState = {...testState.questionState, topic: 'Новая тема', question: 'Новый вопрос'};
		rerender(<SectionAuto/>);
		expect(signal.aborted).toBe(true);
		expect(testState.askFreeAI).toHaveBeenCalledOnce();

		act(() => testState.variantChange?.({loading: true, error: null, data: []}));
		startSourceLoading();
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		testState.foundBySource.set('first', {answers: ['Ответ A'], score: 1});
		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({loading: false, error: null, data: makeModel('first')});
		});
		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Новая тема', 'Новый вопрос', ['Ответ A', 'Ответ B'], ['Ответ A']);
		});

		await act(async () => finishRequest({correctIndexes: [1], source: 'Free AI'}));
		expect(testState.cacheSet).toHaveBeenCalledOnce();
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • база 1', status: 'ok'});
	});

	it('запускает загрузку остальных найденных источников одновременно после ошибки nmo-helper', async () => {
		render(<SectionAuto/>);

		startSourceLoading();

		await waitFor(() => {
			expect(testState.answerChanges.has(PRIMARY_SOURCE_URL)).toBe(true);
			expect(testState.answerChanges.has(SECONDARY_SOURCE_URL)).toBe(true);
			expect(testState.answerChanges.has(FOO_URL)).toBe(true);
		});
	});

	it('дожидается дополнительной базы, если в основной ответа нет', async () => {
		testState.foundBySource.set('first', null);
		testState.foundBySource.set('second', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(4));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: makeModel('first'),
			});
		});
		expect(testState.cacheSet).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(FOO_URL)?.({
				loading: false,
				error: null,
				data: null,
			});
		});
		expect(testState.cacheSet).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(SECONDARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: makeModel('second'),
			});
		});

		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledWith(
				'Тема',
				'Вопрос',
				['Ответ A', 'Ответ B'],
				['Ответ B'],
			);
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • база 2', status: 'ok'});
			expect(testState.setBugReportContext).toHaveBeenLastCalledWith({
				mode: 'auto',
				url: SECONDARY_SOURCE_URL,
			});
		});
	});

	it('обрабатывает ответ основной базы, не дожидаясь остальных источников', async () => {
		testState.foundBySource.set('first', {answers: ['Ответ A'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(4));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: makeModel('first'),
			});
		});

		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledWith(
				'Тема',
				'Вопрос',
				['Ответ A', 'Ответ B'],
				['Ответ A'],
			);
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • база 1', status: 'ok'});
		});
	});

	it('использует базу 3, если другие источники не нашли ответ', async () => {
		testState.foundBySource.set('first', null);
		testState.foundBySource.set('second', null);
		testState.foundBySource.set('third', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(4));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: makeModel('first'),
			});
			testState.answerChanges.get(SECONDARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: makeModel('second'),
			});
			testState.answerChanges.get(FOO_URL)?.({
				loading: false,
				error: null,
				data: makeModel('third'),
			});
		});

		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledWith(
				'Тема',
				'Вопрос',
				['Ответ A', 'Ответ B'],
				['Ответ B'],
			);
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • база 3', status: 'ok'});
			expect(testState.setBugReportContext).toHaveBeenLastCalledWith({
				mode: 'auto',
				url: FOO_URL,
			});
		});
	});

	it('сохраняет приоритет основной базы, когда ответ есть в обоих источниках', async () => {
		testState.foundBySource.set('first', {answers: ['Ответ A'], score: 1});
		testState.foundBySource.set('second', {answers: ['Ответ B'], score: 1});
		testState.foundBySource.set('third', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(4));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: makeModel('first'),
			});
			testState.answerChanges.get(SECONDARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: makeModel('second'),
			});
			testState.answerChanges.get(FOO_URL)?.({
				loading: false,
				error: null,
				data: makeModel('third'),
			});
		});

		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledWith(
				'Тема',
				'Вопрос',
				['Ответ A', 'Ответ B'],
				['Ответ A'],
			);
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • база 1', status: 'ok'});
		});
	});
});

function startSourceLoading(...sourceResults: ITestSearchResult[]): void {
	const results = sourceResults.length
		? sourceResults
		: [
			{source: 'nmo-helper' as const, title: 'Тема API', url: NMO_API_RESULT_URL},
			{source: 'third' as const, title: 'Тема', url: FOO_URL},
		];

	act(() => {
		testState.variantChange?.({
			loading: false,
			error: null,
			data: [
				{source: 'first', title: 'Тема', url: PRIMARY_SOURCE_URL},
				{source: 'second', title: 'Тема', url: SECONDARY_SOURCE_URL},
				...results,
			],
		});
	});
	if (!sourceResults.length) {
		act(() => {
			testState.answerChanges.get(NMO_API_RESULT_URL)?.({loading: false, error: 'Источник недоступен', data: null});
		});
	}
}

function makeModel(source: string): ITestQaCase[] {
	return [{question: source, variants: [], answers: [], idx: 0}];
}
