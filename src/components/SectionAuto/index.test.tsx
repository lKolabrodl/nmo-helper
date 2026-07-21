import {act, render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NMO_URL_24Forc, NMO_URL_ROSMED, NMO_URL_VARIANT} from '../../utils/constants';
import SectionAuto from './index';

interface ITestAnswerModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: HTMLElement | null;
}

interface ITestSearchResult {
	readonly source: 'rosmedicinfo' | '24forcare' | 'nmo-helper';
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
	cacheHas: vi.fn(() => false),
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
		has: testState.cacheHas,
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
	default: ({url, onChange}: {url: string; onChange: AnswerChange}) => {
		if (url) testState.answerChanges.set(url, onChange);
		return null;
	},
}));

const ROSMED_URL = `https://${NMO_URL_ROSMED}/test`;
const FORCARE_URL = `https://${NMO_URL_24Forc}/test`;
const NMO_HELPER_URL = `https://${NMO_URL_VARIANT}/test-medik/nmo/test.html`;

describe('SectionAuto', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testState.variantChange = null;
		testState.answerChanges.clear();
		testState.foundBySource.clear();
		testState.cacheHas.mockReturnValue(false);
	});

	it('запускает загрузку всех найденных источников одновременно', async () => {
		render(<SectionAuto/>);

		startSourceLoading();

		await waitFor(() => {
			expect(testState.answerChanges.has(ROSMED_URL)).toBe(true);
			expect(testState.answerChanges.has(FORCARE_URL)).toBe(true);
			expect(testState.answerChanges.has(NMO_HELPER_URL)).toBe(true);
		});
	});

	it('дожидается 24forcare, если на rosmed ответа нет', async () => {
		testState.foundBySource.set('rosmedicinfo', null);
		testState.foundBySource.set('24forcare', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(ROSMED_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
		});
		expect(testState.cacheSet).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(NMO_HELPER_URL)?.({
				loading: false,
				error: null,
				data: null,
			});
		});
		expect(testState.cacheSet).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(FORCARE_URL)?.({
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
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • 24forcare', status: 'ok'});
			expect(testState.setBugReportContext).toHaveBeenLastCalledWith({
				panelMode: 'auto',
				panelTab: 'auto',
				activeUrl: FORCARE_URL,
			});
		});
	});

	it('ждёт завершения всех источников перед обработкой ответа rosmed', async () => {
		testState.foundBySource.set('rosmedicinfo', {answers: ['Ответ A'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(ROSMED_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
		});
		expect(testState.cacheSet).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(FORCARE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
		});
		expect(testState.cacheSet).not.toHaveBeenCalled();

		act(() => {
			testState.answerChanges.get(NMO_HELPER_URL)?.({
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
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • rosmed', status: 'ok'});
		});
	});

	it('использует nmo-helper, если другие источники не нашли ответ', async () => {
		testState.foundBySource.set('rosmedicinfo', null);
		testState.foundBySource.set('24forcare', null);
		testState.foundBySource.set('nmo-helper', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(ROSMED_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(FORCARE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(NMO_HELPER_URL)?.({
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
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • nmo-helper', status: 'ok'});
			expect(testState.setBugReportContext).toHaveBeenLastCalledWith({
				panelMode: 'auto',
				panelTab: 'auto',
				activeUrl: NMO_HELPER_URL,
			});
		});
	});

	it('сохраняет приоритет rosmed, когда ответ есть в обоих источниках', async () => {
		testState.foundBySource.set('rosmedicinfo', {answers: ['Ответ A'], score: 1});
		testState.foundBySource.set('24forcare', {answers: ['Ответ B'], score: 1});
		testState.foundBySource.set('nmo-helper', {answers: ['Ответ B'], score: 1});
		render(<SectionAuto/>);
		startSourceLoading();

		await waitFor(() => expect(testState.answerChanges.size).toBe(3));

		act(() => {
			testState.answerChanges.get(ROSMED_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(FORCARE_URL)?.({
				loading: false,
				error: null,
				data: document.createElement('div'),
			});
			testState.answerChanges.get(NMO_HELPER_URL)?.({
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
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • rosmed', status: 'ok'});
		});
	});
});

function startSourceLoading(): void {
	act(() => {
		testState.variantChange?.({
			loading: false,
			error: null,
			data: [
				{source: 'rosmedicinfo', title: 'Тема', url: ROSMED_URL},
				{source: '24forcare', title: 'Тема', url: FORCARE_URL},
				{source: 'nmo-helper', title: 'Тема', url: NMO_HELPER_URL},
			],
		});
	});
}
