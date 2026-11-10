import {act, render, waitFor} from '@testing-library/react';
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

	it('сохраняет firstLoading до завершения единственного активного источника', async () => {
		let finishSearch!: (results: ISearchResult[]) => void;
		mocks.searchNmoSource.mockReturnValue(new Promise<ISearchResult[]>(resolve => { finishSearch = resolve; }));
		const onChange = vi.fn();

		render(<VariantLoader text="Тема" onChange={onChange}/>);

		expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: true, error: null, data: []});
		await act(async () => { finishSearch([]); });
		expect(onChange).toHaveBeenLastCalledWith({loading: false, firstLoading: false, error: 'ничего не найдено', data: []});
		for (const search of [mocks.searchFirstSource, mocks.searchSecondarySource, mocks.searchThirdSource]) {
			expect(search).not.toHaveBeenCalled();
		}
	});

	it.each([
		{name: 'общий', Loader: VariantLoader, model: {firstLoading: false}},
		{name: 'Nmo', Loader: VariantLoader.Nmo, model: {}},
	])('$name ищет только в NMO', async ({Loader, model}) => {
		const result: ISearchResult = {source: 'nmo-helper', title: 'Тема', url: 'https://example.com/topic'};
		mocks.searchNmoSource.mockResolvedValue([result]);
		const onChange = vi.fn();

		render(<Loader text="Тема" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({...model, loading: false, error: null, data: [result]});
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
			expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: []});
		});
		for (const search of Object.values(mocks)) expect(search).not.toHaveBeenCalled();
	});
});
