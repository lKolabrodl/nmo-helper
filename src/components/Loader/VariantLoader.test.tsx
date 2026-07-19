import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import VariantLoader from './VariantLoader';

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
					source: 'alternative',
					title: 'Особенности физической реабилитации при постковидном синдроме',
					url: 'https://testotvet.com/test-medik/nmo/678270b4b100db787f87d662.html',
				}],
			});
		});
	});
});
