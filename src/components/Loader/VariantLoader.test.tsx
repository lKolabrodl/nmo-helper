import {act, render, waitFor} from '@testing-library/react';
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

const sourceLoaders = [
	{name: 'Nmo', Loader: VariantLoader.Nmo, search: mocks.searchNmoSource, source: 'nmo-helper'},
	{name: 'First', Loader: VariantLoader.First, search: mocks.searchFirstSource, source: 'first'},
	{name: 'Secondary', Loader: VariantLoader.Secondary, search: mocks.searchSecondarySource, source: 'second'},
	{name: 'Third', Loader: VariantLoader.Third, search: mocks.searchThirdSource, source: 'third'},
] as const;

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
			source: 'second',
			title: 'Дополнительный результат',
			url: 'https://secondary.example/topic',
		};
		const primary: ISearchResult = {
			source: 'first',
			title: 'Основной результат',
			url: 'https://primary.example/topic',
		};
		const nmoApi: ISearchResult = {
			source: 'nmo-helper',
			title: 'Результат NMO API',
			url: `${NMO_API_TOPIC_ENDPOINT}/short-lived.uid`,
		};
		const third: ISearchResult = {
			source: 'third',
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
				firstLoading: false,
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
			source: 'second',
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
				firstLoading: false,
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
				firstLoading: false,
				error: 'ничего не найдено',
				data: [],
			});
		});
	});

	it('отдаёт результаты по мере загрузки и ждёт завершения остальных источников', async () => {
		const requests = new Map<ISearchResult['source'], {
			resolve: (results: ISearchResult[]) => void;
			reject: (error: Error) => void;
		}>();
		for (const {search, source} of sourceLoaders) {
			search.mockImplementation(() => new Promise<ISearchResult[]>((resolve, reject) => {
				requests.set(source, {resolve, reject});
			}));
		}
		const first: ISearchResult = {source: 'first', title: 'Первый результат', url: 'https://first.example/topic'};
		const third: ISearchResult = {source: 'third', title: 'Поздний результат', url: 'https://third.example/topic'};
		const onChange = vi.fn();

		const {container} = render(<VariantLoader text="Тема" onChange={onChange}/>);

		expect(container).toBeEmptyDOMElement();
		expect(requests.size).toBe(4);
		expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: true, error: null, data: []});

		await act(async () => { requests.get('first')!.resolve([first]); });
		expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: false, error: null, data: [first]});

		await act(async () => { requests.get('second')!.reject(new Error('источник недоступен')); });
		expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: false, error: null, data: [first]});

		await act(async () => { requests.get('nmo-helper')!.resolve([]); });
		expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: false, error: null, data: [first]});

		await act(async () => { requests.get('third')!.resolve([third]); });
		expect(onChange).toHaveBeenLastCalledWith({loading: false, firstLoading: false, error: null, data: [first, third]});
	});

	it('не сообщает об отсутствии результатов до завершения последнего источника', async () => {
		let finishSearch!: (results: ISearchResult[]) => void;
		mocks.searchThirdSource.mockReturnValue(new Promise<ISearchResult[]>(resolve => { finishSearch = resolve; }));
		const onChange = vi.fn();

		render(<VariantLoader text="Тема" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: false, error: null, data: []});
		});
		await act(async () => { finishSearch([]); });
		expect(onChange).toHaveBeenLastCalledWith({loading: false, firstLoading: false, error: 'ничего не найдено', data: []});
	});

	it('сбрасывает модель для нового запроса и игнорирует запоздавшие результаты старого', async () => {
		let finishPrevious!: (results: ISearchResult[]) => void;
		const previous = new Promise<ISearchResult[]>(resolve => { finishPrevious = resolve; });
		const result: ISearchResult = {source: 'first', title: 'Новая тема', url: 'https://example.com/new'};
		mocks.searchFirstSource.mockReturnValueOnce(previous).mockResolvedValueOnce([result]);
		const onChange = vi.fn();
		const {rerender} = render(<VariantLoader text="Старая тема" onChange={onChange}/>);

		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: false, error: null, data: []});
		});
		rerender(<VariantLoader text="Новая тема" onChange={onChange}/>);
		expect(onChange).toHaveBeenLastCalledWith({loading: true, firstLoading: true, error: null, data: []});
		await waitFor(() => {
			expect(onChange).toHaveBeenLastCalledWith({loading: false, firstLoading: false, error: null, data: [result]});
		});
		onChange.mockClear();
		await act(async () => { finishPrevious([{...result, title: 'Старая тема'}]); });
		expect(onChange).not.toHaveBeenCalled();
	});

	it('использует актуальный обработчик без перезапуска поиска', async () => {
		let finishSearch!: (results: ISearchResult[]) => void;
		mocks.searchFirstSource.mockReturnValue(new Promise<ISearchResult[]>(resolve => { finishSearch = resolve; }));
		const onChange = vi.fn();
		const nextOnChange = vi.fn();
		const {rerender} = render(<VariantLoader text="Тема" onChange={onChange}/>);

		rerender(<VariantLoader text="Тема" onChange={nextOnChange}/>);
		await act(async () => { finishSearch([]); });

		expect(nextOnChange).toHaveBeenLastCalledWith({loading: false, firstLoading: false, error: 'ничего не найдено', data: []});
		for (const search of Object.values(mocks)) expect(search).toHaveBeenCalledExactlyOnceWith('Тема');
	});

	it.each([null, '', '   '])('сбрасывает общую модель для пустого запроса %j', text => {
		const onChange = vi.fn();
		render(<VariantLoader text={text} onChange={onChange}/>);

		expect(onChange).toHaveBeenLastCalledWith({loading: false, firstLoading: false, error: null, data: []});
		for (const search of Object.values(mocks)) expect(search).not.toHaveBeenCalled();
	});

	describe.each(sourceLoaders)('VariantLoader.$name', ({Loader, search, source}) => {
		it('ищет только в своём источнике и передаёт состояние загрузки', async () => {
			const result: ISearchResult = {source, title: 'Найденная тема', url: 'https://example.com/topic'};
			search.mockResolvedValue([result]);
			const onChange = vi.fn();

			const {container} = render(<Loader text="  Диагностика  " onChange={onChange}/>);

			expect(container).toBeEmptyDOMElement();
			expect(onChange).toHaveBeenNthCalledWith(1, {loading: true, error: null, data: []});
			await waitFor(() => {
				expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: [result]});
			});
			expect(search).toHaveBeenCalledExactlyOnceWith('Диагностика');
			for (const otherSearch of Object.values(mocks).filter(mock => mock !== search)) {
				expect(otherSearch).not.toHaveBeenCalled();
			}
		});

		it.each([null, '', '   '])('сбрасывает состояние для пустого запроса %j без поиска', text => {
			const onChange = vi.fn();

			render(<Loader text={text} onChange={onChange}/>);

			expect(onChange).toHaveBeenCalledExactlyOnceWith({loading: false, error: null, data: []});
			for (const searchSource of Object.values(mocks)) expect(searchSource).not.toHaveBeenCalled();
		});

		it('возвращает пустой результат без ошибки', async () => {
			const onChange = vi.fn();

			render(<Loader text="Тема" onChange={onChange}/>);

			await waitFor(() => {
				expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: []});
			});
		});

		it('передаёт ошибку источника отдельно от пустого результата', async () => {
			search.mockRejectedValue(new Error('источник недоступен'));
			const onChange = vi.fn();

			render(<Loader text="Тема" onChange={onChange}/>);

			await waitFor(() => {
				expect(onChange).toHaveBeenLastCalledWith({loading: false, error: 'источник недоступен', data: []});
			});
		});

		it('игнорирует результат предыдущего запроса после смены текста', async () => {
			let finishPrevious!: (results: ISearchResult[]) => void;
			const previous = new Promise<ISearchResult[]>(resolve => { finishPrevious = resolve; });
			const result: ISearchResult = {source, title: 'Новая тема', url: 'https://example.com/new'};
			search.mockReturnValueOnce(previous).mockResolvedValueOnce([result]);
			const onChange = vi.fn();
			const {rerender} = render(<Loader text="Старая тема" onChange={onChange}/>);

			rerender(<Loader text="Новая тема" onChange={onChange}/>);
			await waitFor(() => {
				expect(onChange).toHaveBeenLastCalledWith({loading: false, error: null, data: [result]});
			});
			onChange.mockClear();
			await act(async () => { finishPrevious([]); });

			expect(search).toHaveBeenNthCalledWith(2, 'Новая тема');
			expect(onChange).not.toHaveBeenCalled();
		});

		it('игнорирует результат после размонтирования', async () => {
			let finishSearch!: (results: ISearchResult[]) => void;
			search.mockReturnValue(new Promise<ISearchResult[]>(resolve => { finishSearch = resolve; }));
			const onChange = vi.fn();
			const {unmount} = render(<Loader text="Тема" onChange={onChange}/>);

			unmount();
			onChange.mockClear();
			await act(async () => { finishSearch([]); });

			expect(onChange).not.toHaveBeenCalled();
		});
	});
});
