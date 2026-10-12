import {useEffect, useRef} from 'react';
import {fetchModels, getCachedModels} from '../../api/fetch/fetch-models';
import type {IAiModel} from '../../types';

export interface IAiModelLoaderState {
	readonly models: IAiModel[];
	readonly loading: boolean;
	readonly fresh: boolean;
	readonly error: string;
	readonly warning: string;
}

interface IAiModelLoaderProps {
	readonly apiKey: string;
	readonly onChange: (state: IAiModelLoaderState) => void;
}

/** Загружает кэш и обновляет модели при переходе на ProxyAPI или смене ключа. */
const AIModelLoader = ({apiKey, onChange}: IAiModelLoaderProps) => {
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		let cancelled = false;
		let state: IAiModelLoaderState = {models: [], loading: true, fresh: false, error: '', warning: ''};
		const publish = (next: Partial<IAiModelLoaderState>) => {
			state = {...state, ...next};
			onChangeRef.current(state);
		};
		onChangeRef.current(state);

		void getCachedModels(apiKey).then(cached => {
			if (!cancelled && !state.fresh) publish({models: cached});
		}).catch(() => { /* Ошибка чтения кэша не мешает свежему запросу. */ });

		// Не отправляем запрос на каждый символ вводимого ключа.
		const timer = setTimeout(() => {
			void fetchModels(apiKey).then(result => {
				if (cancelled) return;
				publish({models: result.models, fresh: true, warning: result.warning ?? ''});
			}).catch((error: unknown) => {
				if (!cancelled) publish({error: error instanceof Error ? error.message : 'не удалось обновить модели ProxyAPI'});
			}).finally(() => {
				if (!cancelled) publish({loading: false});
			});
		}, apiKey ? 400 : 0);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [apiKey]);

	return null;
};

export default AIModelLoader;
