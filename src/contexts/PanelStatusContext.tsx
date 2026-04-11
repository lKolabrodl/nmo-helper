import React, { createContext, useCallback, useContext, useState } from 'react';
import { Status } from '../types';
import type { IStatusInfo } from '../types';
import { usePanelUi } from './PanelUiContext';
import type { UiMode } from './PanelUiContext';

interface IPanelStatusState {
	readonly status: IStatusInfo;
	readonly setStatus: (s: IStatusInfo) => void;
}

const IDLE: IStatusInfo = { title: '', status: Status.IDLE };

const PanelStatusContext = createContext<IPanelStatusState>(null!);

type StatusMap = Record<UiMode, IStatusInfo>;

const INIT_MAP: StatusMap = {
	'auto': { ...IDLE },
	'sites': { ...IDLE },
	'ai': { ...IDLE },
	'ai-pro': { ...IDLE },
};

/**
 * Провайдер статуса панели (per-mode).
 *
 * Хранит отдельный статус для каждого режима.
 * `status` возвращает статус текущего режима,
 * `setStatus` пишет в слот текущего режима.
 */
export const PanelStatusProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
	const { mode } = usePanelUi();
	const [statuses, setStatuses] = useState<StatusMap>(INIT_MAP);

	const setStatus = useCallback((s: IStatusInfo) => {
		setStatuses(prev => prev[mode] === s ? prev : { ...prev, [mode]: s });
	}, [mode]);

	const value: IPanelStatusState = { status: statuses[mode], setStatus };

	return (
		<PanelStatusContext.Provider value={value}>
			{children}
		</PanelStatusContext.Provider>
	);
};

/** Хук для доступа к статусу панели */
export const usePanelStatus = () => useContext(PanelStatusContext);
