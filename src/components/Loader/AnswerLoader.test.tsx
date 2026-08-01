import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ALTERNATIVE_ANSWER_SOURCE_HOST} from '../../utils/constants';
import {NMO_API_TOPIC_ENDPOINT} from '../../api/fetch/fetch-nmo-api';
import AnswerLoader from './AnswerLoader';

const NMO_TEST_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}/test-medik/nmo/topic.html`;

const mocks = vi.hoisted(() => ({
	detectSource: vi.fn(),
	fetchNmoApiTopic: vi.fn(),
	fetchNmoSource: vi.fn(),
	fetchViaBackground: vi.fn(),
	parseHtml: vi.fn(),
}));

vi.mock('../../utils', () => ({
	detectSource: mocks.detectSource,
	fetchViaBackground: mocks.fetchViaBackground,
	parseHtml: mocks.parseHtml,
}));

vi.mock('../../api/fetch/fetch-nmo-source', () => ({
	fetchNmoSource: mocks.fetchNmoSource,
}));

vi.mock('../../api/fetch/fetch-nmo-api', async importOriginal => ({
	...await importOriginal<typeof import('../../api/fetch/fetch-nmo-api')>(),
	fetchNmoApiTopic: mocks.fetchNmoApiTopic,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe('AnswerLoader', () => {
	it('для sourceKey=nmo-helper использует отдельный загрузчик и возвращает готовую модель', async () => {
		const model = [{
			question: 'Вопрос',
			variants: ['A', 'B'],
			answers: ['B'],
			correctIndexes: [1],
			docId: '329960',
			idx: 0,
		}];
		mocks.detectSource.mockReturnValue('nmo-helper');
		mocks.fetchNmoSource.mockResolvedValue(model);
		const onChange = vi.fn();

		render(<AnswerLoader url={NMO_TEST_URL} onChange={onChange}/>);

		expect(onChange).toHaveBeenCalledWith({loading: true, error: null, data: null});
		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: model});
		});
		expect(mocks.fetchNmoSource).toHaveBeenCalledWith(NMO_TEST_URL);
		expect(mocks.fetchViaBackground).not.toHaveBeenCalled();
	});

	it('в режиме nmo-api загружает готовый вариант по тикету', async () => {
		const model = [{
			question: 'Вопрос API',
			variants: ['Нет', 'Да'],
			answers: ['Да'],
			idx: 0,
		}];
		mocks.fetchNmoApiTopic.mockResolvedValue(model);
		const onChange = vi.fn();

		render(
			<AnswerLoader
				url={NMO_API_TOPIC_ENDPOINT}
				mode="nmo-api"
				ticket="short-lived.ticket"
				onChange={onChange}/>,
		);

		expect(onChange).toHaveBeenCalledWith({loading: true, error: null, data: null});
		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: model});
		});
		expect(mocks.fetchNmoApiTopic).toHaveBeenCalledWith('short-lived.ticket');
		expect(mocks.fetchNmoSource).not.toHaveBeenCalled();
		expect(mocks.fetchViaBackground).not.toHaveBeenCalled();
	});

	it('не запускает API-запрос без тикета', () => {
		const onChange = vi.fn();

		render(<AnswerLoader url={NMO_API_TOPIC_ENDPOINT} mode="nmo-api" onChange={onChange}/>);

		expect(onChange).toHaveBeenLastCalledWith({
			loading: false,
			error: 'отсутствует тикет NMO API — повторите поиск',
			data: null,
		});
		expect(mocks.fetchNmoApiTopic).not.toHaveBeenCalled();
	});
});
