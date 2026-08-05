import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NMO_API_TOPIC_ENDPOINT} from '../../utils/constants';
import type {ISearchResult} from '../../types';
import VariantLoader from './VariantLoader';

const mocks = vi.hoisted(() => ({
	searchSecondarySource: vi.fn(),
	searchFirstSource: vi.fn(),
	searchNmoSource: vi.fn(),
	searchThirdSource: vi.fn(),
}));

vi.mock('../../api/fetch/search-variant-sources', () => ({
	searchSecondarySource: mocks.searchSecondarySource,
	searchFirstSource: mocks.searchFirstSource,
	searchNmoSource: mocks.searchNmoSource,
	searchThirdSource: mocks.searchThirdSource,
}));

describe('VariantLoader', () => {
	beforeEach(() => {
		mocks.searchSecondarySource.mockReset().mockResolvedValue([]);
		mocks.searchFirstSource.mockReset().mockResolvedValue([]);
		mocks.searchNmoSource.mockReset().mockResolvedValue([]);
		mocks.searchThirdSource.mockReset().mockResolvedValue([]);
	});

	it('передаёт query четырём источникам и объединяет их результаты', async () => {
		const secondary: ISearchResult = {
			source: 'secondary',
			title: 'Дополнительный результат',
			url: 'https://secondary.example/topic',
		};
		const primary: ISearchResult = {
			source: 'primary',
			title: 'Основной результат',
			url: 'https://primary.example/topic',
		};
		const nmoApi: ISearchResult = {
			source: 'nmo-helper',
			title: 'Результат NMO API',
			url: `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`,
		};
		const third: ISearchResult = {
			source: 'foo',
			title: 'Результат третьего источника',
			url: 'https://third.example/topic',
		};

		mocks.searchSecondarySource.mockResolvedValue([secondary]);
		mocks.searchFirstSource.mockResolvedValue([primary]);
		mocks.searchNmoSource.mockResolvedValue([nmoApi]);
		mocks.searchThirdSource.mockResolvedValue([third]);
		const onChange = vi.fn();

		render(<VariantLoader text="  Диагностика  " onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({
				loading: false,
				error: null,
				data: [nmoApi, secondary, primary, third],
			});
		});

		expect(mocks.searchSecondarySource).toHaveBeenCalledWith('Диагностика');
		expect(mocks.searchFirstSource).toHaveBeenCalledWith('Диагностика');
		expect(mocks.searchNmoSource).toHaveBeenCalledWith('Диагностика');
		expect(mocks.searchThirdSource).toHaveBeenCalledWith('Диагностика');
	});

	it('не теряет результаты остальных источников при единичной ошибке', async () => {
		const result: ISearchResult = {
			source: 'secondary',
			title: 'Найденная тема',
			url: 'https://secondary.example/topic',
		};
		mocks.searchSecondarySource.mockResolvedValue([result]);
		mocks.searchFirstSource.mockRejectedValue(new Error('источник недоступен'));
		const onChange = vi.fn();

		render(<VariantLoader text="Тема" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({
				loading: false,
				error: null,
				data: [result],
			});
		});
	});

	it('сообщает, когда ни один источник ничего не нашёл', async () => {
		const onChange = vi.fn();

		render(<VariantLoader text="Неизвестная тема" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({
				loading: false,
				error: 'ничего не найдено',
				data: [],
			});
		});
	});
});
