import React from 'react';
import cn from 'classnames';
import './styles.scss';
import type {ISearchResult} from '../../../../types';
import {IconStar} from '../../../icons';
import {SOURCE_DETAILS} from '../../utils';

interface ISearchResultsProps {
	readonly results: readonly ISearchResult[];
	readonly selectedUrl: string;
	readonly selectedTicket?: string;
	readonly onSelect: (result: ISearchResult) => void;
}

const SearchResults: React.FC<ISearchResultsProps> = ({results, selectedUrl, selectedTicket = '', onSelect}) => {
	if (!results.length) return null;

	const sortedResults = [...results].sort((a, b) => {
		return SOURCE_DETAILS[a.source].priority - SOURCE_DETAILS[b.source].priority;
	});

	return (
		<div className="nmo-results nmo-fade-up">
			<div className="nmo-results-list">
				{sortedResults.map(result => {
					const source = SOURCE_DETAILS[result.source];
					const resultTicket = result.ticket ?? '';
					const isSelected = result.url === selectedUrl && resultTicket === selectedTicket;

					return (
						<button
							key={`${result.source}:${result.url}:${resultTicket}`}
							type="button"
							className={cn('nmo-results-item', source.className, {selected: isSelected})}
							title={result.title}
							aria-pressed={isSelected}
							onClick={() => onSelect(result)}>
							<div className="nmo-results-title">{result.title}</div>
							<div className="nmo-results-meta-row">
								<span className={cn('nmo-results-src', source.className)}>
									{source.label}
									{result.source === 'primary' && <> <IconStar size={9}/></>}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
};

export default SearchResults;
