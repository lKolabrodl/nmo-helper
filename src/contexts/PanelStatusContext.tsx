import React, {createContext, useContext, useEffect, useState} from 'react';
import {Status} from '../types';
import type {IStatusInfo} from '../types';
import {usePanelUi} from './PanelUiContext';

interface IPanelStatusState {
	readonly status: IStatusInfo;
	readonly setStatus: (s: IStatusInfo) => void;
}

const IDLE: IStatusInfo = {title: '', status: Status.IDLE};

const PanelStatusContext = createContext<IPanelStatusState>(null!);

/**
 * Провайдер статуса панели.
 *
 * Хранит ОДИН статус. При смене режима (`mode`) автоматически сбрасывает
 * status в IDLE — секция при unmount теряет свой локальный state
 * (activeUrl/answerModel/aiRunning), поэтому держать «работает» из прошлой
 * сессии бессмысленно и приводит к рассогласованности UI.
 */
export const PanelStatusProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const {mode} = usePanelUi();
	const [status, setStatus] = useState<IStatusInfo>(IDLE);

	useEffect(() => {
		setStatus(IDLE);
	}, [mode]);

	return (
		<PanelStatusContext.Provider value={{status, setStatus}}>
			{children}
		</PanelStatusContext.Provider>
	);
};

/** Хук для доступа к статусу панели */
export const usePanelStatus = () => useContext(PanelStatusContext);
