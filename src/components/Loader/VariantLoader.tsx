import {useEffect} from 'react';
import type {ISearchResult} from '../../types';
import {searchFirstSource, searchNmoSource, searchSecondarySource, searchThirdSource} from '../../api/fetch/search-answer-sources';

export interface IVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ISearchResult[];
}

const INIT_STATE: IVariantModel = {loading: false, error: null, data: []};

interface IVariantLoaderProps {
	readonly text: string | null;
	readonly onChange: (state: IVariantModel) => void;
}

const VariantLoader = ({text, onChange}: IVariantLoaderProps) => {
	useEffect(() => {
		const query = (text ?? '').trim();
		if (!query) return onChange({...INIT_STATE});

		onChange({loading: true, error: null, data: []});

		let cancelled = false;

		async function search() {
			const resultGroups = await Promise.all([
				searchSecondarySource(query).catch(() => []),
				searchFirstSource(query).catch(() => []),
				searchNmoSource(query).catch(() => []),
				searchThirdSource(query).catch(() => []),
			]);

			if (cancelled) return;

			const results = resultGroups.flat();
			if (!results.length) return onChange({loading: false, error: 'ничего не найдено', data: []});


			onChange({loading: false, error: null, data: results});
		}

		search();

		return () => { cancelled = true; };
	}, [text]);

	return null;
};

export default VariantLoader;
