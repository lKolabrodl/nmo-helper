import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageSet } from '../utils';

export type UiMode = 'sites' | 'ai' | 'auto' | 'ai-pro';

interface IPanelUiState {
	readonly collapsed: boolean;
	readonly setCollapsed: (v: boolean) => void;
	readonly mode: UiMode;
	readonly setMode: (v: UiMode) => void;
}

interface IPanelUiProviderProps {
	readonly initialCollapsed: boolean;
	readonly initialMode: string;
}

const PanelUiContext = createContext<IPanelUiState>(null!);

const VALID_MODES: UiMode[] = ['sites', 'ai', 'auto', 'ai-pro'];

export const PanelUiProvider: React.FC<React.PropsWithChildren<IPanelUiProviderProps>> = ({ initialCollapsed, initialMode, children }) => {
	const [collapsed, setCollapsedRaw] = useState(initialCollapsed);
	const [mode, setModeRaw] = useState<UiMode>(
		VALID_MODES.includes(initialMode as UiMode) ? initialMode as UiMode : 'sites'
	);

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
