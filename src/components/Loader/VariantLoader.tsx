import {useEffect} from 'react';
import type {ISearchResult} from '../../types';
import {searchFirstSource, searchNmoSource, searchSecondarySource, searchThirdSource} from '../../api/fetch/search-variant-sources';

// не грузим если хром - магазин.
const USE_EXTERNAL_SOURCES = __BUILD_TARGET__ !== 'chrome-store';

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

type SearchSource = (query: string) => Promise<ISearchResult[]>;

const SOURCES = {
	Nmo: [searchNmoSource],
	First: USE_EXTERNAL_SOURCES ? [searchFirstSource] : [],
	Secondary: USE_EXTERNAL_SOURCES ? [searchSecondarySource] : [],
	Third: USE_EXTERNAL_SOURCES ? [searchThirdSource] : [],
};
const ALL_SOURCES = [...SOURCES.Nmo, ...SOURCES.Secondary, ...SOURCES.First, ...SOURCES.Third];

const useVariantLoader = ({text, onChange}: IVariantLoaderProps, sources: readonly SearchSource[]) => {
	useEffect(() => {
		const query = (text ?? '').trim();
		if (!query) return onChange({...INIT_STATE});

		onChange({loading: true, error: null, data: []});

		let cancelled = false;

		const search = async () => {
			const resultGroups = await Promise.all(sources.map(source => source(query).catch(() => [])));

			if (cancelled) return;

			const results = resultGroups.flat();
			if (!results.length) return onChange({loading: false, error: 'ничего не найдено', data: []});

			onChange({loading: false, error: null, data: results});
		};

		search();

		return () => { cancelled = true; };
	}, [text, sources]);
};

const VariantLoader = (props: IVariantLoaderProps) => {
	useVariantLoader(props, ALL_SOURCES);
	return null;
};

const Nmo = (props: IVariantLoaderProps) => {
	useVariantLoader(props, SOURCES.Nmo);
	return null;
};

const First = (props: IVariantLoaderProps) => {
	useVariantLoader(props, SOURCES.First);
	return null;
};

const Secondary = (props: IVariantLoaderProps) => {
	useVariantLoader(props, SOURCES.Secondary);
	return null;
};

const Third = (props: IVariantLoaderProps) => {
	useVariantLoader(props, SOURCES.Third);
	return null;
};

VariantLoader.Nmo = Nmo;
VariantLoader.First = First;
VariantLoader.Secondary = Secondary;
VariantLoader.Third = Third;

export default VariantLoader;
