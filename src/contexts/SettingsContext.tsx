import React, {createContext, useContext, useState} from 'react';
import {storageSet} from '../utils';
import type {IExtensionState} from '../types';

export const AUTO_SOLVE_STORAGE_KEY = 'autoSolveTests';
export const AUTO_SOLVE_DELAY_MIN_STORAGE_KEY = 'autoSolveDelayMinSeconds';
export const AUTO_SOLVE_DELAY_MAX_STORAGE_KEY = 'autoSolveDelayMaxSeconds';
export const MIN_AUTO_SOLVE_DELAY_SECONDS = 5;
export const DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS = 5;
export const DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS = 12;

interface ISettingsProviderProps {
	readonly initialState: IExtensionState;
}

interface ISettingsState {
	readonly autoSolveEnabled: boolean;
	readonly setAutoSolveEnabled: (enabled: boolean) => void;
	readonly autoSolveDelayMinSeconds: number;
	readonly setAutoSolveDelayMinSeconds: (seconds: number) => void;
	readonly autoSolveDelayMaxSeconds: number;
	readonly setAutoSolveDelayMaxSeconds: (seconds: number) => void;
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

	const [autoSolveEnabled, setAutoSolveEnabledRaw] = useState(initialState.savedAutoSolveEnabled);
	const [autoSolveDelayMinSeconds, setAutoSolveDelayMinSecondsRaw] = useState(initialMin);
	const [autoSolveDelayMaxSeconds, setAutoSolveDelayMaxSecondsRaw] = useState(initialMax);

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
			autoSolveEnabled,
			setAutoSolveEnabled,
			autoSolveDelayMinSeconds,
			setAutoSolveDelayMinSeconds,
			autoSolveDelayMaxSeconds,
			setAutoSolveDelayMaxSeconds,
		}}>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = () => useContext(SettingsContext);

export function normalizeDelaySeconds(value: unknown, fallback: number): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(MIN_AUTO_SOLVE_DELAY_SECONDS, Math.round(n));
}
