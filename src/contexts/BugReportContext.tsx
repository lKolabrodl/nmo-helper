import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {BugReportMode} from '../types';

export interface IBugReportContextSnapshot {
	readonly mode: BugReportMode | '';
	readonly url: string;
}

interface IBugReportContextState extends IBugReportContextSnapshot {
	readonly setBugReportContext: (next: IBugReportContextSnapshot) => void;
}

const EMPTY_CONTEXT: IBugReportContextSnapshot = {
	mode: '',
	url: '',
};

const BugReportContext = createContext<IBugReportContextState>({
	...EMPTY_CONTEXT,
	setBugReportContext: () => undefined,
});

export const BugReportProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const [snapshot, setSnapshot] = useState<IBugReportContextSnapshot>(EMPTY_CONTEXT);

	const setBugReportContext = useCallback((next: IBugReportContextSnapshot) => {
		setSnapshot(prev => {
			if (next.mode === prev.mode && next.url === prev.url) {
				return prev;
			}
			return next;
		});
	}, []);

	const value = useMemo<IBugReportContextState>(() => ({
		...snapshot,
		setBugReportContext,
	}), [snapshot, setBugReportContext]);

	return (
		<BugReportContext.Provider value={value}>
			{children}
		</BugReportContext.Provider>
	);
};

export const useBugReportContext = () => useContext(BugReportContext);
