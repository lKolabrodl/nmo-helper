import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageSet } from '../utils';
import type {IExtensionState} from '../types';

export type UiMode = 'sites' | 'ai' | 'auto' | 'pdf';

interface IPanelUiState {
	readonly collapsed: boolean;
	readonly setCollapsed: (v: boolean) => void;
	readonly mode: UiMode;
	readonly setMode: (v: UiMode) => void;
}

interface IPanelUiProviderProps {
	readonly initialState: IExtensionState;
}

const PanelUiContext = createContext<IPanelUiState>(null!);

const VALID_MODES: UiMode[] = ['sites', 'ai', 'auto', 'pdf'];

export function normalizeUiMode(mode: string): UiMode {
	if (mode === 'ai-pro') return 'ai';
	return VALID_MODES.includes(mode as UiMode) ? mode as UiMode : 'sites';
}

export const PanelUiProvider: React.FC<React.PropsWithChildren<IPanelUiProviderProps>> = ({ initialState, children }) => {
	const [collapsed, setCollapsedRaw] = useState(initialState.savedCollapsed);
	const [mode, setModeRaw] = useState<UiMode>(normalizeUiMode(initialState.savedMode));

	const setCollapsed = (v: boolean) => { setCollapsedRaw(v); storageSet('panelCollapsed', v); };

	const setMode = (v: UiMode) => {
		setModeRaw(v);
		storageSet('mode', v);
	};

	useEffect(() => {
		const panel = document.getElementById('nmo-panel');
		if (panel) panel.classList.toggle('collapsed', collapsed);
	}, [collapsed]);

	return (
		<PanelUiContext.Provider value={{ collapsed, setCollapsed, mode, setMode }}>
			{children}
		</PanelUiContext.Provider>
	);
};

export const usePanelUi = () => useContext(PanelUiContext);
