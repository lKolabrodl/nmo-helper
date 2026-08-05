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
	{source: 'secondary', title: 'Результат 24forcare', url: 'https://24forcare.com/result'},
	{source: 'primary', title: 'Результат Rosmed', url: 'https://rosmedicinfo.ru/result'},
	{source: 'foo', title: 'Результат foo', url: 'https://foo.example/result'},
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
			'Результат Rosmed',
			'Результат 24forcare',
			'Результат NMO Helper',
			'Результат foo',
		]);

		expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
		expect(buttons[1]).toHaveClass('selected');
		expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');

		fireEvent.click(buttons[1]);
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
});
