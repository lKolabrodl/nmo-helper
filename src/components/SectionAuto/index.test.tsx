import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FIRST_ANSWER_SOURCE_HOST, NMO_API_TOPIC_ENDPOINT, SECOND_ANSWER_SOURCE_HOST, THIRD_ANSWER_SOURCE_HOST} from '../../utils/constants';
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
	setStatus: vi.fn(),
	setBugReportContext: vi.fn(),
	cacheSet: vi.fn(),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({
		status: {title: '', status: 'idle'},
		setStatus: testState.setStatus,
	}),
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => ({
		topic: 'Тема',
		rawTopic: 'Тема',
		question: 'Вопрос',
		variants: ['Ответ A', 'Ответ B'],
	}),
}));

vi.mock('../../contexts/BugReportContext', () => ({
	useBugReportContext: () => ({setBugReportContext: testState.setBugReportContext}),
}));

vi.mock('../../utils/answer-cache', () => ({
	answerCache: {
		set: testState.cacheSet,
	},
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

describe('SectionAuto', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testState.variantChange = null;
		testState.answerChanges.clear();
		testState.foundBySource.clear();
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

	it('загружает остальные источники только после data: null от nmo-helper', async () => {
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
				error: null,
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
	});

	it('запускает загрузку всех найденных источников одновременно', async () => {
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

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

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

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

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

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

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

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

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
		: [{source: 'third' as const, title: 'Тема', url: FOO_URL}];

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
}

function makeModel(source: string): ITestQaCase[] {
	return [{question: source, variants: [], answers: [], idx: 0}];
}
