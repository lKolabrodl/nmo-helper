import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {SECONDARY_ANSWER_SOURCE_HOST, ALTERNATIVE_ANSWER_SOURCE_HOST} from '../../utils/constants';
import {NMO_API_TOPIC_ENDPOINT} from '../../api/fetch/fetch-nmo-api';
import VariantLoader from './VariantLoader';

const NMO_BASE_URL = `https://${ALTERNATIVE_ANSWER_SOURCE_HOST}`;

const mocks = vi.hoisted(() => ({
	fetchViaBackground: vi.fn(),
	searchNmoApi: vi.fn(),
}));

vi.mock('../../utils', () => ({
	fetchViaBackground: mocks.fetchViaBackground,
	parseHtml: vi.fn(),
}));

vi.mock('../../api/fetch/fetch-nmo-api', async importOriginal => ({
	...await importOriginal<typeof import('../../api/fetch/fetch-nmo-api')>(),
	searchNmoApi: mocks.searchNmoApi,
}));

describe('VariantLoader', () => {
	beforeEach(() => {
		mocks.fetchViaBackground.mockReset();
		mocks.searchNmoApi.mockReset();
		mocks.searchNmoApi.mockResolvedValue([]);
	});

	it('сериализует запрос в формате поисковой формы дополнительной базы', async () => {
		mocks.fetchViaBackground.mockResolvedValue({
			error: false,
			status: 200,
			text: '',
		});
		const onChange = vi.fn();

		render(<VariantLoader text="Тема (тест) - 2026" onChange={onChange}/>);

		await waitFor(() => {
			expect(mocks.fetchViaBackground).toHaveBeenCalledWith(
				`https://${SECONDARY_ANSWER_SOURCE_HOST}/search/?query=%D0%A2%D0%B5%D0%BC%D0%B0+%28%D1%82%D0%B5%D1%81%D1%82%29+-+2026`,
			);
		});
	});

	it('добавляет результаты нового API с ticket-only режимом загрузки', async () => {
		mocks.fetchViaBackground.mockResolvedValue({
			error: false,
			status: 200,
			text: '',
		});
		mocks.searchNmoApi.mockResolvedValue([{
			title: 'Диагностика заболевания',
			questionCount: 46,
			ticket: 'short-lived.ticket',
		}]);
		const onChange = vi.fn();

		render(<VariantLoader text="Диагностика" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({
				loading: false,
				error: null,
				data: [{
					source: 'nmo-helper',
					title: 'Диагностика заболевания',
					url: NMO_API_TOPIC_ENDPOINT,
					mode: 'nmo-api',
					ticket: 'short-lived.ticket',
					questionCount: 46,
				}],
			});
		});
		expect(mocks.searchNmoApi).toHaveBeenCalledWith('Диагностика');
	});

	it('формирует результаты alternative из categories', async () => {
		mocks.fetchViaBackground.mockImplementation(async (url: string) => ({
			error: false,
			status: 200,
			text: url.includes('/api/search/suggestions/categories')
				? JSON.stringify({
					categories: [
						{
							name: 'Особенности физической реабилитации при постковидном синдроме',
							slug: '678270b4b100db787f87d662',
						},
						{name: '', slug: 'without-title'},
						{name: 'Без ссылки', slug: null},
					],
				})
				: '',
		}));
		const onChange = vi.fn();

		render(<VariantLoader text="КОВИД" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({
				loading: false,
				error: null,
				data: [{
					source: 'nmo-helper',
					title: 'Особенности физической реабилитации при постковидном синдроме',
					url: `${NMO_BASE_URL}/test-medik/nmo/678270b4b100db787f87d662.html`,
				}],
			});
		});
	});
});
