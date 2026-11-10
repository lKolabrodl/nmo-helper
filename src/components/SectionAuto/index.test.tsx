import {act, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ISearchResult} from '../../types';
import type {IAnswerModel} from '../Loader/AnswerLoader';
import {FIRST_ANSWER_SOURCE_HOST, NMO_API_TOPIC_ENDPOINT, SECOND_ANSWER_SOURCE_HOST, StatusTitle, THIRD_ANSWER_SOURCE_HOST} from '../../utils/constants';
import SectionAuto from './index';

type SourceKey = ISearchResult['source'];
type AnswerChange = (state: IAnswerModel) => void;

interface ITestFoundAnswer {
	readonly answers: string[];
	readonly score: number;
}

interface ITestQuestionState {
	readonly topic: string | null;
	readonly rawTopic: string | null;
	readonly question: string | null;
	readonly variants: string[];
	readonly isSingle: boolean;
}

interface ISearchRequest {
	readonly resolve: (results: ISearchResult[]) => void;
	readonly reject: (error: Error) => void;
}

const testState = vi.hoisted(() => ({
	searchRequests: new Map<SourceKey, ISearchRequest>(),
	answerChanges: new Map<string, AnswerChange>(),
	foundBySource: new Map<string, ITestFoundAnswer | null>(),
	questionState: {} as ITestQuestionState,
	searchNmoSource: vi.fn(),
	searchFirstSource: vi.fn(),
	searchSecondarySource: vi.fn(),
	searchThirdSource: vi.fn(),
	setStatus: vi.fn(),
	setBugReportContext: vi.fn(),
	cacheSet: vi.fn(),
	cacheHas: vi.fn(),
	askFreeAI: vi.fn(),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({status: {title: '', status: 'idle'}, setStatus: testState.setStatus}),
}));
vi.mock('../../contexts/QuestionFinderContext', () => ({useQuestionFinder: () => testState.questionState}));
vi.mock('../../contexts/BugReportContext', () => ({
	useBugReportContext: () => ({setBugReportContext: testState.setBugReportContext}),
}));
vi.mock('../../utils/answer-cache', () => ({answerCache: {set: testState.cacheSet, has: testState.cacheHas}}));
vi.mock('../../api/fetch/fetch-free-ai', () => ({askFreeAI: testState.askFreeAI}));
vi.mock('../../api/fetch/search-variant-sources', () => ({
	searchNmoSource: testState.searchNmoSource,
	searchFirstSource: testState.searchFirstSource,
	searchSecondarySource: testState.searchSecondarySource,
	searchThirdSource: testState.searchThirdSource,
}));
vi.mock('../../utils', () => ({
	pickResult: (results: ISearchResult[], source: SourceKey) => results.find(result => result.source === source),
}));
vi.mock('../../utils/cases', () => ({
	findAnswers: (model: {question: string}[] | null) => model?.length ? testState.foundBySource.get(model[0].question) ?? null : null,
}));
vi.mock('../Loader/AnswerLoader', async () => {
	const {useEffect} = await import('react');
	return {
		default: function AnswerLoaderMock({url, onChange}: {url: string; onChange: AnswerChange}) {
			testState.answerChanges.set(url, onChange);
			useEffect(() => () => { testState.answerChanges.delete(url); }, [url]);
			return null;
		},
	};
});

const SOURCE_URLS: Record<SourceKey, string> = {
	'nmo-helper': `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`,
	first: `https://${FIRST_ANSWER_SOURCE_HOST}/test`,
	second: `https://${SECOND_ANSWER_SOURCE_HOST}/test`,
	third: `https://${THIRD_ANSWER_SOURCE_HOST}/test-medik/nmo/test.html`,
};
const SEARCHES = {
	'nmo-helper': testState.searchNmoSource,
	first: testState.searchFirstSource,
	second: testState.searchSecondarySource,
	third: testState.searchThirdSource,
};

