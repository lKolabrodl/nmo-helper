import React, {createContext, useContext, useState} from 'react';
import {Status} from '../types';
import type {IStatusInfo} from '../types';

interface IPanelStatusState {
	readonly status: IStatusInfo;
	readonly setStatus: (s: IStatusInfo) => void;
}

const IDLE: IStatusInfo = {title: '', status: Status.IDLE};

const PanelStatusContext = createContext<IPanelStatusState>(null!);

/**
 * Провайдер статуса панели.
 *
 * Хранит один статус активной секции. TabBar сбрасывает его перед сменой
 * режима, поэтому эффект инициализации новой секции уже не конфликтует
 * с отложенным сбросом статуса.
 */
export const PanelStatusProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const [status, setStatus] = useState<IStatusInfo>(IDLE);

	return (
		<PanelStatusContext.Provider value={{status, setStatus}}>
			{children}
		</PanelStatusContext.Provider>
	);
};

/** Хук для доступа к статусу панели */
export const usePanelStatus = () => useContext(PanelStatusContext);
