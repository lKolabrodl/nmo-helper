import React, {createContext, useContext, useState} from 'react';
import {storageSet} from '../utils';
import type {AiProvider, IExtensionState} from '../types';

export const AI_PROVIDER_STORAGE_KEY = 'aiProvider';
export const DEFAULT_AI_PROVIDER: AiProvider = 'free';
export const AUTO_SOLVE_STORAGE_KEY = 'autoSolveTests';
export const AUTO_SOLVE_DELAY_MIN_STORAGE_KEY = 'autoSolveDelayMinSeconds';
export const AUTO_SOLVE_DELAY_MAX_STORAGE_KEY = 'autoSolveDelayMaxSeconds';
export const MIN_AUTO_SOLVE_DELAY_SECONDS = 5;
export const DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS = 5;
export const DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS = 12;

interface ISettingsProviderProps {
	readonly initialState: IExtensionState;
}

interface IProxyAiSettings {
	readonly apiKey: string;
	readonly setApiKey: (apiKey: string) => void;
	readonly model: string;
	readonly setModel: (model: string) => void;
}

interface ICustomAiSettings {
	readonly url: string;
	readonly setUrl: (url: string) => void;
	readonly token: string;
	readonly setToken: (token: string) => void;
	readonly model: string;
	readonly setModel: (model: string) => void;
}

interface IAiSettings {
	readonly provider: AiProvider;
	readonly setProvider: (provider: AiProvider) => void;
	readonly proxy: IProxyAiSettings;
	readonly custom: ICustomAiSettings;
}

interface IAutoSolveSettings {
	readonly enabled: boolean;
	readonly setEnabled: (enabled: boolean) => void;
	readonly delayMinSeconds: number;
	readonly setDelayMinSeconds: (seconds: number) => void;
	readonly delayMaxSeconds: number;
	readonly setDelayMaxSeconds: (seconds: number) => void;
}

interface ISettingsState {
	readonly ai: IAiSettings;
	readonly autoSolve: IAutoSolveSettings;
}

const SettingsContext = createContext<ISettingsState>(null!);

export const SettingsProvider: React.FC<React.PropsWithChildren<ISettingsProviderProps>> = ({initialState, children}) => {

	const initialMin = normalizeDelaySeconds(
		initialState.savedAutoSolveDelayMinSeconds,
		DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS
	);

	const initialMax = Math.max(
		normalizeDelaySeconds(initialState.savedAutoSolveDelayMaxSeconds, DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS),
		initialMin
	);

	const [aiProvider, setAiProviderRaw] = useState(
		normalizeAiProvider(initialState.savedAiProvider, initialState.savedMode)
	);
	const [apiKey, setApiKeyRaw] = useState(initialState.savedApiKey);
	const [aiModel, setAiModelRaw] = useState(initialState.savedModel);
	const [customAiUrl, setCustomAiUrlRaw] = useState(initialState.savedCustomAiUrl);
	const [customAiToken, setCustomAiTokenRaw] = useState(initialState.savedCustomAiToken);
	const [customAiModel, setCustomAiModelRaw] = useState(initialState.savedCustomAiModel);
	const [autoSolveEnabled, setAutoSolveEnabledRaw] = useState(initialState.savedAutoSolveEnabled);
	const [autoSolveDelayMinSeconds, setAutoSolveDelayMinSecondsRaw] = useState(initialMin);
	const [autoSolveDelayMaxSeconds, setAutoSolveDelayMaxSecondsRaw] = useState(initialMax);

	const setAiProvider = (provider: AiProvider): void => {
		setAiProviderRaw(provider);
		storageSet(AI_PROVIDER_STORAGE_KEY, provider);
	};

	const setApiKey = (nextApiKey: string): void => {
		setApiKeyRaw(nextApiKey);
		storageSet('apiKey', nextApiKey);
	};

	const setAiModel = (model: string): void => {
		setAiModelRaw(model);
		storageSet('aiModel', model);
	};

	const setCustomAiUrl = (url: string): void => {
		setCustomAiUrlRaw(url);
		storageSet('customAiUrl', url);
	};

	const setCustomAiToken = (token: string): void => {
		setCustomAiTokenRaw(token);
		storageSet('customAiToken', token);
	};

	const setCustomAiModel = (model: string): void => {
		setCustomAiModelRaw(model);
		storageSet('customAiModel', model);
	};

	const setAutoSolveEnabled = (enabled: boolean): void => {
		setAutoSolveEnabledRaw(enabled);
		storageSet(AUTO_SOLVE_STORAGE_KEY, enabled);
	};

	const setAutoSolveDelayMinSeconds = (seconds: number): void => {
		const nextMin = normalizeDelaySeconds(seconds, autoSolveDelayMinSeconds);

		setAutoSolveDelayMinSecondsRaw(nextMin);
		storageSet(AUTO_SOLVE_DELAY_MIN_STORAGE_KEY, nextMin);

		if (autoSolveDelayMaxSeconds < nextMin) {
			setAutoSolveDelayMaxSecondsRaw(nextMin);
			storageSet(AUTO_SOLVE_DELAY_MAX_STORAGE_KEY, nextMin);
		}
	};

	const setAutoSolveDelayMaxSeconds = (seconds: number): void => {
		const nextMax = Math.max(
			normalizeDelaySeconds(seconds, autoSolveDelayMaxSeconds),
			autoSolveDelayMinSeconds
		);

		setAutoSolveDelayMaxSecondsRaw(nextMax);
		storageSet(AUTO_SOLVE_DELAY_MAX_STORAGE_KEY, nextMax);
	};

	return (
		<SettingsContext.Provider value={{
			ai: {
				provider: aiProvider,
				setProvider: setAiProvider,
				proxy: {
					apiKey,
					setApiKey,
					model: aiModel,
					setModel: setAiModel,
				},
				custom: {
					url: customAiUrl,
					setUrl: setCustomAiUrl,
					token: customAiToken,
					setToken: setCustomAiToken,
					model: customAiModel,
					setModel: setCustomAiModel,
				},
			},
			autoSolve: {
				enabled: autoSolveEnabled,
				setEnabled: setAutoSolveEnabled,
				delayMinSeconds: autoSolveDelayMinSeconds,
				setDelayMinSeconds: setAutoSolveDelayMinSeconds,
				delayMaxSeconds: autoSolveDelayMaxSeconds,
				setDelayMaxSeconds: setAutoSolveDelayMaxSeconds,
			},
		}}>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = () => useContext(SettingsContext);

export function normalizeAiProvider(value: unknown, legacyMode = ''): AiProvider {
	if (value === 'free' || value === 'proxy' || value === 'custom') return value;
	if (legacyMode === 'ai-pro') return 'custom';
	if (legacyMode === 'ai') return 'proxy';
	return DEFAULT_AI_PROVIDER;
}

export function normalizeDelaySeconds(value: unknown, fallback: number): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(MIN_AUTO_SOLVE_DELAY_SECONDS, Math.round(n));
}