describe('SectionAuto', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testState.searchRequests.clear();
		testState.answerChanges.clear();
		testState.foundBySource.clear();
		testState.questionState = {
			topic: 'Тема', rawTopic: 'Тема', question: 'Вопрос', variants: ['Ответ A', 'Ответ B'], isSingle: true,
		};
		for (const [source, search] of Object.entries(SEARCHES)) {
			search.mockReset().mockImplementation(() => new Promise<ISearchResult[]>((resolve, reject) => {
				testState.searchRequests.set(source as SourceKey, {resolve, reject});
			}));
		}
		testState.cacheHas.mockReturnValue(false);
		testState.askFreeAI.mockReset().mockResolvedValue({correctIndexes: [1], source: 'Free AI'});
	});

	it('сразу ищет только в NMO и инициализирует контекст режима «Авто»', () => {
		render(<SectionAuto/>);
		expect(testState.searchNmoSource).toHaveBeenCalledExactlyOnceWith('Тема');
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper']);
		expect(testState.setBugReportContext).toHaveBeenCalledWith({mode: 'auto', url: ''});
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it.each([
		{label: 'вопроса', state: {question: null}},
		{label: 'вариантов', state: {variants: []}},
		{label: 'вопроса и вариантов', state: {question: null, variants: []}},
	])('после загрузки темы ожидает появления $label без статуса поиска', async ({state}) => {
		testState.questionState = {...testState.questionState, ...state};
		const {rerender} = render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {data: makeModel('nmo-helper')});
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'ответы загружены, ожидаю вопрос', status: 'ok'});
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		expect(testState.cacheSet).not.toHaveBeenCalled();

		testState.foundBySource.set('nmo-helper', {answers: ['Ответ A'], score: 1});
		testState.questionState = {...testState.questionState, question: 'Вопрос', variants: ['Ответ A', 'Ответ B']};
		rerender(<SectionAuto/>);
		expect(testState.searchNmoSource).toHaveBeenCalledOnce();
		expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Тема', 'Вопрос', ['Ответ A', 'Ответ B'], ['Ответ A']);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • nmo-helper', status: 'ok'});
	});

	it('до появления вопроса показывает загрузку ответов после выбора темы', async () => {
		testState.questionState = {...testState.questionState, question: null, variants: []};
		render(<SectionAuto/>);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: StatusTitle.SEARCHING_ANSWERS, status: 'loading'});
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: StatusTitle.LOADING_ANSWERS, status: 'loading'});
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it.each(['пустого поиска', 'пустой темы', 'ошибок источников'])(
		'после %s ожидает вопрос без бесконечного поиска и запускает AI при старте теста', async outcome => {
			testState.questionState = {...testState.questionState, question: null, variants: []};
			const {rerender} = render(<SectionAuto/>);
			if (outcome === 'ошибок источников') await exhaustSearches();
			else if (outcome === 'пустой темы') {
				await resolveSearch('nmo-helper', [result('nmo-helper')]);
				answer('nmo-helper', {data: []});
			}
			else await resolveSearch('nmo-helper');

			expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'ожидаю вопрос и варианты ответа', status: 'ok'});
			expect(testState.askFreeAI).not.toHaveBeenCalled();
			testState.questionState = {...testState.questionState, question: 'Вопрос', variants: ['Ответ A', 'Ответ B']};
			rerender(<SectionAuto/>);
			await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
		},
	);

	it('передаёт AnswerLoader URL NMO вместе с UID и дожидается ответа', async () => {
		render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		expect([...testState.answerChanges.keys()]).toEqual([SOURCE_URLS['nmo-helper']]);
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper']);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: StatusTitle.LOADING_ANSWERS, status: 'loading'});
	});

	it('после успешного пустого поиска NMO запускает AI без остальных источников', async () => {
		render(<SectionAuto/>);
		await resolveSearch('nmo-helper');
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper']);
		expect(testState.answerChanges.size).toBe(0);
	});

	it.each(['источник недоступен', 'NMO installation registration failed: 401'])(
		'после ошибки поиска NMO запускает только First: %s', async error => {
			render(<SectionAuto/>);
			await rejectSearch('nmo-helper', error);
			expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper', 'first']);
			expect(testState.searchFirstSource).toHaveBeenCalledExactlyOnceWith('Тема');
			expect(testState.askFreeAI).not.toHaveBeenCalled();
			expect(testState.setStatus).toHaveBeenLastCalledWith({title: StatusTitle.SEARCHING_ANSWERS, status: 'loading'});
		},
	);

	it.each([
		{first: 'пусто', second: 'пусто'},
		{first: 'ошибка', second: 'пусто'},
		{first: 'пусто', second: 'ошибка'},
		{first: 'ошибка', second: 'ошибка'},
	])('переходит по очереди к Secondary и Third: $first / $second', async outcomes => {
		render(<SectionAuto/>);
		await rejectSearch('nmo-helper');
		if (outcomes.first === 'ошибка') await rejectSearch('first');
		else await resolveSearch('first');
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper', 'first', 'second']);
		expect(testState.askFreeAI).not.toHaveBeenCalled();

		if (outcomes.second === 'ошибка') await rejectSearch('second');
		else await resolveSearch('second');
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper', 'first', 'second', 'third']);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		await resolveSearch('third');
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
	});

	it.each([
		{source: 'first', label: 'база 1'},
		{source: 'second', label: 'база 2'},
		{source: 'third', label: 'база 3'},
	] as const)('использует найденный вариант $source и прекращает поиск следующих источников', async ({source, label}) => {
		testState.foundBySource.set(source, {answers: ['Ответ A'], score: 1});
		render(<SectionAuto/>);
		await rejectSearch('nmo-helper');
		for (const key of ['first', 'second', 'third'] as const) {
			if (key === source) break;
			await resolveSearch(key);
		}
		await resolveSearch(source, [result(source)]);
		expect([...testState.answerChanges.keys()]).toEqual([SOURCE_URLS[source]]);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		answer(source, {data: makeModel(source)});
		expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Тема', 'Вопрос', ['Ответ A', 'Ответ B'], ['Ответ A']);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: `найдено • ${label}`, status: 'ok'});
		expect(testState.setBugReportContext).toHaveBeenLastCalledWith({mode: 'auto', url: SOURCE_URLS[source]});
		const requestedSources = [...testState.searchRequests.keys()];
		expect(requestedSources[requestedSources.length - 1]).toBe(source);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it('переходит к First после ошибки загрузки ответов NMO', async () => {
		render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {error: 'Источник недоступен'});
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper', 'first']);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		await resolveSearch('first', [result('first')]);
		expect(testState.answerChanges.has(SOURCE_URLS.first)).toBe(true);
		expect(testState.searchSecondarySource).not.toHaveBeenCalled();
	});

	it('после ошибки загрузки First проверяет Secondary и затем Third', async () => {
		render(<SectionAuto/>);
		await rejectSearch('nmo-helper');
		await resolveSearch('first', [result('first')]);
		answer('first', {error: 'Источник недоступен'});
		expect(testState.searchSecondarySource).toHaveBeenCalledOnce();
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		await resolveSearch('second', [result('second')]);
		answer('second', {error: 'Источник недоступен'});
		expect(testState.searchThirdSource).toHaveBeenCalledOnce();
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		await rejectSearch('third');
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
	});

	it.each([
		{label: 'null', data: null},
		{label: '[]', data: []},
	])('после успешного пустого ответа NMO ($label) запускает AI без остальных источников', async ({data}) => {
		render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {data});
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper']);
	});

	it('использует ответ NMO без остальных источников', async () => {
		testState.foundBySource.set('nmo-helper', {answers: ['Ответ A'], score: 1});
		render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {data: makeModel('nmo-helper')});
		expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Тема', 'Вопрос', ['Ответ A', 'Ответ B'], ['Ответ A']);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено • nmo-helper', status: 'ok'});
		expect([...testState.searchRequests.keys()]).toEqual(['nmo-helper']);
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it('показывает предупреждение для ответа с низкой уверенностью', async () => {
		testState.foundBySource.set('nmo-helper', {answers: ['Ответ A'], score: 0.1});
		render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {data: makeModel('nmo-helper')});
		expect(testState.cacheSet).toHaveBeenCalledOnce();
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • nmo-helper`, status: 'warn'});
		expect(testState.askFreeAI).not.toHaveBeenCalled();
	});

	it.each([
		{label: 'вопрос отсутствует', found: null},
		{label: 'варианты не совпали', found: {answers: [], score: 1}},
	])('запускает AI, если тема NMO непустая, но $label', async ({found}) => {
		testState.foundBySource.set('nmo-helper', found);
		render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {data: makeModel('nmo-helper')});
		await waitFor(() => expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Тема', 'Вопрос', ['Ответ A', 'Ответ B'], ['Ответ B']));
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		expect(testState.searchFirstSource).not.toHaveBeenCalled();
	});

	it('использует кеш текущего вопроса после ошибки поиска без запроса к AI', async () => {
		testState.cacheHas.mockReturnValue(true);
		render(<SectionAuto/>);
		await rejectSearch('nmo-helper');
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		expect(testState.cacheSet).not.toHaveBeenCalled();
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'найдено в памяти', status: 'ok'});
	});

	it('без распознанной темы запускает AI, а поиск источников пропускает', async () => {
		testState.questionState = {...testState.questionState, topic: null, rawTopic: null};
		render(<SectionAuto/>);
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledExactlyOnceWith(
			'Вопрос', ['Ответ A', 'Ответ B'], true, '', expect.objectContaining({signal: expect.any(AbortSignal)}),
		));
		for (const search of Object.values(SEARCHES)) expect(search).not.toHaveBeenCalled();
	});

	it('без вариантов ответа дожидается появления вариантов перед запуском AI', async () => {
		testState.questionState = {...testState.questionState, variants: []};
		const {rerender} = render(<SectionAuto/>);
		await resolveSearch('nmo-helper');
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		testState.questionState = {...testState.questionState, variants: ['Ответ A', 'Ответ B']};
		rerender(<SectionAuto/>);
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
	});

	it('после исчерпания цепочки использует AI один раз и сохраняет его ответ', async () => {
		const {rerender} = render(<SectionAuto/>);
		await exhaustSearches();
		await waitFor(() => expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Тема', 'Вопрос', ['Ответ A', 'Ответ B'], ['Ответ B']));
		expect(testState.askFreeAI).toHaveBeenCalledExactlyOnceWith(
			'Вопрос', ['Ответ A', 'Ответ B'], true, 'Тема', expect.objectContaining({signal: expect.any(AbortSignal)}),
		);
		expect(testState.setStatus).toHaveBeenLastCalledWith({title: 'AI · Free AI: вариант 2', status: 'ok'});
		expect(testState.setBugReportContext).toHaveBeenLastCalledWith({mode: 'auto', url: ''});
		expect(screen.getByText('Автоматически')).toBeVisible();
		expect(testState.askFreeAI.mock.calls[0][4].signal.aborted).toBe(true);
		rerender(<SectionAuto/>);
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
	});

	it.each(['пустого ответа', 'ошибки'])('выключает AI после %s без повторного запуска', async outcome => {
		if (outcome === 'ошибки') testState.askFreeAI.mockRejectedValue(new Error('AI недоступен'));
		else testState.askFreeAI.mockResolvedValue({correctIndexes: [], source: 'Free AI'});
		const {rerender} = render(<SectionAuto/>);
		await exhaustSearches();
		await waitFor(() => expect(testState.askFreeAI.mock.calls[0][4].signal.aborted).toBe(true));
		rerender(<SectionAuto/>);
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		expect(testState.cacheSet).not.toHaveBeenCalled();
		expect(testState.setStatus).toHaveBeenLastCalledWith(outcome === 'ошибки'
			? {title: 'AI недоступен', status: 'err'}
			: {title: StatusTitle.AI_NO_ANSWER, status: 'warn'});
	});

	it.each([
		{label: 'вопроса', nextState: {question: 'Следующий вопрос'}},
		{label: 'вариантов', nextState: {variants: ['Ответ C', 'Ответ D']}},
		{label: 'типа выбора', nextState: {isSingle: false}},
	])('при смене $label отменяет старый AI и сохраняет только новый ответ', async ({nextState}) => {
		let finishOldRequest!: (answer: {correctIndexes: number[]; source: string}) => void;
		testState.askFreeAI.mockReturnValueOnce(new Promise(resolve => { finishOldRequest = resolve; }));
		const {rerender} = render(<SectionAuto/>);
		await resolveSearch('nmo-helper');
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
		const {signal} = testState.askFreeAI.mock.calls[0][4];
		testState.questionState = {...testState.questionState, ...nextState};
		rerender(<SectionAuto/>);
		expect(signal.aborted).toBe(true);
		await waitFor(() => expect(testState.cacheSet).toHaveBeenCalledOnce());
		expect(testState.askFreeAI).toHaveBeenCalledTimes(2);
		expect(testState.cacheSet).toHaveBeenLastCalledWith(
			'Тема', testState.questionState.question, testState.questionState.variants, [testState.questionState.variants[1]],
		);
		await act(async () => finishOldRequest({correctIndexes: [0], source: 'Free AI'}));
		expect(testState.cacheSet).toHaveBeenCalledOnce();
		expect(testState.searchNmoSource).toHaveBeenCalledOnce();
	});

	it('при переходе к вопросу с ответом в базе отменяет AI без лишнего запроса', async () => {
		let finishOldRequest!: (answer: {correctIndexes: number[]; source: string}) => void;
		testState.askFreeAI.mockReturnValue(new Promise(resolve => { finishOldRequest = resolve; }));
		const {rerender} = render(<SectionAuto/>);
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {data: makeModel('nmo-helper')});
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
		const {signal} = testState.askFreeAI.mock.calls[0][4];
		testState.foundBySource.set('nmo-helper', {answers: ['Ответ A'], score: 1});
		testState.questionState = {...testState.questionState, question: 'Следующий вопрос'};
		rerender(<SectionAuto/>);
		expect(signal.aborted).toBe(true);
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Тема', 'Следующий вопрос', ['Ответ A', 'Ответ B'], ['Ответ A']);
		await act(async () => finishOldRequest({correctIndexes: [1], source: 'Free AI'}));
		expect(testState.cacheSet).toHaveBeenCalledOnce();
	});

	it('использует AI для следующего вопроса той же темы с пустым поиском', async () => {
		const {rerender} = render(<SectionAuto/>);
		await resolveSearch('nmo-helper');
		await waitFor(() => expect(testState.cacheSet).toHaveBeenCalledOnce());
		testState.questionState = {...testState.questionState, question: 'Следующий вопрос'};
		rerender(<SectionAuto/>);
		await waitFor(() => expect(testState.cacheSet).toHaveBeenLastCalledWith('Тема', 'Следующий вопрос', ['Ответ A', 'Ответ B'], ['Ответ B']));
		expect(testState.askFreeAI).toHaveBeenCalledTimes(2);
		expect(testState.searchNmoSource).toHaveBeenCalledOnce();
	});

	it('при смене темы отменяет AI и начинает поиск заново с NMO', async () => {
		let finishRequest!: (answer: {correctIndexes: number[]; source: string}) => void;
		testState.askFreeAI.mockReturnValue(new Promise(resolve => { finishRequest = resolve; }));
		const {rerender} = render(<SectionAuto/>);
		await exhaustSearches();
		await waitFor(() => expect(testState.askFreeAI).toHaveBeenCalledOnce());
		const {signal} = testState.askFreeAI.mock.calls[0][4];
		testState.questionState = {...testState.questionState, topic: 'Новая тема', question: 'Новый вопрос'};
		rerender(<SectionAuto/>);
		expect(signal.aborted).toBe(true);
		expect(testState.searchNmoSource).toHaveBeenLastCalledWith('Новая тема');
		for (const source of ['first', 'second', 'third'] as const) expect(SEARCHES[source]).toHaveBeenCalledOnce();
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
		testState.foundBySource.set('nmo-helper', {answers: ['Ответ A'], score: 1});
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		answer('nmo-helper', {data: makeModel('nmo-helper')});
		expect(testState.cacheSet).toHaveBeenCalledExactlyOnceWith('Новая тема', 'Новый вопрос', ['Ответ A', 'Ответ B'], ['Ответ A']);
		await act(async () => finishRequest({correctIndexes: [1], source: 'Free AI'}));
		expect(testState.cacheSet).toHaveBeenCalledOnce();
		expect(testState.askFreeAI).toHaveBeenCalledOnce();
	});

	it('игнорирует запоздалый результат First от предыдущей темы', async () => {
		const {rerender} = render(<SectionAuto/>);
		await rejectSearch('nmo-helper');
		const previousRequest = testState.searchRequests.get('first')!;
		testState.questionState = {...testState.questionState, topic: 'Новая тема'};
		rerender(<SectionAuto/>);
		await act(async () => previousRequest.resolve([result('first')]));
		expect(testState.answerChanges.size).toBe(0);
		expect(testState.searchSecondarySource).not.toHaveBeenCalled();
		expect(testState.askFreeAI).not.toHaveBeenCalled();
		await resolveSearch('nmo-helper', [result('nmo-helper')]);
		expect([...testState.answerChanges.keys()]).toEqual([SOURCE_URLS['nmo-helper']]);
	});
});

function result(source: SourceKey): ISearchResult {
	return {source, title: 'Тема', url: SOURCE_URLS[source]};
}

async function resolveSearch(source: SourceKey, results: ISearchResult[] = []): Promise<void> {
	expect(testState.searchRequests.has(source)).toBe(true);
	await act(async () => testState.searchRequests.get(source)!.resolve(results));
}

async function rejectSearch(source: SourceKey, message = 'Источник недоступен'): Promise<void> {
	expect(testState.searchRequests.has(source)).toBe(true);
	await act(async () => testState.searchRequests.get(source)!.reject(new Error(message)));
}

function answer(source: SourceKey, state: Partial<IAnswerModel>): void {
	expect(testState.answerChanges.has(SOURCE_URLS[source])).toBe(true);
	act(() => testState.answerChanges.get(SOURCE_URLS[source])!({loading: false, error: null, data: null, ...state}));
}

async function exhaustSearches(): Promise<void> {
	await rejectSearch('nmo-helper');
	await resolveSearch('first');
	await resolveSearch('second');
	await resolveSearch('third');
}

function makeModel(source: SourceKey) {
	return [{question: source, variants: [], answers: [], idx: 0}];
}
