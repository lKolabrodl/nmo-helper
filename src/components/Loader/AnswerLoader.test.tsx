import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NMO_API_TOPIC_ENDPOINT, THIRD_ANSWER_SOURCE_HOST} from '../../utils/constants';
import AnswerLoader from './AnswerLoader';

const NMO_TEST_URL = `https://${THIRD_ANSWER_SOURCE_HOST}/test-medik/nmo/topic.html`;
const NMO_API_RESULT_URL = `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`;

const mocks = vi.hoisted(() => ({
	detectSource: vi.fn(),
	getFirstAnswers: vi.fn(),
	getSecondAnswers: vi.fn(),
	getNmoAnswers: vi.fn(),
	getThirdAnswers: vi.fn(),
}));

vi.mock('../../utils', () => ({
	detectSource: mocks.detectSource,
}));

vi.mock('../../api/fetch/search-answer-sources', () => ({
	getFirstAnswers: mocks.getFirstAnswers,
	getSecondAnswers: mocks.getSecondAnswers,
	getNmoAnswers: mocks.getNmoAnswers,
	getThirdAnswers: mocks.getThirdAnswers,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe('AnswerLoader', () => {
	it('для sourceKey=third использует отдельный загрузчик и возвращает готовую модель', async () => {
		const model = [{
			question: 'Вопрос',
			variants: ['A', 'B'],
			answers: ['B'],
			correctIndexes: [1],
			docId: '329960',
			idx: 0,
		}];
		mocks.detectSource.mockReturnValue('third');
		mocks.getThirdAnswers.mockResolvedValue(model);
		const onChange = vi.fn();

		render(<AnswerLoader url={NMO_TEST_URL} onChange={onChange}/>);

		expect(onChange).toHaveBeenCalledWith({loading: true, error: null, data: null});
		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: model});
		});
		expect(mocks.getThirdAnswers).toHaveBeenCalledWith(NMO_TEST_URL);
		expect(mocks.getFirstAnswers).not.toHaveBeenCalled();
		expect(mocks.getSecondAnswers).not.toHaveBeenCalled();
		expect(mocks.getNmoAnswers).not.toHaveBeenCalled();
	});

	it('для sourceKey=nmo-helper загружает готовый вариант по тикету', async () => {
		const model = [{
			question: 'Вопрос API',
			variants: ['Нет', 'Да'],
			answers: ['Да'],
			idx: 0,
		}];
		mocks.detectSource.mockReturnValue('nmo-helper');
		mocks.getNmoAnswers.mockResolvedValue(model);
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
		expect(mocks.getNmoAnswers).toHaveBeenCalledWith(NMO_API_RESULT_URL);
		expect(mocks.getThirdAnswers).not.toHaveBeenCalled();
		expect(mocks.getFirstAnswers).not.toHaveBeenCalled();
		expect(mocks.getSecondAnswers).not.toHaveBeenCalled();
	});

	it('для sourceKey=first загружает первый источник и возвращает готовую модель', async () => {
		const model = [{question: 'Вопрос', variants: ['A', 'B'], answers: ['A'], idx: 0}];
		mocks.detectSource.mockReturnValue('first');
		mocks.getFirstAnswers.mockResolvedValue(model);
		const onChange = vi.fn();

		render(<AnswerLoader url="https://first.example/topic" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: model});
		});
		expect(mocks.getFirstAnswers).toHaveBeenCalledWith('https://first.example/topic');
		expect(mocks.getSecondAnswers).not.toHaveBeenCalled();
	});

	it('для sourceKey=second загружает второй источник и возвращает готовую модель', async () => {
		const model = [{question: 'Вопрос', variants: ['A', 'B'], answers: ['B'], idx: 0}];
		mocks.detectSource.mockReturnValue('second');
		mocks.getSecondAnswers.mockResolvedValue(model);
		const onChange = vi.fn();

		render(<AnswerLoader url="https://second.example/topic" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: model});
		});
		expect(mocks.getSecondAnswers).toHaveBeenCalledWith('https://second.example/topic');
		expect(mocks.getFirstAnswers).not.toHaveBeenCalled();
	});

	it('передаёт проверку URL в getNmoAnswers и показывает её ошибку', async () => {
		mocks.detectSource.mockReturnValue('nmo-helper');
		mocks.getNmoAnswers.mockRejectedValue(new Error('некорректный URL NMO API'));
		const onChange = vi.fn();

		render(<AnswerLoader url={NMO_API_TOPIC_ENDPOINT} onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({
				loading: false,
				error: 'некорректный URL NMO API',
				data: null,
			});
		});
		expect(mocks.getNmoAnswers).toHaveBeenCalledWith(NMO_API_TOPIC_ENDPOINT);
	});
});
