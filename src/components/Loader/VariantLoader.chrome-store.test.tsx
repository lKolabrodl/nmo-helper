import {render, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ISearchResult} from '../../types';
import VariantLoader from './VariantLoader';

const mocks = vi.hoisted(() => {
	vi.stubGlobal('__BUILD_TARGET__', 'chrome-store');
	return {
		searchNmoSource: vi.fn(),
		searchFirstSource: vi.fn(),
		searchSecondarySource: vi.fn(),
		searchThirdSource: vi.fn(),
	};
});

vi.mock('../../api/fetch/search-variant-sources', () => mocks);

describe('VariantLoader в chrome-store', () => {
	beforeEach(() => {
		for (const search of Object.values(mocks)) search.mockReset().mockResolvedValue([]);
	});

	it.each([
		{name: 'общий', Loader: VariantLoader},
		{name: 'Nmo', Loader: VariantLoader.Nmo},
	])('$name ищет только в NMO', async ({Loader}) => {
		const result: ISearchResult = {source: 'nmo-helper', title: 'Тема', url: 'https://example.com/topic'};
		mocks.searchNmoSource.mockResolvedValue([result]);
		const onChange = vi.fn();

		render(<Loader text="Тема" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: [result]});
		});
		expect(mocks.searchNmoSource).toHaveBeenCalledExactlyOnceWith('Тема');
		expect(mocks.searchFirstSource).not.toHaveBeenCalled();
		expect(mocks.searchSecondarySource).not.toHaveBeenCalled();
		expect(mocks.searchThirdSource).not.toHaveBeenCalled();
	});

	it.each([
		{name: 'First', Loader: VariantLoader.First},
		{name: 'Secondary', Loader: VariantLoader.Secondary},
		{name: 'Third', Loader: VariantLoader.Third},
	])('$name не обращается к внешним источникам', async ({Loader}) => {
		const onChange = vi.fn();

		render(<Loader text="Тема" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: 'ничего не найдено', data: []});
		});
		for (const search of Object.values(mocks)) expect(search).not.toHaveBeenCalled();
	});
});
