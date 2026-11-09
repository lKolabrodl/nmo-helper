import {useEffect, useRef} from 'react';
import type {ISearchResult} from '../../types';
import {searchFirstSource, searchNmoSource, searchSecondarySource, searchThirdSource} from '../../api/fetch/search-variant-sources';

// не грузим если хром - магазин.
const USE_EXTERNAL_SOURCES = __BUILD_TARGET__ !== 'chrome-store';

export interface IVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ISearchResult[];
}

export interface IVariantSearchModel extends IVariantModel {
	/** Ни один из активных источников ещё не завершил поиск. */
	readonly firstLoading: boolean;
}

const INIT_STATE: IVariantModel = {loading: false, error: null, data: []};

interface IVariantLoaderProps {
	readonly text: string | null;
	readonly onChange: (state: IVariantModel) => void;
}

interface IVariantSearchLoaderProps {
	readonly text: string | null;
	readonly onChange: (state: IVariantSearchModel) => void;
}

type SearchSource = (query: string) => Promise<ISearchResult[]>;

const SOURCES = {
	Nmo: [searchNmoSource],
	First: USE_EXTERNAL_SOURCES ? [searchFirstSource] : [],
	Secondary: USE_EXTERNAL_SOURCES ? [searchSecondarySource] : [],
	Third: USE_EXTERNAL_SOURCES ? [searchThirdSource] : [],
};

const useVariantLoader = ({text, onChange}: IVariantLoaderProps, sources: readonly SearchSource[]) => {
	useEffect(() => {
		const query = (text ?? '').trim();
		if (!query) return onChange({...INIT_STATE});

		onChange({loading: true, error: null, data: []});

		let cancelled = false;

		const search = async () => {
			const resultGroups = await Promise.allSettled(sources.map(source => source(query)));

			if (cancelled) return;

			const results = resultGroups.flatMap(result => result.status === 'fulfilled' ? result.value : []);
			const failure = resultGroups.find(result => result.status === 'rejected');
			const error = failure
				? (failure.reason instanceof Error ? failure.reason.message : String(failure.reason)) || 'ошибка поиска'
				: null;

			onChange({loading: false, error: results.length ? null : error, data: results});
		};

		search();

		return () => { cancelled = true; };
	}, [text, sources]);
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

const SOURCE_LOADERS = USE_EXTERNAL_SOURCES ? [Nmo, Secondary, First, Third] : [Nmo];

const VariantSourcesLoader = ({text, onChange}: IVariantSearchLoaderProps) => {
	const modelsRef = useRef<IVariantModel[]>(SOURCE_LOADERS.map(() => ({...INIT_STATE, loading: !!text})));
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const updateModel = (index: number, model: IVariantModel) => {
		modelsRef.current[index] = model;
		const models = modelsRef.current;
		const loading = models.some(state => state.loading);
		const data = models.flatMap(state => state.data);

		onChangeRef.current({
			loading,
			firstLoading: !!text && models.every(state => state.loading),
			error: text && !loading && !data.length ? 'ничего не найдено' : null,
			data,
		});
	};

	return <>{SOURCE_LOADERS.map((Loader, index) => (
		<Loader key={index} text={text} onChange={model => updateModel(index, model)}/>
	))}</>;
};

const VariantLoader = ({text, onChange}: IVariantSearchLoaderProps) => {
	const query = (text ?? '').trim();
	return <VariantSourcesLoader key={query} text={query} onChange={onChange}/>;
};

VariantLoader.Nmo = Nmo;
VariantLoader.First = First;
VariantLoader.Secondary = Secondary;
VariantLoader.Third = Third;

export default VariantLoader;
