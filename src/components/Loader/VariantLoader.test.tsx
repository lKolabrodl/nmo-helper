import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NMO_URL_24Forc, NMO_URL_VARIANT} from '../../utils/constants';
import VariantLoader from './VariantLoader';

const NMO_BASE_URL = `https://${NMO_URL_VARIANT}`;

const mocks = vi.hoisted(() => ({
	fetchViaBackground: vi.fn(),
}));

vi.mock('../../utils', () => ({
	fetchViaBackground: mocks.fetchViaBackground,
	parseHtml: vi.fn(),
}));

describe('VariantLoader', () => {
	beforeEach(() => {
		mocks.fetchViaBackground.mockReset();
	});

	it('сериализует запрос 24forcare в формате поисковой формы сайта', async () => {
		mocks.fetchViaBackground.mockResolvedValue({
			error: false,
			status: 200,
			text: '',
		});
		const onChange = vi.fn();

		render(<VariantLoader text="Тема (тест) - 2026" onChange={onChange}/>);

		await waitFor(() => {
			expect(mocks.fetchViaBackground).toHaveBeenCalledWith(
				`https://${NMO_URL_24Forc}/search/?query=%D0%A2%D0%B5%D0%BC%D0%B0+%28%D1%82%D0%B5%D1%81%D1%82%29+-+2026`,
			);
		});
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
