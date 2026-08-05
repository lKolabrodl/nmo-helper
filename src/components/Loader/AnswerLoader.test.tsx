import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ALTERNATIVE_ANSWER_SOURCE_HOST} from '../../utils/constants';
import {NMO_API_TOPIC_ENDPOINT} from '../../api/fetch/fetch-nmo-api';
import AnswerLoader from './AnswerLoader';

const NMO_TEST_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}/test-medik/nmo/topic.html`;
const NMO_API_RESULT_URL = `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`;

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
	it('для sourceKey=foo использует отдельный загрузчик и возвращает готовую модель', async () => {
		const model = [{
			question: 'Вопрос',
			variants: ['A', 'B'],
			answers: ['B'],
			correctIndexes: [1],
			docId: '329960',
			idx: 0,
		}];
		mocks.detectSource.mockReturnValue('foo');
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

	it('для sourceKey=nmo-helper загружает готовый вариант по тикету', async () => {
		const model = [{
			question: 'Вопрос API',
			variants: ['Нет', 'Да'],
			answers: ['Да'],
			idx: 0,
		}];
		mocks.detectSource.mockReturnValue('nmo-helper');
		mocks.fetchNmoApiTopic.mockResolvedValue(model);
		const onChange = vi.fn();

		render(
			<AnswerLoader
				url={NMO_API_RESULT_URL}
				onChange={onChange}/>,
		);

		expect(onChange).toHaveBeenCalledWith({loading: true, error: null, data: null});
		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: model});
		});
		expect(mocks.fetchNmoApiTopic).toHaveBeenCalledWith(NMO_API_RESULT_URL);
		expect(mocks.fetchNmoSource).not.toHaveBeenCalled();
		expect(mocks.fetchViaBackground).not.toHaveBeenCalled();
	});

	it('передаёт проверку URL в fetchNmoApiTopic и показывает её ошибку', async () => {
		mocks.detectSource.mockReturnValue('nmo-helper');
		mocks.fetchNmoApiTopic.mockRejectedValue(new Error('некорректный URL NMO API'));
		const onChange = vi.fn();

		render(<AnswerLoader url={NMO_API_TOPIC_ENDPOINT} onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({
				loading: false,
				error: 'некорректный URL NMO API',
				data: null,
			});
		});
		expect(mocks.fetchNmoApiTopic).toHaveBeenCalledWith(NMO_API_TOPIC_ENDPOINT);
	});
});
