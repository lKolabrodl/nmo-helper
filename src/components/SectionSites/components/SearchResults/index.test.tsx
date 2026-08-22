import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ISearchResult} from '../../../../types';
import SearchResults from './index';

const RESULTS: ISearchResult[] = [
	{
		source: 'nmo-helper',
		title: 'Результат NMO Helper',
		url: 'https://nmo-helper.ru/api/nmo/topic/short-lived.uid',
	},
	{source: 'second', title: 'Результат 24forcare', url: 'https://24forcare.com/result'},
	{source: 'first', title: 'Результат Rosmed', url: 'https://rosmedicinfo.ru/result'},
	{source: 'third', title: 'Результат foo', url: 'https://foo.example/result'},
];

describe('SearchResults', () => {
	it('не отображается без результатов', () => {
		const {container} = render(<SearchResults results={[]} selectedUrl="" onSelect={vi.fn()}/>);

		expect(container).toBeEmptyDOMElement();
	});

	it('сортирует источники по приоритету и передаёт выбранный результат', () => {
		const onSelect = vi.fn();
		render(<SearchResults results={RESULTS} selectedUrl={RESULTS[1].url} onSelect={onSelect}/>);

		const buttons = screen.getAllByRole('button');
		expect(buttons.map(button => button.title)).toEqual([
			'Результат NMO Helper',
			'Результат Rosmed',
			'Результат 24forcare',
			'Результат foo',
		]);

		expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
		expect(buttons[2]).toHaveClass('selected');
		expect(buttons[2]).toHaveAttribute('aria-pressed', 'true');

		fireEvent.click(buttons[2]);
		expect(onSelect).toHaveBeenCalledWith(RESULTS[1]);
	});

	it('различает API-результаты по URL с UID', () => {
		const apiResults: ISearchResult[] = [
			{source: 'nmo-helper', title: 'Первый', url: 'https://nmo-helper.ru/api/nmo/topic/uid.one'},
			{source: 'nmo-helper', title: 'Второй', url: 'https://nmo-helper.ru/api/nmo/topic/uid.two'},
		];

		render(
			<SearchResults
				results={apiResults}
				selectedUrl={apiResults[1].url}
				onSelect={vi.fn()}/>,
		);

		const buttons = screen.getAllByRole('button');
		expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
		expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
	});

	it('убирает служебный префикс из отображаемого заголовка', () => {
		const onSelect = vi.fn();
		const result: ISearchResult = {
			source: 'first',
			title: 'Ответы к тестам НМО:   "Кардиология - 2024"',
			url: 'https://rosmedicinfo.ru/cardiology',
		};

		render(<SearchResults results={[result]} selectedUrl="" onSelect={onSelect}/>);

		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('title', '"Кардиология - 2024"');
		expect(screen.getByText('"Кардиология - 2024"')).toBeInTheDocument();

		fireEvent.click(button);
		expect(onSelect).toHaveBeenCalledWith(result);
	});
});
