import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SECONDARY_ANSWER_SOURCE_HOST, PRIMARY_ANSWER_SOURCE_HOST, ALTERNATIVE_ANSWER_SOURCE_HOST} from '../../utils/constants';
import {NMO_API_TOPIC_ENDPOINT} from '../../api/fetch/fetch-nmo-api';
import SectionAuto from './index';

interface ITestAnswerModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: HTMLElement | null;
}

interface ITestSearchResult {
	readonly source: 'primary' | 'secondary' | 'nmo-helper' | 'foo';
	readonly title: string;
	readonly url: string;
	readonly uid?: string;
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
	answerRequests: new Map<string, {readonly ticket?: string}>(),
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
	extractCases: (source: string) => [{question: source, variants: [], answers: [], idx: 0}],
	findAnswers: (model: Array<{question: string}>) => testState.foundBySource.get(model[0].question) ?? null,
}));

vi.mock('../Loader/VariantLoader', () => ({
	default: ({onChange}: {onChange: VariantChange}) => {
		testState.variantChange = onChange;
		return null;
	},
}));

vi.mock('../Loader/AnswerLoader', () => ({
	default: ({url, ticket, onChange}: {
		url: string;
		ticket?: string;
		onChange: AnswerChange;
	}) => {
		if (url) {
			testState.answerChanges.set(url, onChange);
			testState.answerRequests.set(url, {ticket});
		}
		return null;
	},
}));

const PRIMARY_SOURCE_URL = `https://${PRIMARY_ANSWER_SOURCE_HOST}/test`;
const SECONDARY_SOURCE_URL = `https://${SECONDARY_ANSWER_SOURCE_HOST}/test`;
const FOO_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}/test-medik/nmo/test.html`;

describe('SectionAuto', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testState.variantChange = null;
		testState.answerChanges.clear();
		testState.answerRequests.clear();
		testState.foundBySource.clear();
	});

	it('отдельно инициализирует контекст при входе в режим «Авто»', async () => {
		render(<SectionAuto/>);

		await waitFor(() => {
			expect(testState.setBugReportContext).toHaveBeenCalledWith({mode: 'auto', url: ''});
			expect(testState.variantChange).not.toBeNull();
		});
	});

	it('передаёт AnswerLoader короткоживущий UID результата API', async () => {
		render(<SectionAuto/>);

		startSourceLoading({
			source: 'nmo-helper',
			title: 'Тема API',
			url: NMO_API_TOPIC_ENDPOINT,
			uid: 'short-lived.uid',
		});

		await waitFor(() => {
			expect(testState.answerRequests.get(NMO_API_TOPIC_ENDPOINT)).toEqual({
				ticket: 'short-lived.uid',
			});
		});
	});

	it('раздельно загружает результаты nmo-helper и foo', async () => {
		render(<SectionAuto/>);

		startSourceLoading(
			{
				source: 'nmo-helper',
				title: 'Тема API',
				url: NMO_API_TOPIC_ENDPOINT,
				uid: 'short-lived.uid',
			},
			{source: 'foo', title: 'Тема foo', url: FOO_URL},
		);

		await waitFor(() => {
			expect(testState.answerChanges.size).toBe(4);
			expect(testState.answerRequests.get(NMO_API_TOPIC_ENDPOINT)).toEqual({
				ticket: 'short-lived.uid',
			});
			expect(testState.answerRequests.get(FOO_URL)).toEqual({ticket: undefined});
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
		testState.foundBySource.set('primary', null);
		testState.foundBySource.set('secondary', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
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
				data: document.createElement('div'),
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

	it('ждёт завершения всех источников перед обработкой ответа основной базы', async () => {
		testState.foundBySource.set('primary', {answers: ['Ответ A'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
		});
		expect(testState.cacheSet).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(SECONDARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
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

	it('использует foo, если другие источники не нашли ответ', async () => {
		testState.foundBySource.set('primary', null);
		testState.foundBySource.set('secondary', null);
		testState.foundBySource.set('foo', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(SECONDARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(FOO_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
		});

		await waitFor(() => {
			expect(testState.cacheSet).toHaveBeenCalledWith(
				'Тема',
				'Вопрос',
				['Ответ A', 'Ответ B'],
				['Ответ B'],
			);
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • foo', status: 'ok'});
			expect(testState.setBugReportContext).toHaveBeenLastCalledWith({
				mode: 'auto',
				url: FOO_URL,
			});
		});
	});

	it('сохраняет приоритет основной базы, когда ответ есть в обоих источниках', async () => {
		testState.foundBySource.set('primary', {answers: ['Ответ A'], score: 1});
		testState.foundBySource.set('secondary', {answers: ['Ответ B'], score: 1});
		testState.foundBySource.set('foo', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(PRIMARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(SECONDARY_SOURCE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(FOO_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
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
		: [{source: 'foo' as const, title: 'Тема', url: FOO_URL}];

	act(() => {
		testState.variantChange?.({
			loading: false,
			error: null,
			data: [
				{source: 'primary', title: 'Тема', url: PRIMARY_SOURCE_URL},
				{source: 'secondary', title: 'Тема', url: SECONDARY_SOURCE_URL},
				...results,
			],
		});
	});
}
